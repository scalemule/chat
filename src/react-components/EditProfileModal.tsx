import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getAllTimeZones, type TimeZoneOption } from '../shared/timeZones';

export interface EditProfileFormValues {
  fullName: string;
  locale: string;
  timeZone: string;
}

export interface EditProfileInitialValues extends Partial<EditProfileFormValues> {
  /**
   * Email address. Rendered read-only — email changes live in the auth
   * flow, not in a profile edit form. Omit to hide the email row.
   */
  email?: string | null;
}

export interface EditProfileLabels {
  title?: string;
  name?: string;
  email?: string;
  language?: string;
  timeZone?: string;
  cancel?: string;
  save?: string;
  saving?: string;
  close?: string;
  loading?: string;
  errorGeneric?: string;
}

export interface EditProfileLanguageOption {
  value: string;
  label: string;
}

export interface EditProfileModalProps {
  /** Initial form values — the host resolves these before rendering. */
  initialValues?: EditProfileInitialValues;
  /**
   * Called when the user clicks Save. Host persists the profile and
   * resolves to close the modal, or throws to keep it open and
   * surface the error message.
   */
  onSave: (values: EditProfileFormValues) => void | Promise<void>;
  /** Dismiss the modal (Cancel, Escape, backdrop, close button). */
  onClose: () => void;
  /**
   * When `true`, form inputs disable and a spinner replaces the form
   * body. Useful while the host is still fetching the initial values.
   */
  loading?: boolean;
  /**
   * Language dropdown options. Default empty — pass a list that matches
   * the locales the host platform supports. The SDK deliberately ships
   * no hardcoded language list.
   */
  languages?: EditProfileLanguageOption[];
  /**
   * Time-zone dropdown options. Default uses `getAllTimeZones()` (all
   * IANA zones the runtime knows about, sorted west-to-east).
   */
  timeZones?: TimeZoneOption[];
  /** i18n strings. English defaults. */
  labels?: EditProfileLabels;
}

const defaultLabels: Required<EditProfileLabels> = {
  title: 'Edit profile',
  name: 'Name',
  email: 'Email',
  language: 'Language',
  timeZone: 'Time zone',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  close: 'Close',
  loading: 'Loading…',
  errorGeneric: 'Failed to save',
};

const FOCUSABLE_SELECTOR =
  'input, select, textarea, button, [tabindex]:not([tabindex="-1"])';

/**
 * Modal form for editing own-profile fields (name, locale, time zone).
 * Email is rendered read-only — email changes belong to the auth flow.
 *
 * The SDK does no network I/O: the host fetches `initialValues` and
 * wires `onSave`. If `onSave` throws, the thrown `Error.message` (or
 * the `errorGeneric` label) is rendered in an inline alert, and the
 * modal stays open.
 *
 * Accessibility parity with `<NewConversationModal>` (0.0.50) and
 * `<ChannelEditModal>` (0.0.51): focus trap, Escape to close, backdrop
 * click to close, focus returns to the previously-focused element on
 * close. `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
 * pointing at the title.
 *
 * CSS hooks: `.sm-edit-profile-modal`, `.sm-edit-profile-backdrop`,
 * `.sm-edit-profile-body`, `.sm-edit-profile-footer`,
 * `.sm-edit-profile-field`, `.sm-edit-profile-error`.
 */
export function EditProfileModal({
  initialValues,
  onSave,
  onClose,
  loading = false,
  languages = [],
  timeZones,
  labels,
}: EditProfileModalProps): React.JSX.Element {
  const l = { ...defaultLabels, ...labels };
  const titleId = useRef(`sm-edit-profile-title-${Math.random().toString(36).slice(2, 9)}`);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  const resolvedTimeZones = useMemo<TimeZoneOption[]>(
    () => timeZones ?? getAllTimeZones(),
    [timeZones],
  );

  const [fullName, setFullName] = useState(initialValues?.fullName ?? '');
  const [locale, setLocale] = useState(
    initialValues?.locale ?? languages[0]?.value ?? '',
  );
  const [timeZone, setTimeZone] = useState(
    initialValues?.timeZone ?? resolvedTimeZones[0]?.value ?? 'UTC',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reseed when initial values resolve (e.g. host was still loading on
  // first render).
  useEffect(() => {
    if (!initialValues) return;
    if (initialValues.fullName !== undefined) setFullName(initialValues.fullName ?? '');
    if (initialValues.locale !== undefined) setLocale(initialValues.locale ?? '');
    if (initialValues.timeZone !== undefined)
      setTimeZone(initialValues.timeZone ?? 'UTC');
  }, [
    initialValues?.fullName,
    initialValues?.locale,
    initialValues?.timeZone,
    // initialValues ref change shouldn't re-seed — depend on the actual
    // values so hosts passing a stable reference still trigger updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  // Focus the first field on open; restore focus to the previously-
  // focused element on close.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ fullName: fullName.trim(), locale, timeZone });
    } catch (e) {
      const msg =
        e instanceof Error && e.message ? e.message : l.errorGeneric;
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [saving, onSave, fullName, locale, timeZone, l.errorGeneric]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const container = containerRef.current;
        if (!container) return;
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  return (
    <div
      className="sm-edit-profile-backdrop"
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        ref={containerRef}
        className="sm-edit-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          maxWidth: 448,
          borderRadius: 12,
          background: 'var(--sm-surface, #fff)',
          color: 'var(--sm-text-color, #111827)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
          }}
        >
          <h2
            id={titleId.current}
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {l.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={l.close}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: 'var(--sm-muted-text, #6b7280)',
              cursor: 'pointer',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          className="sm-edit-profile-body"
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px 0',
              }}
            >
              <span
                aria-label={l.loading}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  border: '2px solid var(--sm-border-color, #e5e7eb)',
                  borderTopColor: 'var(--sm-primary, #2563eb)',
                  animation: 'sm-edit-profile-spin 800ms linear infinite',
                }}
              />
              <style>{`
                @keyframes sm-edit-profile-spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : (
            <>
              <div className="sm-edit-profile-field">
                <label
                  htmlFor="sm-edit-profile-name"
                  style={fieldLabelStyle}
                >
                  {l.name}
                </label>
                <input
                  id="sm-edit-profile-name"
                  ref={firstFieldRef}
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={saving}
                  style={fieldInputStyle}
                />
              </div>

              {initialValues?.email != null && (
                <div className="sm-edit-profile-field">
                  <label style={fieldLabelStyle}>{l.email}</label>
                  <input
                    type="email"
                    value={initialValues.email}
                    readOnly
                    style={{
                      ...fieldInputStyle,
                      background: 'var(--sm-surface-muted, #f8fafc)',
                      color: 'var(--sm-muted-text, #6b7280)',
                      cursor: 'not-allowed',
                    }}
                  />
                </div>
              )}

              {languages.length > 0 && (
                <div className="sm-edit-profile-field">
                  <label
                    htmlFor="sm-edit-profile-locale"
                    style={fieldLabelStyle}
                  >
                    {l.language}
                  </label>
                  <select
                    id="sm-edit-profile-locale"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    disabled={saving}
                    style={fieldInputStyle}
                  >
                    {languages.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="sm-edit-profile-field">
                <label
                  htmlFor="sm-edit-profile-tz"
                  style={fieldLabelStyle}
                >
                  {l.timeZone}
                </label>
                <select
                  id="sm-edit-profile-tz"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  disabled={saving}
                  style={fieldInputStyle}
                >
                  {resolvedTimeZones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p
                  className="sm-edit-profile-error"
                  role="alert"
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: 'var(--sm-danger-text, #dc2626)',
                  }}
                >
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="sm-edit-profile-footer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 24px 20px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--sm-border-color, #e5e7eb)',
              background: 'var(--sm-surface, #fff)',
              color: 'var(--sm-text-color, #111827)',
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {l.cancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--sm-primary, #2563eb)',
              color: 'var(--sm-own-text, #fff)',
              fontSize: 13,
              fontWeight: 600,
              cursor: saving || loading ? 'default' : 'pointer',
              opacity: saving || loading ? 0.5 : 1,
            }}
          >
            {saving ? l.saving : l.save}
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--sm-muted-text, #6b7280)',
};

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--sm-border-color, #e5e7eb)',
  background: 'var(--sm-surface, #fff)',
  color: 'var(--sm-text-color, #111827)',
  fontSize: 14,
  outline: 'none',
};
