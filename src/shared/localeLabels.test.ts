import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LANGUAGE_LABELS,
  getLanguageLabel,
} from './localeLabels';

describe('getLanguageLabel', () => {
  it('returns null for empty / nullish input', () => {
    expect(getLanguageLabel(null)).toBeNull();
    expect(getLanguageLabel(undefined)).toBeNull();
    expect(getLanguageLabel('')).toBeNull();
    expect(getLanguageLabel('   ')).toBeNull();
  });

  it('matches exact locale tags in the default map', () => {
    expect(getLanguageLabel('en-US')).toBe('English');
    expect(getLanguageLabel('bg-BG')).toBe('Bulgarian');
    expect(getLanguageLabel('ja-JP')).toBe('Japanese');
  });

  it('prefers a host-supplied map over the default', () => {
    expect(
      getLanguageLabel('en-US', { map: { 'en-US': 'US English' } }),
    ).toBe('US English');
  });

  it('falls back to the default map when a host map misses', () => {
    expect(getLanguageLabel('bg-BG', { map: { 'en-US': 'English' } })).toBe(
      'Bulgarian',
    );
  });

  it('uses Intl.DisplayNames for unknown language prefixes', () => {
    // Arabic isn't in the default map; Intl.DisplayNames should resolve "ar"
    const label = getLanguageLabel('ar-SA');
    expect(label).not.toBeNull();
    expect(typeof label).toBe('string');
    // Should not be the raw locale tag (Intl succeeds)
    expect(label).not.toBe('ar-SA');
  });

  it('honors useIntlFallback=false and uses prefix scan only', () => {
    // Without Intl fallback, "xx-ZZ" has no default match and no prefix
    // match either — should return the raw tag.
    const label = getLanguageLabel('xx-ZZ', { useIntlFallback: false });
    expect(label).toBe('xx-ZZ');
  });

  it('scans the default map by prefix when no exact match and Intl off', () => {
    // "en-AU" isn't in the default map; with Intl off, prefix scan
    // finds "en-US" → "English".
    expect(
      getLanguageLabel('en-AU', { useIntlFallback: false }),
    ).toBe('English');
  });

  it('is case-insensitive on the language prefix', () => {
    // "EN-US" isn't an exact match (exact is "en-US") but Intl + prefix
    // scan should still resolve it.
    const label = getLanguageLabel('EN-US');
    expect(label).not.toBeNull();
  });

  it('exposes the default map for inspection', () => {
    expect(DEFAULT_LANGUAGE_LABELS['en-US']).toBe('English');
    expect(Object.keys(DEFAULT_LANGUAGE_LABELS).length).toBeGreaterThan(5);
  });
});
