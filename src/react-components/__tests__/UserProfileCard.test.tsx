// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { UserProfileCard } from '../UserProfileCard';

const baseUser = {
  id: 'user-1',
  name: 'Alice Jones',
  email: 'alice@example.test',
};

describe('<UserProfileCard>', () => {
  it('renders name + email contact row by default', () => {
    const { container, getByText } = render(
      <UserProfileCard user={baseUser} />,
    );
    expect(getByText('Alice Jones')).toBeTruthy();
    expect(getByText('alice@example.test')).toBeTruthy();
    // Edit button hidden by default (read-only view).
    expect(container.querySelector('.sm-profile-card')).toBeTruthy();
    expect(
      container.querySelector('button.sm-profile-card-upload'),
    ).toBeNull();
  });

  it('shows the edit button only when ownProfile + onEditProfile are set', () => {
    const onEdit = vi.fn();
    const { getByText, rerender } = render(
      <UserProfileCard user={baseUser} ownProfile onEditProfile={onEdit} />,
    );
    fireEvent.click(getByText('Edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);

    // ownProfile=false → no edit button
    rerender(<UserProfileCard user={baseUser} onEditProfile={onEdit} />);
    expect(() => getByText('Edit')).toThrow();
  });

  it('wires the upload button to onUploadAvatar via hidden file input', () => {
    const onUpload = vi.fn();
    const { container } = render(
      <UserProfileCard user={baseUser} ownProfile onUploadAvatar={onUpload} />,
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('hides the upload button entirely when ownProfile=false', () => {
    const { container } = render(<UserProfileCard user={baseUser} />);
    expect(
      container.querySelector('button.sm-profile-card-upload'),
    ).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('renders a local-time row when timeZone is provided', () => {
    const { container } = render(
      <UserProfileCard user={{ ...baseUser, timeZone: 'UTC' }} />,
    );
    const meta = container.querySelectorAll('.sm-profile-card-meta');
    const texts = Array.from(meta).map((m) => m.textContent ?? '');
    expect(texts.some((t) => /local time/.test(t))).toBe(true);
  });

  it('renders a language row when locale is provided', () => {
    const { container } = render(
      <UserProfileCard user={{ ...baseUser, locale: 'en-US' }} />,
    );
    const meta = container.querySelectorAll('.sm-profile-card-meta');
    const texts = Array.from(meta).map((m) => m.textContent ?? '');
    expect(texts.some((t) => /English/.test(t))).toBe(true);
  });

  it('honors a custom language label map', () => {
    const { container } = render(
      <UserProfileCard
        user={{ ...baseUser, locale: 'en-US' }}
        languageLabelMap={{ 'en-US': 'US English' }}
      />,
    );
    const texts = Array.from(
      container.querySelectorAll('.sm-profile-card-meta'),
    ).map((m) => m.textContent ?? '');
    expect(texts.some((t) => /US English/.test(t))).toBe(true);
  });

  it('renders the online/away status dot only when isOnline is supplied', () => {
    const { container, rerender, getByText } = render(
      <UserProfileCard user={baseUser} isOnline={true} />,
    );
    expect(getByText('Active')).toBeTruthy();

    rerender(<UserProfileCard user={baseUser} isOnline={false} />);
    expect(getByText('Away')).toBeTruthy();

    rerender(<UserProfileCard user={baseUser} />);
    expect(container.querySelector('.sm-profile-card-status')?.textContent).toBe(
      '',
    );
  });

  it('falls back to email as name when name is empty', () => {
    const { getAllByText } = render(
      <UserProfileCard user={{ id: 'u', email: 'x@y.test' }} />,
    );
    // Appears twice: header name + contact email row.
    expect(getAllByText('x@y.test').length).toBeGreaterThanOrEqual(2);
  });

  it('honors i18n label overrides', () => {
    const { getByText } = render(
      <UserProfileCard
        user={baseUser}
        ownProfile
        onEditProfile={() => {}}
        labels={{ edit: 'Modifier' }}
      />,
    );
    expect(getByText('Modifier')).toBeTruthy();
  });
});
