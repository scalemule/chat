import React, { useCallback, useEffect, useState } from 'react';

import type {
  RepClient,
  UpdateWidgetConfigOptions,
} from '../rep';
import type { SupportWidgetConfig } from '../support';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';

/**
 * <WidgetConfigEditor> — drop-in admin UI for editing the support widget
 * configuration (appearance, content, behavior). Wires directly to
 * RepClient.getWidgetConfig() and RepClient.updateWidgetConfig().
 *
 * Intended for rep dashboards and admin panels. Follows the SDK's theming
 * conventions (--sm-* CSS vars); combine with @scalemule/chat/themes/tailwind
 * or /themes/shadcn to inherit host theme colors automatically.
 *
 * ```tsx
 * import { WidgetConfigEditor } from '@scalemule/chat/react';
 *
 * <WidgetConfigEditor
 *   repClient={repClient}
 *   onSaved={() => toast('Widget updated')}
 * />
 * ```
 */
interface WidgetConfigEditorProps {
  repClient: RepClient;
  theme?: ChatTheme;
  /** Called after a successful save. */
  onSaved?: (config: SupportWidgetConfig) => void;
  /** Called on error. Default: console.error. */
  onError?: (error: { message: string }) => void;
}

type Tab = 'appearance' | 'content' | 'behavior';

const TABS: { id: Tab; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'content', label: 'Content' },
  { id: 'behavior', label: 'Behavior' },
];

export function WidgetConfigEditor({
  repClient,
  theme,
  onSaved,
  onError,
}: WidgetConfigEditorProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('appearance');
  const [config, setConfig] = useState<SupportWidgetConfig | null>(null);
  const [draft, setDraft] = useState<UpdateWidgetConfigOptions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Fetch config on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void repClient.getWidgetConfig().then((result) => {
      if (cancelled) return;
      if (result.data) {
        setConfig(result.data);
      } else if (result.error) {
        setError(result.error.message);
        onError?.(result.error);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [repClient, onError]);

  const isDirty = Object.keys(draft).length > 0;

  const update = useCallback(
    <K extends keyof UpdateWidgetConfigOptions>(
      key: K,
      value: UpdateWidgetConfigOptions[K],
    ) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    setError(null);
    const result = await repClient.updateWidgetConfig(draft);
    setIsSaving(false);
    if (result.data) {
      setConfig(result.data);
      setDraft({});
      setSavedAt(Date.now());
      onSaved?.(result.data);
    } else if (result.error) {
      setError(result.error.message);
      onError?.(result.error);
    }
  }, [draft, isDirty, isSaving, repClient, onSaved, onError]);

  const handleReset = useCallback(() => {
    setDraft({});
    setError(null);
  }, []);

  // Merged view: draft overrides persisted config
  const view = { ...(config ?? {}), ...draft } as SupportWidgetConfig;

  if (isLoading) {
    return (
      <div
        data-scalemule-chat=""
        style={{
          ...themeToStyle(theme),
          padding: 32,
          textAlign: 'center',
          color: 'var(--sm-muted-text, #6b7280)',
          fontFamily: 'var(--sm-font-family)',
        }}
      >
        Loading widget configuration...
      </div>
    );
  }

  return (
    <div
      data-scalemule-chat=""
      style={{
        ...themeToStyle(theme),
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        borderRadius: 'var(--sm-border-radius, 16px)',
        background: 'var(--sm-surface, #fff)',
        color: 'var(--sm-text-color, #111827)',
        fontFamily: 'var(--sm-font-family)',
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
          background: 'var(--sm-surface-muted, #f8fafc)',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom:
                activeTab === tab.id
                  ? '2px solid var(--sm-primary, #2563eb)'
                  : '2px solid transparent',
              color:
                activeTab === tab.id
                  ? 'var(--sm-primary, #2563eb)'
                  : 'var(--sm-muted-text, #6b7280)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {activeTab === 'appearance' && (
          <>
            <Field label="Title">
              <TextInput
                value={view.title ?? ''}
                onChange={(v) => update('title', v)}
              />
            </Field>
            <Field label="Subtitle">
              <TextInput
                value={view.subtitle ?? ''}
                onChange={(v) => update('subtitle', v)}
              />
            </Field>
            <Field label="Primary color">
              <TextInput
                value={view.primary_color ?? ''}
                onChange={(v) => update('primary_color', v)}
                placeholder="#2563eb"
              />
            </Field>
            <Field label="Position">
              <select
                value={view.position ?? 'right'}
                onChange={(e) =>
                  update('position', e.target.value as 'left' | 'right')
                }
                style={selectStyle}
              >
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </Field>
          </>
        )}

        {activeTab === 'content' && (
          <>
            <Field label="Welcome message">
              <TextArea
                value={view.welcome_message ?? ''}
                onChange={(v) => update('welcome_message', v)}
                rows={2}
              />
            </Field>
            <Field label="Offline message">
              <TextArea
                value={view.offline_message ?? ''}
                onChange={(v) => update('offline_message', v)}
                rows={2}
              />
            </Field>
            <Field label={`Pre-chat fields (${view.pre_chat_fields?.length ?? 0})`}>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--sm-muted-text, #6b7280)',
                }}
              >
                {view.pre_chat_fields?.length
                  ? view.pre_chat_fields.map((f) => f.label).join(', ')
                  : 'None configured'}
              </div>
            </Field>
          </>
        )}

        {activeTab === 'behavior' && (
          <>
            <Field label="Real-time updates">
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={view.realtime_enabled ?? false}
                  onChange={(e) => update('realtime_enabled', e.target.checked)}
                />
                Enable WebSocket delivery
              </label>
            </Field>
            <Field label="Business hours">
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--sm-muted-text, #6b7280)',
                }}
              >
                {view.business_hours && Object.keys(view.business_hours).length > 0
                  ? `${Object.keys(view.business_hours).length} entries`
                  : 'Not configured'}
              </div>
            </Field>
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: 16,
          borderTop: '1px solid var(--sm-border-color, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'var(--sm-surface-muted, #f8fafc)',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--sm-muted-text, #6b7280)' }}>
          {error ? (
            <span style={{ color: '#dc2626' }}>{error}</span>
          ) : savedAt && !isDirty ? (
            'Saved'
          ) : isDirty ? (
            'Unsaved changes'
          ) : (
            'No changes'
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--sm-border-color, #e5e7eb)',
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--sm-text-color, #111827)',
              fontSize: 14,
              cursor: isDirty && !isSaving ? 'pointer' : 'not-allowed',
              opacity: isDirty && !isSaving ? 1 : 0.4,
            }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || isSaving}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 8,
              background: 'var(--sm-primary, #2563eb)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: isDirty && !isSaving ? 'pointer' : 'not-allowed',
              opacity: isDirty && !isSaving ? 1 : 0.4,
            }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- internal helpers ---------- */

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--sm-border-color, #e5e7eb)',
  borderRadius: 8,
  fontSize: 14,
  background: 'var(--sm-surface, #fff)',
  color: 'var(--sm-text-color, #111827)',
  outline: 'none',
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--sm-text-color, #111827)',
      }}
    >
      {label}
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): React.JSX.Element {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '8px 12px',
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        borderRadius: 8,
        fontSize: 14,
        background: 'var(--sm-surface, #fff)',
        color: 'var(--sm-text-color, #111827)',
        fontFamily: 'inherit',
        outline: 'none',
      }}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}): React.JSX.Element {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '8px 12px',
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        borderRadius: 8,
        fontSize: 14,
        background: 'var(--sm-surface, #fff)',
        color: 'var(--sm-text-color, #111827)',
        fontFamily: 'inherit',
        outline: 'none',
        resize: 'vertical',
        boxSizing: 'border-box',
      }}
    />
  );
}
