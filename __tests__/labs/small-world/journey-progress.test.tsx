import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { JourneyProgress } from '@/components/labs/small-world/overlay/journey-progress'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'

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
})
