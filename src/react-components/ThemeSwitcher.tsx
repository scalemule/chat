import React from 'react';

import { useThemeMode, type UseThemeMode } from './useThemeMode';
import type { ThemeMode, ThemeModeOptions } from '../shared/themeMode';

export interface ThemeSwitcherLabels {
  light?: string;
  dark?: string;
  system?: string;
  ariaGroup?: string;
}

export interface ThemeSwitcherProps extends ThemeModeOptions {
  /** i18n strings for the three mode buttons. */
  labels?: ThemeSwitcherLabels;
  /**
   * Render only the icon (no text label) for each mode. Default
   * `false` — label + icon shows. SVGs are inlined so hosts don't
   * need an icon library.
   */
  iconOnly?: boolean;
  className?: string;
  /**
   * Override the control. Receives the hook's state + setters for
   * hosts that want full UI control.
   */
  render?: (ctx: UseThemeMode) => React.ReactNode;
}

const defaultLabels: Required<ThemeSwitcherLabels> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  ariaGroup: 'Color theme',
};

const ICONS: Record<ThemeMode, React.ReactNode> = {
  light: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  dark: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  system: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
};

/**
 * Three-button segmented switcher: Light / Dark / System.
 *
 * Persists the selection via `useThemeMode` (which also handles
 * `prefers-color-scheme` subscription for `'system'`). Hosts that
 * want a different UI shape can pass `render` and compose on the
 * same hook state directly.
 *
 * Class hooks: `.sm-theme-switcher`, `.sm-theme-switcher-button`,
 * `.sm-theme-switcher-button-active`.
 */
export function ThemeSwitcher({
  labels,
  iconOnly = false,
  className,
  render,
  ...themeOpts
}: ThemeSwitcherProps): React.JSX.Element {
  const state = useThemeMode(themeOpts);
  const l = { ...defaultLabels, ...labels };

  if (render) return <>{render(state)}</>;

  const modes: ThemeMode[] = ['light', 'dark', 'system'];

  return (
    <div
      className={`sm-theme-switcher${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={l.ariaGroup}
      style={{
        display: 'inline-flex',
        padding: 2,
        borderRadius: 8,
        background: 'var(--sm-surface-muted, #f3f4f6)',
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        gap: 2,
      }}
    >
      {modes.map((m) => {
        const active = state.mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => state.setMode(m)}
            aria-pressed={active}
            aria-label={l[m]}
            className={`sm-theme-switcher-button${
              active ? ' sm-theme-switcher-button-active' : ''
            }`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: iconOnly ? '6px' : '6px 10px',
              border: 'none',
              borderRadius: 6,
              background: active
                ? 'var(--sm-surface, #fff)'
                : 'transparent',
              color: active
                ? 'var(--sm-text-color, #111827)'
                : 'var(--sm-muted-text, #6b7280)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'background-color 120ms, color 120ms',
            }}
          >
            {ICONS[m]}
            {!iconOnly && <span>{l[m]}</span>}
          </button>
        );
      })}
    </div>
  );
}
