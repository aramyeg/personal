import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { SpreadOverlay } from '@/components/labs/storybook/overlay/spread-overlay'
import { useStorybookStore } from '@/components/labs/storybook/store'
import { emitTurnLand, emitTurnStart } from '@/components/labs/storybook/turn-events'

const initial = useStorybookStore.getState()

const overlay = () => document.querySelector('.sb-overlay') as HTMLElement

// spread 2 = "Chapter the First", spread 3 = "Chapter the Second" (content.ts).
describe('SpreadOverlay page-turn choreography', () => {
  beforeEach(() => {
    useStorybookStore.setState(initial, true)
    // Default (non-reduced) matchMedia so the bridge subscription is active.
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

  it('rests on the committed spread with no exit phase', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<SpreadOverlay />)
    expect(screen.getByText('Chapter the First')).toBeInTheDocument()
    expect(overlay()).toHaveAttribute('data-sb-phase', 'resting')
  })

  it('is hidden on the closed cover (spread 0) so the portrait toggle cannot dangle', () => {
    act(() => useStorybookStore.setState({ spread: 0 }))
    render(<SpreadOverlay />)
    expect(overlay()).toHaveStyle({ opacity: '0' })
    // Opening to the title lands the title text (the cover-open land cue).
    act(() => emitTurnLand({ dir: 'next', to: 1 }))
    expect(overlay()).not.toHaveStyle({ opacity: '0' })
    expect(screen.getByText(/the tale begins/i)).toBeInTheDocument()
  })

  it('enters the exit phase when a turn arms', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<SpreadOverlay />)
    act(() => emitTurnStart({ dir: 'next', from: 2 }))
    expect(overlay()).toHaveAttribute('data-sb-phase', 'exiting')
    // The outgoing text is still mounted while it exits (it animates away).
    expect(screen.getByText('Chapter the First')).toBeInTheDocument()
  })

  it('delivers the incoming spread at the land cue, BEFORE the store commits', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<SpreadOverlay />)
    act(() => emitTurnStart({ dir: 'next', from: 2 }))
    act(() => emitTurnLand({ dir: 'next', to: 3 }))
    // Content swapped to the destination even though the store is still on 2 —
    // the text lands a beat before the page settles (spec E-P3).
    expect(useStorybookStore.getState().spread).toBe(2)
    expect(screen.getByText('Chapter the Second')).toBeInTheDocument()
    expect(screen.queryByText('Chapter the First')).not.toBeInTheDocument()
    expect(overlay()).toHaveAttribute('data-sb-phase', 'resting')
  })

  it('remounts the panel on landing so the entrance replays (fresh key)', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<SpreadOverlay />)
    const before = document.getElementById('sb-drawer-panel')
    act(() => emitTurnLand({ dir: 'next', to: 3 }))
    const after = document.getElementById('sb-drawer-panel')
    // React re-keys #sb-drawer-panel by the shown spread → a new DOM node,
    // which is what makes the CSS entrance animation run again.
    expect(after).not.toBe(before)
  })

  it('reconciles with the committed spread when it finally advances', () => {
    act(() => useStorybookStore.setState({ spread: 2 }))
    render(<SpreadOverlay />)
    act(() => emitTurnLand({ dir: 'next', to: 3 }))
    act(() => useStorybookStore.setState({ spread: 3 }))
    expect(screen.getByText('Chapter the Second')).toBeInTheDocument()
    expect(overlay()).toHaveAttribute('data-sb-phase', 'resting')
  })

  it('frozen mid-turn pose (?sbpose=n:t:dir): blacked out, ignores the bridge', () => {
    window.history.replaceState({}, '', '/labs/storybook?sbpose=2:0.5:next')
    try {
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)
      // Blacked out so the golden harness's mid-turn CANVAS stations stay text-free.
      expect(overlay()).toHaveStyle({ opacity: '0' })
      // A land cue must not pull incoming content in over a frozen pose.
      act(() => emitTurnLand({ dir: 'next', to: 3 }))
      expect(screen.queryByText('Chapter the Second')).not.toBeInTheDocument()
    } finally {
      window.history.replaceState({}, '', '/labs/storybook')
    }
  })

  it('reduced motion: ignores the bridge and swaps only at the store commit', () => {
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
    render(<SpreadOverlay />)
    // A land cue must NOT pull the incoming text in early for reduced motion.
    act(() => emitTurnLand({ dir: 'next', to: 3 }))
    expect(screen.getByText('Chapter the First')).toBeInTheDocument()
    expect(screen.queryByText('Chapter the Second')).not.toBeInTheDocument()
    // Only the committed spread change swaps the content — an instant swap.
    act(() => useStorybookStore.setState({ spread: 3 }))
    expect(screen.getByText('Chapter the Second')).toBeInTheDocument()
  })
})
