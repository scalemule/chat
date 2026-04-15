import { describe, expect, it } from 'vitest';

import {
  defaultFormatSystemMessage,
  parseSystemMessage,
} from '../systemMessages';

const profiles = new Map([
  ['u1', { display_name: 'Alice' }],
  ['u2', { display_name: 'Bob' }],
]);

describe('parseSystemMessage', () => {
  it('parses topic + event + params', () => {
    const r = parseSystemMessage('system.channel.invited|user_id=u1|by=u2');
    expect(r.topic).toBe('channel');
    expect(r.event).toBe('invited');
    expect(r.params).toEqual({ user_id: 'u1', by: 'u2' });
  });

  it('returns null topic/event for non-system content', () => {
    const r = parseSystemMessage('hello world');
    expect(r.topic).toBeNull();
    expect(r.event).toBeNull();
    expect(r.params).toEqual({});
  });

  it('preserves equals signs inside values', () => {
    const r = parseSystemMessage('system.x.y|q=a=b=c');
    expect(r.params).toEqual({ q: 'a=b=c' });
  });
});

describe('defaultFormatSystemMessage — channel events', () => {
  it('formats joined', () => {
    expect(
      defaultFormatSystemMessage('system.channel.joined|user_id=u1', { profiles }),
    ).toBe('Alice joined the channel');
  });

  it('formats left', () => {
    expect(
      defaultFormatSystemMessage('system.channel.left|user_id=u2', { profiles }),
    ).toBe('Bob left the channel');
  });

  it('formats invited with inviter', () => {
    expect(
      defaultFormatSystemMessage(
        'system.channel.invited|user_id=u1|by=u2',
        { profiles },
      ),
    ).toBe('Alice was invited to the channel by Bob');
  });

  it('formats created', () => {
    expect(
      defaultFormatSystemMessage('system.channel.created|by=u1', { profiles }),
    ).toBe('Alice created the channel');
  });

  it('formats renamed with from/to', () => {
    expect(
      defaultFormatSystemMessage(
        'system.channel.renamed|by=u1|from=old|to=new',
        { profiles },
      ),
    ).toBe('Alice renamed the channel from “old” to “new”');
  });

  it('falls back to short id when profile missing', () => {
    expect(
      defaultFormatSystemMessage(
        'system.channel.joined|user_id=unknown-long-id',
        { profiles },
      ),
    ).toBe('unknown- joined the channel');
  });
});

describe('defaultFormatSystemMessage — call events', () => {
  it('formats call.started (video by default)', () => {
    expect(defaultFormatSystemMessage('system.call.started')).toBe(
      'Video call started',
    );
  });

  it('formats call.started (audio variant)', () => {
    expect(defaultFormatSystemMessage('system.call.started|type=audio')).toBe(
      'Audio call started',
    );
  });

  it('formats call.ended with duration', () => {
    expect(defaultFormatSystemMessage('system.call.ended|duration=125')).toBe(
      'Call ended (02:05)',
    );
  });
});

describe('defaultFormatSystemMessage — fallback', () => {
  it('returns raw content for unknown system keys', () => {
    expect(defaultFormatSystemMessage('system.unknown.event|x=1')).toBe(
      'system.unknown.event|x=1',
    );
  });

  it('returns raw content for non-system text', () => {
    expect(defaultFormatSystemMessage('hello')).toBe('hello');
  });
});
