// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';

import { useMentionCounts, __ChatContext } from './react';
import type { ChatMessage } from './types';

type Listener = (payload: unknown) => void;

function createMockClient() {
  const listeners = new Map<string, Set<Listener>>();
  return {
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

function buildMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'm',
    content: '',
    message_type: 'text',
    sender_id: 'x',
    is_edited: false,
    created_at: '2026-04-15T10:00:00.000Z',
    ...overrides,
  } as ChatMessage;
}

function Probe({
  currentUserId,
  onCounts,
}: {
  currentUserId?: string;
  onCounts: (counts: Map<string, number>) => void;
}): null {
  const counts = useMentionCounts(currentUserId);
  React.useEffect(() => {
    onCounts(counts);
  });
  return null;
}

function renderHook(currentUserId: string | undefined) {
  let latest: Map<string, number> = new Map();
  const onCounts = (c: Map<string, number>) => {
    latest = c;
  };
  render(
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
      React.createElement(Probe, { currentUserId, onCounts }),
    ),
  );
  return {
    get counts() {
      return latest;
    },
  };
}

beforeEach(() => {
  currentClient = createMockClient();
});

describe('useMentionCounts', () => {
  it('returns an empty map when currentUserId is undefined', () => {
    const hook = renderHook(undefined);
    expect(hook.counts.size).toBe(0);
  });

  it('increments when an incoming message mentions the current user', () => {
    const hook = renderHook('user-me');
    expect(hook.counts.get('conv-1') ?? 0).toBe(0);

    act(() => {
      currentClient.emit('message', {
        message: buildMessage({
          content:
            'hey <span class="sm-mention" data-sm-user-id="user-me">@me</span>',
          sender_id: 'user-other',
        }),
        conversationId: 'conv-1',
      });
    });
    expect(hook.counts.get('conv-1')).toBe(1);

    act(() => {
      currentClient.emit('message', {
        message: buildMessage({
          content:
            '<span class="sm-mention" data-sm-user-id="user-me">@me</span>',
          sender_id: 'user-other',
        }),
        conversationId: 'conv-1',
      });
    });
    expect(hook.counts.get('conv-1')).toBe(2);
  });

  it('does not increment when the current user is the sender', () => {
    const hook = renderHook('user-me');
    act(() => {
      currentClient.emit('message', {
        message: buildMessage({
          content:
            '<span class="sm-mention" data-sm-user-id="user-me">@me</span>',
          sender_id: 'user-me',
        }),
        conversationId: 'conv-1',
      });
    });
    expect(hook.counts.get('conv-1') ?? 0).toBe(0);
  });

  it('does not increment when the message mentions a different user', () => {
    const hook = renderHook('user-me');
    act(() => {
      currentClient.emit('message', {
        message: buildMessage({
          content:
            '<span class="sm-mention" data-sm-user-id="user-other">@other</span>',
          sender_id: 'user-third',
        }),
        conversationId: 'conv-1',
      });
    });
    expect(hook.counts.get('conv-1') ?? 0).toBe(0);
  });

  it('clears the count on a read event for the current user', () => {
    const hook = renderHook('user-me');
    act(() => {
      currentClient.emit('message', {
        message: buildMessage({
          content:
            '<span class="sm-mention" data-sm-user-id="user-me">@me</span>',
          sender_id: 'user-other',
        }),
        conversationId: 'conv-1',
      });
    });
    expect(hook.counts.get('conv-1')).toBe(1);

    act(() => {
      currentClient.emit('read', {
        userId: 'user-me',
        conversationId: 'conv-1',
        lastReadAt: '2026-04-15T10:01:00.000Z',
      });
    });
    expect(hook.counts.has('conv-1')).toBe(false);
  });

  it('ignores read events for other users', () => {
    const hook = renderHook('user-me');
    act(() => {
      currentClient.emit('message', {
        message: buildMessage({
          content:
            '<span class="sm-mention" data-sm-user-id="user-me">@me</span>',
          sender_id: 'user-other',
        }),
        conversationId: 'conv-1',
      });
    });
    expect(hook.counts.get('conv-1')).toBe(1);

    act(() => {
      currentClient.emit('read', {
        userId: 'user-other',
        conversationId: 'conv-1',
        lastReadAt: '2026-04-15T10:01:00.000Z',
      });
    });
    expect(hook.counts.get('conv-1')).toBe(1);
  });

  it('tracks counts independently per conversation', () => {
    const hook = renderHook('user-me');
    act(() => {
      currentClient.emit('message', {
        message: buildMessage({
          content:
            '<span class="sm-mention" data-sm-user-id="user-me">@me</span>',
          sender_id: 'x',
        }),
        conversationId: 'conv-a',
      });
      currentClient.emit('message', {
        message: buildMessage({
          content:
            '<span class="sm-mention" data-sm-user-id="user-me">@me</span>',
          sender_id: 'x',
        }),
        conversationId: 'conv-b',
      });
    });
    expect(hook.counts.get('conv-a')).toBe(1);
    expect(hook.counts.get('conv-b')).toBe(1);

    act(() => {
      currentClient.emit('read', {
        userId: 'user-me',
        conversationId: 'conv-a',
        lastReadAt: '2026-04-15T10:01:00.000Z',
      });
    });
    expect(hook.counts.has('conv-a')).toBe(false);
    expect(hook.counts.get('conv-b')).toBe(1);
  });
});
