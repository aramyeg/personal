import { describe, expect, it } from 'vitest'
import {
  CLEARANCE_MARGIN,
  GAP_BASE,
  GAP_FLOOR,
  INSET_BASE,
  INSET_FLOOR,
  NARROW_MAX_WIDTH,
  connectSpacingFor,
  noteLowestPxBetween,
} from '@/components/labs/small-world/overlay/connect-clearance'
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

describe('the desktop resting layout is untouched', () => {
  it('returns the authored spacings, to the bit, at the reference frame', () => {
    const s = connectSpacingFor(FIXTURES.desktop)
    expect(Object.is(s.gap, GAP_BASE)).toBe(true)
    expect(Object.is(s.inset, INSET_BASE)).toBe(true)
    expect(Object.is(s.lift, 0)).toBe(true)
  })

  it('returns them at every width from the narrow bound upwards', () => {
    for (const width of [NARROW_MAX_WIDTH, 1024, 1280, 1440, 1920, 2560, 5120]) {
      const s = connectSpacingFor({ ...FIXTURES.desktop, width })
      expect(Object.is(s.gap, GAP_BASE), `gap moved at ${width}`).toBe(true)
      expect(Object.is(s.inset, INSET_BASE), `inset moved at ${width}`).toBe(true)
      expect(Object.is(s.lift, 0), `lift non-zero at ${width}`).toBe(true)
    }
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
      const s = connectSpacingFor(f)

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
      const s = connectSpacingFor(FIXTURES[key])
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
      const first = connectSpacingFor(f)
      expect(first.lift).toBeGreaterThan(0)

      // what the DOM reports once the lift is applied, and what the hook must hand back in
      const measuredTop = f.navTop + first.lift
      const second = connectSpacingFor({ ...f, navTop: measuredTop - first.lift })

      expect(second.gap, `${key} gap drifted on re-measure`).toBe(first.gap)
      expect(second.inset, `${key} inset drifted on re-measure`).toBe(first.inset)
      expect(second.lift, `${key} lift drifted on re-measure`).toBe(first.lift)
    }
  })

  it('would COLLAPSE if the round trip forgot to undo the lift', () => {
    // the mutation: hand the lifted rectangle in raw. The row now looks like it already clears, so
    // the solver asks for nothing and the layout snaps back — which is the defect, not a pass.
    const f = FIXTURES.phone390
    const first = connectSpacingFor(f)
    const naive = connectSpacingFor({ ...f, navTop: f.navTop + first.lift })
    expect(naive.lift).toBe(0)
    expect(naive.gap).toBe(GAP_BASE)
  })

  it('spends the gap before the inset', () => {
    const s = connectSpacingFor(FIXTURES.phone390)
    // the inset is only touched once the gap has hit its floor
    if (s.inset < INSET_BASE) expect(s.gap).toBe(GAP_FLOOR)
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
