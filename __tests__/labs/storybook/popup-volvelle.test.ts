import { describe, expect, it } from 'vitest'
import {
  solveVolvellePose,
  volvelleDetentStep,
  volvelleHubFrame,
  volvelleSectorSeen,
  volvelleSnap,
  volvelleThetaMax,
  VOLVELLE_CARD_LIFT,
  VOLVELLE_LIFT,
  type VolvelleGeom,
} from '@/components/labs/storybook/book/popup-volvelle'
import { ROTOR_LIFT } from '@/components/labs/storybook/book/popup-rotor'
import type { PanelQuad, Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { PAGE_H, PAGE_W, easeTurnWeighted } from '@/components/labs/storybook/book/page-geometry'
import {
  S4_DIAL_ROUTES,
  S4_DIAL_SECTORS,
  dialRouteSignature,
} from '../../../scripts/storybook/s4-dial-routes.mjs'

// VOLVELLE gates, ported in-engine from the source-of-truth bench
// .superpowers/sdd/bench/derive-volvelle.mjs (V1-V10). The shipped dial is
// PAGE-ROOTED (mirroring the s4 winch); this uses the shipped ch3-dispatch
// config so the in-engine gates track content.ts exactly.

const rad = (d: number): number => (d * Math.PI) / 180
const deg = (r: number): number => (r * 180) / Math.PI
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]
const REST = rad(176)
const GLOBAL_CAP = 0.0497
const TAU = Math.PI * 2

// The shipped s4 dispatch dial (content.ts ch3-dispatch).
const CFG: VolvelleGeom = {
  mech: 'volvelle',
  side: 'right',
  hubD: 0.6,
  hubZ: 0.36,
  radius: 0.11,
  sectors: 8,
  windows: [
    { psiDeg: 45, halfWidthDeg: 16, rMid: 0.62, rHalf: 0.22 },
    { psiDeg: 90, halfWidthDeg: 16, rMid: 0.62, rHalf: 0.22 },
    { psiDeg: 135, halfWidthDeg: 16, rMid: 0.62, rHalf: 0.22 },
  ],
}
const S = CFG.sectors
const Delta = volvelleDetentStep(CFG)

const pairwise = (q: PanelQuad): number[] => {
  const ds: number[] = []
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ds.push(dist(q[a], q[b]))
  return ds
}
/** Signed distance of a point off the page plane (through the spine/origin). */
const offPage = (p: Vec3, n: Vec3): number => dot(p, n)

describe('volvelle — dispatch dial gates (bench derive-volvelle.mjs, page-rooted)', () => {
  it('V1 coplanar: over the beta sweep the dial rides within ROTOR_LIFT and the card exactly one paper thickness above it', () => {
    const theta = 3 * Delta + 0.21 // adversarial off-detent frozen twist
    let maxDialOff = 0
    let maxCardOff = 0
    for (let i = 0; i <= 200; i++) {
      const beta = (REST * i) / 200
      const [tL, tR] = bloom(beta)
      const { n } = volvelleHubFrame(CFG, tL, tR, 0)
      const pose = solveVolvellePose(CFG, tL, tR, theta)
      for (const p of pose.dial) maxDialOff = Math.max(maxDialOff, Math.abs(offPage(p, n)))
      for (const p of pose.card) maxCardOff = Math.max(maxCardOff, Math.abs(offPage(p, n)))
      // the two hub centres are exactly one glue layer apart, parallel
      const dialC = volvelleHubFrame(CFG, tL, tR, VOLVELLE_LIFT).center
      const cardC = volvelleHubFrame(CFG, tL, tR, VOLVELLE_CARD_LIFT).center
      expect(offPage(cardC, n) - offPage(dialC, n)).toBeCloseTo(ROTOR_LIFT, 9)
    }
    expect(maxDialOff).toBeLessThanOrEqual(VOLVELLE_LIFT + 1e-9)
    expect(maxCardOff).toBeLessThanOrEqual(VOLVELLE_CARD_LIFT + 1e-9)
  })

  it('A2/A12 rigidity: the dial + card squares keep their pairwise corner distances across the theta + beta sweep', () => {
    const ref = solveVolvellePose(CFG, ...bloom(REST), 0)
    const refDial = pairwise(ref.dial)
    const refCard = pairwise(ref.card)
    for (const theta of [0, TAU * 0.3, TAU * 0.7, TAU]) {
      for (const betaDeg of [10, 60, 120, 176]) {
        const pose = solveVolvellePose(CFG, ...bloom(rad(betaDeg)), theta)
        pairwise(pose.dial).forEach((d, k) => expect(d).toBeCloseTo(refDial[k], 9))
        pairwise(pose.card).forEach((d, k) => expect(d).toBeCloseTo(refCard[k], 9))
      }
    }
  })

  it('V3 registration: each window fits inside one sector and its centre is congruent to a sector centre (mod Delta)', () => {
    const margin = rad(4)
    for (const w of CFG.windows) {
      expect(2 * rad(w.halfWidthDeg)).toBeLessThanOrEqual(Delta - 2 * margin + 1e-12)
      const k = Math.round(rad(w.psiDeg) / Delta)
      expect(Math.abs(rad(w.psiDeg) - k * Delta)).toBeLessThan(1e-9)
    }
  })

  it('V4 detent lock: at every detent each window frames exactly ONE sector, centred, no straddle', () => {
    const margin = rad(4)
    for (let d = 0; d < S; d++) {
      const thetaD = d * Delta
      for (const w of CFG.windows) {
        const c = rad(w.psiDeg) - thetaD
        const off = c - Math.round(c / Delta) * Delta // offset from nearest sector centre
        expect(Math.abs(off) + rad(w.halfWidthDeg)).toBeLessThanOrEqual(Delta / 2 - margin + 1e-9)
      }
    }
  })

  it('V5 reveal: the three windows read distinct sectors at every detent, and one detent step changes every window (art changes on spin)', () => {
    for (let d = 0; d < S; d++) {
      const seen = CFG.windows.map((w) => volvelleSectorSeen(CFG, w, d * Delta))
      expect(new Set(seen).size).toBe(CFG.windows.length) // distinct
      for (const w of CFG.windows) {
        const a0 = volvelleSectorSeen(CFG, w, d * Delta)
        const a1 = volvelleSectorSeen(CFG, w, (d + 1) * Delta)
        expect(a0).not.toBe(a1) // advances one sector per detent
      }
    }
  })

  it('V6 radial fit: every window band clears the hub deadzone and sits inside the dial radius', () => {
    for (const w of CFG.windows) {
      expect(w.rMid - w.rHalf).toBeGreaterThanOrEqual(0.25 - 1e-9)
      expect(w.rMid + w.rHalf).toBeLessThanOrEqual(0.96 + 1e-9)
    }
  })

  it('V7 drag: wrapped-delta accumulation over a monotone pointer sweep is monotone, and one pointer revolution winds exactly 2pi of theta', () => {
    const { center, e1, e2 } = volvelleHubFrame(CFG, ...bloom(REST), VOLVELLE_LIFT)
    const wrapDelta = (x: number): number => Math.atan2(Math.sin(x), Math.cos(x))
    const rProbe = 0.7 * CFG.radius
    let theta = 0
    let last: number | null = null
    let prev = 0
    for (let i = 0; i <= 720; i++) {
      const ang = (TAU * i) / 720
      const rel: Vec3 = [
        e1[0] * rProbe * Math.cos(ang) + e2[0] * rProbe * Math.sin(ang),
        e1[1] * rProbe * Math.cos(ang) + e2[1] * rProbe * Math.sin(ang),
        e1[2] * rProbe * Math.cos(ang) + e2[2] * rProbe * Math.sin(ang),
      ]
      void center
      const measured = Math.atan2(dot(rel, e2), dot(rel, e1))
      if (last !== null) theta += wrapDelta(measured - last)
      last = measured
      expect(theta).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = theta
    }
    expect(theta).toBeCloseTo(TAU, 6)
  })

  it('V8 snap: lands exactly on detents, is idempotent there, and moves any theta to the nearest detent (|move| <= Delta/2)', () => {
    for (let d = 0; d <= S; d++) {
      const td = d * Delta
      expect(volvelleSnap(CFG, td)).toBeCloseTo(td, 12)
      expect(volvelleSnap(CFG, volvelleSnap(CFG, td))).toBeCloseTo(td, 12)
    }
    const wrapDelta = (x: number): number => Math.atan2(Math.sin(x), Math.cos(x))
    for (let i = 0; i <= 2000; i++) {
      const t = (TAU * i) / 2000
      const s = volvelleSnap(CFG, t)
      expect(Math.abs(wrapDelta(s - t))).toBeLessThanOrEqual(Delta / 2 + 1e-9)
    }
  })

  it('V9 fold-flat: at book-closed every dial + card corner sits within the lift class of the flat page and inside the page rectangle, for ANY frozen theta', () => {
    const { n } = volvelleHubFrame(CFG, 0, 0, 0)
    for (const theta of [0, Delta / 2, 3 * Delta + 0.21, TAU - 0.1]) {
      const pose = solveVolvellePose(CFG, 0, 0, theta)
      for (const p of [...pose.dial, ...pose.card]) {
        expect(Math.abs(offPage(p, n))).toBeLessThanOrEqual(VOLVELLE_CARD_LIFT + 1e-9)
        expect(p[0]).toBeGreaterThanOrEqual(-1e-9)
        expect(p[0]).toBeLessThanOrEqual(PAGE_W + 1e-9)
        expect(Math.abs(p[2])).toBeLessThanOrEqual(PAGE_H / 2 + 1e-9)
      }
    }
  })

  it('V10 speed cap: at a frozen reader theta, the dial corner real-time step over the eased page-turn clock stays under the global cap', () => {
    const theta = 3 * Delta + 0.21
    let capMax = 0
    let prev: PanelQuad | null = null
    for (let i = 0; i <= 240; i++) {
      const beta = Math.PI * easeTurnWeighted(i / 240)
      const q = solveVolvellePose(CFG, ...bloom(beta), theta).dial
      if (prev) for (let c = 0; c < 4; c++) capMax = Math.max(capMax, dist(prev[c], q[c]))
      prev = q
    }
    expect(capMax).toBeLessThan(GLOBAL_CAP)
  })

  it('the dial is a free-spinning hand-driven handle: THETA_MAX is a full revolution', () => {
    expect(volvelleThetaMax()).toBeCloseTo(TAU, 12)
    expect(deg(Delta)).toBeCloseTo(45, 9)
  })
})

/**
 * V11 — DETENT VISIBILITY (the art half of the s4 "dead handle" finding).
 *
 * V5 above proves the MECHANISM has something to show: one detent step moves a
 * new sector index under every window. That gate passed the entire time the
 * blind reader was reporting "the disc region changed by zero" after 450 degrees
 * of dragging, because an index changing is worth nothing if the two sectors are
 * painted the same picture. The dial's eight sectors were six near-identical
 * raven roundels plus two glyphs, so a detent step — exactly one sector — mostly
 * swapped a roundel for a roundel and rendered pixel-identically.
 *
 * So this gate is on the ART, and it reads the painter's own route table
 * (scripts/storybook/s4-dial-routes.mjs — the single source of truth the
 * `dispatchDial` painter builds from) rather than a luminance box measured off a
 * capture. Nothing here can pass unless a reader who clicks the dial one notch
 * sees a different destination in every window.
 */
describe('V11 dial art — a detent step must LOOK different, not merely index differently', () => {
  it('the route table matches the shipped sector count', () => {
    expect(S4_DIAL_SECTORS).toBe(CFG.sectors)
    expect(S4_DIAL_ROUTES.length).toBe(CFG.sectors)
  })

  it('every sector carries a UNIQUE principal device — the thing that changes shape on a click', () => {
    const marks = S4_DIAL_ROUTES.map((r) => r.mark)
    expect(new Set(marks).size, `duplicate marks: ${marks.join(', ')}`).toBe(marks.length)
    // and a unique destination legend, so the engraving differs too
    const keys = S4_DIAL_ROUTES.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('no two sectors share a silhouette signature, and adjacent ones differ in at least two ways', () => {
    const sigs = S4_DIAL_ROUTES.map((r) => dialRouteSignature(r).join('|'))
    expect(new Set(sigs).size, `duplicate signatures: ${sigs.join(' / ')}`).toBe(sigs.length)
    // Adjacency is the case the reader actually experiences — one click — so it
    // gets the stricter bar: two independent differences, not one.
    for (let k = 0; k < S4_DIAL_ROUTES.length; k++) {
      const a = S4_DIAL_ROUTES[k]
      const b = S4_DIAL_ROUTES[(k + 1) % S4_DIAL_ROUTES.length]
      const diffs = [a.mark !== b.mark, a.ravens !== b.ravens, a.field !== b.field].filter(Boolean).length
      expect(diffs, `sectors ${a.key} -> ${b.key} differ in only ${diffs} way(s)`).toBeGreaterThanOrEqual(2)
    }
  })

  it('the raven count and the traffic weight both vary, so difference survives 1x', () => {
    // A count of birds is the one distinction that reads when a sector is 20px
    // tall on a night page; tone alone was the old design's mistake.
    expect(new Set(S4_DIAL_ROUTES.map((r) => r.ravens)).size).toBeGreaterThanOrEqual(3)
    const weights = S4_DIAL_ROUTES.map((r) => r.weight)
    expect(new Set(weights).size).toBe(weights.length)
    for (const w of weights) expect(w).toBeGreaterThan(0)
  })

  it('every bearing is distinct and lands on its own sector centre', () => {
    const bearings = S4_DIAL_ROUTES.map((r) => r.bearingDeg)
    expect(new Set(bearings).size).toBe(bearings.length)
    S4_DIAL_ROUTES.forEach((r, k) => {
      expect(r.bearingDeg).toBeCloseTo(k * deg(Delta), 9)
    })
  })

  it('WHAT THE READER SEES: at every detent, every window frames a different destination than one click earlier', () => {
    for (let d = 0; d < S; d++) {
      for (const w of CFG.windows) {
        const before = S4_DIAL_ROUTES[volvelleSectorSeen(CFG, w, d * Delta)]
        const after = S4_DIAL_ROUTES[volvelleSectorSeen(CFG, w, (d + 1) * Delta)]
        expect(before.key).not.toBe(after.key)
        expect(dialRouteSignature(before).join('|')).not.toBe(dialRouteSignature(after).join('|'))
      }
      // and the three windows never show the same destination as each other, so
      // the card reads as three slots of one sorting wall rather than a repeat.
      const shown = CFG.windows.map((w) => S4_DIAL_ROUTES[volvelleSectorSeen(CFG, w, d * Delta)].key)
      expect(new Set(shown).size).toBe(shown.length)
    }
  })
})
