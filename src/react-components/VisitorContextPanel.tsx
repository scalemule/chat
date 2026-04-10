import React, { useCallback, useEffect, useState } from 'react';

import type { RepClient, SupportInboxItem } from '../rep';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';

/**
 * <VisitorContextPanel> — sidebar component showing visitor context for a
 * claimed support conversation. Reads visitor metadata (name, email, page
 * URL, user agent) from the RepClient inbox and live-refreshes on
 * `inbox:update` events.
 *
 * Use alongside <SupportInbox> in a rep/admin dashboard:
 *
 * ```tsx
 * <div style={{ display: 'flex', gap: 16 }}>
 *   <SupportInbox
 *     repClient={repClient}
 *     onSelectConversation={(item) => setSelected(item.conversation_id)}
 *   />
 *   <VisitorContextPanel
 *     repClient={repClient}
 *     conversationId={selected}
 *   />
 * </div>
 * ```
 *
 * All visitor fields are optional — widget visitors who skipped the pre-chat
 * form will have sparse data, and the panel gracefully shows "Unknown"
 * placeholders.
 */
interface VisitorContextPanelProps {
  repClient: RepClient;
  conversationId?: string | null;
  theme?: ChatTheme;
  /** Initial item to show before the first fetch (e.g., passed from SupportInbox's onSelectConversation). */
  initialItem?: SupportInboxItem | null;
}

export function VisitorContextPanel({
  repClient,
  conversationId,
  theme,
  initialItem,
}: VisitorContextPanelProps): React.JSX.Element {
  const [item, setItem] = useState<SupportInboxItem | null>(initialItem ?? null);
  const [isLoading, setIsLoading] = useState(false);

  // Lookup: find the matching inbox item for conversationId across all tabs.
  // Tries waiting → active → resolved to find wherever the conversation
  // currently lives.
  const fetchItem = useCallback(async () => {
    if (!conversationId) {
      setItem(null);
      return;
    }
    setIsLoading(true);
    for (const status of ['active', 'waiting', 'resolved'] as const) {
      const result = await repClient.getInbox({ status });
      if (result.data) {
        const found = result.data.find(
          (it) => it.conversation_id === conversationId,
        );
        if (found) {
          setItem(found);
          setIsLoading(false);
          return;
        }
      }
    }
    setIsLoading(false);
  }, [repClient, conversationId]);

  // Fetch on conversationId change
  useEffect(() => {
    void fetchItem();
  }, [fetchItem]);

  // Live refresh on inbox events
  useEffect(() => {
    if (!conversationId) return;
    const handler = () => {
      void fetchItem();
    };
    const unsub = repClient.chat.on('inbox:update', handler);
    return () => {
      unsub();
    };
  }, [repClient, conversationId, fetchItem]);

  if (!conversationId) {
    return (
      <div
        data-scalemule-chat=""
        style={{
          ...themeToStyle(theme),
          ...containerStyle,
          textAlign: 'center',
          color: 'var(--sm-muted-text, #6b7280)',
          fontSize: 13,
        }}
      >
        Select a conversation to see visitor context
      </div>
    );
  }

  if (isLoading && !item) {
    return (
      <div
        data-scalemule-chat=""
        style={{
          ...themeToStyle(theme),
          ...containerStyle,
          textAlign: 'center',
          color: 'var(--sm-muted-text, #6b7280)',
          fontSize: 13,
        }}
      >
        Loading visitor...
      </div>
    );
  }

  const visitor = {
    name: item?.visitor_name ?? 'Anonymous visitor',
    email: item?.visitor_email ?? null,
    pageUrl: item?.visitor_page_url ?? null,
    userAgent: item?.visitor_user_agent ?? null,
  };

  return (
    <div
      data-scalemule-chat=""
      style={{
        ...themeToStyle(theme),
        ...containerStyle,
      }}
    >
      <div
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: 'var(--sm-muted-text, #6b7280)',
            marginBottom: 8,
          }}
        >
          Visitor
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--sm-text-color, #111827)',
            marginBottom: 4,
          }}
        >
          {visitor.name}
        </div>
        {visitor.email && (
          <a
            href={`mailto:${visitor.email}`}
            style={{
              fontSize: 13,
              color: 'var(--sm-primary, #2563eb)',
              textDecoration: 'none',
            }}
          >
            {visitor.email}
          </a>
        )}
      </div>

      <Section title="Page">
        {visitor.pageUrl ? (
          <a
            href={visitor.pageUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 13,
              color: 'var(--sm-primary, #2563eb)',
              textDecoration: 'none',
              wordBreak: 'break-all',
            }}
          >
            {formatUrl(visitor.pageUrl)}
          </a>
        ) : (
          <Muted>Unknown</Muted>
        )}
      </Section>

      <Section title="Browser">
        {visitor.userAgent ? (
          <div
            style={{
              fontSize: 12,
              color: 'var(--sm-text-color, #111827)',
              lineHeight: 1.4,
            }}
          >
            {summarizeUserAgent(visitor.userAgent)}
          </div>
        ) : (
          <Muted>Unknown</Muted>
        )}
      </Section>

      <Section title="Conversation">
        <Row label="Status">{item?.status ?? 'unknown'}</Row>
        {item?.assigned_rep_name && (
          <Row label="Rep">{item.assigned_rep_name}</Row>
        )}
        {item?.created_at && (
          <Row label="Started">{formatRelative(item.created_at)}</Row>
        )}
        {item?.claimed_at && (
          <Row label="Claimed">{formatRelative(item.claimed_at)}</Row>
        )}
      </Section>
    </div>
  );
}

/* ---------- internal helpers ---------- */

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 240,
  maxWidth: 320,
  border: '1px solid var(--sm-border-color, #e5e7eb)',
  borderRadius: 'var(--sm-border-radius, 16px)',
  background: 'var(--sm-surface, #fff)',
  color: 'var(--sm-text-color, #111827)',
  fontFamily: 'var(--sm-font-family)',
  overflow: 'hidden',
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: 'var(--sm-muted-text, #6b7280)',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: 12,
        marginBottom: 3,
      }}
    >
      <span style={{ color: 'var(--sm-muted-text, #6b7280)' }}>{label}</span>
      <span style={{ color: 'var(--sm-text-color, #111827)' }}>{children}</span>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span
      style={{
        fontSize: 12,
        color: 'var(--sm-muted-text, #6b7280)',
        fontStyle: 'italic',
      }}
    >
      {children}
    </span>
  );
}

function formatUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return url;
  }
}

function summarizeUserAgent(ua: string): string {
  // Lightweight UA parsing — extracts browser + OS without a library.
  // Host apps that need detailed parsing can shadow this with their own
  // by passing a custom render prop... actually, we accept a little
  // imperfection here to avoid a dependency.
  let browser = 'Unknown browser';
  let os = 'Unknown OS';

  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';

  return `${browser} on ${os}`;
}

function formatRelative(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
