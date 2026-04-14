/**
 * @scalemule/chat/editor — rich-text editor entry point.
 *
 * Code-split from the core React bundle so plain-text consumers of
 * `@scalemule/chat/react` don't pay the Quill cost. Host apps opt in by
 * importing this module (usually via `ChatThread editor="rich"`, which
 * lazy-loads it under the hood) and by adding `quill` to their own deps
 * (it's a peer dependency here, marked optional).
 *
 * The module deliberately only re-exports the things that exist today —
 * mention menus (`MentionMenu`, `ChannelMentionMenu`) land in Phase C and
 * the link tooltip + modal in Phase D.
 */

export { RichTextInput } from './editor/RichTextInput';
export type { RichTextInputProps } from './editor/RichTextInput';
export type {
  MentionUser,
  ChannelMentionItem,
  RichTextInputHandle,
} from './editor/types';
