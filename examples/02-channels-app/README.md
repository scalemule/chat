# 02 — Slack-style Channels App

Minimal Slack-like team chat: sidebar with named channels, main thread view, inline message search. ~100 lines of React.

## What this example shows

- `ChatProvider` + `tailwindTheme` preset wiring
- `useChannels()` to drive a sidebar of joinable channels
- `ChannelList` for channel discovery and selection
- `ChannelHeader` for the selected channel's metadata
- `ChatThread` for the full messaging UI (messages + input + reactions + attachments)
- `SearchBar` for full-text message search via OpenSearch

## What's NOT in this example

- Authentication (`getToken` is stubbed to hit `/api/chat/token` — replace with your own)
- Creating new channels (wire `useChannels().createChannel()` to a button)
- Channel browser modal (use `ChannelBrowser` component with `open` state)
- User profiles for avatars (pass a `profiles: Map<userId, UserProfile>` prop to `ChatMessageList`, or use the new `renderAvatar` escape hatch on `ChatMessageItem`)

## Theming

This example uses the Tailwind v4 preset. If your host app defines a primary palette via `@theme { --color-primary-500: ...; }`, all SDK components inherit it automatically. No props to pass. Change `tailwindTheme` to `shadcnTheme` if you're on shadcn/ui — dark mode works automatically in that variant.

## Running this example locally

```bash
cd examples/02-channels-app
npm install
npm run build  # type-checks against the local SDK
```

`npm run build` type-checks only. For a running app, drop this file into a Next.js 15 or Vite project as `app/page.tsx` / `src/App.tsx` and add the bootstrap.

## Files

- `App.tsx` — the full example (React, ~110 lines)
- `package.json` — links `@scalemule/chat` via `file:../..` + React peer deps
- `tsconfig.json` — strict type-check config
- `README.md` — this file
