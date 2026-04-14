import React, { useEffect, useRef, useState } from 'react';

/**
 * Responsive format toolbar for `RichTextInput`. Renders Quill format
 * controls in logical groups with tooltips. When the available width shrinks
 * below what fits, trailing groups collapse into an overflow ("...") menu.
 *
 * All class names use the `sm-rich-*` prefix to avoid collisions with host
 * app styles.
 */

export const TOOLBAR_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ['bold', 'italic', 'underline'],
  ['link'],
  ['ordered-list', 'bullet-list'],
  ['blockquote', 'code-block'],
  ['inline-code'],
];

const TOOLBAR_TITLES: Record<string, string> = {
  bold: 'Bold (Ctrl+B)',
  italic: 'Italic (Ctrl+I)',
  underline: 'Underline (Ctrl+U)',
  strike: 'Strikethrough (Ctrl+Shift+X)',
  link: 'Link (Ctrl+K)',
  'ordered-list': 'Ordered List',
  'bullet-list': 'Bulleted List',
  blockquote: 'Quote',
  'code-block': 'Code Block',
  'inline-code': 'Inline Code',
};

export interface ToolbarProps {
  activeFormats: Record<string, unknown>;
  disabled?: boolean;
  onAction: (format: string) => void;
}

export function Toolbar({ activeFormats, disabled, onAction }: ToolbarProps): React.JSX.Element {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const groupWidthsRef = useRef<number[]>([]);
  const [overflowIndex, setOverflowIndex] = useState<number | null>(null);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  // Measure group widths once and observe toolbar width to collapse overflow.
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    function measureGroupWidths() {
      const groups = toolbar!.querySelectorAll<HTMLElement>('.sm-rich-toolbar-group');
      const widths: number[] = [];
      groups.forEach((g) => {
        const prev = g.style.display;
        g.style.display = '';
        widths.push(g.offsetWidth + 2);
        g.style.display = prev;
      });
      if (widths.length > 0) groupWidthsRef.current = widths;
    }

    measureGroupWidths();

    const observer = new ResizeObserver(() => {
      const toolbarWidth = toolbar.clientWidth;
      const widths = groupWidthsRef.current;
      if (widths.length === 0) return;

      const padding = 8;
      const moreButtonWidth = 32;

      const totalWidth = padding + widths.reduce((a, b) => a + b, 0);
      if (totalWidth <= toolbarWidth) {
        setOverflowIndex(null);
        setShowOverflowMenu(false);
        return;
      }

      let usedWidth = padding;
      let cutoff: number | null = null;
      for (let i = 0; i < widths.length; i++) {
        if (usedWidth + widths[i] + moreButtonWidth > toolbarWidth) {
          cutoff = i;
          break;
        }
        usedWidth += widths[i];
      }
      setOverflowIndex(cutoff ?? widths.length);
      if (cutoff === null) setShowOverflowMenu(false);
    });

    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  // Close overflow menu on outside click.
  useEffect(() => {
    if (!showOverflowMenu) return;
    function handleClick(e: MouseEvent) {
      if (
        overflowMenuRef.current &&
        !overflowMenuRef.current.contains(e.target as Node)
      ) {
        setShowOverflowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showOverflowMenu]);

  function isFormatActive(fmt: string): boolean {
    if (fmt === 'inline-code') return !!activeFormats.code;
    if (fmt === 'ordered-list') return activeFormats.list === 'ordered';
    if (fmt === 'bullet-list') return activeFormats.list === 'bullet';
    if (fmt === 'code-block') return !!activeFormats['code-block'];
    return !!activeFormats[fmt];
  }

  function renderButton(fmt: string) {
    return (
      <button
        key={fmt}
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault();
          onAction(fmt);
          setShowOverflowMenu(false);
        }}
        className={`sm-rich-toolbar-btn${
          isFormatActive(fmt) ? ' sm-rich-toolbar-btn-active' : ''
        }`}
        data-tooltip={TOOLBAR_TITLES[fmt] ?? fmt}
        aria-label={TOOLBAR_TITLES[fmt] ?? fmt}
      >
        <ToolbarIcon format={fmt} />
      </button>
    );
  }

  return (
    <>
      <div className="sm-rich-toolbar" ref={toolbarRef}>
        {TOOLBAR_GROUPS.map((group, gi) => (
          <div
            key={gi}
            className="sm-rich-toolbar-group"
            style={
              overflowIndex !== null && gi >= overflowIndex
                ? { display: 'none' }
                : undefined
            }
          >
            {group.map((fmt) => renderButton(fmt))}
            {gi < TOOLBAR_GROUPS.length - 1 && (
              <div className="sm-rich-toolbar-sep" />
            )}
          </div>
        ))}
      </div>

      {overflowIndex !== null && (
        <div ref={overflowMenuRef} className="sm-rich-toolbar-overflow-wrap">
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              setShowOverflowMenu((v) => !v);
            }}
            className="sm-rich-toolbar-btn sm-rich-toolbar-overflow-trigger"
            aria-label="More options"
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="4" cy="10" r="1.5" />
              <circle cx="10" cy="10" r="1.5" />
              <circle cx="16" cy="10" r="1.5" />
            </svg>
          </button>
          {showOverflowMenu && (
            <div className="sm-rich-toolbar-overflow-menu">
              {TOOLBAR_GROUPS.map((group, gi) => {
                if (gi < overflowIndex) return null;
                return (
                  <div key={gi} className="sm-rich-toolbar-group">
                    {group.map((fmt) => renderButton(fmt))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ToolbarIcon({ format }: { format: string }): React.JSX.Element | null {
  switch (format) {
    case 'bold':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.6 10.8c.9-.6 1.4-1.6 1.4-2.7 0-2.2-1.7-3.9-3.9-3.9H7v15.4h7.3c2 0 3.7-1.7 3.7-3.7 0-1.7-.9-3-2.4-3.5zM10 7h3c.8 0 1.5.7 1.5 1.5S13.8 10 13 10h-3V7zm3.5 10h-3.5v-4h3.5c1 0 1.7.8 1.7 2s-.7 2-1.7 2z" />
        </svg>
      );
    case 'italic':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 4v3h2.2l-3.4 10H6v3h8v-3h-2.2l3.4-10H18V4z" />
        </svg>
      );
    case 'underline':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 17c3.3 0 6-2.7 6-6V3h-2.5v8c0 1.9-1.6 3.5-3.5 3.5S8.5 12.9 8.5 11V3H6v8c0 3.3 2.7 6 6 6zM5 19h14v2H5z" />
        </svg>
      );
    case 'strike':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 12v2h12.3c.9.4 1.7 1 1.7 2.2 0 1.6-1.5 2.8-4 2.8-2.9 0-4-1.4-4.1-3H6.4c.1 2.9 2.6 5 6.5 5 3.8 0 6.6-2 6.6-5 0-1-.4-1.7-.9-2.2H21v-2zm3.5-2c-.1-.3-.1-.6-.1-1 0-2.2 2-4 5.1-4 2.5 0 4 1.4 4.1 3h2.5C17.9 5.1 15.2 3 12.5 3c-3.8 0-6.6 2.3-6.6 5.6 0 .4 0 .8.1 1.2z" />
        </svg>
      );
    case 'link':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.9 12c0-1.7 1.4-3.1 3.1-3.1h4V7H7c-2.8 0-5 2.2-5 5s2.2 5 5 5h4v-1.9H7c-1.7 0-3.1-1.4-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.7 0 3.1 1.4 3.1 3.1s-1.4 3.1-3.1 3.1h-4V17h4c2.8 0 5-2.2 5-5s-2.2-5-5-5z" />
        </svg>
      );
    case 'ordered-list':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
        </svg>
      );
    case 'bullet-list':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 10.5c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5zm0-6c-.8 0-1.5.7-1.5 1.5S3.2 7.5 4 7.5 5.5 6.8 5.5 6 4.8 4.5 4 4.5zm0 12c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
        </svg>
      );
    case 'blockquote':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
        </svg>
      );
    case 'code-block':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6z" />
        </svg>
      );
    case 'inline-code':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 17L2 12l5-5 1.4 1.4L4.8 12l3.6 3.6zm10 0l-1.4-1.4L19.2 12l-3.6-3.6L17 7l5 5z" />
        </svg>
      );
    default:
      return null;
  }
}
