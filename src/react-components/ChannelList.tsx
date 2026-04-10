import React, { useMemo, useState } from 'react';

import { useChannels } from '../react';
import type { ChannelListItem } from '../types';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';

interface ChannelListProps {
  selectedChannelId?: string | null;
  onSelect?: (channel: ChannelListItem) => void;
  theme?: ChatTheme;
  title?: string;
  showCreateButton?: boolean;
  onCreateChannel?: () => void;
}

export function ChannelList({
  selectedChannelId,
  onSelect,
  theme,
  title = 'Channels',
  showCreateButton,
  onCreateChannel,
}: ChannelListProps): React.JSX.Element {
  const { channels, isLoading, joinChannel, leaveChannel } = useChannels();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return channels;
    return channels.filter((ch) => {
      const haystack = [ch.name, ch.description].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [channels, search]);

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          {showCreateButton ? (
            <button
              type="button"
              onClick={onCreateChannel}
              style={{
                background: 'var(--sm-primary, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + New
            </button>
          ) : null}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search channels"
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
          <div style={{ padding: 24, fontSize: 14, color: 'var(--sm-muted-text, #6b7280)' }}>
            Loading channels...
          </div>
        ) : !filtered.length ? (
          <div style={{ padding: 24, fontSize: 14, color: 'var(--sm-muted-text, #6b7280)' }}>
            No channels found
          </div>
        ) : (
          filtered.map((channel) => {
            const selected = channel.id === selectedChannelId;

            return (
              <div
                key={channel.id}
                style={{
                  width: '100%',
                  borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
                  padding: 16,
                  background: selected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelect?.(channel)}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      # {channel.name ?? 'Unnamed'}
                    </span>
                    {channel.visibility === 'private' ? (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--sm-surface-muted, #f3f4f6)',
                          color: 'var(--sm-muted-text, #6b7280)',
                        }}
                      >
                        Private
                      </span>
                    ) : null}
                  </div>
                  {channel.description ? (
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--sm-muted-text, #6b7280)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {channel.description}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 12, color: 'var(--sm-muted-text, #6b7280)' }}>
                    {channel.member_count} {channel.member_count === 1 ? 'member' : 'members'}
                  </div>
                </button>

                {channel.is_member ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void leaveChannel(channel.id);
                    }}
                    style={{
                      border: '1px solid var(--sm-border-color, #e5e7eb)',
                      background: 'transparent',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      color: 'var(--sm-muted-text, #6b7280)',
                    }}
                  >
                    Leave
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void joinChannel(channel.id);
                    }}
                    style={{
                      border: 'none',
                      background: 'var(--sm-primary, #2563eb)',
                      color: '#fff',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Join
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
