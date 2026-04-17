// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';

import { ChatContext } from './shared/ChatContext';
import { useConversationPresenceStatus } from './react';
import type { PresenceMember } from './types';

type Listener = (payload: unknown) => void;

function createMockClient() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    joinPresence: () => {},
    leavePresence: () => {},
    async getConversation() {
      return { data: null };
    },
    on(event: string, cb: Listener): () => void {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(cb);
      return () => set!.delete(cb);
    },
    emit(event: string, payload: unknown): void {
      listeners.get(event)?.forEach((cb) => cb(payload));
    },
  };
}

let currentClient: ReturnType<typeof createMockClient>;
beforeEach(() => {
  currentClient = createMockClient();
});

let latest: 'online' | 'away' | 'offline' | null = null;
function Probe({
  conversationId,
  userId,
  staleThresholdMs,
  now,
}: {
  conversationId: string | undefined;
  userId: string | undefined;
  staleThresholdMs?: number;
  now?: () => number;
}): null {
  const status = useConversationPresenceStatus(conversationId, userId, {
    staleThresholdMs,
    now,
  });
  React.useEffect(() => {
    latest = status;
  });
  return null;
}

function renderHook(
  conversationId: string | undefined,
  userId: string | undefined,
  extra?: { staleThresholdMs?: number; now?: () => number },
) {
  latest = null;
  return render(
    React.createElement(
      ChatContext.Provider,
      {
        value: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          client: currentClient as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: { baseUrl: 'x', apiKey: 'k' } as any,
        },
      },
      React.createElement(Probe, {
        conversationId,
        userId,
        staleThresholdMs: extra?.staleThresholdMs,
        now: extra?.now,
      }),
    ),
  );
}

function emitPresenceState(conversationId: string, members: PresenceMember[]) {
  act(() => {
    currentClient.emit('presence:state', { conversationId, members });
  });
}

describe('useConversationPresenceStatus', () => {
  it('returns offline when conversationId is undefined', () => {
    renderHook(undefined, 'u1');
    expect(latest).toBe('offline');
  });

  it('returns offline when userId is undefined', () => {
    renderHook('c1', undefined);
    expect(latest).toBe('offline');
  });

  it('returns offline when the user is not in presence', () => {
    renderHook('c1', 'u1');
    emitPresenceState('c1', [
      { user_id: 'u2', status: 'online', joined_at: '2026-04-15T00:00:00.000Z' },
    ]);
    expect(latest).toBe('offline');
  });

  it('returns online when the user is in presence without a status', () => {
    renderHook('c1', 'u1');
    emitPresenceState('c1', [
      { user_id: 'u1', joined_at: '2026-04-15T00:00:00.000Z' },
    ]);
    expect(latest).toBe('online');
  });

  it('returns online when the user is in presence with status=online', () => {
    renderHook('c1', 'u1');
    emitPresenceState('c1', [
      { user_id: 'u1', status: 'online', joined_at: '2026-04-15T00:00:00.000Z' },
    ]);
    expect(latest).toBe('online');
  });

  it('returns away when the user is in presence with status=away', () => {
    renderHook('c1', 'u1');
    emitPresenceState('c1', [
      { user_id: 'u1', status: 'away', joined_at: '2026-04-15T00:00:00.000Z' },
    ]);
    expect(latest).toBe('away');
  });

  it('transitions online -> away when presence updates', () => {
    renderHook('c1', 'u1');
    emitPresenceState('c1', [
      { user_id: 'u1', status: 'online', joined_at: '2026-04-15T00:00:00.000Z' },
    ]);
    expect(latest).toBe('online');
    emitPresenceState('c1', [
      { user_id: 'u1', status: 'away', joined_at: '2026-04-15T00:00:00.000Z' },
    ]);
    expect(latest).toBe('away');
  });

  it('transitions away -> offline when user leaves presence', () => {
    renderHook('c1', 'u1');
    emitPresenceState('c1', [
      { user_id: 'u1', status: 'away', joined_at: '2026-04-15T00:00:00.000Z' },
    ]);
    expect(latest).toBe('away');
    emitPresenceState('c1', []);
    expect(latest).toBe('offline');
  });

  it('staleThresholdMs=0 disables pruning even with stale last_active_at', () => {
    renderHook('c1', 'u1', { now: () => Date.parse('2026-04-17T12:05:00.000Z') });
    emitPresenceState('c1', [
      {
        user_id: 'u1',
        status: 'online',
        joined_at: '2026-04-17T12:00:00.000Z',
        // 5 minutes stale
        last_active_at: '2026-04-17T12:00:00.000Z',
      },
    ]);
    expect(latest).toBe('online');
  });

  it('flips to offline when last_active_at exceeds staleThresholdMs', () => {
    renderHook('c1', 'u1', {
      staleThresholdMs: 35_000,
      now: () => Date.parse('2026-04-17T12:01:00.000Z'),
    });
    emitPresenceState('c1', [
      {
        user_id: 'u1',
        status: 'online',
        joined_at: '2026-04-17T12:00:00.000Z',
        // 60s stale — exceeds 35s threshold
        last_active_at: '2026-04-17T12:00:00.000Z',
      },
    ]);
    expect(latest).toBe('offline');
  });

  it('keeps online when last_active_at is within staleThresholdMs', () => {
    renderHook('c1', 'u1', {
      staleThresholdMs: 35_000,
      now: () => Date.parse('2026-04-17T12:00:20.000Z'),
    });
    emitPresenceState('c1', [
      {
        user_id: 'u1',
        status: 'online',
        joined_at: '2026-04-17T12:00:00.000Z',
        // 20s stale — under 35s threshold
        last_active_at: '2026-04-17T12:00:00.000Z',
      },
    ]);
    expect(latest).toBe('online');
  });

  it('stale threshold overrides away — silent + away for too long → offline', () => {
    renderHook('c1', 'u1', {
      staleThresholdMs: 35_000,
      now: () => Date.parse('2026-04-17T12:01:00.000Z'),
    });
    emitPresenceState('c1', [
      {
        user_id: 'u1',
        status: 'away',
        joined_at: '2026-04-17T12:00:00.000Z',
        last_active_at: '2026-04-17T12:00:00.000Z',
      },
    ]);
    expect(latest).toBe('offline');
  });

  it('no-ops safely when the server does not ship last_active_at (old service)', () => {
    renderHook('c1', 'u1', {
      staleThresholdMs: 35_000,
      now: () => Date.parse('2026-04-17T12:05:00.000Z'),
    });
    emitPresenceState('c1', [
      // No last_active_at — older realtime service
      { user_id: 'u1', status: 'online', joined_at: '2026-04-17T12:00:00.000Z' },
    ]);
    // Falls back to status-based resolution; user stays online
    // because the SDK can't prove they're stale.
    expect(latest).toBe('online');
  });
});
