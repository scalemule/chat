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
   * Override the default max number of names shown before collapsing to "N
   * people typing...". Defaults to 3. Has no effect when `isLargeRoom` is true.
   */
  maxNames?: number;
}

/**
 * Animated "X is typing..." indicator with smart pluralization and three
 * bouncing dots. Renders nothing when `typingUsers` is empty so consumers
 * can drop it unconditionally into their chat container layout.
 *
 * Uses `--sm-*` CSS variables so it picks up the host app's theme preset.
 * No required props beyond `typingUsers` — ships a sensible "Someone is
 * typing..." fallback when no `resolveUserName` is provided.
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
}: TypingIndicatorProps): React.JSX.Element | null {
  if (typingUsers.length === 0) return null;

  let text: string;
  if (isLargeRoom || typingUsers.length > maxNames) {
    text = `${typingUsers.length} people typing...`;
  } else if (!resolveUserName) {
    text = typingUsers.length === 1 ? 'Someone is typing...' : `${typingUsers.length} people typing...`;
  } else {
    const names = typingUsers.map(resolveUserName);
    if (names.length === 1) {
      text = `${names[0]} is typing...`;
    } else if (names.length === 2) {
      text = `${names[0]} and ${names[1]} are typing...`;
    } else {
      // 3 names (or maxNames if overridden — the >max branch above handles higher)
      const head = names.slice(0, names.length - 1).join(', ');
      const tail = names[names.length - 1];
      text = `${head}, and ${tail} are typing...`;
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 16px',
        fontSize: 12,
        fontStyle: 'italic',
        color: 'var(--sm-muted-text, #6b7280)',
      }}
    >
      <span style={{ display: 'inline-flex', gap: 2 }}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </span>
      {text}
    </div>
  );
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
