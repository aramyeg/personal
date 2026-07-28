import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { BiomeGrade, SHOW_GRADE } from '@/components/labs/small-world/overlay/biome-grade'
import { JourneyOverlay } from '@/components/labs/small-world/overlay/journey-overlay'
import { BIOME_MOODS, gradeAt } from '@/components/labs/small-world/overlay/grade-mood'
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
    expect(v.hazeAlpha).toBeCloseTo(BIOME_MOODS[0].hazeAlpha, 3)
  })

  it('never takes pointer events — it can not swallow a scroll or a panel tap', () => {
    render(<BiomeGrade progressRef={{ current: 0 }} />)
    expect(screen.getByTestId('sw-biome-grade').style.pointerEvents).toBe('none')
  })

  it('follows the journey to each biome’s mood as progress moves', () => {
    const ref = { current: 0 }
    render(<BiomeGrade progressRef={ref} />)
    for (let c = 1; c < BIOME_MOODS.length; c++) {
      ref.current = (c + 0.8) / BIOME_MOODS.length
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
 * A checkpoint rolls out with the visitor's hands off the wheel — zero scroll events — so the
 * grade has to recompute on the arrival driver's frames or it freezes part-way through every
 * entrance. These pin that path, and that it is released on unmount.
 */
describe('BiomeGrade on the arrival clock', () => {
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
      arrivalRef,
      frame: () => act(() => listeners.forEach((fn) => fn())),
      listenerCount: () => listeners.size,
    }
  }

  it('completes the crossfade on driver frames with no scroll at all', () => {
    const { journey, arrivalRef, frame } = fakeJourney()
    // Parked where T54's absorption holds progress while chapter 5 (winter) rolls out.
    const ref = { current: (5 + 0.56) / BIOME_MOODS.length }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<BiomeGrade progressRef={ref} journey={journey as any} />)
    const el = screen.getByTestId('sw-biome-grade')
    // Scroll alone leaves the mood part-way between the canyon and the winter.
    const partway = vars(el)
    expect(partway.haze).not.toBe(BIOME_MOODS[5].cast)
    expect(partway.haze).not.toBe(BIOME_MOODS[4].cast)

    arrivalRef.current.reveal = { chapter: 5, t: 1, phase: 'in' }
    frame()
    const arrived = vars(el)
    expect(arrived.haze).toBe(BIOME_MOODS[5].cast)
    expect(arrived.vignetteAlpha).toBeCloseTo(gradeAt(ref.current, arrivalRef.current.reveal).vignetteAlpha, 4)
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
    const ref = { current: 0.8 / 6 }
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
