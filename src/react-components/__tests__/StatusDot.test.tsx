// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { StatusDot } from '../StatusDot';

describe('StatusDot', () => {
  it('renders an online dot with the online color', () => {
    const { container } = render(<StatusDot status="online" />);
    const dot = container.querySelector<HTMLElement>('.sm-status-dot');
    expect(dot).toBeTruthy();
    expect(dot!.classList.contains('sm-status-dot-online')).toBe(true);
    expect(dot!.getAttribute('aria-label')).toBe('Online');
  });

  it('renders an away dot with amber color + label', () => {
    const { container } = render(<StatusDot status="away" />);
    const dot = container.querySelector<HTMLElement>('.sm-status-dot');
    expect(dot?.classList.contains('sm-status-dot-away')).toBe(true);
    expect(dot?.getAttribute('aria-label')).toBe('Away');
  });

  it('renders an offline dot by default', () => {
    const { container } = render(<StatusDot status="offline" />);
    const dot = container.querySelector<HTMLElement>('.sm-status-dot');
    expect(dot?.classList.contains('sm-status-dot-offline')).toBe(true);
    expect(dot?.getAttribute('aria-label')).toBe('Offline');
  });

  it('treats undefined status the same as offline', () => {
    const { container } = render(<StatusDot status={undefined} />);
    const dot = container.querySelector<HTMLElement>('.sm-status-dot');
    expect(dot?.classList.contains('sm-status-dot-offline')).toBe(true);
  });

  it('renders nothing when offline + showOffline=false', () => {
    const { container } = render(
      <StatusDot status="offline" showOffline={false} />,
    );
    expect(container.querySelector('.sm-status-dot')).toBeNull();
  });

  it('still renders an online dot when showOffline=false', () => {
    const { container } = render(
      <StatusDot status="online" showOffline={false} />,
    );
    expect(container.querySelector('.sm-status-dot-online')).toBeTruthy();
  });

  it('honors size prop', () => {
    const { container } = render(<StatusDot status="online" size={16} />);
    const dot = container.querySelector<HTMLElement>('.sm-status-dot');
    expect(dot?.style.width).toBe('16px');
    expect(dot?.style.height).toBe('16px');
  });

  it('honors custom ariaLabel', () => {
    const { container } = render(
      <StatusDot status="online" ariaLabel="Available for calls" />,
    );
    expect(
      container.querySelector('.sm-status-dot')?.getAttribute('aria-label'),
    ).toBe('Available for calls');
  });
});
