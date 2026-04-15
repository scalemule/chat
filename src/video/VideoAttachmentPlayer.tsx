/**
 * Gallop-powered video player for chat attachments.
 *
 * Thin adapter over `@scalemule/gallop/react`'s `GallopPlayer` that takes a
 * chat `Attachment` (plus an optional presigned-URL fetcher) and renders the
 * polished player — adaptive bitrate, buffered preview, fullscreen, quality
 * switcher — instead of the native `<video controls>` fallback.
 *
 * Ships in the `@scalemule/chat/video` entry so `@scalemule/gallop` stays an
 * **optional** peer dep. Customers not using it never pay the cost. Host
 * apps wire it in via `ChatMessageItem.renderAttachment`:
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

import React, { useEffect, useState } from 'react';
import { GallopPlayer } from '@scalemule/gallop/react';
import type { Attachment } from '../types';

export interface VideoAttachmentPlayerProps {
  attachment: Attachment;
  /**
   * Async resolver for a fresh presigned URL when the attachment doesn't
   * carry one (or it's expired). Optional — if omitted, we fall back to
   * `attachment.presigned_url`.
   */
  fetcher?: (fileId: string) => Promise<string>;
  /** Max rendered height; default 240 so it matches the native fallback. */
  maxHeight?: number;
  /** Extra className applied to the outer wrapper. */
  className?: string;
  style?: React.CSSProperties;
}

function useResolvedUrl(
  fileId: string,
  presigned: string | undefined,
  fetcher: ((fileId: string) => Promise<string>) | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(presigned ?? null);
  useEffect(() => {
    if (presigned || !fileId || !fetcher) return;
    let cancelled = false;
    fetcher(fileId)
      .then((resolved) => {
        if (!cancelled && resolved) setUrl(resolved);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fileId, presigned, fetcher]);
  return url;
}

export function VideoAttachmentPlayer({
  attachment,
  fetcher,
  maxHeight = 240,
  className,
  style,
}: VideoAttachmentPlayerProps): React.JSX.Element | null {
  const viewUrl = useResolvedUrl(attachment.file_id, attachment.presigned_url, fetcher);

  if (!viewUrl) {
    // Placeholder block while the presigned URL is resolving. Keeps layout
    // stable so the bubble doesn't reflow when playback starts.
    return (
      <div
        className={className}
        style={{
          width: '100%',
          maxHeight,
          aspectRatio: '16 / 9',
          background: 'var(--sm-surface-muted, #f3f4f6)',
          borderRadius: 8,
          ...style,
        }}
        aria-busy="true"
        aria-label={attachment.file_name ?? 'Video'}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'block',
        width: '100%',
        maxHeight,
        borderRadius: 8,
        overflow: 'hidden',
        ...style,
      }}
    >
      <GallopPlayer
        src={viewUrl}
        poster={attachment.thumbnail_url}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
