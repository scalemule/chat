import { ChatClient } from './core/ChatClient';
import type { ChatConfig, ChatMessage } from './types';

class ScaleMuleChatElement extends HTMLElement {
  private client: ChatClient | null = null;
  private shadow: ShadowRoot;
  private unsub: (() => void) | null = null;

  static get observedAttributes(): string[] {
    return ['api-key', 'conversation-id', 'api-base-url', 'embed-token'];
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

    if (!apiKey && !embedToken) return;

    const config: ChatConfig = {
      apiKey,
      embedToken,
      apiBaseUrl,
    };

    this.client = new ChatClient(config);

    // Render a minimal container
    this.shadow.innerHTML = `
      <style>
        :host { display: block; width: 100%; height: 100%; }
        .chat-container { width: 100%; height: 100%; display: flex; flex-direction: column; font-family: system-ui, sans-serif; }
        .messages { flex: 1; overflow-y: auto; padding: 8px; }
        .message { margin: 4px 0; padding: 6px 10px; background: #f0f0f0; border-radius: 8px; max-width: 80%; }
        .input-area { display: flex; padding: 8px; border-top: 1px solid #e0e0e0; }
        .input-area input { flex: 1; padding: 8px; border: 1px solid #d0d0d0; border-radius: 6px; outline: none; }
        .input-area button { margin-left: 8px; padding: 8px 16px; background: #0066ff; color: white; border: none; border-radius: 6px; cursor: pointer; }
      </style>
      <div class="chat-container">
        <div class="messages" id="messages"></div>
        <div class="input-area">
          <input type="text" placeholder="Type a message..." id="input" />
          <button id="send">Send</button>
        </div>
      </div>
    `;

    const messagesEl = this.shadow.getElementById('messages')!;
    const inputEl = this.shadow.getElementById('input') as HTMLInputElement;
    const sendBtn = this.shadow.getElementById('send')!;

    // Handle new messages
    this.client.on('message', ({ message }) => {
      this.appendMessage(messagesEl, message);
      this.dispatchEvent(
        new CustomEvent('chat-message', { detail: message, composed: true, bubbles: true }),
      );
    });

    // Send on click or Enter
    const doSend = () => {
      const content = inputEl.value.trim();
      if (!content || !conversationId || !this.client) return;
      this.client.sendMessage(conversationId, { content });
      inputEl.value = '';
    };

    sendBtn.addEventListener('click', doSend);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSend();
    });

    // Subscribe to conversation and load messages
    if (conversationId) {
      this.unsub = this.client.subscribeToConversation(conversationId);
      this.client.connect();

      this.client.getMessages(conversationId).then((result) => {
        if (result.data?.messages) {
          for (const msg of result.data.messages) {
            this.appendMessage(messagesEl, msg);
          }
        }
      });
    }
  }

  private appendMessage(container: HTMLElement, message: ChatMessage): void {
    const el = document.createElement('div');
    el.className = 'message';
    el.textContent = message.content;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  private cleanup(): void {
    this.unsub?.();
    this.unsub = null;
    this.client?.destroy();
    this.client = null;
    this.shadow.innerHTML = '';
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('scalemule-chat')) {
  customElements.define('scalemule-chat', ScaleMuleChatElement);
}
