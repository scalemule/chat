import { ChatClient } from './core/ChatClient';
import { CHAT_VERSION } from './version';
import type { ChatConfig } from './types';

export const ScaleMuleChat = {
  create(config: ChatConfig): ChatClient {
    return new ChatClient(config);
  },

  version: CHAT_VERSION,
};

export type { ChatConfig };
