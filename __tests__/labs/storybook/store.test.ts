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

describe('keepsake seat rule (law H8)', () => {
  beforeEach(() =>
    useStorybookStore.setState({
      spread: 3,
      turning: null,
      queued: null,
      booted: true,
      grab: null,
      keepsakes: {},
      pendingTurn: null,
    })
  )

  it('a turn requested with a card OUT does not turn — it defers and starts the return', () => {
    s().keepsakeOut('kp')
    s().requestTurn('next')
    expect(s().turning).toBeNull() // the book NEVER turns with a card out
    expect(s().keepsakes.kp).toBe('returning') // the card is sent home first
    expect(s().pendingTurn).toBe('next') // the turn is parked
  })

  it('the deferred turn fires only once the card reports home, bounds-checked at fire time', () => {
    s().keepsakeOut('kp')
    s().requestTurn('next')
    expect(s().turning).toBeNull()
    s().keepsakeHomed('kp')
    expect(s().keepsakes.kp).toBe('home')
    expect(s().pendingTurn).toBeNull()
    expect(s().turning).toBe('next') // now it turns
  })

  it('a deferred turn that would run out of bounds is dropped at fire time', () => {
    useStorybookStore.setState({ spread: 9 })
    s().keepsakeOut('kp')
    s().requestTurn('next') // next from 9 is out of bounds
    s().keepsakeHomed('kp')
    expect(s().pendingTurn).toBeNull()
    expect(s().turning).toBeNull() // clamped, no turn
  })

  it('turns requested while RETURNING just replace the parked turn (last wins)', () => {
    s().keepsakeOut('kp')
    s().requestTurn('next')
    expect(s().pendingTurn).toBe('next')
    s().requestTurn('prev') // already returning — replace, do not turn
    expect(s().turning).toBeNull()
    expect(s().pendingTurn).toBe('prev')
    s().keepsakeHomed('kp')
    expect(s().turning).toBe('prev')
  })

  it('grabbing the seated card sends it returning with no parked turn', () => {
    s().keepsakeOut('kp')
    s().keepsakeReturn('kp')
    expect(s().keepsakes.kp).toBe('returning')
    expect(s().pendingTurn).toBeNull()
    s().keepsakeHomed('kp')
    expect(s().keepsakes.kp).toBe('home')
    expect(s().turning).toBeNull() // a plain dismiss, no turn follows
  })

  it('keepsakeReset forces a card home and clears any parked turn (mount reset)', () => {
    s().keepsakeOut('kp')
    s().requestTurn('next')
    s().keepsakeReset('kp')
    expect(s().keepsakes.kp).toBe('home')
    expect(s().pendingTurn).toBeNull()
    expect(s().turning).toBeNull()
  })

  it('the no-keepsake turn path is bit-identical: an empty keepsake map turns immediately', () => {
    expect(s().keepsakes).toEqual({})
    expect(s().pendingTurn).toBeNull()
    s().requestTurn('next')
    expect(s().turning).toBe('next') // exactly the pre-keepsake behaviour
    expect(s().pendingTurn).toBeNull()
  })
})
