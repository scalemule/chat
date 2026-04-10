# Changelog

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
