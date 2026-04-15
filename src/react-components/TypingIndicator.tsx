import React from 'react';

interface TypingIndicatorProps {
  /** The user IDs currently typing. Typically comes from `useTyping(conversationId).typingUsers`, filtered to exclude the current user. */
  typingUsers: string[];
  /**
   * Resolves a user ID to a display name. Host apps pass a lookup into their
   * own profile store (e.g. `(id) => profiles.get(id)?.display_name ?? 'Someone'`).
   * When omitted, the component falls back to "Someone" / "N people".
   */
  resolveUserName?: (userId: string) => string;
  /**
   * In large rooms (100+ participants) showing individual typing names can be
   * noisy and leaks presence info. When true, the component always renders
   * "N people typing..." instead of listing names.
   */
  isLargeRoom?: boolean;
  /**
   * Max number of names shown before collapsing into "and N others". Defaults
   * to 3. Has no effect when `isLargeRoom` is true.
   */
  maxNames?: number;
  /**
   * BCP-47 locale for `Intl.ListFormat` conjunction. Defaults to the runtime
   * locale. Only affects the list-of-names formatting; the surrounding
   * "is/are typing" sentence stays in English until the host wires
   * `formatTyping` for full i18n.
   */
  locale?: string;
  /**
   * Full override for the rendered sentence. Receives the resolved display
   * names (already truncated to `maxNames`, with an "N others" suffix
   * entry when applicable) and returns the final string. Use this for
   * full-sentence i18n ("Alice et Bob sont en train d’écrire…") or to
   * swap the default "typing..." phrasing.
   */
  formatTyping?: (names: string[]) => string;
  /**
   * When true, the indicator reserves its rendered height even when no
   * users are typing, so the surrounding layout doesn't jump as the
   * indicator appears/disappears. Default `false` to preserve the
   * existing "returns `null` when empty" behavior for hosts that
   * compose their own layout.
   */
  alwaysReserveHeight?: boolean;
}

/**
 * Animated "X is typing..." indicator with locale-aware name list
 * formatting and three bouncing dots. Renders nothing when
 * `typingUsers` is empty (unless `alwaysReserveHeight` is set) so
 * consumers can drop it unconditionally into their chat container
 * layout.
 *
 * Uses `--sm-*` CSS variables so it picks up the host app's theme.
 *
 * @example
 * ```tsx
 * const { typingUsers } = useTyping(conversationId);
 * <TypingIndicator
 *   typingUsers={typingUsers.filter(id => id !== currentUserId)}
 *   resolveUserName={(id) => profiles.get(id)?.display_name ?? 'Someone'}
 * />
 * ```
 */
export function TypingIndicator({
  typingUsers,
  resolveUserName,
  isLargeRoom,
  maxNames = 3,
  locale,
  formatTyping,
  alwaysReserveHeight = false,
}: TypingIndicatorProps): React.JSX.Element | null {
  const empty = typingUsers.length === 0;
  if (empty && !alwaysReserveHeight) return null;

  const text = empty
    ? ''
    : resolveTypingText({
        typingUsers,
        resolveUserName,
        isLargeRoom,
        maxNames,
        locale,
        formatTyping,
      });

  return (
    <div
      className="sm-typing-indicator"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 16px',
        fontSize: 'var(--sm-typing-indicator-font-size, 12px)',
        fontStyle: 'italic',
        color: 'var(--sm-typing-indicator-color, var(--sm-muted-text, #6b7280))',
        minHeight:
          alwaysReserveHeight
            ? 'calc(var(--sm-typing-indicator-font-size, 12px) + 12px)'
            : undefined,
        visibility: empty ? 'hidden' : undefined,
      }}
    >
      {empty ? null : (
        <>
          <span style={{ display: 'inline-flex', gap: 2 }}>
            <Dot delay={0} />
            <Dot delay={150} />
            <Dot delay={300} />
          </span>
          {text}
        </>
      )}
    </div>
  );
}

interface ResolveTextArgs {
  typingUsers: string[];
  resolveUserName?: (userId: string) => string;
  isLargeRoom?: boolean;
  maxNames: number;
  locale?: string;
  formatTyping?: (names: string[]) => string;
}

function resolveTypingText({
  typingUsers,
  resolveUserName,
  isLargeRoom,
  maxNames,
  locale,
  formatTyping,
}: ResolveTextArgs): string {
  if (isLargeRoom) {
    return `${typingUsers.length} people typing...`;
  }
  if (!resolveUserName) {
    if (typingUsers.length === 1) return 'Someone is typing...';
    return `${typingUsers.length} people typing...`;
  }
  const resolvedNames = typingUsers.map(resolveUserName);
  // Truncate to maxNames; collapse the tail into an "N others" entry so
  // the caller-supplied formatTyping still sees a useful list shape.
  const names =
    resolvedNames.length > maxNames
      ? [
          ...resolvedNames.slice(0, maxNames),
          `${resolvedNames.length - maxNames} ${resolvedNames.length - maxNames === 1 ? 'other' : 'others'}`,
        ]
      : resolvedNames;

  if (formatTyping) {
    return formatTyping(names);
  }
  return defaultFormatTyping(names, locale);
}

function defaultFormatTyping(names: string[], locale?: string): string {
  const verb = names.length === 1 ? 'is' : 'are';
  const joined = joinWithConjunction(names, locale);
  return `${joined} ${verb} typing...`;
}

interface IntlListFormatCtor {
  new (
    locale?: string | string[],
    options?: { type?: 'conjunction' | 'disjunction' | 'unit'; style?: 'long' | 'short' | 'narrow' },
  ): { format(items: string[]): string };
}

function joinWithConjunction(names: string[], locale?: string): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  try {
    const intlListFormat = (Intl as unknown as { ListFormat?: IntlListFormatCtor }).ListFormat;
    if (typeof intlListFormat === 'function') {
      const formatter = new intlListFormat(locale, {
        type: 'conjunction',
        style: 'long',
      });
      return formatter.format(names);
    }
  } catch {
    // Intl.ListFormat not available / locale invalid — fall through to manual join.
  }
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function Dot({ delay }: { delay: number }): React.JSX.Element {
  return (
    <>
      <style>{`
        @keyframes sm-typing-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
      <span
        style={{
          display: 'inline-block',
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: 'var(--sm-muted-text, #9ca3af)',
          animation: `sm-typing-bounce 1s infinite ease-in-out`,
          animationDelay: `${delay}ms`,
        }}
      />
    </>
  );
}
