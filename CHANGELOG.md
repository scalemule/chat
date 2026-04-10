# Changelog

## 0.0.13 — 2026-04-10

**Not a 0.1.0 release.** This ships Phase 1–6 of the *milestone toward* 0.1.0 — the theming bridge, render-prop escape hatches, admin components, first RTL test coverage, examples, and scope docs. Staying in 0.0.x because meaningful work is still deferred: RTL coverage for the 12 remaining React components, `web/scalemule-app` migration to `@scalemule/chat/react/admin`, full buildable example sub-packages, and real-world validation beyond the YouSnaps migration. The 0.1.0 cut waits until those land.

**What you get in 0.0.13:** `@scalemule/chat` is drop-in for host apps using Tailwind v4 or shadcn/ui, with render-prop escape hatches for structural customization without forking components, admin-dashboard components on a code-split entry point, and the test suite at 89 automated tests.

**Migration:** 0.0.13 is fully backward-compatible with 0.0.12 consumers. No code changes required on upgrade. See [`docs/MIGRATION.md`](./docs/MIGRATION.md) for how to adopt the new theming presets and escape hatches.

**Context:** This release closes the Phase 1–6 work in [`../../docs/chat/CHAT_SDK_COMPLETION_PLAN.md`](../../docs/chat/CHAT_SDK_COMPLETION_PLAN.md), driven by the YouSnaps migration (see [`docs/YOUSNAPS_MIGRATION_NOTES.md`](./docs/YOUSNAPS_MIGRATION_NOTES.md)). The scope boundary is now documented in [`../../docs/chat/CHAT_SDK_SCOPE.md`](../../docs/chat/CHAT_SDK_SCOPE.md) so future feature requests can be triaged against a single source of truth.

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

All escape hatches are **purely additive** — default behavior is unchanged when the props are omitted. This is the mechanism that unblocks host apps (YouSnaps, CoralMeet) from forking `ChatMessageItem` to inject their own avatars, attachment lightboxes, or design-system buttons.

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

First release with the full MergeYard feature set abstracted into the SDK. See [`docs/MIGRATION.md`](./docs/MIGRATION.md) for detailed upgrade notes.

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
