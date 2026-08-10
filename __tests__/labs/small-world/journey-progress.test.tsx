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

const click = (el: HTMLElement) => act(() => el.click())

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
    click(screen.getByRole('button', { name: /hide journey progress/i }))
    expect(screen.queryByRole('group')).toBeNull()
  })

  /**
   * ============================================================================
   * TASK 108 — HIDING IS A TOGGLE, AND THE WAY BACK IS THE SAME CONTROL
   * ============================================================================
   * The old dismiss unmounted the whole component, so the rail was gone for the rest of the visit
   * with nothing left on screen to bring it back. These pin the two halves of the replacement: the
   * readout goes, the control does not, and pressing it again restores a rail that is CURRENT
   * rather than one that has to wait for the next scroll to catch up.
   */
  it('leaves a control behind that says what it will do, and brings the readout back', () => {
    const ref = { current: 0 }
    render(<JourneyProgress progressRef={ref} />)
    const toggle = screen.getByTestId('sw-progress-toggle')
    expect(toggle.textContent).toContain('hide progress')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    click(toggle)
    expect(screen.queryByRole('group')).toBeNull()
    // ...and it is the SAME element, still in the tree, now offering the way back
    expect(screen.getByTestId('sw-progress-toggle')).toBe(toggle)
    expect(toggle.textContent).toContain('show progress')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: /show journey progress/i })).toBe(toggle)

    click(toggle)
    expect(screen.getByRole('group')).not.toBeNull()
    expect(toggle.textContent).toContain('hide progress')
  })

  it('restores a CURRENT rail, not the one that was hidden', () => {
    // the trap: reopening mounts a fresh fill element at 0%, and a visitor who hides at chapter 1,
    // scrolls to chapter 5 and reopens would read an empty bar until they scrolled again
    const ref = { current: 0.2 }
    render(<JourneyProgress progressRef={ref} />)
    fireScroll()
    const toggle = screen.getByTestId('sw-progress-toggle')
    click(toggle)
    ref.current = 4.5 / CHAPTER_COUNT
    fireScroll()
    click(toggle)
    expect(screen.getByRole('group').textContent).toContain(`5 / ${CHAPTER_COUNT}`)
    expect(screen.getByTestId('sw-rail-fill').style.width).toBe('75%')
  })

  it('draws no skip control unless it is given somewhere to go', () => {
    render(<JourneyProgress progressRef={{ current: 0 }} />)
    expect(screen.queryByTestId('sw-skip-to-desk')).toBeNull()
  })

  it('offers the skip from the first frame, and it survives hiding the readout', () => {
    const onSkip = vi.fn()
    render(<JourneyProgress progressRef={{ current: 0 }} onSkip={onSkip} />)
    click(screen.getByTestId('sw-skip-to-desk'))
    expect(onSkip).toHaveBeenCalledTimes(1)

    // hiding the progress readout is a statement about the readout, not about wanting fewer ways
    // out of a 1680vh scroll
    click(screen.getByTestId('sw-progress-toggle'))
    expect(screen.queryByRole('group')).toBeNull()
    click(screen.getByTestId('sw-skip-to-desk'))
    expect(onSkip).toHaveBeenCalledTimes(2)
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
  it('hides the whole rail, and disarms both of its controls, once the stand is up', () => {
    const ref = { current: 0 }
    render(<JourneyProgress progressRef={ref} onSkip={() => {}} />)
    const wrap = screen.getByTestId('sw-journey-rail')
    const controls = [screen.getByTestId('sw-progress-toggle'), screen.getByTestId('sw-skip-to-desk')]

    // mid-journey: whole, and the controls are honest about being clickable
    expect(wrap.style.opacity).toBe('1')
    expect(wrap.style.visibility).toBe('visible')
    for (const c of controls) {
      expect(c.style.pointerEvents).toBe('auto')
      expect(c.style.visibility).toBe('visible')
    }

    // ...and once the ending has begun and the pedestal is rising, it is gone rather than faint
    ref.current = TRACK_END
    fireScroll()
    expect(Number(wrap.style.opacity)).toBe(0)
    expect(wrap.style.visibility).toBe('hidden')
    for (const c of controls) {
      expect(c.style.pointerEvents).toBe('none')
      expect(c.style.visibility).toBe('hidden')
    }
  })

  it('never leaves either control reachable below the legibility bar', () => {
    // swept across the whole track rather than sampled at the endpoints, because the trap this
    // closes lived on the APPROACH: the old control was topmost and focusable at an effective
    // alpha of 0.0099
    const ref = { current: 0 }
    render(<JourneyProgress progressRef={ref} onSkip={() => {}} />)
    const wrap = screen.getByTestId('sw-journey-rail')
    const controls = [screen.getByTestId('sw-progress-toggle'), screen.getByTestId('sw-skip-to-desk')]
    for (let i = 0; i <= 120; i++) {
      ref.current = (i / 120) * TRACK_END
      fireScroll()
      for (const c of controls) {
        if (c.style.pointerEvents === 'auto' || c.style.visibility === 'visible') {
          expect(
            Number(wrap.style.opacity),
            `${c.dataset.testid} reachable at rail opacity ${wrap.style.opacity} (progress ${ref.current})`
          ).toBeGreaterThanOrEqual(0.85)
        }
      }
    }
  })

  /**
   * A PRESS MUST NOT DISARM THE CONTROL IT LANDS ON.
   *
   * The arming used to be an imperative style write from the frame loop, which was safe only
   * because nothing in this component re-rendered between scrolls. The controls now re-render on
   * focus and on press, and React re-applies the whole style prop when they do — so the arming had
   * to move into state. This is that fix, from the outside.
   */
  it('stays live across a press and a focus', () => {
    render(<JourneyProgress progressRef={{ current: 0.4 }} onSkip={() => {}} />)
    const skip = screen.getByTestId('sw-skip-to-desk')
    act(() => {
      skip.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      skip.focus()
    })
    expect(skip.style.pointerEvents).toBe('auto')
    expect(skip.style.visibility).toBe('visible')
  })
})
