/**
 * Support Chat Widget — IIFE entry point.
 *
 * Customers embed this with:
 * <script src="https://cdn.scalemule.com/support-widget.js" data-api-key="pb_..."></script>
 *
 * The script auto-initializes by reading the data-api-key from its own <script> tag.
 */
import { ChatController, type ChatControllerState } from '../shared/ChatController';
import { SupportClient } from '../support';
import type { SupportConversation, SupportWidgetConfig, SupportWidgetPreChatField } from '../support';
import type { Attachment, ChatMessage, ReadStatus } from '../types';
import {
  ATTACH_ICON,
  CHAT_BUBBLE_ICON,
  CLOSE_ICON,
  MINIMIZE_ICON,
  REACTION_ICON,
  SEND_ICON,
} from './icons';
import { WIDGET_STYLES } from './styles';
import * as storage from './storage';

interface SupportWidgetOptions {
  color?: string;
  position?: 'left' | 'right';
}

interface PendingAttachment {
  id: string;
  fileName: string;
  progress: number;
  attachment?: Attachment;
  error?: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '👀'];

const DEFAULT_WIDGET_CONFIG: SupportWidgetConfig = {
  title: 'Support',
  subtitle: 'We typically reply within a few minutes',
  primary_color: '#2563eb',
  position: 'right',
  pre_chat_fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email', required: false },
  ],
  business_hours: {},
  realtime_enabled: false,
  welcome_message: 'Hi! How can we help?',
  offline_message: "We're currently offline. Leave a message!",
  reps_online: false,
  online_count: 0,
};

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmptyState(conversationId = ''): ChatControllerState {
  return {
    conversationId,
    messages: [],
    readStatuses: [],
    typingUsers: [],
    members: [],
    hasMore: false,
    isLoading: false,
    error: null,
  };
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDateLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function isSameDay(left: string, right: string): boolean {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

function tintColor(hex: string, amount: number): string {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return hex;
  }

  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;

  const adjust = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel + amount * 255)))
      .toString(16)
      .padStart(2, '0');

  return `#${adjust(red)}${adjust(green)}${adjust(blue)}`;
}

function inferMessageType(content: string, attachments: Attachment[]): 'text' | 'image' | 'file' {
  if (!attachments.length) return 'text';
  if (!content && attachments.every((attachment) => attachment.mime_type.startsWith('image/'))) {
    return 'image';
  }
  return 'file';
}

function getReadTimestamp(readStatuses: ReadStatus[], userId?: string | null): string | null {
  if (!userId) return null;
  return readStatuses.find((status) => status.user_id === userId)?.last_read_at ?? null;
}

function buildOptimisticMessage(
  senderId: string,
  content: string,
  attachments: Attachment[],
): ChatMessage {
  return {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender_id: senderId,
    sender_type: 'human',
    content,
    message_type: inferMessageType(content, attachments),
    attachments,
    reactions: [],
    is_edited: false,
    created_at: new Date().toISOString(),
  };
}

function renderAttachmentHtml(messageId: string, attachment: Attachment): string {
  const fileName = escapeHtml(attachment.file_name);
  const src = escapeHtml(attachment.presigned_url);
  const fileId = escapeHtml(attachment.file_id);

  if (!attachment.presigned_url) {
    return `<div class="sm-attachment sm-attachment-link" data-file-id="${fileId}" data-message-id="${escapeHtml(messageId)}">${fileName}</div>`;
  }

  if (attachment.mime_type.startsWith('image/')) {
    return `<img class="sm-attachment sm-attachment-image" src="${src}" alt="${fileName}" loading="lazy" />`;
  }

  if (attachment.mime_type.startsWith('video/')) {
    return `<video class="sm-attachment sm-attachment-video" src="${src}" controls preload="metadata"></video>`;
  }

  if (attachment.mime_type.startsWith('audio/')) {
    return `<audio class="sm-attachment sm-attachment-audio" src="${src}" controls preload="metadata"></audio>`;
  }

  return `<a class="sm-attachment sm-attachment-link" href="${src}" target="_blank" rel="noreferrer">${fileName}</a>`;
}

class SupportWidget {
  private root: HTMLElement;
  private shadow: ShadowRoot;
  private client: SupportClient;
  private options: SupportWidgetOptions;
  private config: SupportWidgetConfig = DEFAULT_WIDGET_CONFIG;
  private configLoaded = false;
  private conversation: SupportConversation | null = null;
  private controller: ChatController | null = null;
  private runtimeCleanups: Array<() => void> = [];
  private runtimeState: ChatControllerState = buildEmptyState();
  private panelEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;
  private messagesEl: HTMLElement | null = null;
  private typingEl: HTMLElement | null = null;
  private uploadListEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private fileInputEl: HTMLInputElement | null = null;
  private chatShellEl: HTMLElement | null = null;
  private errorBannerEl: HTMLElement | null = null;
  private isOpen = false;
  private unreadCount = 0;
  private unreadMarkerTimestamp: string | null = null;
  private shouldScrollToUnread = false;
  private fallbackNotice: string | null = null;
  private activeErrorMessage: string | null = null;
  private realtimeFallbackActive = false;
  private pendingAttachments: PendingAttachment[] = [];
  private openReactionMessageId: string | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private typingStopTimer: ReturnType<typeof setTimeout> | null = null;
  private realtimeStatusCleanups: Array<() => void> = [];

  constructor(apiKey: string, apiBaseUrl?: string, options: SupportWidgetOptions = {}) {
    this.client = new SupportClient({ apiKey, apiBaseUrl });
    this.options = options;

    this.root = document.createElement('div');
    this.root.id = 'scalemule-support-widget';
    this.shadow = this.root.attachShadow({ mode: 'closed' });

    this.applyConfigTheme();

    const style = document.createElement('style');
    style.textContent = WIDGET_STYLES;
    this.shadow.appendChild(style);

    this.renderBubble();
    document.body.appendChild(this.root);
  }

  private applyConfigTheme(): void {
    const color = this.options.color ?? this.config.primary_color ?? DEFAULT_WIDGET_CONFIG.primary_color;
    const position = this.options.position ?? this.config.position ?? DEFAULT_WIDGET_CONFIG.position;
    const hover = tintColor(color, -0.12);
    const disabled = tintColor(color, 0.22);

    this.root.style.setProperty('--sm-primary', color);
    this.root.style.setProperty('--sm-primary-hover', hover);
    this.root.style.setProperty('--sm-primary-disabled', disabled);
    this.root.style.setProperty('--sm-position', position);
    this.root.style.setProperty('--sm-bubble-left', position === 'left' ? '20px' : 'auto');
    this.root.style.setProperty('--sm-bubble-right', position === 'right' ? '20px' : 'auto');
    this.root.style.setProperty('--sm-panel-left', position === 'left' ? '20px' : 'auto');
    this.root.style.setProperty('--sm-panel-right', position === 'right' ? '20px' : 'auto');
  }

  private async ensureConfigLoaded(): Promise<void> {
    if (this.configLoaded) return;

    try {
      const remoteConfig = await this.client.getWidgetConfig();
      this.config = {
        ...DEFAULT_WIDGET_CONFIG,
        ...remoteConfig,
        primary_color:
          this.options.color ?? remoteConfig.primary_color ?? DEFAULT_WIDGET_CONFIG.primary_color,
        position: this.options.position ?? remoteConfig.position ?? DEFAULT_WIDGET_CONFIG.position,
      };
    } catch {
      this.config = {
        ...DEFAULT_WIDGET_CONFIG,
        primary_color: this.options.color ?? DEFAULT_WIDGET_CONFIG.primary_color,
        position: this.options.position ?? DEFAULT_WIDGET_CONFIG.position,
      };
    }

    this.configLoaded = true;
    this.applyConfigTheme();
  }

  private renderBubble(): void {
    const bubble = document.createElement('button');
    bubble.className = 'sm-bubble';
    bubble.innerHTML = CHAT_BUBBLE_ICON;
    bubble.setAttribute('aria-label', 'Open support chat');
    bubble.addEventListener('click', () => {
      void this.toggle();
    });
    this.shadow.appendChild(bubble);
  }

  private renderPanel(): void {
    if (this.panelEl) return;

    const panel = document.createElement('div');
    panel.className = 'sm-panel sm-hidden';
    panel.innerHTML = `
      <div class="sm-header">
        <div class="sm-header-copy">
          <div class="sm-header-title"></div>
          <div class="sm-header-status">
            <span class="sm-status-dot"></span>
            <span class="sm-status-label"></span>
          </div>
          <div class="sm-header-subtitle"></div>
        </div>
        <div class="sm-header-actions">
          <button class="sm-header-btn sm-minimize-btn" aria-label="Minimize">${MINIMIZE_ICON}</button>
          <button class="sm-header-btn sm-close-btn" aria-label="Close">${CLOSE_ICON}</button>
        </div>
      </div>
      <div class="sm-error" hidden></div>
      <div class="sm-body"></div>
      <div class="sm-footer">Powered by <a href="https://scalemule.com" target="_blank" rel="noopener">ScaleMule</a></div>
    `;

    panel.querySelector('.sm-minimize-btn')!.addEventListener('click', () => this.minimize());
    panel.querySelector('.sm-close-btn')!.addEventListener('click', () => this.minimize());

    this.panelEl = panel;
    this.bodyEl = panel.querySelector('.sm-body');
    this.errorBannerEl = panel.querySelector('.sm-error');
    this.shadow.appendChild(panel);
    this.updateHeader();
  }

  private updateHeader(): void {
    if (!this.panelEl) return;

    const titleEl = this.panelEl.querySelector('.sm-header-title');
    const subtitleEl = this.panelEl.querySelector('.sm-header-subtitle');
    const statusDotEl = this.panelEl.querySelector('.sm-status-dot');
    const statusLabelEl = this.panelEl.querySelector('.sm-status-label');

    if (!titleEl || !subtitleEl || !statusDotEl || !statusLabelEl) return;

    const visitorId = this.client.visitorUserId;
    const repMembers = this.runtimeState.members.filter((member) => member.userId !== visitorId);
    const repStatuses = repMembers.map((member) => member.status);

    let online = this.config.reps_online;
    let label = this.config.reps_online ? 'Online' : 'Away';

    if (repStatuses.length) {
      if (repStatuses.some((status) => status === 'online')) {
        online = true;
        label = 'Online';
      } else if (repStatuses.some((status) => status === 'away' || status === 'dnd')) {
        online = false;
        label = 'Away';
      } else {
        online = false;
        label = 'Away';
      }
    }

    titleEl.textContent = this.config.title;
    subtitleEl.textContent = online ? this.config.subtitle : this.config.offline_message;
    statusLabelEl.textContent = online ? label : "We'll respond soon";
    statusDotEl.className = `sm-status-dot ${online ? 'sm-status-dot-online' : 'sm-status-dot-away'}`;
  }

  private renderError(message: string | null): void {
    this.activeErrorMessage = message;
    this.syncErrorBanner();
  }

  private setFallbackNotice(message: string | null): void {
    this.fallbackNotice = message;
    this.syncErrorBanner();
  }

  private syncErrorBanner(): void {
    if (!this.errorBannerEl) return;

    const message = this.activeErrorMessage ?? this.fallbackNotice;

    if (!message) {
      this.errorBannerEl.hidden = true;
      this.errorBannerEl.textContent = '';
      return;
    }

    this.errorBannerEl.hidden = false;
    this.errorBannerEl.textContent = message;
  }

  private getConfiguredPreChatFields(): SupportWidgetPreChatField[] {
    if (!this.config.pre_chat_fields?.length) {
      return DEFAULT_WIDGET_CONFIG.pre_chat_fields;
    }
    return this.config.pre_chat_fields.filter((field) => field.key !== 'message');
  }

  private renderPreChatForm(): void {
    if (!this.bodyEl) return;

    const fieldsHtml = this.getConfiguredPreChatFields()
      .map((field) => {
        const id = `sm-prechat-${field.key}`;
        const required = field.required ? 'required' : '';
        const label = `${escapeHtml(field.label)}${field.required ? ' *' : ''}`;
        const common = `id="${id}" data-prechat-key="${escapeHtml(field.key)}" placeholder="${escapeHtml(field.label)}" ${required}`;

        const input =
          field.type === 'textarea'
            ? `<textarea ${common}></textarea>`
            : `<input type="${escapeHtml(field.type || 'text')}" ${common} />`;

        return `
          <div class="sm-field">
            <label for="${id}">${label}</label>
            ${input}
          </div>
        `;
      })
      .join('');

    this.bodyEl.dataset.view = 'prechat';
    this.bodyEl.innerHTML = `
      <div class="sm-prechat">
        <div class="sm-prechat-title">Start a conversation</div>
        <div class="sm-prechat-desc">${escapeHtml(
          this.config.reps_online ? this.config.welcome_message : this.config.offline_message,
        )}</div>
        ${fieldsHtml}
        <div class="sm-field">
          <label for="sm-prechat-message">Message *</label>
          <textarea id="sm-prechat-message" placeholder="How can we help?"></textarea>
        </div>
        <div class="sm-upload-list" id="sm-prechat-uploads"></div>
        <div class="sm-prechat-actions">
          <input type="file" id="sm-prechat-file-input" hidden multiple accept="image/*,video/*,audio/*" />
          <button class="sm-attach-btn sm-prechat-attach" type="button" aria-label="Attach files">${ATTACH_ICON}</button>
          <button class="sm-submit-btn" id="sm-start-btn">Start Chat</button>
        </div>
      </div>
    `;

    this.uploadListEl = this.bodyEl.querySelector('#sm-prechat-uploads');
    this.fileInputEl = this.bodyEl.querySelector('#sm-prechat-file-input');
    this.bodyEl.querySelector('#sm-start-btn')?.addEventListener('click', () => {
      void this.handleStartChat();
    });
    this.bodyEl.querySelector('.sm-prechat-attach')?.addEventListener('click', () => {
      this.fileInputEl?.click();
    });
    this.fileInputEl?.addEventListener('change', () => {
      if (this.fileInputEl?.files) {
        void this.handleFilesSelected(Array.from(this.fileInputEl.files));
        this.fileInputEl.value = '';
      }
    });

    this.renderPendingAttachments();
  }

  private ensureChatView(): void {
    if (!this.bodyEl) return;

    if (this.bodyEl.dataset.view !== 'chat') {
      this.bodyEl.dataset.view = 'chat';
      this.bodyEl.innerHTML = `
        <div class="sm-chat-shell" id="sm-chat-shell">
          <div class="sm-messages" id="sm-messages"></div>
          <div class="sm-typing" id="sm-typing"></div>
          <div class="sm-upload-list" id="sm-upload-list"></div>
          <div class="sm-input-area">
            <input type="file" id="sm-file-input" hidden multiple accept="image/*,video/*,audio/*" />
            <button class="sm-attach-btn" id="sm-attach-btn" type="button" aria-label="Attach files">${ATTACH_ICON}</button>
            <textarea class="sm-input" id="sm-input" placeholder="Type a message..." rows="1"></textarea>
            <button class="sm-send-btn" id="sm-send-btn" type="button" aria-label="Send message">${SEND_ICON}</button>
          </div>
        </div>
      `;

      this.chatShellEl = this.bodyEl.querySelector('#sm-chat-shell');
      this.messagesEl = this.bodyEl.querySelector('#sm-messages');
      this.typingEl = this.bodyEl.querySelector('#sm-typing');
      this.uploadListEl = this.bodyEl.querySelector('#sm-upload-list');
      this.inputEl = this.bodyEl.querySelector('#sm-input') as HTMLTextAreaElement;
      this.fileInputEl = this.bodyEl.querySelector('#sm-file-input') as HTMLInputElement;

      this.bodyEl.querySelector('#sm-send-btn')?.addEventListener('click', () => {
        void this.handleSendMessage();
      });

      this.bodyEl.querySelector('#sm-attach-btn')?.addEventListener('click', () => {
        this.fileInputEl?.click();
      });

      this.fileInputEl?.addEventListener('change', () => {
        if (this.fileInputEl?.files) {
          void this.handleFilesSelected(Array.from(this.fileInputEl.files));
          this.fileInputEl.value = '';
        }
      });

      this.inputEl?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          void this.handleSendMessage();
        }
      });

      this.inputEl?.addEventListener('input', () => {
        if (!this.inputEl) return;
        this.inputEl.style.height = 'auto';
        this.inputEl.style.height = `${Math.min(this.inputEl.scrollHeight, 100)}px`;
        this.sendTypingPulse();
      });

      this.messagesEl?.addEventListener('click', (event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const messageId = target.dataset.messageId;
        if (!messageId) return;

        if (action === 'toggle-picker') {
          this.openReactionMessageId =
            this.openReactionMessageId === messageId ? null : messageId;
          this.renderMessages();
          return;
        }

        if (action === 'set-reaction') {
          const emoji = target.dataset.emoji;
          if (!emoji) return;
          this.openReactionMessageId = null;
          void this.handleReaction(messageId, emoji, target.dataset.reacted === 'true');
        }
      });

      this.messagesEl?.addEventListener('scroll', () => {
        this.clearUnreadMarkerIfViewed();
      });

      this.chatShellEl?.addEventListener('dragover', (event) => {
        event.preventDefault();
        this.chatShellEl?.classList.add('sm-dragging');
      });
      this.chatShellEl?.addEventListener('dragleave', (event) => {
        const related = event.relatedTarget as Node | null;
        if (!related || !this.chatShellEl?.contains(related)) {
          this.chatShellEl?.classList.remove('sm-dragging');
        }
      });
      this.chatShellEl?.addEventListener('drop', (event) => {
        event.preventDefault();
        this.chatShellEl?.classList.remove('sm-dragging');
        void this.handleFilesSelected(Array.from(event.dataTransfer?.files ?? []));
      });
    }

    this.renderMessages();
    this.renderTypingIndicator();
    this.renderPendingAttachments();
  }

  private renderTypingIndicator(): void {
    if (!this.typingEl) return;

    const visitorId = this.client.visitorUserId;
    const typingUsers = this.runtimeState.typingUsers.filter((userId) => userId !== visitorId);

    this.typingEl.innerHTML = typingUsers.length
      ? `<div class="sm-typing-indicator"><span></span><span></span><span></span><span>Agent is typing...</span></div>`
      : '';
  }

  private renderPendingAttachments(): void {
    if (!this.uploadListEl) return;

    if (!this.pendingAttachments.length) {
      this.uploadListEl.innerHTML = '';
      return;
    }

    this.uploadListEl.innerHTML = this.pendingAttachments
      .map(
        (attachment) => `
          <div class="sm-upload-chip ${attachment.error ? 'sm-upload-chip-error' : ''}">
            <span class="sm-upload-name">${escapeHtml(attachment.fileName)}</span>
            <span class="sm-upload-progress">${escapeHtml(
              attachment.error ?? `${attachment.progress}%`,
            )}</span>
            <button class="sm-upload-remove" type="button" data-pending-id="${escapeHtml(
              attachment.id,
            )}" aria-label="Remove attachment">×</button>
          </div>
        `,
      )
      .join('');

    this.uploadListEl.querySelectorAll<HTMLButtonElement>('.sm-upload-remove').forEach((button) => {
      button.addEventListener('click', () => {
        const pendingId = button.dataset.pendingId;
        if (!pendingId) return;
        this.pendingAttachments = this.pendingAttachments.filter((item) => item.id !== pendingId);
        this.renderPendingAttachments();
      });
    });
  }

  private renderMessages(): void {
    if (!this.messagesEl) return;

    const visitorId = this.client.visitorUserId;
    const messages = this.runtimeState.messages;
    let unreadDividerRendered = false;

    this.messagesEl.innerHTML = messages
      .map((message, index) => {
        const previousMessage = messages[index - 1];
        const showDateDivider = !previousMessage || !isSameDay(previousMessage.created_at, message.created_at);
        const isVisitor = message.sender_id === visitorId;
        const isSystem = message.sender_type === 'system' || message.message_type === 'system';
        const attachments = (message.attachments ?? [])
          .map((attachment) => renderAttachmentHtml(message.id, attachment))
          .join('');

        const shouldRenderUnreadDivider =
          !unreadDividerRendered &&
          !isVisitor &&
          !isSystem &&
          this.unreadMarkerTimestamp !== null &&
          new Date(message.created_at).getTime() > new Date(this.unreadMarkerTimestamp).getTime();

        if (shouldRenderUnreadDivider) {
          unreadDividerRendered = true;
        }

        const reactions = (message.reactions ?? [])
          .map((reaction) => {
            const reacted = Boolean(visitorId && reaction.user_ids.includes(visitorId));
            return `
              <button
                type="button"
                class="sm-reaction-badge ${reacted ? 'sm-reaction-badge-active' : ''}"
                data-action="set-reaction"
                data-message-id="${escapeHtml(message.id)}"
                data-emoji="${escapeHtml(reaction.emoji)}"
                data-reacted="${reacted ? 'true' : 'false'}"
              >
                ${escapeHtml(reaction.emoji)} ${reaction.count}
              </button>
            `;
          })
          .join('');

        const picker =
          this.openReactionMessageId === message.id
            ? `
                <div class="sm-reaction-picker">
                  ${REACTION_EMOJIS.map(
                    (emoji) => `
                      <button
                        type="button"
                        class="sm-reaction-picker-btn"
                        data-action="set-reaction"
                        data-message-id="${escapeHtml(message.id)}"
                        data-emoji="${escapeHtml(emoji)}"
                        data-reacted="${
                          message.reactions?.some(
                            (reaction) =>
                              reaction.emoji === emoji &&
                              Boolean(visitorId && reaction.user_ids.includes(visitorId)),
                          )
                            ? 'true'
                            : 'false'
                        }"
                      >
                        ${escapeHtml(emoji)}
                      </button>
                    `,
                  ).join('')}
                </div>
              `
            : '';

        const dateDivider = showDateDivider
          ? `<div class="sm-date-divider">${escapeHtml(formatDateLabel(message.created_at))}</div>`
          : '';

        const unreadDivider = shouldRenderUnreadDivider
          ? `<div class="sm-unread-divider" id="sm-unread-divider"><span>New messages</span></div>`
          : '';

        const actionButton =
          !isSystem && !isVisitor
            ? `<button type="button" class="sm-msg-action" data-action="toggle-picker" data-message-id="${escapeHtml(message.id)}" aria-label="Add reaction">${REACTION_ICON}</button>`
            : '';

        return `
          ${dateDivider}
          ${unreadDivider}
          <div class="sm-msg ${isSystem ? 'sm-msg-system' : isVisitor ? 'sm-msg-visitor' : 'sm-msg-rep'}">
            <div class="sm-msg-row">
              <div class="sm-msg-bubble">
                ${message.content ? `<div class="sm-msg-content">${escapeHtml(message.content)}</div>` : ''}
                ${attachments}
              </div>
              ${actionButton}
            </div>
            ${
              !isSystem
                ? `<div class="sm-msg-time">${escapeHtml(formatTime(message.created_at))}${
                    message.is_edited ? ' · edited' : ''
                  }</div>`
                : ''
            }
            ${reactions ? `<div class="sm-reactions">${reactions}</div>` : ''}
            ${picker}
          </div>
        `;
      })
      .join('');

    if (this.shouldScrollToUnread) {
      const unreadDivider = this.messagesEl.querySelector('#sm-unread-divider');
      if (unreadDivider) {
        unreadDivider.scrollIntoView({ block: 'center' });
      } else {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      }
      this.shouldScrollToUnread = false;
    } else {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  private captureUnreadMarkerFromState(): void {
    const readAt = getReadTimestamp(this.runtimeState.readStatuses, this.client.visitorUserId);
    if (!readAt) {
      this.unreadMarkerTimestamp = null;
      return;
    }

    const hasUnread = this.runtimeState.messages.some(
      (message) =>
        message.sender_id !== this.client.visitorUserId &&
        new Date(message.created_at).getTime() > new Date(readAt).getTime(),
    );

    this.unreadMarkerTimestamp = hasUnread ? readAt : null;
    this.shouldScrollToUnread = hasUnread;
  }

  private clearUnreadMarkerIfViewed(): void {
    if (!this.unreadMarkerTimestamp || !this.messagesEl) return;
    const unreadDivider = this.messagesEl.querySelector<HTMLElement>('#sm-unread-divider');
    if (!unreadDivider) return;
    if (this.messagesEl.scrollTop >= unreadDivider.offsetTop - 24) {
      this.unreadMarkerTimestamp = null;
      this.renderMessages();
    }
  }

  private async initializeVisitorSession(): Promise<void> {
    if (this.client.isInitialized) return;
    await this.client.initVisitorSession();
  }

  private async toggle(): Promise<void> {
    if (this.isOpen) {
      this.minimize();
      return;
    }

    await this.ensureConfigLoaded();
    this.renderPanel();
    this.isOpen = true;
    this.unreadCount = 0;
    this.updateBadge();
    this.panelEl?.classList.remove('sm-hidden');

    try {
      await this.initializeVisitorSession();
    } catch {
      this.renderError('Unable to initialize support chat');
    }

    const existing = this.conversation ?? (await this.client.getActiveConversation());
    if (existing) {
      this.conversation = existing;
      await this.ensureConversationRuntime(true);
      this.renderChatView();
      await this.markConversationRead();
    } else {
      this.renderPreChatForm();
      this.renderError(null);
    }
  }

  private minimize(): void {
    this.isOpen = false;
    this.panelEl?.classList.add('sm-hidden');
  }

  private async ensureConversationRuntime(captureUnreadMarker: boolean): Promise<void> {
    if (!this.conversation) return;

    this.renderError(null);
    if (this.config.realtime_enabled) {
      await this.ensureRealtimeRuntime(captureUnreadMarker);
      return;
    }

    this.realtimeFallbackActive = false;
    this.cleanupRealtimeStatusWatchers();
    this.setFallbackNotice(null);
    this.cleanupRealtimeRuntime();
    await this.loadPollingSnapshot(captureUnreadMarker);
    this.startPolling();
  }

  private cleanupRealtimeRuntime(): void {
    if (this.controller) {
      this.controller.destroy();
      this.controller = null;
    }
    for (const cleanup of this.runtimeCleanups) {
      cleanup();
    }
    this.runtimeCleanups = [];
  }

  private cleanupRealtimeStatusWatchers(): void {
    for (const cleanup of this.realtimeStatusCleanups) {
      cleanup();
    }
    this.realtimeStatusCleanups = [];
  }

  private ensureRealtimeStatusWatchers(): void {
    if (this.realtimeStatusCleanups.length) return;

    this.realtimeStatusCleanups.push(
      this.client.chat.on('reconnecting', () => {
        if (!this.config.realtime_enabled || !this.conversation || this.realtimeFallbackActive) return;
        this.setFallbackNotice('Realtime reconnecting…');
      }),
    );

    this.realtimeStatusCleanups.push(
      this.client.chat.on('disconnected', () => {
        if (!this.config.realtime_enabled || !this.conversation) return;
        void this.enterRealtimeFallback();
      }),
    );

    this.realtimeStatusCleanups.push(
      this.client.chat.on('connected', () => {
        if (!this.config.realtime_enabled || !this.conversation) return;
        if (this.realtimeFallbackActive) {
          void this.restoreRealtimeRuntime();
          return;
        }
        this.setFallbackNotice(null);
      }),
    );
  }

  private async ensureRealtimeRuntime(captureUnreadMarker: boolean): Promise<void> {
    if (!this.conversation) return;
    this.ensureRealtimeStatusWatchers();

    if (!this.controller || this.runtimeState.conversationId !== this.conversation.conversation_id) {
      this.cleanupRealtimeRuntime();
      this.stopPolling();
      this.runtimeState = buildEmptyState(this.conversation.conversation_id);
      this.realtimeFallbackActive = false;
      this.setFallbackNotice(null);

      this.controller = new ChatController(this.client.chat, this.conversation.conversation_id);
      this.runtimeCleanups.push(
        this.controller.on('state', (state) => {
          this.applyRuntimeState(state, false);
        }),
      );
      this.runtimeCleanups.push(
        this.controller.on('error', ({ message }) => {
          this.renderError(message);
        }),
      );

      const state = await this.controller.init({ realtime: true, presence: true });
      this.applyRuntimeState(state, captureUnreadMarker);
      return;
    }

    if (captureUnreadMarker) {
      this.captureUnreadMarkerFromState();
    }
  }

  private async enterRealtimeFallback(
    notice = 'Realtime connection lost. Falling back to polling.',
  ): Promise<void> {
    if (!this.conversation) return;

    this.realtimeFallbackActive = true;
    this.setFallbackNotice(notice);
    this.cleanupRealtimeRuntime();

    try {
      await this.loadPollingSnapshot(false);
      this.startPolling();
      if (this.isOpen) {
        await this.markConversationRead();
      }
    } catch (error) {
      this.renderError(error instanceof Error ? error.message : 'Failed to refresh chat state');
    }
  }

  private async restoreRealtimeRuntime(): Promise<void> {
    if (!this.conversation || !this.config.realtime_enabled) return;

    try {
      this.realtimeFallbackActive = false;
      this.setFallbackNotice(null);
      await this.ensureRealtimeRuntime(false);
    } catch {
      this.realtimeFallbackActive = true;
      this.setFallbackNotice('Realtime reconnect failed. Staying on polling fallback.');
      this.startPolling();
    }
  }

  private applyRuntimeState(state: ChatControllerState, captureUnreadMarker: boolean): void {
    const previousIds = new Set(this.runtimeState.messages.map((message) => message.id));
    const newIncomingCount = state.messages.filter(
      (message) =>
        !previousIds.has(message.id) &&
        message.sender_id !== this.client.visitorUserId &&
        message.sender_type !== 'system',
    ).length;

    this.runtimeState = state;

    if (captureUnreadMarker) {
      this.captureUnreadMarkerFromState();
    }

    if (!this.isOpen && newIncomingCount > 0) {
      this.unreadCount += newIncomingCount;
      this.updateBadge();
    }

    this.updateHeader();
    this.renderError(state.error);

    if (this.conversation && this.panelEl && this.bodyEl?.dataset.view === 'chat') {
      this.renderChatView();
    }

    if (this.isOpen && newIncomingCount > 0) {
      void this.markConversationRead();
    }
  }

  private async loadPollingSnapshot(captureUnreadMarker: boolean): Promise<void> {
    if (!this.conversation) return;

    const [messagesResult, readStatusResult] = await Promise.all([
      this.client.chat.getMessages(this.conversation.conversation_id, { limit: 50 }),
      this.client.chat.getReadStatus(this.conversation.conversation_id),
    ]);

    const state: ChatControllerState = {
      conversationId: this.conversation.conversation_id,
      messages: messagesResult.data?.messages ?? this.runtimeState.messages,
      readStatuses: readStatusResult.data?.statuses ?? this.runtimeState.readStatuses,
      typingUsers: [],
      members: [],
      hasMore: messagesResult.data?.has_more ?? false,
      isLoading: false,
      error: messagesResult.error?.message ?? readStatusResult.error?.message ?? null,
    };

    this.applyRuntimeState(state, captureUnreadMarker);
  }

  private startPolling(): void {
    if (this.pollInterval || !this.conversation) return;

    this.pollInterval = setInterval(() => {
      void this.pollForUpdates();
    }, 30_000);
  }

  private stopPolling(): void {
    if (!this.pollInterval) return;
    clearInterval(this.pollInterval);
    this.pollInterval = null;
  }

  private async pollForUpdates(): Promise<void> {
    if (!this.conversation || (this.config.realtime_enabled && !this.realtimeFallbackActive)) return;
    await this.loadPollingSnapshot(false);
    if (this.isOpen) {
      await this.markConversationRead();
    }
  }

  private getReadyAttachments(): Attachment[] {
    return this.pendingAttachments
      .filter((attachment) => attachment.attachment)
      .map((attachment) => attachment.attachment as Attachment);
  }

  private async handleFilesSelected(files: File[]): Promise<void> {
    if (!files.length) return;

    try {
      await this.initializeVisitorSession();
    } catch {
      this.renderError('Unable to prepare attachment upload');
      return;
    }

    for (const file of files) {
      const pendingId = `${file.name}:${file.size}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      this.pendingAttachments = [
        ...this.pendingAttachments,
        { id: pendingId, fileName: file.name, progress: 0 },
      ];
      this.renderPendingAttachments();

      const result = await this.client.chat.uploadAttachment(file, (progress) => {
        this.pendingAttachments = this.pendingAttachments.map((attachment) =>
          attachment.id === pendingId ? { ...attachment, progress } : attachment,
        );
        this.renderPendingAttachments();
      });

      this.pendingAttachments = this.pendingAttachments.map((attachment) => {
        if (attachment.id !== pendingId) return attachment;
        if (result.data) {
          return {
            ...attachment,
            progress: 100,
            attachment: result.data,
          };
        }
        return {
          ...attachment,
          error: result.error?.message ?? 'Upload failed',
        };
      });
      this.renderPendingAttachments();
    }
  }

  private collectPreChatValues(): {
    name?: string;
    email?: string;
    metadata: Record<string, unknown>;
    valid: boolean;
  } {
    const metadata: Record<string, unknown> = {};
    let name: string | undefined;
    let email: string | undefined;
    let valid = true;

    for (const field of this.getConfiguredPreChatFields()) {
      const input = this.bodyEl?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-prechat-key="${field.key}"]`,
      );
      const value = input?.value.trim() ?? '';

      if (field.required && !value) {
        valid = false;
        input?.focus();
        break;
      }

      if (!value) continue;
      if (field.key === 'name') {
        name = value;
      } else if (field.key === 'email') {
        email = value;
      } else {
        metadata[field.key] = value;
      }
    }

    return { name, email, metadata, valid };
  }

  private async handleStartChat(): Promise<void> {
    const startBtn = this.bodyEl?.querySelector<HTMLButtonElement>('#sm-start-btn');
    const messageInput = this.bodyEl?.querySelector<HTMLTextAreaElement>('#sm-prechat-message');
    const message = messageInput?.value.trim() ?? '';
    const attachments = this.getReadyAttachments();
    const { name, email, metadata, valid } = this.collectPreChatValues();

    if (!valid || (!message && !attachments.length) || !startBtn) {
      this.renderError('Please complete the required fields before starting the chat.');
      return;
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Connecting...';

    try {
      await this.client.initVisitorSession({ name, email });
      this.conversation = await this.client.startConversation(message, {
        page_url: typeof location !== 'undefined' ? location.href : undefined,
        attachments,
        metadata,
      });
      storage.setItem('conversation_id', this.conversation.conversation_id);

      this.pendingAttachments = [];
      this.runtimeState = {
        ...buildEmptyState(this.conversation.conversation_id),
        messages: [
          buildOptimisticMessage(this.client.visitorUserId ?? 'visitor', message, attachments),
        ],
      };
      this.unreadMarkerTimestamp = null;
      this.shouldScrollToUnread = false;

      await this.ensureConversationRuntime(false);
      this.renderChatView();
      await this.markConversationRead();
    } catch (error) {
      this.renderError(error instanceof Error ? error.message : 'Failed to start chat');
      startBtn.disabled = false;
      startBtn.textContent = 'Start Chat';
    }
  }

  private async handleSendMessage(): Promise<void> {
    if (!this.conversation) return;

    const content = this.inputEl?.value.trim() ?? '';
    const attachments = this.getReadyAttachments();
    if (!content && !attachments.length) return;

    this.inputEl!.value = '';
    this.inputEl!.style.height = 'auto';
    this.pendingAttachments = [];
    this.renderPendingAttachments();

    const optimisticMessage = buildOptimisticMessage(
      this.client.visitorUserId ?? 'visitor',
      content,
      attachments,
    );

    if (this.controller) {
      this.controller.stageOptimisticMessage(optimisticMessage);
    } else {
      this.client.chat.stageOptimisticMessage(this.conversation.conversation_id, optimisticMessage);
      this.runtimeState = {
        ...this.runtimeState,
        messages: [...this.client.chat.getCachedMessages(this.conversation.conversation_id)],
      };
      this.renderChatView();
    }

    try {
      if (this.controller) {
        await this.controller.sendMessage(content, attachments);
      } else {
        const result = await this.client.chat.sendMessage(this.conversation.conversation_id, {
          content,
          attachments,
          message_type: inferMessageType(content, attachments),
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        await this.loadPollingSnapshot(false);
      }
      await this.markConversationRead();
    } catch (error) {
      this.renderError(error instanceof Error ? error.message : 'Failed to send message');
    }
  }

  private async handleReaction(messageId: string, emoji: string, reacted: boolean): Promise<void> {
    try {
      if (reacted) {
        if (this.controller) {
          await this.controller.removeReaction(messageId, emoji);
        } else {
          await this.client.chat.removeReaction(messageId, emoji);
          await this.loadPollingSnapshot(false);
        }
      } else if (this.controller) {
        await this.controller.addReaction(messageId, emoji);
      } else {
        await this.client.chat.addReaction(messageId, emoji);
        await this.loadPollingSnapshot(false);
      }
    } catch (error) {
      this.renderError(error instanceof Error ? error.message : 'Failed to update reaction');
    }
  }

  private sendTypingPulse(): void {
    if (!this.controller || !this.config.realtime_enabled) return;
    this.controller.sendTyping(true);
    if (this.typingStopTimer) {
      clearTimeout(this.typingStopTimer);
    }
    this.typingStopTimer = setTimeout(() => {
      this.controller?.sendTyping(false);
    }, 2500);
  }

  private async markConversationRead(): Promise<void> {
    if (!this.conversation) return;
    this.unreadCount = 0;
    this.updateBadge();

    try {
      if (this.controller) {
        await this.controller.markRead();
        await this.controller.refreshReadStatus();
      } else {
        await this.client.chat.markRead(this.conversation.conversation_id);
      }
    } catch {
      // ignore read marker failures in the widget UI
    }
  }

  private renderChatView(): void {
    this.ensureChatView();
    this.updateHeader();
    this.renderError(this.runtimeState.error);
  }

  private updateBadge(): void {
    const bubble = this.shadow.querySelector('.sm-bubble');
    if (!bubble) return;

    let badge = bubble.querySelector('.sm-badge');
    if (this.unreadCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'sm-badge';
        bubble.appendChild(badge);
      }
      badge.textContent = String(this.unreadCount);
    } else if (badge) {
      badge.remove();
    }
  }

  destroy(): void {
    this.stopPolling();
    if (this.typingStopTimer) {
      clearTimeout(this.typingStopTimer);
      this.typingStopTimer = null;
    }
    this.cleanupRealtimeStatusWatchers();
    this.cleanupRealtimeRuntime();
    this.client.destroy();
    this.panelEl?.remove();
    this.root.remove();
  }
}

// ============================================================================
// Auto-initialize from script tag
// ============================================================================

(function init() {
  const scripts = document.querySelectorAll('script[data-api-key]');
  const script = scripts[scripts.length - 1];
  if (!script) {
    console.warn('[ScaleMule] Support widget: missing data-api-key on script tag');
    return;
  }

  const apiKey = script.getAttribute('data-api-key');
  if (!apiKey) {
    console.warn('[ScaleMule] Support widget: data-api-key is empty');
    return;
  }

  const apiBaseUrl = script.getAttribute('data-api-url') || undefined;
  const color = script.getAttribute('data-color') || undefined;
  const positionAttr = script.getAttribute('data-position');
  const position = positionAttr === 'left' || positionAttr === 'right' ? positionAttr : undefined;

  const mount = () => {
    new SupportWidget(apiKey, apiBaseUrl, { color, position });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
