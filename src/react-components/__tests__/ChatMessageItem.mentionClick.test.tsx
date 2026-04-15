// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { ChatMessageItem } from '../ChatMessageItem';
import type { ChatMessage } from '../../types';

function htmlMessage(content: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-2',
    sender_type: 'human',
    content,
    content_format: 'html',
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

describe('ChatMessageItem — mention click delegation', () => {
  it('fires onMentionClick(userId, msg) when a .sm-mention is clicked', () => {
    const onMentionClick = vi.fn();
    const message = htmlMessage(
      'hey <span class="sm-mention" data-sm-user-id="user-99">@Alice</span> here',
    );
    const { container } = render(
      <ChatMessageItem
        message={message}
        currentUserId="user-1"
        profile={{ display_name: 'Bob' }}
        onMentionClick={onMentionClick}
      />,
    );
    const chip = container.querySelector('.sm-mention');
    expect(chip).toBeTruthy();
    fireEvent.click(chip!);
    expect(onMentionClick).toHaveBeenCalledTimes(1);
    expect(onMentionClick).toHaveBeenCalledWith('user-99', message);
  });

  it('fires onChannelMentionClick(channelId, msg) when .sm-channel-mention is clicked', () => {
    const onChannelMentionClick = vi.fn();
    const message = htmlMessage(
      'see <span class="sm-channel-mention" data-sm-channel-id="ch-7">#general</span>',
    );
    const { container } = render(
      <ChatMessageItem
        message={message}
        currentUserId="user-1"
        profile={{ display_name: 'Bob' }}
        onChannelMentionClick={onChannelMentionClick}
      />,
    );
    const chip = container.querySelector('.sm-channel-mention');
    expect(chip).toBeTruthy();
    fireEvent.click(chip!);
    expect(onChannelMentionClick).toHaveBeenCalledTimes(1);
    expect(onChannelMentionClick).toHaveBeenCalledWith('ch-7', message);
  });

  it('does not fire when clicking outside any mention chip', () => {
    const onMentionClick = vi.fn();
    const message = htmlMessage(
      '<p>plain text <span class="sm-mention" data-sm-user-id="user-99">@Alice</span></p>',
    );
    const { container } = render(
      <ChatMessageItem
        message={message}
        currentUserId="user-1"
        profile={{ display_name: 'Bob' }}
        onMentionClick={onMentionClick}
      />,
    );
    const paragraph = container.querySelector('.sm-rich-content p');
    expect(paragraph).toBeTruthy();
    // Click directly on the paragraph text node container (not the chip)
    fireEvent.click(paragraph!);
    expect(onMentionClick).not.toHaveBeenCalled();
  });

  it('does not crash when callbacks are absent and a mention is clicked', () => {
    const message = htmlMessage(
      '<span class="sm-mention" data-sm-user-id="user-99">@Alice</span>',
    );
    const { container } = render(
      <ChatMessageItem
        message={message}
        currentUserId="user-1"
        profile={{ display_name: 'Bob' }}
      />,
    );
    const chip = container.querySelector('.sm-mention');
    expect(chip).toBeTruthy();
    expect(() => fireEvent.click(chip!)).not.toThrow();
  });

  it('skips delegation when the mention markup lacks a data attribute', () => {
    const onMentionClick = vi.fn();
    // No data-sm-user-id — sanitizer would normally drop the markup, but if
    // a host opts into a custom sanitizer that misses the attribute, we
    // should not fire with `null`.
    const message = htmlMessage(
      '<span class="sm-mention">@Alice</span>',
    );
    const { container } = render(
      <ChatMessageItem
        message={message}
        currentUserId="user-1"
        profile={{ display_name: 'Bob' }}
        onMentionClick={onMentionClick}
      />,
    );
    const chip = container.querySelector('.sm-mention');
    fireEvent.click(chip!);
    expect(onMentionClick).not.toHaveBeenCalled();
  });
});
