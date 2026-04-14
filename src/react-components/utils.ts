const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function formatMessageTime(value?: string): string {
  if (!value) return '';
  return timeFormatter.format(new Date(value));
}

export function formatDayLabel(value?: string): string {
  if (!value) return '';
  return dateFormatter.format(new Date(value));
}

/**
 * Count Unicode scalar values (code points) in a string.
 *
 * Matches Rust's `chars().count()` — used to keep frontend length checks in sync
 * with backend `MaxLengthValidator`. JavaScript's `string.length` returns UTF-16
 * code units, which double-counts emoji and many non-BMP characters.
 *
 * Example:
 *   "😀".length === 2          (UTF-16 code units)
 *   countCodePoints("😀") === 1 (Unicode scalars, matches Rust)
 */
export function countCodePoints(value: string): number {
  return Array.from(value).length;
}

export function isSameDay(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}
