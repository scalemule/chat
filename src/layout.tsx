/**
 * Opt-in layout primitives. Code-split from the main `/react` bundle
 * so hosts that build their own chat shell don't pay the cost.
 *
 * Usage:
 *
 * ```tsx
 * import { ThreePaneLayout } from '@scalemule/chat/layout';
 *
 * <ThreePaneLayout
 *   sidebar={<ConversationList ... />}
 *   thread={<ChatThread conversationId={active} />}
 *   profile={showProfile ? <ProfilePanel ... /> : null}
 *   sidebarStorageKey="sm-sidebar-width-v1"
 *   profileStorageKey="sm-profile-width-v1"
 * />
 * ```
 *
 * These are deliberately thin compositions. Hosts that need a
 * responsive collapse or mobile-drawer behavior should wrap or
 * replace `<ThreePaneLayout>` with their own shell built on the
 * underlying `<ResizableSidebar>` primitive.
 */

export { ResizableSidebar } from './react-components/ResizableSidebar';
export type { ResizableSidebarProps } from './react-components/ResizableSidebar';

export { ThreePaneLayout } from './react-components/ThreePaneLayout';
export type { ThreePaneLayoutProps } from './react-components/ThreePaneLayout';
