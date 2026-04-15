/**
 * SSR-safe URL detection for plain-text chat messages.
 *
 * Given a string, returns an array of segments — either plain string runs
 * or detected URL spans. React-free; no DOM access; safe to import in node /
 * server environments and from the React-free root entry.
 *
 * The matcher is intentionally conservative:
 *   - http/https/www-prefixed URLs only (no bare domains, no mailto:);
 *   - common punctuation that follows a URL in prose is excluded from the
 *     match (`,`, `.`, `;`, `:`, `!`, `?`, `)`, `]`, closing quotes);
 *   - "www." matches get prefixed with `https://` for the href.
 *
 * Hosts that need a different policy (matching mailto:, tel:, custom
 * schemes, or bare domains) should pre-process the message and pass it
 * through their own renderer instead.
 */
export interface LinkifyTextSegment {
  type: 'text';
  value: string;
}

export interface LinkifyLinkSegment {
  type: 'link';
  /** Display text exactly as it appeared in the source string. */
  display: string;
  /** Resolved href (always carries an explicit scheme). */
  url: string;
}

export type LinkifySegment = LinkifyTextSegment | LinkifyLinkSegment;

// Trailing punctuation that should not be considered part of a URL when it
// appears at the end of a match (mirrors GitHub-flavored autolink behavior).
const TRAILING_PUNCT_RE = /[.,;:!?)\]'"”’»]+$/;

// Match http(s)://… or www.… URLs greedily on non-whitespace, then trim.
// We use a single regex with the `g` flag and walk matches.
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

/** Strip trailing punctuation that's clearly prose, not URL syntax. */
function trimTrailingPunctuation(raw: string): string {
  // Don't strip trailing `)` if there's an unbalanced `(` inside the URL.
  // Simple heuristic: only trim when paren counts agree.
  let out = raw;
  for (;;) {
    const trimmed = out.replace(TRAILING_PUNCT_RE, '');
    if (trimmed === out) break;
    const trimmedChar = out[out.length - 1];
    if (trimmedChar === ')' || trimmedChar === ']') {
      const open = trimmedChar === ')' ? '(' : '[';
      const opens = (trimmed.match(new RegExp(`\\${open}`, 'g')) ?? []).length;
      const closes = (trimmed.match(new RegExp(`\\${trimmedChar}`, 'g')) ?? []).length;
      if (closes >= opens) {
        out = trimmed;
        continue;
      }
      break;
    }
    out = trimmed;
  }
  return out;
}

function ensureScheme(display: string): string {
  if (/^https?:\/\//i.test(display)) return display;
  return `https://${display}`;
}

/**
 * Split `text` into plain-text and link segments.
 *
 * Always returns at least one segment for non-empty input. Empty input
 * returns an empty array.
 */
export function linkify(text: string): LinkifySegment[] {
  if (!text) return [];

  const segments: LinkifySegment[] = [];
  let cursor = 0;
  // Reset regex state — `g` flag means `lastIndex` is shared.
  URL_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(text)) !== null) {
    const raw = match[0];
    const display = trimTrailingPunctuation(raw);
    if (!display) continue;

    const matchStart = match.index;
    if (matchStart > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, matchStart) });
    }
    segments.push({
      type: 'link',
      display,
      url: ensureScheme(display),
    });
    cursor = matchStart + display.length;
    URL_RE.lastIndex = cursor;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', value: text.slice(cursor) });
  }

  return segments;
}

/**
 * Convenience predicate. Useful when a host wants to decide whether a
 * message needs the link-aware renderer at all.
 */
export function hasLinks(text: string): boolean {
  if (!text) return false;
  URL_RE.lastIndex = 0;
  return URL_RE.test(text);
}
