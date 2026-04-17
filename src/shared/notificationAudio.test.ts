// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetAudioContextForTests,
  getAudioContext,
  initAudio,
  isAudioSupported,
  playMentionChime,
  playRingTone,
  playTones,
} from './notificationAudio';

class FakeOscillator {
  type = 'sine';
  frequency = { setValueAtTime: vi.fn() };
  started?: number;
  stopped?: number;
  connect = vi.fn((node: unknown) => node);
  start(at: number) {
    this.started = at;
  }
  stop(at: number) {
    this.stopped = at;
  }
}

class FakeGain {
  gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn((node: unknown) => node);
}

class FakeAudioContext {
  currentTime = 0;
  state: 'running' | 'suspended' = 'suspended';
  destination = {};
  createdOscillators: FakeOscillator[] = [];
  createdGains: FakeGain[] = [];
  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator();
    this.createdOscillators.push(osc);
    return osc;
  }
  createGain(): FakeGain {
    const gain = new FakeGain();
    this.createdGains.push(gain);
    return gain;
  }
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn();
}

describe('notificationAudio', () => {
  beforeEach(() => {
    __resetAudioContextForTests();
    (window as unknown as { AudioContext: unknown }).AudioContext =
      FakeAudioContext;
  });

  it('initAudio creates a single shared context', () => {
    const a = initAudio();
    const b = initAudio();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(FakeAudioContext);
  });

  it('initAudio returns null when AudioContext is unavailable', () => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    delete (window as unknown as { webkitAudioContext?: unknown })
      .webkitAudioContext;
    __resetAudioContextForTests();
    expect(initAudio()).toBeNull();
    expect(isAudioSupported()).toBe(false);
  });

  it('initAudio resumes a suspended context', async () => {
    const ctx = initAudio() as unknown as FakeAudioContext;
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('getAudioContext returns null before init, the context after', () => {
    expect(getAudioContext()).toBeNull();
    const ctx = initAudio();
    expect(getAudioContext()).toBe(ctx);
  });

  it('playMentionChime schedules two oscillators', () => {
    const ctx = initAudio() as unknown as FakeAudioContext;
    playMentionChime();
    expect(ctx.createdOscillators).toHaveLength(2);
    expect(ctx.createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      880,
      expect.any(Number),
    );
    expect(ctx.createdOscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(
      1108.73,
      expect.any(Number),
    );
  });

  it('playRingTone schedules one oscillator at 587.33 Hz', () => {
    const ctx = initAudio() as unknown as FakeAudioContext;
    playRingTone();
    expect(ctx.createdOscillators).toHaveLength(1);
    expect(ctx.createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      587.33,
      expect.any(Number),
    );
  });

  it('play functions are no-ops when audio is not initialized', () => {
    expect(() => playMentionChime()).not.toThrow();
    expect(() => playRingTone()).not.toThrow();
    expect(() => playTones([{ frequency: 440, duration: 0.1 }])).not.toThrow();
  });

  it('clamps the volume into [0, 1]', () => {
    const ctx = initAudio() as unknown as FakeAudioContext;
    playMentionChime({ volume: 5 });
    const ramp =
      ctx.createdGains[0].gain.linearRampToValueAtTime.mock.calls[0];
    // first linearRampToValueAtTime call should use volume=1 (clamped)
    expect(ramp[0]).toBe(1);

    playMentionChime({ volume: -1 });
    const clampedLow =
      ctx.createdGains[ctx.createdGains.length - 2].gain
        .linearRampToValueAtTime.mock.calls[0][0];
    expect(clampedLow).toBe(0);
  });
});
