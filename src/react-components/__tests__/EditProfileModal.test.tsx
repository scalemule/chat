// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';

import { EditProfileModal } from '../EditProfileModal';

const baseInitial = {
  fullName: 'Alice Jones',
  email: 'alice@example.test',
  locale: 'en-US',
  timeZone: 'UTC',
};

describe('<EditProfileModal>', () => {
  it('renders title, read-only email, and initial name value', () => {
    const { getByText, getByLabelText, container } = render(
      <EditProfileModal
        initialValues={baseInitial}
        onSave={async () => {}}
        onClose={() => {}}
        languages={[{ value: 'en-US', label: 'English' }]}
      />,
    );
    expect(getByText('Edit profile')).toBeTruthy();
    const nameInput = getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Alice Jones');
    const email = container.querySelector(
      'input[type="email"]',
    ) as HTMLInputElement;
    expect(email.value).toBe('alice@example.test');
    expect(email.readOnly).toBe(true);
  });

  it('calls onSave with trimmed values from the form', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { getByLabelText, getByText } = render(
      <EditProfileModal
        initialValues={baseInitial}
        onSave={onSave}
        onClose={onClose}
        languages={[
          { value: 'en-US', label: 'English' },
          { value: 'fr-FR', label: 'French' },
        ]}
      />,
    );
    fireEvent.change(getByLabelText('Name'), {
      target: { value: '  Alice Edited  ' },
    });
    fireEvent.change(getByLabelText('Language'), {
      target: { value: 'fr-FR' },
    });
    await act(async () => {
      fireEvent.click(getByText('Save'));
    });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave).toHaveBeenCalledWith({
      fullName: 'Alice Edited',
      locale: 'fr-FR',
      timeZone: 'UTC',
    });
  });

  it('renders onSave error in an alert without closing', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network is down'));
    const onClose = vi.fn();
    const { getByText, container } = render(
      <EditProfileModal
        initialValues={baseInitial}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    await act(async () => {
      fireEvent.click(getByText('Save'));
    });
    await waitFor(() => {
      expect(container.querySelector('[role="alert"]')).toBeTruthy();
    });
    expect(
      container.querySelector('[role="alert"]')?.textContent,
    ).toContain('Network is down');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    const { container } = render(
      <EditProfileModal
        initialValues={baseInitial}
        onSave={async () => {}}
        onClose={onClose}
      />,
    );
    const dialog = container.querySelector('[role="dialog"]')!;
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <EditProfileModal
        initialValues={baseInitial}
        onSave={async () => {}}
        onClose={onClose}
      />,
    );
    const backdrop = container.querySelector(
      '.sm-edit-profile-backdrop',
    )!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when clicking inside the modal', () => {
    const onClose = vi.fn();
    const { container } = render(
      <EditProfileModal
        initialValues={baseInitial}
        onSave={async () => {}}
        onClose={onClose}
      />,
    );
    const dialog = container.querySelector('[role="dialog"]')!;
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a spinner when loading=true and hides form fields', () => {
    const { container, queryByLabelText } = render(
      <EditProfileModal
        initialValues={undefined}
        onSave={async () => {}}
        onClose={() => {}}
        loading
      />,
    );
    expect(queryByLabelText('Name')).toBeNull();
    expect(container.querySelector('[aria-label="Loading…"]')).toBeTruthy();
  });

  it('hides the language select when no languages are provided', () => {
    const { queryByLabelText } = render(
      <EditProfileModal
        initialValues={baseInitial}
        onSave={async () => {}}
        onClose={() => {}}
      />,
    );
    expect(queryByLabelText('Language')).toBeNull();
  });

  it('hides the email row when email is not supplied', () => {
    const { container } = render(
      <EditProfileModal
        initialValues={{ fullName: 'Alice', locale: 'en-US', timeZone: 'UTC' }}
        onSave={async () => {}}
        onClose={() => {}}
      />,
    );
    expect(container.querySelector('input[type="email"]')).toBeNull();
  });

  it('honors i18n label overrides', () => {
    const { getByText } = render(
      <EditProfileModal
        initialValues={baseInitial}
        onSave={async () => {}}
        onClose={() => {}}
        labels={{ title: 'Profil éditer', save: 'Enregistrer' }}
      />,
    );
    expect(getByText('Profil éditer')).toBeTruthy();
    expect(getByText('Enregistrer')).toBeTruthy();
  });
});
