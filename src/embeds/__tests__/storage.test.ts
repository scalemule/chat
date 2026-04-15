// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readCachedTitle, writeCachedTitle, safeStorage } from '../storage';

// jsdom's localStorage shape varies across Node versions in this repo's
// vitest setup (we've seen `setItem is not a function` on some runs).
// Install a deterministic in-memory Storage shim so the tests exercise
// our wrapper, not jsdom internals.
function installMemoryStorage(): { restore: () => void; store: Map<string, string> } {
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
    store,
    restore: () => {
      if (original) Object.defineProperty(window, 'localStorage', original);
    },
  };
}

describe('safeStorage / readCachedTitle / writeCachedTitle', () => {
  let installed: ReturnType<typeof installMemoryStorage>;

  beforeEach(() => {
    installed = installMemoryStorage();
  });

  afterEach(() => {
    installed.restore();
  });

  it('round-trips a title through localStorage', () => {
    writeCachedTitle('vid-abc', 'Hello world');
    expect(readCachedTitle('vid-abc')).toBe('Hello world');
  });

  it('returns null for an unknown id', () => {
    expect(readCachedTitle('missing-id')).toBeNull();
  });

  it('returns null when the cached payload is malformed', () => {
    window.localStorage.setItem('sm-yt-oembed-v1:vid-bad', 'not-json');
    expect(readCachedTitle('vid-bad')).toBeNull();
  });

  it('returns null when the cache entry is past TTL', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(
      'sm-yt-oembed-v1:vid-stale',
      JSON.stringify({ title: 'Stale', fetchedAt: eightDaysAgo }),
    );
    expect(readCachedTitle('vid-stale')).toBeNull();
  });

  it('does not throw when localStorage.setItem itself throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('quota exceeded');
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      } as Storage,
    });
    expect(() => writeCachedTitle('vid-quota', 'x')).not.toThrow();
  });

  it('returns null from safeStorage when localStorage access throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    expect(safeStorage()).toBeNull();
    expect(readCachedTitle('vid-x')).toBeNull();
  });
});
