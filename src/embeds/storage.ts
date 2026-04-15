/**
 * Best-effort `localStorage` accessor.
 *
 * Returns `null` when storage is unavailable for any reason — SSR (no
 * `window`), private-browsing modes that throw on access, sandboxed iframes,
 * extension storage policies, or quota errors. Callers MUST treat a `null`
 * return as a cache miss and proceed without persistence.
 *
 * The probe write is intentionally cheap and key-namespaced so it can't
 * collide with host-app storage.
 */
const PROBE_KEY = '__sm_yt_storage_probe__';

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

export interface CachedTitle {
  title: string;
  fetchedAt: number;
}

const KEY_PREFIX = 'sm-yt-oembed-v1:';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function readCachedTitle(videoId: string): string | null {
  const s = safeStorage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY_PREFIX + videoId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTitle | null;
    if (!parsed || typeof parsed.title !== 'string') return null;
    if (typeof parsed.fetchedAt !== 'number') return null;
    if (Date.now() - parsed.fetchedAt > TTL_MS) return null;
    return parsed.title;
  } catch {
    return null;
  }
}

export function writeCachedTitle(videoId: string, title: string): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(
      KEY_PREFIX + videoId,
      JSON.stringify({ title, fetchedAt: Date.now() } satisfies CachedTitle),
    );
  } catch {
    // Quota or serialization failure — silent. Cache is best-effort.
  }
}
