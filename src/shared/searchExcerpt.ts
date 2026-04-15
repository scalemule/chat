/**
 * Sanitize a single search-result excerpt.
 *
 * Excerpts come back from the chat service's OpenSearch highlights and
 * normally only contain `<em>` wrapping the matched term. This helper
 * accepts untrusted excerpt HTML and returns a safe subset:
 *
 *   - `<em>` and `<mark>` tags preserved (both variants, so the UI
 *     layer stays stable if the backend ever switches highlight tags).
 *   - All other tags are *unwrapped* — their children render as text.
 *   - `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`,
 *     `<svg>`, `<noscript>`, `<template>` are dropped with their
 *     contents (no unwrap).
 *   - All attributes on preserved tags are stripped — OpenSearch
 *     doesn't emit any; defensive against upstream changes.
 *   - Text is HTML-escaped.
 *
 * Pure: safe to call at module top level, under SSR, inside workers.
 * DOMParser access is guarded behind `typeof window` + lazy — the
 * regex fallback handles SSR / worker environments without throwing.
 */

const ALLOWED_TAGS = new Set(['em', 'mark']);

// Drop tag + children. Anything else that's not allowed is *unwrapped*
// (children kept, tags stripped).
const DROP_WITH_CHILDREN = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'noscript',
  'template',
]);

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hasDom(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.DOMParser !== 'undefined'
  );
}

function domSanitize(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild as Element | null;
  if (!root) return '';
  return serializeNode(root);
}

function serializeNode(node: Node): string {
  let out = '';
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 3) {
      // Text node — escape it. Browser has already decoded entities, so
      // we re-escape to prevent them round-tripping as raw HTML.
      out += escapeText(child.nodeValue ?? '');
      continue;
    }
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (DROP_WITH_CHILDREN.has(tag)) continue;
    const inner = serializeNode(el);
    if (ALLOWED_TAGS.has(tag)) {
      // Preserve the tag, drop all attributes.
      out += `<${tag}>${inner}</${tag}>`;
    } else {
      // Unwrap — emit inner content only.
      out += inner;
    }
  }
  return out;
}

// --- Non-DOM fallback (SSR / workers) --------------------------------
//
// Tiny regex-based walker. Strips `<script>` / `<style>` etc. with
// children, unwraps any non-allowed tag, preserves bare `<em>` /
// `<mark>` (open, close, and self-closing variants), and escapes the
// remaining text.
//
// Rationale: excerpts are short (O(100) chars) and come from a trusted
// internal service — the fallback only needs to keep the output safe
// when rendered via dangerouslySetInnerHTML on the server.

const TOKEN_RE = /<\/?[a-zA-Z][^>]*>|<!--[\s\S]*?-->/g;

function fallbackSanitize(html: string): string {
  // Step 1: drop script/style/etc. tags + their contents entirely.
  let working = html;
  for (const tag of DROP_WITH_CHILDREN) {
    // Non-greedy match; handles nested same-tag occurrences reasonably
    // for the short excerpt inputs we expect.
    const re = new RegExp(
      `<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,
      'gi',
    );
    working = working.replace(re, '');
    // Unclosed variants — drop them too.
    const reOpen = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*$`, 'gi');
    working = working.replace(reOpen, '');
  }

  // Step 2: tokenize into tags + text and emit the safe subset.
  let out = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(working)) !== null) {
    const text = working.slice(lastIndex, match.index);
    if (text) out += escapeText(text);
    lastIndex = match.index + match[0].length;
    const token = match[0];
    if (token.startsWith('<!--')) continue;
    const m = /^<\/?\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(token);
    if (!m) continue;
    const tag = m[1].toLowerCase();
    if (DROP_WITH_CHILDREN.has(tag)) continue;
    if (!ALLOWED_TAGS.has(tag)) continue; // unwrap — drop the token
    const isClose = token.startsWith('</');
    out += isClose ? `</${tag}>` : `<${tag}>`;
  }
  const trailing = working.slice(lastIndex);
  if (trailing) out += escapeText(trailing);
  return out;
}

export function sanitizeSearchExcerpt(html: string): string {
  if (!html) return '';
  try {
    if (hasDom()) return domSanitize(html);
  } catch {
    // Fall through to regex path.
  }
  return fallbackSanitize(html);
}
