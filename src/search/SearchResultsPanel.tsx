import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { HighlightedExcerpt } from './HighlightedExcerpt';
import type {
  Conversation,
  GlobalSearchResult,
} from '../types';
import type {
  GlobalSearchError,
  GlobalSearchProgress,
} from './useGlobalSearch';

export interface SearchResultsPanelProfile {
  display_name: string;
  avatar_url?: string;
}

export interface SearchResultsPanelRowContext {
  profile: SearchResultsPanelProfile | undefined;
  conversationLabel: string;
  timeLabel: string;
  onSelect: () => void;
  active: boolean;
}

export interface SearchResultsPanelProps {
  /** Controls visibility. */
  open: boolean;
  /** Invoked on Escape, backdrop click, or the close button. */
  onClose: () => void;
  /** Results from `useGlobalSearch` (or a host-supplied store). */
  results: GlobalSearchResult[];
  /** Progress from `useGlobalSearch`. Optional when results arrive eagerly. */
  isLoading?: boolean;
  progress?: GlobalSearchProgress;
  errors?: GlobalSearchError[];
  /**
   * Sender profile lookup keyed by `user_id`. When omitted rows fall back
   * to initials derived from the message sender id.
   */
  profiles?: Map<string, SearchResultsPanelProfile>;
  /**
   * Format the conversation label shown under each row. Defaults to
   * `conversation.name` → `conversation_id.slice(0, 8)`.
   */
  conversationLabel?: (conversation: Conversation | undefined, conversationId: string) => string;
  /**
   * Format the per-row timestamp. Defaults to `new Date(...).toLocaleString()`.
   */
  formatTimestamp?: (iso: string) => string;
  /** Fires when the user clicks or activates a row. Router-agnostic. */
  onSelect: (result: GlobalSearchResult) => void;
  /**
   * Escape hatch — replace the default row renderer. When provided the
   * panel chrome (header, progress bar, footer) stays in place and only
   * the body swaps.
   */
  renderResult?: (
    result: GlobalSearchResult,
    context: SearchResultsPanelRowContext,
  ) => React.ReactNode;
  /** Node rendered when `results.length === 0 && !isLoading`. */
  emptyState?: React.ReactNode;
  /** i18n. */
  title?: string;
}

const FOCUSABLE_SELECTOR =
  'input, button, a[href], [tabindex]:not([tabindex="-1"])';

function defaultConversationLabel(
  conversation: Conversation | undefined,
  conversationId: string,
): string {
  if (conversation?.name) return conversation.name;
  if (conversation?.counterparty_user_id) return conversation.counterparty_user_id.slice(0, 8);
  return conversationId.slice(0, 8);
}

function defaultFormatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase() || '?';
}

/**
 * Slide-out overlay rendering results from `useGlobalSearch` (or any
 * host-supplied `GlobalSearchResult[]`). Router-agnostic — the caller's
 * `onSelect` receives the full result and decides how to navigate.
 *
 * Accessibility:
 *   - `role="dialog"` + `aria-modal="true"`.
 *   - Focus on open lands on the first focusable descendant.
 *   - Focus captured when `open` flips true and restored to the
 *     previously-focused element on effect cleanup (close or unmount).
 *   - Tab / Shift+Tab trap inside the panel.
 *   - Escape and backdrop click both call `onClose`.
 *
 * The overlay is non-modal in the scroll sense — body scroll is not
 * frozen. Host layout decides whether to block interaction underneath.
 */
export function SearchResultsPanel({
  open,
  onClose,
  results,
  isLoading,
  progress,
  errors,
  profiles,
  conversationLabel = defaultConversationLabel,
  formatTimestamp = defaultFormatTimestamp,
  onSelect,
  renderResult,
  emptyState,
  title = 'Search results',
}: SearchResultsPanelProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Capture previously-focused element at open; restore on cleanup
  // (close OR unmount). Also move focus into the panel.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    // Focus the first focusable descendant on the next frame so the
    // panel has mounted.
    const handle = queueMicrotask(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    });
    return () => {
      // queueMicrotask has no cancel — no-op. Restore prior focus.
      void handle;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
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

  const pct = useMemo(() => {
    if (!progress || !progress.total) return 0;
    return Math.round((progress.completed / progress.total) * 100);
  }, [progress]);

  if (!open) return null;

  const hasErrors = (errors?.length ?? 0) > 0;

  return (
    <div
      className="sm-search-panel-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.25)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 1000,
      }}
    >
      <div
        ref={panelRef}
        className="sm-search-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: 'var(--sm-search-panel-width, 420px)',
          maxWidth: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--sm-surface, #fff)',
          color: 'var(--sm-text-color, #111827)',
          borderLeft: '1px solid var(--sm-border-color, #e5e7eb)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.12)',
          fontFamily: 'var(--sm-font-family, system-ui, -apple-system, sans-serif)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: 'var(--sm-muted-text, #6b7280)',
            }}
          >
            ×
          </button>
        </div>

        {isLoading && progress && progress.total > 0 && (
          <div
            className="sm-search-panel-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            style={{
              height: 2,
              background: 'var(--sm-border-color, #e5e7eb)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: `${pct}%`,
                background: 'var(--sm-primary, #2563eb)',
                transition: 'width 120ms linear',
              }}
            />
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {results.length === 0 && !isLoading ? (
            <div
              style={{
                padding: 28,
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--sm-muted-text, #6b7280)',
              }}
            >
              {emptyState ?? 'No results'}
            </div>
          ) : (
            results.map((result, i) => {
              const profile = profiles?.get(result.message.sender_id);
              const label = conversationLabel(result.conversation, result.conversationId);
              const timeLabel = formatTimestamp(result.message.created_at);
              const select = () => onSelect(result);

              if (renderResult) {
                return (
                  <React.Fragment key={`${result.conversationId}:${result.message.id}:${i}`}>
                    {renderResult(result, {
                      profile,
                      conversationLabel: label,
                      timeLabel,
                      onSelect: select,
                      active: false,
                    })}
                  </React.Fragment>
                );
              }

              const displayName = profile?.display_name ?? result.message.sender_id.slice(0, 8);
              const avatarUrl = profile?.avatar_url;

              return (
                <button
                  type="button"
                  key={`${result.conversationId}:${result.message.id}:${i}`}
                  onClick={select}
                  className="sm-search-result-row"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 14px',
                    border: 'none',
                    borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    color: 'inherit',
                    font: 'inherit',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background: 'var(--sm-surface-muted, #f3f4f6)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--sm-muted-text, #6b7280)',
                      flexShrink: 0,
                    }}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      initialsOf(displayName)
                    )}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                    <span
                      className="sm-search-result-meta"
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 6,
                        fontSize: 12,
                        color: 'var(--sm-muted-text, #6b7280)',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--sm-text-color, #111827)' }}>
                        {displayName}
                      </span>
                      <span>·</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                      <span>·</span>
                      <span>{timeLabel}</span>
                    </span>
                    {result.highlights.length > 0 ? (
                      <HighlightedExcerpt html={result.highlights[0]} />
                    ) : (
                      <span
                        className="sm-search-result-excerpt"
                        style={{
                          fontSize: 13,
                          color: 'var(--sm-text-color, #111827)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {result.message.plain_text ?? result.message.content}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {hasErrors && (
          <div
            style={{
              borderTop: '1px solid var(--sm-border-color, #e5e7eb)',
              padding: '6px 12px',
              fontSize: 12,
              color: 'var(--sm-muted-text, #6b7280)',
            }}
          >
            <button
              type="button"
              onClick={() => setShowErrors((s) => !s)}
              aria-expanded={showErrors}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'inherit',
                font: 'inherit',
              }}
            >
              {errors!.length === 1
                ? '1 conversation could not be searched'
                : `${errors!.length} conversations could not be searched`}{' '}
              {showErrors ? '▾' : '▸'}
            </button>
            {showErrors && (
              <ul
                style={{
                  margin: '6px 0 0',
                  paddingLeft: 18,
                  listStyle: 'disc',
                }}
              >
                {errors!.map((e, i) => (
                  <li key={`${e.conversationId}-${i}`}>
                    <code>{e.conversationId.slice(0, 8) || 'unknown'}</code>: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
