// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ChatMessageItem } from '../ChatMessageItem';
import type { ChatMessage, Attachment } from '../../types';

function buildMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-2',
    sender_type: 'human',
    content: 'Hello world',
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

describe('ChatMessageItem — render-prop escape hatches', () => {
  it('uses the default avatar when renderAvatar is not passed', () => {
    const message = buildMessage();
    render(
      <ChatMessageItem
        message={message}
        currentUserId="user-1"
        profile={{ display_name: 'Alice', avatar_url: undefined }}
      />,
    );
    // Default avatar renders the initial letter
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('calls renderAvatar with the resolved profile and message', () => {
    const renderAvatar = vi.fn(() => (
      <div data-testid="custom-avatar">CUSTOM AVATAR</div>
    ));
    const message = buildMessage();

    render(
      <ChatMessageItem
        message={message}
        currentUserId="user-1"
        profile={{ display_name: 'Alice' }}
        renderAvatar={renderAvatar}
      />,
    );

    expect(renderAvatar).toHaveBeenCalledWith(
      { display_name: 'Alice' },
      message,
    );
    expect(screen.getByTestId('custom-avatar')).toBeTruthy();
  });

  it('does not call renderAvatar for own messages', () => {
    // Avatars are only shown for incoming messages, so renderAvatar should not
    // be invoked when the message is from the current user.
    const renderAvatar = vi.fn(() => <div data-testid="custom-avatar" />);
    const message = buildMessage({ sender_id: 'user-1' });

    render(
      <ChatMessageItem
        message={message}
        currentUserId="user-1"
        renderAvatar={renderAvatar}
      />,
    );

    expect(renderAvatar).not.toHaveBeenCalled();
  });

  it('calls getProfile when profile prop is not passed', () => {
    const getProfile = vi.fn(() => ({
      display_name: 'Bob',
      avatar_url: undefined,
    }));
    const message = buildMessage({ sender_id: 'user-2' });

    render(
      <ChatMessageItem
        message={message}
        currentUserId="user-1"
        getProfile={getProfile}
      />,
    );

    expect(getProfile).toHaveBeenCalledWith('user-2');
    // Default avatar should render "B" from Bob
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('prefers explicit profile prop over getProfile fallback', () => {
    const getProfile = vi.fn(() => ({ display_name: 'Bob' }));
    const message = buildMessage({ sender_id: 'user-2' });

    // renderAvatar lets us inspect exactly which profile was resolved without
    // depending on the default DOM structure.
    let resolvedProfile: { display_name?: string } | undefined;
    const renderAvatar = vi.fn((profile: { display_name?: string } | undefined) => {
      resolvedProfile = profile;
      return <div data-testid="avatar" />;
    });

    render(
      <ChatMessageItem
        message={message}
        currentUserId="user-1"
        profile={{ display_name: 'Alice' }}
        getProfile={getProfile}
        renderAvatar={renderAvatar}
      />,
    );

    // When both are passed, profile wins — getProfile should not be called,
    // and the resolved profile handed to renderAvatar should be Alice.
    expect(getProfile).not.toHaveBeenCalled();
    expect(resolvedProfile?.display_name).toBe('Alice');
  });

  it('calls renderAttachment for every attachment when provided', () => {
    const attachments: Attachment[] = [
      {
        file_id: 'att-1',
        file_name: 'photo.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
      } as Attachment,
      {
        file_id: 'att-2',
        file_name: 'doc.pdf',
        mime_type: 'application/pdf',
        file_size: 2048,
      } as Attachment,
    ];
    const message = buildMessage({ attachments });
    const renderAttachment = vi.fn((att: Attachment) => (
      <div data-testid={`att-${att.file_id}`}>{att.file_name}</div>
    ));

    render(
      <ChatMessageItem
        message={message}
        currentUserId="user-1"
        renderAttachment={renderAttachment}
      />,
    );

    expect(renderAttachment).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('att-att-1')).toBeTruthy();
    expect(screen.getByTestId('att-att-2')).toBeTruthy();
  });

  it('renders message content without crashing', () => {
    const message = buildMessage({ content: 'test content xyz' });
    render(<ChatMessageItem message={message} currentUserId="user-1" />);
    expect(screen.getByText('test content xyz')).toBeTruthy();
  });
});
