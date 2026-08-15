import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GlyphCursor } from '@/components/labs/memory-card/cursor'

describe('GlyphCursor', () => {
  it('renders nothing on first paint', () => {
    const { container } = render(<GlyphCursor />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the dot once a real pointermove event arrives', () => {
    const { container } = render(<GlyphCursor />)
    expect(container).toBeEmptyDOMElement()

    fireEvent(window, new PointerEvent('pointermove', { clientX: 120, clientY: 80 }))

    expect(screen.getByTestId('glyph-cursor')).toBeInTheDocument()
  })

  // Same matcher shape vitest.setup.ts installs globally, but with `matches`
  // driven by the query string so a single override can stand in for either
  // `(prefers-reduced-motion: reduce)` or `(pointer: coarse)`.
  function mockMatchMedia(matchesFor: (query: string) => boolean) {
    return vi.fn((query: string) => ({
      matches: matchesFor(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  }

  // Reduced-motion hiding is gated by framer-motion's `useReducedMotion()`
  // (the same hook every section in this lab already relies on for its own
  // reduced-motion branch) rather than a matchMedia check this file owns,
  // and that hook memoizes its query result process-wide — a per-test
  // matchMedia override here would just prove the mock, not the component.
  // Reduced-motion hiding is exercised live instead (self-check).

  it('stays hidden under a coarse pointer, even after a pointermove', () => {
    const original = window.matchMedia
    window.matchMedia = mockMatchMedia((q) => q.includes('coarse'))
    try {
      const { container } = render(<GlyphCursor />)
      fireEvent(window, new PointerEvent('pointermove', { clientX: 120, clientY: 80 }))
      expect(container).toBeEmptyDOMElement()
    } finally {
      window.matchMedia = original
    }
  })
})
