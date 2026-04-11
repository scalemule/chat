import type { ApiResponse } from '../types';
import { HttpTransport, type HttpTransportConfig } from '../transport/HttpTransport';

// ============================================================================
// Vendor-neutral Conference API types
// ============================================================================
//
// These map 1:1 to the `scalemule-conference` HTTP API. Field names
// deliberately avoid naming the underlying video backend — the SDK and the
// conference service together treat "LiveKit" (or any other backend) as an
// implementation detail that consumers should never have to know about.
//
// Backend source of truth:
//   ms/scalemule-conference/src/handlers/calls.rs#CallResponse
//   ms/scalemule-conference/src/handlers/participants.rs#JoinCallResponse

/** A call session as returned by the conference service. */
export interface Call {
  /** Call session UUID. */
  id: string;
  /** Linked conversation, if this call is tied to a chat conversation. */
  conversationId: string | null;
  /** `"audio"` | `"video"` | `"screen_share"`. */
  callType: 'audio' | 'video' | 'screen_share';
  /** Lifecycle state: `"created"` | `"active"` | `"ended"` (and whatever else the backend emits). */
  status: string;
  /** UUID of the participant who created the call. */
  createdBy: string;
  /** Opaque room identifier used to route all participants into the same session. */
  roomId: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

/** A single participant in a call. */
export interface CallParticipant {
  id: string;
  userId: string;
  role: string;
  status: string;
}

/**
 * Credentials and participant info returned when joining a call.
 *
 * `accessToken` is short-lived. Refresh it by calling `joinCall()` again
 * before `tokenExpiresAt`.
 */
export interface CallSession {
  /** The call being joined (same as `Call.id`). */
  callId: string;
  /** WebSocket URL for the real-time media session. */
  serverUrl: string;
  /** Short-lived access token presented to `serverUrl`. */
  accessToken: string;
  /**
   * Absolute timestamp (epoch ms) when `accessToken` expires.
   * The client should refresh before this time.
   */
  tokenExpiresAt: number;
  /** The joining user's participant record. */
  participant: CallParticipant;
}

/** Options for `ConferenceClient.createCall()`. */
export interface CreateCallOptions {
  /** Link the call to an existing chat conversation. */
  conversationId?: string;
  /** Defaults to `"video"`. */
  callType?: 'audio' | 'video' | 'screen_share';
  /** Free-form metadata attached to the call record. */
  metadata?: Record<string, unknown>;
}

/** Options for `ConferenceClient.listCalls()`. */
export interface ListCallsOptions {
  conversationId?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

// ============================================================================
// Wire format (internal — matches the backend JSON exactly)
// ============================================================================

interface CallResponseWire {
  id: string;
  conversation_id: string | null;
  call_type: 'audio' | 'video' | 'screen_share';
  status: string;
  created_by: string;
  room_id: string;
  created_at: string;
}

interface JoinCallResponseWire {
  call_id: string;
  server_url: string;
  access_token: string;
  token_ttl_seconds: number;
  participant: {
    id: string;
    user_id: string;
    role: string;
    status: string;
  };
}

function wireToCall(w: CallResponseWire): Call {
  return {
    id: w.id,
    conversationId: w.conversation_id,
    callType: w.call_type,
    status: w.status,
    createdBy: w.created_by,
    roomId: w.room_id,
    createdAt: w.created_at,
  };
}

function wireToSession(w: JoinCallResponseWire): CallSession {
  return {
    callId: w.call_id,
    serverUrl: w.server_url,
    accessToken: w.access_token,
    tokenExpiresAt: Date.now() + w.token_ttl_seconds * 1000,
    participant: {
      id: w.participant.id,
      userId: w.participant.user_id,
      role: w.participant.role,
      status: w.participant.status,
    },
  };
}

// ============================================================================
// Client
// ============================================================================

/** Configuration for a `ConferenceClient`. */
export type ConferenceClientConfig = HttpTransportConfig;

/**
 * Vendor-neutral client for the ScaleMule conference service.
 *
 * Handles call lifecycle (create/list/get/end) and participation
 * (join/leave). The returned `CallSession` object contains generic
 * `serverUrl` and `accessToken` fields that `CallOverlay` knows how to
 * consume — customer code never names the underlying video backend.
 *
 * @example
 * ```ts
 * const conf = new ConferenceClient({ baseUrl, apiKey });
 * const call = await conf.createCall({ conversationId, callType: 'video' });
 * const session = await conf.joinCall(call.id);
 * // <CallOverlay session={session} onClose={() => conf.leaveCall(call.id)} />
 * ```
 */
export class ConferenceClient {
  private http: HttpTransport;

  constructor(config: ConferenceClientConfig) {
    this.http = new HttpTransport(config);
  }

  /** Create a new call session. */
  async createCall(options: CreateCallOptions = {}): Promise<Call> {
    const body = {
      conversation_id: options.conversationId,
      call_type: options.callType ?? 'video',
      metadata: options.metadata,
    };
    const res: ApiResponse<CallResponseWire> = await this.http.post<CallResponseWire>(
      '/v1/conference/calls',
      body,
    );
    return wireToCall(unwrap(res));
  }

  /** Fetch a single call by id. */
  async getCall(callId: string): Promise<Call> {
    const res = await this.http.get<CallResponseWire>(`/v1/conference/calls/${callId}`);
    return wireToCall(unwrap(res));
  }

  /** List calls (most recent first), optionally filtered by conversation or status. */
  async listCalls(options: ListCallsOptions = {}): Promise<Call[]> {
    const params = new URLSearchParams();
    if (options.conversationId) params.set('conversation_id', options.conversationId);
    if (options.status) params.set('status', options.status);
    if (options.page !== undefined) params.set('page', String(options.page));
    if (options.perPage !== undefined) params.set('per_page', String(options.perPage));
    const query = params.toString();
    const path = query ? `/v1/conference/calls?${query}` : '/v1/conference/calls';
    const res = await this.http.get<{ calls: CallResponseWire[] }>(path);
    const data = unwrap(res);
    return (data.calls ?? []).map(wireToCall);
  }

  /**
   * Join a call. Returns a vendor-neutral session with the credentials
   * the client needs to connect to the media server.
   *
   * Also used to refresh credentials: call `joinCall()` again before the
   * previous `tokenExpiresAt` to get a fresh access token.
   */
  async joinCall(callId: string): Promise<CallSession> {
    const res = await this.http.post<JoinCallResponseWire>(
      `/v1/conference/calls/${callId}/join`,
    );
    return wireToSession(unwrap(res));
  }

  /** Leave a call (idempotent). */
  async leaveCall(callId: string): Promise<void> {
    await this.http.post<unknown>(`/v1/conference/calls/${callId}/leave`);
  }

  /** End a call — only the host can call this. */
  async endCall(callId: string): Promise<void> {
    await this.http.post<unknown>(`/v1/conference/calls/${callId}/end`);
  }
}

function unwrap<T>(res: ApiResponse<T>): T {
  if (res.error || res.data === null) {
    const msg = res.error?.message ?? 'Conference API request failed';
    throw new Error(msg);
  }
  return res.data;
}
