/**
 * shadcn/ui theme preset for @scalemule/chat React components.
 *
 * Maps the SDK's `--sm-*` CSS custom properties to shadcn/ui's CSS variables.
 * Any host app using shadcn/ui (`hsl(var(--primary))`, `hsl(var(--background))`,
 * `--radius`, etc.) will get automatic theme inheritance with no further config.
 *
 * ## Usage
 *
 * **Recommended (zero JS):** import the CSS preset in your global
 * stylesheet so every SDK component inherits the shadcn theme including
 * dark mode:
 *
 * ```css
 * @import "@scalemule/chat/themes/shadcn.css";
 * ```
 *
 * **Alternative (per-component JS):** pass `theme={shadcnTheme}` to any
 * SDK component that accepts a `theme?: ChatTheme` prop. `ChatProvider`
 * does NOT accept a theme prop.
 *
 * ```tsx
 * import { SupportInbox } from '@scalemule/chat/react';
 * import { shadcnTheme } from '@scalemule/chat/themes/shadcn';
 *
 * <SupportInbox repClient={repClient} theme={shadcnTheme} />
 * ```
 *
 * ## What this inherits from your shadcn theme
 *
 * | SDK token           | shadcn variable               |
 * |---------------------|-------------------------------|
 * | `--sm-primary`      | `hsl(var(--primary))`         |
 * | `--sm-own-bubble`   | `hsl(var(--primary))`         |
 * | `--sm-own-text`     | `hsl(var(--primary-foreground))` |
 * | `--sm-other-bubble` | `hsl(var(--secondary))`       |
 * | `--sm-other-text`   | `hsl(var(--secondary-foreground))` |
 * | `--sm-surface`      | `hsl(var(--background))`      |
 * | `--sm-surface-muted`| `hsl(var(--muted))`           |
 * | `--sm-border-color` | `hsl(var(--border))`          |
 * | `--sm-text-color`   | `hsl(var(--foreground))`      |
 * | `--sm-muted-text`   | `hsl(var(--muted-foreground))`|
 * | `--sm-border-radius`| `var(--radius)`               |
 *
 * When the host defines a dark mode via `.dark { --background: ...; }`, the
 * SDK components automatically switch too — they're just reading the same
 * variables shadcn sets on the `:root` or `.dark` class.
 *
 * ## Using shadcn primitives as ChatInput.renderSendButton
 *
 * ```tsx
 * import { ChatInput } from '@scalemule/chat/react';
 * import { Button } from '@/components/ui/button';
 * import { Send } from 'lucide-react';
 *
 * <ChatInput
 *   onSend={handleSend}
 *   renderSendButton={({ canSend, disabled, onSend }) => (
 *     <Button
 *       onClick={onSend}
 *       disabled={disabled || !canSend}
 *       size="icon"
 *     >
 *       <Send className="h-4 w-4" />
 *     </Button>
 *   )}
 * />
 * ```
 *
 * ## Compatibility
 *
 * Assumes the host app follows the standard shadcn/ui CSS variable
 * conventions (`--primary`, `--background`, `--radius`, etc. in HSL). Works
 * with the default `new-york` and `default` shadcn themes out of the box.
 */

import type { ChatTheme } from '../react-components/theme';

export const shadcnTheme: ChatTheme = {
  primary: 'hsl(var(--primary, 221 83% 53%))',
  ownBubble: 'hsl(var(--primary, 221 83% 53%))',
  ownText: 'hsl(var(--primary-foreground, 0 0% 100%))',
  otherBubble: 'hsl(var(--secondary, 210 40% 96%))',
  otherText: 'hsl(var(--secondary-foreground, 222 47% 11%))',
  surface: 'hsl(var(--background, 0 0% 100%))',
  surfaceMuted: 'hsl(var(--muted, 210 40% 98%))',
  borderColor: 'hsl(var(--border, 214 32% 91%))',
  textColor: 'hsl(var(--foreground, 222 47% 11%))',
  mutedText: 'hsl(var(--muted-foreground, 215 16% 47%))',
  borderRadius: 'calc(var(--radius, 0.5rem) + 0.5rem)',
  fontFamily: 'inherit',
};

export { shadcnTheme as default };
