import React, {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
} from 'react';

import { useChat, useChatClient, useTyping, usePresence } from '../react';
import type { Attachment, ApiResponse } from '../types';
import { ChatInput } from './ChatInput';
import { ChatMessageList } from './ChatMessageList';
import { TypingIndicator } from './TypingIndicator';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';

// Lazy entry for the rich-text editor — keeps Quill out of the core React
// bundle for plain-text consumers.
const LazyRichTextInput = lazy(() =>
  import('../editor').then((m) => ({ default: m.RichTextInput })),
);

function EditorLoadingSkeleton({
  placeholder,
}: {
  placeholder?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        borderTop: '1px solid var(--sm-border-color, #e5e7eb)',
        background: 'var(--sm-surface, #fff)',
        padding: '20px 16px',
        color: 'var(--sm-muted-text, #6b7280)',
        fontSize: 13,
      }}
      aria-busy="true"
      aria-live="polite"
    >
      {placeholder ?? 'Loading editor…'}
    </div>
  );
}

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
  /** Avatar display size in pixels. Default 32. */
  avatarSize?: number;
  /** Transform a profile's avatar_url into an optimized thumbnail URL. */
  getAvatarUrl?: (profile: UserProfile) => string | undefined;
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
  /** Max content length in Unicode code points. Default 40,000 (Slack-parity). */
  maxLength?: number;
  /** Enable snippet auto-promote for over-limit messages. Default false. */
  enableSnippetPromote?: boolean;
  /** Filename for snippet uploads. Default "message.txt". */
  snippetFilename?: string;
  /**
   * Composer variant. `"plain"` (default) uses the built-in textarea; `"rich"`
   * lazy-loads `@scalemule/chat/editor`'s Quill-backed `RichTextInput`. The
   * `rich` variant requires `quill` installed in the host app (it's a peer dep)
   * and the host's CSS to include `@scalemule/chat/editor.css`.
   */
  editor?: 'plain' | 'rich';
  /** Placeholder text for the composer. */
  placeholder?: string;
  /** Forwarded to the rich editor only — ignored when `editor="plain"`. */
  showToolbar?: boolean;
  enableMarkdownShortcuts?: boolean;
  enableEmoticonReplace?: boolean;
  enableAutoLink?: boolean;
  /**
   * Override the date-separator label. See `ChatMessageList.formatDateLabel`.
   */
  formatDateLabel?: (iso: string) => string;
  /** BCP-47 locale for the default date-label formatter. */
  dateLabelLocale?: string;
  /**
   * IANA time-zone for the default date-label formatter. Recommended for SSR
   * to avoid Today/Yesterday hydration mismatches.
   */
  dateLabelTimeZone?: string;
  /**
   * Group consecutive messages from the same sender within this many ms.
   * See `ChatMessageList.groupingWindowMs`. Default 300_000 (5 min); `0`
   * disables grouping.
   */
  groupingWindowMs?: number;
  /**
   * Click handler for `.sm-mention` chips inside HTML messages. Forwarded.
   * Hosts wire navigation (open profile, route to `/u/{id}`, etc).
   */
  onMentionClick?: (userId: string, message: import('../types').ChatMessage) => void;
  /**
   * Click handler for `.sm-channel-mention` chips inside HTML messages.
   * Forwarded.
   */
  onChannelMentionClick?: (channelId: string, message: import('../types').ChatMessage) => void;
  /**
   * Auto-linkify URLs in plain-text messages. Default true. Forwarded to
   * the message list / item.
   */
  linkifyPlainText?: boolean;
  /**
   * Render rich-link embeds below the message body. Hosts opt in via
   * `@scalemule/chat/embeds`. Forwarded.
   */
  renderEmbeds?: (message: import('../types').ChatMessage) => React.ReactNode;
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
  avatarSize,
  getAvatarUrl,
  title = 'Chat',
  subtitle,
  onFetchAttachmentUrl,
  onDeleteAttachment,
  onValidateFile,
  maxAttachments,
  accept,
  maxLength,
  enableSnippetPromote,
  snippetFilename,
  editor = 'plain',
  placeholder,
  showToolbar,
  enableMarkdownShortcuts,
  enableEmoticonReplace,
  enableAutoLink,
  formatDateLabel,
  dateLabelLocale,
  dateLabelTimeZone,
  groupingWindowMs,
  onMentionClick,
  onChannelMentionClick,
  linkifyPlainText,
  renderEmbeds,
}: ChatThreadProps): React.JSX.Element {
  const [sendError, setSendError] = useState<string | null>(null);
  const sendErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss send error after 6 seconds
  useEffect(() => {
    if (!sendError) return;
    if (sendErrorTimerRef.current) clearTimeout(sendErrorTimerRef.current);
    sendErrorTimerRef.current = setTimeout(() => setSendError(null), 6000);
    return () => {
      if (sendErrorTimerRef.current) clearTimeout(sendErrorTimerRef.current);
    };
  }, [sendError]);

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

  // ChatInput.onValidateFile expects { valid, error } while ChatMessageItem
  // uses string|null. Adapt the unified prop for the send composer.
  const inputValidateFile = useCallback(
    (file: File): { valid: boolean; error?: string } => {
      if (!onValidateFile) return { valid: true };
      const err = onValidateFile(file);
      return err ? { valid: false, error: err } : { valid: true };
    },
    [onValidateFile],
  );

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
        avatarSize={avatarSize}
        getAvatarUrl={getAvatarUrl}
        hasMore={hasMore}
        isLoading={isLoading}
        onLoadMore={loadMore}
        onAddReaction={(messageId, emoji) => void addReaction(messageId, emoji)}
        onRemoveReaction={(messageId, emoji) => void removeReaction(messageId, emoji)}
        onEdit={(messageId, content, attachments, contentFormat) =>
          void editMessage(messageId, content, attachments, contentFormat)
        }
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
        formatDateLabel={formatDateLabel}
        dateLabelLocale={dateLabelLocale}
        dateLabelTimeZone={dateLabelTimeZone}
        groupingWindowMs={groupingWindowMs}
        onMentionClick={onMentionClick}
        onChannelMentionClick={onChannelMentionClick}
        linkifyPlainText={linkifyPlainText}
        renderEmbeds={renderEmbeds}
      />

      <TypingIndicator
        typingUsers={otherTypingUsers}
        resolveUserName={(userId) => profiles?.get(userId)?.display_name ?? 'Someone'}
      />

      {sendError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '0 16px 8px',
            padding: '8px 12px',
            background: 'var(--sm-error-bg, #fef2f2)',
            color: 'var(--sm-error-text, #991b1b)',
            border: '1px solid var(--sm-error-border, #fecaca)',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <span style={{ flex: 1 }}>{sendError}</span>
          <button
            type="button"
            onClick={() => setSendError(null)}
            aria-label="Dismiss error"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {editor === 'rich' ? (
        <Suspense fallback={<EditorLoadingSkeleton placeholder={placeholder} />}>
          <LazyRichTextInput
            onSend={async (content, attachments, options) => {
              return await sendMessage(content, {
                attachments,
                message_type:
                  options?.message_type ??
                  (inferMessageType(content, attachments ?? []) as 'text' | 'image' | 'file'),
                content_format: options?.content_format,
              });
            }}
            onSendError={(err) => setSendError(err.message)}
            onTypingChange={(isTyping) => {
              sendTyping(isTyping);
            }}
            onUploadAttachment={uploadAttachment}
            onDeleteAttachment={onDeleteAttachment}
            onValidateFile={onValidateFile ? inputValidateFile : undefined}
            maxAttachments={maxAttachments}
            accept={accept}
            maxLength={maxLength ?? 40000}
            enableSnippetPromote={enableSnippetPromote}
            snippetFilename={snippetFilename}
            placeholder={placeholder}
            showToolbar={showToolbar}
            enableMarkdownShortcuts={enableMarkdownShortcuts}
            enableEmoticonReplace={enableEmoticonReplace}
            enableAutoLink={enableAutoLink}
          />
        </Suspense>
      ) : (
        <ChatInput
          onSend={async (content, attachments, options) => {
            return await sendMessage(content, {
              attachments,
              message_type:
                options?.message_type ??
                (inferMessageType(content, attachments ?? []) as 'text' | 'image' | 'file'),
              content_format: options?.content_format,
            });
          }}
          onSendError={(err) => setSendError(err.message)}
          onTypingChange={(isTyping) => {
            sendTyping(isTyping);
          }}
          onUploadAttachment={uploadAttachment}
          onDeleteAttachment={onDeleteAttachment}
          onValidateFile={onValidateFile ? inputValidateFile : undefined}
          maxAttachments={maxAttachments}
          accept={accept}
          maxLength={maxLength ?? 40000}
          enableSnippetPromote={enableSnippetPromote}
          snippetFilename={snippetFilename}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
