// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { CallButton } from '../CallButton';

describe('CallButton', () => {
  beforeEach(() => {
    // Stub navigator.mediaDevices.getUserMedia — jsdom doesn't implement it
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [],
        })),
      },
    });
  });

  it('renders with default video call type', () => {
    render(<CallButton conversationId="conv-1" />);
    // Button should be in the document
    expect(document.querySelector('button')).toBeTruthy();
  });

  it('supports custom children', () => {
    render(
      <CallButton conversationId="conv-1">
        <span data-testid="custom-label">Start Video</span>
      </CallButton>,
    );
    expect(screen.getByTestId('custom-label')).toBeTruthy();
  });

  it('is disabled when disabled prop is true', () => {
    render(<CallButton conversationId="conv-1" disabled />);
    const button = document.querySelector('button');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not fire onCallStarted when disabled', () => {
    const onCallStarted = vi.fn();
    render(
      <CallButton
        conversationId="conv-1"
        disabled
        onCallStarted={onCallStarted}
      />,
    );
    const button = document.querySelector('button');
    fireEvent.click(button!);
    expect(onCallStarted).not.toHaveBeenCalled();
  });
});
