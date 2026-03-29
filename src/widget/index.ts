/**
 * Support Chat Widget — IIFE entry point.
 *
 * Customers embed this with:
 * <script src="https://cdn.scalemule.com/support-widget.js" data-api-key="pb_..."></script>
 *
 * The script auto-initializes by reading the data-api-key from its own <script> tag.
 */
import { SupportClient } from '../support';
import type { SupportConversation } from '../support';
import type { ChatMessage } from '../types';
import { WIDGET_STYLES } from './styles';
import { CHAT_BUBBLE_ICON, CLOSE_ICON, SEND_ICON, MINIMIZE_ICON } from './icons';
import * as storage from './storage';

// ============================================================================
// Widget class
// ============================================================================

class SupportWidget {
  private root: HTMLElement;
  private shadow: ShadowRoot;
  private client: SupportClient;
  private conversation: SupportConversation | null = null;
  private panelEl: HTMLElement | null = null;
  private messagesEl: HTMLElement | null = null;
  private typingEl: HTMLElement | null = null;
  private isOpen = false;
  private unreadCount = 0;
  private eventCleanups: Array<() => void> = [];
  private eventsSubscribed = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastMessageCount = 0;

  constructor(apiKey: string, apiBaseUrl?: string) {
    this.client = new SupportClient({ apiKey, apiBaseUrl });

    // Create shadow DOM container
    this.root = document.createElement('div');
    this.root.id = 'scalemule-support-widget';
    this.shadow = this.root.attachShadow({ mode: 'closed' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = WIDGET_STYLES;
    this.shadow.appendChild(style);

    // Render bubble
    this.renderBubble();

    document.body.appendChild(this.root);
  }

  // ============ Rendering ============

  private renderBubble(): void {
    const bubble = document.createElement('button');
    bubble.className = 'sm-bubble';
    bubble.innerHTML = CHAT_BUBBLE_ICON;
    bubble.setAttribute('aria-label', 'Open support chat');
    bubble.addEventListener('click', () => this.toggle());
    this.shadow.appendChild(bubble);
  }

  private renderPanel(): void {
    if (this.panelEl) return;

    const panel = document.createElement('div');
    panel.className = 'sm-panel';
    panel.innerHTML = `
      <div class="sm-header">
        <div>
          <div class="sm-header-title">Support</div>
          <div class="sm-header-subtitle">We typically reply within a few minutes</div>
        </div>
        <div class="sm-header-actions">
          <button class="sm-header-btn sm-minimize-btn" aria-label="Minimize">${MINIMIZE_ICON}</button>
          <button class="sm-header-btn sm-close-btn" aria-label="Close">${CLOSE_ICON}</button>
        </div>
      </div>
      <div class="sm-body"></div>
      <div class="sm-footer">Powered by <a href="https://scalemule.com" target="_blank" rel="noopener">ScaleMule</a></div>
    `;

    panel.querySelector('.sm-minimize-btn')!.addEventListener('click', () => this.minimize());
    panel.querySelector('.sm-close-btn')!.addEventListener('click', () => this.minimize());

    this.panelEl = panel;
    this.shadow.appendChild(panel);
  }

  private renderPreChatForm(): void {
    const body = this.panelEl!.querySelector('.sm-body')!;
    body.innerHTML = `
      <div class="sm-prechat">
        <div class="sm-prechat-title">Start a conversation</div>
        <div class="sm-prechat-desc">We're here to help. Fill in your details and we'll get back to you.</div>
        <div class="sm-field">
          <label for="sm-name">Name *</label>
          <input type="text" id="sm-name" placeholder="Your name" required />
        </div>
        <div class="sm-field">
          <label for="sm-email">Email</label>
          <input type="email" id="sm-email" placeholder="you@example.com" />
        </div>
        <div class="sm-field">
          <label for="sm-message">Message *</label>
          <textarea id="sm-message" placeholder="How can we help?"></textarea>
        </div>
        <button class="sm-submit-btn" id="sm-start-btn">Start Chat</button>
      </div>
    `;

    const startBtn = body.querySelector('#sm-start-btn') as HTMLButtonElement;
    startBtn.addEventListener('click', () => this.handleStartChat());
  }

  private renderChatView(): void {
    const body = this.panelEl!.querySelector('.sm-body')!;
    body.innerHTML = `
      <div class="sm-messages" id="sm-messages"></div>
      <div class="sm-typing" id="sm-typing"></div>
      <div class="sm-input-area">
        <textarea class="sm-input" id="sm-input" placeholder="Type a message..." rows="1"></textarea>
        <button class="sm-send-btn" id="sm-send-btn">${SEND_ICON}</button>
      </div>
    `;

    this.messagesEl = body.querySelector('#sm-messages')!;
    this.typingEl = body.querySelector('#sm-typing')!;

    const input = body.querySelector('#sm-input') as HTMLTextAreaElement;
    const sendBtn = body.querySelector('#sm-send-btn') as HTMLButtonElement;

    sendBtn.addEventListener('click', () => this.handleSendMessage(input));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage(input);
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });
  }

  // ============ Lifecycle ============

  private async toggle(): Promise<void> {
    if (this.isOpen) {
      this.minimize();
      return;
    }

    this.isOpen = true;
    this.unreadCount = 0;
    this.updateBadge();
    this.renderPanel();

    // Remove hidden class if panel was previously minimized
    if (this.panelEl) {
      this.panelEl.classList.remove('sm-hidden');
    }

    // Initialize visitor session
    try {
      await this.client.initVisitorSession();
    } catch (err) {
      // Will init on form submit instead
    }

    // Check for existing conversation
    const existing = await this.client.getActiveConversation();
    if (existing) {
      this.conversation = existing;
      this.renderChatView();
      await this.loadMessages();
      this.subscribeToEvents();
      // Restart polling (may have been stopped by minimize)
      this.startPolling();
    } else {
      this.renderPreChatForm();
    }
  }

  private minimize(): void {
    this.isOpen = false;
    this.stopPolling();
    if (this.panelEl) {
      this.panelEl.classList.add('sm-hidden');
    }
  }

  // ============ Handlers ============

  private async handleStartChat(): Promise<void> {
    const nameInput = this.shadow.querySelector('#sm-name') as HTMLInputElement;
    const emailInput = this.shadow.querySelector('#sm-email') as HTMLInputElement;
    const messageInput = this.shadow.querySelector('#sm-message') as HTMLTextAreaElement;
    const startBtn = this.shadow.querySelector('#sm-start-btn') as HTMLButtonElement;

    const name = nameInput.value.trim();
    const message = messageInput.value.trim();

    if (!name || !message) return;

    startBtn.disabled = true;
    startBtn.textContent = 'Connecting...';

    try {
      // Init session with name/email
      await this.client.initVisitorSession({
        name,
        email: emailInput.value.trim() || undefined,
      });

      // Start conversation
      this.conversation = await this.client.startConversation(message, {
        page_url: location.href,
      });

      // Switch to chat view
      this.renderChatView();
      this.appendMessage({
        id: '',
        sender_id: this.client.visitorUserId ?? '',
        sender_type: 'human',
        content: message,
        message_type: 'text',
        is_edited: false,
        created_at: new Date().toISOString(),
      });
      this.subscribeToEvents();

      // Store conversation ID for return visits
      storage.setItem('conversation_id', this.conversation.conversation_id);
    } catch (err) {
      startBtn.disabled = false;
      startBtn.textContent = 'Start Chat';
    }
  }

  private async handleSendMessage(input: HTMLTextAreaElement): Promise<void> {
    const content = input.value.trim();
    if (!content || !this.conversation) return;

    input.value = '';
    input.style.height = 'auto';

    // Optimistic append
    this.appendMessage({
      id: 'pending-' + Date.now(),
      sender_id: this.client.visitorUserId ?? '',
      sender_type: 'human',
      content,
      message_type: 'text',
      is_edited: false,
      created_at: new Date().toISOString(),
    });

    try {
      await this.client.chat.sendMessage(this.conversation.conversation_id, { content });
    } catch {
      // Message failed — could show error state
    }
  }

  // ============ Real-time (polling fallback) ============

  private subscribeToEvents(): void {
    if (!this.conversation || this.eventsSubscribed) return;
    this.eventsSubscribed = true;

    // Start polling for new messages every 3 seconds.
    // This is the reliable delivery path — WebSocket is a future enhancement.
    this.startPolling();
  }

  private startPolling(): void {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      await this.pollForNewMessages();
    }, 3000);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async pollForNewMessages(): Promise<void> {
    if (!this.conversation || !this.messagesEl) return;

    try {
      const result = await this.client.chat.getMessages(this.conversation.conversation_id, {
        limit: 50,
      });
      if (!result.data?.messages) return;

      const messages = result.data.messages;
      if (messages.length === this.lastMessageCount) return;

      // New messages arrived — re-render all messages
      this.lastMessageCount = messages.length;
      this.messagesEl.innerHTML = '';
      for (const msg of messages) {
        this.appendMessage(msg);
      }

      // Update unread badge if minimized
      if (!this.isOpen) {
        this.unreadCount++;
        this.updateBadge();
      }
    } catch {
      // Polling failure — will retry next interval
    }
  }

  // ============ Message rendering ============

  private appendMessage(msg: ChatMessage): void {
    if (!this.messagesEl) return;

    const isVisitor = msg.sender_id === this.client.visitorUserId;
    const isSystem = msg.sender_type === 'system' || msg.message_type === 'system';

    const wrapper = document.createElement('div');
    wrapper.className = `sm-msg ${isSystem ? 'sm-msg-system' : isVisitor ? 'sm-msg-visitor' : 'sm-msg-rep'}`;

    const bubble = document.createElement('div');
    bubble.className = 'sm-msg-bubble';
    bubble.textContent = msg.content;
    wrapper.appendChild(bubble);

    if (!isSystem) {
      const time = document.createElement('div');
      time.className = 'sm-msg-time';
      time.textContent = this.formatTime(msg.created_at);
      wrapper.appendChild(time);
    }

    this.messagesEl.appendChild(wrapper);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private async loadMessages(): Promise<void> {
    if (!this.conversation || !this.messagesEl) return;

    try {
      const result = await this.client.chat.getMessages(this.conversation.conversation_id, {
        limit: 50,
      });
      if (result.data) {
        this.messagesEl.innerHTML = '';
        this.lastMessageCount = result.data.messages.length;
        for (const msg of result.data.messages) {
          this.appendMessage(msg);
        }
      }
    } catch {
      // Failed to load messages
    }
  }

  // ============ Helpers ============

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

  private formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
}

// ============================================================================
// Auto-initialize from script tag
// ============================================================================

(function init() {
  // Find our own script tag
  const scripts = document.querySelectorAll('script[data-api-key]');
  const script = scripts[scripts.length - 1]; // Last matching script
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

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new SupportWidget(apiKey, apiBaseUrl);
    });
  } else {
    new SupportWidget(apiKey, apiBaseUrl);
  }
})();
