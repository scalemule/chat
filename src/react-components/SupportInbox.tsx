import React, { useState, useEffect, useRef, useCallback } from 'react';

import type { RepClient, SupportInboxItem } from '../rep';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';

interface SupportInboxProps {
  repClient: RepClient;
  theme?: ChatTheme;
  onSelectConversation?: (item: SupportInboxItem) => void;
  /** Uses conversation_id (not support row ID) for matching. */
  selectedConversationId?: string | null;
}

type TabStatus = 'waiting' | 'active' | 'resolved';

const TAB_LABELS: { status: TabStatus; label: string }[] = [
  { status: 'waiting', label: 'Waiting' },
  { status: 'active', label: 'Active' },
  { status: 'resolved', label: 'Resolved' },
];

export function SupportInbox({
  repClient,
  theme,
  onSelectConversation,
  selectedConversationId,
}: SupportInboxProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabStatus>('waiting');
  const [items, setItems] = useState<SupportInboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInbox = useCallback(async () => {
    setIsLoading(true);
    const result = await repClient.getInbox({ status: activeTab });
    if (result.data) {
      setItems(result.data);
    }
    setIsLoading(false);
  }, [repClient, activeTab]);

  // Fetch on tab change
  useEffect(() => {
    void fetchInbox();
  }, [fetchInbox]);

  // Live updates: debounced refetch on support events
  useEffect(() => {
    const debouncedRefetch = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        void fetchInbox();
      }, 500);
    };

    const unsub1 = repClient.chat.on('support:new', debouncedRefetch);
    const unsub2 = repClient.chat.on('support:assigned', debouncedRefetch);
    const unsub3 = repClient.chat.on('inbox:update', debouncedRefetch);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [repClient, fetchInbox]);

  const handleClaim = useCallback(
    async (item: SupportInboxItem) => {
      await repClient.claimConversation(item.id);
      void fetchInbox();
    },
    [repClient, fetchInbox],
  );

  const handleResolve = useCallback(
    async (item: SupportInboxItem) => {
      await repClient.updateConversationStatus(item.id, 'resolved');
      void fetchInbox();
    },
    [repClient, fetchInbox],
  );

  return (
    <div
      data-scalemule-chat=""
      style={{
        ...themeToStyle(theme),
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 300,
        borderRadius: 'var(--sm-border-radius, 16px)',
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        background: 'var(--sm-surface, #fff)',
        color: 'var(--sm-text-color, #111827)',
        fontFamily: 'var(--sm-font-family)',
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
        }}
      >
        {TAB_LABELS.map(({ status, label }) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveTab(status)}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              fontWeight: activeTab === status ? 700 : 400,
              color: activeTab === status
                ? 'var(--sm-primary, #2563eb)'
                : 'var(--sm-muted-text, #6b7280)',
              borderBottom: activeTab === status
                ? '2px solid var(--sm-primary, #2563eb)'
                : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 24, fontSize: 14, color: 'var(--sm-muted-text, #6b7280)' }}>
            Loading...
          </div>
        ) : !items.length ? (
          <div style={{ padding: 24, fontSize: 14, color: 'var(--sm-muted-text, #6b7280)' }}>
            No conversations
          </div>
        ) : (
          items.map((item) => {
            const selected = item.conversation_id === selectedConversationId;

            return (
              <div
                key={item.id}
                style={{
                  padding: 16,
                  borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
                  background: selected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectConversation?.(item)}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {item.visitor_name ?? 'Visitor'}
                  </div>
                  {item.visitor_email ? (
                    <div style={{ fontSize: 12, color: 'var(--sm-muted-text, #6b7280)' }}>
                      {item.visitor_email}
                    </div>
                  ) : null}
                  {item.last_message_preview ? (
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--sm-muted-text, #6b7280)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 240,
                      }}
                    >
                      {item.last_message_preview}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    {item.assigned_rep_name ? (
                      <span style={{ fontSize: 11, color: 'var(--sm-muted-text, #6b7280)' }}>
                        Rep: {item.assigned_rep_name}
                      </span>
                    ) : null}
                    {item.last_message_at ? (
                      <span style={{ fontSize: 11, color: 'var(--sm-muted-text, #6b7280)' }}>
                        {new Date(item.last_message_at).toLocaleTimeString()}
                      </span>
                    ) : null}
                  </div>
                </button>

                {activeTab === 'waiting' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleClaim(item);
                    }}
                    style={{
                      border: 'none',
                      background: 'var(--sm-primary, #2563eb)',
                      color: '#fff',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Claim
                  </button>
                ) : activeTab === 'active' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleResolve(item);
                    }}
                    style={{
                      border: '1px solid var(--sm-border-color, #e5e7eb)',
                      background: 'transparent',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      color: 'var(--sm-muted-text, #6b7280)',
                      flexShrink: 0,
                    }}
                  >
                    Resolve
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
