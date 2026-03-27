import { ChatClient } from '../core/ChatClient';
import type { ChatConfig } from '../types';

function bootstrap(): void {
  const params = new URLSearchParams(window.location.search);
  const pathParts = window.location.pathname.split('/');
  const conversationId = pathParts[pathParts.length - 1] || undefined;
  const token = params.get('token') ?? undefined;

  let config: ChatConfig;
  try {
    const hashConfig = window.location.hash
      ? JSON.parse(decodeURIComponent(window.location.hash.slice(1)))
      : {};
    config = { ...hashConfig, embedToken: token };
  } catch {
    config = { embedToken: token };
  }

  const client = new ChatClient(config);

  // Bridge messages to parent window via postMessage
  client.on('message', ({ message, conversationId: convId }) => {
    window.parent.postMessage({ type: 'message', payload: { message, conversationId: convId } }, '*');
  });

  client.on('connected', () => {
    window.parent.postMessage({ type: 'connected' }, '*');
  });

  let disconnected = false;

  // Listen for commands from parent
  window.addEventListener('message', (event) => {
    const { method, args } = event.data ?? {};
    switch (method) {
      case 'sendMessage':
        if (conversationId && args?.content) {
          client.sendMessage(conversationId, { content: args.content });
        }
        break;
      case 'disconnect':
        disconnected = true;
        client.disconnect();
        break;
    }
  });

  if (conversationId) {
    // Fetch conversation first to populate channel type routing,
    // then subscribe with the correct prefix for large_room/broadcast.
    client.getConversation(conversationId).then(() => {
      if (disconnected) return;
      client.subscribeToConversation(conversationId);
      client.connect();
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}
