import type { CSSProperties } from 'react';

export interface ChatTheme {
  primary?: string;
  ownBubble?: string;
  ownText?: string;
  otherBubble?: string;
  otherText?: string;
  surface?: string;
  surfaceMuted?: string;
  borderColor?: string;
  textColor?: string;
  mutedText?: string;
  borderRadius?: number | string;
  fontFamily?: string;
}

type ThemeStyle = CSSProperties & Record<string, string | number | undefined>;

export function themeToStyle(theme?: ChatTheme): ThemeStyle {
  return {
    '--sm-primary': theme?.primary ?? '#2563eb',
    '--sm-own-bubble': theme?.ownBubble ?? theme?.primary ?? '#2563eb',
    '--sm-own-text': theme?.ownText ?? '#ffffff',
    '--sm-other-bubble': theme?.otherBubble ?? '#f3f4f6',
    '--sm-other-text': theme?.otherText ?? '#111827',
    '--sm-surface': theme?.surface ?? '#ffffff',
    '--sm-surface-muted': theme?.surfaceMuted ?? '#f8fafc',
    '--sm-border-color': theme?.borderColor ?? '#e5e7eb',
    '--sm-text-color': theme?.textColor ?? '#111827',
    '--sm-muted-text': theme?.mutedText ?? '#6b7280',
    '--sm-border-radius':
      typeof theme?.borderRadius === 'number'
        ? `${theme.borderRadius}px`
        : theme?.borderRadius ?? '16px',
    '--sm-font-family':
      theme?.fontFamily ?? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };
}
