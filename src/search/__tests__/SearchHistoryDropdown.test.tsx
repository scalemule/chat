// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { SearchHistoryDropdown } from '../SearchHistoryDropdown';

describe('SearchHistoryDropdown', () => {
  it('renders each history entry as an option', () => {
    render(
      <SearchHistoryDropdown
        history={['alpha', 'beta', 'gamma']}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('option').length).toBe(3);
    expect(screen.getByText('alpha')).toBeTruthy();
  });

  it('renders the empty state when history is empty', () => {
    render(
      <SearchHistoryDropdown
        history={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('No recent searches')).toBeTruthy();
  });

  it('marks the first entry active by default', () => {
    render(
      <SearchHistoryDropdown
        history={['a', 'b']}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const opts = screen.getAllByRole('option');
    expect(opts[0].getAttribute('aria-selected')).toBe('true');
    expect(opts[1].getAttribute('aria-selected')).toBe('false');
  });

  it('ArrowDown / ArrowUp walk entries (wrapping)', () => {
    const { container } = render(
      <SearchHistoryDropdown
        history={['a', 'b', 'c']}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const dropdown = container.querySelector('.sm-search-history-dropdown')!;
    fireEvent.keyDown(dropdown, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(dropdown, { key: 'ArrowDown' });
    fireEvent.keyDown(dropdown, { key: 'ArrowDown' });
    // Wraps back to index 0.
    expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(dropdown, { key: 'ArrowUp' });
    // Wraps up to the last.
    expect(screen.getAllByRole('option')[2].getAttribute('aria-selected')).toBe('true');
  });

  it('Enter selects the active entry', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <SearchHistoryDropdown
        history={['alpha', 'beta']}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    const dropdown = container.querySelector('.sm-search-history-dropdown')!;
    fireEvent.keyDown(dropdown, { key: 'ArrowDown' });
    fireEvent.keyDown(dropdown, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('beta');
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SearchHistoryDropdown
        history={['x']}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(
      container.querySelector('.sm-search-history-dropdown')!,
      { key: 'Escape' },
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('click selects the clicked entry', () => {
    const onSelect = vi.fn();
    render(
      <SearchHistoryDropdown
        history={['one', 'two']}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('two'));
    expect(onSelect).toHaveBeenCalledWith('two');
  });

  it('renders the Clear recent footer only when onClear is provided and history is non-empty', () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <SearchHistoryDropdown
        history={['x']}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText('Clear recent')).toBeNull();
    rerender(
      <SearchHistoryDropdown
        history={['x']}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onClear={onClear}
      />,
    );
    fireEvent.click(screen.getByText('Clear recent'));
    expect(onClear).toHaveBeenCalled();
    // With empty history the footer is suppressed even when onClear is set.
    rerender(
      <SearchHistoryDropdown
        history={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onClear={onClear}
      />,
    );
    expect(screen.queryByText('Clear recent')).toBeNull();
  });

  it('supports a controlled activeIndex', () => {
    const onChange = vi.fn();
    render(
      <SearchHistoryDropdown
        history={['a', 'b', 'c']}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        activeIndex={2}
        onActiveIndexChange={onChange}
      />,
    );
    expect(screen.getAllByRole('option')[2].getAttribute('aria-selected')).toBe('true');
  });
});
