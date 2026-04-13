import React, { useState, useEffect, useRef, useCallback } from 'react';

import type { ChatMessage, Attachment, ApiResponse } from '../types';
import { EmojiPickerTrigger } from './EmojiPicker';
import { ReactionBar } from './ReactionBar';
import { formatMessageTime } from './utils';

interface PendingUpload {
  id: string;
  file: File;
  preview?: string;
  attachment?: Attachment;
  status: 'uploading' | 'ready' | 'error';
  progress: number;
  error?: string;
  abort: AbortController;
}

/** Hook that lazily fetches a presigned URL for an attachment */
function useAttachmentUrl(
  fileId: string,
  hasUrl: boolean,
  fetcher?: (fileId: string) => Promise<string>,
) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (hasUrl || !fileId || !fetcher) return;
    fetcher(fileId)
      .then((viewUrl) => {
        if (viewUrl) setUrl(viewUrl);
      })
      .catch(() => {});
  }, [fileId, hasUrl, fetcher]);
  return url;
}

export interface UserProfile {
  display_name: string;
  username?: string;
  avatar_url?: string;
}

interface ChatMessageItemProps {
  message: ChatMessage;
  currentUserId?: string;
  conversationId?: string;
  /** Profile for the message sender. Overrides `getProfile` when both are passed. */
  profile?: UserProfile;
  /**
   * Fallback profile resolver. Called only when `profile` is not passed. Useful
   * for hosts that keep profiles in a store (Map, Zustand, Redux) and don't
   * want to pass them per-message. Return `undefined` for unknown users —
   * the component will fall back to "User" and generic initials.
   */
  getProfile?: (userId: string) => UserProfile | undefined;
  onAddReaction?: (messageId: string, emoji: string) => void | Promise<void>;
  onRemoveReaction?: (messageId: string, emoji: string) => void | Promise<void>;
  onEdit?: (messageId: string, content: string, attachments?: Attachment[]) => void | Promise<void>;
  onDelete?: (messageId: string) => void | Promise<void>;
  onReport?: (messageId: string) => void;
  onFetchAttachmentUrl?: (fileId: string) => Promise<string>;
  isOwnMessage?: boolean;
  highlight?: boolean;
  /**
   * Custom avatar renderer. Replaces the default 32px circle avatar for
   * incoming messages. Receives the resolved profile (or undefined) and the
   * full message. Return `null` to hide the avatar entirely.
   *
   * Host apps use this to render their own avatar component (shadcn Avatar,
   * linkable profile pictures, status badges, etc.) without forking the
   * entire ChatMessageItem.
   */
  renderAvatar?: (
    profile: UserProfile | undefined,
    message: ChatMessage,
  ) => React.ReactNode;
  /**
   * Custom attachment renderer. Replaces the default image/video/audio/file
   * card for every attachment on the message. Host apps use this to integrate
   * their own media lightbox, lazy-loading strategy, or CDN transformations
   * without losing the rest of the message UI.
   *
   * The default renderer (with presigned URL fetching via onFetchAttachmentUrl)
   * is used when this prop is not passed.
   */
  renderAttachment?: (attachment: Attachment) => React.ReactNode;
  /** Upload handler for adding new attachments during edit. When provided, a
   *  paperclip button appears in the edit footer. Matches ChatInput's API. */
  onUploadAttachment?: (
    file: File | Blob,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal,
  ) => Promise<ApiResponse<Attachment>>;
  /** Cleanup handler called when an uploaded attachment is removed during edit
   *  (or when an edit with pending uploads is cancelled). */
  onDeleteAttachment?: (fileId: string) => Promise<void>;
  /** Optional file validation before upload. Return an error string to reject,
   *  or null to accept. */
  onValidateFile?: (file: File) => string | null;
  /** Maximum number of attachments per message (existing + new). Default 10. */
  maxAttachments?: number;
  /** File input accept filter. Default "image/*,video/*". */
  accept?: string;
}

/** Renders a single attachment -- fetches presigned URL on demand if missing */
function AttachmentRenderer({
  att,
  fetcher,
}: {
  att: Attachment;
  fetcher?: (fileId: string) => Promise<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const fetchedUrl = useAttachmentUrl(att.file_id, !!att.presigned_url, fetcher);
  const viewUrl = att.presigned_url || fetchedUrl;

  const isImage = att.mime_type?.startsWith('image/');
  const isVideo = att.mime_type?.startsWith('video/');
  const isAudio = att.mime_type?.startsWith('audio/');

  if (isImage && viewUrl) {
    return (
      <>
        <img
          src={viewUrl}
          alt={att.file_name}
          loading="lazy"
          onClick={() => setExpanded(true)}
          style={{
            display: 'block',
            maxHeight: 240,
            maxWidth: '100%',
            objectFit: 'contain',
            cursor: 'pointer',
            borderRadius: 8,
          }}
        />
        {expanded && (
          <div
            onClick={() => setExpanded(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              cursor: 'pointer',
            }}
          >
            <img
              src={viewUrl}
              alt={att.file_name}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          </div>
        )}
      </>
    );
  }

  if (isVideo && viewUrl) {
    return (
      <video
        src={viewUrl}
        controls
        preload="metadata"
        poster={att.thumbnail_url}
        style={{
          display: 'block',
          maxHeight: 240,
          maxWidth: '100%',
          borderRadius: 8,
        }}
      />
    );
  }

  if (isAudio && viewUrl) {
    return (
      <audio
        src={viewUrl}
        controls
        style={{ display: 'block', width: '100%', marginTop: 4 }}
      />
    );
  }

  if (isImage && !viewUrl) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          fontSize: 12,
          color: 'var(--sm-muted-text, #6b7280)',
          background: 'var(--sm-surface-muted, #f8fafc)',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            border: '2px solid var(--sm-border-color, #e5e7eb)',
            borderTopColor: 'var(--sm-primary, #2563eb)',
            borderRadius: 999,
            animation: 'sm-spin 0.8s linear infinite',
          }}
        />
        Loading image...
      </div>
    );
  }

  // Generic file attachment
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        fontSize: 14,
        color: 'var(--sm-text-color, #111827)',
        background: 'var(--sm-surface-muted, #f8fafc)',
        borderRadius: 8,
        border: '1px solid var(--sm-border-color, #e5e7eb)',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      {viewUrl ? (
        <a
          href={viewUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', textDecoration: 'underline' }}
        >
          {att.file_name}
        </a>
      ) : (
        att.file_name
      )}
    </div>
  );
}

export function ChatMessageItem({
  message,
  currentUserId,
  conversationId,
  profile: profileProp,
  getProfile,
  onAddReaction,
  onRemoveReaction,
  onEdit,
  onDelete,
  onReport,
  onFetchAttachmentUrl,
  isOwnMessage: isOwnMessageProp,
  highlight = false,
  renderAvatar,
  renderAttachment,
  onUploadAttachment,
  onDeleteAttachment,
  onValidateFile,
  maxAttachments = 10,
  accept = 'image/*,video/*',
}: ChatMessageItemProps): React.JSX.Element {
  // Profile resolution: explicit `profile` prop wins, else fall back to
  // `getProfile(senderId)`, else undefined (default "User" placeholder).
  const profile = profileProp ?? getProfile?.(message.sender_id);
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [editAttachments, setEditAttachments] = useState<Attachment[]>(message.attachments ?? []);
  const [editUploads, setEditUploads] = useState<PendingUpload[]>([]);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setEditContent(message.content);
    setEditAttachments(message.attachments ?? []);
    setEditUploads([]);
    setEditing(true);
  }

  const cancelEditing = useCallback(() => {
    // Revoke preview URLs
    for (const u of editUploads) {
      if (u.preview) URL.revokeObjectURL(u.preview);
      // Abort in-progress uploads
      if (u.status === 'uploading') u.abort.abort();
      // Clean up already-uploaded files
      if (u.status === 'ready' && u.attachment) {
        void onDeleteAttachment?.(u.attachment.file_id);
      }
    }
    setEditContent(message.content);
    setEditAttachments(message.attachments ?? []);
    setEditUploads([]);
    setEditing(false);
  }, [editUploads, message.content, message.attachments, onDeleteAttachment]);

  // Sync edit state when message updates from another user while editing
  useEffect(() => {
    if (!editing) {
      setEditContent(message.content);
      setEditAttachments(message.attachments ?? []);
    }
  }, [message.content, message.attachments, editing]);

  const handleEditFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || !onUploadAttachment) return;
      const totalCount = editAttachments.length + editUploads.filter((u) => u.status !== 'error').length;
      for (let i = 0; i < files.length && totalCount + i < maxAttachments; i++) {
        const file = files[i];
        if (onValidateFile) {
          const err = onValidateFile(file);
          if (err) continue;
        }
        const abort = new AbortController();
        const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const preview = isImage || isVideo ? URL.createObjectURL(file) : undefined;

        const pending: PendingUpload = { id, file, preview, status: 'uploading', progress: 0, abort };
        setEditUploads((prev) => [...prev, pending]);

        onUploadAttachment(
          file,
          (pct) => setEditUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress: pct } : u))),
          abort.signal,
        ).then((res) => {
          if (res.data) {
            setEditUploads((prev) =>
              prev.map((u) => (u.id === id ? { ...u, status: 'ready' as const, attachment: res.data!, progress: 100 } : u)),
            );
          } else {
            setEditUploads((prev) =>
              prev.map((u) => (u.id === id ? { ...u, status: 'error' as const, error: res.error?.message ?? 'Upload failed' } : u)),
            );
          }
        }).catch(() => {
          setEditUploads((prev) =>
            prev.map((u) => (u.id === id ? { ...u, status: 'error' as const, error: 'Upload failed' } : u)),
          );
        });
      }
    },
    [onUploadAttachment, onValidateFile, editAttachments.length, editUploads, maxAttachments],
  );

  const isOwn =
    isOwnMessageProp !== undefined
      ? isOwnMessageProp
      : Boolean(currentUserId && message.sender_id === currentUserId);

  const displayName = profile?.display_name ?? 'User';
  const username = profile?.username;
  const avatarUrl = profile?.avatar_url;
  const initials = displayName.charAt(0).toUpperCase();
  const canReact = Boolean(onAddReaction || onRemoveReaction);

  function handleToggleReaction(emoji: string) {
    const hasReacted = message.reactions?.some(
      (r) =>
        r.emoji === emoji && currentUserId && r.user_ids.includes(currentUserId),
    );
    if (hasReacted) {
      void onRemoveReaction?.(message.id, emoji);
    } else {
      void onAddReaction?.(message.id, emoji);
    }
  }

  function handleSaveEdit() {
    // Merge existing (possibly reduced) + newly uploaded attachments
    const readyUploads = editUploads.filter((u) => u.status === 'ready' && u.attachment);
    const allAttachments = [...editAttachments, ...readyUploads.map((u) => u.attachment!)];

    const originalAttachmentIds = new Set((message.attachments ?? []).map((a) => a.file_id));
    const mergedAttachmentIds = new Set(allAttachments.map((a) => a.file_id));
    const attachmentsChanged =
      originalAttachmentIds.size !== mergedAttachmentIds.size ||
      [...originalAttachmentIds].some((id) => !mergedAttachmentIds.has(id)) ||
      [...mergedAttachmentIds].some((id) => !originalAttachmentIds.has(id));
    const contentChanged = editContent.trim() !== message.content;
    const hasContent = editContent.trim() || allAttachments.length > 0;

    // Delete-on-empty: clearing all text + attachments deletes the message
    if (!hasContent) {
      void onDelete?.(message.id);
      // Clean up preview URLs
      for (const u of editUploads) {
        if (u.preview) URL.revokeObjectURL(u.preview);
      }
      setEditUploads([]);
      setEditing(false);
      return;
    }

    if (contentChanged || attachmentsChanged) {
      void onEdit?.(
        message.id,
        editContent.trim(),
        attachmentsChanged ? allAttachments : undefined,
      );
    }
    // Clean up preview URLs (files are now saved, don't delete from server)
    for (const u of editUploads) {
      if (u.preview) URL.revokeObjectURL(u.preview);
    }
    setEditUploads([]);
    setEditing(false);
  }

  // System messages
  if (message.message_type === 'system') {
    let displayText = message.content;

    // Parse conference call translation keys
    if (message.content.startsWith('system.call.')) {
      const parts = message.content.split('|');
      const key = parts[0];
      const params: Record<string, string> = {};
      for (let i = 1; i < parts.length; i++) {
        const [k, v] = parts[i].split('=');
        if (k && v) params[k] = v;
      }

      if (key === 'system.call.started') {
        const type = params.type === 'audio' ? 'Audio' : 'Video';
        displayText = `${type} call started`;
      } else if (key === 'system.call.ended') {
        const secs = parseInt(params.duration || '0', 10);
        const mins = Math.floor(secs / 60);
        const rem = secs % 60;
        displayText = `Call ended (${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')})`;
      }
    }

    return (
      <div
        style={{
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--sm-muted-text, #6b7280)',
          padding: '8px 0',
          fontStyle: 'italic',
        }}
      >
        {displayText}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        padding: '3px 16px',
        position: 'relative',
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar -- other's messages only */}
      {!isOwn &&
        (renderAvatar ? (
          renderAvatar(profile, message)
        ) : (
          <div
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'var(--sm-surface-muted, #f3f4f6)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--sm-muted-text, #6b7280)',
              marginRight: 10,
              marginTop: 2,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              initials
            )}
          </div>
        ))}

      {/* Message bubble area */}
      <div style={{ position: 'relative', maxWidth: '75%', minWidth: 0 }}>
        {/* Hover actions toolbar */}
        {showActions && canReact && (
          <div
            style={{
              position: 'absolute',
              top: -12,
              [isOwn ? 'right' : 'left']: 4,
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'var(--sm-surface, #fff)',
              border: '1px solid var(--sm-border-color, #e5e7eb)',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              padding: '2px 4px',
            }}
          >
            <EmojiPickerTrigger
              onSelect={(emoji) => void onAddReaction?.(message.id, emoji)}
            />
            {!isOwn && onReport && (
              <button
                onClick={() => {
                  setShowActions(false);
                  onReport(message.id);
                }}
                type="button"
                aria-label="Report"
                title="Report message"
                style={{
                  padding: 6,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--sm-muted-text, #6b7280)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </button>
            )}
            {isOwn && onEdit && (
              <button
                onClick={() => startEditing()}
                type="button"
                aria-label="Edit"
                style={{
                  padding: 6,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--sm-muted-text, #6b7280)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {isOwn && onDelete && (
              <button
                onClick={() => void onDelete(message.id)}
                type="button"
                aria-label="Delete"
                style={{
                  padding: 6,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--sm-muted-text, #6b7280)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          style={{
            borderRadius: 'var(--sm-border-radius, 16px)',
            ...(isOwn
              ? { borderBottomRightRadius: 6 }
              : { borderBottomLeftRadius: 6 }),
            padding: '8px 14px',
            background: isOwn
              ? 'var(--sm-own-bubble-bg, var(--sm-own-bubble, var(--sm-primary, #2563eb)))'
              : 'var(--sm-other-bubble-bg, var(--sm-other-bubble, #f3f4f6))',
            color: isOwn
              ? 'var(--sm-own-bubble-text, var(--sm-own-text, #ffffff))'
              : 'var(--sm-other-bubble-text, var(--sm-other-text, #111827))',
            fontSize: 'var(--sm-font-size, 14px)',
            fontFamily:
              'var(--sm-font-family, system-ui, -apple-system, sans-serif)',
            boxShadow: highlight
              ? '0 0 0 2px rgba(37, 99, 235, 0.22)'
              : 'none',
            transition: 'box-shadow 0.2s ease',
          }}
        >
          {/* Sender name + @username -- other's messages only */}
          {!isOwn && (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                marginBottom: 2,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--sm-other-bubble-text, var(--sm-other-text, #111827))',
                }}
              >
                {displayName}
              </span>
              {username && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--sm-muted-text, #9ca3af)',
                  }}
                >
                  @{username}
                </span>
              )}
            </div>
          )}

          {editing ? (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !editUploads.some((u) => u.status === 'uploading')) handleSaveEdit();
                    if (e.key === 'Escape') cancelEditing();
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    fontSize: 14,
                    border: '1px solid var(--sm-border-color, #e5e7eb)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    outline: 'none',
                    color: 'var(--sm-text-color, #111827)',
                    background: 'var(--sm-surface, #fff)',
                  }}
                />
                {onUploadAttachment && (
                  <>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept={accept}
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        void handleEditFileSelect(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={editAttachments.length + editUploads.filter((u) => u.status !== 'error').length >= maxAttachments}
                      aria-label="Attach file"
                      title="Attach file"
                      style={{
                        padding: 4,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: isOwn ? 'rgba(255,255,255,0.7)' : 'var(--sm-muted-text, #6b7280)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>
                  </>
                )}
                <button
                  onClick={handleSaveEdit}
                  type="button"
                  disabled={editUploads.some((u) => u.status === 'uploading')}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    border: 'none',
                    background: 'transparent',
                    cursor: editUploads.some((u) => u.status === 'uploading') ? 'not-allowed' : 'pointer',
                    opacity: editUploads.some((u) => u.status === 'uploading') ? 0.5 : 1,
                    color: isOwn
                      ? 'rgba(255,255,255,0.7)'
                      : 'var(--sm-primary, #2563eb)',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={cancelEditing}
                  type="button"
                  style={{
                    fontSize: 12,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: isOwn
                      ? 'rgba(255,255,255,0.7)'
                      : 'var(--sm-muted-text, #6b7280)',
                  }}
                >
                  Cancel
                </button>
              </div>
              {/* Existing attachment chips */}
              {(editAttachments.length > 0 || editUploads.length > 0) ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {editAttachments.map((att) => (
                    <div
                      key={att.file_id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        background: isOwn ? 'rgba(255,255,255,0.15)' : 'var(--sm-surface-muted, #f3f4f6)',
                        color: isOwn ? 'rgba(255,255,255,0.8)' : 'var(--sm-muted-text, #6b7280)',
                      }}
                    >
                      <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {att.file_name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditAttachments((prev) => prev.filter((a) => a.file_id !== att.file_id))}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: 14,
                          lineHeight: 1,
                          color: 'inherit',
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  {/* Pending upload chips */}
                  {editUploads.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        background: isOwn ? 'rgba(255,255,255,0.15)' : 'var(--sm-surface-muted, #f3f4f6)',
                        color: u.status === 'error'
                          ? 'var(--sm-error, #ef4444)'
                          : isOwn ? 'rgba(255,255,255,0.8)' : 'var(--sm-muted-text, #6b7280)',
                      }}
                    >
                      {u.status === 'uploading' && (
                        <span style={{ fontSize: 10 }}>{Math.round(u.progress)}%</span>
                      )}
                      <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (u.status === 'uploading') u.abort.abort();
                          if (u.preview) URL.revokeObjectURL(u.preview);
                          if (u.status === 'ready' && u.attachment) {
                            void onDeleteAttachment?.(u.attachment.file_id);
                          }
                          setEditUploads((prev) => prev.filter((p) => p.id !== u.id));
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: 14,
                          lineHeight: 1,
                          color: 'inherit',
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : message.content ? (
            <p
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.content}
            </p>
          ) : null}

          {/* Timestamp + edited */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 2,
              justifyContent: isOwn ? 'flex-end' : 'flex-start',
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: isOwn
                  ? 'rgba(255,255,255,0.6)'
                  : 'var(--sm-muted-text, #9ca3af)',
              }}
            >
              {formatMessageTime(message.created_at)}
            </span>
            {message.is_edited && (
              <span
                style={{
                  fontSize: 10,
                  fontStyle: 'italic',
                  color: isOwn
                    ? 'rgba(255,255,255,0.6)'
                    : 'var(--sm-muted-text, #9ca3af)',
                }}
              >
                (edited)
              </span>
            )}
          </div>
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div
            style={{
              marginTop: 4,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: isOwn ? 'flex-end' : 'flex-start',
            }}
          >
            {message.attachments.map((att) => (
              <div
                key={att.file_id}
                style={{
                  borderRadius: 8,
                  overflow: 'hidden',
                  maxWidth: 320,
                }}
              >
                {renderAttachment ? (
                  renderAttachment(att)
                ) : (
                  <AttachmentRenderer
                    att={att}
                    fetcher={onFetchAttachmentUrl}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Reactions */}
        <ReactionBar
          reactions={message.reactions ?? []}
          currentUserId={currentUserId}
          onToggleReaction={handleToggleReaction}
        />
      </div>
    </div>
  );
}
