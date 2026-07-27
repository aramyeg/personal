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
import { CHAPTERS } from '@/components/labs/storybook/content'
import {
  S4_DIAL_ROUTES,
  S4_DIAL_SECTORS,
  dialRouteSignature,
  s4StageForSector,
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

// The shipped s4 route plate, READ FROM content.ts rather than transcribed. The
// transcription is how this file spent a whole round gating a dial the book no
// longer shipped: the geometry moved in content and every V-gate here went on
// passing against the old numbers. Now it cannot.
const CFG: VolvelleGeom = (() => {
  const layer = CHAPTERS.flatMap((c) => c.layers).find((l) => l.id === 'ch3-dispatch')
  if (!layer || layer.mech !== 'volvelle') throw new Error('ch3-dispatch is not a volvelle any more')
  return layer
})()
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
    expect(deg(Delta)).toBeCloseTo(360 / CFG.sectors, 9)
  })
})

/**
 * V11 — DETENT VISIBILITY, and then CONSEQUENCE (the art half of the s4 "dead
 * handle" finding, twice over).
 *
 * V5 above proves the MECHANISM has something to show: one detent step moves a
 * new sector index under the window. That gate passed the entire time the first
 * blind reader was reporting "the disc region changed by zero" after 450 degrees
 * of dragging, because an index changing is worth nothing if the two sectors are
 * painted the same picture. Round 2 answered that with eight distinct
 * destinations, and the RE-review found it had fixed the wrong half: "the only
 * changed pixels in the entire 1600x900 frame were four 32-px blocks on the dial
 * itself." Eight badges in three 23 x 13 px windows is an INDEX; it reports a
 * state, it cannot mean anything.
 *
 * So the wheel now carries FOUR CROSSINGS of the raven canyon behind one big
 * die-cut arch, and this gate holds two things a picture-changing mechanism
 * needs and a badge carousel does not:
 *   THE PICTURE IS BIG ENOUGH TO BE A PICTURE — asserted in world units off the
 *     shipped geometry, so a future shrink of the plate has to come through here.
 *   THE PICTURE ACTUALLY CHANGES — asserted against the painter's own contract
 *     (scripts/storybook/s4-dial-routes.mjs), never against a luminance box
 *     measured off a capture, which is the house rule.
 */
describe('V11 route plate — one click must change the PICTURE, not an index', () => {
  it('the stage table matches the shipped sector count', () => {
    expect(S4_DIAL_SECTORS).toBe(CFG.sectors)
    expect(S4_DIAL_ROUTES.length).toBe(CFG.sectors)
  })

  it('THE APERTURE IS A PICTURE, not a slot: one window, and it owns most of the plate', () => {
    // The reveal is now a single arch rather than three portholes.
    expect(CFG.windows.length).toBe(1)
    const win = CFG.windows[0]
    // Its ANGULAR width, against the registration ceiling (180/S - margin). The
    // old dial's 16deg half-width could not have been wider with eight sectors;
    // this one takes nearly all of what four sectors allow.
    expect(win.halfWidthDeg).toBeGreaterThanOrEqual(38)
    // Its RADIAL run, as a fraction of the dial: the old band was 0.44R, this
    // is 0.70R — the full legal span between the hub deadzone and the rim.
    expect(win.rHalf * 2).toBeGreaterThanOrEqual(0.68)
    // And the world size that follows, which is the number the reader feels.
    // The arch's world extent is 2*rHalf*radius radially by
    // 2*sin(halfWidth)*(rMid+rHalf)*radius across: both must clear the old
    // dial's WHOLE 0.22-wide disc, i.e. the window is now bigger than the
    // instrument it replaced.
    const radial = 2 * win.rHalf * CFG.radius
    const across = 2 * Math.sin(rad(win.halfWidthDeg)) * (win.rMid + win.rHalf) * CFG.radius
    expect(radial).toBeGreaterThan(0.11)
    expect(across).toBeGreaterThan(0.22)
  })

  it('the crossing appears: exactly one stage has no span, and it is the one the wheel rests on', () => {
    // "A bridge appeared over a river" is ONE BIT, and this is that bit. The
    // untouched plate must show the empty gulf, so the reader's first click is
    // the moment the route comes into existence.
    const unspanned = S4_DIAL_ROUTES.filter((r) => r.span === 0)
    expect(unspanned.length).toBe(1)
    expect(S4_DIAL_ROUTES[0].span).toBe(0)
    // and the UNTOUCHED plate frames it: the wheel rests on the empty gulf, so
    // the reader's first click is the moment the route comes into existence.
    expect(s4StageForSector(volvelleSectorSeen(CFG, CFG.windows[0], 0))).toBe(0)
  })

  it('no two stages share a silhouette signature, and adjacent ones differ in at least two ways', () => {
    const sigs = S4_DIAL_ROUTES.map((r) => dialRouteSignature(r).join('|'))
    expect(new Set(sigs).size, `duplicate signatures: ${sigs.join(' / ')}`).toBe(sigs.length)
    const keys = S4_DIAL_ROUTES.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
    // Adjacency is the case the reader actually experiences — one click — so it
    // gets the stricter bar: two independent differences, not one.
    for (let k = 0; k < S4_DIAL_ROUTES.length; k++) {
      const a = S4_DIAL_ROUTES[k]
      const b = S4_DIAL_ROUTES[(k + 1) % S4_DIAL_ROUTES.length]
      const diffs = [
        a.span !== b.span,
        a.taut !== b.taut,
        a.lamps !== b.lamps,
        a.ravens !== b.ravens,
        a.carriers !== b.carriers,
        a.glow !== b.glow,
      ].filter(Boolean).length
      expect(diffs, `stages ${a.key} -> ${b.key} differ in only ${diffs} way(s)`).toBeGreaterThanOrEqual(2)
    }
  })

  it('the differences are COUNTS, which is what survives 70 x 62 screen px', () => {
    // Tone alone was round 1's mistake and a badge silhouette was round 2's
    // ceiling; what reads at this size is how many bright things there are.
    for (const field of ['lamps', 'ravens', 'carriers', 'glow'] as const) {
      const vals = S4_DIAL_ROUTES.map((r) => r[field])
      expect(new Set(vals).size, `${field} never varies`).toBeGreaterThanOrEqual(2)
      for (const v of vals) expect(v).toBeGreaterThanOrEqual(0)
    }
    // Two of them have to carry a real RANGE, not just an on/off: a picture
    // whose every difference is binary is four pictures, not one that builds.
    const wide = (['lamps', 'ravens', 'carriers', 'glow'] as const).filter(
      (f) => new Set(S4_DIAL_ROUTES.map((r) => r[f])).size >= 3
    )
    expect(wide.length, `only ${wide.join(', ')} vary by more than on/off`).toBeGreaterThanOrEqual(2)
    // and the picture BUILDS: light, birds and traffic are non-decreasing along
    // the wheel, so a reader turning it one way is watching a route come alive
    // rather than watching four unrelated pictures shuffle.
    for (let k = 1; k < S4_DIAL_ROUTES.length; k++) {
      const a = S4_DIAL_ROUTES[k - 1]
      const b = S4_DIAL_ROUTES[k]
      expect(b.glow).toBeGreaterThanOrEqual(a.glow)
      expect(b.ravens).toBeGreaterThanOrEqual(a.ravens)
      expect(b.lamps).toBeGreaterThanOrEqual(a.lamps)
    }
  })

  it('WHAT THE READER SEES: every click swaps the whole picture, in both directions', () => {
    for (let d = 0; d < S; d++) {
      for (const dir of [1, -1]) {
        const before = S4_DIAL_ROUTES[s4StageForSector(volvelleSectorSeen(CFG, CFG.windows[0], d * Delta))]
        const after = S4_DIAL_ROUTES[s4StageForSector(volvelleSectorSeen(CFG, CFG.windows[0], (d + dir) * Delta))]
        expect(before.key).not.toBe(after.key)
        expect(dialRouteSignature(before).join('|')).not.toBe(dialRouteSignature(after).join('|'))
      }
    }
  })

  it('the plate opts in to the honest crank read', () => {
    // The systems patch fixed the winch's raw-atan2 sweep and left the volvelle
    // carrying it, to be converted per piece. This is that conversion, gated so
    // it cannot be lost in a merge.
    expect(CFG.crank).toBe('tangential')
  })
})
