// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const sendMessage = vi.fn(async () => undefined);
const loadMore = vi.fn();
const editMessage = vi.fn(async () => undefined);
const deleteMessage = vi.fn(async () => undefined);
const addReaction = vi.fn(async () => undefined);
const removeReaction = vi.fn(async () => undefined);
const sendTyping = vi.fn();
const markRead = vi.fn();
const reportMessage = vi.fn(async () => undefined);
const uploadAttachment = vi.fn(async () => ({ data: null, error: null }));

const mockChatClient = {
  userId: 'user-1',
  on: vi.fn(() => () => {}),
  destroy: vi.fn(),
} as any;

const chatState = {
  messages: [
    {
      id: 'msg-1',
      conversation_id: 'conv-1',
      sender_id: 'user-2',
      sender_type: 'human',
      content: 'Hello from ChatThread test',
      message_type: 'text',
      attachments: [],
      reactions: [],
      is_edited: false,
      is_deleted: false,
      created_at: '2026-04-10T10:00:00.000Z',
      updated_at: '2026-04-10T10:00:00.000Z',
    },
  ],
  readStatuses: [] as Array<{ user_id: string; last_read_at?: string }>,
  isLoading: false,
  error: null as string | null,
  hasMore: false,
};

vi.mock('../../react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../react')>();
  return {
    ...actual,
    useChatClient: () => mockChatClient,
    useChat: () => ({
      messages: chatState.messages,
      readStatuses: chatState.readStatuses,
      isLoading: chatState.isLoading,
      error: chatState.error,
      hasMore: chatState.hasMore,
      sendMessage,
      loadMore,
      markRead,
      editMessage,
      deleteMessage,
      addReaction,
      removeReaction,
      reportMessage,
      uploadAttachment,
    }),
    useTyping: () => ({
      typingUsers: [] as string[],
      sendTyping,
    }),
    usePresence: () => ({
      members: [] as Array<{ userId: string; status: string }>,
    }),
  };
});

import { ChatThread } from '../ChatThread';

describe('ChatThread', () => {
  it('renders messages from useChat without crashing', () => {
    const { container } = render(<ChatThread conversationId="conv-1" />);
    expect(container.textContent).toContain('Hello from ChatThread test');
  });

  it('accepts a currentUserId prop', () => {
    render(<ChatThread conversationId="conv-1" currentUserId="user-1" />);
    // Just verify no crash — the full message rendering is covered by
    // ChatMessageList + ChatMessageItem tests.
    expect(document.body.textContent).toBeDefined();
  });

  it('forwards formatDateLabel through to the message list separator', () => {
    const { container } = render(
      <ChatThread
        conversationId="conv-1"
        formatDateLabel={() => 'STUB-LABEL'}
      />,
    );
    expect(container.textContent).toContain('STUB-LABEL');
  });
});
