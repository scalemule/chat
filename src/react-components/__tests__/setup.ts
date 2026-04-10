// Test setup for React component tests running in jsdom.
//
// jsdom does not implement several DOM APIs that the pre-built React
// components use for scroll management and layout. Stubbing them here keeps
// the tests focused on props/contracts rather than requiring a full browser.

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL's auto-cleanup only runs when a test framework globals wiring is
// present (e.g., via @testing-library/jest-dom). Register it manually so
// the DOM is reset between tests — without this, queries pick up stale
// nodes from previous renders and fail with "multiple elements found".
afterEach(() => {
  cleanup();
});

// scrollIntoView — used by ChatMessageList for auto-scroll on new messages.
// jsdom throws "scrollIntoView is not a function" without this.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {
    /* no-op in tests */
  };
}

// IntersectionObserver — used by ChatMessageList for unread-divider tracking
// and load-more detection. jsdom doesn't implement it.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver {
    observe(): void {
      /* no-op */
    }
    unobserve(): void {
      /* no-op */
    }
    disconnect(): void {
      /* no-op */
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
}

// ResizeObserver — used by ChatInput for auto-grow textarea. jsdom missing.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe(): void {
      /* no-op */
    }
    unobserve(): void {
      /* no-op */
    }
    disconnect(): void {
      /* no-op */
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = MockResizeObserver;
}
