/**
 * SSR-safe YouTube ID extraction.
 *
 * Matches watch URLs, youtu.be short links, /embed/ links, and /shorts/
 * links. Returns the ordered, de-duplicated list of 11-char video IDs found
 * in `text`. Pure function — no DOM access, safe to import in node.
 */

const YT_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/g;

export function extractYouTubeIds(text: string): string[] {
  if (!text) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  // Strip HTML tags so URL src attributes inside existing iframes don't
  // produce duplicate matches when the message body is HTML.
  const stripped = text.replace(/<[^>]*>/g, ' ');
  // Reset shared regex state.
  YT_URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = YT_URL_RE.exec(stripped)) !== null) {
    const id = m[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
