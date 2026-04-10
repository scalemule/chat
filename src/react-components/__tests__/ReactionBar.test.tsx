// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ReactionBar } from '../ReactionBar';
import type { ReactionSummary } from '../../types';

describe('ReactionBar', () => {
  it('renders nothing when given no reactions', () => {
    const { container } = render(
      <ReactionBar reactions={[]} onToggleReaction={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one button per reaction with the emoji and count', () => {
    const reactions: ReactionSummary[] = [
      { emoji: '👍', count: 3, user_ids: ['u1', 'u2', 'u3'] },
      { emoji: '❤️', count: 1, user_ids: ['u1'] },
    ];
    render(<ReactionBar reactions={reactions} onToggleReaction={vi.fn()} />);
    expect(screen.getByText('👍')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('❤️')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('calls onToggleReaction with the emoji when clicked', () => {
    const reactions: ReactionSummary[] = [
      { emoji: '🔥', count: 1, user_ids: ['u1'] },
    ];
    const onToggle = vi.fn();
    render(
      <ReactionBar
        reactions={reactions}
        currentUserId="u1"
        onToggleReaction={onToggle}
      />,
    );
    fireEvent.click(screen.getByText('🔥').closest('button')!);
    expect(onToggle).toHaveBeenCalledWith('🔥');
  });
});
