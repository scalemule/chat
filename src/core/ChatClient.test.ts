import { afterEach, describe, expect, it, vi } from 'vitest'

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
