/**
 * SSR-safe parser + formatter for system messages emitted by the chat
 * service.
 *
 * The chat service stores system messages with `message_type === 'system'`
 * and a structured `content` string of the form:
 *
 *   system.<topic>.<event>|key=value|key=value
 *
 * Examples:
 *
 *   system.call.started|type=video
 *   system.channel.joined|user_id=u1
 *   system.channel.invited|user_id=u2|by=u1
 *   system.channel.renamed|from=old|to=new|by=u1
 *
 * The default formatter resolves common channel and call events into
 * English strings using a host-supplied `profiles` map. Hosts that need
 * other languages, custom phrasings, or extra event types pass
 * `formatSystemMessage` to override.
 */

export interface SystemMessageProfile {
  display_name: string;
}

export interface ParsedSystemMessage {
  /** Full key, e.g. "system.channel.joined". */
  key: string;
  /** Topic, e.g. "channel". `null` when the content is not in system.* form. */
  topic: string | null;
  /** Event, e.g. "joined". `null` when the content is not in system.* form. */
  event: string | null;
  /** Decoded `key=value` params after the leading key. */
  params: Record<string, string>;
}

export function parseSystemMessage(content: string): ParsedSystemMessage {
  const parts = content.split('|');
  const key = parts[0] ?? '';
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq <= 0) continue;
    const k = parts[i].slice(0, eq);
    const v = parts[i].slice(eq + 1);
    if (k) params[k] = v;
  }
  if (!key.startsWith('system.')) {
    return { key, topic: null, event: null, params };
  }
  const segs = key.split('.');
  const topic = segs[1] ?? null;
  const event = segs.slice(2).join('.') || null;
  return { key, topic, event, params };
}

export interface FormatSystemMessageOptions {
  profiles?: Map<string, SystemMessageProfile>;
}

function nameFor(
  userId: string | undefined,
  profiles: Map<string, SystemMessageProfile> | undefined,
): string {
  if (!userId) return 'Someone';
  const profile = profiles?.get(userId);
  if (profile?.display_name) return profile.display_name;
  return userId.slice(0, 8);
}

/**
 * Default formatter. Handles the channel + call events the chat service
 * emits today; falls back to the raw content for unknown keys so hosts
 * never see "undefined" or an empty system row.
 */
export function defaultFormatSystemMessage(
  content: string,
  options: FormatSystemMessageOptions = {},
): string {
  const parsed = parseSystemMessage(content);
  const { profiles } = options;

  if (parsed.topic === 'channel') {
    const actor = nameFor(parsed.params.user_id, profiles);
    switch (parsed.event) {
      case 'joined':
        return `${actor} joined the channel`;
      case 'left':
        return `${actor} left the channel`;
      case 'invited': {
        const inviter = nameFor(parsed.params.by, profiles);
        return `${actor} was invited to the channel by ${inviter}`;
      }
      case 'created': {
        const creator = nameFor(parsed.params.by, profiles);
        return `${creator} created the channel`;
      }
      case 'renamed': {
        const renamer = nameFor(parsed.params.by, profiles);
        const from = parsed.params.from ?? '';
        const to = parsed.params.to ?? '';
        if (from && to) {
          return `${renamer} renamed the channel from “${from}” to “${to}”`;
        }
        return `${renamer} renamed the channel`;
      }
      case 'archived': {
        const actor2 = nameFor(parsed.params.by, profiles);
        return `${actor2} archived the channel`;
      }
      default:
        break;
    }
  }

  if (parsed.topic === 'call') {
    if (parsed.event === 'started') {
      const type = parsed.params.type === 'audio' ? 'Audio' : 'Video';
      return `${type} call started`;
    }
    if (parsed.event === 'ended') {
      const secs = Number.parseInt(parsed.params.duration ?? '0', 10) || 0;
      const mins = Math.floor(secs / 60);
      const rem = secs % 60;
      return `Call ended (${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')})`;
    }
  }

  // Unknown system key — fall back to the raw content so the row remains
  // human-readable rather than blank.
  return content;
}
