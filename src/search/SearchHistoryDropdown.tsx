import React, { useCallback, useEffect, useState } from 'react';

export interface SearchHistoryDropdownProps {
  /** History entries, ordered newest-first. */
  history: string[];
  /** Invoked when the user selects (click or Enter) a row. */
  onSelect: (query: string) => void;
  /** Invoked on Escape or backdrop click. */
  onClose: () => void;
  /**
   * When provided, renders a "Clear recent" footer button. Hosts wire
   * this to `useSearchHistory().clear`.
   */
  onClear?: () => void;
  /**
   * Controlled active row index. When omitted, the dropdown manages its
   * own keyboard-active index.
   */
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  /** Empty-state override. Default `"No recent searches"`. */
  emptyState?: React.ReactNode;
}

/**
 * Dropdown of recent search queries. Caller owns positioning (wrap in an
 * absolutely-positioned container anchored to the search input).
 *
 * Keyboard: ArrowUp / ArrowDown walk entries (wrapping at both ends),
 * Enter selects the active entry, Escape calls `onClose`.
 */
export function SearchHistoryDropdown({
  history,
  onSelect,
  onClose,
  onClear,
  activeIndex: controlledActive,
  onActiveIndexChange,
  emptyState = 'No recent searches',
}: SearchHistoryDropdownProps): React.JSX.Element {
  const [internalActive, setInternalActive] = useState(0);
  const active =
    controlledActive !== undefined ? controlledActive : internalActive;

  const setActive = useCallback(
    (next: number) => {
      if (controlledActive !== undefined) {
        onActiveIndexChange?.(next);
      } else {
        setInternalActive(next);
        onActiveIndexChange?.(next);
      }
    },
    [controlledActive, onActiveIndexChange],
  );

  // Reset active index when the history set changes shape.
  useEffect(() => {
    if (active >= history.length) setActive(0);
  }, [active, history.length, setActive]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (history.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((active + 1) % history.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((active - 1 + history.length) % history.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const choice = history[active];
        if (choice !== undefined) onSelect(choice);
      }
    },
    [active, history, onClose, onSelect, setActive],
  );

  return (
    <div
      className="sm-search-history-dropdown"
      role="listbox"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        background: 'var(--sm-surface, #fff)',
        color: 'var(--sm-text-color, #111827)',
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        maxHeight: 280,
        overflowY: 'auto',
        fontFamily: 'var(--sm-font-family, system-ui, -apple-system, sans-serif)',
      }}
    >
      {history.length === 0 ? (
        <div
          style={{
            padding: '10px 14px',
            fontSize: 13,
            color: 'var(--sm-muted-text, #6b7280)',
          }}
        >
          {emptyState}
        </div>
      ) : (
        history.map((q, i) => {
          const isActive = i === active;
          return (
            <button
              key={`${q}-${i}`}
              type="button"
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => setActive(i)}
              onClick={() => onSelect(q)}
              className={`sm-search-history-item${
                isActive ? ' sm-search-history-item-active' : ''
              }`}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                border: 'none',
                background: isActive
                  ? 'var(--sm-surface-muted, rgba(37, 99, 235, 0.08))'
                  : 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
                font: 'inherit',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontSize: 11,
                  color: 'var(--sm-muted-text, #6b7280)',
                }}
              >
                ⟲
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {q}
              </span>
            </button>
          );
        })
      )}
      {onClear && history.length > 0 && (
        <div
          style={{
            borderTop: '1px solid var(--sm-border-color, #e5e7eb)',
            padding: '6px 10px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClear}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--sm-muted-text, #6b7280)',
              cursor: 'pointer',
              fontSize: 12,
              font: 'inherit',
            }}
          >
            Clear recent
          </button>
        </div>
      )}
    </div>
  );
}
