import { describe, expect, it } from 'vitest'
import {
  solveTabPiecePose,
  tabPieceFlatSpan,
  type TabPieceFace,
} from '@/components/labs/storybook/book/popup-tabpiece'
import type { TabPieceGeom, PanelQuad, Vec3 } from '@/components/labs/storybook/book/popup-mechanics'

// TAB PIECE face-presentation invariant (D6 feel-batch guard). The tab piece
// renders each non-tab patch's PAINTED face on THREE.FrontSide, with a dark
// BackSide interior mesh behind it (popup-tabpiece-layer.tsx). If a patch's
// winding put its FrontSide toward the page interior, the reader would see the
// dark interior instead of the art. This gate proves that never happens for
// EITHER form ('mound' / 'table') on EITHER page (side 'left' / 'right') at
// rest: every non-tab patch's outward FrontSide normal (a) has a positive
// page-normal component (points out of the page, not into it) and (b) faces
// the reading camera — so the painted band is what renders. The market table
// (table form, side left) is the piece the D6 review scrutinised; the goldpile
// (mound form, side right) is the shipped reference.

// Reading camera (book-scene.tsx / art-overlap.test.ts).
const EYE: Vec3 = [0, 2.6, 2.9]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const normalize = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
// FrontSide normal from the geometry winding [0,1,2, 0,2,3] = (v1-v0) x (v2-v0),
// the exact triangle order makeFaceGeometry indexes (popup-tabpiece-layer.tsx).
const frontNormal = (q: PanelQuad): Vec3 => normalize(cross(sub(q[1], q[0]), sub(q[2], q[0])))
const centroid = (q: PanelQuad): Vec3 => [
  (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4,
  (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4,
  (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4,
]
// The page normal into the wedge (popup-tabpiece.ts pagePoint), for each side.
const pageNormal = (side: 'left' | 'right', t: number): Vec3 =>
  side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]

const BASE = { kind: 'midground', role: 'scenery', mech: 'tabpiece', hingeX: 0.9, z0: 0.26, z1: 0.54 } as const
// Both forms on both pages. Leg/deck spans from the shipped market table; the
// mound leg width from the shipped goldpile — the two real pieces, plus their
// mirror-page synthetic twins for full form x side coverage.
const CASES: Record<string, TabPieceGeom> = {
  'mound-right': { ...BASE, id: 'g', side: 'right', form: 'mound', legW: 0.26, liftDeg: 55 } as TabPieceGeom,
  'mound-left': { ...BASE, id: 'g', side: 'left', form: 'mound', legW: 0.26, liftDeg: 55 } as TabPieceGeom,
  'table-right': { ...BASE, id: 'g', side: 'right', form: 'table', legW: 0.18, deckD: 0.2, liftDeg: 60 } as TabPieceGeom,
  'table-left': { ...BASE, id: 'g', side: 'left', form: 'table', legW: 0.18, deckD: 0.2, liftDeg: 60 } as TabPieceGeom,
}

// Documented UV v-bands per face (tabFaceUvs, popup-tabpiece-layer.tsx): the
// unfolded die-cut, arc length from the inner hinge over the flat span.
const documentedBand = (face: TabPieceFace, g: TabPieceGeom): [number, number] => {
  const span = tabPieceFlatSpan(g)
  const w = g.legW / span
  const d = (g.deckD ?? 0) / span
  const bands: Partial<Record<TabPieceFace, [number, number]>> = {
    slopeIn: [0, 0.5],
    slopeOut: [0.5, 1],
    legIn: [0, w],
    deck: [w, w + d],
    legOut: [w + d, 1],
  }
  return bands[face] ?? [0, 1]
}

describe('tab piece — face presentation invariant (D6 guard, all form x side)', () => {
  // rest bloom: a symmetric open book (beta ~ 2.6 rad), the settled reading pose.
  const beta = 2.6
  const thetaL = Math.PI / 2 + beta / 2
  const thetaR = Math.PI / 2 - beta / 2

  it.each(Object.entries(CASES))('%s: every painted face points OUT of the page (not into the interior)', (_name, geom) => {
    const t = geom.side === 'left' ? thetaL : thetaR
    const n = pageNormal(geom.side, t)
    const patches = solveTabPiecePose(geom, thetaL, thetaR)
    const painted = patches.filter((p) => p.face !== 'tab')
    expect(painted.length).toBeGreaterThanOrEqual(2)
    for (const p of painted) {
      const fn = frontNormal(p.quad)
      // (a) the FrontSide (painted side) points out of the page, never into it.
      expect(dot(fn, n), `${p.face}: FrontSide points into the page interior`).toBeGreaterThan(0)
      // (b) and it faces the reading camera, so the art is what renders.
      const toCam = normalize(sub(EYE, centroid(p.quad)))
      expect(dot(fn, toCam), `${p.face}: FrontSide turned away from the camera`).toBeGreaterThan(0)
    }
  })

  it('table form lays legs/deck in disjoint art bands covering the whole print', () => {
    const g = CASES['table-left']
    const [legInA, legInB] = documentedBand('legIn', g)
    const [deckA, deckB] = documentedBand('deck', g)
    const [legOutA, legOutB] = documentedBand('legOut', g)
    // contiguous, ordered, and spanning [0,1] — legs frame a central deck band.
    expect(legInA).toBeCloseTo(0, 9)
    expect(legInB).toBeCloseTo(deckA, 9)
    expect(deckB).toBeCloseTo(legOutA, 9)
    expect(legOutB).toBeCloseTo(1, 9)
    // the deck (laden top) owns the middle; each leg owns an outer band.
    expect(deckA).toBeGreaterThan(0.2)
    expect(deckB).toBeLessThan(0.8)
  })
})
