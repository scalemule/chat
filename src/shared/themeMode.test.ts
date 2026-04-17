// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_THEME_STORAGE_KEY,
  applyTheme,
  getFlashPreventionScript,
  readThemeMode,
  resolveThemeMode,
  writeThemeMode,
} from './themeMode';

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

describe('readThemeMode / writeThemeMode', () => {
  let storage: { restore: () => void };

  beforeEach(() => {
    storage = installMemoryStorage();
  });

  afterEach(() => {
    storage.restore();
  });

  it('defaults to "system" when nothing is stored', () => {
    expect(readThemeMode()).toBe('system');
  });

  it('round-trips a valid mode through localStorage', () => {
    writeThemeMode('dark');
    expect(readThemeMode()).toBe('dark');
    writeThemeMode('light');
    expect(readThemeMode()).toBe('light');
  });

  it('falls back to "system" when the stored value is invalid', () => {
    window.localStorage.setItem(DEFAULT_THEME_STORAGE_KEY, 'garbage');
    expect(readThemeMode()).toBe('system');
  });

  it('honors a custom storage key', () => {
    writeThemeMode('dark', 'my-app-theme');
    expect(readThemeMode('my-app-theme')).toBe('dark');
    expect(readThemeMode()).toBe('system');
  });
});

describe('resolveThemeMode', () => {
  const originalMM = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMM;
  });

  it('returns the explicit mode when not "system"', () => {
    expect(resolveThemeMode('dark')).toBe('dark');
    expect(resolveThemeMode('light')).toBe('light');
  });

  it('resolves "system" → dark when prefers-color-scheme is dark', () => {
    window.matchMedia = ((query: string) => ({
      matches: /dark/.test(query),
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      media: query,
      onchange: null,
      dispatchEvent: () => true,
    })) as unknown as typeof window.matchMedia;
    expect(resolveThemeMode('system')).toBe('dark');
  });

  it('resolves "system" → light when prefers-color-scheme is light', () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      media: query,
      onchange: null,
      dispatchEvent: () => true,
    })) as unknown as typeof window.matchMedia;
    expect(resolveThemeMode('system')).toBe('light');
  });
});

describe('applyTheme', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-scheme');
  });

  it('adds the dark class by default when resolved is dark', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('honors the "data" strategy with default attribute', () => {
    applyTheme('dark', { strategy: 'data' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('light', { strategy: 'data' });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('honors a custom attribute / class name', () => {
    applyTheme('dark', {
      strategy: 'data',
      dataAttribute: 'data-scheme',
      darkClassOrAttr: 'night',
    });
    expect(document.documentElement.getAttribute('data-scheme')).toBe('night');

    applyTheme('dark', { strategy: 'class', darkClassOrAttr: 'theme-dark' });
    expect(
      document.documentElement.classList.contains('theme-dark'),
    ).toBe(true);
    document.documentElement.classList.remove('theme-dark');
  });
});

describe('getFlashPreventionScript', () => {
  it('returns a self-executing IIFE string with the default storage key', () => {
    const s = getFlashPreventionScript();
    expect(s.startsWith('(function(){')).toBe(true);
    expect(s.endsWith('})();')).toBe(true);
    expect(s).toContain(JSON.stringify(DEFAULT_THEME_STORAGE_KEY));
    expect(s).toContain("prefers-color-scheme: dark");
  });

  it('encodes a custom storage key + strategy', () => {
    const s = getFlashPreventionScript({
      storageKey: 'app-theme',
      strategy: 'data',
      dataAttribute: 'data-scheme',
      darkClassOrAttr: 'night',
    });
    expect(s).toContain('"app-theme"');
    expect(s).toContain('"data"');
    expect(s).toContain('"data-scheme"');
    expect(s).toContain('"night"');
  });

  it('executes without throwing under eval and applies the class', () => {
    const s = installMemoryStorage();
    try {
      window.localStorage.setItem(DEFAULT_THEME_STORAGE_KEY, 'dark');
      document.documentElement.classList.remove('dark');
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      new Function(getFlashPreventionScript())();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    } finally {
      s.restore();
      document.documentElement.classList.remove('dark');
    }
  });
});
