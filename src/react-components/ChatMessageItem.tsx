import React, { useMemo, useState } from 'react';

import type { ChatMessage } from '../types';
import { EmojiPicker } from './EmojiPicker';
import { formatMessageTime } from './utils';

interface ChatMessageItemProps {
  message: ChatMessage;
  currentUserId?: string;
  onAddReaction?: (messageId: string, emoji: string) => void | Promise<void>;
  onRemoveReaction?: (messageId: string, emoji: string) => void | Promise<void>;
  onReport?: (messageId: string) => void | Promise<void>;
  highlight?: boolean;
}

function renderAttachment(messageId: string, attachment: NonNullable<ChatMessage['attachments']>[number]) {
  const key = `${messageId}:${attachment.file_id}`;
  const url = attachment.presigned_url;

  if (!url) {
    return (
      <div
        key={key}
        style={{
          padding: '10px 12px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.16)',
          fontSize: 13,
        }}
      >
        {attachment.file_name}
      </div>
    );
  }

  if (attachment.mime_type.startsWith('image/')) {
    return (
      <img
        key={key}
        src={url}
        alt={attachment.file_name}
        loading="lazy"
        style={{
          display: 'block',
          maxWidth: '100%',
          borderRadius: 12,
          marginTop: 8,
        }}
      />
    );
  }

  if (attachment.mime_type.startsWith('video/')) {
    return (
      <video
        key={key}
        controls
        src={url}
        style={{
          display: 'block',
          width: '100%',
          maxWidth: 320,
          borderRadius: 12,
          marginTop: 8,
        }}
      />
    );
  }

  if (attachment.mime_type.startsWith('audio/')) {
    return (
      <audio
        key={key}
        controls
        src={url}
        style={{
          display: 'block',
          width: '100%',
          marginTop: 8,
        }}
      />
    );
  }

  return (
    <a
      key={key}
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'inline-block',
        marginTop: 8,
        color: 'inherit',
        fontSize: 13,
      }}
    >
      {attachment.file_name}
    </a>
  );
}

export function ChatMessageItem({
  message,
  currentUserId,
  onAddReaction,
  onRemoveReaction,
  onReport,
  highlight = false,
}: ChatMessageItemProps): React.JSX.Element {
  const [showPicker, setShowPicker] = useState(false);
  const isOwn = Boolean(currentUserId && message.sender_id === currentUserId);
  const canReact = Boolean(onAddReaction || onRemoveReaction);

  const reactionEntries = useMemo(() => message.reactions ?? [], [message.reactions]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwn ? 'flex-end' : 'flex-start',
        gap: 6,
      }}
    >
      <div
        style={{
          maxWidth: 'min(82%, 560px)',
          padding: message.attachments?.length ? 10 : '10px 12px',
          borderRadius: 'var(--sm-border-radius, 16px)',
          background: isOwn ? 'var(--sm-own-bubble, #2563eb)' : 'var(--sm-other-bubble, #f3f4f6)',
          color: isOwn ? 'var(--sm-own-text, #fff)' : 'var(--sm-other-text, #111827)',
          boxShadow: highlight ? '0 0 0 2px rgba(37, 99, 235, 0.22)' : 'none',
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {message.content ? (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14 }}>
            {message.content}
          </div>
        ) : null}
        {message.attachments?.map((attachment) => renderAttachment(message.id, attachment))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--sm-muted-text, #6b7280)',
          fontSize: 12,
        }}
      >
        <span>{formatMessageTime(message.created_at)}</span>
        {message.is_edited ? <span>edited</span> : null}
        {onReport && !isOwn ? (
          <button
            type="button"
            onClick={() => void onReport(message.id)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 12,
              padding: 0,
            }}
          >
            Report
          </button>
        ) : null}
        {canReact ? (
          <button
            type="button"
            onClick={() => setShowPicker((value) => !value)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 12,
              padding: 0,
            }}
          >
            React
          </button>
        ) : null}
      </div>

      {showPicker && canReact ? (
        <EmojiPicker
          onSelect={(emoji) => {
            setShowPicker(false);
            void onAddReaction?.(message.id, emoji);
          }}
        />
      ) : null}

      {reactionEntries.length ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {reactionEntries.map((reaction) => {
            const reacted = Boolean(currentUserId && reaction.user_ids.includes(currentUserId));

            return (
              <button
                key={`${message.id}:${reaction.emoji}`}
                type="button"
                onClick={() => {
                  if (reacted) {
                    void onRemoveReaction?.(message.id, reaction.emoji);
                    return;
                  }
                  void onAddReaction?.(message.id, reaction.emoji);
                }}
                style={{
                  border: reacted ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid var(--sm-border-color, #e5e7eb)',
                  background: reacted ? 'rgba(37, 99, 235, 0.08)' : 'var(--sm-surface, #fff)',
                  color: 'var(--sm-text-color, #111827)',
                  borderRadius: 999,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {reaction.emoji} {reaction.count}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
