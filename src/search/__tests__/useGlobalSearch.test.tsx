// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';

import { ChatContext } from '../../shared/ChatContext';
import { useGlobalSearch, type GlobalSearch } from '../useGlobalSearch';
import type { ChatSearchResult, Conversation } from '../../types';

function msg(id: string, createdAt: string): ChatSearchResult {
  return {
    message: {
      id,
      content: id,
      message_type: 'text',
      sender_id: 'u1',
      is_edited: false,
      created_at: createdAt,
    } as unknown as ChatSearchResult['message'],
    score: 1,
    highlights: [`<em>${id}</em>`],
  };
}

interface SearchCall {
  conversationId: string;
  query: string;
}

function createMockClient() {
  const calls: SearchCall[] = [];
  const handlers = new Map<
    string,
    (callIndex: number) => Promise<{
      data?: { results: ChatSearchResult[]; total: number; query: string };
      error?: { message: string };
    }>
  >();
  return {
    calls,
    on: () => () => {},
    emit: () => {},
    /** Register the stubbed response for a given conversation id. */
    whenSearch(
      conversationId: string,
      fn: (
        callIndex: number,
      ) => Promise<{
        data?: { results: ChatSearchResult[]; total: number; query: string };
        error?: { message: string };
      }>,
    ) {
      handlers.set(conversationId, fn);
    },
    async searchMessages(
      conversationId: string,
      query: string,
    ): Promise<{
      data?: { results: ChatSearchResult[]; total: number; query: string };
      error?: { message: string };
    }> {
      calls.push({ conversationId, query });
      const fn = handlers.get(conversationId);
      if (!fn) {
        return { data: { results: [], total: 0, query } };
      }
      return fn(calls.length - 1);
    },
  };
}

let currentClient: ReturnType<typeof createMockClient>;
beforeEach(() => {
  currentClient = createMockClient();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

interface ProbeProps {
  query: string;
  opts?: Parameters<typeof useGlobalSearch>[1];
}

let latest: GlobalSearch | null = null;
function Probe({ query, opts }: ProbeProps): null {
  const state = useGlobalSearch(query, opts);
  React.useEffect(() => {
    latest = state;
  });
  return null;
}

function renderHook(props: ProbeProps) {
  latest = null;
  return render(
    <ChatContext.Provider
      value={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: currentClient as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: { baseUrl: 'x', apiKey: 'k' } as any,
      }}
    >
      <Probe {...props} />
    </ChatContext.Provider>,
  );
}

async function flushDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe('useGlobalSearch', () => {
  it('surfaces an error when neither conversations nor conversationIds is provided', async () => {
    renderHook({ query: 'hello' });
    await flushDebounce();
    expect(latest!.errors).toHaveLength(1);
    expect(latest!.errors[0].message).toMatch(/requires `conversations`/);
    expect(latest!.results).toEqual([]);
    expect(currentClient.calls).toEqual([]);
  });

  it('fans out one searchMessages call per conversation id', async () => {
    currentClient.whenSearch('c1', async () => ({
      data: { results: [msg('m1', '2026-04-15T10:00:00.000Z')], total: 1, query: 'hi' },
    }));
    currentClient.whenSearch('c2', async () => ({
      data: { results: [msg('m2', '2026-04-15T10:05:00.000Z')], total: 1, query: 'hi' },
    }));
    renderHook({ query: 'hi', opts: { conversationIds: ['c1', 'c2'] } });
    await flushDebounce();
    expect(currentClient.calls.map((c) => c.conversationId).sort()).toEqual(['c1', 'c2']);
    expect(latest!.results).toHaveLength(2);
    // Sorted newest-first by message.created_at.
    expect(latest!.results[0].message.id).toBe('m2');
    expect(latest!.results[1].message.id).toBe('m1');
  });

  it('annotates results with conversation when conversations is provided', async () => {
    const conversations: Conversation[] = [
      {
        id: 'c1',
        conversation_type: 'channel',
        created_at: '2026-04-10T00:00:00.000Z',
        name: 'general',
      },
    ];
    currentClient.whenSearch('c1', async () => ({
      data: { results: [msg('m1', '2026-04-15T10:00:00.000Z')], total: 1, query: 'x' },
    }));
    renderHook({ query: 'x', opts: { conversations } });
    await flushDebounce();
    expect(latest!.results[0].conversationId).toBe('c1');
    expect(latest!.results[0].conversation?.name).toBe('general');
  });

  it('captures per-conversation errors without dropping other results', async () => {
    currentClient.whenSearch('c1', async () => ({
      data: { results: [msg('m1', '2026-04-15T10:00:00.000Z')], total: 1, query: 'q' },
    }));
    currentClient.whenSearch('c2', async () => ({
      error: { message: 'index unavailable' },
    }));
    renderHook({ query: 'q', opts: { conversationIds: ['c1', 'c2'] } });
    await flushDebounce();
    expect(latest!.results.map((r) => r.conversationId)).toEqual(['c1']);
    expect(latest!.errors).toEqual([
      { conversationId: 'c2', message: 'index unavailable' },
    ]);
  });

  it('respects the concurrency cap (no more than N in flight at once)', async () => {
    const inFlight = { current: 0, peak: 0 };
    for (const id of ['c1', 'c2', 'c3', 'c4']) {
      currentClient.whenSearch(id, async () => {
        inFlight.current++;
        inFlight.peak = Math.max(inFlight.peak, inFlight.current);
        await new Promise((r) => setTimeout(r, 50));
        inFlight.current--;
        return { data: { results: [], total: 0, query: 'z' } };
      });
    }
    renderHook({
      query: 'z',
      opts: {
        conversationIds: ['c1', 'c2', 'c3', 'c4'],
        concurrency: 2,
        debounceMs: 0,
      },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(inFlight.peak).toBeLessThanOrEqual(2);
  });

  it('discards stale results when the query changes before results return', async () => {
    // Real timers for this test — fake timers interfere with waitFor.
    vi.useRealTimers();
    let resolveFirst!: () => void;
    currentClient.whenSearch('c1', async () => {
      return new Promise((r) => {
        resolveFirst = () =>
          r({ data: { results: [msg('STALE', '2026-04-15T10:00:00.000Z')], total: 1, query: 'old' } });
      });
    });

    const { rerender } = renderHook({
      query: 'old',
      opts: { conversationIds: ['c1'], debounceMs: 0 },
    });
    // Let the first fan-out start and hit the mock.
    await new Promise((r) => setTimeout(r, 20));

    // Swap the handler so the "new" query yields a different result set.
    currentClient.whenSearch('c1', async () => ({
      data: { results: [msg('FRESH', '2026-04-15T11:00:00.000Z')], total: 1, query: 'new' },
    }));

    rerender(
      <ChatContext.Provider
        value={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          client: currentClient as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: { baseUrl: 'x', apiKey: 'k' } as any,
        }}
      >
        <Probe query="new" opts={{ conversationIds: ['c1'], debounceMs: 0 }} />
      </ChatContext.Provider>,
    );
    // Release the first (stale) search now that the sequence has advanced.
    resolveFirst();
    await waitFor(() => {
      expect(latest!.results.map((r) => r.message.id)).toContain('FRESH');
    });
    expect(latest!.results.map((r) => r.message.id)).not.toContain('STALE');
  });

  it('empty/whitespace query clears results and skips the fan-out', async () => {
    renderHook({ query: '  ', opts: { conversationIds: ['c1'] } });
    await flushDebounce();
    expect(latest!.results).toEqual([]);
    expect(latest!.errors).toEqual([]);
    expect(currentClient.calls).toEqual([]);
  });

  it('refetch re-runs the fan-out for the current query', async () => {
    currentClient.whenSearch('c1', async () => ({
      data: { results: [msg('m1', '2026-04-15T10:00:00.000Z')], total: 1, query: 'q' },
    }));
    renderHook({ query: 'q', opts: { conversationIds: ['c1'] } });
    await flushDebounce();
    expect(currentClient.calls.length).toBe(1);
    act(() => {
      latest!.refetch();
    });
    await flushDebounce();
    expect(currentClient.calls.length).toBe(2);
  });
});
