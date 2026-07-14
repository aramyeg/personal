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

describe('boot gate', () => {
  beforeEach(() => useStorybookStore.setState({ booted: false }))

  it('starts un-booted so the veil covers the warming canvas', () => {
    expect(s().booted).toBe(false)
  })

  it('markBooted flips the flag and is idempotent', () => {
    s().markBooted()
    expect(s().booted).toBe(true)
    s().markBooted()
    expect(s().booted).toBe(true)
  })
})

describe('grab lifecycle', () => {
  beforeEach(() =>
    useStorybookStore.setState({ spread: 3, turning: null, queued: null, booted: true, grab: null })
  )

  it('beginGrab records the id/kind when booted and settled', () => {
    s().beginGrab('tab-1', 'tab')
    expect(s().grab).toEqual({ id: 'tab-1', kind: 'tab' })
  })

  it('beginGrab no-ops when not booted', () => {
    useStorybookStore.setState({ booted: false })
    s().beginGrab('tab-1', 'tab')
    expect(s().grab).toBeNull()
  })

  it('beginGrab no-ops mid-turn', () => {
    useStorybookStore.setState({ turning: 'next' })
    s().beginGrab('knob-1', 'knob')
    expect(s().grab).toBeNull()
  })

  it('endGrab clears an active grab', () => {
    s().beginGrab('flap-1', 'flap')
    s().endGrab()
    expect(s().grab).toBeNull()
  })

  it('endGrab is a no-op when nothing is grabbed', () => {
    s().endGrab()
    expect(s().grab).toBeNull()
  })

  it('requestTurn force-releases an active grab and still turns normally', () => {
    s().beginGrab('keepsake-1', 'keepsake')
    s().requestTurn('next')
    expect(s().grab).toBeNull()
    expect(s().turning).toBe('next')
    s().completeTurn()
    expect(s().spread).toBe(4)
  })

  it('a grab can never coexist with an in-flight turn, and queuing semantics are unchanged', () => {
    s().beginGrab('tab-2', 'tab')
    s().requestTurn('next') // releases the grab and starts turning, per the test above
    s().beginGrab('tab-3', 'tab') // illegal while turning !== null — stays null
    expect(s().grab).toBeNull()
    s().requestTurn('prev') // queues, exactly like the grab-free case (store.test.ts's turn machine)
    expect(s().grab).toBeNull()
    expect(s().queued).toBe('prev')
    s().completeTurn()
    expect(s().spread).toBe(4)
    expect(s().turning).toBe('prev')
    expect(s().queued).toBeNull()
  })

  it('requestTurn still clamps at the covers with a grab active', () => {
    useStorybookStore.setState({ spread: 9, grab: { id: 'tab-3', kind: 'tab' } })
    s().requestTurn('next')
    expect(s().grab).toBeNull()
    expect(s().turning).toBeNull()
  })
})
