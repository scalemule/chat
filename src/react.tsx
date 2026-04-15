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
  Attachment,
  ChannelListItem,
  ChatConfig,
  ChatMessage,
  ChatSearchResult,
  ConnectionStatus,
  Conversation,
  CreateChannelOptions,
  ApiResponse,
  ListChannelsOptions,
  ReadStatus,
  SendMessageOptions,
  GetMessagesOptions,
  MessagesResponse,
} from './types';

// ============ Context ============

interface ChatContextValue {
  client: ChatClient;
  config: ChatConfig;
}

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Internal-only context export for tests that need to inject a mock
 * client without spinning up the real ChatProvider (which opens a
 * websocket). Not part of the public API surface — the underscore
 * prefix and this comment signal that.
 *
 * @internal
 */
export { ChatContext as __ChatContext };

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

  return <ChatContext.Provider value={{ client, config }}>{children}</ChatContext.Provider>;
}

// ============ Client Access ============

/** Direct access to the ChatClient instance for custom event subscriptions (e.g., support:new). */
export function useChatClient(): ChatClient {
  return useChatContext().client;
}

export function useChatConfig(): ChatConfig {
  return useChatContext().config;
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
  const [readStatuses, setReadStatuses] = useState<ReadStatus[]>([]);
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

      const readStatusResult = await client.getReadStatus(conversationId);
      if (cancelled) return;
      if (readStatusResult.data?.statuses) {
        setReadStatuses(readStatusResult.data.statuses);
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
        setMessages([...client.getCachedMessages(conversationId)]);
      }
    });
  }, [client, conversationId]);

  // Handle message updates
  useEffect(() => {
    if (!conversationId) return;

    return client.on('message:updated', ({ message, conversationId: convId }) => {
      if (convId === conversationId) {
        setMessages([...client.getCachedMessages(conversationId)]);
      }
    });
  }, [client, conversationId]);

  // Handle message deletions
  useEffect(() => {
    if (!conversationId) return;

    return client.on('message:deleted', ({ messageId, conversationId: convId }) => {
      if (convId === conversationId) {
        setMessages([...client.getCachedMessages(conversationId)]);
      }
    });
  }, [client, conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    return client.on('reaction', ({ conversationId: convId }) => {
      if (convId === conversationId) {
        setMessages([...client.getCachedMessages(conversationId)]);
      }
    });
  }, [client, conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    return client.on('read', ({ conversationId: convId, userId, lastReadAt }) => {
      if (convId !== conversationId) return;

      setReadStatuses((prev) => {
        const existingIndex = prev.findIndex((status) => status.user_id === userId);
        if (existingIndex < 0) {
          return [...prev, { user_id: userId, last_read_at: lastReadAt }];
        }

        return prev.map((status) =>
          status.user_id === userId ? { ...status, last_read_at: lastReadAt } : status,
        );
      });
    });
  }, [client, conversationId]);

  const sendMessage = useCallback(
    async (content: string, options?: Partial<SendMessageOptions>) => {
      if (!conversationId) return;
      const result = await client.sendMessage(conversationId, { content, ...options });
      if (result?.error) {
        setError(result.error.message);
      }
      return result;
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

  const editMessage = useCallback(
    async (
      messageId: string,
      content: string,
      attachments?: Attachment[],
      contentFormat?: 'plain' | 'html',
    ) => {
      const result = await client.editMessage(messageId, content, attachments, contentFormat);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    },
    [client],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      const result = await client.deleteMessage(messageId);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    },
    [client],
  );

  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const result = await client.addReaction(messageId, emoji);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    },
    [client],
  );

  const removeReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const result = await client.removeReaction(messageId, emoji);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    },
    [client],
  );

  const uploadAttachment = useCallback(
    async (file: File | Blob, onProgress?: (percent: number) => void, signal?: AbortSignal) => {
      const result = await client.uploadAttachment(file, onProgress, signal);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    },
    [client],
  );

  const refreshAttachmentUrl = useCallback(
    async (messageId: string, fileId: string) => {
      const result = await client.refreshAttachmentUrl(messageId, fileId);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    },
    [client],
  );

  const reportMessage = useCallback(
    async (
      messageId: string,
      reason: 'spam' | 'harassment' | 'hate' | 'violence' | 'other',
      description?: string,
    ) => {
      const result = await client.reportMessage(messageId, reason, description);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    },
    [client],
  );

  const muteConversation = useCallback(
    async (mutedUntil?: string) => {
      if (!conversationId) return;
      const result = await client.muteConversation(conversationId, mutedUntil);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    },
    [client, conversationId],
  );

  const unmuteConversation = useCallback(async () => {
    if (!conversationId) return;
    const result = await client.unmuteConversation(conversationId);
    if (result.error) {
      setError(result.error.message);
    }
    return result;
  }, [client, conversationId]);

  const getReadStatus = useCallback(async () => {
    if (!conversationId) return;
    const result = await client.getReadStatus(conversationId);
    if (result.data?.statuses) {
      setReadStatuses(result.data.statuses);
    } else if (result.error) {
      setError(result.error.message);
    }
    return result;
  }, [client, conversationId]);

  const markRead = useCallback(async () => {
    if (!conversationId) return;
    await client.markRead(conversationId);
    await getReadStatus();
  }, [client, conversationId, getReadStatus]);

  return {
    messages,
    readStatuses,
    isLoading,
    error,
    hasMore,
    sendMessage,
    loadMore,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    uploadAttachment,
    refreshAttachmentUrl,
    reportMessage,
    muteConversation,
    unmuteConversation,
    getReadStatus,
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

export function useConversations(options?: { conversationType?: string; perPage?: number }) {
  const { client } = useChatContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversations = useCallback(async () => {
    const result = await client.listConversations({
      conversation_type: options?.conversationType as Conversation['conversation_type'],
      per_page: options?.perPage,
    });
    if (result.data) {
      setConversations(result.data);
    }
    setIsLoading(false);
  }, [client, options?.conversationType, options?.perPage]);

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

  // Listen for channel:changed events — debounced re-fetch, but only when
  // viewing channels or all conversations (prevents unrelated lists from refetching)
  useEffect(() => {
    const type = options?.conversationType;
    if (type && type !== 'channel') return;
    return client.on('channel:changed', () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        fetchConversations();
      }, 500);
    });
  }, [client, fetchConversations, options?.conversationType]);

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

// ============ useChannels Hook ============

export function useChannels(options?: ListChannelsOptions) {
  const { client } = useChatContext();
  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChannels = useCallback(async () => {
    setIsLoading(true);
    const result = await client.listChannels(options);
    if (result.data) {
      setChannels(result.data);
    }
    setIsLoading(false);
  }, [client, options?.search, options?.visibility]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Refresh when channel membership changes
  useEffect(() => {
    return client.on('channel:changed', () => {
      fetchChannels();
    });
  }, [client, fetchChannels]);

  const createChannel = useCallback(
    async (opts: CreateChannelOptions) => {
      const result = await client.createChannel(opts);
      return result;
    },
    [client],
  );

  const joinChannel = useCallback(
    async (channelId: string) => {
      const result = await client.joinChannel(channelId);
      return result;
    },
    [client],
  );

  const leaveChannel = useCallback(
    async (channelId: string) => {
      const result = await client.leaveChannel(channelId);
      return result;
    },
    [client],
  );

  return { channels, isLoading, refresh: fetchChannels, createChannel, joinChannel, leaveChannel };
}

// ============ useSearch Hook ============

export function useSearch(conversationId?: string) {
  const { client } = useChatContext();
  const [results, setResults] = useState<ChatSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');

  const search = useCallback(
    async (searchQuery: string, limit?: number) => {
      if (!conversationId || !searchQuery.trim()) {
        setResults([]);
        setTotal(0);
        setQuery('');
        return;
      }
      setIsSearching(true);
      setQuery(searchQuery);
      const result = await client.searchMessages(conversationId, searchQuery, limit);
      if (result.data) {
        setResults(result.data.results);
        setTotal(result.data.total);
      }
      setIsSearching(false);
    },
    [client, conversationId],
  );

  const clearSearch = useCallback(() => {
    setResults([]);
    setTotal(0);
    setQuery('');
  }, []);

  return { results, total, query, isSearching, search, clearSearch };
}

// ============ useMentionCounts Hook ============

/**
 * Live overlay of @-mention counts by conversation id.
 *
 * The chat service does not currently emit a distinct mention event, so
 * the hook derives increments client-side by scanning incoming message
 * HTML for `<span class="sm-mention" data-sm-user-id="{currentUserId}">`.
 * `ConversationList` combines this overlay with the server-side hint on
 * `conversation.mention_count` — the overlay resets when the current user
 * reads the conversation (same simplification as `useUnreadCount`).
 *
 * Passing `undefined` for `currentUserId` disables the hook (returns an
 * empty map and installs no listeners) — useful during SSR / auth loads.
 */
export function useMentionCounts(currentUserId?: string): Map<string, number> {
  const { client } = useChatContext();
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map());

  useEffect(() => {
    if (!currentUserId) return;
    // The mention blot emits exactly this attribute on the rendered span.
    // Plain-text messages lack the attribute so this is a safe needle.
    const needle = `data-sm-user-id="${currentUserId}"`;
    return client.on('message', ({ message, conversationId }) => {
      if (message.sender_id === currentUserId) return;
      const html = message.content ?? '';
      if (!html.includes(needle)) return;
      setCounts((prev) => {
        const next = new Map(prev);
        next.set(conversationId, (next.get(conversationId) ?? 0) + 1);
        return next;
      });
    });
  }, [client, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    return client.on('read', ({ userId, conversationId }) => {
      if (userId !== currentUserId) return;
      setCounts((prev) => {
        if (!prev.has(conversationId)) return prev;
        const next = new Map(prev);
        next.delete(conversationId);
        return next;
      });
    });
  }, [client, currentUserId]);

  return counts;
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

// Call components (CallOverlay, CallControls, CallButton) have moved to
// @scalemule/conference. Chat SDK retains thin integration components only:
// ActiveCallBanner, CallTriggerButton, CallSystemMessage.
export {
  ActiveCallBanner,
  ActiveCallDot,
  CallTriggerButton,
  CallSystemMessage,
  ChatInput,
  ChatMessageItem,
  ChatMessageList,
  ChatThread,
  ChannelBrowser,
  ChannelEditModal,
  ChannelHeader,
  ChannelList,
  ConversationList,
  NewConversationModal,
  EmojiPicker,
  EmojiPickerTrigger,
  ReactionBar,
  RepStatusToggle,
  ReportDialog,
  SearchBar,
  SearchResults,
  SupportInbox,
  TypingIndicator,
} from './react-components';
export type { UserProfile } from './react-components';

// Note: Admin-only components (WidgetConfigEditor, VisitorContextPanel) are
// intentionally NOT exported from the main @scalemule/chat/react entry —
// they are shipped separately via @scalemule/chat/react/admin to keep the
// bundle lean for customer-facing chat apps. See src/react-admin.ts.

// Re-export core types
export { ChatClient } from './core/ChatClient';
export { uploadSnippet, MAX_SNIPPET_SIZE_BYTES, SNIPPET_PREVIEW_LENGTH } from './shared/snippet';
export type { UploadSnippetResult, SnippetUploadFn } from './shared/snippet';
export type {
  ChannelListItem,
  ChatConfig,
  ChatMessage,
  ChatSearchResult,
  ChatSearchResponse,
  ConnectionStatus,
  CreateChannelOptions,
  Conversation,
  ApiResponse,
  ListChannelsOptions,
  SendMessageOptions,
  GetMessagesOptions,
  GetMessagesAroundOptions,
  MessagesResponse,
  MessagesAroundResponse,
  ReadStatus,
  ReactionSummary,
  UnreadTotalResponse,
  ListConversationsOptions,
} from './types';
export type { ChatTheme } from './react-components';
