// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { LinkTooltip, LinkEditModal } from '../LinkTooltip';

describe('LinkTooltip', () => {
  const sampleData = {
    url: 'https://example.com',
    text: 'Example',
    index: 0,
    length: 7,
    top: 0,
    left: 0,
  };

  it('renders URL and text', () => {
    render(
      <LinkTooltip
        data={sampleData}
        onClose={() => {}}
        onEdit={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText('Example')).toBeTruthy();
    expect(screen.getByText('https://example.com')).toBeTruthy();
  });

  it('fires onEdit when Edit is clicked', () => {
    const onEdit = vi.fn();
    render(
      <LinkTooltip
        data={sampleData}
        onClose={() => {}}
        onEdit={onEdit}
        onRemove={() => {}}
      />,
    );
    fireEvent.mouseDown(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalled();
  });

  it('fires onRemove when Remove is clicked', () => {
    const onRemove = vi.fn();
    render(
      <LinkTooltip
        data={sampleData}
        onClose={() => {}}
        onEdit={() => {}}
        onRemove={onRemove}
      />,
    );
    fireEvent.mouseDown(screen.getByText('Remove'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('URL anchor opens in a new tab with safe rel', () => {
    render(
      <LinkTooltip
        data={sampleData}
        onClose={() => {}}
        onEdit={() => {}}
        onRemove={() => {}}
      />,
    );
    const a = screen.getByText('https://example.com') as HTMLAnchorElement;
    expect(a.target).toBe('_blank');
    expect(a.rel).toContain('noopener');
    expect(a.rel).toContain('noreferrer');
  });
});

describe('LinkEditModal', () => {
  it('save button is disabled when URL is empty', () => {
    render(
      <LinkEditModal
        initialText=""
        initialUrl=""
        onCancel={() => {}}
        onSave={() => {}}
      />,
    );
    const save = screen.getByText('Save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it('calls onSave with trimmed values', () => {
    const onSave = vi.fn();
    render(
      <LinkEditModal
        initialText="click me"
        initialUrl="https://example.com  "
        onCancel={() => {}}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('click me', 'https://example.com');
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <LinkEditModal
        initialText="x"
        initialUrl="https://x.com"
        onCancel={onCancel}
        onSave={() => {}}
      />,
    );
    const backdrop = container.querySelector('.sm-rich-link-modal-backdrop')!;
    fireEvent.keyDown(backdrop, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});
