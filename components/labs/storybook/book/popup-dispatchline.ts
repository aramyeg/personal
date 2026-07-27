/**
 * THE DISPATCH LINE (E3 s4 round-4) — family #25: a working cable with
 * letter-baskets riding it, and the reader's hand on one of them.
 *
 * Derived in `.superpowers/sdd/bench/e3s4r4-cable.mjs`, whose header records
 * the three answers that had to die first. The short version:
 *
 *   A CABLE CANNOT CROSS THE GUTTER ON THIS SPREAD. A thread between two page
 *   anchors carries ~1.2 of slack at book-closed. A dress overhang reaching
 *   toward the spine dies at the backdrop-wings wedge (rnear -> 0). And a
 *   gutter-anchored die-cut v-fold — the one that should have worked, since a
 *   v-fold IS spine-anchored and the class was never near the height wall —
 *   fails on a number nobody had written down: a v-fold's crest RAKES through
 *       z = apexZ + height * vDir * cos(lambda(beta))
 *   as its crease elevation runs 174.5deg -> 104.7deg over the turn, a depth
 *   excursion of ~1.25 x height. Any span tall enough to carry a cable over the
 *   keep's crown spends most of the turn raking straight through the keep.
 *
 *   HOUSE LAW EARNED THERE: **the keep owns the gutter.** On a spread with a
 *   tall spine-anchored stack, a second gutter-class piece must be SHORT or
 *   seated ON the stack — never a tall free-standing span.
 *
 * So the line crosses the gutter the way a cut-paper book crosses anything: the
 * reader's eye does it. The cable leaves the crooked tower's own crown storey
 * (die-cut into the tower's sheet), runs over the keep's spire lantern (painted
 * on a piece already standing there), and lands on THIS piece — a page-rooted
 * die-cut panel on the right page carrying the long swooping run, the basket
 * lanterns, and the reader's basket, down into the terraced roosts.
 *
 * STRUCTURE. The panel is a STAGEDCHAIN — the tower's own family, already
 * proven — so nothing here re-derives physics. What is new is:
 *
 *   THE DIE-CUT CABLE, a polyline in panel (u, v): u runs radially inboard ->
 *   outboard across the sheet, v climbs the whole chain (so a rider crosses the
 *   storey joint without a seam). Everything off the line, its masts and its
 *   lanterns is cut away by the atlas alpha; the sheet is a wall, the
 *   silhouette is a cable.
 *
 *   THE RIDER, an IN-PLANE translation inside the panel. This is the keepwinch
 *   counterweight idiom exactly — a sash-weight descending WITHIN the hall
 *   flank-wall plane: zero off-plane reach, drive-insensitive, wedge-contained
 *   for free. A rider is a CONSTANT-WEIGHT bilinear combination of the sheet's
 *   four corners, so (a) its per-station displacement is a convex combination
 *   of theirs and can never exceed the sheet's own worst step, and (b) when the
 *   sheet folds dead flat, so does the basket — at ANY held position. The
 *   liftflap persistence law is satisfied structurally rather than by gating:
 *   the panel's cam IS the rider's envelope.
 *
 * PAPER PEDIGREE: Birmingham mech 116's automatic strip drives the panel off
 * the page; the rider is a slot-and-slider (mechs 45-48) cut along the cable —
 * the reader's thumb pushes the basket down the wire.
 */

import type { PanelQuad, Vec3 } from './popup-mechanics'
import {
  solveStagedChainPose,
  stagedChainLength,
  type StagedChainGeom,
} from './popup-stagedchain'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** A node of the die-cut cable in panel space: [u across the sheet, v up it]. */
export type CableNode = readonly [number, number]

export type DispatchLineGeom = Omit<StagedChainGeom, 'mech'> & {
  mech: 'dispatchline'
  /** The die-cut cable, inboard -> outboard. Must be monotone in u. */
  cable: readonly CableNode[]
  /** Fixed basket lanterns, as arc parameters s in [0, 1] along the cable. */
  baskets: readonly number[]
  /** Where the reader's basket sits before it is pushed. */
  riderHome: number
  /** Half-size of a basket's die-cut sprite, in panel (u, v) units. */
  basketHalfU: number
  basketHalfV: number
  /** Atlas cell rows for the basket sprites (one row per basket sprite). */
  basketSprites?: number
  /** THE LANDING — what arriving at the far end of the wire DOES (s4 round-3,
   *  S4R3-2). All of it is in the panel's own plane, so all of it inherits the
   *  sheet's cam. */
  dock?: DispatchLineDock
}

/**
 * THE LANDING (E3 s4 round-3, item S4R3-2).
 *
 * WHY IT EXISTS. A context-quarantined reader drove this trolley the whole
 * length of the wire, both ways, and filed the best interaction on the spread
 * with one damning sentence: "Nothing happens at either end. The mast says
 * SEND; docking the trolley there launches no raven, drops no letter, changes
 * no light. The carrier's white parcel is identical at both ends. The one place
 * in the scene with an explicit verb and an obvious payoff has no payoff."
 *
 * WHAT ARRIVING DOES. Over the last `band` of the stroke — eased, so the
 * landing has a run-in rather than a switch — three things happen at once:
 *   the TIP: the pannier swings `tipDeg` on its bail and the letters go into
 *     the roost. This is a rotation of the rider quad ABOUT ITS OWN CENTRE,
 *     IN the panel plane: rigid (every pairwise corner distance preserved),
 *     coplanar (it never leaves the sheet), and therefore still a
 *     constant-weight point set of the sheet's four corners — the fold-flat,
 *     wedge and real-time arguments the rider already carries are the same
 *     arguments at a different angle.
 *   the RAVEN: a die-cut bird sitting on the landing lifts off and climbs
 *     `ravenRise` up the wire (and `ravenRun` back along it), in-plane, fading
 *     up from nothing. It is not a bird flying past the page; it is a bird
 *     printed on the same sheet as the wire, which is what a paper book can
 *     honestly do.
 *   the LAMP: the roost lantern at `lampS` comes up. Light only, no motion.
 *
 * ALL THREE ARE FUNCTIONS OF THE HELD DRIVE, so a reader who parks the trolley
 * half-way into the landing gets half the event and keeps it — no timers, no
 * animation state, nothing that could disagree with the pose the page turn
 * solves for. And because the whole event lives in the panel plane, a page turn
 * mid-landing folds the tipped basket, the climbing raven and the lit lamp flat
 * with the sheet, at any held position.
 */
export type DispatchLineDock = {
  /** Fraction of the stroke, at the far end, over which the landing plays. */
  band: number
  /** How far the pannier tips on its bail at full dock, degrees. */
  tipDeg: number
  /** The raven's climb and run at full dock, in panel (v, u) units. */
  ravenRise: number
  ravenRun: number
  /** Where the roost lantern sits, as an arc parameter on the cable. */
  lampS: number
}

/** The panel geom underneath — the same object, read as its own family. */
export const dispatchLinePanel = (geom: DispatchLineGeom): StagedChainGeom =>
  ({ ...geom, mech: 'stagedchain' }) as StagedChainGeom

/**
 * Point on the die-cut cable at arc parameter s in [0, 1], piecewise-linear
 * over the authored nodes. s is a UNIFORM parameter over node index, not over
 * true arc length — the authored nodes are evenly spaced in u, so the two agree
 * to within the sag, and a uniform parameter is what makes the reader's drag
 * feel like pushing a basket rather than winding a variable gear.
 */
export function dispatchLineCableAt(geom: DispatchLineGeom, s: number): CableNode {
  const n = geom.cable.length
  if (n === 0) return [0, 0]
  if (n === 1) return geom.cable[0]
  const t = clamp(s, 0, 1) * (n - 1)
  const i = Math.min(n - 2, Math.floor(t))
  const f = t - i
  const a = geom.cable[i]
  const b = geom.cable[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

/**
 * Panel (u, v) -> world, through the chain's own trapezoid quads. v is measured
 * over the WHOLE chain length so the cable runs across the storey joint without
 * a seam; u is the fraction across each node's radial span, which on a
 * trapezoid narrows with height exactly as the printed sheet does.
 */
export function dispatchLinePoint(
  geom: DispatchLineGeom,
  u: number,
  v: number,
  thetaL: number,
  thetaR: number
): Vec3 {
  const panel = dispatchLinePanel(geom)
  const { panels } = solveStagedChainPose(panel, thetaL, thetaR)
  const total = stagedChainLength(panel)
  const target = clamp(v, 0, 1) * total
  let below = 0
  let k = 0
  for (; k < panel.stages.length - 1; k++) {
    if (below + panel.stages[k].h >= target) break
    below += panel.stages[k].h
  }
  const local = clamp((target - below) / panel.stages[k].h, 0, 1)
  const q = panels[k] // [inner-base, outer-base, outer-top, inner-top]
  const uu = clamp(u, 0, 1)
  const out: number[] = []
  for (let c = 0; c < 3; c++) {
    const a = q[0][c] + (q[1][c] - q[0][c]) * uu
    const b = q[3][c] + (q[2][c] - q[3][c]) * uu
    out.push(a + (b - a) * local)
  }
  return [out[0], out[1], out[2]]
}

/**
 * The four world corners of a basket sitting at arc parameter s — a small
 * axis-aligned rectangle in PANEL space, so it is coplanar with the sheet by
 * construction and inherits fold-flat, wedge containment and the real-time
 * bound from it. Corner order matches the chain's own convention
 * [inner-base, outer-base, outer-top, inner-top].
 */
export function dispatchLineBasketQuad(
  geom: DispatchLineGeom,
  s: number,
  thetaL: number,
  thetaR: number
): PanelQuad {
  const [uRaw, vRaw] = dispatchLineCableAt(geom, s)
  // Clamp the basket's CENTRE into the sheet, never its corners. Clamping
  // corners looks harmless and is not: at the outboard end of the wire the
  // quad's far edge pins to u = 1 while its near edge keeps travelling, so the
  // basket SQUASHES to half width exactly where the reader has just pushed it —
  // measured at 7.2 px across, against 14.8 anywhere else. A handle that shrinks
  // as you use it is worse than a small one.
  const u = clamp(uRaw, geom.basketHalfU, 1 - geom.basketHalfU)
  const u0 = u - geom.basketHalfU
  const u1 = u + geom.basketHalfU
  // The trolley is CENTRED on the cable, not hung beneath it: the pulley wheel
  // and its hanger ride above the wire, the pannier below. That is what a cable
  // trolley is, and it is also the only way the handle fits — a quad hung
  // entirely below the wire dips 0.244 at the outboard end, under the roosts'
  // 0.287 crest, and a handle behind a roof is not a handle (gate L17).
  const v = clamp(vRaw, geom.basketHalfV, 1 - geom.basketHalfV)
  const v0 = v - geom.basketHalfV
  const v1 = v + geom.basketHalfV
  const at = (uu: number, vv: number): Vec3 => dispatchLinePoint(geom, uu, vv, thetaL, thetaR)
  return [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)]
}

/**
 * The reader's basket position. `drive` is the raw drive-channel stroke in
 * [0, 1]; there is no separate fold-flat envelope because an in-plane rider on
 * a folding sheet already carries one — the sheet's cam. Holding the basket
 * mid-span through a page turn is therefore free, which is the whole point of
 * building the playable IN the plane instead of on top of it.
 */
export const dispatchLineRiderS = (geom: DispatchLineGeom, drive: number): number =>
  clamp(geom.riderHome + (1 - geom.riderHome) * clamp(drive, 0, 1), 0, 1)

/**
 * HOW FAR INTO THE LANDING the reader has pushed, in [0, 1]. Zero over the
 * whole open wire, then an eased run-in over the last `dock.band` of the
 * stroke: sin(p*pi/2), the same snap-free cam shape every staged output in this
 * book uses, so the event has finite slope where it starts and lands softly.
 * A geom with no `dock` never leaves zero, which is what keeps this free for
 * any other cable the family ever carries.
 */
export function dispatchLineDockT(geom: DispatchLineGeom, drive: number): number {
  const dock = geom.dock
  if (!dock) return 0
  const band = Math.max(1e-6, dock.band)
  const p = clamp((clamp(drive, 0, 1) - (1 - band)) / band, 0, 1)
  return Math.sin((p * Math.PI) / 2)
}

/**
 * A RIGID IN-PLANE ROTATION of a quad about its own centroid.
 *
 * Rodrigues about the quad's own normal, applied to each corner's offset from
 * the centroid — so every pairwise corner distance is preserved EXACTLY (it is
 * a rotation of a rigid body, not a re-parameterisation), for a quad that is
 * planar or not. That matters here because the rider may straddle the panel's
 * storey joint, where its four sample points are not exactly coplanar; taking
 * the axis from the diagonals and rotating about it keeps the piece rigid
 * either way.
 *
 * And it keeps the fold-flat argument intact rather than needing a new one: at
 * book-close the sheet lies in the page, so the quad's normal IS the page
 * normal, and a rotation about the page normal cannot lift anything off the
 * page. The pannier can therefore stay tipped through a page turn — which is
 * the liftflap persistence law satisfied structurally, exactly as the rider's
 * own hold is.
 */
export function rotateQuadInPlane(quad: PanelQuad, angle: number): PanelQuad {
  if (angle === 0) return quad
  const c: Vec3 = [
    (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4,
    (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4,
    (quad[0][2] + quad[1][2] + quad[2][2] + quad[3][2]) / 4,
  ]
  const d1: Vec3 = [quad[2][0] - quad[0][0], quad[2][1] - quad[0][1], quad[2][2] - quad[0][2]]
  const d2: Vec3 = [quad[3][0] - quad[1][0], quad[3][1] - quad[1][1], quad[3][2] - quad[1][2]]
  const nx = d1[1] * d2[2] - d1[2] * d2[1]
  const ny = d1[2] * d2[0] - d1[0] * d2[2]
  const nz = d1[0] * d2[1] - d1[1] * d2[0]
  const nl = Math.hypot(nx, ny, nz)
  if (nl < 1e-12) return quad
  const k: Vec3 = [nx / nl, ny / nl, nz / nl]
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  return quad.map((p) => {
    const v: Vec3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
    const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2]
    const cx = k[1] * v[2] - k[2] * v[1]
    const cy = k[2] * v[0] - k[0] * v[2]
    const cz = k[0] * v[1] - k[1] * v[0]
    return [
      c[0] + v[0] * ca + cx * sa + k[0] * kv * (1 - ca),
      c[1] + v[1] * ca + cy * sa + k[1] * kv * (1 - ca),
      c[2] + v[2] * ca + cz * sa + k[2] * kv * (1 - ca),
    ] as Vec3
  }) as unknown as PanelQuad
}

/**
 * A LANDING SPRITE — the taking-off raven and the roost lantern — as a small
 * axis-aligned rectangle in PANEL space at (u, v), exactly the construction the
 * fixed baskets and the rider use. Everything the rider's containment proof
 * says is true of these too, for the same reason: a constant-weight bilinear
 * combination of the sheet's corners can never move further than the sheet's
 * own worst step, and folds dead flat when the sheet does.
 */
export function dispatchLineSpriteQuad(
  geom: DispatchLineGeom,
  u: number,
  v: number,
  halfU: number,
  halfV: number,
  thetaL: number,
  thetaR: number
): PanelQuad {
  const uu = clamp(u, halfU, 1 - halfU)
  const vv = clamp(v, halfV, 1 - halfV)
  const at = (a: number, b: number): Vec3 => dispatchLinePoint(geom, a, b, thetaL, thetaR)
  return [
    at(uu - halfU, vv - halfV),
    at(uu + halfU, vv - halfV),
    at(uu + halfU, vv + halfV),
    at(uu - halfU, vv + halfV),
  ]
}

/** Where the landing raven sits at dock progress `t`: it starts ON the landing
 *  (the outboard end of the wire) and climbs back up the line as it takes off. */
export function dispatchLineRavenUV(geom: DispatchLineGeom, t: number): readonly [number, number] {
  const dock = geom.dock
  const [u0, v0] = dispatchLineCableAt(geom, 1)
  if (!dock) return [u0, v0]
  return [u0 + dock.ravenRun * t, v0 + dock.ravenRise * t]
}

/**
 * THE TRAVEL FRAME the reader's hand is read in (s4 round-3, the
 * ch3-dispatch-line gesture-axis known-failure).
 *
 * The trolley used to take the plain page-plane read every tab in the book
 * takes, and the axis gate measured the price: 64.9 degrees between the
 * direction a reader must drag and the direction the paper under their finger
 * actually goes — more than twice the book's bar. The cause is that this handle
 * is NOT on the page. It rides an arc inside a sheet standing at rootDeg 82, so
 * reading its travel off the page's fore axis throws away the whole climb.
 *
 * So the hand is measured where the piece travels: on the SHEET's plane, along
 * the CABLE's own tangent, over the wire's WORLD LENGTH. That last part is what
 * makes the gesture feel right as well as read right — a drag of the run's
 * length is exactly one full traverse.
 *
 * It lives here, not in the layer, so that the axis gate and the drag-regression
 * gate drive the same function the renderer does. A private copy in the layer is
 * how the old mismatch survived two reviews.
 */
export function dispatchLineTravelFrame(
  geom: DispatchLineGeom,
  s: number,
  thetaL: number,
  thetaR: number
): { center: Vec3; n: Vec3; dir: Vec3; len: number } {
  const at = (t: number): Vec3 => {
    const [u, v] = dispatchLineCableAt(geom, t)
    return dispatchLinePoint(geom, u, v, thetaL, thetaR)
  }
  const ds = 0.02
  const pa = at(Math.max(0, s - ds))
  const pb = at(Math.min(1, s + ds))
  const dir: Vec3 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]]
  const panel = solveStagedChainPose(dispatchLinePanel(geom), thetaL, thetaR).panels[0]
  const e1: Vec3 = [panel[1][0] - panel[0][0], panel[1][1] - panel[0][1], panel[1][2] - panel[0][2]]
  const e2: Vec3 = [panel[3][0] - panel[0][0], panel[3][1] - panel[0][1], panel[3][2] - panel[0][2]]
  const n: Vec3 = [
    e1[1] * e2[2] - e1[2] * e2[1],
    e1[2] * e2[0] - e1[0] * e2[2],
    e1[0] * e2[1] - e1[1] * e2[0],
  ]
  let len = 0
  let prev = at(0)
  for (let i = 1; i <= 16; i++) {
    const p = at(i / 16)
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2])
    prev = p
  }
  return { center: at(s), n, dir, len: Math.max(0.05, len) }
}

/** Screen-space-free reach check used by the tests: the cable must lie inside
 *  the sheet and fall monotonically outboard (the scene's one-diagonal law). */
export function dispatchLineCableIsLegal(geom: DispatchLineGeom): boolean {
  return geom.cable.every(
    ([u, v], i) =>
      u >= 0 &&
      u <= 1 &&
      v >= 0 &&
      v <= 1 &&
      (i === 0 || (u > geom.cable[i - 1][0] && v <= geom.cable[i - 1][1] + 1e-9))
  )
}
