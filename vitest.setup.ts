import { vi, beforeAll, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Guard DOM mocks: individual test files may opt into the `node` environment
// (e.g. via `// @vitest-environment node`) for tests that need real
// WebCrypto (jose) rather than jsdom's. This setup file still runs for
// those files, but `window` won't exist.
if (typeof window !== 'undefined') {
  // Mock IntersectionObserver as a proper class (next/link's prefetcher calls `new IntersectionObserver(...)`)
  class MockIntersectionObserver {
    observe() {
      return null;
    }
    unobserve() {
      return null;
    }
    disconnect() {
      return null;
    }
  }
  window.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;

  // Mock ResizeObserver as a proper class
  class MockResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock scrollTo
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

  // Mock requestAnimationFrame
  window.requestAnimationFrame = vi.fn((callback) => {
    return setTimeout(callback, 0);
  }) as unknown as typeof window.requestAnimationFrame;

  window.cancelAnimationFrame = vi.fn((id) => {
    clearTimeout(id);
  }) as unknown as typeof window.cancelAnimationFrame;
}

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Setup before all tests
beforeAll(() => {
  // Suppress console errors during tests (optional)
  // vi.spyOn(console, 'error').mockImplementation(() => {});
});
