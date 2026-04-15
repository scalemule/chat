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
