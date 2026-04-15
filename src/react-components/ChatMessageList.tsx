import React, { useState, useEffect, useRef, useCallback } from 'react';

import type { Attachment, ApiResponse, ChatMessage } from '../types';
import { ChatMessageItem } from './ChatMessageItem';
import { defaultFormatDateLabel, isSameCalendarDay } from './dateLabel';

interface UserProfile {
  display_name: string;
  username?: string;
  avatar_url?: string;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  currentUserId?: string;
  conversationId?: string;
  profiles?: Map<string, UserProfile>;
  hasMore?: boolean;
  isLoading?: boolean;
  onLoadMore?: () => void;
  onAddReaction?: (messageId: string, emoji: string) => void | Promise<void>;
  onRemoveReaction?: (messageId: string, emoji: string) => void | Promise<void>;
  onEdit?: (
    messageId: string,
    content: string,
    attachments?: Attachment[],
    contentFormat?: 'plain' | 'html',
  ) => void | Promise<void>;
  onDelete?: (messageId: string) => void | Promise<void>;
  onReport?: (messageId: string) => void;
  onFetchAttachmentUrl?: (fileId: string) => Promise<string>;
  firstUnreadMessageId?: string;
  /** @deprecated use firstUnreadMessageId instead */
  unreadSince?: string;
  /** Scroll to and visually highlight a specific message (e.g. from search results). */
  highlightMessageId?: string;
  isNearBottom?: boolean;
  onReachBottom?: () => void;
  emptyState?: React.ReactNode;
  /**
   * Render-prop escape hatch: replace the default `ChatMessageItem` with a
   * fully custom renderer. Receives the message and computed render context
   * (own/highlight flags, resolved profile). Use this when you want custom
   * bubble chrome without losing the list-level features (date dividers,
   * unread divider, scroll management, load-more).
   *
   * When omitted, the default `ChatMessageItem` is used.
   */
  renderMessage?: (
    message: ChatMessage,
    context: {
      isOwnMessage: boolean;
      highlight: boolean;
      profile: UserProfile | undefined;
      currentUserId: string | undefined;
      conversationId: string | undefined;
      /** True when this message starts a new calendar-day group. */
      showDateSeparator: boolean;
      /** Resolved date label for the separator above this message. `null`
       *  when `showDateSeparator` is false. */
      dateLabel: string | null;
      /** True when this message groups with the previous one (same sender
       *  within `groupingWindowMs`, no divider in between). Custom renderers
       *  should suppress avatar/header to preserve list polish. */
      isGrouped: boolean;
    },
  ) => React.ReactNode;
  /**
   * Override the date-separator label. Receives the message's ISO timestamp
   * and the resolved options (locale, timeZone). Default is
   * `defaultFormatDateLabel`, which renders Today / Yesterday / weekday name
   * (last 6 days) / "Apr 4" / "Apr 4, 2025".
   *
   * SSR hosts: pass either this prop or `dateLabelTimeZone` to keep the
   * server's "Today" boundary in sync with the client's.
   */
  formatDateLabel?: (iso: string) => string;
  /** BCP-47 locale for the default date-label formatter. */
  dateLabelLocale?: string;
  /**
   * IANA time-zone for the default date-label formatter. Recommended for SSR
   * to avoid Today/Yesterday hydration mismatches when server and client
   * disagree on the local date.
   */
  dateLabelTimeZone?: string;
  /**
   * Forwarded to the default `ChatMessageItem` for per-attachment custom
   * rendering (e.g. click-to-expand image lightbox, branded video player).
   * Ignored when `renderMessage` is provided.
   */
  renderAttachment?: (attachment: Attachment) => React.ReactNode;
  /**
   * Forwarded to the default `ChatMessageItem` for custom avatar rendering
   * on other-user messages. Ignored when `renderMessage` is provided.
   */
  renderAvatar?: (
    profile: UserProfile | undefined,
    message: ChatMessage,
  ) => React.ReactNode;
  /** Avatar display size in pixels. Forwarded to ChatMessageItem. Default 32. */
  avatarSize?: number;
  /** Transform a profile's avatar_url into an optimized thumbnail URL. Forwarded to ChatMessageItem. */
  getAvatarUrl?: (profile: UserProfile) => string | undefined;
  /** Forwarded to ChatMessageItem for adding attachments during edit. */
  onUploadAttachment?: (
    file: File | Blob,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal,
  ) => Promise<ApiResponse<Attachment>>;
  /** Forwarded to ChatMessageItem for cleaning up removed/cancelled uploads. */
  onDeleteAttachment?: (fileId: string) => Promise<void>;
  /** Forwarded to ChatMessageItem for validating files before upload. */
  onValidateFile?: (file: File) => string | null;
  /** Forwarded to ChatMessageItem. Max attachments per message. Default 5. */
  maxAttachments?: number;
  /** Forwarded to ChatMessageItem. File input accept filter. Default "image/*,video/*". */
  accept?: string;
  /**
   * Group consecutive messages from the same sender within this many ms
   * (avatar + sender header are suppressed on grouped messages). System
   * messages never group; date-separator and unread-divider boundaries
   * always break grouping. Default 300_000 (5 minutes). Pass `0` to disable.
   */
  groupingWindowMs?: number;
  /**
   * Click handler for `<span class="sm-mention" data-sm-user-id>` elements
   * inside HTML messages. Forwarded to ChatMessageItem.
   */
  onMentionClick?: (userId: string, message: ChatMessage) => void;
  /**
   * Click handler for `<span class="sm-channel-mention" data-sm-channel-id>`
   * elements inside HTML messages. Forwarded to ChatMessageItem.
   */
  onChannelMentionClick?: (channelId: string, message: ChatMessage) => void;
}

export function ChatMessageList({
  messages,
  currentUserId,
  conversationId,
  profiles,
  hasMore = false,
  isLoading = false,
  onLoadMore,
  onAddReaction,
  onRemoveReaction,
  onEdit,
  onDelete,
  onReport,
  onFetchAttachmentUrl,
  firstUnreadMessageId,
  unreadSince,
  highlightMessageId,
  isNearBottom: isNearBottomProp,
  onReachBottom,
  emptyState,
  renderMessage,
  renderAttachment,
  renderAvatar,
  avatarSize,
  getAvatarUrl,
  onUploadAttachment,
  onDeleteAttachment,
  onValidateFile,
  maxAttachments,
  accept,
  formatDateLabel,
  dateLabelLocale,
  dateLabelTimeZone,
  groupingWindowMs = 300_000,
  onMentionClick,
  onChannelMentionClick,
}: ChatMessageListProps): React.JSX.Element {
  const resolveDateLabel = useCallback(
    (iso: string) =>
      formatDateLabel
        ? formatDateLabel(iso)
        : defaultFormatDateLabel(iso, {
            locale: dateLabelLocale,
            timeZone: dateLabelTimeZone,
          }),
    [formatDateLabel, dateLabelLocale, dateLabelTimeZone],
  );
  const sameDay = useCallback(
    (a: string, b: string) =>
      isSameCalendarDay(a, b, {
        locale: dateLabelLocale,
        timeZone: dateLabelTimeZone,
      }),
    [dateLabelLocale, dateLabelTimeZone],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);
  const isNearBottomRef = useRef(true);
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false);

  // Resolve unreadSince to firstUnreadMessageId if needed
  const resolvedFirstUnreadId =
    firstUnreadMessageId ??
    (unreadSince
      ? messages.find(
          (m) =>
            new Date(m.created_at).getTime() > new Date(unreadSince).getTime(),
        )?.id
      : undefined);

  // Sync external isNearBottom prop into our ref
  useEffect(() => {
    if (isNearBottomProp !== undefined) {
      isNearBottomRef.current = isNearBottomProp;
    }
  }, [isNearBottomProp]);

  // Track if user is near the bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    const nearBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    isNearBottomRef.current = nearBottom;

    if (nearBottom) {
      setShowNewMessagesPill(false);
    }

    // Mark as read when user scrolls past the unread divider
    if (unreadDividerRef.current && el) {
      const dividerRect = unreadDividerRef.current.getBoundingClientRect();
      const containerRect = el.getBoundingClientRect();
      if (dividerRect.bottom < containerRect.bottom) {
        onReachBottom?.();
      }
    } else if (nearBottom) {
      onReachBottom?.();
    }
  }, [onReachBottom]);

  // Auto-scroll to bottom on new messages if user is near bottom, otherwise show pill
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      if (isNearBottomRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setShowNewMessagesPill(true);
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Initial scroll: to highlighted message, unread divider, or bottom
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      if (highlightMessageId && highlightRef.current) {
        highlightRef.current.scrollIntoView({
          block: 'center',
          behavior: 'instant' as ScrollBehavior,
        });
      } else if (resolvedFirstUnreadId && unreadDividerRef.current) {
        unreadDividerRef.current.scrollIntoView({
          block: 'start',
          behavior: 'instant' as ScrollBehavior,
        });
      } else {
        bottomRef.current?.scrollIntoView({
          behavior: 'instant' as ScrollBehavior,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, resolvedFirstUnreadId, highlightMessageId]);

  // IntersectionObserver on bottomRef: detects when bottom is visible
  useEffect(() => {
    const container = containerRef.current;
    const bottom = bottomRef.current;
    if (!container || !bottom) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onReachBottom?.();
        }
      },
      { root: container, threshold: 0.1 },
    );
    observer.observe(bottom);
    return () => observer.disconnect();
  }, [onReachBottom]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowNewMessagesPill(false);
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--sm-muted-text, #6b7280)',
          fontSize: 14,
          padding: 24,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            border: '2px solid var(--sm-border-color, #e5e7eb)',
            borderTopColor: 'var(--sm-primary, #2563eb)',
            borderRadius: 999,
            animation: 'sm-spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--sm-muted-text, #6b7280)',
          fontSize: 14,
          padding: 24,
        }}
      >
        {emptyState ?? 'No messages yet'}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      {/* Inject keyframe animation for spinner */}
      <style>{`@keyframes sm-spin { to { transform: rotate(360deg); } }`}</style>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          height: '100%',
          overflowY: 'auto',
          position: 'relative',
          background: 'var(--sm-surface-muted, #f8fafc)',
        }}
      >
        {/* Load more */}
        {hasMore && onLoadMore && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '12px 0',
            }}
          >
            <button
              onClick={onLoadMore}
              type="button"
              style={{
                fontSize: 12,
                color: 'var(--sm-muted-text, #6b7280)',
                fontWeight: 500,
                padding: '4px 12px',
                borderRadius: 999,
                border: '1px solid var(--sm-border-color, #e5e7eb)',
                background: 'var(--sm-surface, #fff)',
                cursor: 'pointer',
              }}
            >
              Load earlier messages
            </button>
          </div>
        )}

        {/* Messages with date separators and unread divider */}
        {messages.map((msg, i) => {
          const prevMsg = i > 0 ? messages[i - 1] : null;
          const showDateSeparator =
            !prevMsg || !sameDay(msg.created_at, prevMsg.created_at);
          const dateLabel = showDateSeparator
            ? resolveDateLabel(msg.created_at)
            : null;
          const showUnreadDivider = resolvedFirstUnreadId === msg.id;
          const isHighlighted = highlightMessageId === msg.id;
          const isOwn = msg.sender_id === currentUserId;
          const isGrouped =
            groupingWindowMs > 0 &&
            !!prevMsg &&
            !showDateSeparator &&
            !showUnreadDivider &&
            msg.message_type !== 'system' &&
            prevMsg.message_type !== 'system' &&
            !!msg.sender_id &&
            msg.sender_id === prevMsg.sender_id &&
            new Date(msg.created_at).getTime() -
              new Date(prevMsg.created_at).getTime() <
              groupingWindowMs;

          return (
            <React.Fragment key={msg.id}>
              {showUnreadDivider && (
                <div
                  ref={unreadDividerRef}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 16px',
                    margin: '4px 0',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background:
                        'var(--sm-unread-divider-color, rgba(37, 99, 235, 0.4))',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--sm-primary, #2563eb)',
                      fontWeight: 500,
                      background:
                        'var(--sm-unread-divider-bg, rgba(37, 99, 235, 0.06))',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    New messages
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background:
                        'var(--sm-unread-divider-color, rgba(37, 99, 235, 0.4))',
                    }}
                  />
                </div>
              )}
              {showDateSeparator && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 16px',
                    margin: '4px 0',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: 'var(--sm-border-color, #e5e7eb)',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--sm-muted-text, #6b7280)',
                      fontWeight: 500,
                    }}
                  >
                    {dateLabel}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: 'var(--sm-border-color, #e5e7eb)',
                    }}
                  />
                </div>
              )}
              <div ref={isHighlighted ? highlightRef : undefined}>
                {renderMessage ? (
                  renderMessage(msg, {
                    isOwnMessage: isOwn,
                    highlight: showUnreadDivider || isHighlighted,
                    profile: profiles?.get(msg.sender_id),
                    currentUserId,
                    conversationId,
                    showDateSeparator,
                    dateLabel,
                    isGrouped,
                  })
                ) : (
                  <ChatMessageItem
                    message={msg}
                    currentUserId={currentUserId}
                    conversationId={conversationId}
                    profile={profiles?.get(msg.sender_id)}
                    onAddReaction={onAddReaction}
                    onRemoveReaction={onRemoveReaction}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReport={onReport}
                    onFetchAttachmentUrl={onFetchAttachmentUrl}
                    onUploadAttachment={onUploadAttachment}
                    onDeleteAttachment={onDeleteAttachment}
                    onValidateFile={onValidateFile}
                    maxAttachments={maxAttachments}
                    accept={accept}
                    isOwnMessage={isOwn}
                    highlight={showUnreadDivider || isHighlighted}
                    isGrouped={isGrouped}
                    onMentionClick={onMentionClick}
                    onChannelMentionClick={onChannelMentionClick}
                    renderAttachment={renderAttachment}
                    renderAvatar={renderAvatar}
                    avatarSize={avatarSize}
                    getAvatarUrl={getAvatarUrl}
                  />
                )}
              </div>
            </React.Fragment>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Floating "New messages" pill */}
      {showNewMessagesPill && (
        <button
          onClick={scrollToBottom}
          type="button"
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            border: 'none',
            borderRadius: 999,
            background: 'var(--sm-primary, #2563eb)',
            color: '#fff',
            padding: '6px 16px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            fontSize: 12,
            fontWeight: 500,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 14 }}>&#8595;</span> New messages
        </button>
      )}
    </div>
  );
}
