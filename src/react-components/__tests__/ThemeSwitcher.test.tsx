// @vitest-environment jsdom

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeSwitcher } from '../ThemeSwitcher';
import { DEFAULT_THEME_STORAGE_KEY } from '../../shared/themeMode';

function installMemoryStorage(): { restore: () => void } {
  const store = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    } as Storage,
  });
  return {
    restore: () => {
      if (original) Object.defineProperty(window, 'localStorage', original);
    },
  };
}

describe('<ThemeSwitcher>', () => {
  let storage: { restore: () => void };

  beforeEach(() => {
    storage = installMemoryStorage();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    storage.restore();
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders three labeled buttons and marks system as active by default', () => {
    const { getByLabelText } = render(<ThemeSwitcher />);
    const light = getByLabelText('Light');
    const dark = getByLabelText('Dark');
    const system = getByLabelText('System');
    expect(light.getAttribute('aria-pressed')).toBe('false');
    expect(dark.getAttribute('aria-pressed')).toBe('false');
    expect(system.getAttribute('aria-pressed')).toBe('true');
  });

  it('applies the dark class to <html> when Dark is clicked', () => {
    const { getByLabelText } = render(<ThemeSwitcher />);
    act(() => {
      fireEvent.click(getByLabelText('Dark'));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(DEFAULT_THEME_STORAGE_KEY)).toBe('dark');
  });

  it('removes the dark class when Light is clicked', () => {
    const { getByLabelText } = render(<ThemeSwitcher />);
    act(() => {
      fireEvent.click(getByLabelText('Dark'));
    });
    act(() => {
      fireEvent.click(getByLabelText('Light'));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(DEFAULT_THEME_STORAGE_KEY)).toBe('light');
  });

  it('honors label overrides', () => {
    const { getByLabelText } = render(
      <ThemeSwitcher
        labels={{ light: 'Claire', dark: 'Sombre', system: 'Auto' }}
      />,
    );
    expect(getByLabelText('Claire')).toBeTruthy();
    expect(getByLabelText('Sombre')).toBeTruthy();
    expect(getByLabelText('Auto')).toBeTruthy();
  });

  it('honors iconOnly (hides text labels)', () => {
    const { container, getByLabelText } = render(<ThemeSwitcher iconOnly />);
    const light = getByLabelText('Light');
    expect(light.textContent).toBe('');
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('delegates rendering to the render prop when provided', () => {
    const { getByText } = render(
      <ThemeSwitcher
        render={(ctx) => (
          <button onClick={ctx.cycleMode} aria-label="toggle">
            {ctx.mode}
          </button>
        )}
      />,
    );
    expect(getByText('system')).toBeTruthy();
  });

  it('honors the data attribute strategy', () => {
    const { getByLabelText } = render(<ThemeSwitcher strategy="data" />);
    act(() => {
      fireEvent.click(getByLabelText('Dark'));
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
