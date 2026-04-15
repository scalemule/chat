// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';

import { useChannelInvitations, __ChatContext } from './react';
import type { ChannelInvitation } from './types';

type Listener = (payload: unknown) => void;

function createMockClient(initial: ChannelInvitation[] = []) {
  const listeners = new Map<string, Set<Listener>>();
  const accept = vi.fn(async (id: string) => ({
    data: { channel_id: 'ch-' + id },
    error: null,
  }));
  const reject = vi.fn(async () => ({ data: undefined, error: null }));
  return {
    listChannelInvitations: vi.fn(async () => ({ data: initial, error: null })),
    acceptChannelInvitation: accept,
    rejectChannelInvitation: reject,
    on(event: string, cb: Listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(cb);
      return () => set!.delete(cb);
    },
    emit(event: string, payload: unknown) {
      listeners.get(event)?.forEach((cb) => cb(payload));
    },
  };
}

let currentClient: ReturnType<typeof createMockClient>;

beforeEach(() => {
  // Each test sets currentClient explicitly so the harness reads a fresh one.
});
afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
});

function inv(id: string, channel: string): ChannelInvitation {
  return {
    id,
    channel_id: channel,
    channel_name: channel,
    invited_by: 'inviter',
    invited_by_display_name: 'Inviter',
    created_at: '2026-04-15T10:00:00.000Z',
  };
}

interface ProbeState {
  invitations: ChannelInvitation[];
  unseenCount: number;
  isLoading: boolean;
  error: string | null;
  accept: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
  markAllSeen: () => void;
}

let latest: ProbeState | null = null;
function Probe(): null {
  const state = useChannelInvitations();
  React.useEffect(() => {
    latest = state;
  });
  return null;
}

function renderHook() {
  latest = null;
  return render(
    React.createElement(
      __ChatContext.Provider,
      {
        value: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          client: currentClient as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: { baseUrl: 'x', apiKey: 'k' } as any,
        },
      },
      React.createElement(Probe),
    ),
  );
}

describe('useChannelInvitations', () => {
  it('seeds from listChannelInvitations and exposes unseen count', async () => {
    currentClient = createMockClient([inv('i1', 'general'), inv('i2', 'random')]);
    renderHook();
    await waitFor(() => expect(latest?.invitations.length).toBe(2));
    expect(latest!.unseenCount).toBe(2);
  });

  it('appends new invitations when channel:invitation:received fires', async () => {
    currentClient = createMockClient([inv('i1', 'general')]);
    renderHook();
    await waitFor(() => expect(latest?.invitations.length).toBe(1));
    act(() => {
      currentClient.emit('channel:invitation:received', {
        invitation: inv('i2', 'random'),
      });
    });
    await waitFor(() => expect(latest?.invitations.length).toBe(2));
    expect(latest!.invitations[0].id).toBe('i2');
  });

  it('removes an invitation when channel:invitation:resolved fires', async () => {
    currentClient = createMockClient([inv('i1', 'general'), inv('i2', 'random')]);
    renderHook();
    await waitFor(() => expect(latest?.invitations.length).toBe(2));
    act(() => {
      currentClient.emit('channel:invitation:resolved', {
        invitationId: 'i1',
        status: 'accepted',
      });
    });
    await waitFor(() => expect(latest?.invitations.length).toBe(1));
    expect(latest!.invitations[0].id).toBe('i2');
  });

  it('accept() optimistically removes and calls the client', async () => {
    currentClient = createMockClient([inv('i1', 'general')]);
    renderHook();
    await waitFor(() => expect(latest?.invitations.length).toBe(1));
    await act(async () => {
      await latest!.accept('i1');
    });
    expect(currentClient.acceptChannelInvitation).toHaveBeenCalledWith('i1');
    expect(latest!.invitations.length).toBe(0);
  });

  it('restores the row if accept rejects', async () => {
    currentClient = createMockClient([inv('i1', 'general')]);
    currentClient.acceptChannelInvitation = vi.fn(async () => ({
      data: null,
      error: { message: 'denied' } as unknown as { message: string },
    })) as unknown as typeof currentClient.acceptChannelInvitation;
    renderHook();
    await waitFor(() => expect(latest?.invitations.length).toBe(1));
    await act(async () => {
      await expect(latest!.accept('i1')).rejects.toThrow(/denied/);
    });
    expect(latest!.invitations.length).toBe(1);
  });

  it('markAllSeen persists the latest id and zeroes unseenCount', async () => {
    currentClient = createMockClient([inv('i2', 'random'), inv('i1', 'general')]);
    renderHook();
    await waitFor(() => expect(latest?.invitations.length).toBe(2));
    expect(latest!.unseenCount).toBe(2);
    act(() => {
      latest!.markAllSeen();
    });
    expect(latest!.unseenCount).toBe(0);
    // A new invitation arrives — unseenCount becomes 1 again.
    act(() => {
      currentClient.emit('channel:invitation:received', {
        invitation: inv('i3', 'newest'),
      });
    });
    await waitFor(() => expect(latest?.invitations.length).toBe(3));
    expect(latest!.unseenCount).toBe(1);
  });
});
