import { describe, it, expect } from 'vitest'
import {
  dampTimeScale,
  nextTimeScale,
  resolveLocomotion,
  resolveLocomotionHysteretic,
  shouldTriggerCelebrate,
  shouldYieldCelebrate,
  resolveClipPlan,
  selectCelebrateClip,
  speedToTimeScale,
  SKIP_CLIP,
  LEGACY_SKIP_CLIP,
  IDLE_SLOT,
  BACKWARD_SLOT,
  JUMP_A_SLOT,
  JUMP_B_SLOT,
  WALK_SLOT,
  RUN_SLOT,
  BASE_STRIDE,
  WALK_MAX,
  WALK_MAX_DOWN,
  RUN_MIN,
  RUN_MIN_DOWN,
  resolveForwardGear,
  stepForwardGear,
  initialGearState,
  GEAR_TAU_SECONDS,
  GEAR_MIN_HOLD_SECONDS,
  type GearState,
  type Locomotion,
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

describe('shouldYieldCelebrate — travel outranks the celebrate one-shot (T52)', () => {
  it('yields the mixer back the moment forward travel resumes', () => {
    expect(shouldYieldCelebrate(true, 'forward')).toBe(true)
  })

  it('yields on a backward scrub too — any travel outranks the jump', () => {
    expect(shouldYieldCelebrate(true, 'backward')).toBe(true)
  })

  it('holds the jump while the world is still, so a dwell plays it in full', () => {
    expect(shouldYieldCelebrate(true, 'idle')).toBe(false)
  })

  it('is inert when nothing is celebrating', () => {
    expect(shouldYieldCelebrate(false, 'forward')).toBe(false)
    expect(shouldYieldCelebrate(false, 'idle')).toBe(false)
  })
})

describe('celebrate yield + hysteresis — the T52 repro as pure state', () => {
  const REST = 0.03
  const MOVE = 0.06
  /**
   * Replays the measured checkpoint trace: travel in, the staged rotation freeze
   * (speed pinned at exactly 0 while the reader keeps scrolling through the
   * burst + panel windows), then travel resuming. The jump fires on the frame the
   * freeze begins. Returns the frame index the celebrate was released on.
   */
  const replay = (speeds: readonly number[], fireAt: number) => {
    let loco: Locomotion = 'forward'
    let celebrating = false
    let releasedAt: number | null = null
    speeds.forEach((speed, i) => {
      loco = resolveLocomotionHysteretic(speed, loco, REST, MOVE)
      if (shouldYieldCelebrate(celebrating, loco)) {
        celebrating = false
        releasedAt = i
      }
      if (i === fireAt) celebrating = true // burst rising edge
    })
    return { releasedAt, celebrating, loco }
  }

  it('never yields during the freeze — the jump owns the still world', () => {
    // fires at index 2 (last moving frame before the freeze), then 10 still frames
    const { releasedAt, celebrating } = replay([2.5, 2.5, 1.9, ...Array(10).fill(0)], 2)
    expect(releasedAt).toBeNull()
    expect(celebrating).toBe(true)
  })

  it('releases on the FIRST frame travel resumes, not when the clip ends', () => {
    const speeds = [2.5, 1.9, ...Array(8).fill(0), 0.55, 2.5, 2.5]
    const { releasedAt, celebrating } = replay(speeds, 1)
    expect(releasedAt).toBe(10) // the 0.55 frame — the first past the move bar
    expect(celebrating).toBe(false)
  })

  it('survives its own firing frame (the trigger frame still reads as travel)', () => {
    // Speed at the burst edge is still the incoming travel; the yield is checked
    // before the trigger, so the jump is not aborted on the frame it starts.
    const { releasedAt, celebrating } = replay([2.5, 1.9, 0, 0, 0], 1)
    expect(releasedAt).toBeNull()
    expect(celebrating).toBe(true)
  })

  it('a fling straight through a checkpoint drops the jump within a frame', () => {
    // No freeze sampled at all: the very next frame is still travelling.
    const { releasedAt } = replay([2.5, 2.5, 2.5, 2.5], 1)
    expect(releasedAt).toBe(2)
  })

  it('dwell jitter inside the hysteresis dead band cannot abort the jump', () => {
    const jitter = [2.5, 1.9, 0, 0.04, 0.02, 0.05, 0.01]
    const { releasedAt, celebrating } = replay(jitter, 1)
    expect(releasedAt).toBeNull()
    expect(celebrating).toBe(true)
  })
})

describe('nextTimeScale / dampTimeScale — cadence easing and entry seeding', () => {
  const LAMBDA = 6
  const DT = 1 / 60

  it('seeds the cadence at the demanded value when entering a state', () => {
    expect(nextTimeScale(0.12, 2.1, true, LAMBDA, DT)).toBe(2.1)
    // …including after a jump held a stale, far-too-fast cadence
    expect(nextTimeScale(2.5, 0.4, true, LAMBDA, DT)).toBe(0.4)
  })

  it('eases toward the target on subsequent frames without overshooting', () => {
    const stepped = nextTimeScale(1, 2, false, LAMBDA, DT)
    expect(stepped).toBeGreaterThan(1)
    expect(stepped).toBeLessThan(2)
  })

  it('converges to the target over many frames', () => {
    let ts = 0.12
    for (let i = 0; i < 240; i++) ts = nextTimeScale(ts, 2, false, LAMBDA, DT)
    expect(ts).toBeCloseTo(2, 6)
  })

  it('is frame-rate independent: two half-steps equal one whole step', () => {
    const whole = dampTimeScale(0.5, 2, LAMBDA, 0.1)
    const half = dampTimeScale(dampTimeScale(0.5, 2, LAMBDA, 0.05), 2, LAMBDA, 0.05)
    expect(half).toBeCloseTo(whole, 12)
  })

  it('holds still on a zero delta and is deterministic', () => {
    expect(dampTimeScale(1.3, 2, LAMBDA, 0)).toBe(1.3)
    expect(dampTimeScale(1.3, 2, LAMBDA, DT)).toBe(dampTimeScale(1.3, 2, LAMBDA, DT))
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

  it('the exit jump is absent (T87) — the ending keeps her on the skip/idle blend', () => {
    expect(plan.exitJump).toBeNull()
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

  it('the exit jump rides Jump_B — the cleaner launch and the higher apex (T87)', () => {
    expect(plan.exitJump).toEqual({ clip: JUMP_B_SLOT, fallback: false })
  })

  it('the exit jump degrades to Jump_A when only it exists', () => {
    const partial = resolveClipPlan([SKIP_CLIP, JUMP_A_SLOT])
    expect(partial.exitJump).toEqual({ clip: JUMP_A_SLOT, fallback: false })
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

describe('forward gears (T110)', () => {
  const ALL = [SKIP_CLIP, IDLE_SLOT, BACKWARD_SLOT, JUMP_A_SLOT, JUMP_B_SLOT, WALK_SLOT, RUN_SLOT]

  describe('resolveForwardGear', () => {
    it('picks walk / skip / run across the measured speed bands', () => {
      expect(resolveForwardGear(0.5, 0)).toBe(0)
      expect(resolveForwardGear(4.0, 0)).toBe(1)
      expect(resolveForwardGear(12.0, 0)).toBe(2)
    })

    it('holds the current gear inside the dead band rather than flickering', () => {
      // 2.2..2.5 and 7.2..8.0 belong to whichever gear is already driving.
      expect(resolveForwardGear(2.3, 0)).toBe(0)
      expect(resolveForwardGear(2.3, 1)).toBe(1)
      expect(resolveForwardGear(7.5, 1)).toBe(1)
      expect(resolveForwardGear(7.5, 2)).toBe(2)
    })

    it('needs the UP threshold to climb and the lower DOWN one to drop', () => {
      expect(resolveForwardGear(WALK_MAX, 0)).toBe(1)
      expect(resolveForwardGear(WALK_MAX - 0.01, 0)).toBe(0)
      expect(resolveForwardGear(WALK_MAX_DOWN, 1)).toBe(1)
      expect(resolveForwardGear(WALK_MAX_DOWN - 0.01, 1)).toBe(0)
      expect(resolveForwardGear(RUN_MIN, 1)).toBe(2)
      expect(resolveForwardGear(RUN_MIN - 0.01, 1)).toBe(1)
      expect(resolveForwardGear(RUN_MIN_DOWN, 2)).toBe(2)
      expect(resolveForwardGear(RUN_MIN_DOWN - 0.01, 2)).toBe(1)
    })

    it('drops two gears at once when a fling stops dead', () => {
      expect(resolveForwardGear(0.1, 2)).toBe(0)
    })

    it('keeps the dead bands ordered — a DOWN never sits above its own UP', () => {
      expect(WALK_MAX_DOWN).toBeLessThan(WALK_MAX)
      expect(RUN_MIN_DOWN).toBeLessThan(RUN_MIN)
      expect(WALK_MAX).toBeLessThan(RUN_MIN_DOWN)
    })

    it('leaves the gentle reader entirely in the walk (measured max 2.23 u/s)', () => {
      expect(resolveForwardGear(2.23, 0)).toBe(0)
    })
  })

  describe('stepForwardGear — a gear on the gait’s timescale, not the frame’s', () => {
    const DT = 1 / 60
    /** Drive the chooser at 60fps for `seconds` at a constant speed. */
    const hold = (state: GearState, speed: number, seconds: number, forward = true): GearState => {
      let s = state
      for (let i = 0; i < Math.round(seconds / DT); i++) s = stepForwardGear(s, speed, DT, forward)
      return s
    }

    it('settles on the gear a sustained speed asks for', () => {
      expect(hold(initialGearState(), 1.2, 2).gear).toBe(0)
      expect(hold(initialGearState(), 4.0, 2).gear).toBe(1)
      expect(hold(initialGearState(), 12.0, 2).gear).toBe(2)
    })

    it('gives a fling the run inside four tenths of a second from rest', () => {
      // She climbs one gear at a time and each rung costs the hold: the average
      // crosses WALK_MAX about 40ms in (that change is free — `heldFor` starts at
      // Infinity), then the run waits out GEAR_MIN_HOLD_SECONDS behind it. The
      // budget is the point: nothing can put a gait on screen faster than the
      // 0.25s crossfade anyway, so a third of a second to the run costs nothing
      // visible, and the skip she passes through is now long enough to BE a skip.
      expect(hold(initialGearState(), 40, 0.15).gear).toBe(1)
      expect(hold(initialGearState(), 40, 0.4).gear).toBe(2)
    })

    it('is unmoved by one fast frame inside a slow read', () => {
      // THE DEFECT, in one law, at the size it actually occurs. Instrumented on
      // the shipped build, a slow read-through peaked at 5.45 u/s in single
      // frames while sitting at 1.31 — and the per-frame chooser answered each of
      // those spikes with a clip change the mixer then spent a quarter-second
      // crossfading into. Those frames must not move the gear.
      let s = hold(initialGearState(), 1.31, 2)
      s = stepForwardGear(s, 5.45, DT, true)
      expect(s.gear).toBe(0)
    })

    it('never changes gear twice inside the mixer’s crossfade', () => {
      // A gait that is faded in over CROSSFADE and out again before it lands is
      // not a gait. Alternate a demand every frame and count the changes.
      let s = hold(initialGearState(), 1.0, 2)
      let changes = 0
      let prev = s.gear
      for (let i = 0; i < 240; i++) {
        s = stepForwardGear(s, i % 2 === 0 ? 40 : 0, DT, true)
        if (s.gear !== prev) changes += 1
        prev = s.gear
      }
      // 4s of maximal churn, and each change costs at least GEAR_MIN_HOLD_SECONDS.
      expect(changes).toBeLessThanOrEqual(Math.ceil(4 / GEAR_MIN_HOLD_SECONDS))
    })

    it('holds the gear through a dwell, and keeps averaging through it', () => {
      // The gear index only moves while travelling forward — a checkpoint leaves
      // her in the gear she arrived in — but the AVERAGE keeps tracking, so the
      // frame travel resumes is answered with what she is doing now.
      const running = hold(initialGearState(), 12, 2)
      expect(running.gear).toBe(2)
      const dwelt = hold(running, 0, 1.5, false)
      expect(dwelt.gear, 'the gear survives the dwell').toBe(2)
      expect(dwelt.avgSpeed).toBeLessThan(0.2)
    })

    it('answers a real change of pace inside a second', () => {
      // The cure must not be worse than the disease: a reader who stops browsing
      // and starts flinging sees the run before a second is out.
      const browsing = hold(initialGearState(), 3.5, 2)
      expect(browsing.gear).toBe(1)
      expect(hold(browsing, 20, 1).gear).toBe(2)
    })

    it('is frame-rate independent — 30fps and 120fps reach the same gear', () => {
      const at = (dt: number) => {
        let s = initialGearState()
        for (let i = 0; i < Math.round(1.5 / dt); i++) s = stepForwardGear(s, 12, dt, true)
        return s
      }
      expect(at(1 / 30).gear).toBe(at(1 / 120).gear)
      expect(at(1 / 30).avgSpeed).toBeCloseTo(at(1 / 120).avgSpeed, 1)
    })

    it('averages over at least the crossfade it is protecting', () => {
      // The number is derived, not felt: a signal with a shorter memory than the
      // mixer's fade can demand a gait faster than the mixer can show one.
      expect(GEAR_TAU_SECONDS).toBeGreaterThanOrEqual(0.25)
      expect(GEAR_MIN_HOLD_SECONDS).toBeGreaterThanOrEqual(0.25)
    })
  })

  describe('resolveClipPlan forwardGears', () => {
    it('names the three clips slow-to-fast when the GLB carries them', () => {
      const gears = resolveClipPlan(ALL).forwardGears
      expect(gears.map((g) => g.clip)).toEqual([WALK_SLOT, SKIP_CLIP, RUN_SLOT])
      expect(gears.every((g) => !g.fallback)).toBe(true)
      // Strides rise with the gear, or a faster clip would play slower.
      expect(gears[0].stride).toBeLessThan(gears[1].stride)
      expect(gears[1].stride).toBeLessThan(gears[2].stride)
    })

    it('degrades every missing gear onto the forward slot — the mixer is never empty', () => {
      // A pre-T110 GLB: no walk, no run. Every gear must still name a real clip,
      // which is what keeps T-pose immunity true by construction.
      const gears = resolveClipPlan([SKIP_CLIP, IDLE_SLOT, BACKWARD_SLOT]).forwardGears
      expect(gears).toHaveLength(3)
      expect(gears.map((g) => g.clip)).toEqual([SKIP_CLIP, SKIP_CLIP, SKIP_CLIP])
      expect(gears.map((g) => g.fallback)).toEqual([true, false, true])
      // …and a fallback gear carries the pre-T110 stride, so the old GLB keeps
      // exactly the old cadence law rather than a gear's retuned one.
      expect(gears[0].stride).toBe(BASE_STRIDE)
      expect(gears[2].stride).toBe(BASE_STRIDE)
    })

    it('degrades a partial GLB per gear, keeping the ones it does carry', () => {
      const gears = resolveClipPlan([SKIP_CLIP, WALK_SLOT]).forwardGears
      expect(gears.map((g) => g.clip)).toEqual([WALK_SLOT, SKIP_CLIP, SKIP_CLIP])
      expect(gears.map((g) => g.fallback)).toEqual([false, false, true])
    })

    it('every gear index resolveForwardGear can return is a real gear', () => {
      const gears = resolveClipPlan(ALL).forwardGears
      for (const speed of [0, 1, 2.4, 2.6, 5, 7.9, 8.1, 30]) {
        for (const prev of [0, 1, 2]) {
          expect(gears[resolveForwardGear(speed, prev)]).toBeDefined()
        }
      }
    })

    it('leaves the base forward slot alone — the ending still walks on its own clip', () => {
      // driveEnding reads plan.forward, not the gears; T110 must not move it.
      expect(resolveClipPlan(ALL).forward.clip).toBe(SKIP_CLIP)
    })
  })
})
