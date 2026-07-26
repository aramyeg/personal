import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { BookNav } from '@/components/labs/storybook/overlay/nav'
import { SPREAD_COUNT } from '@/components/labs/storybook/content'
import { useStorybookStore } from '@/components/labs/storybook/store'
import { emitTurnLand } from '@/components/labs/storybook/turn-events'

const initial = useStorybookStore.getState()
const pill = () => document.querySelector('.sb-nav-pill') as HTMLElement

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
    document.querySelector(`button.${side === 'left' ? 'left-0' : 'right-0'}`) as HTMLButtonElement

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
