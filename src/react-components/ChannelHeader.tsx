import React, { useState } from 'react';

import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';

interface ChannelHeaderProps {
  channelId: string;
  name?: string;
  description?: string;
  memberCount?: number;
  theme?: ChatTheme;
  onLeave?: () => void;
  /**
   * When provided, an "Edit" button appears in the header. Hosts open
   * `<ChannelEditModal>` (or their own settings UI) from this callback.
   * Permission gating is the host's responsibility — the SDK does not
   * check the user's role.
   */
  onEdit?: () => void;
}

export function ChannelHeader({
  name,
  description,
  memberCount,
  theme,
  onLeave,
  onEdit,
}: ChannelHeaderProps): React.JSX.Element {
  const [showInfo, setShowInfo] = useState(false);
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
          {description ? (
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                aria-label="Channel description"
                aria-expanded={showInfo}
                onMouseEnter={() => setShowInfo(true)}
                onMouseLeave={() => setShowInfo(false)}
                onFocus={() => setShowInfo(true)}
                onBlur={() => setShowInfo(false)}
                onClick={() => setShowInfo((s) => !s)}
                className="sm-channel-info-icon"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  border: '1px solid var(--sm-border-color, #e5e7eb)',
                  background: 'transparent',
                  color: 'var(--sm-muted-text, #6b7280)',
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'help',
                  padding: 0,
                }}
              >
                i
              </button>
              {showInfo && (
                <span
                  role="tooltip"
                  className="sm-channel-info-popover"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    zIndex: 50,
                    width: 280,
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'var(--sm-surface, #fff)',
                    color: 'var(--sm-text-color, #111827)',
                    border: '1px solid var(--sm-border-color, #e5e7eb)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    fontSize: 13,
                    lineHeight: 1.4,
                    whiteSpace: 'normal',
                  }}
                >
                  {description}
                </span>
              )}
            </span>
          ) : null}
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            style={{
              border: '1px solid var(--sm-border-color, #e5e7eb)',
              background: 'transparent',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 13,
              cursor: 'pointer',
              color: 'var(--sm-muted-text, #6b7280)',
            }}
          >
            Edit
          </button>
        ) : null}
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
            }}
          >
            Leave
          </button>
        ) : null}
      </div>
    </div>
  );
}
