// ============================================================================
// @scalemule/chat/calls — video conferencing entry point
// ============================================================================
//
// Everything video-call-related lives here in a separate entry point so that
// consumers of @scalemule/chat/react who only need chat functionality don't
// pay the cost of loading the video backend's React components at build or
// runtime. The main /react entry no longer re-exports CallButton, CallControls,
// or CallOverlay.
//
// Usage:
//
//   import { ConferenceClient, CallOverlay } from '@scalemule/chat/calls';
//
//   const conf = new ConferenceClient({ baseUrl, apiKey });
//   const call = await conf.createCall({ conversationId, callType: 'video' });
//   const session = await conf.joinCall(call.id);
//
//   <CallOverlay
//     session={session}
//     onTokenRefresh={() => conf.joinCall(call.id)}
//     onClose={() => conf.leaveCall(call.id)}
//   />
//
// The vendor-specific dependency (currently LiveKit) is bundled inside this
// entry point. It does not leak into the /react entry's module graph.

export { ConferenceClient } from './core/ConferenceClient';
export type {
  Call,
  CallParticipant,
  CallSession,
  ConferenceClientConfig,
  CreateCallOptions,
  ListCallsOptions,
} from './core/ConferenceClient';

export { CallButton } from './react-components/CallButton';
export { CallControls } from './react-components/CallControls';
export { CallOverlay } from './react-components/CallOverlay';
export type { CallOverlayProps } from './react-components/CallOverlay';
