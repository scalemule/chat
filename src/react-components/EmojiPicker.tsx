import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const QUICK_REACTIONS = ['❤️', '😂', '👍', '🔥', '😮', '😢', '👏', '🙌'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  emojis?: string[];
}

export function EmojiPicker({
  onSelect,
  onClose,
  anchorRef,
  emojis = QUICK_REACTIONS,
}: EmojiPickerProps): React.JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Position the picker above the trigger button
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const pickerWidth = emojis.length * 36 + 16; // button width * count + padding
    let left = rect.left + rect.width / 2 - pickerWidth / 2;
    // Keep within viewport
    if (left < 8) left = 8;
    if (left + pickerWidth > window.innerWidth - 8)
      left = window.innerWidth - 8 - pickerWidth;
    setPosition({ top: rect.top - 8, left });
  }, [anchorRef, emojis.length]);

  // Click-outside close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorRef]);

  if (!position) return null;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateY(-100%)',
        background: 'var(--sm-surface, #fff)',
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        borderRadius: 12,
        boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
        padding: 8,
        display: 'flex',
        gap: 4,
        zIndex: 9999,
      }}
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          type="button"
          aria-label={`React with ${emoji}`}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 18,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background =
              'var(--sm-surface-muted, #f8fafc)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = 'transparent';
          }}
        >
          {emoji}
        </button>
      ))}
    </div>,
    document.body,
  );
}

interface EmojiPickerTriggerProps {
  onSelect: (emoji: string) => void;
  emojis?: string[];
}

export function EmojiPickerTrigger({
  onSelect,
  emojis,
}: EmojiPickerTriggerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Add reaction"
        style={{
          padding: 6,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--sm-muted-text, #6b7280)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.color =
            'var(--sm-text-color, #111827)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.color =
            'var(--sm-muted-text, #6b7280)';
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      </button>
      {open && (
        <EmojiPicker
          onSelect={onSelect}
          onClose={handleClose}
          anchorRef={buttonRef}
          emojis={emojis}
        />
      )}
    </>
  );
}
