import React from 'react';

interface CallTriggerButtonProps {
  conversationId: string;
  callType?: 'audio' | 'video';
  onCallRequested?: (conversationId: string, callType: 'audio' | 'video') => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Thin call trigger button for the chat UI.
 *
 * Renders an icon button that fires `onCallRequested` when clicked.
 * Does NOT call `getUserMedia` — that responsibility lives in the
 * conference SDK's `CallButton` or `PreCallLobby`.
 *
 * Named `CallTriggerButton` (not `CallButton`) to avoid collision
 * with the conference SDK's full `CallButton` component.
 */
export function CallTriggerButton({
  conversationId,
  callType = 'video',
  onCallRequested,
  disabled = false,
  className,
  style,
  children,
}: CallTriggerButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      style={{
        background: 'none',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        ...style,
      }}
      onClick={() => {
        if (!disabled) onCallRequested?.(conversationId, callType);
      }}
      aria-label={callType === 'video' ? 'Start video call' : 'Start audio call'}
    >
      {children ?? (callType === 'video' ? '\u{1F4F9}' : '\u{1F4DE}')}
    </button>
  );
}
