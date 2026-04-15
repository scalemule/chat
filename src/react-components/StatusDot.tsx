import React from 'react';

export type StatusDotStatus = 'online' | 'away' | 'offline';

export interface StatusDotProps {
  /**
   * Resolved status. Hosts typically pass the return value of
   * `useConversationPresenceStatus` from `@scalemule/chat/react`.
   * `undefined` is treated the same as `'offline'`.
   */
  status: StatusDotStatus | undefined;
  /**
   * When `false`, the dot renders nothing for the `offline` status.
   * Default `true` — an offline member still gets a gray hollow dot
   * so the status area in a row doesn't jump between "dot" and
   * "no dot" as a user goes online/offline.
   */
  showOffline?: boolean;
  /** Dot diameter in pixels. Default 10. */
  size?: number;
  /** Accessible label. Defaults to the English status name. */
  ariaLabel?: string;
}

/**
 * Pure visual status dot — green (online), amber (away), gray hollow
 * (offline). No data fetch, no presence subscription. Host supplies the
 * resolved status via `status`.
 *
 * Composes well on top of an existing avatar:
 *
 * ```tsx
 * <div style={{ position: 'relative' }}>
 *   <Avatar src={user.avatar_url} />
 *   <div style={{ position: 'absolute', right: 0, bottom: 0 }}>
 *     <StatusDot status={status} />
 *   </div>
 * </div>
 * ```
 *
 * Styling tokens (themes/message-polish.css):
 *   - `--sm-status-online-color`   (default green)
 *   - `--sm-status-away-color`     (default amber)
 *   - `--sm-status-offline-color`  (default muted gray)
 *   - `--sm-status-dot-border`     (default `--sm-surface`, keeps
 *                                   contrast when overlaid on an avatar)
 */
export function StatusDot({
  status,
  showOffline = true,
  size = 10,
  ariaLabel,
}: StatusDotProps): React.JSX.Element | null {
  const resolved: StatusDotStatus = status ?? 'offline';
  if (resolved === 'offline' && !showOffline) return null;

  const label =
    ariaLabel ??
    (resolved === 'online'
      ? 'Online'
      : resolved === 'away'
        ? 'Away'
        : 'Offline');

  return (
    <span
      role="status"
      aria-label={label}
      className={`sm-status-dot sm-status-dot-${resolved}`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 999,
        border: '2px solid var(--sm-status-dot-border, var(--sm-surface, #fff))',
        boxSizing: 'content-box',
        background:
          resolved === 'online'
            ? 'var(--sm-status-online-color, #22c55e)'
            : resolved === 'away'
              ? 'var(--sm-status-away-color, #f59e0b)'
              : 'var(--sm-status-offline-color, #9ca3af)',
      }}
    />
  );
}
