import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { JourneyOverlay } from '@/components/labs/small-world/overlay/journey-overlay'
import { firePanelAdvance } from '@/components/labs/small-world/panel-tap'
import { chapters } from '@/components/labs/small-world/chapters'

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

  it('shows the to-be-continued end panel at the journey end', () => {
    const ref = { current: 0 }
    render(<JourneyOverlay progressRef={ref} onAdvance={() => {}} />)
    ref.current = 1
    fireScroll()
    expect(screen.getByTestId('sw-panel-end').textContent?.toLowerCase()).toContain('to be continued')
  })
})
