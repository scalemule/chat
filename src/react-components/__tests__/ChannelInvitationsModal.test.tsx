// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { __ChatContext } from '../../react';
import { ChannelInvitationsModal } from '../ChannelInvitationsModal';
import type { ChannelInvitation } from '../../types';

function inv(id: string, name: string): ChannelInvitation {
  return {
    id,
    channel_id: 'ch-' + id,
    channel_name: name,
    invited_by: 'u-inviter',
    invited_by_display_name: 'Alice',
    created_at: '2026-04-15T10:00:00.000Z',
  };
}

function buildClient(seed: ChannelInvitation[]) {
  type Listener = (p: unknown) => void;
  const listeners = new Map<string, Set<Listener>>();
  return {
    listChannelInvitations: vi.fn(async () => ({ data: seed, error: null })),
    acceptChannelInvitation: vi.fn(async () => ({
      data: { channel_id: 'ch-i1' },
      error: null,
    })),
    rejectChannelInvitation: vi.fn(async () => ({ data: undefined, error: null })),
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

function renderModal(
  client: ReturnType<typeof buildClient>,
  props: Partial<React.ComponentProps<typeof ChannelInvitationsModal>> = {},
) {
  return render(
    <__ChatContext.Provider
      value={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: { baseUrl: 'x', apiKey: 'k' } as any,
      }}
    >
      <ChannelInvitationsModal
        open
        onClose={vi.fn()}
        {...props}
      />
    </__ChatContext.Provider>,
  );
}

describe('ChannelInvitationsModal', () => {
  it('renders nothing when open=false', () => {
    const client = buildClient([]);
    const { container } = render(
      <__ChatContext.Provider
        value={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          client: client as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: { baseUrl: 'x', apiKey: 'k' } as any,
        }}
      >
        <ChannelInvitationsModal open={false} onClose={vi.fn()} />
      </__ChatContext.Provider>,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('lists pending invitations from the hook', async () => {
    const client = buildClient([inv('i1', 'general'), inv('i2', 'random')]);
    renderModal(client);
    await waitFor(() => {
      expect(screen.getByText(/general/)).toBeTruthy();
      expect(screen.getByText(/random/)).toBeTruthy();
    });
  });

  it('shows empty state when no invitations', async () => {
    const client = buildClient([]);
    renderModal(client);
    await waitFor(() => {
      expect(screen.getByText('No pending invitations')).toBeTruthy();
    });
  });

  it('Accept calls the client and removes the row', async () => {
    const client = buildClient([inv('i1', 'general')]);
    const onAccepted = vi.fn();
    renderModal(client, { onAccepted });
    await waitFor(() => screen.getByText(/general/));
    fireEvent.click(screen.getByText('Accept'));
    await waitFor(() => {
      expect(client.acceptChannelInvitation).toHaveBeenCalledWith('i1');
    });
    expect(onAccepted).toHaveBeenCalled();
    expect(screen.queryByText(/general/)).toBeNull();
  });

  it('Reject calls the client and removes the row', async () => {
    const client = buildClient([inv('i1', 'general')]);
    renderModal(client);
    await waitFor(() => screen.getByText(/general/));
    fireEvent.click(screen.getByText('Reject'));
    await waitFor(() => {
      expect(client.rejectChannelInvitation).toHaveBeenCalledWith('i1');
    });
    expect(screen.queryByText(/general/)).toBeNull();
  });

  it('Escape calls onClose', async () => {
    const client = buildClient([inv('i1', 'general')]);
    const onClose = vi.fn();
    const { container } = renderModal(client, { onClose });
    await waitFor(() => screen.getByText(/general/));
    fireEvent.keyDown(container.querySelector('[role="dialog"]')!, {
      key: 'Escape',
    });
    expect(onClose).toHaveBeenCalled();
  });
});
