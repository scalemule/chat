import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useChannelInvitations } from '../react';
import type { ChannelInvitation } from '../types';

export interface ChannelInvitationsModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Optional: invoked after a successful accept. Hosts typically navigate
   * to the channel here. Receives the resolved invitation row (already
   * removed from the local hook state).
   */
  onAccepted?: (invitation: ChannelInvitation) => void;
  title?: string;
  emptyState?: React.ReactNode;
}

const FOCUSABLE_SELECTOR = 'button, [tabindex]:not([tabindex="-1"])';

export function ChannelInvitationsModal({
  open,
  onClose,
  onAccepted,
  title = 'Channel invitations',
  emptyState,
}: ChannelInvitationsModalProps): React.JSX.Element | null {
  const { invitations, isLoading, error, accept, reject, markAllSeen } =
    useChannelInvitations();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mark the inbox seen when the modal opens.
  useEffect(() => {
    if (!open) return;
    markAllSeen();
    setRowError(null);
  }, [open, markAllSeen]);

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

  const onAccept = useCallback(
    async (invitation: ChannelInvitation) => {
      setBusyId(invitation.id);
      setRowError(null);
      try {
        await accept(invitation.id);
        onAccepted?.(invitation);
      } catch (e) {
        setRowError(e instanceof Error ? e.message : 'Could not accept');
      } finally {
        setBusyId(null);
      }
    },
    [accept, onAccepted],
  );

  const onReject = useCallback(
    async (invitation: ChannelInvitation) => {
      setBusyId(invitation.id);
      setRowError(null);
      try {
        await reject(invitation.id);
      } catch (e) {
        setRowError(e instanceof Error ? e.message : 'Could not reject');
      } finally {
        setBusyId(null);
      }
    },
    [reject],
  );

  if (!open) return null;

  return (
    <div
      className="sm-channel-invites-backdrop"
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
        className="sm-channel-invites-modal"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
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
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {title}
            {invitations.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 12,
                  color: 'var(--sm-muted-text, #6b7280)',
                  fontWeight: 500,
                }}
              >
                {invitations.length}
              </span>
            )}
          </div>
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

        <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
          {isLoading ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--sm-muted-text, #6b7280)',
              }}
            >
              Loading…
            </div>
          ) : error ? (
            <div
              role="alert"
              style={{
                margin: 12,
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
          ) : invitations.length === 0 ? (
            <div
              style={{
                padding: 28,
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--sm-muted-text, #6b7280)',
              }}
            >
              {emptyState ?? 'No pending invitations'}
            </div>
          ) : (
            invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="sm-channel-invite-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    # {invitation.channel_name ?? invitation.channel_id.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sm-muted-text, #6b7280)' }}>
                    Invited by{' '}
                    {invitation.invited_by_display_name ??
                      invitation.invited_by.slice(0, 8)}
                  </div>
                  {invitation.channel_description && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        color: 'var(--sm-muted-text, #6b7280)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {invitation.channel_description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => void onReject(invitation)}
                    disabled={busyId === invitation.id}
                    style={{
                      padding: '6px 12px',
                      background: 'transparent',
                      border: '1px solid var(--sm-border-color, #e5e7eb)',
                      borderRadius: 6,
                      cursor: busyId === invitation.id ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      color: 'inherit',
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => void onAccept(invitation)}
                    disabled={busyId === invitation.id}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--sm-primary, #2563eb)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: busyId === invitation.id ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      opacity: busyId === invitation.id ? 0.6 : 1,
                    }}
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))
          )}
          {rowError && (
            <div
              role="alert"
              style={{
                margin: 12,
                padding: '8px 10px',
                background: 'var(--sm-error-bg, #fef2f2)',
                color: 'var(--sm-error-text, #991b1b)',
                border: '1px solid var(--sm-error-border, #fecaca)',
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {rowError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
