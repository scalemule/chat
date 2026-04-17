import React, { useState, useEffect, useRef, useCallback } from 'react';

import type { ChatMessage, Attachment, ApiResponse } from '../types';
import { Avatar } from './Avatar';
import { EmojiPickerTrigger } from './EmojiPicker';
import { ReactionBar } from './ReactionBar';
import { sanitizeHtml, stripTags } from './sanitize';
import { formatMessageTime } from './utils';
import { linkify } from '../shared/linkify';
import {
  defaultFormatSystemMessage,
  type SystemMessageProfile,
} from './systemMessages';

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
  onEdit?: (
    messageId: string,
    content: string,
    attachments?: Attachment[],
    contentFormat?: 'plain' | 'html',
  ) => void | Promise<void>;
  onDelete?: (messageId: string) => void | Promise<void>;
  onReport?: (messageId: string) => void;
  onFetchAttachmentUrl?: (fileId: string) => Promise<string>;
  isOwnMessage?: boolean;
  /**
   * @deprecated Pass `isSearchHit` and/or `isUnreadStart` explicitly so the
   * two visually-distinct concepts can render differently. When set, the
   * value is treated as `isSearchHit || isUnreadStart` for backwards
   * compatibility — but this only buys host apps a bridging window; the
   * unified style is already split in the SDK. Will be removed in 0.1.0.
   */
  highlight?: boolean;
  /**
   * The message is the target of a "scroll-to-message" jump (e.g. clicking
   * a search result). Adds the `sm-message-highlighted` class which paints
   * a 2-second amber fade + left border via CSS animation. Set by
   * `ChatMessageList` when `highlightMessageId === message.id`.
   */
  isSearchHit?: boolean;
  /**
   * The message is the first unread message in the thread. Adds the
   * `sm-message-unread-start` class — a subtle ring matching the unread
   * divider color, distinct from the louder search-hit animation.
   */
  isUnreadStart?: boolean;
  /**
   * Suppress the avatar and sender header on this message because it groups
   * with the previous one (same sender, recent enough). The composing list
   * (`ChatMessageList`) decides; the item just renders. Default false.
   */
  isGrouped?: boolean;
  /**
   * Click handler for `<span class="sm-mention" data-sm-user-id="...">`
   * elements rendered inside HTML messages. The component delegates a single
   * `onClick` on the message body and resolves the user id from the
   * `data-sm-user-id` attribute. Hosts wire navigation (open profile, route
   * to `/u/{id}`, etc). When omitted the chip is still styled and clickable
   * but the click is a no-op.
   */
  onMentionClick?: (userId: string, message: ChatMessage) => void;
  /**
   * Click handler for `<span class="sm-channel-mention" data-sm-channel-id>`.
   * See `onMentionClick` for the delegation contract.
   */
  onChannelMentionClick?: (channelId: string, message: ChatMessage) => void;
  /**
   * Auto-linkify URLs in plain-text messages. Default true. Detected URLs
   * render as `<a class="sm-link-auto" target="_blank" rel="noopener
   * noreferrer nofollow">`. HTML messages are unaffected — Quill auto-links
   * at compose time and the sanitizer preserves the markup.
   */
  linkifyPlainText?: boolean;
  /**
   * Resolve the human-readable text for `message_type === 'system'` rows.
   * Default handles channel events (joined/left/invited/created/renamed/
   * archived) and call events (started/ended). Hosts override for
   * locales or new event types. Receives the raw content string and a
   * profiles map for resolving `user_id` params.
   */
  formatSystemMessage?: (
    content: string,
    profiles: Map<string, SystemMessageProfile> | undefined,
  ) => string;
  /**
   * Profile lookup for system-message actor names. Optional but
   * recommended when channel events are emitted with `user_id` params.
   */
  systemMessageProfiles?: Map<string, SystemMessageProfile>;
  /**
   * Render rich-link embeds (e.g. YouTube cards) below the message body.
   * Hosts opt in by importing from `@scalemule/chat/embeds`:
   *
   * ```tsx
   * import { YouTubeEmbeds } from '@scalemule/chat/embeds';
   * <ChatMessageList renderEmbeds={(m) => <YouTubeEmbeds html={m.content} />} />
   * ```
   *
   * Returns `null` / `undefined` to skip. The default renderer renders
   * nothing, keeping the embeds bundle out of the core React import for
   * hosts that don't use it.
   */
  renderEmbeds?: (message: ChatMessage) => React.ReactNode;
  /** Avatar display size in pixels. Default 32. Set to 36 for pre-generated thumbnail cache hits. */
  avatarSize?: number;
  /** Transform a profile's avatar_url into an optimized thumbnail URL (e.g. photo service transform). */
  getAvatarUrl?: (profile: UserProfile) => string | undefined;
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
  /** Maximum number of attachments per message (existing + new). Default 5. */
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

/**
 * Renders a snippet message — a collapsible card backed by a text/* attachment.
 * Used when message content exceeds the chat limit and is auto-promoted to a snippet.
 *
 * Collapsed: shows the preview (message.content) in a code-style frame.
 * Expanded: fetches the full body and renders in <pre><code>. Retries once on 403
 *           (expired URL) via onFetchAttachmentUrl.
 */
function SnippetCard({
  preview,
  attachment,
  fetcher,
  isOwn,
}: {
  preview: string;
  attachment: Attachment;
  fetcher?: (fileId: string) => Promise<string>;
  isOwn: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedOnce = useRef(false);

  // Load body the first time the user expands the card.
  useEffect(() => {
    if (!expanded || fetchedOnce.current || body != null) return;
    fetchedOnce.current = true;
    setLoading(true);
    setError(null);

    (async () => {
      let url = attachment.presigned_url;
      try {
        // If we don't have a URL yet, fetch one
        if (!url && fetcher) {
          url = await fetcher(attachment.file_id);
        }
        if (!url) throw new Error('No URL for snippet');

        let res = await fetch(url);
        // Retry once on 403 (URL expired) by minting a fresh one
        if (res.status === 403 && fetcher) {
          const freshUrl = await fetcher(attachment.file_id);
          if (freshUrl) {
            res = await fetch(freshUrl);
          }
        }
        if (!res.ok) throw new Error(`Failed to load snippet: ${res.status}`);
        const text = await res.text();
        setBody(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load snippet');
      } finally {
        setLoading(false);
      }
    })();
  }, [expanded, attachment.file_id, attachment.presigned_url, fetcher, body]);

  const retry = () => {
    fetchedOnce.current = false;
    setBody(null);
    setError(null);
    setExpanded(false);
    setTimeout(() => setExpanded(true), 0);
  };

  const sizeLabel = formatFileSize(attachment.file_size);

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        background: 'var(--sm-surface-muted, #f8fafc)',
        overflow: 'hidden',
        minWidth: 240,
        maxWidth: 480,
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          borderBottom: expanded ? '1px solid var(--sm-border-color, #e5e7eb)' : 'none',
          cursor: 'pointer',
          color: 'var(--sm-text-color, #111827)',
          textAlign: 'left',
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
          style={{ flexShrink: 0 }}
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {attachment.file_name}
        </span>
        {sizeLabel && (
          <span style={{ fontSize: 11, color: 'var(--sm-muted-text, #6b7280)' }}>{sizeLabel}</span>
        )}
        <span style={{ fontSize: 12, color: 'var(--sm-muted-text, #6b7280)', marginLeft: 4 }}>
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {/* Preview (collapsed) */}
      {!expanded && preview && (
        <div
          style={{
            padding: '10px 12px',
            fontSize: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: 'var(--sm-muted-text, #6b7280)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 80,
            overflow: 'hidden',
          }}
        >
          {preview}
        </div>
      )}

      {/* Body (expanded) */}
      {expanded && (
        <div style={{ maxHeight: 480, overflow: 'auto' }}>
          {loading && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--sm-muted-text, #6b7280)' }}>
              Loading snippet…
            </div>
          )}
          {error && (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--sm-error-text, #dc2626)', marginBottom: 8 }}>
                {error}
              </div>
              <button
                type="button"
                onClick={retry}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--sm-border-color, #e5e7eb)',
                  background: 'var(--sm-surface, #fff)',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}
          {body != null && (
            <pre
              style={{
                margin: 0,
                padding: 12,
                fontSize: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: 'var(--sm-text-color, #111827)',
                background: 'var(--sm-code-bg, #f3f4f6)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <code>{body}</code>
            </pre>
          )}
        </div>
      )}

      {/* isOwn marker reserved for future per-own styling; referenced to avoid unused warning */}
      {isOwn ? null : null}
    </div>
  );
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  highlight: highlightProp,
  isSearchHit: isSearchHitProp,
  isUnreadStart: isUnreadStartProp,
  isGrouped = false,
  onMentionClick,
  onChannelMentionClick,
  linkifyPlainText = true,
  formatSystemMessage,
  systemMessageProfiles,
  renderEmbeds,
  avatarSize = 32,
  getAvatarUrl,
  renderAvatar,
  renderAttachment,
  onUploadAttachment,
  onDeleteAttachment,
  onValidateFile,
  maxAttachments = 5,
  accept = 'image/*,video/*',
}: ChatMessageItemProps): React.JSX.Element {
  // Profile resolution: explicit `profile` prop wins, else fall back to
  // `getProfile(senderId)`, else undefined (default "User" placeholder).
  const profile = profileProp ?? getProfile?.(message.sender_id);
  // Resolve highlight semantics. Hosts that still pass the deprecated
  // `highlight` boolean get the union of both effects (matches pre-0.0.45
  // behavior) until they migrate to the explicit flags.
  const isSearchHit = isSearchHitProp ?? highlightProp ?? false;
  const isUnreadStart = isUnreadStartProp ?? false;
  const wrapperClasses = [
    isGrouped ? 'sm-message-grouped' : null,
    isSearchHit ? 'sm-message-highlighted' : null,
    isUnreadStart && !isSearchHit ? 'sm-message-unread-start' : null,
  ]
    .filter(Boolean)
    .join(' ');
  const wrapperClassName = wrapperClasses || undefined;
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  // For rich-HTML messages the inline edit UI is plain-text only (Phase A scope),
  // so seed the textarea with plain_text / stripped HTML. Saving text changes
  // sends contentFormat: 'plain' so the backend re-purifies correctly.
  const initialEditText =
    message.content_format === 'html'
      ? (message.plain_text ?? stripTags(message.content))
      : message.content;
  const [editContent, setEditContent] = useState(initialEditText);
  const [editAttachments, setEditAttachments] = useState<Attachment[]>(message.attachments ?? []);
  const [editUploads, setEditUploads] = useState<PendingUpload[]>([]);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setEditContent(initialEditText);
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
    setEditContent(initialEditText);
    setEditAttachments(message.attachments ?? []);
    setEditUploads([]);
    setEditing(false);
  }, [editUploads, initialEditText, message.attachments, onDeleteAttachment]);

  // Sync edit state when message updates from another user while editing
  useEffect(() => {
    if (!editing) {
      setEditContent(initialEditText);
      setEditAttachments(message.attachments ?? []);
    }
  }, [initialEditText, message.attachments, editing]);

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
  const avatarUrl = (profile && getAvatarUrl?.(profile)) ?? profile?.avatar_url;
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
    const contentChanged = editContent.trim() !== initialEditText;
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
      // When editing a rich-HTML message as plain text, tell the backend to
      // re-type the format so the stored HTML is replaced with the new plain
      // text (instead of wrapping it in `<p>` and re-purifying as HTML).
      const contentFormat: 'plain' | 'html' | undefined =
        contentChanged && message.content_format === 'html' ? 'plain' : undefined;
      void onEdit?.(
        message.id,
        editContent.trim(),
        attachmentsChanged ? allAttachments : undefined,
        contentFormat,
      );
    }
    // Clean up preview URLs (files are now saved, don't delete from server)
    for (const u of editUploads) {
      if (u.preview) URL.revokeObjectURL(u.preview);
    }
    setEditUploads([]);
    setEditing(false);
  }

  // Snippet messages — render as a collapsible file-backed card.
  // Snippet convention: `content` is the 280-char preview, and the single
  // attachment (text/*) holds the full body.
  if (message.message_type === 'snippet') {
    const snippetAtt = message.attachments?.[0];
    if (snippetAtt) {
      return (
        <div
          className={wrapperClassName}
          style={{
            display: 'flex',
            justifyContent: isOwn ? 'flex-end' : 'flex-start',
            padding: isGrouped ? '1px 16px' : '3px 16px',
            position: 'relative',
          }}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          {/* Avatar for received snippets — replaced by spacer when grouped */}
          {!isOwn &&
            (isGrouped ? (
              <div
                style={{
                  flexShrink: 0,
                  width: avatarSize,
                  marginRight: 10,
                }}
                aria-hidden="true"
              />
            ) : (
              <div style={{ marginRight: 10, marginTop: 2, flexShrink: 0 }}>
                <Avatar
                  name={displayName}
                  colorKey={message.sender_id}
                  src={avatarUrl}
                  size={avatarSize}
                  initialsMaxChars={1}
                />
              </div>
            ))}
          <div style={{ maxWidth: '75%', minWidth: 0 }}>
            {!isOwn && !isGrouped && (
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--sm-other-text, #111827)' }}>
                {displayName}
              </div>
            )}
            <SnippetCard
              preview={message.content}
              attachment={snippetAtt}
              fetcher={onFetchAttachmentUrl}
              isOwn={isOwn}
            />
            <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--sm-muted-text, #9ca3af)' }}>
                {formatMessageTime(message.created_at)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    // Snippet with no attachment — fall through to system-style "broken" message
    return (
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--sm-muted-text, #6b7280)', padding: '8px 0', fontStyle: 'italic' }}>
        [Snippet unavailable]
      </div>
    );
  }

  // System messages
  if (message.message_type === 'system') {
    const displayText = formatSystemMessage
      ? formatSystemMessage(message.content, systemMessageProfiles)
      : defaultFormatSystemMessage(message.content, {
          profiles: systemMessageProfiles,
        });

    return (
      <div
        className="sm-system-message"
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
      className={wrapperClassName}
      style={{
        display: 'flex',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        padding: isGrouped ? '1px 16px' : '3px 16px',
        position: 'relative',
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar -- other's messages only. Replaced by a spacer when grouped
          so the bubble stays aligned under the previous message's avatar. */}
      {!isOwn &&
        (isGrouped ? (
          <div
            style={{
              flexShrink: 0,
              width: avatarSize,
              marginRight: 10,
            }}
            aria-hidden="true"
          />
        ) : renderAvatar ? (
          renderAvatar(profile, message)
        ) : (
          <div style={{ marginRight: 10, marginTop: 2, flexShrink: 0 }}>
            <Avatar
              name={displayName}
              colorKey={message.sender_id}
              src={avatarUrl}
              size={avatarSize}
              initialsMaxChars={1}
            />
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
          }}
        >
          {/* Sender name + @username -- other's messages, non-grouped only */}
          {!isOwn && !isGrouped && (
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
            message.content_format === 'html' ? (
              <div
                className="sm-rich-content"
                style={{ margin: 0, wordBreak: 'break-word' }}
                onClick={(e) => {
                  if (!onMentionClick && !onChannelMentionClick) return;
                  const target = e.target as HTMLElement | null;
                  if (!target || typeof target.closest !== 'function') return;
                  const userMention = target.closest<HTMLElement>('.sm-mention');
                  if (userMention && onMentionClick) {
                    const userId = userMention.getAttribute('data-sm-user-id');
                    if (userId) {
                      e.preventDefault();
                      e.stopPropagation();
                      onMentionClick(userId, message);
                      return;
                    }
                  }
                  const channelMention = target.closest<HTMLElement>(
                    '.sm-channel-mention',
                  );
                  if (channelMention && onChannelMentionClick) {
                    const channelId = channelMention.getAttribute(
                      'data-sm-channel-id',
                    );
                    if (channelId) {
                      e.preventDefault();
                      e.stopPropagation();
                      onChannelMentionClick(channelId, message);
                    }
                  }
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.content) }}
              />
            ) : (
              <p
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {linkifyPlainText
                  ? linkify(message.content).map((seg, i) =>
                      seg.type === 'link' ? (
                        <a
                          key={`l-${i}`}
                          className="sm-link-auto"
                          href={seg.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          style={{
                            color: isOwn
                              ? 'rgba(255,255,255,0.95)'
                              : 'var(--sm-link-color, var(--sm-primary, #2563eb))',
                            textDecoration: 'underline',
                            wordBreak: 'break-word',
                          }}
                        >
                          {seg.display}
                        </a>
                      ) : (
                        <React.Fragment key={`t-${i}`}>{seg.value}</React.Fragment>
                      ),
                    )
                  : message.content}
              </p>
            )
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

        {/* Embeds (host-supplied; e.g. YouTube cards from @scalemule/chat/embeds) */}
        {renderEmbeds && renderEmbeds(message)}

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
