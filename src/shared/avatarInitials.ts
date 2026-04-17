/**
 * Pure helpers for avatar initials + deterministic palette color.
 *
 * React-free, SSR-safe. Used by `<Avatar>` in the main React entry and by
 * any host that wants to compute initials or a stable background color
 * (e.g. to render a matching inline avatar outside the SDK).
 */

const DEFAULT_AVATAR_PALETTE_SIZE = 8;

/**
 * Extract initials from a display name.
 *
 * - `"Alice Jones"` → `"AJ"` (default `maxChars=2`)
 * - `"alice"`       → `"A"`
 * - `""` / nullish  → `""` — caller should fall back to a placeholder
 *
 * Whitespace is normalized; extra runs of spaces never produce empty
 * initials. Only the first two non-empty name parts are considered.
 */
export function getInitials(
  name: string | null | undefined,
  maxChars: 1 | 2 = 2,
): string {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (maxChars === 1 || parts.length === 1) {
    return (parts[0][0] ?? '').toUpperCase();
  }
  const first = parts[0][0] ?? '';
  const second = parts[1][0] ?? '';
  return (first + second).toUpperCase();
}

/**
 * Simple, stable 32-bit hash (djb2 variant). Deterministic across
 * runtimes; same input → same index. Not cryptographic.
 */
function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return h >>> 0; // force unsigned
}

/**
 * Deterministically pick one of 8 palette slots based on `key`.
 *
 * Returned as a CSS value referencing `--sm-avatar-bg-{1..8}` tokens,
 * falling back to a packaged hex so hosts that skip the SDK theme CSS
 * still see distinct colors. Pass a stable key (user id is ideal — the
 * color stays consistent even if the display name changes).
 */
export function avatarColorFromKey(
  key: string | null | undefined,
  paletteSize: number = DEFAULT_AVATAR_PALETTE_SIZE,
): string {
  const size = Math.max(1, Math.floor(paletteSize));
  const safeKey = key ?? '';
  const idx = safeKey ? hashString(safeKey) % size : 0;
  const fallback = DEFAULT_AVATAR_PALETTE[idx] ?? DEFAULT_AVATAR_PALETTE[0];
  return `var(--sm-avatar-bg-${idx + 1}, ${fallback})`;
}

/**
 * Default foreground (initials) color for avatars. References the
 * `--sm-avatar-text` token with a white fallback.
 */
export function avatarTextColor(): string {
  return 'var(--sm-avatar-text, #ffffff)';
}

/**
 * Default 8-color palette fallbacks. Host themes override these via
 * `--sm-avatar-bg-1` through `--sm-avatar-bg-8`. Colors picked for WCAG
 * AA contrast against white text.
 */
export const DEFAULT_AVATAR_PALETTE: readonly string[] = [
  '#2563eb', // blue
  '#9333ea', // purple
  '#0891b2', // teal
  '#db2777', // pink
  '#ea580c', // orange
  '#059669', // emerald
  '#ca8a04', // amber
  '#4f46e5', // indigo
];
