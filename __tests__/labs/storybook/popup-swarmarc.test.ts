import { describe, expect, it } from 'vitest'
import {
  buildSwarmStruts,
  solveSwarmArcPose,
  solveSwarmStrut,
  swarmArcEnvelope,
  swarmDeployAngle,
  swarmOpenness,
  swarmStirDelta,
  swarmStrutRadius,
  swarmWaveWindow,
  SWARM_RIDER_SEAT,
  type SwarmArcGeom,
} from '@/components/labs/storybook/book/popup-swarmarc'

// House laws (bench e3s3-swarmarc.mjs constants)
const DTHETA = 0.06437
const STEP_CAP = 0.0497
const R_SHIP = 0.75
const Z_SHIP = 0.72

const STRUTS = buildSwarmStruts()
const N_RING = 18
const GEOM: SwarmArcGeom = {
  mech: 'swarmarc',
  struts: STRUTS,
  strutW: 0.01,
  stir: { side: 'right', stroke: 0.14, deg: 38, phaseStep: 0.2, crest: 0.8 },
}

const rad = (d: number): number => (d * Math.PI) / 180

describe('swarmarc ring generation (bench table)', () => {
  it('builds 18 ring struts + 4 outriders in ring order', () => {
    // E3 Wave-2 THINNING: 12 struts a side read as a picket fence to a blind
    // first-time reader (finding 8); 9 a side opens the plan spacing by a third.
    expect(STRUTS).toHaveLength(22)
    expect(STRUTS.slice(0, 9).every((s) => s.side === 'left')).toBe(true)
    expect(STRUTS.slice(9, 18).every((s) => s.side === 'right')).toBe(true)
    // ring order: left arm front→crown (|θ| descends), right arm crown→front.
    // wave = (150−|θ|)/140 rises to the crown then falls, so the peak sits at
    // the arm boundary.
    const waves = STRUTS.slice(0, N_RING).map((s) => s.wave)
    const crownAt = waves.indexOf(Math.max(...waves))
    expect(crownAt).toBeGreaterThanOrEqual(8)
    expect(crownAt).toBeLessThanOrEqual(9)
  })

  it('matches the Wave-2 spot rows (world units, 4dp)', () => {
    // θ 150 nominal (front left end, no jitter at the clamp)
    const s0 = STRUTS[0]
    expect(s0.F).toBeCloseTo(0.33, 3)
    expect(s0.z0).toBeCloseTo(0.3132, 3)
    expect(s0.L).toBeCloseTo(0.1031, 3)
    expect(s0.r).toBeCloseTo(0.0509, 3)
    expect(s0.aRestDeg).toBeCloseTo(67.24, 1)
    // θ 10 nominal (right crown) — the tallest strut
    const crown = STRUTS[9]
    expect(crown.F).toBeCloseTo(0.1146, 3)
    expect(crown.z0).toBeCloseTo(-0.3445, 3)
    expect(crown.L).toBeCloseTo(0.6101, 3)
    expect(crown.aRestDeg).toBeCloseTo(85.31, 1)
    // the worst-radius member is now the deep left outrider
    const worstIdx = STRUTS.map((s) => swarmStrutRadius(s, s.aRestDeg)).reduce(
      (m, r, i, all) => (r > all[m] ? i : m),
      0
    )
    expect(worstIdx).toBe(18)
    expect(swarmStrutRadius(STRUTS[18], STRUTS[18].aRestDeg)).toBeCloseTo(0.7436, 3)
    // outrider L1
    const oL1 = STRUTS[18]
    expect(oL1.F).toBeCloseTo(0.73, 3)
    expect(oL1.z0).toBeCloseTo(0.3525, 3)
    expect(oL1.side).toBe('left')
  })

  it('DETUNE is bounded and signed one way where the ratchet needs it', () => {
    // θ ±2.8°, y 0..−7%, a 0..+9° (see popup-swarmarc.ts). The two one-sided
    // terms only ever move a strut's foot DOWNSTAGE, which is what keeps the
    // D-G2 near-rest ratchet for spread 3 at 8 illegal brushes rather than 9.
    for (const s of STRUTS.slice(0, N_RING)) {
      // the strut's own |θ| is recoverable from its wave key exactly
      const thetaDeg = 150 - s.wave * 140
      expect(thetaDeg).toBeGreaterThanOrEqual(10 - 1e-9)
      expect(thetaDeg).toBeLessThanOrEqual(150 + 1e-9)
      // lean never drops BELOW the smooth law's own value at that |θ|
      const c = 0.5 + 0.5 * Math.cos(rad(thetaDeg))
      expect(s.aRestDeg).toBeGreaterThanOrEqual(57 + 21 * c - 1e-9)
      expect(s.aRestDeg).toBeLessThanOrEqual(57 + 21 * c + 9 + 1e-9)
    }
    // and the detune actually detunes: the ring's leans span a wide band and
    // at most ONE adjacent pair ends up parallel by coincidence (the reader's
    // complaint was a field of PARALLEL sticks, not a single matched pair)
    const leans = STRUTS.slice(0, N_RING).map((s) => s.aRestDeg)
    expect(Math.max(...leans) - Math.min(...leans)).toBeGreaterThan(20)
    let parallelPairs = 0
    for (let i = 1; i < N_RING; i++) {
      if (Math.abs(leans[i] - leans[i - 1]) < 0.5) parallelPairs += 1
    }
    expect(parallelPairs).toBeLessThanOrEqual(1)
  })

  it('marks exactly the 4 outer right-arm STIR members ranked from the tab inward', () => {
    const stirIdx = STRUTS.map((s, i) => (s.stir >= 0 ? i : -1)).filter((i) => i >= 0)
    expect(stirIdx).toEqual([14, 15, 16, 17])
    // rank 0 at the fore edge (θ ≈ 150, nearest the tab), 3 deepest in
    expect(STRUTS[17].stir).toBe(0)
    expect(STRUTS[16].stir).toBe(1)
    expect(STRUTS[14].stir).toBe(3)
    expect(STRUTS.every((s) => s.stir < 0 || s.side === 'right')).toBe(true)
    // only SHORT struts join the ripple (nothing flails)
    expect(STRUTS.filter((s) => s.stir >= 0).every((s) => s.L <= 0.27)).toBe(true)
  })

  it('never gives two ring neighbors the same sprite+flip, and varies the stalk', () => {
    for (let i = 1; i < N_RING; i++) {
      const a = STRUTS[i - 1]
      const b = STRUTS[i]
      expect(a.sprite !== b.sprite || a.flip !== b.flip).toBe(true)
      // three stalk swatches (reed/twine/twig): neighbours never share one, so
      // the hairlines stop reading as one machined picket (finding 8)
      expect(a.swatch).not.toBe(b.swatch)
    }
    expect(STRUTS.every((s) => s.sprite >= 0 && s.sprite < 16)).toBe(true)
    expect(new Set(STRUTS.map((s) => s.swatch))).toEqual(new Set([0, 1, 2]))
  })

  it('seats the rider ABOVE the stalk tip — no courier is skewered', () => {
    // The stalk stops at rho = L − SEAT·r, i.e. inside the rider quad's lower
    // third; the atlas continues it as a painted flight thread. Paper truth:
    // the stalk tip must still be INSIDE the rider footprint (one continuous
    // die, no floating alpha island), but never at its centre.
    expect(SWARM_RIDER_SEAT).toBeGreaterThan(0)
    expect(SWARM_RIDER_SEAT).toBeLessThan(1)
    for (const s of STRUTS) {
      const stalkTip = s.L - s.r * SWARM_RIDER_SEAT
      expect(stalkTip).toBeGreaterThan(s.L - s.r) // inside the rider's foot edge
      expect(stalkTip).toBeLessThan(s.L) // below the rider's centre
    }
  })
})

describe('swarmarc radius + step gates (S1–S3)', () => {
  it('S1: folds flat inside the closed page (flat tip z ≤ 0.72, z0 ≥ −0.72, anchor keep-out)', () => {
    for (const s of STRUTS) {
      const flatTipZ = s.z0 + s.L + s.r
      expect(flatTipZ).toBeLessThanOrEqual(Z_SHIP)
      expect(s.z0).toBeGreaterThanOrEqual(-Z_SHIP)
      expect(s.F).toBeGreaterThanOrEqual(0.1)
      expect(s.F + GEOM.strutW).toBeLessThanOrEqual(1.1)
    }
  })

  it('S1b: flat runs clear the ch2-fringe glue line by ≥ 0.02', () => {
    for (const s of STRUTS) {
      if (s.F > 0.6) continue
      const fringeGlueZ = 0.56 - s.F / Math.tan(rad(84))
      expect(s.z0 + s.L + s.r).toBeLessThanOrEqual(fringeGlueZ - 0.02)
    }
  })

  it('S2/S3: every strut holds full deploy (plus stir) inside the rigid ball', () => {
    for (const s of STRUTS) {
      const aMax = s.aRestDeg + (s.stir >= 0 ? GEOM.stir.deg : 0)
      const R = swarmStrutRadius(s, aMax)
      expect(R).toBeLessThanOrEqual(R_SHIP)
      expect(R * DTHETA).toBeLessThanOrEqual(STEP_CAP)
    }
  })

  it('R(0) = F — the flat pose adds only z (the family law)', () => {
    for (const s of STRUTS) expect(swarmStrutRadius(s, 0)).toBeCloseTo(s.F, 10)
  })
})

describe('swarmarc fold-flat + wave stagger (M1 / S7)', () => {
  it('q(0) = 0 exactly: closed book zeroes every strut for ANY held stir state', () => {
    expect(swarmArcEnvelope(GEOM, 0)).toBe(0)
    expect(swarmOpenness(GEOM, 0)).toBe(0)
    for (const s of STRUTS) {
      expect(swarmDeployAngle(GEOM, s, 0, 0)).toBe(0)
      expect(swarmDeployAngle(GEOM, s, 0, GEOM.stir.stroke)).toBe(0)
    }
    // fully closed pose: every vertex lies in the page plane (y = 0) and
    // inside the closed page footprint
    const closed = solveSwarmArcPose(GEOM, Math.PI / 2, Math.PI / 2, GEOM.stir.stroke)
    for (const pose of closed) {
      for (const quad of [pose.strut, pose.rider]) {
        for (const [, , z] of quad) expect(Math.abs(z)).toBeLessThanOrEqual(0.75)
      }
      expect(pose.a).toBe(0)
    }
  })

  it('wave windows are monotone in the wave key and all close by s = 0.98', () => {
    for (const u of [0.2, 0.4, 0.6, 0.8, 0.95]) {
      for (let i = 1; i < STRUTS.length; i++) {
        const a = STRUTS[i - 1]
        const b = STRUTS[i]
        if (a.wave <= b.wave) {
          expect(swarmWaveWindow(a.wave, u)).toBeGreaterThanOrEqual(swarmWaveWindow(b.wave, u) - 1e-12)
        }
      }
    }
    for (const s of STRUTS) {
      expect(swarmWaveWindow(s.wave, 1)).toBe(1)
      expect(swarmWaveWindow(s.wave, 0.98)).toBeGreaterThanOrEqual(0.99)
    }
    // outriders lead (or tie — the b0 floor clamps at 0) the front ends,
    // crown lands last
    const outrider = STRUTS[18]
    const front = STRUTS[0]
    const crown = STRUTS[9]
    expect(swarmWaveWindow(outrider.wave, 0.3)).toBeGreaterThanOrEqual(swarmWaveWindow(front.wave, 0.3))
    expect(swarmWaveWindow(front.wave, 0.5)).toBeGreaterThan(swarmWaveWindow(crown.wave, 0.5))
  })

  it('each strut deploys monotonically as the book opens', () => {
    const rest = rad(176)
    for (const s of [STRUTS[0], STRUTS[9], STRUTS[14], STRUTS[21]]) {
      let last = -1
      for (let k = 0; k <= 20; k++) {
        const beta = (k / 20) * rest
        const a = swarmDeployAngle(GEOM, s, beta, 0)
        expect(a).toBeGreaterThanOrEqual(last - 1e-12)
        last = a
      }
      expect(swarmDeployAngle(GEOM, s, rest, 0)).toBeCloseTo(rad(s.aRestDeg), 10)
    }
  })

  it('A10 wedge law: every strut tip subtends a spine angle inside the closing wedge', () => {
    // The family's containment law re-derived for near-spine anchors: the tip
    // spine-angle atan(L_eff·sin a / F_inner) must stay <= beta at every
    // dihedral (else the strut pierces a bounding page mid-close).
    for (const s of STRUTS) {
      const fInner = s.F - Math.max(s.r, GEOM.strutW / 2)
      for (let k = 1; k <= 40; k++) {
        const beta = (k / 40) * rad(176)
        const a = swarmDeployAngle(GEOM, s, beta, 0)
        const spineAng = Math.atan2((s.L + s.r) * Math.sin(a), fInner)
        expect(spineAng).toBeLessThanOrEqual(beta + 1e-9)
      }
    }
  })

  it('deployed tips land on the bench table at flat-open', () => {
    // flat-open pages: thetaL = π, thetaR = 0 → E = 1
    const pose0 = solveSwarmStrut(GEOM, STRUTS[0], Math.PI, 0)
    const tip = pose0.rider // rider center = strut tip; check via strut quad far edge midpoint
    const tipMid = [
      (pose0.strut[2][0] + pose0.strut[3][0]) / 2,
      (pose0.strut[2][1] + pose0.strut[3][1]) / 2,
      (pose0.strut[2][2] + pose0.strut[3][2]) / 2,
    ]
    // the stalk now stops at rho = L − SEAT·r, so the far edge sits just under
    // the rider's centre (0.0810 vs the rider centre's 0.0950 in y)
    expect(tipMid[0]).toBeCloseTo(-0.33, 3)
    expect(tipMid[1]).toBeCloseTo(0.081, 3)
    expect(tipMid[2]).toBeCloseTo(0.3472, 3)
    expect(tip[0][1]).toBeLessThan(tip[3][1]) // rider quad rises foot→tip
  })
})

describe('swarmarc stir ripple (the STIR THE SWARM tab)', () => {
  it('ripples 38° max, cascading by rank, and leaves NO rank at rest at full stroke', () => {
    const spec = GEOM.stir
    for (let k = 0; k < 4; k++) {
      let peak = 0
      for (let i = 0; i <= 28; i++) {
        const s = (i / 28) * spec.stroke
        peak = Math.max(peak, swarmStirDelta(spec, k, s))
        expect(swarmStirDelta(spec, k, s)).toBeGreaterThanOrEqual(0)
        expect(swarmStirDelta(spec, k, s)).toBeLessThanOrEqual(spec.deg)
      }
      expect(peak).toBeGreaterThan(0) // every rank participates within the stroke
    }
    // phase cascade: at a small stroke the tab-near rank leads the deep rank
    const sEarly = 0.35 * spec.stroke
    expect(swarmStirDelta(spec, 0, sEarly)).toBeGreaterThan(swarmStirDelta(spec, 3, sEarly))
    // non-members never move
    expect(swarmStirDelta(spec, -1, spec.stroke)).toBe(0)
    // THE PAYOFF LAW (Wave-2): at FULL stroke every rank is still displaced.
    // With crest 1 the wave ran clean off the arm and rank 0 — the strut right
    // beside the tab, the one the reader is looking at — measured exactly 0.
    for (let k = 0; k < 4; k++) {
      expect(swarmStirDelta(spec, k, spec.stroke)).toBeGreaterThan(0.35 * spec.deg)
    }
  })

  it('persistence law: shown angle = rest·W(s(β)) + Δa·E(β) — held stir folds flat at close', () => {
    const s = STRUTS[17] // rank 0, the tab-nearest strut
    const held = GEOM.stir.stroke * 0.5
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      const beta = frac * rad(176)
      const expected =
        rad(s.aRestDeg) * swarmWaveWindow(s.wave, swarmOpenness(GEOM, beta)) +
        rad(swarmStirDelta(GEOM.stir, s.stir, held)) * swarmArcEnvelope(GEOM, beta)
      expect(swarmDeployAngle(GEOM, s, beta, held)).toBeCloseTo(expected, 12)
    }
    expect(swarmDeployAngle(GEOM, s, 0, held)).toBe(0)
  })

  it('stirred struts stay inside the radius wall at peak ripple', () => {
    for (const s of STRUTS.filter((x) => x.stir >= 0)) {
      expect(swarmStrutRadius(s, s.aRestDeg + GEOM.stir.deg)).toBeLessThanOrEqual(R_SHIP)
    }
  })
})
