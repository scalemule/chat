# @scalemule/chat

**Real-time chat SDK for the ScaleMule platform** — messaging, presence, typing indicators, named channels, search, support inbox, and pre-built React components.

```bash
npm install @scalemule/chat
```

---

## Features

- **Real-time messaging** over WebSocket with HTTP polling fallback
- **Presence & typing indicators** with multi-tab safety
- **Named channels** (Slack-style, public or private)
- **Full-text message search** with highlighted excerpts
- **Message editing** including attachment add/remove
- **Reactions** with toggle semantics
- **File attachments** (images, video, audio, files) via presigned upload
- **Support inbox** — rep management, claim/resolve workflow, widget config
- **Pre-built React components** and hooks
- **Framework-agnostic core** (also ships a Web Component and iframe embed)

---

## Quick start — React

```tsx
import { ChatProvider, useChat } from '@scalemule/chat/react'

function App() {
  return (
    <ChatProvider
      config={{
        apiKey: 'pk_...',
        apiBaseUrl: 'https://api.scalemule.com',
        wsUrl: 'https://api.scalemule.com',
        userId: 'user-uuid',
      }}
    >
      <Conversation conversationId="conv-uuid" />
    </ChatProvider>
  )
}

function Conversation({ conversationId }: { conversationId: string }) {
  const { messages, sendMessage } = useChat(conversationId)
  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>{m.content}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  )
}
```

For a complete chat UI out of the box, use `<ChatThread>`:

```tsx
import { ChatThread } from '@scalemule/chat/react'

<ChatThread conversationId="conv-uuid" currentUserId="user-uuid" />
```

### Date separators

By default, the message list renders separators as **Today / Yesterday / weekday name (last 6 days) / Apr 4 / Apr 4, 2025**.

Three knobs are available on both `<ChatThread>` and `<ChatMessageList>`:

| Prop | Purpose |
| --- | --- |
| `formatDateLabel(iso)` | Replace the default formatter entirely. |
| `dateLabelLocale` | BCP-47 locale (e.g. `'en-GB'`, `'de-DE'`). |
| `dateLabelTimeZone` | IANA zone (e.g. `'America/New_York'`). |

**SSR hosts should pass `dateLabelTimeZone`** (or `formatDateLabel`) so the server and client agree on the day boundary — otherwise "Today" vs "Yesterday" can flip during hydration around midnight.

### Message grouping

Consecutive messages from the same sender within 5 minutes are grouped: the avatar and sender header are suppressed on follow-up messages, leaving a tighter visual cluster. System messages never group; date-separator and unread-divider boundaries always break grouping.

| Prop | Purpose |
| --- | --- |
| `groupingWindowMs` | Window in ms (default `300_000`). Pass `0` to disable. |

The grouped wrapper carries the `sm-message-grouped` class — override in host CSS for further customization (e.g. hover-only timestamps).

Custom `renderMessage` consumers receive `isGrouped` in context and should honor it to preserve list polish.

### Channel invitations

```tsx
import {
  ChannelInvitationsModal,
  useChannelInvitations,
} from '@scalemule/chat/react'

// Badge in the header
const { unseenCount } = useChannelInvitations()
<button onClick={() => setOpen(true)}>
  Invitations {unseenCount > 0 ? `(${unseenCount})` : ''}
</button>

// Modal
<ChannelInvitationsModal
  open={open}
  onClose={() => setOpen(false)}
  onAccepted={(inv) => router.push(`/c/${inv.channel_id}`)}
/>
```

The hook seeds from `listChannelInvitations()` and reacts to `channel:invitation:received` / `channel:invitation:resolved` realtime events. Accept / reject are optimistic; rows restore on error. Unseen count persists across reloads via `localStorage`.

`ChatClient` exposes `listChannelInvitations`, `inviteToChannel`, `acceptChannelInvitation`, `rejectChannelInvitation` for hosts that want to integrate without the modal.

### Channel admin

```tsx
import { ChannelEditModal, ChannelHeader } from '@scalemule/chat/react'

<ChannelHeader
  channelId={c.id}
  name={c.name}
  description={c.description}
  onEdit={canEdit ? () => setEditOpen(true) : undefined}
  onLeave={() => leave(c.id)}
/>

<ChannelEditModal
  open={editOpen}
  onClose={() => setEditOpen(false)}
  initial={{ name: c.name, description: c.description, visibility: c.visibility }}
  onSave={async (v) => updateChannel(c.id, v)}
  onArchive={() => archive(c.id)}
/>
```

`ChannelHeader` renders an `(i)` icon when `description` is set; hover/focus shows the full description in a popover. `<ChannelEditModal>` is the matching settings form. Permission gating is host-side — open the modal only for users who can edit.

### Channel system messages

```tsx
import { defaultFormatSystemMessage, ChatMessageItem } from '@scalemule/chat/react'

<ChatMessageItem
  message={m}
  systemMessageProfiles={profiles}
  formatSystemMessage={defaultFormatSystemMessage} // optional; this is the default
/>
```

The default formatter handles `system.channel.{joined,left,invited,created,renamed,archived}` and `system.call.{started,ended}`. Pass a custom `formatSystemMessage(content, profiles)` to override. `parseSystemMessage` is also exported for use outside the chat UI (activity logs, audit views).

### New-conversation modal

```tsx
import { NewConversationModal } from '@scalemule/chat/react'

<NewConversationModal
  open={open}
  onClose={() => setOpen(false)}
  searchUsers={(q) => api.searchUsers(q)}
  onCreate={async (ids) => {
    const conv = await api.createDM(ids)
    router.push(`/messages/${conv.id}`)
  }}
  currentUserId={currentUserId}
/>
```

Multi-select user picker with debounced search (250ms default), keyboard navigation, focus trap, and error surfacing. Router-agnostic — host provides `searchUsers` and `onCreate`.

### Active call indicator

```tsx
import { ActiveCallDot, ConversationList } from '@scalemule/chat/react'

<ConversationList
  renderActiveIndicator={(c) => (
    <ActiveCallDot active={activeCallIds.has(c.id)} />
  )}
/>
```

Host wires the source of truth (conference presence, WebRTC signaling, etc.). `<ActiveCallDot>` is a pulsing green dot with pure-CSS animation — pass `active={false}` or omit the renderer entirely to disable.

Tokens: `--sm-active-call-color`, `--sm-active-call-pulse-opacity` (set to `0` to disable the pulse while keeping the dot).

### Mention count badges

```tsx
import { useMentionCounts, ConversationList } from '@scalemule/chat/react'

// Automatic: ConversationList calls the hook internally using currentUserId.
<ConversationList currentUserId={currentUserId} />

// Manual: host-supplied store wins over the internal hook.
const counts = useMentionCounts(currentUserId)
<ConversationList currentUserId={currentUserId} mentionCounts={counts} />
```

The badge reads `@N` and is styled via `.sm-mention-badge` using `--sm-mention-badge-bg` / `--sm-mention-badge-text`. The displayed count sums the server-side hint on `Conversation.mention_count` with the live hook overlay. `showMentionBadge={false}` suppresses the badge entirely.

Increments derive client-side from the mention blot's `data-sm-user-id` attribute, so nothing server-side changes — the feature lights up automatically once the host renders mentions.

### Sectioned conversation list

```tsx
<ConversationList
  groupBy="type"
  sectionOrder={['channel', 'group', 'direct']}
  sectionLabels={{ channel: 'TOPICS', direct: 'PEOPLE' }}
/>
```

`groupBy="type"` partitions rows by `conversation_type` and renders a collapsible header for each section. Per-section collapse state persists to `localStorage` (`sm-conv-list-section-collapsed-v1`) and degrades silently when storage is unavailable.

`sectionOrder` doubles as an inclusion filter — types omitted from the list are hidden entirely. `sectionLabels` overrides the default English labels (CHANNELS, GROUPS, DIRECT MESSAGES, etc.).

CSS hooks: `.sm-conv-section`, `.sm-conv-section-{type}`, `.sm-conv-section-header`.

### Conversation display names

`ConversationList` resolves human-readable names for every row type:

```tsx
<ConversationList
  currentUserId={currentUserId}
  profiles={profilesByUserId}
  selfLabel="— Saved"           // optional; default "(you)"
  formatGroupName={(names) =>   // optional; default "Alice, Bob, and N others"
    `${names.length} people`
  }
/>
```

- 1:1 DM with self → `"<your name> (you)"`
- Named channels / groups → `conversation.name`
- Unnamed groups → `"Alice, Bob, and N others"` (current user filtered out)
- 1:1 DM → other participant's display name, falling back to `counterparty_user_id` → `conversation.name` → short id

`resolveConversationDisplayName`, `buildDefaultGroupName`, and `otherParticipantNames` are exported from `@scalemule/chat` (SSR-safe, React-free) for use in previews / notifications / system-message templates.

### Search UX (opt-in entry)

Search UX ships in a separate code-split entry so hosts that don't render search pay no bundle cost:

```tsx
// Core chat — used everywhere
import { ChatThread, ConversationList } from '@scalemule/chat/react'

// Search UX — import only in views that need it
import {
  HighlightedExcerpt,
  SearchHistoryDropdown,
  useSearchHistory,
} from '@scalemule/chat/search'
```

**Search history with a controlled input:**

```tsx
const { history, push, clear } = useSearchHistory({
  storageKey: `sm-search-history-v1:${userId}`,  // scope per user
})
const [q, setQ] = useState('')
const [open, setOpen] = useState(false)

<div style={{ position: 'relative' }}>
  <input
    value={q}
    onChange={(e) => setQ(e.target.value)}
    onFocus={() => setOpen(true)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        push(q)
        setOpen(false)
      }
    }}
  />
  {open && (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0 }}>
      <SearchHistoryDropdown
        history={history}
        onSelect={(q) => { setQ(q); setOpen(false) }}
        onClose={() => setOpen(false)}
        onClear={clear}
      />
    </div>
  )}
</div>
```

**Rendering highlighted excerpts:**

```tsx
result.highlights.map((html, i) => (
  <HighlightedExcerpt key={i} html={html} />
))
```

Theme via `--sm-search-highlight-bg` / `--sm-search-highlight-text`.

`<SearchBar>` and `useSearch` (from `@scalemule/chat/react`) remain the single-conversation inline search surface — unchanged.

### Scroll-to-message highlight

Pass `highlightMessageId` (on `<ChatThread>` or `<ChatMessageList>`) to scroll to a specific message and paint the search-hit treatment — a 2-second amber fade + left border. Typically wired to a search-result click.

The unread-divider emphasis (first unread message) renders independently as a subtle left-edge ring — no longer collapsed into the same chrome.

| CSS class | Applied when |
| --- | --- |
| `.sm-message-highlighted` | `highlightMessageId === message.id` |
| `.sm-message-unread-start` | first unread message in the thread (and not also a search hit) |

Tokens for theming: `--sm-highlight-bg`, `--sm-highlight-border`, `--sm-unread-divider-color`.

### Rich-link embeds (YouTube)

Opt-in via the `@scalemule/chat/embeds` entry — code-split so hosts that don't render embeds don't pay the bundle cost.

```tsx
import { YouTubeEmbeds } from '@scalemule/chat/embeds'

<ChatThread
  conversationId={id}
  renderEmbeds={(msg) => <YouTubeEmbeds html={msg.content} />}
/>
```

Detection covers standard watch URLs, `youtu.be` short links, `/embed/`, and `/shorts/`. Titles are fetched best-effort via YouTube's oEmbed endpoint and cached to `localStorage` for 7 days. Storage access is guarded — SSR, private browsing, and quota-blocked browsers fall back to title-less embeds without crashing.

`extractYouTubeIds` is exported standalone for previews / notifications / search-index enrichment (SSR-safe).

### URL auto-linkify

Plain-text messages auto-detect http/https/`www.` URLs and render them as `<a class="sm-link-auto" target="_blank" rel="noopener noreferrer nofollow">`. Trailing prose punctuation is trimmed; balanced parens are kept.

| Prop | Purpose |
| --- | --- |
| `linkifyPlainText` | Default `true`. Pass `false` to render raw text. |

The detection helper is also a public utility for previews, notifications, and search excerpts:

```ts
import { linkify, hasLinks } from '@scalemule/chat'

const segments = linkify('see https://example.com docs')
// → [{type:'text', value:'see '}, {type:'link', display:..., url:...}, ...]
```

It's SSR-safe (regex-only, no DOM).

### Mention click handling

`<span class="sm-mention" data-sm-user-id>` and `<span class="sm-channel-mention" data-sm-channel-id>` chips inside HTML messages are clickable. Wire navigation via two callbacks:

```tsx
<ChatThread
  conversationId={id}
  onMentionClick={(userId) => router.push(`/u/${userId}`)}
  onChannelMentionClick={(channelId) => router.push(`/c/${channelId}`)}
/>
```

When neither callback is provided, chips render as styled but inert text — useful for read-only views (e.g. archived threads).

Customize chip colors via `--sm-mention-bg`, `--sm-mention-hover-bg`, `--sm-mention-text`, `--sm-channel-mention-bg`, `--sm-channel-mention-hover-bg`, `--sm-channel-mention-text`.

---

## Quick start — named channels

```tsx
import { useChannels } from '@scalemule/chat/react'

function ChannelPicker() {
  const { channels, createChannel, joinChannel, leaveChannel } = useChannels()

  return (
    <div>
      <button onClick={() => createChannel({ name: 'general', visibility: 'public' })}>
        Create #general
      </button>
      {channels.map((ch) => (
        <div key={ch.id}>
          # {ch.name} — {ch.member_count} members
          {ch.is_member ? (
            <button onClick={() => leaveChannel(ch.id)}>Leave</button>
          ) : (
            <button onClick={() => joinChannel(ch.id)}>Join</button>
          )}
        </div>
      ))}
    </div>
  )
}
```

Or drop in the pre-built `<ChannelList>` and `<ChannelBrowser>` components.

---

## Quick start — message search

```tsx
import { SearchBar } from '@scalemule/chat/react'

<SearchBar conversationId="conv-uuid" placeholder="Search this conversation..." />
```

The component renders a search input and results dropdown inline. For custom UI, use the `useSearch(conversationId)` hook directly.

---

## Quick start — support rep (RepClient)

```ts
import { RepClient } from '@scalemule/chat'

const rep = new RepClient({
  apiBaseUrl: 'https://api.scalemule.com',
  apiKey: 'pk_...',
  userId: 'rep-user-uuid',
  getToken: async () => getAccessToken(),
})

// Register as a support rep
await rep.register({ display_name: 'Alice' })

// Go online and start heartbeat
await rep.updateStatus('online')
rep.startHeartbeat()

// Fetch the inbox and claim the first waiting conversation
const inbox = await rep.getInbox({ status: 'waiting' })
if (inbox.data?.[0]) {
  await rep.claimConversation(inbox.data[0].id)
  // rep.chat is now routed to the support conversation; send messages with rep.chat.sendMessage
}
```

See [`docs/MIGRATION.md`](./docs/MIGRATION.md) for a full walkthrough including the cookie-based auth recipe for admin dashboards.

---

## Entry points

| Import | Contents |
|--------|----------|
| `@scalemule/chat` | `ChatClient`, `RepClient`, `SupportClient`, `ChatController`, all types |
| `@scalemule/chat/react` | `ChatProvider`, hooks (`useChat`, `useChannels`, `useSearch`, `useConversations`, `useUnreadCount`, `usePresence`, `useTyping`, `useConnection`), and pre-built components |
| `@scalemule/chat/element` | `<scalemule-chat>` Web Component |
| `@scalemule/chat/iframe` | iframe embed bootstrap |

---

## Documentation

- [`CHANGELOG.md`](./CHANGELOG.md) — version history
- [`docs/MIGRATION.md`](./docs/MIGRATION.md) — upgrade guides, including the 0.0.12 Phase 1-3 features

---

## License

MIT
