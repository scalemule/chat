/**
 * SSR-safety smoke test for the `@scalemule/chat/profile` entry.
 *
 * Importing the entry in a Node environment (no `window`, no `document`
 * at module top level) must not throw. Both the card/panel React
 * components and the language/timezone helpers are expected to be
 * loadable in a pure-Node runtime.
 *
 * Vitest's default environment is Node, which simulates SSR.
 */

import { describe, expect, it } from 'vitest';

describe('@scalemule/chat/profile SSR import', () => {
  it('module load does not touch window or throw', async () => {
    const mod = await import('../../profile');
    expect(mod.Avatar).toBeDefined();
    expect(mod.UserProfileCard).toBeDefined();
    expect(mod.ProfilePanel).toBeDefined();
    expect(mod.getInitials).toBeDefined();
    expect(mod.avatarColorFromKey).toBeDefined();
    expect(mod.getLanguageLabel).toBeDefined();
    expect(mod.formatLocalTime).toBeDefined();
    expect(mod.getAllTimeZones).toBeDefined();
    expect(typeof window).toBe('undefined');

    // Pure helpers work under SSR.
    expect(mod.getInitials('Alice Jones')).toBe('AJ');
    expect(mod.getLanguageLabel('en-US')).toBe('English');
    expect(mod.formatLocalTime('UTC', { now: new Date('2026-04-17T18:30:00Z') })).toMatch(
      /6:30/,
    );
    const zones = mod.getAllTimeZones();
    expect(zones.length).toBeGreaterThan(0);
  });
});
