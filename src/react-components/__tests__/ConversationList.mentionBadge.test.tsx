// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { Conversation } from '../../types';

function setup(
  conversations: Conversation[],
  mentionCounts: Map<string, number> = new Map(),
): void {
  vi.doMock('../../react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../react')>();
    return {
      ...actual,
      useConversations: () => ({
        conversations,
        isLoading: false,
        refresh: vi.fn(),
      }),
      useMentionCounts: () => mentionCounts,
    };
  });
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

const baseConv = {
  created_at: '2026-04-15T10:00:00.000Z',
  updated_at: '2026-04-15T10:00:00.000Z',
};

describe('ConversationList — mention badge', () => {
  it('renders @N badge when mention_count is set server-side', async () => {
    setup([
      {
        ...baseConv,
        id: 'c1',
        conversation_type: 'channel',
        name: 'general',
        mention_count: 3,
      } as Conversation,
    ]);
    const { ConversationList } = await import('../ConversationList');
    render(<ConversationList />);
    expect(screen.getByText('@3')).toBeTruthy();
  });

  it('sums the server hint with the live hook overlay', async () => {
    setup(
      [
        {
          ...baseConv,
          id: 'c1',
          conversation_type: 'channel',
          name: 'general',
          mention_count: 2,
        } as Conversation,
      ],
      new Map([['c1', 4]]),
    );
    const { ConversationList } = await import('../ConversationList');
    render(<ConversationList currentUserId="me" />);
    expect(screen.getByText('@6')).toBeTruthy();
  });

  it('hides the badge when the count is 0', async () => {
    setup([
      {
        ...baseConv,
        id: 'c1',
        conversation_type: 'channel',
        name: 'general',
      } as Conversation,
    ]);
    const { ConversationList } = await import('../ConversationList');
    const { container } = render(<ConversationList />);
    expect(container.querySelector('.sm-mention-badge')).toBeNull();
  });

  it('suppresses the badge entirely when showMentionBadge=false', async () => {
    setup([
      {
        ...baseConv,
        id: 'c1',
        conversation_type: 'channel',
        name: 'general',
        mention_count: 5,
      } as Conversation,
    ]);
    const { ConversationList } = await import('../ConversationList');
    const { container } = render(
      <ConversationList showMentionBadge={false} />,
    );
    expect(container.querySelector('.sm-mention-badge')).toBeNull();
    expect(screen.queryByText('@5')).toBeNull();
  });

  it('honors the caller-supplied mentionCounts prop (overrides the hook)', async () => {
    setup(
      [
        {
          ...baseConv,
          id: 'c1',
          conversation_type: 'channel',
          name: 'general',
        } as Conversation,
      ],
      // The (mocked) hook would return 99; the prop wins.
      new Map([['c1', 99]]),
    );
    const { ConversationList } = await import('../ConversationList');
    render(
      <ConversationList mentionCounts={new Map([['c1', 2]])} />,
    );
    expect(screen.getByText('@2')).toBeTruthy();
  });

  it('uses singular "mention" in the aria-label for count=1', async () => {
    setup([
      {
        ...baseConv,
        id: 'c1',
        conversation_type: 'channel',
        name: 'general',
        mention_count: 1,
      } as Conversation,
    ]);
    const { ConversationList } = await import('../ConversationList');
    const { container } = render(<ConversationList />);
    const badge = container.querySelector('.sm-mention-badge');
    expect(badge?.getAttribute('aria-label')).toBe('1 unread mention');
  });
});
