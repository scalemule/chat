// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { WidgetConfigEditor } from '../WidgetConfigEditor';
import type { RepClient } from '../../rep';
import type { SupportWidgetConfig } from '../../support';

const BASE_CONFIG: SupportWidgetConfig = {
  title: 'Support',
  subtitle: 'How can we help?',
  primary_color: '#2563eb',
  position: 'right',
  pre_chat_fields: [],
  business_hours: {},
  realtime_enabled: true,
  welcome_message: 'Hi there!',
  offline_message: 'We are offline.',
  reps_online: true,
  online_count: 2,
};

function buildMockRepClient(overrides?: Partial<SupportWidgetConfig>): RepClient {
  return {
    getWidgetConfig: vi.fn(async () => ({
      data: { ...BASE_CONFIG, ...overrides },
      error: null,
    })),
    updateWidgetConfig: vi.fn(async (patch) => ({
      data: { ...BASE_CONFIG, ...patch },
      error: null,
    })),
  } as unknown as RepClient;
}

describe('WidgetConfigEditor', () => {
  it('shows loading state before config arrives', () => {
    const repClient = {
      getWidgetConfig: vi.fn(() => new Promise(() => { /* never resolves */ })),
    } as unknown as RepClient;
    render(<WidgetConfigEditor repClient={repClient} />);
    expect(screen.getByText(/Loading widget configuration/)).toBeTruthy();
  });

  it('renders all 3 tabs after loading', async () => {
    const repClient = buildMockRepClient();
    render(<WidgetConfigEditor repClient={repClient} />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Appearance' })).toBeTruthy();
    });
    expect(screen.getByRole('tab', { name: 'Content' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Behavior' })).toBeTruthy();
  });

  it('populates appearance tab with fetched config', async () => {
    const repClient = buildMockRepClient({ title: 'Custom Title' });
    render(<WidgetConfigEditor repClient={repClient} />);

    await waitFor(() => {
      const titleInput = screen.getByDisplayValue('Custom Title');
      expect(titleInput).toBeTruthy();
    });
  });

  it('enables save button only after edits are made', async () => {
    const repClient = buildMockRepClient();
    const { container } = render(<WidgetConfigEditor repClient={repClient} />);

    await waitFor(() => screen.getByDisplayValue('Support'));

    const saveButton = screen.getByRole('button', { name: /Save/ });
    // Initially no changes → save disabled
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    // Edit title → save enabled
    const titleInput = screen.getByDisplayValue('Support');
    fireEvent.change(titleInput, { target: { value: 'Support (edited)' } });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);

    // container is not null — satisfies the linter
    expect(container).toBeTruthy();
  });

  it('calls repClient.updateWidgetConfig with only the changed fields on save', async () => {
    const repClient = buildMockRepClient();
    render(<WidgetConfigEditor repClient={repClient} />);

    await waitFor(() => screen.getByDisplayValue('Support'));

    // Edit title
    const titleInput = screen.getByDisplayValue('Support');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });

    // Click save
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => {
      expect(repClient.updateWidgetConfig).toHaveBeenCalledWith({
        title: 'New Title',
      });
    });
  });

  it('switches tabs without losing unsaved edits', async () => {
    const repClient = buildMockRepClient();
    render(<WidgetConfigEditor repClient={repClient} />);

    await waitFor(() => screen.getByDisplayValue('Support'));

    // Edit title on Appearance tab
    const titleInput = screen.getByDisplayValue('Support');
    fireEvent.change(titleInput, { target: { value: 'Tabbed Title' } });

    // Switch to Content tab
    fireEvent.click(screen.getByRole('tab', { name: 'Content' }));
    expect(screen.getByDisplayValue('Hi there!')).toBeTruthy();

    // Switch back to Appearance — edited value should still be there
    fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
    expect(screen.getByDisplayValue('Tabbed Title')).toBeTruthy();
  });
});
