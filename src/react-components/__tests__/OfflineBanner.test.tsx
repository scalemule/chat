// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { ConnectionStatus } from '../../types';

afterEach(() => {
  vi.resetModules();
});

function setup(status: ConnectionStatus): void {
  vi.doMock('../../react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../react')>();
    return {
      ...actual,
      useConnectionStatus: () => ({
        status,
        isOnline: status === 'connected',
        isReconnecting: status === 'reconnecting',
      }),
    };
  });
}

describe('OfflineBanner', () => {
  it('renders nothing when the connection is online', async () => {
    setup('connected');
    const { OfflineBanner } = await import('../OfflineBanner');
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the default English message when offline', async () => {
    setup('disconnected');
    const { OfflineBanner } = await import('../OfflineBanner');
    render(<OfflineBanner />);
    expect(screen.getByText('You are offline')).toBeTruthy();
  });

  it('renders during reconnect attempts (status !== connected)', async () => {
    setup('reconnecting');
    const { OfflineBanner } = await import('../OfflineBanner');
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('honors children override', async () => {
    setup('disconnected');
    const { OfflineBanner } = await import('../OfflineBanner');
    render(<OfflineBanner>Sin conexión</OfflineBanner>);
    expect(screen.getByText('Sin conexión')).toBeTruthy();
    expect(screen.queryByText('You are offline')).toBeNull();
  });

  it('renders a dismiss button when onDismiss is provided', async () => {
    setup('disconnected');
    const { OfflineBanner } = await import('../OfflineBanner');
    const onDismiss = vi.fn();
    const { rerender } = render(<OfflineBanner />);
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
    rerender(<OfflineBanner onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('exposes the .sm-offline-banner class hook', async () => {
    setup('disconnected');
    const { OfflineBanner } = await import('../OfflineBanner');
    const { container } = render(<OfflineBanner />);
    expect(container.querySelector('.sm-offline-banner')).toBeTruthy();
  });
});
