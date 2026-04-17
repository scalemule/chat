import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { readJson, writeJson } from '../shared/safeStorage';

export interface ResizableSidebarProps {
  /** Content of the pane — the drag handle renders alongside, not inside. */
  children: ReactNode;
  /**
   * Which edge the drag handle sits on. `'right'` for a left-mounted
   * sidebar (drag the right edge to widen), `'left'` for a right-
   * mounted pane (drag the left edge). Default `'right'`.
   */
  side?: 'left' | 'right';
  /** Pixel width used on first render. Default 280. */
  initialWidth?: number;
  /** Lower clamp while dragging. Default 200. */
  minWidth?: number;
  /** Upper clamp while dragging. Default 480. */
  maxWidth?: number;
  /**
   * localStorage key to persist the resolved width. Omit to keep the
   * width in-memory only (resets on reload).
   */
  storageKey?: string;
  /** Fires with the new pixel width after each drag / storage rehydrate. */
  onWidthChange?: (width: number) => void;
  /** Allow hosts to suppress resize entirely (pane still renders, no handle). */
  disabled?: boolean;
  /** Accessible label for the drag handle. Default `"Resize sidebar"`. */
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Generic resizable-pane wrapper: renders its children at a
 * dynamically-controlled width with a thin drag handle on the
 * configured edge. Persists the width to localStorage when
 * `storageKey` is set; clamps to `[minWidth, maxWidth]` while
 * dragging; supports pointer + touch (Pointer Events with touch
 * fallback) and keyboard nudge (ArrowLeft/ArrowRight ± 16px,
 * Shift+arrow ± 64px, Home/End jump to clamp).
 *
 * SSR-safe — on first render uses `initialWidth`, then reads
 * `storageKey` (when set) on mount and swaps.
 *
 * Class hooks: `.sm-resizable-sidebar`, `.sm-resizable-sidebar-handle`,
 * `.sm-resizable-sidebar-handle-dragging`. Inline styles cover the
 * default appearance so hosts that skip theme CSS still see a
 * functional handle.
 */
export function ResizableSidebar({
  children,
  side = 'right',
  initialWidth = 280,
  minWidth = 200,
  maxWidth = 480,
  storageKey,
  onWidthChange,
  disabled = false,
  ariaLabel = 'Resize sidebar',
  className,
  style,
}: ResizableSidebarProps): React.JSX.Element {
  const [width, setWidth] = useState<number>(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(initialWidth);

  // Rehydrate from storage on mount.
  useEffect(() => {
    if (!storageKey) return;
    const stored = readJson<number>(storageKey);
    if (typeof stored === 'number' && stored >= minWidth && stored <= maxWidth) {
      setWidth(stored);
      onWidthChange?.(stored);
    }
    // Re-run only if the storage key changes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const clamp = useCallback(
    (w: number) => Math.max(minWidth, Math.min(maxWidth, Math.round(w))),
    [minWidth, maxWidth],
  );

  const commit = useCallback(
    (next: number) => {
      const clamped = clamp(next);
      setWidth(clamped);
      if (storageKey) writeJson(storageKey, clamped);
      onWidthChange?.(clamped);
    },
    [clamp, storageKey, onWidthChange],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      draggingRef.current = true;
      setIsDragging(true);

      // Attach window-level move/up listeners so we keep tracking
      // even if the pointer leaves the handle.
      const onMove = (ev: MouseEvent): void => {
        if (!draggingRef.current) return;
        const dx = ev.clientX - startXRef.current;
        const direction = side === 'right' ? 1 : -1;
        commit(startWidthRef.current + dx * direction);
      };
      const onUp = (): void => {
        draggingRef.current = false;
        setIsDragging(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [disabled, width, side, commit],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (disabled) return;
      const touch = e.touches[0];
      if (!touch) return;
      startXRef.current = touch.clientX;
      startWidthRef.current = width;
      draggingRef.current = true;
      setIsDragging(true);

      const onMove = (ev: TouchEvent): void => {
        if (!draggingRef.current) return;
        const t = ev.touches[0];
        if (!t) return;
        const dx = t.clientX - startXRef.current;
        const direction = side === 'right' ? 1 : -1;
        commit(startWidthRef.current + dx * direction);
      };
      const onEnd = (): void => {
        draggingRef.current = false;
        setIsDragging(false);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        window.removeEventListener('touchcancel', onEnd);
      };
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);
      window.addEventListener('touchcancel', onEnd);
    },
    [disabled, width, side, commit],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const direction = side === 'right' ? 1 : -1;
      const step = e.shiftKey ? 64 : 16;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        commit(width - step * direction);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        commit(width + step * direction);
      } else if (e.key === 'Home') {
        e.preventDefault();
        commit(minWidth);
      } else if (e.key === 'End') {
        e.preventDefault();
        commit(maxWidth);
      }
    },
    [disabled, side, width, commit, minWidth, maxWidth],
  );

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    [side]: -3,
    width: 6,
    cursor: disabled ? 'default' : 'col-resize',
    background: isDragging
      ? 'var(--sm-primary, #2563eb)'
      : 'transparent',
    transition: 'background-color 120ms ease-in-out',
    zIndex: 1,
    touchAction: 'none',
  };

  return (
    <div
      className={`sm-resizable-sidebar${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        flexShrink: 0,
        width,
        height: '100%',
        ...style,
      }}
    >
      {children}
      {!disabled && (
        <div
          className={`sm-resizable-sidebar-handle${
            isDragging ? ' sm-resizable-sidebar-handle-dragging' : ''
          }`}
          role="separator"
          aria-label={ariaLabel}
          aria-orientation="vertical"
          aria-valuenow={width}
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          tabIndex={0}
          style={handleStyle}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onKeyDown={onKeyDown}
          onMouseEnter={(e) => {
            if (!isDragging) {
              (e.currentTarget as HTMLDivElement).style.background =
                'var(--sm-border-color, #e5e7eb)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDragging) {
              (e.currentTarget as HTMLDivElement).style.background =
                'transparent';
            }
          }}
        />
      )}
    </div>
  );
}
