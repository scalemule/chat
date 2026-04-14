// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { MentionMenu } from '../MentionMenu';
import { ChannelMentionMenu } from '../ChannelMentionMenu';

describe('MentionMenu', () => {
  it('renders nothing when users list is empty', () => {
    const { container } = render(
      <MentionMenu
        users={[]}
        selectedIndex={0}
        position={{ top: 0, left: 0 }}
        onSelect={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders display_name / email / id in that precedence', () => {
    const onSelect = vi.fn();
    render(
      <MentionMenu
        users={[
          { id: 'u1', display_name: 'Alice' },
          { id: 'u2', email: 'bob@example.com' },
          { id: 'u3-long-uuid-here' },
        ]}
        selectedIndex={0}
        position={{ top: 0, left: 0 }}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('bob@example.com')).toBeTruthy();
    // Falls back to first 8 chars of id
    expect(screen.getByText('u3-long-')).toBeTruthy();
  });

  it('highlights the selected index', () => {
    const { container } = render(
      <MentionMenu
        users={[
          { id: 'u1', display_name: 'A' },
          { id: 'u2', display_name: 'B' },
        ]}
        selectedIndex={1}
        position={{ top: 0, left: 0 }}
        onSelect={() => {}}
      />,
    );
    const items = container.querySelectorAll('.sm-mention-menu-item');
    expect(items[0].className).not.toContain('sm-mention-menu-item-active');
    expect(items[1].className).toContain('sm-mention-menu-item-active');
  });

  it('fires onSelect on mousedown', () => {
    const onSelect = vi.fn();
    render(
      <MentionMenu
        users={[{ id: 'u1', display_name: 'Alice' }]}
        selectedIndex={0}
        position={{ top: 0, left: 0 }}
        onSelect={onSelect}
      />,
    );
    fireEvent.mouseDown(screen.getByText('Alice'));
    expect(onSelect).toHaveBeenCalledWith({ id: 'u1', display_name: 'Alice' });
  });

  it('shows online/offline dot based on is_online', () => {
    const { container } = render(
      <MentionMenu
        users={[
          { id: 'u1', display_name: 'A', is_online: true },
          { id: 'u2', display_name: 'B', is_online: false },
        ]}
        selectedIndex={0}
        position={{ top: 0, left: 0 }}
        onSelect={() => {}}
      />,
    );
    const dots = container.querySelectorAll('.sm-mention-status-dot');
    expect(dots.length).toBe(2);
    expect(dots[0].className).not.toContain('sm-mention-status-dot-offline');
    expect(dots[1].className).toContain('sm-mention-status-dot-offline');
  });
});

describe('ChannelMentionMenu', () => {
  it('renders lock icon for private channels, hash for public', () => {
    const { container } = render(
      <ChannelMentionMenu
        channels={[
          { id: 'c1', name: 'general', visibility: 'public' },
          { id: 'c2', name: 'secret', visibility: 'private' },
        ]}
        selectedIndex={0}
        position={{ top: 0, left: 0 }}
        onSelect={() => {}}
      />,
    );
    expect(container.querySelectorAll('.sm-channel-mention-hash').length).toBe(1);
    expect(container.querySelectorAll('.sm-channel-mention-icon svg').length).toBe(1);
  });

  it('renders member_count as meta when provided', () => {
    render(
      <ChannelMentionMenu
        channels={[{ id: 'c1', name: 'general', member_count: 42 }]}
        selectedIndex={0}
        position={{ top: 0, left: 0 }}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('42')).toBeTruthy();
  });
});
