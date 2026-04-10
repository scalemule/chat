import { ChatClient } from './core/ChatClient';
import { HttpTransport } from './transport/HttpTransport';
import type { ApiResponse } from './types';
import type { SupportWidgetConfig, SupportWidgetPreChatField } from './support';

// ============ Types ============

export interface RepClientConfig {
  /** Wrap an existing ChatClient for WS/messaging. RepClient does NOT own its lifecycle. */
  chatClient?: ChatClient;
  /** Required — base URL for rep HTTP endpoints. */
  apiBaseUrl: string;
  apiKey?: string;
  /** At least one of sessionToken or getToken is required. */
  sessionToken?: string;
  /** At least one of sessionToken or getToken is required. */
  getToken?: () => Promise<string | null>;
  wsUrl?: string;
  userId?: string;
}

export interface SupportRep {
  id: string;
  user_id: string;
  rep_type: string;
  display_name: string;
  avatar_url?: string;
  status: string;
  max_concurrent: number;
  active_count: number;
  created_at: string;
}

export interface RegisterRepOptions {
  display_name: string;
  avatar_url?: string;
  max_concurrent?: number;
}

export interface SupportInboxItem {
  id: string;
  conversation_id: string;
  status: string;
  visitor_name?: string;
  visitor_email?: string;
  visitor_page_url?: string;
  visitor_user_agent?: string;
  assigned_rep_id?: string;
  assigned_rep_name?: string;
  last_message_preview?: string;
  last_message_at?: string;
  created_at: string;
  claimed_at?: string;
  resolved_at?: string;
}

export interface SupportUnreadCount {
  waiting_count: number;
  active_unread_count: number;
}

export interface InboxListOptions {
  status?: 'waiting' | 'active' | 'resolved';
  page?: number;
  per_page?: number;
}

export interface UpdateWidgetConfigOptions {
  title?: string;
  subtitle?: string;
  primary_color?: string;
  position?: 'left' | 'right';
  pre_chat_fields?: SupportWidgetPreChatField[];
  business_hours?: Record<string, unknown>;
  realtime_enabled?: boolean;
  welcome_message?: string;
  offline_message?: string;
}

// ============ RepClient ============

/**
 * Client for support representative operations. Wraps a ChatClient for
 * messaging in claimed conversations and provides rep-specific HTTP methods.
 *
 * NOTE: If wrapping an existing chatClient, the RepClientConfig auth fields
 * must target the same environment (apiBaseUrl, credentials) as the wrapped client.
 */
export class RepClient {
  readonly chat: ChatClient;
  /** True when RepClient created the ChatClient (and owns its lifecycle). */
  readonly ownsChat: boolean;
  private http: HttpTransport;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RepClientConfig) {
    // Validate auth
    if (!config.sessionToken && !config.getToken) {
      throw new Error('RepClient requires sessionToken or getToken for authentication');
    }

    // Validate userId consistency when wrapping an existing ChatClient
    if (config.chatClient && config.chatClient.userId && config.userId &&
        config.chatClient.userId !== config.userId) {
      throw new Error('RepClient userId does not match wrapped chatClient.userId');
    }

    // Build the getToken function for HttpTransport
    const getToken = config.getToken ?? (config.sessionToken
      ? () => Promise.resolve(config.sessionToken!)
      : undefined);

    this.http = new HttpTransport({
      baseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
      getToken,
    });

    if (config.chatClient) {
      this.chat = config.chatClient;
      this.ownsChat = false;
    } else {
      this.chat = new ChatClient({
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl,
        wsUrl: config.wsUrl,
        sessionToken: config.sessionToken,
        getToken: config.getToken,
        userId: config.userId,
      });
      this.ownsChat = true;
    }
  }

  // ============ Rep Lifecycle ============

  async register(options: RegisterRepOptions): Promise<ApiResponse<SupportRep>> {
    return this.http.post<SupportRep>('/v1/chat/support/reps/register', options);
  }

  async listReps(): Promise<ApiResponse<SupportRep[]>> {
    return this.http.get<SupportRep[]>('/v1/chat/support/reps');
  }

  async updateStatus(status: 'online' | 'away' | 'offline'): Promise<ApiResponse<{ status: string }>> {
    return this.http.patch<{ status: string }>('/v1/chat/support/reps/me/status', { status });
  }

  async heartbeat(): Promise<ApiResponse<{ ok: boolean }>> {
    return this.http.post<{ ok: boolean }>('/v1/chat/support/reps/me/heartbeat');
  }

  /** Start periodic heartbeat. Idempotent — clears any existing timer first. */
  startHeartbeat(intervalMs = 30_000): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      void this.heartbeat();
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ============ Conversation Management ============

  /**
   * Claim a support conversation. Uses the support_conversation row ID (not conversation_id).
   * Stamps support routing on the returned conversation_id.
   */
  async claimConversation(supportConversationId: string): Promise<ApiResponse<SupportInboxItem>> {
    const result = await this.http.post<SupportInboxItem>(
      `/v1/chat/support/conversations/${supportConversationId}/claim`,
    );
    if (result.data?.conversation_id) {
      this.chat.setConversationType(result.data.conversation_id, 'support');
    }
    return result;
  }

  /**
   * Update support conversation status. Uses the support_conversation row ID.
   */
  async updateConversationStatus(
    supportConversationId: string,
    status: 'resolved' | 'active',
  ): Promise<ApiResponse<void>> {
    return this.http.patch<void>(
      `/v1/chat/support/conversations/${supportConversationId}/status`,
      { status },
    );
  }

  /**
   * Get support inbox. Stamps support routing on every returned item's conversation_id.
   */
  async getInbox(options?: InboxListOptions): Promise<ApiResponse<SupportInboxItem[]>> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.page) params.set('page', String(options.page));
    if (options?.per_page) params.set('per_page', String(options.per_page));
    const qs = params.toString();

    const result = await this.http.get<SupportInboxItem[]>(
      `/v1/chat/support/inbox${qs ? '?' + qs : ''}`,
    );

    // Stamp support routing for every conversation
    if (result.data) {
      for (const item of result.data) {
        if (item.conversation_id) {
          this.chat.setConversationType(item.conversation_id, 'support');
        }
      }
    }

    return result;
  }

  async getUnreadCount(): Promise<ApiResponse<SupportUnreadCount>> {
    return this.http.get<SupportUnreadCount>('/v1/chat/support/inbox/unread-count');
  }

  // ============ Widget Config ============

  async getWidgetConfig(): Promise<ApiResponse<SupportWidgetConfig>> {
    return this.http.get<SupportWidgetConfig>('/v1/chat/support/widget/config');
  }

  async updateWidgetConfig(
    config: Partial<UpdateWidgetConfigOptions>,
  ): Promise<ApiResponse<SupportWidgetConfig>> {
    return this.http.put<SupportWidgetConfig>('/v1/chat/support/widget/config', config);
  }

  // ============ Cleanup ============

  destroy(): void {
    this.stopHeartbeat();
    if (this.ownsChat) {
      this.chat.destroy();
    }
  }
}
