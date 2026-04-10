// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { ReportDialog } from '../ReportDialog';

describe('ReportDialog', () => {
  it('renders the dialog with default reason selected', () => {
    render(
      <ReportDialog messageId="msg-1" onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/Report Message/i)).toBeTruthy();
    // Default reason is "spam"
    const select = screen.getByRole('combobox');
    expect((select as HTMLSelectElement).value).toBe('spam');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <ReportDialog messageId="msg-1" onSubmit={vi.fn()} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSubmit with the reason and description on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ReportDialog messageId="msg-42" onSubmit={onSubmit} onClose={vi.fn()} />,
    );

    // Change reason
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'harassment' } });

    // Type description
    const textarea = screen.getByPlaceholderText(/Provide additional details/);
    fireEvent.change(textarea, { target: { value: 'This message was abusive' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Submit Report/ }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        messageId: 'msg-42',
        reason: 'harassment',
        description: 'This message was abusive',
      });
    });
  });

  it('surfaces error text when onSubmit throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Backend is down'));
    render(
      <ReportDialog messageId="msg-1" onSubmit={onSubmit} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Submit Report/ }));

    await waitFor(() => {
      expect(screen.getByText(/Backend is down/)).toBeTruthy();
    });
  });
});
