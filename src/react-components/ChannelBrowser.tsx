import React, { useState } from 'react';

import { useChannels } from '../react';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';

interface ChannelBrowserProps {
  open: boolean;
  onClose: () => void;
  onJoinChannel?: (channelId: string) => void;
  theme?: ChatTheme;
}

export function ChannelBrowser({
  open,
  onClose,
  onJoinChannel,
  theme,
}: ChannelBrowserProps): React.JSX.Element | null {
  const [search, setSearch] = useState('');
  const { channels, isLoading, joinChannel } = useChannels({
    search: search || undefined,
    visibility: 'public',
  });

  if (!open) return null;

  return (
    <div
      data-scalemule-chat=""
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          ...themeToStyle(theme),
          width: '100%',
          maxWidth: 480,
          maxHeight: '70vh',
          borderRadius: 'var(--sm-border-radius, 16px)',
          background: 'var(--sm-surface, #fff)',
          color: 'var(--sm-text-color, #111827)',
          fontFamily: 'var(--sm-font-family)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
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
            <div style={{ fontSize: 16, fontWeight: 700 }}>Browse Channels</div>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 18,
                cursor: 'pointer',
                padding: '4px 8px',
                color: 'var(--sm-muted-text, #6b7280)',
              }}
            >
              &times;
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search public channels..."
            autoFocus
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
              Searching...
            </div>
          ) : !channels.length ? (
            <div style={{ padding: 24, fontSize: 14, color: 'var(--sm-muted-text, #6b7280)' }}>
              No public channels found
            </div>
          ) : (
            channels.map((channel) => (
              <div
                key={channel.id}
                style={{
                  padding: 16,
                  borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    # {channel.name ?? 'Unnamed'}
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
                  <div style={{ fontSize: 12, color: 'var(--sm-muted-text, #6b7280)', marginTop: 2 }}>
                    {channel.member_count} {channel.member_count === 1 ? 'member' : 'members'}
                  </div>
                </div>

                {channel.is_member ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--sm-muted-text, #6b7280)',
                      padding: '4px 10px',
                    }}
                  >
                    Joined
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await joinChannel(channel.id);
                      if (result.data) {
                        onJoinChannel?.(channel.id);
                      }
                    }}
                    style={{
                      border: 'none',
                      background: 'var(--sm-primary, #2563eb)',
                      color: '#fff',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Join
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
