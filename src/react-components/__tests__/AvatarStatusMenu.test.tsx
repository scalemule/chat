// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ChatContext } from '../../shared/ChatContext';
import { AvatarStatusMenu } from '../AvatarStatusMenu';

type Listener = (payload: unknown) => void;

function createMockClient(initial: 'active' | 'away' = 'active') {
  const listeners = new Map<string, Set<Listener>>();
  let status: 'active' | 'away' = initial;
  return {
    getStatus: () => status,
    setStatus: vi.fn((next: 'active' | 'away') => {
      if (status === next) return;
      status = next;
      listeners.get('status:changed')?.forEach((cb) => cb({ status: next }));
    }),
    on(event: string, cb: Listener): () => void {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(cb);
      return () => set!.delete(cb);
    },
  };
}

let currentClient: ReturnType<typeof createMockClient>;
beforeEach(() => {
  currentClient = createMockClient();
});

function renderMenu(props: Partial<React.ComponentProps<typeof AvatarStatusMenu>> = {}) {
  return render(
    <ChatContext.Provider
      value={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: currentClient as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: { baseUrl: 'x', apiKey: 'k' } as any,
      }}
    >
      <AvatarStatusMenu onClose={vi.fn()} {...props} />
    </ChatContext.Provider>,
  );
}

describe('AvatarStatusMenu', () => {
  it('renders Active + Away options', () => {
    renderMenu();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Away')).toBeTruthy();
  });

  it('marks the current status as active', () => {
    currentClient = createMockClient('away');
    renderMenu();
    const awayBtn = screen.getByRole('menuitemradio', { name: /Away/ });
    const activeBtn = screen.getByRole('menuitemradio', { name: /Active/ });
    expect(awayBtn.getAttribute('aria-checked')).toBe('true');
    expect(activeBtn.getAttribute('aria-checked')).toBe('false');
  });

  it('calls setStatus + onClose when the user picks an option', () => {
    const onClose = vi.fn();
    renderMenu({ onClose });
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Away/ }));
    expect(currentClient.setStatus).toHaveBeenCalledWith('away');
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape closes the menu', () => {
    const onClose = vi.fn();
    const { container } = renderMenu({ onClose });
    fireEvent.keyDown(container.querySelector('.sm-avatar-status-menu')!, {
      key: 'Escape',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('honors i18n labels', () => {
    renderMenu({ activeLabel: 'Disponible', awayLabel: 'Ausente' });
    expect(screen.getByText('Disponible')).toBeTruthy();
    expect(screen.getByText('Ausente')).toBeTruthy();
  });

  it('renders the optional headerLabel', () => {
    renderMenu({ headerLabel: 'STATUS' });
    expect(screen.getByText('STATUS')).toBeTruthy();
  });
});
