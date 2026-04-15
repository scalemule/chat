// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ChannelEditModal } from '../ChannelEditModal';

const initial = {
  name: 'general',
  description: 'Team-wide announcements',
  visibility: 'public' as const,
};

describe('ChannelEditModal', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <ChannelEditModal
        open={false}
        onClose={vi.fn()}
        initial={initial}
        onSave={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the form with initial values', () => {
    render(
      <ChannelEditModal open onClose={vi.fn()} initial={initial} onSave={vi.fn()} />,
    );
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('general');
    expect(
      (screen.getByLabelText('Description') as HTMLTextAreaElement).value,
    ).toBe('Team-wide announcements');
    expect(
      (screen.getByLabelText(/Public/) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('calls onSave with trimmed values and closes on success', async () => {
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(
      <ChannelEditModal
        open
        onClose={onClose}
        initial={initial}
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: '  random  ' },
    });
    fireEvent.click(screen.getByLabelText(/Private/));
    fireEvent.click(screen.getByText('Save'));
    await new Promise((r) => setTimeout(r, 0));
    expect(onSave).toHaveBeenCalledWith({
      name: 'random',
      description: 'Team-wide announcements',
      visibility: 'private',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks save when name is empty', () => {
    const onSave = vi.fn();
    render(
      <ChannelEditModal
        open
        onClose={vi.fn()}
        initial={{ ...initial, name: '' }}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Name is required');
  });

  it('surfaces onSave errors and stays open', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn(async () => {
      throw new Error('Permission denied');
    });
    render(
      <ChannelEditModal open onClose={onClose} initial={initial} onSave={onSave} />,
    );
    fireEvent.click(screen.getByText('Save'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole('alert').textContent).toContain('Permission denied');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the Archive button only when onArchive is provided', () => {
    const { rerender } = render(
      <ChannelEditModal
        open
        onClose={vi.fn()}
        initial={initial}
        onSave={vi.fn()}
      />,
    );
    expect(screen.queryByText('Archive channel')).toBeNull();
    rerender(
      <ChannelEditModal
        open
        onClose={vi.fn()}
        initial={initial}
        onSave={vi.fn()}
        onArchive={vi.fn()}
      />,
    );
    expect(screen.getByText('Archive channel')).toBeTruthy();
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ChannelEditModal
        open
        onClose={onClose}
        initial={initial}
        onSave={vi.fn()}
      />,
    );
    fireEvent.keyDown(container.querySelector('[role="dialog"]')!, {
      key: 'Escape',
    });
    expect(onClose).toHaveBeenCalled();
  });
});
