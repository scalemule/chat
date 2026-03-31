// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockMessage {
  id: string
  content: string
  message_type: 'text' | 'image' | 'file' | 'system'
  sender_id: string
  sender_type: string
  attachments: Array<Record<string, unknown>>
  reactions: Array<{ emoji: string; count: number; user_ids: string[] }>
  is_edited: boolean
  created_at: string
}

interface MockControllerState {
  conversationId: string
  messages: MockMessage[]
  readStatuses: Array<{ user_id: string; last_read_at?: string }>
  typingUsers: string[]
  members: Array<{ userId: string; status: string }>
  hasMore: boolean
  isLoading: boolean
  error: string | null
}

const buildMessage = (overrides: Partial<MockMessage> = {}): MockMessage => ({
  id: 'msg-1',
  content: 'Hello from mocked controller',
  message_type: 'text',
  sender_id: 'member-2',
  sender_type: 'human',
  attachments: [],
  reactions: [],
  is_edited: false,
  created_at: '2026-03-30T10:00:00.000Z',
  ...overrides,
})

const buildState = (
  conversationId: string,
  overrides: Partial<MockControllerState> = {}
): MockControllerState => ({
  conversationId,
  messages: [buildMessage()],
  readStatuses: [],
  typingUsers: [],
  members: [],
  hasMore: false,
  isLoading: false,
  error: null,
  ...overrides,
})

let mockInitialState: Partial<MockControllerState> = {}

const chatClientInstances: Array<{
  on: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  userId: string
}> = []

const controllerInstances: Array<{
  on: ReturnType<typeof vi.fn>
  init: ReturnType<typeof vi.fn>
  markRead: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  sendMessage: ReturnType<typeof vi.fn>
  sendTyping: ReturnType<typeof vi.fn>
  uploadAttachment: ReturnType<typeof vi.fn>
  addReaction: ReturnType<typeof vi.fn>
  removeReaction: ReturnType<typeof vi.fn>
  emitState: (state?: Partial<MockControllerState>) => void
}> = []

vi.mock('./core/ChatClient', () => ({
  ChatClient: vi.fn().mockImplementation(() => {
    const instance = {
      on: vi.fn(() => () => {}),
      destroy: vi.fn(),
      userId: 'member-1',
    }
    chatClientInstances.push(instance)
    return instance
  }),
}))

vi.mock('./shared/ChatController', () => ({
  ChatController: vi.fn().mockImplementation((_client: unknown, conversationId: string) => {
    let stateHandler: ((state: MockControllerState) => void) | null = null

    const emitState = (state: Partial<MockControllerState> = {}) => {
      stateHandler?.(buildState(conversationId, state))
    }

    const instance = {
      on: vi.fn((event: string, handler: (state: MockControllerState) => void) => {
        if (event === 'state') {
          stateHandler = handler
        }
        return () => {}
      }),
      init: vi.fn(async () => {
        emitState(mockInitialState)
      }),
      markRead: vi.fn(async () => {}),
      destroy: vi.fn(),
      sendMessage: vi.fn(async () => {}),
      sendTyping: vi.fn(),
      addReaction: vi.fn(async () => {}),
      removeReaction: vi.fn(async () => {}),
      uploadAttachment: vi.fn(async (_file: File, onProgress?: (progress: number) => void) => {
        onProgress?.(100)
        return {
          data: {
            file_id: 'file-1',
            file_name: 'clip.mp3',
            file_size: 128,
            mime_type: 'audio/mpeg',
            presigned_url: 'https://storage.scalemule.test/clip.mp3',
          },
          error: null,
        }
      }),
      emitState,
    }

    controllerInstances.push(instance)
    return instance
  }),
}))

describe('scalemule-chat element', () => {
  const flush = async () => {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Promise.resolve()
  }

  beforeEach(() => {
    document.body.innerHTML = ''
    chatClientInstances.length = 0
    controllerInstances.length = 0
    mockInitialState = {}
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('registers the custom element and renders chat state into shadow DOM', async () => {
    await import('./element')

    const element = document.createElement('scalemule-chat')
    element.setAttribute('api-key', 'sm_pb_test')
    element.setAttribute('conversation-id', 'conv-1')
    document.body.appendChild(element)

    await flush()

    const shadow = element.shadowRoot
    const controller = controllerInstances.at(-1)
    expect(shadow).not.toBeNull()
    expect(shadow?.querySelector('.message-content')?.textContent).toContain(
      'Hello from mocked controller'
    )
    expect(controller).toBeDefined()
    expect(controller?.init).toHaveBeenCalledTimes(1)
    expect(controller?.markRead).toHaveBeenCalled()
  })

  it('sends a message through the controller from the composed input UI', async () => {
    await import('./element')

    const element = document.createElement('scalemule-chat')
    element.setAttribute('api-key', 'sm_pb_test')
    element.setAttribute('conversation-id', 'conv-2')
    document.body.appendChild(element)

    await flush()

    const shadow = element.shadowRoot
    const controller = controllerInstances.at(-1)
    const input = shadow?.getElementById('input') as HTMLTextAreaElement | null
    const send = shadow?.getElementById('send') as HTMLButtonElement | null

    expect(input).not.toBeNull()
    expect(send).not.toBeNull()

    if (!input || !send) {
      throw new Error('Expected element input controls to render')
    }

    const initialMarkReadCalls = controller?.markRead.mock.calls.length ?? 0
    input.value = 'Reply from agent'
    send.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await flush()

    expect(controller).toBeDefined()
    expect(controller?.sendMessage).toHaveBeenCalledWith('Reply from agent', [])
    expect((controller?.markRead.mock.calls.length ?? 0) > initialMarkReadCalls).toBe(true)
  })

  it('applies theme-color and can upload an attachment before sending', async () => {
    await import('./element')

    const element = document.createElement('scalemule-chat')
    element.setAttribute('api-key', 'sm_pb_test')
    element.setAttribute('conversation-id', 'conv-3')
    element.setAttribute('theme-color', '#e11d48')
    document.body.appendChild(element)

    await flush()

    const shadow = element.shadowRoot
    const controller = controllerInstances.at(-1)
    const fileInput = shadow?.getElementById('file-input') as HTMLInputElement | null
    const attachChipContainer = shadow?.getElementById('attachments')
    const input = shadow?.getElementById('input') as HTMLTextAreaElement | null
    const send = shadow?.getElementById('send') as HTMLButtonElement | null
    expect(shadow?.innerHTML).toContain('--sm-primary: #e11d48')
    expect(fileInput).not.toBeNull()
    expect(input).not.toBeNull()
    expect(send).not.toBeNull()

    if (!fileInput || !input || !send) {
      throw new Error('Expected attachment-capable input controls to render')
    }

    const file = new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' })
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    })

    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await flush()

    expect(controller?.uploadAttachment).toHaveBeenCalledTimes(1)
    expect(attachChipContainer?.textContent).toContain('clip.mp3')

    input.value = 'Voice note attached'
    send.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    expect(controller?.sendMessage).toHaveBeenCalledWith('Voice note attached', [
      expect.objectContaining({
        file_id: 'file-1',
        mime_type: 'audio/mpeg',
      }),
    ])
  })

  it('renders presence, unread state, and escaped content safely', async () => {
    mockInitialState = {
      messages: [
        buildMessage({
          id: 'msg-1',
          content: 'Older safe message',
          created_at: '2026-03-30T10:00:00.000Z',
        }),
        buildMessage({
          id: 'msg-2',
          content: '<img src=x onerror="alert(1)">',
          created_at: '2026-03-30T10:05:00.000Z',
        }),
      ],
      readStatuses: [{ user_id: 'member-1', last_read_at: '2026-03-30T10:01:00.000Z' }],
      members: [{ userId: 'member-2', status: 'online' }],
    }

    await import('./element')

    const element = document.createElement('scalemule-chat')
    element.setAttribute('api-key', 'sm_pb_test')
    element.setAttribute('conversation-id', 'conv-4')
    document.body.appendChild(element)

    await flush()

    const shadow = element.shadowRoot
    const messageContents = shadow?.querySelectorAll('.message-content')
    const unsafeMessage = messageContents?.item(1) as HTMLElement | null

    expect(shadow?.querySelector('#presence-label')?.textContent).toBe('Online')
    expect(shadow?.querySelector('#status-copy')?.textContent).toBe('1 online')
    expect(shadow?.querySelector('#unread-divider')?.textContent).toContain('New messages')
    expect(unsafeMessage?.innerHTML).toContain('&lt;img')
    expect(unsafeMessage?.querySelector('img')).toBeNull()
  })

  it('escapes pending attachment chip labels and wires reaction actions', async () => {
    mockInitialState = {
      messages: [
        buildMessage({
          id: 'msg-9',
          content: 'React to this',
          reactions: [{ emoji: '👍', count: 1, user_ids: ['member-1'] }],
        }),
      ],
    }

    await import('./element')

    const element = document.createElement('scalemule-chat')
    element.setAttribute('api-key', 'sm_pb_test')
    element.setAttribute('conversation-id', 'conv-5')
    document.body.appendChild(element)

    await flush()

    const shadow = element.shadowRoot
    const controller = controllerInstances.at(-1)
    const fileInput = shadow?.getElementById('file-input') as HTMLInputElement | null
    const attachments = shadow?.getElementById('attachments')
    const reactToggle = shadow?.querySelector(
      '[data-action="toggle-picker"][data-message-id="msg-9"]'
    ) as HTMLButtonElement | null
    const existingBadge = shadow?.querySelector(
      '[data-action="toggle-reaction"][data-message-id="msg-9"][data-emoji="👍"]'
    ) as HTMLButtonElement | null

    expect(fileInput).not.toBeNull()
    expect(reactToggle).not.toBeNull()
    expect(existingBadge).not.toBeNull()

    if (!fileInput || !reactToggle || !existingBadge) {
      throw new Error('Expected reaction and attachment controls to render')
    }

    const file = new File(['audio'], '<b>clip</b>.mp3', { type: 'audio/mpeg' })
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))

    await flush()

    expect(attachments?.textContent).toContain('<b>clip</b>.mp3')
    expect(attachments?.querySelector('b')).toBeNull()

    existingBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(controller?.removeReaction).toHaveBeenCalledWith('msg-9', '👍')

    controller?.emitState({
      messages: [buildMessage({ id: 'msg-9', content: 'React to this', reactions: [] })],
    })
    await flush()

    const freshToggle = shadow?.querySelector(
      '[data-action="toggle-picker"][data-message-id="msg-9"]'
    ) as HTMLButtonElement | null
    expect(freshToggle).not.toBeNull()

    if (!freshToggle) {
      throw new Error('Expected reaction picker toggle to rerender')
    }

    freshToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    const addButton = shadow?.querySelector(
      '[data-action="add-reaction"][data-message-id="msg-9"][data-emoji="👍"]'
    ) as HTMLButtonElement | null
    expect(addButton).not.toBeNull()

    if (!addButton) {
      throw new Error('Expected reaction picker buttons to render')
    }

    addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    expect(controller?.addReaction).toHaveBeenCalledWith('msg-9', '👍')
  })
})
