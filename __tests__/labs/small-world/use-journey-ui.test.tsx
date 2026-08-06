import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useJourneyUi } from '@/components/labs/small-world/overlay/use-journey-ui'
import { initialArrival } from '@/components/labs/small-world/arrival'
import { ENDING_SPAN, TRACK_END } from '@/components/labs/small-world/ending-timeline'
import type { RevealState } from '@/components/labs/small-world/journey-timeline'
import type { ArrivalJourney } from '@/components/labs/small-world/use-arrival-journey'

function refOf(value: number) {
  return { current: value }
}

/**
 * Stands in for the arrival driver: holds a reveal the test can rewrite, and hands
 * back a `tick()` that fires its subscribers the way a driver frame does — with no
 * scroll event at all, which is the whole point of the clock.
 */
function fakeJourney(progress: number, reveal: RevealState | null) {
  const listeners = new Set<() => void>()
  const journey: ArrivalJourney = {
    progressRef: refOf(progress),
    rawProgressRef: refOf(progress),
    arrivalRef: { current: { ...initialArrival(progress), reveal } },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return {
    journey,
    set(next: RevealState | null, at = journey.progressRef.current) {
      journey.progressRef.current = at
      journey.arrivalRef.current = { ...journey.arrivalRef.current, reveal: next }
    },
    tick: () =>
      act(() => {
        listeners.forEach((l) => l())
      }),
  }
}

// compute() is deferred to a rAF (mocked as setTimeout(fn, 0) in
// vitest.setup.ts) so it always reads progressRef after every scroll
// listener for the event has run. Flush it with fake timers.
const fireScroll = () =>
  act(() => {
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(16)
  })

describe('useJourneyUi', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in chapter 0 with no panel', () => {
    const { result } = renderHook(() => useJourneyUi(refOf(0)))
    // `started` is false at rest and is what keeps the ~250KB manga page for
    // chapter 0 off the first-paint route (chapter alone cannot tell "not yet
    // moved" from "walking the first leg").
    expect(result.current).toEqual({
      chapter: 0,
      burst: false,
      started: false,
      panel: null,
      ending: null,
    })
  })

  it('reports the burst window', () => {
    const ref = refOf(0)
    const { result } = renderHook(() => useJourneyUi(ref))
    ref.current = 0.1 // chapter 0 local 0.6 — inside [0.55, 0.65)
    fireScroll()
    expect(result.current.burst).toBe(true)
    expect(result.current.panel).toBeNull()
  })

  it('reports the panel window with a quantized entrance', () => {
    const ref = refOf(0)
    const { result } = renderHook(() => useJourneyUi(ref))
    ref.current = 0.72 / 6 // chapter 0 local 0.72 — inside [0.65, 0.95)
    fireScroll()
    expect(result.current.panel).not.toBeNull()
    expect(result.current.panel!.chapter).toBe(0)
    expect(result.current.panel!.enter).toBeCloseTo(0.51, 1)
    expect((result.current.panel!.enter * 60) % 1).toBeCloseTo(0, 6)
  })

  // Task 63: the ending is scroll real estate PAST progress 1, not a flag at 0.985. The old
  // threshold landed inside chapter 6's dwell and truncated its cards; progress 1 is now the
  // journey's last frame and belongs to the journey.
  it('reports no ending at the journey\'s last frame', () => {
    const ref = refOf(0)
    const { result } = renderHook(() => useJourneyUi(ref))
    ref.current = 1
    fireScroll()
    expect(result.current.ending).toBeNull()
  })

  it('reports the ending, with its phase, once the track runs past the journey', () => {
    const ref = refOf(0)
    const { result } = renderHook(() => useJourneyUi(ref))
    ref.current = 1 + 0.1 * ENDING_SPAN
    fireScroll()
    expect(result.current.ending).not.toBeNull()
    expect(result.current.ending!.phase).toBe('still')
    expect(result.current.ending!.t).toBeCloseTo(0.1, 6)

    ref.current = TRACK_END
    fireScroll()
    expect(result.current.ending!.phase).toBe('zoom')
    expect(result.current.ending!.t).toBe(1)
  })

  it('quantizes the ending clock, so scrubbing it does not re-render every frame', () => {
    const ref = refOf(1 + 0.5 * ENDING_SPAN)
    const { result } = renderHook(() => useJourneyUi(ref))
    const before = result.current
    ref.current += ENDING_SPAN / 1000
    fireScroll()
    expect(result.current).toBe(before)
  })

  it('keeps referential stability when nothing changed', () => {
    const ref = refOf(0.2)
    const { result } = renderHook(() => useJourneyUi(ref))
    const before = result.current
    fireScroll()
    expect(result.current).toBe(before)
  })
})

// Round 15 / Task 54 — the arrival is a wall clock, so the cards must follow the
// driver's frames, not scroll events. These are the DOM half of that contract.
describe('useJourneyUi on the arrival clock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mounts the cards the moment the girl arrives, before the dwell panel exists', () => {
    // chapter 0 local 0.56: she has stopped, the old panel window has not opened yet.
    const driver = fakeJourney(0.56 / 6, { chapter: 0, t: 0, phase: 'in' })
    const { result } = renderHook(() => useJourneyUi(driver.journey.progressRef, driver.journey))
    expect(result.current.panel).not.toBeNull()
    expect(result.current.panel!.chapter).toBe(0)
    expect(result.current.panel!.enter).toBe(0)
  })

  it('rolls the cards out on driver frames with no scroll input at all', () => {
    const driver = fakeJourney(0.56 / 6, { chapter: 0, t: 0, phase: 'in' })
    const { result } = renderHook(() => useJourneyUi(driver.journey.progressRef, driver.journey))
    const seen: number[] = []
    for (const t of [0.4, 0.6, 0.8, 1]) {
      driver.set({ chapter: 0, t, phase: 'in' })
      driver.tick()
      seen.push(result.current.panel!.enter)
    }
    expect(seen[seen.length - 1]).toBe(1)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1])
  })

  it('parks: lingering or scrubbing inside the dwell costs no re-render', () => {
    const driver = fakeJourney(0.8 / 6, { chapter: 0, t: 1, phase: 'in' })
    const { result } = renderHook(() => useJourneyUi(driver.journey.progressRef, driver.journey))
    const parked = result.current
    expect(parked.panel!.enter).toBe(1)
    driver.set({ chapter: 0, t: 1, phase: 'in' }, 0.9 / 6)
    driver.tick()
    expect(result.current).toBe(parked)
  })

  it('walks the cards back out on retraction, then unmounts them', () => {
    const driver = fakeJourney(0.96 / 6, { chapter: 0, t: 1, phase: 'in' })
    const { result } = renderHook(() => useJourneyUi(driver.journey.progressRef, driver.journey))
    driver.set({ chapter: 0, t: 0.5, phase: 'out' })
    driver.tick()
    expect(result.current.panel!.enter).toBeGreaterThan(0)
    expect(result.current.panel!.enter).toBeLessThan(1)
    driver.set(null)
    driver.tick()
    expect(result.current.panel).toBeNull()
  })

  it('keeps the burst on the clock, so the "!" pops without scrolling', () => {
    const driver = fakeJourney(0.56 / 6, { chapter: 0, t: 0.2, phase: 'in' })
    const { result } = renderHook(() => useJourneyUi(driver.journey.progressRef, driver.journey))
    expect(result.current.burst).toBe(true)
    driver.set({ chapter: 0, t: 0.8, phase: 'in' })
    driver.tick()
    expect(result.current.burst).toBe(false)
  })
})
