import { EventEmitter } from './EventEmitter';
import { MessageCache } from './MessageCache';
import { OfflineQueue } from './OfflineQueue';

/**
 * Small random id generator for client-only optimistic message ids.
 * Prefers `crypto.randomUUID` when available, falls back to a two-
 * segment random string everywhere else (Node <19, older browsers).
 * Never collides with server ids — callers always prefix with
 * `pending-` so the cache reconciliation can find these rows.
 */
function generateTempId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return (
    Math.random().toString(36).slice(2, 10) +
    '-' +
    Date.now().toString(36)
  );
}
import { HttpTransport } from '../transport/HttpTransport';
import { WebSocketTransport } from '../transport/WebSocketTransport';
import { DEFAULT_API_BASE_URL } from '../constants';
import { uploadToPresignedUrl } from '../shared/upload';
import { readJson, writeJson } from '../shared/safeStorage';
import type {
  Attachment,
  ApiResponse,
  ChannelInvitation,
  ChannelListItem,
  ChatConfig,
  ChatEventMap,
  ChatMessage,
  ChatReaction,
  ChatSearchResponse,
  MessagePin,
  ChannelWithSettings,
  ConnectionStatus,
  Conversation,
  CreateChannelOptions,
  CreateConversationOptions,
  CreateEphemeralChannelOptions,
  CreateLargeRoomOptions,
  GetMessagesOptions,
  GetMessagesAroundOptions,
  ListChannelsOptions,
  ListConversationsOptions,
  MessageEditedEvent,
  MessagesResponse,
  MessagesAroundResponse,
  PresignedUploadResponse,
  ReactionEvent,
  ReadStatus,
  SendMessageOptions,
  ChannelSettings,
  UnreadTotalResponse,
  UploadCompleteResponse,
} from '../types';

export class ChatClient extends EventEmitter<ChatEventMap> {
  private http: HttpTransport;
  private ws: WebSocketTransport;
  private cache: MessageCache;
  private offlineQueue: OfflineQueue;
  private conversationSubs = new Map<string, () => void>();
  private conversationTypes = new Map<string, Conversation['conversation_type']>();
  private currentUserId?: string;
  private applicationId?: string;
  private presenceConversations = new Set<string>();
  private selfStatus: 'active' | 'away' = 'active';

  constructor(config: ChatConfig) {
    super();

    const baseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    this.currentUserId = config.userId;
    this.applicationId = config.applicationId;
    // Seed self-status from storage so a reload preserves the user's
    // last explicit choice. Silent fallback on SSR / blocked storage.
    this.selfStatus = readSelfStatus(this.applicationId, this.currentUserId);

    this.http = new HttpTransport({
      baseUrl,
      apiKey: config.apiKey,
      getToken: config.getToken ?? (config.sessionToken ? () => Promise.resolve(config.sessionToken!) : undefined),
    });

    this.ws = new WebSocketTransport({
      baseUrl,
      wsUrl: config.wsUrl,
      apiKey: config.apiKey,
      getToken: config.getToken ?? (config.sessionToken ? () => Promise.resolve(config.sessionToken!) : undefined),
      reconnect: config.reconnect,
    });

    this.cache = new MessageCache(
      config.messageCache?.maxMessages,
      config.messageCache?.maxConversations,
    );

    this.offlineQueue = new OfflineQueue(config.offlineQueue ?? true);

    // Forward WebSocket events
    this.ws.on('status', (status) => {
      switch (status) {
        case 'connected':
          this.emit('connected');
          this.flushOfflineQueue();
          break;
        case 'disconnected':
          this.emit('disconnected');
          break;
      }
    });

    this.ws.on('reconnecting', (data) => {
      this.emit('reconnecting', data);
    });

    this.ws.on('message', ({ channel, data }) => {
      this.handleRealtimeMessage(channel, data);
    });

    this.ws.on('presence:state', ({ channel, members }) => {
      const conversationId = channel.replace(/^conversation:(?:lr:|bc:|support:)?/, '');
      this.emit('presence:state', { conversationId, members });
    });

    this.ws.on('presence:join', ({ channel, user }) => {
      const conversationId = channel.replace(/^conversation:(?:lr:|bc:|support:)?/, '');
      this.emit('presence:join', { userId: user.user_id, conversationId, userData: user.user_data });
      // When our own user's presence resumes (initial join OR resubscribe
      // after a reconnect), re-assert the cached self-status so remote
      // observers see the right dot without a manual toggle.
      if (
        this.currentUserId &&
        user.user_id === this.currentUserId &&
        this.selfStatus === 'away'
      ) {
        this.updatePresence(conversationId, 'away');
      }
    });

    this.ws.on('presence:leave', ({ channel, userId }) => {
      const conversationId = channel.replace(/^conversation:(?:lr:|bc:|support:)?/, '');
      this.emit('presence:leave', { userId, conversationId });
    });

    this.ws.on('presence:update', ({ channel, userId, status, userData }) => {
      const conversationId = channel.replace(/^conversation:(?:lr:|bc:|support:)?/, '');
      this.emit('presence:update', { userId, conversationId, status, userData });
    });

    this.ws.on('error', ({ message }) => {
      this.emit('error', { code: 'ws_error', message });
    });
  }

  // ============ Connection ============

  get status(): ConnectionStatus {
    return this.ws.getStatus();
  }

  get userId(): string | undefined {
    return this.currentUserId;
  }

  connect(): void {
    this.ws.connect();
  }

  disconnect(): void {
    for (const unsub of this.conversationSubs.values()) {
      unsub();
    }
    this.conversationSubs.clear();
    this.ws.disconnect();
  }

  // ============ Conversations ============

  async createConversation(options: CreateConversationOptions): Promise<ApiResponse<Conversation>> {
    const body = {
      ...options,
      conversation_type: options.conversation_type ?? 'direct',
    };
    const result = await this.http.post<Conversation>('/v1/chat/conversations', body);
    if (result.data) this.trackConversationType(result.data);
    return result;
  }

  async listConversations(options?: ListConversationsOptions): Promise<ApiResponse<Conversation[]>> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.per_page) params.set('per_page', String(options.per_page));
    if (options?.conversation_type) params.set('conversation_type', options.conversation_type);
    const qs = params.toString();
    const result = await this.http.get<Conversation[]>(`/v1/chat/conversations${qs ? '?' + qs : ''}`);
    if (result.data) result.data.forEach((c) => this.trackConversationType(c));
    return result;
  }

  async getConversation(id: string): Promise<ApiResponse<Conversation>> {
    const result = await this.http.get<Conversation>(`/v1/chat/conversations/${id}`);
    if (result.data) this.trackConversationType(result.data);
    return result;
  }

  private trackConversationType(conversation: Conversation): void {
    if (conversation.conversation_type !== 'direct' && conversation.conversation_type !== 'group') {
      this.conversationTypes.set(conversation.id, conversation.conversation_type);
    }
  }

  // ============ Messages ============

  async sendMessage(conversationId: string, options: SendMessageOptions): Promise<ApiResponse<ChatMessage>> {
    const optimistic = options.optimistic ?? false;
    let stagedId: string | undefined;

    if (optimistic) {
      stagedId = options.tempId ?? `pending-${generateTempId()}`;
      const stagedMessage = this.buildOptimisticMessage(conversationId, stagedId, options);
      this.cache.upsertMessage(conversationId, stagedMessage);
      this.emit('message', { message: stagedMessage, conversationId });
    }

    const result = await this.http.post<ChatMessage>(
      `/v1/chat/conversations/${conversationId}/messages`,
      {
        content: options.content,
        content_format: options.content_format,
        message_type: options.message_type ?? 'text',
        attachments: options.attachments,
        thread_id: options.thread_id,
        is_thread_broadcast: options.is_thread_broadcast,
      },
    );

    if (result.data) {
      const reconciled = this.cache.reconcileOptimisticMessage(conversationId, result.data);
      this.cache.upsertMessage(conversationId, reconciled);
      if (optimistic) {
        this.emit('message', { message: reconciled, conversationId });
      }
    } else if (result.error?.status === 0) {
      // Network error — queue for offline delivery. The optimistic row
      // stays in place (is_pending) so the UI shows it will retry.
      this.offlineQueue.enqueue(
        conversationId,
        options.content,
        options.message_type ?? 'text',
        options.attachments,
      );
    } else if (optimistic && stagedId) {
      // Non-network failure (4xx / 5xx / parse error) — mark the
      // staged message as failed so the UI can surface a retry
      // affordance.
      const failed = this.markOptimisticFailed(conversationId, stagedId);
      if (failed) {
        this.emit('message:updated', {
          message: failed,
          conversationId,
          update: {
            message_id: failed.id,
            content: failed.content,
            is_edited: failed.is_edited,
            // Cast keeps the event shape backwards-compatible while
            // hosts that subscribe can read `message.is_failed`.
          } as MessageEditedEvent,
        });
      }
    }

    return result;
  }

  private buildOptimisticMessage(
    conversationId: string,
    id: string,
    options: SendMessageOptions,
  ): ChatMessage {
    const existing = this.cache
      .getMessages(conversationId)
      .find((m) => m.id === id);
    const now = new Date().toISOString();
    return {
      id,
      content: options.content,
      content_format: options.content_format,
      message_type: options.message_type ?? 'text',
      sender_id: this.currentUserId ?? 'me',
      attachments: options.attachments,
      reactions: existing?.reactions ?? [],
      is_edited: false,
      created_at: existing?.created_at ?? now,
      thread_id: options.thread_id,
      is_thread_broadcast: options.is_thread_broadcast,
      is_pending: true,
      is_failed: false,
    } as ChatMessage;
  }

  private markOptimisticFailed(
    conversationId: string,
    tempId: string,
  ): ChatMessage | null {
    const messages = this.cache.getMessages(conversationId);
    const target = messages.find((m) => m.id === tempId);
    if (!target) return null;
    const failed: ChatMessage = {
      ...target,
      is_pending: false,
      is_failed: true,
    };
    this.cache.upsertMessage(conversationId, failed);
    return failed;
  }

  /**
   * Retry a previously-failed optimistic send. Looks up the temp
   * message by id in the conversation cache, clears its `is_failed`
   * marker, and re-runs `sendMessage` with the same content and
   * attachments. Emits a `'message:updated'` event immediately so the
   * UI can revert to the pending visual state before the network
   * round-trip resolves.
   *
   * No-op when the id doesn't match a failed pending row.
   */
  async retryMessage(
    conversationId: string,
    tempId: string,
  ): Promise<ApiResponse<ChatMessage> | undefined> {
    const messages = this.cache.getMessages(conversationId);
    const failed = messages.find(
      (m) => m.id === tempId && m.is_failed === true,
    );
    if (!failed) return undefined;
    const pending: ChatMessage = {
      ...failed,
      is_pending: true,
      is_failed: false,
    };
    this.cache.upsertMessage(conversationId, pending);
    this.emit('message:updated', {
      message: pending,
      conversationId,
      update: {
        message_id: pending.id,
        content: pending.content,
        is_edited: pending.is_edited,
      } as MessageEditedEvent,
    });
    // System messages can't be re-sent via the public send path; the
    // retry API is only meaningful for user-authored messages, so fall
    // back to 'text' when the failed row wasn't a standard send type.
    const sendType: SendMessageOptions['message_type'] =
      failed.message_type === 'text' ||
      failed.message_type === 'image' ||
      failed.message_type === 'file' ||
      failed.message_type === 'snippet'
        ? failed.message_type
        : 'text';
    return this.sendMessage(conversationId, {
      content: failed.content,
      content_format: failed.content_format,
      message_type: sendType,
      attachments: failed.attachments,
      thread_id: failed.thread_id,
      is_thread_broadcast: failed.is_thread_broadcast,
      optimistic: true,
      tempId,
    });
  }

  /**
   * Remove a failed or pending optimistic message from the cache.
   * Used when the host wants to dismiss a failed send without
   * retrying. Emits `'message:deleted'` so subscribers reconcile.
   */
  dismissMessage(conversationId: string, messageId: string): boolean {
    const messages = this.cache.getMessages(conversationId);
    const target = messages.find((m) => m.id === messageId);
    if (!target) return false;
    this.cache.removeMessage(conversationId, messageId);
    this.emit('message:deleted', { messageId, conversationId });
    return true;
  }

  async getMessages(conversationId: string, options?: GetMessagesOptions): Promise<ApiResponse<MessagesResponse>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.before) params.set('before', options.before);
    if (options?.after) params.set('after', options.after);
    const qs = params.toString();

    const result = await this.http.get<MessagesResponse>(
      `/v1/chat/conversations/${conversationId}/messages${qs ? '?' + qs : ''}`,
    );

    if (result.data?.messages) {
      // Server returns DESC for initial/before queries. Normalize to chronological (oldest first)
      // so all consumers (React hook, web component) get consistent ordering.
      if (!options?.after) {
        result.data.messages = result.data.messages.slice().reverse();
      }

      if (!options?.before && !options?.after) {
        // Initial load — replace cache
        this.cache.setMessages(conversationId, result.data.messages);
      }
    }

    return result;
  }

  async getMessagesAround(
    conversationId: string,
    messageId: string,
    options?: GetMessagesAroundOptions,
  ): Promise<ApiResponse<MessagesAroundResponse>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString();

    return this.http.get<MessagesAroundResponse>(
      `/v1/chat/conversations/${conversationId}/messages/${messageId}/around${qs ? '?' + qs : ''}`,
    );
  }

  async getThreadReplies(messageId: string, options?: GetMessagesOptions): Promise<ApiResponse<MessagesResponse>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.before) params.set('before', options.before);
    if (options?.after) params.set('after', options.after);
    const qs = params.toString();

    return this.http.get<MessagesResponse>(
      `/v1/chat/messages/${messageId}/replies${qs ? '?' + qs : ''}`,
    );
  }

  async editMessage(
    messageId: string,
    content: string,
    attachments?: Attachment[],
    contentFormat?: 'plain' | 'html',
  ): Promise<ApiResponse<void>> {
    const body: Record<string, unknown> = { content };
    if (attachments !== undefined) {
      body.attachments = attachments;
    }
    if (contentFormat !== undefined) {
      body.content_format = contentFormat;
    }
    return this.http.patch<void>(`/v1/chat/messages/${messageId}`, body);
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<void>> {
    return this.http.del<void>(`/v1/chat/messages/${messageId}`);
  }

  async uploadAttachment(
    file: File | Blob,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal,
  ): Promise<ApiResponse<Attachment>> {
    const filename = typeof File !== 'undefined' && file instanceof File ? file.name : 'attachment';
    const contentType = file.type || 'application/octet-stream';

    const initResult = await this.http.post<PresignedUploadResponse>('/v1/storage/signed-url/upload', {
      filename,
      content_type: contentType,
      size_bytes: file.size,
      is_public: false,
      metadata: {
        source: 'chat_sdk',
      },
    });

    if (initResult.error || !initResult.data) {
      return { data: null, error: initResult.error };
    }

    const uploadResult = await uploadToPresignedUrl(
      initResult.data.upload_url,
      file,
      onProgress,
      signal,
    );

    if (uploadResult.error) {
      return { data: null, error: uploadResult.error };
    }

    const completeResult = await this.http.post<UploadCompleteResponse>('/v1/storage/signed-url/complete', {
      file_id: initResult.data.file_id,
      completion_token: initResult.data.completion_token,
    });

    if (completeResult.error || !completeResult.data) {
      return { data: null, error: completeResult.error };
    }

    return {
      data: {
        file_id: completeResult.data.file_id,
        file_name: completeResult.data.filename,
        file_size: completeResult.data.size_bytes,
        mime_type: completeResult.data.content_type,
        presigned_url: completeResult.data.url,
      },
      error: null,
    };
  }

  async refreshAttachmentUrl(
    messageId: string,
    fileId: string,
  ): Promise<ApiResponse<{ url: string }>> {
    return this.http.get<{ url: string }>(
      `/v1/chat/messages/${messageId}/attachment/${fileId}/url`,
    );
  }

  getCachedMessages(conversationId: string): ChatMessage[] {
    return this.cache.getMessages(conversationId);
  }

  stageOptimisticMessage(conversationId: string, message: ChatMessage): ChatMessage {
    this.cache.upsertMessage(conversationId, message);
    return message;
  }

  // ============ Reactions ============

  async addReaction(messageId: string, emoji: string): Promise<ApiResponse<void>> {
    return this.http.post<void>(`/v1/chat/messages/${messageId}/reactions`, { emoji });
  }

  async removeReaction(messageId: string, emoji: string): Promise<ApiResponse<void>> {
    return this.http.del<void>(`/v1/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  }

  // ============ Pins ============

  async pinMessage(messageId: string): Promise<ApiResponse<MessagePin>> {
    return this.http.post<MessagePin>(`/v1/chat/messages/${messageId}/pin`, {});
  }

  async unpinMessage(messageId: string): Promise<ApiResponse<void>> {
    return this.http.del<void>(`/v1/chat/messages/${messageId}/pin`);
  }

  async getPinnedMessages(
    conversationId: string,
  ): Promise<ApiResponse<{ pins: MessagePin[] }>> {
    return this.http.get<{ pins: MessagePin[] }>(
      `/v1/chat/conversations/${conversationId}/pins`,
    );
  }

  async reportMessage(
    messageId: string,
    reason: 'spam' | 'harassment' | 'hate' | 'violence' | 'other',
    description?: string,
  ): Promise<ApiResponse<{ reported: boolean }>> {
    return this.http.post<{ reported: boolean }>(`/v1/chat/messages/${messageId}/report`, {
      reason,
      description,
    });
  }

  async muteConversation(
    conversationId: string,
    mutedUntil?: string,
  ): Promise<ApiResponse<{ muted: boolean }>> {
    return this.http.post<{ muted: boolean }>(`/v1/chat/conversations/${conversationId}/mute`, {
      muted_until: mutedUntil,
    });
  }

  async unmuteConversation(conversationId: string): Promise<ApiResponse<{ muted: boolean }>> {
    return this.http.del<{ muted: boolean }>(`/v1/chat/conversations/${conversationId}/mute`);
  }

  // ============ Unread Count ============

  async getUnreadTotal(): Promise<ApiResponse<UnreadTotalResponse>> {
    return this.http.get<UnreadTotalResponse>('/v1/chat/conversations/unread-total');
  }

  // ============ Typing & Read Receipts ============

  async sendTyping(conversationId: string, isTyping = true): Promise<void> {
    await this.http.post(`/v1/chat/conversations/${conversationId}/typing`, { is_typing: isTyping });
  }

  async markRead(conversationId: string): Promise<void> {
    await this.http.post(`/v1/chat/conversations/${conversationId}/read`);
  }

  async getReadStatus(conversationId: string): Promise<ApiResponse<{ statuses: ReadStatus[] }>> {
    return this.http.get(`/v1/chat/conversations/${conversationId}/read-status`);
  }

  // ============ Participants ============

  async addParticipant(conversationId: string, userId: string): Promise<ApiResponse<void>> {
    return this.http.post<void>(`/v1/chat/conversations/${conversationId}/participants`, {
      user_id: userId,
    });
  }

  async removeParticipant(conversationId: string, userId: string): Promise<ApiResponse<void>> {
    return this.http.del<void>(`/v1/chat/conversations/${conversationId}/participants/${userId}`);
  }

  // ============ Presence ============

  joinPresence(conversationId: string, userData?: unknown): void {
    const channel = this.channelName(conversationId);
    this.presenceConversations.add(conversationId);
    this.ws.joinPresence(channel, userData);
  }

  leavePresence(conversationId: string): void {
    const channel = this.channelName(conversationId);
    this.presenceConversations.delete(conversationId);
    this.ws.leavePresence(channel);
  }

  /** Update presence status (online/away/dnd) without leaving the channel. */
  updatePresence(conversationId: string, status: 'online' | 'away' | 'dnd', userData?: unknown): void {
    const channel = this.channelName(conversationId);
    this.ws.send({ type: 'presence_update', channel, status, user_data: userData });
  }

  /**
   * Read the current self-status. Seeded from `localStorage` on
   * construction (per-user scoped key); defaults to `'active'`.
   */
  getStatus(): 'active' | 'away' {
    return this.selfStatus;
  }

  /**
   * Set the current self-status. Persists to `localStorage`, emits the
   * internal `status:changed` event, and broadcasts `updatePresence`
   * (`online` | `away`) to every conversation where presence has been
   * joined via `joinPresence`. Safe to call before any presence join —
   * the status is cached and re-applied automatically when a
   * conversation's presence resumes (see the `presence:join` wiring in
   * the constructor).
   *
   * **Does not touch the WebSocket ping keepalive.** The "away =
   * suppress heartbeat" model was considered and rejected (the
   * keepalive is a transport-layer concern; pausing it would make the
   * connection stale and trigger reconnects). Away is purely a
   * presence-level annotation — the server broadcasts the new status
   * to other users who receive the amber dot via `presence:update`.
   */
  setStatus(status: 'active' | 'away'): void {
    if (this.selfStatus === status) return;
    this.selfStatus = status;
    writeSelfStatus(this.applicationId, this.currentUserId, status);
    this.emit('status:changed', { status });
    const presenceStatus = status === 'active' ? 'online' : 'away';
    for (const conversationId of this.presenceConversations) {
      this.updatePresence(conversationId, presenceStatus);
    }
  }

  // ============ Channel Types ============

  async getChannelSettings(channelId: string): Promise<ApiResponse<ChannelSettings>> {
    return this.http.get<ChannelSettings>(`/v1/chat/channels/${channelId}/settings`);
  }

  /**
   * Set the conversation type for channel name routing.
   * Large rooms use `conversation:lr:` prefix to skip MySQL in the realtime service.
   */
  setConversationType(conversationId: string, type: Conversation['conversation_type']): void {
    this.conversationTypes.set(conversationId, type);
  }

  // ============ Channel Methods ============

  /**
   * Find an active ephemeral or large_room channel by linked session ID.
   * Returns null (not an error) if no active channel exists.
   */
  async findChannelBySessionId(linkedSessionId: string): Promise<ChannelWithSettings | null> {
    const result = await this.http.get<ChannelWithSettings>(
      `/v1/chat/channels/by-session?linked_session_id=${encodeURIComponent(linkedSessionId)}`
    );
    if (result.error?.status === 404) return null;
    if (result.data) {
      this.conversationTypes.set(result.data.id, result.data.channel_type as Conversation['conversation_type']);
    }
    return result.data;
  }

  /**
   * Join any channel (ephemeral, large room, or named). Idempotent.
   */
  async joinChannel(channelId: string): Promise<ApiResponse<{ participant_id: string; role: string; joined_at: string }>> {
    const result = await this.http.post<{ participant_id: string; role: string; joined_at: string }>(`/v1/chat/channels/${channelId}/join`, {});
    if (result.data) {
      this.emit('channel:changed');
    }
    return result;
  }

  /**
   * Create an ephemeral channel tied to a session (e.g., a video snap).
   */
  async createEphemeralChannel(options: CreateEphemeralChannelOptions): Promise<ApiResponse<ChannelWithSettings>> {
    const result = await this.http.post<ChannelWithSettings>('/v1/chat/channels/ephemeral', options);
    if (result.data) {
      this.conversationTypes.set(result.data.id, 'ephemeral');
    }
    return result;
  }

  /**
   * Create a large room channel (high-concurrency, skips MySQL tracking in realtime).
   */
  async createLargeRoom(options: CreateLargeRoomOptions): Promise<ApiResponse<ChannelWithSettings>> {
    const result = await this.http.post<ChannelWithSettings>('/v1/chat/channels/large-room', options);
    if (result.data) {
      this.conversationTypes.set(result.data.id, 'large_room');
    }
    return result;
  }

  /**
   * Get the global concurrent subscriber count for a conversation.
   */
  async getSubscriberCount(conversationId: string): Promise<number> {
    const result = await this.http.get<{ count: number }>(`/v1/chat/conversations/${conversationId}/subscriber-count`);
    return result.data?.count ?? 0;
  }

  // ============ Named Channels (Slack-style) ============

  /**
   * Create a named channel with optional visibility and description.
   */
  async createChannel(options: CreateChannelOptions): Promise<ApiResponse<Conversation>> {
    const result = await this.http.post<Conversation>('/v1/chat/channels', options);
    if (result.data) {
      this.conversationTypes.set(result.data.id, 'channel');
      this.emit('channel:changed');
    }
    return result;
  }

  /**
   * List/search discoverable channels. Returns public channels and private channels
   * you are a member of, with an `is_member` flag on each.
   */
  async listChannels(options?: ListChannelsOptions): Promise<ApiResponse<ChannelListItem[]>> {
    const params = new URLSearchParams();
    if (options?.search) params.set('search', options.search);
    if (options?.visibility) params.set('visibility', options.visibility);
    const qs = params.toString();
    return this.http.get<ChannelListItem[]>(`/v1/chat/channels${qs ? '?' + qs : ''}`);
  }

  /**
   * Leave a named channel. Unsubscribes from realtime events and presence,
   * removes the channel from local tracking, and emits 'channel:changed'.
   */
  /**
   * List the current user's pending channel invitations. Returns an empty
   * array when the server endpoint is not yet available so hosts can ship
   * the UI before the backend lands.
   */
  async listChannelInvitations(): Promise<ApiResponse<ChannelInvitation[]>> {
    return this.http.get<ChannelInvitation[]>('/v1/chat/channels/invitations');
  }

  /**
   * Invite users to a named channel. The server emits
   * `channel:invitation:received` to each recipient.
   */
  async inviteToChannel(
    channelId: string,
    userIds: string[],
  ): Promise<ApiResponse<void>> {
    return this.http.post<void>(
      `/v1/chat/channels/${channelId}/invitations`,
      { user_ids: userIds },
    );
  }

  /**
   * Accept a pending invitation. On success the SDK auto-joins the
   * channel (same effect as `joinChannel`) and emits `channel:changed`.
   */
  async acceptChannelInvitation(
    invitationId: string,
  ): Promise<ApiResponse<{ channel_id: string }>> {
    const result = await this.http.post<{ channel_id: string }>(
      `/v1/chat/channels/invitations/${invitationId}/accept`,
      {},
    );
    if (result.data) {
      this.emit('channel:invitation:resolved', {
        invitationId,
        status: 'accepted',
      });
      this.emit('channel:changed');
    }
    return result;
  }

  /**
   * Reject a pending invitation. The chat service tombstones the row;
   * subsequent `listChannelInvitations()` calls will not include it.
   */
  async rejectChannelInvitation(
    invitationId: string,
  ): Promise<ApiResponse<void>> {
    const result = await this.http.post<void>(
      `/v1/chat/channels/invitations/${invitationId}/reject`,
      {},
    );
    if (!result.error) {
      this.emit('channel:invitation:resolved', {
        invitationId,
        status: 'rejected',
      });
    }
    return result;
  }

  async leaveChannel(channelId: string): Promise<ApiResponse<void>> {
    const result = await this.http.post<void>(`/v1/chat/channels/${channelId}/leave`, {});
    if (!result.error) {
      // Unsubscribe from conversation WS channel
      const unsub = this.conversationSubs.get(channelId);
      if (unsub) {
        unsub();
        this.conversationSubs.delete(channelId);
      }
      // Leave presence
      this.leavePresence(channelId);
      // Remove from type tracking
      this.conversationTypes.delete(channelId);
      this.emit('channel:changed');
    }
    return result;
  }

  // ============ Search ============

  /**
   * Search messages within a conversation using full-text search (OpenSearch-backed).
   * Returns scored results with highlighted excerpts.
   */
  async searchMessages(conversationId: string, query: string, limit?: number): Promise<ApiResponse<ChatSearchResponse>> {
    const body: Record<string, unknown> = { query };
    if (limit !== undefined) body.limit = limit;
    return this.http.post<ChatSearchResponse>(`/v1/chat/conversations/${conversationId}/search`, body);
  }

  // ============ Realtime Subscriptions ============

  subscribeToConversation(conversationId: string): () => void {
    if (this.conversationSubs.has(conversationId)) {
      return this.conversationSubs.get(conversationId)!;
    }
    const channel = this.channelName(conversationId);
    const unsub = this.ws.subscribe(channel);
    this.conversationSubs.set(conversationId, unsub);
    return () => {
      this.conversationSubs.delete(conversationId);
      unsub();
    };
  }

  /** Build channel name with correct prefix based on conversation type. */
  private channelName(conversationId: string): string {
    const type = this.conversationTypes.get(conversationId);
    switch (type) {
      case 'large_room':
        return `conversation:lr:${conversationId}`;
      case 'broadcast':
        return `conversation:bc:${conversationId}`;
      case 'support':
        return `conversation:support:${conversationId}`;
      default:
        return `conversation:${conversationId}`;
    }
  }

  // ============ Cleanup ============

  destroy(): void {
    this.disconnect();
    this.cache.clear();
    this.removeAllListeners();
  }

  // ============ Private ============

  private handleRealtimeMessage(channel: string, data: unknown): void {
    if (channel.startsWith('conversation:')) {
      this.handleConversationMessage(channel, data);
      return;
    }
    if (channel.startsWith('private:')) {
      this.handlePrivateMessage(data);
      return;
    }
  }

  private handlePrivateMessage(data: unknown): void {
    const raw = data as Record<string, unknown>;
    if (!raw) return;

    const event = (raw.event as string) ?? (raw.type as string);
    const payload = (raw.data as Record<string, unknown>) ?? raw;

    switch (event) {
      case 'new_message': {
        const conversationId = payload.conversation_id as string;
        const messageId = (payload.id as string) ?? (payload.message_id as string);
        const senderId = payload.sender_id as string;
        const preview = (payload.content as string) ?? '';
        if (conversationId) {
          // Emit distinct inbox event — NOT 'message' to avoid double-counting
          // with conversation-channel events in useChat
          this.emit('inbox:update', { conversationId, messageId, senderId, preview });
        }
        break;
      }
      case 'support:new_conversation': {
        const conversationId = payload.conversation_id as string;
        const visitorName = payload.visitor_name as string | undefined;
        if (conversationId) {
          this.emit('support:new', { conversationId, visitorName });
        }
        break;
      }
      case 'support:assigned': {
        const conversationId = payload.conversation_id as string;
        const visitorName = payload.visitor_name as string | undefined;
        const visitorEmail = payload.visitor_email as string | undefined;
        if (conversationId) {
          this.emit('support:assigned', { conversationId, visitorName, visitorEmail });
        }
        break;
      }
    }
  }

  private normalizeMessage(payload: Record<string, unknown>): ChatMessage {
    return {
      id: (payload.id as string) ?? (payload.message_id as string) ?? '',
      content: (payload.content as string) ?? '',
      content_format: payload.content_format as 'plain' | 'html' | undefined,
      plain_text: payload.plain_text as string | undefined,
      message_type: ((payload.message_type as ChatMessage['message_type']) ?? 'text'),
      sender_id: (payload.sender_id as string) ?? (payload.sender_user_id as string) ?? '',
      sender_type: payload.sender_type as string | undefined,
      sender_agent_model: payload.sender_agent_model as string | undefined,
      attachments: payload.attachments as Attachment[] | undefined,
      reactions: payload.reactions as ChatMessage['reactions'] | undefined,
      is_edited: Boolean(payload.is_edited ?? false),
      created_at:
        (payload.created_at as string) ??
        (payload.updated_at as string) ??
        (payload.timestamp as string) ??
        new Date().toISOString(),
      thread_id: payload.thread_id as string | undefined,
      reply_count: payload.reply_count as number | undefined,
      latest_reply_at: payload.latest_reply_at as string | undefined,
      reply_user_ids: payload.reply_user_ids as string[] | undefined,
      is_thread_broadcast: payload.is_thread_broadcast as boolean | undefined,
    };
  }

  private buildEditedMessage(conversationId: string, update: MessageEditedEvent): ChatMessage | null {
    const messageId = update.message_id ?? update.id;
    if (!messageId) {
      return null;
    }

    const existing = this.cache.getMessage(conversationId, messageId);
    return {
      id: existing?.id ?? messageId,
      content: update.content ?? update.new_content ?? existing?.content ?? '',
      content_format:
        update.new_content_format ?? update.content_format ?? existing?.content_format,
      plain_text: update.new_plain_text ?? update.plain_text ?? existing?.plain_text,
      message_type: existing?.message_type ?? 'text',
      sender_id: existing?.sender_id ?? '',
      sender_type: existing?.sender_type,
      sender_agent_model: existing?.sender_agent_model,
      attachments: update.new_attachments ?? update.attachments ?? existing?.attachments,
      reactions: existing?.reactions,
      is_edited: true,
      created_at:
        existing?.created_at ??
        update.updated_at ??
        update.timestamp ??
        new Date().toISOString(),
    };
  }

  private applyReactionEvent(conversationId: string, reactionEvent: ReactionEvent): ChatReaction {
    const reaction: ChatReaction = {
      id: `${reactionEvent.message_id}:${reactionEvent.user_id}:${reactionEvent.emoji}`,
      message_id: reactionEvent.message_id,
      user_id: reactionEvent.user_id,
      emoji: reactionEvent.emoji,
      action: reactionEvent.action,
      timestamp: reactionEvent.timestamp,
    };

    const existingMessage = this.cache.getMessage(conversationId, reactionEvent.message_id);
    if (!existingMessage) {
      return reaction;
    }

    const nextReactions = [...(existingMessage.reactions ?? [])];
    const reactionIndex = nextReactions.findIndex((entry) => entry.emoji === reactionEvent.emoji);

    if (reactionEvent.action === 'added') {
      if (reactionIndex >= 0) {
        const current = nextReactions[reactionIndex];
        if (!current.user_ids.includes(reactionEvent.user_id)) {
          const user_ids = [...current.user_ids, reactionEvent.user_id];
          nextReactions[reactionIndex] = {
            ...current,
            user_ids,
            count: user_ids.length,
          };
        }
      } else {
        nextReactions.push({
          emoji: reactionEvent.emoji,
          count: 1,
          user_ids: [reactionEvent.user_id],
        });
      }
    } else if (reactionIndex >= 0) {
      const current = nextReactions[reactionIndex];
      const user_ids = current.user_ids.filter((userId) => userId !== reactionEvent.user_id);
      if (user_ids.length === 0) {
        nextReactions.splice(reactionIndex, 1);
      } else {
        nextReactions[reactionIndex] = {
          ...current,
          user_ids,
          count: user_ids.length,
        };
      }
    }

    this.cache.updateMessage(conversationId, {
      ...existingMessage,
      reactions: nextReactions,
    });

    return reaction;
  }

  private handleConversationMessage(channel: string, data: unknown): void {
    // Strip prefix: conversation:{id}, conversation:lr:{id}, conversation:bc:{id}
    const conversationId = channel.replace(/^conversation:(?:lr:|bc:|support:)?/, '');
    const raw = data as Record<string, unknown>;

    if (!raw) return;

    // The broadcast handler wraps messages as { event, data }.
    // Unwrap the envelope to get the event name and inner payload.
    const event = (raw.event as string) ?? (raw.type as string);
    const payload = (raw.data as Record<string, unknown>) ?? raw;

    switch (event) {
      case 'new_message': {
        const message = this.normalizeMessage(payload);
        const reconciled = this.cache.reconcileOptimisticMessage(conversationId, message);
        this.cache.upsertMessage(conversationId, reconciled);
        this.emit('message', { message: reconciled, conversationId });
        break;
      }
      case 'message_edited': {
        const update = payload as unknown as MessageEditedEvent;
        const message = this.buildEditedMessage(conversationId, update);
        if (message) {
          this.cache.upsertMessage(conversationId, message);
          this.emit('message:updated', { message, conversationId, update });
        }
        break;
      }
      case 'reaction': {
        const reactionEvent = payload as unknown as ReactionEvent;
        if (!reactionEvent.message_id || !reactionEvent.user_id || !reactionEvent.emoji) {
          break;
        }
        const reaction = this.applyReactionEvent(conversationId, reactionEvent);
        this.emit('reaction', {
          reaction,
          conversationId,
          action: reactionEvent.action,
        });
        break;
      }
      case 'message_pinned':
      case 'message_unpinned': {
        const pinPayload = payload as {
          message_id?: string;
          conversation_id?: string;
          pinned_by_user_id?: string;
          timestamp?: string;
        };
        if (!pinPayload.message_id) break;
        const action: 'pinned' | 'unpinned' = event === 'message_pinned' ? 'pinned' : 'unpinned';
        const pinnedAt = pinPayload.timestamp ?? new Date().toISOString();
        // Reflect on the cached message so the next render shows the pin badge.
        const cached = this.cache.getMessage(conversationId, pinPayload.message_id);
        if (cached) {
          this.cache.updateMessage(conversationId, {
            ...cached,
            is_pinned: action === 'pinned',
            pinned_at: action === 'pinned' ? pinnedAt : undefined,
          });
        }
        const pin: MessagePin = {
          message_id: pinPayload.message_id,
          conversation_id: pinPayload.conversation_id ?? conversationId,
          pinned_by_user_id: pinPayload.pinned_by_user_id ?? '',
          pinned_at: pinnedAt,
        };
        this.emit('pin', { pin, conversationId, action });
        break;
      }
      case 'message_deleted': {
        const messageId = (payload as { message_id?: string }).message_id ?? (payload as { id?: string }).id;
        if (messageId) {
          this.cache.removeMessage(conversationId, messageId as string);
          this.emit('message:deleted', { messageId: messageId as string, conversationId });
        }
        break;
      }
      case 'user_typing': {
        const userId = (payload as { user_id?: string }).user_id;
        if (userId) {
          this.emit('typing', { userId, conversationId });
        }
        break;
      }
      case 'user_stopped_typing': {
        const userId = (payload as { user_id?: string }).user_id;
        if (userId) {
          this.emit('typing:stop', { userId, conversationId });
        }
        break;
      }
      case 'typing_batch': {
        // Batched typing from large rooms — emit individual typing events for each user
        const users = (payload as { users?: string[] }).users ?? [];
        for (const userId of users) {
          this.emit('typing', { userId, conversationId });
        }
        break;
      }
      case 'messages_read': {
        const userId = (payload as { user_id?: string }).user_id;
        const lastReadAt = (payload as { last_read_at?: string }).last_read_at;
        if (userId && lastReadAt) {
          this.emit('read', { userId, conversationId, lastReadAt });
        }
        break;
      }
      case 'thread_update': {
        const messageId = (payload as { message_id?: string }).message_id;
        const latestReplyAt = (payload as { latest_reply_at?: string }).latest_reply_at;
        const replyUserId = (payload as { reply_user_id?: string }).reply_user_id;
        if (messageId && latestReplyAt && replyUserId) {
          // Update cached parent message's reply_count
          const existing = this.cache.getMessage(conversationId, messageId);
          if (existing) {
            this.cache.updateMessage(conversationId, {
              ...existing,
              reply_count: (existing.reply_count ?? 0) + 1,
              latest_reply_at: latestReplyAt,
              reply_user_ids: existing.reply_user_ids
                ? existing.reply_user_ids.includes(replyUserId)
                  ? existing.reply_user_ids
                  : [...existing.reply_user_ids, replyUserId]
                : [replyUserId],
            });
          }
          this.emit('thread:update', { conversationId, messageId, latestReplyAt, replyUserId });
        }
        break;
      }
      case 'room_upgraded': {
        const newType = (payload as { new_type?: string }).new_type;
        if (newType === 'large_room') {
          // Update conversation type for channel routing
          this.conversationTypes.set(conversationId, 'large_room');
          // Unsubscribe from old channel and re-subscribe with new prefix
          const oldUnsub = this.conversationSubs.get(conversationId);
          if (oldUnsub) {
            oldUnsub();
            this.conversationSubs.delete(conversationId);
            // Re-subscribe with new large_room prefix
            this.subscribeToConversation(conversationId);
          }
          this.emit('room_upgraded', { conversationId, newType: 'large_room' });
        }
        break;
      }
    }
  }

  private async flushOfflineQueue(): Promise<void> {
    const queued = this.offlineQueue.drain();
    for (const item of queued) {
      await this.sendMessage(item.conversationId, {
        content: item.content,
        message_type: item.message_type as 'text' | 'image' | 'file',
        attachments: item.attachments as Attachment[] | undefined,
      });
    }
  }
}

// ============ Self-status persistence ============
//
// Scoped per `applicationId` + `userId` so multi-tenant hosts don't
// cross-leak status between users on the same browser profile. Keys
// that can't be scoped (e.g. SSR or before auth resolves) degrade to a
// non-persistent default; `safeStorage` already handles storage-blocked
// environments silently.

const SELF_STATUS_KEY_PREFIX = 'sm-chat-self-status-v1';

function statusKey(applicationId?: string, userId?: string): string | null {
  if (!applicationId || !userId) return null;
  return `${SELF_STATUS_KEY_PREFIX}:${applicationId}:${userId}`;
}

function readSelfStatus(
  applicationId?: string,
  userId?: string,
): 'active' | 'away' {
  const key = statusKey(applicationId, userId);
  if (!key) return 'active';
  const raw = readJson<{ status?: 'active' | 'away' } | 'active' | 'away'>(key);
  if (!raw) return 'active';
  if (raw === 'active' || raw === 'away') return raw;
  if (typeof raw === 'object' && (raw.status === 'active' || raw.status === 'away')) {
    return raw.status;
  }
  return 'active';
}

function writeSelfStatus(
  applicationId: string | undefined,
  userId: string | undefined,
  status: 'active' | 'away',
): void {
  const key = statusKey(applicationId, userId);
  if (!key) return;
  writeJson(key, status);
}
