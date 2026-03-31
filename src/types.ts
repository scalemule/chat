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
  conversation_type: 'direct' | 'group' | 'broadcast' | 'ephemeral' | 'large_room' | 'support';
  name?: string;
  created_by?: string;
  participant_count?: number;
  last_message_at?: string;
  unread_count?: number;
  is_muted?: boolean;
  last_message_preview?: string;
  last_message_sender_id?: string;
  counterparty_user_id?: string;
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
  message_type: 'text' | 'image' | 'file' | 'system';
  sender_id: string;
  sender_type?: string;
  sender_agent_model?: string;
  attachments?: Attachment[];
  reactions?: ReactionSummary[];
  is_edited: boolean;
  created_at: string;
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
  'room_upgraded': { conversationId: string; newType: 'large_room' };
  'delivery': { messageId: string; status: 'sent' | 'delivered' | 'read' };
  'inbox:update': { conversationId: string; messageId: string; senderId: string; preview: string };
  'support:new': { conversationId: string; visitorName?: string };
  'support:assigned': { conversationId: string; visitorName?: string; visitorEmail?: string };
  'error': { code: string; message: string };
}

// ============ Connection Status ============

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// ============ Request Types ============

export interface SendMessageOptions {
  content: string;
  message_type?: 'text' | 'image' | 'file';
  attachments?: Attachment[];
}

export interface ListConversationsOptions {
  page?: number;
  per_page?: number;
  conversation_type?: 'direct' | 'group' | 'broadcast' | 'ephemeral' | 'large_room' | 'support';
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
