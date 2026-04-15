// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { Conversation } from '../../types';

const baseConv = {
  created_at: '2026-04-15T10:00:00.000Z',
  updated_at: '2026-04-15T10:00:00.000Z',
};

function mockConversations(conversations: Conversation[]): void {
  vi.doMock('../../react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../react')>();
    return {
      ...actual,
      useConversations: () => ({
        conversations,
        isLoading: false,
        refresh: vi.fn(),
      }),
      useMentionCounts: () => new Map<string, number>(),
    };
  });
}

describe('ConversationList — display name resolution', () => {
  it('renders "(you)" for a self-DM', async () => {
    vi.resetModules();
    mockConversations([
      {
        ...baseConv,
        id: 'self-dm',
        conversation_type: 'direct',
        participants: [{ user_id: 'me', role: 'member', joined_at: '' }],
      } as Conversation,
    ]);
    const { ConversationList } = await import('../ConversationList');
    render(
      <ConversationList
        currentUserId="me"
        profiles={new Map([['me', { display_name: 'Plamen' }]])}
      />,
    );
    expect(screen.getByText('Plamen (you)')).toBeTruthy();
  });

  it('honors a custom selfLabel', async () => {
    vi.resetModules();
    mockConversations([
      {
        ...baseConv,
        id: 'self-dm',
        conversation_type: 'direct',
        participants: [{ user_id: 'me', role: 'member', joined_at: '' }],
      } as Conversation,
    ]);
    const { ConversationList } = await import('../ConversationList');
    render(
      <ConversationList
        currentUserId="me"
        profiles={new Map([['me', { display_name: 'Plamen' }]])}
        selfLabel="— Saved"
      />,
    );
    expect(screen.getByText('Plamen — Saved')).toBeTruthy();
  });

  it('builds a default group name from participants when unnamed', async () => {
    vi.resetModules();
    mockConversations([
      {
        ...baseConv,
        id: 'g1',
        conversation_type: 'group',
        participants: [
          { user_id: 'me', role: 'member', joined_at: '' },
          { user_id: 'u1', role: 'member', joined_at: '' },
          { user_id: 'u2', role: 'member', joined_at: '' },
          { user_id: 'u3', role: 'member', joined_at: '' },
        ],
      } as Conversation,
    ]);
    const { ConversationList } = await import('../ConversationList');
    render(
      <ConversationList
        currentUserId="me"
        profiles={
          new Map([
            ['u1', { display_name: 'Alice' }],
            ['u2', { display_name: 'Bob' }],
            ['u3', { display_name: 'Carol' }],
          ])
        }
      />,
    );
    expect(screen.getByText('Alice, Bob, and 1 other')).toBeTruthy();
  });

  it('honors formatGroupName override', async () => {
    vi.resetModules();
    mockConversations([
      {
        ...baseConv,
        id: 'g1',
        conversation_type: 'group',
        participants: [
          { user_id: 'me', role: 'member', joined_at: '' },
          { user_id: 'u1', role: 'member', joined_at: '' },
          { user_id: 'u2', role: 'member', joined_at: '' },
        ],
      } as Conversation,
    ]);
    const { ConversationList } = await import('../ConversationList');
    render(
      <ConversationList
        currentUserId="me"
        profiles={
          new Map([
            ['u1', { display_name: 'Alice' }],
            ['u2', { display_name: 'Bob' }],
          ])
        }
        formatGroupName={(names) => `${names.length} people`}
      />,
    );
    expect(screen.getByText('2 people')).toBeTruthy();
  });

  it('preserves conversation.name for named channels', async () => {
    vi.resetModules();
    mockConversations([
      {
        ...baseConv,
        id: 'ch1',
        conversation_type: 'channel',
        name: 'announcements',
        participants: [
          { user_id: 'me', role: 'member', joined_at: '' },
          { user_id: 'u1', role: 'member', joined_at: '' },
        ],
      } as Conversation,
    ]);
    const { ConversationList } = await import('../ConversationList');
    render(
      <ConversationList
        currentUserId="me"
        profiles={new Map([['u1', { display_name: 'Alice' }]])}
      />,
    );
    // "announcements" appears both as the row title and (because there's
    // no last_message_preview) in the preview line — assert that at least
    // one match exists.
    expect(screen.getAllByText('announcements').length).toBeGreaterThan(0);
  });
});
