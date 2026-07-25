import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '@/components/labs/storybook/content'
import { creaseElevation } from '@/components/labs/storybook/book/popup-mechanics'
import {
  MFOLD_ATLAS_ROWS,
  MFOLD_ATLAS_SIZE,
  mfoldAtlasBand,
  rankVFoldGeom,
  solveMFoldRangePose,
  type MFoldRangeGeom,
} from '@/components/labs/storybook/book/popup-mfoldrange'
import { TURN_CULL_RAMP, turnCullOpacity, turnCulled } from '@/components/labs/storybook/book/turn-cull'

const rad = (d: number): number => (d * Math.PI) / 180

const s5 = CHAPTERS.find((c) => c.spread === 5)
const range = s5?.layers.find((l) => l.id === 'ch4-range')
const getRange = (): MFoldRangeGeom => {
  if (!range || range.mech !== 'mfoldrange') throw new Error('ch4-range missing or wrong mech')
  return range
}

describe('mfoldrange family — the s5 ch4-range dune massif (bench e3s5-mfoldrange)', () => {
  it('G-A fold-flat: at dihedral 0 every rank corner and gusset corner lies in the page plane', () => {
    const geom = getRange()
    // An arbitrary closed pose (both pages coincident at theta): the plane
    // normal is (-sin theta, cos theta, 0); residual must be float noise.
    const theta = 0.4
    const pose = solveMFoldRangePose(geom, theta, theta)
    const n = [-Math.sin(theta), Math.cos(theta), 0] as const
    let worst = 0
    for (const rank of pose.ranks) {
      for (const quad of [rank.right, rank.left]) {
        for (const p of quad) {
          worst = Math.max(worst, Math.abs(p[0] * n[0] + p[1] * n[1] + p[2] * n[2]))
        }
      }
    }
    for (const gusset of pose.gussets) {
      for (const quad of [gusset.left, gusset.right]) {
        for (const p of quad) {
          worst = Math.max(worst, Math.abs(p[0] * n[0] + p[1] * n[1] + p[2] * n[2]))
        }
      }
    }
    expect(worst).toBeLessThan(1e-12)
  })

  it('rank ordering covenant: apexZ strictly ascending, rho > phi per rank, width monotone non-increasing', () => {
    const geom = getRange()
    expect(geom.ranks.length).toBeGreaterThanOrEqual(4)
    expect(geom.ranks.length).toBeLessThanOrEqual(8)
    for (let k = 0; k < geom.ranks.length; k++) {
      const rank = geom.ranks[k]
      // standing-when-open is the v-fold law rho > phi
      expect(rank.rhoDeg, `rank ${k} must stand (rho > phi)`).toBeGreaterThan(rank.phiDeg)
      // flat-foldable sane angles
      expect(rank.phiDeg).toBeGreaterThan(0)
      expect(rank.phiDeg + rank.rhoDeg).toBeLessThan(180)
      if (k > 0) {
        expect(rank.apexZ, `rank ${k} apexZ ascending (back->front)`).toBeGreaterThan(
          geom.ranks[k - 1].apexZ
        )
        expect(rank.width, `rank ${k} width grading (front narrowest, mech 118)`).toBeLessThanOrEqual(
          geom.ranks[k - 1].width
        )
      }
    }
  })

  it('bloom wave: deployment at 3/4-rest is strictly monotone back->front from angle grading alone (M1)', () => {
    const geom = getRange()
    const betaRest = rad(176) // the book's rest bloom (never dead flat)
    const beta = 0.75 * betaRest
    // Deployment fraction of a rank's crease elevation from closed
    // (Lambda(0) = phi + rho) toward its rest elevation — the closed form,
    // no straps, no cams: the phi grading alone orders the wave.
    const deployment = geom.ranks.map((rank) => {
      const phi = rad(rank.phiDeg)
      const rho = rad(rank.rhoDeg)
      const closed = creaseElevation(phi, rho, 0)
      const rest = creaseElevation(phi, rho, betaRest)
      return (closed - creaseElevation(phi, rho, beta)) / (closed - rest)
    })
    for (let k = 0; k + 1 < deployment.length; k++) {
      expect(
        deployment[k],
        `rank ${k} (deeper) must be further deployed than rank ${k + 1}`
      ).toBeGreaterThan(deployment[k + 1])
    }
    expect(deployment[deployment.length - 1]).toBeGreaterThan(0)
  })

  it('every rank stands as a wall at rest (crest elevation 75-115 deg) and deeper ranks read higher', () => {
    const geom = getRange()
    const pose = solveMFoldRangePose(geom, Math.PI, 0)
    let prevCrest = Infinity
    pose.ranks.forEach((rank, k) => {
      // crest elevation at the book's REST BLOOM (dihedral ~176 deg, the
      // pose the reader dwells in — bench G-B: 93.4/94.6/95.5/96.9 deg)
      const lambda = creaseElevation(rad(geom.ranks[k].phiDeg), rad(geom.ranks[k].rhoDeg), rad(176))
      expect((lambda * 180) / Math.PI).toBeGreaterThanOrEqual(75)
      expect((lambda * 180) / Math.PI).toBeLessThanOrEqual(115)
      // crest apex world y at full open — height grading keeps the massif
      // stacking back-over-front at the pinned camera (bench G-E)
      const crestY = rank.right[3][1]
      expect(crestY, `rank ${k} crest below the rank behind it`).toBeLessThan(prevCrest)
      prevCrest = crestY
    })
  })

  it('gussets lie between consecutive rank stations, glued to both pages at every dihedral', () => {
    const geom = getRange()
    for (const beta of [0.3, Math.PI / 2, Math.PI - 0.1]) {
      const pose = solveMFoldRangePose(geom, Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2)
      expect(pose.gussets.length).toBe(geom.ranks.length - 1)
      pose.gussets.forEach((gusset, g) => {
        const zFar = geom.ranks[g].apexZ
        const zNear = geom.ranks[g + 1].apexZ
        for (const quad of [gusset.left, gusset.right]) {
          for (const p of quad) {
            expect(p[2]).toBeGreaterThanOrEqual(zFar - 1e-12)
            expect(p[2]).toBeLessThanOrEqual(zNear + 1e-12)
          }
          // spine edge on the spine; outer edge in the page plane (y/x ratio
          // matches the page angle, i.e. the strip never leaves its page)
          expect(Math.hypot(quad[0][0], quad[0][1])).toBeLessThan(1e-12)
          expect(Math.hypot(quad[3][0], quad[3][1])).toBeLessThan(1e-12)
        }
      })
    }
  })

  it('rankVFoldGeom hands each rank to the shipped v-fold solver verbatim (no new math)', () => {
    const geom = getRange()
    const vfold = rankVFoldGeom(geom, geom.ranks[0])
    expect(vfold).toEqual({
      mech: 'vfold',
      apexZ: geom.ranks[0].apexZ,
      vDir: geom.vDir,
      phiDeg: geom.ranks[0].phiDeg,
      rhoDeg: geom.ranks[0].rhoDeg,
      creaseU: geom.ranks[0].creaseU,
      width: geom.ranks[0].width,
      height: geom.ranks[0].height,
    })
  })

  it('atlas rows tile the full 1024 texture and bands are disjoint top->bottom', () => {
    expect(MFOLD_ATLAS_ROWS.reduce((a, b) => a + b, 0)).toBe(MFOLD_ATLAS_SIZE)
    let prevBottom = 1
    for (let row = 0; row < MFOLD_ATLAS_ROWS.length; row++) {
      const [v0, v1] = mfoldAtlasBand(row)
      expect(v1).toBeCloseTo(prevBottom, 12) // each band starts where the last ended
      expect(v0).toBeLessThan(v1)
      prevBottom = v0
    }
    expect(prevBottom).toBeCloseTo(0, 12)
  })
})

describe('s5 retirement + turn-cull wiring', () => {
  it('the three flat walls are retired; range + frieze + aureole replace them', () => {
    if (!s5) throw new Error('spread 5 missing')
    const ids = new Set(s5.layers.map((l) => l.id))
    expect(ids.has('ch4-backdrop')).toBe(false)
    expect(ids.has('ch4-midground')).toBe(false)
    expect(ids.has('ch4-foreground')).toBe(false)
    expect(ids.has('ch4-range')).toBe(true)
    expect(ids.has('ch4-frieze')).toBe(true)
    expect(ids.has('ch4-aureole')).toBe(true)
    // the declared spread hero is untouched
    expect(s5.hero).toBe('ch4-goldpile')
  })

  it('ch4-dissolve is turn-culled: hidden through the fast middle, restored inside the settle window', () => {
    if (!s5) throw new Error('spread 5 missing')
    const dissolve = s5.layers.find((l) => l.id === 'ch4-dissolve')
    if (!dissolve || dissolve.mech !== 'dissolve') throw new Error('ch4-dissolve missing or wrong mech')
    expect(dissolve.turnCull).toBe(true)
    // rest and turn endpoints draw at full opacity — a book that never turns
    // behaves as if the cull did not exist
    expect(turnCullOpacity(0)).toBe(1)
    expect(turnCullOpacity(1)).toBe(1)
    // the fast middle is fully culled (draws actually returned)
    expect(turnCulled(0.5)).toBe(true)
    expect(turnCulled(TURN_CULL_RAMP)).toBe(true)
    expect(turnCulled(1 - TURN_CULL_RAMP)).toBe(true)
    // 15% ramps: fading but visible inside the ramp windows
    const midRamp = turnCullOpacity(TURN_CULL_RAMP / 2)
    expect(midRamp).toBeGreaterThan(0)
    expect(midRamp).toBeLessThan(1)
    const landing = turnCullOpacity(1 - TURN_CULL_RAMP / 2)
    expect(landing).toBeGreaterThan(0)
    expect(landing).toBeLessThan(1)
  })

  it('the frieze keeps the retiring foreground station and the pack height', () => {
    if (!s5) throw new Error('spread 5 missing')
    const frieze = s5.layers.find((l) => l.id === 'ch4-frieze')
    if (!frieze || frieze.mech !== 'vfold') throw new Error('ch4-frieze missing or wrong mech')
    expect(frieze.apexZ).toBe(0.62)
    expect(frieze.height).toBe(0.16)
    expect(frieze.rhoDeg).toBeGreaterThan(frieze.phiDeg)
  })
})
