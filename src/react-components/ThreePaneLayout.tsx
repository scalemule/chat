import React, { type ReactNode } from 'react';

import { ResizableSidebar } from './ResizableSidebar';

export interface ThreePaneLayoutProps {
  /** Left pane — conversation list / channel browser / nav. */
  sidebar: ReactNode;
  /** Center pane — the active chat thread (the "always-present" column). */
  thread: ReactNode;
  /**
   * Right pane — profile / details / search results. Omit to render a
   * two-pane layout (sidebar + thread) with no right rail; pass a
   * node to reveal the third column.
   */
  profile?: ReactNode;
  /** Initial left-pane width in px. Default 280. */
  sidebarWidth?: number;
  /** Min/max while dragging the left pane. Default 200 / 480. */
  sidebarMinWidth?: number;
  sidebarMaxWidth?: number;
  /** Initial right-pane width in px. Default 360. */
  profileWidth?: number;
  /** Min/max while dragging the right pane. Default 280 / 520. */
  profileMinWidth?: number;
  profileMaxWidth?: number;
  /**
   * localStorage keys for persisting each pane's resolved width.
   * Omit either to keep that pane in-memory only.
   */
  sidebarStorageKey?: string;
  profileStorageKey?: string;
  /** Disable resize on the sidebar (renders a fixed-width pane). */
  sidebarResizable?: boolean;
  /** Disable resize on the profile pane. */
  profileResizable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Three-pane chat shell — sidebar + thread + (optional) profile rail.
 *
 * Layout is a plain flexbox row; each side pane is wrapped in
 * `<ResizableSidebar>` so hosts get drag-to-resize + persistence for
 * free. The center thread pane fills the remaining width.
 *
 * This is intentionally a thin composition; hosts that need a
 * responsive collapse behavior, a mobile drawer, or a slide-in
 * animation should either wrap this component or compose the
 * underlying primitives (`<ResizableSidebar>`) directly.
 *
 * Class hooks: `.sm-three-pane`, `.sm-three-pane-sidebar`,
 * `.sm-three-pane-thread`, `.sm-three-pane-profile`.
 */
export function ThreePaneLayout({
  sidebar,
  thread,
  profile,
  sidebarWidth = 280,
  sidebarMinWidth = 200,
  sidebarMaxWidth = 480,
  profileWidth = 360,
  profileMinWidth = 280,
  profileMaxWidth = 520,
  sidebarStorageKey,
  profileStorageKey,
  sidebarResizable = true,
  profileResizable = true,
  className,
  style,
}: ThreePaneLayoutProps): React.JSX.Element {
  return (
    <div
      className={`sm-three-pane${className ? ` ${className}` : ''}`}
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        background: 'var(--sm-surface, #fff)',
        color: 'var(--sm-text-color, #111827)',
        ...style,
      }}
    >
      <ResizableSidebar
        side="right"
        initialWidth={sidebarWidth}
        minWidth={sidebarMinWidth}
        maxWidth={sidebarMaxWidth}
        storageKey={sidebarStorageKey}
        disabled={!sidebarResizable}
        ariaLabel="Resize conversation sidebar"
        className="sm-three-pane-sidebar"
        style={{
          borderRight: '1px solid var(--sm-border-color, #e5e7eb)',
          overflow: 'hidden',
        }}
      >
        {sidebar}
      </ResizableSidebar>

      <div
        className="sm-three-pane-thread"
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {thread}
      </div>

      {profile && (
        <ResizableSidebar
          side="left"
          initialWidth={profileWidth}
          minWidth={profileMinWidth}
          maxWidth={profileMaxWidth}
          storageKey={profileStorageKey}
          disabled={!profileResizable}
          ariaLabel="Resize profile panel"
          className="sm-three-pane-profile"
          style={{
            borderLeft: '1px solid var(--sm-border-color, #e5e7eb)',
            overflow: 'hidden',
          }}
        >
          {profile}
        </ResizableSidebar>
      )}
    </div>
  );
}
