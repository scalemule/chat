// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { RepStatusToggle } from '../RepStatusToggle';
import type { RepClient, SupportRep } from '../../rep';

function buildRep(overrides: Partial<SupportRep> = {}): SupportRep {
  return {
    id: 'rep-1',
    user_id: 'user-1',
    display_name: 'Rep One',
    status: 'online',
    ...overrides,
  } as SupportRep;
}

function buildMockRepClient(reps: SupportRep[] = []): RepClient {
  return {
    listReps: vi.fn(async () => ({ data: reps, error: null })),
    updateStatus: vi.fn(async () => ({ data: null, error: null })),
    startHeartbeat: vi.fn(),
    stopHeartbeat: vi.fn(),
  } as unknown as RepClient;
}

describe('RepStatusToggle', () => {
  it('fetches the rep list on mount and finds the matching user', async () => {
    const rep = buildRep({ user_id: 'user-1', status: 'online' });
    const repClient = buildMockRepClient([rep]);
    render(<RepStatusToggle repClient={repClient} userId="user-1" />);

    await waitFor(() => {
      expect(repClient.listReps).toHaveBeenCalled();
    });
  });

  it('starts heartbeat when rep is already online on mount', async () => {
    const rep = buildRep({ user_id: 'user-1', status: 'online' });
    const repClient = buildMockRepClient([rep]);
    render(<RepStatusToggle repClient={repClient} userId="user-1" />);

    await waitFor(() => {
      expect(repClient.startHeartbeat).toHaveBeenCalled();
    });
  });

  it('does NOT start heartbeat when rep is offline on mount', async () => {
    const rep = buildRep({ user_id: 'user-1', status: 'offline' });
    const repClient = buildMockRepClient([rep]);
    render(<RepStatusToggle repClient={repClient} userId="user-1" />);

    // Wait for the listReps fetch to settle
    await waitFor(() => {
      expect(repClient.listReps).toHaveBeenCalled();
    });
    expect(repClient.startHeartbeat).not.toHaveBeenCalled();
  });

  it('stops heartbeat on unmount', async () => {
    const rep = buildRep({ user_id: 'user-1', status: 'online' });
    const repClient = buildMockRepClient([rep]);
    const { unmount } = render(
      <RepStatusToggle repClient={repClient} userId="user-1" />,
    );

    await waitFor(() => expect(repClient.listReps).toHaveBeenCalled());

    unmount();
    expect(repClient.stopHeartbeat).toHaveBeenCalled();
  });
});
