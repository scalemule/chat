/**
 * Gallop-powered video player for chat attachments.
 *
 * Thin adapter over `@scalemule/gallop/react`'s `GallopPlayer` that takes a
 * chat `Attachment` (plus an optional presigned-URL fetcher) and renders
 * the polished player — adaptive bitrate + quality switcher for HLS,
 * progressive-download playback for raw mp4/webm/mov — behind one
 * consistent UI.
 *
 * Requires `@scalemule/gallop@^0.0.4`, which added `NativeFileEngine` for
 * progressive-download sources. Earlier Gallop versions couldn't play raw
 * mp4 URLs and left the player spinning forever.
 *
 * Ships in the `@scalemule/chat/video` entry so `@scalemule/gallop` stays
 * an optional peer dep.
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
    return () => {
      cancelled = true;
    };
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

  // Gallop@0.0.4+ inspects the URL and picks HLS.js for `.m3u8` manifests,
  // Safari-native HLS where applicable, or its NativeFileEngine for raw
  // mp4/webm/mov. The `mimeType` hint disambiguates presigned URLs without
  // extensions.
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
        mimeType={attachment.mime_type}
        poster={attachment.thumbnail_url}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
