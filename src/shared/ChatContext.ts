import { createContext } from 'react';

import type { ChatClient } from '../core/ChatClient';
import type { ChatConfig } from '../types';

export interface ChatContextValue {
  client: ChatClient;
  config: ChatConfig;
}

/**
 * Chat context object. Defined in a standalone module so secondary
 * entries (e.g. `@scalemule/chat/search`) can consume the context
 * without dragging the full `react.tsx` module (ChatClient, provider,
 * every hook) into their bundle.
 *
 * The public `ChatProvider` in `react.tsx` uses this same context, so
 * any consumer that sees the provider also sees this value.
 *
 * @internal — exported for secondary entries and tests only.
 */
export const ChatContext = createContext<ChatContextValue | null>(null);
