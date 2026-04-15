import { describe, expect, it } from 'vitest';

import { sanitizeSearchExcerpt } from './searchExcerpt';

describe('sanitizeSearchExcerpt — allowed tags', () => {
  it('preserves <em>', () => {
    expect(sanitizeSearchExcerpt('hello <em>world</em>')).toBe(
      'hello <em>world</em>',
    );
  });

  it('preserves <mark> (forward-compat)', () => {
    expect(sanitizeSearchExcerpt('see <mark>match</mark>')).toBe(
      'see <mark>match</mark>',
    );
  });

  it('preserves nested <em> + <mark>', () => {
    expect(
      sanitizeSearchExcerpt('<em>outer <mark>inner</mark></em>'),
    ).toBe('<em>outer <mark>inner</mark></em>');
  });
});

describe('sanitizeSearchExcerpt — unwrapping', () => {
  it('unwraps <strong>', () => {
    expect(
      sanitizeSearchExcerpt('<strong>hi <em>there</em></strong>'),
    ).toBe('hi <em>there</em>');
  });

  it('unwraps <a href>', () => {
    expect(
      sanitizeSearchExcerpt('see <a href="x">the <em>docs</em></a>'),
    ).toBe('see the <em>docs</em>');
  });

  it('unwraps <p> and <div>', () => {
    expect(
      sanitizeSearchExcerpt('<p>one</p><div>two <em>three</em></div>'),
    ).toBe('onetwo <em>three</em>');
  });
});

describe('sanitizeSearchExcerpt — dropped tags + children', () => {
  it('drops <script> tag and its contents', () => {
    expect(
      sanitizeSearchExcerpt('ok <script>alert(1)</script> done'),
    ).toBe('ok  done');
  });

  it('drops <style>', () => {
    expect(
      sanitizeSearchExcerpt('pre <style>body{}</style> post'),
    ).toBe('pre  post');
  });

  it('drops <iframe>', () => {
    expect(
      sanitizeSearchExcerpt('<iframe src="x"></iframe>after'),
    ).toBe('after');
  });

  it('drops <svg>', () => {
    expect(
      sanitizeSearchExcerpt('<svg><path/></svg>plain'),
    ).toBe('plain');
  });
});

describe('sanitizeSearchExcerpt — attribute stripping', () => {
  it('removes attributes from <em>', () => {
    expect(
      sanitizeSearchExcerpt('<em onclick="alert(1)" class="x">match</em>'),
    ).toBe('<em>match</em>');
  });

  it('removes attributes from <mark>', () => {
    expect(
      sanitizeSearchExcerpt('<mark style="color:red" onmouseover="x">hi</mark>'),
    ).toBe('<mark>hi</mark>');
  });
});

describe('sanitizeSearchExcerpt — text escaping', () => {
  it('escapes <, >, & in text', () => {
    expect(sanitizeSearchExcerpt('a & b < c > d')).toBe(
      'a &amp; b &lt; c &gt; d',
    );
  });

  it('preserves em markup alongside plain text with special characters', () => {
    // Raw `&` in the text gets escaped; markup survives intact.
    const out = sanitizeSearchExcerpt('x <em>y</em> & z');
    expect(out).toContain('<em>y</em>');
    expect(out).toContain('&amp;');
    expect(out).not.toContain('<script');
  });
});

describe('sanitizeSearchExcerpt — malformed + edge inputs', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeSearchExcerpt('')).toBe('');
  });

  it('handles unclosed <em>', () => {
    // Browser fixes the markup; fallback unwraps dangling close tags. The
    // match content is preserved either way.
    const out = sanitizeSearchExcerpt('plain <em>unclosed');
    expect(out).toContain('unclosed');
    expect(out).not.toContain('<script');
  });

  it('handles stray close tag', () => {
    expect(sanitizeSearchExcerpt('bare </em> close')).not.toContain('<em>');
  });

  it('drops HTML comments', () => {
    expect(sanitizeSearchExcerpt('a <!-- cmt --> b')).toBe('a  b');
  });
});
