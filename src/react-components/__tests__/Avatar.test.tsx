// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { Avatar } from '../Avatar';
import {
  DEFAULT_AVATAR_PALETTE,
  avatarColorFromKey,
  getInitials,
} from '../../shared/avatarInitials';

describe('getInitials', () => {
  it('returns uppercase first + second initials by default', () => {
    expect(getInitials('alice jones')).toBe('AJ');
  });

  it('falls back to one letter for single-word names', () => {
    expect(getInitials('alice')).toBe('A');
  });

  it('honors maxChars=1', () => {
    expect(getInitials('alice jones', 1)).toBe('A');
  });

  it('handles runs of whitespace', () => {
    expect(getInitials('  alice    bob  carol  ')).toBe('AB');
  });

  it('handles empty / nullish input', () => {
    expect(getInitials('')).toBe('');
    expect(getInitials(null)).toBe('');
    expect(getInitials(undefined)).toBe('');
    expect(getInitials('   ')).toBe('');
  });
});

describe('avatarColorFromKey', () => {
  it('returns a stable CSS var reference for the same key', () => {
    const a = avatarColorFromKey('user-123');
    const b = avatarColorFromKey('user-123');
    expect(a).toBe(b);
  });

  it('references one of the 8 palette slots', () => {
    const color = avatarColorFromKey('user-abc');
    expect(color).toMatch(/--sm-avatar-bg-[1-8]/);
  });

  it('packages a hex fallback inside the var() reference', () => {
    const color = avatarColorFromKey('user-abc');
    expect(color).toMatch(/#[0-9a-f]{6}/i);
  });

  it('distributes distinct keys across the palette (not all one slot)', () => {
    const slots = new Set<string>();
    for (let i = 0; i < 64; i += 1) {
      slots.add(avatarColorFromKey(`user-${i}`));
    }
    expect(slots.size).toBeGreaterThan(3);
  });

  it('maps null/undefined keys to slot 1 deterministically', () => {
    expect(avatarColorFromKey(null)).toContain('--sm-avatar-bg-1');
    expect(avatarColorFromKey(undefined)).toContain('--sm-avatar-bg-1');
    expect(avatarColorFromKey('')).toContain('--sm-avatar-bg-1');
  });

  it('honors a custom palette size', () => {
    const color = avatarColorFromKey('user-abc', 4);
    const match = color.match(/--sm-avatar-bg-(\d+)/);
    expect(match).not.toBeNull();
    const slot = match ? Number(match[1]) : 0;
    expect(slot).toBeGreaterThanOrEqual(1);
    expect(slot).toBeLessThanOrEqual(4);
  });

  it('exposes the default palette for inspection', () => {
    expect(DEFAULT_AVATAR_PALETTE).toHaveLength(8);
    for (const hex of DEFAULT_AVATAR_PALETTE) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('<Avatar>', () => {
  it('renders the image when src is provided', () => {
    const { container } = render(
      <Avatar name="Alice Jones" src="https://example.test/a.png" />,
    );
    const img = container.querySelector('img.sm-avatar');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://example.test/a.png');
    expect(img?.getAttribute('alt')).toBe('Alice Jones');
  });

  it('falls back to initials when src is absent', () => {
    const { container } = render(<Avatar name="Alice Jones" />);
    const span = container.querySelector('span.sm-avatar-initials');
    expect(span).toBeTruthy();
    expect(span?.textContent).toBe('AJ');
  });

  it('falls back to "?" when name is also absent', () => {
    const { container } = render(<Avatar />);
    const span = container.querySelector('span.sm-avatar-initials');
    expect(span?.textContent).toBe('?');
  });

  it('swaps to initials on image onError', () => {
    const { container } = render(
      <Avatar name="Alice Jones" src="https://example.test/broken.png" />,
    );
    const img = container.querySelector('img.sm-avatar')!;
    fireEvent.error(img);
    expect(container.querySelector('span.sm-avatar-initials')?.textContent).toBe(
      'AJ',
    );
    expect(container.querySelector('img.sm-avatar')).toBeNull();
  });

  it('uses a stable palette color derived from colorKey', () => {
    const { container: a } = render(<Avatar name="Alice" colorKey="user-1" />);
    const { container: b } = render(<Avatar name="Bob" colorKey="user-1" />);
    const bgA = (
      a.querySelector<HTMLElement>('span.sm-avatar-initials')!
    ).style.background;
    const bgB = (
      b.querySelector<HTMLElement>('span.sm-avatar-initials')!
    ).style.background;
    expect(bgA).toBe(bgB);
  });

  it('accepts a custom size and rounded override', () => {
    const { container } = render(
      <Avatar name="Alice" size={64} rounded="lg" />,
    );
    const span = container.querySelector<HTMLElement>('span.sm-avatar')!;
    expect(span.style.width).toBe('64px');
    expect(span.style.height).toBe('64px');
    expect(span.style.borderRadius).toBe('12px');
  });

  it('wraps content in a button when onClick is provided', () => {
    const onClick = (): void => {};
    const { container } = render(<Avatar name="Alice" onClick={onClick} />);
    expect(container.querySelector('button.sm-avatar-button')).toBeTruthy();
  });

  it('honors initialsMaxChars=1 for compact chat rows', () => {
    const { container } = render(
      <Avatar name="Alice Jones" initialsMaxChars={1} />,
    );
    expect(
      container.querySelector('span.sm-avatar-initials')?.textContent,
    ).toBe('A');
  });
});
