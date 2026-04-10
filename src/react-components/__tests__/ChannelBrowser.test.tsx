// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const joinChannel = vi.fn(async () => ({ data: null, error: null }));
const leaveChannel = vi.fn(async () => ({ data: null, error: null }));
const createChannel = vi.fn(async () => ({
  data: { id: 'ch-new', name: 'new-channel' },
  error: null,
}));
const refresh = vi.fn();

const channels = [
  {
    id: 'ch-1',
    name: 'general',
    description: 'General',
    visibility: 'public',
    is_member: true,
    member_count: 10,
  },
  {
    id: 'ch-2',
    name: 'random',
    description: 'Off topic',
    visibility: 'public',
    is_member: false,
    member_count: 3,
  },
];

vi.mock('../../react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../react')>();
  return {
    ...actual,
    useChannels: () => ({
      channels,
      isLoading: false,
      joinChannel,
      leaveChannel,
      createChannel,
      refresh,
    }),
  };
});

import { ChannelBrowser } from '../ChannelBrowser';

describe('ChannelBrowser', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <ChannelBrowser open={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders public channels from useChannels when open=true', () => {
    render(<ChannelBrowser open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/general/)).toBeTruthy();
    expect(screen.getByText(/random/)).toBeTruthy();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ChannelBrowser open={true} onClose={onClose} />,
    );
    // Backdrop is the outermost div with the rgba background
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
