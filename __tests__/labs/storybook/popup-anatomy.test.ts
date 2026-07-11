/**
 * Anatomy-phase CI gates — the pop-up mechanism solvers in popup-anatomy.ts
 * (floating platform, angle-fold fan, rider, dress) held to the same numeric
 * covenants proven first in .superpowers/sdd/bench/ (derive-platform,
 * derive-fan, derive-recursion). Every gate here mirrors a derive gate
 * IN-ENGINE: the derive configs translated to the author-facing geometry
 * types, the derive gate logic and tolerances copied. The derives are ground
 * truth — all green — so a red gate here means the engine drifted from the
 * paper math, not that a tolerance wants loosening.
 *
 * Labels track the shared benchmark (A12 rigidity, A13 closure, A15 flat-fold
 * + containment), matching popup-mechanics.test.ts.
 */
import { describe, expect, it } from 'vitest'
import {
  deckCreasePoint,
  solveDressPose,
  solveFanPose,
  solvePlatformPose,
  solveRiderPose,
  strutClosedReach,
} from '@/components/labs/storybook/book/popup-anatomy'
import {
  parallelRidge,
  solveBoxPose,
  type BoxGeom,
  type DressGeom,
  type FanGeom,
  type PanelQuad,
  type PlatformGeom,
  type RiderGeom,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import { PAGE_H, PAGE_W } from '@/components/labs/storybook/book/page-geometry'

// --- vector helpers (kept local; the modules under test stay three-free) ---
const deg = (r: number): number => (r * 180) / Math.PI
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
const dist3 = (a: Vec3, b: Vec3): number => norm(sub(a, b))
const dist2 = (a: readonly [number, number], b: readonly [number, number]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1])
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** Bisector angle m and page half-angle h, exactly as the solvers derive
 *  them; page planes sit at m +/- h. */
const frame = (thetaL: number, thetaR: number): { m: number; h: number; pageL: number; pageR: number } => {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const m = (thetaL + thetaR) / 2
  const h = beta / 2
  return { m, h, pageL: m + h, pageR: m - h }
}

/** Distance of a corner off the page plane through the spine at world angle
 *  theta — the plane is x*sin(theta) - y*cos(theta) = 0. */
const offPage = (p: Vec3, theta: number): number => Math.abs(p[0] * Math.sin(theta) - p[1] * Math.cos(theta))

type Plane = { readonly point: Vec3; readonly n: Vec3 }
const planeOf = (q: PanelQuad): Plane => {
  const raw = cross(sub(q[1], q[0]), sub(q[3], q[0]))
  const l = norm(raw)
  return { point: q[0], n: [raw[0] / l, raw[1] / l, raw[2] / l] }
}
const offPlane = (p: Vec3, pl: Plane): number => Math.abs(dot(sub(p, pl.point), pl.n))
const offNearest = (p: Vec3, planes: readonly Plane[]): number => Math.min(...planes.map((pl) => offPlane(p, pl)))

/** Distance of a point off the infinite line through a -> b. */
const offLine = (p: Vec3, a: Vec3, b: Vec3): number => norm(cross(sub(p, a), sub(b, a))) / norm(sub(b, a))

/** The 6 pairwise corner distances of a quad — its rigidity fingerprint. */
const fingerprint = (q: PanelQuad): number[] => {
  const ds: number[] = []
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) ds.push(dist3(q[i], q[j]))
  return ds
}
const edgeLens = (q: PanelQuad): number[] => [dist3(q[0], q[1]), dist3(q[1], q[2]), dist3(q[2], q[3]), dist3(q[3], q[0])]

const faceQuad = (patches: ReadonlyArray<{ readonly face: string; readonly quad: PanelQuad }>, face: string): PanelQuad => {
  const found = patches.find((p) => p.face === face)
  if (!found) throw new Error(`missing face ${face}`)
  return found.quad
}

// --- page-angle sweeps -----------------------------------------------------
// Single-turning-page path (thetaR pinned) + the symmetric path (same beta,
// bisector swung to PI/2): the solve depends on h only, so both must agree —
// this proves page-path invariance the way the derives sweep h directly.
const SWEEP: ReadonlyArray<readonly [number, number]> = [
  ...Array.from({ length: 61 }, (_, i) => [(i / 60) * Math.PI, 0] as const),
  ...Array.from({ length: 61 }, (_, i) => {
    const s = (i / 60) * (Math.PI / 2)
    return [Math.PI / 2 + s, Math.PI / 2 - s] as const
  }),
]
// Closed-book poses at several bisector angles (flat-fold is m-invariant).
const CLOSED: readonly number[] = [0, Math.PI / 6, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI]

// Flat-fold tolerance for PARALLEL-derived mechanisms. The platform deck rides
// parallelRidge struts and the rooftop rider rides the deck crease — both go
// through a circle-circle sqrt whose ~1e-16 residue at the flat-fold tangency
// is sqrt-amplified to ~1e-8 world units (max observed 1.4e-8 on bridge-gentle;
// the derive's differently-ordered sum lands on exact 0). Sub-micron against
// paper thickness 0.02 — the same 1e-6 class popup-mechanics.test.ts's flatTol
// applies to parallel folds. Analytically-exact mechs (symmetric v-fold fans,
// the boxLid rider whose hEff = h) stay bitwise flat at 1e-9.
const FLAT_TOL_PARALLEL = 1e-6

// ---------------------------------------------------------------------------
// FLOATING PLATFORM — derive-platform.mjs configs, mapped to PlatformGeom:
// glueL=aL, glueR=aR, rise=wL-aR (so wR = aL+rise). Bridge ranks mirror by
// swapping glueL/glueR; terrace ranks are symmetric tents.
// ---------------------------------------------------------------------------
type PlatformCase = { readonly name: string; readonly kind: 'bridge' | 'terrace'; readonly geom: PlatformGeom }
const PLATFORMS: readonly PlatformCase[] = [
  {
    name: 'bridge-gentle',
    kind: 'bridge',
    geom: {
      mech: 'platform',
      strutA: { glueL: 0.2, glueR: 0.14, rise: 0.16, spans: [[0.3, 0.38], [0.5, 0.58]] },
      strutB: { glueL: 0.14, glueR: 0.2, rise: 0.16, spans: [[0.3, 0.38], [0.5, 0.58]] },
      qA: 0.12,
      qB: 0.12,
      deckZ0: 0.3,
      deckZ1: 0.58,
    },
  },
  {
    name: 'bridge-low-wide',
    kind: 'bridge',
    geom: {
      mech: 'platform',
      strutA: { glueL: 0.16, glueR: 0.1, rise: 0.14, spans: [[-0.6, -0.52], [-0.4, -0.32], [-0.2, -0.12]] },
      strutB: { glueL: 0.1, glueR: 0.16, rise: 0.14, spans: [[-0.6, -0.52], [-0.4, -0.32], [-0.2, -0.12]] },
      qA: 0.1,
      qB: 0.1,
      deckZ0: -0.6,
      deckZ1: -0.12,
    },
  },
  {
    name: 'terrace-equal',
    kind: 'terrace',
    geom: {
      mech: 'platform',
      strutA: { glueL: 0.12, glueR: 0.12, rise: 0.14, spans: [[0.1, 0.2]] },
      strutB: { glueL: 0.1, glueR: 0.1, rise: 0.06, spans: [[0.32, 0.42]] },
      qA: 0.06,
      qB: 0.06,
      deckZ0: 0.1,
      deckZ1: 0.42,
    },
  },
  {
    name: 'terrace-skewed',
    kind: 'terrace',
    geom: {
      mech: 'platform',
      strutA: { glueL: 0.14, glueR: 0.14, rise: 0.16, spans: [[-0.5, -0.4]] },
      strutB: { glueL: 0.08, glueR: 0.08, rise: 0.1, spans: [[-0.28, -0.18]] },
      qA: 0.115,
      qB: 0.065,
      deckZ0: -0.5,
      deckZ1: -0.18,
    },
  },
]

describe('platform deck flat-fold design rules (derive-platform covenant)', () => {
  it.each(PLATFORMS.map((c) => [c.name, c] as const))('%s obeys its variant closure rule', (_n, c) => {
    const reachA = strutClosedReach(c.geom.strutA)
    const reachB = strutClosedReach(c.geom.strutB)
    if (c.kind === 'bridge') {
      // mirrored ranks coincide at closed, so the deck panels must be equal.
      expect(c.geom.qA).toBe(c.geom.qB)
      expect(Math.abs(reachA - reachB)).toBeLessThan(1e-9)
    } else {
      // the crease must land in the page sandwich: qA + qB fills the gap.
      expect(Math.abs(c.geom.qA + c.geom.qB - Math.abs(reachA - reachB))).toBeLessThan(1e-9)
    }
  })
})

describe('A12 — platform rigidity: no patch stretches across the fold', () => {
  it.each(PLATFORMS.map((c) => [c.name, c] as const))('%s keeps every patch rigid (rel drift <= 1e-9)', (_n, c) => {
    const ref = solvePlatformPose(c.geom, Math.PI / 2, 0).map((p) => fingerprint(p.quad))
    for (const [tL, tR] of SWEEP) {
      solvePlatformPose(c.geom, tL, tR).forEach((patch, pi) => {
        fingerprint(patch.quad).forEach((d, di) => {
          expect(Math.abs(d - ref[pi][di]) / Math.max(ref[pi][di], 1e-9)).toBeLessThan(1e-9)
        })
      })
    }
  })
})

describe('A13 — platform closure: deck meets both ridges, glue stays on the page', () => {
  it.each(PLATFORMS.map((c) => [c.name, c] as const))('%s closes to <= 1e-6 (glue on page <= 1e-9)', (_n, c) => {
    for (const [tL, tR] of SWEEP) {
      const { h, pageL, pageR } = frame(tL, tR)
      // the deck is 0-DOF in h — exercise the closed forms directly.
      const ra = parallelRidge(c.geom.strutA.glueL, c.geom.strutA.glueR, c.geom.strutA.rise, h)
      const rb = parallelRidge(c.geom.strutB.glueL, c.geom.strutB.glueR, c.geom.strutB.rise, h)
      const crease = deckCreasePoint(ra, c.geom.qA, rb, c.geom.qB)
      expect(Math.abs(dist2(crease, ra) - c.geom.qA)).toBeLessThan(1e-6)
      expect(Math.abs(dist2(crease, rb) - c.geom.qB)).toBeLessThan(1e-6)
      // strut glue corners lie exactly on their page planes.
      for (const patch of solvePlatformPose(c.geom, tL, tR)) {
        if (patch.face === 'strutL') {
          for (const p of [patch.quad[0], patch.quad[1]]) expect(offPage(p, pageL)).toBeLessThan(1e-9)
        } else if (patch.face === 'strutR') {
          for (const p of [patch.quad[2], patch.quad[3]]) expect(offPage(p, pageR)).toBeLessThan(1e-9)
        }
      }
    }
  })
})

describe('A15 — platform flat-fold + containment at book-closed', () => {
  it.each(PLATFORMS.map((c) => [c.name, c] as const))('%s collapses flat inside the page sandwich', (_n, c) => {
    for (const m of CLOSED) {
      for (const patch of solvePlatformPose(c.geom, m, m)) {
        for (const p of patch.quad) {
          expect(offPage(p, m)).toBeLessThan(FLAT_TOL_PARALLEL)
          expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(PAGE_W)
          expect(Math.abs(p[2])).toBeLessThanOrEqual(PAGE_H / 2)
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// ANGLE-FOLD FAN — derive-fan.mjs m-fold-nested-3 (radian angles converted to
// degrees for FanMember); the non-crossing test ports arcsCross verbatim.
// ---------------------------------------------------------------------------
const FAN: FanGeom = {
  mech: 'fan',
  apexZ: -0.1,
  vDir: 1,
  members: [
    { phiDeg: deg(0.3), rhoDeg: deg(0.55), width: 0.4, height: 0.3 },
    { phiDeg: deg(0.55), rhoDeg: deg(0.85), width: 0.4, height: 0.3 },
    { phiDeg: deg(0.8), rhoDeg: deg(1.15), width: 0.4, height: 0.3 },
  ],
}

/** Transversal intersection of two great-circle arcs (p1->p2, q1->q2), unit
 *  vectors sharing the sphere center — ported from derive-fan.mjs. Coplanar
 *  arcs (flat-stacked paper at closed) are excluded, not counted. */
const arcsCross = (p1: Vec3, p2: Vec3, q1: Vec3, q2: Vec3): boolean => {
  const n1 = cross(p1, p2)
  const n2 = cross(q1, q2)
  const line = cross(n1, n2)
  const L = norm(line)
  if (L < 1e-9) return false // coplanar: stacked paper, not a crossing
  const inArc = (a: Vec3, b: Vec3, nrm: Vec3, t: Vec3): boolean =>
    dot(cross(a, t), nrm) >= -1e-12 && dot(cross(t, b), nrm) >= -1e-12
  for (const t of [scale(line, 1 / L), scale(line, -1 / L)]) {
    if (inArc(p1, p2, n1, t) && inArc(q1, q2, n2, t)) return true
  }
  return false
}

describe('fan — shared apex, member rules, non-crossing, flat-fold', () => {
  it('every member shares the one spine apex', () => {
    for (const [tL, tR] of [[Math.PI, 0], [1.3, 0.2], [Math.PI / 2, Math.PI / 2]] as const) {
      const poses = solveFanPose(FAN, tL, tR)
      for (const pose of poses) expect(dist3(pose.apex, poses[0].apex)).toBeLessThan(1e-12)
      expect(poses[0].apex[2]).toBeCloseTo(FAN.apexZ, 12)
    }
  })

  it('each member can bridge its glue lines at full open (feasibility rule)', () => {
    for (const mbr of FAN.members) {
      const skew = mbr.skewDeg ?? 0
      expect(mbr.rhoDeg).toBeGreaterThanOrEqual(mbr.phiDeg)
      expect(2 * mbr.rhoDeg - skew).toBeGreaterThanOrEqual(2 * mbr.phiDeg + skew)
    }
  })

  it('members never pass through each other mid-fold (both page paths)', () => {
    const hs = Array.from({ length: 121 }, (_, i) => (i / 120) * (Math.PI / 2)).filter((h) => h > 0.02)
    let crossings = 0
    for (const h of hs) {
      for (const [tL, tR] of [[2 * h, 0], [Math.PI / 2 + h, Math.PI / 2 - h]] as const) {
        const poses = solveFanPose(FAN, tL, tR)
        for (let i = 0; i < poses.length; i++)
          for (let j = i + 1; j < poses.length; j++) {
            const arcsI: ReadonlyArray<readonly [Vec3, Vec3]> = [
              [poses[i].glueL, poses[i].crease],
              [poses[i].crease, poses[i].glueR],
            ]
            const arcsJ: ReadonlyArray<readonly [Vec3, Vec3]> = [
              [poses[j].glueL, poses[j].crease],
              [poses[j].crease, poses[j].glueR],
            ]
            for (const [p1, p2] of arcsI)
              for (const [q1, q2] of arcsJ) if (arcsCross(p1, p2, q1, q2)) crossings += 1
          }
      }
    }
    expect(crossings).toBe(0)
  })

  it('all panels lie flat in the page at book-closed', () => {
    for (const m of CLOSED) {
      for (const pose of solveFanPose(FAN, m, m)) {
        for (const p of [...pose.right, ...pose.left]) expect(offPage(p, m)).toBeLessThan(1e-9)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// RIDER — derive-recursion.mjs valley-on-box-lid + rooftop-on-bridge-deck,
// plus the negative mount-rule configs (asserted to throw).
// ---------------------------------------------------------------------------
const RIDER_BOX: BoxGeom = { mech: 'box', a: 0.1, height: 0.11, z0: 0.38, z1: 0.5, roof: 'flat' }
const RIDER_ON_LID: RiderGeom = {
  mech: 'rider',
  parentId: 'box',
  seat: 'boxLid',
  mountZ: 0.44,
  vDir: 1,
  phiDeg: deg(0.5),
  rhoDeg: deg(0.75),
  width: 0.08,
  height: 0.07,
}
const RIDER_ON_DECK: RiderGeom = {
  mech: 'rider',
  parentId: 'plat',
  seat: 'deckCrease',
  mountZ: 0.44,
  vDir: 1,
  phiDeg: deg(0.5),
  rhoDeg: deg(0.75),
  width: 0.08,
  height: 0.07,
}
const BRIDGE = PLATFORMS[0].geom
const TERRACE = PLATFORMS[2].geom

describe('rider — valley child seated on a flat box lid', () => {
  it('glue edges ride in the lid planes at every angle; apex on the seam', () => {
    for (const [tL, tR] of SWEEP) {
      const pose = solveRiderPose(RIDER_ON_LID, RIDER_BOX, tL, tR)
      const box = solveBoxPose(RIDER_BOX, tL, tR)
      const lids = [planeOf(faceQuad(box, 'lidL')), planeOf(faceQuad(box, 'lidR'))]
      for (const p of [pose.left[0], pose.left[1], pose.right[0], pose.right[1]]) {
        expect(offNearest(p, lids)).toBeLessThan(1e-9)
      }
      const seam = faceQuad(box, 'backbone')
      expect(offLine(pose.apex, seam[2], seam[3])).toBeLessThan(1e-9)
    }
  })

  it('folds flat into the page at book-closed', () => {
    for (const m of CLOSED) {
      const pose = solveRiderPose(RIDER_ON_LID, RIDER_BOX, m, m)
      for (const p of [...pose.right, ...pose.left]) expect(offPage(p, m)).toBeLessThan(1e-9)
    }
  })
})

describe('rider — rooftop child straddling a bridge deck crease', () => {
  it('glue edges ride in the deck panel planes across the sweep', () => {
    for (const [tL, tR] of SWEEP) {
      const pose = solveRiderPose(RIDER_ON_DECK, BRIDGE, tL, tR)
      const plat = solvePlatformPose(BRIDGE, tL, tR)
      const decks = [planeOf(faceQuad(plat, 'deckA')), planeOf(faceQuad(plat, 'deckB'))]
      for (const p of [pose.left[0], pose.left[1], pose.right[0], pose.right[1]]) {
        expect(offNearest(p, decks)).toBeLessThan(1e-9)
      }
    }
  })

  it('folds flat into the page at book-closed', () => {
    for (const m of CLOSED) {
      const pose = solveRiderPose(RIDER_ON_DECK, BRIDGE, m, m)
      for (const p of [...pose.right, ...pose.left]) expect(offPage(p, m)).toBeLessThan(FLAT_TOL_PARALLEL)
    }
  })
})

describe('rider — mount rule has teeth (invalid seats throw)', () => {
  it('a deckCrease rider on a TERRACE platform is rejected', () => {
    expect(() => solveRiderPose(RIDER_ON_DECK, TERRACE, Math.PI, 0)).toThrow()
  })
  it('a boxLid rider on a GABLE-roofed box is rejected', () => {
    const gable: BoxGeom = { mech: 'box', a: 0.1, height: 0.11, z0: 0.38, z1: 0.5, roof: 'gable', gableRise: 0.06 }
    expect(() => solveRiderPose(RIDER_ON_LID, gable, Math.PI, 0)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// DRESS — a rigid decorative quad riding one moving parent panel (a box
// wallL swept across the fold). Zero kinematics: rigid, parallel, fixed lift.
// ---------------------------------------------------------------------------
const DRESS_BOX: BoxGeom = { mech: 'box', a: 0.1, height: 0.11, z0: 0.38, z1: 0.5, roof: 'flat' }
const DRESS: DressGeom = {
  mech: 'dress',
  parentId: 'box',
  seat: 'wallL',
  u: 0.02,
  v: 0.03,
  angleDeg: 15,
  width: 0.06,
  height: 0.05,
}
const DRESS_LIFT = 0.003

describe('dress — rigid decorative patch on a moving seat', () => {
  it('stays rigid, parallel to its seat, lifted a fixed 0.003 off it', () => {
    const ref = edgeLens(solveDressPose(DRESS, faceQuad(solveBoxPose(DRESS_BOX, Math.PI, 0), 'wallL')))
    for (const [tL, tR] of SWEEP) {
      const seat = faceQuad(solveBoxPose(DRESS_BOX, tL, tR), 'wallL')
      const patch = solveDressPose(DRESS, seat)
      // rigid: edge lengths constant across the fold
      edgeLens(patch).forEach((len, i) => expect(Math.abs(len - ref[i])).toBeLessThan(1e-9))
      // parallel: the dress normal stays aligned with the seat normal
      expect(1 - Math.abs(dot(planeOf(seat).n, planeOf(patch).n))).toBeLessThan(1e-9)
      // fixed lift off the seat plane (no z-fighting) for every corner
      const seatPlane = planeOf(seat)
      for (const p of patch) expect(Math.abs(offPlane(p, seatPlane) - DRESS_LIFT)).toBeLessThan(1e-9)
    }
  })
})
