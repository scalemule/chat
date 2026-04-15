import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface ChannelEditFormValues {
  name: string;
  description: string;
  visibility: 'public' | 'private';
}

export interface ChannelEditModalProps {
  open: boolean;
  onClose: () => void;
  /** Initial form values — typically the current channel's settings. */
  initial: ChannelEditFormValues;
  /**
   * Save handler. Receives the new values; throw to keep the modal open
   * and surface the error in a banner.
   */
  onSave: (values: ChannelEditFormValues) => Promise<void> | void;
  /**
   * Optional archive handler. When provided, an "Archive channel" button
   * appears in the footer. Permission gating is the host's responsibility.
   */
  onArchive?: () => Promise<void> | void;
  title?: string;
}

const FOCUSABLE_SELECTOR = 'input, textarea, button, [tabindex]:not([tabindex="-1"])';

export function ChannelEditModal({
  open,
  onClose,
  initial,
  onSave,
  onArchive,
  title = 'Channel settings',
}: ChannelEditModalProps): React.JSX.Element | null {
  const [values, setValues] = useState<ChannelEditFormValues>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValues(initial);
    setSubmitting(false);
    setError(null);
    queueMicrotask(() => nameRef.current?.focus());
  }, [open, initial]);

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

  const submit = useCallback(async () => {
    if (submitting) return;
    if (!values.name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        name: values.name.trim(),
        description: values.description.trim(),
        visibility: values.visibility,
      });
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save channel';
      setError(message);
      setSubmitting(false);
    }
  }, [onClose, onSave, submitting, values]);

  const archive = useCallback(async () => {
    if (!onArchive || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onArchive();
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not archive channel';
      setError(message);
      setSubmitting(false);
    }
  }, [onArchive, onClose, submitting]);

  if (!open) return null;

  return (
    <div
      className="sm-channel-edit-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
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
        className="sm-channel-edit-modal"
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

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Name</span>
            <input
              ref={nameRef}
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--sm-border-color, #e5e7eb)',
                borderRadius: 6,
                font: 'inherit',
                color: 'inherit',
                background: 'transparent',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Description</span>
            <textarea
              value={values.description}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
              rows={3}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--sm-border-color, #e5e7eb)',
                borderRadius: 6,
                font: 'inherit',
                color: 'inherit',
                background: 'transparent',
                resize: 'vertical',
              }}
            />
          </label>

          <fieldset
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              border: 'none',
              padding: 0,
              margin: 0,
            }}
          >
            <legend style={{ fontSize: 12, fontWeight: 600, padding: 0 }}>
              Visibility
            </legend>
            {(['public', 'private'] as const).map((v) => (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="sm-channel-visibility"
                  value={v}
                  checked={values.visibility === v}
                  onChange={() => setValues((prev) => ({ ...prev, visibility: v }))}
                />
                <span style={{ fontSize: 13 }}>
                  {v === 'public' ? 'Public — anyone can join' : 'Private — invite only'}
                </span>
              </label>
            ))}
          </fieldset>

          {error && (
            <div
              role="alert"
              style={{
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
            justifyContent: 'space-between',
            gap: 8,
            padding: '10px 14px',
            borderTop: '1px solid var(--sm-border-color, #e5e7eb)',
          }}
        >
          <div>
            {onArchive ? (
              <button
                type="button"
                onClick={() => void archive()}
                disabled={submitting}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  color: 'var(--sm-error-text, #991b1b)',
                  border: '1px solid var(--sm-error-border, #fecaca)',
                  borderRadius: 6,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                }}
              >
                Archive channel
              </button>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
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
              disabled={submitting}
              style={{
                padding: '8px 14px',
                background: 'var(--sm-primary, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
