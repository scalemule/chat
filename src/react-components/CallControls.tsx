import React from 'react';

interface CallControlsProps {
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  onToggleMute?: () => void;
  onToggleVideo?: () => void;
  onToggleScreenShare?: () => void;
  onEndCall?: () => void;
  style?: React.CSSProperties;
}

/**
 * Call control bar with mute, camera, screen share, and end call buttons.
 */
export function CallControls({
  isMuted = false,
  isVideoOff = false,
  isScreenSharing = false,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
  style,
}: CallControlsProps): React.JSX.Element {
  const barStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    ...style,
  };

  const btnBase: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.15s',
  };

  return (
    <div style={barStyle}>
      <button
        type="button"
        onClick={onToggleMute}
        style={{ ...btnBase, backgroundColor: isMuted ? '#ef4444' : '#374151', color: '#fff' }}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '\u{1F507}' : '\u{1F50A}'}
      </button>
      <button
        type="button"
        onClick={onToggleVideo}
        style={{ ...btnBase, backgroundColor: isVideoOff ? '#ef4444' : '#374151', color: '#fff' }}
        aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
      >
        {isVideoOff ? '\u{1F6AB}' : '\u{1F4F7}'}
      </button>
      <button
        type="button"
        onClick={onToggleScreenShare}
        style={{
          ...btnBase,
          backgroundColor: isScreenSharing ? '#3b82f6' : '#374151',
          color: '#fff',
        }}
        aria-label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
      >
        {'\u{1F5A5}'}
      </button>
      <button
        type="button"
        onClick={onEndCall}
        style={{ ...btnBase, backgroundColor: '#ef4444', color: '#fff', width: 56 }}
        aria-label="End call"
        title="End call"
      >
        {'\u{1F4F5}'}
      </button>
    </div>
  );
}
