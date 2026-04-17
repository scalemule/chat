/**
 * SSR-safety smoke test for the `@scalemule/chat/notifications` entry.
 *
 * Importing the entry in a Node environment (no `window`, no
 * `AudioContext`, no `Notification`) must not throw. All helpers are
 * documented as SSR-safe no-ops in that case.
 */

import { describe, expect, it } from 'vitest';

describe('@scalemule/chat/notifications SSR import', () => {
  it('module load does not touch window or throw', async () => {
    const mod = await import('../../notifications');
    expect(mod.initAudio).toBeDefined();
    expect(mod.playMentionChime).toBeDefined();
    expect(mod.playRingTone).toBeDefined();
    expect(mod.playTones).toBeDefined();
    expect(mod.requestNotificationPermission).toBeDefined();
    expect(mod.showNotification).toBeDefined();
    expect(mod.getNotificationPermission).toBeDefined();
    expect(mod.isNotificationSupported).toBeDefined();
    expect(mod.isAudioSupported).toBeDefined();
    expect(mod.messageContainsMention).toBeDefined();
    expect(mod.useMentionAlerts).toBeDefined();
    expect(mod.useNotificationPermission).toBeDefined();
    expect(typeof window).toBe('undefined');

    // SSR-safe no-op semantics.
    expect(mod.initAudio()).toBeNull();
    expect(mod.isAudioSupported()).toBe(false);
    expect(mod.isNotificationSupported()).toBe(false);
    expect(mod.getNotificationPermission()).toBe('unsupported');
    await expect(mod.requestNotificationPermission()).resolves.toBe(
      'unsupported',
    );
    expect(mod.showNotification({ title: 'Hi' })).toBeNull();
    // Pure helper still works.
    expect(
      mod.messageContainsMention(
        '<span data-sm-user-id="u1">x</span>',
        'u1',
      ),
    ).toBe(true);
  });
});
