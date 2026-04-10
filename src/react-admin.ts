/**
 * @scalemule/chat/react/admin — admin/rep dashboard components
 *
 * These are the React components intended for rep dashboards and internal
 * admin panels — NOT for customer-facing chat surfaces. They depend on
 * `RepClient` (which in turn requires privileged auth) and are shipped as
 * a separate entry point so normal chat apps don't pay for code they
 * won't use.
 *
 * ## Usage
 *
 * ```tsx
 * import { SupportInbox } from '@scalemule/chat/react';
 * import {
 *   WidgetConfigEditor,
 *   VisitorContextPanel,
 * } from '@scalemule/chat/react/admin';
 *
 * <SupportInbox repClient={repClient} />
 * <VisitorContextPanel repClient={repClient} conversationId={selected} />
 * <WidgetConfigEditor repClient={repClient} />
 * ```
 *
 * Note: `SupportInbox` and `RepStatusToggle` remain in the main
 * `@scalemule/chat/react` entry because they're also commonly embedded in
 * the support widget itself (customer-side visitor can see a rep's presence
 * badge, for example).
 */

export { WidgetConfigEditor } from './react-components/WidgetConfigEditor';
export { VisitorContextPanel } from './react-components/VisitorContextPanel';
