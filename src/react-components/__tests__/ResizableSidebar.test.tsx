// @vitest-environment jsdom

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResizableSidebar } from '../ResizableSidebar';

function installMemoryStorage(): { restore: () => void } {
  const store = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    } as Storage,
  });
  return {
    restore: () => {
      if (original) Object.defineProperty(window, 'localStorage', original);
    },
  };
}

describe('<ResizableSidebar>', () => {
  let storage: { restore: () => void };

  beforeEach(() => {
    storage = installMemoryStorage();
  });

  afterEach(() => {
    storage.restore();
  });

  it('renders children at the initial width', () => {
    const { container } = render(
      <ResizableSidebar initialWidth={300}>
        <div>content</div>
      </ResizableSidebar>,
    );
    const wrapper = container.querySelector<HTMLElement>(
      '.sm-resizable-sidebar',
    );
    expect(wrapper?.style.width).toBe('300px');
  });

  it('renders the drag handle when not disabled', () => {
    const { container } = render(
      <ResizableSidebar>
        <div>x</div>
      </ResizableSidebar>,
    );
    expect(
      container.querySelector('.sm-resizable-sidebar-handle'),
    ).toBeTruthy();
  });

  it('omits the handle when disabled', () => {
    const { container } = render(
      <ResizableSidebar disabled>
        <div>x</div>
      </ResizableSidebar>,
    );
    expect(
      container.querySelector('.sm-resizable-sidebar-handle'),
    ).toBeNull();
  });

  it('exposes the current width via aria-valuenow', () => {
    const { container } = render(
      <ResizableSidebar initialWidth={240}>
        <div>x</div>
      </ResizableSidebar>,
    );
    expect(
      container
        .querySelector('.sm-resizable-sidebar-handle')
        ?.getAttribute('aria-valuenow'),
    ).toBe('240');
  });

  it('persists width to localStorage on drag', () => {
    const { container } = render(
      <ResizableSidebar
        initialWidth={280}
        minWidth={200}
        maxWidth={480}
        storageKey="my-sidebar"
      >
        <div>x</div>
      </ResizableSidebar>,
    );
    const handle = container.querySelector(
      '.sm-resizable-sidebar-handle',
    )!;

    // Simulate a drag: pointer down at x=100, move to x=150 (+50), up.
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 150 });
    fireEvent.mouseUp(window, { clientX: 150 });

    const wrapper = container.querySelector<HTMLElement>(
      '.sm-resizable-sidebar',
    );
    expect(wrapper?.style.width).toBe('330px');
    expect(window.localStorage.getItem('my-sidebar')).toBe('330');
  });

  it('clamps drag to min/max width', () => {
    const { container } = render(
      <ResizableSidebar initialWidth={280} minWidth={200} maxWidth={400}>
        <div>x</div>
      </ResizableSidebar>,
    );
    const handle = container.querySelector(
      '.sm-resizable-sidebar-handle',
    )!;
    // Try to shrink below minWidth
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 0 });
    fireEvent.mouseUp(window, { clientX: 0 });
    let wrapper = container.querySelector<HTMLElement>(
      '.sm-resizable-sidebar',
    );
    expect(wrapper?.style.width).toBe('200px');

    // Try to grow above maxWidth
    fireEvent.mouseDown(handle, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 999 });
    fireEvent.mouseUp(window, { clientX: 999 });
    wrapper = container.querySelector<HTMLElement>('.sm-resizable-sidebar');
    expect(wrapper?.style.width).toBe('400px');
  });

  it('inverts drag direction for side="left"', () => {
    const { container } = render(
      <ResizableSidebar
        initialWidth={280}
        minWidth={100}
        maxWidth={400}
        side="left"
      >
        <div>x</div>
      </ResizableSidebar>,
    );
    const handle = container.querySelector(
      '.sm-resizable-sidebar-handle',
    )!;
    // Drag right (positive dx) on a left-handle should SHRINK the pane.
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 150 });
    fireEvent.mouseUp(window, { clientX: 150 });
    const wrapper = container.querySelector<HTMLElement>(
      '.sm-resizable-sidebar',
    );
    expect(wrapper?.style.width).toBe('230px');
  });

  it('rehydrates from localStorage on mount when storageKey is set', () => {
    window.localStorage.setItem('my-sidebar-rehydrate', '320');
    const onWidthChange = vi.fn();
    const { container } = render(
      <ResizableSidebar
        initialWidth={200}
        minWidth={150}
        maxWidth={400}
        storageKey="my-sidebar-rehydrate"
        onWidthChange={onWidthChange}
      >
        <div>x</div>
      </ResizableSidebar>,
    );
    const wrapper = container.querySelector<HTMLElement>(
      '.sm-resizable-sidebar',
    );
    expect(wrapper?.style.width).toBe('320px');
    expect(onWidthChange).toHaveBeenCalledWith(320);
  });

  it('keyboard: ArrowRight widens by 16px, Shift+ArrowRight by 64px', () => {
    const { container } = render(
      <ResizableSidebar initialWidth={280}>
        <div>x</div>
      </ResizableSidebar>,
    );
    const handle = container.querySelector(
      '.sm-resizable-sidebar-handle',
    )!;
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    let wrapper = container.querySelector<HTMLElement>(
      '.sm-resizable-sidebar',
    );
    expect(wrapper?.style.width).toBe('296px');

    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
    wrapper = container.querySelector<HTMLElement>('.sm-resizable-sidebar');
    expect(wrapper?.style.width).toBe('360px');
  });

  it('keyboard: Home jumps to minWidth, End to maxWidth', () => {
    const { container } = render(
      <ResizableSidebar initialWidth={280} minWidth={150} maxWidth={400}>
        <div>x</div>
      </ResizableSidebar>,
    );
    const handle = container.querySelector(
      '.sm-resizable-sidebar-handle',
    )!;
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(
      (container.querySelector<HTMLElement>('.sm-resizable-sidebar'))!
        .style.width,
    ).toBe('150px');
    fireEvent.keyDown(handle, { key: 'End' });
    expect(
      (container.querySelector<HTMLElement>('.sm-resizable-sidebar'))!
        .style.width,
    ).toBe('400px');
  });

  it('fires onWidthChange during drag', () => {
    const onWidthChange = vi.fn();
    const { container } = render(
      <ResizableSidebar
        initialWidth={280}
        onWidthChange={onWidthChange}
      >
        <div>x</div>
      </ResizableSidebar>,
    );
    const handle = container.querySelector(
      '.sm-resizable-sidebar-handle',
    )!;
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 130 });
    fireEvent.mouseUp(window, { clientX: 130 });
    expect(onWidthChange).toHaveBeenCalledWith(310);
  });
});
