// @vitest-environment jsdom

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { __ChatContext, useChannels } from './react';

function createMockClient() {
  return {
    listChannels: vi.fn(async () => ({ data: [], error: null })),
    createChannel: vi.fn(),
    updateChannel: vi.fn(async () => ({
      data: {
        id: 'ch-1',
        conversation_type: 'channel',
        name: 'renamed',
        created_at: '2026-08-23T00:00:00Z',
      },
      error: null,
    })),
    joinChannel: vi.fn(),
    leaveChannel: vi.fn(),
    on: vi.fn(() => () => undefined),
  };
}

let latest: ReturnType<typeof useChannels> | null = null;

function Probe(): null {
  const state = useChannels();
  React.useEffect(() => {
    latest = state;
  });
  return null;
}

describe('useChannels', () => {
  it('exposes updateChannel and delegates a name-only rename to ChatClient', async () => {
    const client = createMockClient();
    render(
      <__ChatContext.Provider
        value={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          client: client as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: { baseUrl: 'x', apiKey: 'k' } as any,
        }}
      >
        <Probe />
      </__ChatContext.Provider>,
    );

    await waitFor(() => expect(latest?.isLoading).toBe(false));
    await act(async () => {
      await latest!.updateChannel('ch-1', { name: 'renamed' });
    });

    expect(client.updateChannel).toHaveBeenCalledWith('ch-1', { name: 'renamed' });
  });
});
