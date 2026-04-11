// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { CallSession } from '../../core/ConferenceClient';

// Mock the video backend — CallOverlay lazy-loads this at runtime. In
// isolation tests the import resolves instantly to the stubs below, which
// stand in for the real LiveKit React components.
vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="video-room">{children}</div>
  ),
  VideoConference: () => <div data-testid="video-conference" />,
  RoomAudioRenderer: () => <div data-testid="room-audio-renderer" />,
}));

import { CallOverlay } from '../CallOverlay';

function makeSession(overrides: Partial<CallSession> = {}): CallSession {
  return {
    callId: 'call-1',
    serverUrl: 'wss://example.com',
    accessToken: 'fake-token',
    tokenExpiresAt: Date.now() + 5 * 60 * 1000,
    participant: {
      id: 'participant-1',
      userId: 'user-1',
      role: 'member',
      status: 'joined',
    },
    ...overrides,
  };
}

describe('CallOverlay', () => {
  it('renders without crashing with a session', () => {
    const { container } = render(<CallOverlay session={makeSession()} />);
    // Either the placeholder or the backend-mounted content should render.
    expect(container.firstChild).toBeTruthy();
  });

  it('accepts onClose callback without error', () => {
    const onClose = vi.fn();
    render(<CallOverlay session={makeSession()} onClose={onClose} />);
    // onClose is wired via overlay controls; not necessarily triggered on
    // mount. Just verify the prop doesn't cause a crash.
    expect(onClose).not.toHaveBeenCalled();
  });
});
