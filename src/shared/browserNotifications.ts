/**
 * Thin wrapper around the browser Notification API.
 *
 * SSR-safe — every helper tolerates `typeof window === 'undefined'`
 * and reports `'unsupported'` when the API isn't available (older
 * browsers, embedded webviews, some mobile browsers).
 */

export type NotificationPermissionState =
  | 'default'
  | 'granted'
  | 'denied'
  | 'unsupported';

interface NotificationConstructor {
  new (title: string, options?: NotificationOptions): Notification;
  permission: NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
}

function resolveNotificationCtor(): NotificationConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { Notification?: NotificationConstructor };
  if (!w.Notification) return null;
  // Safari 16+ exposes `Notification` but throws on construction in
  // insecure contexts — we still return the ctor and let the caller
  // handle the error at showtime.
  return w.Notification;
}

/** Returns `true` when the current environment supports notifications. */
export function isNotificationSupported(): boolean {
  return resolveNotificationCtor() !== null;
}

/**
 * Read the current permission state. Returns `'unsupported'` when
 * the Notification API is unavailable.
 */
export function getNotificationPermission(): NotificationPermissionState {
  const Ctor = resolveNotificationCtor();
  if (!Ctor) return 'unsupported';
  return Ctor.permission;
}

/**
 * Prompt the user for notification permission. Returns the resulting
 * state, or `'unsupported'` when the API isn't available. Idempotent
 * from the browser's perspective — calling after `'granted'` or
 * `'denied'` simply returns the existing state without re-prompting.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  const Ctor = resolveNotificationCtor();
  if (!Ctor) return 'unsupported';
  if (Ctor.permission !== 'default') return Ctor.permission;
  try {
    return await Ctor.requestPermission();
  } catch {
    return Ctor.permission;
  }
}

export interface ShowNotificationOptions {
  /** Required notification title. */
  title: string;
  /** Notification body text. */
  body?: string;
  /** Icon URL. Typically the app's logo or the sender's avatar. */
  icon?: string;
  /**
   * Stable tag. Notifications with the same tag replace each other
   * rather than stacking — use the conversation id to avoid a flood
   * of notifications from a single thread.
   */
  tag?: string;
  /** When true, renders silently (no OS sound). Default false. */
  silent?: boolean;
  /**
   * Click handler. The SDK focuses `window` automatically before
   * invoking the handler, since clicking a notification doesn't
   * change the browser's active tab on most platforms.
   */
  onClick?: () => void;
  /** Extra `data` to attach (available on the Notification instance). */
  data?: unknown;
}

/**
 * Show a browser notification. Returns the `Notification` instance on
 * success, or `null` when:
 *   - the API is unsupported,
 *   - permission isn't `'granted'`,
 *   - construction throws (insecure context, service-worker required,
 *     rate limits).
 *
 * Never throws — hosts call this freely without guarding.
 */
export function showNotification(
  options: ShowNotificationOptions,
): Notification | null {
  const Ctor = resolveNotificationCtor();
  if (!Ctor) return null;
  if (Ctor.permission !== 'granted') return null;

  try {
    const notif = new Ctor(options.title, {
      body: options.body,
      icon: options.icon,
      tag: options.tag,
      silent: options.silent,
      data: options.data,
    });
    if (options.onClick) {
      notif.onclick = (event: Event) => {
        try {
          (event.target as Notification | null)?.close?.();
        } catch {
          // ignore
        }
        try {
          window.focus();
        } catch {
          // ignore
        }
        options.onClick?.();
      };
    }
    return notif;
  } catch {
    return null;
  }
}
