// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';

import {
  useSearchHistory,
  type SearchHistory,
  type SearchHistoryOptions,
} from '../useSearchHistory';

function installMemoryStorage(): { restore: () => void } {
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
    restore: () => {
      if (original) Object.defineProperty(window, 'localStorage', original);
    },
  };
}

let latest: SearchHistory | null = null;
function Probe({ opts }: { opts?: SearchHistoryOptions }): null {
  const h = useSearchHistory(opts);
  React.useEffect(() => {
    latest = h;
  });
  return null;
}

function renderHook(opts?: SearchHistoryOptions) {
  latest = null;
  return render(<Probe opts={opts} />);
}

let installed: ReturnType<typeof installMemoryStorage>;
beforeEach(() => {
  installed = installMemoryStorage();
});
afterEach(() => {
  installed.restore();
});

describe('useSearchHistory', () => {
  it('starts empty when storage has no prior entries', () => {
    renderHook();
    expect(latest!.history).toEqual([]);
  });

  it('push adds a new query at the top', () => {
    renderHook();
    act(() => {
      latest!.push('alpha');
    });
    expect(latest!.history).toEqual(['alpha']);
  });

  it('dedupe: pushing an existing query bumps it to the top', () => {
    renderHook();
    act(() => {
      latest!.push('a');
      latest!.push('b');
      latest!.push('c');
      latest!.push('a');
    });
    expect(latest!.history).toEqual(['a', 'c', 'b']);
  });

  it('trims whitespace and ignores empty strings', () => {
    renderHook();
    act(() => {
      latest!.push('   ');
      latest!.push('  foo  ');
      latest!.push('');
    });
    expect(latest!.history).toEqual(['foo']);
  });

  it('caps at the configured max', () => {
    renderHook({ max: 3 });
    act(() => {
      ['a', 'b', 'c', 'd', 'e'].forEach((q) => latest!.push(q));
    });
    expect(latest!.history).toEqual(['e', 'd', 'c']);
  });

  it('remove drops one entry', () => {
    renderHook();
    act(() => {
      latest!.push('a');
      latest!.push('b');
      latest!.remove('a');
    });
    expect(latest!.history).toEqual(['b']);
  });

  it('clear empties the history', () => {
    renderHook();
    act(() => {
      latest!.push('x');
      latest!.push('y');
      latest!.clear();
    });
    expect(latest!.history).toEqual([]);
  });

  it('persists across mounts with the same storageKey', () => {
    const first = renderHook();
    act(() => {
      latest!.push('keep');
    });
    first.unmount();
    renderHook();
    expect(latest!.history).toEqual(['keep']);
  });

  it('isolates history between distinct storageKeys', () => {
    const first = renderHook({ storageKey: 'sm-search-history-v1:alice' });
    act(() => {
      latest!.push('alice-query');
    });
    first.unmount();
    renderHook({ storageKey: 'sm-search-history-v1:bob' });
    expect(latest!.history).toEqual([]);
  });

  it('tolerates blocked storage (silent in-memory fallback)', () => {
    // Re-install storage that throws on access.
    installed.restore();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    renderHook();
    act(() => {
      latest!.push('no-persist');
    });
    expect(latest!.history).toEqual(['no-persist']);
  });
});
