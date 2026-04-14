import React, { useState, useRef, useCallback, useEffect } from 'react';

import type { ApiError, ApiResponse, Attachment, ChatMessage, SendMessageOptions } from '../types';
import { countCodePoints } from './utils';

/** Result returned by ChatInput.onSend. Allows sync or async, with or without ApiResponse. */
export type ChatInputSendResult = void | ApiResponse<ChatMessage> | undefined;

interface PendingAttachment {
  id: string;
  file: File;
  preview: string;
  status: 'uploading' | 'ready' | 'error';
  progress: number;
  attachment?: Attachment;
  error?: string;
  abortController?: AbortController;
}

interface ChatInputProps {
  onSend: (
    content: string,
    attachments?: Attachment[],
    options?: Pick<SendMessageOptions, 'content_format' | 'message_type'>,
  ) => ChatInputSendResult | Promise<ChatInputSendResult>;
  /** Called when send fails (API returned error or threw). Receives ApiError. */
  onSendError?: (error: ApiError) => void;
  onTypingChange?: (isTyping: boolean) => void;
  onUploadAttachment?: (
    file: File | Blob,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal,
  ) => Promise<{ data: Attachment | null; error: { message: string } | null } | undefined>;
  onDeleteAttachment?: (fileId: string) => void | Promise<void>;
  onValidateFile?: (file: File) => { valid: boolean; error?: string };
  placeholder?: string;
  disabled?: boolean;
  maxAttachments?: number;
  accept?: string;
  /** Maximum content length in Unicode code points. When set, shows a counter
   *  and disables send when exceeded. Backend enforces 40,000 by default. */
  maxLength?: number;
  /** Show counter when content length exceeds warnThreshold * maxLength. Default 0.9. */
  warnThreshold?: number;
  /**
   * Render-prop escape hatch: replace the default send button with a fully
   * custom element. Host apps use this to drop in their own themed button
   * (shadcn Button, gradient background, custom icon) without forking the
   * entire ChatInput.
   *
   * The render function receives `canSend` (false when empty or uploading)
   * and `onSend` (the submit callback wired into ChatInput's state).
   */
  renderSendButton?: (args: {
    canSend: boolean;
    disabled: boolean;
    onSend: () => void;
  }) => React.ReactNode;
}

export function ChatInput({
  onSend,
  onSendError,
  onTypingChange,
  onUploadAttachment,
  onDeleteAttachment,
  onValidateFile,
  placeholder = 'Type a message...',
  disabled = false,
  maxAttachments = 5,
  accept = 'image/*,video/*',
  maxLength,
  warnThreshold = 0.9,
  renderSendButton,
}: ChatInputProps): React.JSX.Element {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCounterRef = useRef(0);

  const hasReadyAttachments = attachments.some((a) => a.status === 'ready');
  const hasUploadingAttachments = attachments.some(
    (a) => a.status === 'uploading',
  );
  // Use code-point count (matches Rust chars().count()) — emoji = 1, not 2 like text.length
  const codePointCount = countCodePoints(text);
  const overLimit = maxLength != null && codePointCount > maxLength;
  const showCounter =
    maxLength != null && codePointCount > Math.floor(maxLength * warnThreshold);
  const canSend: boolean = Boolean(
    (text.trim() || hasReadyAttachments) &&
      !hasUploadingAttachments &&
      !isSending &&
      !overLimit,
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      for (const att of attachments) {
        att.abortController?.abort();
        URL.revokeObjectURL(att.preview);
        if (att.status === 'ready' && att.attachment?.file_id) {
          void onDeleteAttachment?.(att.attachment.file_id);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTyping = useCallback(() => {
    if (!onTypingChange) return;
    onTypingChange(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => onTypingChange(false), 2000);
  }, [onTypingChange]);

  const addFiles = useCallback(
    (files: File[]) => {
      if (!onUploadAttachment) return;
      const remaining = maxAttachments - attachments.length;
      const toAdd = files.slice(0, remaining);

      for (const file of toAdd) {
        if (onValidateFile) {
          const validation = onValidateFile(file);
          if (!validation.valid) {
            console.warn('File rejected:', validation.error);
            continue;
          }
        }

        const id = crypto.randomUUID();
        const preview = URL.createObjectURL(file);
        const abortController = new AbortController();

        const pending: PendingAttachment = {
          id,
          file,
          preview,
          status: 'uploading',
          progress: 0,
          abortController,
        };

        setAttachments((prev) => [...prev, pending]);

        // Start upload immediately
        onUploadAttachment(
          file,
          (progress: number) => {
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === id ? { ...a, progress } : a,
              ),
            );
          },
          abortController.signal,
        )
          .then((result) => {
            if (result?.data) {
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === id
                    ? {
                        ...a,
                        status: 'ready' as const,
                        progress: 100,
                        attachment: result.data!,
                      }
                    : a,
                ),
              );
            } else {
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === id
                    ? {
                        ...a,
                        status: 'error' as const,
                        error:
                          result?.error?.message ?? 'Upload failed',
                      }
                    : a,
                ),
              );
            }
          })
          .catch((err: Error) => {
            if (err.name === 'AbortError') return;
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === id
                  ? { ...a, status: 'error' as const, error: err.message }
                  : a,
              ),
            );
          });
      }
    },
    [attachments.length, maxAttachments, onUploadAttachment, onValidateFile],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      setAttachments((prev) => {
        const att = prev.find((a) => a.id === id);
        if (att) {
          att.abortController?.abort();
          URL.revokeObjectURL(att.preview);
          if (att.status === 'ready' && att.attachment?.file_id) {
            void onDeleteAttachment?.(att.attachment.file_id);
          }
        }
        return prev.filter((a) => a.id !== id);
      });
    },
    [onDeleteAttachment],
  );

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    const readyAttachments: Attachment[] = attachments
      .filter((a) => a.status === 'ready' && a.attachment)
      .map((a) => a.attachment!);

    setIsSending(true);
    try {
      const result = await onSend(
        text.trim(),
        readyAttachments.length > 0 ? readyAttachments : undefined,
      );

      // If onSend returned an ApiResponse with an error, treat as failure.
      // Keep input populated so the user can edit and retry.
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        onSendError?.(result.error);
        return;
      }

      // Success: clear state -- don't delete sent files (they're now part of the message)
      for (const att of attachments) {
        URL.revokeObjectURL(att.preview);
      }
      setText('');
      setAttachments([]);
      if (onTypingChange) onTypingChange(false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      textareaRef.current?.focus();
    } catch (err: unknown) {
      // Thrown exception (network error etc.) — keep input populated, fire error callback
      const message = err instanceof Error ? err.message : 'Send failed';
      onSendError?.({ code: 'send_failed', message, status: 0 });
    } finally {
      setIsSending(false);
    }
  }, [text, attachments, canSend, onSend, onSendError, onTypingChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      handleTyping();
      const ta = e.target;
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    },
    [handleTyping],
  );

  // Drag and drop handlers
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer.types.includes('Files') && onUploadAttachment) {
        setIsDragOver(true);
      }
    },
    [onUploadAttachment],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      dragCounterRef.current = 0;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) addFiles(files);
    },
    [addFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) addFiles(files);
      e.target.value = ''; // Reset so same file can be selected again
    },
    [addFiles],
  );

  return (
    <div
      style={{
        position: 'relative',
        borderTop: '1px solid var(--sm-border-color, #e5e7eb)',
        background: 'var(--sm-surface, #fff)',
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            background: 'rgba(37, 99, 235, 0.1)',
            backdropFilter: 'blur(4px)',
            borderRadius: '0 0 var(--sm-border-radius, 16px) var(--sm-border-radius, 16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--sm-primary, #2563eb)"
              strokeWidth="2"
              style={{ margin: '0 auto 8px' }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p
              style={{
                margin: 0,
                color: 'var(--sm-primary, #2563eb)',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Drop to attach
            </p>
          </div>
        </div>
      )}

      {/* Attachment preview chips */}
      {attachments.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '8px 12px 4px',
            overflowX: 'auto',
          }}
        >
          {attachments.map((att) => (
            <div
              key={att.id}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background:
                  att.status === 'error'
                    ? '#fef2f2'
                    : 'var(--sm-surface-muted, #f8fafc)',
                border:
                  att.status === 'error'
                    ? '1px solid #fecaca'
                    : '1px solid var(--sm-border-color, #e5e7eb)',
                borderRadius: 8,
                padding: '6px 8px',
                fontSize: 12,
                flexShrink: 0,
                maxWidth: 180,
              }}
            >
              {/* Thumbnail */}
              {att.file.type.startsWith('image/') ? (
                <img
                  src={att.preview}
                  alt=""
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    background: 'var(--sm-border-color, #e5e7eb)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
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
                    style={{ color: 'var(--sm-muted-text, #6b7280)' }}
                  >
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
              )}

              {/* Name + progress */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--sm-text-color, #111827)',
                  }}
                >
                  {att.file.name}
                </p>
                {att.status === 'uploading' && (
                  <div
                    style={{
                      width: '100%',
                      height: 3,
                      background: 'var(--sm-border-color, #e5e7eb)',
                      borderRadius: 999,
                      marginTop: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        background: 'var(--sm-primary, #2563eb)',
                        borderRadius: 999,
                        transition: 'width 0.2s ease',
                        width: `${att.progress}%`,
                      }}
                    />
                  </div>
                )}
                {att.status === 'error' && (
                  <p
                    style={{
                      margin: 0,
                      color: '#dc2626',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {att.error}
                  </p>
                )}
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                style={{
                  flexShrink: 0,
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 999,
                  background: 'var(--sm-muted-text, #9ca3af)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 10,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          padding: '8px 12px',
        }}
      >
        {/* File picker button */}
        {onUploadAttachment && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || attachments.length >= maxAttachments}
              aria-label="Attach file"
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                border: 'none',
                background: 'transparent',
                cursor:
                  disabled || attachments.length >= maxAttachments
                    ? 'not-allowed'
                    : 'pointer',
                color: 'var(--sm-muted-text, #6b7280)',
                opacity:
                  disabled || attachments.length >= maxAttachments ? 0.4 : 1,
                marginBottom: 2,
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            fontSize: 14,
            background: 'var(--sm-surface-muted, #f8fafc)',
            border: '1px solid var(--sm-border-color, #e5e7eb)',
            borderRadius: 16,
            padding: '8px 16px',
            fontFamily:
              'var(--sm-font-family, system-ui, -apple-system, sans-serif)',
            color: 'var(--sm-text-color, #111827)',
            resize: 'none',
            overflow: 'hidden',
            outline: 'none',
            minHeight: 36,
            lineHeight: '20px',
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
            boxSizing: 'border-box',
          }}
        />

        {renderSendButton ? (
          renderSendButton({
            canSend,
            disabled,
            onSend: () => void handleSend(),
          })
        ) : (
          <button
            onClick={() => void handleSend()}
            disabled={disabled || !canSend}
            type="button"
            aria-label="Send message"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              border: 'none',
              background: 'var(--sm-primary, #2563eb)',
              color: '#fff',
              cursor: disabled || !canSend ? 'not-allowed' : 'pointer',
              opacity: disabled || !canSend ? 0.4 : 1,
              marginBottom: 2,
              transition: 'opacity 0.15s ease',
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
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>
      {showCounter && maxLength != null && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '0 16px 4px',
            fontSize: 11,
            color: overLimit
              ? 'var(--sm-error-text, #dc2626)'
              : codePointCount > maxLength * 0.95
                ? 'var(--sm-warning-text, #ea580c)'
                : 'var(--sm-muted-text, #6b7280)',
            fontVariantNumeric: 'tabular-nums',
          }}
          role="status"
          aria-live="polite"
        >
          {codePointCount.toLocaleString()} / {maxLength.toLocaleString()}
        </div>
      )}
    </div>
  );
}
