import React from 'react';

interface CallSystemMessageProps {
  type: 'started' | 'ended';
  callerName?: string;
  duration?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * System message for call events rendered in the chat timeline.
 *
 * Shows "Video call started" or "Video call ended · 5m 23s" as an
 * inline system message (not a user message bubble).
 */
export function CallSystemMessage({
  type,
  callerName,
  duration,
  className,
  style,
}: CallSystemMessageProps) {
  const text =
    type === 'started'
      ? `${callerName ? callerName + ' ' : ''}started a call`
      : `Call ended${duration ? ` · ${duration}` : ''}`;

  return (
    <div
      className={className}
      style={{
        textAlign: 'center',
        padding: '4px 0',
        fontSize: '12px',
        color: '#888',
        ...style,
      }}
    >
      {text}
    </div>
  );
}
