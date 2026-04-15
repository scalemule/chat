// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { ChatContext } from './shared/ChatContext';
import { useConnectionStatus } from './react';
import type { ConnectionStatus } from './types';

type Listener = (payload: unknown) => void;

function createMockClient(initial: ConnectionStatus) {
  const listeners = new Map<string, Set<Listener>>();
  return {
    status: initial,
    connect: vi.fn(),
    disconnect: vi.fn(),
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
  currentClient = createMockClient('connected');
});

let latest: ReturnType<typeof useConnectionStatus> | null = null;
function Probe(): null {
  const s = useConnectionStatus();
  React.useEffect(() => {
    latest = s;
  });
  return null;
}

function renderWith(status: ConnectionStatus) {
  currentClient = createMockClient(status);
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

describe('useConnectionStatus', () => {
  it('returns isOnline=true when connected', () => {
    renderWith('connected');
    expect(latest).toEqual({
      status: 'connected',
      isOnline: true,
      isReconnecting: false,
    });
  });

  it('returns isReconnecting=true while reconnecting', () => {
    renderWith('reconnecting');
    expect(latest).toEqual({
      status: 'reconnecting',
      isOnline: false,
      isReconnecting: true,
    });
  });

  it('returns isOnline=false when disconnected', () => {
    renderWith('disconnected');
    expect(latest).toEqual({
      status: 'disconnected',
      isOnline: false,
      isReconnecting: false,
    });
  });
});
