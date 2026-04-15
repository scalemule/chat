/**
 * Gallop-powered video player for chat attachments — with a native `<video>`
 * fallback for non-HLS sources.
 *
 * Gallop (`@scalemule/gallop`) is HLS-only: its engine goes through hls.js
 * or Safari's native HLS and expects a `.m3u8` manifest. Most chat
 * attachments are raw mp4/webm/mov files served from S3 presigned URLs,
 * which hls.js can't parse — it spins forever. So:
 *
 *  - If the source looks like HLS (URL ends in `.m3u8` OR MIME is
 *    `application/vnd.apple.mpegurl` / `application/x-mpegurl`) we render
 *    Gallop.
 *  - Otherwise we render native `<video controls>` inside the same chrome
 *    (same rounded corners, same max-height) so the fallback looks
 *    consistent with the Gallop rendering.
 *
 * Ships in the `@scalemule/chat/video` entry so `@scalemule/gallop` stays an
 * optional peer dep. Customers not using HLS never pay the Gallop cost.
 */

import React, { useEffect, useState } from 'react';
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

function isHlsSource(url: string, mime: string | undefined): boolean {
  if (mime === 'application/vnd.apple.mpegurl' || mime === 'application/x-mpegurl') {
    return true;
  }
  // Strip query string / fragment before extension check — S3 presigned URLs
  // have long `?X-Amz-*` tails that would otherwise fail the check.
  const pathOnly = url.split('?')[0].split('#')[0];
  return pathOnly.endsWith('.m3u8');
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

  const wrapperStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    maxHeight,
    borderRadius: 8,
    overflow: 'hidden',
    ...style,
  };

  if (isHlsSource(viewUrl, attachment.mime_type)) {
    // HLS — use Gallop for adaptive bitrate + quality switcher + polish.
    return <GallopShell viewUrl={viewUrl} attachment={attachment} wrapperStyle={wrapperStyle} className={className} />;
  }

  // Raw mp4/webm/mov — Gallop can't play these. Native `<video>` in the
  // same wrapper gives identical chrome and a play button that actually works.
  return (
    <div className={className} style={wrapperStyle}>
      <video
        src={viewUrl}
        controls
        preload="metadata"
        poster={attachment.thumbnail_url}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

/**
 * GallopPlayer is imported lazily so hosts that never see an HLS attachment
 * don't evaluate Gallop's module (and don't need `@scalemule/gallop`
 * installed at all — the import only resolves when HLS playback is actually
 * attempted). Peer-dep stays truly optional.
 */
const LazyGallopPlayer = React.lazy(async () => {
  const mod = await import('@scalemule/gallop/react');
  return { default: mod.GallopPlayer };
});

function GallopShell({
  viewUrl,
  attachment,
  wrapperStyle,
  className,
}: {
  viewUrl: string;
  attachment: Attachment;
  wrapperStyle: React.CSSProperties;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={className} style={wrapperStyle}>
      <React.Suspense
        fallback={
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--sm-surface-muted, #f3f4f6)',
              borderRadius: 8,
            }}
            aria-busy="true"
          />
        }
      >
        <LazyGallopPlayer
          src={viewUrl}
          poster={attachment.thumbnail_url}
          style={{ width: '100%', height: '100%' }}
        />
      </React.Suspense>
    </div>
  );
}
