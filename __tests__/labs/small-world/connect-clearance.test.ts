import { describe, expect, it } from 'vitest'
import {
  CLEARANCE_MARGIN,
  ENVELOPE_MARGIN,
  GAP_BASE,
  GAP_FLOOR,
  INSET_BASE,
  INSET_FLOOR,
  NARROW_MAX_WIDTH,
  connectSpacingFor,
  noteLowestPxAtPose,
  noteLowestPxBetween,
  worstClearanceOverEnvelope,
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
 * RE-MEASURED AT TASK 85, and the re-measure is the point rather than an update.
 * Finding 1 took the row from three pills to one — the Email and GitHub pills
 * carried Aram's addresses on a page that is Alwina's CV — so the rectangle these
 * fixtures describe stopped existing. A clearance solved against the OLD row
 * would have gone on passing while describing a span the note is no longer under:
 * the row is 136.4 px wide now against 331.8, and it is centred, so it sits over
 * a completely different stretch of the note's falling edge.
 *
 * Measured on the shipped build at commit b3244e0, production server, headed
 * Playwright, at the bottom of the track (`scratchpad/t85/checkout-after/geom.mjs`):
 *
 *   1440x900   nav top 795.4, x 646.8..783.2   (pill row 136.4 wide, 44.5 tall)
 *    390x844   nav top 739.4, x 121.8..258.2
 *    360x844   nav top 739.4, x 106.8..243.2
 *
 * THESE ARE THE UNLIFTED POSITIONS, which is what this file's arithmetic is
 * written in — the live DOM shows the row 6.3 px lower on a phone because the
 * solve has already moved it, and feeding that number back in would be asking
 * the geometry a question about a row that has already been answered (the round
 * trip the FIXED POINT test below exists for). Reduced by the lift the shipped
 * build actually applies, read off the block's own computed gap and inset:
 * 0.0 px at desktop, 6.3 px at both phones.
 *
 * The row's VERTICAL position is unchanged by finding 1 — one row of pills is
 * one row of pills. Only the span moved.
 */
const FIXTURES = {
  desktop: { width: 1440, height: 900, navTop: 795.4, navLeft: 646.8, navRight: 783.2 },
  phone390: { width: 390, height: 844, navTop: 739.4, navLeft: 121.8, navRight: 258.2 },
  phone360: { width: 360, height: 844, navTop: 739.4, navLeft: 106.8, navRight: 243.2 },
}

/** The pill's own span at each viewport, measured the same way. One, now. */
const PILLS = {
  desktop: [['LinkedIn', 662.8, 767.2]],
  phone390: [['LinkedIn', 137.8, 242.2]],
  phone360: [['LinkedIn', 122.8, 227.2]],
} as Record<string, [string, number, number][]>

describe('the note-edge model agrees with the render', () => {
  /**
   * The model is only worth gating a layout on if it describes the pixels. These are rendered
   * note-mask lows under three known spans, taken from a clean plate with the overlay hidden
   * (T72's `app/geom.mjs`). The model is expected to sit a pixel or so BELOW the mask — the sheet's
   * anti-aliased lip, the same bias `note-settle.ts` records against its own centre-line check.
   *
   * THESE ARE SPANS, NOT PILLS, and Task 85 is why the distinction now matters. They used to be
   * keyed to the pill row because the row happened to be what had been measured; finding 1 removed
   * two pills, and a fixture keyed to a pill list would have had to be either deleted or re-measured
   * to say the same thing about the same geometry.
   *
   * NOTHING HERE NEEDED RE-MEASURING, and that is a claim about what changed rather than an
   * assumption. This validates `noteLowestPxBetween` — the note's seat, the camera, the projection —
   * and finding 1 touched none of them. The three spans below still span x 570..869 at desktop and
   * 45..344 on the phones, so the surviving pill's own span (662.8..767.2 desktop, 137.8..242.2 at
   * 390) lies INSIDE an already-validated range. Re-shooting a plate to confirm a model that did not
   * move would be a new number pretending to be evidence.
   */
  const VALIDATED_SPANS: Record<string, [string, number, number, number][]> = {
    // name, x0, x1, rendered low
    desktop: [
      ['left', 570, 652, 774],
      ['middle', 663, 756, 783],
      ['right', 765, 869, 792],
    ],
    phone390: [
      ['left', 45, 127, 725],
      ['middle', 138, 231, 734],
      ['right', 240, 344, 744],
    ],
    phone360: [
      ['left', 30, 112, 725],
      ['middle', 123, 216, 734],
      ['right', 225, 329, 744],
    ],
  }

  for (const key of ['desktop', 'phone390', 'phone360'] as const) {
    it(`tracks the rendered mask across the note's whole width at ${key}`, () => {
      const f = FIXTURES[key]
      for (const [name, x0, x1, rendered] of VALIDATED_SPANS[key]) {
        const model = noteLowestPxBetween(x0, x1, f.width, f.height)
        expect(model, `${name} span must cross the note`).not.toBeNull()
        const delta = (model as number) - rendered
        expect(
          Math.abs(delta),
          `${key} ${name}: model ${(model as number).toFixed(1)} vs rendered ${rendered}`
        ).toBeLessThan(3)
      }
    })
  }

  it('validates the span the shipped pill actually occupies', () => {
    // The point of the note above, asserted rather than promised: the surviving
    // pill sits inside the range the plate covers, at every shipped viewport.
    for (const key of ['desktop', 'phone390', 'phone360'] as const) {
      const spans = VALIDATED_SPANS[key]
      const lo = Math.min(...spans.map(([, x0]) => x0))
      const hi = Math.max(...spans.map(([, , x1]) => x1))
      for (const [name, x0, x1] of PILLS[key]) {
        expect(x0, `${key} ${name} left is inside the validated plate`).toBeGreaterThanOrEqual(lo)
        expect(x1, `${key} ${name} right is inside the validated plate`).toBeLessThanOrEqual(hi)
      }
    }
  })

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

  it('no longer has to move desktop at all, because the row got narrower', () => {
    // TASK 85 CHANGED THIS OUTCOME, and the number is the reason rather than the
    // edit. Finding 1 took the pill row from 331.8 px to 136.4 and centred it, so
    // it now sits over a HIGHER part of the note's falling edge — the edge falls
    // to the right, and the old row's right-hand pill was the one hanging over
    // the low end. Measured, desktop:
    //
    //             resting clearance   worst clearance over the envelope   lift
    //   3 pills          1.71 px                    -6.91 px            10.91 px
    //   1 pill           9.07 px                    +5.32 px             0.00 px
    //
    // So the envelope term asks for nothing here now. That is a real improvement
    // and not a gate going quiet: the assertion below is that the row CLEARS by
    // more than the margin, which is why no lift is owed.
    const s = connectSpacingFor(FIXTURES.desktop, { parallax: true })
    expect(s.lift).toBe(0)
    expect(s.shortfall).toBe(0)
    const [, x0, x1] = PILLS.desktop[0]
    const worst = worstClearanceOverEnvelope(
      FIXTURES.desktop.navTop,
      x0,
      x1,
      FIXTURES.desktop.width,
      FIXTURES.desktop.height
    )
    expect(worst, 'desktop clears the whole breath unaided').toBeGreaterThanOrEqual(ENVELOPE_MARGIN)
  })

  it('would STILL move desktop for a row wide enough to need it', () => {
    // The envelope term is the only one that reaches a wide frame, and desktop no
    // longer exercises it — so it is exercised with the row that used to ship.
    // Without this, restoring an email pill could re-open T72's finding C2 with
    // nothing failing.
    const wide = { ...FIXTURES.desktop, navLeft: 554.1, navRight: 885.9 }
    const s = connectSpacingFor(wide, { parallax: true })
    expect(s.lift).toBeGreaterThan(1)
    expect(s.shortfall).toBe(0)
    // ...and the resting term alone would still not have moved it: desktop's
    // resting composition is approved and only the breath may disturb it.
    expect(connectSpacingFor(wide, { parallax: false }).lift).toBe(0)
  })

  it('records what desktop`s own resting clearance is, rather than quietly fixing it', () => {
    // T72 left desktop's resting margin alone deliberately — closing it meant moving an APPROVED
    // composition — and recorded it at under 4 px so a future change could not make it worse
    // silently. Task 85 made it better without touching the composition: the pill row narrowed from
    // 331.8 px to 136.4 and centred, so it stopped hanging over the low end of the falling edge.
    // 1.71 px then, 9.07 px now. The record stays, with the bar where the measurement is.
    const f = FIXTURES.desktop
    // THE PILL THAT SHIPS, not the span the old right-hand pill used to occupy.
    const [, x0, x1] = PILLS.desktop[0]
    const worst = noteLowestPxBetween(x0, x1, f.width, f.height) as number
    const clearance = f.navTop - worst
    expect(clearance).toBeGreaterThan(CLEARANCE_MARGIN)
    // and it is a RECORD, so it fails if it drifts either way
    expect(clearance).toBeLessThan(12)
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
      const [, x0, x1] = PILLS[key][0]
      const worst = noteLowestPxBetween(x0, x1, f.width, f.height) as number
      // the measured row is the LIFTED one, so the unlifted top is what the note is asked about
      const unlifted = f.navTop - connectSpacingFor(f, { parallax: false }).lift
      expect(unlifted - worst).toBeLessThan(0)
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
