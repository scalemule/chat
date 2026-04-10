/**
 * Example 03 — Rep dashboard
 *
 * Goal: a minimal support rep dashboard with an inbox (Waiting/Active/
 * Resolved), conversation thread with visitor context sidebar, and a
 * widget configuration editor. Shows how the admin entry point
 * (@scalemule/chat/react/admin) composes with the main entry.
 */

import { useEffect, useRef, useState } from 'react';
import { RepClient } from '@scalemule/chat';
import type { SupportInboxItem } from '@scalemule/chat';
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

// In a real Next.js / Vite app, read this from your env system.
// Hardcoded here for the type-level example.
const API_BASE = 'https://api.scalemule.com';
const CURRENT_REP_USER_ID = 'current-rep-user-id';

export default function RepDashboard() {
  const repClientRef = useRef<RepClient | null>(null);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [view, setView] = useState<'inbox' | 'config'>('inbox');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const rc = new RepClient({
      apiBaseUrl: API_BASE,
      getToken: async (): Promise<string> => {
        // Hits an internal admin endpoint that returns a short-lived
        // rep token. Rep dashboards use cookie-gated auth.
        const res = await fetch('/api/admin/rep-token');
        const json = (await res.json()) as { token: string };
        return json.token;
      },
      userId: CURRENT_REP_USER_ID,
    });
    repClientRef.current = rc;

    // Register if not already, then start heartbeat so we appear online
    void rc.register({ display_name: 'Rep Name' }).then(() => {
      rc.startHeartbeat();
      setInitialized(true);
    });

    return () => {
      rc.destroy();
    };
  }, []);

  if (!initialized || !repClientRef.current) {
    return <div>Initializing rep dashboard...</div>;
  }

  const repClient = repClientRef.current;

  const chatConfig = {
    apiBaseUrl: API_BASE,
    getToken: async () => '', // not used in this example
  };

  // Theming: import "@scalemule/chat/themes/shadcn.css" in your global
  // stylesheet so all SDK components inherit the host shadcn palette
  // and dark mode. See MIGRATION.md "Theming".
  return (
    <ChatProvider config={chatConfig}>
      <div style={{ display: 'flex', height: '100vh' }}>
        {/* Left: inbox + status + view switcher */}
        <aside
          style={{
            width: 288,
            borderRight: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
            <RepStatusToggle repClient={repClient} userId={CURRENT_REP_USER_ID} />
          </div>
          <nav style={{ display: 'flex', gap: 8, padding: 8, borderBottom: '1px solid #e5e7eb' }}>
            <button type="button" onClick={() => setView('inbox')}>
              Inbox
            </button>
            <button type="button" onClick={() => setView('config')}>
              Widget
            </button>
          </nav>
          {view === 'inbox' ? (
            <SupportInbox
              repClient={repClient}
              selectedConversationId={selectedConv}
              onSelectConversation={(item: SupportInboxItem) =>
                setSelectedConv(item.conversation_id)
              }
            />
          ) : null}
        </aside>

        {/* Main: thread or widget editor */}
        <main style={{ flex: 1, display: 'flex' }}>
          {view === 'config' ? (
            <div style={{ flex: 1, padding: 24 }}>
              <WidgetConfigEditor
                repClient={repClient}
                onSaved={() => console.log('Widget config saved')}
              />
            </div>
          ) : selectedConv ? (
            <>
              <div style={{ flex: 1 }}>
                <ChatThread conversationId={selectedConv} />
              </div>
              <VisitorContextPanel
                repClient={repClient}
                conversationId={selectedConv}
              />
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
              }}
            >
              Select a conversation to get started
            </div>
          )}
        </main>
      </div>
    </ChatProvider>
  );
}
