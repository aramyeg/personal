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

import { INTERIOR_SHEETS, PAGE_W, SHEET_STACK_T, restAngles } from './page-geometry'
// Kinetic arms are a two-panel MechPose whose math lives in its own module
// (this file is at its size cap). popup-kinetic imports only creaseElevation
// + parallelogram back — both defined below and used only at call time, so
// the cycle is inert at module-eval (ESM live bindings).
import { solveKineticArmPose } from './popup-kinetic'
// The E1 showpiece mechs (dispatch keep) define their geoms in their own
// solver modules; imported TYPE-ONLY here for the LayerGeom union, so there is
// no runtime cycle (popup-keepstack requires solveBoxPose from this file, not
// the reverse). Their solvers are multi-patch / user-driven and route through
// their own layer renderers, exactly like box/knobtower.
import type { KeepStackGeom } from './popup-keepstack'
import type { KeepWinchGeom } from './popup-keepwinch'
import type { KeepSkylineGeom } from './popup-skyline'
import type { SwarmArcGeom } from './popup-swarmarc'
// The E3 s5 range family (Birmingham 28/57): ONE card of k standing v-fold
// ranks at distinct apexZ stations + flat gusset strips. TYPE-ONLY import
// (popup-mfoldrange requires solveVFoldPose from this file, not the reverse).
import type { MFoldRangeGeom } from './popup-mfoldrange'
// The E3 s7 nave rank (origamic-architecture relief strata die-cut from a
// v-fold wall host) — geom + relief math in its own module, TYPE-ONLY here
// (popup-oanave requires solveVFoldPose from this file, not the reverse).
import type { OanaveGeom } from './popup-oanave'
// The E3 s4 staged-chain family (round-3 rookery cliffs): a page-rooted chain
// of storey panels whose joints deploy on their own beta cams. TYPE-ONLY here
// (popup-stagedchain only needs PanelQuad/Vec3 from this file).
import type { StagedChainGeom } from './popup-stagedchain'

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
  /** When false, the capFront faces render as raw supporting paper (no `-front`
   *  art), because a DIE-CUT FACADE PLATE (popup-keepstack.ts facade plate,
   *  the raven-finial idiom generalized) prints the tier's front art in front of
   *  the cap instead — the cap stays as plain bracing paper hidden behind it.
   *  Default true (the cap prints its own `-front` art). */
  capFrontArt?: boolean
  /** Cumulative height of the stories BENEATH this box when it is one story
   *  of a stacked keep (popup-keepstack.ts): the whole bisector-x is offset
   *  by baseH so the box's wall glue seats ON the lower story's flat lid at
   *  lid-distance a (telescoping a_k <= a_{k-1}). Default 0 = a ground box.
   *  Folds dead flat at book-closed regardless (the offset is along bisector-x,
   *  which collapses to the page plane as beta -> 0). */
  baseH?: number
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
 * RIDER (mechanism-on-mechanism recursion, derive-recursion.mjs; extended
 * by the OFF-SPINE family, derive-offspine.mjs — C6 round 7): a symmetric
 * v-fold whose "pages" are a parent mechanism's hinged patch pair. Valid
 * seats fold parallel at book-closed (the mount rule):
 * 'boxLid' — valley child standing on a flat-roofed box (local half-angle
 * = the page half-angle exactly); 'deckCrease' — rooftop child straddling
 * a bridge platform's deck peak (half-angle PI at closed, easing down as
 * the book opens — a rider, not a tower). The bridge may be NON-MIRRORED
 * (equal closed reach is the whole rule), so the deck — and the rider —
 * can stand at any lateral station; 'tentRidge' — rooftop child astride a
 * parallel-fold ground swell's ridge, which sits at lateral station
 * ~ (glueL - glueR): the full-range off-spine anchor. Tent seats are
 * always mount-valid (the tent's panels fold together with the page
 * sandwich); the rider leans by half the tent's cross-section asymmetry —
 * zero when glueL === glueR, growing with offset (composition budgets it).
 */
export type RiderGeom = {
  mech: 'rider'
  /** id of the box (roof 'flat'), bridge platform, or parallel-fold ground
   *  swell this rider sits on. */
  parentId: string
  seat: 'boxLid' | 'deckCrease' | 'tentRidge'
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

/**
 * PULL-STRIP ERECTED FLAP (C6 round 7c; derive-pullstrip.mjs): the
 * off-center figure with NO visible connector (law L5). A hidden strip
 * anchored on the OPPOSITE page crosses the gutter valley as a taut
 * chord, threads a slot in the floor, and pulls a flap erect about a
 * hinge glued flat on the figure's page — the book's own opening is the
 * puller (one dihedral, benchmark B9). The under-floor run cancels out
 * of the kinematics, so the figure stands at ANY station with ANY
 * facing; only the flap itself is visible paper. Geared to stand at
 * exactly 90 deg at `erectAtDeg`; the opposite page presses it flat
 * early in a turn until it peels up (theta = min(strip curve, beta)).
 */
export type StripFlapGeom = {
  mech: 'stripflap'
  /** The page the figure stands on (the strip anchors on the other). */
  side: 'left' | 'right'
  /** Strip anchor: distance from the gutter on the opposite page, and z. */
  anchor: number
  anchorZ: number
  /** Floor slot: distance from the gutter on the figure's page, and z. */
  slot: number
  slotZ: number
  /** Hinge center on the figure's page: distance from the gutter along
   *  the page, and z. */
  hingeX: number
  hingeZ: number
  /** Hinge orientation in the page plane, degrees: 0 = across the page
   *  (frontal figure, face to the reader), 90 = along the spine
   *  (profile). 180 flips which way the flap lies when flat. */
  hingeDeg?: number
  width: number
  height: number
  /** Dihedral (deg) at which the figure stands exactly upright.
   *  Default 176 — the book's rest bloom. */
  erectAtDeg?: number
}

export type TabPieceGeom = {
  mech: 'tabpiece'
  /** The page the piece stands on (and whose fore edge shows the tab). */
  side: 'left' | 'right'
  form: 'mound' | 'table'
  /** Fixed fore-side hinge: distance from the gutter along the page. */
  hingeX: number
  /** Piece extent along the spine (ridge runs parallel to the spine). */
  z0: number
  z1: number
  /** Panel / leg width. */
  legW: number
  /** Table only: deck length between the leg tops. */
  deckD?: number
  /** Rest lift angle, degrees (default 55; must stay below 90). */
  liftDeg?: number
  /** Dihedral (deg) the cam normalizes to — the book's rest bloom.
   *  Default 176. */
  restAtDeg?: number
  /** Visible tab width along the spine (default 0.1). */
  tabW?: number
}

/**
 * KINETIC MOVING ARM (Part D4; Birmingham mech 73) — the book's first
 * image-ANIMATING fold. A 45deg double-triangle muscle astride the spine
 * carries a rigid ARM extended up its ridge crease; the arm sweeps a clean
 * quarter-turn from lying in the page (book closed) to standing vertical
 * (book open). Pose math lives in book/popup-kinetic.ts (this module is at
 * its size cap); it is an ordinary two-panel MechPose (ARM + FLAP), so it
 * routes through the standard PopupLayer renderer. Derived + gate-checked in
 * .superpowers/sdd/bench/derive-kinetic.mjs.
 */
export type KineticArmGeom = {
  mech: 'kinetic'
  /** Apex on the spine (world z). */
  apexZ: number
  /** Fold direction along the spine: +1 the arm folds flat toward +z as the
   *  book closes, -1 toward -z. */
  vDir: 1 | -1
  /** Glue-crease angle from the spine, degrees. Birmingham's 45 fold — 45
   *  makes the arm sweep a clean quarter-turn (default 45). */
  phiDeg?: number
  /** Muscle corner angle, degrees. rho = 90 stands the arm EXACTLY vertical
   *  at full open (the 45 rule); a hair under leans it toward the reader.
   *  Must exceed phi, and phi + rho < 180. */
  rhoDeg: number
  /** Arm length up the ridge crease — the sweeping lever. */
  armLen: number
  /** Arm base width along its glue line (narrow = a lever, not a wall). */
  armW: number
  /** Muscle flap on the opposite page: glue-line width and rise up the ridge
   *  (the short mount triangle). */
  flapW: number
  flapLen: number
}

/**
 * PANEL ROTOR (Part D4 wave 2; Birmingham mech 76 "A TURNING DISC" + mech 103
 * "THE HUB") — the KINETIC sibling of the dress patch. A die-cut disc riveted
 * flat onto ONE parent panel, one glue layer proud, that ROTATES in the plane
 * of that panel as the book opens (windmill sails, a compass rose, a clock
 * dial). It resolves its seat exactly like a dress patch (the same seat
 * vocabulary), but its square quad SPINS about its center by a designed cam of
 * the dihedral. Because it lies ON its parent panel (coplanar within the glue
 * lift at every angle), it adds NO collision footprint — the reason this
 * variant exists. Pose math lives in book/popup-rotor.ts (this module is at
 * its size cap). Derived + gate-checked in .superpowers/sdd/bench/derive-rotor.mjs.
 */
export type RotorGeom = {
  mech: 'rotor'
  /** id of the panel this disc rivets onto (a v-fold, box, or platform). */
  parentId: string
  /** Which parent surface carries the disc — the dress seat vocabulary:
   *  'left' | 'right' for two-panel mechs, a BoxFace, a PlatformFace. */
  seat: string
  /** Hub position from the seat panel's bottom-left corner, along its edges
   *  (world units) — the disc's center of rotation. */
  u: number
  v: number
  /** Disc radius; rendered as a square quad of side 2*radius carrying circular
   *  die-cut art (the alpha cutout makes it a disc). The rotating square's
   *  corners reach radius*sqrt(2) from the hub. */
  radius: number
  /** Total spin from closed to rest, degrees. Capped at |150| (mech 76:
   *  rotation = 2xE, practical E <= 75). Sign sets the turn direction. */
  spinDeg: number
  /** Dihedral (deg) the cam normalizes to — the book's rest bloom. Default 176. */
  restAtDeg?: number
}

/**
 * VOLVELLE (E2.2 Batch B; Birmingham mech 103 "THE HUB" + mech 104 "THE
 * ROTATING WINDOW") — the book's first reader-spun paper DIAL with windowed
 * reveals: the raven DISPATCH DIAL on spread 4. PAGE-ROOTED like the knob tower
 * (side + page coordinates, NOT seated on a parent panel), it mirrors the s4
 * winch: the winch's crank knob on the LEFT page, the dispatch dial on the
 * RIGHT. TWO die-cut discs are HUB-RIVETED coplanar into the page (the rotor
 * vocabulary: ROTOR_LIFT proud, spun on the page's own frame):
 *   DIAL — beneath, one glue layer proud, S sectors of dispatch art (ravens at
 *     staggered headings, route glyphs, a tally band). Spun by the reader's
 *     twist theta (the knobtower/winch H4 idiom: pointer angle about the hub,
 *     wrapped-delta accumulation into the user-drive channel, release HOLDS theta
 *     — persistence, "the book remembers the knob"). A coplanar disc lies flat at
 *     ANY rotation, so — unlike the knob tower — the dial needs NO fold-flat
 *     envelope: it simply rides the folding page, whose own flat-fold carries it
 *     down at book close.
 *   CARD — over, a second glue layer proud, STATIC, W die-cut WINDOWS + a rim
 *     thumb-tab (the affordance). Each detent-worth of spin frames a fresh
 *     sector through each window.
 * On release theta snaps to the nearest detent (2pi/S — the sectors click into
 * their windows). Pose + registration math lives in book/popup-volvelle.ts (this
 * module is at its size cap). Derived + gate-checked in
 * .superpowers/sdd/bench/derive-volvelle.mjs.
 */
export type VolvelleWindow = {
  /** Window centre angle in the disc's page frame (0 = the fore-edge/along-page
   *  direction), degrees. Congruent to a sector centre (mod 360/sectors) so
   *  every detent locks all windows onto sector centres simultaneously. */
  psiDeg: number
  /** Angular half-width, degrees. 2*halfWidth must stay under one sector. */
  halfWidthDeg: number
  /** Radial band centre / half-height, as fractions of the dial radius. */
  rMid: number
  rHalf: number
}

export type VolvelleGeom = {
  mech: 'volvelle'
  /** The page the dial rivets into (and whose frame the hub spins on). */
  side: 'left' | 'right'
  /** Hub (disc centre) distance from the spine along the page run. */
  hubD: number
  /** Hub position along the spine (world z). */
  hubZ: number
  /** Dial radius; rendered as a square quad of side 2*radius carrying circular
   *  die-cut art. The static window card shares the hub + radius. */
  radius: number
  /** Detent count S — the dial clicks into 360/S sectors; the sector art. */
  sectors: number
  /** The die-cut windows in the static card. */
  windows: readonly VolvelleWindow[]
}

/**
 * KNOB-TWIST TOWER (Part D6 "THE HAND"; Birmingham mech 103 "THE HUB" volvelle
 * + mech 59/105 Scotch yoke + mech 90 "the knee") — the book's first
 * USER-DRIVEN fold. A die-cut disc riveted flat INTO the page (the rotor
 * vocabulary: coplanar, one glue layer proud) that the reader TWISTS by angle
 * theta; a hidden paper crank converts the twist into a strip pull that erects
 * a row of N staggered knee towers standing IN the page. PAGE-ROOTED like the
 * tab piece (side + page coordinates), NOT seated on a parent panel. The
 * fold-flat composition a_shown = a(theta) * E(beta) collapses every tier
 * exactly at book-closed for ANY frozen theta, so the coplanar disc holds the
 * user's twist through page turns (the book "remembers" the knob). Pose math
 * lives in book/popup-knobtower.ts (this module is at its size cap). Derived +
 * gate-checked in .superpowers/sdd/bench/derive-knobtower.mjs.
 */
export type KnobTowerGeom = {
  mech: 'knobtower'
  /** The page the assembly stands on (and whose surface carries the disc). */
  side: 'left' | 'right'
  /** Hub (disc centre) distance from the spine along the page run. */
  hubD: number
  /** Hub position along the spine (world z). */
  hubZ: number
  /** Visible disc radius; rendered as a square quad of side 2*discR carrying
   *  circular die-cut art (the alpha cutout makes it a disc). Its spin-swept
   *  corners reach discR*sqrt(2) from the hub. */
  discR: number
  /** Crank pin radius — the strip pull is crankR * (1 - cos theta). Full
   *  erection needs s_full <= 2*crankR (the Scotch-yoke stroke ceiling). */
  crankR: number
  /** Common fore-side hinge for every tier: distance from the spine along the
   *  page. Each tier's mound spans [foreHingeD - 2w, foreHingeD]. */
  foreHingeD: number
  /** The knee tiers, ascending. Each is a mound of leg width `w` at rest lift
   *  `aRestDeg` (below 90), occupying a disjoint z-band
   *  [zc - ridgeLen/2, zc + ridgeLen/2] along the spine. */
  tiers: ReadonlyArray<{
    w: number
    aRestDeg: number
    zc: number
    ridgeLen: number
  }>
  /** Engagement fraction: tier k+1 wakes at this fraction of tier k's rest
   *  lift (default 0.75). Smaller overlaps the cascade and shortens the wind. */
  phiE?: number
  /** Dihedral (deg) the fold-flat envelope normalizes to — the book's rest
   *  bloom. Default 176. */
  restAtDeg?: number
}

/**
 * REMOVABLE KEEPSAKE (Part D6 "THE HAND") — the book's first REMOVABLE piece: a
 * flat die-cut card in a page-internal SLEEVE that the reader pulls clear of the
 * book. PAGE-ROOTED like the tab piece (side + page coordinates); the card
 * slides coplanar with the page (invariant I1) until its trailing edge clears
 * the fore-edge slit, then detaches and settles onto a WORLD-fixed desk seat.
 * The seat rule (law H8, store.ts) guarantees the book only ever turns or
 * closes with the card home. Pose + trajectory math lives in
 * book/popup-keepsake.ts (this module is at its size cap). Derived + gate-
 * checked in .superpowers/sdd/bench/derive-keepsake.mjs.
 */
export type KeepsakeGeom = {
  mech: 'keepsake'
  /** The page the sleeve lives on (and whose fore edge the card exits). */
  side: 'left' | 'right'
  /** Sleeve span along the spine (world z), z0 < z1 — the card's width band. */
  z0: number
  z1: number
  /** Card length along the page run (spine -> fore direction). */
  cardL: number
  /** Grip lip inside the fore edge (default TAB_LIP 0.02). */
  tabLip?: number
  /** The desk seat (WORLD): downstage-center in the clear band between the HTML
   *  columns, tilted toward the camera. `y` defaults to the desk (0); `yawDeg`
   *  swivels the card in the desk plane (default 0). */
  seat: { x: number; y?: number; z: number; tiltDeg: number; yawDeg?: number }
  /** Auto-return duration, ms (default TURN_MS 1250). */
  returnMs?: number
}

/**
 * LIFT-THE-FLAP (E2.2 Batch B; Birmingham mech 94/95 "the lifted flap" + the
 * reader-direct variant) — the book's first numbered DOOR-FLAPS the reader
 * lifts to find keys: the conceit of Chapter I, "The Inn of a Hundred Keys"
 * (spread 2), and its playable (G4). PAGE-ROOTED like the knob tower / volvelle
 * (side + page coordinates, riding the page's own moving frame, NOT seated on a
 * parent panel). A KEY-BOARD plaque riveted coplanar into the page (one glue
 * layer proud) carries a row of numbered door leaves; each leaf is hinged along
 * its SPINE-WARD edge (the hinge axis runs along the spine), lying coplanar one
 * paper thickness above the board at rest (shut) and lifting through a capped
 * arc when the reader grabs its fore edge — uncovering a painted recess (a
 * hanging brass key, or the innkeeper's cat behind one door, the surprise).
 * Each door HOLDS its own reader angle (the book remembers which are open); the
 * shown lift = a_user * E(beta), so E(0) = 0 folds every leaf flat at book
 * close for any held angle (the winch/knobtower persistence law). Pose math
 * lives in book/popup-liftflap.ts (this module is at its size cap). Derived +
 * gate-checked in .superpowers/sdd/bench/derive-liftflap.mjs.
 */
export type LiftFlapDoor = {
  /** Door band along the spine (world z), z0 < z1 — bands are disjoint so the
   *  standing leaves never meet (bench L4). */
  z0: number
  z1: number
  /** What the recess behind this door reveals — selects the -key/-cat art id
   *  suffix. Most doors hide a brass key; one hides the innkeeper's cat. */
  reveal: 'key' | 'cat'
  /** The number stamped on the door's brass plate (1..N). */
  plate: number
}

export type LiftFlapGeom = {
  mech: 'liftflap'
  /** The page the board rivets into (whose frame the leaves hinge on). */
  side: 'left' | 'right'
  /** Shared hinge line: distance from the spine along the page (the doors'
   *  spine-ward edge). */
  hingeD: number
  /** Door leaf length hinge -> fore edge (the door's "height"). */
  leafLen: number
  /** Key-board plaque run band [boardD0, boardD1] (spine -> fore). */
  boardD0: number
  boardD1: number
  /** Key-board plaque spine band [boardZ0, boardZ1] — holds the door row. */
  boardZ0: number
  boardZ1: number
  /** The numbered door leaves, in disjoint z-bands. */
  doors: readonly LiftFlapDoor[]
  /** Max lift, degrees (default 95 — the anti-flip ceiling). */
  liftMaxDeg?: number
  /** The reveal threshold, degrees (default 70 — a door reads open past this). */
  regOpenDeg?: number
  /** Dihedral (deg) the fold-flat envelope normalizes to. Default 176. */
  restAtDeg?: number
}

/**
 * DEPTH VISTA (E2.2 Batch B) — an ALL-WINGS graded tunnel-frame on spread 8 (The
 * Hero's Satchel): N page-rooted parallel-fold FLAP PAIRS, each mirrored to the
 * left + right pages, graded in warmth + scale + depth (near -> mid -> rear) so
 * they frame the satchel hero and their shaped inner-top arcs imply one receding
 * vaulted aperture. Each wing is a SINGLE +z-facing cammed flap (the ch3-skyline
 * form — a die-cut painted plane, DoubleSide alpha), NOT a two-slope prism: on
 * the flat-page reading camera a mound's raw-kraft back reads as scaffolding
 * (the bench's STRUT-SILHOUETTE gate proves it), so a single flap with no kraft
 * riser is the proven form. Page-driven: every flap rises from beta and folds
 * DEAD FLAT at close (rest-lift * envelope, E(0) = 0). Pose math lives in
 * book/popup-depthvista.ts (this module is at its size cap), porting the source-
 * of-truth bench (derive-depthvista.mjs) VERBATIM. Multi-flap + page-driven, so
 * it routes through its own layer renderer (popup-depthvista-layer.tsx), like the
 * skyline.
 */
export type DepthVistaWing = {
  /** Art-id suffix + warmth-grade tag (e.g. 'near' | 'mid' | 'rear'). The flap's
   *  painting is `<layerId>-<key>`, shared by both mirrored sides. */
  key: string
  /** Radial base-inner edge (the hinge) distance from the spine — the flap's
   *  closest approach; F > ~0.42 clears the bag's swept column. */
  F: number
  /** Radial extent of the reader-facing mass (base spans [F, F+width]). */
  width: number
  /** Flap height (how tall it stands); the top leans toward -z so the broad
   *  front face angles up toward the reading camera (a mass, not an edge-on
   *  sliver). */
  height: number
  /** Base depth (world z) — the radial base line's z; the receding grade. */
  zc: number
  /** Rest stand/lean angle, degrees — scaled by the fold-flat envelope E(beta). */
  standDeg: number
}

export type DepthVistaGeom = {
  mech: 'depthvista'
  /** The graded wing configs, front -> back (near first). Each is mirrored onto
   *  both the left + right pages. */
  wings: readonly DepthVistaWing[]
  /** Dihedral (deg) the fold-flat envelope normalizes to. Default 176. */
  restAtDeg?: number
}

/**
 * PULL-TAB DISSOLVE (E2.2 Batch B; Birmingham mech 92 WOVEN DISSOLVE / 93 PANEL
 * DISSOLVE / 119 SHUTTER SCENE) — the book's first paper CROSSFADE: the reader
 * pulls a tab and one picture transmutes into another across a rack of
 * interleaved slats (s5 dunes -> the dragon's gold hoard). PAGE-ROOTED like the
 * volvelle / tab piece (side + page coordinates, riding the page's own moving
 * frame, NOT seated on a parent panel). A page-flat rack of N rigid SLATS, each
 * a ribbon spanning the placard's full spine band, hinged along its spine-ward
 * z-edge; a single reader flip angle tau in [0,PI], shared by every slat (a
 * synchronised venetian), carries image-A up-faces (tau=0) through the edge-on
 * "blinds close" collapse over to image-B up-faces (tau=PI). The pull-strip is
 * the cord: tab draw delta in [0,stroke] maps tau = PI*delta/stroke. Both end
 * states are COPLANAR, so — like the volvelle — it needs no fold-flat envelope;
 * the release snaps tau to a pure end {0,PI}, held through page turns (H4). A
 * pure in-plane translation of flat opaque layers CANNOT cross-fade two
 * pictures (bench D0) — the slats FLIP. Pose + registration math lives in
 * book/popup-dissolve.ts (this module is at its size cap). Derived + gate-
 * checked in .superpowers/sdd/bench/derive-dissolve.mjs.
 */
export type DissolveGeom = {
  mech: 'dissolve'
  /** The page the rack rivets into (whose frame the slats hinge on). */
  side: 'left' | 'right'
  /** Placard band along the page run (spine -> fore), d0 < d1 — the slats stack
   *  across it, one pitch p = (d1 - d0)/slats each. The strip runs on from d1 to
   *  the fore-edge slit at PAGE_W, emerging as the tab. */
  d0: number
  d1: number
  /** Placard band along the spine (world z), z0 < z1 — every slat spans it. */
  z0: number
  z1: number
  /** Slat count N — derive from the camera's angular resolution so each band
   *  still reads as a strip of art (bench D10). */
  slats: number
  /** Tab pull for a full A->B flip (world units; default 0.14). */
  stroke?: number
  /** Visible tab width along the spine (default 0.1). */
  tabW?: number
  /** Turn-time culling (Batch C-3, the dial-class lever): the rack is
   *  interaction-only and page-flat, so mid-turn it stops drawing — the
   *  renderer ramps it out/in over the turn-cull window (turn-cull.ts) and
   *  restores it inside the landing-settle beat. Visual only: no pose,
   *  envelope, or fold-flat proof is touched. */
  turnCull?: boolean
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
  | StripFlapGeom
  | TabPieceGeom
  | KineticArmGeom
  | RotorGeom
  | VolvelleGeom
  | KnobTowerGeom
  | LiftFlapGeom
  | KeepsakeGeom
  | KeepStackGeom
  | KeepWinchGeom
  | KeepSkylineGeom
  | SwarmArcGeom
  | DepthVistaGeom
  | DissolveGeom
  | MFoldRangeGeom
  | OanaveGeom
  | StagedChainGeom

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
  const baseH = geom.baseH ?? 0
  // Bisector frame -> world: X along the bisector (offset by baseH so a
  // stacked story seats on the lower lid), rotated by m about Z.
  const W = (x: number, y: number, z: number): Vec3 => {
    const X = x + baseH
    return [X * cm - y * sm, X * sm + y * cm, z]
  }

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
// Pull-strip erected flap (derive-pullstrip.mjs — see StripFlapGeom).

/** A strip flap's hinge frame on its figure page: u along the page (gutter ->
 *  fore edge), n into the wedge, the hinge axis turned by hingeDeg in the page
 *  plane, `flat` the flap's lie direction when down, and the two hinge ends
 *  h0/h1 about the hinge centre. Shared by the pose solver and the D6 handle
 *  layer (which measures the pointer's angle about this hinge). */
export function stripFlapFrame(
  geom: StripFlapGeom,
  thetaL: number,
  thetaR: number
): { u: Vec3; n: Vec3; hinge: Vec3; flat: Vec3; center: Vec3; h0: Vec3; h1: Vec3 } {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  const hd = rad(geom.hingeDeg ?? 0)
  const hinge: Vec3 = [Math.cos(hd) * u[0], Math.cos(hd) * u[1], Math.sin(hd)]
  const flat = cross(hinge, n) // the flap's lie direction when flat
  const center: Vec3 = [geom.hingeX * u[0], geom.hingeX * u[1], geom.hingeZ]
  const h0 = combine(1, center, -geom.width / 2, hinge)
  const h1 = combine(1, center, geom.width / 2, hinge)
  return { u, n, hinge, flat, center, h0, h1 }
}

/** The strip cam lift (chord law) for dihedral beta, BEFORE the press-and-peel
 *  graze clamp — the flap's page-driven target. The D6 layer eases the reader-
 *  released flap back to this. */
export function stripFlapCamLift(geom: StripFlapGeom, beta: number): number {
  const a = geom.anchor
  const b = geom.slot
  const dz = geom.anchorZ - geom.slotZ
  const strip = (bt: number): number => Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(bt) + dz * dz)
  const shut = strip(0)
  const reach = Math.max(strip(rad(geom.erectAtDeg ?? 176)) - shut, 1e-9)
  const pull = strip(clamp(beta, 0, Math.PI)) - shut
  return Math.acos(clamp(1 - pull / reach, -1, 1))
}

export function solveStripFlapPose(geom: StripFlapGeom, thetaL: number, thetaR: number): MechPose {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  return solveStripFlapPoseAt(geom, stripFlapCamLift(geom, beta), thetaL, thetaR)
}

/**
 * Solves the flap pose at an EXPLICIT requested lift — the D6 user-drive
 * override path (the flap IS the handle, law H3). solveStripFlapPose delegates
 * here with the chord-law cam lift, so the non-interactive pose is bit-
 * identical; the layer passes the reader's pulled or returning lift, clamped
 * to [0, 90deg] (the anti-flip stop). The press-and-peel graze clamp still
 * applies to `liftReq` exactly as before, so nothing ever passes through the
 * facing page.
 */
export function solveStripFlapPoseAt(
  geom: StripFlapGeom,
  liftReq: number,
  thetaL: number,
  thetaR: number
): MechPose {
  const { n, flat, hinge, center, h0, h1 } = stripFlapFrame(geom, thetaL, thetaR)

  // Press-and-peel: early in a turn the strip curve would carry the flap
  // tip through the OTHER page — in paper the tip rests against that page
  // and slides until it peels free. Cap the lift at the graze pose (the
  // largest angle keeping every tip corner inside the dihedral wedge),
  // less a paper-thickness press gap.
  const nuR: Vec3 = [-Math.sin(thetaR), Math.cos(thetaR), 0]
  const nuL: Vec3 = [Math.sin(thetaL), -Math.cos(thetaL), 0]
  const erectAt = (th: number): Vec3 => [
    flat[0] * Math.cos(th) + n[0] * Math.sin(th),
    flat[1] * Math.cos(th) + n[1] * Math.sin(th),
    flat[2] * Math.cos(th) + n[2] * Math.sin(th),
  ]
  const insideWedge = (th: number): boolean => {
    const e = erectAt(th)
    for (const base of [h0, h1]) {
      const tip = combine(1, base, geom.height, e)
      if (dot(tip, nuR) < -1e-12 || dot(tip, nuL) < -1e-12) return false
    }
    return true
  }
  let lift = liftReq
  if (!insideWedge(lift)) {
    let lo = 0
    let hi = lift
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      if (insideWedge(mid)) lo = mid
      else hi = mid
    }
    lift = Math.max(0, lo - 0.002)
  }
  const erect = erectAt(lift)

  // Two coplanar half-quads split at the center so the standard two-panel
  // renderer draws it with a seamless (invisible) center line.
  return {
    right: parallelogram(center, [h1[0] - center[0], h1[1] - center[1], h1[2] - center[2]], 1, erect, geom.height),
    left: parallelogram(center, [h0[0] - center[0], h0[1] - center[1], h0[2] - center[2]], 1, erect, geom.height),
    split: 0.5,
    apex: center,
    crease: erect,
    glueR: hinge,
    glueL: [-hinge[0], -hinge[1], -hinge[2]],
  }
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
    case 'stripflap':
      return solveStripFlapPose(geom, thetaL, thetaR)
    case 'kinetic':
      // Two-panel moving arm — MechPose (ARM + FLAP), math in popup-kinetic.
      return solveKineticArmPose(geom, thetaL, thetaR)
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
    case 'tabpiece':
      throw new Error('storybook: tab pieces are multi-patch — use solveTabPiecePose (popup-tabpiece)')
    case 'rotor':
      throw new Error('storybook: rotors ride a solved parent surface — use solveRotorPose (popup-rotor)')
    case 'volvelle':
      throw new Error('storybook: volvelle layers are multi-patch + user-driven — use solveVolvellePose (popup-volvelle)')
    case 'liftflap':
      throw new Error('storybook: lift-flap layers are multi-patch + user-driven — use solveLiftFlapPose (popup-liftflap)')
    case 'knobtower':
      throw new Error('storybook: knob-tower layers are multi-patch + user-driven — use solveKnobTowerPose (popup-knobtower)')
    case 'keepsake':
      throw new Error('storybook: keepsake layers are removable + trajectory-driven — use keepsakeCardInPlane (popup-keepsake)')
    case 'keepstack':
      throw new Error('storybook: keepstack layers expand to N stacked box poses — use solveKeepStackPose (popup-keepstack)')
    case 'keepwinch':
      throw new Error('storybook: keepwinch layers are multi-output + user-driven — use solveKeepWinchPose (popup-keepwinch)')
    case 'skyline':
      throw new Error('storybook: skyline layers are multi-mound — use solveKeepSkylinePose (popup-skyline)')
    case 'swarmarc':
      throw new Error('storybook: swarmarc layers are multi-strut + user-stirred — use solveSwarmArcPose (popup-swarmarc)')
    case 'depthvista':
      throw new Error('storybook: depth-vista layers are multi-patch (arches + wings) — use solveDepthVistaPose (popup-depthvista)')
    case 'dissolve':
      throw new Error('storybook: dissolve layers are multi-patch + user-driven — use solveDissolvePose (popup-dissolve)')
    case 'mfoldrange':
      throw new Error('storybook: range layers are multi-rank — use solveMFoldRangePose (popup-mfoldrange)')
    case 'stagedchain':
      throw new Error('storybook: staged-chain layers are multi-storey with per-joint cams — use solveStagedChainPose (popup-stagedchain)')
    case 'oanave':
      // The nave rank's HOST is the shipped v-fold wall solver verbatim; the
      // dihedral-slaved relief strata are extra patches (oanavePatches in
      // popup-oanave.ts) that never leave the host silhouette — so the host
      // pose IS the piece's two-panel pose for sweep/motion/mount purposes.
      return solveVFoldPose(
        {
          mech: 'vfold',
          apexZ: geom.apexZ,
          vDir: geom.vDir,
          phiDeg: geom.phiDeg,
          rhoDeg: geom.rhoDeg,
          width: geom.width,
          height: geom.height,
        },
        thetaL,
        thetaR
      )
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

/**
 * A spread's turn role derived from the FRAME-LOOP clock (the driver's
 * committedSpread ref + the in-flight dir), never from React render state.
 * The React-prop version of this value arrives one commit late at a turn's
 * completion: the driver nulls its frame ref inside the same rAF that calls
 * completeTurn(), but a prop still saying 'outgoing' meets that null frame
 * as spreadPageAngles(role, null, 0) = dihedral PI — the whole outgoing
 * scene popping fully open for however many frames React needs to catch up
 * (the commit-time page flash). Every pose consumer derives its role from
 * this function inside useFrame so role and dihedral tick on one clock.
 */
export function liveSpreadRole(
  spreadIndex: number,
  committedSpread: number,
  dir: TurnDir | null
): SpreadRole | 'hidden' {
  if (dir === null) return spreadIndex === committedSpread ? 'current' : 'hidden'
  if (spreadIndex === committedSpread) return 'outgoing'
  const incoming = committedSpread + (dir === 'next' ? 1 : -1)
  return spreadIndex === incoming ? 'incoming' : 'hidden'
}

// ---------------------------------------------------------------------------
// Tilted (bulge) gearing — derive-bulge.mjs theorems A16-A20. The book never
// opens dead flat: each spread rests at (PI - aL, aR) from its per-side
// stack heights (page-geometry's restAngles), and the sheet sweeps between
// the exact planes it lifts out of and lands as (A16 hand-off coincidence —
// the invariant that keeps turn endpoints flicker-free under tilt).

/** The moving sheet's tilted sweep for the turn leaving `committedSpread`
 *  in `dir`: from the plane it lifts out of to the plane it lands as. */
export function sheetSweepTilted(
  dir: TurnDir,
  committedSpread: number
): { from: number; to: number } {
  if (dir === 'next') {
    return {
      from: restAngles(committedSpread).aR,
      to: Math.PI - restAngles(committedSpread + 1).aL,
    }
  }
  return {
    from: Math.PI - restAngles(committedSpread).aL,
    to: restAngles(committedSpread - 1).aR,
  }
}

/** Tilted replacement for `sheetAngle`: same eased clock, endpoint planes
 *  from the rest poses instead of hard 0/PI. */
export function sheetAngleTilted(dir: TurnDir, easedT: number, committedSpread: number): number {
  const { from, to } = sheetSweepTilted(dir, committedSpread)
  return from + (to - from) * clamp(easedT, 0, 1)
}

/**
 * Tilted replacement for `spreadPageAngles`, role derived internally from
 * the frame-loop pair (one clock). Static planes wear their OWN spread's
 * rest tilt, which encodes the two re-tilt moments exactly: the side that
 * LOSES the flying sheet re-tilts at lift-off (its stack is already one
 * sheet shorter — the outgoing spread's static side keeps the OLD tilt,
 * the incoming spread's shows the NEW one), and the side that GAINS it
 * re-tilts at commit, hidden under the just-landed sheet. Hidden/current
 * spreads sit at their rest pose (A18: still blooming, dihedral ~176 deg).
 */
export function spreadPageAnglesTilted(
  spreadIndex: number,
  committedSpread: number,
  dir: TurnDir | null,
  easedT: number
): { thetaL: number; thetaR: number } {
  const role = liveSpreadRole(spreadIndex, committedSpread, dir)
  const rest = restAngles(spreadIndex)
  if (dir !== null && isCoverPair(committedSpread, dir)) {
    // Cover turn: only spread 1 has skin in it — its pop-ups gear to the
    // cover board and the relaxing title page, not to a flying sheet.
    return spreadIndex === 1
      ? coverSpreadAngles(dir, easedT)
      : { thetaL: Math.PI - rest.aL, thetaR: rest.aR }
  }
  if (dir === null || role === 'current' || role === 'hidden') {
    return { thetaL: Math.PI - rest.aL, thetaR: rest.aR }
  }
  const theta = sheetAngleTilted(dir, easedT, committedSpread)
  if (dir === 'next') {
    // Sheet lifts off the right stack, lands as the incoming left page.
    return role === 'outgoing'
      ? { thetaL: Math.PI - rest.aL, thetaR: theta }
      : { thetaL: theta, thetaR: rest.aR }
  }
  // 'prev': sheet lifts off the left stack, lands as the incoming right page.
  return role === 'outgoing'
    ? { thetaL: theta, thetaR: rest.aR }
    : { thetaL: Math.PI - rest.aL, thetaR: theta }
}

// ---------------------------------------------------------------------------
// Cover-turn gearing. A cover turn is NOT a sheet turn: the board itself is
// the moving left plane, and the right plane is the TITLE PAGE riding the
// top of the page block while the block's spine side relaxes from the shut
// slab down into the gutter valley (book.tsx's block morph — a real book's
// binding relaxes as the cover opens). Everything is geared to the single
// eased open fraction the cover board itself rotates by.

/** True when the frame-loop pair describes a cover turn (spread 0 <-> 1) —
 *  the pure-math twin of use-turn-driver's isCoverTurn, keyed off the same
 *  committed spread the driver mirrors. */
export const isCoverPair = (committedSpread: number, dir: TurnDir | null): boolean =>
  (committedSpread === 0 && dir === 'next') || (committedSpread === 1 && dir === 'prev')

/**
 * Spread 1's page angles during a cover turn, from the eased progress:
 * thetaL is the cover board's own rotation (its inner face carries the
 * endpaper — spread 1's left page), thetaR the title page lying on the
 * relaxing block: asin(sheetStack * open / PAGE_W), which at open = 1 is
 * EXACTLY restAngles(1).aR — the hand-off to the rest pose is coincident
 * by construction, the cover-turn twin of the A16 sweep invariant.
 */
export function coverSpreadAngles(dir: TurnDir, easedT: number): { thetaL: number; thetaR: number } {
  const e = clamp(easedT, 0, 1)
  const open = dir === 'next' ? e : 1 - e
  return {
    thetaL: Math.PI * open,
    thetaR: Math.asin((INTERIOR_SHEETS * SHEET_STACK_T * open) / PAGE_W),
  }
}
