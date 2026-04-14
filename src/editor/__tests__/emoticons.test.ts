import { describe, it, expect } from 'vitest';
import { EMOTICON_MAP } from '../emoticons';

describe('EMOTICON_MAP', () => {
  it('is sorted longest-first within overlapping prefixes', () => {
    // Verify specific overlap: ":-)" (3 chars) must come before ":)" (2 chars)
    // so that a ":-)" match does not get preempted by ":)".
    const keys = EMOTICON_MAP.map(([k]) => k);
    const smileyLong = keys.indexOf(':-)');
    const smileyShort = keys.indexOf(':)');
    expect(smileyLong).toBeGreaterThanOrEqual(0);
    expect(smileyShort).toBeGreaterThan(smileyLong);
  });

  it('contains no duplicate trigger sequences', () => {
    const keys = EMOTICON_MAP.map(([k]) => k);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('every entry maps to at least one emoji code point', () => {
    for (const [, emoji] of EMOTICON_MAP) {
      expect(emoji.length).toBeGreaterThan(0);
    }
  });

  it('covers basic happy/sad/wink/love categories', () => {
    const keys = new Set(EMOTICON_MAP.map(([k]) => k));
    for (const required of [':)', ':(', ';)', '<3', ':D', ':P', 'XD']) {
      expect(keys.has(required)).toBe(true);
    }
  });
});
