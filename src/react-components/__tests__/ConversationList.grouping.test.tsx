// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { Conversation } from '../../types';

const baseConv = {
  created_at: '2026-04-15T10:00:00.000Z',
  updated_at: '2026-04-15T10:00:00.000Z',
};

function mockConversations(conversations: Conversation[]): void {
  vi.doMock('../../react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../react')>();
    return {
      ...actual,
      useConversations: () => ({
        conversations,
        isLoading: false,
        refresh: vi.fn(),
      }),
      useMentionCounts: () => new Map<string, number>(),
    };
  });
}

function installMemoryStorage(): { restore: () => void } {
  const store = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    } as Storage,
  });
  return {
    restore: () => {
      if (original) Object.defineProperty(window, 'localStorage', original);
    },
  };
}

const SAMPLE = [
  { ...baseConv, id: 'ch-1', conversation_type: 'channel', name: 'general',
    last_message_preview: 'preview-ch-1',
    participants: [{ user_id: 'me', role: 'member', joined_at: '' }] },
  { ...baseConv, id: 'ch-2', conversation_type: 'channel', name: 'random',
    last_message_preview: 'preview-ch-2',
    participants: [{ user_id: 'me', role: 'member', joined_at: '' }] },
  { ...baseConv, id: 'gp-1', conversation_type: 'group', name: 'Project Team',
    last_message_preview: 'preview-gp-1',
    participants: [{ user_id: 'me', role: 'member', joined_at: '' }] },
  { ...baseConv, id: 'dm-1', conversation_type: 'direct', name: 'Alice',
    last_message_preview: 'preview-dm-1',
    counterparty_user_id: 'u1' },
] as Conversation[];

describe('ConversationList — groupBy="type"', () => {
  let storage: ReturnType<typeof installMemoryStorage>;
  beforeEach(() => { storage = installMemoryStorage(); });
  afterEach(() => { storage.restore(); });

  it('partitions rows under default-ordered section headers', async () => {
    vi.resetModules();
    mockConversations(SAMPLE);
    const { ConversationList } = await import('../ConversationList');
    const { container } = render(
      <ConversationList currentUserId="me" groupBy="type" />,
    );
    const headers = Array.from(
      container.querySelectorAll('.sm-conv-section-header'),
    ).map((h) => h.textContent?.replace(/[▾▸\s]+/g, ' ').trim());
    // Default order: channel, group, direct.
    expect(headers).toEqual([
      'CHANNELS2',
      'GROUPS1',
      'DIRECT MESSAGES1',
    ]);
  });

  it('respects sectionOrder (and hides types not listed)', async () => {
    vi.resetModules();
    mockConversations(SAMPLE);
    const { ConversationList } = await import('../ConversationList');
    const { container } = render(
      <ConversationList
        currentUserId="me"
        groupBy="type"
        sectionOrder={['direct', 'channel']}
      />,
    );
    const headers = Array.from(
      container.querySelectorAll('.sm-conv-section-header'),
    ).map((h) => h.textContent?.replace(/[▾▸\s]+/g, ' ').trim());
    expect(headers).toEqual(['DIRECT MESSAGES1', 'CHANNELS2']);
    // Group section is omitted entirely.
    expect(container.textContent).not.toContain('GROUPS');
    // The Project Team row is excluded because its section is hidden.
    expect(screen.queryByText('Project Team')).toBeNull();
  });

  it('honors sectionLabels overrides', async () => {
    vi.resetModules();
    mockConversations(SAMPLE);
    const { ConversationList } = await import('../ConversationList');
    render(
      <ConversationList
        currentUserId="me"
        groupBy="type"
        sectionLabels={{ channel: 'TOPICS', direct: 'PEOPLE' }}
      />,
    );
    expect(screen.getByText(/TOPICS/)).toBeTruthy();
    expect(screen.getByText(/PEOPLE/)).toBeTruthy();
    // Unspecified label still uses the default.
    expect(screen.getByText(/GROUPS/)).toBeTruthy();
  });

  it('toggles a section when its header is clicked', async () => {
    vi.resetModules();
    mockConversations(SAMPLE);
    const { ConversationList } = await import('../ConversationList');
    const { container } = render(
      <ConversationList currentUserId="me" groupBy="type" />,
    );
    // Channels section starts expanded.
    expect(screen.getByText('general')).toBeTruthy();
    const channelsHeader = Array.from(
      container.querySelectorAll('.sm-conv-section-header'),
    ).find((h) => h.textContent?.includes('CHANNELS'))!;
    fireEvent.click(channelsHeader);
    expect(screen.queryByText('general')).toBeNull();
    expect(channelsHeader.getAttribute('aria-expanded')).toBe('false');
  });

  it('persists collapsed state across mounts via localStorage', async () => {
    vi.resetModules();
    mockConversations(SAMPLE);
    const first = await import('../ConversationList');
    const { container, unmount } = render(
      <first.ConversationList currentUserId="me" groupBy="type" />,
    );
    const channelsHeader = Array.from(
      container.querySelectorAll('.sm-conv-section-header'),
    ).find((h) => h.textContent?.includes('CHANNELS'))!;
    fireEvent.click(channelsHeader);
    unmount();

    // Re-mount — collapse should rehydrate from storage.
    const second = render(
      <first.ConversationList currentUserId="me" groupBy="type" />,
    );
    const channelsHeaderAgain = Array.from(
      second.container.querySelectorAll('.sm-conv-section-header'),
    ).find((h) => h.textContent?.includes('CHANNELS'))!;
    expect(channelsHeaderAgain.getAttribute('aria-expanded')).toBe('false');
    expect(second.container.textContent).not.toContain('general');
  });

  it('falls back to the flat list when groupBy is omitted', async () => {
    vi.resetModules();
    mockConversations(SAMPLE);
    const { ConversationList } = await import('../ConversationList');
    const { container } = render(<ConversationList currentUserId="me" />);
    expect(container.querySelectorAll('.sm-conv-section-header').length).toBe(0);
  });
});
