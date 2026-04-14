import { ChatClient } from './core/ChatClient';
import { ChatController, type ChatControllerState } from './shared/ChatController';
import type { Attachment, ChatConfig, ChatMessage } from './types';

interface PendingAttachment {
  id: string;
  fileName: string;
  progress: number;
  attachment?: Attachment;
  error?: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '👀'];

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url?: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://scalemule.com');
    if (['http:', 'https:', 'blob:'].includes(parsed.protocol)) {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function sanitizeThemeColor(value?: string): string {
  const candidate = value?.trim();
  if (!candidate) return '#2563eb';

  if (typeof document !== 'undefined') {
    const style = document.createElement('span').style;
    style.color = '';
    style.color = candidate;
    if (style.color) {
      return candidate;
    }
  }

  if (/^#[0-9a-f]{3,8}$/i.test(candidate)) {
    return candidate;
  }

  return '#2563eb';
}

function formatDayLabel(value: string): string {
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

function getUnreadIndex(messages: ChatMessage[], unreadSince?: string): number {
  if (!unreadSince) return -1;
  return messages.findIndex(
    (message) => new Date(message.created_at).getTime() > new Date(unreadSince).getTime(),
  );
}

function renderAttachment(attachment: Attachment): string {
  const fileName = escapeHtml(attachment.file_name);
  const url = sanitizeUrl(attachment.presigned_url ?? undefined);
  if (!url) {
    return `<div class="attachment attachment-link">${fileName}</div>`;
  }

  if (attachment.mime_type.startsWith('image/')) {
    return `<img class="attachment attachment-image" src="${escapeHtml(url)}" alt="${fileName}" />`;
  }

  if (attachment.mime_type.startsWith('video/')) {
    return `<video class="attachment attachment-video" src="${escapeHtml(url)}" controls></video>`;
  }

  if (attachment.mime_type.startsWith('audio/')) {
    return `<audio class="attachment attachment-audio" src="${escapeHtml(url)}" controls></audio>`;
  }

  return `<a class="attachment attachment-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${fileName}</a>`;
}

function renderMessage(
  message: ChatMessage,
  currentUserId?: string,
  showReactionPicker = false,
): string {
  const isOwn = Boolean(currentUserId && message.sender_id === currentUserId);
  const attachments = (message.attachments ?? []).map(renderAttachment).join('');
  const edited = message.is_edited ? '<span class="message-edited">edited</span>' : '';
  const reactions = (message.reactions ?? [])
    .map((reaction) => {
      const reacted = Boolean(currentUserId && reaction.user_ids.includes(currentUserId));
      return `
        <button
          class="reaction-badge ${reacted ? 'reaction-badge-active' : ''}"
          type="button"
          data-action="toggle-reaction"
          data-message-id="${escapeHtml(message.id)}"
          data-emoji="${escapeHtml(reaction.emoji)}"
          data-reacted="${reacted ? 'true' : 'false'}"
        >
          ${escapeHtml(reaction.emoji)} ${reaction.count}
        </button>
      `;
    })
    .join('');
  const picker = showReactionPicker
    ? `
      <div class="reaction-picker">
        ${REACTION_EMOJIS.map(
          (emoji) => `
            <button
              class="reaction-picker-btn"
              type="button"
              data-action="add-reaction"
              data-message-id="${escapeHtml(message.id)}"
              data-emoji="${escapeHtml(emoji)}"
            >
              ${escapeHtml(emoji)}
            </button>
          `,
        ).join('')}
      </div>
    `
    : '';

  return `
    <div class="message ${isOwn ? 'message-own' : 'message-other'}">
      <div class="message-bubble">
        ${message.content ? `<div class="message-content">${escapeHtml(message.content)}</div>` : ''}
        ${attachments}
      </div>
      <div class="message-meta">
        <span>${new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        ${edited}
        <button class="message-action" type="button" data-action="toggle-picker" data-message-id="${escapeHtml(message.id)}">React</button>
      </div>
      ${reactions ? `<div class="reactions">${reactions}</div>` : ''}
      ${picker}
    </div>
  `;
}

class ScaleMuleChatElement extends HTMLElement {
  private client: ChatClient | null = null;
  private controller: ChatController | null = null;
  private shadow: ShadowRoot;
  private cleanupFns: Array<() => void> = [];
  private pendingAttachments: PendingAttachment[] = [];
  private currentState: ChatControllerState | null = null;
  private openReactionMessageId: string | null = null;
  private didScrollToUnread = false;

  static get observedAttributes(): string[] {
    return ['api-key', 'conversation-id', 'api-base-url', 'embed-token', 'ws-url', 'theme-color'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.initialize();
  }

  disconnectedCallback(): void {
    this.cleanup();
  }

  attributeChangedCallback(): void {
    this.cleanup();
    this.initialize();
  }

  private initialize(): void {
    const apiKey = this.getAttribute('api-key') ?? undefined;
    const conversationId = this.getAttribute('conversation-id');
    const apiBaseUrl = this.getAttribute('api-base-url') ?? undefined;
    const embedToken = this.getAttribute('embed-token') ?? undefined;
    const wsUrl = this.getAttribute('ws-url') ?? undefined;
    const themeColor = sanitizeThemeColor(this.getAttribute('theme-color') ?? '#2563eb');

    if ((!apiKey && !embedToken) || !conversationId) return;

    const config: ChatConfig = {
      apiKey,
      embedToken,
      apiBaseUrl,
      wsUrl,
    };

    this.client = new ChatClient(config);
    this.controller = new ChatController(this.client, conversationId);

    this.shadow.innerHTML = `
      <style>
        :host { display: block; width: 100%; height: 100%; color: #111827; }
        .chat-container {
          --sm-primary: ${themeColor};
          --sm-primary-muted: color-mix(in srgb, var(--sm-primary) 10%, white);
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          font-family: system-ui, sans-serif;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          overflow: hidden;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid #e5e7eb;
          background: #fff;
        }
        .header-title {
          font-size: 15px;
          font-weight: 700;
        }
        .header-status-copy {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }
        .header-presence {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #6b7280;
          white-space: nowrap;
        }
        .header-presence-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #94a3b8;
        }
        .header-presence-dot.online {
          background: #22c55e;
        }
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .message {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-width: 82%;
        }
        .message-own { align-self: flex-end; }
        .message-other { align-self: flex-start; }
        .message-bubble {
          padding: 10px 12px;
          border-radius: 16px;
          background: #f3f4f6;
          color: #111827;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .message-own .message-bubble {
          background: var(--sm-primary);
          color: #fff;
        }
        .message-meta {
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: 12px;
          color: #6b7280;
        }
        .message-edited { text-transform: lowercase; }
        .message-action {
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-size: 12px;
          padding: 0;
        }
        .date-divider,
        .unread-divider {
          align-self: center;
          font-size: 12px;
          color: #6b7280;
        }
        .date-divider {
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.12);
        }
        .unread-divider {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--sm-primary);
          font-weight: 600;
        }
        .unread-divider::before,
        .unread-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: color-mix(in srgb, var(--sm-primary) 28%, white);
        }
        .attachment {
          display: block;
          width: 100%;
          margin-top: 8px;
          border-radius: 12px;
        }
        .attachment-image,
        .attachment-video { max-width: 320px; }
        .attachment-link { color: inherit; }
        .reactions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .reaction-badge,
        .reaction-picker-btn {
          border: 1px solid #dbe3ef;
          border-radius: 999px;
          background: #fff;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
        }
        .reaction-badge-active {
          border-color: color-mix(in srgb, var(--sm-primary) 40%, white);
          background: color-mix(in srgb, var(--sm-primary) 10%, white);
        }
        .reaction-picker {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .typing {
          min-height: 20px;
          padding: 0 16px 10px;
          font-size: 12px;
          color: #6b7280;
        }
        .attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 0 12px 12px;
        }
        .attachment-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid #dbe3ef;
          background: #f8fafc;
          font-size: 12px;
        }
        .attachment-chip-error {
          border-color: #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }
        .attachment-remove {
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font: inherit;
        }
        .input-area {
          display: flex;
          gap: 10px;
          padding: 12px;
          border-top: 1px solid #e5e7eb;
          background: #fff;
        }
        .input-area textarea {
          flex: 1;
          min-height: 44px;
          resize: vertical;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 10px 12px;
          font: inherit;
          outline: none;
        }
        .input-area button {
          border: none;
          border-radius: 12px;
          padding: 0 16px;
          background: var(--sm-primary);
          color: white;
          cursor: pointer;
        }
        .input-area .attach-btn {
          background: var(--sm-primary-muted);
          color: #0f172a;
        }
        .empty {
          color: #6b7280;
          font-size: 14px;
          padding: 32px 0;
          text-align: center;
        }
      </style>
      <div class="chat-container">
        <div class="header">
          <div>
            <div class="header-title">Chat</div>
            <div class="header-status-copy" id="status-copy">Loading conversation…</div>
          </div>
          <div class="header-presence">
            <span class="header-presence-dot" id="presence-dot"></span>
            <span id="presence-label">Away</span>
          </div>
        </div>
        <div class="messages" id="messages" role="log" aria-live="polite"></div>
        <div class="typing" id="typing" aria-live="polite"></div>
        <div class="attachments" id="attachments" aria-live="polite"></div>
        <div class="input-area">
          <input type="file" id="file-input" hidden multiple accept="image/*,video/*,audio/*" aria-label="Attach files" />
          <button class="attach-btn" id="attach" type="button" aria-label="Attach files">Attach</button>
          <textarea placeholder="Type a message..." id="input" aria-label="Message"></textarea>
          <button id="send" aria-label="Send message">Send</button>
        </div>
      </div>
    `;

    const messagesEl = this.shadow.getElementById('messages') as HTMLDivElement;
    const typingEl = this.shadow.getElementById('typing') as HTMLDivElement;
    const attachmentsEl = this.shadow.getElementById('attachments') as HTMLDivElement;
    const statusCopyEl = this.shadow.getElementById('status-copy') as HTMLDivElement;
    const presenceDotEl = this.shadow.getElementById('presence-dot') as HTMLSpanElement;
    const presenceLabelEl = this.shadow.getElementById('presence-label') as HTMLSpanElement;
    const inputEl = this.shadow.getElementById('input') as HTMLTextAreaElement;
    const fileInputEl = this.shadow.getElementById('file-input') as HTMLInputElement;
    const attachBtn = this.shadow.getElementById('attach') as HTMLButtonElement;
    const sendBtn = this.shadow.getElementById('send') as HTMLButtonElement;

    const renderPendingAttachments = () => {
      attachmentsEl.innerHTML = this.pendingAttachments.length
        ? this.pendingAttachments
            .map(
              (attachment) => `
                <div class="attachment-chip ${attachment.error ? 'attachment-chip-error' : ''}">
                  <span>${escapeHtml(attachment.fileName)}</span>
                  <span>${escapeHtml(attachment.error ?? `${attachment.progress}%`)}</span>
                  <button class="attachment-remove" type="button" data-pending-id="${escapeHtml(attachment.id)}" aria-label="Remove attachment">x</button>
                </div>
              `,
            )
            .join('')
        : '';

      attachmentsEl.querySelectorAll<HTMLButtonElement>('[data-pending-id]').forEach((button) => {
        button.addEventListener('click', () => {
          const id = button.dataset.pendingId;
          if (!id) return;
          this.pendingAttachments = this.pendingAttachments.filter((item) => item.id !== id);
          renderPendingAttachments();
        });
      });
    };

    const renderState = (state: ChatControllerState) => {
      this.currentState = state;
      const currentUserId = this.client?.userId;
      const activeMembers = state.members.filter((member) => member.userId !== currentUserId);
      const online = activeMembers.some((member) => member.status === 'online');
      const onlineCount = activeMembers.filter((member) => member.status === 'online').length;
      const unreadSince = currentUserId
        ? state.readStatuses.find((status) => status.user_id === currentUserId)?.last_read_at
        : undefined;
      const unreadIndex = getUnreadIndex(state.messages, unreadSince);

      presenceDotEl.className = `header-presence-dot ${online ? 'online' : ''}`;
      presenceLabelEl.textContent = online ? 'Online' : 'Away';
      statusCopyEl.textContent = state.error
        ? state.error
        : state.typingUsers.some((userId) => userId !== currentUserId)
          ? 'Someone is typing…'
          : onlineCount
            ? `${onlineCount} online`
            : 'No one online';

      if (!state.messages.length) {
        messagesEl.innerHTML = `<div class="empty">${escapeHtml(state.error ?? (state.isLoading ? 'Loading messages...' : 'Start the conversation'))}</div>`;
      } else {
        messagesEl.innerHTML = state.messages
          .map((message, index) => {
            const previousMessage = state.messages[index - 1];
            const showDateDivider = !previousMessage || !isSameDay(previousMessage.created_at, message.created_at);
            const showUnreadDivider = unreadIndex === index;

            return `
              ${showDateDivider ? `<div class="date-divider">${escapeHtml(formatDayLabel(message.created_at))}</div>` : ''}
              ${showUnreadDivider ? `<div class="unread-divider" id="unread-divider">New messages</div>` : ''}
              ${renderMessage(message, currentUserId, this.openReactionMessageId === message.id)}
            `;
          })
          .join('');
      }

      typingEl.textContent = state.typingUsers.some((userId) => userId !== currentUserId) ? 'Someone is typing...' : '';

      const unreadDivider = messagesEl.querySelector('#unread-divider');
      if (unreadDivider && !this.didScrollToUnread) {
        unreadDivider.scrollIntoView({ block: 'center' });
        this.didScrollToUnread = true;
      } else {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    };

    this.cleanupFns.push(
      this.controller.on('state', (state) => {
        renderState(state);
      }),
    );

    this.cleanupFns.push(
      this.client.on('message', () => {
        this.dispatchEvent(
          new CustomEvent('chat-message', { composed: true, bubbles: true }),
        );
      }),
    );

    messagesEl.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!target || !this.controller || !this.currentState) return;

      const action = target.dataset.action;
      const messageId = target.dataset.messageId;
      if (!messageId) return;

      if (action === 'toggle-picker') {
        this.openReactionMessageId = this.openReactionMessageId === messageId ? null : messageId;
        renderState(this.currentState);
        return;
      }

      const emoji = target.dataset.emoji;
      if (!emoji) return;

      if (action === 'add-reaction') {
        this.openReactionMessageId = null;
        void this.controller.addReaction(messageId, emoji);
        return;
      }

      if (action === 'toggle-reaction') {
        const reacted = target.dataset.reacted === 'true';
        if (reacted) {
          void this.controller.removeReaction(messageId, emoji);
        } else {
          void this.controller.addReaction(messageId, emoji);
        }
      }
    });

    const handleFiles = async (files: FileList | File[]) => {
      if (!this.controller) return;

      for (const file of Array.from(files)) {
        const pendingId = `${file.name}:${file.size}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        this.pendingAttachments = [
          ...this.pendingAttachments,
          {
            id: pendingId,
            fileName: file.name,
            progress: 0,
          },
        ];
        renderPendingAttachments();

        const result = await this.controller.uploadAttachment(file, (progress) => {
          this.pendingAttachments = this.pendingAttachments.map((attachment) =>
            attachment.id === pendingId ? { ...attachment, progress } : attachment,
          );
          renderPendingAttachments();
        });

        this.pendingAttachments = this.pendingAttachments.map((attachment) => {
          if (attachment.id !== pendingId) return attachment;

          if (result?.data) {
            return {
              ...attachment,
              progress: 100,
              attachment: result.data,
            };
          }

          return {
            ...attachment,
            error: result?.error?.message ?? 'Upload failed',
          };
        });
        renderPendingAttachments();
      }
    };

    const send = async () => {
      const content = inputEl.value.trim();
      const readyAttachments = this.pendingAttachments
        .filter((attachment) => attachment.attachment)
        .map((attachment) => attachment.attachment as Attachment);

      if ((!content && !readyAttachments.length) || !this.controller) return;

      // Snapshot what we're sending — do NOT clear input until success.
      const sentContent = content;
      const sentAttachmentIds = new Set(readyAttachments.map((a) => a.file_id));

      try {
        await this.controller.sendMessage(sentContent, readyAttachments);
        // SUCCESS: clear input only if user hasn't typed something new in flight.
        if (inputEl.value.trim() === sentContent) {
          inputEl.value = '';
        }
        this.pendingAttachments = this.pendingAttachments.filter(
          (a) => !a.attachment || !sentAttachmentIds.has(a.attachment.file_id),
        );
        renderPendingAttachments();
        await this.controller.markRead();
      } catch (err) {
        // Keep input + attachments — user can edit and retry. Caller can override
        // via the controller's error event for richer UX.
        // eslint-disable-next-line no-console
        console.warn('[scalemule-chat] send failed:', err);
      }
    };

    attachBtn.addEventListener('click', () => {
      fileInputEl.click();
    });
    fileInputEl.addEventListener('change', () => {
      if (fileInputEl.files) {
        void handleFiles(fileInputEl.files);
        fileInputEl.value = '';
      }
    });
    sendBtn.addEventListener('click', () => {
      void send();
    });
    inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void send();
      } else {
        this.controller?.sendTyping(true);
      }
    });

    void this.controller.init().then(() => this.controller?.markRead());
  }

  private cleanup(): void {
    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns = [];
    this.controller?.destroy();
    this.controller = null;
    this.client?.destroy();
    this.client = null;
    this.currentState = null;
    this.openReactionMessageId = null;
    this.didScrollToUnread = false;
    this.shadow.innerHTML = '';
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('scalemule-chat')) {
  customElements.define('scalemule-chat', ScaleMuleChatElement);
}
