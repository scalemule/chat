/**
 * SupportClient — High-level client for the support chat widget.
 *
 * Handles visitor session lifecycle (create/restore/refresh) and exposes
 * the underlying ChatClient for real-time messaging.
 *
 * Usage:
 * ```ts
 * const support = new SupportClient({ apiKey: 'pb_...', apiBaseUrl: 'https://api.scalemule.com' });
 * await support.initVisitorSession({ name: 'Jane' });
 * const conversation = await support.startConversation('Hi, I need help!', { page_url: location.href });
 * support.chat.on('message', (msg) => console.log(msg));
 * ```
 */
import { ChatClient } from './core/ChatClient';
import type { Attachment, ChatConfig } from './types';

const STORAGE_PREFIX = 'sm_support_';

export interface SupportConversation {
  id: string;
  conversation_id: string;
  status: string;
  visitor_name?: string;
  visitor_email?: string;
  visitor_page_url?: string;
  assigned_rep_id?: string;
  assigned_rep_name?: string;
  last_message_preview?: string;
  last_message_at?: string;
  created_at: string;
  existing?: boolean;
}

export interface SupportWidgetPreChatField {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

export interface SupportWidgetConfig {
  title: string;
  subtitle: string;
  primary_color: string;
  position: 'left' | 'right';
  pre_chat_fields: SupportWidgetPreChatField[];
  business_hours: Record<string, unknown>;
  realtime_enabled: boolean;
  welcome_message: string;
  offline_message: string;
  reps_online: boolean;
  online_count: number;
}

export interface SupportClientConfig {
  apiKey: string;
  apiBaseUrl?: string;
  wsUrl?: string;
}

interface StoredVisitorState {
  anonymous_id: string;
  refresh_token: string;
  user_id: string;
}

export class SupportClient {
  private chatClient: ChatClient | null = null;
  private apiKey: string;
  private apiBaseUrl: string;
  private wsUrl?: string;
  private storageKey: string;
  private anonymousId: string;
  private refreshToken: string | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private userId: string | null = null;
  private visitorName: string | undefined;
  private visitorEmail: string | undefined;

  constructor(config: SupportClientConfig) {
    this.apiKey = config.apiKey;
    this.apiBaseUrl = config.apiBaseUrl ?? 'https://api.scalemule.com';
    this.wsUrl = config.wsUrl;
    // Key storage by first 8 chars of API key to avoid cross-app collisions
    this.storageKey = STORAGE_PREFIX + config.apiKey.substring(0, 8);

    // Restore or generate anonymous_id
    const stored = this.loadState();
    if (stored) {
      this.anonymousId = stored.anonymous_id;
      this.refreshToken = stored.refresh_token;
      this.userId = stored.user_id;
    } else {
      this.anonymousId = crypto.randomUUID();
    }
  }

  /** Create or restore a visitor session. Call before startConversation(). */
  async initVisitorSession(info?: { name?: string; email?: string }): Promise<void> {
    this.visitorName = info?.name;
    this.visitorEmail = info?.email;

    // Try refresh first if we have a stored refresh token
    if (this.refreshToken) {
      try {
        await this.refreshAccessToken();
        this.initChatClient();
        return;
      } catch {
        // Refresh failed — fall through to create new session
        this.refreshToken = null;
      }
    }

    // Create new visitor session
    const resp = await fetch(`${this.apiBaseUrl}/v1/auth/visitor-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({
        anonymous_id: this.anonymousId,
        name: info?.name,
        email: info?.email,
        page_url: typeof location !== 'undefined' ? location.href : undefined,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Visitor session failed: ${resp.status} ${body}`);
    }

    const result = await resp.json();
    const data = result.data;

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.userId = data.user_id;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    this.saveState();
    this.initChatClient();
  }

  /** Start a new support conversation with the first message. */
  async startConversation(
    message: string,
    meta?: {
      page_url?: string;
      attachments?: Attachment[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<SupportConversation> {
    if (!this.accessToken) {
      throw new Error('Call initVisitorSession() first');
    }

    const resp = await fetch(`${this.apiBaseUrl}/v1/chat/support/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        message,
        name: this.visitorName,
        email: this.visitorEmail,
        page_url: meta?.page_url ?? (typeof location !== 'undefined' ? location.href : undefined),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        attachments: meta?.attachments,
        metadata: meta?.metadata,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Create support conversation failed: ${resp.status} ${body}`);
    }

    const result = await resp.json();
    const conversation = result.data as SupportConversation;

    // Store conversation type so ChatClient uses the correct channel prefix
    if (this.chatClient) {
      (this.chatClient as any).conversationTypes?.set(conversation.conversation_id, 'support');
    }

    return conversation;
  }

  /** Get the visitor's active/waiting support conversation, if any. */
  async getActiveConversation(): Promise<SupportConversation | null> {
    if (!this.accessToken) return null;

    const resp = await fetch(`${this.apiBaseUrl}/v1/chat/support/conversations/mine`, {
      headers: {
        'x-api-key': this.apiKey,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!resp.ok) return null;

    const result = await resp.json();
    const conversations = result.data as SupportConversation[];

    // Find first active or waiting conversation
    const active = conversations.find((c) => c.status === 'active' || c.status === 'waiting');
    if (active && this.chatClient) {
      (this.chatClient as any).conversationTypes?.set(active.conversation_id, 'support');
    }
    return active ?? null;
  }

  /** Fetch widget configuration and live support availability. */
  async getWidgetConfig(): Promise<SupportWidgetConfig> {
    const resp = await fetch(`${this.apiBaseUrl}/v1/chat/support/widget/config`, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Get widget config failed: ${resp.status} ${body}`);
    }

    const result = await resp.json();
    return result.data as SupportWidgetConfig;
  }

  /** Get the underlying ChatClient for messaging, events, typing indicators, etc. */
  get chat(): ChatClient {
    if (!this.chatClient) {
      throw new Error('Call initVisitorSession() first');
    }
    return this.chatClient;
  }

  /** Whether a visitor session has been initialized. */
  get isInitialized(): boolean {
    return this.chatClient !== null;
  }

  connect(): void {
    this.chat.connect();
  }

  disconnect(): void {
    this.chat.disconnect();
  }

  /** The visitor's user ID (available after initVisitorSession). */
  get visitorUserId(): string | null {
    return this.userId;
  }

  /** Clean up all resources. */
  destroy(): void {
    this.chatClient?.destroy();
    this.chatClient = null;
  }

  // ============ Private ============

  private initChatClient(): void {
    if (this.chatClient) {
      this.chatClient.destroy();
    }

    const config: ChatConfig = {
      apiKey: this.apiKey,
      apiBaseUrl: this.apiBaseUrl,
      wsUrl: this.wsUrl,
      // Proactive token refresh: check expiry before each request.
      // HttpTransport and WebSocketTransport call getToken() once per request
      // and do NOT retry on 401/null, so the token must be valid when returned.
      getToken: async () => {
        if (!this.accessToken) return null;
        // Proactive refresh: refresh if less than 60 seconds remaining
        if (Date.now() > this.tokenExpiresAt - 60_000) {
          try {
            await this.refreshAccessToken();
          } catch {
            // If refresh fails, return stale token (may 401, widget will re-init)
          }
        }
        return this.accessToken;
      },
    };

    this.chatClient = new ChatClient(config);
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) throw new Error('No refresh token');

    const resp = await fetch(`${this.apiBaseUrl}/v1/auth/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    });

    if (!resp.ok) {
      throw new Error(`Token refresh failed: ${resp.status}`);
    }

    const result = await resp.json();
    const data = result.data;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  }

  private loadState(): StoredVisitorState | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as StoredVisitorState;
    } catch {
      return null;
    }
  }

  private saveState(): void {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          anonymous_id: this.anonymousId,
          refresh_token: this.refreshToken,
          user_id: this.userId,
        }),
      );
    } catch {
      // localStorage may be unavailable (private browsing, etc.)
    }
  }
}
