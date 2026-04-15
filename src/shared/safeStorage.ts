/**
 * Best-effort `localStorage` accessor.
 *
 * Returns `null` when storage is unavailable for any reason — SSR (no
 * `window`), private-browsing modes that throw on access, sandboxed
 * iframes, extension storage policies, or quota errors. Callers MUST
 * treat a `null` return as a cache miss and proceed without persistence.
 *
 * The probe write is intentionally cheap and key-namespaced so it can't
 * collide with host-app storage.
 *
 * Originally introduced for the YouTube oEmbed cache (0.0.44). Promoted
 * to `src/shared/` in 0.0.47 so other features (e.g. ConversationList
 * section-collapse persistence) can reuse it without circularly depending
 * on the embeds entry.
 */
const PROBE_KEY = '__sm_storage_probe__';

export function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = window.localStorage;
    s.setItem(PROBE_KEY, '1');
    s.removeItem(PROBE_KEY);
    return s;
  } catch {
    return null;
  }
}

/** Read + JSON.parse a key. Returns `null` on missing/blocked/malformed. */
export function readJson<T>(key: string): T | null {
  const s = safeStorage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** JSON.stringify + write. Silent no-op on failure. */
export function writeJson(key: string, value: unknown): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / serialization failure — silent. Persistence is best-effort.
  }
}
