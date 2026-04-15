export { ChatClient } from './core/ChatClient';
export { SupportClient } from './support';
export { RepClient } from './rep';
export { ChatController } from './shared/ChatController';
export { uploadSnippet, MAX_SNIPPET_SIZE_BYTES, SNIPPET_PREVIEW_LENGTH } from './shared/snippet';
export type { UploadSnippetResult, SnippetUploadFn } from './shared/snippet';
export { linkify, hasLinks } from './shared/linkify';
export type { LinkifySegment, LinkifyTextSegment, LinkifyLinkSegment } from './shared/linkify';
export type {
  SupportConversation,
  SupportClientConfig,
  SupportWidgetConfig,
  SupportWidgetPreChatField,
} from './support';
export type {
  RepClientConfig,
  SupportRep,
  RegisterRepOptions,
  SupportInboxItem,
  SupportUnreadCount,
  InboxListOptions,
  UpdateWidgetConfigOptions,
} from './rep';
export type { ChatControllerState } from './shared/ChatController';
export { CHAT_VERSION } from './version';
export type {
  ApiError,
  ApiResponse,
  Attachment,
  ChannelListItem,
  ChannelSettings,
  ChannelWithSettings,
  ChatConfig,
  ChatEventMap,
  ChatMessage,
  ChatReaction,
  ChatSearchResponse,
  ChatSearchResult,
  ConnectionStatus,
  Conversation,
  CreateChannelOptions,
  CreateConversationOptions,
  CreateEphemeralChannelOptions,
  CreateLargeRoomOptions,
  GetMessagesOptions,
  ListChannelsOptions,
  ListConversationsOptions,
  MessageEditedEvent,
  MessagesResponse,
  Participant,
  PresenceMember,
  ReactionEvent,
  ReactionSummary,
  ReadStatus,
  SendMessageOptions,
  UnreadTotalResponse,
} from './types';
