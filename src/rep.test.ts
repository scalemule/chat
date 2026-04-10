import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from './core/ChatClient';
import { RepClient } from './rep';

const BASE_CONFIG = {
  apiBaseUrl: 'https://api.scalemule.test',
  apiKey: 'pk_test',
  sessionToken: 'tok_test',
  userId: 'user-rep-1',
};

describe('RepClient constructor', () => {
  it('creates its own ChatClient when chatClient not provided', () => {
    const rep = new RepClient(BASE_CONFIG);
    expect(rep.chat).toBeInstanceOf(ChatClient);
    expect(rep.ownsChat).toBe(true);
    rep.destroy();
  });

  it('wraps existing ChatClient when provided', () => {
    const existingChat = new ChatClient({
      apiBaseUrl: 'https://api.scalemule.test',
      userId: 'user-rep-1',
    });
    const rep = new RepClient({ ...BASE_CONFIG, chatClient: existingChat });
    expect(rep.chat).toBe(existingChat);
    expect(rep.ownsChat).toBe(false);
    rep.destroy();
    existingChat.destroy();
  });

  it('throws when neither sessionToken nor getToken provided', () => {
    expect(() => new RepClient({ apiBaseUrl: 'https://api.scalemule.test' })).toThrow(
      'RepClient requires sessionToken or getToken for authentication',
    );
  });

  it('throws when chatClient.userId and config.userId differ', () => {
    const existingChat = new ChatClient({
      apiBaseUrl: 'https://api.scalemule.test',
      userId: 'user-A',
    });
    expect(
      () =>
        new RepClient({
          ...BASE_CONFIG,
          chatClient: existingChat,
          userId: 'user-B',
        }),
    ).toThrow('RepClient userId does not match wrapped chatClient.userId');
    existingChat.destroy();
  });
});

describe('RepClient HTTP methods', () => {
  let rep: RepClient;

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      }),
    );
    rep = new RepClient(BASE_CONFIG);
  });

  afterEach(() => {
    rep.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('register sends POST /v1/chat/support/reps/register', async () => {
    await rep.register({ display_name: 'Alice' });
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.scalemule.test/v1/chat/support/reps/register');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ display_name: 'Alice' });
  });

  it('listReps sends GET /v1/chat/support/reps', async () => {
    await rep.listReps();
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.scalemule.test/v1/chat/support/reps');
    expect(opts.method).toBe('GET');
  });

  it('updateStatus sends PATCH /v1/chat/support/reps/me/status', async () => {
    await rep.updateStatus('online');
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.scalemule.test/v1/chat/support/reps/me/status');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ status: 'online' });
  });

  it('heartbeat sends POST /v1/chat/support/reps/me/heartbeat', async () => {
    await rep.heartbeat();
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.scalemule.test/v1/chat/support/reps/me/heartbeat');
    expect(opts.method).toBe('POST');
  });

  it('claimConversation stamps support routing on returned conversation_id', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: { id: 'sc-1', conversation_id: 'conv-123', status: 'active' },
        }),
    });

    const spy = vi.spyOn(rep.chat, 'setConversationType');
    await rep.claimConversation('sc-1');

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.scalemule.test/v1/chat/support/conversations/sc-1/claim');
    expect(spy).toHaveBeenCalledWith('conv-123', 'support');
  });

  it('getInbox stamps support routing on every item', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            { id: 'sc-1', conversation_id: 'conv-1', status: 'waiting' },
            { id: 'sc-2', conversation_id: 'conv-2', status: 'active' },
          ],
        }),
    });

    const spy = vi.spyOn(rep.chat, 'setConversationType');
    await rep.getInbox({ status: 'waiting', page: 1, per_page: 10 });

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(
      'https://api.scalemule.test/v1/chat/support/inbox?status=waiting&page=1&per_page=10',
    );
    expect(spy).toHaveBeenCalledWith('conv-1', 'support');
    expect(spy).toHaveBeenCalledWith('conv-2', 'support');
  });

  it('updateConversationStatus sends PATCH with status', async () => {
    await rep.updateConversationStatus('sc-1', 'resolved');
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.scalemule.test/v1/chat/support/conversations/sc-1/status');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ status: 'resolved' });
  });

  it('getWidgetConfig sends GET', async () => {
    await rep.getWidgetConfig();
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.scalemule.test/v1/chat/support/widget/config');
  });

  it('updateWidgetConfig sends PUT', async () => {
    await rep.updateWidgetConfig({ title: 'Help', primary_color: '#ff0000' });
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.scalemule.test/v1/chat/support/widget/config');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ title: 'Help', primary_color: '#ff0000' });
  });
});

describe('RepClient heartbeat timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { ok: true } }),
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('startHeartbeat fires at interval', () => {
    const rep = new RepClient(BASE_CONFIG);
    const heartbeatSpy = vi.spyOn(rep, 'heartbeat');
    rep.startHeartbeat(5000);

    expect(heartbeatSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(heartbeatSpy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(heartbeatSpy).toHaveBeenCalledTimes(2);

    rep.destroy();
  });

  it('startHeartbeat is idempotent — calling twice does not leak timers', () => {
    const rep = new RepClient(BASE_CONFIG);
    const heartbeatSpy = vi.spyOn(rep, 'heartbeat');
    rep.startHeartbeat(5000);
    rep.startHeartbeat(5000); // second call should clear the first

    vi.advanceTimersByTime(5000);
    // Should only have 1 call, not 2 (no leaked interval)
    expect(heartbeatSpy).toHaveBeenCalledTimes(1);

    rep.destroy();
  });

  it('stopHeartbeat clears the timer', () => {
    const rep = new RepClient(BASE_CONFIG);
    rep.startHeartbeat(5000);
    rep.stopHeartbeat();

    vi.advanceTimersByTime(10000);
    expect(fetch).not.toHaveBeenCalled();

    rep.destroy();
  });

  it('destroy stops heartbeat and destroys owned chat', () => {
    const rep = new RepClient(BASE_CONFIG);
    const chatDestroySpy = vi.spyOn(rep.chat, 'destroy');
    rep.startHeartbeat(5000);
    rep.destroy();

    vi.advanceTimersByTime(10000);
    expect(fetch).not.toHaveBeenCalled();
    expect(chatDestroySpy).toHaveBeenCalledTimes(1);
  });

  it('destroy does not destroy wrapped chat', () => {
    const existingChat = new ChatClient({
      apiBaseUrl: 'https://api.scalemule.test',
      userId: 'user-rep-1',
    });
    const chatDestroySpy = vi.spyOn(existingChat, 'destroy');
    const rep = new RepClient({ ...BASE_CONFIG, chatClient: existingChat });
    rep.destroy();

    expect(chatDestroySpy).not.toHaveBeenCalled();
    existingChat.destroy();
  });
});
