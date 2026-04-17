/**
 * Opt-in notification UX entry. Code-split from the main `/react`
 * bundle so hosts that don't fire browser/audio alerts don't pay the
 * cost.
 *
 * Usage:
 *
 * ```tsx
 * import {
 *   initAudio,
 *   useMentionAlerts,
 *   useNotificationPermission,
 * } from '@scalemule/chat/notifications';
 *
 * // Unlock audio on the first click anywhere in the app:
 * useEffect(() => {
 *   const handler = () => initAudio();
 *   window.addEventListener('click', handler, { once: true });
 *   return () => window.removeEventListener('click', handler);
 * }, []);
 *
 * useMentionAlerts({ currentUserId, activeConversationId });
 * ```
 */

export {
  initAudio,
  getAudioContext,
  isAudioSupported,
  playMentionChime,
  playRingTone,
  playTones,
} from './shared/notificationAudio';

export {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showNotification,
} from './shared/browserNotifications';
export type {
  NotificationPermissionState,
  ShowNotificationOptions,
} from './shared/browserNotifications';

export { messageContainsMention } from './shared/mentionDetection';

export { useNotificationPermission } from './react-components/useNotificationPermission';
export type { UseNotificationPermission } from './react-components/useNotificationPermission';

export { useMentionAlerts } from './react-components/useMentionAlerts';
export type {
  UseMentionAlertsOptions,
  MentionAlertContext,
} from './react-components/useMentionAlerts';
