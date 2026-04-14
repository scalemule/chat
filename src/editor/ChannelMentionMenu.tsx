/**
 * Channel mention dropdown for `RichTextInput`. Triggered by typing `#`.
 */

import React, { useEffect, useRef } from 'react';
import type { ChannelMentionItem } from './types';

export interface ChannelMentionMenuProps {
  channels: ChannelMentionItem[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (channel: ChannelMentionItem) => void;
  onHover?: (index: number) => void;
  onClose?: () => void;
}

export function ChannelMentionMenu({
  channels,
  selectedIndex,
  position,
  onSelect,
  onHover,
}: ChannelMentionMenuProps): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const item = menuRef.current?.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (channels.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="sm-channel-mention-menu sm-mention-menu"
      style={{ top: position.top, left: position.left }}
    >
      {channels.map((channel, i) => {
        const isActive = i === selectedIndex;
        return (
          <button
            key={channel.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(channel);
            }}
            onMouseEnter={() => onHover?.(i)}
            className={`sm-mention-menu-item${
              isActive ? ' sm-mention-menu-item-active' : ''
            }`}
          >
            <span className="sm-channel-mention-icon">
              {channel.visibility === 'private' ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ) : (
                <span className="sm-channel-mention-hash">#</span>
              )}
            </span>
            <span className="sm-mention-name">{channel.name}</span>
            {typeof channel.member_count === 'number' && (
              <span className="sm-mention-meta">{channel.member_count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
