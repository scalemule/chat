// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const searchFn = vi.fn(async () => undefined);
const clearSearch = vi.fn();

const searchState = {
  results: [] as unknown[],
  total: 0,
  query: '',
  isSearching: false,
};

vi.mock('../../react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../react')>();
  return {
    ...actual,
    useSearch: () => ({
      results: searchState.results,
      total: searchState.total,
      query: searchState.query,
      isSearching: searchState.isSearching,
      search: searchFn,
      clearSearch,
    }),
  };
});

import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
  it('renders a search input', () => {
    render(<SearchBar conversationId="conv-1" />);
    expect(screen.getByPlaceholderText(/Search/i)).toBeTruthy();
  });

  it('calls search on form submit with the trimmed query', () => {
    searchFn.mockClear();
    const { container } = render(<SearchBar conversationId="conv-1" />);
    const input = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(input, { target: { value: '  hello  ' } });

    // Submit the form (Enter key or button click)
    const form = container.querySelector('form');
    fireEvent.submit(form!);

    expect(searchFn).toHaveBeenCalledWith('hello');
  });

  it('accepts a custom placeholder', () => {
    render(
      <SearchBar conversationId="conv-1" placeholder="Find a message..." />,
    );
    expect(screen.getByPlaceholderText('Find a message...')).toBeTruthy();
  });
});
