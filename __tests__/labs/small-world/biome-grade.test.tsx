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
