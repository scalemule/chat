import React, { useCallback, useEffect, useRef } from 'react';

import { useMyStatus } from '../react';

export interface AvatarStatusMenuProps {
  /** Fires on Escape, backdrop click, or after selection. */
  onClose: () => void;
  /** i18n. */
  activeLabel?: string;
  awayLabel?: string;
  /** i18n for the optional header shown above the options. */
  headerLabel?: string;
}

const FOCUSABLE_SELECTOR = 'button, [tabindex]:not([tabindex="-1"])';

/**
 * Small dropdown of self-status options (Active / Away). Reads + writes
 * via `useMyStatus`. Host owns positioning — wrap the menu in an
 * absolutely-positioned container anchored to the avatar/profile button.
 *
 * Closes on Escape, backdrop click, or after the user selects an option.
 * Tab/Shift+Tab cycles within the menu. The menu does not own the
 * avatar itself — compose it into host UI however you want.
 */
export function AvatarStatusMenu({
  onClose,
  activeLabel = 'Active',
  awayLabel = 'Away',
  headerLabel,
}: AvatarStatusMenuProps): React.JSX.Element {
  const { status, setStatus } = useMyStatus();
  const rootRef = useRef<HTMLDivElement>(null);

  // Focus the current option on mount.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const current = root.querySelector<HTMLElement>(
      '.sm-avatar-status-option-active',
    );
    const first = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (current ?? first)?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const root = rootRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const activeEl = document.activeElement as HTMLElement | null;
        if (event.shiftKey && activeEl === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && activeEl === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  const pick = (next: 'active' | 'away') => {
    setStatus(next);
    onClose();
  };

  return (
    <div
      ref={rootRef}
      className="sm-avatar-status-menu"
      role="menu"
      aria-label={headerLabel ?? 'Status'}
      onKeyDown={handleKeyDown}
      style={{
        background: 'var(--sm-surface, #fff)',
        color: 'var(--sm-text-color, #111827)',
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        minWidth: 160,
        padding: 4,
        fontFamily: 'var(--sm-font-family, system-ui, -apple-system, sans-serif)',
      }}
    >
      {headerLabel && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--sm-muted-text, #6b7280)',
            padding: '6px 8px',
          }}
        >
          {headerLabel}
        </div>
      )}
      <MenuOption
        label={activeLabel}
        active={status === 'active'}
        dotColor="var(--sm-status-online-color, #22c55e)"
        onClick={() => pick('active')}
      />
      <MenuOption
        label={awayLabel}
        active={status === 'away'}
        dotColor="var(--sm-status-away-color, #f59e0b)"
        onClick={() => pick('away')}
      />
    </div>
  );
}

interface MenuOptionProps {
  label: string;
  active: boolean;
  dotColor: string;
  onClick: () => void;
}

function MenuOption({
  label,
  active,
  dotColor,
  onClick,
}: MenuOptionProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={`sm-avatar-status-option${active ? ' sm-avatar-status-option-active' : ''}`}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        border: 'none',
        background: active
          ? 'var(--sm-surface-muted, rgba(37, 99, 235, 0.08))'
          : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13,
        color: 'inherit',
        font: 'inherit',
        borderRadius: 6,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: dotColor,
        }}
      />
      <span style={{ flex: 1 }}>{label}</span>
      {active && (
        <span aria-hidden="true" style={{ fontSize: 12 }}>
          ✓
        </span>
      )}
    </button>
  );
}
