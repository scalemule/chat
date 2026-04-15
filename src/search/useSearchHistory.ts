import { useCallback, useEffect, useState } from 'react';

import { readJson, writeJson } from '../shared/safeStorage';

export interface SearchHistoryOptions {
  /**
   * localStorage key. Default `'sm-search-history-v1'`. Multi-user hosts
   * should scope this per-account to avoid cross-user query leaks
   * (e.g. `'sm-search-history-v1:' + userId`).
   */
  storageKey?: string;
  /** Maximum entries retained. Default 8. */
  max?: number;
}

export interface SearchHistory {
  history: string[];
  push: (query: string) => void;
  remove: (query: string) => void;
  clear: () => void;
}

const DEFAULT_STORAGE_KEY = 'sm-search-history-v1';
const DEFAULT_MAX = 8;

/**
 * Persists the user's most recent search queries to `localStorage`
 * (falls back silently to in-memory state when storage is unavailable —
 * SSR, private browsing, quota).
 *
 * - `push(q)` trims whitespace, ignores empties, dedupes (an existing
 *   entry is bumped to the top), and caps at `max`.
 * - `remove(q)` removes one entry.
 * - `clear()` empties the history.
 */
export function useSearchHistory(
  opts: SearchHistoryOptions = {},
): SearchHistory {
  const storageKey = opts.storageKey ?? DEFAULT_STORAGE_KEY;
  const max = opts.max ?? DEFAULT_MAX;

  const [history, setHistory] = useState<string[]>(
    () => readJson<string[]>(storageKey) ?? [],
  );

  // Reload when the storage key changes so a logout → re-login UI
  // swap picks up the right set without remounting the host.
  useEffect(() => {
    setHistory(readJson<string[]>(storageKey) ?? []);
  }, [storageKey]);

  useEffect(() => {
    writeJson(storageKey, history);
  }, [history, storageKey]);

  const push = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      setHistory((prev) => {
        const without = prev.filter((q) => q !== trimmed);
        return [trimmed, ...without].slice(0, max);
      });
    },
    [max],
  );

  const remove = useCallback((query: string) => {
    setHistory((prev) => prev.filter((q) => q !== query));
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, push, remove, clear };
}
