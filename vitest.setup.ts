import { vi, beforeAll, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock ResizeObserver
const mockResizeObserver = vi.fn();
mockResizeObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.ResizeObserver = mockResizeObserver as unknown as typeof ResizeObserver;

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

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Setup before all tests
beforeAll(() => {
  // Suppress console errors during tests (optional)
  // vi.spyOn(console, 'error').mockImplementation(() => {});
});
