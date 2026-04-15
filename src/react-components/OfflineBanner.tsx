import React from 'react';

import { useConnectionStatus } from '../react';

export interface OfflineBannerProps {
  /**
   * Custom banner body. Defaults to English `"You are offline"`.
   * Use for i18n or to compose a richer message (e.g. "Reconnecting…"
   * when `isReconnecting` is true).
   */
  children?: React.ReactNode;
  /**
   * When provided, renders a dismiss button. Useful if hosts want
   * users to be able to hide the banner manually and rely on other
   * cues (e.g. a disabled composer via `disableWhenOffline`).
   */
  onDismiss?: () => void;
}

/**
 * Renders a banner when the chat WebSocket is not connected. Hidden
 * while connected. Thin wrapper over `useConnectionStatus`.
 *
 * Theming tokens (CSS, applied inline by default):
 *   - `--sm-offline-banner-bg`   (default amber tint)
 *   - `--sm-offline-banner-text` (default darker amber)
 *
 * CSS class hook: `.sm-offline-banner`.
 */
export function OfflineBanner({
  children,
  onDismiss,
}: OfflineBannerProps): React.JSX.Element | null {
  const { isOnline } = useConnectionStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sm-offline-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 14px',
        background: 'var(--sm-offline-banner-bg, rgba(251, 191, 36, 0.15))',
        color: 'var(--sm-offline-banner-text, #92400e)',
        borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
        fontSize: 13,
        fontFamily: 'var(--sm-font-family, system-ui, -apple-system, sans-serif)',
      }}
    >
      <span>{children ?? 'You are offline'}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
