# Migration Guide

## Upgrading to 0.0.12 (from 0.0.9–0.0.11)

**0.0.12 is a fully additive release** — you can bump without code changes and everything continues to work. New features are opt-in.

```bash
npm install @scalemule/chat@^0.0.12
```

The rest of this guide explains how to start using each new feature.

---

## 0. Theming the SDK to match your app (Tailwind v4)

**Problem:** SDK pre-built React components ship with a blue primary color and generic neutral grays. Host apps using Tailwind v4 want reactions, bubbles, and CTAs to inherit the host palette automatically.

**Solution:** Import the Tailwind preset that ships in v0.0.13+. It maps the SDK's `--sm-*` CSS custom properties to Tailwind v4's auto-generated theme tokens via a fallback chain.

### Option A — CSS import (zero JavaScript)

In your `app/globals.css` (Next.js 15) or equivalent:

```css
@import "tailwindcss";
@import "@scalemule/chat/themes/tailwind.css";
```

That's it. Every `ReactionBar`, `EmojiPicker`, `ChatMessageItem`, `ChannelList`, `SearchBar`, `SupportInbox`, etc. now inherits your Tailwind theme's `--color-primary-*`, grays, `--radius-2xl`, and `--font-sans` automatically.

### Option B — JS import with ChatProvider

```tsx
// app/layout.tsx
import { ChatProvider } from '@scalemule/chat/react';
import { tailwindTheme } from '@scalemule/chat/themes/tailwind';

export default function RootLayout({ children }) {
  return (
    <ChatProvider config={chatConfig} theme={tailwindTheme}>
      {children}
    </ChatProvider>
  );
}
```

### Customizing your primary color

Define a Tailwind v4 primary palette and the SDK inherits it with no further config:

```css
@import "tailwindcss";

@theme {
  --color-primary-500: #ef4444;  /* red-500 */
  --color-primary-600: #dc2626;
}
```

Now all SDK components render in red. No props to pass. No JS config.

### Override individual tokens

Any `--sm-*` variable can be overridden on `:root` or a scoped element:

```css
:root {
  --sm-border-radius: 8px;  /* tighter than default */
  --sm-own-bubble: linear-gradient(135deg, #ef4444, #dc2626);  /* gradient */
}
```

### Fallback chain reference

| SDK token | Resolves to |
|---|---|
| `--sm-primary` | `--color-primary-500` → `--color-blue-600` → `#2563eb` |
| `--sm-own-bubble` | Same as `--sm-primary` |
| `--sm-other-bubble` | `--color-gray-100` → `#f3f4f6` |
| `--sm-surface` | `--color-white` → `#ffffff` |
| `--sm-border-color` | `--color-gray-200` → `#e5e7eb` |
| `--sm-text-color` | `--color-gray-900` → `#111827` |
| `--sm-muted-text` | `--color-gray-500` → `#6b7280` |
| `--sm-border-radius` | `--radius-2xl` → `16px` |
| `--sm-font-family` | `--font-sans` → system stack |

### Tailwind v3 users

The CSS `var()` fallback chain is standard CSS and works in v3 too — you just don't get the automatic `--color-*` inheritance because Tailwind v3 doesn't emit those variables. Define `--sm-primary` etc. directly in your global CSS:

```css
:root {
  --sm-primary: #ef4444;
  --sm-own-bubble: #ef4444;
}
```

### shadcn/ui users — use the shadcn preset instead

If your host app uses shadcn/ui (very common in the Next.js 15 ecosystem), use the dedicated shadcn preset. shadcn stores colors as bare HSL triplets and wraps them in `hsl(var(--primary))` — this preset reads those variables directly, including dark mode:

```css
/* app/globals.css */
@import "tailwindcss";
@import "@scalemule/chat/themes/shadcn.css";
```

Or via JS:

```tsx
import { ChatProvider } from '@scalemule/chat/react';
import { shadcnTheme } from '@scalemule/chat/themes/shadcn';

<ChatProvider config={chatConfig} theme={shadcnTheme}>
  {children}
</ChatProvider>
```

The SDK components now read from `--primary`, `--secondary`, `--background`, `--muted`, `--border`, `--foreground`, `--muted-foreground`, and `--radius` — the same variables shadcn's own `Button`, `Card`, `Input` components use. Your `.dark` class toggles both at once.

Combine with `renderSendButton` to drop in a shadcn `<Button>`:

```tsx
import { ChatInput } from '@scalemule/chat/react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

<ChatInput
  onSend={handleSend}
  renderSendButton={({ canSend, disabled, onSend }) => (
    <Button onClick={onSend} disabled={disabled || !canSend} size="icon">
      <Send className="h-4 w-4" />
    </Button>
  )}
/>
```

---

## 0b. Customizing component slots with render props

Theming handles colors, fonts, and border radius. For structural changes — custom avatars, a lightbox for attachments, a design-system send button — use the render-prop escape hatches.

### Custom avatar on `<ChatMessageItem>`

```tsx
import { ChatMessageItem } from '@scalemule/chat/react';
import { Avatar } from '@/components/ui/avatar'; // your design system

<ChatMessageItem
  message={msg}
  currentUserId={currentUserId}
  renderAvatar={(profile, message) => (
    <Avatar
      src={profile?.avatar_url}
      fallback={profile?.display_name?.charAt(0)}
      href={`/u/${message.sender_id}`}
    />
  )}
/>
```

### Custom attachment renderer (e.g., app-wide media lightbox)

```tsx
<ChatMessageItem
  message={msg}
  currentUserId={currentUserId}
  renderAttachment={(att) => (
    <MyMediaCard
      fileId={att.file_id}
      mimeType={att.mime_type}
      onClick={() => openLightbox(att)}
    />
  )}
/>
```

### Profile lookup from a store

When you already have a profile store (Zustand, Redux, a plain Map), you don't need to pass `profile` on every message — pass a resolver instead:

```tsx
const profiles = useProfileStore((s) => s.profiles); // Map<userId, Profile>

<ChatMessageList
  messages={messages}
  currentUserId={currentUserId}
  getProfile={(userId) => profiles.get(userId)}
/>
```

Works on both `<ChatMessageItem>` and `<ChatMessageList>`. When both `profile` and `getProfile` are provided, the explicit `profile` prop wins.

### Replace the entire message item

If you want full control over the message bubble but still want the list-level features (date dividers, unread divider, scroll-to-bottom pill), use `renderMessage` on `<ChatMessageList>`:

```tsx
<ChatMessageList
  messages={messages}
  currentUserId={currentUserId}
  profiles={profileMap}
  renderMessage={(msg, ctx) => (
    <MyBubble
      message={msg}
      isOwn={ctx.isOwnMessage}
      highlight={ctx.highlight}
      profile={ctx.profile}
    />
  )}
/>
```

### Custom send button

```tsx
import { ChatInput } from '@scalemule/chat/react';
import { Button } from '@/components/ui/button'; // shadcn Button

<ChatInput
  onSend={handleSend}
  renderSendButton={({ canSend, disabled, onSend }) => (
    <Button
      onClick={onSend}
      disabled={disabled || !canSend}
      size="icon"
      variant="default"
    >
      <SendIcon className="h-4 w-4" />
    </Button>
  )}
/>
```

### Why render props instead of "just fork the component"?

You keep:
- All future SDK bug fixes and feature additions automatically on upgrade
- All the state management (edit mode, attachment upload, typing indicators, scroll sync)
- All the event wiring to `ChatClient`

You only write the visual bits your design system requires. This is why the YouSnaps migration (see `docs/YOUSNAPS_MIGRATION_NOTES.md`) needed these escape hatches before swapping its Tailwind-themed `ChatMessageItem`.

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
