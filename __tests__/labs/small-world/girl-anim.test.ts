import { describe, it, expect } from 'vitest'
import {
  resolveLocomotion,
  shouldTriggerCelebrate,
  resolveClipPlan,
  speedToTimeScale,
  SKIP_CLIP,
  IDLE_SLOT,
  BACKWARD_SLOT,
} from '@/components/labs/small-world/scene/girl-anim'

describe('resolveLocomotion', () => {
  const EPS = 0.04

  it('maps clearly positive speed to forward', () => {
    expect(resolveLocomotion(1.2, EPS)).toBe('forward')
  })

  it('maps clearly negative speed to backward', () => {
    expect(resolveLocomotion(-1.2, EPS)).toBe('backward')
  })

  it('treats |speed| within eps as idle (dwell/rest)', () => {
    expect(resolveLocomotion(0, EPS)).toBe('idle')
    expect(resolveLocomotion(EPS, EPS)).toBe('idle')
    expect(resolveLocomotion(-EPS, EPS)).toBe('idle')
    expect(resolveLocomotion(EPS * 0.5, EPS)).toBe('idle')
  })

  it('crosses out of idle exactly past eps', () => {
    expect(resolveLocomotion(EPS + 1e-6, EPS)).toBe('forward')
    expect(resolveLocomotion(-(EPS + 1e-6), EPS)).toBe('backward')
  })
})

describe('shouldTriggerCelebrate', () => {
  it('fires on the rising edge of the burst when a clip exists', () => {
    expect(shouldTriggerCelebrate(null, 0, true)).toBe(true)
    expect(shouldTriggerCelebrate(null, 0.5, true)).toBe(true)
  })

  it('does not fire mid-burst (already celebrating)', () => {
    expect(shouldTriggerCelebrate(0.2, 0.4, true)).toBe(false)
  })

  it('does not fire on the falling edge (burst ending)', () => {
    expect(shouldTriggerCelebrate(0.9, null, true)).toBe(false)
  })

  it('never fires without a celebrate clip (badge-only fallback)', () => {
    expect(shouldTriggerCelebrate(null, 0, false)).toBe(false)
    expect(shouldTriggerCelebrate(null, 0.5, false)).toBe(false)
  })
})

describe('resolveClipPlan — current GLB (skip clip only)', () => {
  const plan = resolveClipPlan([SKIP_CLIP])

  it('forward is the skip clip, driven directly', () => {
    expect(plan.forward).toEqual({ clip: SKIP_CLIP, fallback: false })
  })

  it('idle falls back to the forward skip (slow keep-alive, never parked)', () => {
    expect(plan.idle).toEqual({ clip: SKIP_CLIP, fallback: true })
  })

  it('backward falls back to the forward skip, played forward (never reversed)', () => {
    expect(plan.backward).toEqual({ clip: SKIP_CLIP, fallback: true })
  })

  it('celebrate is badge-only (null) with no dedicated clip', () => {
    expect(plan.celebrate).toBeNull()
  })

  it('every slot resolves to a real clip (no T-pose possible)', () => {
    expect(plan.forward.clip).toBeTruthy()
    expect(plan.idle.clip).toBeTruthy()
    expect(plan.backward.clip).toBeTruthy()
  })
})

describe('resolveClipPlan — full Meshy delivery (all named clips)', () => {
  const plan = resolveClipPlan([SKIP_CLIP, IDLE_SLOT, BACKWARD_SLOT, 'Wave'])

  it('idle uses the dedicated Idle clip (real clip, not a fallback)', () => {
    expect(plan.idle).toEqual({ clip: IDLE_SLOT, fallback: false })
  })

  it('backward uses the dedicated Walk_Backward clip', () => {
    expect(plan.backward).toEqual({ clip: BACKWARD_SLOT, fallback: false })
  })

  it('celebrate uses the Wave clip', () => {
    expect(plan.celebrate).toEqual({ clip: 'Wave' })
  })

  it('forward stays the skip clip', () => {
    expect(plan.forward.clip).toBe(SKIP_CLIP)
  })
})

describe('resolveClipPlan — clip-name variants and partial delivery', () => {
  it('accepts "Celebrate" as the celebrate slot alias', () => {
    const plan = resolveClipPlan([SKIP_CLIP, 'Celebrate'])
    expect(plan.celebrate).toEqual({ clip: 'Celebrate' })
  })

  it('prefers "Wave" over "Celebrate" when both are present', () => {
    const plan = resolveClipPlan([SKIP_CLIP, 'Celebrate', 'Wave'])
    expect(plan.celebrate).toEqual({ clip: 'Wave' })
  })

  it('resolves each slot independently (only Idle delivered)', () => {
    const plan = resolveClipPlan([SKIP_CLIP, IDLE_SLOT])
    expect(plan.idle.fallback).toBe(false)
    expect(plan.backward.fallback).toBe(true)
    expect(plan.celebrate).toBeNull()
  })

  it('uses the first animation as forward when the skip clip is renamed', () => {
    const plan = resolveClipPlan(['Skip_v2', IDLE_SLOT])
    expect(plan.forward.clip).toBe('Skip_v2')
    expect(plan.backward.clip).toBe('Skip_v2')
  })

  it('never throws on an empty animation list — forward defaults to the skip name', () => {
    const plan = resolveClipPlan([])
    expect(plan.forward.clip).toBe(SKIP_CLIP)
    expect(plan.backward.clip).toBe(SKIP_CLIP)
    expect(plan.idle.fallback).toBe(true)
    expect(plan.celebrate).toBeNull()
  })
})

describe('speedToTimeScale', () => {
  const STRIDE = 1.0
  const MIN = 0.2
  const MAX = 2.5

  it('maps mid-range speed linearly through the stride', () => {
    expect(speedToTimeScale(1.0, STRIDE, MIN, MAX)).toBeCloseTo(1.0, 10)
    expect(speedToTimeScale(2.0, STRIDE, MIN, MAX)).toBeCloseTo(2.0, 10)
  })

  it('clamps below the floor so a crawl still reads as a skip', () => {
    expect(speedToTimeScale(0, STRIDE, MIN, MAX)).toBe(MIN)
    expect(speedToTimeScale(0.05, STRIDE, MIN, MAX)).toBe(MIN)
  })

  it('clamps above the ceiling so a fast fling never runs away', () => {
    expect(speedToTimeScale(10, STRIDE, MIN, MAX)).toBe(MAX)
  })

  it('takes only the magnitude — sign is applied by the caller for reverse', () => {
    expect(speedToTimeScale(1.5, STRIDE, MIN, MAX)).toBeCloseTo(1.5, 10)
  })
})
