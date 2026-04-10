/**
 * Example 02 — Slack-style channels app
 *
 * Goal: a minimal team chat surface with a sidebar of named channels, a
 * main thread view, and inline message search.
 *
 * Stack: React + @scalemule/chat (works with Next.js 15 / Vite / Remix).
 */

import { useState } from 'react';
import type { ChannelListItem } from '@scalemule/chat';
import {
  ChatProvider,
  ChannelList,
  ChannelHeader,
  ChatThread,
  SearchBar,
  useChannels,
} from '@scalemule/chat/react';

// In a real Next.js / Vite app, read this from your env system:
//   process.env.NEXT_PUBLIC_SCALEMULE_API    (Next.js, needs @types/node)
//   import.meta.env.VITE_SCALEMULE_API       (Vite)
// For this type-level example we hardcode it.
const API_BASE = 'https://api.scalemule.com';

const chatConfig = {
  apiBaseUrl: API_BASE,
  getToken: async (): Promise<string> => {
    // Replace with your own token resolver — typically hits an internal
    // endpoint that returns the user's short-lived session token.
    const res = await fetch('/api/chat/token');
    const json = (await res.json()) as { token: string };
    return json.token;
  },
};

function ChannelsLayout() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { channels } = useChannels();
  const selectedChannel = channels.find((c) => c.id === selectedId);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 256,
          borderRight: '1px solid #e5e7eb',
          background: '#fff',
        }}
      >
        <ChannelList
          selectedChannelId={selectedId}
          onSelect={(ch: ChannelListItem) => setSelectedId(ch.id)}
        />
      </aside>

      {/* Main pane */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedId && selectedChannel ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                borderBottom: '1px solid #e5e7eb',
                padding: 16,
              }}
            >
              <ChannelHeader
                channelId={selectedChannel.id}
                name={selectedChannel.name ?? undefined}
                description={selectedChannel.description ?? undefined}
                memberCount={selectedChannel.member_count}
              />
              <div style={{ marginLeft: 'auto', width: 320 }}>
                <SearchBar conversationId={selectedId} />
              </div>
            </div>
            <ChatThread conversationId={selectedId} />
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              color: '#6b7280',
            }}
          >
            Select a channel to get started
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  // Theming: the cleanest pattern is to import the theme CSS in your
  // global stylesheet (recommended — see MIGRATION.md "Theming"):
  //
  //   // app/globals.css
  //   @import "tailwindcss";
  //   @import "@scalemule/chat/themes/tailwind.css";
  //
  // Alternatively, pass `theme={tailwindTheme}` to individual SDK
  // components that accept a `theme?: ChatTheme` prop (most do).
  return (
    <ChatProvider config={chatConfig}>
      <ChannelsLayout />
    </ChatProvider>
  );
}
