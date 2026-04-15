import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { ChatContext } from '../shared/ChatContext';
import type {
  ChatSearchResult,
  Conversation,
  GlobalSearchResult,
} from '../types';

export interface GlobalSearchOptions {
  /**
   * Full Conversation objects to search. When provided, the annotated
   * `GlobalSearchResult.conversation` field is populated on every row.
   * Either this or `conversationIds` is REQUIRED — the hook does not
   * fetch the conversation list itself.
   */
  conversations?: Conversation[];
  /**
   * Id-only input. Use when the caller has ids but not the full
   * conversation rows (saves a round-trip). Annotated results have
   * `conversationId` only; `conversation` is left undefined.
   */
  conversationIds?: string[];
  /**
   * Maximum concurrent search requests. Default 6. Tune down for
   * gateways with tight per-client rate limits.
   */
  concurrency?: number;
  /** Debounce window before a new query fires the fan-out. Default 300ms. */
  debounceMs?: number;
  /** Pass-through to `client.searchMessages`. Default 20. */
  perConversationLimit?: number;
}

export interface GlobalSearchProgress {
  completed: number;
  total: number;
}

export interface GlobalSearchError {
  conversationId: string;
  message: string;
}

export interface GlobalSearch {
  results: GlobalSearchResult[];
  isLoading: boolean;
  progress: GlobalSearchProgress;
  errors: GlobalSearchError[];
  /**
   * Re-runs the fan-out for the current query. Useful for retrying
   * after a transient network blip without changing the input.
   */
  refetch: () => void;
}

const MISSING_INPUT_ERROR = 'useGlobalSearch requires `conversations` or `conversationIds`';

interface ConversationTarget {
  id: string;
  conversation?: Conversation;
}

function resolveTargets(opts: GlobalSearchOptions): ConversationTarget[] {
  if (opts.conversations && opts.conversations.length > 0) {
    return opts.conversations.map((c) => ({ id: c.id, conversation: c }));
  }
  if (opts.conversationIds && opts.conversationIds.length > 0) {
    return opts.conversationIds.map((id) => ({ id }));
  }
  return [];
}

/**
 * Fan-out chat search across a caller-supplied set of conversations.
 *
 * The hook REQUIRES either `conversations` or `conversationIds` — it
 * will not implicitly call `useConversations()` or fetch the
 * conversation list. This keeps network behavior predictable and lets
 * hosts compose however they want ("sidebar only", "starred only", a
 * paginated crawl of every channel the user has joined — the hook
 * doesn't care).
 *
 * Cancellation is handled via an internal sequence id (not
 * AbortSignal) — fresh queries bump the counter and late-arriving
 * responses from stale queries are dropped. No HTTP-layer changes
 * required.
 */
export function useGlobalSearch(
  query: string,
  opts: GlobalSearchOptions = {},
): GlobalSearch {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useGlobalSearch must be used within a ChatProvider');
  }
  const { client } = ctx;

  const {
    concurrency = 6,
    debounceMs = 300,
    perConversationLimit = 20,
  } = opts;

  const targets = resolveTargets(opts);

  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [errors, setErrors] = useState<GlobalSearchError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<GlobalSearchProgress>({
    completed: 0,
    total: 0,
  });
  const [refetchToken, setRefetchToken] = useState(0);

  const sequenceRef = useRef(0);

  // Snapshot a stable key for the target set so the effect only re-runs
  // when ids actually change (not on every parent re-render).
  const targetIdsKey = targets.map((t) => t.id).join('|');

  const refetch = useCallback(() => {
    setRefetchToken((t) => t + 1);
  }, []);

  useEffect(() => {
    const seq = sequenceRef.current + 1;
    sequenceRef.current = seq;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setErrors([]);
      setProgress({ completed: 0, total: 0 });
      setIsLoading(false);
      return;
    }

    if (!opts.conversations && !opts.conversationIds) {
      // Surface the misuse loudly but don't throw during render — the
      // host may be building state up incrementally. An empty result
      // set + an error entry is the least surprising fallback.
      setResults([]);
      setErrors([{ conversationId: '', message: MISSING_INPUT_ERROR }]);
      setProgress({ completed: 0, total: 0 });
      setIsLoading(false);
      return;
    }

    if (targets.length === 0) {
      setResults([]);
      setErrors([]);
      setProgress({ completed: 0, total: 0 });
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setProgress({ completed: 0, total: targets.length });

    const timer = setTimeout(() => {
      void runFanOut();
    }, debounceMs);

    async function runFanOut(): Promise<void> {
      const accumulated: GlobalSearchResult[] = [];
      const accumulatedErrors: GlobalSearchError[] = [];
      let completed = 0;
      let nextIndex = 0;

      async function worker(): Promise<void> {
        while (!cancelled && sequenceRef.current === seq) {
          const idx = nextIndex++;
          if (idx >= targets.length) return;
          const target = targets[idx];
          const res = await client.searchMessages(
            target.id,
            trimmed,
            perConversationLimit,
          );
          if (cancelled || sequenceRef.current !== seq) return;
          if (res.error) {
            accumulatedErrors.push({
              conversationId: target.id,
              message: res.error.message,
            });
          } else if (res.data) {
            for (const r of res.data.results) {
              accumulated.push(annotate(r, target));
            }
          }
          completed++;
          if (!cancelled && sequenceRef.current === seq) {
            setProgress({ completed, total: targets.length });
          }
        }
      }

      const pool = Array.from(
        { length: Math.min(concurrency, targets.length) },
        () => worker(),
      );
      await Promise.all(pool);

      if (cancelled || sequenceRef.current !== seq) return;

      accumulated.sort((a, b) => {
        const ta = new Date(a.message.created_at).getTime();
        const tb = new Date(b.message.created_at).getTime();
        return tb - ta;
      });

      setResults(accumulated);
      setErrors(accumulatedErrors);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query,
    targetIdsKey,
    concurrency,
    debounceMs,
    perConversationLimit,
    refetchToken,
    client,
  ]);

  return { results, isLoading, progress, errors, refetch };
}

function annotate(
  result: ChatSearchResult,
  target: ConversationTarget,
): GlobalSearchResult {
  return {
    ...result,
    conversationId: target.id,
    conversation: target.conversation,
  };
}
