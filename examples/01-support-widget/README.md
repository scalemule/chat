# 01 — Support Widget

Embeddable chat bubble for any marketing site, static page, or customer-facing product.

## What this example shows

- Creating a `SupportClient` with a publishable API key
- Initializing a visitor session (anonymous or pre-filled)
- Starting a conversation with an opening message + `page_url` context
- Listening for incoming messages via `support.chat.on('message', ...)`
- Sending a follow-up message

## Production usage (HTML + script tag)

For a real site, you don't need to ship this TS file — just include the SDK's pre-bundled widget via `<script>`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Acme Inc.</title>
</head>
<body>
  <h1>Welcome to Acme</h1>

  <script src="https://unpkg.com/@scalemule/chat@^0.0.13/dist/support-widget.global.js"></script>
  <script>
    ScaleMuleSupportWidget.init({
      apiKey: 'pb_live_your_public_api_key',
      theme: { primary: '#ef4444', borderRadius: 12 },
      position: 'right',
    });
  </script>
</body>
</html>
```

That's the entire integration. The widget:
- Creates an anonymous visitor session on first open
- Persists the session token across page reloads via localStorage
- Streams messages in real-time (WebSocket with HTTP polling fallback)
- Supports file attachments, emoji reactions, typing indicators
- Inherits your `primary` color

## Running this example locally

```bash
cd examples/01-support-widget
npm install
npm run build  # type-checks against the local SDK
```

`npm run build` only type-checks — it doesn't start a server. The example is type-level proof that the `SupportClient` API matches what's documented. For a runnable demo, paste the HTML above into a file and open it in a browser.

## Files

- `index.ts` — programmatic API usage (for custom integrations)
- `package.json` — links `@scalemule/chat` via `file:../..`
- `tsconfig.json` — strict type-check config
- `README.md` — this file
