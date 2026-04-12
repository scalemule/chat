import React from 'react';

/**
 * Minimal call info type — structurally compatible with
 * `@scalemule/conference`'s `Call` type without importing it.
 * Consumers pass conference SDK `Call` objects and TypeScript's
 * structural typing accepts them.
 */
interface ActiveCallInfo {
  id: string;
  createdBy: string;
  callType: string;
  status: string;
}

interface ActiveCallBannerProps {
  call: ActiveCallInfo | null;
  onJoin?: (callId: string) => void;
  onDismiss?: () => void;
  getUserName?: (userId: string) => string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Thin banner showing "X started a call" with a Join button.
 *
 * Pure presentational — the parent hooks up `useIncomingCalls` from
 * `@scalemule/conference` and passes the call data in.
 */
export function ActiveCallBanner({
  call,
  onJoin,
  onDismiss,
  getUserName,
  className,
  style,
}: ActiveCallBannerProps) {
  if (!call || call.status !== 'active') return null;

  const callerName = getUserName ? getUserName(call.createdBy) : call.createdBy;
  const typeLabel = call.callType === 'video' ? 'video call' : 'audio call';

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: '#1e3a5f',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '13px',
        ...style,
      }}
    >
      <span>
        <strong>{callerName}</strong> started a {typeLabel}
      </span>
      <div style={{ display: 'flex', gap: '8px' }}>
        {onJoin && (
          <button
            type="button"
            onClick={() => onJoin(call.id)}
            style={{
              background: '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Join
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'none',
              color: '#aaa',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
