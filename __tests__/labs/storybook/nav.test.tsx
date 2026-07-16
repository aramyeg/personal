import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { BookNav } from '@/components/labs/storybook/overlay/nav'
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
