/**
 * Pop-up mechanism kinematics — pure math, no three.js, jsdom-testable.
 *
 * Physical model (see docs/superpowers/research/2026-07-10-popup-kinematics-
 * literature.md and the physics benchmark spec): every pop-up piece is a
 * rigid paper mechanism glued to BOTH pages of its spread, posed purely by
 * the spread's dihedral angle beta = thetaL - thetaR. No timers, no springs:
 * when the turning page moves, the paper glued to it is stretched open or
 * folded flat by the page's own motion, exactly like the real book.
 *
 * Three mechanism families (all closed-form, all validated numerically in
 * .superpowers/sdd/bench/derive-variation.mjs before landing here):
 *
 * 1. V-FOLD — a spherical four-bar whose four creases (gutter, two glue
 *    lines, central crease) meet at an apex ON the spine. Symmetric case
 *    (lit doc §3.1): the central crease rides the dihedral-bisector plane at
 *
 *      Lambda(beta) = Phi(beta) + arccos( cos(rho) / R(beta) )
 *      R(beta)      = sqrt( cos^2(phi) + sin^2(phi) * cos^2(beta/2) )
 *      Phi(beta)    = atan2( sin(phi) * cos(beta/2), cos(phi) )
 *
 *    Lambda(0) = phi + rho (folds flat automatically); standing-when-open
 *    requires rho > phi; the late "bloom" is geometric. ASYMMETRIC case
 *    (lit doc §3.3): glue angles phiL != phiR — the crease leaves the
 *    bisector plane and is solved as the two-cone intersection
 *    c.gR = cos(rhoR), c.gL = cos(rhoL) on the unit sphere, with the
 *    Kawasaki-analog flat-fold condition phiR + rhoR = phiL + rhoL kept
 *    true BY CONSTRUCTION via a single skew parameter:
 *    phiL = phi + skew, rhoL = rho - skew.
 *
 * 2. PARALLEL FOLD (lit doc §4) — a planar four-bar in the cross-section
 *    perpendicular to the spine: a strip glued at distance glueL/glueR from
 *    the gutter on each page, creased twice, its floating ridge B solved by
 *    circle-circle intersection. Struts wA = glueR + rise, wC = glueL +
 *    rise make it fold exactly flat at closed (|glueL - glueR| =
 *    |wA - wC|) and stand proud of the pages by `rise` worth of slack when
 *    open. Its creases run PARALLEL to the spine — tents, awnings,
 *    counters — where the v-fold's creases cross it.
 *
 * 3. CHILD V-FOLD (Glassner "generations", lit doc §5) — a symmetric
 *    v-fold whose "pages" are its parent v-fold's two panels and whose
 *    "gutter" is the parent's central crease. Built frame-free from the
 *    parent's in-panel perpendiculars bR/bL:
 *      gChild  = cos(phi) * Zc + sin(phi) * bPanel
 *      cChild  = cos(Lambda(eta)) * Zc + sin(Lambda(eta)) * bisector(bR,bL)
 *    which satisfies the spherical-linkage equation exactly by construction
 *    (the dot product expands to the defining closed form with beta = eta,
 *    the parent's panel dihedral). One page turn drives parent AND child —
 *    a raven rides the rookery fold because the fold itself opens it.
 *
 * 4. BOX FOLD (Ruiz et al. CGF 2014, research doc 2026-07-11; derived and
 *    gate-checked in .superpowers/sdd/bench/derive-boxfold.mjs) — the
 *    volumetric mechanism: an enclosed prism straddling the gutter. Side
 *    walls glued at distance `a` from the spine on BOTH pages stay exactly
 *    PARALLEL TO THE DIHEDRAL BISECTOR at every beta (the lid strut from
 *    wall top to backbone top has length |a*(cos h, sin h)| = a
 *    identically — a zero-residual four-bar branch), so in the bisector
 *    frame the whole box is closed-form:
 *      wall glue at a*(cos h, +-sin h), walls extruded along the bisector;
 *      backbone C = the STATIC rectangle on the bisector plane over the
 *      spine (Ruiz's rigidizer — its seam is visible on real boxes);
 *      flat lid = two width-a panels hinged wall-top <-> C-top (flat
 *      painted top at open, seam over the spine);
 *      gable roof = two width-w panels meeting at a floating ridge at
 *      X = a cos h + H + sqrt(w^2 - a^2 sin^2 h) (pitched barn roof);
 *      caps (front/back faces) = width-a panel pairs hinged on the walls'
 *      front edges, crease on the bisector plane at z1 + a cos h — flat
 *      camera-facing faces at open that bulge outward as the book closes.
 *    The caps are the BRACE: a rigid rectangular cap's crease stays
 *    parallel to its hinge, and coincident lines must be parallel, so
 *    crease coincidence pins both walls to the bisector (Ruiz: the front/
 *    back patches keep L and R from shearing). At least one cap pair is
 *    mandatory; the backbone exists iff roof === 'flat' (the lid braces
 *    it — under a gable or open top it would be an unbraced sway DOF).
 *    Symmetric only: asymmetric glue distances raise the two cap hinges
 *    to different heights and no rigid rectangle can crease them together.
 *
 * World convention (v2 orientation): spine along Z at x = 0, +Y up, +Z
 * toward the camera. A page at angle theta occupies direction
 * (cos theta, sin theta, 0): right page flat = 0, left page flat = PI.
 * V-fold math runs in the dihedral-bisector frame (pages symmetric about
 * its X axis) and is rotated into the world by the bisector angle
 * m = (thetaL + thetaR) / 2 about Z.
 */

export type Vec3 = readonly [number, number, number]

/** One panel's world-space quad corners, ordered for uv mapping:
 *  [bottom-inner, bottom-outer, top-outer, top-inner]. For v-folds the
 *  bottom edge lies exactly on the panel's page (along the glue line) and
 *  the inner edge is the shared central crease; for parallel folds "bottom"
 *  is the glue line and "top" the floating ridge, swept along the spine. */
export type PanelQuad = readonly [Vec3, Vec3, Vec3, Vec3]

// ---------------------------------------------------------------------------
// Author-facing layer geometry (degrees, as written in content.ts).

export type VFoldGeom = {
  mech: 'vfold'
  /** Apex position along the spine (world z, + toward the camera). */
  apexZ: number
  /** Which way along the spine the V opens: +1 toward the camera, -1 away.
   *  The piece folds flat in the OPPOSITE direction when the book closes. */
  vDir: 1 | -1
  /** Right glue-line angle from the gutter, degrees. */
  phiDeg: number
  /** Right panel corner angle (glue crease to central crease), degrees. */
  rhoDeg: number
  /** Asymmetry, degrees: phiL = phi + skew, rhoL = rho - skew. Keeping
   *  phi + rho equal on both sides is the flat-fold (Kawasaki) condition —
   *  built in, so any skew still closes perfectly flat. Nonzero skew tips
   *  the central crease off the vertical: the piece leans. */
  skewDeg?: number
  /** Where the central crease sits across the art, as a fraction of width
   *  from the LEFT edge (default 0.5 = centered). The die-cut's two panel
   *  widths follow it, so an off-center peak folds correctly. */
  creaseU?: number
  /** Full art width across both panels (world units). */
  width: number
  /** Art height along the central crease (world units). */
  height: number
}

export type ParallelGeom = {
  mech: 'parallel'
  /** Glue-line distances from the spine on the left / right page. */
  glueL: number
  glueR: number
  /** Slack that makes the strip stand when open: strut lengths are
   *  wA = glueR + rise (left panel), wC = glueL + rise (right panel), so
   *  the piece folds exactly flat at closed and rises by ~sqrt(rise^2 +
   *  (glueL + glueR) * rise) when open. Closed it reaches
   *  glueL + glueR + rise from the spine — keep that inside the page. */
  rise: number
  /** Span along the spine (world z), z0 < z1. */
  z0: number
  z1: number
}

export type ChildGeom = {
  mech: 'child'
  /** id of the v-fold layer whose central crease this piece rides. */
  parentId: string
  /** Distance along the parent's central crease from the parent apex. */
  mount: number
  /** Which way along the parent crease the child V opens: +1 toward the
   *  crease top, -1 back toward the parent apex. */
  vDir: 1 | -1
  /** Child glue/corner angles, degrees — measured against the parent
   *  crease exactly as a page v-fold measures against the gutter.
   *  Children are symmetric only (skew belongs on page-level pieces). */
  phiDeg: number
  rhoDeg: number
  creaseU?: number
  width: number
  height: number
}

export type BoxGeom = {
  mech: 'box'
  /** Glue-line distance from the spine on BOTH pages (the box half-width).
   *  Symmetric by construction — see the module header. */
  a: number
  /** Wall height along the dihedral bisector. */
  height: number
  /** Span along the spine (world z), z0 < z1; the front face is at z1,
   *  toward the camera. Caps fold OUT to z1 + a / z0 - a at closed — keep
   *  that inside the page. */
  z0: number
  z1: number
  /** 'flat' = painted lid on a backbone (counter, chest with a top);
   *  'gable' = pitched roof pair on a floating ridge (barn, stall);
   *  'open' = hollow, interior visible from the high reading camera. */
  roof: 'flat' | 'gable' | 'open'
  /** Ridge height above the walls at full open (gable roofs only). */
  gableRise?: number
  /** Cap pairs (the box's front/back faces). At least one pair must stay
   *  on: the caps are what brace the walls (default both true). */
  capFront?: boolean
  capBack?: boolean
}

export type PlatformStrut = {
  /** Glue-line distances from the spine on the left / right page. */
  glueL: number
  glueR: number
  /** Stand-proud slack, exactly as ParallelGeom: panel widths are
   *  glueR + rise (left panel) and glueL + rise (right panel), so every
   *  strut folds flat by construction. */
  rise: number
  /** Strut bays along the spine: disjoint [z0, z1] spans. All bays of a
   *  rank share one cross-section, so they share one ridge line — that is
   *  what lets a single deck ride them all (Eni Oken: "the secret is to
   *  create all pedestals the same size"). */
  spans: readonly (readonly [number, number])[]
}

/**
 * FLOATING PLATFORM (anatomy research rec #1; derive-platform.mjs): a
 * two-panel DECK hinged along the ridge lines of two tent-strut ranks,
 * meeting at a center crease solved by circle-circle intersection —
 * 0-DOF, closed form, h-only. The crease is authentic anatomy: a rigid
 * uncreased plate spanning the gutter cannot flat-fold. Flat-fold rules
 * (asserted by the content covenant, discovered in the derive):
 * BRIDGE (rank B mirrors rank A, same closed reach) needs qA = qB;
 * TERRACE (different closed reaches) needs qA + qB = the closed gap.
 */
export type PlatformGeom = {
  mech: 'platform'
  strutA: PlatformStrut
  strutB: PlatformStrut
  /** Deck panel widths, ridge A / ridge B to the shared crease. */
  qA: number
  qB: number
  /** Deck span along the spine — bridging the strut bays IS the floating
   *  look (one art piece spanning the gaps between supports). */
  deckZ0: number
  deckZ1: number
}

/** One fan member — a v-fold sharing the fan's common apex. Same angle
 *  conventions as VFoldGeom; the built-in skew keeps flat-fold true.
 *  Feasibility (derive-fan.mjs): the member must bridge its glue lines at
 *  full open — rhoL + rhoR >= phiL + phiR — asserted by the covenant. */
export type FanMember = {
  phiDeg: number
  rhoDeg: number
  skewDeg?: number
  creaseU?: number
  width: number
  height: number
}

/**
 * ANGLE-FOLD FAN (research §4; derive-fan.mjs): k independent v-folds
 * sharing ONE spine apex with distinct angles — Birmingham's M-fold is
 * 3 members: 6 planes / 9 gullies from one sheet. Members must never
 * cross mid-fold (3D arc gate in the derive + covenant test).
 */
export type FanGeom = {
  mech: 'fan'
  apexZ: number
  vDir: 1 | -1
  members: readonly FanMember[]
}

/**
 * RIDER (mechanism-on-mechanism recursion, derive-recursion.mjs): a
 * symmetric v-fold whose "pages" are a parent mechanism's hinged patch
 * pair. Valid seats fold parallel at book-closed (the mount rule):
 * 'boxLid' — valley child standing on a flat-roofed box (local half-angle
 * = the page half-angle exactly); 'deckCrease' — rooftop child straddling
 * a BRIDGE platform's deck peak (half-angle PI at closed, easing down as
 * the book opens — a rider, not a tower).
 */
export type RiderGeom = {
  mech: 'rider'
  /** id of the box (roof 'flat') or bridge platform this rider sits on. */
  parentId: string
  seat: 'boxLid' | 'deckCrease'
  /** Mount position along the seat crease (world z). */
  mountZ: number
  vDir: 1 | -1
  phiDeg: number
  rhoDeg: number
  creaseU?: number
  width: number
  height: number
}

/**
 * DRESS PATCH (the Sabuda recipe's engine form): a decoratively-shaped
 * NON-KINEMATIC patch glued flat onto one parent panel, rigidly riding
 * its link — "links may be curved, partially cut away, extended beyond
 * their joints". Dress patches carry die-cut silhouette art and may
 * overhang the panel edges; they add zero DOF and zero solver work.
 */
export type DressGeom = {
  mech: 'dress'
  parentId: string
  /** Which parent surface carries the patch: 'left' | 'right' for
   *  two-panel mechs, a BoxFace for boxes, a PlatformFace for platforms. */
  seat: string
  /** Placement from the seat panel's bottom-left corner, along its edges
   *  (world units). May run past the panel — overhang is the point. */
  u: number
  v: number
  /** Rotation in the panel plane, degrees. */
  angleDeg?: number
  width: number
  height: number
}

export type LayerGeom =
  | VFoldGeom
  | ParallelGeom
  | ChildGeom
  | BoxGeom
  | PlatformGeom
  | FanGeom
  | RiderGeom
  | DressGeom

/** A solved mechanism pose: two world-space panel quads plus the axes a
 *  cascaded child needs to mount on (unit vectors; apex in world space).
 *  `split` is the fold line's texture coordinate (u across the art). */
export type MechPose = {
  right: PanelQuad
  left: PanelQuad
  split: number
  apex: Vec3
  /** Unit central crease / ridge direction. */
  crease: Vec3
  /** Unit glue-line directions (v-folds; parallel folds have no meaningful
   *  glue direction for children — mounting on them is rejected). */
  glueR: Vec3
  glueL: Vec3
}

// ---------------------------------------------------------------------------
// Small vector helpers (local — this module stays three.js-free).

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const combine = (sa: number, a: Vec3, sb: number, b: Vec3): Vec3 => [
  sa * a[0] + sb * b[0],
  sa * a[1] + sb * b[1],
  sa * a[2] + sb * b[2],
]
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** Parallelogram panel from an apex and two spanning directions — the shape
 *  a real die-cut v-fold panel is: base along the glue line, sides along
 *  the central crease. Corner order matches PanelQuad. Exported for the
 *  anatomy solvers (popup-anatomy.ts); not an authoring API. */
export const parallelogram = (apex: Vec3, g: Vec3, glueLen: number, c: Vec3, height: number): PanelQuad => [
  apex,
  combine(1, apex, glueLen, g),
  [
    apex[0] + g[0] * glueLen + c[0] * height,
    apex[1] + g[1] * glueLen + c[1] * height,
    apex[2] + g[2] * glueLen + c[2] * height,
  ],
  combine(1, apex, height, c),
]

// ---------------------------------------------------------------------------
// V-fold closed forms.

/** Central-crease elevation for dihedral beta — the symmetric closed form. */
export function creaseElevation(phi: number, rho: number, beta: number): number {
  const cb2 = Math.cos(beta / 2)
  const r = Math.sqrt(Math.cos(phi) ** 2 + Math.sin(phi) ** 2 * cb2 * cb2)
  const bigPhi = Math.atan2(Math.sin(phi) * cb2, Math.cos(phi))
  return bigPhi + Math.acos(clamp(Math.cos(rho) / r, -1, 1))
}

/** Crease elevation at fully open (beta = PI): arccos(cos rho / cos phi). */
export const openElevation = (phi: number, rho: number): number =>
  Math.acos(clamp(Math.cos(rho) / Math.cos(phi), -1, 1))

/** Bisector-frame central crease for a possibly-asymmetric v-fold.
 *  Symmetric pieces take the exact closed form (total on [0, PI]); skewed
 *  pieces take the general two-cone solve, whose branch t = -vDir * sqrt(t2)
 *  is the standing (reader-side) sheet — validated continuous across the
 *  sweep, no flips (derive-variation.mjs §1b). */
function bisectorCrease(
  phiR: number,
  rhoR: number,
  phiL: number,
  rhoL: number,
  vDir: 1 | -1,
  beta: number,
  gR: Vec3,
  gL: Vec3
): Vec3 {
  if (phiR === phiL && rhoR === rhoL) {
    const lambda = creaseElevation(phiR, rhoR, beta)
    return [Math.sin(lambda), 0, vDir * Math.cos(lambda)]
  }
  const d = dot(gR, gL)
  const den = 1 - d * d
  const cR = Math.cos(rhoR)
  const cL = Math.cos(rhoL)
  const a = (cR - d * cL) / den
  const b = (cL - d * cR) / den
  // t2's exact zero at beta = 0 (the flat fold) picks up ~1e-11 of float
  // residue; clamping keeps the sqrt real. Sub-micron flatness — the A3
  // benchmark tolerance for skewed pieces is 1e-5 against paper at 0.02.
  const t2 = Math.max(0, (1 - a * cR - b * cL) / den)
  const t = -vDir * Math.sqrt(t2)
  const x = cross(gR, gL)
  return [
    a * gR[0] + b * gL[0] + t * x[0],
    a * gR[1] + b * gL[1] + t * x[1],
    a * gR[2] + b * gL[2] + t * x[2],
  ]
}

/**
 * Solves a page-glued v-fold's world pose for pages at (thetaL, thetaR).
 *
 * The art maps onto each panel as a parallelogram whose bottom edge runs
 * along the glue line (length panelWidth / sin rho, so the art's
 * perpendicular panel width is exact) and whose side edges run along the
 * central crease — the same shear a real die-cut v-fold piece carries. The
 * whole bottom edge therefore lies IN the page plane at every beta: the
 * glue is visible truth, not an epsilon.
 */
export function solveVFoldPose(geom: VFoldGeom, thetaL: number, thetaR: number): MechPose {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const m = (thetaL + thetaR) / 2
  const h = beta / 2
  const { vDir, apexZ } = geom
  const skew = rad(geom.skewDeg ?? 0)
  const phiR = rad(geom.phiDeg)
  const rhoR = rad(geom.rhoDeg)
  const phiL = phiR + skew
  const rhoL = rhoR - skew

  // Bisector-frame glue directions (pages symmetric about the frame's X
  // axis; z mirrored by vDir so the V opens the requested way).
  const gR: Vec3 = [Math.sin(phiR) * Math.cos(h), -Math.sin(phiR) * Math.sin(h), vDir * Math.cos(phiR)]
  const gL: Vec3 = [Math.sin(phiL) * Math.cos(h), Math.sin(phiL) * Math.sin(h), vDir * Math.cos(phiL)]
  const c = bisectorCrease(phiR, rhoR, phiL, rhoL, vDir, beta, gR, gL)

  // World = rotate by the bisector angle m about Z, then offset to the apex.
  const cm = Math.cos(m)
  const sm = Math.sin(m)
  const toWorld = (v: Vec3): Vec3 => [v[0] * cm - v[1] * sm, v[0] * sm + v[1] * cm, v[2]]
  const gRw = toWorld(gR)
  const gLw = toWorld(gL)
  const cw = toWorld(c)

  const split = geom.creaseU ?? 0.5
  const glueLenR = (geom.width * (1 - split)) / Math.sin(rhoR)
  const glueLenL = (geom.width * split) / Math.sin(rhoL)
  const apex: Vec3 = [0, 0, apexZ]

  return {
    right: parallelogram(apex, gRw, glueLenR, cw, geom.height),
    left: parallelogram(apex, gLw, glueLenL, cw, geom.height),
    split,
    apex,
    crease: cw,
    glueR: gRw,
    glueL: gLw,
  }
}

// ---------------------------------------------------------------------------
// Parallel fold (planar four-bar in the cross-section, lit doc §4).

/** Cross-section ridge of a parallel-fold strip in the bisector frame
 *  (pages at +-h from X): glue at dL/dR from the spine, panel widths
 *  glueR + rise / glueL + rise. Exported for the platform solver, whose
 *  strut ranks are exactly these tents (popup-anatomy.ts). */
export function parallelRidge(dL: number, dR: number, rise: number, h: number): readonly [number, number] {
  const wA = dR + rise
  const wC = dL + rise
  const ax = dL * Math.cos(h)
  const ay = dL * Math.sin(h)
  const cx = dR * Math.cos(h)
  const cy = -dR * Math.sin(h)
  const dx = cx - ax
  const dy = cy - ay
  const dist = Math.hypot(dx, dy)

  if (dist < 1e-9) {
    // Symmetric strip at exactly closed: the glue points coincide and the
    // equal-radius circles are concentric — the strip folds flat up the
    // collapsed page, reaching dL + wA from the spine.
    return [ax + wA, ay]
  }
  const ex = dx / dist
  const ey = dy / dist
  const along = (dist * dist + wA * wA - wC * wC) / (2 * dist)
  const h2 = Math.max(0, wA * wA - along * along)
  const lift = Math.sqrt(h2)
  // Two branches along the AC normal; the ridge stands on the reader
  // side (larger bisector-frame x). n = (-ey, ex) has nx = -ey >= 0 for
  // beta in [0, PI] (ey <= 0), so the + branch is always the standing one.
  return [ax + along * ex - lift * ey, ay + along * ey + lift * ex]
}

export function solveParallelPose(geom: ParallelGeom, thetaL: number, thetaR: number): MechPose {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const m = (thetaL + thetaR) / 2
  const h = beta / 2
  const { glueL: dL, glueR: dR, rise, z0, z1 } = geom
  const wA = dR + rise
  const wC = dL + rise

  const ax = dL * Math.cos(h)
  const ay = dL * Math.sin(h)
  const cx = dR * Math.cos(h)
  const cy = -dR * Math.sin(h)
  const [bx, by] = parallelRidge(dL, dR, rise, h)

  const cm = Math.cos(m)
  const sm = Math.sin(m)
  const world = (x: number, y: number, z: number): Vec3 => [x * cm - y * sm, x * sm + y * cm, z]

  const split = wA / (wA + wC)
  const left: PanelQuad = [world(ax, ay, z0), world(ax, ay, z1), world(bx, by, z1), world(bx, by, z0)]
  const right: PanelQuad = [world(bx, by, z0), world(bx, by, z1), world(cx, cy, z1), world(cx, cy, z0)]

  return {
    right,
    left,
    split,
    apex: world(bx, by, z0),
    crease: [0, 0, 1],
    glueR: [0, 0, 1],
    glueL: [0, 0, 1],
  }
}

// ---------------------------------------------------------------------------
// Cascaded child v-fold riding a parent's central crease (lit doc §5).

export function solveChildPose(geom: ChildGeom, parent: MechPose): MechPose {
  const c = parent.crease
  // In-panel perpendiculars to the crease, pointing into each parent panel.
  const bR = normalize(combine(1, parent.glueR, -dot(parent.glueR, c), c))
  const bL = normalize(combine(1, parent.glueL, -dot(parent.glueL, c), c))
  // The parent's panel dihedral is the child's driving angle: 0 when the
  // book (and so the parent) is folded flat, opening as the parent blooms.
  const eta = Math.acos(clamp(dot(bR, bL), -1, 1))

  const phi = rad(geom.phiDeg)
  const rho = rad(geom.rhoDeg)
  const zc: Vec3 = [c[0] * geom.vDir, c[1] * geom.vDir, c[2] * geom.vDir]
  const gRw = combine(Math.cos(phi), zc, Math.sin(phi), bR)
  const gLw = combine(Math.cos(phi), zc, Math.sin(phi), bL)
  // Symmetric child: its crease rides the parent panels' bisector plane at
  // the closed-form elevation — dot(cChild, gChild) = cos(rho) expands to
  // exactly the defining equation (V1) with beta = eta.
  const lambda = creaseElevation(phi, rho, eta)
  const bisector = normalize(combine(1, bR, 1, bL))
  const cChild = combine(Math.cos(lambda), zc, Math.sin(lambda), bisector)

  const apex: Vec3 = [
    parent.apex[0] + c[0] * geom.mount,
    parent.apex[1] + c[1] * geom.mount,
    parent.apex[2] + c[2] * geom.mount,
  ]
  const split = geom.creaseU ?? 0.5
  const glueLenR = (geom.width * (1 - split)) / Math.sin(rho)
  const glueLenL = (geom.width * split) / Math.sin(rho)

  return {
    right: parallelogram(apex, gRw, glueLenR, cChild, geom.height),
    left: parallelogram(apex, gLw, glueLenL, cChild, geom.height),
    split,
    apex,
    crease: cChild,
    glueR: gRw,
    glueL: gLw,
  }
}

// ---------------------------------------------------------------------------
// Box fold (Ruiz-style enclosed prism, closed form — module header §4).

/** A box patch's name doubles as its art-face role: caps carry the front/
 *  back paintings, walls the sides, lid/roof the top, backbone raw paper. */
export type BoxFace =
  | 'wallL'
  | 'wallR'
  | 'lidL'
  | 'lidR'
  | 'roofL'
  | 'roofR'
  | 'capFrontL'
  | 'capFrontR'
  | 'capBackL'
  | 'capBackR'
  | 'backbone'

export type BoxPatch = { readonly face: BoxFace; readonly quad: PanelQuad }

/**
 * Solves a box fold's world pose. Every quad is ordered [bottom-left,
 * bottom-right, top-right, top-left] AS SEEN FROM OUTSIDE the box at rest,
 * so uvs (0,0)(1,0)(1,1)(0,1) print each face's art upright and the
 * [0,1,2, 0,2,3] winding faces outward. The patch LIST (faces present,
 * their order) is constant for a given geometry — only corners move.
 */
export function solveBoxPose(geom: BoxGeom, thetaL: number, thetaR: number): readonly BoxPatch[] {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const m = (thetaL + thetaR) / 2
  const h = beta / 2
  const ch = Math.cos(h)
  const sh = Math.sin(h)
  const cm = Math.cos(m)
  const sm = Math.sin(m)
  const { a, height: H, z0, z1 } = geom
  const capFront = geom.capFront ?? true
  const capBack = geom.capBack ?? true
  // Bisector frame -> world: X along the bisector, rotated by m about Z.
  const W = (x: number, y: number, z: number): Vec3 => [x * cm - y * sm, x * sm + y * cm, z]

  const patches: BoxPatch[] = [
    { face: 'wallL', quad: [W(a * ch, a * sh, z0), W(a * ch, a * sh, z1), W(a * ch + H, a * sh, z1), W(a * ch + H, a * sh, z0)] },
    { face: 'wallR', quad: [W(a * ch, -a * sh, z1), W(a * ch, -a * sh, z0), W(a * ch + H, -a * sh, z0), W(a * ch + H, -a * sh, z1)] },
  ]
  if (geom.roof === 'flat') {
    patches.push(
      { face: 'backbone', quad: [W(0, 0, z0), W(0, 0, z1), W(H, 0, z1), W(H, 0, z0)] },
      { face: 'lidL', quad: [W(a * ch + H, a * sh, z1), W(H, 0, z1), W(H, 0, z0), W(a * ch + H, a * sh, z0)] },
      { face: 'lidR', quad: [W(H, 0, z1), W(a * ch + H, -a * sh, z1), W(a * ch + H, -a * sh, z0), W(H, 0, z0)] }
    )
  } else if (geom.roof === 'gable') {
    const w = Math.hypot(a, geom.gableRise ?? 0)
    const rx = a * ch + H + Math.sqrt(Math.max(0, w * w - a * a * sh * sh))
    patches.push(
      { face: 'roofL', quad: [W(a * ch + H, a * sh, z1), W(rx, 0, z1), W(rx, 0, z0), W(a * ch + H, a * sh, z0)] },
      { face: 'roofR', quad: [W(rx, 0, z1), W(a * ch + H, -a * sh, z1), W(a * ch + H, -a * sh, z0), W(rx, 0, z0)] }
    )
  }
  if (capFront) {
    const zc = z1 + a * ch
    patches.push(
      { face: 'capFrontL', quad: [W(a * ch, a * sh, z1), W(a * ch, 0, zc), W(a * ch + H, 0, zc), W(a * ch + H, a * sh, z1)] },
      { face: 'capFrontR', quad: [W(a * ch, 0, zc), W(a * ch, -a * sh, z1), W(a * ch + H, -a * sh, z1), W(a * ch + H, 0, zc)] }
    )
  }
  if (capBack) {
    const zc = z0 - a * ch
    patches.push(
      { face: 'capBackR', quad: [W(a * ch, -a * sh, z0), W(a * ch, 0, zc), W(a * ch + H, 0, zc), W(a * ch + H, -a * sh, z0)] },
      { face: 'capBackL', quad: [W(a * ch, 0, zc), W(a * ch, a * sh, z0), W(a * ch + H, a * sh, z0), W(a * ch + H, 0, zc)] }
    )
  }
  return patches
}

// ---------------------------------------------------------------------------
// Dispatch: one entry point for any layer geometry.

/**
 * Solves any two-panel layer's pose. Child layers need their parent's
 * geometry — the caller resolves `parentId` (content keeps children after
 * parents in each spread's layer list). Children may only mount on
 * v-folds: a parallel fold's ridge is a translating crease, not a
 * fixed-apex fold, so a spherical child cannot ride it. Box layers are
 * multi-patch and take `solveBoxPose` instead.
 */
export function solveLayerPose(
  geom: LayerGeom,
  parentGeom: LayerGeom | undefined,
  thetaL: number,
  thetaR: number
): MechPose {
  switch (geom.mech) {
    case 'vfold':
      return solveVFoldPose(geom, thetaL, thetaR)
    case 'parallel':
      return solveParallelPose(geom, thetaL, thetaR)
    case 'child': {
      if (!parentGeom || parentGeom.mech !== 'vfold') {
        throw new Error(`storybook: child layer needs a v-fold parent (got ${parentGeom?.mech ?? 'none'})`)
      }
      return solveChildPose(geom, solveVFoldPose(parentGeom, thetaL, thetaR))
    }
    case 'box':
      throw new Error('storybook: box layers are multi-patch — use solveBoxPose')
    case 'platform':
      throw new Error('storybook: platform layers are multi-patch — use solvePlatformPose (popup-anatomy)')
    case 'fan':
      throw new Error('storybook: fan layers are multi-pose — use solveFanPose (popup-anatomy)')
    case 'rider':
      throw new Error('storybook: rider layers need their parent geometry — use solveRiderPose (popup-anatomy)')
    case 'dress':
      throw new Error('storybook: dress patches ride a solved parent surface — use solveDressPose (popup-anatomy)')
  }
}

// ---------------------------------------------------------------------------
// Turn plumbing: which page angles a spread sees, given a turn in flight.

export type SpreadRole = 'current' | 'outgoing' | 'incoming'
export type TurnDir = 'next' | 'prev'

/** The moving sheet's angle over the right side, radians 0..PI — matches
 *  the turning page's own rigid rotation exactly (same eased t). */
export const sheetAngle = (dir: TurnDir, easedT: number): number =>
  dir === 'next' ? Math.PI * clamp(easedT, 0, 1) : Math.PI * (1 - clamp(easedT, 0, 1))

/**
 * Page angles (thetaL, thetaR) for a spread, by its relationship to the
 * turn in flight. The sheet IS one page of both spreads at once:
 * the outgoing spread's dihedral closes PI -> 0 while the incoming one's
 * opens 0 -> PI, both driven by the single sheet angle — so the paper
 * moves exactly when, and as fast as, the page does.
 */
export function spreadPageAngles(
  role: SpreadRole,
  dir: TurnDir | null,
  easedT: number
): { thetaL: number; thetaR: number } {
  if (role === 'current' || dir === null) return { thetaL: Math.PI, thetaR: 0 }
  const theta = sheetAngle(dir, easedT)
  if (dir === 'next') {
    // Sheet lifts off the right stack (outgoing right page), lands as the
    // incoming spread's left page.
    return role === 'outgoing' ? { thetaL: Math.PI, thetaR: theta } : { thetaL: theta, thetaR: 0 }
  }
  // 'prev': sheet lifts off the left stack, lands as the incoming right page.
  return role === 'outgoing' ? { thetaL: theta, thetaR: 0 } : { thetaL: Math.PI, thetaR: theta }
}

/** Dihedral angle a spread sees for its role — the single driving value. */
export function spreadDihedral(role: SpreadRole, dir: TurnDir | null, easedT: number): number {
  const { thetaL, thetaR } = spreadPageAngles(role, dir, easedT)
  return clamp(thetaL - thetaR, 0, Math.PI)
}
