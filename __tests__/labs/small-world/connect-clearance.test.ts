import { describe, expect, it } from 'vitest'
import {
  CLEARANCE_MARGIN,
  GAP_BASE,
  GAP_FLOOR,
  INSET_BASE,
  INSET_FLOOR,
  NARROW_MAX_WIDTH,
  connectSpacingFor,
  noteLowestPxAtPose,
  noteLowestPxBetween,
} from '@/components/labs/small-world/overlay/connect-clearance'
import { cameraPositionAt, cameraTargetAt } from '@/components/labs/small-world/scene/camera'
import {
  PARALLAX_PITCH_MAX,
  orbitEyeInto,
  yawMaxFor,
} from '@/components/labs/small-world/scene/camera-parallax'
import { noteShiftBetween } from '@/components/labs/small-world/scene/note-parallax-shift'
import { TRACK_END } from '@/components/labs/small-world/ending-timeline'
import { noteNearEdgePoint } from '@/components/labs/small-world/overlay/note-settle'
import { DESK_NOTE } from '@/components/labs/small-world/scene/desk-stage'
import { DESK_PAD } from '@/components/labs/small-world/scene/props/desk-glb-contract'

/**
 * THE PHONE'S RESTING FRAME (Task 72 addendum).
 *
 * The row's rectangle is the one thing here that cannot be computed — it depends on font loading and
 * on the label list — so it is supplied as a FIXTURE measured on the shipped build at the tip this
 * addendum was written against (`scratchpad/t72d/geom-before`, `app/geom.mjs`). Every fixture below
 * is a rendered number, and the test that guards them from drifting is the capture in the report.
 *
 *   1440x900   nav top 795.4, x 554.1..885.9   (pill row 331.8 wide, 44.5 tall)
 *    390x844   nav top 739.4, x  29.1..360.9
 *    360x844   nav top 739.4, x  14.1..345.9
 */
const FIXTURES = {
  desktop: { width: 1440, height: 900, navTop: 795.4, navLeft: 554.1, navRight: 885.9 },
  phone390: { width: 390, height: 844, navTop: 739.4, navLeft: 29.1, navRight: 360.9 },
  phone360: { width: 360, height: 844, navTop: 739.4, navLeft: 14.1, navRight: 345.9 },
}

/** The three pills' own spans at each viewport, measured the same way. */
const PILLS = {
  desktop: [
    ['Email', 570, 652],
    ['GitHub', 663, 756],
    ['LinkedIn', 765, 869],
  ],
  phone390: [
    ['Email', 45, 127],
    ['GitHub', 138, 231],
    ['LinkedIn', 240, 344],
  ],
  phone360: [
    ['Email', 30, 112],
    ['GitHub', 123, 216],
    ['LinkedIn', 225, 329],
  ],
} as Record<string, [string, number, number][]>

describe('the note-edge model agrees with the render', () => {
  /**
   * The model is only worth gating a layout on if it describes the pixels. These are the rendered
   * note-mask lows under each pill's own rectangle, taken from a clean plate with the overlay hidden
   * (`app/geom.mjs`). The model is expected to sit a pixel or so BELOW the mask — the sheet's
   * anti-aliased lip, the same bias `note-settle.ts` records against its own centre-line check.
   */
  const RENDERED: Record<string, Record<string, number>> = {
    desktop: { Email: 774, GitHub: 783, LinkedIn: 792 },
    phone390: { Email: 725, GitHub: 734, LinkedIn: 744 },
    phone360: { Email: 725, GitHub: 734, LinkedIn: 744 },
  }

  for (const key of ['desktop', 'phone390', 'phone360'] as const) {
    it(`tracks the rendered mask under every pill at ${key}`, () => {
      const f = FIXTURES[key]
      for (const [name, x0, x1] of PILLS[key]) {
        const model = noteLowestPxBetween(x0, x1, f.width, f.height)
        expect(model, `${name} span must cross the note`).not.toBeNull()
        const delta = (model as number) - RENDERED[key][name]
        expect(
          Math.abs(delta),
          `${key} ${name}: model ${(model as number).toFixed(1)} vs rendered ${RENDERED[key][name]}`
        ).toBeLessThan(3)
      }
    })
  }

  it('has the edge FALLING to the right, which is what the correction fixed', () => {
    // the old spelling had this backwards; it is the whole reason the phone collided
    const f = FIXTURES.phone390
    const left = noteLowestPxBetween(40, 130, f.width, f.height) as number
    const right = noteLowestPxBetween(240, 344, f.width, f.height) as number
    expect(right).toBeGreaterThan(left)
  })

  it('reads the note from the mesh`s own seat and yaw', () => {
    // guards the correction itself: the near edge is on the PAD, and the yaw is the mesh's
    expect(noteNearEdgePoint(0)[1]).toBeCloseTo(DESK_PAD.top + DESK_NOTE.lift, 10)
    const s = Math.sin(DESK_NOTE.rot)
    const c = Math.cos(DESK_NOTE.rot)
    const lz = DESK_NOTE.depth / 2
    expect(noteNearEdgePoint(0.5)[2]).toBeCloseTo(DESK_NOTE.z - 0.5 * s + lz * c, 10)
  })
})

describe('the desktop resting layout is untouched WHERE NOTHING FORCES IT', () => {
  /**
   * Without a breath there is nothing to clear beyond the resting frame, and the resting frame at
   * desktop is approved — so the authored spacings come back by IDENTITY. This is the reduced-motion
   * path, and it is the promise that the desktop composition Aram signed off is still exactly itself
   * for any visitor who never produces a parallax.
   */
  it('returns the authored spacings, to the bit, with no parallax', () => {
    const s = connectSpacingFor(FIXTURES.desktop, { parallax: false })
    expect(Object.is(s.gap, GAP_BASE)).toBe(true)
    expect(Object.is(s.inset, INSET_BASE)).toBe(true)
    expect(Object.is(s.lift, 0)).toBe(true)
  })

  it('returns them at every width from the narrow bound upwards, with no parallax', () => {
    for (const width of [NARROW_MAX_WIDTH, 1024, 1280, 1440, 1920, 2560, 5120]) {
      const s = connectSpacingFor({ ...FIXTURES.desktop, width }, { parallax: false })
      expect(Object.is(s.gap, GAP_BASE), `gap moved at ${width}`).toBe(true)
      expect(Object.is(s.inset, INSET_BASE), `inset moved at ${width}`).toBe(true)
      expect(Object.is(s.lift, 0), `lift non-zero at ${width}`).toBe(true)
    }
  })

  it('never charges a narrow frame for a breath it will not see either', () => {
    // the phone still owes its RESTING lift under reduced motion — that collision is not parallax's
    const withOut = connectSpacingFor(FIXTURES.phone390, { parallax: false })
    const withIn = connectSpacingFor(FIXTURES.phone390, { parallax: true })
    expect(withOut.lift).toBeGreaterThan(0)
    expect(withOut.lift).toBeLessThanOrEqual(withIn.lift)
  })

  it('DOES move desktop once a breath is possible, and only by what the envelope demands', () => {
    const s = connectSpacingFor(FIXTURES.desktop, { parallax: true })
    expect(s.lift).toBeGreaterThan(1)
    expect(s.shortfall).toBe(0)
    // and the resting term alone would not have moved it at all
    expect(connectSpacingFor(FIXTURES.desktop, { parallax: false }).lift).toBe(0)
  })

  it('records what desktop`s own worst clearance is, rather than quietly fixing it', () => {
    // Left alone deliberately: closing this means moving an APPROVED resting position. The number is
    // here so a future change cannot make it worse without a test saying so.
    const f = FIXTURES.desktop
    const worst = noteLowestPxBetween(765, 869, f.width, f.height) as number
    const clearance = f.navTop - worst
    expect(clearance).toBeGreaterThan(0)
    expect(clearance).toBeLessThan(4)
  })
})

describe('every pill clears the note at rest on a phone', () => {
  for (const key of ['phone390', 'phone360'] as const) {
    it(`clears by at least the margin at ${key}`, () => {
      const f = FIXTURES[key]
      const s = connectSpacingFor(f, { parallax: false })

      expect(s.lift, 'the row must actually have moved').toBeGreaterThan(0)
      expect(s.shortfall, 'the floors must be able to buy what the geometry asks').toBe(0)
      expect(s.gap).toBeGreaterThanOrEqual(GAP_FLOOR)
      expect(s.inset).toBeGreaterThanOrEqual(INSET_FLOOR)

      const navTop = f.navTop + s.lift
      for (const [name, x0, x1] of PILLS[key]) {
        const low = noteLowestPxBetween(x0, x1, f.width, f.height) as number
        expect(
          navTop - low,
          `${name} clears by ${(navTop - low).toFixed(1)}px (was ${(f.navTop - low).toFixed(1)})`
        ).toBeGreaterThanOrEqual(CLEARANCE_MARGIN)
      }
    })

    it(`FAILED before the lift at ${key} — the gate can tell the difference`, () => {
      const f = FIXTURES[key]
      const worst = noteLowestPxBetween(240, 344, f.width, f.height) as number
      // the shipped-before layout put the row's top ABOVE the note's low point, i.e. on the sheet
      expect(f.navTop - worst).toBeLessThan(0)
    })
  }

  it('keeps the block on screen: the lift never eats more than the floors allow', () => {
    for (const key of ['phone390', 'phone360'] as const) {
      const s = connectSpacingFor(FIXTURES[key], { parallax: true })
      expect(s.gap + s.inset).toBeGreaterThanOrEqual(GAP_FLOOR + INSET_FLOOR)
      expect(s.lift).toBeLessThanOrEqual(GAP_BASE - GAP_FLOOR + (INSET_BASE - INSET_FLOOR))
    }
  })

  /**
   * THE ROUND TRIP, which is the bug the fixtures above cannot see.
   *
   * The hook applies the lift, which MOVES the row, and then measures again — a resize, or the hand
   * font landing. The second measurement therefore sees the LIFTED rectangle and has to recover the
   * unlifted one before asking the geometry anything. Feeding fixtures straight in never exercises
   * that step, and the first cut had its sign backwards: the re-measure computed a negative
   * requirement, returned the base layout, and undid the fix on the very next frame. It cost
   * nothing at the type level and nothing in these tests until this one existed.
   */
  it('is a FIXED POINT: re-measuring the lifted row asks for the same lift again', () => {
    for (const key of ['phone390', 'phone360'] as const) {
      const f = FIXTURES[key]
      const first = connectSpacingFor(f, { parallax: true })
      expect(first.lift).toBeGreaterThan(0)

      // what the DOM reports once the lift is applied, and what the hook must hand back in
      const measuredTop = f.navTop + first.lift
      const second = connectSpacingFor({ ...f, navTop: measuredTop - first.lift }, { parallax: true })

      expect(second.gap, `${key} gap drifted on re-measure`).toBe(first.gap)
      expect(second.inset, `${key} inset drifted on re-measure`).toBe(first.inset)
      expect(second.lift, `${key} lift drifted on re-measure`).toBe(first.lift)
    }
  })

  it('would COLLAPSE if the round trip forgot to undo the lift', () => {
    // the mutation: hand the lifted rectangle in raw. The row now looks like it already clears, so
    // the solver asks for nothing and the layout snaps back — which is the defect, not a pass.
    const f = FIXTURES.phone390
    const first = connectSpacingFor(f, { parallax: true })
    const naive = connectSpacingFor({ ...f, navTop: f.navTop + first.lift }, { parallax: true })
    expect(naive.lift).toBe(0)
    expect(naive.gap).toBe(GAP_BASE)
  })

  it('spends the gap before the inset', () => {
    const s = connectSpacingFor(FIXTURES.phone390, { parallax: true })
    // the inset is only touched once the gap has hit its floor
    if (s.inset < INSET_BASE) expect(s.gap).toBe(GAP_FLOOR)
  })
})

/**
 * THE PARALLAX ENVELOPE (Task 72, second addendum).
 *
 * Everything above solves the layout at ZERO pointer input. The breath orbits the camera at the
 * money shot, which slides the note in the frame while the block stays bolted to the viewport — a
 * blind review caught the LinkedIn pill cutting through the "Aram" signature.
 *
 * These re-run the REAL per-pill clearance at all five poses of the envelope, once without the
 * tracking (which is what shipped, and it fails) and once with it (which is what ships now).
 */
describe('the note stays under the row across the whole parallax envelope', () => {
  const CORNERS: [number, number][] = [
    [0, 0],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]

  /** The composed pose at a pointer deflection, exactly as `scene.tsx` composes it. */
  function poseAt(cx: number, cy: number, aspect: number) {
    const aim = cameraTargetAt(TRACK_END)
    const eye = orbitEyeInto(
      cameraPositionAt(TRACK_END),
      aim,
      cx * yawMaxFor(aspect),
      cy * PARALLAX_PITCH_MAX,
      [0, 0, 0]
    )
    return { base: cameraPositionAt(TRACK_END), eye, aim }
  }

  /** How far the block itself moves at that pose, in px — the shipped tracking. */
  function trackPx(cx: number, cy: number, W: number, H: number) {
    const { base, eye, aim } = poseAt(cx, cy, W / H)
    const d = noteShiftBetween(base, eye, aim, W / H)
    return { dx: (d.x * W) / 2, dy: (-d.y * H) / 2 }
  }

  for (const key of ['desktop', 'phone390', 'phone360'] as const) {
    it(`every pill still clears the note at every pose — ${key}`, () => {
      const f = FIXTURES[key]
      const lift = connectSpacingFor(f, { parallax: true }).lift
      const worst: string[] = []
      let tightest = Infinity

      for (const [cx, cy] of CORNERS) {
        const { base, eye, aim } = poseAt(cx, cy, f.width / f.height)
        const { dx, dy } = trackPx(cx, cy, f.width, f.height)
        for (const [name, x0, x1] of PILLS[key]) {
          // the row has moved with the note, so its rectangle moves too
          const low = noteLowestPxAtPose(x0 + dx, x1 + dx, f.width, f.height, eye, aim)
          if (low === null) continue
          const clearance = f.navTop + lift + dy - low
          if (clearance < tightest) tightest = clearance
          if (clearance < 0) worst.push(`${name} at corner(${cx},${cy}): ${clearance.toFixed(1)}px`)
        }
      }
      expect(worst, 'pills overlapping the note under parallax').toEqual([])
      // the zero-input margin is 8px on a phone and desktop's own 3.4px; the sheet's perspective
      // shear is what the tracking cannot take out, and it is bounded rather than argued away
      expect(tightest).toBeGreaterThan(0)
    })
  }

  it('WOULD FAIL without the tracking — the guard is load-bearing', () => {
    // the shipped-before behaviour: block bolted to the viewport while the camera swings
    const f = FIXTURES.desktop
    const lift = connectSpacingFor(f, { parallax: false }).lift
    let worstOverlap = 0
    for (const [cx, cy] of CORNERS) {
      const { base, eye, aim } = poseAt(cx, cy, f.width / f.height)
      for (const [, x0, x1] of PILLS.desktop) {
        const low = noteLowestPxAtPose(x0, x1, f.width, f.height, eye, aim)
        if (low === null) continue
        worstOverlap = Math.min(worstOverlap, f.navTop + lift - low)
      }
    }
    // the note ran ~50px past the row's top edge at the pitched-up corner
    expect(worstOverlap).toBeLessThan(-40)
  })

  it('moves the block by EXACTLY zero at zero pointer input', () => {
    for (const key of ['desktop', 'phone390', 'phone360'] as const) {
      const f = FIXTURES[key]
      const { dx, dy } = trackPx(0, 0, f.width, f.height)
      expect(Object.is(dx, 0) || Object.is(dx, -0)).toBe(true)
      expect(Object.is(dy, 0) || Object.is(dy, -0)).toBe(true)
    }
  })

  it('tracks the note rather than merely moving in the same direction', () => {
    // the block's travel must MATCH the note's, not just share its sign: a fixed nudge would pass a
    // sign check and still let the sheet slide out from under the row
    const f = FIXTURES.desktop
    for (const [cx, cy] of CORNERS) {
      const { base, eye, aim } = poseAt(cx, cy, f.width / f.height)
      const { dy } = trackPx(cx, cy, f.width, f.height)
      const at0 = noteLowestPxAtPose(f.navLeft, f.navRight, f.width, f.height, base, aim) as number
      const dx = trackPx(cx, cy, f.width, f.height).dx
      const atPose = noteLowestPxAtPose(
        f.navLeft + dx,
        f.navRight + dx,
        f.width,
        f.height,
        eye,
        aim
      ) as number
      // After tracking, the note's line under the row is where it was, to within the sheet's own
      // perspective shear. This bound is A RECORDED MEASUREMENT, not a tolerance anyone chose: it
      // is what the ENVELOPE term in the solve pays for, so it moves whenever the envelope does.
      //
      // Task 81 widened the envelope (yaw 2.4 -> 3.0, pitch 1.2 -> 3.0) and re-derived it. Measured
      // per corner, desktop: 0.000, 4.498, 9.593, 7.454, 2.575 — was 6.29 worst. On phone390 the
      // same corners give 0.000, 0.330, 4.437, 4.030, 1.122, so the desktop frame remains the
      // binding one and is what this pins. 11 keeps the same ~11% margin over the worst corner that
      // the old 7 kept over its own 6.29; it is NOT slack to grow into.
      expect(Math.abs(atPose - dy - at0)).toBeLessThan(11)
    }
  })
})

describe('degenerate input cannot move the approved layout', () => {
  it('falls back to the authored spacings for a zero or absurd rectangle', () => {
    for (const bad of [
      { width: 0, height: 844, navTop: 700, navLeft: 10, navRight: 300 },
      { width: 390, height: 0, navTop: 700, navLeft: 10, navRight: 300 },
      { width: 390, height: 844, navTop: 700, navLeft: 300, navRight: 10 },
    ]) {
      const s = connectSpacingFor(bad)
      expect(s.gap).toBe(GAP_BASE)
      expect(s.inset).toBe(INSET_BASE)
    }
  })

  it('leaves the layout alone when the row does not reach the note at all', () => {
    // a row far off to one side crosses no part of the edge; there is nothing to clear
    const s = connectSpacingFor({ width: 390, height: 844, navTop: 739.4, navLeft: -400, navRight: -300 })
    expect(s.lift).toBe(0)
  })
})
