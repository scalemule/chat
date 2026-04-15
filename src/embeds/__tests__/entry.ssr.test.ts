/**
 * SSR safety check for the embeds entry.
 *
 * Importing `@scalemule/chat/embeds` on the server (no `window`,
 * no `localStorage`) must not throw. The localStorage cache wrapper guards
 * with `typeof window !== 'undefined'`, so module load is safe — useEffect
 * (where the oEmbed fetch lives) is never invoked at module scope.
 *
 * Vitest default environment is node (no jsdom), which simulates SSR.
 */

import { describe, it, expect } from 'vitest';

describe('@scalemule/chat/embeds SSR import', () => {
  it('module load does not touch window or throw', async () => {
    const mod = await import('../../embeds');
    expect(mod.YouTubeEmbed).toBeDefined();
    expect(mod.YouTubeEmbeds).toBeDefined();
    expect(mod.extractYouTubeIds).toBeDefined();
    expect(typeof window).toBe('undefined');
    // The pure helper is callable in node.
    expect(mod.extractYouTubeIds('https://youtu.be/abcdefghijk')).toEqual([
      'abcdefghijk',
    ]);
  });
});
