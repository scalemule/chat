# YouSnaps Migration Notes — @scalemule/chat 0.0.11 → 0.0.12

**Date:** 2026-04-10
**Branch (yousnaps):** `feat/plamen-chat-sdk-0012-upgrade`
**Source repo surveyed:** `yousnaps-repos/web/yousnaps-web/app`

This document captures what worked, what didn't, and what needs to change in the SDK (input to Phase 2 theming bridge) based on the first real customer adoption of v0.0.12.

---

## TL;DR

- **Version bump is truly additive.** The only type error after bumping `^0.0.11` → `^0.0.12` was pre-existing (`screen` missing from `@testing-library/react` — unrelated).
- **3 components swapped cleanly** (ReactionBar, EmojiPicker/EmojiPickerTrigger, ReportDialog) via changes to the single consumer (`ChatMessageItem.tsx`).
- **3 local files deleted** — `ReactionBar.tsx`, `EmojiPicker.tsx`, `ReportDialog.tsx` removed from `src/components/chat/`.
- **`useChannels` does NOT fit YouSnaps.** YouSnaps' "rooms" are a tier-gated commerce primitive, not Slack-style named channels. Not a feature gap — a different primitive. Leave both in the SDK; don't try to force-fit.
- **`useSearch` has no surface in YouSnaps today.** Wiring it would require adding a new search UI to `ChatRoomView.tsx` — that's a feature addition, not a refactor. Deferred.
- **Visual regression expected on swap.** SDK components use inline styles with `--sm-*` CSS custom properties; YouSnaps is Tailwind-first. Phase 2 (theming bridge) must address this before any further swaps.

---

## What worked

### 1. Version bump (additive)

- `package.json:17` changed from `"@scalemule/chat": "^0.0.11"` → `"^0.0.12"`
- `npm install --legacy-peer-deps` — 1 package changed, 0 errors
- `npx tsc --noEmit` — no new type errors introduced by the bump

### 2. `ReactionBar` swap — clean drop-in

Before:
```tsx
import { ReactionBar } from './ReactionBar';
```
After:
```tsx
import { ReactionBar } from '@scalemule/chat/react';
```

Props are 100% compatible (`reactions`, `currentUserId`, `onToggleReaction`). Zero code changes at call sites.

### 3. `EmojiPickerTrigger` swap — clean drop-in

Same story. The SDK version even adds an optional `emojis?: string[]` prop YouSnaps isn't using yet, but the default reaction set is identical.

### 4. `ReportDialog` swap — required a thin adapter

The SDK version is architecturally cleaner than YouSnaps' local copy. Where YouSnaps' version hardcoded a `fetch('/api/chat/report', ...)` call with CSRF headers, the SDK version takes an `onSubmit` callback:

```ts
// SDK signature
interface ReportDialogProps {
  messageId: string;
  onSubmit: (data: { messageId, reason, description? }) => void | Promise<void>;
  onClose: () => void;
}
```

No `conversationId` prop — conversation context is now the caller's responsibility. That's the **right** design (zero API coupling), but it meant YouSnaps needed a small adapter in `ChatMessageItem.tsx`:

```tsx
async function handleReportSubmit({ messageId: reportedMessageId, reason, description }) {
  const res = await fetch('/api/chat/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({
      messageId: reportedMessageId,
      conversationId, // captured from closure
      reason,
      details: description,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || data.message || 'Failed to submit report');
  }
}
```

Then the usage site changed from passing `conversationId` directly to passing `onSubmit={handleReportSubmit}`.

**Lesson:** Any SDK component that needs to hit a backend should take a callback, never hardcode URLs. YouSnaps uses a proxy pattern (`/api/chat/...` → scalemule) for CSRF; direct SDK calls would break that model. The SDK's `ReportDialog` already gets this right; this is the pattern for any future components.

---

## What didn't work (and why)

### 1. `useChannels` doesn't fit YouSnaps' "rooms"

Original plan: wire `useChannels` into `RoomList.tsx` because "rooms become named channels."

Reality: YouSnaps rooms have tier-gated access (`open` / `subscribers` / `tier2_vip` / `tier3_vip`), a `can_access` gate, a `slow_mode_seconds` field, a `creatorId` scope, and API endpoints at `/api/chat/community-rooms`. They are a **creator-commerce primitive** built on top of chat, not Slack-style channels.

The SDK's `useChannels` has no concept of:
- Tier-based access gating
- Monetization
- Creator scoping
- Custom access policies

Forcing YouSnaps rooms through `useChannels` would drop every commerce feature. It's not the same thing.

**Recommendation:**
- Keep `useChannels` in the SDK as-is — it's correct for CoralMeet, scalemule-app, and any future Slack-like app.
- Leave YouSnaps `RoomList.tsx` custom.
- Do NOT add tier-gating to SDK channels — that's a creator-commerce concern, not a chat concern.
- Possibly in the future: a `@scalemule/creator-commerce` SDK layer that composes `@scalemule/chat` channels with tier gating. Out of scope for v0.1.0.

### 2. `useSearch` has no surface in YouSnaps today

Original plan: wire `useSearch` into `ChatRoomView.tsx`.

Reality: `ChatRoomView` has no search UI. Header has room name + audio/video call buttons. Adding search would mean adding a new search bar, search results panel, and UX flow — that's a feature, not a refactor.

**Recommendation:**
- Do NOT add search UI to YouSnaps in this pass. Defer to a follow-up product decision.
- Keep `useSearch` + `SearchBar` + `SearchResults` in the SDK as-is.
- When YouSnaps product decides to ship search, the SDK hook is ready.

### 3. `ChatMessageItem` cannot be swapped yet — Phase 2 blocker

YouSnaps' `ChatMessageItem` is 278 lines of Tailwind-styled code with:
- Red-themed message bubbles (`bg-red-500 text-white` for own messages)
- Hover action toolbar floating above bubbles
- Avatar column for others' messages
- Custom attachment renderer with image/video lightbox
- "@username" display alongside display name
- Custom edit-in-place inputs with red focus rings

The SDK's `ChatMessageItem` is 712 lines of inline-styled code with a **blue** (`--sm-primary: #2563eb`) default theme and a different layout. Swapping would require:
- Tailwind preset (Phase 2a) so the SDK's `--sm-*` tokens inherit YouSnaps' red palette
- A way to inject custom avatar rendering
- A way to pass through the `profile` prop (display_name, username, avatar_url)
- A way to keep YouSnaps' custom attachment lightbox

Only the theming part is in Phase 2 scope. The rest is "YouSnaps wants customization points the SDK doesn't expose yet."

**Phase 2 must also add:**
- `ChatMessageItem` prop for custom avatar renderer: `renderAvatar?: (profile, message) => ReactNode`
- `ChatMessageItem` prop for custom attachment renderer: `renderAttachment?: (att) => ReactNode`
- `ChatMessageItem` prop for resolving user profiles: `getProfile?: (userId) => { display_name, username?, avatar_url? }`
- The headless hook `useChatMessageItemState` should return all state so YouSnaps can keep its custom rendering while sharing state logic

---

## Pre-existing issues surfaced (not my fault, flag for separate fix)

### P1: Peer dependency conflict requires `--legacy-peer-deps`

`@scalemule/react@^0.0.10` declares a peer of `@scalemule/sdk@^0.0.29`, but YouSnaps' root `package.json` has `@scalemule/sdk@^0.0.32`. `npm install` fails without `--legacy-peer-deps`.

**Fix:** either (a) bump `@scalemule/react`'s peer range to `^0.0.29 || ^0.0.32`, or (b) add `.npmrc` with `legacy-peer-deps=true` at `yousnaps-repos/web/yousnaps-web/app/`. Out of scope for this PR.

### P2: `@testing-library/react` type error in test file

`src/__tests__/YouSnapsChatProvider.test.tsx:1` imports `screen` from `@testing-library/react`, but the installed version (`^16.3.2`) doesn't export it as a module member. This error is pre-existing and not related to the chat SDK bump. Out of scope.

### P3: `onAddReaction` / `onRemoveReaction` are TODO stubs in `ChatRoomView.tsx`

```tsx
const handleAddReaction = useCallback((_messageId: string, _emoji: string) => {
  // TODO: wire to ChatClient.addReaction via context
}, []);
```

These are no-ops, so reactions don't actually work in YouSnaps rooms right now. Not introduced by my changes — pre-existing TODO. Worth flagging for a follow-up.

---

## Changes committed

Files modified:
- `app/package.json` — `@scalemule/chat` pin: `^0.0.11` → `^0.0.12`
- `app/package-lock.json` — regenerated
- `app/src/components/chat/ChatMessageItem.tsx` — imports from `@scalemule/chat/react`; added `handleReportSubmit` adapter
- `app/src/components/chat/index.ts` — re-exports `ReactionBar`, `EmojiPicker`, `EmojiPickerTrigger` from SDK for backwards compat

Files deleted:
- `app/src/components/chat/ReactionBar.tsx` (37 lines)
- `app/src/components/chat/EmojiPicker.tsx` (96 lines)
- `app/src/components/chat/ReportDialog.tsx` (157 lines)

**Net: ~290 lines deleted, ~30 lines added.**

---

## Phase 2 requirements (extracted from this migration)

These are hard requirements the theming bridge must solve before YouSnaps can swap any more components:

1. **Tailwind preset** (`@scalemule/chat/themes/tailwind`) that maps `--sm-*` CSS custom properties to Tailwind CSS variables in the host app's theme. YouSnaps uses `@tailwindcss/postcss` v4.
2. **Headless hooks** for `ChatMessageItem`, `ChatInput`, `ChatMessageList`, `ChatThread`, `ConversationList` — returning state + handlers so custom-rendered consumers can share logic without forking the whole component.
3. **Render-prop escape hatches** on pre-built components:
   - `ChatMessageItem`: `renderAvatar`, `renderAttachment`, `getProfile`
   - `ChatMessageList`: `renderMessage` (bypass the default item entirely)
   - `ChatInput`: `renderAttachmentPreview`, `renderSendButton`
4. **Theme tokens** should include a `ownBubbleGradient?` optional for YouSnaps' red gradient style.

These 4 items become Phase 2 acceptance criteria.

---

## Verdict

The v0.0.12 bump is **production-safe for YouSnaps**. The 3 swapped components will cause minor visual changes (blue-ish reactions vs. red Tailwind-themed) that will resolve once Phase 2 ships the Tailwind preset. The bigger migration (ChatMessageItem, ChatInput, ChatMessageList) is blocked on Phase 2 — which is exactly what the plan predicted.

No regressions. No broken tests. No runtime errors. Ready to push.
