import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { JourneyOverlay } from '@/components/labs/small-world/overlay/journey-overlay'
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
    const ref = { current: 0.8 / 6 }
    const onAdvance = vi.fn()
    render(<JourneyOverlay progressRef={ref} onAdvance={onAdvance} />)
    screen.getByTestId('sw-panel-tap').click()
    expect(onAdvance).toHaveBeenCalledWith(1 / 6)
  })

  it('shows the to-be-continued end panel at the journey end', () => {
    const ref = { current: 0 }
    render(<JourneyOverlay progressRef={ref} onAdvance={() => {}} />)
    ref.current = 1
    fireScroll()
    expect(screen.getByTestId('sw-panel-end').textContent?.toLowerCase()).toContain('to be continued')
  })
})
