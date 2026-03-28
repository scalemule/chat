// ============ Configuration ============

export interface ChatConfig {
  apiKey?: string;
  embedToken?: string;
  apiBaseUrl?: string;
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
  conversation_type: 'direct' | 'group' | 'broadcast' | 'ephemeral' | 'large_room';
  name?: string;
  created_by?: string;
  participant_count?: number;
  last_message_at?: string;
  unread_count?: number;
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
  is_edited: boolean;
  created_at: string;
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
  'message:updated': { message: ChatMessage; conversationId: string };
  'message:deleted': { messageId: string; conversationId: string };
  'typing': { userId: string; conversationId: string };
  'typing:stop': { userId: string; conversationId: string };
  'presence:join': { userId: string; conversationId: string; userData?: unknown };
  'presence:leave': { userId: string; conversationId: string };
  'presence:update': { userId: string; conversationId: string; status: string; userData?: unknown };
  'presence:state': { conversationId: string; members: PresenceMember[] };
  'read': { userId: string; conversationId: string; lastReadAt: string };
  'reaction': { reaction: ChatReaction; conversationId: string };
  'room_upgraded': { conversationId: string; newType: 'large_room' };
  'delivery': { messageId: string; status: 'sent' | 'delivered' | 'read' };
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
