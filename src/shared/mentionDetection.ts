/**
 * Client-side mention detection.
 *
 * The chat service does not currently emit a distinct mention event,
 * so hooks like `useMentionCounts` and `useMentionAlerts` derive
 * mentions by scanning incoming message HTML for the exact attribute
 * emitted by the Quill mention blot.
 *
 * React-free, SSR-safe. No DOM parsing — pure string search.
 */

/**
 * Returns `true` when `htmlContent` contains a mention of `userId`.
 *
 * The Quill mention blot renders as:
 *
 *     <span class="sm-mention" data-sm-user-id="{id}">@Name</span>
 *
 * Plain-text messages don't have the attribute, so this is a safe
 * needle that never false-positives on ordinary body text.
 */
export function messageContainsMention(
  htmlContent: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!htmlContent || !userId) return false;
  return htmlContent.includes(`data-sm-user-id="${userId}"`);
}
