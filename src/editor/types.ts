/**
 * Public types for the @scalemule/chat/editor entry point.
 *
 * Host apps pass `MentionUser[]` / `ChannelMentionItem[]` into `RichTextInput`
 * to populate the mention dropdowns. Field names match the backend's
 * `/v1/chat/users/search` and `/v1/chat/channels/search` shapes — host apps
 * with different shapes should map before passing.
 */

export interface MentionUser {
  id: string;
  /** Preferred display (falls back to email, then id). */
  display_name?: string;
  email?: string;
  avatar_url?: string;
  is_online?: boolean;
}

export interface ChannelMentionItem {
  id: string;
  name: string;
  visibility?: 'public' | 'private';
  member_count?: number;
}

/**
 * Imperative handle for `RichTextInput`. Lets the parent focus the editor,
 * clear state after send, or read the current HTML/text snapshot.
 */
export interface RichTextInputHandle {
  focus: () => void;
  clear: () => void;
  isEmpty: () => boolean;
  getHTML: () => string;
  getText: () => string;
  insertText: (text: string) => void;
}
