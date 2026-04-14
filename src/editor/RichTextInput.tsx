/**
 * RichTextInput — Quill-backed drop-in for `ChatInput`.
 *
 * Shipped from `@scalemule/chat/editor`, which is a code-split entry so
 * plain-text consumers of `@scalemule/chat/react` don't pay the Quill cost.
 * Quill itself is a peer dep (optional) — the import happens inside
 * `useEffect` so SSR/CJS consumers never touch `window` at module load.
 *
 * Contract parity with `ChatInput`:
 *   - same `onSend(content, attachments?, options?)` signature
 *   - same attachment/upload/drag-drop/paste-to-attach behaviour
 *   - same snippet-promote semantics for over-limit content
 *   - same code-point counter against `maxLength`
 *
 * Rich-specific behaviours:
 *   - `onSend` body is `quill.getSemanticHTML()` with `content_format: 'html'`
 *     (snippet promote still sends `text/plain` from `quill.getText()`)
 *   - markdown shortcuts (quill-markdown-shortcuts-new) + emoticon replace
 *   - auto-link URLs on space/paste
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type Quill from 'quill';

import type { ApiError, Attachment } from '../types';
import {
  type ChatInputProps,
  type ChatInputOnSendFn,
  type UploadAttachmentFn,
} from '../react-components/ChatInput';
import { countCodePoints } from '../react-components/utils';
import { createKeyboardBindings } from './keyboard';
import { EMOTICON_MAP } from './emoticons';
import { Toolbar } from './Toolbar';
import type {
  ChannelMentionItem,
  MentionUser,
  RichTextInputHandle,
} from './types';

/* ------------------------------------------------------------------------- */
/* Props                                                                      */
/* ------------------------------------------------------------------------- */

export interface RichTextInputProps
  extends Omit<
    ChatInputProps,
    'onSend' | 'renderSendButton'
  > {
  onSend: ChatInputOnSendFn;
  /** Show the format toolbar. Default true. */
  showToolbar?: boolean;
  /** Enable markdown shortcut module (quill-markdown-shortcuts-new). Default true. */
  enableMarkdownShortcuts?: boolean;
  /** Replace text emoticons with emoji on space. Default true. */
  enableEmoticonReplace?: boolean;
  /** Auto-linkify URLs on space/paste. Default true. */
  enableAutoLink?: boolean;
  /**
   * Called as the user types `@query`. Host app responds by setting
   * `mentionUsers` to matching users. Leave unset to disable mentions.
   *
   * The mention dropdown itself is added in a later phase; Phase B accepts
   * the props to keep callers stable across versions.
   */
  onMentionSearch?: (query: string) => void;
  mentionUsers?: MentionUser[];
  onChannelSearch?: (query: string) => void;
  channelResults?: ChannelMentionItem[];
  /**
   * Render-prop escape hatch: replace the default send button, same contract
   * as `ChatInput.renderSendButton`.
   */
  renderSendButton?: (args: {
    canSend: boolean;
    disabled: boolean;
    onSend: () => void;
  }) => React.ReactNode;
}

/* ------------------------------------------------------------------------- */
/* Internal                                                                   */
/* ------------------------------------------------------------------------- */

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

type QuillCtor = typeof Quill;

/* ------------------------------------------------------------------------- */
/* Component                                                                  */
/* ------------------------------------------------------------------------- */

export const RichTextInput = forwardRef<RichTextInputHandle, RichTextInputProps>(
  function RichTextInput(props, ref) {
    const {
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
      snippetFilename = 'message.txt',
      enableSnippetPromote = false,
      showToolbar = true,
      enableMarkdownShortcuts = true,
      enableEmoticonReplace = true,
      enableAutoLink = true,
      renderSendButton,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<Quill | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dragCounterRef = useRef(0);
    const suppressedLinksRef = useRef<Set<string>>(new Set());

    // Refs so lazily-loaded Quill handlers always see the latest callbacks.
    const onSendRef = useRef(onSend);
    onSendRef.current = onSend;
    const onTypingChangeRef = useRef(onTypingChange);
    onTypingChangeRef.current = onTypingChange;
    const uploadRef = useRef<UploadAttachmentFn | undefined>(onUploadAttachment);
    uploadRef.current = onUploadAttachment;
    const enableEmoticonReplaceRef = useRef(enableEmoticonReplace);
    enableEmoticonReplaceRef.current = enableEmoticonReplace;
    const enableAutoLinkRef = useRef(enableAutoLink);
    enableAutoLinkRef.current = enableAutoLink;

    const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [activeFormats, setActiveFormats] = useState<Record<string, unknown>>(
      {},
    );
    const [contentLength, setContentLength] = useState(0);
    const [plainLength, setPlainLength] = useState(0);
    const [isReady, setIsReady] = useState(false);

    const hasReadyAttachments = attachments.some((a) => a.status === 'ready');
    const hasUploadingAttachments = attachments.some(
      (a) => a.status === 'uploading',
    );
    const overLimit = maxLength != null && contentLength > maxLength;
    const showCounter =
      maxLength != null &&
      contentLength > Math.floor(maxLength * warnThreshold);
    const snippetPromoteAvailable =
      enableSnippetPromote &&
      !!onUploadAttachment &&
      overLimit &&
      plainLength > 0;
    const canSend: boolean = Boolean(
      (plainLength > 0 || hasReadyAttachments) &&
        !hasUploadingAttachments &&
        !isSending &&
        (!overLimit || snippetPromoteAvailable),
    );

    /* --------------------------------------------------------------------- */
    /* Attachment upload flow (mirrors ChatInput)                             */
    /* --------------------------------------------------------------------- */

    const addFiles = useCallback(
      (files: File[]) => {
        if (!onUploadAttachment) return;
        const remaining = maxAttachments - attachments.length;
        const toAdd = files.slice(0, remaining);

        for (const file of toAdd) {
          if (onValidateFile) {
            const validation = onValidateFile(file);
            if (!validation.valid) {
              // eslint-disable-next-line no-console
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

          onUploadAttachment(
            file,
            (progress: number) => {
              setAttachments((prev) =>
                prev.map((a) => (a.id === id ? { ...a, progress } : a)),
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
                          error: result?.error?.message ?? 'Upload failed',
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

    /* --------------------------------------------------------------------- */
    /* Send                                                                   */
    /* --------------------------------------------------------------------- */

    const handleSend = useCallback(async () => {
      const quill = quillRef.current;
      if (!quill) return;
      if (!canSend) return;

      const text = quill.getText().trim();
      const html = quill.getSemanticHTML().replace(/&nbsp;/g, ' ');
      const readyAttachments: Attachment[] = attachments
        .filter((a) => a.status === 'ready' && a.attachment)
        .map((a) => a.attachment!);

      setIsSending(true);
      try {
        let result;
        if (snippetPromoteAvailable && onUploadAttachment) {
          // Snippet body is plain text (the visible content), not HTML — mime
          // is text/plain. Rich formatting is intentionally dropped here.
          const { uploadSnippet } = await import('../shared/snippet');
          const { attachment: snippetAtt, preview } = await uploadSnippet(
            text,
            snippetFilename,
            onUploadAttachment,
          );
          result = await onSend(preview, [snippetAtt], {
            content_format: 'plain',
            message_type: 'snippet',
          });
        } else {
          const hasRichFormatting = html !== `<p>${escapeHtml(text)}</p>`;
          result = await onSend(
            hasRichFormatting ? html : text,
            readyAttachments.length > 0 ? readyAttachments : undefined,
            {
              content_format: hasRichFormatting ? 'html' : 'plain',
              message_type: 'text',
            },
          );
        }

        if (result && typeof result === 'object' && 'error' in result && result.error) {
          onSendError?.(result.error);
          return;
        }

        // Snapshot before await already done; only clear if still the same.
        for (const att of attachments) {
          URL.revokeObjectURL(att.preview);
        }
        if (quillRef.current) {
          quillRef.current.setText('');
          suppressedLinksRef.current.clear();
        }
        setAttachments([]);
        if (onTypingChange) onTypingChange(false);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Send failed';
        const error: ApiError = { code: 'send_failed', message, status: 0 };
        onSendError?.(error);
      } finally {
        setIsSending(false);
      }
    }, [
      canSend,
      attachments,
      onSend,
      onSendError,
      onTypingChange,
      snippetPromoteAvailable,
      onUploadAttachment,
      snippetFilename,
    ]);

    // Keep a ref to the latest handleSend so Quill's Enter binding always
    // calls the current closure.
    const handleSendRef = useRef(handleSend);
    handleSendRef.current = handleSend;

    /* --------------------------------------------------------------------- */
    /* Lazy Quill initialization                                              */
    /* --------------------------------------------------------------------- */

    useEffect(() => {
      let cancelled = false;
      if (!containerRef.current) return;

      (async () => {
        const [quillMod, markdownMod] = await Promise.all([
          import('quill'),
          enableMarkdownShortcuts
            ? import('quill-markdown-shortcuts-new')
            : Promise.resolve(null),
        ]);
        if (cancelled || !containerRef.current) return;

        const Quill: QuillCtor = quillMod.default;
        if (markdownMod) {
          const MarkdownShortcuts =
            (markdownMod as { default?: unknown }).default ?? markdownMod;
          Quill.register(
            'modules/markdownShortcuts',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            MarkdownShortcuts as any,
            true,
          );
        }

        const editorDiv = document.createElement('div');
        containerRef.current.appendChild(editorDiv);

        const lazyRef = { current: null as Quill | null };
        const modules: Record<string, unknown> = {
          toolbar: false,
          keyboard: {
            bindings: createKeyboardBindings({
              quill: lazyRef,
              onSubmit: () => handleSendRef.current(),
            }),
          },
        };
        if (markdownMod) modules.markdownShortcuts = {};

        const quill = new Quill(editorDiv, {
          theme: 'snow',
          placeholder,
          formats: [
            'bold',
            'italic',
            'underline',
            'strike',
            'link',
            'list',
            'blockquote',
            'code-block',
            'code',
          ],
          modules,
        });
        lazyRef.current = quill;
        quillRef.current = quill;

        quill.on('text-change', () => {
          const t = quill.getText().trim();
          if (t) handleTypingRef.current?.();
          setContentLength(countCodePoints(quill.root.innerHTML));
          setPlainLength(t.length);
          const sel = quill.getSelection();
          if (sel)
            setActiveFormats(
              quill.getFormat(sel.index, sel.length) as Record<string, unknown>,
            );

          // Auto-format: ``` → code block, > → blockquote.
          if (sel && sel.length === 0) {
            const cursorPos = sel.index;
            const [line, offset] = quill.getLine(cursorPos);
            if (line) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const lineText = (line as any).domNode?.textContent || '';
              const fmt = quill.getFormat(cursorPos) as Record<string, unknown>;
              if (lineText.endsWith('```') && !fmt['code-block']) {
                const tickStart = cursorPos - 3;
                const lineStart = cursorPos - offset;
                if (lineText === '```') {
                  quill.deleteText(lineStart, 3);
                  quill.formatLine(lineStart, 1, 'code-block', true);
                  quill.setSelection(lineStart, 0);
                } else {
                  quill.deleteText(tickStart, 3);
                  quill.insertText(tickStart, '\n');
                  quill.formatLine(tickStart + 1, 1, 'code-block', true);
                  quill.setSelection(tickStart + 1, 0);
                }
                return;
              }
              if (lineText === '>' && !fmt.blockquote) {
                const lineStart = cursorPos - offset;
                quill.deleteText(lineStart, lineText.length);
                quill.formatLine(lineStart, 1, 'blockquote', true);
                quill.setSelection(lineStart, 0);
                return;
              }

              // Emoticon replace on space.
              if (
                enableEmoticonReplaceRef.current &&
                lineText.length >= 2 &&
                lineText.endsWith(' ')
              ) {
                const beforeSpace = lineText.slice(0, -1);
                for (const [emoticon, emoji] of EMOTICON_MAP) {
                  if (beforeSpace.endsWith(emoticon)) {
                    const emoticonStart = beforeSpace.length - emoticon.length;
                    if (
                      emoticonStart === 0 ||
                      /\s/.test(beforeSpace[emoticonStart - 1])
                    ) {
                      const deleteStart = cursorPos - emoticon.length - 1;
                      quill.deleteText(deleteStart, emoticon.length + 1);
                      quill.insertText(deleteStart, emoji + ' ');
                      quill.setSelection(deleteStart + emoji.length + 1, 0);
                      return;
                    }
                  }
                }
              }

              // Auto-linkify URLs on trailing whitespace.
              if (
                enableAutoLinkRef.current &&
                lineText.length >= 2 &&
                /[\s\n]$/.test(lineText)
              ) {
                const beforeWs = lineText.slice(0, -1);
                const wordMatch = beforeWs.match(/(\S+)$/);
                if (wordMatch) {
                  const word = wordMatch[1];
                  const isFullUrl = /^https?:\/\/\S+/.test(word);
                  const isBareUrl = !isFullUrl && /^www\.\S+\.\S+/.test(word);
                  if (isFullUrl || isBareUrl) {
                    const wordStart = beforeWs.length - word.length;
                    const absStart = cursorPos - offset + wordStart;
                    const existingFmt = quill.getFormat(absStart, word.length) as Record<string, unknown>;
                    if (!existingFmt.link) {
                      const href = isBareUrl ? `https://${word}` : word;
                      if (!suppressedLinksRef.current.has(href)) {
                        quill.formatText(
                          absStart,
                          word.length,
                          'link',
                          href,
                          'api',
                        );
                        return;
                      }
                    }
                  }
                }
              }
            }
          }
        });

        quill.on('selection-change', (range) => {
          if (range) {
            setActiveFormats(
              quill.getFormat(range.index, range.length) as Record<string, unknown>,
            );
          }
        });

        // Paste → file detection (images, videos) → upload.
        quill.root.addEventListener(
          'paste',
          (e: ClipboardEvent) => {
            const files = Array.from(e.clipboardData?.files || []);
            const media = files.filter(
              (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
            );
            if (media.length > 0 && uploadRef.current) {
              e.preventDefault();
              addFilesRef.current?.(media);
              return;
            }
            // Auto-linkify a pasted bare URL.
            if (enableAutoLinkRef.current) {
              const pasted = e.clipboardData?.getData('text/plain')?.trim();
              const isFullUrl = pasted && /^https?:\/\/\S+$/.test(pasted);
              const isBareUrl =
                pasted && !isFullUrl && /^www\.\S+\.\S+$/.test(pasted);
              if (isFullUrl || isBareUrl) {
                e.preventDefault();
                const href = isBareUrl ? `https://${pasted}` : pasted!;
                const sel = quill.getSelection();
                const idx = sel ? sel.index : quill.getLength() - 1;
                if (sel && sel.length > 0) {
                  quill.formatText(idx, sel.length, 'link', href, 'user');
                } else {
                  quill.insertText(idx, pasted!, 'link', href, 'user');
                  quill.setSelection(idx + pasted!.length, 0);
                }
              }
            }
          },
          { capture: true },
        );

        // Drop on the Quill editor → route to attachment upload instead of
        // letting Quill try to embed it as content.
        quill.root.addEventListener('drop', (e: DragEvent) => {
          const files = Array.from(e.dataTransfer?.files || []);
          if (files.length > 0 && uploadRef.current) {
            e.preventDefault();
            e.stopPropagation();
            addFilesRef.current?.(files);
          }
        });

        setIsReady(true);
      })();

      return () => {
        cancelled = true;
        quillRef.current = null;
        if (containerRef.current) containerRef.current.innerHTML = '';
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update placeholder without reinitializing Quill.
    useEffect(() => {
      const q = quillRef.current;
      if (!q) return;
      q.root.setAttribute('data-placeholder', placeholder ?? '');
    }, [placeholder]);

    /* --------------------------------------------------------------------- */
    /* Typing indicator + addFiles ref                                        */
    /* --------------------------------------------------------------------- */

    const handleTyping = useCallback(() => {
      if (!onTypingChange) return;
      onTypingChange(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => onTypingChange(false), 2000);
    }, [onTypingChange]);
    const handleTypingRef = useRef(handleTyping);
    handleTypingRef.current = handleTyping;

    const addFilesRef = useRef(addFiles);
    addFilesRef.current = addFiles;

    // Cleanup any in-flight uploads on unmount.
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

    /* --------------------------------------------------------------------- */
    /* Imperative handle                                                      */
    /* --------------------------------------------------------------------- */

    useImperativeHandle(
      ref,
      () => ({
        focus: () => quillRef.current?.focus(),
        clear: () => {
          quillRef.current?.setText('');
          suppressedLinksRef.current.clear();
          setAttachments([]);
        },
        isEmpty: () => {
          if (!quillRef.current) return true;
          return quillRef.current.getText().trim().length === 0;
        },
        getHTML: () => quillRef.current?.getSemanticHTML() ?? '',
        getText: () => quillRef.current?.getText().trim() ?? '',
        insertText: (text: string) => {
          const q = quillRef.current;
          if (!q) return;
          q.focus();
          const sel = q.getSelection();
          const idx = sel ? sel.index : q.getLength();
          q.insertText(idx, text, 'user');
          q.setSelection(idx + text.length, 0, 'user');
        },
      }),
      [],
    );

    /* --------------------------------------------------------------------- */
    /* Toolbar action                                                         */
    /* --------------------------------------------------------------------- */

    const onToolbarAction = useCallback((fmt: string) => {
      const q = quillRef.current;
      if (!q) return;
      q.focus();
      const current = q.getFormat() as Record<string, unknown>;

      switch (fmt) {
        case 'inline-code':
          q.format('code', !current.code);
          return;
        case 'ordered-list':
          q.format('list', current.list === 'ordered' ? false : 'ordered');
          return;
        case 'bullet-list':
          q.format('list', current.list === 'bullet' ? false : 'bullet');
          return;
        case 'link': {
          if (current.link) {
            q.format('link', false);
            return;
          }
          const sel = q.getSelection();
          const selText =
            sel && sel.length > 0 ? q.getText(sel.index, sel.length) : '';
          // Minimal: prompt the user for a URL. A proper LinkTooltip + modal
          // comes in Phase D — for Phase B we keep this lightweight.
          const url = typeof window !== 'undefined' ? window.prompt('URL', '') : null;
          if (url && url.trim()) {
            if (sel && sel.length > 0) {
              q.formatText(sel.index, sel.length, 'link', url.trim(), 'user');
            } else {
              const idx = sel ? sel.index : q.getLength() - 1;
              q.insertText(idx, selText || url.trim(), 'link', url.trim(), 'user');
              q.setSelection(idx + (selText || url.trim()).length, 0);
            }
          }
          return;
        }
        case 'blockquote':
        case 'code-block':
          q.format(fmt, !current[fmt]);
          return;
        default:
          q.format(fmt, !current[fmt as keyof typeof current]);
      }
    }, []);

    /* --------------------------------------------------------------------- */
    /* Drag-drop on the container                                             */
    /* --------------------------------------------------------------------- */

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
      if (dragCounterRef.current === 0) setIsDragOver(false);
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
        e.target.value = '';
      },
      [addFiles],
    );

    /* --------------------------------------------------------------------- */
    /* Render                                                                 */
    /* --------------------------------------------------------------------- */

    return (
      <div
        className="sm-rich-editor"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="sm-rich-editor-drop-overlay">
            <div>
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--sm-primary, #2563eb)"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p>Drop to attach</p>
            </div>
          </div>
        )}

        {showToolbar && (
          <div className="sm-rich-toolbar-wrap">
            <Toolbar
              activeFormats={activeFormats}
              disabled={disabled}
              onAction={onToolbarAction}
            />
          </div>
        )}

        {attachments.length > 0 && (
          <div className="sm-rich-attachments">
            {attachments.map((att) => (
              <div
                key={att.id}
                className={`sm-rich-attachment${
                  att.status === 'error' ? ' sm-rich-attachment-error' : ''
                }`}
              >
                {att.file.type.startsWith('image/') ? (
                  <img src={att.preview} alt="" />
                ) : (
                  <div className="sm-rich-attachment-icon">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </div>
                )}
                <div className="sm-rich-attachment-meta">
                  <span className="sm-rich-attachment-name">{att.file.name}</span>
                  {att.status === 'uploading' && (
                    <div className="sm-rich-attachment-progress">
                      <div
                        className="sm-rich-attachment-progress-bar"
                        style={{ width: `${att.progress}%` }}
                      />
                    </div>
                  )}
                  {att.status === 'error' && (
                    <span className="sm-rich-attachment-error-text">
                      {att.error}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="sm-rich-attachment-remove"
                  onClick={() => removeAttachment(att.id)}
                  aria-label="Remove attachment"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quill editor container */}
        <div ref={containerRef} className="sm-rich-editor-container" />

        <div className="sm-rich-editor-footer">
          {onUploadAttachment && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={accept}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="sm-rich-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  disabled || attachments.length >= maxAttachments || isSending
                }
                aria-label="Attach file"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
            </>
          )}

          {showCounter && (
            <span
              className={`sm-rich-counter${
                overLimit ? ' sm-rich-counter-over' : ''
              }`}
              role="status"
              aria-live="polite"
            >
              {contentLength.toLocaleString()}
              {maxLength != null ? ` / ${maxLength.toLocaleString()}` : ''}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {renderSendButton ? (
            renderSendButton({
              canSend,
              disabled: disabled || !isReady,
              onSend: () => void handleSend(),
            })
          ) : (
            <button
              type="button"
              className="sm-rich-send-btn"
              disabled={!canSend || disabled || !isReady}
              onClick={() => void handleSend()}
            >
              {snippetPromoteAvailable ? 'Send as snippet' : 'Send'}
            </button>
          )}
        </div>

        {/* Props are accepted for stable API; the visible dropdown UI lands
            in Phase C — but keeping the refs live here means the detection
            logic doesn't have to change when menus are added. */}
        <MentionDataSink
          onMentionSearch={props.onMentionSearch}
          mentionUsers={props.mentionUsers}
          onChannelSearch={props.onChannelSearch}
          channelResults={props.channelResults}
        />
      </div>
    );
  },
);

// A no-op receiver for mention props so TS doesn't drop them from the surface
// in Phase B. Keeps the contract forward-compatible with Phase C without any
// runtime cost.
function MentionDataSink(_props: {
  onMentionSearch?: (query: string) => void;
  mentionUsers?: MentionUser[];
  onChannelSearch?: (query: string) => void;
  channelResults?: ChannelMentionItem[];
}): null {
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
