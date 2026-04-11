import React, { useEffect, useState } from 'react';
import type { CallSession } from '../core/ConferenceClient';

// ============================================================================
// Lazy loader for the video backend's React components.
//
// The SDK uses LiveKit's React components internally as the video backend.
// We load them lazily via dynamic import so that:
//  1. Consumers who never render a CallOverlay don't pay the bundle cost.
//  2. The dynamic import still fails gracefully if the peer dep is somehow
//     missing (legacy consumers upgrading from an older version, etc.).
//
// Consumers of @scalemule/chat should never see "LiveKit" in their own
// code — the backend (`scalemule-conference`) exposes vendor-neutral field
// names and this component accepts vendor-neutral props. The only
// vendor-specific code lives here, below this comment.
// ============================================================================

interface VideoBackendComponents {
  Room: React.ComponentType<any>;
  VideoConference: React.ComponentType<any>;
  RoomAudioRenderer: React.ComponentType<any>;
}

let cachedComponents: VideoBackendComponents | null = null;
let importAttempted = false;
let importPromise: Promise<VideoBackendComponents | null> | null = null;

function loadVideoBackendComponents(): Promise<VideoBackendComponents | null> {
  if (importPromise) return importPromise;
  importPromise = import('@livekit/components-react')
    .then((mod) => {
      cachedComponents = {
        Room: mod.LiveKitRoom,
        VideoConference: mod.VideoConference,
        RoomAudioRenderer: mod.RoomAudioRenderer,
      };
      importAttempted = true;
      return cachedComponents;
    })
    .catch(() => {
      importAttempted = true;
      return null;
    });
  return importPromise;
}

// ============================================================================
// Public props — vendor-neutral
// ============================================================================

export interface CallOverlayProps {
  /**
   * The active call session, obtained via `ConferenceClient.joinCall(callId)`.
   * The SDK re-calls `joinCall` internally before `session.tokenExpiresAt`
   * via `onTokenRefresh` to keep the connection alive.
   */
  session: CallSession;
  /**
   * Called when the access token is about to expire. Should resolve to a
   * fresh session (typically by calling `ConferenceClient.joinCall(callId)`
   * again). If omitted, the call will disconnect when the token expires.
   */
  onTokenRefresh?: () => Promise<CallSession>;
  /** Called when the user closes the overlay (or the call is ended). */
  onClose?: () => void;
  /** Fired on media-session errors. */
  onError?: (error: Error) => void;
  style?: React.CSSProperties;
}

/**
 * Full-screen video call overlay.
 *
 * Takes a `CallSession` from `ConferenceClient.joinCall()` and renders a
 * live video conference. The specific video backend is an implementation
 * detail — this component's public API is entirely vendor-neutral.
 */
export function CallOverlay({
  session,
  onTokenRefresh,
  onClose,
  onError,
  style,
}: CallOverlayProps): React.JSX.Element {
  const [, setIsConnected] = useState(false);
  const [backend, setBackend] = useState<VideoBackendComponents | null>(cachedComponents);
  const [backendLoaded, setBackendLoaded] = useState(importAttempted);
  const [currentToken, setCurrentToken] = useState(session.accessToken);
  const [currentServerUrl, setCurrentServerUrl] = useState(session.serverUrl);

  // Resolve the video backend on mount (async, cached after first load)
  useEffect(() => {
    if (cachedComponents) {
      setBackend(cachedComponents);
      setBackendLoaded(true);
      return;
    }
    let cancelled = false;
    loadVideoBackendComponents().then((result) => {
      if (!cancelled) {
        setBackend(result);
        setBackendLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Token refresh ahead of expiry. Wakes up 30s before the token dies,
  // calls `onTokenRefresh` with linear-backoff + jitter retries (preserved
  // from #17 — prevents thundering-herd reconnects when the video backend
  // restarts and many clients refresh simultaneously), and swaps the new
  // session in when it arrives.
  useEffect(() => {
    if (!onTokenRefresh) return;
    const msUntilRefresh = Math.max(
      5_000,
      session.tokenExpiresAt - Date.now() - 30_000,
    );
    let cancelled = false;
    const timer = setTimeout(async () => {
      const backoffWindows: Array<[number, number]> = [
        [1000, 3000],
        [3000, 10000],
        [10000, 30000],
      ];
      let lastError: unknown;
      for (let attempt = 0; attempt <= backoffWindows.length; attempt++) {
        if (cancelled) return;
        try {
          const next = await onTokenRefresh();
          if (cancelled) return;
          setCurrentToken(next.accessToken);
          setCurrentServerUrl(next.serverUrl);
          return;
        } catch (err) {
          lastError = err;
          if (attempt >= backoffWindows.length) break;
          const [minMs, maxMs] = backoffWindows[attempt];
          const delayMs = minMs + Math.floor(Math.random() * (maxMs - minMs));
          console.warn(
            `[CallOverlay] Token refresh attempt ${attempt + 1} failed, retrying in ${delayMs}ms`,
            err,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      if (cancelled) return;
      const finalErr =
        lastError instanceof Error
          ? lastError
          : new Error('Token refresh failed after 4 attempts');
      onError?.(finalErr);
    }, msUntilRefresh);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session.tokenExpiresAt, onTokenRefresh, onError]);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#000',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 9999,
    ...style,
  };

  if (backend && currentToken && currentServerUrl) {
    const Room = backend.Room;
    const VideoConference = backend.VideoConference;
    const RoomAudioRenderer = backend.RoomAudioRenderer;
    return (
      <div style={overlayStyle} role="dialog" aria-label="Video call">
        <Room
          serverUrl={currentServerUrl}
          token={currentToken}
          connect={true}
          onConnected={() => setIsConnected(true)}
          onDisconnected={() => setIsConnected(false)}
          onError={(err: Error) => {
            onError?.(err);
          }}
          options={{
            adaptiveStream: true,
            dynacast: true,
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <VideoConference />
            <RoomAudioRenderer />
          </div>

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
        </Room>
      </div>
    );
  }

  // Fallback: backend still loading, failed to load, or missing creds
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
          {!backendLoaded
            ? 'Loading...'
            : currentServerUrl
              ? 'Connecting...'
              : 'Video conferencing not configured'}
        </p>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 24 }}>
          Call ID: {session.callId}
        </p>
        {backendLoaded && !backend && (
          <p style={{ fontSize: 13, color: '#d1d5db', maxWidth: 400, textAlign: 'center' }}>
            Video backend failed to load. Reinstall <code>@scalemule/chat</code> to repair.
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
