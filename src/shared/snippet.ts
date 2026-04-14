import type { ApiResponse, Attachment } from '../types';

/** Maximum snippet body size (1 MB, matches Slack's snippet limit). */
export const MAX_SNIPPET_SIZE_BYTES = 1_048_576;

/** Preview length in Unicode scalars (code points), matches backend logging threshold. */
export const SNIPPET_PREVIEW_LENGTH = 280;

/** File upload function compatible with the SDK's upload shape.
 *
 * Accepts either the strict `ApiResponse<Attachment>` shape OR the looser
 * `{ data, error }` shape used by ChatInput's `onUploadAttachment` prop.
 */
export type SnippetUploadFn = (
  file: File | Blob,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
) => Promise<
  | ApiResponse<Attachment>
  | { data: Attachment | null; error: { message: string; code?: string; status?: number } | null }
  | undefined
>;

export interface UploadSnippetResult {
  /** Uploaded attachment metadata — pass this to `sendMessage` as `attachments: [attachment]`. */
  attachment: Attachment;
  /**
   * Code-point-safe preview string (first ~280 scalars + "…" if truncated).
   * Pass this to `sendMessage` as `content`.
   */
  preview: string;
}

/**
 * Upload long content as a text/plain attachment and build the preview string
 * for a snippet message. The caller then sends:
 *
 *   await sendMessage({
 *     content: result.preview,
 *     content_format: 'plain',
 *     message_type: 'snippet',
 *     attachments: [result.attachment],
 *   });
 *
 * Use when content exceeds the regular message limit (40,000 code points).
 *
 * @param content       The full body text. Passed as-is to the upload. For
 *                       rich-editor sources, pass `quill.getText()` (plain
 *                       text), NOT `quill.getSemanticHTML()` — the stored
 *                       mime type is `text/plain`.
 * @param filename      Display filename (e.g. `"message.txt"`).
 * @param uploadFn      SDK-shaped upload function (e.g. the result of
 *                       `useChat().uploadAttachment` or a custom adapter).
 */
export async function uploadSnippet(
  content: string,
  filename: string,
  uploadFn: SnippetUploadFn,
): Promise<UploadSnippetResult> {
  const body = content;

  // Size guard — body must fit in the 1MB backend limit (same byte length as sent).
  const byteLength = new Blob([body]).size;
  if (byteLength > MAX_SNIPPET_SIZE_BYTES) {
    throw new Error(
      `Snippet too large: ${byteLength} bytes (max ${MAX_SNIPPET_SIZE_BYTES}). Split into multiple messages or upload as a file.`,
    );
  }

  const blob = new Blob([body], { type: 'text/plain' });
  const uploadResult = await uploadFn(blob);
  if (!uploadResult || !uploadResult.data || uploadResult.error) {
    throw new Error(uploadResult?.error?.message ?? 'Snippet upload failed');
  }

  // Attach the filename to the returned attachment metadata so the card can render it.
  const attachment: Attachment = {
    ...uploadResult.data,
    file_name: filename,
  };

  // Code-point-safe preview truncation — `.slice(0, N)` on a string can split
  // surrogate pairs. Array.from preserves Unicode scalars.
  const scalars = Array.from(body);
  const preview =
    scalars.length <= SNIPPET_PREVIEW_LENGTH
      ? body
      : scalars.slice(0, SNIPPET_PREVIEW_LENGTH).join('') + '…';

  return { attachment, preview };
}
