import { describe, it, expect } from 'vitest'
import {
  resolveLocomotion,
  resolveLocomotionHysteretic,
  shouldTriggerCelebrate,
  resolveClipPlan,
  selectCelebrateClip,
  speedToTimeScale,
  SKIP_CLIP,
  LEGACY_SKIP_CLIP,
  IDLE_SLOT,
  BACKWARD_SLOT,
  JUMP_A_SLOT,
  JUMP_B_SLOT,
} from '@/components/labs/small-world/scene/girl-anim'

describe('resolveLocomotion (instantaneous classifier)', () => {
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

describe('resolveLocomotionHysteretic (idle<->moving enter/exit band)', () => {
  const REST = 0.03 // drop below this to settle back to idle (low bar)
  const MOVE = 0.06 // exceed this to start moving from idle (high bar)

  it('from idle: holds idle until |speed| exceeds the high move bar', () => {
    expect(resolveLocomotionHysteretic(0, 'idle', REST, MOVE)).toBe('idle')
    expect(resolveLocomotionHysteretic(MOVE, 'idle', REST, MOVE)).toBe('idle')
    expect(resolveLocomotionHysteretic(MOVE + 1e-6, 'idle', REST, MOVE)).toBe('forward')
    expect(resolveLocomotionHysteretic(-(MOVE + 1e-6), 'idle', REST, MOVE)).toBe('backward')
  })

  it('from moving: keeps moving until |speed| drops below the low rest bar', () => {
    expect(resolveLocomotionHysteretic(REST, 'forward', REST, MOVE)).toBe('idle')
    expect(resolveLocomotionHysteretic(REST + 1e-6, 'forward', REST, MOVE)).toBe('forward')
    expect(resolveLocomotionHysteretic(-(REST + 1e-6), 'backward', REST, MOVE)).toBe('backward')
  })

  it('holds the previous state inside the hysteresis band (rest < |speed| <= move)', () => {
    const mid = (REST + MOVE) / 2
    expect(resolveLocomotionHysteretic(mid, 'idle', REST, MOVE)).toBe('idle')
    expect(resolveLocomotionHysteretic(mid, 'forward', REST, MOVE)).toBe('forward')
    expect(resolveLocomotionHysteretic(-mid, 'backward', REST, MOVE)).toBe('backward')
  })

  it('flips direction directly when a fast scrub reverses sign while moving', () => {
    expect(resolveLocomotionHysteretic(-1.2, 'forward', REST, MOVE)).toBe('backward')
    expect(resolveLocomotionHysteretic(1.2, 'backward', REST, MOVE)).toBe('forward')
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

describe('resolveClipPlan — girl v2 delivery (his real clips)', () => {
  const plan = resolveClipPlan([SKIP_CLIP, IDLE_SLOT, BACKWARD_SLOT, JUMP_A_SLOT, JUMP_B_SLOT])

  it('idle uses the dedicated Idle clip (real clip, not a fallback)', () => {
    expect(plan.idle).toEqual({ clip: IDLE_SLOT, fallback: false })
  })

  it('backward uses the dedicated Walk_Backward clip', () => {
    expect(plan.backward).toEqual({ clip: BACKWARD_SLOT, fallback: false })
  })

  it('celebrate carries both jumps in order for alternation', () => {
    expect(plan.celebrate).toEqual({ clips: [JUMP_A_SLOT, JUMP_B_SLOT] })
  })

  it('forward stays the Skip_Forward clip', () => {
    expect(plan.forward.clip).toBe(SKIP_CLIP)
    expect(plan.forward.fallback).toBe(false)
  })
})

describe('resolveClipPlan — forward name fallback chain', () => {
  it('resolves the canonical Skip_Forward name', () => {
    expect(resolveClipPlan([SKIP_CLIP]).forward.clip).toBe(SKIP_CLIP)
  })

  it('accepts the legacy Armature|Skip_Forward|baselayer name for old GLBs', () => {
    const plan = resolveClipPlan([LEGACY_SKIP_CLIP, IDLE_SLOT])
    expect(plan.forward.clip).toBe(LEGACY_SKIP_CLIP)
    expect(plan.backward.clip).toBe(LEGACY_SKIP_CLIP) // backward fallback rides the legacy forward
  })

  it('prefers the canonical name when both canonical and legacy are present', () => {
    expect(resolveClipPlan([LEGACY_SKIP_CLIP, SKIP_CLIP]).forward.clip).toBe(SKIP_CLIP)
  })

  it('uses the first animation as forward when neither forward name is present', () => {
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

describe('resolveClipPlan — name-absence robustness (T37 fallback table)', () => {
  it('resolves each slot independently (only Idle delivered)', () => {
    const plan = resolveClipPlan([SKIP_CLIP, IDLE_SLOT])
    expect(plan.idle.fallback).toBe(false)
    expect(plan.backward.fallback).toBe(true)
    expect(plan.celebrate).toBeNull()
  })

  it('a single jump still yields a one-clip celebrate cycle', () => {
    const plan = resolveClipPlan([SKIP_CLIP, JUMP_A_SLOT])
    expect(plan.celebrate).toEqual({ clips: [JUMP_A_SLOT] })
  })

  it('still accepts a legacy Wave/Celebrate clip when a jump is absent', () => {
    expect(resolveClipPlan([SKIP_CLIP, 'Wave']).celebrate).toEqual({ clips: ['Wave'] })
    expect(resolveClipPlan([SKIP_CLIP, 'Celebrate']).celebrate).toEqual({ clips: ['Celebrate'] })
  })

  it('orders jumps ahead of any legacy celebrate name in the cycle', () => {
    const plan = resolveClipPlan([SKIP_CLIP, 'Wave', JUMP_B_SLOT, JUMP_A_SLOT])
    expect(plan.celebrate).toEqual({ clips: [JUMP_A_SLOT, JUMP_B_SLOT, 'Wave'] })
  })
})

describe('selectCelebrateClip — deterministic alternation by discovery index', () => {
  const twoJumps = { clips: [JUMP_A_SLOT, JUMP_B_SLOT] }

  it('alternates Jump_A / Jump_B by index parity', () => {
    expect(selectCelebrateClip(twoJumps, 0)).toBe(JUMP_A_SLOT)
    expect(selectCelebrateClip(twoJumps, 1)).toBe(JUMP_B_SLOT)
    expect(selectCelebrateClip(twoJumps, 2)).toBe(JUMP_A_SLOT)
    expect(selectCelebrateClip(twoJumps, 3)).toBe(JUMP_B_SLOT)
  })

  it('returns the sole clip for a one-clip cycle regardless of index', () => {
    const one = { clips: [JUMP_A_SLOT] }
    expect(selectCelebrateClip(one, 0)).toBe(JUMP_A_SLOT)
    expect(selectCelebrateClip(one, 7)).toBe(JUMP_A_SLOT)
  })

  it('returns null for a badge-only (null) plan', () => {
    expect(selectCelebrateClip(null, 0)).toBeNull()
  })

  it('is defensive against a negative index', () => {
    expect(selectCelebrateClip(twoJumps, -1)).toBe(JUMP_B_SLOT)
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

  it('takes only the magnitude (the caller has no reverse playback path)', () => {
    expect(speedToTimeScale(1.5, STRIDE, MIN, MAX)).toBeCloseTo(1.5, 10)
  })
})
