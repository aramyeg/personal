/**
 * THE STAGED CHAIN (E3 s4 round-3) — the new family's own gates.
 *
 * The four FAMILY CONDITIONS from the derivation (playbook §1, bench
 * `.superpowers/sdd/bench/e3-derive-stagedchain.mjs`) plus the two the scene
 * bench (`e3s4-cliffs.mjs`) added: the measured beta-ratio ceiling (house law:
 * measure, then pin) and CLOSED-POSE containment sampled at the closed pose
 * rather than assumed from the deployed one (the s5 lesson).
 *
 * Every gate here is expressed against the SHIPPED cliffs, so a config edit
 * that breaks the family's physics fails the suite rather than the eye.
 */

import { describe, expect, it } from 'vitest'
import { CHAPTERS, type SceneLayer } from '@/components/labs/storybook/content'
import {
  PAGE_H,
  PAGE_W,
  easeTurnWeighted,
  restAngles,
} from '@/components/labs/storybook/book/page-geometry'
import {
  planStagedChainCam,
  solveStagedChainPose,
  stagedChainApex,
  stagedChainBand,
  stagedChainCam,
  stagedChainLength,
  stagedChainNodes,
  stagedChainNodesQ,
  stagedChainQ,
  stagedChainQuads,
  stagedChainClosedDepth,
  stagedChainWedgeExcursion,
  type StagedChainGeom,
} from '@/components/labs/storybook/book/popup-stagedchain'

const GLOBAL_CAP = 0.0497
const N_ST = 240

const chains: (SceneLayer & StagedChainGeom)[] = CHAPTERS.flatMap((c) => c.layers).filter(
  (l): l is SceneLayer & StagedChainGeom => l.mech === 'stagedchain'
)

/** Max per-station beta step of the eased 240-station turn clock. */
const DTHETA_MAX = (() => {
  let m = 0
  for (let i = 0; i < N_ST; i++) {
    m = Math.max(m, (easeTurnWeighted((i + 1) / N_ST) - easeTurnWeighted(i / N_ST)) * Math.PI)
  }
  return m
})()
/** Rotation radius a point may have and still pass the real-time step cap. */
const RADIUS_CAP = GLOBAL_CAP / DTHETA_MAX

const REST_BETA = Math.PI - restAngles(3).aL - restAngles(3).aR

const dist = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** The four house turn paths: the two where the rooted page itself sweeps, and
 *  the two where it rests while the other page moves. */
const PATHS = [
  { name: 'move-out', side: 'right', t: (th: number) => th, beta: (th: number) => Math.PI - th },
  { name: 'move-in', side: 'left', t: (th: number) => th, beta: (th: number) => th },
  { name: 'stat-out', side: 'left', t: () => Math.PI, beta: (th: number) => Math.PI - th },
  { name: 'stat-in', side: 'right', t: () => 0, beta: (th: number) => th },
] as const

/** Poses the chain on an explicit page angle by feeding the solver the
 *  (thetaL, thetaR) pair that produces exactly (t, beta) on its own side. */
function quadsAt(geom: StagedChainGeom, t: number, beta: number) {
  return geom.side === 'left'
    ? stagedChainQuads(geom, t, t - beta)
    : stagedChainQuads(geom, t + beta, t)
}

describe('staged chain — the family exists', () => {
  it('ships two cliffs on chapter III', () => {
    expect(chains.map((c) => c.id)).toEqual(['ch3-cliff-l', 'ch3-cliff-r'])
    expect(chains.map((c) => c.side)).toEqual(['left', 'right'])
  })

  it('is a chain, not a flap: every cliff carries at least two storeys', () => {
    for (const c of chains) expect(c.stages.length).toBeGreaterThanOrEqual(2)
  })

  it('reads as two different cliffs, not a mirrored pair (variety law)', () => {
    const [l, r] = chains
    expect(l.stages.length).not.toBe(r.stages.length)
    expect(l.rootDeg).not.toBe(r.rootDeg)
    expect(stagedChainApex(l, REST_BETA)).not.toBeCloseTo(stagedChainApex(r, REST_BETA), 2)
  })
})

describe.each(chains.map((c) => [c.id, c] as const))(
  'staged chain family conditions — %s',
  (_id, geom) => {
    // ---- CONDITION 4: q(0) = 0 exactly -> fold-flat is free ----------------
    it('condition 4: every joint reads q(0) = 0 EXACTLY, so the wall folds dead flat', () => {
      geom.stages.forEach((_, k) => expect(stagedChainQ(geom, k, 0)).toBe(0))
      for (const [, eta] of stagedChainNodes(geom, 0)) expect(eta).toBe(0)
      expect(stagedChainApex(geom, 0)).toBe(0)
    })

    it('condition 4: the CLOSED pose is sampled and fits the page', () => {
      // Sample the closed pose itself rather than inferring it from the
      // deployed one — the s5 lesson. At beta = 0 every panel must lie in the
      // page plane, and the flat footprint must fit the paper.
      const quads = quadsAt(geom, 0, 0)
      const zs = quads.flat().map((p) => p[2])
      const radii = quads.flat().map((p) => Math.hypot(p[0], p[1]))
      expect(Math.max(...radii)).toBeLessThanOrEqual(PAGE_W + 1e-9)
      expect(Math.max(...zs)).toBeLessThanOrEqual(PAGE_H / 2 + 1e-9)
      expect(Math.min(...zs)).toBeGreaterThanOrEqual(-PAGE_H / 2 - 1e-9)
    })

    it('condition 4: the closed depth matches the style, and fits the page', () => {
      // An ACCORDION superposes to its alternating prefix reach (<= h_0); a
      // RIBBON lies extended and pays the full chain length in page depth.
      // Either way the CLOSED pose — sampled, not inferred — must fit.
      const depth = stagedChainClosedDepth(geom)
      if ((geom.style ?? 'accordion') === 'ribbon') {
        expect(depth).toBeCloseTo(stagedChainLength(geom), 9)
      } else {
        expect(depth).toBeLessThanOrEqual(geom.stages[0].h + 1e-9)
      }
      expect(geom.zc - depth).toBeGreaterThanOrEqual(-PAGE_H / 2)
    })

    // ---- CONDITION 5: wedge containment (this scene's discovery) ----------
    it('condition 5: never pokes through the OTHER page as the book shuts', () => {
      // eta <= F*tan(beta) below a right angle. This is what killed the first
      // accordion cliffs (0.45 past the limit at beta 10deg) and why these are
      // ribbons — an accordion joint tents to ~its own panel height mid-fold,
      // at exactly the small betas the top-down unroll law schedules it for.
      for (let i = 1; i <= 400; i++) {
        const beta = (i / 400) * Math.PI
        if (beta >= Math.PI / 2) break
        expect(stagedChainWedgeExcursion(geom, beta)).toBeLessThanOrEqual(1e-9)
      }
    })

    it('condition 5: an ACCORDION at this height would FAIL the wedge (the wall is real)', () => {
      // Same chain, same cam, accordion folding: the tent appears and the gate
      // trips. Keeps the ribbon choice honest rather than decorative.
      const asAccordion: StagedChainGeom = { ...geom, style: 'accordion' }
      let worst = -Infinity
      for (let i = 1; i <= 400; i++) {
        const beta = (i / 400) * Math.PI
        if (beta >= Math.PI / 2) break
        worst = Math.max(worst, stagedChainWedgeExcursion(asAccordion, beta))
      }
      expect(worst).toBeGreaterThan(0.1)
    })

    // ---- CONDITION 3: top-down unroll --------------------------------------
    it('condition 3: unrolls TOP-DOWN — an upper joint never lags the one below', () => {
      for (let i = 0; i <= N_ST; i++) {
        const beta = (i / N_ST) * Math.PI
        for (let k = 1; k < geom.stages.length; k++) {
          expect(stagedChainQ(geom, k, beta) + 1e-9).toBeGreaterThanOrEqual(
            stagedChainQ(geom, k - 1, beta)
          )
        }
      }
    })

    it('condition 3 consequence: the chain never pierces its own page', () => {
      for (let i = 0; i <= 200; i++) {
        for (const [, eta] of stagedChainNodes(geom, (i / 200) * Math.PI)) {
          expect(eta).toBeGreaterThanOrEqual(-1e-9)
        }
      }
    })

    // ---- CONDITION 2: joint arc fits the eased tails ------------------------
    it('condition 2: the cam drains every joint’s arc into the eased tails', () => {
      expect(stagedChainCam(geom).feasible).toBe(true)
    })

    it('condition 2: every joint cam is MONOTONE in beta (no snap)', () => {
      const { betas, q } = stagedChainCam(geom)
      for (let k = 0; k < geom.stages.length; k++) {
        for (let i = 1; i < betas.length; i++) {
          expect(q[k][i] + 1e-12).toBeGreaterThanOrEqual(q[k][i - 1])
        }
        expect(q[k][betas.length - 1]).toBe(1)
      }
    })

    // ---- CONDITION 1: hold-through-midturn reach ----------------------------
    it('condition 1: holds a shallow enough pose through the fast mid-turn station', () => {
      const rfar = geom.F + geom.w
      const holdCap = Math.sqrt(RADIUS_CAP ** 2 - rfar ** 2)
      // beta = PI/2 is where the eased clock is fastest on both moving paths.
      expect(stagedChainApex(geom, Math.PI / 2)).toBeLessThanOrEqual(holdCap)
    })

    it('condition 1 consequence: real-time worst step clears GLOBAL_CAP on all four paths', () => {
      let worst = 0
      for (const path of PATHS) {
        let prev: readonly (readonly number[])[] | null = null
        for (let i = 0; i <= N_ST; i++) {
          const th = easeTurnWeighted(i / N_ST) * Math.PI
          const pts = quadsAt(geom, path.t(th), path.beta(th)).flat()
          if (prev) for (let c = 0; c < pts.length; c++) worst = Math.max(worst, dist(prev[c], pts[c]))
          prev = pts
        }
      }
      expect(worst).toBeLessThan(GLOBAL_CAP)
    })

    // ---- the measured family ceiling (house law: measure, then pin) ---------
    it('beta-domain max/mean ratio stays under the measured+10% family ceiling', () => {
      let prev: readonly (readonly number[])[] | null = null
      let max = 0
      let sum = 0
      let n = 0
      for (let i = 0; i <= N_ST; i++) {
        const beta = (i / N_ST) * REST_BETA
        const pts = quadsAt(geom, Math.PI / 2 - beta / 2 + (geom.side === 'left' ? beta : 0), beta).flat()
        if (prev) {
          for (let c = 0; c < pts.length; c++) {
            const d = dist(prev[c], pts[c])
            max = Math.max(max, d)
            sum += d
            n++
          }
        }
        prev = pts
      }
      // 13 = 11.15 measured (ch3-cliff-l) + 10%, mirrored in
      // motion-character.test.ts's FAMILY_RATIO_CEILINGS.
      expect(max / (sum / n)).toBeLessThan(13)
    })

    // ---- the pose the reader actually holds ---------------------------------
    it('is FULLY deployed at the book’s real rest dihedral, not at a notional 176deg', () => {
      // The derivation saturated its cam at 176deg; the book rests at 173.72.
      expect((REST_BETA * 180) / Math.PI).toBeLessThan(176)
      geom.stages.forEach((_, k) => expect(stagedChainQ(geom, k, REST_BETA)).toBe(1))
    })

    it('stands tall but leaves the keep the gutter crown, under the crop ceiling', () => {
      const apex = stagedChainApex(geom, REST_BETA)
      expect(apex).toBeGreaterThan(0.7)
      // the keep's fan spire reaches ~1.01; nothing is built above ~1.2
      expect(apex).toBeLessThan(1.0)
      const maxY = quadsAt(geom, Math.PI / 2 - REST_BETA / 2, REST_BETA)
        .flat()
        .reduce((a, p) => Math.max(a, p[1]), 0)
      expect(maxY).toBeLessThanOrEqual(1.2)
    })

    it('is RAKED BACK — the lean-back lever the derivation did not sweep', () => {
      // rootDeg < 90 is what let the cliffs out-mass the retired ring while
      // staying under the keep's crown: the chain is longer than it is tall.
      expect(geom.rootDeg).toBeDefined()
      expect(geom.rootDeg as number).toBeLessThan(90)
      expect(stagedChainLength(geom)).toBeGreaterThan(stagedChainApex(geom, REST_BETA))
    })
  }
)

describe('staged chain — solver contract', () => {
  it('poses one quad per storey, root first, sharing the storey seams', () => {
    for (const geom of chains) {
      const { panels } = solveStagedChainPose(geom, Math.PI, 0)
      expect(panels).toHaveLength(geom.stages.length)
      // panel k's top edge IS panel k+1's base edge (one folded sheet, no gaps)
      for (let k = 0; k + 1 < panels.length; k++) {
        expect(dist(panels[k][3], panels[k + 1][0])).toBeLessThan(1e-12)
        expect(dist(panels[k][2], panels[k + 1][1])).toBeLessThan(1e-12)
      }
    }
  })

  it('keeps every storey rigid through the whole turn', () => {
    for (const geom of chains) {
      for (let i = 0; i <= 60; i++) {
        const beta = (i / 60) * Math.PI
        const { panels } = solveStagedChainPose(geom, beta, 0)
        panels.forEach((quad, k) => {
          expect(dist(quad[0], quad[1])).toBeCloseTo(geom.w, 9)
          expect(dist(quad[0], quad[3])).toBeCloseTo(geom.stages[k].h, 9)
        })
      }
    }
  })

  it('is deterministic and cached: the cam plan is a pure function of the geom', () => {
    for (const geom of chains) {
      const a = planStagedChainCam(geom)
      const b = planStagedChainCam(geom)
      for (let k = 0; k < geom.stages.length; k++) {
        expect(Array.from(a.q[k])).toEqual(Array.from(b.q[k]))
      }
      expect(stagedChainCam(geom)).toBe(stagedChainCam(geom))
    }
  })

  it('ships both cliffs as RIBBONS — the wedge wall forbids tall accordions', () => {
    for (const geom of chains) expect(geom.style).toBe('ribbon')
  })

  it('rejects a config whose joint arc cannot fit the tails', () => {
    // The family is not clampable: an over-tall chain must fail loudly so it is
    // re-derived rather than silently truncated.
    const overTall: StagedChainGeom = {
      mech: 'stagedchain',
      side: 'right',
      F: 0.43,
      w: 0.3,
      zc: 0.15,
      rootDeg: 90,
      stages: [{ h: 1.2 }, { h: 1.2 }, { h: 1.2 }],
    }
    expect(planStagedChainCam(overTall).feasible).toBe(false)
  })

  it('q feeds the chain: an explicit deployment vector reproduces the solved nodes', () => {
    for (const geom of chains) {
      const beta = 1.9
      const direct = stagedChainNodesQ(
        geom,
        geom.stages.map((_, k) => stagedChainQ(geom, k, beta))
      )
      expect(stagedChainNodes(geom, beta)).toEqual(direct)
    }
  })
})

describe('staged chain — atlas contract', () => {
  it('slices ONE continuous painting into per-storey bands, base at v=0', () => {
    for (const geom of chains) {
      const bands = geom.stages.map((_, k) => stagedChainBand(geom, k))
      expect(bands[0][0]).toBe(0)
      expect(bands[bands.length - 1][1]).toBeCloseTo(1, 12)
      // contiguous, ascending, and proportional to each storey's true height
      for (let k = 0; k + 1 < bands.length; k++) expect(bands[k][1]).toBeCloseTo(bands[k + 1][0], 12)
      bands.forEach(([v0, v1], k) => {
        expect(v1 - v0).toBeCloseTo(geom.stages[k].h / stagedChainLength(geom), 12)
      })
    }
  })
})
