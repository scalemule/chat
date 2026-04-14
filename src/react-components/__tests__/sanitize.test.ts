// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeHtml, stripTags } from '../sanitize';

describe('sanitizeHtml — safe formatting', () => {
  it('preserves bold, italic, underline, strike', () => {
    expect(sanitizeHtml('<strong>bold</strong>')).toBe('<strong>bold</strong>');
    expect(sanitizeHtml('<em>italic</em>')).toBe('<em>italic</em>');
    expect(sanitizeHtml('<u>underline</u>')).toBe('<u>underline</u>');
    expect(sanitizeHtml('<s>strike</s>')).toBe('<s>strike</s>');
    expect(sanitizeHtml('<b>b</b>')).toBe('<b>b</b>');
    expect(sanitizeHtml('<i>i</i>')).toBe('<i>i</i>');
  });

  it('preserves paragraphs and line breaks', () => {
    expect(sanitizeHtml('<p>hello</p><p>world</p>')).toBe('<p>hello</p><p>world</p>');
    expect(sanitizeHtml('line<br>break')).toBe('line<br>break');
  });

  it('preserves ordered and unordered lists', () => {
    expect(sanitizeHtml('<ul><li>one</li><li>two</li></ul>')).toBe(
      '<ul><li>one</li><li>two</li></ul>',
    );
    expect(sanitizeHtml('<ol><li>a</li><li>b</li></ol>')).toBe(
      '<ol><li>a</li><li>b</li></ol>',
    );
  });

  it('preserves blockquote, inline code, code block', () => {
    expect(sanitizeHtml('<blockquote>quoted</blockquote>')).toBe(
      '<blockquote>quoted</blockquote>',
    );
    expect(sanitizeHtml('<code>inline</code>')).toBe('<code>inline</code>');
    expect(sanitizeHtml('<pre class="ql-syntax">code</pre>')).toBe(
      '<pre class="ql-syntax">code</pre>',
    );
  });

  it('keeps safe http/https/mailto links', () => {
    expect(sanitizeHtml('<a href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com">x</a>',
    );
    expect(sanitizeHtml('<a href="http://example.com">x</a>')).toBe(
      '<a href="http://example.com">x</a>',
    );
    expect(sanitizeHtml('<a href="mailto:a@b.com">x</a>')).toBe(
      '<a href="mailto:a@b.com">x</a>',
    );
  });

  it('forces rel="noopener noreferrer" on target="_blank" links', () => {
    const out = sanitizeHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it('preserves user mentions', () => {
    const mention = '<span class="sm-mention" data-sm-user-id="abc123">@Alice</span>';
    const out = sanitizeHtml(mention);
    expect(out).toContain('class="sm-mention"');
    expect(out).toContain('data-sm-user-id="abc123"');
    expect(out).toContain('@Alice');
  });

  it('preserves channel mentions', () => {
    const mention =
      '<span class="sm-channel-mention" data-sm-channel-id="ch1">#general</span>';
    const out = sanitizeHtml(mention);
    expect(out).toContain('class="sm-channel-mention"');
    expect(out).toContain('data-sm-channel-id="ch1"');
    expect(out).toContain('#general');
  });
});

describe('sanitizeHtml — XSS vectors', () => {
  it('strips <script> and keeps surrounding text', () => {
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>');
  });

  it('strips inline event handlers', () => {
    const out = sanitizeHtml('<a href="https://x.com" onclick="alert(1)">x</a>');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('alert');
  });

  it('strips javascript: href', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('strips data: href', () => {
    const out = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(out).not.toContain('data:');
  });

  it('strips benign disallowed tags but keeps text children', () => {
    expect(sanitizeHtml('<div>text</div>')).toBe('text');
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe('');
  });

  it('drops dangerous tags with their contents', () => {
    expect(sanitizeHtml('<iframe>text</iframe>')).toBe('');
    expect(sanitizeHtml('<script>text</script>')).toBe('');
  });

  it('strips <style> and <form>', () => {
    expect(sanitizeHtml('<style>body{display:none}</style>')).toBe('');
    expect(sanitizeHtml('<form><input></form>')).toBe('');
  });

  it('drops unknown span classes', () => {
    const out = sanitizeHtml('<span class="evil">text</span>');
    expect(out).toContain('text');
    expect(out).not.toContain('class="evil"');
  });

  it('drops unknown pre classes', () => {
    const out = sanitizeHtml('<pre class="malicious">text</pre>');
    expect(out).toContain('<pre>text</pre>');
  });

  it('drops disallowed attributes on allowed tags', () => {
    const out = sanitizeHtml('<p style="color:red" onclick="bad()">x</p>');
    expect(out).not.toContain('style');
    expect(out).not.toContain('onclick');
    expect(out).toContain('<p>x</p>');
  });

  it('drops non-sm data attributes on span', () => {
    const out = sanitizeHtml('<span class="sm-mention" data-evil="1">x</span>');
    expect(out).not.toContain('data-evil');
  });

  it('strips <img> entirely (not on allowlist)', () => {
    const out = sanitizeHtml('<img src="https://x.com/a.png">');
    expect(out).toBe('');
  });

  it('handles nested malicious content', () => {
    const out = sanitizeHtml(
      '<p>safe <script>alert(1)</script><strong>bold</strong></p>',
    );
    expect(out).toBe('<p>safe <strong>bold</strong></p>');
  });
});

describe('sanitizeHtml — edge cases', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(sanitizeHtml('just text')).toBe('just text');
  });

  it('escapes text nodes containing html-like chars', () => {
    expect(sanitizeHtml('a &lt; b')).toContain('&lt;');
  });

  it('preserves multiple classes if all allowlisted', () => {
    const out = sanitizeHtml(
      '<span class="sm-mention sm-channel-mention">x</span>',
    );
    expect(out).toContain('sm-mention');
    expect(out).toContain('sm-channel-mention');
  });

  it('drops non-allowlisted classes mixed with allowlisted ones', () => {
    const out = sanitizeHtml('<span class="sm-mention evil">x</span>');
    expect(out).toContain('sm-mention');
    expect(out).not.toContain('evil');
  });

  it('handles deeply nested Quill output', () => {
    const input =
      '<p><strong><em>bold italic</em></strong></p><ul><li>one</li></ul>';
    const out = sanitizeHtml(input);
    expect(out).toContain('<strong>');
    expect(out).toContain('<em>');
    expect(out).toContain('<li>one</li>');
  });

  it('preserves plain http link without target', () => {
    expect(sanitizeHtml('<a href="https://x.com">x</a>')).toBe(
      '<a href="https://x.com">x</a>',
    );
  });
});

describe('sanitizeHtml — SSR safety', () => {
  it('escapes input when document is undefined', () => {
    const origDoc = globalThis.document;
    const origParser = globalThis.DOMParser;
    // @ts-expect-error simulate SSR
    globalThis.document = undefined;
    // @ts-expect-error simulate SSR
    globalThis.DOMParser = undefined;
    try {
      const out = sanitizeHtml('<p>hi</p><script>alert(1)</script>');
      expect(out).toBe('&lt;p&gt;hi&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    } finally {
      globalThis.document = origDoc;
      globalThis.DOMParser = origParser;
    }
  });
});

describe('stripTags', () => {
  it('removes tags and preserves text', () => {
    expect(stripTags('<p><strong>bold</strong> and <em>italic</em></p>')).toBe(
      'bold and italic',
    );
  });

  it('converts <br> and </p> to newlines', () => {
    expect(stripTags('line1<br>line2')).toBe('line1\nline2');
    expect(stripTags('<p>a</p><p>b</p>')).toBe('a\nb');
  });

  it('decodes common entities', () => {
    expect(stripTags('a &lt; b &amp; c &gt; d')).toBe('a < b & c > d');
    expect(stripTags('&quot;x&quot;')).toBe('"x"');
  });

  it('extracts mention display name', () => {
    expect(
      stripTags(
        'Hello <span class="sm-mention" data-sm-user-id="abc">@Alice</span>!',
      ),
    ).toBe('Hello @Alice!');
  });

  it('collapses 3+ consecutive newlines', () => {
    expect(stripTags('<p>a</p><p>b</p><p>c</p>')).toBe('a\nb\nc');
  });

  it('returns empty string for empty input', () => {
    expect(stripTags('')).toBe('');
  });
});
