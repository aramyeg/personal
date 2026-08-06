import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { BiomeGrade, SHOW_GRADE } from '@/components/labs/small-world/overlay/biome-grade'
import { JourneyOverlay } from '@/components/labs/small-world/overlay/journey-overlay'
import { BIOME_MOODS, bloomAt, gradeAt } from '@/components/labs/small-world/overlay/grade-mood'
import {
  TRAVEL_END,
  chapterDwellProgress,
} from '@/components/labs/small-world/journey-timeline'
import { PALETTE } from '@/components/labs/small-world/palette'

// The grade defers its scroll compute to a rAF (mocked as setTimeout(fn, 0) in vitest.setup.ts),
// matching the other overlay suites.
const fireScroll = () =>
  act(() => {
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(16)
  })

const vars = (el: HTMLElement) => ({
  haze: el.style.getPropertyValue('--sw-grade-haze'),
  hazeAlpha: Number(el.style.getPropertyValue('--sw-grade-haze-a')),
  vignetteAlpha: Number(el.style.getPropertyValue('--sw-grade-vig-a')),
})

describe('BiomeGrade', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ships enabled, and the kill switch is a single constant', () => {
    expect(SHOW_GRADE).toBe(true)
  })

  it('paints the opening mood before any scroll happens', () => {
    render(<BiomeGrade progressRef={{ current: 0 }} />)
    const v = vars(screen.getByTestId('sw-biome-grade'))
    expect(v.haze).toBe(BIOME_MOODS[0].cast)
    // At the bloom's RESTING strength: Task 73 put the swell's peak at the checkpoint rather than
    // at the segment seam, so the page opens at BLOOM_FLOOR and blooms in over the walk to the
    // first card. The mood identity — which is what this test is about — is unchanged.
    expect(v.hazeAlpha).toBeCloseTo(BIOME_MOODS[0].hazeAlpha * bloomAt(0), 3)
  })

  it('never takes pointer events — it can not swallow a scroll or a panel tap', () => {
    render(<BiomeGrade progressRef={{ current: 0 }} />)
    expect(screen.getByTestId('sw-biome-grade').style.pointerEvents).toBe('none')
  })

  it('follows the journey to each biome’s mood as progress moves', () => {
    const ref = { current: 0 }
    render(<BiomeGrade progressRef={ref} />)
    for (let c = 1; c < BIOME_MOODS.length; c++) {
      ref.current = chapterDwellProgress(c)
      fireScroll()
      const v = vars(screen.getByTestId('sw-biome-grade'))
      expect(v.haze, BIOME_MOODS[c].id).toBe(BIOME_MOODS[c].cast)
      expect(v.hazeAlpha).toBeCloseTo(BIOME_MOODS[c].hazeAlpha, 3)
      expect(v.vignetteAlpha).toBeCloseTo(BIOME_MOODS[c].vignetteAlpha, 3)
    }
  })

  it('writes exactly what the pure mapping says, so captures can be reasoned about', () => {
    const ref = { current: 0 }
    render(<BiomeGrade progressRef={ref} />)
    ref.current = 4.55 / BIOME_MOODS.length // mid-crossfade into the canyon
    fireScroll()
    const v = vars(screen.getByTestId('sw-biome-grade'))
    const g = gradeAt(ref.current)
    expect(v.haze).toBe(g.haze)
    expect(v.hazeAlpha).toBeCloseTo(g.hazeAlpha, 3)
    expect(v.vignetteAlpha).toBeCloseTo(g.vignetteAlpha, 3)
  })

  it('stops listening once unmounted', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<BiomeGrade progressRef={{ current: 0 }} />)
    unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})

/**
 * `progressRef` IS the arrival driver's progress, and the driver moves it on its own frames while
 * it absorbs and then releases the scroll a checkpoint swallows — no scroll events are fired for
 * any of it. So the grade has to recompute on driver frames or it reads a stale progress across
 * every arrival. Task 59 removed the grade's reveal input but not this: the trigger is about who
 * writes `progressRef`, not about what the grade reads out of the journey.
 */
describe('BiomeGrade on the driver’s frames', () => {
  const fakeJourney = () => {
    const listeners = new Set<() => void>()
    const arrivalRef = { current: { reveal: null as { chapter: number; t: number; phase: 'in' | 'out' } | null } }
    return {
      journey: {
        progressRef: { current: 0 },
        rawProgressRef: { current: 0 },
        arrivalRef,
        subscribe: (fn: () => void) => {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
      },
      frame: () => act(() => listeners.forEach((fn) => fn())),
      listenerCount: () => listeners.size,
    }
  }

  it('tracks progress the driver moves with no scroll at all', () => {
    const { journey, frame } = fakeJourney()
    // Mid-crossfade onto the canyon, where the driver is still releasing absorbed scroll.
    const ref = { current: (4 + TRAVEL_END * 0.35) / BIOME_MOODS.length }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<BiomeGrade progressRef={ref} journey={journey as any} />)
    const el = screen.getByTestId('sw-biome-grade')
    const partway = vars(el)
    expect(partway.haze).not.toBe(BIOME_MOODS[4].cast)
    expect(partway.haze).not.toBe(BIOME_MOODS[3].cast)

    // The driver advances progress into the canyon's dwell. No scroll event is dispatched.
    ref.current = chapterDwellProgress(4)
    frame()
    const arrived = vars(el)
    expect(arrived.haze).toBe(BIOME_MOODS[4].cast)
    expect(arrived.vignetteAlpha).toBeCloseTo(gradeAt(ref.current).vignetteAlpha, 4)
    expect(arrived.vignetteAlpha).not.toBeCloseTo(partway.vignetteAlpha, 4)
  })

  it('unsubscribes from the driver on unmount', () => {
    const { journey, listenerCount } = fakeJourney()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { unmount } = render(<BiomeGrade progressRef={{ current: 0 }} journey={journey as any} />)
    expect(listenerCount()).toBe(1)
    unmount()
    expect(listenerCount()).toBe(0)
  })
})

describe('grade paint order', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // Card legibility is guaranteed by paint order, not by gentle numbers: positioned siblings with
  // no z-index paint in DOM order, so the grade preceding the panel means the panel is on top.
  it('puts the grade under the chapter cards', () => {
    const ref = { current: chapterDwellProgress(0) }
    render(<JourneyOverlay progressRef={ref} onAdvance={() => {}} />)
    const grade = screen.getByTestId('sw-biome-grade')
    const panel = screen.getByTestId('sw-panel-tap')
    expect(grade.parentElement).toBe(panel.parentElement)
    expect(grade.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('base atmosphere', () => {
  // The graded key light mixes AWAY FROM this colour, so it has to be the exact warm daylight the
  // scene shipped with before the grade — otherwise switching the grade off changes the lighting.
  it('keeps the ungraded key light identical to the pre-grade scene', () => {
    expect(PALETTE.keyWarm.toLowerCase()).toBe('#fff2e0')
  })
})
