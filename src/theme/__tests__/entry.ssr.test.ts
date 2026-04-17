/**
 * SSR-safety smoke test for the `@scalemule/chat/theme` entry.
 */

import { describe, expect, it } from 'vitest';

describe('@scalemule/chat/theme SSR import', () => {
  it('module load does not touch window or throw', async () => {
    const mod = await import('../../theme');
    expect(mod.ThemeSwitcher).toBeDefined();
    expect(mod.useThemeMode).toBeDefined();
    expect(mod.applyTheme).toBeDefined();
    expect(mod.getFlashPreventionScript).toBeDefined();
    expect(mod.readThemeMode).toBeDefined();
    expect(mod.resolveThemeMode).toBeDefined();
    expect(mod.writeThemeMode).toBeDefined();
    expect(mod.DEFAULT_THEME_STORAGE_KEY).toBeDefined();
    expect(typeof window).toBe('undefined');

    // Pure helpers tolerate the server:
    expect(mod.readThemeMode()).toBe('system');
    // No localStorage → silent write is fine:
    mod.writeThemeMode('dark');
    // Resolver defaults to light under SSR (no matchMedia):
    expect(mod.resolveThemeMode('system')).toBe('light');
    expect(mod.resolveThemeMode('dark')).toBe('dark');
    // applyTheme is a no-op when document is undefined:
    expect(() => mod.applyTheme('dark')).not.toThrow();
    // Flash-prevention script is a pure string:
    const script = mod.getFlashPreventionScript();
    expect(typeof script).toBe('string');
    expect(script.startsWith('(function(){')).toBe(true);
  });
});
