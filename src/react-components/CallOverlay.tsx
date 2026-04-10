import React from 'react';

interface CallOverlayProps {
  callId: string;
  livekitUrl?: string;
  livekitToken?: string;
  onClose?: () => void;
  style?: React.CSSProperties;
}

/**
 * Full-screen call overlay with participant grid.
 *
 * In production, this wraps @livekit/components-react LiveKitRoom + VideoConference.
 * For v1, this is a placeholder that renders call status and a close button.
 * Actual LiveKit integration requires adding livekit-client and
 * @livekit/components-react as dependencies.
 *
 * When LiveKit deps are added, replace the placeholder with:
 * ```tsx
 * import { LiveKitRoom, VideoConference } from '@livekit/components-react';
 *
 * <LiveKitRoom serverUrl={livekitUrl} token={livekitToken}>
 *   <VideoConference />
 * </LiveKitRoom>
 * ```
 */
export function CallOverlay({
  callId,
  livekitUrl,
  livekitToken,
  onClose,
  style,
}: CallOverlayProps): React.JSX.Element {
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    color: '#fff',
    ...style,
  };

  const hasLiveKit = livekitUrl && livekitToken;

  return (
    <div style={overlayStyle} role="dialog" aria-label="Video call">
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        {hasLiveKit ? (
          <div>
            <p style={{ fontSize: 18, marginBottom: 8 }}>Call in progress</p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 24 }}>
              Call ID: {callId}
            </p>
            <p style={{ fontSize: 13, color: '#d1d5db', marginBottom: 24 }}>
              LiveKit integration placeholder — add livekit-client and
              @livekit/components-react to enable video
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 18, marginBottom: 8 }}>Connecting...</p>
            <p style={{ fontSize: 12, color: '#9ca3af' }}>Call ID: {callId}</p>
          </div>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 24px',
              borderRadius: 24,
              border: 'none',
              backgroundColor: '#ef4444',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 16,
            }}
          >
            End Call
          </button>
        )}
      </div>
    </div>
  );
}
