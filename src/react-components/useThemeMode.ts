import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_THEME_STORAGE_KEY,
  applyTheme,
  readThemeMode,
  resolveThemeMode,
  writeThemeMode,
  type ResolvedTheme,
  type ThemeMode,
  type ThemeModeOptions,
} from '../shared/themeMode';

export interface UseThemeMode {
  /** Current user-selected mode. */
  mode: ThemeMode;
  /** Actual resolved theme (always `'light'` or `'dark'`). */
  resolved: ResolvedTheme;
  /** Change the user-selected mode. Persists to storage + applies immediately. */
  setMode: (next: ThemeMode) => void;
  /**
   * Convenience: cycle light → dark → system. Some hosts prefer a
   * single-button switcher over the three-button group.
   */
  cycleMode: () => void;
}

/**
 * Track + apply the user-selected theme mode. On mount, reads the
 * persisted mode (default `'system'`) and applies the resolved class
 * or attribute to `<html>`. Subscribes to `prefers-color-scheme`
 * changes so `'system'` follows the OS in real time.
 *
 * Use `getFlashPreventionScript()` in your root HTML `<head>` to
 * ensure the initial paint matches the stored mode — this hook runs
 * after hydration.
 */
export function useThemeMode(opts?: ThemeModeOptions): UseThemeMode {
  const storageKey = opts?.storageKey ?? DEFAULT_THEME_STORAGE_KEY;
  const [mode, setModeState] = useState<ThemeMode>(() =>
    readThemeMode(storageKey),
  );
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveThemeMode(readThemeMode(storageKey)),
  );

  // Apply on mount + when the mode changes.
  useEffect(() => {
    const r = resolveThemeMode(mode);
    setResolved(r);
    applyTheme(r, opts);
    // opts is a plain object — destructure its relevant fields into
    // the dep array so we don't re-run on unrelated reference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    opts?.strategy,
    opts?.darkClassOrAttr,
    opts?.dataAttribute,
  ]);

  // Follow the OS when mode === 'system'.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => {
      const r: ResolvedTheme = mq.matches ? 'dark' : 'light';
      setResolved(r);
      applyTheme(r, opts);
    };
    // Some older Safari versions only expose addListener.
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener?.(onChange);
    return () => mq.removeListener?.(onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    opts?.strategy,
    opts?.darkClassOrAttr,
    opts?.dataAttribute,
  ]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      writeThemeMode(next, storageKey);
      setModeState(next);
    },
    [storageKey],
  );

  const cycleMode = useCallback(() => {
    setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light');
  }, [mode, setMode]);

  return { mode, resolved, setMode, cycleMode };
}
