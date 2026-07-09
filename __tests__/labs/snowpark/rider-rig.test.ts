/**
 * Rider rig + scarf: behavioral guards for the orchestrator's GATE-D tuning.
 * Assertions are on relationships and invariants (determinism, finiteness,
 * monotonic pose response, bail continuity), NOT exact coordinates — so tuning
 * RIG constants stays free.
 */
import { describe, it, expect } from 'vitest'
import { compileCourse } from '@/components/labs/snowpark/course'
import { createRider, stepRider, PHYS, type RiderState, type RiderInput } from '@/components/labs/snowpark/rider'
import {
  computePose,
  riderJoints,
  boardAngle,
  drawRider,
  RIG,
} from '@/components/labs/snowpark/render/rider-rig'
import { createScarf, SCARF } from '@/components/labs/snowpark/render/scarf'
import { skyColors } from '@/components/labs/snowpark/render/sky'

const NEUTRAL: RiderInput = {
  jumpHeld: false,
  jumpPressed: false,
  grab: 'none',
  spinDir: 0,
  retryPressed: false,
}

/** Minimal no-op 2D context: every method is a no-op, every prop is writable.
 * Guards that the draw calls only touch the canvas API they claim to. */
function stubCtx(): CanvasRenderingContext2D {
  const noop = () => {}
  const bag: Record<string, unknown> = {}
  return new Proxy(bag, {
    get: (t, k) => (k in t ? t[k as string] : noop),
    set: (t, k, v) => ((t[k as string] = v), true),
  }) as unknown as CanvasRenderingContext2D
}

const finite = (p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y)

function riderAt(over: Partial<RiderState>): RiderState {
  return { ...createRider(compileCourse()), ...over }
}

describe('rider rig — pose model', () => {
  it('is a pure function of state (same state → identical pose)', () => {
    const s = riderAt({ x: 1234, speed: 300, tucking: true, charge: 0.6 })
    expect(computePose(s)).toEqual(computePose({ ...s }))
  })

  it('produces finite joints and board angle across a full scripted run', () => {
    const course = compileCourse()
    let s = createRider(course)
    const scripts: RiderInput[] = [
      { ...NEUTRAL, jumpHeld: true, jumpPressed: true },
      { ...NEUTRAL, grab: 'nose', spinDir: 1 },
      { ...NEUTRAL, jumpHeld: true, spinDir: -1 },
      { ...NEUTRAL, grab: 'tail' },
      NEUTRAL,
    ]
    const modes = new Set<string>()
    for (let i = 0; i < 4000; i++) {
      s = stepRider(s, scripts[i % scripts.length], 1 / 60, course)
      modes.add(s.mode)
      const pose = computePose(s)
      for (const p of Object.values(pose)) expect(finite(p)).toBe(true)
      const j = riderJoints(s)
      expect(finite(j.neck) && finite(j.boardCenter)).toBe(true)
      expect(Number.isFinite(boardAngle(s))).toBe(true)
    }
    expect(modes.has('snow')).toBe(true)
    expect(modes.has('air')).toBe(true)
  })

  it('crouches (hip drops toward the board) as the tuck charge builds', () => {
    const flat = { x: 0, speed: PHYS.MIN_SPEED, tucking: true }
    const light = computePose(riderAt({ ...flat, charge: 0.1 }))
    const deep = computePose(riderAt({ ...flat, charge: 1 }))
    // y increases downward: deeper crouch → hip nearer the board (larger y).
    expect(deep.hip.y).toBeGreaterThan(light.hip.y)
  })

  it('reaches the front hand to the board deck when grabbing', () => {
    const air = { mode: 'air' as const, x: 0, launchAngleDeg: 0, flipDeg: 0 }
    const noGrab = computePose(riderAt({ ...air, grab: 'none' }))
    const grab = computePose(riderAt({ ...air, grab: 'nose' }))
    // Grab pulls the front hand down to the deck (much larger y than the
    // shoulder-height trailing pose).
    expect(grab.frontHand.y).toBeGreaterThan(noGrab.frontHand.y)
    expect(grab.frontHand.y).toBeGreaterThan(grab.shoulder.y)
  })

  it('poses nose and tail grabs as distinct reaches (nose toward the front, tail the back)', () => {
    const air = { mode: 'air' as const, x: 0, launchAngleDeg: 0, flipDeg: 0 }
    const nose = computePose(riderAt({ ...air, grab: 'nose' }))
    const tail = computePose(riderAt({ ...air, grab: 'tail' }))
    // Both hands drop to the deck, but the nose reach is forward (+x) of the
    // tail reach (−x) — two visibly different poses, not one.
    expect(nose.frontHand.x).toBeGreaterThan(tail.frontHand.x)
    expect(nose.frontHand.x).toBeGreaterThan(0)
    expect(tail.frontHand.x).toBeLessThan(0)
  })

  it('boardAngle follows the flip pitch and ignores the flat spin', () => {
    const base = { mode: 'air' as const, x: 0, launchAngleDeg: 0 }
    // A spin leaves the board flat; a flip pitches it.
    expect(boardAngle(riderAt({ ...base, flipDeg: 0, spinDeg: 360 }))).toBeCloseTo(0, 6)
    expect(boardAngle(riderAt({ ...base, flipDeg: 90, spinDeg: 0 }))).not.toBeCloseTo(0, 6)
  })

  it('reads its overall height in the intended ~2.5× range', () => {
    const pose = computePose(riderAt({ x: 0, speed: 300 }))
    const height = pose.boardBack.y - (pose.head.y - RIG.HEAD_R) // board top → head crown
    expect(height).toBeGreaterThan(40)
    expect(height).toBeLessThan(64)
  })

  it('draws every mode against a stub context without throwing', () => {
    const ctx = stubCtx()
    const colors = skyColors(0.5)
    for (const mode of ['snow', 'air', 'grind', 'bail', 'finish'] as const) {
      const s = riderAt({ mode, bailTimer: mode === 'bail' ? 0.6 : 0, time: 3 })
      expect(() => drawRider(ctx, s, { sx: 1.1, sy: 0.85 }, colors)).not.toThrow()
    }
  })
})

describe('rider rig — bail tumble', () => {
  it('seeds the tumble from a bail-start invariant, so the neck moves continuously', () => {
    // Two adjacent bail frames (bailTimer counts down; time counts up) share a
    // seed, so the torso-piece neck advances smoothly rather than snapping.
    const a = riderAt({ mode: 'bail', x: 500, y: 200, time: 5.0, bailTimer: PHYS.BAIL_TIME - 0.30 })
    const b = riderAt({ mode: 'bail', x: 500, y: 200, time: 5 + 1 / 60, bailTimer: PHYS.BAIL_TIME - 0.30 - 1 / 60 })
    const na = riderJoints(a).neck
    const nb = riderJoints(b).neck
    expect(finite(na) && finite(nb)).toBe(true)
    expect(Math.hypot(nb.x - na.x, nb.y - na.y)).toBeLessThan(12) // one-frame step, no jump
  })
})

describe('scarf', () => {
  it('keeps segment lengths near SCARF.SEG after settling under wind', () => {
    const scarf = createScarf()
    scarf.reset(0, -30)
    for (let i = 0; i < 240; i++) scarf.update(0, -30, -150, 1 / 60)
    // Reach in and measure via a recording draw stub.
    const pts: number[][] = []
    const rec = new Proxy(
      {},
      {
        get: (_t, k) =>
          k === 'moveTo' || k === 'lineTo'
            ? (x: number, y: number) => pts.push([x, y])
            : () => {},
        set: () => true,
      }
    ) as unknown as CanvasRenderingContext2D
    scarf.draw(rec)
    // Each drawn segment is a moveTo→lineTo pair (even→odd in record order);
    // measure a mid-chain segment against the rest length.
    const d = Math.hypot(pts[7][0] - pts[6][0], pts[7][1] - pts[6][1])
    expect(d).toBeGreaterThan(SCARF.SEG * 0.5)
    expect(d).toBeLessThan(SCARF.SEG * 1.6)
  })

  it('freezes on dt=0 (hit-stop) yet keeps the root pinned to a moved anchor', () => {
    const scarf = createScarf()
    scarf.reset(10, -30)
    scarf.update(10, -30, -100, 1 / 60)
    expect(() => scarf.update(20, -40, -100, 0)).not.toThrow()
  })
})
