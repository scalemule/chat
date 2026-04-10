import React, { useCallback, useEffect, useState } from 'react';

interface LiveKitComponents {
  LiveKitRoom: React.ComponentType<any>;
  VideoConference: React.ComponentType<any>;
  RoomAudioRenderer: React.ComponentType<any>;
}

// Module-level cache for the async-resolved LiveKit components.
// This ensures the dynamic import only runs once across all CallOverlay instances.
let cachedComponents: LiveKitComponents | null = null;
let importAttempted = false;
let importPromise: Promise<LiveKitComponents | null> | null = null;

function loadLiveKitComponents(): Promise<LiveKitComponents | null> {
  if (importPromise) return importPromise;
  importPromise = import('@livekit/components-react')
    .then((mod) => {
      cachedComponents = {
        LiveKitRoom: mod.LiveKitRoom,
        VideoConference: mod.VideoConference,
        RoomAudioRenderer: mod.RoomAudioRenderer,
      };
      importAttempted = true;
      return cachedComponents;
    })
    .catch(() => {
      // @livekit/components-react not installed — will render placeholder
      importAttempted = true;
      return null;
    });
  return importPromise;
}

interface CallOverlayProps {
  callId: string;
  livekitUrl: string;
  livekitToken: string;
  /** Called to get a fresh token (5-min TTL refresh). Should call sm.conference.joinCall(callId). */
  onTokenRefresh?: () => Promise<string>;
  onClose?: () => void;
  onError?: (error: Error) => void;
  style?: React.CSSProperties;
}

/**
 * Full-screen call overlay with video conferencing.
 *
 * Uses @livekit/components-react for the actual WebRTC UI.
 * Falls back to a placeholder if LiveKit deps aren't installed.
 *
 * The `onTokenRefresh` callback is critical -- LiveKit tokens have a 5-minute TTL.
 * The SDK calls this automatically before expiry to get a fresh token.
 * This re-checks authorization (chat membership, etc.) on every refresh.
 */
export function CallOverlay({
  callId,
  livekitUrl,
  livekitToken,
  onTokenRefresh,
  onClose,
  onError,
  style,
}: CallOverlayProps): React.JSX.Element {
  const [isConnected, setIsConnected] = useState(false);
  const [lk, setLk] = useState<LiveKitComponents | null>(cachedComponents);
  const [lkLoaded, setLkLoaded] = useState(importAttempted);

  // Resolve LiveKit components on mount (async, but cached after first load)
  useEffect(() => {
    if (cachedComponents) {
      setLk(cachedComponents);
      setLkLoaded(true);
      return;
    }
    let cancelled = false;
    loadLiveKitComponents().then((result) => {
      if (!cancelled) {
        setLk(result);
        setLkLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const tokenProvider = useCallback(async (): Promise<string> => {
    if (onTokenRefresh) {
      return onTokenRefresh();
    }
    throw new Error('Token refresh not configured');
  }, [onTokenRefresh]);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#000',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 9999,
    ...style,
  };

  // If LiveKit components are available, render the real video UI
  if (lk && livekitUrl && livekitToken) {
    return (
      <div style={overlayStyle} role="dialog" aria-label="Video call">
        <lk.LiveKitRoom
          serverUrl={livekitUrl}
          token={livekitToken}
          connect={true}
          onConnected={() => setIsConnected(true)}
          onDisconnected={() => setIsConnected(false)}
          onError={(err: Error) => {
            console.error('LiveKit error:', err);
            onError?.(err);
          }}
          options={{
            adaptiveStream: true,
            dynacast: true,
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <lk.VideoConference />
            <lk.RoomAudioRenderer />
          </div>

          {/* Close/end call button overlay */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 10000,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 20px',
                borderRadius: 20,
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              End Call
            </button>
          </div>
        </lk.LiveKitRoom>
      </div>
    );
  }

  // Fallback: LiveKit deps not installed, still loading, or missing connection details
  return (
    <div style={overlayStyle} role="dialog" aria-label="Video call">
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        <p style={{ fontSize: 18, marginBottom: 8 }}>
          {!lkLoaded
            ? 'Loading...'
            : livekitUrl
              ? 'Connecting...'
              : 'Video conferencing not configured'}
        </p>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 24 }}>
          Call ID: {callId}
        </p>
        {lkLoaded && !lk && (
          <p style={{ fontSize: 13, color: '#d1d5db', maxWidth: 400, textAlign: 'center' }}>
            Install @livekit/components-react and livekit-client to enable video conferencing.
          </p>
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
