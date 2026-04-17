/**
 * Theme-mode helpers.
 *
 * The SDK supports three modes: `'light'`, `'dark'`, and `'system'`
 * (follows the user's OS preference). Everything here is framework-
 * agnostic — the React hook + switcher component both build on these
 * primitives and hosts can wire their own UI off them.
 *
 * SSR-safe: every helper tolerates `typeof window === 'undefined'`.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/**
 * Signal used to tell hosts how the resolved theme is applied.
 *
 * - `'class'`: add `dark` (or the configured class) on `<html>` when
 *   resolved is dark. Matches Tailwind `dark:` / shadcn default.
 * - `'data'`: set `data-theme="dark"` (or the configured attribute).
 *   Matches common CSS-variable switchers.
 */
export type ThemeAttributeStrategy = 'class' | 'data';

export interface ThemeModeOptions {
  /** localStorage key. Default `'sm-chat-theme-v1'`. */
  storageKey?: string;
  /** How to apply the resolved theme. Default `'class'`. */
  strategy?: ThemeAttributeStrategy;
  /**
   * The class or attribute name to toggle. Default `'dark'` for both
   * strategies (i.e. `<html class="dark">` or `<html data-theme="dark">`).
   */
  darkClassOrAttr?: string;
  /**
   * When `strategy='data'`, the attribute name. Default `'data-theme'`.
   * Ignored for the `'class'` strategy.
   */
  dataAttribute?: string;
}

export const DEFAULT_THEME_STORAGE_KEY = 'sm-chat-theme-v1';

function isMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Read the saved theme mode from localStorage. Returns `'system'`
 * when nothing is stored or the stored value is invalid. SSR-safe.
 */
export function readThemeMode(
  storageKey: string = DEFAULT_THEME_STORAGE_KEY,
): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage?.getItem(storageKey);
    if (isMode(raw)) return raw;
  } catch {
    // localStorage blocked (private mode, quota) — fall through
  }
  return 'system';
}

/** Persist the theme mode. Silent no-op on SSR or when storage is blocked. */
export function writeThemeMode(
  mode: ThemeMode,
  storageKey: string = DEFAULT_THEME_STORAGE_KEY,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(storageKey, mode);
  } catch {
    // ignore
  }
}

/**
 * Resolve a theme mode against the current `prefers-color-scheme`
 * media query. Returns `'light'` under SSR (safer default — prevents
 * a dark flash when hydrating in an unknown state).
 */
export function resolveThemeMode(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Apply the resolved theme to `<html>`. Idempotent and SSR-safe.
 * Hosts typically don't call this directly — the `useThemeMode` hook
 * applies it on mount and whenever the mode changes.
 */
export function applyTheme(
  resolved: ResolvedTheme,
  opts?: ThemeModeOptions,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const strategy = opts?.strategy ?? 'class';
  const mark = opts?.darkClassOrAttr ?? 'dark';
  if (strategy === 'class') {
    root.classList.toggle(mark, resolved === 'dark');
  } else {
    const attr = opts?.dataAttribute ?? 'data-theme';
    if (resolved === 'dark') {
      root.setAttribute(attr, mark);
    } else {
      root.removeAttribute(attr);
    }
  }
}

/**
 * Returns the inline IIFE string hosts inject in their HTML `<head>`
 * (before React hydrates) to prevent a flash of the wrong theme on
 * first paint. Next.js usage:
 *
 * ```tsx
 * // app/layout.tsx
 * import { getFlashPreventionScript } from '@scalemule/chat/theme';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <head>
 *         <script
 *           dangerouslySetInnerHTML={{ __html: getFlashPreventionScript() }}
 *         />
 *       </head>
 *       <body>{children}</body>
 *     </html>
 *   );
 * }
 * ```
 *
 * The script reads the stored mode, resolves `'system'` against
 * `prefers-color-scheme`, and applies the resulting class/attribute
 * to `<html>` synchronously — all before paint.
 */
export function getFlashPreventionScript(opts?: ThemeModeOptions): string {
  const storageKey = JSON.stringify(
    opts?.storageKey ?? DEFAULT_THEME_STORAGE_KEY,
  );
  const strategy = JSON.stringify(opts?.strategy ?? 'class');
  const mark = JSON.stringify(opts?.darkClassOrAttr ?? 'dark');
  const dataAttr = JSON.stringify(opts?.dataAttribute ?? 'data-theme');
  // Keep this tight — it's inlined into every page. No template
  // literals; pre-built string concatenation keeps the minified size
  // predictable and avoids any token the host's CSP might trip over.
  return (
    '(function(){try{' +
    'var k=' +
    storageKey +
    ';' +
    'var s=' +
    strategy +
    ';' +
    'var m=' +
    mark +
    ';' +
    'var d=' +
    dataAttr +
    ';' +
    'var v=null;try{v=localStorage.getItem(k)}catch(e){}' +
    "if(v!=='light'&&v!=='dark'&&v!=='system'){v='system'}" +
    "var r=v;if(v==='system'){r=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}" +
    "var h=document.documentElement;if(s==='class'){if(r==='dark'){h.classList.add(m)}else{h.classList.remove(m)}}" +
    "else{if(r==='dark'){h.setAttribute(d,m)}else{h.removeAttribute(d)}}" +
    '}catch(e){}})();'
  );
}
