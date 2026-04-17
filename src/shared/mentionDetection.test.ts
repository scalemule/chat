import { describe, expect, it } from 'vitest';

import { messageContainsMention } from './mentionDetection';

describe('messageContainsMention', () => {
  const needleMarkup = (id: string) =>
    `<span class="sm-mention" data-sm-user-id="${id}">@Name</span>`;

  it('detects the exact attribute emitted by the mention blot', () => {
    const html = `hey ${needleMarkup('user-1')} please look`;
    expect(messageContainsMention(html, 'user-1')).toBe(true);
  });

  it('is userId-scoped — does not match other users mentions', () => {
    const html = `hey ${needleMarkup('user-2')} please look`;
    expect(messageContainsMention(html, 'user-1')).toBe(false);
  });

  it('handles multi-mention messages', () => {
    const html = `${needleMarkup('user-2')} ${needleMarkup('user-1')}`;
    expect(messageContainsMention(html, 'user-1')).toBe(true);
  });

  it('rejects plain text containing a similar substring', () => {
    // The attribute form requires the exact quoted needle — a plain
    // body that happens to contain the user id must not match.
    expect(messageContainsMention('a plain user-1 message', 'user-1')).toBe(
      false,
    );
  });

  it('returns false for empty / nullish inputs', () => {
    expect(messageContainsMention('', 'user-1')).toBe(false);
    expect(messageContainsMention(null, 'user-1')).toBe(false);
    expect(messageContainsMention(undefined, 'user-1')).toBe(false);
    expect(messageContainsMention('<span>hi</span>', null)).toBe(false);
    expect(messageContainsMention('<span>hi</span>', undefined)).toBe(false);
    expect(messageContainsMention('<span>hi</span>', '')).toBe(false);
  });
});
