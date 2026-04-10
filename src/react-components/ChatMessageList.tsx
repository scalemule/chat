import React, { useState, useEffect, useRef, useCallback } from 'react';

import type { Attachment, ChatMessage } from '../types';
import { ChatMessageItem } from './ChatMessageItem';

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
  onEdit?: (messageId: string, content: string, attachments?: Attachment[]) => void | Promise<void>;
  onDelete?: (messageId: string) => void | Promise<void>;
  onReport?: (messageId: string) => void;
  onFetchAttachmentUrl?: (fileId: string) => Promise<string>;
  firstUnreadMessageId?: string;
  /** @deprecated use firstUnreadMessageId instead */
  unreadSince?: string;
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
    },
  ) => React.ReactNode;
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
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
  isNearBottom: isNearBottomProp,
  onReachBottom,
  emptyState,
  renderMessage,
}: ChatMessageListProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);
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

  // Initial scroll: to unread divider if present, otherwise to bottom
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      if (resolvedFirstUnreadId && unreadDividerRef.current) {
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
  }, [isLoading, resolvedFirstUnreadId]);

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
            !prevMsg || !isSameDay(msg.created_at, prevMsg.created_at);
          const showUnreadDivider = resolvedFirstUnreadId === msg.id;
          const isOwn = msg.sender_id === currentUserId;

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
                    {getDateLabel(msg.created_at)}
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
              {renderMessage ? (
                renderMessage(msg, {
                  isOwnMessage: isOwn,
                  highlight: showUnreadDivider,
                  profile: profiles?.get(msg.sender_id),
                  currentUserId,
                  conversationId,
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
                  isOwnMessage={isOwn}
                  highlight={showUnreadDivider}
                />
              )}
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
