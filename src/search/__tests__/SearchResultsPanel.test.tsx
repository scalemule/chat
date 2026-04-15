// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { SearchResultsPanel } from '../SearchResultsPanel';
import type { GlobalSearchResult } from '../../types';

function mkResult(
  overrides: Partial<GlobalSearchResult> & {
    id?: string;
    sender?: string;
    conversationId?: string;
    highlight?: string;
  } = {},
): GlobalSearchResult {
  const id = overrides.id ?? 'msg-1';
  const sender = overrides.sender ?? 'u1';
  const conversationId = overrides.conversationId ?? 'c1';
  const highlight = overrides.highlight ?? '<em>match</em>';
  return {
    conversationId,
    message: {
      id,
      content: 'hello',
      message_type: 'text',
      sender_id: sender,
      is_edited: false,
      created_at: '2026-04-15T10:00:00.000Z',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    score: 1,
    highlights: [highlight],
    ...overrides,
  };
}

describe('SearchResultsPanel', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <SearchResultsPanel
        open={false}
        onClose={vi.fn()}
        results={[mkResult()]}
        onSelect={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders rows + highlight excerpt when open', () => {
    const results = [mkResult({ highlight: 'hello <em>world</em>' })];
    render(
      <SearchResultsPanel
        open
        onClose={vi.fn()}
        results={results}
        profiles={new Map([['u1', { display_name: 'Alice' }]])}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Alice')).toBeTruthy();
    // HighlightedExcerpt renders the <em> inside .sm-search-result-excerpt
    expect(document.querySelector('.sm-search-result-excerpt em')?.textContent).toBe('world');
  });

  it('shows the empty state when results.length === 0 and not loading', () => {
    render(
      <SearchResultsPanel
        open
        onClose={vi.fn()}
        results={[]}
        onSelect={vi.fn()}
        emptyState="Nothing found"
      />,
    );
    expect(screen.getByText('Nothing found')).toBeTruthy();
  });

  it('onSelect fires with the full GlobalSearchResult on row click', () => {
    const onSelect = vi.fn();
    const result = mkResult({ id: 'msg-42' });
    render(
      <SearchResultsPanel
        open
        onClose={vi.fn()}
        results={[result]}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(document.querySelector('.sm-search-result-row')!);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].message.id).toBe('msg-42');
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SearchResultsPanel
        open
        onClose={onClose}
        results={[mkResult()]}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.keyDown(container.querySelector('.sm-search-panel-backdrop')!, {
      key: 'Escape',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('backdrop click calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SearchResultsPanel
        open
        onClose={onClose}
        results={[mkResult()]}
        onSelect={vi.fn()}
      />,
    );
    // Click the backdrop (not the panel itself).
    fireEvent.click(container.querySelector('.sm-search-panel-backdrop')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a progress bar while loading', () => {
    render(
      <SearchResultsPanel
        open
        onClose={vi.fn()}
        results={[]}
        onSelect={vi.fn()}
        isLoading
        progress={{ completed: 3, total: 10 }}
      />,
    );
    const bar = document.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.getAttribute('aria-valuenow')).toBe('30');
  });

  it('collapses / expands per-conversation errors', () => {
    render(
      <SearchResultsPanel
        open
        onClose={vi.fn()}
        results={[]}
        onSelect={vi.fn()}
        errors={[
          { conversationId: 'c1', message: 'timeout' },
          { conversationId: 'c2', message: 'forbidden' },
        ]}
      />,
    );
    const toggle = screen.getByRole('button', {
      name: /2 conversations could not be searched/i,
    });
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.getByText(/timeout/)).toBeTruthy();
    expect(screen.getByText(/forbidden/)).toBeTruthy();
  });

  it('uses the renderResult escape hatch when provided', () => {
    const result = mkResult({ id: 'custom-1' });
    render(
      <SearchResultsPanel
        open
        onClose={vi.fn()}
        results={[result]}
        onSelect={vi.fn()}
        renderResult={(r) => (
          <div data-testid={`custom-${r.message.id}`}>CUSTOM</div>
        )}
      />,
    );
    expect(document.querySelector('[data-testid="custom-custom-1"]')?.textContent).toBe('CUSTOM');
    // Default row is not rendered.
    expect(document.querySelector('.sm-search-result-row')).toBeNull();
  });

  it('focus restores to the element focused before open, on close', async () => {
    // Anchor element that will grab focus before the panel opens.
    const { rerender, unmount } = render(
      <>
        <button data-testid="trigger" autoFocus>
          open
        </button>
        <SearchResultsPanel
          open={false}
          onClose={vi.fn()}
          results={[mkResult()]}
          onSelect={vi.fn()}
        />
      </>,
    );
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    rerender(
      <>
        <button data-testid="trigger">open</button>
        <SearchResultsPanel
          open
          onClose={vi.fn()}
          results={[mkResult()]}
          onSelect={vi.fn()}
        />
      </>,
    );
    // Panel snapshotted the trigger. Close it.
    rerender(
      <>
        <button data-testid="trigger">open</button>
        <SearchResultsPanel
          open={false}
          onClose={vi.fn()}
          results={[mkResult()]}
          onSelect={vi.fn()}
        />
      </>,
    );
    // Focus restored to the previously-focused element.
    expect(document.activeElement).toBe(screen.getByTestId('trigger'));
    unmount();
  });
});
