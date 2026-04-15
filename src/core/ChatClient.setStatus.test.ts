// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from './ChatClient';

function installMemoryStorage(): { store: Map<string, string>; restore: () => void } {
  const store = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    } as Storage,
  });
  return {
    store,
    restore: () => {
      if (original) Object.defineProperty(window, 'localStorage', original);
    },
  };
}

function makeClient(config: { applicationId?: string; userId?: string } = {}) {
  const client = new ChatClient({
    apiKey: 'k',
    apiBaseUrl: 'http://x',
    wsUrl: 'ws://x',
    ...config,
  });
  const sendSpy = vi.fn();
  const joinPresenceSpy = vi.fn();
  const leavePresenceSpy = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).ws = {
    send: sendSpy,
    joinPresence: joinPresenceSpy,
    leavePresence: leavePresenceSpy,
    on: () => () => {},
  };
  return { client, sendSpy, joinPresenceSpy, leavePresenceSpy };
}

let storage: ReturnType<typeof installMemoryStorage>;
beforeEach(() => {
  storage = installMemoryStorage();
});
afterEach(() => {
  storage.restore();
});

describe('ChatClient.setStatus / getStatus', () => {
  it('defaults to "active" when storage is empty', () => {
    const { client } = makeClient({ applicationId: 'app-1', userId: 'u-1' });
    expect(client.getStatus()).toBe('active');
  });

  it('seeds from storage on construction with a per-user scoped key', () => {
    storage.store.set(
      'sm-chat-self-status-v1:app-1:u-1',
      JSON.stringify('away'),
    );
    const { client } = makeClient({ applicationId: 'app-1', userId: 'u-1' });
    expect(client.getStatus()).toBe('away');
  });

  it('ignores storage when either applicationId or userId is missing', () => {
    storage.store.set(
      'sm-chat-self-status-v1:app-1:u-1',
      JSON.stringify('away'),
    );
    // Missing userId — should NOT read the scoped key.
    const { client } = makeClient({ applicationId: 'app-1' });
    expect(client.getStatus()).toBe('active');
  });

  it('persists + emits status:changed on setStatus', () => {
    const { client } = makeClient({ applicationId: 'app-1', userId: 'u-1' });
    const heard: Array<{ status: 'active' | 'away' }> = [];
    client.on('status:changed', (e) => heard.push(e));
    client.setStatus('away');
    expect(client.getStatus()).toBe('away');
    expect(heard).toEqual([{ status: 'away' }]);
    expect(storage.store.get('sm-chat-self-status-v1:app-1:u-1')).toBe(
      JSON.stringify('away'),
    );
  });

  it('is a no-op when setStatus is called with the current value', () => {
    const { client } = makeClient({ applicationId: 'app-1', userId: 'u-1' });
    const heard: Array<{ status: 'active' | 'away' }> = [];
    client.on('status:changed', (e) => heard.push(e));
    client.setStatus('active');
    expect(heard).toEqual([]);
  });

  it('broadcasts updatePresence for every joined presence conversation', () => {
    const { client, sendSpy } = makeClient({
      applicationId: 'app-1',
      userId: 'u-1',
    });
    client.joinPresence('c1');
    client.joinPresence('c2');
    sendSpy.mockClear();
    client.setStatus('away');
    const sent = sendSpy.mock.calls.map((c) => c[0]);
    const updates = sent.filter(
      (m) => (m as { type?: string }).type === 'presence_update',
    ) as Array<{ channel: string; status: string }>;
    expect(updates.map((u) => [u.channel, u.status]).sort()).toEqual([
      ['conversation:c1', 'away'],
      ['conversation:c2', 'away'],
    ]);
  });

  it('setStatus("active") broadcasts "online" to presence', () => {
    const { client, sendSpy } = makeClient({
      applicationId: 'app-1',
      userId: 'u-1',
    });
    client.setStatus('away'); // first move to away so we can come back
    client.joinPresence('c1');
    sendSpy.mockClear();
    client.setStatus('active');
    const updates = sendSpy.mock.calls
      .map((c) => c[0])
      .filter((m) => (m as { type?: string }).type === 'presence_update') as Array<{
      channel: string;
      status: string;
    }>;
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe('online');
  });

  it('does NOT pause or resume the WebSocket ping loop', () => {
    const { client, sendSpy } = makeClient({
      applicationId: 'app-1',
      userId: 'u-1',
    });
    // Stub ws has no ping methods; asserting the shape of send calls is
    // the closest we get. Key invariant: setStatus only emits
    // presence_update messages, never ping-affecting ones.
    client.joinPresence('c1');
    sendSpy.mockClear();
    client.setStatus('away');
    const types = sendSpy.mock.calls.map(
      (c) => (c[0] as { type?: string }).type,
    );
    expect(types.every((t) => t === 'presence_update')).toBe(true);
  });
});
