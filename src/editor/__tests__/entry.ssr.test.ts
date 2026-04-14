/**
 * SSR safety check for the editor entry.
 *
 * Importing `@scalemule/chat/editor` on the server (no `window`, no
 * `DOMParser`) must not throw at module load. Quill itself is lazy-imported
 * inside `useEffect`, so the top-level exports are safe to evaluate in a Node
 * environment.
 *
 * Vitest default environment is node (no jsdom), which is exactly what we
 * want to simulate.
 */

import { describe, it, expect } from 'vitest';

describe('@scalemule/chat/editor SSR import', () => {
  it('module load does not touch window or throw', async () => {
    // Dynamic import via the source entry — the published package maps
    // `./editor` to this same module.
    const mod = await import('../../editor');
    // forwardRef returns an object with a `$$typeof` and `render` fn — either
    // shape is fine, we just care the export exists and importing didn't throw.
    expect(mod.RichTextInput).toBeDefined();
    expect(typeof window).toBe('undefined');
  });
});
