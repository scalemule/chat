/**
 * Opt-in theme UX entry. Code-split from the main `/react` bundle so
 * hosts that don't render a theme switcher don't pay the cost.
 *
 * Usage:
 *
 * ```tsx
 * import { ThemeSwitcher, getFlashPreventionScript } from '@scalemule/chat/theme';
 *
 * // app/layout.tsx — prevent a flash of the wrong theme on first paint:
 * <head>
 *   <script dangerouslySetInnerHTML={{ __html: getFlashPreventionScript() }} />
 * </head>
 *
 * // Somewhere in a settings panel:
 * <ThemeSwitcher />
 * ```
 */

export { ThemeSwitcher } from './react-components/ThemeSwitcher';
export type {
  ThemeSwitcherProps,
  ThemeSwitcherLabels,
} from './react-components/ThemeSwitcher';

export { useThemeMode } from './react-components/useThemeMode';
export type { UseThemeMode } from './react-components/useThemeMode';

export {
  applyTheme,
  getFlashPreventionScript,
  readThemeMode,
  resolveThemeMode,
  writeThemeMode,
  DEFAULT_THEME_STORAGE_KEY,
} from './shared/themeMode';
export type {
  ThemeMode,
  ResolvedTheme,
  ThemeAttributeStrategy,
  ThemeModeOptions,
} from './shared/themeMode';
