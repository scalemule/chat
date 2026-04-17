/**
 * Opt-in profile UX entry. Code-split from the main `/react` bundle
 * so hosts that don't render a profile panel don't pay the cost.
 *
 * Usage:
 *
 * ```tsx
 * import { ProfilePanel } from '@scalemule/chat/profile';
 * ```
 *
 * All components here depend only on the shared helpers in
 * `src/shared/` (no `ChatContext` subscription). Pure presentational.
 * Network I/O (fetching profiles, uploading avatars, saving edits) is
 * the host's responsibility — wire up through the exposed callbacks.
 */

export { Avatar } from './react-components/Avatar';
export type { AvatarProps } from './react-components/Avatar';

export { UserProfileCard } from './react-components/UserProfileCard';
export type {
  UserProfileCardProps,
  UserProfileCardUser,
  UserProfileCardLabels,
} from './react-components/UserProfileCard';

export { ProfilePanel } from './react-components/ProfilePanel';
export type {
  ProfilePanelProps,
  ProfilePanelLabels,
} from './react-components/ProfilePanel';

export {
  getInitials,
  avatarColorFromKey,
  avatarTextColor,
  DEFAULT_AVATAR_PALETTE,
} from './shared/avatarInitials';

export {
  getLanguageLabel,
  DEFAULT_LANGUAGE_LABELS,
} from './shared/localeLabels';

export {
  formatLocalTime,
  formatGmtOffset,
  getAllTimeZones,
  getTimeZoneOffsetMinutes,
} from './shared/timeZones';
export type { TimeZoneOption } from './shared/timeZones';
