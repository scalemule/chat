// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DEFAULT_WIDGET_CONFIG = {
  title: 'Support',
  subtitle: 'We typically reply within a few minutes',
  primary_color: '#2563eb',
  position: 'right',
  pre_chat_fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email', required: false },
  ],
  business_hours: {},
  realtime_enabled: false,
  welcome_message: 'Hi! How can we help?',
  offline_message: "We're currently offline. Leave a message!",
  reps_online: false,
  online_count: 0,
} as const

let mockWidgetConfig = { ...DEFAULT_WIDGET_CONFIG }
let mockActiveConversation: {
  id: string
  conversation_id: string
  status: string
  created_at: string
} | null = null

interface MockWidgetMessage {
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

interface MockWidgetControllerState {
  conversationId: string
  messages: MockWidgetMessage[]
  readStatuses: Array<{ user_id: string; last_read_at?: string }>
  typingUsers: string[]
  members: Array<{ userId: string; status: string }>
  hasMore: boolean
  isLoading: boolean
  error: string | null
}

const buildWidgetMessage = (overrides: Partial<MockWidgetMessage> = {}): MockWidgetMessage => ({
  id: 'msg-1',
  content: 'Hello from support',
  message_type: 'text',
  sender_id: 'rep-1',
  sender_type: 'human',
  attachments: [],
  reactions: [],
  is_edited: false,
  created_at: '2026-03-30T10:00:00.000Z',
  ...overrides,
})

const buildWidgetControllerState = (
  conversationId: string,
  overrides: Partial<MockWidgetControllerState> = {}
): MockWidgetControllerState => ({
  conversationId,
  messages: [buildWidgetMessage()],
  readStatuses: [],
  typingUsers: [],
  members: [],
  hasMore: false,
  isLoading: false,
  error: null,
  ...overrides,
})

let mockControllerState: Partial<MockWidgetControllerState> = {}
let mockPollingState: Partial<MockWidgetControllerState> = {}

const supportClientInstances: Array<{
  destroy: ReturnType<typeof vi.fn>
  isInitialized: boolean
  visitorUserId: string
  initVisitorSession: ReturnType<typeof vi.fn>
  getWidgetConfig: ReturnType<typeof vi.fn>
  getActiveConversation: ReturnType<typeof vi.fn>
  chat: {
    on: ReturnType<typeof vi.fn>
    emit: (event: string, payload?: unknown) => void
    getMessages: ReturnType<typeof vi.fn>
    getReadStatus: ReturnType<typeof vi.fn>
    markRead: ReturnType<typeof vi.fn>
    addReaction: ReturnType<typeof vi.fn>
    removeReaction: ReturnType<typeof vi.fn>
  }
}> = []

const controllerInstances: Array<{
  on: ReturnType<typeof vi.fn>
  init: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  markRead: ReturnType<typeof vi.fn>
  refreshReadStatus: ReturnType<typeof vi.fn>
  stageOptimisticMessage: ReturnType<typeof vi.fn>
  sendMessage: ReturnType<typeof vi.fn>
  addReaction: ReturnType<typeof vi.fn>
  removeReaction: ReturnType<typeof vi.fn>
  sendTyping: ReturnType<typeof vi.fn>
  emitState: (state?: Partial<MockWidgetControllerState>) => void
}> = []

describe('support widget bootstrap', () => {
  const flush = async () => {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Promise.resolve()
  }

  beforeEach(() => {
    document.body.innerHTML = ''
    supportClientInstances.length = 0
    controllerInstances.length = 0
    mockWidgetConfig = { ...DEFAULT_WIDGET_CONFIG }
    mockActiveConversation = null
    mockControllerState = {}
    mockPollingState = {}
    vi.resetModules()
    vi.clearAllMocks()
    vi.restoreAllMocks()

    const originalAttachShadow = HTMLElement.prototype.attachShadow
    vi.spyOn(HTMLElement.prototype, 'attachShadow').mockImplementation(function (
      this: HTMLElement,
      init: ShadowRootInit
    ) {
      return originalAttachShadow.call(this, { ...init, mode: 'open' })
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })

    vi.doMock('../support', () => ({
      SupportClient: vi.fn().mockImplementation(() => {
        const listeners = new Map<string, Array<(payload?: unknown) => void>>()
        const conversationId = mockActiveConversation?.conversation_id ?? 'conv-live'
        const instance = {
          destroy: vi.fn(),
          isInitialized: false,
          visitorUserId: 'visitor-1',
          initVisitorSession: vi.fn(async () => {
            instance.isInitialized = true
          }),
          getWidgetConfig: vi.fn(async () => ({ ...mockWidgetConfig })),
          getActiveConversation: vi.fn(async () => mockActiveConversation),
          chat: {
            on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
              const next = listeners.get(event) ?? []
              next.push(handler)
              listeners.set(event, next)
              return () => {
                listeners.set(
                  event,
                  (listeners.get(event) ?? []).filter((candidate) => candidate !== handler)
                )
              }
            }),
            emit: (event: string, payload?: unknown) => {
              for (const handler of listeners.get(event) ?? []) {
                handler(payload)
              }
            },
            getMessages: vi.fn(async () => ({
              data: {
                messages: buildWidgetControllerState(conversationId, mockPollingState).messages,
                has_more: false,
              },
              error: null,
            })),
            getReadStatus: vi.fn(async () => ({
              data: {
                statuses: buildWidgetControllerState(conversationId, mockPollingState).readStatuses,
              },
              error: null,
            })),
            markRead: vi.fn(),
            addReaction: vi.fn(),
            removeReaction: vi.fn(),
          },
        }
        supportClientInstances.push(instance)
        return instance
      }),
    }))

    vi.doMock('../shared/ChatController', () => ({
      ChatController: vi.fn().mockImplementation((_chat: unknown, conversationId: string) => {
        let stateHandler: ((state: MockWidgetControllerState) => void) | null = null

        const emitState = (state: Partial<MockWidgetControllerState> = {}) => {
          stateHandler?.(buildWidgetControllerState(conversationId, state))
        }

        const instance = {
          on: vi.fn((event: string, handler: (state: MockWidgetControllerState) => void) => {
            if (event === 'state') {
              stateHandler = handler
            }
            return () => {}
          }),
          init: vi.fn(async () => {
            const state = buildWidgetControllerState(conversationId, mockControllerState)
            stateHandler?.(state)
            return state
          }),
          destroy: vi.fn(),
          markRead: vi.fn(async () => {}),
          refreshReadStatus: vi.fn(async () => buildWidgetControllerState(conversationId, mockControllerState).readStatuses),
          stageOptimisticMessage: vi.fn(),
          sendMessage: vi.fn(async () => {}),
          addReaction: vi.fn(async () => {}),
          removeReaction: vi.fn(async () => {}),
          sendTyping: vi.fn(),
          emitState,
        }

        controllerInstances.push(instance)
        return instance
      }),
    }))
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('boots from the latest script tag and applies script-tag theme overrides', async () => {
    document.body.innerHTML = `
      <script data-api-key="sm_pb_test" data-color="#e11d48" data-position="left"></script>
    `

    await import('./index')

    const host = document.body.querySelector('#scalemule-support-widget') as HTMLElement | null

    expect(host).not.toBeNull()
    expect(host?.style.getPropertyValue('--sm-primary')).toBe('#e11d48')
    expect(host?.style.getPropertyValue('--sm-position')).toBe('left')
    expect(supportClientInstances).toHaveLength(1)
  })

  it('warns and does not mount when no script tag provides data-api-key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await import('./index')

    expect(document.body.querySelector('#scalemule-support-widget')).toBeNull()
    expect(warn).toHaveBeenCalledWith(
      '[ScaleMule] Support widget: missing data-api-key on script tag'
    )
  })

  it('loads remote widget config on open and renders the configured support header and fields', async () => {
    mockWidgetConfig = {
      ...DEFAULT_WIDGET_CONFIG,
      title: 'Concierge',
      subtitle: 'Average reply under five minutes',
      welcome_message: 'Tell us what you need',
      reps_online: true,
      online_count: 2,
      pre_chat_fields: [
        { key: 'name', label: 'Full name', type: 'text', required: true },
        { key: 'company', label: 'Company', type: 'text', required: false },
        { key: 'message', label: 'Message', type: 'textarea', required: true },
      ],
    }

    document.body.innerHTML = `<script data-api-key="sm_pb_test"></script>`

    await import('./index')

    const host = document.body.querySelector('#scalemule-support-widget') as HTMLElement | null
    const shadow = host?.shadowRoot
    const bubble = shadow?.querySelector('.sm-bubble') as HTMLButtonElement | null
    const supportClient = supportClientInstances.at(-1)

    expect(host).not.toBeNull()
    expect(shadow).not.toBeNull()
    expect(bubble).not.toBeNull()
    expect(supportClient).toBeDefined()

    if (!shadow || !bubble || !supportClient) {
      throw new Error('Expected widget controls and client mock to render')
    }

    supportClient.getWidgetConfig = vi.fn(async () => ({ ...mockWidgetConfig }))
    supportClient.initVisitorSession = vi.fn(async () => {
      supportClient.isInitialized = true
    })
    supportClient.getActiveConversation = vi.fn(async () => null)

    bubble.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    expect(supportClient.getWidgetConfig).toHaveBeenCalledTimes(1)
    expect(supportClient.initVisitorSession).toHaveBeenCalledTimes(1)
    expect(shadow.querySelector('.sm-header-title')?.textContent).toBe('Concierge')
    expect(shadow.querySelector('.sm-status-label')?.textContent).toBe('Online')
    expect(shadow.querySelector('.sm-header-subtitle')?.textContent).toBe(
      'Average reply under five minutes'
    )
    expect(shadow.querySelector('[data-prechat-key="name"]')).not.toBeNull()
    expect(shadow.querySelector('[data-prechat-key="company"]')).not.toBeNull()
    expect(shadow.querySelector('[data-prechat-key="message"]')).toBeNull()
    expect(shadow.querySelector('#sm-prechat-message')).not.toBeNull()
  })

  it('applies remote theme config when script tag overrides are absent', async () => {
    mockWidgetConfig = {
      ...DEFAULT_WIDGET_CONFIG,
      primary_color: '#0f766e',
      position: 'left',
    }

    document.body.innerHTML = `<script data-api-key="sm_pb_test"></script>`

    await import('./index')

    const host = document.body.querySelector('#scalemule-support-widget') as HTMLElement | null
    const shadow = host?.shadowRoot
    const bubble = shadow?.querySelector('.sm-bubble') as HTMLButtonElement | null
    const supportClient = supportClientInstances.at(-1)

    expect(host).not.toBeNull()
    expect(bubble).not.toBeNull()
    expect(supportClient).toBeDefined()

    if (!bubble || !supportClient) {
      throw new Error('Expected widget bubble and client mock to render')
    }

    supportClient.getWidgetConfig = vi.fn(async () => ({ ...mockWidgetConfig }))
    supportClient.initVisitorSession = vi.fn(async () => {
      supportClient.isInitialized = true
    })
    supportClient.getActiveConversation = vi.fn(async () => null)

    bubble.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    expect(host?.style.getPropertyValue('--sm-primary')).toBe('#0f766e')
    expect(host?.style.getPropertyValue('--sm-position')).toBe('left')
  })

  it('uses ChatController for realtime conversations and renders unread plus reaction controls', async () => {
    mockWidgetConfig = {
      ...DEFAULT_WIDGET_CONFIG,
      realtime_enabled: true,
      reps_online: true,
    }
    mockActiveConversation = {
      id: 'support-1',
      conversation_id: 'conv-live',
      status: 'active',
      created_at: '2026-03-30T09:59:00.000Z',
    }
    mockControllerState = {
      messages: [
        buildWidgetMessage({
          id: 'msg-1',
          content: 'Earlier reply',
          created_at: '2026-03-30T10:00:00.000Z',
        }),
        buildWidgetMessage({
          id: 'msg-2',
          content: 'Unread reply',
          created_at: '2026-03-30T10:05:00.000Z',
          reactions: [{ emoji: '👍', count: 1, user_ids: ['visitor-1'] }],
        }),
      ],
      readStatuses: [{ user_id: 'visitor-1', last_read_at: '2026-03-30T10:01:00.000Z' }],
      members: [{ userId: 'rep-1', status: 'online' }],
    }

    document.body.innerHTML = `<script data-api-key="sm_pb_test"></script>`

    await import('./index')

    const host = document.body.querySelector('#scalemule-support-widget') as HTMLElement | null
    const shadow = host?.shadowRoot
    const bubble = shadow?.querySelector('.sm-bubble') as HTMLButtonElement | null

    expect(host).not.toBeNull()
    expect(shadow).not.toBeNull()
    expect(bubble).not.toBeNull()

    if (!shadow || !bubble) {
      throw new Error('Expected widget bubble and shadow root to render')
    }

    bubble.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    const controller = controllerInstances.at(-1)
    expect(controller).toBeDefined()

    if (!controller) {
      throw new Error('Expected realtime controller to initialize')
    }

    expect(controller.init).toHaveBeenCalledWith({ realtime: true, presence: true })
    expect(shadow.querySelector('#sm-unread-divider')?.textContent).toContain('New messages')
    expect(shadow.querySelector('.sm-status-label')?.textContent).toBe('Online')

    const activeReaction = shadow.querySelector(
      '[data-action="set-reaction"][data-message-id="msg-2"][data-emoji="👍"][data-reacted="true"]'
    ) as HTMLButtonElement | null
    expect(activeReaction).not.toBeNull()

    if (!activeReaction) {
      throw new Error('Expected active reaction badge to render')
    }

    activeReaction.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(controller.removeReaction).toHaveBeenCalledWith('msg-2', '👍')

    const pickerToggle = shadow.querySelector(
      '[data-action="toggle-picker"][data-message-id="msg-1"]'
    ) as HTMLButtonElement | null
    expect(pickerToggle).not.toBeNull()

    if (!pickerToggle) {
      throw new Error('Expected reaction picker toggle to render')
    }

    pickerToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    const pickerButton = shadow.querySelector(
      '[data-action="set-reaction"][data-message-id="msg-1"][data-emoji="🎉"]'
    ) as HTMLButtonElement | null
    expect(pickerButton).not.toBeNull()

    if (!pickerButton) {
      throw new Error('Expected reaction picker button to render')
    }

    pickerButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    expect(controller.addReaction).toHaveBeenCalledWith('msg-1', '🎉')
  })

  it('falls back to polling when realtime disconnects and shows a fallback notice', async () => {
    mockWidgetConfig = {
      ...DEFAULT_WIDGET_CONFIG,
      realtime_enabled: true,
      reps_online: true,
    }
    mockActiveConversation = {
      id: 'support-2',
      conversation_id: 'conv-fallback',
      status: 'active',
      created_at: '2026-03-30T09:59:00.000Z',
    }
    mockControllerState = {
      messages: [
        buildWidgetMessage({
          id: 'msg-1',
          content: 'Live websocket message',
          created_at: '2026-03-30T10:00:00.000Z',
        }),
      ],
      readStatuses: [{ user_id: 'visitor-1', last_read_at: '2026-03-30T10:00:00.000Z' }],
      members: [{ userId: 'rep-1', status: 'online' }],
    }
    mockPollingState = {
      messages: [
        buildWidgetMessage({
          id: 'msg-poll',
          content: 'Polling fallback message',
          created_at: '2026-03-30T10:06:00.000Z',
        }),
      ],
      readStatuses: [{ user_id: 'visitor-1', last_read_at: '2026-03-30T10:00:00.000Z' }],
    }

    document.body.innerHTML = `<script data-api-key="sm_pb_test"></script>`

    await import('./index')

    const host = document.body.querySelector('#scalemule-support-widget') as HTMLElement | null
    const shadow = host?.shadowRoot
    const bubble = shadow?.querySelector('.sm-bubble') as HTMLButtonElement | null
    const supportClient = supportClientInstances.at(-1)

    expect(shadow).not.toBeNull()
    expect(bubble).not.toBeNull()
    expect(supportClient).toBeDefined()

    if (!shadow || !bubble || !supportClient) {
      throw new Error('Expected widget and support client to render')
    }

    bubble.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    const initialController = controllerInstances.at(-1)
    expect(initialController).toBeDefined()

    supportClient.chat.emit('disconnected')
    await flush()

    expect(initialController?.destroy).toHaveBeenCalled()
    expect(supportClient.chat.getMessages).toHaveBeenCalled()
    expect(supportClient.chat.getReadStatus).toHaveBeenCalled()
    expect(shadow.querySelector('.sm-error')?.textContent).toContain(
      'Realtime connection lost. Falling back to polling.'
    )
    expect(shadow.querySelector('.sm-msg-content')?.textContent).toContain(
      'Polling fallback message'
    )
  })
})
