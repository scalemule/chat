import React, { useCallback, useState } from 'react';

interface CallButtonProps {
  conversationId: string;
  callType?: 'audio' | 'video';
  className?: string;
  style?: React.CSSProperties;
  onCallStarted?: (callId: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * One-click call button for initiating audio/video calls from a conversation.
 *
 * IMPORTANT (Mobile WebRTC): This component renders a real <button> element.
 * The onClick handler must trigger getUserMedia synchronously within the user
 * gesture to satisfy iOS Safari and Android Chrome autoplay/media policies.
 * Do NOT defer media access to useEffect or async callbacks outside the gesture.
 */
export function CallButton({
  conversationId,
  callType = 'video',
  className,
  style,
  onCallStarted,
  onError,
  disabled = false,
  children,
}: CallButtonProps): React.JSX.Element {
  const [isStarting, setIsStarting] = useState(false);

  const handleClick = useCallback(async () => {
    if (isStarting || disabled) return;
    setIsStarting(true);

    try {
      // Request media permissions in the click handler (required for mobile WebRTC)
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: callType === 'video',
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Stop tracks immediately — the video backend will request its own stream
      // once the call is joined.
      stream.getTracks().forEach((t) => t.stop());

      // Notify parent to initiate the call. The parent component (e.g.,
      // ChatThread) should use `ConferenceClient` to create and join the
      // call, then render `CallOverlay` with the resulting `CallSession`.
      onCallStarted?.(conversationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access media devices';
      onError?.(message);
    } finally {
      setIsStarting(false);
    }
  }, [conversationId, callType, isStarting, disabled, onCallStarted, onError]);

  const defaultStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: 'var(--sm-primary, #3b82f6)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled || isStarting ? 'not-allowed' : 'pointer',
    opacity: disabled || isStarting ? 0.6 : 1,
    transition: 'opacity 0.15s',
    ...style,
  };

  const icon = callType === 'audio' ? '\u{1F4DE}' : '\u{1F4F9}';

  return (
    <button
      type="button"
      className={className}
      style={defaultStyle}
      onClick={handleClick}
      disabled={disabled || isStarting}
      aria-label={`Start ${callType} call`}
    >
      {children || (
        <>
          <span>{icon}</span>
          <span>{isStarting ? 'Starting...' : callType === 'audio' ? 'Call' : 'Video'}</span>
        </>
      )}
    </button>
  );
}
