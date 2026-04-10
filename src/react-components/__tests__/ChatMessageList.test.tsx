// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ChatMessageList } from '../ChatMessageList';
import type { ChatMessage } from '../../types';

function buildMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-2',
    sender_type: 'human',
    content: 'Hello',
    message_type: 'text',
    attachments: [],
    reactions: [],
    is_edited: false,
    is_deleted: false,
    created_at: '2026-04-10T10:00:00.000Z',
    updated_at: '2026-04-10T10:00:00.000Z',
    ...overrides,
  } as ChatMessage;
}

describe('ChatMessageList — renderMessage escape hatch', () => {
  it('uses the default ChatMessageItem when renderMessage is not passed', () => {
    const messages = [buildMessage({ id: 'm1', content: 'default msg' })];
    render(
      <ChatMessageList
        messages={messages}
        currentUserId="user-1"
        conversationId="conv-1"
      />,
    );
    expect(screen.getByText('default msg')).toBeTruthy();
  });

  it('calls renderMessage with the resolved context for every message', () => {
    const messages = [
      buildMessage({ id: 'm1', sender_id: 'user-1', content: 'own' }),
      buildMessage({ id: 'm2', sender_id: 'user-2', content: 'other' }),
    ];
    const profiles = new Map([
      ['user-2', { display_name: 'Bob' }],
    ]);

    const contexts: Array<{ msgId: string; isOwn: boolean; displayName?: string }> = [];
    const renderMessage = vi.fn(
      (msg: ChatMessage, ctx: { isOwnMessage: boolean; profile?: { display_name?: string } }) => {
        contexts.push({
          msgId: msg.id,
          isOwn: ctx.isOwnMessage,
          displayName: ctx.profile?.display_name,
        });
        return (
          <div key={msg.id} data-testid={`custom-${msg.id}`}>
            {msg.content}
          </div>
        );
      },
    );

    render(
      <ChatMessageList
        messages={messages}
        currentUserId="user-1"
        conversationId="conv-1"
        profiles={profiles}
        renderMessage={renderMessage}
      />,
    );

    expect(renderMessage).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('custom-m1')).toBeTruthy();
    expect(screen.getByTestId('custom-m2')).toBeTruthy();

    // Own/other classification flows through context
    const m1Context = contexts.find((c) => c.msgId === 'm1');
    const m2Context = contexts.find((c) => c.msgId === 'm2');
    expect(m1Context?.isOwn).toBe(true);
    expect(m2Context?.isOwn).toBe(false);

    // Profile map is threaded through by sender_id
    expect(m2Context?.displayName).toBe('Bob');
  });

  it('does not crash with an empty message list', () => {
    render(
      <ChatMessageList
        messages={[]}
        currentUserId="user-1"
        emptyState={<div data-testid="empty">No messages yet</div>}
      />,
    );
    expect(screen.getByTestId('empty')).toBeTruthy();
  });
});
