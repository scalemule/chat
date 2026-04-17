import { statSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST_DIR = resolve(process.cwd(), 'dist');

const budgets = [
  {
    // Bumped 75K -> 78K for 0.0.57 self-status (ChatClient.setStatus +
    // seeded localStorage-backed self-status pulls the shared safeStorage
    // helper into every bundle that includes ChatClient).
    file: 'support-widget.global.js',
    limit: 78_000,
    label: 'Widget IIFE',
  },
  {
    // Same bump as the widget: ChatClient now seeds self-status from
    // storage on construction.
    file: 'chat.embed.global.js',
    limit: 28_000,
    label: 'Embed IIFE',
  },
  {
    file: 'chat.umd.global.js',
    limit: 50_000,
    label: 'UMD bundle',
  },
  {
    file: 'element.js',
    limit: 25_000,
    label: 'Element ESM',
  },
  {
    file: 'react.js',
    // Bumped 160K -> 170K to accommodate the SnippetCard component (Phase B).
    // The snippet renderer adds ~5KB but it's a new feature that replaces what
    // would otherwise be host-app duplication. Monitor on next major release.
    // Bumped 170K -> 175K for Phase A of the rich-editor port: adds the
    // HTML allowlist sanitizer (sanitize.ts ~3KB) used by ChatMessageItem to
    // render content_format="html" messages via dangerouslySetInnerHTML.
    // Bumped 175K -> 180K for 0.0.41 message grouping (isGrouped wiring in
    // ChatMessageList + ChatMessageItem chrome-suppression branches; ~300
    // bytes net), with headroom for the upcoming 0.0.42-0.0.45 polish work.
    // Bumped 180K -> 200K for Section 4 (conversation/channel sidebar polish
    // — 0.0.46 display resolver + 0.0.47-0.0.52 coming in this track adds
    // NewConversationModal, ChannelEditModal, grouping, mention/call
    // indicators, invitations).
    // Bumped 200K -> 225K for 0.0.50 NewConversationModal (~17KB —
    // multi-select picker, debounced search, focus trap). Remaining
    // Section 4 features (channel edit/invitations modals) land under
    // the same ceiling.
    // Bumped 225K -> 240K for 0.0.52 channel invitations
    // (ChannelInvitationsModal + useChannelInvitations hook + 4 new
    // ChatClient methods). Section 4 ceiling — no further bumps planned
    // before a 0.1.0 audit.
    // Bumped 240K -> 245K for 0.0.57 self-status — ChatClient.setStatus
    // + getStatus + storage-seeded selfStatus brings AvatarStatusMenu +
    // useMyStatus + the safeStorage path into the core bundle.
    // Bumped 245K -> 250K for 0.0.60 CallTriggerGroup (SVG icons) +
    // enhanced ActiveCallBanner (elapsed time hook + pulsing dot).
    // Bumped 250K -> 256K for 0.0.61 — new shared <Avatar> component
    // + avatarInitials helpers. The refactor removes ~20 lines of
    // duplicated inline avatar styles from ChatMessageItem, but the
    // new component (two render paths + onError swap + deterministic
    // palette hash) still nets ~1.2 KB growth in react.js.
    limit: 256_000,
    label: 'React ESM',
  },
  {
    // Editor entry — Quill wrapper + toolbar + markdown shortcuts. Quill itself
    // is a peer dep (external) so isn't counted here. Monolithic (splitting
    // disabled for this entry) so a single fixed-file check is sufficient.
    file: 'editor.js',
    limit: 90_000,
    label: 'Editor ESM',
  },
  {
    // Video player entry — Gallop itself is a peer dep (external) so isn't
    // counted here. This is the thin adapter (~1KB). Budget padded for
    // poster/presigned-url logic growth.
    file: 'video.js',
    limit: 5_000,
    label: 'Video ESM',
  },
  {
    // Embeds entry — opt-in rich-link embeds (YouTube + future providers).
    // Code-split so react.js stays clean for hosts that don't render embeds.
    // Initial size ~4KB (YouTube card + oEmbed cache + extractYouTubeIds).
    // Budget headroom set so additional providers (Twitter, Loom) can land
    // without an immediate budget bump.
    file: 'embeds.js',
    limit: 8_000,
    label: 'Embeds ESM',
  },
  {
    // Search entry — opt-in search UX. 0.0.53 shipped history dropdown,
    // excerpt renderer, and the pure sanitizer. 0.0.54 adds the global
    // search hook + results panel — raises the entry from ~9KB to
    // ~27KB, so the budget moves from 20K to 34K with headroom.
    file: 'search.js',
    limit: 34_000,
    label: 'Search ESM',
  },
  {
    // Profile entry — opt-in profile UX. 0.0.62 ships <Avatar>
    // (re-exported), <UserProfileCard>, <ProfilePanel>, and the
    // locale/time-zone helpers (~22K). Bumped 25K -> 40K for 0.0.63
    // <EditProfileModal> (~14K: form state, focus trap, accessible
    // dialog wiring, inline styling for read-only email + language +
    // timezone selects). Next feature in this entry should fit under
    // the current ceiling without a further bump.
    file: 'profile.js',
    limit: 40_000,
    label: 'Profile ESM',
  },
];

let hasFailure = false;

console.log('Checking chat SDK bundle budgets...');

for (const budget of budgets) {
  const fullPath = resolve(DIST_DIR, budget.file);
  let size;

  try {
    size = statSync(fullPath).size;
  } catch (error) {
    hasFailure = true;
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`FAIL ${budget.label}: missing ${budget.file} (${message})`);
    continue;
  }

  const withinBudget = size <= budget.limit;
  const sizeLabel = `${(size / 1024).toFixed(2)} KB`;
  const budgetLabel = `${(budget.limit / 1024).toFixed(2)} KB`;

  if (!withinBudget) {
    hasFailure = true;
  }

  console.log(
    `${withinBudget ? 'PASS' : 'FAIL'} ${budget.label}: ${budget.file} ${sizeLabel} / ${budgetLabel}`,
  );
}

if (hasFailure) {
  console.error('Bundle budget check failed.');
  process.exit(1);
}

console.log('Bundle budgets look good.');
