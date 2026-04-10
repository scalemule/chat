import { describe, expect, it } from 'vitest';
import { shadcnTheme } from './shadcn';
import { themeToStyle } from '../react-components/theme';

describe('shadcnTheme', () => {
  it('exports every ChatTheme token', () => {
    expect(shadcnTheme.primary).toBeDefined();
    expect(shadcnTheme.ownBubble).toBeDefined();
    expect(shadcnTheme.ownText).toBeDefined();
    expect(shadcnTheme.otherBubble).toBeDefined();
    expect(shadcnTheme.otherText).toBeDefined();
    expect(shadcnTheme.surface).toBeDefined();
    expect(shadcnTheme.surfaceMuted).toBeDefined();
    expect(shadcnTheme.borderColor).toBeDefined();
    expect(shadcnTheme.textColor).toBeDefined();
    expect(shadcnTheme.mutedText).toBeDefined();
    expect(shadcnTheme.borderRadius).toBeDefined();
    expect(shadcnTheme.fontFamily).toBeDefined();
  });

  it('uses shadcn hsl(var(--...)) fallback chains', () => {
    // Every color token must wrap a shadcn variable in hsl(...) with a
    // default HSL triplet fallback. This matches shadcn's convention of
    // storing colors as bare HSL triplets.
    expect(shadcnTheme.primary).toMatch(/^hsl\(var\(--primary,/);
    expect(shadcnTheme.ownBubble).toMatch(/^hsl\(var\(--primary,/);
    expect(shadcnTheme.ownText).toMatch(/^hsl\(var\(--primary-foreground,/);
    expect(shadcnTheme.otherBubble).toMatch(/^hsl\(var\(--secondary,/);
    expect(shadcnTheme.surface).toMatch(/^hsl\(var\(--background,/);
    expect(shadcnTheme.borderColor).toMatch(/^hsl\(var\(--border,/);
    expect(shadcnTheme.mutedText).toMatch(/^hsl\(var\(--muted-foreground,/);
  });

  it('uses shadcn --radius for border radius', () => {
    expect(shadcnTheme.borderRadius).toContain('var(--radius');
  });

  it('inherits the host font', () => {
    expect(shadcnTheme.fontFamily).toBe('inherit');
  });

  it('is compatible with themeToStyle()', () => {
    const style = themeToStyle(shadcnTheme);
    expect(style['--sm-primary']).toBeDefined();
    expect(style['--sm-own-bubble']).toBeDefined();
    expect(style['--sm-other-bubble']).toBeDefined();
    expect(style['--sm-surface']).toBeDefined();
    expect(style['--sm-border-color']).toBeDefined();
    expect(style['--sm-border-radius']).toBeDefined();
    expect(style['--sm-font-family']).toBeDefined();
  });
});
