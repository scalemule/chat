/**
 * Quill keyboard bindings factory for `RichTextInput`.
 *
 * Must be imported only from modules that are themselves lazily imported
 * (inside a `useEffect`), so that the SSR-safe contract of the editor entry
 * holds — importing `@scalemule/chat/editor` on the server should not trigger
 * any code path that references `quill` at module top level.
 *
 * Returns a plain `bindings` object suitable for `new Quill(el, { modules: { keyboard: { bindings } } })`.
 */

import type Quill from 'quill';

interface Range {
  index: number;
  length: number;
}

export interface KeyboardBindingRefs {
  /** Must always point at the live Quill instance. */
  quill: { current: Quill | null };
  /** Fired on plain Enter (no modifiers) when no mention menu is active. */
  onSubmit: () => void;
  /** Set to true while the user-mention dropdown is open. */
  mentionActive?: { current: boolean };
  /** Called on Enter / Tab when the user-mention dropdown is open. */
  mentionSelect?: { current: (() => void) | null };
  /** Set to true while the channel-mention dropdown is open. */
  channelMentionActive?: { current: boolean };
  /** Called on Enter / Tab when the channel-mention dropdown is open. */
  channelSelect?: { current: (() => void) | null };
}

export function createKeyboardBindings(refs: KeyboardBindingRefs) {
  return {
    enter: {
      key: 'Enter',
      handler: () => {
        if (refs.mentionActive?.current) {
          refs.mentionSelect?.current?.();
          return false;
        }
        if (refs.channelMentionActive?.current) {
          refs.channelSelect?.current?.();
          return false;
        }
        refs.onSubmit();
        return false;
      },
    },
    'shift-enter': {
      key: 'Enter',
      shiftKey: true,
      handler: (range: Range) => {
        refs.quill.current?.insertText(range.index, '\n');
        return false;
      },
    },
    // Backspace at the start of a block-formatted line clears the block format
    // (converting the line back to a plain paragraph) instead of deleting the
    // previous character. Matches Slack/Notion muscle memory.
    'clear-block-format': {
      key: 'Backspace',
      handler: (range: Range) => {
        const quill = refs.quill.current;
        if (!quill) return true;
        if (range.length > 0) return true;

        const lineResult = quill.getLine(range.index);
        const line = lineResult[0];
        const offset = lineResult[1];
        if (!line || offset !== 0) return true;

        const fmt = quill.getFormat(range.index) as Record<string, unknown>;
        if (fmt.blockquote) {
          quill.formatLine(range.index, 1, 'blockquote', false);
          return false;
        }
        if (fmt['code-block']) {
          quill.formatLine(range.index, 1, 'code-block', false);
          return false;
        }
        if (fmt.list) {
          quill.formatLine(range.index, 1, 'list', false);
          return false;
        }
        return true;
      },
    },
    // ArrowDown on the last line of a code block inserts a plain line after
    // the block and moves the cursor there — otherwise the cursor gets stuck
    // inside the block.
    'exit-code-block-down': {
      key: 'ArrowDown',
      handler: (range: Range) => {
        const quill = refs.quill.current;
        if (!quill) return true;
        const fmt = quill.getFormat(range.index) as Record<string, unknown>;
        if (!fmt['code-block']) return true;

        const lineResult = quill.getLine(range.index);
        const line = lineResult[0];
        if (!line) return true;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const next = (line as any).next;
        if (
          !next ||
          !(next.domNode as HTMLElement)?.classList?.contains('ql-code-block')
        ) {
          const lineEnd = range.index + (line.length() - 1);
          const insertPos = lineEnd + 1;
          quill.insertText(insertPos, '\n');
          quill.formatLine(insertPos + 1, 1, 'code-block', false);
          quill.setSelection(insertPos + 1, 0);
          return false;
        }
        return true;
      },
    },
  };
}
