// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

import { ChatContext } from './shared/ChatContext';
import { useMyStatus } from './react';

type Listener = (payload: unknown) => void;

function createMockClient(initial: 'active' | 'away' = 'active') {
  const listeners = new Map<string, Set<Listener>>();
  let status: 'active' | 'away' = initial;
  return {
    getStatus(): 'active' | 'away' {
      return status;
    },
    setStatus(next: 'active' | 'away'): void {
      if (status === next) return;
      status = next;
      listeners.get('status:changed')?.forEach((cb) => cb({ status: next }));
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
  };
}

let currentClient: ReturnType<typeof createMockClient>;
beforeEach(() => {
  currentClient = createMockClient();
});

let latest: ReturnType<typeof useMyStatus> | null = null;
function Probe(): null {
  const s = useMyStatus();
  React.useEffect(() => {
    latest = s;
  });
  return null;
}

function renderHook() {
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
      React.createElement(Probe),
    ),
  );
}

describe('useMyStatus', () => {
  it('seeds from ChatClient.getStatus()', () => {
    currentClient = createMockClient('away');
    renderHook();
    expect(latest?.status).toBe('away');
  });

  it('setStatus delegates to ChatClient and triggers re-render via status:changed', () => {
    const spy = vi.spyOn(currentClient, 'setStatus');
    renderHook();
    expect(latest?.status).toBe('active');
    act(() => {
      latest!.setStatus('away');
    });
    expect(spy).toHaveBeenCalledWith('away');
    expect(latest?.status).toBe('away');
  });

  it('subscribes to status:changed events from other call sites', () => {
    renderHook();
    expect(latest?.status).toBe('active');
    act(() => {
      // Another part of the app calls setStatus — the hook should update.
      currentClient.setStatus('away');
    });
    expect(latest?.status).toBe('away');
  });
});
