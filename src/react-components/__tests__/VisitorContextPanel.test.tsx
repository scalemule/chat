// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { VisitorContextPanel } from '../VisitorContextPanel';
import type { RepClient, SupportInboxItem } from '../../rep';

function buildItem(overrides: Partial<SupportInboxItem> = {}): SupportInboxItem {
  return {
    id: 'sup-1',
    conversation_id: 'conv-1',
    status: 'active',
    visitor_name: 'Jane Doe',
    visitor_email: 'jane@example.com',
    visitor_page_url: 'https://example.com/pricing',
    visitor_user_agent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    assigned_rep_name: 'Rep Smith',
    created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    ...overrides,
  };
}

function buildMockRepClient(items: SupportInboxItem[] = []): RepClient {
  const getInbox = vi.fn(async ({ status }: { status?: string }) => ({
    data: items.filter((it) => it.status === status),
    error: null,
  }));
  return {
    getInbox,
    chat: {
      on: vi.fn(() => () => {
        /* unsubscribe */
      }),
    },
  } as unknown as RepClient;
}

describe('VisitorContextPanel', () => {
  it('shows empty state when no conversation is selected', () => {
    const repClient = buildMockRepClient();
    render(<VisitorContextPanel repClient={repClient} conversationId={null} />);
    expect(
      screen.getByText(/Select a conversation to see visitor context/),
    ).toBeTruthy();
  });

  it('renders visitor identity from the initialItem prop', () => {
    const item = buildItem();
    const repClient = buildMockRepClient([item]);
    render(
      <VisitorContextPanel
        repClient={repClient}
        conversationId="conv-1"
        initialItem={item}
      />,
    );
    expect(screen.getByText('Jane Doe')).toBeTruthy();
    expect(screen.getByText('jane@example.com')).toBeTruthy();
  });

  it('fetches the inbox item when only conversationId is given', async () => {
    const item = buildItem();
    const repClient = buildMockRepClient([item]);

    render(
      <VisitorContextPanel
        repClient={repClient}
        conversationId="conv-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeTruthy();
    });
    // Should have called getInbox looking for the conversation
    expect(repClient.getInbox).toHaveBeenCalled();
  });

  it('subscribes to inbox:update live events', () => {
    const item = buildItem();
    const repClient = buildMockRepClient([item]);
    render(
      <VisitorContextPanel
        repClient={repClient}
        conversationId="conv-1"
        initialItem={item}
      />,
    );
    expect(repClient.chat.on).toHaveBeenCalledWith(
      'inbox:update',
      expect.any(Function),
    );
  });

  it('formats the page URL to hostname + path', () => {
    const item = buildItem({
      visitor_page_url: 'https://example.com/pricing?utm=x',
    });
    const repClient = buildMockRepClient([item]);
    render(
      <VisitorContextPanel
        repClient={repClient}
        conversationId="conv-1"
        initialItem={item}
      />,
    );
    // Should show "example.com/pricing" not the full URL with query
    expect(screen.getByText('example.com/pricing')).toBeTruthy();
  });

  it('summarizes the user agent into browser + OS', () => {
    const item = buildItem();
    const repClient = buildMockRepClient([item]);
    render(
      <VisitorContextPanel
        repClient={repClient}
        conversationId="conv-1"
        initialItem={item}
      />,
    );
    // Safari on macOS per the test UA string
    expect(screen.getByText(/Safari on macOS/)).toBeTruthy();
  });

  it('handles missing visitor fields gracefully', () => {
    const item = buildItem({
      visitor_name: undefined,
      visitor_email: undefined,
      visitor_page_url: undefined,
      visitor_user_agent: undefined,
    });
    const repClient = buildMockRepClient([item]);
    render(
      <VisitorContextPanel
        repClient={repClient}
        conversationId="conv-1"
        initialItem={item}
      />,
    );
    expect(screen.getByText('Anonymous visitor')).toBeTruthy();
    // Both the page and browser sections should show "Unknown" for missing data
    const unknowns = screen.getAllByText('Unknown');
    expect(unknowns.length).toBeGreaterThanOrEqual(2);
  });
});
