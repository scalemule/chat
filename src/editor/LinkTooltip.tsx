/**
 * Link tooltip + edit modal for `RichTextInput`.
 *
 * The tooltip anchors above a clicked `<a>` in the editor and offers Edit /
 * Remove. The edit modal is a tiny in-editor dialog — text + URL fields,
 * Save/Cancel, Escape to dismiss, focus trap for Tab cycling.
 *
 * Mentions (`.sm-mention` / `.sm-channel-mention`) are NOT surfaced by this
 * tooltip — the tooltip only appears when a real `<a href>` is clicked.
 */

import React, { useEffect, useRef } from 'react';

export interface LinkTooltipData {
  url: string;
  text: string;
  index: number;
  length: number;
  top: number;
  left: number;
}

interface LinkTooltipProps {
  data: LinkTooltipData;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

export function LinkTooltip({
  data,
  onClose,
  onEdit,
  onRemove,
}: LinkTooltipProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="sm-rich-link-tooltip"
      style={{ top: data.top, left: data.left }}
    >
      <button
        type="button"
        className="sm-rich-link-tooltip-close"
        onMouseDown={(e) => {
          e.preventDefault();
          onClose();
        }}
        aria-label="Close"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="sm-rich-link-tooltip-text">{data.text}</div>
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="sm-rich-link-tooltip-url"
      >
        {data.url}
      </a>
      <div className="sm-rich-link-tooltip-actions">
        <button
          type="button"
          className="sm-rich-link-tooltip-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            onEdit();
          }}
        >
          Edit
        </button>
        <button
          type="button"
          className="sm-rich-link-tooltip-btn sm-rich-link-tooltip-btn-danger"
          onMouseDown={(e) => {
            e.preventDefault();
            onRemove();
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

interface LinkEditModalProps {
  initialText: string;
  initialUrl: string;
  onCancel: () => void;
  onSave: (text: string, url: string) => void;
}

export function LinkEditModal({
  initialText,
  initialUrl,
  onCancel,
  onSave,
}: LinkEditModalProps): React.JSX.Element {
  const [text, setText] = React.useState(initialText);
  const [url, setUrl] = React.useState(initialUrl);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Autofocus the appropriate field: URL when text is prefilled, else Text.
  useEffect(() => {
    const el = dialogRef.current?.querySelectorAll<HTMLInputElement>('input');
    if (!el) return;
    (initialText ? el[1] : el[0])?.focus();
  }, [initialText]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    // Basic focus trap
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'input, button',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const canSave = url.trim().length > 0;

  return (
    <div
      className="sm-rich-link-modal-backdrop"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        className="sm-rich-link-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit link"
      >
        <div className="sm-rich-link-modal-header">
          <h3>Edit link</h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="sm-rich-link-modal-close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="sm-rich-link-modal-body">
          <label className="sm-rich-link-modal-label">
            Text
            <input
              ref={firstInputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="sm-rich-link-modal-input"
            />
          </label>
          <label className="sm-rich-link-modal-label">
            Link
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) {
                  e.preventDefault();
                  onSave(text, url.trim());
                }
              }}
              className="sm-rich-link-modal-input"
            />
          </label>
        </div>
        <div className="sm-rich-link-modal-footer">
          <button
            type="button"
            onClick={onCancel}
            className="sm-rich-link-modal-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(text, url.trim())}
            className="sm-rich-link-modal-btn sm-rich-link-modal-btn-primary"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
