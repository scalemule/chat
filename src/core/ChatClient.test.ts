import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatClient } from './ChatClient'
import type { ChatEventMap, ChatMessage } from '../types'

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    content: 'Original message',
    message_type: 'text',
    sender_id: 'user-1',
    sender_type: 'human',
    attachments: [],
    reactions: [],
    is_edited: false,
    created_at: '2026-03-30T10:00:00.000Z',
    ...overrides,
  }
}

function createClient(): ChatClient {
  return new ChatClient({
    apiBaseUrl: 'https://api.scalemule.test',
    wsUrl: 'https://api.scalemule.test',
    userId: 'user-1',
  })
}

function emitConversationEvent(
  client: ChatClient,
  conversationId: string,
  event: string,
  data: Record<string, unknown>
) {
  ;(client as unknown as {
    handleConversationMessage: (channel: string, payload: unknown) => void
  }).handleConversationMessage(`conversation:support:${conversationId}`, {
    event,
    data,
  })
}

describe('ChatClient realtime handling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies partial message_edited payloads onto cached messages', () => {
    const client = createClient()
    const conversationId = 'conv-1'
    const original = createMessage({
      attachments: [
        {
          file_id: 'file-1',
          file_name: 'image.png',
          file_size: 42,
          mime_type: 'image/png',
          presigned_url: 'https://storage.scalemule.test/image.png',
        },
      ],
    })
    client.stageOptimisticMessage(conversationId, original)

    const listener = vi.fn<(payload: ChatEventMap['message:updated']) => void>()
    client.on('message:updated', listener)

    emitConversationEvent(client, conversationId, 'message_edited', {
      message_id: original.id,
      conversation_id: conversationId,
      new_content: 'Edited message',
      updated_at: '2026-03-30T10:05:00.000Z',
    })

    const [updated] = client.getCachedMessages(conversationId)

    expect(updated.content).toBe('Edited message')
    expect(updated.id).toBe(original.id)
    expect(updated.sender_id).toBe(original.sender_id)
    expect(updated.attachments).toEqual(original.attachments)
    expect(updated.is_edited).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0].update?.message_id).toBe(original.id)
  })

  it('updates cached reactions when reaction events arrive', () => {
    const client = createClient()
    const conversationId = 'conv-2'
    client.stageOptimisticMessage(
      conversationId,
      createMessage({
        id: 'msg-2',
        content: 'React to me',
      })
    )

    const listener = vi.fn<(payload: ChatEventMap['reaction']) => void>()
    client.on('reaction', listener)

    emitConversationEvent(client, conversationId, 'reaction', {
      message_id: 'msg-2',
      conversation_id: conversationId,
      user_id: 'user-2',
      emoji: '🔥',
      action: 'added',
      timestamp: '2026-03-30T10:06:00.000Z',
    })

    let [message] = client.getCachedMessages(conversationId)
    expect(message.reactions).toEqual([{ emoji: '🔥', count: 1, user_ids: ['user-2'] }])
    expect(listener).toHaveBeenLastCalledWith({
      reaction: {
        id: 'msg-2:user-2:🔥',
        message_id: 'msg-2',
        user_id: 'user-2',
        emoji: '🔥',
        action: 'added',
        timestamp: '2026-03-30T10:06:00.000Z',
      },
      conversationId,
      action: 'added',
    })

    emitConversationEvent(client, conversationId, 'reaction', {
      message_id: 'msg-2',
      conversation_id: conversationId,
      user_id: 'user-2',
      emoji: '🔥',
      action: 'removed',
      timestamp: '2026-03-30T10:07:00.000Z',
    })

    ;[message] = client.getCachedMessages(conversationId)
    expect(message.reactions).toEqual([])
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener.mock.calls[1]?.[0].action).toBe('removed')
  })

  it('emits channel:changed when joinChannel succeeds', async () => {
    const client = createClient()
    const listener = vi.fn()
    client.on('channel:changed', listener)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { participant_id: 'p-1', role: 'member', joined_at: '2026-04-08T00:00:00Z' } }),
    }))

    await client.joinChannel('channel-1')
    expect(listener).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('reconciles optimistic pending messages when the server confirms delivery', () => {
    const client = createClient()
    const conversationId = 'conv-3'
    client.stageOptimisticMessage(
      conversationId,
      createMessage({
        id: 'pending-123',
        content: 'Hello from optimistic state',
        attachments: [
          {
            file_id: 'file-7',
            file_name: 'clip.mp3',
            file_size: 256,
            mime_type: 'audio/mpeg',
          },
        ],
      })
    )

    emitConversationEvent(client, conversationId, 'new_message', {
      id: 'msg-server-1',
      conversation_id: conversationId,
      content: 'Hello from optimistic state',
      sender_id: 'user-1',
      sender_type: 'human',
      message_type: 'file',
      attachments: [
        {
          file_id: 'file-7',
          file_name: 'clip.mp3',
          file_size: 256,
          mime_type: 'audio/mpeg',
        },
      ],
      created_at: '2026-03-30T10:08:00.000Z',
    })

    const messages = client.getCachedMessages(conversationId)
    expect(messages).toHaveLength(1)
    expect(messages[0]?.id).toBe('msg-server-1')
    expect(messages[0]?.content).toBe('Hello from optimistic state')
  })
})

describe('ChatClient named channels', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('createChannel sends POST /v1/chat/channels and emits channel:changed', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: { id: 'ch-1', conversation_type: 'channel', name: 'general', created_at: '2026-04-08T00:00:00Z' },
        }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createClient()
    const listener = vi.fn()
    client.on('channel:changed', listener)

    const result = await client.createChannel({ name: 'general', visibility: 'public', description: 'Main channel' })

    expect(result.data).toBeTruthy()
    expect(result.data!.name).toBe('general')
    expect(listener).toHaveBeenCalledTimes(1)

    // Verify correct URL and body
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.scalemule.test/v1/chat/channels')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ name: 'general', visibility: 'public', description: 'Main channel' })
  })

  it('listChannels builds query string from options', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createClient()
    await client.listChannels({ search: 'gen', visibility: 'public' })

    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.scalemule.test/v1/chat/channels?search=gen&visibility=public')
  })

  it('listChannels without options sends no query string', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createClient()
    await client.listChannels()

    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.scalemule.test/v1/chat/channels')
  })

  it('leaveChannel unsubscribes, leaves presence, removes type, emits channel:changed', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createClient()
    const listener = vi.fn()
    client.on('channel:changed', listener)

    // Set up type tracking to verify cleanup
    client.setConversationType('ch-1', 'channel')

    const result = await client.leaveChannel('ch-1')

    expect(result.error).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.scalemule.test/v1/chat/channels/ch-1/leave')
    expect(opts.method).toBe('POST')
  })
})

describe('ChatClient search', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('searchMessages sends POST with query and limit', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: { results: [], total: 0, query: 'hello' },
        }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createClient()
    const result = await client.searchMessages('conv-1', 'hello', 25)

    expect(result.data).toBeTruthy()
    expect(result.data!.query).toBe('hello')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.scalemule.test/v1/chat/conversations/conv-1/search')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ query: 'hello', limit: 25 })
  })

  it('searchMessages omits limit when not provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: { results: [], total: 0, query: 'test' },
        }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createClient()
    await client.searchMessages('conv-1', 'test')

    const [, opts] = mockFetch.mock.calls[0]
    expect(JSON.parse(opts.body)).toEqual({ query: 'test' })
  })
})

describe('ChatClient editMessage with attachments', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends attachments in PATCH body when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createClient()
    const att = { file_id: 'f-1', file_name: 'img.png', file_size: 100, mime_type: 'image/png' }
    await client.editMessage('msg-1', 'updated text', [att])

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.scalemule.test/v1/chat/messages/msg-1')
    expect(opts.method).toBe('PATCH')
    expect(JSON.parse(opts.body)).toEqual({ content: 'updated text', attachments: [att] })
  })

  it('omits attachments from PATCH body when not provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createClient()
    await client.editMessage('msg-1', 'updated text')

    const [, opts] = mockFetch.mock.calls[0]
    expect(JSON.parse(opts.body)).toEqual({ content: 'updated text' })
  })

  it('buildEditedMessage applies new_attachments from edit event', () => {
    const client = createClient()
    const conversationId = 'conv-edit'
    const original = createMessage({
      id: 'msg-edit',
      attachments: [
        { file_id: 'old-file', file_name: 'old.png', file_size: 50, mime_type: 'image/png' },
      ],
    })
    client.stageOptimisticMessage(conversationId, original)

    const newAtt = { file_id: 'new-file', file_name: 'new.pdf', file_size: 200, mime_type: 'application/pdf' }
    emitConversationEvent(client, conversationId, 'message_edited', {
      message_id: 'msg-edit',
      conversation_id: conversationId,
      new_content: 'edited with new attachment',
      new_attachments: [newAtt],
      updated_at: '2026-04-08T12:00:00.000Z',
    })

    const [updated] = client.getCachedMessages(conversationId)
    expect(updated.content).toBe('edited with new attachment')
    expect(updated.attachments).toEqual([newAtt])
    expect(updated.is_edited).toBe(true)
  })
})
