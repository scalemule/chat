import React, { useMemo, useRef, useState } from 'react';

import type { Attachment } from '../types';

interface ChatInputProps {
  onSend: (content: string, attachments: Attachment[]) => void | Promise<void>;
  onTypingChange?: (isTyping: boolean) => void;
  onUploadAttachment?: (
    file: File | Blob,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal,
  ) => Promise<{ data: Attachment | null; error: { message: string } | null } | undefined>;
  placeholder?: string;
}

interface PendingAttachment {
  id: string;
  fileName: string;
  progress: number;
  attachment?: Attachment;
  error?: string;
}

export function ChatInput({
  onSend,
  onTypingChange,
  onUploadAttachment,
  placeholder = 'Type a message...',
}: ChatInputProps): React.JSX.Element {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readyAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.attachment).map((attachment) => attachment.attachment as Attachment),
    [attachments],
  );
  const uploadingCount = attachments.filter((attachment) => !attachment.attachment && !attachment.error).length;

  const emitTyping = () => {
    onTypingChange?.(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onTypingChange?.(false);
    }, 2500);
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    if (!onUploadAttachment) return;

    const files = Array.from(fileList);
    for (const file of files) {
      const id = `${file.name}:${file.size}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      setAttachments((current) => [
        ...current,
        {
          id,
          fileName: file.name,
          progress: 0,
        },
      ]);

      const result = await onUploadAttachment(file, (progress) => {
        setAttachments((current) =>
          current.map((attachment) =>
            attachment.id === id ? { ...attachment, progress } : attachment,
          ),
        );
      });

      setAttachments((current) =>
        current.map((attachment) => {
          if (attachment.id !== id) return attachment;

          if (result?.data) {
            return {
              ...attachment,
              progress: 100,
              attachment: result.data,
            };
          }

          return {
            ...attachment,
            error: result?.error?.message ?? 'Upload failed',
          };
        }),
      );
    }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if ((!trimmed && !readyAttachments.length) || isSending || uploadingCount > 0) return;

    setIsSending(true);
    try {
      await onSend(trimmed, readyAttachments);
      setContent('');
      setAttachments([]);
      onTypingChange?.(false);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (onUploadAttachment) {
          setIsDragging(true);
        }
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        void handleFiles(event.dataTransfer.files);
      }}
      style={{
        borderTop: '1px solid var(--sm-border-color, #e5e7eb)',
        background: isDragging ? 'rgba(37, 99, 235, 0.06)' : 'var(--sm-surface, #fff)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {attachments.length ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 999,
                background: 'var(--sm-surface-muted, #f8fafc)',
                border: '1px solid var(--sm-border-color, #e5e7eb)',
                fontSize: 12,
              }}
            >
              <span>{attachment.fileName}</span>
              <span style={{ color: attachment.error ? '#dc2626' : 'var(--sm-muted-text, #6b7280)' }}>
                {attachment.error ?? `${attachment.progress}%`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAttachments((current) => current.filter((item) => item.id !== attachment.id));
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--sm-muted-text, #6b7280)',
                }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <textarea
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            emitTyping();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          rows={1}
          placeholder={placeholder}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            resize: 'vertical',
            borderRadius: 14,
            border: '1px solid var(--sm-border-color, #e5e7eb)',
            padding: '12px 14px',
            font: 'inherit',
            color: 'var(--sm-text-color, #111827)',
          }}
        />

        {onUploadAttachment ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept="image/*,video/*,audio/*"
              onChange={(event) => {
                if (event.target.files) {
                  void handleFiles(event.target.files);
                  event.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach files"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                border: '1px solid var(--sm-border-color, #e5e7eb)',
                background: 'var(--sm-surface, #fff)',
                cursor: 'pointer',
                color: 'var(--sm-text-color, #111827)',
              }}
            >
              +
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSending || uploadingCount > 0 || (!content.trim() && !readyAttachments.length)}
          style={{
            height: 44,
            padding: '0 16px',
            borderRadius: 14,
            border: 'none',
            background: 'var(--sm-primary, #2563eb)',
            color: '#fff',
            cursor: isSending ? 'wait' : 'pointer',
            opacity: isSending || uploadingCount > 0 ? 0.75 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
