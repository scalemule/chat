// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import type { ConnectionStatus } from '../../types';

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
} as unknown;

afterEach(() => {
  vi.resetModules();
});

function setup(connectionStatus: ConnectionStatus): void {
  vi.doMock('../../react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../react')>();
    return {
      ...actual,
      useChatClient: () => mockChatClient,
      useConnectionStatus: () => ({
        status: connectionStatus,
        isOnline: connectionStatus === 'connected',
        isReconnecting: connectionStatus === 'reconnecting',
      }),
      useChat: () => ({
        messages: [],
        readStatuses: [],
        isLoading: false,
        error: null,
        hasMore: false,
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
}

async function renderThread(
  props: Record<string, unknown> = {},
): Promise<HTMLElement> {
  const { ChatThread } = await import('../ChatThread');
  const { container } = render(
    <ChatThread conversationId="conv-1" {...props} />,
  );
  return container;
}

describe('ChatThread — disableWhenOffline (plain composer)', () => {
  it('disables the plain composer when offline + disableWhenOffline=true', async () => {
    setup('disconnected');
    const container = await renderThread({ disableWhenOffline: true });
    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();
    expect(textarea?.disabled).toBe(true);
  });

  it('keeps the plain composer enabled when online + disableWhenOffline=true', async () => {
    setup('connected');
    const container = await renderThread({ disableWhenOffline: true });
    const textarea = container.querySelector('textarea');
    expect(textarea?.disabled).toBe(false);
  });

  it('keeps the plain composer enabled when offline but disableWhenOffline=false', async () => {
    setup('disconnected');
    const container = await renderThread({ disableWhenOffline: false });
    const textarea = container.querySelector('textarea');
    expect(textarea?.disabled).toBe(false);
  });

  it('keeps the plain composer enabled when offline and disableWhenOffline omitted (back-compat default)', async () => {
    setup('disconnected');
    const container = await renderThread();
    const textarea = container.querySelector('textarea');
    expect(textarea?.disabled).toBe(false);
  });
});
