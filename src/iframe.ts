import type { ChatConfig, ChatMessage } from './types';

export class ChatIframeController {
  private iframe: HTMLIFrameElement;
  private listeners = new Map<string, Set<(data: unknown) => void>>();

  constructor(
    container: HTMLElement,
    config: ChatConfig & { conversationId?: string; iframeSrc?: string },
  ) {
    this.iframe = document.createElement('iframe');
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
    this.iframe.style.border = 'none';

    const baseUrl = config.apiBaseUrl ?? 'https://api.scalemule.com';
    const src =
      config.iframeSrc ??
      `${baseUrl}/v1/chat/embed/${config.conversationId ?? ''}?token=${encodeURIComponent(config.embedToken ?? '')}`;

    this.iframe.src = src;
    container.appendChild(this.iframe);

    window.addEventListener('message', this.handleMessage);
  }

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  sendMessage(content: string): void {
    this.postToIframe('sendMessage', { content });
  }

  destroy(): void {
    window.removeEventListener('message', this.handleMessage);
    this.iframe.remove();
    this.listeners.clear();
  }

  private handleMessage = (event: MessageEvent): void => {
    if (event.source !== this.iframe.contentWindow) return;
    const { type, payload } = event.data ?? {};
    if (type && this.listeners.has(type)) {
      for (const cb of this.listeners.get(type)!) {
        cb(payload);
      }
    }
  };

  private postToIframe(method: string, args: unknown): void {
    this.iframe.contentWindow?.postMessage({ method, args }, '*');
  }
}
