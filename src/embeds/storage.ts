// Re-export the shared safeStorage so existing callers (and tests) keep
// importing from `./storage`. Implementation moved to `shared/` in 0.0.47.
export { safeStorage } from '../shared/safeStorage';
import { safeStorage } from '../shared/safeStorage';

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
