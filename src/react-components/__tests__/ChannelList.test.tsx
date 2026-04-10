// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the hook used by ChannelList. vi.mock is hoisted before the import of
// ChannelList below, so ChannelList will resolve useChannels to our stub.
const joinChannel = vi.fn(async () => ({ data: null, error: null }));
const leaveChannel = vi.fn(async () => ({ data: null, error: null }));
const createChannel = vi.fn(async () => ({ data: null, error: null }));
const refresh = vi.fn();

const channelsState = {
  channels: [
    {
      id: 'ch-1',
      name: 'general',
      description: 'General discussion',
      visibility: 'public',
      is_member: true,
      member_count: 12,
    },
    {
      id: 'ch-2',
      name: 'random',
      description: 'Off topic',
      visibility: 'public',
      is_member: false,
      member_count: 5,
    },
  ],
  isLoading: false,
};

vi.mock('../../react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../react')>();
  return {
    ...actual,
    useChannels: () => ({
      channels: channelsState.channels,
      isLoading: channelsState.isLoading,
      joinChannel,
      leaveChannel,
      createChannel,
      refresh,
    }),
  };
});

import { ChannelList } from '../ChannelList';

describe('ChannelList', () => {
  it('renders the channels returned by useChannels', () => {
    render(<ChannelList />);
    expect(screen.getByText(/general/)).toBeTruthy();
    expect(screen.getByText(/random/)).toBeTruthy();
  });

  it('filters channels by the search input', () => {
    render(<ChannelList />);
    const search = screen.getByPlaceholderText(/Search channels/);
    fireEvent.change(search, { target: { value: 'general' } });
    expect(screen.getByText(/general/)).toBeTruthy();
    // "random" should no longer appear in the filtered list
    expect(screen.queryByText(/random/)).toBeNull();
  });

  it('renders a custom title when provided', () => {
    render(<ChannelList title="My Channels" />);
    expect(screen.getByText('My Channels')).toBeTruthy();
  });

  it('renders a Create button and wires onCreateChannel when shown', () => {
    const onCreateChannel = vi.fn();
    render(
      <ChannelList showCreateButton onCreateChannel={onCreateChannel} />,
    );
    const createButton = screen.getByRole('button', { name: /\+ New/ });
    fireEvent.click(createButton);
    expect(onCreateChannel).toHaveBeenCalled();
  });
});
