# Changelog

## 0.0.36 — 2026-04-14

**Added: `leftAccessory` prop on `RichTextInput`.** Optional node rendered at the very start of the composer's footer row, before the attach button. Hosts use this to pin a single-icon control (e.g., a plain/rich editor toggle, a voice-note button) into the existing footer cluster instead of stacking another row above the composer. Keeps the chrome compact.

## 0.0.35 — 2026-04-14

**Added: Link tooltip + edit modal in `RichTextInput`.**

Clicking a link inside the editor now shows a small tooltip above the anchor with Edit / Remove buttons instead of navigating. Clicking the toolbar Link button (or Edit from the tooltip) opens an inline modal with Text / URL fields, Save / Cancel, Escape-to-dismiss, and a focus trap for Tab cycling. Replaces the `window.prompt` stopgap added in 0.0.32.

- New exports from `@scalemule/chat/editor`: `LinkTooltip`, `LinkEditModal`, `LinkTooltipData`.
- Tooltip is suppressed for mention spans (`.sm-mention`, `.sm-channel-mention`) — it only appears on real `<a href>` clicks.
- Remove strips the link format while preserving the visible text; Save reformats the span with the new URL and display text.
- All selectors use the `sm-rich-link-*` / `sm-rich-link-modal-*` prefix.

**Bundle:** `editor.js` 55.66 KB → 66.25 KB (budget 90 KB).

## 0.0.34 — 2026-04-14

Version bump only — 0.0.33 was already taken on npm (a prior auto-publish with different content). The mention-support release ships under 0.0.34.

## 0.0.33 — 2026-04-14

**Added: `@` user mentions and `#` channel mentions in `RichTextInput`.**

Typing `@` (or `#`) after whitespace / at the start of a line fires the host's `onMentionSearch(query)` (or `onChannelSearch(query)`). As the host populates `mentionUsers` / `channelResults`, a dropdown renders above the cursor with keyboard navigation (ArrowUp/Down, Enter/Tab to select, Escape to dismiss). Selecting inserts a custom Quill embed that serializes as the exact markup the backend `HtmlAllowlistSanitizer` allows:

```
<span class="sm-mention" data-sm-user-id="uuid">@DisplayName</span>
<span class="sm-channel-mention" data-sm-channel-id="uuid">#name</span>
```

- New exports from `@scalemule/chat/editor`: `MentionMenu`, `ChannelMentionMenu`, `MentionMenuProps`, `ChannelMentionMenuProps`.
- New `blots.ts` with `registerMentionBlots(Quill)` — atomic `Embed` subclasses so mentions behave as single tokens (cursor can't land inside, Backspace deletes the whole thing).
- Detection logic in `RichTextInput` runs after every `text-change` (deferred microtask so Quill's selection is synced); dropdown position uses Quill's `getBounds()` relative to `.sm-rich-editor`.
- Outside-click dismisses the menu; existing keyboard bindings preempt Enter when a menu is active.
- `Toolbar`, keyboard bindings, and theme `--sm-*` tokens used for menu styling — no new host dependencies.

**Bundle:** `editor.js` grew 39.75 KB → 55.66 KB (budget 90 KB) for the two menu components + blot registration.

**Host wiring** (typical):

```tsx
<ChatThread
  editor="rich"
  onMentionSearch={(q) => dispatch(fetchUsers(q))}
  mentionUsers={users}
  onChannelSearch={(q) => dispatch(fetchChannels(q))}
  channelResults={channels}
  /* ... */
/>
```

## 0.0.32 — 2026-04-14

**Added: `@scalemule/chat/editor` entry — Quill-backed `RichTextInput` for rich-text chat composers.**

A new code-split entry point that exports `RichTextInput`, a drop-in upgrade for `ChatInput` powered by Quill 2.x. `ChatThread` now accepts `editor="rich"` to opt into it — the import is `React.lazy`, so plain-text consumers of `@scalemule/chat/react` don't pay the Quill cost.

- New `<ChatThread editor="rich" />` prop (default `"plain"`). When set, the composer is lazy-loaded via `React.lazy(() => import('@scalemule/chat/editor'))`. A non-interactive `EditorLoadingSkeleton` renders while the chunk loads (~100–300ms on first visit, cached thereafter) — guarantees no draft-loss during swap.
- `ChatThread` gains `placeholder`, `showToolbar`, `enableMarkdownShortcuts`, `enableEmoticonReplace`, `enableAutoLink` props — forwarded only to the rich variant.
- `RichTextInput` props extend `ChatInputProps` so drop-in migration is a one-line swap. Send emits `content_format: 'html'` when the editor has formatting and `content_format: 'plain'` otherwise; snippet auto-promote keeps using `quill.getText()` + `text/plain` (formatting is intentionally dropped for snippets).
- Responsive `Toolbar` with overflow dropdown; format buttons: bold / italic / underline / link / ordered-list / bullet-list / blockquote / code-block / inline-code.
- Markdown shortcuts via `quill-markdown-shortcuts-new` (runtime dep); emoticon auto-replace on space (`:)` → 😊 and 36 more); auto-link URLs on space / paste; paste-file detection routes to `onUploadAttachment`; drag-drop on the editor surface matches `ChatInput`.
- Keyboard bindings: Enter sends, Shift+Enter newline, Backspace at block-line-start clears the block format, ArrowDown exits a code block.
- All editor class names use the `sm-rich-*` prefix to avoid colliding with host app styles.

**Peer deps:**
- `quill ^2.0.0` is an **optional** peer dep — add it to the host app when using `editor="rich"` (no install needed for plain-text consumers).
- `quill-markdown-shortcuts-new ^0.0.11` is a runtime dep, marked `external` in the SDK build — still lazy-imported inside `useEffect` so it never evaluates on the server.

**CSS packaging:** one new entry at `@scalemule/chat/editor.css` — the build step prepends `quill/dist/quill.snow.css` to the SDK editor overrides so customers import a single stylesheet.

**SSR safety:** `@scalemule/chat/editor` has no top-level window / DOMParser access. Quill + markdown-shortcuts are dynamic-imported inside `useEffect`, matching the SSR story of `ChatInput`.

**Bundle budget:**
- New `editor.js` budget: 90KB (actual 39.75KB).
- `react.js` contains zero Quill references — the `RichTextInput` lazy import becomes a separate chunk loaded on demand.

**Known limitations:**
- Mention dropdowns are Phase C: `onMentionSearch` / `mentionUsers` / `onChannelSearch` / `channelResults` props are accepted for forward compatibility but render no UI yet.
- Link tooltip + inline edit modal are Phase D: the toolbar Link button uses `window.prompt` as a stopgap.

## 0.0.31 — 2026-04-13

**Added: Rich HTML message rendering in `ChatMessageItem`.** Messages with `content_format: 'html'` are now rendered as formatted HTML (bold, italic, lists, code blocks, links, mentions) instead of raw markup. Previously the SDK accepted rich messages on send but displayed them as escaped text — this closes the known gap noted in 0.0.29.

- New `sanitizeHtml(html)` helper in `react-components/sanitize.ts`. DOMParser-based allowlist that mirrors the backend `HtmlAllowlistSanitizer` (tags: p/br/b/strong/i/em/u/s/ul/ol/li/blockquote/pre/code/span/a; href schemes: http/https/mailto; mention markup preserved). Defense-in-depth — the backend remains the authoritative sanitizer.
- SSR-safe: on the server (no `DOMParser`) the helper escapes HTML to text. Hydration re-renders through DOMParser on the client.
- `ChatMessageItem` branches on `content_format === 'html'` to render via `dangerouslySetInnerHTML` with `.sm-rich-content` class.
- New `src/themes/rich-content.css` (concatenated into `themes/tailwind.css` and `themes/shadcn.css` at build). Styles target `.sm-rich-content` descendants only and pull from existing `--sm-*` tokens.
- `build:assets` is now a Node script (`scripts/build-assets.mjs`) that concatenates rich-content.css into the theme outputs.

**Added: Rich-message editing fallback.** Editing a message with `content_format: 'html'` opens the plain textarea seeded with `plain_text` (or a stripped-HTML fallback). Saving text changes sends `contentFormat: 'plain'` so the backend re-types the message. Attachment-only edits preserve the existing HTML format.

- `ChatMessageItem.onEdit`, `ChatMessageList.onEdit`, and `ChatThread`'s internal wiring now all accept an optional 4th `contentFormat?: 'plain' | 'html'` argument.
- `useChat.editMessage` already forwarded `contentFormat` as of 0.0.29.

**Bundle budget:** React ESM budget bumped 170K → 175K for the sanitizer (~3KB).

## 0.0.30 — 2026-04-14

**Added: Snippets — auto-promote long content (>40K) to a file-backed collapsible block.**

When a user types content that exceeds the chat limit (40K code points), the new snippet flow uploads the body as a `text/plain` attachment and sends a snippet message with a 280-char preview. Renders as a collapsible card with the file name, size, and expand/collapse controls. Matches Slack's snippet pattern.

- New `uploadSnippet(content, filename, uploadFn)` helper exported from `@scalemule/chat` and `@scalemule/chat/react`. Returns `{ attachment, preview }`. Code-point-safe truncation (Unicode-aware, no surrogate-pair splits).
- `SendMessageType` widens to include `'snippet'`.
- `ChatInput` adds `enableSnippetPromote` and `snippetFilename` props. When over `maxLength` AND `onUploadAttachment` is provided AND `enableSnippetPromote=true`, the Send button stays enabled with label "Send as snippet". Click triggers the promote flow automatically.
- `ChatThread` forwards `enableSnippetPromote` and `snippetFilename` props through to `ChatInput`.
- `ChatMessageItem` renders snippet messages as a `SnippetCard`: collapsed shows the 280-char preview; expanded fetches the full body (via `onFetchAttachmentUrl` if presigned URL is missing/expired) and renders in `<pre><code>`. Retries once on 403 with a fresh URL.

**Snippet body source for rich editors:** Use `quill.getText()` (visible text) for the snippet body, NOT semantic HTML. Mime type is `text/plain`. The user is informed that formatting is stripped.

**Bundle budget:** React ESM budget bumped 160K → 170K to accommodate the SnippetCard component (~5KB).

## 0.0.29 — 2026-04-14

**Added:** Graceful handling of message send failures. `useChat().sendMessage` now sets `error` state on API failures (matches `editMessage`/`deleteMessage` pattern). `ChatInput` adds `onSendError?` prop and an optional `maxLength` character counter. On send failure, `ChatInput` keeps the user's text and attachments intact — they can edit and retry instead of losing their message.

**Added:** `countCodePoints(value)` helper exported from `react-components/utils`. Counts Unicode scalars (code points), matching Rust's `chars().count()`. Use this for length checks against backend `MaxLengthValidator` to handle emoji and combining characters correctly.

**Added:** `ChatInput.onSend` callback now accepts an optional 3rd `options` argument with `content_format` and `message_type`. Return type broadened to allow synchronous `ApiResponse<ChatMessage>` returns (was `Promise<void>`-only). `ChatThread` returns the `sendMessage` result so error state propagates correctly.

**Added:** `ChatThread` renders an inline error banner above the input when send fails. Auto-dismisses after 6s, manual dismiss available. `--sm-error-bg`, `--sm-error-text`, `--sm-error-border` tokens.

**Added:** `ChatThread` defaults `maxLength={40000}` (Slack-parity). Override via prop.

**Added:** `content_format` and `plain_text` fields wired through types, `ChatClient.sendMessage`, `ChatClient.editMessage`, `normalizeMessage` (realtime events), and `buildEditedMessage` (edit cache update). `MessageEditedEvent` extended with `content_format`/`plain_text`/`new_content_format`/`new_plain_text` fields.

**Added:** Type split: `ChatMessageType` (all server-emitted types incl. `system`/`snippet`) vs `SendMessageType` (only `text`/`image`/`file` — what callers can send). Phase B will widen `SendMessageType` to include `snippet`.

**Fixed:** Widget (`@scalemule/chat` UMD) and Web Component (`@scalemule/chat/element`) now defer clearing input + pending attachments until after a confirmed-success send. Previously they cleared optimistically; on failure (network error, 4xx) the user lost their text. Race-safe: only clears if the input still contains the sent content (user can keep typing during in-flight send).

## 0.0.28 — 2026-04-13

**Fixed:** Republish with theme CSS files (`tailwind.css`, `shadcn.css`) included in tarball. Versions 0.0.25-0.0.27 were missing these files due to a stale dist directory during publish.

## 0.0.27 — 2026-04-13

**Fixed:** Type error in `ChatThread` when forwarding `onValidateFile` to `ChatInput`. `ChatInput` expects `(file) => { valid, error }` while `ChatMessageItem` uses `(file) => string | null`. `ChatThread` now adapts between the two signatures internally.

## 0.0.26 — 2026-04-13

**Fixed:** `ChatThread` now forwards `onDeleteAttachment`, `onValidateFile`, `maxAttachments`, and `accept` to `ChatInput` as well as `ChatMessageList`. Previously only the message list received the full edit-upload prop surface; the send composer was missing cleanup, validation, count, and accept configuration.

## 0.0.25 — 2026-04-13

**Fixed:** `ChatMessageItem` `maxAttachments` default changed from 10 to 5 to match the backend's max-5 enforcement. Previously SDK allowed selecting up to 10 files but the server would reject >5.

**Fixed:** `ChatThread` now forwards `onDeleteAttachment`, `onValidateFile`, `maxAttachments`, and `accept` props to `ChatMessageList`. Previously only `onUploadAttachment` was forwarded; the remaining edit-upload control surface was inaccessible through the `ChatThread` convenience component.

## 0.0.24 — 2026-04-13

**Added:** `ChatMessageItem` file upload button in edit mode. When `onUploadAttachment` is passed, a paperclip button appears in the edit footer allowing users to add new attachments while editing a message. Upload progress is tracked per-file, Save is disabled while uploads are in-progress, and cancelled/abandoned uploads are cleaned up via `onDeleteAttachment`.

**Added:** Delete-on-empty-edit. Clearing all text and removing all attachments during message edit now calls `onDelete` to delete the message (matching the Slack/MergeYard convention where an empty save = delete).

**Added:** `ChatMessageList` and `ChatThread` forward `onUploadAttachment`, `onDeleteAttachment`, `onValidateFile`, `maxAttachments`, and `accept` props through to `ChatMessageItem`.

**Fixed:** `ChatClient.buildEditedMessage()` now accepts the `attachments` field from server edit events alongside `new_attachments`. Previously, edit-attachment changes broadcast by the backend were ignored in the live cache until page reload.

**Fixed:** `ChatMessageItem` edit state (content, attachments, pending uploads) now resets correctly on cancel and re-edit. Previously, removing an attachment, cancelling the edit, then re-editing would show the stale removed state.

**Fixed:** `MessageEditedEvent` type now includes optional `attachments` field matching backend broadcast payload.

## 0.0.23 — 2026-04-12

**Fix:** UMD bundle (`chat.umd.global.js`) now registers the `<scalemule-chat>` custom element.
Previously the `sideEffects` field caused esbuild to drop the `import './element'` in `umd.ts`.

**Fix:** `package-lock.json` regenerated — was stale at 0.0.20 with LiveKit dependencies.

## 0.0.22 — 2026-04-11

**Breaking: Conference code extracted to `@scalemule/conference`.**

Removed: `ConferenceClient`, `CallOverlay`, `CallControls`, full `CallButton`.
Removed: `./calls` entry point.
Removed: LiveKit dependencies (`@livekit/components-react`, `livekit-client`).

Migration:
```
Before: import { ConferenceClient } from '@scalemule/chat';
After:  import { ConferenceClient } from '@scalemule/conference';

Before: import { CallOverlay } from '@scalemule/chat/calls';
After:  import { CallOverlay } from '@scalemule/conference/react';
```

Added: Thin `ActiveCallBanner`, `CallSystemMessage`, `CallTriggerButton` presentational components.
`CallTriggerButton` replaces the old `CallButton` — renamed to avoid silent behavior change
(the full `CallButton` with getUserMedia now lives in `@scalemule/conference/react`).

Fixed: Declaration generation uses `tsconfig.build.json` — test `.d.ts` files no longer leak into `dist/`.

## 0.0.21 — 2026-04-11

**New entry point: `@scalemule/chat/calls`** — the video call components and `ConferenceClient` now ship from a dedicated sub-entry so consumers who only need chat don't pay the video bundle cost.

Before (0.0.20):
```ts
import { CallOverlay, CallButton, CallControls } from '@scalemule/chat/react';
```

After (0.0.21):
```ts
import {
  ConferenceClient,
  CallOverlay,
  CallButton,
  CallControls,
} from '@scalemule/chat/calls';
```

`ConferenceClient` is also still exported from `@scalemule/chat` (main) and `@scalemule/chat/react` for backward compat — it's pure TypeScript/HTTP with no video backend dependencies. Only the React components (`CallButton`, `CallControls`, `CallOverlay`) moved.

**Breaking:** `@scalemule/chat/react` no longer re-exports `CallButton`, `CallControls`, or `CallOverlay`. Consumers using those from `/react` need to switch the import path to `/calls`. No source changes other than the import statement.

**Bundle size impact:** the `react.js` entry dropped from **145.50 KB → 136.25 KB** (about 9 KB), and the UMD bundle dropped from **43.51 KB → 22.28 KB** (about 21 KB — nearly half). Chat-only consumers get a lighter bundle and the video backend's module graph stays completely out of their build.

**Also added:** `sideEffects` field in `package.json` listing only the IIFE script-tag bundles (`chat.umd.global.js`, `chat.embed.global.js`, `support-widget.global.js`) and CSS as side-effectful. Every library entry (`index`, `react`, `react-admin`, `calls`, `element`, `iframe`, `themes/*`) is marked side-effect-free so downstream bundlers (webpack, Turbopack, rollup, esbuild) can drop phantom shared-chunk imports during tree-shaking.

## 0.0.20 — 2026-04-11

**Added: `ConferenceClient`** — a vendor-neutral client for the ScaleMule conference service. Customer code now never names the underlying video backend.

```ts
import { ConferenceClient, CallOverlay } from '@scalemule/chat';

const conf = new ConferenceClient({ baseUrl, apiKey });
const call = await conf.createCall({ conversationId, callType: 'video' });
const session = await conf.joinCall(call.id);

// session: { callId, serverUrl, accessToken, tokenExpiresAt, participant }
<CallOverlay
  session={session}
  onTokenRefresh={() => conf.joinCall(call.id)}
  onClose={() => conf.leaveCall(call.id)}
/>
```

Surface: `createCall` / `listCalls` / `getCall` / `joinCall` / `leaveCall` / `endCall`. Types: `Call`, `CallSession`, `CallParticipant`, `CreateCallOptions`, `ListCallsOptions`, `ConferenceClientConfig`.

**Breaking (`CallOverlay` props):** Renamed vendor-named props to a vendor-neutral `session` object.

Before (0.0.19):
```tsx
<CallOverlay callId={callId} livekitUrl={url} livekitToken={token} onTokenRefresh={...} />
```

After (0.0.20):
```tsx
<CallOverlay session={session} onTokenRefresh={async () => conf.joinCall(callId)} />
```

`session.callId`, `session.serverUrl`, `session.accessToken`, `session.tokenExpiresAt`, `session.participant` — all vendor-neutral. `onTokenRefresh` now returns a full `CallSession` and the overlay handles the refresh internally before the previous token's `tokenExpiresAt`.

**Dependency change:** Moved `@livekit/components-react` and `livekit-client` from `peerDependencies` → `dependencies`. Customers no longer need to install these packages separately — they come transitively via `@scalemule/chat`. The video backend is now a fully hidden implementation detail. Also fixes a Turbopack build failure in Next.js 16 consumers where the previously-optional peer dep couldn't be statically resolved.

**Internal rename:** The `LiveKitComponents` type inside `CallOverlay` was renamed to `VideoBackendComponents` to match the rest of the vendor-neutral surface. This is internal to the file — no consumer impact.

## 0.0.19 — 2026-04-10

**Added:** `TypingIndicator` component. Slack-style "X is typing..." indicator with smart pluralization (`"Alice is typing..."`, `"Alice and Bob are typing..."`, `"Alice, Bob, and Carol are typing..."`, `"4 people typing..."`) plus three animated bouncing dots. Uses `--sm-*` CSS variables so it inherits host theme presets. Renders nothing when `typingUsers` is empty so host apps can drop it unconditionally into their container layout.

```tsx
import { useTyping, TypingIndicator } from '@scalemule/chat/react';

const { typingUsers } = useTyping(conversationId);

<TypingIndicator
  typingUsers={typingUsers.filter(id => id !== currentUserId)}
  resolveUserName={(id) => profiles.get(id)?.display_name ?? 'Someone'}
/>
```

Props:
- `typingUsers: string[]` — required; the user IDs currently typing
- `resolveUserName?: (userId: string) => string` — optional name lookup; falls back to "Someone" / "N people"
- `isLargeRoom?: boolean` — forces count-only mode (no names), for 100+ participant rooms
- `maxNames?: number` — collapse to count past this many typers (default: 3)

The SDK's drop-in `ChatThread` component now uses `TypingIndicator` internally, so it gets real pluralization + animated dots instead of the previous "Someone is typing..." placeholder.

**Tests:** +8 component tests (`TypingIndicator.test.tsx`), bringing the SDK suite to 145 passing.

## 0.0.18 — 2026-04-10

**Privacy/hygiene patch.** Removes all host-app names (customer references) from the shipped docs and changelog. 0.0.15, 0.0.16, and 0.0.17 shipped with two host-app-specific migration doc files and several changelog references to specific host apps by name — an inadvertent privacy leak for any downstream consumer inspecting the tarball. Those files are deleted and the changelog/MIGRATION.md are rewritten to refer only to "host apps" generically. Consumers should upgrade off 0.0.15/16/17 to 0.0.18.

### Removed
- `docs/YOUSNAPS_0.0.14_ADOPTION_NOTES.md` — host-app-specific migration notes; content belongs in the host app's own repo, not the SDK
- `docs/YOUSNAPS_MIGRATION_NOTES.md` — same
- All host-app name references in `docs/MIGRATION.md` (replaced with generic language)
- All host-app name references in this changelog (replaced with generic language)

### Unchanged
- All runtime behavior, APIs, bundle size, and `dist/` contents are identical to 0.0.17
- `ChatMessageList`'s `renderAttachment` / `renderAvatar` forwarding (from 0.0.15)
- `getMessagesAround` / `highlightMessageId` (from 0.0.15)
- `useConversations({ perPage })` option (from 0.0.17)

## 0.0.17 — 2026-04-10

**Added:** `useConversations()` hook now accepts an optional `perPage` option, forwarded to `client.listConversations({ per_page })`. Host apps that need more than the server default page size can now get it via the hook without dropping to direct `ChatClient` calls.

## 0.0.16 — 2026-04-10

**Added:** `ChatMessageList` now accepts `renderAttachment` and `renderAvatar` props, forwarded to its default `ChatMessageItem`. Previously the only way to customize attachment rendering was the full `renderMessage` escape hatch (which required re-implementing the whole bubble). Now a host app can supply a branded attachment renderer and keep the SDK's default bubble chrome, hover toolbar, reactions, etc. Also includes the `getMessagesAround` / `highlightMessageId` scroll-to-message feature merged in from 0.0.15 work.

## 0.0.15 — 2026-04-10

Superseded by 0.0.16/0.0.18. Do not use.

## 0.0.14 — 2026-04-10

**Cleanup patch — no new features.** Closes the deferred Item B (RTL test coverage gap), Item C (scalemule-app migration decision doc), and Item D (buildable example sub-packages) from the completion plan. Ships as a patch bump per the [versioning policy](../../docs/chat/CHAT_SDK_COMPLETION_PLAN.md#decisions-locked-2026-04-10) — still staying in 0.0.x until the user explicitly cuts 0.1.0.

### Added

**React Testing Library coverage for the remaining 14 components** (+48 tests, 89 → 137 total)
- `ChannelList`, `ChannelBrowser`, `ChannelHeader`
- `SearchBar`, `SearchResults`
- `RepStatusToggle`
- `CallButton`, `CallControls`, `CallOverlay`
- `ConversationList`, `ChatThread`
- `EmojiPicker`, `ReactionBar`, `ReportDialog`
- Hook-using components use `vi.mock('../../react', async (importOriginal) => ...)` with `importOriginal()` to preserve real `ChatProvider` types while stubbing specific hooks — this is the pattern for any future context-consuming test
- `CallOverlay` mocks `@livekit/components-react` (dynamic browser-only import that jsdom can't load)
- `CallButton` stubs `globalThis.navigator.mediaDevices.getUserMedia` (jsdom doesn't implement WebRTC)

**Buildable example sub-packages under `examples/NN-*/`** (+3 directories + shared tsconfig)
- `examples/01-support-widget/` — `SupportClient` programmatic usage + HTML `<script>` tag recipe
- `examples/02-channels-app/` — React Slack-style channels app (~120 lines)
- `examples/03-rep-dashboard/` — React rep dashboard using `@scalemule/chat/react` + `@scalemule/chat/react/admin` (~140 lines)
- Each example has its own `package.json` with `"@scalemule/chat": "file:../.."`, `tsconfig.json`, and a `README.md`
- New `tsconfig.examples.json` at the SDK root with path mapping (`@scalemule/chat/*` → `./src/*`) — enables CI-level type checking of all examples via a new `npm run check:examples` script without requiring npm install in each sub-package

### Fixed

**Documentation bugs caught by the new buildable examples** (4 hallucinated API shapes in previously-shipped docs):

- `<ChatProvider theme={...}>` is **not a real API** — `ChatProvider` has no `theme` prop. Themes are applied per-component (via the `theme?: ChatTheme` prop on components that accept it) or globally via the CSS preset import (recommended). Fixed in:
  - `docs/MIGRATION.md` (Tailwind and shadcn sections)
  - `examples/README.md` (channels-app and rep-dashboard recipes)
  - `src/themes/tailwind.ts` JSDoc
  - `src/themes/shadcn.ts` JSDoc
  All now recommend the CSS import path as primary and per-component passing as a fallback for scoped overrides.
- `SupportClient.startConversation` returns `SupportConversation` directly (throws on error), not `{ data, error }`. Fixed example 01.
- `ChannelListItem.name` and `ChannelListItem.description` are `string | null`, not `string | undefined` — callers need `?? undefined` coercion when passing to `ChannelHeader`. Fixed example 02 and example recipe.
- `ChatClient` `'message'` event payload is `{ message, conversationId }`, not a bare `ChatMessage`. Fixed example 01.

These were all shipped in 0.0.13 docs; anyone copying from the recipes would have hit them. 0.0.14 is the correction.

### Tests

- **137 automated tests passing** (89 → 137, +48 from Item B)
- Full suite runs in ~9s including jsdom React component tests
- `npm run check:examples` added as a type-check-only validator for the examples

### Scope decision (Item C — verified no-op)

After auditing `web/scalemule-app` for local copies of `WidgetConfigEditor` / `VisitorContextPanel` / `RepStatusToggle` to migrate, the conclusion is **do not migrate**. scalemule-app correctly uses `RepClient` from `@scalemule/chat` as the data layer but keeps its local composed UIs because they bundle features beyond the SDK's minimal admin components (API key management, registration flow, deep shadcn integration with `@/components/ui/*`, auth-bound workflows). See `docs/chat/SCALEMULE_APP_INTEGRATION.md` in the meta-repo for the full decision rationale. The SDK's `@scalemule/chat/react/admin` is for a **different audience** — drop-in admin dashboards for customers who don't have their own design system.

---

## 0.0.13 — 2026-04-10

**Not a 0.1.0 release.** This ships Phase 1–6 of the *milestone toward* 0.1.0 — the theming bridge, render-prop escape hatches, admin components, first RTL test coverage, examples, and scope docs. Staying in 0.0.x because meaningful work is still deferred: RTL coverage for the 12 remaining React components, `web/scalemule-app` migration to `@scalemule/chat/react/admin`, full buildable example sub-packages, and further real-world validation. The 0.1.0 cut waits until those land.

**What you get in 0.0.13:** `@scalemule/chat` is drop-in for host apps using Tailwind v4 or shadcn/ui, with render-prop escape hatches for structural customization without forking components, admin-dashboard components on a code-split entry point, and the test suite at 89 automated tests.

**Migration:** 0.0.13 is fully backward-compatible with 0.0.12 consumers. No code changes required on upgrade. See [`docs/MIGRATION.md`](./docs/MIGRATION.md) for how to adopt the new theming presets and escape hatches.

**Context:** This release closes the Phase 1–6 work in the SDK completion plan. The scope boundary is documented in the SDK scope doc so future feature requests can be triaged against a single source of truth.

### Added

**Tailwind v4 theme preset** (`@scalemule/chat/themes/tailwind`)
- New `tailwindTheme` export (ChatTheme object with `var()` fallback chains)
- New CSS file: `@scalemule/chat/themes/tailwind.css` — zero-JS import path
- Maps all 12 `--sm-*` tokens to Tailwind v4 auto-generated theme variables: `--color-primary-*` → `--color-blue-*` → SDK default
- Host apps can override the primary palette via Tailwind v4 `@theme { --color-primary-500: ... }` with no further config
- Pre-built components (ReactionBar, EmojiPicker, ChatMessageItem, ChannelList, SearchBar, SupportInbox, etc.) inherit the host theme automatically

**shadcn/ui theme preset** (`@scalemule/chat/themes/shadcn`)
- New `shadcnTheme` export (ChatTheme object mapping to shadcn's `hsl(var(--primary))` convention)
- New CSS file: `@scalemule/chat/themes/shadcn.css` — zero-JS import path
- Reads shadcn's standard variables: `--primary`, `--primary-foreground`, `--secondary`, `--background`, `--muted`, `--border`, `--foreground`, `--muted-foreground`, `--radius`
- **Dark mode works automatically** — the preset only reads shadcn variables, so when `.dark` flips them, SDK components follow
- Combines naturally with `ChatInput.renderSendButton` to drop in a shadcn `<Button>` — MIGRATION.md has the recipe

**Admin dashboard components** (`@scalemule/chat/react/admin`) — new subpath entry
- `<WidgetConfigEditor repClient={...} />` — 3-tab editor (Appearance / Content / Behavior) for the support widget config, wired to `RepClient.getWidgetConfig` / `updateWidgetConfig`. Save button only activates after edits; Reset button clears draft; error state surfaces API failures.
- `<VisitorContextPanel repClient={...} conversationId={...} />` — sidebar showing visitor identity, page URL (hostname + path), browser/OS summary, conversation status, and assigned rep. Subscribes to `inbox:update` for live refresh. Gracefully shows "Anonymous visitor" and "Unknown" placeholders when visitor fields are sparse.
- **Split entry point:** Admin components are NOT in the main `@scalemule/chat/react` bundle — they ship via `@scalemule/chat/react/admin`. This keeps customer-facing chat apps from paying for admin dashboard code they don't use. Main React ESM stayed at 142.26 KB (no regression); new admin ESM is 20.5 KB.

```tsx
// Rep dashboard recipe
import { SupportInbox } from '@scalemule/chat/react';
import { WidgetConfigEditor, VisitorContextPanel } from '@scalemule/chat/react/admin';

<SupportInbox repClient={repClient} onSelectConversation={...} />
<VisitorContextPanel repClient={repClient} conversationId={selected} />
<WidgetConfigEditor repClient={repClient} onSaved={() => toast('Saved')} />
```

**Render-prop escape hatches** — host apps can now customize slots inside pre-built components without forking them:
- `ChatMessageItem.renderAvatar?: (profile, message) => ReactNode` — replace the default 32px circle avatar
- `ChatMessageItem.renderAttachment?: (attachment) => ReactNode` — replace the default image/video/audio/file renderer
- `ChatMessageItem.getProfile?: (userId) => UserProfile | undefined` — fallback profile resolver for host apps with a profile store (Map/Zustand/Redux)
- `ChatMessageList.renderMessage?: (message, context) => ReactNode` — replace the default `<ChatMessageItem>` entirely while keeping list features (date dividers, unread divider, scroll management)
- `ChatInput.renderSendButton?: ({ canSend, disabled, onSend }) => ReactNode` — replace the default send button with a themed custom element
- `UserProfile` type is now exported from `@scalemule/chat/react`

All escape hatches are **purely additive** — default behavior is unchanged when the props are omitted. This is the mechanism that unblocks host apps from forking `ChatMessageItem` to inject their own avatars, attachment lightboxes, or design-system buttons.

### Fixed

- `ChatInput.canSend` local variable was typed as `string | boolean` due to implicit truthy coalescing; now explicitly coerced to `boolean` (no behavior change, fixes a type issue exposed by the new `renderSendButton` render prop signature)

### Notes

These are Phase 2 deliverables of the v0.1.0 completion plan. See [`docs/YOUSNAPS_MIGRATION_NOTES.md`](./docs/YOUSNAPS_MIGRATION_NOTES.md) for the customer migration that drove this work, and [`../../docs/chat/CHAT_SDK_COMPLETION_PLAN.md`](../../docs/chat/CHAT_SDK_COMPLETION_PLAN.md) for the full plan.

### Tests

- **89 automated tests passing** (48 pre-plan + 10 theme + 18 escape-hatch/SupportInbox + 13 admin component tests)
- `@testing-library/react` suite covers render-prop escape hatches, SupportInbox wiring, WidgetConfigEditor (load, tab switch, save diff, unsaved-edits preservation, save-button gating), VisitorContextPanel (empty state, visitor fields, URL formatting, UA parsing, live event subscription, sparse-data fallbacks)
- `vitest.config.ts` includes a setup file that stubs missing jsdom APIs (`scrollIntoView`, `IntersectionObserver`, `ResizeObserver`) and registers RTL's `afterEach(cleanup)` hook
- Dev deps added: `@testing-library/react@^16`, `@testing-library/dom@^10`
- Remaining React components (ChannelList, ChannelBrowser, ChannelHeader, SearchBar, SearchResults, RepStatusToggle, ConversationList, CallButton/Controls/Overlay, ChatThread, EmojiPicker, ReactionBar, ReportDialog) need ChatProvider context mocking — deferred to post-v0.1.0

---

## 0.0.12 — 2026-04-10

First release with the full reference-app feature set abstracted into the SDK. See [`docs/MIGRATION.md`](./docs/MIGRATION.md) for detailed upgrade notes.

### Added

**Named channels (Slack-style)**
- `ChatClient.createChannel({ name, visibility, description })`
- `ChatClient.listChannels({ search, visibility })` — discovery endpoint, returns public channels and your private channels with an `is_member` flag
- `ChatClient.leaveChannel(id)` — performs full local cleanup (unsubscribes WS, leaves presence, removes type tracking, emits `channel:changed`)
- `ChatClient.joinChannel(id)` — existing method now also works for named channels and emits `channel:changed`
- New `'channel'` conversation type on `Conversation`, plus `visibility?: 'public' | 'private'` and `description?: string` fields
- New `'channel:changed'` event on `ChatEventMap`
- `useChannels(options?)` hook — returns `{ channels, isLoading, refresh, createChannel, joinChannel, leaveChannel }`
- `useConversations` now listens for `channel:changed` and refetches — **scoped** to `conversationType === 'channel'` (or no filter) so unrelated sidebars don't refetch
- Pre-built components: `<ChannelList>`, `<ChannelHeader>`, `<ChannelBrowser>`

**Message search**
- `ChatClient.searchMessages(conversationId, query, limit?)` — OpenSearch-backed full-text search
- Returns `ChatSearchResponse` with `results: ChatSearchResult[]` (message, relevance score, highlighted excerpts) and `total`
- `useSearch(conversationId?)` hook — returns `{ results, total, query, isSearching, search, clearSearch }`
- Pre-built components: `<SearchBar>` (input + inline results), `<SearchResults>` (results list with highlights)

**Attachment editing (full stack)**
- `ChatClient.editMessage(messageId, content, attachments?)` — backward-compatible signature; attachments are included in the PATCH body only when provided
- `MessageEditedEvent.new_attachments?` — incoming edit events can now carry attachment changes
- `ChatClient.buildEditedMessage()` applies `new_attachments` to the cached message
- `ChatController.editMessage(messageId, content, attachments?)` and `ChatController.deleteMessage(messageId)` — both were missing entirely before
- `useChat().editMessage` callback accepts the optional third argument
- `<ChatMessageItem>` now shows removable attachment chips in edit mode; the save gate blocks empty results (no text AND no attachments)
- Adding new attachments during edit is currently out of scope (remove / keep / edit text is supported)

**RepClient (support representative management)**
- New `RepClient` class with two construction modes:
  - `new RepClient({ chatClient, apiBaseUrl, getToken, ... })` — wraps an existing `ChatClient`, does not own its lifecycle (`ownsChat = false`)
  - `new RepClient({ apiBaseUrl, getToken, userId, ... })` — creates its own `ChatClient` (`ownsChat = true`)
- Constructor throws if neither `sessionToken` nor `getToken` is provided
- Constructor throws if a wrapped `chatClient.userId` conflicts with `config.userId`
- Methods: `register`, `listReps`, `updateStatus`, `heartbeat`, `startHeartbeat` (idempotent), `stopHeartbeat`, `claimConversation`, `updateConversationStatus`, `getInbox`, `getUnreadCount`, `getWidgetConfig`, `updateWidgetConfig`
- `getInbox()` and `claimConversation()` automatically stamp `setConversationType(conversation_id, 'support')` on every returned `conversation_id` so `rep.chat` routes messages through the correct WebSocket prefix
- `destroy()` stops the heartbeat and destroys the wrapped `ChatClient` **only if** `ownsChat === true`

**Support UI components**
- `<SupportInbox repClient={...} />` — 3-tab inbox (Waiting / Active / Resolved), claim/resolve actions, debounced live updates via `support:new`, `support:assigned`, and `inbox:update` events. **Does not manage WebSocket lifecycle** — assumes the app owns the connection.
- `<RepStatusToggle repClient={...} userId={...} />` — reads current rep status via `listReps`, renders a dropdown (online/away/offline) with auto heartbeat start/stop. Renders "Not registered" for unregistered users (registration is intentionally left to the host app).

**Transport**
- `HttpTransport.put()` — new method for PUT endpoints (used by `updateWidgetConfig`)

### Notes

- All pre-built components use inline styles with `var(--sm-*)` CSS custom properties via the `ChatTheme` object. They are designed to be portable but **do not match Tailwind / design system apps out of the box**. For admin dashboards using a specific design system, the recommended pattern is to **reuse `RepClient` (or `ChatClient`) under the hood** while keeping your native UI. See [`docs/MIGRATION.md`](./docs/MIGRATION.md#recipe-admin-dashboards-with-cookie-based-auth) for the cookie-auth recipe.
- `useConversations`'s `channel:changed` listener is **scoped**: it only refetches when `conversationType === 'channel'` or no filter is set, so existing sidebars filtered by `direct`, `group`, or `support` do not churn on channel activity.
- The public API is additive — existing 0.0.x consumers can upgrade without code changes.
- Bundle size increase: the React ESM bundle grew from ~110 KB (0.0.11) to ~142 KB due to the 7 new components (ChannelList, ChannelHeader, ChannelBrowser, SearchBar, SearchResults, SupportInbox, RepStatusToggle).

### Tests

- 48 automated tests passing (13 ChatClient, 5 ChatController, 18 RepClient, 12 existing element/widget/upload)
- All new tests stay below the React layer — React components are covered by manual smoke testing

---

## 0.0.11 — 2026-04-10

- LiveKit React components (`CallButton`, `CallControls`, `CallOverlay`) wired into conference call flow (#2)

## 0.0.10 — 2026-04-10

- Initial call components and conference system message rendering (#1)

## 0.0.9 and earlier

- Core SDK (`ChatClient`, `SupportClient`, React hooks, Web Component, support widget)
- See git history for details
