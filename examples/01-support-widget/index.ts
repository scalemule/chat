/**
 * Example 01 — Embeddable support widget on a static HTML page
 *
 * Goal: drop a "Need help?" chat bubble on any marketing site with zero
 * framework. Visitors can start a conversation that's routed to a rep
 * dashboard (see example 03).
 *
 * In production, you would include this as a <script> tag:
 *
 * ```html
 * <script src="https://unpkg.com/@scalemule/chat@^0.0.13/dist/support-widget.global.js"></script>
 * <script>
 *   ScaleMuleSupportWidget.init({
 *     apiKey: 'pb_live_your_public_api_key',
 *     theme: { primary: '#ef4444', borderRadius: 12 },
 *     position: 'right',
 *   });
 * </script>
 * ```
 *
 * This file demonstrates the TypeScript API for programmatic use (e.g.,
 * wiring the widget from a custom framework layer rather than a script tag).
 */

import { SupportClient } from '@scalemule/chat';

async function runExample(): Promise<void> {
  const support = new SupportClient({
    apiKey: 'pb_live_your_public_api_key',
    apiBaseUrl: 'https://api.scalemule.com',
  });

  // Create or restore a visitor session (anonymous by default, or
  // pre-fill with name/email to skip the pre-chat form).
  await support.initVisitorSession({
    name: 'Visitor',
    email: 'visitor@example.com',
  });

  // Start a conversation with an opening message. Subsequent messages
  // stream through the underlying ChatClient.
  // Note: startConversation throws on failure; wrap in try/catch.
  try {
    const conversation = await support.startConversation('Hi, I need help!', {
      page_url: typeof location !== 'undefined' ? location.href : '/',
    });

    const conversationId = conversation.conversation_id;
    console.log('Conversation started:', conversationId);

    // Listen for incoming messages from the rep
    support.chat.on('message', ({ message }) => {
      console.log('New message:', message);
    });

    // Send a follow-up
    const sendResult = await support.chat.sendMessage(conversationId, {
      content: 'Still there?',
    });
    if (sendResult.error) {
      console.error('Send failed:', sendResult.error);
    }
  } catch (err) {
    console.error('Failed to start conversation:', err);
  }
}

// Only runs when executed directly (not during tsc --noEmit)
if (typeof window !== 'undefined' && (window as { __runExample__?: boolean }).__runExample__) {
  void runExample();
}

export { runExample };
