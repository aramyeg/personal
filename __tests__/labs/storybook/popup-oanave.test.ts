import { describe, expect, it } from 'vitest'
import {
  oanaveChevronDeg,
  oanavePatches,
  oanavePatchCount,
  oanaveReliefFrame,
  solveOanaveHostPose,
  type OanaveGeom,
} from '@/components/labs/storybook/book/popup-oanave'
import {
  solveLayerPose,
  spreadDihedral,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import { easeTurnWeighted, PAGE_H, restAngles } from '@/components/labs/storybook/book/page-geometry'
import { popupContentForSpread, type SceneLayer } from '@/components/labs/storybook/content'

// OANAVE family gates OA-1..OA-10 (s7 scene pack §4a) + the two MEASURE-FIRST
// numbers the pack review ordered before art (R2 hero sweep, R3 chevron /
// phi-rho pairing). Source-of-truth benches: e3s7-oa-foldflat.mjs (plan-model
// identities) and e3s7-nave-sightline.mjs (camera reads) — the sightline math
// is ported here VERBATIM but driven from live content values, so a retune
// re-gates automatically.

const S7 = popupContentForSpread(7)
if (!S7) throw new Error('spread 7: no pop-up content')
const isNave = (l: SceneLayer): l is SceneLayer & OanaveGeom => l.mech === 'oanave'
const RANKS = S7.layers.filter(isNave)
const rank = (id: string): SceneLayer & OanaveGeom => {
  const l = RANKS.find((r) => r.id === id)
  if (!l) throw new Error(`missing nave rank ${id}`)
  return l
}
const NAVE = ['ch6-nave-d', 'ch6-nave-c', 'ch6-nave-b', 'ch6-nave-a'].map(rank) // mouth -> apse

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]
// The spread's real rest pose (the book blooms at ~176 deg, never dead flat).
const REST: [number, number] = [Math.PI - restAngles(7).aL, restAngles(7).aR]

describe('oanave family — geometry gates OA-1..OA-6 (fold physics)', () => {
  it('OA-1 arm identity E = H per stratum, err < 1e-12 across the fold range', () => {
    for (const r of NAVE) {
      for (let beta = 0.05; beta <= Math.PI + 1e-9; beta += 0.1) {
        const patches = oanavePatches(r, ...bloom(beta))
        for (const p of patches) {
          if (p.stratum === undefined) continue
          const e = r.strata[p.stratum].e
          // quad = [crease@v0, score@v0, score@v1, crease@v1]: both cut edges
          // must measure exactly the arm e in 3D (H) — and the uv rect spans
          // exactly e/width in sheet space (E), so E = H identically.
          expect(Math.abs(dist(p.quad[0], p.quad[1]) - e)).toBeLessThan(1e-12)
          expect(Math.abs(dist(p.quad[3], p.quad[2]) - e)).toBeLessThan(1e-12)
          expect(Math.abs(Math.abs(p.uv[2] - p.uv[0]) * r.width - e)).toBeLessThan(1e-12)
        }
      }
    }
  })

  it('OA-2 score || cut audit: every score/crease line parallel to the central fold; cuts end on scores', () => {
    for (const r of NAVE) {
      for (const beta of [0.4, 1.6, Math.PI]) {
        const [tL, tR] = bloom(beta)
        const pose = solveOanaveHostPose(r, tL, tR)
        const patches = oanavePatches(r, tL, tR)
        for (const p of patches) {
          if (p.stratum === undefined) continue
          // Side edges (the score line and the mountain crease) run along the
          // host crease direction: cross product with it vanishes.
          for (const [a, b] of [
            [p.quad[0], p.quad[3]],
            [p.quad[1], p.quad[2]],
          ] as const) {
            const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
            const l = Math.hypot(d[0], d[1], d[2])
            const cx = d[1] * pose.crease[2] - d[2] * pose.crease[1]
            const cy = d[2] * pose.crease[0] - d[0] * pose.crease[2]
            const cz = d[0] * pose.crease[1] - d[1] * pose.crease[0]
            expect(Math.hypot(cx, cy, cz) / l).toBeLessThan(1e-12)
          }
          // The cut edges (band top/bottom) begin on the crease line and end
          // on the score line — corner-shared by construction; assert the cut
          // edge length equals the arm (no dangling cut past a score).
          const e = r.strata[p.stratum].e
          expect(Math.abs(dist(p.quad[0], p.quad[1]) - e)).toBeLessThan(1e-12)
        }
      }
    }
  })

  it('OA-3 fold-flat: zero out-of-plane residual at book-closed; relief contained in the rank silhouette', () => {
    for (const r of NAVE) {
      // beta = 0: both pages vertical at PI/2 — the page plane is x = 0.
      const patches = oanavePatches(r, Math.PI / 2, Math.PI / 2)
      for (const p of patches) {
        for (const c of p.quad) expect(Math.abs(c[0])).toBeLessThan(1e-12)
      }
      // Cut-from containment is structural (a stratum never leaves its
      // sheet): every relief corner stays inside the host panels' flat
      // bounding box, closed-book worst case.
      const host = patches.filter((p) => p.stratum === undefined).flatMap((p) => p.quad)
      const lo = [Math.min(...host.map((c) => c[1])), Math.min(...host.map((c) => c[2]))]
      const hi = [Math.max(...host.map((c) => c[1])), Math.max(...host.map((c) => c[2]))]
      for (const p of patches) {
        if (p.stratum === undefined) continue
        for (const c of p.quad) {
          expect(c[1]).toBeGreaterThanOrEqual(lo[0] - 1e-9)
          expect(c[1]).toBeLessThanOrEqual(hi[0] + 1e-9)
          expect(c[2]).toBeGreaterThanOrEqual(lo[1] - 1e-9)
          expect(c[2]).toBeLessThanOrEqual(hi[1] + 1e-9)
        }
      }
    }
  })

  it('OA-4 monotone crease excursion over the turn (2e sin alpha, alpha rest -> 90 deg)', () => {
    for (const r of NAVE) {
      if (r.strata.length === 0) continue
      let prev = Infinity
      for (let beta = 0.05; beta <= Math.PI + 1e-9; beta += 0.05) {
        const { cosG } = oanaveReliefFrame(solveOanaveHostPose(r, ...bloom(beta)))
        // Excursion shrinks from 2e (closed, collinear) to 2e sin(alpha_rest):
        // cosG must fall monotonically as the book opens.
        expect(cosG).toBeLessThanOrEqual(prev + 1e-12)
        prev = cosG
      }
    }
  })

  it('OA-5 standing excursion pops INTO the inter-rank gap and clears it by 0.05', () => {
    const stations = NAVE.map((r) => r.apexZ) // mouth -> apse, descending z
    NAVE.forEach((r, i) => {
      if (r.strata.length === 0) return
      const pose = solveOanaveHostPose(r, ...REST)
      const { b, cosG } = oanaveReliefFrame(pose)
      // The relief bisector points toward the next-deeper rank (-z): the
      // strata pop away from the camera, into the gap behind the face.
      expect(b[2]).toBeLessThan(0)
      const gap = Math.abs(stations[i] - stations[i + 1])
      for (const st of r.strata) {
        const excursion = 2 * st.e * cosG
        expect(excursion, `${r.id} ${st.kind} excursion vs gap ${gap}`).toBeLessThan(gap - 0.05)
      }
    })
  })

  it('OA-6 fold-back band 2e fits the solid sheet band it is cut from', () => {
    // Tympanum strata (band above the aperture apex): the bench-conservative
    // solid halfwidth is 0.28. In-portal strata (the column pairs): the
    // fold-back band must fit inside the aperture opening it stands in.
    for (const r of NAVE) {
      r.strata.forEach((st) => {
        if (!r.aperture || st.band[0] >= r.aperture.apexH) {
          expect(2 * st.e, `${r.id} ${st.kind}`).toBeLessThanOrEqual(0.28)
        } else {
          expect(2 * st.e, `${r.id} ${st.kind}`).toBeLessThanOrEqual(2 * r.aperture.halfW)
        }
        // and always inside the rank halfwidth
        expect(2 * st.e).toBeLessThanOrEqual(r.width / 2)
      })
    }
  })

  it('order-2 cascade: keystone parents are order-1, max order 2, child arm <= parent arm, band nested', () => {
    for (const r of NAVE) {
      r.strata.forEach((st) => {
        if (st.parent === undefined) return
        const parent = r.strata[st.parent]
        expect(parent).toBeDefined()
        expect(parent.parent, `${r.id}: cascade deeper than order 2`).toBeUndefined()
        expect(st.e).toBeLessThanOrEqual(parent.e)
        expect(st.band[0]).toBeGreaterThanOrEqual(parent.band[0] - 1e-9)
        expect(st.band[1]).toBeLessThanOrEqual(parent.band[1] + 1e-9)
      })
      expect(oanavePatchCount(r)).toBe(2 + r.strata.length * 2)
    }
  })
})

describe('oanave R3 — chevron / phi-rho pairing (MEASURE-FIRST, pack review decision 3)', () => {
  it('solved rest chevron gives real relief pop on every strata-bearing rank (>= 10 deg, pop in the READ band)', () => {
    const rows: Record<string, { chevronDeg: number; worstPop: number }> = {}
    for (const r of NAVE) {
      const alpha = oanaveChevronDeg(r, ...REST)
      let worstPop = Infinity
      for (const st of r.strata) {
        const pop = st.e * Math.sin((alpha * Math.PI) / 180) // beyond the score chord
        worstPop = Math.min(worstPop, pop)
        if (st.parent !== undefined) {
          expect(pop, `${r.id} ${st.kind} (order-2) pop`).toBeGreaterThanOrEqual(0.01)
        } else {
          expect(pop, `${r.id} ${st.kind} pop`).toBeGreaterThanOrEqual(0.018)
          expect(pop, `${r.id} ${st.kind} pop`).toBeLessThanOrEqual(0.065)
        }
      }
      if (r.strata.length > 0) {
        expect(alpha, `${r.id} chevron — relief goes shy under 10 deg (R3)`).toBeGreaterThanOrEqual(10)
      }
      rows[r.id] = { chevronDeg: Number(alpha.toFixed(2)), worstPop: r.strata.length ? Number(worstPop.toFixed(4)) : NaN }
    }
    console.table(rows)
  })
})

describe('oanave R2 — hero sweep (MEASURE-FIRST, pack review decision 3)', () => {
  it('ch6-nave-a clears the wow floor 0.525 across an incoming turn', () => {
    const apse = rank('ch6-nave-a')
    const [tL0, tR0] = bloom(spreadDihedral('incoming', 'next', easeTurnWeighted(0)))
    const [tL1, tR1] = bloom(spreadDihedral('incoming', 'next', easeTurnWeighted(1)))
    const q0 = [...solveLayerPose(apse, undefined, tL0, tR0).right, ...solveLayerPose(apse, undefined, tL0, tR0).left]
    const q1 = [...solveLayerPose(apse, undefined, tL1, tR1).right, ...solveLayerPose(apse, undefined, tL1, tR1).left]
    let sweep = 0
    for (let k = 0; k < q0.length; k++) sweep = Math.max(sweep, dist(q0[k], q1[k]))
    console.log(`R2 measured hero sweep ch6-nave-a = ${sweep.toFixed(4)} (floor ${(0.35 * PAGE_H).toFixed(3)})`)
    expect(sweep).toBeGreaterThanOrEqual(0.35 * PAGE_H)
  })
})

// ---------------------------------------------------------------------------
// Sightline gates OA-7..OA-10 — the e3s7-nave-sightline.mjs camera model,
// ported verbatim, driven from live content values.

const CAM = { x: 0, y: 1.85, z: 3.05 }
const LOOK = { x: 0, y: 0.38, z: 0.05 }
const FOV_V = (34 * Math.PI) / 180
const ASPECT = 16 / 9
type P3 = { x: number; y: number; z: number }
const sub = (a: P3, b: P3): P3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const norm3 = (v: P3): P3 => {
  const l = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}
const cross3 = (a: P3, b: P3): P3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const dot3 = (a: P3, b: P3): number => a.x * b.x + a.y * b.y + a.z * b.z
const FWD = norm3(sub(LOOK, CAM))
const RIGHT = norm3(cross3(FWD, { x: 0, y: 1, z: 0 }))
const UP = cross3(RIGHT, FWD)
const tanV = Math.tan(FOV_V / 2)
const tanH = tanV * ASPECT
const proj = (p: P3) => {
  const v = sub(p, CAM)
  const d = dot3(v, FWD)
  return { sx: dot3(v, RIGHT) / d / tanH, sy: dot3(v, UP) / d / tanV }
}
const fracH = (a: P3, b: P3) => Math.abs(proj(a).sy - proj(b).sy) / 2
const fracW = (a: P3, b: P3) => Math.abs(proj(a).sx - proj(b).sx) / 2
const grazeY = (y0: number, z0: number, z: number) => y0 + ((y0 - CAM.y) / (z0 - CAM.z)) * (z - z0)

describe('oanave sightline gates OA-7..OA-10 (ported bench, live content)', () => {
  const naveRows = NAVE.map((r) => ({
    id: r.id,
    z: r.apexZ,
    h: r.height,
    hw: r.width / 2,
    apW: r.aperture?.halfW ?? 0,
    apH: r.aperture?.apexH ?? 0,
  }))

  it('OA-7 crown band >= 0.10 world AND >= 3% frame height per rank', () => {
    const dais = S7.layers.find((l) => l.id === 'ch6-steps')
    const box = S7.layers.find((l) => l.id === 'ch6-strongbox')
    if (!dais || dais.mech !== 'platform' || !box || box.mech !== 'box') throw new Error('s7 occluders missing')
    const occl: { y: number; z: number }[] = [
      { y: dais.strutA.rise, z: dais.deckZ1 },
      { y: box.height, z: box.z1 },
    ]
    for (const r of naveRows) {
      let clip = 0
      for (const o of occl) clip = Math.max(clip, grazeY(o.y, o.z, r.z))
      const band = r.h - clip
      const f = fracH({ x: 0, y: clip, z: r.z }, { x: 0, y: r.h, z: r.z })
      expect(band, `${r.id} crown band world`).toBeGreaterThanOrEqual(0.1)
      expect(f, `${r.id} crown band frameH`).toBeGreaterThanOrEqual(0.03)
      occl.push({ y: r.h, z: r.z })
    }
  })

  it('OA-8 wing exposure >= 0.08/side; jamb rims >= 1% frame width', () => {
    for (let i = 0; i < naveRows.length - 1; i++) {
      const near = naveRows[i]
      const deep = naveRows[i + 1]
      const scale = (CAM.z - deep.z) / (CAM.z - near.z)
      const exposed = deep.hw - near.hw * scale
      expect(exposed, `${deep.id} wing exposure beyond ${near.id}`).toBeGreaterThanOrEqual(0.08)
    }
    for (let i = 0; i < 2; i++) {
      const near = naveRows[i]
      const deep = naveRows[i + 1]
      const rim = fracW(
        { x: near.apW, y: 0.1, z: near.z },
        { x: (deep.apW * (CAM.z - near.z)) / (CAM.z - deep.z), y: 0.1, z: near.z }
      )
      expect(rim, `jamb rim ${near.id} -> ${deep.id}`).toBeGreaterThanOrEqual(0.01)
    }
  })

  it('OA-9 floor vista through the mouth portal >= 0.35 world (and the apse face stays invisible)', () => {
    const mouth = naveRows[0]
    const apse = naveRows[naveRows.length - 1]
    const s = (CAM.y - mouth.apH) / (CAM.z - mouth.z)
    const zFloorMax = mouth.z - mouth.apH / s
    expect(mouth.z - zFloorMax).toBeGreaterThanOrEqual(0.35)
    // Design premise: the glow must be PAINTED (dome band + pooled floor
    // light) because no ray through the portal reaches the apse face.
    expect(grazeY(mouth.apH, mouth.z, apse.z)).toBeLessThanOrEqual(0)
  })

  it('OA-10 crop: tallest silhouette point at sy x 1.2 <= 1', () => {
    const apse = NAVE[NAVE.length - 1]
    const domeTop = proj({ x: 0, y: apse.height, z: apse.apexZ })
    expect(Math.abs(domeTop.sy) * 1.2).toBeLessThanOrEqual(1)
  })

  it('R7 content invariant: the strongbox group stays under the 0.12 height freeze', () => {
    const box = S7.layers.find((l) => l.id === 'ch6-strongbox')
    const crest = S7.layers.find((l) => l.id === 'ch6-crest')
    if (!box || box.mech !== 'box' || !crest || crest.mech !== 'rider') throw new Error('strongbox group missing')
    expect(box.height).toBeLessThanOrEqual(0.12)
    expect(crest.height).toBeLessThanOrEqual(0.12)
  })
})
