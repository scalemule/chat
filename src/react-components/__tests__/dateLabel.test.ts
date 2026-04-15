import { describe, expect, it } from 'vitest';

import {
  defaultFormatDateLabel,
  isSameCalendarDay,
} from '../dateLabel';

const NY = 'America/New_York';

// Pin "now" to noon UTC on a fixed date so day-boundary math is unambiguous.
// 2026-04-14 12:00 UTC = 2026-04-14 08:00 in America/New_York.
const NOW = new Date('2026-04-14T12:00:00.000Z');

function iso(yyyy: number, mm: number, dd: number, hh = 12): string {
  const m = String(mm).padStart(2, '0');
  const d = String(dd).padStart(2, '0');
  const h = String(hh).padStart(2, '0');
  return `${yyyy}-${m}-${d}T${h}:00:00.000Z`;
}

describe('defaultFormatDateLabel', () => {
  it('returns "Today" for the same calendar day in the requested zone', () => {
    expect(
      defaultFormatDateLabel(iso(2026, 4, 14), {
        now: NOW,
        timeZone: NY,
        locale: 'en-US',
      }),
    ).toBe('Today');
  });

  it('returns "Yesterday" for the previous calendar day', () => {
    expect(
      defaultFormatDateLabel(iso(2026, 4, 13), {
        now: NOW,
        timeZone: NY,
        locale: 'en-US',
      }),
    ).toBe('Yesterday');
  });

  it('returns the weekday name for messages 2-6 days back', () => {
    // 2026-04-14 NY is a Tuesday. 2 days back = Sunday.
    expect(
      defaultFormatDateLabel(iso(2026, 4, 12), {
        now: NOW,
        timeZone: NY,
        locale: 'en-US',
      }),
    ).toBe('Sunday');

    // 6 days back from Tue 2026-04-14 = Wednesday 2026-04-08.
    expect(
      defaultFormatDateLabel(iso(2026, 4, 8), {
        now: NOW,
        timeZone: NY,
        locale: 'en-US',
      }),
    ).toBe('Wednesday');
  });

  it('returns "Mon Day" for older dates in the current calendar year', () => {
    // 7 days back, still 2026 — falls past the weekday window.
    const label = defaultFormatDateLabel(iso(2026, 4, 7), {
      now: NOW,
      timeZone: NY,
      locale: 'en-US',
    });
    expect(label).toBe('Apr 7');
  });

  it('returns "Mon Day, Year" for dates in prior years', () => {
    const label = defaultFormatDateLabel(iso(2025, 12, 25), {
      now: NOW,
      timeZone: NY,
      locale: 'en-US',
    });
    expect(label).toBe('Dec 25, 2025');
  });

  it('respects timeZone for the day boundary', () => {
    // 2026-04-14 03:00 UTC is still 2026-04-13 in New York.
    // Without timeZone, behavior depends on the runtime TZ — so we assert
    // the *zoned* result against a fixed "now" placed mid-day NY time.
    const earlyMorningUtc = '2026-04-14T03:00:00.000Z'; // 23:00 NY on 04-13
    expect(
      defaultFormatDateLabel(earlyMorningUtc, {
        now: NOW,
        timeZone: NY,
        locale: 'en-US',
      }),
    ).toBe('Yesterday');
  });
});

describe('isSameCalendarDay', () => {
  it('treats two timestamps on the same NY calendar day as equal', () => {
    expect(
      isSameCalendarDay(
        '2026-04-14T13:00:00.000Z', // 09:00 NY
        '2026-04-14T22:00:00.000Z', // 18:00 NY
        { timeZone: NY, locale: 'en-US' },
      ),
    ).toBe(true);
  });

  it('treats a UTC-late / NY-previous-day timestamp as different', () => {
    expect(
      isSameCalendarDay(
        '2026-04-14T03:00:00.000Z', // 23:00 NY on 04-13
        '2026-04-14T22:00:00.000Z', // 18:00 NY on 04-14
        { timeZone: NY, locale: 'en-US' },
      ),
    ).toBe(false);
  });
});
