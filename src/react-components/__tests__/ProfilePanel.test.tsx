// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { ProfilePanel } from '../ProfilePanel';

const baseUser = {
  id: 'user-1',
  name: 'Alice Jones',
  email: 'alice@example.test',
};

describe('<ProfilePanel>', () => {
  it('renders header + card content', () => {
    const { container, getByText } = render(
      <ProfilePanel user={baseUser} onClose={() => {}} />,
    );
    expect(container.querySelector('.sm-profile-panel')).toBeTruthy();
    expect(getByText('Profile')).toBeTruthy();
    expect(getByText('Alice Jones')).toBeTruthy();
  });

  it('fires onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ProfilePanel user={baseUser} onClose={onClose} />,
    );
    fireEvent.click(
      container.querySelector('button.sm-profile-panel-close')!,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('omits the back arrow when onBack is not provided', () => {
    const { container } = render(
      <ProfilePanel user={baseUser} onClose={() => {}} />,
    );
    expect(container.querySelector('button.sm-profile-panel-back')).toBeNull();
  });

  it('renders the back arrow and fires onBack when provided', () => {
    const onBack = vi.fn();
    const { container } = render(
      <ProfilePanel user={baseUser} onClose={() => {}} onBack={onBack} />,
    );
    const back = container.querySelector('button.sm-profile-panel-back')!;
    expect(back).toBeTruthy();
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('forwards card-level labels through', () => {
    const { getByText } = render(
      <ProfilePanel
        user={baseUser}
        ownProfile
        onClose={() => {}}
        onEditProfile={() => {}}
        labels={{ edit: 'Modifier' }}
      />,
    );
    expect(getByText('Modifier')).toBeTruthy();
  });

  it('honors panel-level label overrides', () => {
    const { getByText } = render(
      <ProfilePanel
        user={baseUser}
        onClose={() => {}}
        panelLabels={{ title: 'Profil' }}
      />,
    );
    expect(getByText('Profil')).toBeTruthy();
  });
});
