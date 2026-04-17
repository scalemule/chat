import React from 'react';

export interface CallTriggerGroupProps {
  /** Conversation to initiate the call in. */
  conversationId: string;
  /**
   * Fires when the user clicks either button. The second argument is
   * the call type so the host can route to the appropriate pre-call
   * lobby or directly call `ConferenceClient.createCall`.
   */
  onCallRequested: (
    conversationId: string,
    callType: 'audio' | 'video',
  ) => void;
  /** Disable both buttons (e.g. while offline). Default false. */
  disabled?: boolean;
  /** Hide the audio call button. Default false. */
  hideAudio?: boolean;
  /** Hide the video call button. Default false. */
  hideVideo?: boolean;
  /** i18n: aria-label for the audio button. */
  audioLabel?: string;
  /** i18n: aria-label for the video button. */
  videoLabel?: string;
  style?: React.CSSProperties;
}

const btnBase: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  color: 'var(--sm-muted-text, #6b7280)',
  transition: 'color 0.15s, opacity 0.15s',
};

/**
 * Paired audio + video call trigger buttons for the chat header.
 *
 * Renders two icon buttons side by side. Does NOT call `getUserMedia`
 * — the host routes the `onCallRequested` callback to the conference
 * SDK's `PreCallLobby` or `ConferenceClient.createCall`.
 *
 * ```tsx
 * <ChannelHeader ...>
 *   <CallTriggerGroup
 *     conversationId={conversationId}
 *     onCallRequested={(id, type) => openLobby(id, type)}
 *   />
 * </ChannelHeader>
 * ```
 *
 * CSS class `.sm-call-trigger-group` for host overrides.
 */
export function CallTriggerGroup({
  conversationId,
  onCallRequested,
  disabled = false,
  hideAudio = false,
  hideVideo = false,
  audioLabel = 'Start audio call',
  videoLabel = 'Start video call',
  style,
}: CallTriggerGroupProps): React.JSX.Element {
  return (
    <span
      className="sm-call-trigger-group"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
    >
      {!hideAudio && (
        <button
          type="button"
          disabled={disabled}
          aria-label={audioLabel}
          title={audioLabel}
          onClick={() => onCallRequested(conversationId, 'audio')}
          className="sm-call-trigger-audio"
          style={{
            ...btnBase,
            opacity: disabled ? 0.4 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </button>
      )}
      {!hideVideo && (
        <button
          type="button"
          disabled={disabled}
          aria-label={videoLabel}
          title={videoLabel}
          onClick={() => onCallRequested(conversationId, 'video')}
          className="sm-call-trigger-video"
          style={{
            ...btnBase,
            opacity: disabled ? 0.4 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </button>
      )}
    </span>
  );
}
