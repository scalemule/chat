import { useCallback, useEffect, useState } from 'react';

import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '../shared/browserNotifications';

export interface UseNotificationPermission {
  /** Current permission state. `'unsupported'` when the API is unavailable. */
  state: NotificationPermissionState;
  /** `true` when permission is `'granted'`. */
  isGranted: boolean;
  /** `true` when `state` is `'default'` (user has not decided yet). */
  canPrompt: boolean;
  /**
   * Ask the user for permission. Returns the resulting state. No-op
   * when the API is unsupported or permission was already decided.
   */
  request: () => Promise<NotificationPermissionState>;
}

/**
 * Track the browser Notification API permission state. Exposes a
 * `request()` function to prompt the user from a click handler.
 *
 * SSR-safe — returns `'unsupported'` during server render.
 */
export function useNotificationPermission(): UseNotificationPermission {
  const [state, setState] = useState<NotificationPermissionState>('unsupported');

  useEffect(() => {
    if (!isNotificationSupported()) {
      setState('unsupported');
      return;
    }
    setState(getNotificationPermission());
  }, []);

  const request = useCallback(async () => {
    const next = await requestNotificationPermission();
    setState(next);
    return next;
  }, []);

  return {
    state,
    isGranted: state === 'granted',
    canPrompt: state === 'default',
    request,
  };
}
