import type { ChatMessage } from '../types';
import { DEFAULT_MESSAGE_CACHE_SIZE, DEFAULT_MAX_CONVERSATIONS_CACHED } from '../constants';

export class MessageCache {
  private cache = new Map<string, ChatMessage[]>();
  private maxMessages: number;
  private maxConversations: number;

  constructor(maxMessages?: number, maxConversations?: number) {
    this.maxMessages = maxMessages ?? DEFAULT_MESSAGE_CACHE_SIZE;
    this.maxConversations = maxConversations ?? DEFAULT_MAX_CONVERSATIONS_CACHED;
  }

  getMessages(conversationId: string): ChatMessage[] {
    return this.cache.get(conversationId) ?? [];
  }

  setMessages(conversationId: string, messages: ChatMessage[]): void {
    this.cache.set(conversationId, messages.slice(0, this.maxMessages));
    this.evictOldConversations();
  }

  addMessage(conversationId: string, message: ChatMessage): void {
    const messages = this.cache.get(conversationId) ?? [];
    // Deduplicate by ID
    if (messages.some((m) => m.id === message.id)) return;
    messages.push(message);
    // Sort by created_at ascending
    messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
    // Trim to max
    if (messages.length > this.maxMessages) {
      messages.splice(0, messages.length - this.maxMessages);
    }
    this.cache.set(conversationId, messages);
  }

  updateMessage(conversationId: string, message: ChatMessage): void {
    const messages = this.cache.get(conversationId);
    if (!messages) return;
    const idx = messages.findIndex((m) => m.id === message.id);
    if (idx >= 0) {
      messages[idx] = message;
    }
  }

  removeMessage(conversationId: string, messageId: string): void {
    const messages = this.cache.get(conversationId);
    if (!messages) return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx >= 0) {
      messages.splice(idx, 1);
    }
  }

  clear(conversationId?: string): void {
    if (conversationId) {
      this.cache.delete(conversationId);
    } else {
      this.cache.clear();
    }
  }

  private evictOldConversations(): void {
    while (this.cache.size > this.maxConversations) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }
}
