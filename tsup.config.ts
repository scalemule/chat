import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM + CJS library builds (tree-shakeable)
  {
    entry: {
      index: 'src/index.ts',
      element: 'src/element.ts',
      react: 'src/react.tsx',
      iframe: 'src/iframe.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: false,
    clean: true,
    external: ['react', 'react-dom'],
    treeshake: true,
    splitting: true,
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
