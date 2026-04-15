/**
 * Default formatter for chat date separators.
 *
 * Labels:
 *   - "Today" / "Yesterday" for diffDays <= 1
 *   - Weekday name (e.g. "Monday") for diffDays in [2, 6]
 *   - "Month Day" (e.g. "Apr 4") for older dates in the current calendar year
 *   - "Month Day, Year" (e.g. "Apr 4, 2025") for dates in prior years
 *
 * Both the message-day and "today" are derived through the same
 * Intl.DateTimeFormat path so a caller-provided `timeZone` is respected on
 * both sides — using `new Date(y, m, d)` local-midnight math would re-introduce
 * server-vs-browser time-zone drift and cause SSR hydration mismatches.
 *
 * `now` is intentionally internal-only so tests can inject a fixed clock.
 */
export interface DateLabelOptions {
  /** Internal: inject a fixed clock for tests. Defaults to `new Date()`. */
  now?: Date;
  /** BCP-47 locale tag. Defaults to runtime default (browser locale). */
  locale?: string;
  /**
   * IANA time-zone identifier (e.g. "America/New_York"). When set, both
   * "today" and the message day are computed in this zone — recommended for
   * SSR hosts to avoid hydration mismatches around midnight boundaries.
   * Defaults to runtime default.
   */
  timeZone?: string;
}

interface YMD {
  year: number;
  month: number;
  day: number;
  weekday: string;
}

function partsToYMD(
  date: Date,
  locale: string | undefined,
  timeZone: string | undefined,
): YMD {
  const fmt = new Intl.DateTimeFormat(locale ?? 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    timeZone,
  });
  const parts = fmt.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  let weekday = '';
  for (const part of parts) {
    if (part.type === 'year') year = Number.parseInt(part.value, 10);
    else if (part.type === 'month') month = Number.parseInt(part.value, 10);
    else if (part.type === 'day') day = Number.parseInt(part.value, 10);
    else if (part.type === 'weekday') weekday = part.value;
  }
  return { year, month, day, weekday };
}

/** Days from (a) to (b), where both are calendar-day triples (no time). */
function diffCalendarDays(a: YMD, b: YMD): number {
  // Use UTC math against the YMD triples — they're already zone-normalized,
  // so this is pure integer arithmetic, not a wall-clock conversion.
  const aMs = Date.UTC(a.year, a.month - 1, a.day);
  const bMs = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bMs - aMs) / (24 * 60 * 60 * 1000));
}

export function defaultFormatDateLabel(
  iso: string,
  opts: DateLabelOptions = {},
): string {
  const { now, locale, timeZone } = opts;
  const messageDate = new Date(iso);
  const todayDate = now ?? new Date();

  const messageYMD = partsToYMD(messageDate, locale, timeZone);
  const todayYMD = partsToYMD(todayDate, locale, timeZone);

  const diffDays = diffCalendarDays(messageYMD, todayYMD);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays >= 2 && diffDays <= 6) return messageYMD.weekday;

  const showYear = messageYMD.year !== todayYMD.year;
  return new Intl.DateTimeFormat(locale ?? 'en-US', {
    month: 'short',
    day: 'numeric',
    year: showYear ? 'numeric' : undefined,
    timeZone,
  }).format(messageDate);
}

/** True iff `a` and `b` fall on the same calendar day in the given zone. */
export function isSameCalendarDay(
  a: string,
  b: string,
  opts: { locale?: string; timeZone?: string } = {},
): boolean {
  const aYMD = partsToYMD(new Date(a), opts.locale, opts.timeZone);
  const bYMD = partsToYMD(new Date(b), opts.locale, opts.timeZone);
  return (
    aYMD.year === bYMD.year &&
    aYMD.month === bYMD.month &&
    aYMD.day === bYMD.day
  );
}
