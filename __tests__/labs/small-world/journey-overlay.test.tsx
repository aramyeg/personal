import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { JourneyOverlay } from '@/components/labs/small-world/overlay/journey-overlay'
import { firePanelAdvance } from '@/components/labs/small-world/panel-tap'
import { CHAPTER_COUNT, chapters } from '@/components/labs/small-world/chapters'
import { ENDING_SPAN, TRACK_END } from '@/components/labs/small-world/ending-timeline'
import { BURST_END, PANEL_END } from '@/components/labs/small-world/journey-timeline'

// compute() is deferred to a rAF (mocked as setTimeout(fn, 0) in
// vitest.setup.ts) so it always reads progressRef after every scroll
// listener for the event has run. Flush it with fake timers, matching
// use-journey-ui.test.tsx.
const fireScroll = () =>
  act(() => {
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(16)
  })

describe('JourneyOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows nothing during travel', () => {
    render(<JourneyOverlay progressRef={{ current: 0.03 }} onAdvance={() => {}} />)
    expect(screen.queryByTestId('sw-panel-data')).toBeNull()
  })

  it('shows the chapter data panel inside the panel window', () => {
    const ref = { current: 0 }
    render(<JourneyOverlay progressRef={ref} onAdvance={() => {}} />)
    ref.current = 0.8 / 6
    fireScroll()
    const panel = screen.getByTestId('sw-panel-data')
    expect(panel.textContent).toContain(chapters[0].company)
    expect(panel.textContent).toContain(chapters[0].role)
    expect(panel.textContent).toContain(chapters[0].period)
  })

  it('advances to the next chapter on tap', () => {
    // Task 61 changed the PATH, not the behaviour. Tap-to-advance used to be a DOM `onClick` on a
    // full-viewport `pointer-events: auto` div, which blanketed the canvas and made the yeti egg
    // unclickable at every dwell. Advance now fires from the canvas via r3f's `onPointerMissed` —
    // i.e. on a click that hit no interactive object — so this exercises that path instead. The
    // assertion is unchanged: a tap while chapter 1's panel is up advances to chapter 2.
    const ref = { current: 0.8 / 6 }
    const onAdvance = vi.fn()
    render(<JourneyOverlay progressRef={ref} onAdvance={onAdvance} />)
    firePanelAdvance()
    expect(onAdvance).toHaveBeenCalledWith(1 / 6)
  })

  it('does NOT advance from a DOM click on the panel — the canvas owns the pointer now', () => {
    const ref = { current: 0.8 / 6 }
    const onAdvance = vi.fn()
    render(<JourneyOverlay progressRef={ref} onAdvance={onAdvance} />)
    const tap = screen.getByTestId('sw-panel-tap')
    expect(tap.style.pointerEvents, 'clicks fall through to the canvas').toBe('none')
    tap.click()
    expect(onAdvance).not.toHaveBeenCalled()
  })

  // Task 63 — the "To be continued…" panel is retired. What was one full-viewport scrim at
  // progress 0.985 is now a scroll segment past progress 1, and the overlay's only job in it is
  // to hold a mount point for T64's curtain call and T65's desk reveal.
  it('shows no ending overlay anywhere in the journey', () => {
    const ref = { current: 0 }
    render(<JourneyOverlay progressRef={ref} onAdvance={() => {}} />)
    for (const p of [0.5, 0.985, 1]) {
      ref.current = p
      fireScroll()
      expect(screen.queryByTestId('sw-ending')).toBeNull()
    }
    expect(screen.queryByTestId('sw-panel-end')).toBeNull()
  })

  it('mounts the ending slot, tagged with its phase, once the ending begins', () => {
    const ref = { current: 0 }
    render(<JourneyOverlay progressRef={ref} onAdvance={() => {}} />)
    ref.current = 1 + 0.1 * ENDING_SPAN
    fireScroll()
    expect(screen.getByTestId('sw-ending').dataset.phase).toBe('curtain')
    ref.current = TRACK_END
    fireScroll()
    expect(screen.getByTestId('sw-ending').dataset.phase).toBe('zoom')
  })

  it('takes no pointer events in the ending — the canvas still owns the click', () => {
    // A transparent full-viewport catcher is exactly the tap blanket Task 61 removed. The slot
    // inherits `pointer-events: none` from the overlay root and must not set its own.
    const ref = { current: TRACK_END }
    render(<JourneyOverlay progressRef={ref} onAdvance={() => {}} />)
    const slot = screen.getByTestId('sw-ending')
    expect(slot.style.pointerEvents).toBe('')
    expect(slot.parentElement!.style.pointerEvents).toBe('none')
  })

  it('lets chapter 6 finish its dwell — the ending no longer truncates the last cards', () => {
    // END_AT = 0.985 sat INSIDE chapter 6's dwell (which runs to 0.9917), so the last chapter's
    // cards were yanked mid-read to clear the stage for the end panel. Nothing gates them now.
    // Nine tenths of the way through chapter 6's panel window — past the old 0.985 cut-off,
    // still inside the dwell.
    const lastDwell =
      (CHAPTER_COUNT - 1 + BURST_END + 0.9 * (PANEL_END - BURST_END)) / CHAPTER_COUNT
    expect(lastDwell).toBeGreaterThan(0.985)
    const ref = { current: lastDwell }
    render(<JourneyOverlay progressRef={ref} onAdvance={() => {}} />)
    expect(screen.getByTestId('sw-panel-data').textContent).toContain(
      chapters[CHAPTER_COUNT - 1].company
    )
  })
})
