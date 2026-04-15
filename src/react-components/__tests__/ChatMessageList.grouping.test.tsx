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
    created_at: '2026-04-14T10:00:00.000Z',
    updated_at: '2026-04-14T10:00:00.000Z',
    ...overrides,
  } as ChatMessage;
}

/**
 * The grouping computation isn't exported as a pure function — it lives in
 * the list's render loop. We assert via the `renderMessage` escape hatch,
 * which receives `isGrouped` in its context. This double-duty validates
 * both the grouping logic AND that the field is present in the public
 * renderMessage context (Finding 4 from the design review).
 */
function captureGrouped(messages: ChatMessage[], extra: Partial<React.ComponentProps<typeof ChatMessageList>> = {}): boolean[] {
  const flags: boolean[] = [];
  const renderMessage = vi.fn((m: ChatMessage, ctx: { isGrouped: boolean }) => {
    flags.push(ctx.isGrouped);
    return <div key={m.id}>{m.content}</div>;
  });
  render(
    <ChatMessageList
      messages={messages}
      currentUserId="user-1"
      conversationId="conv-1"
      renderMessage={renderMessage}
      {...extra}
    />,
  );
  return flags;
}

describe('ChatMessageList — message grouping', () => {
  it('groups same-sender messages within the default 5-minute window', () => {
    const messages = [
      msg({ id: 'm1', sender_id: 'user-2', created_at: '2026-04-14T10:00:00.000Z' }),
      msg({ id: 'm2', sender_id: 'user-2', created_at: '2026-04-14T10:02:00.000Z' }),
      msg({ id: 'm3', sender_id: 'user-2', created_at: '2026-04-14T10:04:30.000Z' }),
    ];
    expect(captureGrouped(messages)).toEqual([false, true, true]);
  });

  it('breaks grouping when the sender changes', () => {
    const messages = [
      msg({ id: 'm1', sender_id: 'user-2', created_at: '2026-04-14T10:00:00.000Z' }),
      msg({ id: 'm2', sender_id: 'user-3', created_at: '2026-04-14T10:01:00.000Z' }),
      msg({ id: 'm3', sender_id: 'user-3', created_at: '2026-04-14T10:02:00.000Z' }),
    ];
    expect(captureGrouped(messages)).toEqual([false, false, true]);
  });

  it('breaks grouping past the time window', () => {
    const messages = [
      msg({ id: 'm1', sender_id: 'user-2', created_at: '2026-04-14T10:00:00.000Z' }),
      // 6 minutes later — past the 5-minute default
      msg({ id: 'm2', sender_id: 'user-2', created_at: '2026-04-14T10:06:00.000Z' }),
    ];
    expect(captureGrouped(messages)).toEqual([false, false]);
  });

  it('never groups when previous or current is a system message', () => {
    const messages = [
      msg({ id: 'm1', sender_id: 'user-2', created_at: '2026-04-14T10:00:00.000Z' }),
      msg({
        id: 'm2',
        sender_id: 'user-2',
        message_type: 'system' as ChatMessage['message_type'],
        created_at: '2026-04-14T10:01:00.000Z',
      }),
      msg({ id: 'm3', sender_id: 'user-2', created_at: '2026-04-14T10:02:00.000Z' }),
    ];
    // m2 is system → not grouped. m3 follows a system msg → not grouped.
    expect(captureGrouped(messages)).toEqual([false, false, false]);
  });

  it('breaks grouping across a date-separator boundary', () => {
    const messages = [
      msg({ id: 'm1', sender_id: 'user-2', created_at: '2026-04-13T23:58:00.000Z' }),
      // Same sender, 4 minutes later by clock — but it's a different
      // calendar day, so the date-separator should break grouping.
      msg({ id: 'm2', sender_id: 'user-2', created_at: '2026-04-14T00:02:00.000Z' }),
    ];
    expect(
      captureGrouped(messages, { dateLabelTimeZone: 'UTC' }),
    ).toEqual([false, false]);
  });

  it('breaks grouping across the unread divider', () => {
    const messages = [
      msg({ id: 'm1', sender_id: 'user-2', created_at: '2026-04-14T10:00:00.000Z' }),
      msg({ id: 'm2', sender_id: 'user-2', created_at: '2026-04-14T10:01:00.000Z' }),
    ];
    // Mark m2 as the first unread → unread divider sits above m2 → no grouping.
    expect(
      captureGrouped(messages, { firstUnreadMessageId: 'm2' }),
    ).toEqual([false, false]);
  });

  it('disables grouping entirely when groupingWindowMs=0', () => {
    const messages = [
      msg({ id: 'm1', sender_id: 'user-2', created_at: '2026-04-14T10:00:00.000Z' }),
      msg({ id: 'm2', sender_id: 'user-2', created_at: '2026-04-14T10:01:00.000Z' }),
      msg({ id: 'm3', sender_id: 'user-2', created_at: '2026-04-14T10:02:00.000Z' }),
    ];
    expect(captureGrouped(messages, { groupingWindowMs: 0 })).toEqual([false, false, false]);
  });
});

describe('ChatMessageList — grouping suppresses default-item chrome', () => {
  it('hides the sender name on grouped default-item messages', () => {
    const messages = [
      msg({
        id: 'm1',
        sender_id: 'user-2',
        content: 'first',
        created_at: '2026-04-14T10:00:00.000Z',
      }),
      msg({
        id: 'm2',
        sender_id: 'user-2',
        content: 'second',
        created_at: '2026-04-14T10:01:00.000Z',
      }),
    ];
    const profiles = new Map([
      ['user-2', { display_name: 'Bob' }],
    ]);
    const { container } = render(
      <ChatMessageList
        messages={messages}
        currentUserId="user-1"
        conversationId="conv-1"
        profiles={profiles}
      />,
    );
    // "Bob" should appear exactly once (on the first message header), not twice.
    const bobMatches = (container.textContent ?? '').match(/Bob/g) ?? [];
    expect(bobMatches.length).toBe(1);
    // The grouped (second) message wrapper carries the sm-message-grouped class.
    expect(container.querySelectorAll('.sm-message-grouped').length).toBe(1);
  });
});
