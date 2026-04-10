// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ChatInput } from '../ChatInput';

describe('ChatInput — renderSendButton escape hatch', () => {
  it('renders the default send button when renderSendButton is not passed', () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByLabelText('Send message')).toBeTruthy();
  });

  it('calls renderSendButton with canSend/disabled/onSend', () => {
    const renderSendButton = vi.fn(
      ({ canSend, disabled, onSend }: { canSend: boolean; disabled: boolean; onSend: () => void }) => (
        <button
          type="button"
          data-testid="custom-send"
          data-can-send={String(canSend)}
          data-disabled={String(disabled)}
          onClick={onSend}
        >
          SEND
        </button>
      ),
    );

    render(<ChatInput onSend={vi.fn()} renderSendButton={renderSendButton} />);

    expect(renderSendButton).toHaveBeenCalled();
    const btn = screen.getByTestId('custom-send');
    // Empty input → canSend=false
    expect(btn.getAttribute('data-can-send')).toBe('false');
    expect(btn.getAttribute('data-disabled')).toBe('false');

    // Default send button should NOT render in parallel
    expect(screen.queryByLabelText('Send message')).toBeNull();
  });

  it('passes canSend=true after the user types', () => {
    const onSend = vi.fn();
    const renderSendButton = vi.fn(
      ({ canSend, onSend: handleSend }: { canSend: boolean; onSend: () => void }) => (
        <button
          type="button"
          data-testid="custom-send"
          data-can-send={String(canSend)}
          onClick={handleSend}
        >
          SEND
        </button>
      ),
    );

    render(<ChatInput onSend={onSend} renderSendButton={renderSendButton} />);

    const textarea = screen.getByPlaceholderText(/Type a message/);
    fireEvent.change(textarea, { target: { value: 'hi there' } });

    // After typing, the latest call to renderSendButton should have canSend=true
    const calls = renderSendButton.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[0].canSend).toBe(true);
  });

  it('respects the disabled prop', () => {
    const renderSendButton = vi.fn(
      ({ disabled }: { disabled: boolean }) => (
        <button
          type="button"
          data-testid="custom-send"
          data-disabled={String(disabled)}
        >
          SEND
        </button>
      ),
    );

    render(<ChatInput onSend={vi.fn()} disabled renderSendButton={renderSendButton} />);
    expect(screen.getByTestId('custom-send').getAttribute('data-disabled')).toBe('true');
  });
});
