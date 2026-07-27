import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { BookNav } from '@/components/labs/storybook/overlay/nav'
import { SPREAD_COUNT } from '@/components/labs/storybook/content'
import {
  CORNER_BOTTOM_PCT,
  CORNER_H_PCT,
  CORNER_SIDE_PCT,
  CORNER_W_PCT,
} from '@/components/labs/storybook/overlay/corner-hotspot'
import { useStorybookStore } from '@/components/labs/storybook/store'
import { emitTurnLand } from '@/components/labs/storybook/turn-events'
import { ESCAPE_WHISPER, useBookInput } from '@/components/labs/storybook/use-book-input'

const initial = useStorybookStore.getState()
const pill = () => document.querySelector('.sb-nav-pill') as HTMLElement
const whisper = () => document.querySelector('.sb-escape-whisper') as HTMLElement

// spread 2 = "I · The Inn of a Hundred Keys", spread 3 = "II · The Carrier Swarm".
describe('BookNav label sync', () => {
  beforeEach(() => {
    useStorybookStore.setState(initial, true)
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  })
  afterEach(cleanup)

  it('shows the committed spread label at rest', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<BookNav />)
    expect(pill().textContent).toMatch(/The Inn of a Hundred Keys/)
  })

  it('swaps the label on the land cue, together with the overlay, BEFORE commit', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<BookNav />)
    act(() => emitTurnLand({ dir: 'next', to: 3 }))
    // Label previews the destination at the land cue while the store is still 2
    // — matching the overlay text so the two surfaces never disagree mid-turn.
    expect(useStorybookStore.getState().spread).toBe(2)
    expect(pill().textContent).toMatch(/The Carrier Swarm/)
  })

  it('keeps the arrows bound to the COMMITTED spread, not the previewed label', () => {
    act(() => useStorybookStore.setState({ spread: 0 }))
    render(<BookNav />)
    // At the cover the "back" arrow is disabled (committed spread 0) even if a
    // land cue previews spread 1.
    act(() => emitTurnLand({ dir: 'next', to: 1 }))
    expect(screen.getByRole('button', { name: /turn back/i })).toBeDisabled()
  })

  it('reduced motion: label follows the commit, not the land cue', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<BookNav />)
    act(() => emitTurnLand({ dir: 'next', to: 3 }))
    expect(pill().textContent).toMatch(/The Inn of a Hundred Keys/)
    act(() => useStorybookStore.setState({ spread: 3 }))
    expect(pill().textContent).toMatch(/The Carrier Swarm/)
  })
})

// BW-3 / BW-16: all five blind readers found the corner hotspots invisible
// and/or undiscoverable to assistive tech. These lock in the fix — the
// corners stay OUT of the accessibility tree (justified: the labeled arrow
// buttons already give keyboard/AT users a full, equivalent path), but every
// clickable element gets `data-sb-hover` (the quill-cursor trigger) and the
// corners' disabled state now tracks the spread bounds exactly like the
// arrows. A dog-ear only renders on the side that can currently turn.
describe('BookNav corner hotspots', () => {
  const corner = (side: 'left' | 'right'): HTMLButtonElement =>
    document.querySelector(`button.sb-corner--${side}`) as HTMLButtonElement

  beforeEach(() => {
    useStorybookStore.setState(initial, true)
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  })
  afterEach(cleanup)

  it('keeps both corners out of the accessibility tree, with the arrows as the equivalent AT path', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<BookNav />)

    expect(corner('left')).toHaveAttribute('aria-hidden', 'true')
    expect(corner('left')).toHaveAttribute('tabindex', '-1')
    expect(corner('right')).toHaveAttribute('aria-hidden', 'true')
    expect(corner('right')).toHaveAttribute('tabindex', '-1')

    // The screen-reader path: two real, labeled, focusable buttons that fire
    // the same requestTurn the corners do.
    act(() => screen.getByRole('button', { name: /turn back/i }).click())
    expect(useStorybookStore.getState().turning).toBe('prev')
    act(() => useStorybookStore.setState({ turning: null, spread: 2 }))
    act(() => screen.getByRole('button', { name: /turn the page/i }).click())
    expect(useStorybookStore.getState().turning).toBe('next')
  })

  it('disables the back corner at the cover and the forward corner at the last spread, exactly like the arrows', () => {
    act(() => useStorybookStore.setState({ spread: 0 }))
    render(<BookNav />)
    expect(corner('left')).toBeDisabled()
    expect(corner('right')).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /turn back/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /turn the page/i })).not.toBeDisabled()
    cleanup()

    act(() => useStorybookStore.setState({ spread: SPREAD_COUNT - 1 }))
    render(<BookNav />)
    expect(corner('left')).not.toBeDisabled()
    expect(corner('right')).toBeDisabled()
    expect(screen.getByRole('button', { name: /turn back/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /turn the page/i })).toBeDisabled()
  })

  it('gives every clickable chrome element in this file the data-sb-hover cursor trigger', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<BookNav />)
    const buttons = document.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('data-sb-hover')
    })
  })

  it('draws its CSS box from the same constants the hit test runs on (SP-3 b)', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<BookNav />)
    // The law from corner-hotspot.ts's header: one set of numbers for the box
    // the reader sees and the rect use-book-input.ts tests against. The corner
    // no longer touches the viewport's edges — that is desk, not paper.
    for (const side of ['left', 'right'] as const) {
      const style = corner(side).style
      expect(style.width).toBe(`${CORNER_W_PCT}vw`)
      expect(style.height).toBe(`${CORNER_H_PCT}vh`)
      expect(style.bottom).toBe(`${CORNER_BOTTOM_PCT}vh`)
      expect(style[side]).toBe(`${CORNER_SIDE_PCT}vw`)
    }
  })

  it('renders the dog-ear only on the side that can currently turn, and never as the click target', () => {
    act(() => useStorybookStore.setState({ spread: 0 }))
    render(<BookNav />)
    // At the cover: no fold on the disabled "back" corner, a fold on "next".
    expect(corner('left').querySelector('.sb-dogear')).toBeNull()
    expect(corner('right').querySelector('.sb-dogear')).not.toBeNull()
    // The fold never swallows the click — the button underneath still fires.
    act(() => corner('right').click())
    expect(useStorybookStore.getState().turning).toBe('next')
    cleanup()

    act(() => useStorybookStore.setState({ spread: SPREAD_COUNT - 1 }))
    render(<BookNav />)
    expect(corner('left').querySelector('.sb-dogear')).not.toBeNull()
    expect(corner('right').querySelector('.sb-dogear')).toBeNull()
  })
})

// ============================================================================
// SP-3(c) — THE FOLIO IS NOT A BUTTON. It wore the same pill chrome as the two
// arrows beside it ("reads as a button but is fake") while doing nothing at
// all. The chip comes off rather than an action going on: it is the running
// head at the foot of the page, and it now looks like one.
// ============================================================================

describe('BookNav folio', () => {
  beforeEach(() => {
    useStorybookStore.setState(initial, true)
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  })
  afterEach(cleanup)

  it('carries no interactive role, stop, handler or hover trigger', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<BookNav />)

    expect(pill().tagName).toBe('P')
    expect(pill()).not.toHaveAttribute('role')
    expect(pill()).not.toHaveAttribute('tabindex')
    expect(pill()).not.toHaveAttribute('data-sb-hover') // no quill swell
    expect(pill().onclick).toBeNull()
  })

  it('wears no button chrome — nothing that reads as pressable', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<BookNav />)

    const chrome = ['rounded-full', 'border', 'bg-black', 'backdrop-blur']
    for (const token of chrome) expect(pill().className).not.toMatch(token)
    // The layout hook stays: the fixed width is what keeps the arrows from
    // sliding with each chapter's title length.
    expect(pill().className).toMatch('sb-nav-pill')
  })

  it('leaves exactly the two real controls in the accessibility tree', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<BookNav />)
    // The corner hotspots are aria-hidden by design (see above), so every
    // button an AT user can reach here is a labelled, working one.
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    for (const button of buttons) expect(button).toHaveAccessibleName()
  })
})

// ============================================================================
// SP-3(d) — THE ESCAPE WHISPER. use-book-input.ts spends the first Escape on a
// warning instead of the exit; this is the surface that carries it.
// ============================================================================

describe('BookNav escape whisper', () => {
  beforeEach(() => {
    useStorybookStore.setState(initial, true)
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  })
  afterEach(cleanup)

  it('sits silent and unheard until an Escape asks for it', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<BookNav />)
    // Mounted at rest so the copy can fade BOTH ways, but hidden from the
    // page and from AT until it is offered.
    expect(whisper()).toHaveAttribute('data-sb-shown', 'false')
    expect(whisper()).toHaveAttribute('aria-hidden', 'true')
    expect(whisper()?.textContent).toBe(ESCAPE_WHISPER)
    expect(document.querySelector('[role="status"]')?.textContent).toBe('')
  })

  it('raises the whisper — and announces it — on the first Escape', () => {
    act(() => useStorybookStore.setState({ spread: 2, booted: true }))
    render(<BookNav />)
    const { unmount } = renderHook(() => useBookInput(true))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    })

    expect(whisper()).toHaveAttribute('data-sb-shown', 'true')
    // The visible line is decorative; this is what a screen reader hears, so
    // a reader who cannot see the fade still learns the key was caught.
    expect(document.querySelector('[role="status"]')?.textContent).toBe(ESCAPE_WHISPER)
    unmount()
  })
})
