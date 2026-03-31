import { EventEmitter } from '../core/EventEmitter';
import type { ChatClient } from '../core/ChatClient';
import type { ChatMessage, ReadStatus, Attachment } from '../types';

interface PresenceStateMember {
  userId: string;
  status: string;
  userData?: unknown;
}

interface ChatControllerInitOptions {
  realtime?: boolean;
  presence?: boolean;
}

export interface ChatControllerState {
  conversationId: string;
  messages: ChatMessage[];
  readStatuses: ReadStatus[];
  typingUsers: string[];
  members: PresenceStateMember[];
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

interface ChatControllerEvents {
  state: ChatControllerState;
  ready: ChatControllerState;
  error: { message: string };
}

export class ChatController extends EventEmitter<ChatControllerEvents> {
  private readonly client: ChatClient;
  private readonly conversationId: string;
  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private unsubscribers: Array<() => void> = [];
  private state: ChatControllerState;

  constructor(client: ChatClient, conversationId: string) {
    super();
    this.client = client;
    this.conversationId = conversationId;
    this.state = {
      conversationId,
      messages: [],
      readStatuses: [],
      typingUsers: [],
      members: [],
      hasMore: false,
      isLoading: true,
      error: null,
    };
  }

  getState(): ChatControllerState {
    return this.state;
  }

  async init(options: ChatControllerInitOptions = {}): Promise<ChatControllerState> {
    const realtimeEnabled = options.realtime ?? true;
    const presenceEnabled = options.presence ?? realtimeEnabled;
    this.bindEvents();
    if (realtimeEnabled) {
      this.client.connect();
    }

    try {
      await this.client.getConversation(this.conversationId);
      const [messagesResult, readStatusResult] = await Promise.all([
        this.client.getMessages(this.conversationId),
        this.client.getReadStatus(this.conversationId),
      ]);

      this.state = {
        ...this.state,
        messages: messagesResult.data?.messages ?? [],
        readStatuses: readStatusResult.data?.statuses ?? [],
        hasMore: messagesResult.data?.has_more ?? false,
        isLoading: false,
        error: messagesResult.error?.message ?? readStatusResult.error?.message ?? null,
      };

      if (realtimeEnabled) {
        this.unsubscribers.push(this.client.subscribeToConversation(this.conversationId));
      }
      if (presenceEnabled) {
        this.client.joinPresence(this.conversationId);
      }
      this.emit('state', this.state);
      this.emit('ready', this.state);
      return this.state;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize chat controller';
      this.state = {
        ...this.state,
        isLoading: false,
        error: message,
      };
      this.emit('state', this.state);
      this.emit('error', { message });
      throw error;
    }
  }

  async loadMore(): Promise<void> {
    const oldestId = this.state.messages[0]?.id;
    if (!oldestId) return;

    const result = await this.client.getMessages(this.conversationId, { before: oldestId });
    if (result.data?.messages?.length) {
      this.state = {
        ...this.state,
        messages: [...result.data.messages, ...this.state.messages],
        hasMore: result.data.has_more ?? false,
      };
      this.emit('state', this.state);
    }
  }

  async sendMessage(content: string, attachments: Attachment[] = []): Promise<void> {
    const messageType =
      attachments.length > 0
        ? attachments.every((attachment) => attachment.mime_type.startsWith('image/')) && !content
          ? 'image'
          : 'file'
        : 'text';

    const result = await this.client.sendMessage(this.conversationId, {
      content,
      attachments,
      message_type: messageType,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  stageOptimisticMessage(message: ChatMessage): ChatMessage {
    const staged = this.client.stageOptimisticMessage(this.conversationId, message);
    this.patchState({
      messages: [...this.client.getCachedMessages(this.conversationId)],
    });
    return staged;
  }

  async uploadAttachment(
    file: File | Blob,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal,
  ) {
    return this.client.uploadAttachment(file, onProgress, signal);
  }

  async refreshAttachmentUrl(messageId: string, fileId: string) {
    return this.client.refreshAttachmentUrl(messageId, fileId);
  }

  async addReaction(messageId: string, emoji: string): Promise<void> {
    const result = await this.client.addReaction(messageId, emoji);
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  async removeReaction(messageId: string, emoji: string): Promise<void> {
    const result = await this.client.removeReaction(messageId, emoji);
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  async reportMessage(
    messageId: string,
    reason: 'spam' | 'harassment' | 'hate' | 'violence' | 'other',
    description?: string,
  ) {
    return this.client.reportMessage(messageId, reason, description);
  }

  async muteConversation(mutedUntil?: string) {
    return this.client.muteConversation(this.conversationId, mutedUntil);
  }

  async unmuteConversation() {
    return this.client.unmuteConversation(this.conversationId);
  }

  async markRead(): Promise<void> {
    await this.client.markRead(this.conversationId);
  }

  async refreshReadStatus(): Promise<ReadStatus[]> {
    const result = await this.client.getReadStatus(this.conversationId);
    if (result.data?.statuses) {
      this.patchState({ readStatuses: result.data.statuses });
      return result.data.statuses;
    }

    if (result.error) {
      throw new Error(result.error.message);
    }

    return this.state.readStatuses;
  }

  sendTyping(isTyping = true): void {
    void this.client.sendTyping(this.conversationId, isTyping);
  }

  destroy(): void {
    this.client.leavePresence(this.conversationId);
    for (const timer of this.typingTimers.values()) {
      clearTimeout(timer);
    }
    this.typingTimers.clear();
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
    this.removeAllListeners();
  }

  private bindEvents(): void {
    if (this.unsubscribers.length) return;

    this.unsubscribers.push(
      this.client.on('message', ({ conversationId }) => {
        if (conversationId !== this.conversationId) return;
        this.patchState({
          messages: [...this.client.getCachedMessages(this.conversationId)],
        });
      }),
    );

    this.unsubscribers.push(
      this.client.on('message:updated', ({ conversationId }) => {
        if (conversationId !== this.conversationId) return;
        this.patchState({
          messages: [...this.client.getCachedMessages(this.conversationId)],
        });
      }),
    );

    this.unsubscribers.push(
      this.client.on('message:deleted', ({ conversationId }) => {
        if (conversationId !== this.conversationId) return;
        this.patchState({
          messages: [...this.client.getCachedMessages(this.conversationId)],
        });
      }),
    );

    this.unsubscribers.push(
      this.client.on('reaction', ({ conversationId }) => {
        if (conversationId !== this.conversationId) return;
        this.patchState({
          messages: [...this.client.getCachedMessages(this.conversationId)],
        });
      }),
    );

    this.unsubscribers.push(
      this.client.on('typing', ({ conversationId, userId }) => {
        if (conversationId !== this.conversationId) return;
        this.patchState({
          typingUsers: this.state.typingUsers.includes(userId)
            ? this.state.typingUsers
            : [...this.state.typingUsers, userId],
        });

        const timer = this.typingTimers.get(userId);
        if (timer) {
          clearTimeout(timer);
        }
        this.typingTimers.set(
          userId,
          setTimeout(() => {
            this.patchState({
              typingUsers: this.state.typingUsers.filter((typingUserId) => typingUserId !== userId),
            });
            this.typingTimers.delete(userId);
          }, 3000),
        );
      }),
    );

    this.unsubscribers.push(
      this.client.on('typing:stop', ({ conversationId, userId }) => {
        if (conversationId !== this.conversationId) return;
        const timer = this.typingTimers.get(userId);
        if (timer) {
          clearTimeout(timer);
          this.typingTimers.delete(userId);
        }
        this.patchState({
          typingUsers: this.state.typingUsers.filter((typingUserId) => typingUserId !== userId),
        });
      }),
    );

    this.unsubscribers.push(
      this.client.on('read', ({ conversationId, userId, lastReadAt }) => {
        if (conversationId !== this.conversationId) return;
        const nextStatuses = [...this.state.readStatuses];
        const existingIndex = nextStatuses.findIndex((status) => status.user_id === userId);
        if (existingIndex >= 0) {
          nextStatuses[existingIndex] = { ...nextStatuses[existingIndex], last_read_at: lastReadAt };
        } else {
          nextStatuses.push({ user_id: userId, last_read_at: lastReadAt });
        }
        this.patchState({ readStatuses: nextStatuses });
      }),
    );

    this.unsubscribers.push(
      this.client.on('presence:state', ({ conversationId, members }) => {
        if (conversationId !== this.conversationId) return;
        this.patchState({
          members: members.map((member) => ({
            userId: member.user_id,
            status: (member as { status?: string }).status ?? 'online',
            userData: member.user_data,
          })),
        });
      }),
    );

    this.unsubscribers.push(
      this.client.on('presence:join', ({ conversationId, userId, userData }) => {
        if (conversationId !== this.conversationId) return;
        if (this.state.members.some((member) => member.userId === userId)) return;
        this.patchState({
          members: [...this.state.members, { userId, status: 'online', userData }],
        });
      }),
    );

    this.unsubscribers.push(
      this.client.on('presence:leave', ({ conversationId, userId }) => {
        if (conversationId !== this.conversationId) return;
        this.patchState({
          members: this.state.members.filter((member) => member.userId !== userId),
        });
      }),
    );

    this.unsubscribers.push(
      this.client.on('presence:update', ({ conversationId, userId, status, userData }) => {
        if (conversationId !== this.conversationId) return;
        this.patchState({
          members: this.state.members.map((member) =>
            member.userId === userId ? { ...member, status, userData } : member,
          ),
        });
      }),
    );
  }

  private patchState(patch: Partial<ChatControllerState>): void {
    this.state = {
      ...this.state,
      ...patch,
      error: patch.error !== undefined ? patch.error : this.state.error,
    };
    this.emit('state', this.state);
  }
}
