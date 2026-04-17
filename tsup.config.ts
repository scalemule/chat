import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM + CJS library builds (tree-shakeable)
  {
    entry: {
      index: 'src/index.ts',
      element: 'src/element.ts',
      react: 'src/react.tsx',
      'react-admin': 'src/react-admin.ts',
      iframe: 'src/iframe.ts',
      'themes/tailwind': 'src/themes/tailwind.ts',
      'themes/shadcn': 'src/themes/shadcn.ts',
    },
    format: ['esm', 'cjs'],
    dts: false,
    sourcemap: false,
    clean: true,
    external: ['react', 'react-dom', 'quill', 'quill-markdown-shortcuts-new', '@scalemule/gallop', '@scalemule/gallop/react'],
    treeshake: true,
    splitting: true,
  },
  // Rich-text editor entry — code-split so plain-text consumers don't pay for
  // Quill. Splitting disabled so editor.js is a single monolithic chunk that's
  // trivial to audit with a fixed-file bundle budget. Revisit once we have
  // more editor submodules (mention menus, link tooltip) and want them lazy.
  {
    entry: { editor: 'src/editor.tsx' },
    format: ['esm', 'cjs'],
    dts: false,
    sourcemap: false,
    clean: false,
    external: ['react', 'react-dom', 'quill', 'quill-markdown-shortcuts-new'],
    treeshake: true,
    splitting: false,
  },
  // Video player entry — @scalemule/gallop is an optional peer dep; this
  // keeps it out of the core/react bundles for customers who don't need the
  // polished player.
  {
    entry: { video: 'src/video.tsx' },
    format: ['esm', 'cjs'],
    dts: false,
    sourcemap: false,
    clean: false,
    external: ['react', 'react-dom', '@scalemule/gallop', '@scalemule/gallop/react'],
    treeshake: true,
    splitting: false,
  },
  // Embeds entry — opt-in rich-link embeds (YouTube etc.). Code-split so
  // the iframe + oEmbed code never lands in the core react bundle for
  // hosts that don't render embeds.
  {
    entry: { embeds: 'src/embeds.tsx' },
    format: ['esm', 'cjs'],
    dts: false,
    sourcemap: false,
    clean: false,
    external: ['react', 'react-dom'],
    treeshake: true,
    splitting: false,
  },
  // Search entry — opt-in search UX (history + dropdown + excerpt
  // renderer in 0.0.53; global search hook + results panel in 0.0.54).
  // Code-split so hosts that don't render search don't pay the bundle
  // cost in react.js.
  {
    entry: { search: 'src/search.tsx' },
    format: ['esm', 'cjs'],
    dts: false,
    sourcemap: false,
    clean: false,
    external: ['react', 'react-dom'],
    treeshake: true,
    splitting: false,
  },
  // Profile entry — opt-in profile UX (UserProfileCard, ProfilePanel,
  // language/timezone helpers). Code-split so hosts that don't render
  // a profile panel don't pay the bundle cost in react.js. Avatar is
  // re-exported here for convenience even though it also lives in
  // react.js, so hosts that only pull `/profile` get everything they
  // need without a second import.
  {
    entry: { profile: 'src/profile.tsx' },
    format: ['esm', 'cjs'],
    dts: false,
    sourcemap: false,
    clean: false,
    external: ['react', 'react-dom'],
    treeshake: true,
    splitting: false,
  },
  // Notifications entry — opt-in mention/call notification UX (sound
  // chime, browser Notification API wrapper, AudioContext unlock,
  // useMentionAlerts hook). Code-split so hosts that handle alerts
  // externally (or not at all) don't pay the bundle cost in react.js.
  {
    entry: { notifications: 'src/notifications.tsx' },
    format: ['esm', 'cjs'],
    dts: false,
    sourcemap: false,
    clean: false,
    external: ['react', 'react-dom'],
    treeshake: true,
    splitting: false,
  },
  // UMD bundle (script tag: window.ScaleMuleChat)
  {
    entry: { 'chat.umd': 'src/umd.ts' },
    format: ['iife'],
    globalName: 'ScaleMuleChat',
    sourcemap: false,
    minify: true,
  },
  // Embed bundle (self-contained IIFE for iframe HTML shell)
  {
    entry: { 'chat.embed': 'src/embed/index.ts' },
    format: ['iife'],
    globalName: 'ChatEmbed',
    sourcemap: false,
    minify: true,
  },
  // Support widget bundle (CDN-deployable IIFE for customer websites)
  {
    entry: { 'support-widget': 'src/widget/index.ts' },
    format: ['iife'],
    globalName: 'ScaleMuleSupportWidget',
    sourcemap: false,
    minify: true,
  },
]);
