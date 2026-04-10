// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// Mock the LiveKit dynamic import — the overlay gracefully falls back to a
// placeholder when @livekit/components-react is not available (see
// CallOverlay source: catches the import failure and renders a placeholder).
vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="livekit-room">{children}</div>
  ),
  VideoConference: () => <div data-testid="video-conference" />,
  RoomAudioRenderer: () => <div data-testid="room-audio-renderer" />,
}));

import { CallOverlay } from '../CallOverlay';

describe('CallOverlay', () => {
  it('renders without crashing with minimum props', () => {
    const { container } = render(
      <CallOverlay
        callId="call-1"
        livekitUrl="wss://example.com"
        livekitToken="fake-token"
      />,
    );
    // Either the placeholder or the LiveKit-mounted content should render.
    expect(container.firstChild).toBeTruthy();
  });

  it('accepts onClose callback without error', () => {
    const onClose = vi.fn();
    render(
      <CallOverlay
        callId="call-1"
        livekitUrl="wss://example.com"
        livekitToken="fake-token"
        onClose={onClose}
      />,
    );
    // onClose is wired via overlay controls; not necessarily triggered on
    // mount. Just verify the prop doesn't cause a crash.
    expect(onClose).not.toHaveBeenCalled();
  });
});
