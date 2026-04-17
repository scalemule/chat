// ============ Configuration ============

export interface ChatConfig {
  apiKey?: string;
  embedToken?: string;
  apiBaseUrl?: string;
  wsUrl?: string;
  applicationId?: string;
  userId?: string;
  sessionToken?: string;
  getToken?: () => Promise<string | null>;
  debug?: boolean;
  reconnect?: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  };
  messageCache?: {
    maxMessages?: number;
    maxConversations?: number;
  };
  offlineQueue?: boolean;
}

// ============ API Response Contract ============

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

// ============ Domain Types ============

export interface Conversation {
  id: string;
  conversation_type: 'direct' | 'group' | 'broadcast' | 'ephemeral' | 'large_room' | 'support' | 'channel';
  name?: string;
  created_by?: string;
  participant_count?: number;
  last_message_at?: string;
  unread_count?: number;
  /**
   * Count of unread @-mentions of the current user in this conversation.
   * Server-side hint; pair with `useMentionCounts()` for the live overlay
   * (`ConversationList` sums the two).
   */
  mention_count?: number;
  is_muted?: boolean;
  last_message_preview?: string;
  last_message_sender_id?: string;
  counterparty_user_id?: string;
  visibility?: 'public' | 'private';
  description?: string;
  created_at: string;
  participants?: Participant[];
}

export interface Participant {
  user_id: string;
  role: string;
  joined_at: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  /** Content format: 'plain' (escaped on render) or 'html' (sanitized HTML allowed). */
  content_format?: 'plain' | 'html';
  /** Plain text extraction, used for previews/search/notifications. */
  plain_text?: string;
  message_type: ChatMessageType;
  sender_id: string;
  sender_type?: string;
  sender_agent_model?: string;
  attachments?: Attachment[];
  reactions?: ReactionSummary[];
  is_edited: boolean;
  created_at: string;
  thread_id?: string;
  reply_count?: number;
  latest_reply_at?: string;
  reply_user_ids?: string[];
  is_thread_broadcast?: boolean;
  /**
   * Client-only marker — `true` while the message is optimistically
   * staged but not yet acknowledged by the server. The server never
   * sets this field. When the server confirms the send, the optimistic
   * row is replaced with the real one (which lacks `is_pending`).
   */
  is_pending?: boolean;
  /**
   * Client-only marker — `true` when the HTTP POST that backs an
   * optimistic send returned an error. `is_pending` is cleared at the
   * same time. Hosts typically render a retry affordance and call
   * `useChat().retryMessage(id)` (or re-run `sendMessage` directly).
   */
  is_failed?: boolean;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  user_ids: string[];
}

export interface Attachment {
  file_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  presigned_url?: string;
  thumbnail_url?: string;
}

export interface ReadStatus {
  user_id: string;
  last_read_at?: string;
}

export interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  action?: 'added' | 'removed';
  timestamp?: string;
}

export interface MessageEditedEvent {
  id?: string;
  message_id: string;
  conversation_id: string;
  content?: string;
  new_content?: string;
  content_format?: 'plain' | 'html';
  new_content_format?: 'plain' | 'html';
  plain_text?: string;
  new_plain_text?: string;
  new_attachments?: Attachment[];
  attachments?: Attachment[];
  editor_user_id?: string;
  is_edited?: boolean;
  updated_at?: string;
  timestamp?: string;
}

export interface ReactionEvent {
  message_id: string;
  conversation_id?: string;
  user_id: string;
  emoji: string;
  action: 'added' | 'removed';
  timestamp?: string;
}

export interface PresenceMember {
  user_id: string;
  /**
   * Host-reported status for this presence membership. Typically
   * `"online"` (default — member is connected) or `"away"` (user
   * explicitly marked themselves away via `ChatClient.setStatus`,
   * shipping in 0.0.57). Kept as `string` to allow host-specific
   * values without a type bump.
   */
  status?: 'online' | 'away' | string;
  user_data?: unknown;
  joined_at: string;
}

// ============ Channel Types ============

export interface ChannelSettings {
  publisher_user_ids?: string[];
  linked_session_id?: string;
  expires_at?: string;
  max_participants?: number;
  slow_mode_seconds?: number;
}

export interface ChannelWithSettings {
  id: string;
  channel_type: string;
  name?: string;
  created_at: string;
  linked_session_id?: string;
  expires_at?: string;
  participant_count: number;
}

export interface CreateEphemeralChannelOptions {
  linked_session_id: string;
  name?: string;
  ttl_minutes?: number;
}

export interface CreateLargeRoomOptions {
  name: string;
  linked_session_id?: string;
  max_participants?: number;
  slow_mode_seconds?: number;
}

// ============ Event Map ============

export interface ChatEventMap {
  connected: void;
  disconnected: void;
  reconnecting: { attempt: number };
  'message': { message: ChatMessage; conversationId: string };
  'message:updated': { message: ChatMessage; conversationId: string; update?: MessageEditedEvent };
  'message:deleted': { messageId: string; conversationId: string };
  'typing': { userId: string; conversationId: string };
  'typing:stop': { userId: string; conversationId: string };
  'presence:join': { userId: string; conversationId: string; userData?: unknown };
  'presence:leave': { userId: string; conversationId: string };
  'presence:update': { userId: string; conversationId: string; status: string; userData?: unknown };
  'presence:state': { conversationId: string; members: PresenceMember[] };
  'read': { userId: string; conversationId: string; lastReadAt: string };
  'reaction': { reaction: ChatReaction; conversationId: string; action: 'added' | 'removed' };
  'thread:update': { conversationId: string; messageId: string; latestReplyAt: string; replyUserId: string };
  'room_upgraded': { conversationId: string; newType: 'large_room' };
  'delivery': { messageId: string; status: 'sent' | 'delivered' | 'read' };
  'inbox:update': { conversationId: string; messageId: string; senderId: string; preview: string };
  'support:new': { conversationId: string; visitorName?: string };
  'support:assigned': { conversationId: string; visitorName?: string; visitorEmail?: string };
  'channel:changed': void;
  'channel:invitation:received': { invitation: ChannelInvitation };
  'channel:invitation:resolved': { invitationId: string; status: 'accepted' | 'rejected' };
  'status:changed': { status: 'active' | 'away' };
  'error': { code: string; message: string };
}

/**
 * Pending channel invitation. The chat service emits these via the
 * `channel:invitation:received` event and surfaces them through
 * `listChannelInvitations()`. When the user accepts or rejects, the
 * service emits `channel:invitation:resolved`.
 */
export interface ChannelInvitation {
  id: string;
  channel_id: string;
  channel_name?: string;
  channel_description?: string;
  invited_by: string;
  invited_by_display_name?: string;
  created_at: string;
}

// ============ Connection Status ============

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// ============ Request Types ============

/** All message types the server can emit (for incoming/rendered messages). */
export type ChatMessageType = 'text' | 'image' | 'file' | 'system' | 'snippet';

/**
 * Message types SDK callers are allowed to SEND.
 * - `system` is excluded — reserved for internal services.
 * - `snippet` is used when auto-promoting oversized content (>40K chars) to
 *   a file-backed collapsible block. Triggered via `uploadSnippet` helper.
 */
export type SendMessageType = 'text' | 'image' | 'file' | 'snippet';

export interface SendMessageOptions {
  content: string;
  /** Content format. Defaults to 'plain' on the server. */
  content_format?: 'plain' | 'html';
  message_type?: SendMessageType;
  attachments?: Attachment[];
  thread_id?: string;
  is_thread_broadcast?: boolean;
  /**
   * When `true`, the client stages an optimistic copy of the message
   * in the local cache with `is_pending: true` and emits a
   * `'message'` event before the network round-trip. The temp row is
   * replaced with the server-returned message on success. On failure,
   * the temp row is marked `is_failed: true` so the UI can offer a
   * retry. Default `false` — callers that already manage optimistic
   * state via `stageOptimisticMessage` can keep the existing flow.
   */
  optimistic?: boolean;
  /**
   * When combined with `optimistic`, reuses an existing pending /
   * failed temp-message id instead of generating a new one. Used by
   * `ChatClient.retryMessage` to retry a previously-failed send
   * without duplicating the row in the list.
   */
  tempId?: string;
}

export interface ListConversationsOptions {
  page?: number;
  per_page?: number;
  conversation_type?: 'direct' | 'group' | 'broadcast' | 'ephemeral' | 'large_room' | 'support' | 'channel';
}

export interface UnreadTotalResponse {
  unread_conversations: number;
  unread_messages: number;
}

export interface GetMessagesOptions {
  limit?: number;
  before?: string;
  after?: string;
}

export interface CreateConversationOptions {
  conversation_type?: 'direct' | 'group';
  name?: string;
  participant_ids: string[];
}

// ============ Messages Response ============

export interface MessagesResponse {
  messages: ChatMessage[];
  has_more?: boolean;
  oldest_id?: string;
  newest_id?: string;
}

export interface GetMessagesAroundOptions {
  limit?: number;
}

export interface MessagesAroundResponse {
  messages: ChatMessage[];
  target_message_id: string;
  has_older: boolean;
  has_newer: boolean;
}

export interface PresignedUploadResponse {
  file_id: string;
  upload_url: string;
  completion_token: string;
  expires_at: string;
  method?: string;
}

export interface UploadCompleteResponse {
  file_id: string;
  filename: string;
  size_bytes: number;
  content_type: string;
  url: string;
  already_completed: boolean;
  scan_queued: boolean;
}

// ============ Named Channels (Slack-style) ============

export interface CreateChannelOptions {
  name: string;
  visibility?: 'public' | 'private';
  description?: string;
}

export interface ChannelListItem {
  id: string;
  name: string | null;
  visibility: string | null;
  description: string | null;
  member_count: number;
  created_at: string;
  is_member: boolean;
}

export interface ListChannelsOptions {
  search?: string;
  visibility?: 'public' | 'private';
}

// ============ Search ============

export interface ChatSearchResult {
  message: ChatMessage;
  score: number;
  highlights: string[];
}

export interface ChatSearchResponse {
  results: ChatSearchResult[];
  total: number;
  query: string;
}

/**
 * A per-conversation search result annotated with its source so callers
 * can render / navigate across conversations. Produced by
 * `useGlobalSearch` from `@scalemule/chat/search`.
 *
 * Extends the single-conversation `ChatSearchResult` shape rather than
 * embedding it so host code that already handles `ChatSearchResult`
 * properties keeps working.
 */
export interface GlobalSearchResult extends ChatSearchResult {
  conversationId: string;
  /** Populated when the fan-out input was a `Conversation[]`. */
  conversation?: Conversation;
}
