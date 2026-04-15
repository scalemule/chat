// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { ActiveCallDot } from '../ActiveCallDot';

describe('ActiveCallDot', () => {
  it('renders nothing when active=false', () => {
    const { container } = render(<ActiveCallDot active={false} />);
    expect(container.querySelector('.sm-active-call-dot')).toBeNull();
  });

  it('renders the dot with default aria-label when active=true', () => {
    const { container } = render(<ActiveCallDot active={true} />);
    const dot = container.querySelector('.sm-active-call-dot');
    expect(dot).toBeTruthy();
    expect(dot?.getAttribute('role')).toBe('status');
    expect(dot?.getAttribute('aria-label')).toBe('Active call');
  });

  it('honors a custom aria-label', () => {
    const { container } = render(
      <ActiveCallDot active={true} ariaLabel="On a call now" />,
    );
    expect(
      container.querySelector('.sm-active-call-dot')?.getAttribute('aria-label'),
    ).toBe('On a call now');
  });

  it('uses a custom size', () => {
    const { container } = render(<ActiveCallDot active={true} size={16} />);
    const dot = container.querySelector<HTMLElement>('.sm-active-call-dot');
    expect(dot?.style.width).toBe('16px');
    expect(dot?.style.height).toBe('16px');
  });
});
