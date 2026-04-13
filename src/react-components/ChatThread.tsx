import React, { useEffect, useMemo } from 'react';

import { useChat, useChatClient, useTyping, usePresence } from '../react';
import type { Attachment, ApiResponse } from '../types';
import { ChatInput } from './ChatInput';
import { ChatMessageList } from './ChatMessageList';
import { TypingIndicator } from './TypingIndicator';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';

interface UserProfile {
  display_name: string;
  username?: string;
  avatar_url?: string;
}

interface ChatThreadProps {
  conversationId: string;
  theme?: ChatTheme;
  currentUserId?: string;
  profiles?: Map<string, UserProfile>;
  title?: string;
  subtitle?: string;
  onFetchAttachmentUrl?: (fileId: string) => Promise<string>;
  /** Cleanup handler for removing uploaded attachments on cancel. */
  onDeleteAttachment?: (fileId: string) => Promise<void>;
  /** File validation before upload. Return error string to reject, null to accept. */
  onValidateFile?: (file: File) => string | null;
  /** Max attachments per message. Default 5. */
  maxAttachments?: number;
  /** File input accept filter. Default "image/*,video/*". */
  accept?: string;
}

function inferMessageType(content: string, attachments: Attachment[]): 'text' | 'image' | 'file' {
  if (!attachments.length) return 'text';
  if (!content && attachments.every((attachment) => attachment.mime_type.startsWith('image/'))) {
    return 'image';
  }
  return 'file';
}

export function ChatThread({
  conversationId,
  theme,
  currentUserId,
  profiles,
  title = 'Chat',
  subtitle,
  onFetchAttachmentUrl,
  onDeleteAttachment,
  onValidateFile,
  maxAttachments,
  accept,
}: ChatThreadProps): React.JSX.Element {
  const client = useChatClient();
  const resolvedUserId = currentUserId ?? client.userId;
  const {
    messages,
    readStatuses,
    isLoading,
    error,
    hasMore,
    sendMessage,
    loadMore,
    markRead,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    reportMessage,
    uploadAttachment,
  } = useChat(conversationId);
  const { typingUsers, sendTyping } = useTyping(conversationId);
  const { members } = usePresence(conversationId);

  const ownReadStatus = useMemo(
    () =>
      resolvedUserId
        ? readStatuses.find((status) => status.user_id === resolvedUserId)?.last_read_at
        : undefined,
    [readStatuses, resolvedUserId],
  );

  const otherTypingUsers = useMemo(
    () => typingUsers.filter((userId) => userId !== resolvedUserId),
    [typingUsers, resolvedUserId],
  );

  const activeMembers = useMemo(
    () => members.filter((member) => member.userId !== resolvedUserId),
    [members, resolvedUserId],
  );

  useEffect(() => {
    if (!messages.length) return;
    void markRead();
  }, [markRead, messages.length, messages[messages.length - 1]?.id]);

  return (
    <div
      data-scalemule-chat=""
      style={{
        ...themeToStyle(theme),
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 320,
        borderRadius: 'var(--sm-border-radius, 16px)',
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        background: 'var(--sm-surface, #fff)',
        color: 'var(--sm-text-color, #111827)',
        fontFamily: 'var(--sm-font-family)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--sm-muted-text, #6b7280)' }}>
            {otherTypingUsers.length
              ? 'Typing...'
              : subtitle ?? (activeMembers.length ? `${activeMembers.length} online` : 'No one online')}
          </div>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--sm-muted-text, #6b7280)',
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: activeMembers.length ? '#22c55e' : '#94a3b8',
            }}
          />
          {activeMembers.length ? 'Online' : 'Away'}
        </div>
      </div>

      {error ? (
        <div
          style={{
            padding: '10px 16px',
            fontSize: 13,
            color: '#b91c1c',
            background: '#fef2f2',
            borderBottom: '1px solid #fecaca',
          }}
        >
          {error}
        </div>
      ) : null}

      <ChatMessageList
        messages={messages}
        currentUserId={resolvedUserId}
        conversationId={conversationId}
        profiles={profiles}
        hasMore={hasMore}
        isLoading={isLoading}
        onLoadMore={loadMore}
        onAddReaction={(messageId, emoji) => void addReaction(messageId, emoji)}
        onRemoveReaction={(messageId, emoji) => void removeReaction(messageId, emoji)}
        onEdit={(messageId, content, attachments) => void editMessage(messageId, content, attachments)}
        onDelete={(messageId) => void deleteMessage(messageId)}
        onReport={(messageId) => void reportMessage(messageId, 'other')}
        onFetchAttachmentUrl={onFetchAttachmentUrl}
        onUploadAttachment={uploadAttachment}
        onDeleteAttachment={onDeleteAttachment}
        onValidateFile={onValidateFile}
        maxAttachments={maxAttachments}
        accept={accept}
        unreadSince={ownReadStatus}
        onReachBottom={() => void markRead()}
        emptyState={isLoading ? 'Loading messages...' : 'Start the conversation'}
      />

      <TypingIndicator
        typingUsers={otherTypingUsers}
        resolveUserName={(userId) => profiles?.get(userId)?.display_name ?? 'Someone'}
      />

      <ChatInput
        onSend={async (content, attachments) => {
          await sendMessage(content, {
            attachments,
            message_type: inferMessageType(content, attachments ?? []),
          });
        }}
        onTypingChange={(isTyping) => {
          sendTyping(isTyping);
        }}
        onUploadAttachment={uploadAttachment}
        onDeleteAttachment={onDeleteAttachment}
        onValidateFile={onValidateFile}
        maxAttachments={maxAttachments}
        accept={accept}
      />
    </div>
  );
}
