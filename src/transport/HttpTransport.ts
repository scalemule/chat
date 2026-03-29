import type { ApiResponse, ApiError } from '../types';
import { DEFAULT_REQUEST_TIMEOUT } from '../constants';

export interface HttpTransportConfig {
  baseUrl: string;
  apiKey?: string;
  getToken?: () => Promise<string | null>;
  timeout?: number;
}

export class HttpTransport {
  private baseUrl: string;
  private apiKey?: string;
  private getToken?: () => Promise<string | null>;
  private timeout: number;

  constructor(config: HttpTransportConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.getToken = config.getToken;
    this.timeout = config.timeout ?? DEFAULT_REQUEST_TIMEOUT;
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body);
  }

  async del<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 204) {
        return { data: null, error: null };
      }

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const error: ApiError = {
          code: json?.error?.code ?? json?.code ?? 'unknown',
          message: json?.error?.message ?? json?.message ?? response.statusText,
          status: response.status,
          details: json?.error?.details ?? json?.details,
        };
        return { data: null, error };
      }

      // Unwrap ScaleMule API response envelope
      const data = json?.data !== undefined ? json.data : json;
      return { data: data as T, error: null };
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : 'Network error';
      return {
        data: null,
        error: { code: 'network_error', message, status: 0 },
      };
    }
  }
}
