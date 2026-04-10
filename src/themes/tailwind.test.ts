import { describe, expect, it } from 'vitest';
import { tailwindTheme } from './tailwind';
import { themeToStyle } from '../react-components/theme';

describe('tailwindTheme', () => {
  it('exports every ChatTheme token', () => {
    expect(tailwindTheme.primary).toBeDefined();
    expect(tailwindTheme.ownBubble).toBeDefined();
    expect(tailwindTheme.ownText).toBeDefined();
    expect(tailwindTheme.otherBubble).toBeDefined();
    expect(tailwindTheme.otherText).toBeDefined();
    expect(tailwindTheme.surface).toBeDefined();
    expect(tailwindTheme.surfaceMuted).toBeDefined();
    expect(tailwindTheme.borderColor).toBeDefined();
    expect(tailwindTheme.textColor).toBeDefined();
    expect(tailwindTheme.mutedText).toBeDefined();
    expect(tailwindTheme.borderRadius).toBeDefined();
    expect(tailwindTheme.fontFamily).toBeDefined();
  });

  it('uses CSS var() fallback chains for Tailwind v4 inheritance', () => {
    // Every color token must reference a --color-* Tailwind variable as the
    // primary lookup, with a hard-coded fallback. This is what lets a host
    // Tailwind theme override SDK defaults without any JS config.
    expect(tailwindTheme.primary).toContain('var(--color-');
    expect(tailwindTheme.primary).toContain('#2563eb'); // SDK default fallback
    expect(tailwindTheme.ownBubble).toContain('var(--color-');
    expect(tailwindTheme.otherBubble).toContain('var(--color-');
    expect(tailwindTheme.surface).toContain('var(--color-');
    expect(tailwindTheme.borderColor).toContain('var(--color-');
  });

  it('uses Tailwind v4 radius and font tokens', () => {
    expect(tailwindTheme.borderRadius).toContain('var(--radius-');
    expect(tailwindTheme.fontFamily).toContain('var(--font-');
  });

  it('is compatible with themeToStyle()', () => {
    const style = themeToStyle(tailwindTheme);

    // themeToStyle should emit all 12 --sm-* CSS custom properties when the
    // full theme is passed. No undefined values should leak through.
    expect(style['--sm-primary']).toBeDefined();
    expect(style['--sm-own-bubble']).toBeDefined();
    expect(style['--sm-own-text']).toBeDefined();
    expect(style['--sm-other-bubble']).toBeDefined();
    expect(style['--sm-other-text']).toBeDefined();
    expect(style['--sm-surface']).toBeDefined();
    expect(style['--sm-surface-muted']).toBeDefined();
    expect(style['--sm-border-color']).toBeDefined();
    expect(style['--sm-text-color']).toBeDefined();
    expect(style['--sm-muted-text']).toBeDefined();
    expect(style['--sm-border-radius']).toBeDefined();
    expect(style['--sm-font-family']).toBeDefined();
  });

  it('primary token resolves to a Tailwind v4 primary color fallback chain', () => {
    // Chain: --color-primary-500 → --color-blue-600 → #2563eb
    // Means: if the host defines a primary palette, use it; else blue; else SDK default.
    expect(tailwindTheme.primary).toMatch(
      /var\(--color-primary-500,\s*var\(--color-blue-600,\s*#2563eb\)\)/,
    );
  });
});
