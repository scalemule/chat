import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from './ChatClient';
import type { ChatMessage } from '../types';

function createClient(): ChatClient {
  return new ChatClient({
    apiBaseUrl: 'https://api.test/chat',
    userId: 'user-1',
    applicationId: 'app-1',
  });
}

describe('ChatClient.sendMessage — optimistic', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does NOT stage a row when { optimistic: false } (back-compat default)', async () => {
    const client = createClient();
    const conv = 'conv-a';
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'server-1',
          conversation_id: conv,
          content: 'hi',
          message_type: 'text',
          sender_id: 'user-1',
          is_edited: false,
          created_at: '2026-04-17T00:00:00Z',
        }),
      },
    );

    const listener = vi.fn();
    client.on('message', listener);

    await client.sendMessage(conv, { content: 'hi' });

    // No optimistic staging path → listener only fires via the WS
    // 'new_message' handler, which this test doesn't trigger. Cache
    // still gets the server row (the existing non-optimistic path).
    expect(listener).not.toHaveBeenCalled();
    expect(client.getCachedMessages(conv).map((m) => m.id)).toEqual([
      'server-1',
    ]);
  });

  it('stages a pending row + emits before the POST when optimistic: true', async () => {
    const client = createClient();
    const conv = 'conv-b';
    let resolveFetch: ((value: unknown) => void) | null = null;
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const listener = vi.fn();
    client.on('message', listener);

    const pending = client.sendMessage(conv, {
      content: 'hi',
      optimistic: true,
    });

    // Before the network resolves, the cache already shows the pending row.
    const staged = client.getCachedMessages(conv);
    expect(staged).toHaveLength(1);
    expect(staged[0].id.startsWith('pending-')).toBe(true);
    expect(staged[0].is_pending).toBe(true);
    expect(staged[0].is_failed).toBeFalsy();
    expect(staged[0].sender_id).toBe('user-1');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].message.id).toBe(staged[0].id);

    // Complete the network with a server row.
    resolveFetch!({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'server-2',
        conversation_id: conv,
        content: 'hi',
        message_type: 'text',
        sender_id: 'user-1',
        is_edited: false,
        created_at: '2026-04-17T00:00:00Z',
      }),
    });
    await pending;

    // Reconciliation replaces the pending row with the real one.
    const after = client.getCachedMessages(conv);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe('server-2');
    // Second emit — the confirmed message.
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].message.id).toBe('server-2');
  });

  it('marks the staged row is_failed and emits message:updated on HTTP error', async () => {
    const client = createClient();
    const conv = 'conv-c';
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        ok: false,
        status: 500,
        json: async () => ({ message: 'boom', code: 'internal_error' }),
      },
    );

    const failureListener = vi.fn();
    client.on('message:updated', failureListener);

    await client.sendMessage(conv, { content: 'hi', optimistic: true });

    const msgs = client.getCachedMessages(conv);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].is_pending).toBe(false);
    expect(msgs[0].is_failed).toBe(true);
    expect(failureListener).toHaveBeenCalledTimes(1);
  });

  it('leaves the pending row in place on network error (offline queue takes over)', async () => {
    const client = createClient();
    const conv = 'conv-d';
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError('network down'),
    );

    await client.sendMessage(conv, { content: 'hi', optimistic: true });

    const msgs = client.getCachedMessages(conv);
    expect(msgs).toHaveLength(1);
    // Network error path keeps is_pending=true (no failed marker) —
    // the offline queue will retry later.
    expect(msgs[0].is_pending).toBe(true);
    expect(msgs[0].is_failed).toBeFalsy();
  });
});

describe('ChatClient.retryMessage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('clears is_failed, sets is_pending, and re-POSTs with the same payload', async () => {
    const client = createClient();
    const conv = 'conv-r';
    // First POST fails.
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      { ok: false, status: 500, json: async () => ({ message: 'boom' }) },
    );
    // Retry POST succeeds.
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'server-r',
          conversation_id: conv,
          content: 'retry me',
          message_type: 'text',
          sender_id: 'user-1',
          is_edited: false,
          created_at: '2026-04-17T00:00:00Z',
        }),
      },
    );

    await client.sendMessage(conv, { content: 'retry me', optimistic: true });
    const failed = client.getCachedMessages(conv)[0];
    expect(failed.is_failed).toBe(true);

    const updateListener = vi.fn();
    client.on('message:updated', updateListener);

    const result = await client.retryMessage(conv, failed.id);
    expect(result?.data?.id).toBe('server-r');

    const after = client.getCachedMessages(conv);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe('server-r');
    // First emit: is_failed → is_pending transition (before the POST).
    expect(updateListener).toHaveBeenCalled();
  });

  it('returns undefined when the id does not match a failed row', async () => {
    const client = createClient();
    const conv = 'conv-r2';
    const result = await client.retryMessage(conv, 'pending-nonexistent');
    expect(result).toBeUndefined();
  });
});

describe('ChatClient.dismissMessage', () => {
  it('removes the row from the cache and emits message:deleted', () => {
    const client = createClient();
    const conv = 'conv-d';
    const staged: ChatMessage = {
      id: 'pending-1',
      content: 'x',
      message_type: 'text',
      sender_id: 'user-1',
      is_edited: false,
      created_at: '2026-04-17T00:00:00Z',
      is_failed: true,
    };
    client.stageOptimisticMessage(conv, staged);
    expect(client.getCachedMessages(conv)).toHaveLength(1);

    const listener = vi.fn();
    client.on('message:deleted', listener);

    const dismissed = client.dismissMessage(conv, 'pending-1');
    expect(dismissed).toBe(true);
    expect(client.getCachedMessages(conv)).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns false when the id does not exist', () => {
    const client = createClient();
    expect(client.dismissMessage('conv-x', 'nope')).toBe(false);
  });
});
