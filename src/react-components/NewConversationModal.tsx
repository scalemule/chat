import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface NewConversationUser {
  id: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
  /** Optional online status; when provided a small green dot renders on the avatar. */
  online?: boolean;
}

export interface NewConversationModalProps {
  /** Controls visibility. */
  open: boolean;
  /** Invoked when the user dismisses (Escape, backdrop click, close button). */
  onClose: () => void;
  /**
   * Host-provided user search. Called with the debounced query whenever it
   * changes. Return an array of matches ordered for display. The SDK does
   * not cache — host controls freshness.
   */
  searchUsers: (query: string) => Promise<NewConversationUser[]>;
  /**
   * Called when the user confirms (button or Cmd/Ctrl+Enter). Receives the
   * selected participant ids in selection order. Return the new conversation
   * id (the modal closes on resolve) or throw to keep the modal open and
   * show an error.
   */
  onCreate: (participantIds: string[]) => Promise<string | void>;
  /** Excluded from results (typically the current user). Optional. */
  currentUserId?: string;
  /** Maximum number of participants selectable. Default 10. */
  maxParticipants?: number;
  /** i18n. */
  title?: string;
  /** i18n for the search field placeholder. */
  searchPlaceholder?: string;
  /** i18n for the submit button. */
  createLabel?: string;
  /** Debounce interval in ms for `searchUsers`. Default 250. */
  debounceMs?: number;
}

const FOCUSABLE_SELECTOR =
  'input, button, [tabindex]:not([tabindex="-1"])';

export function NewConversationModal({
  open,
  onClose,
  searchUsers,
  onCreate,
  currentUserId,
  maxParticipants = 10,
  title = 'New conversation',
  searchPlaceholder = 'Search people',
  createLabel = 'Create',
  debounceMs = 250,
}: NewConversationModalProps): React.JSX.Element | null {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NewConversationUser[]>([]);
  const [selected, setSelected] = useState<NewConversationUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when (re)opening so each invocation starts fresh.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setSelected([]);
    setActiveIndex(0);
    setError(null);
    setSubmitting(false);
    // Defer focus until the input has mounted.
    queueMicrotask(() => inputRef.current?.focus());
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    if (!query) {
      setResults([]);
      setActiveIndex(0);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchUsers(query)
        .then((users) => {
          if (cancelled) return;
          const filtered = users.filter(
            (u) =>
              u.id !== currentUserId &&
              !selected.some((s) => s.id === u.id),
          );
          setResults(filtered);
          setActiveIndex(0);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setActiveIndex(0);
        });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, searchUsers, currentUserId, selected, debounceMs]);

  // Focus trap: cycle Tab / Shift+Tab across focusable descendants.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const container = containerRef.current;
        if (!container) return;
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
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

  const canAddMore = selected.length < maxParticipants;

  const addUser = useCallback((user: NewConversationUser) => {
    setSelected((prev) =>
      prev.some((s) => s.id === user.id) ? prev : [...prev, user],
    );
    setQuery('');
    setResults([]);
    setActiveIndex(0);
    inputRef.current?.focus();
  }, []);

  const removeLastPill = useCallback(() => {
    setSelected((prev) => prev.slice(0, -1));
  }, []);

  const removePill = useCallback((id: string) => {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) =>
          results.length === 0 ? 0 : Math.min(i + 1, results.length - 1),
        );
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        if ((event.metaKey || event.ctrlKey) && selected.length > 0) {
          event.preventDefault();
          void submit();
          return;
        }
        const candidate = results[activeIndex];
        if (candidate && canAddMore) {
          event.preventDefault();
          addUser(candidate);
        }
        return;
      }
      if (event.key === 'Backspace' && query === '' && selected.length > 0) {
        event.preventDefault();
        removeLastPill();
      }
    },
    [activeIndex, addUser, canAddMore, query, removeLastPill, results, selected.length],
  );

  const submit = useCallback(async (): Promise<void> => {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(selected.map((s) => s.id));
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not create conversation';
      setError(message);
      setSubmitting(false);
    }
  }, [onClose, onCreate, selected, submitting]);

  const initials = useMemo(() => {
    const build = (name: string) => {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.charAt(0).toUpperCase();
    };
    return (user: NewConversationUser) => build(user.display_name || '?');
  }, []);

  if (!open) return null;

  return (
    <div
      className="sm-new-conv-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        ref={containerRef}
        className="sm-new-conv-modal"
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--sm-surface, #fff)',
          color: 'var(--sm-text-color, #111827)',
          borderRadius: 'var(--sm-border-radius, 12px)',
          border: '1px solid var(--sm-border-color, #e5e7eb)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          fontFamily: 'var(--sm-font-family, system-ui, -apple-system, sans-serif)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
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

        <div style={{ padding: 14 }}>
          <div
            className="sm-new-conv-search"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
              padding: 8,
              border: '1px solid var(--sm-border-color, #e5e7eb)',
              borderRadius: 8,
              minHeight: 42,
            }}
          >
            {selected.map((user) => (
              <span
                key={user.id}
                className="sm-new-conv-pill"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'var(--sm-primary, #2563eb)',
                  color: '#fff',
                  fontSize: 13,
                }}
              >
                {user.display_name}
                <button
                  type="button"
                  aria-label={`Remove ${user.display_name}`}
                  onClick={() => removePill(user.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 14,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={selected.length ? '' : searchPlaceholder}
              disabled={!canAddMore}
              aria-label={searchPlaceholder}
              style={{
                flex: 1,
                minWidth: 120,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                font: 'inherit',
                color: 'inherit',
              }}
            />
          </div>

          {results.length > 0 && (
            <div
              role="listbox"
              style={{
                marginTop: 8,
                border: '1px solid var(--sm-border-color, #e5e7eb)',
                borderRadius: 8,
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {results.map((user, i) => {
                const active = i === activeIndex;
                return (
                  <button
                    key={user.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => canAddMore && addUser(user)}
                    className={`sm-new-conv-result${active ? ' sm-new-conv-result-active' : ''}`}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      border: 'none',
                      background: active
                        ? 'var(--sm-surface-muted, rgba(37, 99, 235, 0.08))'
                        : 'transparent',
                      cursor: canAddMore ? 'pointer' : 'not-allowed',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        position: 'relative',
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: 'var(--sm-surface-muted, #f3f4f6)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--sm-muted-text, #6b7280)',
                        overflow: 'hidden',
                      }}
                    >
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        initials(user)
                      )}
                      {user.online && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            right: -1,
                            bottom: -1,
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: 'var(--sm-active-call-color, #22c55e)',
                            border: '1.5px solid var(--sm-surface, #fff)',
                          }}
                        />
                      )}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{user.display_name}</span>
                      {user.username && (
                        <span style={{ fontSize: 12, color: 'var(--sm-muted-text, #6b7280)' }}>
                          @{user.username}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 10,
                padding: '8px 10px',
                background: 'var(--sm-error-bg, #fef2f2)',
                color: 'var(--sm-error-text, #991b1b)',
                border: '1px solid var(--sm-error-border, #fecaca)',
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '10px 14px',
            borderTop: '1px solid var(--sm-border-color, #e5e7eb)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid var(--sm-border-color, #e5e7eb)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              color: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={selected.length === 0 || submitting}
            style={{
              padding: '8px 14px',
              background: 'var(--sm-primary, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor:
                selected.length === 0 || submitting ? 'not-allowed' : 'pointer',
              opacity: selected.length === 0 || submitting ? 0.6 : 1,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {submitting ? 'Creating…' : createLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
