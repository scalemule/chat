# Migration Guide

## Upgrading to 0.0.12 (from 0.0.9–0.0.11)

**0.0.12 is a fully additive release** — you can bump without code changes and everything continues to work. New features are opt-in.

```bash
npm install @scalemule/chat@^0.0.12
```

The rest of this guide explains how to start using each new feature.

---

## 1. Named channels

The backend now supports Slack-style named channels alongside the existing `direct`, `group`, `large_room`, `broadcast`, `ephemeral`, and `support` conversation types.

### Create, list, join, leave

```ts
import { useChannels } from '@scalemule/chat/react'

function ChannelsPanel() {
  const { channels, isLoading, createChannel, joinChannel, leaveChannel } =
    useChannels({ search: '' })

  const handleCreate = async () => {
    const result = await createChannel({
      name: 'engineering',
      visibility: 'public', // or 'private'
      description: 'Engineering discussions',
    })
    if (result.data) {
      console.log('Created:', result.data.id)
    }
  }

  return (
    <ul>
      {channels.map((ch) => (
        <li key={ch.id}>
          # {ch.name} ({ch.member_count})
          {ch.is_member ? (
            <button onClick={() => leaveChannel(ch.id)}>Leave</button>
          ) : (
            <button onClick={() => joinChannel(ch.id)}>Join</button>
          )}
        </li>
      ))}
    </ul>
  )
}
```

### Discovery vs joined-channel sidebars

`listChannels()` is the **discovery** endpoint — it returns public channels and your private channels with an `is_member` flag. Use it for the "Browse Channels" dialog.

For the user's **joined-channel sidebar**, keep using:

```ts
useConversations({ conversationType: 'channel' })
```

`useConversations` now listens for the new `'channel:changed'` event and auto-refetches — but **only when `conversationType === 'channel'` or no filter is set**. Your existing direct/group/support sidebars will not churn on channel activity.

### `leaveChannel` cleanup

`ChatClient.leaveChannel(id)` performs full local cleanup on success:

1. POSTs `/v1/chat/channels/{id}/leave`
2. Unsubscribes from the conversation WebSocket channel
3. Calls `leavePresence`
4. Removes the channel from the `conversationTypes` map
5. Emits `'channel:changed'`

Callers don't need to manually navigate away first, but note that a still-mounted `<ChatThread>` will keep showing **cached** messages until the host app clears its conversation selection.

---

## 2. Message search

```ts
import { useSearch } from '@scalemule/chat/react'

function SearchPanel({ conversationId }: { conversationId: string }) {
  const { results, total, query, isSearching, search, clearSearch } =
    useSearch(conversationId)

  return (
    <div>
      <input onKeyDown={(e) => e.key === 'Enter' && search(e.currentTarget.value)} />
      {isSearching && 'Searching...'}
      {query && `${total} results for "${query}"`}
      {results.map((r) => (
        <div key={r.message.id}>
          Score: {r.score.toFixed(2)}
          {r.highlights.map((h, i) => (
            <div key={i} dangerouslySetInnerHTML={{ __html: h }} />
          ))}
        </div>
      ))}
      <button onClick={clearSearch}>Clear</button>
    </div>
  )
}
```

Or drop in `<SearchBar conversationId={...} />` for a one-liner with inline results.

`ChatClient.searchMessages(conversationId, query, limit?)` is the underlying method if you need to call it directly.

---

## 3. Attachment editing

`editMessage` got an optional third argument:

```ts
// 0.0.11 and earlier
await client.editMessage(messageId, 'new text')

// 0.0.12 — backward compatible
await client.editMessage(messageId, 'new text') // unchanged
await client.editMessage(messageId, 'new text', newAttachmentsArray) // new
```

When you pass `attachments`, the PATCH body includes them and the backend updates both the `content` and `attachments` columns atomically.

On the incoming side, `MessageEditedEvent.new_attachments` is optional — the SDK's `buildEditedMessage()` applies them to the cached message if present.

### React integration

The `useChat().editMessage` callback threads attachments through:

```ts
const { editMessage } = useChat(conversationId)
await editMessage(messageId, 'new text', [attachment1, attachment2])
```

The pre-built `<ChatMessageItem>` edit mode now shows removable attachment chips. The save gate blocks empty results (no text AND no attachments). **Adding new attachments during edit is currently out of scope** — reps can remove attachments or edit text, but the upload flow for new attachments during edit is not wired in yet.

### `ChatController` additions

`ChatController` was missing `editMessage` and `deleteMessage` entirely. They're now available:

```ts
const controller = new ChatController(client, conversationId)
await controller.editMessage(messageId, 'new text', attachments)
await controller.deleteMessage(messageId)
```

Both throw on error (matching `sendMessage`'s pattern).

---

## 4. RepClient — support representative operations

`RepClient` is a new class for managing support reps, claiming conversations, and updating widget config. It has two construction modes.

### Mode A: Standalone (owns its own ChatClient)

Use this for dedicated support dashboards or standalone rep apps.

```ts
import { RepClient } from '@scalemule/chat'

const rep = new RepClient({
  apiBaseUrl: 'https://api.scalemule.com',
  apiKey: 'pk_...',
  getToken: async () => getAccessToken(),
  userId: 'rep-user-uuid',
})

// rep.ownsChat === true — destroy() will close the ChatClient
```

### Mode B: Wrap an existing ChatClient

Use this when your app already has a `ChatProvider` and you want the rep to reuse its WebSocket.

```tsx
import { RepClient } from '@scalemule/chat'
import { useChatClient } from '@scalemule/chat/react'

function RepDashboard() {
  const chatClient = useChatClient()
  const rep = useMemo(
    () =>
      new RepClient({
        chatClient, // <-- wrap the shared instance
        apiBaseUrl: 'https://api.scalemule.com',
        getToken: async () => getAccessToken(),
        userId: 'rep-user-uuid',
      }),
    [chatClient],
  )

  useEffect(() => () => rep.destroy(), [rep])
  // rep.ownsChat === false — destroy() will NOT close the wrapped ChatClient
}
```

### Constructor validation

`RepClient` throws at construction if:

1. **Neither `sessionToken` nor `getToken` is provided** — rep HTTP endpoints require bearer auth:
   ```
   Error: RepClient requires sessionToken or getToken for authentication
   ```
2. **A wrapped `chatClient.userId` conflicts with `config.userId`** — prevents silently using the wrong identity:
   ```
   Error: RepClient userId does not match wrapped chatClient.userId
   ```

### Typical rep flow

```ts
// 1. Register (only needed once per user)
await rep.register({ display_name: 'Alice', max_concurrent: 5 })

// 2. Go online
await rep.updateStatus('online')
rep.startHeartbeat(60_000) // idempotent — clears any existing timer first

// 3. Fetch the waiting tab
const { data: waiting } = await rep.getInbox({ status: 'waiting' })
// Each returned item has support routing stamped automatically —
// rep.chat.sendMessage(conv_id, ...) will route to conversation:support:{id}

// 4. Claim the first one
const { data: claimed } = await rep.claimConversation(waiting![0].id)

// 5. Reply via the wrapped ChatClient
await rep.chat.sendMessage(claimed!.conversation_id, { content: 'Hi there!' })

// 6. Resolve when done
await rep.updateConversationStatus(claimed!.id, 'resolved')
```

### IDs: `id` vs `conversation_id`

Support inbox items have two identifiers:

- **`id`** — the `support_conversations` row ID. Used for rep-facing routes: `claimConversation(id)`, `updateConversationStatus(id, ...)`.
- **`conversation_id`** — the actual chat conversation UUID. Used for messaging via `rep.chat.*` and for matching against `<ChatThread conversationId={...}>`.

Get both from `SupportInboxItem` and pick the right one for each call.

---

## 5. Recipe: admin dashboards with cookie-based auth

**Context**: Admin dashboards (like `scalemule-app`) authenticate members via session cookies, not bearer tokens. `RepClient`'s `HttpTransport` does not send cookies (`credentials: 'include'` was intentionally removed to support cross-origin widgets). So how do you use `RepClient` in a cookie-auth app?

**Recipe**: Store a **non-HttpOnly** access token in a cookie readable by JS, then pass it via `RepClient`'s `getToken` callback. The transport will put it in an `Authorization: Bearer ...` header, and the gateway accepts it just like cookie auth.

```ts
// lib/chat/member-config.ts
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function getMemberAccessToken(): string | null {
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'local'
  return readCookie(`${environment}_member_access_token`)
}
```

```tsx
// components/RepStatusToggle.tsx
import { useEffect, useMemo, useState } from 'react'
import { RepClient } from '@scalemule/chat'
import { useChatClient } from '@scalemule/chat/react'
import { useAuth } from '@/lib/auth/auth-context'
import { getMemberAccessToken } from '@/lib/chat/member-config'

export function RepStatusToggle() {
  const { user } = useAuth()
  const chatClient = useChatClient() // shared from ChatProvider

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const repClient = useMemo(() => {
    if (!user?.sm_user_id) return null
    return new RepClient({
      chatClient, // wrap the shared instance
      apiBaseUrl: process.env.NEXT_PUBLIC_API_GATEWAY_URL!,
      userId: user.sm_user_id,
      getToken: async () => getMemberAccessToken(),
    })
  }, [chatClient, user?.sm_user_id])

  // Stop the heartbeat timer on unmount — does NOT close the wrapped ChatClient
  useEffect(() => () => repClient?.destroy(), [repClient])

  // ... rest of component
}
```

### Why keep your native UI

The SDK ships pre-built components (`<RepStatusToggle>`, `<SupportInbox>`, `<ChannelList>`, etc.) with inline styles and CSS custom properties. They're designed for portability, but they **will not match Tailwind / shadcn / MUI / Chakra apps** without significant theming work.

For admin dashboards with an existing design system, the recommended pattern is:

1. **Keep your native UI** (Tailwind components, shadcn primitives, etc.)
2. **Swap the backend calls** from ad-hoc `fetch` / `axios` to the SDK's typed clients (`ChatClient`, `RepClient`)
3. **Reuse the shared `ChatClient`** via `useChatClient()` inside `ChatProvider` so you don't duplicate WebSocket connections

This gives you consistent UI with minimal refactoring and validates the SDK path without regressing UX.

### Why not pass the existing ChatClient token?

You might wonder why `RepClient` needs its own auth config when a wrapped `ChatClient` already has one. The answer: `ChatClient` does not expose its internal `HttpTransport` or auth config (they're private fields), so `RepClient` can't reuse them. It has to construct its own `HttpTransport` with the same auth inputs. This is a known limitation that could be addressed in a future release by exposing a shared transport factory.

**Consequence**: your wrapped `chatClient` and your `RepClientConfig` auth fields must target the **same environment** (same `apiBaseUrl`, same token source). There's no automatic check because `ChatClient` doesn't expose its `apiBaseUrl`.

---

## 6. Scoped `useConversations` refetch

**Breaking-ish**: `useConversations` now listens for `'channel:changed'` events in addition to `'inbox:update'` and `'read'`. This could be surprising if you have multiple `useConversations` instances filtered by different types.

**The listener is scoped** — it only refetches when:

- `options?.conversationType === 'channel'`, OR
- `options?.conversationType` is `undefined` (no filter)

So `useConversations({ conversationType: 'direct' })` and `useConversations({ conversationType: 'support' })` will NOT refetch on channel create/join/leave. Only channel-filtered or unfiltered lists refetch.

If you have an unfiltered `useConversations` and don't want it to refetch on channel changes, pass an explicit filter:

```ts
// Before 0.0.12: only refetched on inbox:update
useConversations()

// After 0.0.12: also refetches on channel:changed
useConversations() // unchanged — but now includes channels

// If you want the old behavior (no channel refetches), filter it:
useConversations({ conversationType: 'direct' }) // won't see channels
```

---

## 7. Bundle size impact

The React ESM bundle grew from ~110 KB (0.0.11) to ~142 KB in 0.0.12 because of the 7 new components. If you tree-shake aggressively and don't import the new components, your final bundle should only grow by the hooks + client methods you actually use.

The core (`@scalemule/chat`) and non-React entry points (`element`, `iframe`) are unaffected.

---

## Questions

If you hit anything this guide doesn't cover, file an issue on [`github.com/scalemule/chat`](https://github.com/scalemule/chat/issues).
