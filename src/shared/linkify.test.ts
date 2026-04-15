import { describe, expect, it } from 'vitest';

import { linkify, hasLinks } from './linkify';

describe('linkify — SSR safety', () => {
  it('does not access any DOM globals', () => {
    // If the helper touched window/document/DOMParser, importing + invoking
    // it under the default node test env would throw. We can also assert
    // that no DOM globals are leaked.
    expect(typeof globalThis).toBe('object');
    // @ts-expect-error window is intentionally undefined under node env
    expect(typeof window).toBe('undefined');
    const segs = linkify('check https://example.com');
    expect(segs).toHaveLength(2);
  });
});

describe('linkify — URL detection', () => {
  it('returns an empty array for empty input', () => {
    expect(linkify('')).toEqual([]);
  });

  it('returns a single text segment when no URLs are present', () => {
    expect(linkify('hello world')).toEqual([
      { type: 'text', value: 'hello world' },
    ]);
  });

  it('detects an http URL', () => {
    expect(linkify('see http://example.com docs')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', display: 'http://example.com', url: 'http://example.com' },
      { type: 'text', value: ' docs' },
    ]);
  });

  it('detects an https URL with a path and query', () => {
    const segs = linkify('open https://example.com/docs?q=hi here');
    expect(segs).toEqual([
      { type: 'text', value: 'open ' },
      {
        type: 'link',
        display: 'https://example.com/docs?q=hi',
        url: 'https://example.com/docs?q=hi',
      },
      { type: 'text', value: ' here' },
    ]);
  });

  it('promotes a www. URL to https://', () => {
    expect(linkify('www.example.com')).toEqual([
      {
        type: 'link',
        display: 'www.example.com',
        url: 'https://www.example.com',
      },
    ]);
  });

  it('strips trailing prose punctuation from URL matches', () => {
    expect(linkify('go to https://example.com.')).toEqual([
      { type: 'text', value: 'go to ' },
      { type: 'link', display: 'https://example.com', url: 'https://example.com' },
      { type: 'text', value: '.' },
    ]);
    expect(linkify('see (https://example.com)')).toEqual([
      { type: 'text', value: 'see (' },
      { type: 'link', display: 'https://example.com', url: 'https://example.com' },
      { type: 'text', value: ')' },
    ]);
  });

  it('keeps balanced parens inside the URL', () => {
    // Wikipedia-style URL with balanced parens — should NOT be trimmed.
    const segs = linkify('https://en.wikipedia.org/wiki/Foo_(bar)');
    expect(segs).toEqual([
      {
        type: 'link',
        display: 'https://en.wikipedia.org/wiki/Foo_(bar)',
        url: 'https://en.wikipedia.org/wiki/Foo_(bar)',
      },
    ]);
  });

  it('detects multiple URLs in one message', () => {
    const segs = linkify('a https://x.test b https://y.test c');
    expect(segs).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'link', display: 'https://x.test', url: 'https://x.test' },
      { type: 'text', value: ' b ' },
      { type: 'link', display: 'https://y.test', url: 'https://y.test' },
      { type: 'text', value: ' c' },
    ]);
  });

  it('does NOT match bare domains, mailto:, or tel:', () => {
    expect(linkify('email me at x@example.com or call tel:+15551234')).toEqual([
      { type: 'text', value: 'email me at x@example.com or call tel:+15551234' },
    ]);
  });
});

describe('linkify — regex statefulness', () => {
  it('produces consistent results across consecutive calls', () => {
    // The module-level regex uses the `g` flag; lastIndex must reset.
    const a = linkify('https://a.test foo');
    const b = linkify('https://a.test foo');
    expect(a).toEqual(b);
  });
});

describe('hasLinks', () => {
  it('returns true for text that contains a URL', () => {
    expect(hasLinks('hi https://example.com')).toBe(true);
  });
  it('returns false for plain text', () => {
    expect(hasLinks('hello world')).toBe(false);
  });
  it('returns false for empty input', () => {
    expect(hasLinks('')).toBe(false);
  });
  it('does not leak regex state into subsequent linkify() calls', () => {
    hasLinks('https://x.test');
    expect(linkify('https://x.test')).toEqual([
      { type: 'link', display: 'https://x.test', url: 'https://x.test' },
    ]);
  });
});
