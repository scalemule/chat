/**
 * @scalemule/chat/video — Gallop-powered video player for chat attachments.
 *
 * Code-split entry so customers that don't want Gallop never pull it in.
 * `@scalemule/gallop` is an **optional** peer dep (marked in package.json);
 * only customers who import from this entry need it installed.
 *
 * Typical use:
 *
 * ```tsx
 * import { VideoAttachmentPlayer } from '@scalemule/chat/video';
 *
 * <ChatMessageList
 *   renderAttachment={(att) =>
 *     att.mime_type?.startsWith('video/')
 *       ? <VideoAttachmentPlayer attachment={att} fetcher={onFetchAttachmentUrl} />
 *       : undefined
 *   }
 * />
 * ```
 */

export { VideoAttachmentPlayer } from './video/VideoAttachmentPlayer';
export type { VideoAttachmentPlayerProps } from './video/VideoAttachmentPlayer';
