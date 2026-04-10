import React, { useState, useEffect, useCallback, useRef } from 'react';

import type { RepClient, SupportRep } from '../rep';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';

interface RepStatusToggleProps {
  repClient: RepClient;
  userId: string;
  theme?: ChatTheme;
  onStatusChange?: (status: string) => void;
}

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'online', label: 'Online', color: '#10b981' },
  { value: 'away', label: 'Away', color: '#f59e0b' },
  { value: 'offline', label: 'Offline', color: '#9ca3af' },
];

export function RepStatusToggle({
  repClient,
  userId,
  theme,
  onStatusChange,
}: RepStatusToggleProps): React.JSX.Element {
  const [rep, setRep] = useState<SupportRep | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('offline');
  const [isLoading, setIsLoading] = useState(true);
  const mounted = useRef(true);

  // Load initial status
  useEffect(() => {
    mounted.current = true;
    (async () => {
      const result = await repClient.listReps();
      if (!mounted.current) return;
      if (result.data) {
        const myRep = result.data.find((r) => r.user_id === userId);
        if (myRep) {
          setRep(myRep);
          setCurrentStatus(myRep.status);
          // Start heartbeat if already online/away
          if (myRep.status === 'online' || myRep.status === 'away') {
            repClient.startHeartbeat();
          }
        }
      }
      setIsLoading(false);
    })();

    return () => {
      mounted.current = false;
      repClient.stopHeartbeat();
    };
  }, [repClient, userId]);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      setCurrentStatus(newStatus);
      await repClient.updateStatus(newStatus as 'online' | 'away' | 'offline');
      if (newStatus === 'online' || newStatus === 'away') {
        repClient.startHeartbeat();
      } else {
        repClient.stopHeartbeat();
      }
      onStatusChange?.(newStatus);
    },
    [repClient, onStatusChange],
  );

  const statusOption = STATUS_OPTIONS.find((o) => o.value === currentStatus) ?? STATUS_OPTIONS[2];

  if (isLoading) {
    return (
      <div
        data-scalemule-chat=""
        style={{ ...themeToStyle(theme), fontSize: 13, color: 'var(--sm-muted-text, #6b7280)' }}
      >
        Loading...
      </div>
    );
  }

  if (!rep) {
    return (
      <div
        data-scalemule-chat=""
        style={{
          ...themeToStyle(theme),
          fontSize: 13,
          color: 'var(--sm-muted-text, #6b7280)',
          fontFamily: 'var(--sm-font-family)',
        }}
      >
        Not registered
      </div>
    );
  }

  return (
    <div
      data-scalemule-chat=""
      style={{
        ...themeToStyle(theme),
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--sm-font-family)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: statusOption.color,
          flexShrink: 0,
        }}
      />
      <select
        value={currentStatus}
        onChange={(e) => void handleStatusChange(e.target.value)}
        style={{
          border: '1px solid var(--sm-border-color, #e5e7eb)',
          borderRadius: 6,
          padding: '4px 8px',
          fontSize: 13,
          background: 'var(--sm-surface, #fff)',
          color: 'var(--sm-text-color, #111827)',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
