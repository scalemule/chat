import React, { useEffect, useState } from 'react';

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
  createdAt?: string;
}

interface ActiveCallBannerProps {
  call: ActiveCallInfo | null;
  onJoin?: (callId: string) => void;
  onDismiss?: () => void;
  getUserName?: (userId: string) => string;
  className?: string;
  style?: React.CSSProperties;
}

function useElapsed(startedAt: string | undefined): string {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!startedAt) return;
    const update = () => {
      const secs = Math.max(
        0,
        Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
      );
      if (secs < 60) setText(`${secs}s ago`);
      else setText(`${Math.floor(secs / 60)}m ago`);
    };
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return text;
}

/**
 * Banner showing "X started a call — 45s ago" with a Join button.
 *
 * Pure presentational — the parent hooks up `useIncomingCalls` from
 * `@scalemule/conference` and passes the call data in. Displays
 * elapsed time relative to `call.createdAt` when available.
 *
 * CSS class `.sm-active-call-banner` for host overrides. Styling uses
 * `--sm-*` tokens so it inherits the host theme.
 */
export function ActiveCallBanner({
  call,
  onJoin,
  onDismiss,
  getUserName,
  className,
  style,
}: ActiveCallBannerProps) {
  const elapsed = useElapsed(call?.createdAt);
  if (!call || call.status !== 'active') return null;

  const callerName = getUserName ? getUserName(call.createdBy) : call.createdBy;
  const typeLabel = call.callType === 'video' ? 'video call' : 'audio call';

  return (
    <div
      className={`sm-active-call-banner ${className ?? ''}`}
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 12px',
        background: 'var(--sm-call-banner-bg, #1e3a5f)',
        borderRadius: 8,
        color: 'var(--sm-call-banner-text, #fff)',
        fontSize: 13,
        fontFamily: 'var(--sm-font-family, system-ui, -apple-system, sans-serif)',
        ...style,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: '#22c55e',
            animation: 'sm-call-pulse 1.5s ease-out infinite',
            flexShrink: 0,
          }}
        />
        <span>
          <strong>{callerName}</strong> started a {typeLabel}
          {elapsed && (
            <span style={{ marginLeft: 6, opacity: 0.7 }}>— {elapsed}</span>
          )}
        </span>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {onJoin && (
          <button
            type="button"
            onClick={() => onJoin(call.id)}
            style={{
              background: 'var(--sm-primary, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '4px 14px',
              cursor: 'pointer',
              fontSize: 13,
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
              color: 'rgba(255,255,255,0.6)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
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
