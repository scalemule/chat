/**
 * Custom Quill blots for mention markup.
 *
 * Registering these with Quill makes `@Alice` and `#general` tokens round-
 * trip as `<span class="sm-mention" data-sm-user-id="uuid">@Alice</span>`
 * (and the channel equivalent) — which is exactly what the backend's
 * `HtmlAllowlistSanitizer` permits.
 *
 * Embeds (atomic) rather than inline blots so users can't edit half the
 * mention text with the cursor.
 *
 * Must be imported only from code that runs after Quill itself is loaded —
 * i.e., inside the `useEffect` in `RichTextInput`. Never at module top level.
 */

import type Quill from 'quill';

interface MentionValue {
  userId: string;
  name: string;
}

interface ChannelMentionValue {
  channelId: string;
  name: string;
}

/**
 * Register mention blots on the provided Quill constructor. Safe to call
 * multiple times — internal `Quill.register` is idempotent.
 */
export function registerMentionBlots(QuillCtor: typeof Quill): void {
  const Embed = QuillCtor.import('blots/embed') as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (...args: any[]): unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create(value: any): HTMLElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value(node: HTMLElement): any;
    blotName?: string;
    tagName?: string;
    className?: string;
  };

  // Helper factory — returns a configured Embed subclass.
  function makeMentionBlot(opts: {
    blotName: string;
    className: string;
    dataAttr: string;
    renderText: (name: string) => string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readValue: (node: HTMLElement) => any;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    class MentionBlot extends (Embed as any) {
      static blotName = opts.blotName;
      static tagName = 'span';
      static className = opts.className;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      static create(value: any): HTMLElement {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = (super.create as any)(value) as HTMLElement;
        const id = value?.userId ?? value?.channelId ?? '';
        const name = value?.name ?? '';
        node.setAttribute(opts.dataAttr, String(id));
        node.setAttribute('contenteditable', 'false');
        node.textContent = opts.renderText(String(name));
        return node;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      static value(node: HTMLElement): any {
        return opts.readValue(node);
      }
    }
    return MentionBlot;
  }

  const MentionBlot = makeMentionBlot({
    blotName: 'sm-mention',
    className: 'sm-mention',
    dataAttr: 'data-sm-user-id',
    renderText: (name) => `@${name}`,
    readValue: (node): MentionValue => ({
      userId: node.getAttribute('data-sm-user-id') ?? '',
      name: (node.textContent ?? '').replace(/^@/, ''),
    }),
  });

  const ChannelMentionBlot = makeMentionBlot({
    blotName: 'sm-channel-mention',
    className: 'sm-channel-mention',
    dataAttr: 'data-sm-channel-id',
    renderText: (name) => `#${name}`,
    readValue: (node): ChannelMentionValue => ({
      channelId: node.getAttribute('data-sm-channel-id') ?? '',
      name: (node.textContent ?? '').replace(/^#/, ''),
    }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  QuillCtor.register(MentionBlot as any, true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  QuillCtor.register(ChannelMentionBlot as any, true);
}

export const MENTION_BLOT = 'sm-mention';
export const CHANNEL_MENTION_BLOT = 'sm-channel-mention';
