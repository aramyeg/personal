import { describe, expect, it } from 'vitest'
import {
  KEEP_WINCH_IRIS_SHUTTERS,
  keepWinchCounterweightDeck,
  keepWinchCrank,
  keepWinchDiscQuad,
  keepWinchEngageTheta,
  keepWinchIrisQuads,
  keepWinchOutputQuads,
  keepWinchOutputValue,
  keepWinchSemaphoreQuad,
  keepWinchStrokeFull,
  keepWinchThetaMax,
  type KeepWinchGeom,
} from '@/components/labs/storybook/book/popup-keepwinch'
import { keepStackStoryGeoms, type KeepStackGeom } from '@/components/labs/storybook/book/popup-keepstack'
import { solveBoxPose, type PanelQuad, type Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { easeTurnWeighted } from '@/components/labs/storybook/book/page-geometry'
import { CHAPTERS, type SceneLayer } from '@/components/labs/storybook/content'

// THE TOWER-HOIST WINCH gates, ported in-engine from the source-of-truth bench
// .superpowers/sdd/bench/derive-keep-winch.mjs (N1-N7 + H1-H8), run against the
// SHIPPED winch + keep from content.ts. The D-G2 collision scrub follows the
// D-series user-domain pattern: sweep the whole knob-twist domain at the true
// tilted rest and assert zero illegal crossings against the keep and among the
// outputs.

const rad = (d: number): number => (d * Math.PI) / 180
const deg = (r: number): number => (r * 180) / Math.PI
const REST = rad(176)
const GLOBAL_CAP = 0.0497
const A_TOL = rad(15)
const H_TOL = 0.028
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]

const spread4 = CHAPTERS.find((c) => c.spread === 4)!
const WINCH = spread4.layers.find((l): l is SceneLayer & KeepWinchGeom => l.mech === 'keepwinch')!
const KEEP = spread4.layers.find((l): l is SceneLayer & KeepStackGeom => l.mech === 'keepstack')!
const THETA_MAX = keepWinchThetaMax(WINCH)

describe('tower-hoist winch — D6/N gates (bench derive-keep-winch.mjs)', () => {
  it('N1 crank law s(theta) = crankR(1 - cos theta): exact, monotone, zero slope at liftoff', () => {
    let maxErr = 0
    for (let i = 0; i <= 400; i++) {
      const th = (Math.PI * i) / 400
      const geo = WINCH.crankR - WINCH.crankR * Math.cos(th) // pin projected on the yoke guide
      maxErr = Math.max(maxErr, Math.abs(keepWinchCrank(WINCH.crankR, th) - geo))
    }
    expect(maxErr).toBeLessThan(1e-12)
    let prev = -1
    for (let i = 0; i <= 400; i++) {
      const s = keepWinchCrank(WINCH.crankR, (THETA_MAX * i) / 400)
      expect(s).toBeGreaterThanOrEqual(prev - 1e-15)
      prev = s
    }
    expect(WINCH.crankR * Math.sin(0)).toBe(0) // ds/dtheta = 0 at liftoff — no snap
  })

  it('N2 all three output cams are monotone and C1 (bounded slope, no snap) at rest', () => {
    const M = 4000
    for (const which of ['semaphore', 'iris', 'counterweight'] as const) {
      let prev = -Infinity
      let maxD = 0
      for (let i = 1; i <= M; i++) {
        const th0 = (THETA_MAX * (i - 1)) / M
        const th1 = (THETA_MAX * i) / M
        const v1 = keepWinchOutputValue(WINCH, which, th1, REST)
        expect(v1).toBeGreaterThanOrEqual(prev - 1e-12)
        prev = v1
        maxD = Math.max(maxD, Math.abs(v1 - keepWinchOutputValue(WINCH, which, th0, REST)) / (th1 - th0))
      }
      expect(Number.isFinite(maxD)).toBe(true)
      expect(maxD).toBeLessThan(50) // bench N2 ceiling; a rigid acos-of-slide snaps far past it
    }
  })

  it('N3 stagger: the outputs engage in SEQUENCE semaphore -> iris -> counterweight', () => {
    const tSem = keepWinchEngageTheta(WINCH, WINCH.semaphore)
    const tIris = keepWinchEngageTheta(WINCH, WINCH.iris)
    const tCw = keepWinchEngageTheta(WINCH, WINCH.counterweight)
    expect(tSem).toBeLessThan(tIris)
    expect(tIris).toBeLessThan(tCw)
  })

  it('N4 body containment: every output BODY folds into the page at book-closed for ANY frozen theta', () => {
    // The corrected gate (integration exposed the bench gap): not that the deploy
    // ANGLE is 0 at close, but that the rigid BODIES fold into the page. Measured
    // at the real closed pose (outgoing turn tL=tR=PI -> beta=0, m=PI): the
    // shutters + knee panel ride folding keep walls, so off-page world-Y -> 0.
    // FLAT_TOL = paper thickness (covers the semaphore's spine-aligned 0.015).
    const FLAT_TOL = 0.02
    let maxY = 0
    for (let i = 0; i <= 40; i++) {
      const theta = (THETA_MAX * i) / 40
      for (const q of keepWinchOutputQuads(WINCH, theta, Math.PI, Math.PI))
        for (const p of q) maxY = Math.max(maxY, Math.abs(p[1]))
    }
    expect(maxY).toBeLessThanOrEqual(FLAT_TOL)
    // the deploy angles themselves still zero out at close (the envelope).
    for (const which of ['semaphore', 'iris', 'counterweight'] as const) {
      expect(keepWinchOutputValue(WINCH, which, THETA_MAX, 0)).toBeLessThanOrEqual(1e-12)
    }
  })

  it('the winch hosts match the keep’s loft story (iris + re-stationed counterweight)', () => {
    const stories = keepStackStoryGeoms(KEEP)
    const loft = stories.find((s) => s.key === 'loft')!
    // Both the iris (loft walls) and the re-stationed counterweight (loft FRONT CAP)
    // now ride the loft story — the counterweight moved off the hall flank (dead
    // sightline) onto the belfry mouth face.
    for (const key of ['a', 'height', 'z0', 'z1', 'baseH'] as const) {
      expect(WINCH.iris.host[key], `iris host ${key}`).toBe(loft[key])
      expect(WINCH.counterweight.host[key], `cw host ${key}`).toBe(loft[key])
    }
    expect(keepWinchIrisQuads(WINCH, THETA_MAX, REST, ...bloom(REST)).length).toBe(KEEP_WINCH_IRIS_SHUTTERS)
  })

  it('N5 ergonomics: THETA_MAX is the crank inverse of s_full and inside the 270deg ceiling (~112.6deg)', () => {
    const sFull = keepWinchStrokeFull(WINCH)
    expect(THETA_MAX).toBeCloseTo(Math.acos(1 - sFull / WINCH.crankR), 12)
    expect(deg(THETA_MAX)).toBeLessThanOrEqual(270)
    expect(deg(THETA_MAX)).toBeCloseTo(112.6, 0)
  })

  it('N7 real-time: the autonomous collapse (page turn at frozen full twist) stays under the global cap', () => {
    const STN = 240
    let capMax = 0
    let prev: Vec3[] | null = null
    for (let i = 0; i <= STN; i++) {
      const [tL, tR] = bloom(Math.PI * easeTurnWeighted(i / STN))
      const verts = keepWinchOutputQuads(WINCH, THETA_MAX, tL, tR).flat()
      if (prev) for (let c = 0; c < verts.length; c++) capMax = Math.max(capMax, dist(prev[c], verts[c]))
      prev = verts
    }
    expect(capMax).toBeLessThan(GLOBAL_CAP)
  })

  it('N8 mid-turn wedge containment: no output body point dips below the swinging page, full grid', () => {
    // Bench-parity port of derive-keep-winch.mjs N8 (the winch's full beta x
    // theta grid, including book-closed). The book-wide REUSABLE version of this
    // gate is A10 in popup-mechanics.test.ts (every layer, worst drive); this
    // one pins the winch to the bench's exact grid + tolerance. The A10 gap N4
    // missed: a body can dip BELOW the swinging page at PARTIAL deploy mid-turn
    // (the forbidden down-swing counterweight did). Gate: across the full
    // (beta x theta) grid on both real turn paths, every body point stays in the
    // wedge (dot(p, nL) >= -tol AND dot(p, nR) >= -tol).
    //
    // WINDING RECONCILIATION (why the FINAL counterweight is an in-plane sash-
    // weight, not a hinged flap): the bench's storyPatches winds wallR z0-first
    // (INWARD seat normal); the render's solveBoxPose winds it z1-first (OUTWARD,
    // FrontSide). A HINGED cos*e1 + sin*n rider swings OPPOSITE directions in the
    // two frames — the superseded swing-out counterweight measured -0.015
    // contained (bench winding) vs -0.080 through-page (naive render port),
    // fixable only by reordering the render quad [w1,w0,w3,w2] to the bench
    // frame. The sash-weight TRANSLATES in the wall plane (symmetric in e1, e2
    // identical both windings, only a negligible n lift), so it is winding-
    // INSENSITIVE by construction — no reconciliation, no per-face-UV hazard for
    // the art pass. Any FUTURE hinged wallR/wallL rider must reorder to the bench
    // winding or prefer this in-plane translate idiom (spec winding law).
    const WEDGE_TOL = 0.02
    const paths: ReadonlyArray<{ tL: number; tR: number }> = [
      ...Array.from({ length: 41 }, (_, i) => ({ tL: Math.PI, tR: (i / 40) * Math.PI })),
      ...Array.from({ length: 41 }, (_, i) => ({ tL: (i / 40) * Math.PI, tR: 0 })),
    ]
    let minWedge = Infinity
    for (const { tL, tR } of paths) {
      const nL: Vec3 = [Math.sin(tL), -Math.cos(tL), 0]
      const nR: Vec3 = [-Math.sin(tR), Math.cos(tR), 0]
      for (let ti = 0; ti <= 24; ti++) {
        const theta = (THETA_MAX * ti) / 24
        for (const q of keepWinchOutputQuads(WINCH, theta, tL, tR))
          for (const p of q) {
            const w = Math.min(p[0] * nL[0] + p[1] * nL[1], p[0] * nR[0] + p[1] * nR[1])
            if (w < minWedge) minWedge = w
          }
      }
    }
    expect(minWedge).toBeGreaterThanOrEqual(-WEDGE_TOL)
  })

  it('H4 the disc is a rigid handle that holds any frozen twist (no autonomous return)', () => {
    // The disc spins on an orthonormal frame — rigid at every twist. Its pose is
    // a pure function of (theta, pages); release simply stops writing theta.
    const refEdge = (q: PanelQuad): number => dist(q[0], q[1])
    const [tL, tR] = bloom(REST)
    const rest = refEdge(keepWinchDiscQuad(WINCH, 0, tL, tR))
    for (const theta of [0, THETA_MAX * 0.3, THETA_MAX * 0.7, THETA_MAX]) {
      expect(refEdge(keepWinchDiscQuad(WINCH, theta, tL, tR))).toBeCloseTo(rest, 12)
    }
  })

  // --- N6 collision (the D-G2 user-domain scrub) ---------------------------
  const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const norm = (v: Vec3): number => Math.hypot(v[0], v[1], v[2])
  const qArea = (q: PanelQuad): number =>
    (norm(cross(sub(q[1], q[0]), sub(q[2], q[0]))) + norm(cross(sub(q[2], q[0]), sub(q[3], q[0])))) / 2
  const qAng = (a: PanelQuad, b: PanelQuad): number => {
    const na = cross(sub(a[1], a[0]), sub(a[3], a[0]))
    const nb = cross(sub(b[1], b[0]), sub(b[3], b[0]))
    const la = norm(na)
    const lb = norm(nb)
    return la < 1e-9 || lb < 1e-9 ? 0 : Math.acos(Math.min(1, Math.abs(dot(na, nb)) / (la * lb)))
  }
  const eC = (T: Vec3[], d: number[]): Vec3[] => {
    const p: Vec3[] = []
    for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
      if ((d[i] < 0 && d[j] > 0) || (d[i] > 0 && d[j] < 0)) {
        const t = d[i] / (d[i] - d[j])
        p.push([T[i][0] + (T[j][0] - T[i][0]) * t, T[i][1] + (T[j][1] - T[i][1]) * t, T[i][2] + (T[j][2] - T[i][2]) * t])
      }
    }
    for (let i = 0; i < 3; i++) if (Math.abs(d[i]) < 1e-15) p.push(T[i])
    return p
  }
  const triSeg = (A: Vec3[], B: Vec3[]): [Vec3, Vec3] | null => {
    const nB = cross(sub(B[1], B[0]), sub(B[2], B[0]))
    const dA = [dot(nB, sub(A[0], B[0])), dot(nB, sub(A[1], B[0])), dot(nB, sub(A[2], B[0]))]
    if ((dA[0] > 0 && dA[1] > 0 && dA[2] > 0) || (dA[0] < 0 && dA[1] < 0 && dA[2] < 0)) return null
    const nA = cross(sub(A[1], A[0]), sub(A[2], A[0]))
    const dB = [dot(nA, sub(B[0], A[0])), dot(nA, sub(B[1], A[0])), dot(nA, sub(B[2], A[0]))]
    if ((dB[0] > 0 && dB[1] > 0 && dB[2] > 0) || (dB[0] < 0 && dB[1] < 0 && dB[2] < 0)) return null
    const pA = eC(A, dA)
    const pB = eC(B, dB)
    if (pA.length < 2 || pB.length < 2) return null
    const D = cross(nA, nB)
    const Dl = norm(D)
    if (Dl < 1e-9) return null
    const Dn: Vec3 = [D[0] / Dl, D[1] / Dl, D[2] / Dl]
    const a = pA.map((p) => ({ p, t: dot(p, Dn) })).sort((x, y) => x.t - y.t)
    const b = pB.map((p) => ({ p, t: dot(p, Dn) })).sort((x, y) => x.t - y.t)
    if (Math.max(a[0].t, b[0].t) > Math.min(a[a.length - 1].t, b[b.length - 1].t)) return null
    return [a[0].p, a[a.length - 1].p]
  }
  const hAbove = (p: Vec3, tL: number, tR: number): number =>
    Math.min(Math.abs(-p[0] * Math.sin(tR) + p[1] * Math.cos(tR)), Math.abs(-p[0] * Math.sin(tL) + p[1] * Math.cos(tL)))
  const crossingHeight = (qa: PanelQuad, qb: PanelQuad, tL: number, tR: number): number => {
    if (qArea(qa) < 1e-9 || qArea(qb) < 1e-9) return -1
    const tA = [[qa[0], qa[1], qa[2]], [qa[0], qa[2], qa[3]]]
    const tB = [[qb[0], qb[1], qb[2]], [qb[0], qb[2], qb[3]]]
    let h = -1
    for (const a of tA)
      for (const b of tB) {
        const seg = triSeg(a, b)
        if (seg)
          for (let k = 0; k <= 16; k++) {
            const u = k / 16
            const p: Vec3 = [
              seg[0][0] + (seg[1][0] - seg[0][0]) * u,
              seg[0][1] + (seg[1][1] - seg[0][1]) * u,
              seg[0][2] + (seg[1][2] - seg[0][2]) * u,
            ]
            h = Math.max(h, hAbove(p, tL, tR))
          }
      }
    return h
  }
  const illegal = (A: PanelQuad, B: PanelQuad, tL: number, tR: number): boolean =>
    qArea(A) > 1e-9 && qArea(B) > 1e-9 && qAng(A, B) >= A_TOL && crossingHeight(A, B, tL, tR) >= H_TOL

  const scrubStations: ReadonlyArray<readonly [string, number, number]> = [
    ['rest', ...bloom(REST)],
    ['tiltA', Math.PI - 0.06 - 0.11, 0.06 - 0.11],
    ['tiltB', Math.PI - 0.06 + 0.11, 0.06 + 0.11],
  ]

  it('N6 collision: the whole knob-twist scrub is D-G2-clean vs the keep + among outputs, excluding each body’s glued host wall (the legal hinge)', () => {
    const stories = keepStackStoryGeoms(KEEP)
    const isIrisHost = (s: string, f: string): boolean => s === 'loft' && (f === 'wallL' || f === 'wallR')
    // cw host = loft FRONT CAP; caps are excluded from COLLIDE_FACES below (as the
    // bench excludes them), so this never fires — kept for parity with the bench.
    const isCwHost = (s: string, f: string): boolean => s === 'loft' && (f === 'capFrontL' || f === 'capFrontR')
    let illegalCount = 0
    let worst = ''
    // The bench models the keep's collision surfaces as the reader-facing
    // structure — walls + lids/roofs, NOT the caps or backbone (which fold out
    // of the outputs' swing zone); match it so this is a faithful port.
    const COLLIDE_FACES = new Set(['wallL', 'wallR', 'lidL', 'lidR', 'roofL', 'roofR'])
    for (const [label, tL, tR] of scrubStations) {
      const beta = tL - tR
      const keepFaces = stories.flatMap((g) =>
        solveBoxPose(g, tL, tR)
          .filter((p) => COLLIDE_FACES.has(p.face))
          .map((p) => ({ quad: p.quad, story: g.key, face: p.face as string }))
      )
      for (let ti = 0; ti <= 200; ti++) {
        const theta = (THETA_MAX * ti) / 200
        const bodies: ReadonlyArray<{ name: string; quads: PanelQuad[]; isHost: (s: string, f: string) => boolean }> = [
          { name: 'semaphore', quads: [keepWinchSemaphoreQuad(WINCH, theta, beta, tL, tR)], isHost: () => false },
          { name: 'iris', quads: keepWinchIrisQuads(WINCH, theta, beta, tL, tR), isHost: isIrisHost },
          { name: 'counterweight', quads: (() => { const cw = keepWinchCounterweightDeck(WINCH, theta, beta, tL, tR); return [cw.crestL, cw.crestR] })(), isHost: isCwHost },
        ]
        for (const body of bodies)
          for (const A of body.quads)
            for (const B of keepFaces)
              if (!body.isHost(B.story, B.face) && illegal(A, B.quad, tL, tR)) {
                illegalCount++
                worst = `${body.name} x ${B.story}[${B.face}] @ ${label} theta ${deg(theta).toFixed(0)}`
              }
        for (let a = 0; a < bodies.length; a++)
          for (let b = a + 1; b < bodies.length; b++)
            for (const A of bodies[a].quads)
              for (const B of bodies[b].quads)
                if (illegal(A, B, tL, tR)) {
                  illegalCount++
                  worst = `${bodies[a].name} x ${bodies[b].name} @ ${label}`
                }
      }
    }
    expect(illegalCount, worst).toBe(0)
  })
})
