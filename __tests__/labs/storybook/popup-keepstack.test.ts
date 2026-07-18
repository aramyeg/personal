import { describe, expect, it } from 'vitest'
import {
  keepStackBalconyDeck,
  keepStackCrownHeight,
  keepStackFacadePlate,
  keepStackQuads,
  keepStackSeatHeight,
  keepStackSpirePoses,
  keepStackSpireRaven,
  keepStackStoryGeoms,
  keepStackTelescopes,
  solveKeepStackPose,
  type KeepStackGeom,
} from '@/components/labs/storybook/book/popup-keepstack'
import { solveBoxPose, type PanelQuad, type Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { PAGE_H, PAGE_W, easeTurnWeighted } from '@/components/labs/storybook/book/page-geometry'
import { CHAPTERS, type SceneLayer } from '@/components/labs/storybook/content'

// THE DISPATCH KEEP — STORY CASCADE gates, ported in-engine from the source-of-
// truth bench .superpowers/sdd/bench/derive-keep-stack.mjs (S1-S8) and derive-
// keep-gallery.mjs (the balcony, B1-B6). Run against the SHIPPED keep from
// content.ts so the covenant catches any drift of the bench-proven constants.

const rad = (d: number): number => (d * Math.PI) / 180
const REST = rad(176)
const GLOBAL_CAP = 0.0497
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
/** Symmetric bloom angles for a dihedral beta. */
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]

const KEEP = CHAPTERS.find((c) => c.spread === 4)!.layers.find(
  (l): l is SceneLayer & KeepStackGeom => l.mech === 'keepstack'
)!

const pairwise = (q: PanelQuad): number[] => {
  const ds: number[] = []
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ds.push(dist(q[a], q[b]))
  return ds
}

describe('dispatch keep — story cascade (bench derive-keep-stack.mjs / gallery.mjs)', () => {
  it('the shipped keep has three box stories that telescope inward with nested z-spans (crown retired for the fan spire)', () => {
    expect(KEEP.stories.length).toBe(3)
    expect(KEEP.stories.map((s) => s.key)).toEqual(['hall', 'gallery', 'loft'])
    expect(keepStackTelescopes(KEEP)).toBe(true)
    // nested z-spans: each story sits within the one below (bench S6b honesty).
    for (let k = 1; k < KEEP.stories.length; k++) {
      const lower = KEEP.stories[k - 1]
      const s = KEEP.stories[k]
      expect(s.a).toBeLessThanOrEqual(lower.a + 1e-12)
      expect(s.z0).toBeGreaterThanOrEqual(lower.z0 - 1e-12)
      expect(s.z1).toBeLessThanOrEqual(lower.z1 + 1e-12)
    }
  })

  it('S1 flat-fold: at book-closed every story (+ balcony + raven) lies exactly in the page plane', () => {
    // At (0, 0) the page plane is y = 0; every vertex must collapse onto it for
    // ANY of the keep's parts — the whole keep folds dead flat.
    let maxOff = 0
    for (const q of keepStackQuads(KEEP, 0, 0)) for (const p of q) maxOff = Math.max(maxOff, Math.abs(p[1]))
    expect(maxOff).toBeLessThanOrEqual(1e-9)
  })

  it('S2 rigidity: every story patch keeps its rest edge/diagonal lengths across the whole sweep', () => {
    const geoms = keepStackStoryGeoms(KEEP)
    const ref = geoms.map((g) => solveBoxPose(g, ...bloom(REST)).map((p) => pairwise(p.quad)))
    for (const betaDeg of [10, 60, 120, 176]) {
      geoms.forEach((g, gi) => {
        solveBoxPose(g, ...bloom(rad(betaDeg))).forEach((patch, pi) => {
          pairwise(patch.quad).forEach((d, k) => expect(d).toBeCloseTo(ref[gi][pi][k], 9))
        })
      })
    }
  })

  it('S3 glue chain: each upper story’s wall bottom stays glued on the lower story’s lid', () => {
    const geoms = keepStackStoryGeoms(KEEP)
    let maxGap = 0
    for (let i = 0; i <= 120; i++) {
      const [tL, tR] = bloom((Math.PI * i) / 120)
      const h = (tL - tR) / 2
      const ch = Math.cos(h)
      const sh = Math.sin(h)
      const m = (tL + tR) / 2
      const cm = Math.cos(m)
      const sm = Math.sin(m)
      for (let k = 1; k < geoms.length; k++) {
        const lower = geoms[k - 1]
        const s = geoms[k]
        const lidBaseX = (lower.baseH ?? 0) + lower.height
        for (const zEnd of [s.z0, s.z1]) {
          const lx = lidBaseX + s.a * ch
          const ly = s.a * sh
          const lid: Vec3 = [lx * cm - ly * sm, lx * sm + ly * cm, zEnd]
          // the story's own wall glue point at the same lid-distance a_k
          const wx = (s.baseH ?? 0) + s.a * ch
          const wy = s.a * sh
          const wall: Vec3 = [wx * cm - wy * sm, wx * sm + wy * cm, zEnd]
          maxGap = Math.max(maxGap, dist(wall, lid))
        }
      }
    }
    expect(maxGap).toBeLessThanOrEqual(1e-9)
  })

  it('S5/T7 height: the FAN SPIRE peak clears its loft-lid seat (structural ~0.89, raven crest ~1.01 world)', () => {
    // Concept A: the gabled crown box is replaced by a fan spire seated on the loft
    // lid. PHASE 1 height refit pulled the hall+gallery caps down to their plate
    // heights, dropping the seat 0.65 -> 0.5448 and the whole spire ~0.105. The
    // spire members are UNCHANGED, so the structural peak (seat + peak-member crease
    // run) is ~0.891 and the raven crest tops out ~1.011 at the tilted rest bloom —
    // a pierced peak clearing its seat by ~0.35, not a lid (bench T7).
    expect(keepStackSeatHeight(KEEP)).toBeCloseTo(0.5448, 6) // hall+gallery+loft
    expect(keepStackCrownHeight(KEEP)).toBeCloseTo(0.8914, 3)
    expect(keepStackCrownHeight(KEEP) - keepStackSeatHeight(KEEP)).toBeGreaterThan(0.3)
    // measured world-Y at the tilted rest bloom: the raven crest pierces well above.
    let topY = -Infinity
    for (const q of keepStackQuads(KEEP, ...bloom(REST))) for (const p of q) topY = Math.max(topY, p[1])
    expect(topY).toBeGreaterThan(0.93)
  })

  it('S4 containment: the flat-fold footprint fits the page (reach <= PAGE_W, z in +-PAGE_H/2)', () => {
    let reach = 0
    let zMin = Infinity
    let zMax = -Infinity
    for (const q of keepStackQuads(KEEP, 0, 0))
      for (const p of q) {
        reach = Math.max(reach, Math.abs(p[0]), Math.abs(p[1]))
        zMin = Math.min(zMin, p[2])
        zMax = Math.max(zMax, p[2])
      }
    expect(reach).toBeLessThanOrEqual(PAGE_W + 1e-9)
    expect(zMin).toBeGreaterThanOrEqual(-PAGE_H / 2 - 1e-9)
    expect(zMax).toBeLessThanOrEqual(PAGE_H / 2 + 1e-9)
  })

  it('S8 real-time: the worst per-vertex step over an eased page turn stays under the global cap', () => {
    const STN = 240
    let capMax = 0
    let prev: Vec3[] | null = null
    for (let i = 0; i <= STN; i++) {
      const tL = Math.PI
      const tR = easeTurnWeighted(i / STN) * Math.PI // outgoing: dihedral PI -> 0
      const verts = keepStackQuads(KEEP, tL, tR).flat()
      if (prev) for (let c = 0; c < verts.length; c++) capMax = Math.max(capMax, dist(prev[c], verts[c]))
      prev = verts
    }
    expect(capMax).toBeLessThan(GLOBAL_CAP)
  })

  describe('the jutting balcony (derive-keep-gallery.mjs)', () => {
    it('B1 folds exactly flat at book-closed', () => {
      const deck = keepStackBalconyDeck(KEEP, 0, 0)!
      for (const q of [deck.deckL, deck.deckR]) for (const p of q) expect(Math.abs(p[1])).toBeLessThanOrEqual(1e-9)
    })

    it('B2 reads horizontal at rest (a shelf, not a rake) — deck plane tilt < 12deg', () => {
      const deck = keepStackBalconyDeck(KEEP, ...bloom(REST))!
      const e1: Vec3 = [
        deck.deckL[1][0] - deck.deckL[0][0],
        deck.deckL[1][1] - deck.deckL[0][1],
        deck.deckL[1][2] - deck.deckL[0][2],
      ]
      const e2: Vec3 = [
        deck.deckL[3][0] - deck.deckL[0][0],
        deck.deckL[3][1] - deck.deckL[0][1],
        deck.deckL[3][2] - deck.deckL[0][2],
      ]
      const n: Vec3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
      const l = Math.hypot(n[0], n[1], n[2])
      const fromHoriz = Math.acos(Math.min(1, Math.abs(n[1]) / l)) // angle of the normal from +Y
      expect(fromHoriz).toBeLessThanOrEqual(rad(12))
    })

    it('B3 containment: the deck never crosses the fore edge (+PAGE_H/2) at any beta', () => {
      let maxZ = -Infinity
      for (let i = 0; i <= 200; i++) {
        const deck = keepStackBalconyDeck(KEEP, Math.PI, (i / 200) * Math.PI)!
        for (const q of [deck.deckL, deck.deckR]) for (const p of q) maxZ = Math.max(maxZ, p[2])
      }
      expect(maxZ).toBeLessThanOrEqual(PAGE_H / 2 + 1e-9)
    })

    it('B6 rigidity: the deck rides the hall lid rigidly (edge lengths preserved)', () => {
      const refLen = (q: PanelQuad): number[] => [
        dist(q[0], q[1]),
        dist(q[1], q[2]),
        dist(q[2], q[3]),
        dist(q[3], q[0]),
      ]
      const ref = refLen(keepStackBalconyDeck(KEEP, ...bloom(REST))!.deckL)
      for (let i = 0; i <= 200; i++) {
        const l = refLen(keepStackBalconyDeck(KEEP, Math.PI, (i / 200) * Math.PI)!.deckL)
        for (let k = 0; k < 4; k++) if (ref[k] > 1e-9) expect(Math.abs(l[k] - ref[k]) / ref[k]).toBeLessThanOrEqual(1e-9)
      }
    })
  })

  describe('die-cut facade plates (the raven-finial idiom generalized to tier fronts)', () => {
    const PLATED = ['hall', 'gallery', 'loft'] as const

    it('every plated tier suppresses its cap-front art (capFrontArt:false) so the cap stays raw bracing paper', () => {
      const geoms = keepStackStoryGeoms(KEEP)
      for (const g of geoms) {
        const plated = PLATED.includes(g.key as (typeof PLATED)[number])
        expect(g.plate !== undefined).toBe(plated)
        // plated -> capFrontArt false (cap hidden behind the plate); else default (art on).
        if (plated) expect(g.capFrontArt).toBe(false)
        else expect(g.capFrontArt).toBeUndefined()
      }
    })

    it('each plate mesh aspect (width/height) equals the delivered UNCROPPED art aspect', () => {
      // hall 4.448 (curtain wall), gallery 3.677 (arcade loggia), loft 2.427
      // (belfry roof+bell). The crown plate is retired with the crown box.
      const want: Record<string, number> = { hall: 4.448, gallery: 3.677, loft: 2.427 }
      for (const key of PLATED) {
        const plate = KEEP.stories.find((s) => s.key === key)!.plate!
        expect(plate.width / plate.height).toBeCloseTo(want[key], 2)
      }
    })

    it('plates fold dead flat at book-closed (inherited from the coplanar cap — S1 covers, asserted directly)', () => {
      for (const key of PLATED) {
        const plate = keepStackFacadePlate(KEEP, key, 0, 0)!
        for (const q of [plate.plateL, plate.plateR]) for (const p of q) expect(Math.abs(p[1])).toBeLessThanOrEqual(1e-9)
      }
    })

    it('plates are rigid across the sweep (coplanar cap-plane extension, zero off-plane DOF)', () => {
      const refLen = (q: PanelQuad): number[] => [dist(q[0], q[1]), dist(q[1], q[2]), dist(q[2], q[3]), dist(q[3], q[0])]
      for (const key of PLATED) {
        const ref = refLen(keepStackFacadePlate(KEEP, key, ...bloom(REST))!.plateL)
        for (let i = 0; i <= 120; i++) {
          const l = refLen(keepStackFacadePlate(KEEP, key, ...bloom((Math.PI * i) / 120))!.plateL)
          for (let k = 0; k < 4; k++) if (ref[k] > 1e-9) expect(Math.abs(l[k] - ref[k]) / ref[k]).toBeLessThanOrEqual(1e-9)
        }
      }
    })
  })

  it('the balcony deck is seat-lifted off the hall lid (no coplanar z-fight) yet folds flat at close', () => {
    // At rest the deck must NOT lie in the hall lid plane (that coplanarity is the
    // reported flicker). Measure the deck's signed distance from the lid plane.
    const [tL, tR] = bloom(REST)
    const lidL = solveBoxPose(keepStackStoryGeoms(KEEP)[0], tL, tR).find((p) => p.face === 'lidL')!.quad
    const e1: Vec3 = [lidL[1][0] - lidL[0][0], lidL[1][1] - lidL[0][1], lidL[1][2] - lidL[0][2]]
    const e2: Vec3 = [lidL[3][0] - lidL[0][0], lidL[3][1] - lidL[0][1], lidL[3][2] - lidL[0][2]]
    const n: Vec3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    const nl = Math.hypot(...n)
    const deck = keepStackBalconyDeck(KEEP, tL, tR)!
    const off = Math.abs(
      ((deck.deckL[0][0] - lidL[0][0]) * n[0] + (deck.deckL[0][1] - lidL[0][1]) * n[1] + (deck.deckL[0][2] - lidL[0][2]) * n[2]) / nl
    )
    expect(off).toBeGreaterThan(0.002) // cleared the lid plane (z-fight broken)
    // still folds dead flat at close (B1, re-asserted with the lift in place).
    const shut = keepStackBalconyDeck(KEEP, 0, 0)!
    for (const q of [shut.deckL, shut.deckR]) for (const p of q) expect(Math.abs(p[1])).toBeLessThanOrEqual(1e-9)
  })

  it('the per-story renderer expansion tags every story and reuses solveBoxPose', () => {
    const solved = solveKeepStackPose(KEEP, ...bloom(REST))
    expect(solved.map((s) => s.key)).toEqual(['hall', 'gallery', 'loft'])
    // each story’s patches match a direct solveBoxPose on its box geom (the
    // renderer draws exactly this through popup-box-layer).
    for (const s of solved) {
      const direct = solveBoxPose(s.geom, ...bloom(REST))
      expect(s.patches.length).toBe(direct.length)
    }
  })

  // THE FAN SPIRE CROWN (bench derive-keep-spire.mjs T1-T8), run against the
  // shipped keep so the covenant catches any drift of the spire constants.
  describe('the fan spire crown (bench derive-keep-spire.mjs)', () => {
    const spireQuads = (tL: number, tR: number): PanelQuad[] => {
      const q: PanelQuad[] = []
      for (const p of keepStackSpirePoses(KEEP, tL, tR)!) q.push(p.left, p.right)
      const rv = keepStackSpireRaven(KEEP, tL, tR)!
      q.push(rv.crestL, rv.crestR)
      return q
    }

    it('T1 folds exactly flat at book-closed (spire members + raven in the page plane)', () => {
      for (const q of spireQuads(0, 0)) for (const p of q) expect(Math.abs(p[1])).toBeLessThanOrEqual(1e-9)
    })

    it('T2 every spire member + raven is rigid across the sweep', () => {
      const ref = spireQuads(...bloom(REST)).map(pairwise)
      for (const betaDeg of [10, 60, 120, 176]) {
        spireQuads(...bloom(rad(betaDeg))).forEach((q, qi) => {
          pairwise(q).forEach((d, k) => {
            if (ref[qi][k] > 1e-9) expect(Math.abs(d - ref[qi][k]) / ref[qi][k]).toBeLessThanOrEqual(1e-9)
          })
        })
      }
    })

    it('T3 body containment: no spire/raven vertex pierces a page over the sweep', () => {
      let minWedge = Infinity
      for (let i = 1; i <= 120; i++) {
        const [tL, tR] = bloom((Math.PI * i) / 120)
        const nL: Vec3 = [Math.sin(tL), -Math.cos(tL), 0]
        const nR: Vec3 = [-Math.sin(tR), Math.cos(tR), 0]
        for (const q of spireQuads(tL, tR))
          for (const p of q) minWedge = Math.min(minWedge, p[0] * nL[0] + p[1] * nL[1], p[0] * nR[0] + p[1] * nR[1])
      }
      expect(minWedge).toBeGreaterThanOrEqual(-1e-9)
    })

    it('T5b seat-slack: every spire vertex sits on/above the loft lid (bisector-x >= seat height)', () => {
      const seat = keepStackSeatHeight(KEEP)
      let minSlack = Infinity
      for (let i = 1; i <= 120; i++) {
        const [tL, tR] = bloom((Math.PI * i) / 120)
        const m = (tL + tR) / 2
        const cm = Math.cos(m)
        const sm = Math.sin(m)
        for (const q of spireQuads(tL, tR)) for (const p of q) minSlack = Math.min(minSlack, p[0] * cm + p[1] * sm - seat)
      }
      expect(minSlack).toBeGreaterThanOrEqual(-1e-9)
    })

    it('T7 the peak member + raven pierce above the old crown top (~0.90 world)', () => {
      let peakY = -Infinity
      for (const q of spireQuads(...bloom(REST))) for (const p of q) peakY = Math.max(peakY, p[1])
      expect(peakY).toBeGreaterThan(0.93)
    })

    it('the raven finial is coplanar with the peak member (folds flat + rides it rigidly)', () => {
      // the raven crease-bottom is the peak member ridge tip; each half lies in
      // the same plane as the peak panel it extends (zero off-plane reach).
      const [tL, tR] = bloom(REST)
      const poses = keepStackSpirePoses(KEEP, tL, tR)!
      const peak = poses[poses.length - 1]
      const rv = keepStackSpireRaven(KEEP, tL, tR)!
      // plane of the peak LEFT panel
      const e1: Vec3 = [peak.left[1][0] - peak.left[0][0], peak.left[1][1] - peak.left[0][1], peak.left[1][2] - peak.left[0][2]]
      const e2: Vec3 = [peak.left[3][0] - peak.left[0][0], peak.left[3][1] - peak.left[0][1], peak.left[3][2] - peak.left[0][2]]
      const n: Vec3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
      const nl = Math.hypot(...n)
      for (const p of rv.crestL) {
        const off = Math.abs(((p[0] - peak.left[0][0]) * n[0] + (p[1] - peak.left[0][1]) * n[1] + (p[2] - peak.left[0][2]) * n[2]) / nl)
        expect(off).toBeLessThanOrEqual(1e-9)
      }
    })
  })
})
