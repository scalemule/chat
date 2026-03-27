const STORAGE_KEY = 'scalemule_chat_offline_queue';

interface QueuedMessage {
  conversationId: string;
  content: string;
  message_type: string;
  attachments?: unknown[];
  timestamp: number;
}

export class OfflineQueue {
  private queue: QueuedMessage[] = [];
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
    if (this.enabled) {
      this.load();
    }
  }

  enqueue(conversationId: string, content: string, messageType = 'text', attachments?: unknown[]): void {
    if (!this.enabled) return;
    this.queue.push({
      conversationId,
      content,
      message_type: messageType,
      attachments,
      timestamp: Date.now(),
    });
    this.save();
  }

  drain(): QueuedMessage[] {
    const items = [...this.queue];
    this.queue = [];
    this.save();
    return items;
  }

  get size(): number {
    return this.queue.length;
  }

  private save(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
      }
    } catch {
      // localStorage not available (SSR, private browsing)
    }
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.queue = JSON.parse(stored);
        }
      }
    } catch {
      this.queue = [];
    }
  }
}
