// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { ChatMessageItem } from '../ChatMessageItem';
import type { ChatMessage } from '../../types';

function plainMessage(content: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-2',
    sender_type: 'human',
    content,
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

describe('ChatMessageItem — plain-text linkify', () => {
  it('renders detected URLs as anchors with safe rel attributes', () => {
    const { container } = render(
      <ChatMessageItem
        message={plainMessage('check https://example.com docs')}
        currentUserId="user-1"
        profile={{ display_name: 'Bob' }}
      />,
    );
    const anchor = container.querySelector('a.sm-link-auto');
    expect(anchor).toBeTruthy();
    expect(anchor!.getAttribute('href')).toBe('https://example.com');
    expect(anchor!.getAttribute('target')).toBe('_blank');
    expect(anchor!.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(anchor!.textContent).toBe('https://example.com');
  });

  it('promotes www.* matches with an https:// scheme', () => {
    const { container } = render(
      <ChatMessageItem
        message={plainMessage('go to www.example.com')}
        currentUserId="user-1"
        profile={{ display_name: 'Bob' }}
      />,
    );
    const anchor = container.querySelector('a.sm-link-auto');
    expect(anchor).toBeTruthy();
    expect(anchor!.getAttribute('href')).toBe('https://www.example.com');
  });

  it('renders raw text when linkifyPlainText is false', () => {
    const { container } = render(
      <ChatMessageItem
        message={plainMessage('check https://example.com docs')}
        currentUserId="user-1"
        profile={{ display_name: 'Bob' }}
        linkifyPlainText={false}
      />,
    );
    expect(container.querySelector('a.sm-link-auto')).toBeNull();
    expect(container.textContent).toContain('https://example.com');
  });

  it('does not touch HTML messages — Quill linkifies at compose time', () => {
    const { container } = render(
      <ChatMessageItem
        message={plainMessage(
          '<p>see <a href="https://x.test">x</a></p>',
          { content_format: 'html' },
        )}
        currentUserId="user-1"
        profile={{ display_name: 'Bob' }}
      />,
    );
    // No sm-link-auto — only the existing anchor.
    expect(container.querySelectorAll('a.sm-link-auto').length).toBe(0);
    const anchors = container.querySelectorAll('.sm-rich-content a');
    expect(anchors.length).toBe(1);
    expect(anchors[0].getAttribute('href')).toBe('https://x.test');
  });
});
