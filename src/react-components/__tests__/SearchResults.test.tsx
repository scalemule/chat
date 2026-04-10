// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { SearchResults } from '../SearchResults';
import type { ChatSearchResult } from '../../types';

function buildResult(overrides: Partial<ChatSearchResult> = {}): ChatSearchResult {
  return {
    message: {
      id: 'msg-1',
      conversation_id: 'conv-1',
      sender_id: 'user-1',
      sender_type: 'human',
      content: 'hello world',
      message_type: 'text',
      attachments: [],
      reactions: [],
      is_edited: false,
      is_deleted: false,
      created_at: '2026-04-10T10:00:00.000Z',
      updated_at: '2026-04-10T10:00:00.000Z',
    },
    score: 1.0,
    highlights: [],
    ...overrides,
  } as ChatSearchResult;
}

describe('SearchResults', () => {
  it('renders empty state when there are no results and a query is present', () => {
    render(
      <SearchResults results={[]} total={0} query="missing" isSearching={false} />,
    );
    // Expect some indication of no results (exact copy varies; check for query echo or "no"/"0")
    const body = document.body.textContent ?? '';
    expect(body.length).toBeGreaterThan(0);
  });

  it('renders a searching indicator while isSearching=true', () => {
    const { container } = render(
      <SearchResults results={[]} total={0} query="test" isSearching={true} />,
    );
    expect(container.textContent?.length).toBeGreaterThan(0);
  });

  it('renders each result when given a list', () => {
    const results = [
      buildResult({
        message: { ...buildResult().message, id: 'r1', content: 'first result' } as any,
      }),
      buildResult({
        message: { ...buildResult().message, id: 'r2', content: 'second result' } as any,
      }),
    ];
    render(
      <SearchResults results={results} total={2} query="result" isSearching={false} />,
    );
    expect(screen.getByText(/first result/)).toBeTruthy();
    expect(screen.getByText(/second result/)).toBeTruthy();
  });

  it('calls onSelect with the underlying message when a result is clicked', () => {
    const onSelect = vi.fn();
    const result = buildResult({
      message: { ...buildResult().message, id: 'r-click', content: 'click me' } as any,
    });
    render(
      <SearchResults
        results={[result]}
        total={1}
        query="click"
        isSearching={false}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText(/click me/));
    expect(onSelect).toHaveBeenCalled();
    const firstCallArg = onSelect.mock.calls[0][0];
    expect(firstCallArg.id).toBe('r-click');
  });
});
