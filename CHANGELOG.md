# Changelog

## 0.0.58 — 2026-04-15

**Added: offline banner + composer disable on disconnect.**

Closes the Section 6 presence track.

- **`useConnectionStatus()`** — thin wrapper over `useConnection` returning `{ status, isOnline, isReconnecting }` for ergonomic boolean access.
- **`<OfflineBanner children? onDismiss?>`** — renders a banner when the WebSocket is not connected; hides when connected. `children` overrides the default English message; `onDismiss` adds a dismiss button. Tokens `--sm-offline-banner-bg` (default amber tint) and `--sm-offline-banner-text` style the banner.
- **`ChatThread.disableWhenOffline?: boolean`** — default `false` for back-compat. When `true`, the composer (plain or rich) is `disabled` while offline. Combines with the composer's existing `disabled` state — never overrides it.

**Composer parity fix** — the plain-text `<ChatInput>` was previously not receiving `disabled` from `<ChatThread>` even if internal state required it. Both the lazy rich `<RichTextInput>` and the plain `<ChatInput>` now receive `composerDisabled` from the same source.

**Bundle:** `react.js` 235.18K → 236.91K within 245K budget. Other bundles unchanged.

## 0.0.57 — 2026-04-15

**Added: self-status (Active / Away) with automatic re-apply on reconnect.**

Users can now toggle between `'active'` and `'away'` through the SDK, and the choice persists across reloads and WebSocket reconnects.

- **`ChatClient.setStatus('active' | 'away')`** — caches the value, persists to `localStorage` under a per-user scoped key (`sm-chat-self-status-v1:{applicationId}:{userId}`; no persistence when either id is missing), emits the internal `status:changed` event, and broadcasts `updatePresence` (`online` | `away`) to every conversation where presence has been joined via `joinPresence`. Works before any presence join — the status is cached and re-applied automatically when a conversation's presence resumes.
- **`ChatClient.getStatus(): 'active' | 'away'`** — reads the cached value. Seeded from storage on client construction.
- **`useMyStatus()`** hook — returns `{ status, setStatus }`. Subscribes to `status:changed` so components re-render when any part of the app changes the status.
- **`<AvatarStatusMenu>`** — small dropdown with Active / Away options. Host owns positioning (wrap in an absolute container anchored to the avatar/profile button). Focus trap, Escape + backdrop close, keyboard navigation. i18n via `activeLabel` / `awayLabel` / `headerLabel`.
- **`ChatEventMap.status:changed`** — new event type.

**Reconnect behavior:** The `ChatClient` watches its own `presence:join` events. When the current user's presence resumes (initial join or resubscribe after a reconnect), any cached `'away'` state is re-asserted via `updatePresence` so remote observers see the amber dot without a manual toggle.

**Hard architectural invariants (unchanged from the Section 6 plan):**

- Away is a presence annotation, not a connection state. **The WebSocket ping keepalive stays untouched** — pausing it would risk a stale connection and trigger reconnects. The explicit `setStatus` spec includes a test asserting `setStatus` only emits `presence_update` frames.
- No client-side staleness lens. Still deferred until server-backed `last_active_at` exists.

**Bundle:** `react.js` 231.25K → 235.18K (budget 234K → 245K). `support-widget.global.js` + `chat.embed.global.js` also bumped a small amount to accommodate the `safeStorage` path now reachable via `ChatClient`. Offline banner + composer disable ship in 0.0.58 to close the section.

## 0.0.56 — 2026-04-15

**Added: presence status dot + conversation-scoped resolver.**

Lays the foundation for the presence UX track (self-status, away toggle, offline banner ship in 0.0.57/0.0.58).

- **`<StatusDot status size? showOffline? ariaLabel?>`** — pure visual. Hosts pass the resolved status; the component renders a small green (online), amber (away), or gray hollow (offline) dot. No data fetch, no subscription. Typically overlaid on an avatar via a relatively-positioned wrapper. Tokens: `--sm-status-online-color`, `--sm-status-away-color`, `--sm-status-offline-color`, `--sm-status-dot-border`. CSS classes `.sm-status-dot`, `.sm-status-dot-{online,away,offline}` are stable hooks for host overrides.

- **`useConversationPresenceStatus(conversationId, userId)`** — returns `'online' | 'away' | 'offline'` derived from `usePresence(conversationId)`. Conversation-scoped intentionally; there's no platform-level presence source in the SDK today. Missing `conversationId` or `userId` returns `'offline'` rather than throwing so hosts can pass props that fill in later.

- **Type fix:** `PresenceMember.status?: 'online' | 'away' | string` is now official on the SDK type (previously cast ad-hoc in `usePresence`). No runtime change — host code that already read `status` via narrowing keeps working.

**Not shipping here** (deferred to 0.0.57/0.0.58):

- Self-status control (`setStatus`, `useMyStatus`, `<AvatarStatusMenu>`) — needs coordinated `presence_update` + reconnect re-application.
- Offline banner + composer disable — requires `<ChatThread>`/composer wiring for plain + rich parity.
- Client-side staleness thresholds — dropped from Section 6 entirely. Requires a server-backed `last_active_at` field and a tighter sweep cadence; today's 2-minute server sweep and join/update-only timestamps make a 35s client lens incorrect.

**Architectural notes:**

- Away is modeled as an explicit `presence_update` with `status: 'away'` — NOT as heartbeat suppression. The WebSocket ping keepalive stays owned by the transport layer across this entire track.
- No new code-split entry — presence code is small and used universally. Lives in `@scalemule/chat/react`.

**Bundle:** `react.js` 230.02K → 231.25K (within 234.38K budget).

## 0.0.55 — 2026-04-15

**Docs: search → jump-to-message wiring.**

README adds an end-to-end example showing the full flow from a controlled input through `useSearchHistory`, `useGlobalSearch`, `<SearchResultsPanel>`, and finally to `<ChatThread highlightMessageId>` (which scrolls to the target and paints the amber fade animation shipped in 0.0.45). Navigation stays host-controlled — the SDK never touches the router.

No code changes. Bundles unchanged.

## 0.0.54 — 2026-04-15

**Added: cross-conversation search — `useGlobalSearch` + `<SearchResultsPanel>`.**

New additions to the `@scalemule/chat/search` entry from 0.0.53.

```tsx
import {
  useGlobalSearch,
  SearchResultsPanel,
} from '@scalemule/chat/search';

const { results, isLoading, progress, errors } = useGlobalSearch(query, {
  conversations,   // REQUIRED — caller supplies the conversation set
});

<SearchResultsPanel
  open={panelOpen}
  onClose={() => setPanelOpen(false)}
  results={results}
  isLoading={isLoading}
  progress={progress}
  errors={errors}
  profiles={profilesByUserId}
  onSelect={(result) => {
    router.push(
      `/messages/${result.conversationId}?highlight=${result.message.id}`,
    );
  }}
/>
```

**`useGlobalSearch(query, opts)`** fans out `searchMessages` calls with a configurable concurrency cap (default 6) and debounced query changes (default 300ms). Results are annotated with `conversationId` (and `conversation` when full rows were supplied), sorted newest-first by `created_at`, and per-conversation failures are captured in `errors[]` without blocking the other conversations.

**One of `conversations` or `conversationIds` is required** — the hook never implicitly fetches the conversation list. Callers compose with `useConversations` (or their own store) and pass the set to search. An empty or missing input surfaces a loud error entry rather than silently doing nothing.

**Cancellation:** when the query changes mid-flight, late-arriving results from the prior query are discarded via an internal sequence-id. No HTTP `AbortSignal` required (transport layer unchanged).

**`<SearchResultsPanel>`** is a slide-out overlay on the right edge of the viewport. It captures the currently-focused element on open and restores focus to it when the panel closes or unmounts, so keyboard users land back where they started. Tab/Shift+Tab cycles inside the panel. Escape and backdrop click both close. A progress bar renders across the top while the fan-out is in flight. Per-conversation errors are listed in a collapsible footer. Pass `renderResult` to fully replace row chrome, or `profiles` + `conversationLabel` + `formatTimestamp` to theme the default rows.

**New type:** `GlobalSearchResult` — `ChatSearchResult & { conversationId; conversation? }`. Exported from both `@scalemule/chat/search` and `@scalemule/chat` core types so hosts can reference it in server code before rendering.

**Internal refactor:** `ChatContext` extracted to `src/shared/ChatContext.ts` so secondary entries (search now; any future entry that needs the chat client) can read the context without dragging the whole `react.tsx` module into their bundle. `react.tsx` continues to export the same `__ChatContext` internal symbol — no public API change.

**Bundle:** `search.js` grows 9.57K → 26.72K; budget raised 20K → 34K. `react.js` **unchanged at 230K** — verified code-split.

CSS (appended to `themes/message-polish.css`): `.sm-search-panel`, `.sm-search-panel-backdrop`, `.sm-search-result-row`, `.sm-search-result-meta`, `.sm-search-panel-progress`. New token `--sm-search-panel-width` (default 420px).

## 0.0.53 — 2026-04-15

**Added: `@scalemule/chat/search` entry — search history + highlighted excerpts.**

New opt-in, code-split entry for search UX. Hosts that don't render search don't pay the bundle cost in `react.js` (unchanged at 230K).

```tsx
import {
  HighlightedExcerpt,
  SearchHistoryDropdown,
  useSearchHistory,
} from '@scalemule/chat/search';
```

**`useSearchHistory({ storageKey?, max? })`** — persists recent queries to `localStorage` (silent in-memory fallback for SSR / private browsing / quota). Dedupes (bumps existing to top), caps at 8 entries by default, trims whitespace, ignores empty strings. Multi-user hosts should pass a per-user `storageKey` (e.g. `'sm-search-history-v1:' + userId`).

**`<SearchHistoryDropdown>`** — keyboard-navigable recent-queries dropdown. Host owns positioning (wrap in an absolute container anchored to your search input). Arrow-key nav wraps at both ends, Enter selects, Escape calls `onClose`. Optional `onClear` footer button. Works with uncontrolled or controlled `activeIndex`.

**`<HighlightedExcerpt html>`** — safely renders a single excerpt from `ChatSearchResult.highlights[]`. Preserves `<em>` (current OpenSearch highlight tag) and `<mark>` (forward-compat); unwraps all other tags, drops `<script>` / `<style>` / `<iframe>` / `<object>` / `<embed>` / `<svg>` with their contents, strips all attributes. Pure helper `sanitizeSearchExcerpt` is also exported for custom row renderers.

**CSS** (appended to the existing `themes/message-polish.css`):

- `.sm-search-result-excerpt em`, `.sm-search-result-excerpt mark` — soft amber highlight. Override via `--sm-search-highlight-bg` / `--sm-search-highlight-text`.
- `.sm-search-history-dropdown`, `.sm-search-history-item`, `.sm-search-history-item-active` — stable hooks for host layout.

**Unchanged:** `<SearchBar>`, `<SearchResults>`, `useSearch`, `ChatSearchResult`. Single-conversation search continues to work exactly as before. The new entry adds a complementary surface — it does not replace the existing one.

**Bundle:** new `search.js` at 9.57K / 19.53K raw budget. `react.js` **unchanged** — verified code-split.

Cross-conversation search (`useGlobalSearch`) + results panel ship in 0.0.54.

## 0.0.52 — 2026-04-15

**Added: channel invitations — `ChatClient` methods, `useChannelInvitations` hook, `<ChannelInvitationsModal>`.**

End-to-end invitation surface for named channels.

**`ChatClient` methods** (4 new):

- `listChannelInvitations()` — `GET /v1/chat/channels/invitations`.
- `inviteToChannel(channelId, userIds)` — `POST /v1/chat/channels/{id}/invitations`.
- `acceptChannelInvitation(invitationId)` — auto-joins the channel and emits `channel:changed`.
- `rejectChannelInvitation(invitationId)` — tombstones server-side.

Both `accept` and `reject` emit a new `channel:invitation:resolved` event so other observers (badges, UI consumers) update without re-fetching. Inbound invitations from the realtime stream emit `channel:invitation:received`.

**`useChannelInvitations()` hook** returns `{ invitations, unseenCount, isLoading, error, accept, reject, markAllSeen, refresh }`. Seeds from the list call on mount, applies optimistic accept/reject (restores the row on error), and tracks an unseen cursor in `localStorage` (`sm-channel-invites-last-seen-v1`) so hosts can render an unread-invitations badge without re-fetching. Storage failures degrade silently — `safeStorage` from 0.0.47 handles SSR / private-browsing / quota.

**`<ChannelInvitationsModal>`** lists pending invitations with Accept / Reject buttons. Calls `markAllSeen()` on open so the badge clears immediately. Optional `onAccepted(invitation)` callback for hosts to navigate to the joined channel. Focus trap + Escape-to-close mirrors the other modals.

**New types:**

- `ChannelInvitation` — id, channel_id, optional channel_name/description, invited_by, optional invited_by_display_name, created_at.
- `ChatEventMap` adds `channel:invitation:received` and `channel:invitation:resolved`.

**CSS:** `.sm-channel-invites-modal`, `.sm-channel-invite-row` for host overrides.

**Bundle:** `react.js` budget bumped 225K → 240K (current 230.01K). Section 4 ceiling — no further bumps planned before a 0.1.0 audit.

## 0.0.51 — 2026-04-15

**Added: channel admin UX — `<ChannelEditModal>`, channel-description info popover, system-message resolver.**

Three coordinated additions cover the channel-admin surface:

1. **`<ChannelEditModal>`** (new component, exported from `@scalemule/chat/react`). Form for `name`, `description`, `visibility` (`public` | `private`). Optional `onArchive` callback surfaces an "Archive channel" footer button. Validation + error surfacing + focus trap mirror `NewConversationModal`. Permission gating is host's responsibility — open the modal only for users who can edit.

2. **Channel description info icon** on `ChannelHeader`. When `description` is set, an `(i)` icon renders next to the channel name; hover/focus reveals a 280px popover with the full text. Useful when the in-line description is truncated. New props: `onEdit?: () => void` (renders an "Edit" button when set, typically wired to open `<ChannelEditModal>`).

3. **System-message resolver** at `react-components/systemMessages.ts`. Replaces the inline call-only parser with a topic+event parser that handles:

   - `system.channel.joined|user_id=…`
   - `system.channel.left|user_id=…`
   - `system.channel.invited|user_id=…|by=…`
   - `system.channel.created|by=…`
   - `system.channel.renamed|by=…|from=…|to=…`
   - `system.channel.archived|by=…`
   - `system.call.started|type=…`
   - `system.call.ended|duration=…`

   Unknown keys fall back to the raw content string so rows never render blank. Hosts with other locales / event types pass `formatSystemMessage(content, profiles)` on `ChatMessageItem` to override entirely.

   New `ChatMessageItem` props: `formatSystemMessage`, `systemMessageProfiles?: Map<userId, { display_name }>`. The system row carries a `.sm-system-message` CSS class.

`parseSystemMessage` and `defaultFormatSystemMessage` are also exported (React-free) for hosts that need to format system events outside the chat UI (e.g. activity logs, audit views).

**Bundle:** `react.js` 216.87K within 219.73K budget (set in 0.0.50). The three additions land together in a single budget envelope.

## 0.0.50 — 2026-04-15

**Added: `<NewConversationModal>` — accessible multi-select user picker.**

New component for "start a new conversation" flows. Router-agnostic: the host passes `searchUsers(query)` and `onCreate(participantIds)`; the SDK handles pills, debounced search, keyboard navigation, focus trap, and error surfacing.

```tsx
import { NewConversationModal } from '@scalemule/chat/react';

<NewConversationModal
  open={open}
  onClose={() => setOpen(false)}
  searchUsers={(q) => api.searchUsers(q)}
  onCreate={async (ids) => {
    const conv = await api.createDM(ids);
    router.push(`/messages/${conv.id}`);
  }}
  currentUserId={currentUserId}
/>
```

Behavior:

- **Debounced search** — default 250ms; configurable via `debounceMs`.
- **Keyboard navigation** — `ArrowUp` / `ArrowDown` walk results, `Enter` selects the highlighted result, `Cmd/Ctrl+Enter` submits, `Backspace` at an empty search removes the last pill, `Escape` closes.
- **Focus trap** — `Tab` / `Shift+Tab` cycle inside the modal; no need for an external trap wrapper.
- **Error surfacing** — when `onCreate` throws, the modal stays open and renders the error in a `role="alert"` banner.
- **Max participants** — default 10; configurable via `maxParticipants`.
- **i18n** — `title`, `searchPlaceholder`, `createLabel` props.
- **Current-user filter** — rows whose `id === currentUserId` are excluded from results.

CSS hooks: `.sm-new-conv-modal`, `.sm-new-conv-search`, `.sm-new-conv-pill`, `.sm-new-conv-result`, `.sm-new-conv-result-active`.

**Bundle:** `react.js` budget bumped 200K → 225K (current 200.59K). The modal adds ~17K — multi-select picker, debouncer, focus trap, error surface. Headroom reserved for the channel-admin + invitations modals coming in 0.0.51–0.0.52.

## 0.0.49 — 2026-04-15

**Added: active-call indicator for conversation rows.**

New `<ActiveCallDot active>` component (exported from `@scalemule/chat/react`) and a matching `renderActiveIndicator?: (conversation) => ReactNode` render-prop on `ConversationList`.

The SDK stays free of conference-SDK dependencies — hosts wire the source of truth (e.g. `@scalemule/conference`'s own presence hook, WebRTC signaling, a Redux selector) and return the dot (or their own marker) per row:

```tsx
import { ActiveCallDot, ConversationList } from '@scalemule/chat/react';

<ConversationList
  renderActiveIndicator={(c) => (
    <ActiveCallDot active={activeCallIds.has(c.id)} />
  )}
/>
```

`<ActiveCallDot>` is a pulsing green dot (CSS-only animation, no JS timer) with:

- `active: boolean` — when false, renders nothing.
- `ariaLabel?: string` — default `"Active call"`.
- `size?: number` — default 8px.

CSS animation lives in `themes/message-polish.css` (`@keyframes sm-call-pulse`, `.sm-active-call-dot::after`). Tokens:

- `--sm-active-call-color` (default green `#22c55e`)
- `--sm-active-call-pulse-opacity` (default `0.35` — set `0` to disable the pulse while keeping the dot)

**Scoping decision:** the Section 4 plan floated a new `@scalemule/chat/conference-indicators` entry for conference-SDK-coupled helpers. Shipped instead as a standard `react-components` export because no conference-SDK import is needed — the render-prop seam is the right coupling boundary. If future indicator helpers genuinely need conference imports, a dedicated entry can be added then.

**Bundle:** `react.js` 183.42K within 195.31K budget.

## 0.0.48 — 2026-04-15

**Added: per-conversation mention count badges.**

New hook `useMentionCounts(currentUserId)` returns a live `Map<conversationId, number>` overlay of @-mentions of the current user. The hook derives increments client-side by scanning incoming message HTML for `data-sm-user-id="{currentUserId}"` (the attribute emitted by the mention blot since 0.0.34); it decrements on `read` events for the current user (same simplification as `useUnreadCount`).

`ConversationList` renders the `@N` badge alongside the existing unread badge. The displayed count is `(conversation.mention_count ?? 0) + (liveHook.get(id) ?? 0)` — the server-side hint and the live overlay always sum cleanly.

New props on `ConversationList`:

- `showMentionBadge?: boolean` — default `true`. The badge only renders when count > 0, so hosts with no mentions incur no visible chrome regardless. Pass `false` to suppress entirely.
- `mentionCounts?: Map<string, number>` — override the live hook with a host-supplied store (e.g. a Redux selector).

Type extension: new optional `mention_count?: number` on `Conversation` for the server-side seed.

CSS: new `.sm-mention-badge` class, styled via tokens `--sm-mention-badge-bg` (default red-tinted `--sm-error`) and `--sm-mention-badge-text` (default `#fff`).

**Internal:** new `@internal` export `__ChatContext` so hooks that depend on the chat context can be unit-tested without spinning a full `ChatProvider`. Not part of the public surface — underscore prefix signals test-only use.

**Bundle:** `react.js` 182.81K within 195.31K budget.

## 0.0.47 — 2026-04-15

**Added: sectioned conversation list (CHANNELS / GROUPS / DIRECT MESSAGES).**

`ConversationList` accepts a new `groupBy` prop with two modes:

- `"flat"` (default, unchanged from 0.0.46) — single scrollable list.
- `"type"` — partition rows by `conversation_type` and render a collapsible header for each group. Per-section collapse state persists to `localStorage` under `sm-conv-list-section-collapsed-v1`. Storage failures degrade silently (SSR / private browsing / quota) — collapse still works for the session.

```tsx
<ConversationList
  groupBy="type"
  sectionOrder={['channel', 'direct']}     // optional; default ['channel', 'group', 'direct']
  sectionLabels={{ channel: 'TOPICS' }}    // optional; i18n / re-labeling hook
/>
```

`sectionOrder` doubles as an inclusion filter — types omitted from the list are hidden entirely. Section headers carry `.sm-conv-section-header` and `.sm-conv-section-{type}` for host CSS overrides.

**Refactor:** `safeStorage` (introduced in 0.0.44 for the YouTube oEmbed cache) promoted to `src/shared/safeStorage.ts` with a small `readJson` / `writeJson` helper layer so other features can reuse it without depending on the `embeds` entry. Existing `embeds/storage.ts` re-exports the shared module — no public surface change.

**Bundle:** `react.js` 180.49K within 195.31K budget.

## 0.0.46 — 2026-04-15

**Added: self-DM "(you)" label + default group display name in `ConversationList`.**

`ConversationList` now renders human-readable names for every row type without requiring the host to pre-compute them:

- **Self-DMs** — 1:1 direct conversations where every participant is the current user render as `"<your name> (you)"`. Uses the current user's profile display name when available, falls back to `"You (you)"`.
- **Named channels / groups** — `conversation.name` verbatim (unchanged).
- **Unnamed groups** — `"Alice, Bob, and 2 others"` built from participant profiles with the current user filtered out. Singular form is `"and 1 other"`.
- **1:1 DMs** — resolves via the participant list first, then `counterparty_user_id` → profile, then `conversation.name`, then a short id prefix (stable fallback so rows never say `undefined`).

New props on `ConversationList`:

- `currentUserId?: string` — required for self-DM detection and for filtering the current user out of group names.
- `profiles?: Map<string, { display_name: string }>` — profile lookup by user id.
- `selfLabel?: string` — default `"(you)"`. i18n hook.
- `formatGroupName?: (participantNames, currentUserId) => string` — override the default "Alice, Bob, and N others" formatter. Receives the ordered other-participant names (current user already filtered out).

The resolver is exported from `react-components/conversationDisplay.ts` as `resolveConversationDisplayName`, `buildDefaultGroupName`, and `otherParticipantNames` — React-free, SSR-safe. Useful from host previews, notification formatters, and system-message templates.

Search now matches the resolved display name, not just the raw `conversation.name` — so typing a group member's name finds the unnamed group containing them.

**Bundle:** `react.js` budget bumped 180K → 200K (current 177.05K) with headroom for the upcoming Section 4 track (0.0.47-0.0.52: sectioned sidebar, mention counts, call indicator, new-conversation modal, channel edit/invitations).

## 0.0.45 — 2026-04-15

**Polished: scroll-to-message highlight; split from unread emphasis.**

The "search hit" jump (via `highlightMessageId`) and the "first unread" emphasis are no longer collapsed into the same boxShadow. Each gets a distinct CSS class on the message wrapper and a distinct visual treatment:

- `.sm-message-highlighted` — 2-second amber fade animation + 3px left border in `--sm-highlight-border` (default `--sm-primary`). Pure CSS keyframes, no JS timer. Reads as "search," not "selected."
- `.sm-message-unread-start` — subtle inset 3px left line in `--sm-unread-divider-color`, distinct from the louder search-hit animation. Replaces the prior inline `boxShadow` on the bubble.

New `ChatMessageItem` props:

- `isSearchHit?: boolean` — set when the message is the search-jump target.
- `isUnreadStart?: boolean` — set on the first unread message.

New tokens:

- `--sm-highlight-bg` (default soft amber `rgba(251, 191, 36, 0.22)`)
- `--sm-highlight-border` (default `--sm-primary`)

`ChatThread` now forwards `highlightMessageId` (was previously list-only — wiring search-result jumps from a host's higher-level container is now a one-prop add).

`renderMessage` context gains `isSearchHit` and `isUnreadStart` alongside the existing `highlight` (kept as the union for backwards compat — still equals `isSearchHit || isUnreadStart`).

The `highlight` prop on `ChatMessageItem` is `@deprecated` — when set without the new flags it still renders the search-hit class for the bridging window. Will be removed in 0.1.0.

**Bundle:** `react.js` 174.42K within 175.78K budget. CSS animation lives in `themes/message-polish.css` so hosts importing the theme bundles get it automatically.

## 0.0.44 — 2026-04-15

**Added: `@scalemule/chat/embeds` entry — YouTube rich-link embeds.**

New code-split entry exports `YouTubeEmbed`, `YouTubeEmbeds`, and `extractYouTubeIds`. Hosts opt in via a `renderEmbeds` prop on `ChatMessageList` / `ChatThread`:

```tsx
import { YouTubeEmbeds } from '@scalemule/chat/embeds';

<ChatThread
  conversationId={id}
  renderEmbeds={(msg) => <YouTubeEmbeds html={msg.content} />}
/>
```

Detection covers watch URLs, `youtu.be`, `/embed/`, and `/shorts/` variants. Titles fetch best-effort via YouTube's oEmbed endpoint and cache to `localStorage` under `sm-yt-oembed-v1:<id>` for 7 days. Cache misses don't block render — the iframe mounts immediately and the title slot fills in when the fetch resolves.

`localStorage` access is wrapped in a `safeStorage()` helper that returns `null` in SSR, private browsing, sandboxed iframes, blocked-storage extensions, or quota errors. Every `getItem` / `setItem` is `try/catch`-guarded — a host that disables storage still gets a working embed; titles just don't persist across reloads.

New props on `ChatMessageList` and `ChatThread`:

- `renderEmbeds?: (message) => ReactNode` — render below the message body, above attachments.

`extractYouTubeIds(text)` is exported standalone and is SSR-safe (regex-only). Useful for thread previews, push-notification snippets, or message-search index enrichment.

**Bundle:** new `embeds.js` entry budgeted at 8 KB raw (initial size 4 KB). `react.js` unchanged at 173.97 KB — embed code is fully code-split.

## 0.0.43 — 2026-04-15

**Added: URL auto-linkify in plain-text messages.**

`ChatMessageItem` now detects http/https/`www.` URLs inside plain-text messages and renders them as `<a class="sm-link-auto" target="_blank" rel="noopener noreferrer nofollow">`. Trailing prose punctuation (`.`, `,`, `;`, `:`, `!`, `?`, closing parens/brackets/quotes) is stripped from matches; balanced parens inside URLs (e.g. Wikipedia article URLs) are preserved.

HTML messages are unaffected — the rich editor (Quill) auto-links at compose time and the sanitizer preserves the markup.

New props on `ChatMessageList` and `ChatThread`:

- `linkifyPlainText?: boolean` — default `true`. Set to `false` for hosts where messages are pre-formatted or where unsolicited link rendering is undesirable.

The detection helper is published as a public utility from the React-free root entry:

```ts
import { linkify, hasLinks } from '@scalemule/chat';
import type { LinkifySegment } from '@scalemule/chat';
```

Useful for thread previews, push-notification snippets, search-result excerpts. SSR-safe (regex only, no DOM access).

CSS additions in `themes/message-polish.css`:

- `.sm-link-auto` — empty by default (renderer applies inline coloring per bubble), exported as a stable hook for hosts that want focus rings, dotted underlines, etc.

**Bundle:** `react.js` 173.82K within 180K budget.

## 0.0.42 — 2026-04-15

**Added: clickable mention chips in rendered HTML messages.**

`<span class="sm-mention" data-sm-user-id>` and `<span class="sm-channel-mention" data-sm-channel-id>` (already preserved by the sanitizer since 0.0.31) now render as styled chips with cursor + hover affordance, and `ChatMessageItem` delegates a single `onClick` on the message body that resolves the chip via `target.closest()` and fires a host-supplied callback.

New props on `ChatMessageList` and `ChatThread`:

- `onMentionClick?: (userId, message) => void`
- `onChannelMentionClick?: (channelId, message) => void`

Hosts wire navigation (open profile drawer, route to `/u/{id}`, etc) — the SDK is router-agnostic and never assumes a URL scheme.

Click delegation only runs when at least one callback is provided. When neither is set, chips remain styled but clicks are a no-op (no `preventDefault`, no console noise).

CSS additions in `themes/rich-content.css`:

- `.sm-mention:hover` background uses new token `--sm-mention-hover-bg` (default rgba primary 0.16).
- `.sm-channel-mention` gains chip styling parity with `.sm-mention` (was previously color-only). New tokens: `--sm-channel-mention-bg`, `--sm-channel-mention-hover-bg`.

**Bundle:** `react.js` now 172.75K (within bumped 180K budget set in 0.0.41).

## 0.0.41 — 2026-04-15

**Added: message grouping for consecutive messages from the same sender.**

`ChatMessageList` now suppresses the avatar and sender header on messages that follow another from the same sender within a configurable window (default 5 minutes). System messages never group. Date-separator and unread-divider boundaries always break grouping.

New props on `ChatMessageList` and `ChatThread`:

- `groupingWindowMs?: number` — default `300_000`. Pass `0` to disable grouping entirely.

`ChatMessageItem` accepts a new `isGrouped?: boolean` prop. When true: the avatar slot is replaced with an aligned spacer (so bubbles stay under the previous message's avatar), the in-bubble sender name + `@username` row is suppressed, and outer vertical padding tightens from 3px to 1px. The wrapper carries an `sm-message-grouped` CSS class hook for host overrides.

`renderMessage` context gains:

- `isGrouped: boolean`

Custom renderers should honor it to keep parity with the default item.

New CSS file `themes/message-polish.css` (concatenated into `tailwind.css` and `shadcn.css`) holds the `sm-message-grouped` class. It's intentionally empty by default — the visual tightening is inline so hosts get the polish without requiring the CSS bundle, and the class is exported as a stable hook for layered customization.

**Bundle:** `react.js` budget bumped 175K → 180K (current size 171.17K) — adds the grouping branches in list + item plus headroom for the 0.0.42-0.0.45 polish work.

## 0.0.40 — 2026-04-14

**Added: weekday labels + formatter override on date separators.**

`ChatMessageList` (and `ChatThread`) now show "Today" / "Yesterday" / weekday name (for messages 2-6 days back) / "Apr 4" / "Apr 4, 2025" — replacing the previous Today/Yesterday/short-date pattern. The default formatter is exposed at `react-components/dateLabel.ts` for hosts that want to compose with it.

New props on `ChatMessageList` and `ChatThread`:

- `formatDateLabel?: (iso: string) => string` — full override.
- `dateLabelLocale?: string` — BCP-47 locale for the default formatter.
- `dateLabelTimeZone?: string` — IANA zone for the default formatter. **SSR hosts should set this** (or pass `formatDateLabel`) — server and client computing the day boundary in different zones is the typical cause of Today/Yesterday hydration mismatches.

`renderMessage` context gains two fields so custom renderers can preserve the list polish:

- `showDateSeparator: boolean`
- `dateLabel: string | null`

Date-boundary math now uses `Intl.DateTimeFormat.formatToParts()` for both the message day and "today" — no `new Date(y, m, d)` local-midnight conversion, so a caller-provided `timeZone` is honored consistently on both sides of the comparison.

No bundle impact (formatter replaces inline helper of similar size).

## 0.0.39 — 2026-04-14

**Changed: `VideoAttachmentPlayer` now uses Gallop for every video attachment**, including raw mp4 / webm / mov files from chat uploads.

0.0.38 fell back to native `<video>` for non-HLS sources because Gallop couldn't play them. `@scalemule/gallop@0.0.4` added `NativeFileEngine` (progressive-download playback via `video.src`), so Gallop's chrome now wraps raw files too — users get one consistent player regardless of whether the source is an HLS manifest, a Safari-native stream, or a direct S3 presigned mp4.

- Peer dep bumped: `@scalemule/gallop@>=0.0.4`.
- `VideoAttachmentPlayer` drops the HLS-detection branch — Gallop's `createEngine` now picks the right streaming engine based on URL / `mimeType`.
- No API change. Host apps that already use `VideoAttachmentPlayer` pick up the polished chrome on their existing mp4 attachments after bumping.

## 0.0.38 — 2026-04-14

**Fixed: `VideoAttachmentPlayer` now plays non-HLS chat attachments.**

Gallop's engine is HLS-only (hls.js or Safari native HLS). Chat attachments are almost always raw mp4/webm/mov files from S3 presigned URLs, which hls.js can't parse — the player mounted but the video never started, showing an infinite spinner under the Gallop chrome.

Fix: `VideoAttachmentPlayer` now detects the source type. HLS sources (`.m3u8` URL or `application/vnd.apple.mpegurl` / `application/x-mpegurl` mime) render through `GallopPlayer` for adaptive bitrate + quality switcher. Raw file sources render native `<video controls>` inside the same rounded wrapper — same visual chrome, playback that works.

`@scalemule/gallop/react` is now imported via `React.lazy` so hosts that never serve HLS attachments don't evaluate the module (and don't need `@scalemule/gallop` installed).

## 0.0.37 — 2026-04-14

**Added: `@scalemule/chat/video` entry — Gallop-powered `VideoAttachmentPlayer`.**

New code-split entry that wraps `@scalemule/gallop/react`'s `GallopPlayer` into a chat-attachment shape: accepts an `Attachment`, resolves presigned URLs on demand, and renders the polished player (adaptive bitrate, buffered preview, fullscreen, quality switcher) instead of the native `<video controls>` fallback in `ChatMessageItem`.

Usage (typically via `renderAttachment`):

```tsx
import { VideoAttachmentPlayer } from '@scalemule/chat/video';

<ChatMessageList
  renderAttachment={(att) =>
    att.mime_type?.startsWith('video/')
      ? <VideoAttachmentPlayer attachment={att} fetcher={onFetchAttachmentUrl} />
      : undefined
  }
/>
```

`@scalemule/gallop` is an **optional** peer dep — only consumers of this entry need it installed. `react.js` and `editor.js` contain zero references to Gallop (code-split verified in the bundle).

**Added: 2 more emoticons** (`:-*` / `:*` → 😘). Emoticon map is now 37 entries, matching the original MergeYard audit.

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
