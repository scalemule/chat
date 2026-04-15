/**
 * SSR-safety smoke test for the `@scalemule/chat/search` entry.
 *
 * Importing the entry in a Node environment (no `window`, no `DOMParser`
 * at module top level) must not throw. The sanitizer lazy-loads its DOM
 * dependency inside the function body and falls back to a regex walker
 * when the DOM isn't available, so module load is always safe.
 *
 * Vitest's default environment is Node, which simulates SSR.
 */

import { describe, it, expect } from 'vitest';

describe('@scalemule/chat/search SSR import', () => {
  it('module load does not touch window or throw', async () => {
    const mod = await import('../../search');
    expect(mod.HighlightedExcerpt).toBeDefined();
    expect(mod.SearchHistoryDropdown).toBeDefined();
    expect(mod.useSearchHistory).toBeDefined();
    expect(mod.sanitizeSearchExcerpt).toBeDefined();
    expect(typeof window).toBe('undefined');
    // Pure helper works under SSR via the regex fallback.
    expect(mod.sanitizeSearchExcerpt('hi <em>x</em>')).toBe('hi <em>x</em>');
  });
});
