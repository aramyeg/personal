/**
 * ONE RELEASE LAW (E3 BW-12) — a reader-lifted piece LATCHES, and fold-flat at
 * book close stays supreme.
 *
 * Before this, release semantics differed by family and the readers noticed
 * every seam: the s5 gold pavilion "snaps all the way back to the closed tent…
 * delightful while held, deflating on let-go" while the identical mechanism one
 * chapter later latched open ("nothing distinguishes them visually… that felt
 * like a bug, not a choice"); the s6 stall row "springs fully back to raised on
 * release; nothing persists"; the s7 scribe "springs straight back"; the s3
 * stir undid itself in 300ms.
 *
 * The law: the channel keeps the angle the reader left, and the SHOWN value is
 * that angle times the piece's own page-openness envelope — the lift-flap
 * persistence composition, a_shown = a_user * E(beta). It latches at rest and
 * it is EXACTLY zero at beta = 0, so a held state can never survive the close.
 */

import { describe, expect, it } from 'vitest'
import {
  solveStripFlapPoseAt,
  stripFlapCamLift,
  stripFlapHoldEnvelope,
  type StripFlapGeom,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import {
  solveTabPiecePoseAt,
  tabPieceCamShape,
  tabPieceCeiling,
  tabPieceLift,
  tabPieceStopLift,
  type TabPieceGeom,
} from '@/components/labs/storybook/book/popup-tabpiece'
import {
  LIFTFLAP_TOUCH_SLOP,
  doorSlopFactors,
  type LiftFlapGeom,
} from '@/components/labs/storybook/book/popup-liftflap'
import {
  swarmArcEnvelope,
  swarmDeployAngle,
  type SwarmArcGeom,
} from '@/components/labs/storybook/book/popup-swarmarc'
import {
  readUserDrive,
  resetUserDrives,
  writeUserDrive,
  beginGrabChannel,
  activeGrabId,
} from '@/components/labs/storybook/user-drive'
import { popupContentForSpread, SPREAD_COUNT } from '@/components/labs/storybook/content'
import type { SceneLayer } from '@/components/labs/storybook/content'

const rad = (d: number): number => (d * Math.PI) / 180
const REST = rad(176)
/** Symmetric page angles for a dihedral (the bloom idiom the other suites use). */
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]

/** Off-page lift of a vertex: its distance from the page plane through the
 *  spine at angle `t`. FOLDING FLAT means every vertex lies IN that plane, not
 *  that y is zero — at the closed book both pages point the same way and the
 *  page plane is vertical. */
const offPage = (v: Vec3, t: number): number => Math.abs(v[0] * Math.sin(t) - v[1] * Math.cos(t))

const locate = (id: string): SceneLayer => {
  for (let s = 0; s < SPREAD_COUNT; s++) {
    const layer = popupContentForSpread(s)?.layers.find((l) => l.id === id)
    if (layer) return layer
  }
  throw new Error(`no layer ${id}`)
}

const STRIPFLAPS = ['ch1-rank', 'ch3-ring-tower', 'ch5-throng', 'ch5-tea', 'ch6-clerk']
const TABPIECES = ['ch4-goldpile', 'ch5-raise-stall']
const LIFTFLAPS = ['ch1-keyboard', 'ch6-coffer']

describe('strip flap — latch, then fold flat', () => {
  for (const id of STRIPFLAPS) {
    const geom = locate(id) as SceneLayer & StripFlapGeom

    it(`${id}: the hold envelope is 1 at rest and EXACTLY 0 at book close`, () => {
      expect(stripFlapHoldEnvelope(geom, rad(geom.erectAtDeg ?? 176))).toBeCloseTo(1, 12)
      expect(stripFlapHoldEnvelope(geom, 0)).toBe(0)
    })

    it(`${id}: the envelope is monotone in the dihedral (no unwind mid-turn)`, () => {
      let prev = -1
      for (let i = 0; i <= 200; i++) {
        const e = stripFlapHoldEnvelope(geom, (i / 200) * REST)
        expect(e).toBeGreaterThanOrEqual(prev - 1e-12)
        prev = e
      }
    })

    it(`${id}: a piece left at its own page cam renders bit-identically`, () => {
      // The latch must not change the shipped, non-interactive look: the cam
      // value at rest IS the anti-flip ceiling by construction, so a_user =
      // cam(rest) reproduces cam(beta) at every dihedral.
      const restCam = stripFlapCamLift(geom, REST)
      for (const beta of [REST, rad(120), rad(60), rad(20), rad(2)]) {
        expect(restCam * stripFlapHoldEnvelope(geom, beta)).toBeCloseTo(
          stripFlapCamLift(geom, beta),
          12
        )
      }
    })

    it(`${id}: ANY held angle is flat at book close`, () => {
      const held = Math.PI / 2 // the anti-flip ceiling: the worst case
      const beta = 1e-7
      const [tL, tR] = bloom(beta)
      const pose = solveStripFlapPoseAt(geom, held * stripFlapHoldEnvelope(geom, beta), tL, tR)
      const t = geom.side === 'left' ? tL : tR
      for (const v of [...pose.right, ...pose.left]) expect(offPage(v, t)).toBeLessThan(1e-4)
    })

    it(`${id}: the latch never steps faster than the un-driven page cam`, () => {
      // The turn-step budget (gate UT) is INHERITED rather than re-argued: a
      // held angle can never exceed 90deg, which is exactly the cam's own rest
      // value, so a_user/cam(rest) <= 1 at every dihedral.
      expect(stripFlapCamLift(geom, rad(geom.erectAtDeg ?? 176))).toBeCloseTo(Math.PI / 2, 9)
    })
  }
})

describe('tab piece — latch, then fold flat', () => {
  for (const id of TABPIECES) {
    const geom = locate(id) as SceneLayer & TabPieceGeom

    it(`${id}: the cam shape is 1 at rest and EXACTLY 0 at book close`, () => {
      expect(tabPieceCamShape(geom, rad(geom.restAtDeg ?? 176))).toBeCloseTo(1, 12)
      expect(tabPieceCamShape(geom, 0)).toBe(0)
    })

    it(`${id}: the whole family is built from that one shape`, () => {
      for (const beta of [REST, rad(120), rad(45), rad(5), 0]) {
        const s = tabPieceCamShape(geom, beta)
        expect(tabPieceLift(geom, beta)).toBeCloseTo(rad(geom.liftDeg ?? 55) * s, 12)
        expect(tabPieceCeiling(geom, beta)).toBeCloseTo(tabPieceStopLift(geom) * s, 12)
      }
    })

    it(`${id}: a tab left at its page cam renders bit-identically`, () => {
      const restLift = tabPieceLift(geom, REST)
      for (const beta of [REST, rad(120), rad(60), rad(10)]) {
        expect(restLift * tabPieceCamShape(geom, beta)).toBeCloseTo(tabPieceLift(geom, beta), 12)
      }
    })

    it(`${id}: a tab held at its mechanical stop is flat at book close`, () => {
      const held = tabPieceStopLift(geom)
      const beta = 1e-7
      const [tL, tR] = bloom(beta)
      const t = geom.side === 'left' ? tL : tR
      const shown = Math.min(held * tabPieceCamShape(geom, beta), tabPieceCeiling(geom, beta))
      for (const patch of solveTabPiecePoseAt(geom, shown, tL, tR)) {
        for (const v of patch.quad) expect(offPage(v, t)).toBeLessThan(1e-4)
      }
    })

    it(`${id}: a held tab never outruns the always-on ceiling`, () => {
      // min(a_user, a_stop) * S <= a_stop * S = the ceiling, at every dihedral —
      // so the latch adds no per-frame step the ceiling did not already gate.
      const held = tabPieceStopLift(geom)
      for (let i = 0; i <= 100; i++) {
        const beta = (i / 100) * REST
        expect(held * tabPieceCamShape(geom, beta)).toBeLessThanOrEqual(
          tabPieceCeiling(geom, beta) + 1e-12
        )
      }
    })
  }
})

describe('swarm stir — the latched stroke still folds flat', () => {
  const geom = locate('ch2-swarm') as SceneLayer & SwarmArcGeom

  it('carries the held stroke through the envelope, so beta = 0 zeroes it', () => {
    expect(swarmArcEnvelope(geom, 0)).toBe(0)
    for (const strut of geom.struts) {
      // At book close the deploy angle is 0 for ANY held stir stroke.
      expect(swarmDeployAngle(geom, strut, 0, geom.stir.stroke)).toBe(0)
    }
  })

  it('a full held stroke actually changes the stirred struts at rest', () => {
    const stirred = geom.struts.filter((s) => s.stir >= 0)
    expect(stirred.length).toBeGreaterThan(0)
    const moved = stirred.filter(
      (s) =>
        Math.abs(
          swarmDeployAngle(geom, s, REST, geom.stir.stroke) - swarmDeployAngle(geom, s, REST, 0)
        ) > rad(1)
    )
    expect(moved.length).toBeGreaterThan(0)
  })
})

describe('lift-flap door pads never overlap a neighbour', () => {
  for (const id of LIFTFLAPS) {
    const geom = locate(id) as SceneLayer & LiftFlapGeom
    it(`${id}: every door's slop band is disjoint from every other's`, () => {
      // s2 finding 4 ("row 1 always falls shut on release while 2/3/4 hold"):
      // overlapping pads let one press engage two different doors, and the
      // second engage overwrote the first's grab record.
      const factors = doorSlopFactors(geom.doors)
      expect(factors).toHaveLength(geom.doors.length)
      const bands = geom.doors.map((d, k) => {
        const lo = Math.min(d.z0, d.z1)
        const hi = Math.max(d.z0, d.z1)
        const grow = ((factors[k] - 1) * (hi - lo)) / 2
        return [lo - grow, hi + grow] as const
      })
      for (let a = 0; a < bands.length; a++) {
        expect(factors[a]).toBeGreaterThanOrEqual(1)
        expect(factors[a]).toBeLessThanOrEqual(LIFTFLAP_TOUCH_SLOP)
        for (let b = a + 1; b < bands.length; b++) {
          const overlap = Math.min(bands[a][1], bands[b][1]) - Math.max(bands[a][0], bands[b][0])
          expect(overlap).toBeLessThanOrEqual(1e-12)
        }
      }
    })
  }

  it('keeps the full pad for a single-door board (nothing to collide with)', () => {
    expect(doorSlopFactors([{ z0: 0, z1: 0.1, reveal: 'key', plate: 1 }])).toEqual([
      LIFTFLAP_TOUCH_SLOP,
    ])
  })
})

describe('resetUserDrives — a reopened page is a fresh pop-up (BW-19)', () => {
  it('drops every held value and any active grab identity', () => {
    writeUserDrive('a', 0.5)
    writeUserDrive('b~2', 1.1)
    beginGrabChannel('a')
    expect(readUserDrive('a')).toBe(0.5)
    expect(activeGrabId()).toBe('a')
    resetUserDrives()
    expect(readUserDrive('a')).toBeUndefined()
    expect(readUserDrive('b~2')).toBeUndefined()
    expect(activeGrabId()).toBeNull()
  })
})
