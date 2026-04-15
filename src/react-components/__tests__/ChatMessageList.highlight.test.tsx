// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { ChatMessageList } from '../ChatMessageList';
import type { ChatMessage } from '../../types';

function msg(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'm',
    conversation_id: 'conv-1',
    sender_id: 'user-2',
    sender_type: 'human',
    content: 'hi',
    message_type: 'text',
    attachments: [],
    reactions: [],
    is_edited: false,
    is_deleted: false,
    created_at: '2026-04-15T10:00:00.000Z',
    updated_at: '2026-04-15T10:00:00.000Z',
    ...overrides,
  } as ChatMessage;
}

describe('ChatMessageList — highlight semantics split', () => {
  it('applies sm-message-highlighted to the search-hit message', () => {
    const messages = [
      msg({ id: 'm1', created_at: '2026-04-15T10:00:00.000Z' }),
      msg({ id: 'm2', created_at: '2026-04-15T10:01:00.000Z' }),
    ];
    const { container } = render(
      <ChatMessageList
        messages={messages}
        currentUserId="user-1"
        conversationId="conv-1"
        highlightMessageId="m2"
      />,
    );
    const hits = container.querySelectorAll('.sm-message-highlighted');
    expect(hits.length).toBe(1);
    // Search-hit class never coexists with the unread-start class on the
    // same wrapper — the renderer suppresses unread-start when search-hit
    // is set.
    expect(container.querySelectorAll('.sm-message-unread-start').length).toBe(0);
  });

  it('applies sm-message-unread-start to the first unread message only', () => {
    const messages = [
      msg({ id: 'm1', created_at: '2026-04-15T10:00:00.000Z' }),
      msg({ id: 'm2', created_at: '2026-04-15T10:01:00.000Z' }),
      msg({ id: 'm3', created_at: '2026-04-15T10:02:00.000Z' }),
    ];
    const { container } = render(
      <ChatMessageList
        messages={messages}
        currentUserId="user-1"
        conversationId="conv-1"
        firstUnreadMessageId="m2"
      />,
    );
    const unreadMarkers = container.querySelectorAll('.sm-message-unread-start');
    expect(unreadMarkers.length).toBe(1);
    expect(container.querySelectorAll('.sm-message-highlighted').length).toBe(0);
  });

  it('renders both classes on different messages when search-hit and unread-start point to different ids', () => {
    const messages = [
      msg({ id: 'm1', created_at: '2026-04-15T10:00:00.000Z' }),
      msg({ id: 'm2', created_at: '2026-04-15T10:01:00.000Z' }),
      msg({ id: 'm3', created_at: '2026-04-15T10:02:00.000Z' }),
    ];
    const { container } = render(
      <ChatMessageList
        messages={messages}
        currentUserId="user-1"
        conversationId="conv-1"
        firstUnreadMessageId="m2"
        highlightMessageId="m3"
      />,
    );
    expect(container.querySelectorAll('.sm-message-highlighted').length).toBe(1);
    expect(container.querySelectorAll('.sm-message-unread-start').length).toBe(1);
  });

  it('renderMessage context exposes split flags alongside legacy `highlight`', () => {
    const messages = [
      msg({ id: 'm1', created_at: '2026-04-15T10:00:00.000Z' }),
      msg({ id: 'm2', created_at: '2026-04-15T10:01:00.000Z' }),
    ];
    type Ctx = {
      highlight: boolean;
      isSearchHit: boolean;
      isUnreadStart: boolean;
    };
    const seen: Array<{ id: string; ctx: Ctx }> = [];
    const renderMessage = vi.fn((m: ChatMessage, ctx: Ctx) => {
      seen.push({ id: m.id, ctx: { ...ctx } });
      return <div key={m.id}>{m.content}</div>;
    });
    render(
      <ChatMessageList
        messages={messages}
        currentUserId="user-1"
        conversationId="conv-1"
        firstUnreadMessageId="m1"
        highlightMessageId="m2"
        renderMessage={renderMessage}
      />,
    );
    const m1 = seen.find((s) => s.id === 'm1')!.ctx;
    const m2 = seen.find((s) => s.id === 'm2')!.ctx;
    expect(m1).toMatchObject({
      highlight: true,
      isUnreadStart: true,
      isSearchHit: false,
    });
    expect(m2).toMatchObject({
      highlight: true,
      isUnreadStart: false,
      isSearchHit: true,
    });
  });

  it('does not paint highlight chrome when neither flag is set', () => {
    const messages = [msg({ id: 'm1', created_at: '2026-04-15T10:00:00.000Z' })];
    const { container } = render(
      <ChatMessageList
        messages={messages}
        currentUserId="user-1"
        conversationId="conv-1"
      />,
    );
    expect(container.querySelectorAll('.sm-message-highlighted').length).toBe(0);
    expect(container.querySelectorAll('.sm-message-unread-start').length).toBe(0);
  });
});
