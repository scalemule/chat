import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Avatar } from './Avatar';
import { getLanguageLabel } from '../shared/localeLabels';
import { formatLocalTime } from '../shared/timeZones';

export interface UserProfileCardUser {
  /** Stable id. Used as the avatar palette key when no image is available. */
  id: string;
  /** Display name. Falls back to `email` then "User". */
  name?: string | null;
  email?: string | null;
  /** Fully-resolved avatar URL. Host signs / resolves file ids before passing. */
  avatarUrl?: string | null;
  /** BCP-47 locale tag (e.g. `"en-US"`). */
  locale?: string | null;
  /** IANA time zone id (e.g. `"America/Los_Angeles"`). */
  timeZone?: string | null;
}

export interface UserProfileCardLabels {
  edit?: string;
  uploadPhoto?: string;
  localTime?: string;
  language?: string;
  email?: string;
  contactInfo?: string;
  active?: string;
  away?: string;
}

export interface UserProfileCardProps {
  user: UserProfileCardUser;
  /**
   * When `true`, enables the edit button and the avatar upload overlay.
   * Defaults to `false` — read-only view suitable for looking at
   * another user's profile.
   */
  ownProfile?: boolean;
  /** Resolved online/away indicator state. */
  isOnline?: boolean;
  /**
   * Called when the user picks a file from the avatar overlay. The
   * host is responsible for uploading to storage and writing the
   * resulting URL back to the user's profile; the SDK does no I/O.
   */
  onUploadAvatar?: (file: File) => void | Promise<void>;
  /** When `true`, the upload overlay shows a spinner in place of the icon. */
  uploading?: boolean;
  /** Called when the user clicks the edit button. Host owns the modal. */
  onEditProfile?: () => void;
  /** Avatar diameter in pixels. Default 160. */
  avatarSize?: number;
  /**
   * Override the language label map. Keys are BCP-47 tags. Unknown
   * tags fall back to `Intl.DisplayNames` and finally to the tag
   * itself.
   */
  languageLabelMap?: Readonly<Record<string, string>>;
  /**
   * Override the "now"-in-timezone renderer. Default uses the shared
   * `formatLocalTime` helper with the card's locale.
   */
  formatLocalTimeFn?: (timeZone: string) => string | null;
  /** i18n strings — English defaults. */
  labels?: UserProfileCardLabels;
  /** Accepted image MIME types for the avatar upload input. Default `"image/*"`. */
  avatarAccept?: string;
  className?: string;
}

const defaultLabels: Required<UserProfileCardLabels> = {
  edit: 'Edit',
  uploadPhoto: 'Upload photo',
  localTime: 'local time',
  language: 'Language:',
  email: 'Email Address',
  contactInfo: 'Contact information',
  active: 'Active',
  away: 'Away',
};

/**
 * Pure presentational profile card — avatar, name, status, local time,
 * language, and contact row. Performs no network I/O: the host
 * resolves the profile data and wires `onUploadAvatar` / `onEditProfile`.
 *
 * Drop-in suitable for both own-profile (enable `ownProfile`) and
 * viewing another user (omit `ownProfile` — edit + upload chrome hide).
 *
 * Style hooks:
 *   `.sm-profile-card`              — outer container
 *   `.sm-profile-card-avatar`       — avatar wrapper
 *   `.sm-profile-card-upload`       — upload overlay button (own-profile only)
 *   `.sm-profile-card-name`         — name row
 *   `.sm-profile-card-status`       — online/away dot + label
 *   `.sm-profile-card-meta`         — local-time / language rows
 *   `.sm-profile-card-contact`      — contact information block
 *
 * Tokens (re-uses existing):
 *   `--sm-surface`, `--sm-border-color`, `--sm-text-color`,
 *   `--sm-muted-text`, `--sm-primary`, `--sm-status-online-color`,
 *   `--sm-status-offline-color`.
 */
export function UserProfileCard({
  user,
  ownProfile = false,
  isOnline,
  onUploadAvatar,
  uploading = false,
  onEditProfile,
  avatarSize = 160,
  languageLabelMap,
  formatLocalTimeFn,
  labels,
  avatarAccept = 'image/*',
  className,
}: UserProfileCardProps): React.JSX.Element {
  const l = { ...defaultLabels, ...labels };
  const displayName = user.name || user.email || 'User';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);

  // Tick once a minute so the local-time row stays fresh without
  // consuming work when no time zone is set.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!user.timeZone) return;
    const iv = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(iv);
  }, [user.timeZone]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void onUploadAvatar?.(file);
      // Clear so selecting the same file twice in a row still fires.
      e.target.value = '';
    },
    [onUploadAvatar],
  );

  const languageLabel = getLanguageLabel(user.locale, {
    map: languageLabelMap,
  });
  const localTime =
    user.timeZone != null
      ? (formatLocalTimeFn
          ? formatLocalTimeFn(user.timeZone)
          : formatLocalTime(user.timeZone))
      : null;
  const hasMeta = Boolean(languageLabel) || Boolean(localTime);

  return (
    <div
      className={`sm-profile-card${className ? ` ${className}` : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sm-surface, #fff)',
        color: 'var(--sm-text-color, #111827)',
      }}
    >
      {/* Avatar */}
      <div
        className="sm-profile-card-avatar"
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '24px 20px 16px',
        }}
      >
        <div
          style={{ position: 'relative', display: 'inline-block' }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <Avatar
            name={displayName}
            colorKey={user.id}
            src={user.avatarUrl}
            size={avatarSize}
            rounded="lg"
            initialsMaxChars={2}
          />
          {ownProfile && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                aria-label={l.uploadPhoto}
                className="sm-profile-card-upload"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  border: 'none',
                  background:
                    hover || uploading ? 'rgba(0,0,0,0.4)' : 'transparent',
                  color: '#fff',
                  cursor: uploading ? 'default' : 'pointer',
                  transition: 'background-color 120ms ease-in-out',
                  opacity: hover || uploading ? 1 : 0,
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {uploading ? (
                  <span
                    aria-label="Uploading"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      border: '2px solid #fff',
                      borderTopColor: 'transparent',
                      animation: 'sm-avatar-upload-spin 800ms linear infinite',
                    }}
                  />
                ) : (
                  l.uploadPhoto
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={avatarAccept}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <style>{`
                @keyframes sm-avatar-upload-spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </>
          )}
        </div>
      </div>

      {/* Name + edit */}
      <div
        className="sm-profile-card-name"
        style={{
          padding: '0 20px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </h3>
        {ownProfile && onEditProfile && (
          <button
            type="button"
            onClick={onEditProfile}
            style={{
              flexShrink: 0,
              border: '1px solid var(--sm-border-color, #e5e7eb)',
              background: 'var(--sm-surface, #fff)',
              color: 'var(--sm-text-color, #111827)',
              borderRadius: 6,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {l.edit}
          </button>
        )}
      </div>

      {/* Status + meta */}
      <div
        className="sm-profile-card-status"
        style={{ padding: `0 20px ${hasMeta ? 24 : 16}px` }}
      >
        {isOnline !== undefined && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 999,
                background: isOnline
                  ? 'var(--sm-status-online-color, #22c55e)'
                  : 'transparent',
                border: isOnline
                  ? 'none'
                  : '2px solid var(--sm-border-color, #e5e7eb)',
              }}
            />
            <span style={{ fontSize: 14, color: 'var(--sm-muted-text, #6b7280)' }}>
              {isOnline ? l.active : l.away}
            </span>
          </div>
        )}
        {localTime && (
          <p
            className="sm-profile-card-meta"
            style={{
              margin: '4px 0 0',
              fontSize: 14,
              color: 'var(--sm-muted-text, #6b7280)',
            }}
          >
            {localTime} {l.localTime}
          </p>
        )}
        {languageLabel && (
          <p
            className="sm-profile-card-meta"
            style={{
              margin: '4px 0 0',
              fontSize: 14,
              color: 'var(--sm-muted-text, #6b7280)',
            }}
          >
            <span style={{ color: 'var(--sm-muted-text, #9ca3af)' }}>
              {l.language}
            </span>{' '}
            {languageLabel}
          </p>
        )}
      </div>

      {/* Contact info */}
      {user.email && (
        <>
          <div
            style={{
              borderTop: '1px solid var(--sm-border-color, #e5e7eb)',
            }}
          />
          <div
            className="sm-profile-card-contact"
            style={{ padding: '16px 20px' }}
          >
            <h4
              style={{
                margin: '0 0 12px',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {l.contactInfo}
            </h4>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--sm-muted-text, #6b7280)',
                }}
              >
                {l.email}
              </p>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 14,
                  color: 'var(--sm-primary, #2563eb)',
                  wordBreak: 'break-word',
                }}
              >
                {user.email}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
