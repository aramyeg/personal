import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { JourneyOverlay } from '@/components/labs/small-world/overlay/journey-overlay'
import { firePanelAdvance, panelTapArmed } from '@/components/labs/small-world/panel-tap'
import { initialArrival } from '@/components/labs/small-world/arrival'
import { CHAPTER_COUNT, chapters } from '@/components/labs/small-world/chapters'
import { ENDING_SPAN, TRACK_END } from '@/components/labs/small-world/ending-timeline'
import type { RevealState } from '@/components/labs/small-world/journey-timeline'
import {
  BURST_END,
  PANEL_END,
  chapterDwellProgress,
} from '@/components/labs/small-world/journey-timeline'
import {
  STORY_STOP_PROGRESS,
  advanceTargetFrom,
} from '@/components/labs/small-world/story-stops'
import type { ArrivalJourney } from '@/components/labs/small-world/use-arrival-journey'

/** A driver holding one reveal, so a RETRACTING spread can be rendered at a chosen progress. */
function fakeJourney(progress: number, reveal: RevealState): ArrivalJourney {
  return {
    progressRef: { current: progress },
    rawProgressRef: { current: progress },
    arrivalRef: { current: { ...initialArrival(progress), reveal } },
    subscribe: () => () => {},
  }
}

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
    ref.current = chapterDwellProgress(0)
    fireScroll()
    const panel = screen.getByTestId('sw-panel-data')
    expect(panel.textContent).toContain(chapters[0].theme)
    expect(panel.textContent).toContain(chapters[0].hook)
    expect(panel.textContent).toContain(chapters[0].caption)
  })

  it('advances to the next chapter on tap', () => {
    // Task 61 changed the PATH, not the behaviour. Tap-to-advance used to be a DOM `onClick` on a
    // full-viewport `pointer-events: auto` div, which blanketed the canvas and made the yeti egg
    // unclickable at every dwell. Advance now fires from the canvas via r3f's `onPointerMissed` —
    // i.e. on a click that hit no interactive object — so this exercises that path instead. The
    // assertion is unchanged: a tap while chapter 1's panel is up advances to chapter 2.
    //
    // Task 75 moved WHERE it advances to, and the reason is the story stops: a fling settles on
    // chapter 2's checkpoint, so a tap has to land there too rather than at the boundary before
    // it, which left the reader with a whole approach still to scroll and no card up.
    const ref = { current: chapterDwellProgress(0) }
    const onAdvance = vi.fn()
    render(<JourneyOverlay progressRef={ref} onAdvance={onAdvance} />)
    firePanelAdvance()
    expect(onAdvance).toHaveBeenCalledWith(chapterDwellProgress(1))
    expect(onAdvance).toHaveBeenCalledWith(advanceTargetFrom(0))
    expect(onAdvance).toHaveBeenCalledWith(STORY_STOP_PROGRESS[1])
  })

  it('does NOT advance from a DOM click on the panel — the canvas owns the pointer now', () => {
    const ref = { current: chapterDwellProgress(0) }
    const onAdvance = vi.fn()
    render(<JourneyOverlay progressRef={ref} onAdvance={onAdvance} />)
    const tap = screen.getByTestId('sw-panel-tap')
    expect(tap.style.pointerEvents, 'clicks fall through to the canvas').toBe('none')
    tap.click()
    expect(onAdvance).not.toHaveBeenCalled()
  })

  // Task 63 — the "To be continued…" panel is retired. What was one full-viewport scrim at
  // progress 0.985 is now a scroll segment past progress 1, and the overlay's only job in it is
  // to hold a mount point for T64's still beat and T65's desk reveal.
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
    expect(screen.getByTestId('sw-ending').dataset.phase).toBe('still')
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

  it('un-arms tap-to-advance while a spread retracts INTO the ending', () => {
    // The trap this closes: chapter 6's spread retracts on a wall clock, so it can still be mounted
    // a fraction of a second after progress crosses 1 — and `ChapterPanels` registers tap-to-advance
    // for as long as it is mounted. A canvas click there fired `advanceTo(1)` and smooth-scrolled
    // the visitor BACKWARDS out of the still beat, to 77.4% of the track.
    //
    // Reachable without any hurry, too: an End key or a scrollbar drag from the last dwell to the
    // bottom of the track is a teleport, which `stepArrival` passes through at 1:1 — so the visitor
    // lands at full pull-back with the registration live for the whole RETRACT_SECONDS.
    const progress = 1 + 0.02 * ENDING_SPAN
    const journey = fakeJourney(progress, { chapter: CHAPTER_COUNT - 1, t: 0.6, phase: 'out' })
    const onAdvance = vi.fn()
    render(
      <JourneyOverlay
        progressRef={journey.progressRef}
        journey={journey}
        onAdvance={onAdvance}
      />
    )

    // The retraction is still on screen — the fix is to the REGISTRATION, not to the render.
    // Hard-cutting a retracting spread would be the worse trade.
    expect(screen.getByTestId('sw-panel-data')).not.toBeNull()
    expect(screen.getByTestId('sw-ending')).not.toBeNull()

    expect(panelTapArmed(), 'no click target may survive into the ending').toBe(false)
    firePanelAdvance()
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('still arms tap-to-advance for the same spread one frame before the ending', () => {
    // The control for the test above: the ONLY thing that changed is which side of progress 1 the
    // retraction is on. At 1 exactly — the journey's last frame — the tap is live as always.
    //
    // And it still advances to 1, not to a seventh story stop: there is no stop in the walk-out or
    // the ending, so the last card hands the reader to the ending's first frame exactly as before
    // (`advanceTargetFrom` carries that rule for both the tap and the snap areas).
    const journey = fakeJourney(1, { chapter: CHAPTER_COUNT - 1, t: 0.6, phase: 'out' })
    const onAdvance = vi.fn()
    render(
      <JourneyOverlay progressRef={journey.progressRef} journey={journey} onAdvance={onAdvance} />
    )
    expect(screen.queryByTestId('sw-ending')).toBeNull()
    expect(panelTapArmed()).toBe(true)
    firePanelAdvance()
    expect(onAdvance).toHaveBeenCalledWith(1)
    expect(advanceTargetFrom(CHAPTER_COUNT - 1)).toBe(1)
  })

  it('lets chapter 6 finish its dwell — the ending no longer truncates the last cards', () => {
    // END_AT = 0.985 sat INSIDE chapter 6's dwell (which runs to 0.9917), so the last chapter's
    // cards were yanked mid-read to clear the stage for the end panel. Nothing gates them now.
    // Nine tenths of the way through chapter 6's panel window — past the old 0.985 cut-off,
    // still inside the dwell.
    const lastDwell =
      (CHAPTER_COUNT - 1 + BURST_END + 0.9 * (PANEL_END - BURST_END)) / CHAPTER_COUNT
    // Task 73 moved the last card off 0.9917 and Task 75 settled it on the 0.873-0.940 window, so 0.985
    // landmark (the retired EndPanel's cut-off) now sits PAST the dwell rather than inside it.
    // What the test is about is unchanged: chapter 6's cards run their full dwell, untruncated.
    expect(lastDwell).toBeLessThan(1)
    expect(lastDwell).toBeGreaterThan((CHAPTER_COUNT - 1 + BURST_END) / CHAPTER_COUNT)
    const ref = { current: lastDwell }
    render(<JourneyOverlay progressRef={ref} onAdvance={() => {}} />)
    expect(screen.getByTestId('sw-panel-data').textContent).toContain(
      chapters[CHAPTER_COUNT - 1].hook
    )
  })
})
