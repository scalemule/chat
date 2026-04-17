// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  showNotification,
} from './browserNotifications';

class FakeNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn(async () => FakeNotification.permission);
  title: string;
  options?: NotificationOptions;
  onclick: ((event: Event) => void) | null = null;
  close = vi.fn();
  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
  }
}

describe('browserNotifications', () => {
  const originalNotif = (window as unknown as { Notification?: unknown })
    .Notification;

  beforeEach(() => {
    (window as unknown as { Notification: unknown }).Notification =
      FakeNotification;
    FakeNotification.permission = 'default';
    FakeNotification.requestPermission.mockClear();
  });

  afterEach(() => {
    if (originalNotif) {
      (window as unknown as { Notification: unknown }).Notification =
        originalNotif;
    } else {
      delete (window as unknown as { Notification?: unknown }).Notification;
    }
  });

  it('isNotificationSupported returns true when Notification exists', () => {
    expect(isNotificationSupported()).toBe(true);
  });

  it('getNotificationPermission mirrors Notification.permission', () => {
    FakeNotification.permission = 'granted';
    expect(getNotificationPermission()).toBe('granted');
  });

  it('returns unsupported when Notification is unavailable', () => {
    delete (window as unknown as { Notification?: unknown }).Notification;
    expect(isNotificationSupported()).toBe(false);
    expect(getNotificationPermission()).toBe('unsupported');
  });

  it('requestNotificationPermission calls requestPermission when default', async () => {
    FakeNotification.permission = 'default';
    FakeNotification.requestPermission.mockResolvedValueOnce('granted');
    await expect(requestNotificationPermission()).resolves.toBe('granted');
    expect(FakeNotification.requestPermission).toHaveBeenCalled();
  });

  it('requestNotificationPermission short-circuits when already decided', async () => {
    FakeNotification.permission = 'granted';
    await expect(requestNotificationPermission()).resolves.toBe('granted');
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();

    FakeNotification.permission = 'denied';
    await expect(requestNotificationPermission()).resolves.toBe('denied');
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });

  it('requestNotificationPermission returns unsupported when API missing', async () => {
    delete (window as unknown as { Notification?: unknown }).Notification;
    await expect(requestNotificationPermission()).resolves.toBe('unsupported');
  });

  it('showNotification returns null when permission is not granted', () => {
    FakeNotification.permission = 'default';
    expect(showNotification({ title: 'Hi' })).toBeNull();
    FakeNotification.permission = 'denied';
    expect(showNotification({ title: 'Hi' })).toBeNull();
  });

  it('showNotification returns null when API is unsupported', () => {
    delete (window as unknown as { Notification?: unknown }).Notification;
    expect(showNotification({ title: 'Hi' })).toBeNull();
  });

  it('showNotification constructs a Notification when permission is granted', () => {
    FakeNotification.permission = 'granted';
    const n = showNotification({
      title: 'New mention',
      body: 'Alice: hi',
      tag: 'conv-1',
    }) as unknown as FakeNotification | null;
    expect(n).not.toBeNull();
    expect(n?.title).toBe('New mention');
    expect(n?.options?.tag).toBe('conv-1');
    expect(n?.options?.body).toBe('Alice: hi');
  });

  it('showNotification wires an onclick handler that focuses window', () => {
    FakeNotification.permission = 'granted';
    const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {});
    const onClick = vi.fn();
    const n = showNotification({
      title: 'Hi',
      onClick,
    }) as unknown as FakeNotification;
    expect(n.onclick).toBeTruthy();
    n.onclick?.({ target: n } as unknown as Event);
    expect(focusSpy).toHaveBeenCalled();
    expect(n.close).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it('showNotification returns null when construction throws', () => {
    FakeNotification.permission = 'granted';
    class ThrowingNotification extends FakeNotification {
      constructor() {
        super('x');
        throw new Error('not allowed');
      }
    }
    (window as unknown as { Notification: unknown }).Notification =
      ThrowingNotification;
    ThrowingNotification.permission = 'granted';
    expect(showNotification({ title: 'Hi' })).toBeNull();
  });
});
