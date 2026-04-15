import { describe, expect, it } from 'vitest';

import {
  buildDefaultGroupName,
  otherParticipantNames,
  resolveConversationDisplayName,
} from '../conversationDisplay';
import type { Conversation } from '../../types';

function conv(overrides: Partial<Conversation>): Conversation {
  return {
    id: 'c',
    conversation_type: 'direct',
    created_at: '2026-04-15T10:00:00.000Z',
    ...overrides,
  } as Conversation;
}

const profiles = new Map([
  ['u1', { display_name: 'Alice' }],
  ['u2', { display_name: 'Bob' }],
  ['u3', { display_name: 'Carol' }],
  ['u4', { display_name: 'Dan' }],
  ['me', { display_name: 'Me' }],
]);

describe('buildDefaultGroupName', () => {
  it('returns "Group" for empty input', () => {
    expect(buildDefaultGroupName([])).toBe('Group');
  });

  it('returns the single name for a 1-person list', () => {
    expect(buildDefaultGroupName(['Alice'])).toBe('Alice');
  });

  it('joins two names with a comma', () => {
    expect(buildDefaultGroupName(['Alice', 'Bob'])).toBe('Alice, Bob');
  });

  it('collapses into "and N others" for 4+', () => {
    expect(buildDefaultGroupName(['Alice', 'Bob', 'Carol', 'Dan'])).toBe(
      'Alice, Bob, and 2 others',
    );
  });

  it('uses singular "other" for exactly 3', () => {
    expect(buildDefaultGroupName(['Alice', 'Bob', 'Carol'])).toBe(
      'Alice, Bob, and 1 other',
    );
  });
});

describe('otherParticipantNames', () => {
  it('filters out the current user and resolves profiles', () => {
    const c = conv({
      conversation_type: 'group',
      participants: [
        { user_id: 'me', role: 'member', joined_at: '' },
        { user_id: 'u1', role: 'member', joined_at: '' },
        { user_id: 'u2', role: 'member', joined_at: '' },
      ],
    });
    expect(otherParticipantNames(c, 'me', profiles)).toEqual(['Alice', 'Bob']);
  });

  it('falls back to short id prefix when profile is missing', () => {
    const c = conv({
      conversation_type: 'group',
      participants: [
        { user_id: 'me', role: 'member', joined_at: '' },
        { user_id: 'unknown-long-id-123', role: 'member', joined_at: '' },
      ],
    });
    expect(otherParticipantNames(c, 'me', profiles)).toEqual(['unknown-']);
  });
});

describe('resolveConversationDisplayName', () => {
  it('returns conversation.name verbatim for named non-DM conversations', () => {
    const c = conv({
      conversation_type: 'channel',
      name: 'announcements',
    });
    expect(
      resolveConversationDisplayName(c, { currentUserId: 'me', profiles }),
    ).toBe('announcements');
  });

  it('appends selfLabel for a self-DM', () => {
    const c = conv({
      conversation_type: 'direct',
      participants: [{ user_id: 'me', role: 'member', joined_at: '' }],
    });
    expect(
      resolveConversationDisplayName(c, { currentUserId: 'me', profiles }),
    ).toBe('Me (you)');
  });

  it('uses a custom selfLabel when provided', () => {
    const c = conv({
      conversation_type: 'direct',
      participants: [{ user_id: 'me', role: 'member', joined_at: '' }],
    });
    expect(
      resolveConversationDisplayName(c, {
        currentUserId: 'me',
        profiles,
        selfLabel: '— Saved',
      }),
    ).toBe('Me — Saved');
  });

  it('resolves a 1:1 DM to the other user display name', () => {
    const c = conv({
      conversation_type: 'direct',
      participants: [
        { user_id: 'me', role: 'member', joined_at: '' },
        { user_id: 'u1', role: 'member', joined_at: '' },
      ],
    });
    expect(
      resolveConversationDisplayName(c, { currentUserId: 'me', profiles }),
    ).toBe('Alice');
  });

  it('falls back to counterparty_user_id for a DM without participant list', () => {
    const c = conv({
      conversation_type: 'direct',
      counterparty_user_id: 'u2',
    });
    expect(
      resolveConversationDisplayName(c, { currentUserId: 'me', profiles }),
    ).toBe('Bob');
  });

  it('builds a default group name from participants when unnamed', () => {
    const c = conv({
      conversation_type: 'group',
      participants: [
        { user_id: 'me', role: 'member', joined_at: '' },
        { user_id: 'u1', role: 'member', joined_at: '' },
        { user_id: 'u2', role: 'member', joined_at: '' },
        { user_id: 'u3', role: 'member', joined_at: '' },
      ],
    });
    expect(
      resolveConversationDisplayName(c, { currentUserId: 'me', profiles }),
    ).toBe('Alice, Bob, and 1 other');
  });

  it('honors a caller-supplied formatGroupName', () => {
    const c = conv({
      conversation_type: 'group',
      participants: [
        { user_id: 'me', role: 'member', joined_at: '' },
        { user_id: 'u1', role: 'member', joined_at: '' },
        { user_id: 'u2', role: 'member', joined_at: '' },
        { user_id: 'u3', role: 'member', joined_at: '' },
        { user_id: 'u4', role: 'member', joined_at: '' },
      ],
    });
    expect(
      resolveConversationDisplayName(c, {
        currentUserId: 'me',
        profiles,
        formatGroupName: (names) => `${names.length} people`,
      }),
    ).toBe('4 people');
  });

  it('prefers conversation.name even for a group with participants', () => {
    const c = conv({
      conversation_type: 'group',
      name: 'Q4 Planning',
      participants: [
        { user_id: 'me', role: 'member', joined_at: '' },
        { user_id: 'u1', role: 'member', joined_at: '' },
      ],
    });
    expect(
      resolveConversationDisplayName(c, { currentUserId: 'me', profiles }),
    ).toBe('Q4 Planning');
  });
});
