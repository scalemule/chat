import React from 'react';

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '👀'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  emojis?: string[];
}

export function EmojiPicker({
  onSelect,
  emojis = DEFAULT_EMOJIS,
}: EmojiPickerProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 6,
        padding: 6,
        borderRadius: 999,
        background: 'var(--sm-surface, #fff)',
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
      }}
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          aria-label={`React with ${emoji}`}
          style={{
            width: 32,
            height: 32,
            border: 'none',
            background: 'transparent',
            borderRadius: 999,
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
