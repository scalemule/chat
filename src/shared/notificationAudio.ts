/**
 * Minimal WebAudio helpers for notification tones.
 *
 * Framework-agnostic, SSR-safe. `initAudio()` must be called from a
 * user-gesture handler (click, keydown) to unlock audio playback on
 * browsers that block autoplay until the user interacts with the
 * page. All play functions are no-ops when the context isn't yet
 * initialized, so they can't throw or crash UI code.
 */

interface AudioContextConstructor {
  new (options?: AudioContextOptions): AudioContext;
}

let sharedContext: AudioContext | null = null;

function resolveAudioContextCtor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Returns `true` when the current environment supports WebAudio.
 * Safe to call on the server — returns `false` there.
 */
export function isAudioSupported(): boolean {
  return resolveAudioContextCtor() !== null;
}

/**
 * Create or return the shared `AudioContext`. Attempts to resume the
 * context when it's been suspended by autoplay policies. Returns
 * `null` when called on the server or when WebAudio is unavailable.
 *
 * Idempotent — safe to call on every user interaction. Hosts
 * typically call this once on the first click/keydown, then forget it.
 */
export function initAudio(): AudioContext | null {
  const Ctor = resolveAudioContextCtor();
  if (!Ctor) return null;
  if (!sharedContext) {
    try {
      sharedContext = new Ctor();
    } catch {
      return null;
    }
  }
  if (sharedContext.state === 'suspended') {
    // `resume` returns a promise; swallow any rejection — the caller
    // might be in a non-user-gesture path where resume is refused.
    void sharedContext.resume().catch(() => {});
  }
  return sharedContext;
}

/**
 * Returns the shared context if one has been created, without creating
 * one. Useful for callers that want to play a tone only when audio is
 * already unlocked.
 */
export function getAudioContext(): AudioContext | null {
  return sharedContext;
}

/**
 * For tests only — tears down the shared context so the next
 * `initAudio()` creates a fresh one.
 */
export function __resetAudioContextForTests(): void {
  try {
    void sharedContext?.close?.();
  } catch {
    // ignore
  }
  sharedContext = null;
}

export interface ToneOptions {
  /** Override the shared context (defaults to the one from `initAudio`). */
  context?: AudioContext | null;
  /** Linear gain 0..1 applied to the tone. Default 0.1 (quiet). */
  volume?: number;
  /** When true, resolves after the tone finishes. Default false. */
  await?: boolean;
}

interface ToneStep {
  /** Frequency in Hz. */
  frequency: number;
  /** Duration in seconds. */
  duration: number;
  /** Pause in seconds before the step starts. Default 0. */
  gap?: number;
  /** `type` parameter for the oscillator. Default `'sine'`. */
  type?: OscillatorType;
}

function playSequence(
  steps: ToneStep[],
  opts?: ToneOptions,
): Promise<void> | void {
  const ctx = opts?.context ?? sharedContext;
  if (!ctx) return;
  const volume = Math.max(0, Math.min(1, opts?.volume ?? 0.1));
  let cursor = ctx.currentTime;
  let lastEnd = cursor;
  for (const step of steps) {
    const start = cursor + (step.gap ?? 0);
    const end = start + step.duration;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = step.type ?? 'sine';
    osc.frequency.setValueAtTime(step.frequency, start);
    gain.gain.setValueAtTime(0, start);
    // Tiny attack + release so the tone doesn't click.
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.linearRampToValueAtTime(0, end);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.01);
    cursor = end;
    lastEnd = end;
  }
  if (opts?.await) {
    return new Promise((resolve) => {
      const delayMs = Math.max(0, (lastEnd - ctx.currentTime) * 1000);
      setTimeout(resolve, delayMs + 20);
    });
  }
}

/**
 * Play the two-tone mention chime: A5 (880Hz) → C#6 (1108Hz).
 *
 * This is the "someone @mentioned you" pattern. Requires
 * `initAudio()` to have been called previously from a user gesture,
 * otherwise the call is a silent no-op.
 */
export function playMentionChime(opts?: ToneOptions): Promise<void> | void {
  return playSequence(
    [
      { frequency: 880, duration: 0.12 },
      { frequency: 1108.73, duration: 0.2, gap: 0.04 },
    ],
    opts,
  );
}

/**
 * Play a single 587Hz ring tone (0.8s). Suitable for incoming-call
 * signals in hosts that don't use the conference SDK's own ring.
 */
export function playRingTone(opts?: ToneOptions): Promise<void> | void {
  return playSequence([{ frequency: 587.33, duration: 0.8 }], opts);
}

/**
 * Play a custom tone sequence. Escape hatch for hosts that want a
 * different chime (e.g. an arpeggio for bot mentions).
 */
export function playTones(
  steps: ToneStep[],
  opts?: ToneOptions,
): Promise<void> | void {
  return playSequence(steps, opts);
}
