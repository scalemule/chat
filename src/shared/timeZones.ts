/**
 * Time-zone helpers used by the profile components.
 *
 * React-free, SSR-safe. All functions tolerate `Intl.supportedValuesOf`
 * being unavailable (older Node, some browsers) and fall back cleanly.
 */

export interface TimeZoneOption {
  value: string;
  label: string;
  offsetMinutes: number;
}

/**
 * Compute the current UTC offset in minutes for a named IANA time zone.
 * Falls back to `0` (UTC) when the zone is invalid or the platform
 * can't resolve it.
 */
export function getTimeZoneOffsetMinutes(
  timeZone: string,
  date: Date = new Date(),
): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(date);
    const part = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    const match = part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return 0;
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3] ?? '0', 10);
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

/**
 * Format a signed minute offset as a GMT±HH:MM string.
 */
export function formatGmtOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Enumerate every IANA time zone the runtime knows about and annotate
 * each with a human-readable label + current offset. Sorted by offset
 * then by tz id, so dropdowns render in a natural west-to-east order.
 *
 * On platforms without `Intl.supportedValuesOf`, falls back to a
 * minimal list of `['UTC']` so callers can still render a dropdown.
 * Hosts that need a richer fallback pass a custom zone list through
 * the `zones` parameter.
 */
export function getAllTimeZones(zones?: string[]): TimeZoneOption[] {
  let list: string[] = zones ?? [];
  if (!zones) {
    try {
      const IntlAny = Intl as unknown as {
        supportedValuesOf?: (key: string) => string[];
      };
      if (typeof IntlAny.supportedValuesOf === 'function') {
        list = IntlAny.supportedValuesOf('timeZone');
      }
    } catch {
      // fall through to ['UTC']
    }
    if (list.length === 0) list = ['UTC'];
  }

  const options = list.map<TimeZoneOption>((tz) => {
    const offsetMinutes = getTimeZoneOffsetMinutes(tz);
    return {
      value: tz,
      label: `(GMT${formatGmtOffset(offsetMinutes)}) ${tz.replace(/_/g, ' ')}`,
      offsetMinutes,
    };
  });

  options.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) {
      return a.offsetMinutes - b.offsetMinutes;
    }
    return a.value.localeCompare(b.value);
  });

  return options;
}

/**
 * Format the current clock in a given time zone (e.g. "2:30 PM").
 *
 * Returns `null` for empty / nullish input, or when the time zone is
 * invalid on the current platform.
 */
export function formatLocalTime(
  timeZone: string | null | undefined,
  opts?: {
    /** BCP-47 locale used by `Intl.DateTimeFormat`. Default `"en-US"`. */
    locale?: string;
    /** Override the "now" timestamp. Default `new Date()`. */
    now?: Date;
    /** Use 12-hour clock. Default `true`. */
    hour12?: boolean;
  },
): string | null {
  if (!timeZone) return null;
  const tz = String(timeZone).trim();
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat(opts?.locale ?? 'en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: opts?.hour12 ?? true,
    }).format(opts?.now ?? new Date());
  } catch {
    return null;
  }
}
