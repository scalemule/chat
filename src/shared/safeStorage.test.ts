// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { safeStorage, readJson, writeJson } from './safeStorage';

function installMemoryStorage(): { restore: () => void; store: Map<string, string> } {
  const store = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    } as Storage,
  });
  return {
    store,
    restore: () => {
      if (original) Object.defineProperty(window, 'localStorage', original);
    },
  };
}

describe('safeStorage', () => {
  let installed: ReturnType<typeof installMemoryStorage>;
  beforeEach(() => { installed = installMemoryStorage(); });
  afterEach(() => { installed.restore(); });

  it('returns the in-memory storage when available', () => {
    expect(safeStorage()).not.toBeNull();
  });

  it('returns null when localStorage access throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('blocked'); },
    });
    expect(safeStorage()).toBeNull();
  });
});

describe('readJson / writeJson', () => {
  let installed: ReturnType<typeof installMemoryStorage>;
  beforeEach(() => { installed = installMemoryStorage(); });
  afterEach(() => { installed.restore(); });

  it('round-trips a JSON-serializable value', () => {
    writeJson('k', { a: 1, b: ['x', 'y'] });
    expect(readJson<{ a: number; b: string[] }>('k')).toEqual({
      a: 1,
      b: ['x', 'y'],
    });
  });

  it('returns null for missing keys', () => {
    expect(readJson('does-not-exist')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    window.localStorage.setItem('bad', '{not json');
    expect(readJson('bad')).toBeNull();
  });

  it('does not throw when setItem itself throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => { throw new Error('quota exceeded'); },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      } as Storage,
    });
    expect(() => writeJson('k', { a: 1 })).not.toThrow();
  });
});
