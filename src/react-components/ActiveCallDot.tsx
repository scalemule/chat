import React from 'react';

export interface ActiveCallDotProps {
  /**
   * When false, renders nothing. When true, renders a pulsing dot. Callers
   * typically pass the output of a presence hook (e.g.
   * `@scalemule/conference`'s `useActiveCall(conversationId)`) so the SDK
   * itself stays free of conference-SDK dependencies.
   */
  active: boolean;
  /**
   * Accessible label announced to screen readers. Default `"Active call"`.
   */
  ariaLabel?: string;
  /** Dot diameter in pixels. Default 8. */
  size?: number;
}

/**
 * Small pulsing dot indicating an ongoing call in a conversation.
 *
 * Visual-only — the SDK does not track call state. Wire visibility via the
 * `active` prop from the host's call-presence source of truth. Typical
 * placements: `ConversationList.renderActiveIndicator` (sidebar rows) and
 * `ChannelHeader` (breadcrumb).
 *
 * Styling tokens:
 *   - `--sm-active-call-color` (default green `#22c55e`)
 *   - `--sm-active-call-pulse-opacity` (default `0.35`)
 */
export function ActiveCallDot({
  active,
  ariaLabel = 'Active call',
  size = 8,
}: ActiveCallDotProps): React.JSX.Element | null {
  if (!active) return null;
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className="sm-active-call-dot"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 999,
        background: 'var(--sm-active-call-color, #22c55e)',
        position: 'relative',
        flexShrink: 0,
      }}
    />
  );
}
