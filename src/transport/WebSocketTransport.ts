import { EventEmitter } from '../core/EventEmitter';
import type { ConnectionStatus, PresenceMember } from '../types';
import {
  DEFAULT_WS_HEARTBEAT_INTERVAL,
  DEFAULT_WS_RECONNECT_BASE_DELAY,
  DEFAULT_WS_RECONNECT_MAX_DELAY,
  DEFAULT_WS_RECONNECT_MAX_RETRIES,
} from '../constants';

interface WsEventMap {
  status: ConnectionStatus;
  reconnecting: { attempt: number };
  message: { channel: string; data: unknown };
  'presence:state': { channel: string; members: PresenceMember[] };
  'presence:join': { channel: string; user: PresenceMember };
  'presence:leave': { channel: string; userId: string };
  'presence:update': { channel: string; userId: string; status: string; userData?: unknown };
  error: { message: string };
}

export interface WebSocketTransportConfig {
  baseUrl: string;
  wsUrl?: string;
  apiKey?: string;
  getToken?: () => Promise<string | null>;
  reconnect?: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  };
}

export class WebSocketTransport extends EventEmitter<WsEventMap> {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private subscriptions = new Set<string>();
  private presenceChannels = new Map<string, unknown>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private config: WebSocketTransportConfig;
  private maxRetries: number;
  private baseDelay: number;
  private maxDelay: number;
  private ticketUrl: string;
  private wsBaseUrl: string;

  constructor(config: WebSocketTransportConfig) {
    super();
    this.config = config;
    this.maxRetries = config.reconnect?.maxRetries ?? DEFAULT_WS_RECONNECT_MAX_RETRIES;
    this.baseDelay = config.reconnect?.baseDelay ?? DEFAULT_WS_RECONNECT_BASE_DELAY;
    this.maxDelay = config.reconnect?.maxDelay ?? DEFAULT_WS_RECONNECT_MAX_DELAY;

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    this.ticketUrl = `${baseUrl}/v1/realtime/ws/ticket`;
    // Use wsUrl for WebSocket connection if provided, otherwise derive from baseUrl
    const wsBase = config.wsUrl ? config.wsUrl.replace(/\/$/, '') : baseUrl;
    this.wsBaseUrl = wsBase.replace(/^http/, 'ws') + '/v1/realtime/ws';
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  async connect(): Promise<void> {
    if (this.status === 'connected' || this.status === 'connecting') return;
    this.setStatus('connecting');

    try {
      // Step 1: Exchange API key + JWT for a short-lived WS ticket
      const ticket = await this.obtainTicket();
      if (!ticket) {
        this.setStatus('disconnected');
        this.emit('error', { message: 'Failed to obtain WS ticket' });
        return;
      }

      // Step 2: Open WebSocket with ticket
      const wsUrl = `${this.wsBaseUrl}?ticket=${encodeURIComponent(ticket)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempt = 0;
        this.startHeartbeat();
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data as string);
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (this.status !== 'disconnected') {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onclose will fire after onerror
      };
    } catch {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.setStatus('disconnected');
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(channel: string): () => void {
    this.subscriptions.add(channel);
    if (this.status === 'connected') {
      this.send({ type: 'subscribe', channel });
    } else if (this.status === 'disconnected') {
      this.connect();
    }
    return () => this.unsubscribe(channel);
  }

  unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);
    if (this.status === 'connected') {
      this.send({ type: 'unsubscribe', channel });
    }
  }

  publish(channel: string, data: unknown): void {
    if (this.status === 'connected') {
      this.send({ type: 'publish', channel, data });
    }
  }

  joinPresence(channel: string, userData?: unknown): void {
    this.presenceChannels.set(channel, userData);
    if (this.status === 'connected') {
      this.send({ type: 'presence_join', channel, user_data: userData ?? {} });
    }
  }

  leavePresence(channel: string): void {
    this.presenceChannels.delete(channel);
    if (this.status === 'connected') {
      this.send({ type: 'presence_leave', channel });
    }
  }

  private async obtainTicket(): Promise<string | null> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }
    if (this.config.getToken) {
      const token = await this.config.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(this.ticketUrl, {
        method: 'POST',
        headers,
      });
      if (!response.ok) return null;
      const json = await response.json();
      return json.ticket ?? json.data?.ticket ?? null;
    } catch {
      return null;
    }
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleMessage(raw: string): void {
    if (raw === 'pong') return;

    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'auth_success':
          // Already handled by onopen
          break;
        case 'subscribed':
          break;
        case 'message':
          this.emit('message', { channel: msg.channel, data: msg.data });
          break;
        case 'presence_state':
          this.emit('presence:state', { channel: msg.channel, members: msg.members ?? [] });
          break;
        case 'presence_join':
          this.emit('presence:join', { channel: msg.channel, user: msg.user });
          break;
        case 'presence_leave':
          this.emit('presence:leave', { channel: msg.channel, userId: msg.user_id });
          break;
        case 'presence_update':
          this.emit('presence:update', {
            channel: msg.channel,
            userId: msg.user_id,
            status: msg.status,
            userData: msg.user_data,
          });
          break;
        case 'error':
          this.emit('error', { message: msg.message ?? 'Unknown error' });
          break;
        case 'token_expiring':
          // Token about to expire — re-obtain ticket and reconnect
          this.reconnectAttempt = 0;
          this.scheduleReconnect();
          break;
      }
    } catch {
      // Non-JSON message, ignore
    }
  }

  private resubscribeAll(): void {
    for (const channel of this.subscriptions) {
      this.send({ type: 'subscribe', channel });
    }
    for (const [channel, userData] of this.presenceChannels) {
      this.send({ type: 'presence_join', channel, user_data: userData ?? {} });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, DEFAULT_WS_HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.maxRetries) {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('reconnecting');
    this.emit('reconnecting', { attempt: this.reconnectAttempt + 1 });

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempt) + Math.random() * this.baseDelay * 0.3,
      this.maxDelay,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempt++;
      this.connect();
    }, delay);
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit('status', status);
    }
  }
}
