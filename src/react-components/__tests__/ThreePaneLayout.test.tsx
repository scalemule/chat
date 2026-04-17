// @vitest-environment jsdom

import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThreePaneLayout } from '../ThreePaneLayout';

describe('<ThreePaneLayout>', () => {
  it('renders sidebar + thread + profile when all three slots are provided', () => {
    const { container, getByText } = render(
      <ThreePaneLayout
        sidebar={<div>side</div>}
        thread={<div>thread</div>}
        profile={<div>profile</div>}
      />,
    );
    expect(getByText('side')).toBeTruthy();
    expect(getByText('thread')).toBeTruthy();
    expect(getByText('profile')).toBeTruthy();
    expect(container.querySelector('.sm-three-pane')).toBeTruthy();
    expect(container.querySelector('.sm-three-pane-sidebar')).toBeTruthy();
    expect(container.querySelector('.sm-three-pane-thread')).toBeTruthy();
    expect(container.querySelector('.sm-three-pane-profile')).toBeTruthy();
  });

  it('renders two-pane layout when profile is omitted', () => {
    const { container, getByText } = render(
      <ThreePaneLayout
        sidebar={<div>side</div>}
        thread={<div>thread</div>}
      />,
    );
    expect(getByText('side')).toBeTruthy();
    expect(getByText('thread')).toBeTruthy();
    expect(container.querySelector('.sm-three-pane-profile')).toBeNull();
  });

  it('honors initial widths on each side pane', () => {
    const { container } = render(
      <ThreePaneLayout
        sidebar={<div>side</div>}
        thread={<div>thread</div>}
        profile={<div>profile</div>}
        sidebarWidth={260}
        profileWidth={340}
      />,
    );
    const sidebarPane = container.querySelector<HTMLElement>(
      '.sm-three-pane-sidebar',
    );
    const profilePane = container.querySelector<HTMLElement>(
      '.sm-three-pane-profile',
    );
    expect(sidebarPane?.style.width).toBe('260px');
    expect(profilePane?.style.width).toBe('340px');
  });

  it('suppresses drag handles when resizable flags are false', () => {
    const { container } = render(
      <ThreePaneLayout
        sidebar={<div>side</div>}
        thread={<div>thread</div>}
        profile={<div>profile</div>}
        sidebarResizable={false}
        profileResizable={false}
      />,
    );
    expect(
      container.querySelectorAll('.sm-resizable-sidebar-handle').length,
    ).toBe(0);
  });

  it('renders exactly one handle per resizable pane', () => {
    const { container } = render(
      <ThreePaneLayout
        sidebar={<div>side</div>}
        thread={<div>thread</div>}
        profile={<div>profile</div>}
      />,
    );
    expect(
      container.querySelectorAll('.sm-resizable-sidebar-handle').length,
    ).toBe(2);
  });
});
