import { beforeEach, describe, expect, it } from 'vitest'
import {
  WHEEL_THRESHOLD,
  accumulateWheel,
  useStorybookStore,
} from '@/components/labs/storybook/store'

const s = () => useStorybookStore.getState()

describe('turn machine', () => {
  beforeEach(() => useStorybookStore.setState({ spread: 0, turning: null, queued: null }))

  it('turns forward and commits', () => {
    s().requestTurn('next')
    expect(s().turning).toBe('next')
    expect(s().spread).toBe(0)
    s().completeTurn()
    expect(s().spread).toBe(1)
    expect(s().turning).toBeNull()
  })

  it('clamps at both covers', () => {
    s().requestTurn('prev')
    expect(s().turning).toBeNull()
    useStorybookStore.setState({ spread: 9 })
    s().requestTurn('next')
    expect(s().turning).toBeNull()
  })

  it('queues exactly one turn while turning, then chains it', () => {
    useStorybookStore.setState({ spread: 3 })
    s().requestTurn('next')
    s().requestTurn('next')
    s().requestTurn('prev') // latest wins
    expect(s().queued).toBe('prev')
    s().completeTurn()
    expect(s().spread).toBe(4)
    expect(s().turning).toBe('prev')
    expect(s().queued).toBeNull()
  })

  it('drops a queued turn that would go out of bounds', () => {
    useStorybookStore.setState({ spread: 8 })
    s().requestTurn('next')
    s().requestTurn('next')
    s().completeTurn()
    expect(s().spread).toBe(9)
    expect(s().turning).toBeNull()
  })
})

describe('accumulateWheel', () => {
  it('fires next after accumulated scroll and resets', () => {
    let acc = { value: 0, lastMs: 0 }
    let fire = null
    for (const t of [0, 16, 32]) {
      ;({ acc, fire } = accumulateWheel(acc, 80, t))
    }
    expect(fire).toBe('next')
    expect(acc.value).toBe(0)
  })
  it('decays stale momentum', () => {
    let { acc } = accumulateWheel({ value: 0, lastMs: 0 }, WHEEL_THRESHOLD - 1, 0)
    const r = accumulateWheel(acc, 2, 2000) // long pause → decayed
    expect(r.fire).toBeNull()
  })
})
