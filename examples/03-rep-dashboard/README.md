# 03 — Rep Dashboard

Minimal support rep dashboard: inbox with live updates, conversation thread with visitor context sidebar, and a widget configuration editor. Uses both the main React entry and the admin subpath.

## What this example shows

- Creating a `RepClient` with a `getToken` resolver that hits a privileged admin endpoint
- `repClient.register()` + `startHeartbeat()` lifecycle so the rep appears as online
- `SupportInbox` — multi-tab inbox (Waiting / Active / Resolved) with live updates via `support:new`, `support:assigned`, `inbox:update` events
- `RepStatusToggle` — dropdown for online/away/offline with auto heartbeat start/stop
- `ChatThread` — full messaging UI for the selected conversation
- `VisitorContextPanel` — sidebar showing visitor identity, page URL (hostname + path), browser/OS, conversation status
- `WidgetConfigEditor` — 3-tab editor (Appearance / Content / Behavior) for the support widget config

## Architecture notes

- **Uses both SDK entries:** `@scalemule/chat/react` for the main components (`SupportInbox`, `RepStatusToggle`, `ChatThread`) and `@scalemule/chat/react/admin` for the rep-dashboard-only components (`WidgetConfigEditor`, `VisitorContextPanel`). This split keeps customer-facing chat apps from paying for admin dashboard code.
- **`shadcnTheme` preset:** this example assumes the host app uses shadcn/ui. When the host toggles `.dark` class on `<html>`, dark mode works automatically because the preset only reads shadcn CSS variables (it doesn't set them).
- **Cookie auth:** rep dashboards use cookie-gated auth, not publishable API keys. Your `/api/admin/rep-token` endpoint should return a short-lived rep token after verifying the admin session.
- **`ownsChat` semantics:** `RepClient` constructed with only `apiBaseUrl`/`getToken`/`userId` creates and owns its own `ChatClient`. When you `destroy()` it, the underlying WebSocket closes. If you instead pass an existing `chatClient` (via `useChatClient()` from `ChatProvider`), `RepClient` wraps it and `destroy()` leaves it alone — use that pattern when rep dashboards embed in a larger app that already has a `ChatProvider`.

## What's NOT in this example

- Actual API key management for the widget (out of chat SDK scope — see `docs/chat/CHAT_SDK_SCOPE.md`)
- The "Select conversation → claim" flow (built into `SupportInbox` via a claim action that calls `repClient.claimConversation()`)
- App-level routing (this is a single-page dashboard; in production you'd wrap it in your admin router)

## Running this example locally

```bash
cd examples/03-rep-dashboard
npm install
npm run build  # type-checks against the local SDK
```

`npm run build` type-checks only. For a running dashboard, drop this file into a Next.js 15 app at `app/admin/support/page.tsx` (or similar) and provide real `getToken` and `CURRENT_REP_USER_ID` values.

## Files

- `App.tsx` — the full dashboard (~140 lines of React)
- `package.json` — links `@scalemule/chat` via `file:../..` + React peer deps
- `tsconfig.json` — strict type-check config
- `README.md` — this file
