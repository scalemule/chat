// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationPermission } from '../useNotificationPermission';

class FakeNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn(async () => FakeNotification.permission);
  constructor() {}
}

describe('useNotificationPermission', () => {
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

  it('reports default state on mount when permission is default', () => {
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.state).toBe('default');
    expect(result.current.canPrompt).toBe(true);
    expect(result.current.isGranted).toBe(false);
  });

  it('reports granted when permission is granted', () => {
    FakeNotification.permission = 'granted';
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.state).toBe('granted');
    expect(result.current.isGranted).toBe(true);
    expect(result.current.canPrompt).toBe(false);
  });

  it('reports unsupported when the API is unavailable', () => {
    delete (window as unknown as { Notification?: unknown }).Notification;
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.state).toBe('unsupported');
  });

  it('request() updates the returned state after permission is granted', async () => {
    FakeNotification.permission = 'default';
    FakeNotification.requestPermission.mockImplementationOnce(async () => {
      FakeNotification.permission = 'granted';
      return 'granted';
    });
    const { result } = renderHook(() => useNotificationPermission());
    await act(async () => {
      await result.current.request();
    });
    expect(result.current.state).toBe('granted');
  });
});
