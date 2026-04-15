import React, { useEffect, useState } from 'react';

import { extractYouTubeIds } from './youtube';
import { readCachedTitle, writeCachedTitle } from './storage';

export interface YouTubeEmbedProps {
  videoId: string;
}

export function YouTubeEmbed({ videoId }: YouTubeEmbedProps): React.JSX.Element {
  const [title, setTitle] = useState<string | null>(() =>
    readCachedTitle(videoId),
  );

  useEffect(() => {
    if (title) return;
    let cancelled = false;
    fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { title?: string } | null) => {
        if (cancelled || !data?.title) return;
        setTitle(data.title);
        writeCachedTitle(videoId, data.title);
      })
      .catch(() => {
        // Network errors, CORS rejection, JSON parse — silent. The embed
        // continues to render without a title.
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, title]);

  return (
    <div
      className="sm-yt-embed"
      style={{
        marginTop: 8,
        maxWidth: 480,
        overflow: 'hidden',
        borderRadius: 8,
        border: '1px solid var(--sm-embed-border, var(--sm-border-color, #e5e7eb))',
        background: 'var(--sm-embed-bg, var(--sm-surface, #fff))',
      }}
    >
      {title && (
        <div
          className="sm-yt-embed-title"
          style={{
            padding: '6px 10px',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--sm-text-color, #111827)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
      )}
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title || 'YouTube video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 0,
          }}
        />
      </div>
    </div>
  );
}

export interface YouTubeEmbedsProps {
  /** Plain text or HTML message body — IDs are extracted from URL substrings. */
  html: string;
}

export function YouTubeEmbeds({ html }: YouTubeEmbedsProps): React.JSX.Element | null {
  const ids = extractYouTubeIds(html);
  if (ids.length === 0) return null;
  return (
    <>
      {ids.map((id) => (
        <YouTubeEmbed key={id} videoId={id} />
      ))}
    </>
  );
}

export { extractYouTubeIds };
