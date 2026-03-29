import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { ChatClient } from './core/ChatClient';
import type {
  ChatConfig,
  ChatMessage,
  ConnectionStatus,
  Conversation,
  ApiResponse,
  SendMessageOptions,
  GetMessagesOptions,
  MessagesResponse,
} from './types';

// ============ Context ============

interface ChatContextValue {
  client: ChatClient;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within a ChatProvider');
  return ctx;
}

// ============ Provider ============

interface ChatProviderProps {
  config: ChatConfig;
  children: ReactNode;
}

export function ChatProvider({ config, children }: ChatProviderProps): React.JSX.Element {
  const [client] = useState(() => new ChatClient(config));

  useEffect(() => {
    return () => {
      client.destroy();
    };
  }, [client]);

  return <ChatContext.Provider value={{ client }}>{children}</ChatContext.Provider>;
}

// ============ Client Access ============

/** Direct access to the ChatClient instance for custom event subscriptions (e.g., support:new). */
export function useChatClient(): ChatClient {
  return useChatContext().client;
}

// ============ Hooks ============

export function useConnection(): { status: ConnectionStatus; connect: () => void; disconnect: () => void } {
  const { client } = useChatContext();
  const [status, setStatus] = useState<ConnectionStatus>(client.status);

  useEffect(() => {
    return client.on('connected', () => setStatus('connected'));
  }, [client]);

  useEffect(() => {
    return client.on('disconnected', () => setStatus('disconnected'));
  }, [client]);

  useEffect(() => {
    return client.on('reconnecting', () => setStatus('reconnecting'));
  }, [client]);

  const connect = useCallback(() => client.connect(), [client]);
  const disconnect = useCallback(() => client.disconnect(), [client]);

  return { status, connect, disconnect };
}

export function useChat(conversationId?: string) {
  const { client } = useChatContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Fetch conversation (populates conversationTypes for channel routing),
  // load messages, then subscribe with the correct channel prefix.
  // Uses AbortController-style cancelled flag to prevent stale subscriptions
  // if the component unmounts or conversationId changes during async work.
  useEffect(() => {
    if (!conversationId) return;

    setIsLoading(true);
    setError(null);

    let cancelled = false;
    let unsub: (() => void) | undefined;

    (async () => {
      // Fetch conversation first — this auto-populates conversationTypes
      // so subscribeToConversation uses the correct channel prefix for
      // large_room and broadcast conversations.
      await client.getConversation(conversationId);
      if (cancelled) return;

      const result = await client.getMessages(conversationId);
      if (cancelled) return;

      if (result.data?.messages) {
        setMessages(result.data.messages);
        setHasMore(result.data.has_more ?? false);
      } else if (result.error) {
        setError(result.error.message);
      }
      setIsLoading(false);

      unsub = client.subscribeToConversation(conversationId);
      client.connect();
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [client, conversationId]);

  // Handle realtime messages
  useEffect(() => {
    if (!conversationId) return;

    return client.on('message', ({ message, conversationId: convId }) => {
      if (convId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    });
  }, [client, conversationId]);

  // Handle message updates
  useEffect(() => {
    if (!conversationId) return;

    return client.on('message:updated', ({ message, conversationId: convId }) => {
      if (convId === conversationId) {
        setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
      }
    });
  }, [client, conversationId]);

  // Handle message deletions
  useEffect(() => {
    if (!conversationId) return;

    return client.on('message:deleted', ({ messageId, conversationId: convId }) => {
      if (convId === conversationId) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    });
  }, [client, conversationId]);

  const sendMessage = useCallback(
    async (content: string, options?: Partial<SendMessageOptions>) => {
      if (!conversationId) return;
      return client.sendMessage(conversationId, { content, ...options });
    },
    [client, conversationId],
  );

  const loadMore = useCallback(async () => {
    if (!conversationId || !messages.length) return;
    const oldestId = messages[0]?.id;
    const result = await client.getMessages(conversationId, { before: oldestId });
    if (result.data?.messages) {
      setMessages((prev) => [...result.data!.messages, ...prev]);
      setHasMore(result.data.has_more ?? false);
    }
  }, [client, conversationId, messages]);

  const markRead = useCallback(async () => {
    if (!conversationId) return;
    await client.markRead(conversationId);
  }, [client, conversationId]);

  return {
    messages,
    isLoading,
    error,
    hasMore,
    sendMessage,
    loadMore,
    markRead,
  };
}

export function usePresence(conversationId?: string) {
  const { client } = useChatContext();
  const [members, setMembers] = useState<
    { userId: string; status: string; userData?: unknown }[]
  >([]);

  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;

    // Fetch conversation first to populate conversationTypes,
    // then join presence with the correct channel prefix.
    (async () => {
      await client.getConversation(conversationId);
      if (cancelled) return;
      client.joinPresence(conversationId);
    })();

    const unsubState = client.on('presence:state', ({ conversationId: convId, members: m }) => {
      if (convId === conversationId) {
        setMembers(
          m.map((p) => ({
            userId: p.user_id,
            status: (p as { status?: string }).status ?? 'online',
            userData: p.user_data,
          })),
        );
      }
    });

    const unsubJoin = client.on('presence:join', ({ conversationId: convId, userId, userData }) => {
      if (convId === conversationId) {
        setMembers((prev) => {
          if (prev.some((m) => m.userId === userId)) return prev;
          return [...prev, { userId, status: 'online', userData }];
        });
      }
    });

    const unsubLeave = client.on('presence:leave', ({ conversationId: convId, userId }) => {
      if (convId === conversationId) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      }
    });

    const unsubUpdate = client.on(
      'presence:update',
      ({ conversationId: convId, userId, status, userData }) => {
        if (convId === conversationId) {
          setMembers((prev) =>
            prev.map((m) =>
              m.userId === userId ? { ...m, status, userData: userData ?? m.userData } : m,
            ),
          );
        }
      },
    );

    return () => {
      cancelled = true;
      client.leavePresence(conversationId);
      unsubState();
      unsubJoin();
      unsubLeave();
      unsubUpdate();
    };
  }, [client, conversationId]);

  return { members };
}

export function useTyping(conversationId?: string) {
  const { client } = useChatContext();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!conversationId) return;

    const unsubTyping = client.on('typing', ({ conversationId: convId, userId }) => {
      if (convId !== conversationId) return;
      setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));

      // Auto-clear after 3s
      const existing = typingTimers.current.get(userId);
      if (existing) clearTimeout(existing);
      typingTimers.current.set(
        userId,
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((id) => id !== userId));
          typingTimers.current.delete(userId);
        }, 3000),
      );
    });

    const unsubStop = client.on('typing:stop', ({ conversationId: convId, userId }) => {
      if (convId !== conversationId) return;
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
      const timer = typingTimers.current.get(userId);
      if (timer) {
        clearTimeout(timer);
        typingTimers.current.delete(userId);
      }
    });

    return () => {
      unsubTyping();
      unsubStop();
      for (const timer of typingTimers.current.values()) {
        clearTimeout(timer);
      }
      typingTimers.current.clear();
    };
  }, [client, conversationId]);

  const sendTyping = useCallback(
    (isTyping = true) => {
      if (!conversationId) return;
      client.sendTyping(conversationId, isTyping);
    },
    [client, conversationId],
  );

  return { typingUsers, sendTyping };
}

// ============ useConversations Hook ============

export function useConversations(options?: { conversationType?: string }) {
  const { client } = useChatContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversations = useCallback(async () => {
    const result = await client.listConversations({
      conversation_type: options?.conversationType as Conversation['conversation_type'],
    });
    if (result.data) {
      setConversations(result.data);
    }
    setIsLoading(false);
  }, [client, options?.conversationType]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Listen for inbox:update events — debounced re-fetch
  useEffect(() => {
    return client.on('inbox:update', () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        fetchConversations();
      }, 500);
    });
  }, [client, fetchConversations]);

  // Listen for read events — update unread_count locally
  useEffect(() => {
    return client.on('read', ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)),
      );
    });
  }, [client]);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  return { conversations, isLoading, refresh: fetchConversations };
}

// ============ useUnreadCount Hook ============

export function useUnreadCount() {
  const { client } = useChatContext();
  const [totalUnread, setTotalUnread] = useState(0);

  // Fetch initial count from dedicated endpoint
  useEffect(() => {
    (async () => {
      const result = await client.getUnreadTotal();
      if (result.data) {
        setTotalUnread(result.data.unread_messages);
      }
    })();
  }, [client]);

  // Increment on inbox:update (new message in any conversation)
  useEffect(() => {
    return client.on('inbox:update', () => {
      setTotalUnread((prev) => prev + 1);
    });
  }, [client]);

  // Reset for a conversation on read
  useEffect(() => {
    return client.on('read', () => {
      // Re-fetch to get accurate count since we don't know how many were unread
      (async () => {
        const result = await client.getUnreadTotal();
        if (result.data) {
          setTotalUnread(result.data.unread_messages);
        }
      })();
    });
  }, [client]);

  return { totalUnread };
}

// Re-export core types
export { ChatClient } from './core/ChatClient';
export type {
  ChatConfig,
  ChatMessage,
  ConnectionStatus,
  Conversation,
  ApiResponse,
  SendMessageOptions,
  GetMessagesOptions,
  MessagesResponse,
  ReactionSummary,
  UnreadTotalResponse,
  ListConversationsOptions,
} from './types';
