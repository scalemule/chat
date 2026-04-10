import { describe, expect, it, vi } from 'vitest'

import { ChatController } from './ChatController'
import type { Attachment, ChatClient, ChatMessage, ReadStatus } from '../types'

function createClientStub() {
  const cachedMessages: ChatMessage[] = []
  const readStatuses: ReadStatus[] = []

  return {
    connect: vi.fn(),
    getConversation: vi.fn(async () => ({ data: { id: 'conv-1' }, error: null })),
    getMessages: vi.fn(async () => ({
      data: { messages: cachedMessages, has_more: false },
      error: null,
    })),
    getReadStatus: vi.fn(async () => ({
      data: { statuses: readStatuses },
      error: null,
    })),
    subscribeToConversation: vi.fn(() => () => {}),
    joinPresence: vi.fn(),
    leavePresence: vi.fn(),
    on: vi.fn(() => () => {}),
    sendMessage: vi.fn(async () => ({ data: {}, error: null })),
    editMessage: vi.fn(async () => ({ data: null, error: null })),
    deleteMessage: vi.fn(async () => ({ data: null, error: null })),
    uploadAttachment: vi.fn(async () => ({ data: null, error: null })),
    refreshAttachmentUrl: vi.fn(),
    addReaction: vi.fn(async () => ({ data: null, error: null })),
    removeReaction: vi.fn(async () => ({ data: null, error: null })),
    reportMessage: vi.fn(),
    muteConversation: vi.fn(),
    unmuteConversation: vi.fn(),
    markRead: vi.fn(async () => {}),
    sendTyping: vi.fn(async () => {}),
    getCachedMessages: vi.fn(() => cachedMessages),
    stageOptimisticMessage: vi.fn(),
  } satisfies Partial<ChatClient>
}

describe('ChatController sendMessage', () => {
  it('sends file message_type when text and attachments are both present', async () => {
    const client = createClientStub()
    const controller = new ChatController(client as unknown as ChatClient, 'conv-1')
    const attachments: Attachment[] = [
      {
        file_id: 'file-1',
        file_name: 'clip.mp3',
        file_size: 128,
        mime_type: 'audio/mpeg',
      },
    ]

    await controller.sendMessage('Here is the clip', attachments)

    expect(client.sendMessage).toHaveBeenCalledWith('conv-1', {
      content: 'Here is the clip',
      attachments,
      message_type: 'file',
    })
  })

  it('sends image message_type for image-only attachment messages', async () => {
    const client = createClientStub()
    const controller = new ChatController(client as unknown as ChatClient, 'conv-1')
    const attachments: Attachment[] = [
      {
        file_id: 'file-2',
        file_name: 'image.png',
        file_size: 256,
        mime_type: 'image/png',
      },
    ]

    await controller.sendMessage('', attachments)

    expect(client.sendMessage).toHaveBeenCalledWith('conv-1', {
      content: '',
      attachments,
      message_type: 'image',
    })
  })
})

describe('ChatController editMessage', () => {
  it('delegates to client.editMessage with content and attachments', async () => {
    const client = createClientStub()
    const controller = new ChatController(client as unknown as ChatClient, 'conv-1')
    const atts: Attachment[] = [
      { file_id: 'f-1', file_name: 'doc.pdf', file_size: 100, mime_type: 'application/pdf' },
    ]

    await controller.editMessage('msg-1', 'updated', atts)

    expect(client.editMessage).toHaveBeenCalledWith('msg-1', 'updated', atts)
  })

  it('delegates to client.editMessage without attachments', async () => {
    const client = createClientStub()
    const controller = new ChatController(client as unknown as ChatClient, 'conv-1')

    await controller.editMessage('msg-1', 'just text')

    expect(client.editMessage).toHaveBeenCalledWith('msg-1', 'just text', undefined)
  })
})

describe('ChatController deleteMessage', () => {
  it('delegates to client.deleteMessage', async () => {
    const client = createClientStub()
    const controller = new ChatController(client as unknown as ChatClient, 'conv-1')

    await controller.deleteMessage('msg-1')

    expect(client.deleteMessage).toHaveBeenCalledWith('msg-1')
  })
})
