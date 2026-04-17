// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { CallTriggerGroup } from '../CallTriggerGroup';

describe('CallTriggerGroup', () => {
  it('renders both audio and video buttons by default', () => {
    render(
      <CallTriggerGroup
        conversationId="conv-1"
        onCallRequested={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /audio/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /video/i })).toBeTruthy();
  });

  it('fires onCallRequested with the correct call type', () => {
    const onCall = vi.fn();
    render(
      <CallTriggerGroup conversationId="c1" onCallRequested={onCall} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /audio/i }));
    expect(onCall).toHaveBeenCalledWith('c1', 'audio');
    fireEvent.click(screen.getByRole('button', { name: /video/i }));
    expect(onCall).toHaveBeenCalledWith('c1', 'video');
  });

  it('hides audio when hideAudio=true', () => {
    render(
      <CallTriggerGroup
        conversationId="c1"
        onCallRequested={vi.fn()}
        hideAudio
      />,
    );
    expect(screen.queryByRole('button', { name: /audio/i })).toBeNull();
    expect(screen.getByRole('button', { name: /video/i })).toBeTruthy();
  });

  it('hides video when hideVideo=true', () => {
    render(
      <CallTriggerGroup
        conversationId="c1"
        onCallRequested={vi.fn()}
        hideVideo
      />,
    );
    expect(screen.getByRole('button', { name: /audio/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /video/i })).toBeNull();
  });

  it('disables both buttons when disabled=true', () => {
    render(
      <CallTriggerGroup
        conversationId="c1"
        onCallRequested={vi.fn()}
        disabled
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.every((b) => b.hasAttribute('disabled'))).toBe(true);
  });

  it('carries the .sm-call-trigger-group class', () => {
    const { container } = render(
      <CallTriggerGroup conversationId="c1" onCallRequested={vi.fn()} />,
    );
    expect(container.querySelector('.sm-call-trigger-group')).toBeTruthy();
  });
});
