// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  NewConversationModal,
  type NewConversationUser,
} from '../NewConversationModal';

const ALL_USERS: NewConversationUser[] = [
  { id: 'u1', display_name: 'Alice Smith', username: 'alice' },
  { id: 'u2', display_name: 'Bob Jones', username: 'bob' },
  { id: 'u3', display_name: 'Carol King', username: 'carol' },
  { id: 'me', display_name: 'Current User' },
];

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function makeSearch(tracker: { calls: string[] }) {
  return async (query: string): Promise<NewConversationUser[]> => {
    tracker.calls.push(query);
    const q = query.toLowerCase();
    return ALL_USERS.filter(
      (u) =>
        u.display_name.toLowerCase().includes(q) ||
        (u.username ?? '').toLowerCase().includes(q),
    );
  };
}

describe('NewConversationModal', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <NewConversationModal
        open={false}
        onClose={vi.fn()}
        onCreate={vi.fn(async () => undefined)}
        searchUsers={vi.fn(async () => [])}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('debounces searchUsers and filters out the current user', async () => {
    const tracker = { calls: [] as string[] };
    const searchUsers = makeSearch(tracker);
    render(
      <NewConversationModal
        open
        onClose={vi.fn()}
        onCreate={vi.fn(async () => undefined)}
        searchUsers={searchUsers}
        currentUserId="me"
      />,
    );
    const input = screen.getByPlaceholderText('Search people');
    fireEvent.change(input, { target: { value: 'Curre' } });
    // Not fired yet — debounced.
    expect(tracker.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(250);
    expect(tracker.calls).toEqual(['Curre']);
    // "Current User" matches but is the current user — no result row.
    expect(screen.queryByText('Current User')).toBeNull();
  });

  it('shows matches and selects via Enter → pill appears, input clears', async () => {
    const tracker = { calls: [] as string[] };
    render(
      <NewConversationModal
        open
        onClose={vi.fn()}
        onCreate={vi.fn(async () => undefined)}
        searchUsers={makeSearch(tracker)}
      />,
    );
    const input = screen.getByPlaceholderText('Search people') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'alice' } });
    await vi.advanceTimersByTimeAsync(250);
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter' });
    // Pill appears; input clears.
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(input.value).toBe('');
  });

  it('ArrowDown / ArrowUp navigate results', async () => {
    render(
      <NewConversationModal
        open
        onClose={vi.fn()}
        onCreate={vi.fn(async () => undefined)}
        searchUsers={async () => ALL_USERS.filter((u) => u.id !== 'me')}
      />,
    );
    const input = screen.getByPlaceholderText('Search people');
    fireEvent.change(input, { target: { value: 'a' } });
    await vi.advanceTimersByTimeAsync(250);
    // First option active by default.
    const options = screen.getAllByRole('option');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(options[0].getAttribute('aria-selected')).toBe('true');
  });

  it('Backspace with empty query removes the last pill', async () => {
    render(
      <NewConversationModal
        open
        onClose={vi.fn()}
        onCreate={vi.fn(async () => undefined)}
        searchUsers={async () => [ALL_USERS[0]]}
      />,
    );
    const input = screen.getByPlaceholderText('Search people') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'alice' } });
    await vi.advanceTimersByTimeAsync(250);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(screen.queryByText('Alice Smith')).toBeNull();
  });

  it('Cmd+Enter calls onCreate with the selected ids and closes on resolve', async () => {
    const onCreate = vi.fn(async () => 'new-conv');
    const onClose = vi.fn();
    render(
      <NewConversationModal
        open
        onClose={onClose}
        onCreate={onCreate}
        searchUsers={async () => [ALL_USERS[0], ALL_USERS[1]]}
      />,
    );
    const input = screen.getByPlaceholderText('Search people');
    // Add Alice
    fireEvent.change(input, { target: { value: 'alice' } });
    await vi.advanceTimersByTimeAsync(250);
    fireEvent.keyDown(input, { key: 'Enter' });
    // Add Bob
    fireEvent.change(input, { target: { value: 'bob' } });
    await vi.advanceTimersByTimeAsync(250);
    fireEvent.keyDown(input, { key: 'Enter' });

    await vi.runAllTimersAsync();
    vi.useRealTimers();
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    // Flush pending microtasks for the onCreate promise.
    await new Promise((r) => setTimeout(r, 0));
    expect(onCreate).toHaveBeenCalledWith(['u1', 'u2']);
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <NewConversationModal
        open
        onClose={onClose}
        onCreate={vi.fn(async () => undefined)}
        searchUsers={vi.fn(async () => [])}
      />,
    );
    const dialog = container.querySelector('[role="dialog"]')!;
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('surfaces onCreate errors without closing the modal', async () => {
    vi.useRealTimers();
    const onCreate = vi.fn(async () => {
      throw new Error('Permission denied');
    });
    const onClose = vi.fn();
    render(
      <NewConversationModal
        open
        onClose={onClose}
        onCreate={onCreate}
        searchUsers={async () => [ALL_USERS[0]]}
      />,
    );
    const input = screen.getByPlaceholderText('Search people');
    fireEvent.change(input, { target: { value: 'alice' } });
    await new Promise((r) => setTimeout(r, 300));
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByText('Create'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole('alert').textContent).toContain('Permission denied');
    expect(onClose).not.toHaveBeenCalled();
  });
});
