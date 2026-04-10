# @scalemule/chat examples

Three copy-paste recipes for the most common ways to adopt `@scalemule/chat`.
Each one is a single-file starting point you can drop into your host app.

For full prop/type documentation, see the [MIGRATION.md](../docs/MIGRATION.md) and the generated `.d.ts` files in the published package.

---

## 1. Embeddable support widget (customer website)

**Goal:** Add a floating support chat bubble to a marketing site, with zero JS framework. Visitors talk to reps; reps claim conversations from a separate dashboard.

```html
<!-- index.html (any static site) -->
<!DOCTYPE html>
<html>
<head>
  <title>Acme Inc.</title>
</head>
<body>
  <h1>Welcome to Acme</h1>

  <!-- Support widget bootstrap -->
  <script src="https://unpkg.com/@scalemule/chat@^0.1.0/dist/support-widget.global.js"></script>
  <script>
    ScaleMuleSupportWidget.init({
      apiKey: 'pb_live_your_public_api_key',
      theme: {
        primary: '#ef4444',      // host brand color
        borderRadius: 12,
      },
      position: 'right',          // or 'left'
    });
  </script>
</body>
</html>
```

That's the entire integration. The widget:
- Creates an anonymous visitor session on first open
- Persists the session token across page reloads
- Streams messages in real-time (WebSocket with HTTP polling fallback)
- Supports file attachments, emoji reactions, typing indicators
- Inherits the `primary` color you pass in

**Next steps:** Customize pre-chat fields, widget copy, and behavior via the [Rep Dashboard](#3-rep-dashboard-claim--resolve--configure-widget) → Widget Config tab.

---

## 2. Slack-style channels app (Next.js 15 + Tailwind v4)

**Goal:** Build a Slack-like team chat surface: sidebar of named channels, main thread view, message search, typing indicators.

```tsx
// app/channels/page.tsx
'use client';

import { useState } from 'react';
import {
  ChatProvider,
  ChannelList,
  ChannelHeader,
  ChatThread,
  SearchBar,
  useChannels,
} from '@scalemule/chat/react';
import { tailwindTheme } from '@scalemule/chat/themes/tailwind';
import '@scalemule/chat/themes/tailwind.css';

const chatConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_SCALEMULE_API!,
  getToken: async () => {
    // Your app's auth — return the user's session token
    const res = await fetch('/api/chat/token');
    const { token } = await res.json();
    return token;
  },
};

function ChannelsLayout() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { channels } = useChannels();
  const selectedChannel = channels.find((c) => c.id === selectedId);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-white">
        <ChannelList
          selectedChannelId={selectedId}
          onSelect={(ch) => setSelectedId(ch.id)}
        />
      </aside>

      {/* Main pane */}
      <main className="flex-1 flex flex-col">
        {selectedId && selectedChannel && (
          <>
            <div className="border-b p-4 flex items-center gap-4">
              <ChannelHeader channel={selectedChannel} />
              <div className="ml-auto w-80">
                <SearchBar conversationId={selectedId} />
              </div>
            </div>
            <ChatThread conversationId={selectedId} />
          </>
        )}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <ChatProvider config={chatConfig} theme={tailwindTheme}>
      <ChannelsLayout />
    </ChatProvider>
  );
}
```

**What this gives you:**
- Sidebar auto-populates with every channel the user is a member of
- Clicking a channel opens the thread and subscribes to real-time messages
- Search bar does full-text message search via OpenSearch (built into the SDK)
- All colors inherit your Tailwind theme via the preset — customize by setting `--color-primary-500` in your `@theme` block

**Next steps:** Wire a "Create channel" button that calls `createChannel()` from `useChannels()`, or a channel browser via the `ChannelBrowser` component.

---

## 3. Rep dashboard (claim + resolve + configure widget)

**Goal:** Build the rep-side admin dashboard for a support product: inbox of waiting/active/resolved conversations, visitor context sidebar, widget config editor.

```tsx
// app/admin/support/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChatProvider,
  SupportInbox,
  RepStatusToggle,
  ChatThread,
} from '@scalemule/chat/react';
import {
  WidgetConfigEditor,
  VisitorContextPanel,
} from '@scalemule/chat/react/admin';
import { RepClient } from '@scalemule/chat';
import { shadcnTheme } from '@scalemule/chat/themes/shadcn';
import '@scalemule/chat/themes/shadcn.css';

const API_BASE = process.env.NEXT_PUBLIC_SCALEMULE_API!;

export default function RepDashboard() {
  const repClientRef = useRef<RepClient | null>(null);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [view, setView] = useState<'inbox' | 'config'>('inbox');

  useEffect(() => {
    // Create RepClient once on mount. Uses cookie auth (your admin login).
    const rc = new RepClient({
      apiBaseUrl: API_BASE,
      getToken: async () => {
        const res = await fetch('/api/admin/rep-token');
        const { token } = await res.json();
        return token;
      },
      userId: 'current-rep-user-id',
    });
    repClientRef.current = rc;

    // Register + start heartbeat so we appear as online
    void rc.register({ display_name: 'Rep Name' }).then(() => rc.startHeartbeat());

    return () => {
      rc.destroy();
    };
  }, []);

  if (!repClientRef.current) return <div>Initializing...</div>;
  const repClient = repClientRef.current;

  return (
    <ChatProvider config={{ apiBaseUrl: API_BASE, getToken: () => '' }} theme={shadcnTheme}>
      <div className="flex h-screen">
        {/* Left: inbox + controls */}
        <aside className="w-72 border-r flex flex-col">
          <div className="p-4 border-b">
            <RepStatusToggle repClient={repClient} userId="current-rep-user-id" />
          </div>
          <nav className="flex gap-2 p-2 border-b">
            <button onClick={() => setView('inbox')}>Inbox</button>
            <button onClick={() => setView('config')}>Widget</button>
          </nav>
          {view === 'inbox' ? (
            <SupportInbox
              repClient={repClient}
              selectedConversationId={selectedConv}
              onSelectConversation={(item) => setSelectedConv(item.conversation_id)}
            />
          ) : null}
        </aside>

        {/* Main: thread or widget editor */}
        <main className="flex-1 flex">
          {view === 'config' ? (
            <div className="flex-1 p-6">
              <WidgetConfigEditor
                repClient={repClient}
                onSaved={() => console.log('Widget saved')}
              />
            </div>
          ) : selectedConv ? (
            <>
              <div className="flex-1">
                <ChatThread conversationId={selectedConv} />
              </div>
              <VisitorContextPanel
                repClient={repClient}
                conversationId={selectedConv}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to get started
            </div>
          )}
        </main>
      </div>
    </ChatProvider>
  );
}
```

**What this gives you:**
- Multi-tab inbox (Waiting / Active / Resolved) with live updates via NATS events
- Click a conversation → opens the thread + visitor context sidebar
- Visitor context shows name, email, page URL, browser, conversation history
- Widget config tab lets the rep tune Appearance/Content/Behavior without touching code
- `RepStatusToggle` lets the rep flip online/away/offline with auto heartbeat
- Dark mode works automatically when your host app toggles `.dark` (shadcn theme bridge)

**Auth note:** Rep dashboards use cookie auth, not API keys. Your `getToken` implementation should hit a privileged internal endpoint that returns a short-lived rep token. The SDK never sees user credentials directly.

---

## Running these examples locally

Each snippet is meant to be copy-pasted into your own Next.js/React project. To build a standalone runnable example:

```bash
npx create-next-app@latest my-chat-example --typescript --tailwind
cd my-chat-example
npm install @scalemule/chat@^0.1.0
# paste one of the examples above into app/page.tsx
npm run dev
```

For a runnable minimal example that builds against the local SDK in this monorepo, use `file:../..` in the example's `package.json`:

```json
{
  "dependencies": {
    "@scalemule/chat": "file:../..",
    "next": "16.1.0",
    "react": "19.2.3",
    "react-dom": "19.2.3"
  }
}
```

---

## More recipes

- [MIGRATION.md](../docs/MIGRATION.md) has detailed recipes for theming (Tailwind v4, shadcn/ui, Tailwind v3), render-prop escape hatches, and upgrading from earlier versions.
- [YOUSNAPS_MIGRATION_NOTES.md](../docs/YOUSNAPS_MIGRATION_NOTES.md) is a real customer migration with lessons on what works and what needs customization.
