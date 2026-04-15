import type { Conversation, Participant } from '../types';

export interface ParticipantProfile {
  display_name: string;
}

/**
 * Resolves the list of participants excluding the current user, in the
 * order they appear on the conversation. `profiles` is a best-effort lookup
 * — missing entries fall back to a short id prefix so we never render an
 * empty row.
 */
export function otherParticipantNames(
  conversation: Conversation,
  currentUserId: string | undefined,
  profiles: Map<string, ParticipantProfile> | undefined,
): string[] {
  const participants = conversation.participants ?? [];
  const others = currentUserId
    ? participants.filter((p) => p.user_id !== currentUserId)
    : participants.slice();
  return others.map((p) => resolveName(p, profiles));
}

function resolveName(
  p: Participant,
  profiles: Map<string, ParticipantProfile> | undefined,
): string {
  const profile = profiles?.get(p.user_id);
  if (profile?.display_name) return profile.display_name;
  // Fall back to a short id tag so the row never renders "undefined".
  return p.user_id ? p.user_id.slice(0, 8) : 'User';
}

/**
 * Default formatter for a group chat display name when the conversation
 * has no explicit `name`. Shows up to 2 names and collapses the rest into
 * "and N others". The current user is filtered out before counting.
 */
export function buildDefaultGroupName(
  participantNames: string[],
): string {
  if (participantNames.length === 0) return 'Group';
  if (participantNames.length === 1) return participantNames[0];
  if (participantNames.length === 2)
    return `${participantNames[0]}, ${participantNames[1]}`;
  const overflow = participantNames.length - 2;
  return `${participantNames[0]}, ${participantNames[1]}, and ${overflow} ${
    overflow === 1 ? 'other' : 'others'
  }`;
}

export interface ResolveDisplayNameOptions {
  currentUserId?: string;
  profiles?: Map<string, ParticipantProfile>;
  selfLabel?: string;
  formatGroupName?: (
    participantNames: string[],
    currentUserId: string | undefined,
  ) => string;
}

/**
 * Canonical display-name resolver for `ConversationList` rows. Handles:
 *
 *   - 1:1 DM with self → "<your name> (selfLabel)"
 *   - 1:1 DM with another user → profile display name (or counterparty id)
 *   - Named group / channel → conversation.name verbatim
 *   - Unnamed group → buildDefaultGroupName(otherParticipantNames)
 *
 * Pure — no React, no DOM. Safe to call from SSR contexts.
 */
export function resolveConversationDisplayName(
  conversation: Conversation,
  options: ResolveDisplayNameOptions = {},
): string {
  const {
    currentUserId,
    profiles,
    selfLabel = '(you)',
    formatGroupName,
  } = options;

  // Named conversations (channels, named groups) win.
  if (conversation.name && conversation.conversation_type !== 'direct') {
    return conversation.name;
  }

  const participants = conversation.participants ?? [];

  // Self-DM — DM where every participant is the current user, or where the
  // only other participant resolves to the same id. Check both shapes to
  // survive either backend convention.
  if (
    conversation.conversation_type === 'direct' &&
    currentUserId &&
    participants.length > 0 &&
    participants.every((p) => p.user_id === currentUserId)
  ) {
    const selfName =
      profiles?.get(currentUserId)?.display_name ?? 'You';
    return `${selfName} ${selfLabel}`;
  }

  if (conversation.conversation_type === 'direct') {
    const other = participants.find((p) => p.user_id !== currentUserId);
    if (other) return resolveName(other, profiles);
    if (conversation.counterparty_user_id) {
      const counterpartyProfile = profiles?.get(
        conversation.counterparty_user_id,
      );
      if (counterpartyProfile?.display_name)
        return counterpartyProfile.display_name;
      // Some backends stash the counterparty display name in
      // `conversation.name` for DMs — prefer it over a truncated id so
      // the row stays human-readable without a populated profiles map.
      if (conversation.name) return conversation.name;
      return conversation.counterparty_user_id.slice(0, 8);
    }
    return conversation.name ?? 'Direct message';
  }

  // Unnamed group / channel / ephemeral — build from participants.
  const others = otherParticipantNames(conversation, currentUserId, profiles);
  if (formatGroupName) {
    return formatGroupName(others, currentUserId);
  }
  return buildDefaultGroupName(others);
}
