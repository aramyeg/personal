import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { LoadSignal } from '@/components/labs/small-world/loader/load-signal'

// vi.mock factories are hoisted above module-scope consts — vi.hoisted keeps the
// shared state initialized before the factory can run (plain const = TDZ crash).
const progressState = vi.hoisted(() => ({ active: true, progress: 40 }))
vi.mock('@react-three/drei', () => ({
  useProgress: () => ({ ...progressState }),
}))

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('LoadSignal (small-world)', () => {
  it('reports progress without ready while the manager is active', () => {
    progressState.active = true
    progressState.progress = 40
    const onChange = vi.fn()
    render(<LoadSignal onChange={onChange} />)
    expect(onChange).toHaveBeenCalledWith(40, false)
    act(() => vi.advanceTimersByTime(1000))
    expect(onChange).not.toHaveBeenCalledWith(expect.anything(), true)
  })

  it('reports ready 300ms after the manager goes idle', () => {
    const onChange = vi.fn()
    progressState.active = false
    progressState.progress = 100
    render(<LoadSignal onChange={onChange} />)
    expect(onChange).toHaveBeenCalledWith(100, false)
    act(() => vi.advanceTimersByTime(300))
    expect(onChange).toHaveBeenCalledWith(100, true)
  })

  it('treats a warm cache (never active, progress 0) as ready', () => {
    const onChange = vi.fn()
    progressState.active = false
    progressState.progress = 0
    render(<LoadSignal onChange={onChange} />)
    act(() => vi.advanceTimersByTime(300))
    expect(onChange).toHaveBeenCalledWith(0, true)
  })
})
