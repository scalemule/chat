/**
 * SSR-safety smoke test for the `@scalemule/chat/layout` entry.
 *
 * Importing the entry in a Node environment (no `window`, no
 * pointer-event types) must not throw. Both components are React
 * components that render on the client; the module load itself must
 * stay safe on the server.
 */

import { describe, expect, it } from 'vitest';

describe('@scalemule/chat/layout SSR import', () => {
  it('module load does not touch window or throw', async () => {
    const mod = await import('../../layout');
    expect(mod.ResizableSidebar).toBeDefined();
    expect(mod.ThreePaneLayout).toBeDefined();
    expect(typeof window).toBe('undefined');
  });
});
