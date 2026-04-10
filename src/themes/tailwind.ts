/**
 * Tailwind v4 theme preset for @scalemule/chat React components.
 *
 * Maps the SDK's `--sm-*` CSS custom properties to Tailwind's auto-generated
 * theme CSS variables via a fallback chain. When the host app's Tailwind theme
 * defines `--color-primary-*` (Tailwind v4 `@theme` block), the SDK components
 * inherit the host palette automatically. When no primary is defined, the chain
 * falls back to `--color-blue-*`, and finally to the SDK's own default colors.
 *
 * ## Usage (Tailwind v4)
 *
 * **Recommended:** import the CSS preset in your global stylesheet. This
 * sets the `--sm-*` variables on `:root` globally so every SDK component
 * inherits the theme with no per-component prop passing:
 *
 * ```css
 * @import "tailwindcss";
 * @import "@scalemule/chat/themes/tailwind.css";
 * ```
 *
 * **Alternative (per-component):** pass `theme={tailwindTheme}` to any
 * SDK component that accepts a `theme?: ChatTheme` prop. `ChatProvider`
 * does NOT accept a theme prop — themes are applied per-component or
 * globally via the CSS import above.
 *
 * ```tsx
 * import { ChannelList } from '@scalemule/chat/react';
 * import { tailwindTheme } from '@scalemule/chat/themes/tailwind';
 *
 * <ChannelList theme={tailwindTheme} onSelect={...} />
 * ```
 *
 * ## Defining a custom primary color (Tailwind v4)
 *
 * ```css
 * @import "tailwindcss";
 *
 * @theme {
 *   --color-primary-500: #ef4444; // red-500
 *   --color-primary-600: #dc2626;
 * }
 * ```
 *
 * The SDK components will now render reactions, own-message bubbles, and CTAs
 * in your red palette. No further configuration needed.
 *
 * ## Tailwind v3 users
 *
 * The fallback chain still works — you just need to manually define `--sm-*`
 * in your global CSS, or set `theme.colors.primary` in `tailwind.config.ts`
 * and use a CSS plugin to emit `--color-primary-*` variables.
 *
 * ## Compatibility
 *
 * This theme is a plain `ChatTheme` object with no runtime dependencies on
 * Tailwind itself — it only contains `var()` references that resolve in the
 * browser. Safe to use with any framework that supports CSS custom properties.
 */

import type { ChatTheme } from '../react-components/theme';

export const tailwindTheme: ChatTheme = {
  // Primary color — used for own-message bubbles, CTAs, active states.
  // Fallback chain: host's --color-primary-500 → --color-blue-600 → SDK default
  primary:
    'var(--color-primary-500, var(--color-blue-600, #2563eb))',

  // Own message bubble — defaults to primary
  ownBubble:
    'var(--color-primary-500, var(--color-blue-600, #2563eb))',
  ownText: 'var(--color-white, #ffffff)',

  // Other message bubble — neutral
  otherBubble: 'var(--color-gray-100, #f3f4f6)',
  otherText: 'var(--color-gray-900, #111827)',

  // Surfaces
  surface: 'var(--color-white, #ffffff)',
  surfaceMuted: 'var(--color-gray-50, #f8fafc)',

  // Borders and text
  borderColor: 'var(--color-gray-200, #e5e7eb)',
  textColor: 'var(--color-gray-900, #111827)',
  mutedText: 'var(--color-gray-500, #6b7280)',

  // Radius — Tailwind v4 exposes --radius-2xl for rounded-2xl
  borderRadius: 'var(--radius-2xl, 16px)',

  // Font — Tailwind v4 exposes --font-sans for font-sans
  fontFamily:
    'var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
};

/**
 * Convenience helper to apply the Tailwind theme as inline style tokens
 * on a root element (e.g., a div wrapping a non-ChatProvider consumer).
 *
 * ```tsx
 * import { tailwindThemeStyle } from '@scalemule/chat/themes/tailwind';
 *
 * <div style={tailwindThemeStyle}>
 *   <ChannelList ... />
 * </div>
 * ```
 */
export { tailwindTheme as default };
