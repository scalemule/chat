import React, { useEffect, useState } from 'react';

import {
  avatarColorFromKey,
  avatarTextColor,
  getInitials,
} from '../shared/avatarInitials';

export interface AvatarProps {
  /**
   * Display name used to derive initials. When absent or empty, the
   * component falls back to rendering the placeholder character(s) in
   * `fallback` (default `"?"`).
   */
  name?: string | null;
  /**
   * Stable identity used to pick the background color slot (palette of
   * 8). Defaults to `name` when omitted — prefer a user id so the color
   * remains consistent even if the display name changes.
   */
  colorKey?: string | null;
  /**
   * Fully-resolved image URL. When absent or when the image fails to
   * load, the component falls back to initials on a colored background.
   */
  src?: string | null;
  /** Accessible alt text. Defaults to `name`. */
  alt?: string;
  /** Pixel diameter. Default 40. */
  size?: number;
  /**
   * Corner radius. `'full'` (default) = circular; `'md'` = 8px; `'lg'`
   * = 12px; a number is interpreted as pixels. Matches the shape
   * conventions used elsewhere in the SDK.
   */
  rounded?: 'full' | 'md' | 'lg' | number;
  /** Extra class for host overrides. The `.sm-avatar` hook is always applied. */
  className?: string;
  /**
   * Override the computed initials. Useful when the host already has a
   * cleaned/truncated version.
   */
  initials?: string;
  /**
   * Maximum letters for default initials. Default 2. Pass `1` to match
   * compact chat-row avatars.
   */
  initialsMaxChars?: 1 | 2;
  /** Override the computed background color. Takes any CSS color value. */
  bgColor?: string;
  /** Override the text color for initials. Defaults to `--sm-avatar-text` (white). */
  textColor?: string;
  /**
   * Placeholder shown when neither `src` nor a derivable initial
   * exists. Default `"?"`.
   */
  fallback?: string;
  /** Optional click handler — wraps avatar in a button when provided. */
  onClick?: () => void;
}

function radiusFor(rounded: AvatarProps['rounded']): number | string {
  if (typeof rounded === 'number') return rounded;
  if (rounded === 'md') return 8;
  if (rounded === 'lg') return 12;
  return 999; // 'full' default
}

/**
 * Reusable avatar — renders an image with graceful fallback to
 * initials on a deterministic colored background.
 *
 * The background color is a stable hash of `colorKey` (or `name`) into
 * 8 palette slots, each backed by a `--sm-avatar-bg-{1..8}` CSS token
 * with a packaged hex fallback. Hosts that want a different palette
 * override the tokens in their theme.
 *
 * Styling tokens:
 *   --sm-avatar-bg-1 ... --sm-avatar-bg-8   (8 background colors)
 *   --sm-avatar-text                         (initials color, default white)
 *
 * Class hook: `.sm-avatar` (always), plus `.sm-avatar-img` on the
 * image branch and `.sm-avatar-initials` on the initials branch.
 */
export function Avatar({
  name,
  colorKey,
  src,
  alt,
  size = 40,
  rounded = 'full',
  className,
  initials: initialsOverride,
  initialsMaxChars = 2,
  bgColor,
  textColor,
  fallback = '?',
  onClick,
}: AvatarProps): React.JSX.Element {
  const [imageFailed, setImageFailed] = useState(false);

  // Reset the failed flag whenever the src changes — e.g. after an upload
  // swaps in a fresh URL for the same avatar position.
  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const derivedInitials =
    initialsOverride ?? getInitials(name, initialsMaxChars);
  const visibleLabel = derivedInitials || fallback;

  const radius = radiusFor(rounded);
  const resolvedAlt = alt ?? name ?? 'User';

  const commonStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexShrink: 0,
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',
    boxSizing: 'border-box',
  };

  const content =
    src && !imageFailed ? (
      <img
        src={src}
        alt={resolvedAlt}
        className={`sm-avatar sm-avatar-img${className ? ` ${className}` : ''}`}
        style={{ ...commonStyle, objectFit: 'cover' }}
        onError={() => setImageFailed(true)}
      />
    ) : (
      <span
        className={`sm-avatar sm-avatar-initials${className ? ` ${className}` : ''}`}
        aria-label={resolvedAlt}
        role="img"
        style={{
          ...commonStyle,
          background: bgColor ?? avatarColorFromKey(colorKey ?? name ?? ''),
          color: textColor ?? avatarTextColor(),
          fontSize: Math.max(10, Math.round(size * 0.4)),
          fontWeight: 600,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {visibleLabel}
      </span>
    );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="sm-avatar-button"
        style={{
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'inline-flex',
        }}
      >
        {content}
      </button>
    );
  }

  return content;
}
