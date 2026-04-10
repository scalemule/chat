import React from 'react';

import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';

interface ChannelHeaderProps {
  channelId: string;
  name?: string;
  description?: string;
  memberCount?: number;
  theme?: ChatTheme;
  onLeave?: () => void;
}

export function ChannelHeader({
  name,
  description,
  memberCount,
  theme,
  onLeave,
}: ChannelHeaderProps): React.JSX.Element {
  return (
    <div
      data-scalemule-chat=""
      style={{
        ...themeToStyle(theme),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
        background: 'var(--sm-surface, #fff)',
        fontFamily: 'var(--sm-font-family)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--sm-text-color, #111827)' }}>
            # {name ?? 'Channel'}
          </span>
          {memberCount !== undefined ? (
            <span style={{ fontSize: 12, color: 'var(--sm-muted-text, #6b7280)' }}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </span>
          ) : null}
        </div>
        {description ? (
          <div
            style={{
              fontSize: 13,
              color: 'var(--sm-muted-text, #6b7280)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      {onLeave ? (
        <button
          type="button"
          onClick={onLeave}
          style={{
            border: '1px solid var(--sm-border-color, #e5e7eb)',
            background: 'transparent',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 13,
            cursor: 'pointer',
            color: 'var(--sm-muted-text, #6b7280)',
            flexShrink: 0,
          }}
        >
          Leave
        </button>
      ) : null}
    </div>
  );
}
