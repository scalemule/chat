import { describe, expect, it } from 'vitest';

import {
  formatGmtOffset,
  formatLocalTime,
  getAllTimeZones,
  getTimeZoneOffsetMinutes,
} from './timeZones';

describe('getTimeZoneOffsetMinutes', () => {
  it('returns 0 for UTC', () => {
    expect(getTimeZoneOffsetMinutes('UTC')).toBe(0);
  });

  it('returns 0 for an invalid zone without throwing', () => {
    expect(getTimeZoneOffsetMinutes('Nowhere/Nope')).toBe(0);
  });

  it('returns a non-zero offset for a fixed western zone', () => {
    // Pacific/Honolulu is fixed UTC-10; offset should be -600 minutes.
    expect(getTimeZoneOffsetMinutes('Pacific/Honolulu')).toBe(-600);
  });

  it('honors a half-hour offset (Asia/Kolkata is UTC+5:30)', () => {
    expect(getTimeZoneOffsetMinutes('Asia/Kolkata')).toBe(330);
  });
});

describe('formatGmtOffset', () => {
  it('formats positive offsets with a leading plus', () => {
    expect(formatGmtOffset(330)).toBe('+05:30');
  });

  it('formats negative offsets with a leading minus', () => {
    expect(formatGmtOffset(-480)).toBe('-08:00');
  });

  it('formats zero as +00:00', () => {
    expect(formatGmtOffset(0)).toBe('+00:00');
  });

  it('pads single-digit hour components', () => {
    expect(formatGmtOffset(60)).toBe('+01:00');
  });
});

describe('getAllTimeZones', () => {
  it('returns a non-empty array', () => {
    const zones = getAllTimeZones();
    expect(zones.length).toBeGreaterThan(0);
  });

  it('sorts by offset then by zone id', () => {
    const zones = getAllTimeZones();
    for (let i = 1; i < Math.min(zones.length, 50); i += 1) {
      const prev = zones[i - 1];
      const curr = zones[i];
      expect(
        curr.offsetMinutes > prev.offsetMinutes ||
          (curr.offsetMinutes === prev.offsetMinutes &&
            curr.value.localeCompare(prev.value) >= 0),
      ).toBe(true);
    }
  });

  it('labels each zone with a GMT offset and a prettified id', () => {
    const zones = getAllTimeZones();
    const sample = zones.find((z) => z.value.includes('/'));
    expect(sample).toBeTruthy();
    expect(sample?.label).toMatch(/^\(GMT[+-]\d{2}:\d{2}\)/);
    // Underscores in the zone id are replaced with spaces.
    expect(sample?.label).not.toMatch(/_/);
  });

  it('accepts a host-supplied zone list', () => {
    const zones = getAllTimeZones(['UTC', 'America/New_York']);
    expect(zones).toHaveLength(2);
    expect(zones.some((z) => z.value === 'UTC')).toBe(true);
  });
});

describe('formatLocalTime', () => {
  const fixed = new Date('2026-04-17T18:30:00Z');

  it('returns null for empty / nullish input', () => {
    expect(formatLocalTime(null)).toBeNull();
    expect(formatLocalTime(undefined)).toBeNull();
    expect(formatLocalTime('')).toBeNull();
    expect(formatLocalTime('   ')).toBeNull();
  });

  it('returns null for an invalid zone instead of throwing', () => {
    expect(formatLocalTime('Nowhere/Nope', { now: fixed })).toBeNull();
  });

  it('formats UTC as a 12-hour clock by default', () => {
    const s = formatLocalTime('UTC', { now: fixed });
    expect(s).not.toBeNull();
    expect(s).toMatch(/6:30\s?PM/);
  });

  it('honors hour12=false', () => {
    const s = formatLocalTime('UTC', { now: fixed, hour12: false });
    expect(s).toMatch(/18:30/);
  });

  it('applies the supplied locale', () => {
    // "en-GB" formats 24-hour by default, but we're passing hour12:true
    // so the number should still be 6:30.
    const s = formatLocalTime('UTC', { now: fixed, locale: 'en-GB' });
    expect(s).toMatch(/6:30/);
  });
});
