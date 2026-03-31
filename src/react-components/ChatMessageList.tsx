import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { ChatMessage } from '../types';
import { ChatMessageItem } from './ChatMessageItem';
import { formatDayLabel, isSameDay } from './utils';

interface ChatMessageListProps {
  messages: ChatMessage[];
  currentUserId?: string;
  unreadSince?: string;
  scrollToUnreadOnMount?: boolean;
  onAddReaction?: (messageId: string, emoji: string) => void | Promise<void>;
  onRemoveReaction?: (messageId: string, emoji: string) => void | Promise<void>;
  onReport?: (messageId: string) => void | Promise<void>;
  emptyState?: React.ReactNode;
}

function getUnreadIndex(messages: ChatMessage[], unreadSince?: string): number {
  if (!unreadSince) return -1;
  return messages.findIndex((message) => new Date(message.created_at).getTime() > new Date(unreadSince).getTime());
}

export function ChatMessageList({
  messages,
  currentUserId,
  unreadSince,
  scrollToUnreadOnMount = true,
  onAddReaction,
  onRemoveReaction,
  onReport,
  emptyState,
}: ChatMessageListProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const unreadMarkerRef = useRef<HTMLDivElement | null>(null);
  const lastMessageCountRef = useRef(messages.length);
  const didScrollToUnreadRef = useRef(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const unreadIndex = useMemo(() => getUnreadIndex(messages, unreadSince), [messages, unreadSince]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const shouldStickToBottom = distanceFromBottom < 80;

    if (messages.length > lastMessageCountRef.current && shouldStickToBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      setShowJumpToLatest(false);
    } else if (messages.length > lastMessageCountRef.current) {
      setShowJumpToLatest(true);
    }

    lastMessageCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (!scrollToUnreadOnMount || unreadIndex < 0 || didScrollToUnreadRef.current) {
      return;
    }

    unreadMarkerRef.current?.scrollIntoView({ block: 'center' });
    didScrollToUnreadRef.current = true;
  }, [scrollToUnreadOnMount, unreadIndex, messages.length]);

  if (!messages.length) {
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
      <div
        ref={containerRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const distanceFromBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight;
          setShowJumpToLatest(distanceFromBottom > 120);
        }}
        style={{
          height: '100%',
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: 'var(--sm-surface-muted, #f8fafc)',
        }}
      >
        {messages.map((message, index) => {
          const previousMessage = messages[index - 1];
          const showDateDivider = !previousMessage || !isSameDay(previousMessage.created_at, message.created_at);
          const showUnreadDivider = unreadIndex === index;

          return (
            <React.Fragment key={message.id}>
              {showDateDivider ? (
                <div
                  style={{
                    alignSelf: 'center',
                    fontSize: 12,
                    color: 'var(--sm-muted-text, #6b7280)',
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(148, 163, 184, 0.12)',
                  }}
                >
                  {formatDayLabel(message.created_at)}
                </div>
              ) : null}

              {showUnreadDivider ? (
                <div
                  ref={unreadMarkerRef}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: 'var(--sm-primary, #2563eb)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: 'rgba(37, 99, 235, 0.28)' }} />
                  <span>New messages</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(37, 99, 235, 0.28)' }} />
                </div>
              ) : null}

              <ChatMessageItem
                message={message}
                currentUserId={currentUserId}
                onAddReaction={onAddReaction}
                onRemoveReaction={onRemoveReaction}
                onReport={onReport}
                highlight={showUnreadDivider}
              />
            </React.Fragment>
          );
        })}
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          onClick={() => {
            containerRef.current?.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: 'smooth',
            });
            setShowJumpToLatest(false);
          }}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            border: 'none',
            borderRadius: 999,
            background: 'var(--sm-primary, #2563eb)',
            color: '#fff',
            padding: '10px 14px',
            cursor: 'pointer',
            boxShadow: '0 12px 28px rgba(37, 99, 235, 0.28)',
          }}
        >
          New messages
        </button>
      ) : null}
    </div>
  );
}
