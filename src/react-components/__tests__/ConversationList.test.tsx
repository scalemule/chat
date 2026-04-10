// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const conversations = [
  {
    id: 'conv-1',
    conversation_type: 'direct',
    name: 'Alice',
    counterparty_user_id: 'user-2',
    last_message_preview: 'Hey there',
    last_message_at: '2026-04-10T10:00:00.000Z',
    unread_count: 2,
    created_at: '2026-04-10T09:00:00.000Z',
    updated_at: '2026-04-10T10:00:00.000Z',
  },
  {
    id: 'conv-2',
    conversation_type: 'group',
    name: 'Project Team',
    last_message_preview: 'Sounds good',
    last_message_at: '2026-04-10T09:30:00.000Z',
    unread_count: 0,
    created_at: '2026-04-10T08:00:00.000Z',
    updated_at: '2026-04-10T09:30:00.000Z',
  },
];

vi.mock('../../react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../react')>();
  return {
    ...actual,
    useConversations: () => ({
      conversations,
      isLoading: false,
      refresh: vi.fn(),
    }),
  };
});

import { ConversationList } from '../ConversationList';

describe('ConversationList', () => {
  it('renders conversations from the hook', () => {
    render(<ConversationList />);
    expect(screen.getByText(/Alice/)).toBeTruthy();
    expect(screen.getByText(/Project Team/)).toBeTruthy();
  });

  it('calls onSelect with the conversation when clicked', () => {
    const onSelect = vi.fn();
    render(<ConversationList onSelect={onSelect} />);
    fireEvent.click(screen.getByText(/Alice/));
    expect(onSelect).toHaveBeenCalled();
    const selectedConv = onSelect.mock.calls[0][0];
    expect(selectedConv.id).toBe('conv-1');
  });

  it('shows the last message preview', () => {
    render(<ConversationList />);
    expect(screen.getByText(/Hey there/)).toBeTruthy();
    expect(screen.getByText(/Sounds good/)).toBeTruthy();
  });
});
