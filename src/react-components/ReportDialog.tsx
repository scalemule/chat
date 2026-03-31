import React, { useState } from 'react';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'violence', label: 'Violence' },
  { value: 'other', label: 'Other' },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]['value'];

interface ReportDialogProps {
  messageId: string;
  onSubmit: (data: {
    messageId: string;
    reason: ReportReason;
    description?: string;
  }) => void | Promise<void>;
  onClose: () => void;
}

export function ReportDialog({
  messageId,
  onSubmit,
  onClose,
}: ReportDialogProps): React.JSX.Element {
  const [reason, setReason] = useState<ReportReason>('spam');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        messageId,
        reason,
        description: description.trim() || undefined,
      });
      setSubmitted(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--sm-surface, #fff)',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: 448,
          margin: '0 16px',
          overflow: 'hidden',
          color: 'var(--sm-text-color, #111827)',
          fontFamily:
            'var(--sm-font-family, system-ui, -apple-system, sans-serif)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--sm-text-color, #111827)',
            }}
          >
            Report Message
          </h3>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close"
            style={{
              border: 'none',
              background: 'transparent',
              padding: 4,
              cursor: 'pointer',
              color: 'var(--sm-muted-text, #6b7280)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--sm-text-color, #111827)',
                }}
              >
                Report submitted
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 12,
                  color: 'var(--sm-muted-text, #6b7280)',
                }}
              >
                We will review this message shortly.
              </p>
            </div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              {error && (
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: 14,
                    borderRadius: 8,
                  }}
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--sm-text-color, #111827)',
                    marginBottom: 6,
                  }}
                >
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReportReason)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--sm-border-color, #e5e7eb)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 14,
                    background: 'var(--sm-surface, #fff)',
                    color: 'var(--sm-text-color, #111827)',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--sm-text-color, #111827)',
                    marginBottom: 6,
                  }}
                >
                  Description{' '}
                  <span
                    style={{
                      fontWeight: 400,
                      color: 'var(--sm-muted-text, #6b7280)',
                    }}
                  >
                    (optional)
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide additional details..."
                  rows={3}
                  maxLength={1000}
                  style={{
                    width: '100%',
                    border: '1px solid var(--sm-border-color, #e5e7eb)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    color: 'var(--sm-text-color, #111827)',
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--sm-border-color, #e5e7eb)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            <button
              onClick={onClose}
              type="button"
              style={{
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--sm-text-color, #111827)',
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting}
              type="button"
              style={{
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                background: 'var(--sm-primary, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: submitting ? 'wait' : 'pointer',
                opacity: submitting ? 0.5 : 1,
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
