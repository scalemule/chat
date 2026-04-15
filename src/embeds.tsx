/**
 * @scalemule/chat/embeds — opt-in rich-link embeds for chat messages.
 *
 * Currently ships YouTube — additional providers (Twitter, Loom, etc.) can
 * be added as new exports without touching the core React bundle.
 *
 * Typical wiring through the message list / thread:
 *
 * ```tsx
 * import { YouTubeEmbeds } from '@scalemule/chat/embeds';
 *
 * <ChatThread
 *   conversationId={id}
 *   renderEmbeds={(msg) => <YouTubeEmbeds html={msg.content} />}
 * />
 * ```
 *
 * Code-split: hosts that don't import this entry don't pay the iframe +
 * oEmbed cost in `react.js`.
 */

export {
  YouTubeEmbed,
  YouTubeEmbeds,
  extractYouTubeIds,
} from './embeds/YouTubeEmbed';
export type {
  YouTubeEmbedProps,
  YouTubeEmbedsProps,
} from './embeds/YouTubeEmbed';
