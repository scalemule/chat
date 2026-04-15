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

  it('forwards linkifyPlainText=false through to the rendered message body', () => {
    // Default message (chatState) is plain-text and contains no URL — verify
    // by adding one and asserting the absence of the auto-link anchor.
    const previous = chatState.messages;
    chatState.messages = [
      {
        ...previous[0],
        content: 'see https://example.com',
      },
    ];
    try {
      const { container } = render(
        <ChatThread conversationId="conv-1" linkifyPlainText={false} />,
      );
      expect(container.querySelector('a.sm-link-auto')).toBeNull();
    } finally {
      chatState.messages = previous;
    }
  });

  it('forwards onMentionClick through to the rendered message body', () => {
    const onMentionClick = vi.fn();
    const previous = chatState.messages;
    chatState.messages = [
      {
        ...previous[0],
        content: 'hello <span class="sm-mention" data-sm-user-id="user-42">@Alice</span>',
        content_format: 'html' as const,
      },
    ];
    try {
      const { container } = render(
        <ChatThread conversationId="conv-1" onMentionClick={onMentionClick} />,
      );
      const chip = container.querySelector('.sm-mention');
      expect(chip).toBeTruthy();
      chip!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onMentionClick).toHaveBeenCalledTimes(1);
      expect(onMentionClick.mock.calls[0][0]).toBe('user-42');
    } finally {
      chatState.messages = previous;
    }
  });

  it('forwards groupingWindowMs through to the message list', () => {
    // Push a second message from the same sender, 1 minute apart.
    const previous = chatState.messages;
    chatState.messages = [
      previous[0],
      {
        ...previous[0],
        id: 'msg-2',
        content: 'second from same sender',
        created_at: '2026-04-10T10:01:00.000Z',
        updated_at: '2026-04-10T10:01:00.000Z',
      },
    ];
    try {
      // groupingWindowMs=0 disables grouping → both messages should render
      // their full chrome (e.g. the sender name appears twice when the
      // profile is provided). We assert the simpler observable: the
      // second message has no sm-message-grouped class.
      const { container } = render(
        <ChatThread conversationId="conv-1" groupingWindowMs={0} />,
      );
      expect(container.querySelectorAll('.sm-message-grouped').length).toBe(0);
    } finally {
      chatState.messages = previous;
    }
  });
});
