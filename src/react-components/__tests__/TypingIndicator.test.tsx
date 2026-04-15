// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { TypingIndicator } from '../TypingIndicator';

describe('TypingIndicator', () => {
  it('renders nothing when no users are typing', () => {
    const { container } = render(<TypingIndicator typingUsers={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Someone is typing..." for one user when no resolver is provided', () => {
    const { getByText } = render(<TypingIndicator typingUsers={['u1']} />);
    expect(getByText(/Someone is typing/)).toBeTruthy();
  });

  it('shows "<Name> is typing..." when a resolver is provided', () => {
    const { getByText } = render(
      <TypingIndicator
        typingUsers={['u1']}
        resolveUserName={(id) => (id === 'u1' ? 'Alice' : 'Unknown')}
      />,
    );
    expect(getByText(/Alice is typing/)).toBeTruthy();
  });

  it('pluralizes two names with "and"', () => {
    const { getByText } = render(
      <TypingIndicator
        typingUsers={['u1', 'u2']}
        resolveUserName={(id) => (id === 'u1' ? 'Alice' : 'Bob')}
      />,
    );
    expect(getByText(/Alice and Bob are typing/)).toBeTruthy();
  });

  it('uses Oxford comma for three names', () => {
    const names: Record<string, string> = { u1: 'Alice', u2: 'Bob', u3: 'Carol' };
    const { getByText } = render(
      <TypingIndicator
        typingUsers={['u1', 'u2', 'u3']}
        resolveUserName={(id) => names[id] ?? 'Unknown'}
      />,
    );
    expect(getByText(/Alice, Bob, and Carol are typing/)).toBeTruthy();
  });

  it('collapses trailing names into "and N others" past maxNames', () => {
    const names: Record<string, string> = { u1: 'A', u2: 'B', u3: 'C', u4: 'D', u5: 'E' };
    const { getByText } = render(
      <TypingIndicator
        typingUsers={['u1', 'u2', 'u3', 'u4', 'u5']}
        resolveUserName={(id) => names[id] ?? 'Unknown'}
      />,
    );
    expect(getByText(/A, B, C, and 2 others are typing/)).toBeTruthy();
  });

  it('uses singular "other" when exactly one name overflows maxNames', () => {
    const names: Record<string, string> = { u1: 'A', u2: 'B', u3: 'C', u4: 'D' };
    const { getByText } = render(
      <TypingIndicator
        typingUsers={['u1', 'u2', 'u3', 'u4']}
        resolveUserName={(id) => names[id] ?? 'Unknown'}
      />,
    );
    expect(getByText(/A, B, C, and 1 other are typing/)).toBeTruthy();
  });

  it('always collapses to count when isLargeRoom is true', () => {
    const { getByText } = render(
      <TypingIndicator
        typingUsers={['u1', 'u2']}
        resolveUserName={(id) => (id === 'u1' ? 'Alice' : 'Bob')}
        isLargeRoom
      />,
    );
    expect(getByText(/2 people typing/)).toBeTruthy();
  });

  it('respects a custom maxNames with the "N others" collapse', () => {
    const { getByText } = render(
      <TypingIndicator
        typingUsers={['u1', 'u2']}
        resolveUserName={(id) => (id === 'u1' ? 'Alice' : 'Bob')}
        maxNames={1}
      />,
    );
    expect(getByText(/Alice and 1 other are typing/)).toBeTruthy();
  });

  it('invokes formatTyping override with the resolved name list', () => {
    const { getByText } = render(
      <TypingIndicator
        typingUsers={['u1', 'u2']}
        resolveUserName={(id) => (id === 'u1' ? 'Alice' : 'Bob')}
        formatTyping={(names) => `${names.length} typing: ${names.join(' / ')}`}
      />,
    );
    expect(getByText('2 typing: Alice / Bob')).toBeTruthy();
  });

  it('accepts a locale override for Intl.ListFormat', () => {
    // German conjunction list formatter yields "Alice und Bob" (not
    // "Alice and Bob"). The surrounding "is/are typing" sentence stays
    // English until formatTyping is wired.
    const { getByText } = render(
      <TypingIndicator
        typingUsers={['u1', 'u2']}
        resolveUserName={(id) => (id === 'u1' ? 'Alice' : 'Bob')}
        locale="de-DE"
      />,
    );
    expect(getByText(/Alice und Bob are typing/)).toBeTruthy();
  });

  it('reserves height when alwaysReserveHeight=true and nobody is typing', () => {
    const { container } = render(
      <TypingIndicator typingUsers={[]} alwaysReserveHeight />,
    );
    const el = container.querySelector<HTMLElement>('.sm-typing-indicator');
    expect(el).toBeTruthy();
    expect(el?.style.visibility).toBe('hidden');
  });
});
