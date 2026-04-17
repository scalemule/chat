/**
 * Map an IETF BCP-47 locale tag to a human-readable language label.
 *
 * React-free, SSR-safe. Hosts extend or replace the map as needed — the
 * default only covers a handful of common locales so the SDK never
 * ships opinions about which languages a platform supports.
 */

/**
 * Minimal default locale → label map. Intentionally small. Host apps
 * pass a richer map via the `map` parameter or override per call.
 */
export const DEFAULT_LANGUAGE_LABELS: Readonly<Record<string, string>> = {
  'en-US': 'English',
  'en-GB': 'English (UK)',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
  'pt-BR': 'Portuguese (Brazil)',
  'it-IT': 'Italian',
  'ja-JP': 'Japanese',
  'zh-CN': 'Chinese (Simplified)',
  'bg-BG': 'Bulgarian',
};

/**
 * Resolve a locale tag to a display label.
 *
 * Resolution order:
 *   1. Exact match in `map`
 *   2. Exact match in `DEFAULT_LANGUAGE_LABELS`
 *   3. `Intl.DisplayNames` of the language prefix (e.g. "en" → "English")
 *      when `useIntlFallback` is `true` (default). The display locale
 *      defaults to `"en"`, or the `displayLocale` parameter.
 *   4. Any map entry whose tag starts with the same prefix
 *   5. The original tag as a last resort
 *
 * Returns `null` for empty / nullish input.
 */
export function getLanguageLabel(
  locale: string | null | undefined,
  opts?: {
    map?: Readonly<Record<string, string>>;
    useIntlFallback?: boolean;
    displayLocale?: string;
  },
): string | null {
  if (!locale) return null;
  const tag = String(locale).trim();
  if (!tag) return null;

  const map = opts?.map ?? DEFAULT_LANGUAGE_LABELS;
  if (map[tag]) return map[tag];
  if (map !== DEFAULT_LANGUAGE_LABELS && DEFAULT_LANGUAGE_LABELS[tag]) {
    return DEFAULT_LANGUAGE_LABELS[tag];
  }

  const prefix = tag.split('-')[0]?.toLowerCase() ?? '';

  const useIntl = opts?.useIntlFallback ?? true;
  if (useIntl && prefix) {
    try {
      const IntlAny = Intl as unknown as {
        DisplayNames?: new (
          locales: string | string[],
          options: { type: 'language' | 'region' | 'script' | 'currency' },
        ) => { of(code: string): string | undefined };
      };
      if (typeof IntlAny.DisplayNames === 'function') {
        const dn = new IntlAny.DisplayNames(opts?.displayLocale ?? 'en', {
          type: 'language',
        });
        const resolved = dn.of(prefix);
        if (resolved && resolved !== prefix) return resolved;
      }
    } catch {
      // fall through to prefix scan
    }
  }

  for (const [key, label] of Object.entries(map)) {
    if (key.toLowerCase().startsWith(prefix)) return label;
  }

  return tag;
}
