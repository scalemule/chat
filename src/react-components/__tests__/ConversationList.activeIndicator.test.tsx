// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import type { Conversation } from '../../types';

function setup(conversations: Conversation[]): void {
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

afterEach(() => {
  vi.resetModules();
});

const baseConv = {
  created_at: '2026-04-15T10:00:00.000Z',
  updated_at: '2026-04-15T10:00:00.000Z',
};

describe('ConversationList — renderActiveIndicator', () => {
  it('invokes the renderer for every row and renders its output', async () => {
    const conversations = [
      { ...baseConv, id: 'c1', conversation_type: 'direct', name: 'Alice' } as Conversation,
      { ...baseConv, id: 'c2', conversation_type: 'channel', name: 'general' } as Conversation,
    ];
    setup(conversations);
    const { ConversationList } = await import('../ConversationList');
    const ids: string[] = [];
    render(
      <ConversationList
        renderActiveIndicator={(c) => {
          ids.push(c.id);
          return c.id === 'c2' ? (
            <span data-testid={`active-${c.id}`}>ACTIVE</span>
          ) : null;
        }}
      />,
    );
    // Renderer called once per row, preserving order.
    expect(ids).toEqual(['c1', 'c2']);
    const activeMarker = document.querySelector('[data-testid="active-c2"]');
    expect(activeMarker).toBeTruthy();
    expect(document.querySelector('[data-testid="active-c1"]')).toBeNull();
  });

  it('wires ActiveCallDot through a host-supplied predicate', async () => {
    const conversations = [
      { ...baseConv, id: 'c1', conversation_type: 'direct', name: 'Alice' } as Conversation,
      { ...baseConv, id: 'c2', conversation_type: 'channel', name: 'general' } as Conversation,
    ];
    setup(conversations);
    const { ConversationList } = await import('../ConversationList');
    const { ActiveCallDot } = await import('../ActiveCallDot');
    const activeSet = new Set(['c2']);
    const { container } = render(
      <ConversationList
        renderActiveIndicator={(c) => (
          <ActiveCallDot active={activeSet.has(c.id)} />
        )}
      />,
    );
    // Exactly one row (c2) gets the dot.
    expect(container.querySelectorAll('.sm-active-call-dot').length).toBe(1);
  });

  it('renders nothing extra when renderActiveIndicator is omitted', async () => {
    setup([
      { ...baseConv, id: 'c1', conversation_type: 'direct', name: 'Alice' } as Conversation,
    ]);
    const { ConversationList } = await import('../ConversationList');
    const { container } = render(<ConversationList />);
    expect(container.querySelector('.sm-active-call-dot')).toBeNull();
  });
});
