import React, { useMemo, useState } from 'react';

import { useConversations } from '../react';
import type { Conversation } from '../types';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';
import {
  resolveConversationDisplayName,
  type ParticipantProfile,
} from './conversationDisplay';

interface ConversationListProps {
  conversationType?: Conversation['conversation_type'];
  selectedConversationId?: string | null;
  onSelect?: (conversation: Conversation) => void;
  theme?: ChatTheme;
  title?: string;
  /**
   * Current user id. Used to identify self-DMs and to filter the current
   * user out of default group display names.
   */
  currentUserId?: string;
  /**
   * Profile lookup by user id. When provided, `display_name` is used in
   * place of raw user ids for group display names and the self-DM label.
   */
  profiles?: Map<string, ParticipantProfile>;
  /**
   * Label appended after the current user's name for self-DMs. Default
   * `"(you)"`. Internationalize as needed.
   */
  selfLabel?: string;
  /**
   * Override the default group-name formatter ("Alice, Bob, and N others").
   * Receives the ordered other-participant display names (current user
   * already filtered out) and the current user id.
   */
  formatGroupName?: (
    participantNames: string[],
    currentUserId: string | undefined,
  ) => string;
}

function formatPreview(conversation: Conversation): string {
  if (conversation.last_message_preview) {
    return conversation.last_message_preview;
  }

  return conversation.name ?? conversation.id;
}

export function ConversationList({
  conversationType,
  selectedConversationId,
  onSelect,
  theme,
  title = 'Conversations',
  currentUserId,
  profiles,
  selfLabel,
  formatGroupName,
}: ConversationListProps): React.JSX.Element {
  const { conversations, isLoading } = useConversations({
    conversationType,
  });
  const [search, setSearch] = useState('');

  const resolveName = useMemo(
    () =>
      (conversation: Conversation): string =>
        resolveConversationDisplayName(conversation, {
          currentUserId,
          profiles,
          selfLabel,
          formatGroupName,
        }),
    [currentUserId, profiles, selfLabel, formatGroupName],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const haystack = [
        resolveName(conversation),
        conversation.name,
        conversation.last_message_preview,
        conversation.counterparty_user_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [conversations, search, resolveName]);

  return (
    <div
      data-scalemule-chat=""
      style={{
        ...themeToStyle(theme),
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 280,
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
          padding: 16,
          borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search conversations"
          style={{
            width: '100%',
            borderRadius: 12,
            border: '1px solid var(--sm-border-color, #e5e7eb)',
            padding: '10px 12px',
            font: 'inherit',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div
            style={{
              padding: 24,
              fontSize: 14,
              color: 'var(--sm-muted-text, #6b7280)',
            }}
          >
            Loading conversations...
          </div>
        ) : !filtered.length ? (
          <div
            style={{
              padding: 24,
              fontSize: 14,
              color: 'var(--sm-muted-text, #6b7280)',
            }}
          >
            No conversations found
          </div>
        ) : (
          filtered.map((conversation) => {
            const selected = conversation.id === selectedConversationId;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelect?.(conversation)}
                style={{
                  width: '100%',
                  border: 'none',
                  borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
                  padding: 16,
                  textAlign: 'left',
                  background: selected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {resolveName(conversation)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {conversation.is_muted ? (
                      <span style={{ fontSize: 11, color: 'var(--sm-muted-text, #6b7280)' }}>Muted</span>
                    ) : null}
                    {conversation.unread_count ? (
                      <span
                        style={{
                          minWidth: 22,
                          height: 22,
                          borderRadius: 999,
                          background: 'var(--sm-primary, #2563eb)',
                          color: '#fff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '0 6px',
                        }}
                      >
                        {conversation.unread_count}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--sm-muted-text, #6b7280)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatPreview(conversation)}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
