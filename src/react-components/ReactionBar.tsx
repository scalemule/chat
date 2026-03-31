import React from 'react';

import type { ReactionSummary } from '../types';

interface ReactionBarProps {
  reactions: ReactionSummary[];
  currentUserId?: string;
  onToggleReaction: (emoji: string) => void;
}

export function ReactionBar({
  reactions,
  currentUserId,
  onToggleReaction,
}: ReactionBarProps): React.JSX.Element | null {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {reactions.map((r) => {
        const hasReacted = currentUserId
          ? r.user_ids.includes(currentUserId)
          : false;
        return (
          <button
            key={r.emoji}
            onClick={() => onToggleReaction(r.emoji)}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 12,
              border: hasReacted
                ? '1px solid var(--sm-reaction-active-border, rgba(37, 99, 235, 0.4))'
                : '1px solid var(--sm-border-color, #e5e7eb)',
              background: hasReacted
                ? 'var(--sm-reaction-active-bg, rgba(37, 99, 235, 0.08))'
                : 'var(--sm-surface-muted, #f8fafc)',
              color: hasReacted
                ? 'var(--sm-primary, #2563eb)'
                : 'var(--sm-text-color, #111827)',
              cursor: 'pointer',
              lineHeight: '18px',
            }}
          >
            <span>{r.emoji}</span>
            <span style={{ fontWeight: 500 }}>{r.count}</span>
          </button>
        );
      })}
    </div>
  );
}
