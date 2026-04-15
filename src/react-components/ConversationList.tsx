import React, { useEffect, useMemo, useState } from 'react';

import { useConversations, useMentionCounts } from '../react';
import type { Conversation } from '../types';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';
import {
  resolveConversationDisplayName,
  type ParticipantProfile,
} from './conversationDisplay';
import { readJson, writeJson } from '../shared/safeStorage';

type ConversationType = Conversation['conversation_type'];

const COLLAPSE_STORAGE_KEY = 'sm-conv-list-section-collapsed-v1';
const DEFAULT_SECTION_ORDER: ConversationType[] = [
  'channel',
  'group',
  'direct',
];
const DEFAULT_SECTION_LABELS: Partial<Record<ConversationType, string>> = {
  channel: 'CHANNELS',
  group: 'GROUPS',
  direct: 'DIRECT MESSAGES',
  broadcast: 'BROADCASTS',
  ephemeral: 'EPHEMERAL',
  large_room: 'ROOMS',
  support: 'SUPPORT',
};

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
  /**
   * Sidebar layout mode.
   *   - `"flat"` (default) — single scrollable list, no headers.
   *   - `"type"` — partition rows by `conversation_type` and render a
   *     collapsible header for each group ("CHANNELS", "DIRECT MESSAGES",
   *     etc.). Per-section collapsed state is persisted to `localStorage`
   *     under `sm-conv-list-section-collapsed-v1` (silently no-ops in SSR
   *     or blocked-storage contexts).
   */
  groupBy?: 'flat' | 'type';
  /**
   * Override the default section header labels when `groupBy="type"`.
   * Pass the keys you want to relabel; missing keys keep the defaults
   * (CHANNELS, GROUPS, DIRECT MESSAGES, etc.). Useful for i18n.
   */
  sectionLabels?: Partial<Record<ConversationType, string>>;
  /**
   * Order — and inclusion filter — of section types when `groupBy="type"`.
   * Sections not listed here are hidden entirely. Default order:
   * `['channel', 'group', 'direct']`.
   */
  sectionOrder?: ConversationType[];
  /**
   * Whether to render the per-row @-mention badge. Default `true` — the
   * badge only renders when the computed count is > 0, so hosts without
   * mentions incur no visible chrome regardless of this setting. Set
   * `false` to suppress the badge entirely (e.g. for a simplified
   * customer-facing sidebar).
   */
  showMentionBadge?: boolean;
  /**
   * Optional override for mention counts. When provided, this map is used
   * verbatim; when absent, the component uses `useMentionCounts()` with
   * `currentUserId` internally. Hosts can pass a custom store (e.g. a
   * Redux selector) without giving up the rendering.
   */
  mentionCounts?: Map<string, number>;
  /**
   * Render-prop for an indicator placed in the conversation-row header
   * (before the mention/unread badges). Typical use: a pulsing dot
   * showing an active call on that conversation.
   *
   * ```tsx
   * import { ActiveCallDot } from '@scalemule/chat/react';
   * import { useActiveCall } from '@scalemule/conference/react';
   *
   * <ConversationList
   *   renderActiveIndicator={(c) => (
   *     <ActiveCallDot active={useActiveCall(c.id).active} />
   *   )}
   * />
   * ```
   *
   * The SDK stays free of conference-SDK dependencies — hosts wire the
   * source of truth (conference presence, WebRTC signaling, etc.).
   */
  renderActiveIndicator?: (conversation: Conversation) => React.ReactNode;
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
  groupBy = 'flat',
  sectionLabels,
  sectionOrder,
  showMentionBadge = true,
  mentionCounts: mentionCountsProp,
  renderActiveIndicator,
}: ConversationListProps): React.JSX.Element {
  const { conversations, isLoading } = useConversations({
    conversationType,
  });
  const liveMentionCounts = useMentionCounts(currentUserId);
  const mentionCounts = mentionCountsProp ?? liveMentionCounts;
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

  // Per-section collapsed state for groupBy='type'. Persisted to
  // localStorage when available; silent no-op otherwise.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    () => readJson<Record<string, boolean>>(COLLAPSE_STORAGE_KEY) ?? {},
  );
  useEffect(() => {
    writeJson(COLLAPSE_STORAGE_KEY, collapsed);
  }, [collapsed]);
  const toggleCollapsed = (type: ConversationType) => {
    setCollapsed((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const renderRow = (conversation: Conversation): React.JSX.Element => {
    const selected = conversation.id === selectedConversationId;
    const mentionCount =
      (conversation.mention_count ?? 0) +
      (mentionCounts.get(conversation.id) ?? 0);
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
            {renderActiveIndicator ? renderActiveIndicator(conversation) : null}
            {conversation.is_muted ? (
              <span style={{ fontSize: 11, color: 'var(--sm-muted-text, #6b7280)' }}>Muted</span>
            ) : null}
            {showMentionBadge && mentionCount > 0 ? (
              <span
                className="sm-mention-badge"
                aria-label={`${mentionCount} unread ${mentionCount === 1 ? 'mention' : 'mentions'}`}
                style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: 999,
                  background:
                    'var(--sm-mention-badge-bg, var(--sm-error, #ef4444))',
                  color:
                    'var(--sm-mention-badge-text, #fff)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 6px',
                }}
              >
                @{mentionCount}
              </span>
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
  };

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
        ) : groupBy === 'type' ? (
          renderSectioned({
            conversations: filtered,
            sectionOrder: sectionOrder ?? DEFAULT_SECTION_ORDER,
            sectionLabels,
            collapsed,
            toggleCollapsed,
            renderRow,
          })
        ) : (
          filtered.map(renderRow)
        )}
      </div>
    </div>
  );
}

interface SectionedRenderArgs {
  conversations: Conversation[];
  sectionOrder: ConversationType[];
  sectionLabels: Partial<Record<ConversationType, string>> | undefined;
  collapsed: Record<string, boolean>;
  toggleCollapsed: (type: ConversationType) => void;
  renderRow: (conversation: Conversation) => React.JSX.Element;
}

function renderSectioned({
  conversations,
  sectionOrder,
  sectionLabels,
  collapsed,
  toggleCollapsed,
  renderRow,
}: SectionedRenderArgs): React.ReactNode {
  const buckets = new Map<ConversationType, Conversation[]>();
  for (const c of conversations) {
    const list = buckets.get(c.conversation_type) ?? [];
    list.push(c);
    buckets.set(c.conversation_type, list);
  }

  return sectionOrder.map((type) => {
    const items = buckets.get(type);
    if (!items || items.length === 0) return null;
    const label =
      sectionLabels?.[type] ?? DEFAULT_SECTION_LABELS[type] ?? type.toUpperCase();
    const isCollapsed = !!collapsed[type];
    return (
      <div key={type} className={`sm-conv-section sm-conv-section-${type}`}>
        <button
          type="button"
          onClick={() => toggleCollapsed(type)}
          aria-expanded={!isCollapsed}
          className="sm-conv-section-header"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            border: 'none',
            background: 'transparent',
            color:
              'var(--sm-section-header-text, var(--sm-muted-text, #6b7280))',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textAlign: 'left',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 8,
              transition: 'transform 0.15s ease',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            ▾
          </span>
          {label}
          <span
            style={{
              marginLeft: 'auto',
              fontWeight: 500,
              opacity: 0.7,
            }}
          >
            {items.length}
          </span>
        </button>
        {!isCollapsed && items.map(renderRow)}
      </div>
    );
  });
}
