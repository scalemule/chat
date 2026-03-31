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

  getMessage(conversationId: string, messageId: string): ChatMessage | undefined {
    return this.getMessages(conversationId).find((message) => message.id === messageId);
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

  upsertMessage(conversationId: string, message: ChatMessage): void {
    if (this.getMessage(conversationId, message.id)) {
      this.updateMessage(conversationId, message);
      return;
    }

    this.addMessage(conversationId, message);
  }

  updateMessage(conversationId: string, message: ChatMessage): void {
    const messages = this.cache.get(conversationId);
    if (!messages) return;
    const idx = messages.findIndex((m) => m.id === message.id);
    if (idx >= 0) {
      messages[idx] = message;
    }
  }

  reconcileOptimisticMessage(conversationId: string, message: ChatMessage): ChatMessage {
    const messages = this.cache.get(conversationId);
    if (!messages) return message;

    const incomingAttachmentIds = (message.attachments ?? []).map((attachment) => attachment.file_id).sort();
    const pendingIndex = messages.findIndex((cached) => {
      if (!cached.id.startsWith('pending-')) return false;
      if (cached.sender_id !== message.sender_id) return false;
      if (cached.content !== message.content) return false;

      const cachedAttachmentIds = (cached.attachments ?? [])
        .map((attachment) => attachment.file_id)
        .sort();

      if (cachedAttachmentIds.length !== incomingAttachmentIds.length) return false;
      return cachedAttachmentIds.every((fileId, index) => fileId === incomingAttachmentIds[index]);
    });

    if (pendingIndex >= 0) {
      messages[pendingIndex] = message;
    }

    return message;
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
