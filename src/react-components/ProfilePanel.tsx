import React from 'react';

import {
  UserProfileCard,
  type UserProfileCardProps,
} from './UserProfileCard';

export interface ProfilePanelLabels {
  title?: string;
  close?: string;
  back?: string;
}

export interface ProfilePanelProps extends UserProfileCardProps {
  /** Dismiss the panel — the host owns the containing shell. */
  onClose: () => void;
  /**
   * Optional back-arrow target. Useful when the profile panel stacks
   * over a thread view on narrow layouts. Omit for desktop sidebars.
   */
  onBack?: () => void;
  /** Panel-level i18n. Card-level labels still live on the card `labels` prop. */
  panelLabels?: ProfilePanelLabels;
}

const defaultPanelLabels: Required<ProfilePanelLabels> = {
  title: 'Profile',
  close: 'Close',
  back: 'Back',
};

/**
 * Sidebar shell for `<UserProfileCard>`: header (title, optional back
 * arrow, close button) plus the card body. The shell is layout-
 * agnostic — hosts place the panel in whatever container they
 * maintain (fixed right rail, slide-out drawer, stacked mobile view).
 *
 * Every card prop is forwarded, so the full set of `<UserProfileCard>`
 * knobs (ownProfile, onUploadAvatar, onEditProfile, labels, …) works
 * unchanged.
 */
export function ProfilePanel({
  onClose,
  onBack,
  panelLabels,
  ...cardProps
}: ProfilePanelProps): React.JSX.Element {
  const l = { ...defaultPanelLabels, ...panelLabels };

  return (
    <div
      className="sm-profile-panel"
      role="complementary"
      aria-label={l.title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--sm-surface, #fff)',
        color: 'var(--sm-text-color, #111827)',
        overflowY: 'auto',
      }}
    >
      <div
        className="sm-profile-panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px 8px 20px',
          borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
          minHeight: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={l.back}
              className="sm-profile-panel-back"
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
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--sm-text-color, #111827)',
            }}
          >
            {l.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={l.close}
          className="sm-profile-panel-close"
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

      <div className="sm-profile-panel-content">
        <UserProfileCard {...cardProps} />
      </div>
    </div>
  );
}
