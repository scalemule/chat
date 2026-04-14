/**
 * Client-side HTML sanitizer — defense-in-depth for rendering rich chat messages.
 *
 * The backend `HtmlAllowlistSanitizer` is the authoritative trust boundary;
 * this sanitizer mirrors its allowlist so that host apps (and this SDK's own
 * render path) never dangerouslySetInnerHTML an unfiltered string even if the
 * backend is bypassed.
 *
 * SSR: on the server there is no DOMParser. In that environment we escape the
 * input to plain text — hydration on the client re-runs through DOMParser and
 * swaps the correct sanitized HTML in. Safe because the backend has already
 * sanitized what's stored; this is a defensive cap, not a source of truth.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'span',
  'a',
]);

const GLOBAL_ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  span: new Set(['class', 'data-sm-user-id', 'data-sm-channel-id']),
  pre: new Set(['class']),
};

const SPAN_ALLOWED_CLASSES = new Set(['sm-mention', 'sm-channel-mention']);
const PRE_ALLOWED_CLASSES = new Set(['ql-syntax']);
const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

// Tags whose text content is dangerous or meaningless outside the tag —
// drop both tag AND its children rather than unwrapping to text.
const DANGEROUS_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
  'form',
  'input',
  'textarea',
  'select',
  'button',
  'base',
  'meta',
  'link',
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function isSafeUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // Relative or fragment URLs are allowed (no scheme)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) === false) return true;
  try {
    const url = new URL(trimmed, 'https://placeholder.invalid');
    return ALLOWED_URL_SCHEMES.has(url.protocol.toLowerCase());
  } catch {
    return false;
  }
}

function filterClasses(tag: string, value: string): string | null {
  const allowed = tag === 'span' ? SPAN_ALLOWED_CLASSES : tag === 'pre' ? PRE_ALLOWED_CLASSES : null;
  if (!allowed) return null;
  const kept = value
    .split(/\s+/)
    .filter((cls) => allowed.has(cls));
  return kept.length ? kept.join(' ') : null;
}

function cleanElement(el: Element, doc: Document): Node | null {
  const tag = el.tagName.toLowerCase();
  if (DANGEROUS_TAGS.has(tag)) {
    // Drop tag and its children entirely — script/style contents are not text.
    return null;
  }
  if (!ALLOWED_TAGS.has(tag)) {
    // Drop the tag, keep its text children (recursively cleaned)
    const frag = doc.createDocumentFragment();
    for (const child of Array.from(el.childNodes)) {
      const cleaned = cleanNode(child, doc);
      if (cleaned) frag.appendChild(cleaned);
    }
    return frag;
  }

  const replacement = doc.createElement(tag);
  const tagAttrs = GLOBAL_ALLOWED_ATTRS[tag];

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (!tagAttrs?.has(name)) continue;
    const value = attr.value;

    if (name === 'href') {
      if (!isSafeUrl(value)) continue;
      replacement.setAttribute('href', value);
      continue;
    }
    if (name === 'target') {
      replacement.setAttribute('target', value);
      continue;
    }
    if (name === 'rel') continue; // handled below
    if (name === 'class') {
      const filtered = filterClasses(tag, value);
      if (filtered) replacement.setAttribute('class', filtered);
      continue;
    }
    if (name.startsWith('data-sm-')) {
      replacement.setAttribute(name, value);
      continue;
    }
  }

  // Enforce rel="noopener noreferrer" on links with target="_blank"
  if (tag === 'a' && replacement.getAttribute('target') === '_blank') {
    replacement.setAttribute('rel', 'noopener noreferrer');
  }

  for (const child of Array.from(el.childNodes)) {
    const cleaned = cleanNode(child, doc);
    if (cleaned) replacement.appendChild(cleaned);
  }

  return replacement;
}

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === 3 /* text */) {
    return doc.createTextNode(node.textContent ?? '');
  }
  if (node.nodeType === 1 /* element */) {
    return cleanElement(node as Element, doc);
  }
  return null;
}

/**
 * Sanitize an HTML fragment to the same allowlist as the backend. Returns a
 * safe string suitable for `dangerouslySetInnerHTML`. On the server, returns
 * escaped plain text (see module docs).
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined' || typeof DOMParser === 'undefined') {
    return escapeHtml(html);
  }
  const doc = new DOMParser().parseFromString(
    `<!doctype html><body>${html}</body>`,
    'text/html',
  );
  const body = doc.body;
  const container = doc.createElement('div');
  for (const child of Array.from(body.childNodes)) {
    const cleaned = cleanNode(child, doc);
    if (cleaned) container.appendChild(cleaned);
  }
  return container.innerHTML;
}

/**
 * Strip all HTML tags from a string, decoding common entities. Used as a
 * fallback when a user edits a rich message in the plain edit UI.
 *
 * Regex-based (no DOMParser), SSR-safe. Matches the spirit of the backend's
 * `strip_to_plain_text` but without preserving list/block structure — this
 * helper is for populating an edit textarea, not for rendering.
 */
export function stripTags(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
