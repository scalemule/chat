import { useContext, useEffect } from 'react';

import { ChatContext } from '../shared/ChatContext';
import { messageContainsMention } from '../shared/mentionDetection';
import { playMentionChime } from '../shared/notificationAudio';
import {
  showNotification,
  type ShowNotificationOptions,
} from '../shared/browserNotifications';
import type { ChatMessage } from '../types';

export interface MentionAlertContext {
  message: ChatMessage;
  conversationId: string;
  activeConversationId?: string;
}

export interface UseMentionAlertsOptions {
  /** The signed-in user. Passing `undefined` disables the hook entirely. */
  currentUserId?: string;
  /**
   * The conversation the user is currently viewing. Mentions in that
   * conversation skip both the sound and the browser notification
   * (the user already sees the message). Omit to alert on every
   * mention.
   */
  activeConversationId?: string;
  /** Play the two-tone chime when mentioned. Default `true`. */
  sound?: boolean;
  /** Fire a browser notification when mentioned. Default `true`. */
  browser?: boolean;
  /**
   * Host-supplied builder for the notification payload. Return `null`
   * to skip the browser notification for this specific mention. When
   * omitted, a minimal default is used: `title = "New mention"`,
   * `body = message.content.replace(/<[^>]+>/g, '').slice(0, 120)`,
   * `tag = conversationId` so repeated mentions replace.
   */
  buildNotification?: (
    ctx: MentionAlertContext,
  ) => ShowNotificationOptions | null;
  /**
   * Extra hook — runs for every detected mention, before sound +
   * notification fire. Use this to update app-level state (unread
   * counter, last-mention marker).
   */
  onMentioned?: (ctx: MentionAlertContext) => void;
}

function defaultNotification(
  ctx: MentionAlertContext,
): ShowNotificationOptions {
  const text = (ctx.message.content ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const body = text.length > 120 ? `${text.slice(0, 117)}…` : text;
  return {
    title: 'New mention',
    body,
    tag: ctx.conversationId,
  };
}

/**
 * Subscribe to incoming messages and fire sound + browser
 * notification alerts when the current user is mentioned. The hook
 * reuses the same mention-detection logic as `useMentionCounts`
 * (0.0.48) — both hooks recognize the exact attribute emitted by the
 * Quill mention blot.
 *
 * Composition pattern:
 *
 * ```tsx
 * useMentionAlerts({
 *   currentUserId,
 *   activeConversationId,
 *   buildNotification: ({ message, conversationId }) => ({
 *     title: `Mention in #${lookupChannel(conversationId)}`,
 *     body: extractPlainText(message.content),
 *     icon: appIcon,
 *     onClick: () => router.push(`/conversation/${conversationId}`),
 *     tag: conversationId,
 *   }),
 * });
 * ```
 *
 * Requires the `ChatProvider` context and relies on `initAudio()`
 * having been called previously from a user gesture for the chime to
 * be audible (sound silently no-ops otherwise).
 */
export function useMentionAlerts(options: UseMentionAlertsOptions): void {
  const ctx = useContext(ChatContext);
  const client = ctx?.client;

  const {
    currentUserId,
    activeConversationId,
    sound = true,
    browser = true,
    buildNotification,
    onMentioned,
  } = options;

  useEffect(() => {
    if (!client || !currentUserId) return;
    return client.on('message', ({ message, conversationId }) => {
      if (message.sender_id === currentUserId) return;
      if (!messageContainsMention(message.content, currentUserId)) return;
      const alertCtx: MentionAlertContext = {
        message,
        conversationId,
        activeConversationId,
      };
      onMentioned?.(alertCtx);
      const muteForActive = activeConversationId === conversationId;
      if (muteForActive) return;
      if (sound) playMentionChime();
      if (browser) {
        const opts =
          buildNotification?.(alertCtx) ?? defaultNotification(alertCtx);
        if (opts) showNotification(opts);
      }
    });
  }, [
    client,
    currentUserId,
    activeConversationId,
    sound,
    browser,
    buildNotification,
    onMentioned,
  ]);
}
