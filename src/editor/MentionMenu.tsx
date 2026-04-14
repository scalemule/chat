/**
 * User mention dropdown for `RichTextInput`.
 *
 * Positioned above the `@` trigger by the parent. The component is purely
 * presentational — keyboard nav and detection live in `RichTextInput`, which
 * passes `selectedIndex` + `onSelect` down.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { MentionUser } from './types';

export interface MentionMenuProps {
  users: MentionUser[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (user: MentionUser) => void;
  onHover?: (index: number) => void;
  onClose?: () => void;
}

const AVATAR_COLORS = [
  '#E8912D',
  '#2BAC76',
  '#1264A3',
  '#E01E5A',
  '#36C5F0',
  '#9B59B6',
  '#E67E22',
  '#1ABC9C',
];

function getAvatarColor(id: string): string {
  if (!id) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

function MentionAvatar({
  userId,
  name,
  avatarUrl,
}: {
  userId: string;
  name: string;
  avatarUrl: string | null | undefined;
}): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const isAbsoluteUrl =
    avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('//'));

  if (isAbsoluteUrl && !failed) {
    return (
      <img
        src={avatarUrl!}
        alt={name}
        className="sm-mention-avatar-img"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="sm-mention-avatar-initials"
      style={{ background: getAvatarColor(userId) }}
    >
      {getInitials(name)}
    </div>
  );
}

export function MentionMenu({
  users,
  selectedIndex,
  position,
  onSelect,
  onHover,
}: MentionMenuProps): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const item = menuRef.current?.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (users.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="sm-mention-menu"
      style={{ top: position.top, left: position.left }}
    >
      {users.map((user, i) => {
        const displayName =
          user.display_name || user.email || user.id.slice(0, 8);
        const isActive = i === selectedIndex;
        return (
          <button
            key={user.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(user);
            }}
            onMouseEnter={() => onHover?.(i)}
            className={`sm-mention-menu-item${
              isActive ? ' sm-mention-menu-item-active' : ''
            }`}
          >
            <span className="sm-mention-avatar-wrap">
              <MentionAvatar
                userId={user.id}
                name={displayName}
                avatarUrl={user.avatar_url}
              />
              {user.is_online !== undefined && (
                <span
                  className={`sm-mention-status-dot${
                    user.is_online ? '' : ' sm-mention-status-dot-offline'
                  }`}
                />
              )}
            </span>
            <span className="sm-mention-name">{displayName}</span>
          </button>
        );
      })}
    </div>
  );
}
