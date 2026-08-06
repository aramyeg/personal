import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { JourneyProgress } from '@/components/labs/small-world/overlay/journey-progress'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { TRACK_END } from '@/components/labs/small-world/ending-timeline'

// The rail defers its scroll compute to a rAF (mocked as setTimeout(fn, 0) in
// vitest.setup.ts), matching the other overlay suites. Flush with fake timers.
const fireScroll = () =>
  act(() => {
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(16)
  })

describe('JourneyProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the chapter counter and one dot per chapter at the start', () => {
    render(<JourneyProgress progressRef={{ current: 0 }} />)
    const group = screen.getByRole('group')
    expect(group.textContent).toContain(`1 / ${CHAPTER_COUNT}`)
  })

  it('advances the counter as progress moves into a later chapter', () => {
    const ref = { current: 0 }
    render(<JourneyProgress progressRef={ref} />)
    ref.current = 3.5 / CHAPTER_COUNT // chapter index 3 → "4 / 6"
    fireScroll()
    expect(screen.getByRole('group').textContent).toContain(`4 / ${CHAPTER_COUNT}`)
  })

  it('reports the final chapter at the end of the journey', () => {
    render(<JourneyProgress progressRef={{ current: 1 }} />)
    expect(screen.getByRole('group').textContent).toContain(`${CHAPTER_COUNT} / ${CHAPTER_COUNT}`)
  })

  it('can be dismissed', () => {
    render(<JourneyProgress progressRef={{ current: 0 }} />)
    act(() => {
      screen.getByRole('button', { name: /hide journey progress/i }).click()
    })
    expect(screen.queryByRole('group')).toBeNull()
  })

  /**
   * THE WIRING, not just the arithmetic (Task 72, review finding C1).
   *
   * `ending-connect.test.tsx` pins `railOpacity` and `railDismissLive` as functions. These pin that
   * the component actually WRITES them to the DOM — the defect class being closed is a control that
   * is invisible and still focusable, and that is a property of the element rather than of a number.
   * `visibility` is checked alongside `pointerEvents` on purpose: the second stops a click, the
   * first is what takes the control out of sequential focus as well.
   */
  it('hides the whole rail, and disarms its dismiss control, once the stand is up', () => {
    const ref = { current: 0 }
    const { container } = render(<JourneyProgress progressRef={ref} />)
    const wrap = container.querySelector<HTMLElement>('[role="group"]')!
    const dismiss = screen.getByRole('button', { name: /hide journey progress/i })

    // mid-journey: whole, and the control is honest about being clickable
    expect(wrap.style.opacity).toBe('1')
    expect(wrap.style.visibility).toBe('visible')
    expect(dismiss.style.pointerEvents).toBe('auto')
    expect(dismiss.style.visibility).toBe('visible')

    // ...and once the ending has begun and the pedestal is rising, it is gone rather than faint
    ref.current = TRACK_END
    fireScroll()
    expect(Number(wrap.style.opacity)).toBe(0)
    expect(wrap.style.visibility).toBe('hidden')
    expect(dismiss.style.pointerEvents).toBe('none')
    expect(dismiss.style.visibility).toBe('hidden')
  })

  it('never leaves the dismiss control reachable below the legibility bar', () => {
    // swept across the whole track rather than sampled at the endpoints, because the trap this
    // closes lived on the APPROACH: the old control was topmost and focusable at an effective
    // alpha of 0.0099
    const ref = { current: 0 }
    const { container } = render(<JourneyProgress progressRef={ref} />)
    const wrap = container.querySelector<HTMLElement>('[role="group"]')!
    const dismiss = screen.getByRole('button', { name: /hide journey progress/i })
    for (let i = 0; i <= 120; i++) {
      ref.current = (i / 120) * TRACK_END
      fireScroll()
      if (dismiss.style.pointerEvents === 'auto' || dismiss.style.visibility === 'visible') {
        expect(
          Number(wrap.style.opacity),
          `dismiss reachable at rail opacity ${wrap.style.opacity} (progress ${ref.current})`
        ).toBeGreaterThanOrEqual(0.85)
      }
    }
  })
})
