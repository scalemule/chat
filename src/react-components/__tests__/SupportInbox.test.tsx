// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { SupportInbox } from '../SupportInbox';
import type { RepClient, SupportInboxItem } from '../../rep';

/**
 * Minimal RepClient mock for SupportInbox smoke tests.
 *
 * Only implements the methods SupportInbox actually calls:
 *  - getInbox({ status })
 *  - claimConversation(id)
 *  - updateConversationStatus(id, status)
 *  - chat.on(event, handler) — returns unsubscribe function
 */
function buildMockRepClient(initialItems: SupportInboxItem[] = []): RepClient {
  const getInbox = vi.fn(async () => ({ data: initialItems, error: null }));
  const claimConversation = vi.fn(async () => ({ data: null, error: null }));
  const updateConversationStatus = vi.fn(async () => ({ data: null, error: null }));
  const chat = {
    on: vi.fn(() => () => {
      /* unsubscribe */
    }),
  };

  return {
    getInbox,
    claimConversation,
    updateConversationStatus,
    chat,
  } as unknown as RepClient;
}

describe('SupportInbox', () => {
  it('renders the 3 tab labels on mount', () => {
    const repClient = buildMockRepClient();
    render(<SupportInbox repClient={repClient} />);
    expect(screen.getByText('Waiting')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Resolved')).toBeTruthy();
  });

  it('calls getInbox with the initial tab (waiting) on mount', async () => {
    const repClient = buildMockRepClient();
    render(<SupportInbox repClient={repClient} />);
    // getInbox is called in useEffect — wait a tick
    await Promise.resolve();
    expect(repClient.getInbox).toHaveBeenCalledWith({ status: 'waiting' });
  });

  it('switches tab when user clicks another label', async () => {
    const repClient = buildMockRepClient();
    render(<SupportInbox repClient={repClient} />);

    // Click the "Active" tab
    fireEvent.click(screen.getByText('Active'));
    await Promise.resolve();

    // getInbox should now have been called with status: 'active' as well
    expect(repClient.getInbox).toHaveBeenCalledWith({ status: 'active' });
  });

  it('subscribes to live update events from the chat client', () => {
    const repClient = buildMockRepClient();
    render(<SupportInbox repClient={repClient} />);

    // Should subscribe to all 3 inbox-updating events
    expect(repClient.chat.on).toHaveBeenCalledWith('support:new', expect.any(Function));
    expect(repClient.chat.on).toHaveBeenCalledWith('support:assigned', expect.any(Function));
    expect(repClient.chat.on).toHaveBeenCalledWith('inbox:update', expect.any(Function));
  });
});
