// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
} as unknown;

afterEach(() => {
  vi.resetModules();
});

function setup(typingUsers: string[]) {
  vi.doMock('../../react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../react')>();
    return {
      ...actual,
      useChatClient: () => mockChatClient,
      useConnectionStatus: () => ({
        status: 'connected' as const,
        isOnline: true,
        isReconnecting: false,
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
      useTyping: () => ({ typingUsers, sendTyping }),
      usePresence: () => ({
        members: [] as Array<{ userId: string; status: string }>,
      }),
    };
  });
}

async function renderThread(props: Record<string, unknown> = {}) {
  const { ChatThread } = await import('../ChatThread');
  return render(
    <ChatThread
      conversationId="conv-1"
      currentUserId="user-1"
      profiles={
        new Map([
          ['user-2', { display_name: 'Alice' }],
          ['user-3', { display_name: 'Bob' }],
        ])
      }
      {...props}
    />,
  );
}

describe('ChatThread — typing indicator placement', () => {
  it('renders the indicator above the composer by default', async () => {
    setup(['user-2']);
    const { container } = await renderThread();
    const indicators = container.querySelectorAll('.sm-typing-indicator');
    expect(indicators.length).toBe(1);

    // The composer (textarea from ChatInput) should come AFTER the indicator
    // in DOM order for the default 'above-composer' position.
    const indicator = indicators[0] as HTMLElement;
    const composer = container.querySelector('textarea');
    expect(composer).toBeTruthy();
    const indicatorIdx = Array.from(container.querySelectorAll('*')).indexOf(indicator);
    const composerIdx = Array.from(container.querySelectorAll('*')).indexOf(composer!);
    expect(indicatorIdx).toBeLessThan(composerIdx);
  });

  it('renders the indicator below the composer when typingIndicatorPosition="below-composer"', async () => {
    setup(['user-2']);
    const { container } = await renderThread({
      typingIndicatorPosition: 'below-composer',
    });
    const indicator = container.querySelector('.sm-typing-indicator') as HTMLElement;
    const composer = container.querySelector('textarea');
    expect(indicator).toBeTruthy();
    expect(composer).toBeTruthy();
    const indicatorIdx = Array.from(container.querySelectorAll('*')).indexOf(indicator);
    const composerIdx = Array.from(container.querySelectorAll('*')).indexOf(composer!);
    expect(indicatorIdx).toBeGreaterThan(composerIdx);
  });

  it('suppresses the indicator entirely when typingIndicatorPosition="none"', async () => {
    setup(['user-2']);
    const { container } = await renderThread({
      typingIndicatorPosition: 'none',
    });
    expect(container.querySelectorAll('.sm-typing-indicator').length).toBe(0);
  });

  it('forwards formatTyping + typingIndicatorLocale to the indicator', async () => {
    setup(['user-2', 'user-3']);
    const formatTyping = vi.fn((names: string[]) => `STUB: ${names.join(' + ')}`);
    const { getByText } = await renderThread({
      formatTyping,
      typingIndicatorLocale: 'en-US',
    });
    expect(getByText('STUB: Alice + Bob')).toBeTruthy();
    expect(formatTyping).toHaveBeenCalled();
  });
});
