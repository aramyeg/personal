/**
 * THE CARRIER SWARM (E3 s3, new family 'swarmarc') — a horseshoe vortex of
 * graded hairline struts, each carrying one tiny courier (bee / envelope /
 * parcel), wheeling around the ch2 hero. Bench-proven in
 * .superpowers/sdd/bench/e3s3-swarmarc.mjs (S1–S7); spec
 * .superpowers/sdd/scenes/s3-scene-pack.md.
 *
 * FAMILY MODEL (per strut, single rigid hinge, page-riding). Each strut is ONE
 * rigid die-cut: hairline strut (width 0.010, length L) + rider silhouette of
 * radius r beyond the tip (L_eff = L + r), glued to ONE page at radial anchor
 * distance F from the spine at depth z0, hinge line RADIAL (along the page's
 * fore-edge direction). Flat pose lies along +z (downstage); deploy angle a
 * about the hinge lifts the run off the page along the page normal:
 *   point(d, rho) = d·u + rho·sin(a)·n + (z0 + rho·cos(a))·ẑ.
 *
 * WHY FULL DEPLOY IS LEGAL THROUGH THE TURN (the family's load-bearing fact):
 * the per-vertex page-turn step is pure page sweep = R·dθ (ch3 skyline law),
 * R = max vertex distance from the spine axis. For a +z-flat radial-hinge
 * strut R(a) = √(F² + (L_eff·sin a)²), monotone in a, and R(0) = F — the flat
 * pose adds only z, which the spine axis ignores. R(aRest) ≤ 0.75 for every
 * strut in the table ⇒ no staged envelope; q(0)=0 free via the house E(beta).
 * Corollary: tall struts anchor near the gutter, tips never pass |x| ≈ 0.75 —
 * the radius wall itself shapes the vortex (high crown at the spine, low wide
 * limbs). Grammar and kinematics are the same statement.
 *
 * WAVE-STAGGERED DEPLOY (M1-lawful): strut i erects inside its own eased
 * window a_i(E) = aRest_i · smoothstep(b0_i, b0_i + 0.38, E) with
 * b0_i = 0.18 + 0.42·w_i, wave key w_i = (150 − |θ_i|)/140 (outriders slightly
 * before the front ends; crown last; all full by E = 0.98; monotone; a(0)=0
 * exactly since E(0)=0). Opening the page pours the swarm out of the hive.
 *
 * STIR THE SWARM (user tab, drive channel `ch2-swarm~stir`): stroke
 * s ∈ [0, stroke] rocks the right-arm STIR struts by
 * Δa_k(s) = deg° · sin(π · clamp(crest·s/stroke − phaseStep·k, 0, 1)), k = rank
 * from the tab inward — a ripple that runs up the arm. The SHOWN angle is
 * (aRest·W_i(E) + Δa_k(s)) · gated by E via the liftflap persistence law (user
 * state × envelope): both terms carry the envelope, so fold-flat survives any
 * held stir state.
 *
 * E3 WAVE-2 RETUNE (blind reader s3, finding 1 + the ledger's STIR PAYOFF item).
 * The tab was proven live end to end and STILL read as dead, because the shipped
 * ripple was invisible at reading distance: deg 12 over phaseStep 0.12 moved the
 * furthest rider 17.5 screen px and the tab-nearest rider EXACTLY 0 px at full
 * stroke (clamp hits 1, sin π = 0 — the wave had already run off the end of the
 * arm by the time the reader finished pulling). Three derived changes, measured
 * at the pinned reading camera in popup-swarmarc-scene.test.ts:
 *   deg 12 -> 38        peak rider travel 17.5 px -> 37 px
 *   phaseStep 0.12 -> 0.20   the four ranks separate into a readable wave
 *   crest (NEW, 0.8)    at full stroke rank 0 sits at sin(0.8π), not sin(π):
 *                       every member of the arm is displaced at s = max, so the
 *                       s=0 / s=max capture pair differs everywhere along it
 *                       (18 / 31 / 32 / 36 px) instead of at one strut.
 */

import type { PanelQuad, Vec3 } from './popup-mechanics'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180

const DEFAULT_REST_DEG = 176

/** One swarm strut: a single rigid die-cut (hairline strut + rider) hinged on
 *  ONE page along a radial line. `F` = radial anchor distance from the spine
 *  (≥ 0.10, the glue-lane keep-out), `z0` the hinge depth, `L` the strut
 *  length to the rider center, `r` the rider silhouette radius beyond the tip
 *  (reach L_eff = L + r), `aRestDeg` the rest deploy angle, `wave` the stagger
 *  key w (b0 = 0.18 + 0.42·w), `stir` the ripple rank from the tab inward
 *  (−1 = not a stir member), `sprite` the atlas cell its rider samples,
 *  `flip` a u-mirror so no two neighbors share sprite+flip, `swatch` which of
 *  the three hairline-stalk swatches the strut samples (0 reed / 1 twine /
 *  2 twig — the s3 blind reader read ~25 identical pale sticks as a picket
 *  fence, so the stalks themselves now vary). */
export type SwarmStrut = {
  side: 'left' | 'right'
  F: number
  z0: number
  L: number
  r: number
  aRestDeg: number
  wave: number
  stir: number
  sprite: number
  flip: boolean
  swatch: number
}

export type SwarmStirSpec = {
  side: 'left' | 'right'
  /** Full tab stroke in world units (drive domain [0, stroke]). */
  stroke: number
  /** Peak ripple amplitude in degrees. */
  deg: number
  /** Phase lag per rank (fraction of the normalized stroke). */
  phaseStep: number
  /** How far along its own half-wave rank 0 has travelled at FULL stroke
   *  (default 1 = the wave runs clean off the arm and rank 0 returns to rest,
   *  which is why the shipped ripple showed zero travel on the strut the
   *  reader's eye was already on). < 1 leaves every rank displaced at s = max. */
  crest?: number
}

export type SwarmArcGeom = {
  mech: 'swarmarc'
  struts: readonly SwarmStrut[]
  /** Hairline strut die-cut width (world units, 0.010). */
  strutW: number
  stir: SwarmStirSpec
  /** Dihedral (deg) the fold-flat envelope normalizes to. Default 176. */
  restAtDeg?: number
}

/** Page-openness envelope E(beta) — the shared fold-flat cam (E(0)=0 exact). */
export function swarmArcEnvelope(geom: SwarmArcGeom, beta: number): number {
  const rest = rad(geom.restAtDeg ?? DEFAULT_REST_DEG)
  const u = clamp(Math.sin(beta / 2) / Math.sin(rest / 2), 0, 1)
  return Math.sin((u * Math.PI) / 2)
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Normalized page openness s = beta / betaRest, clamped to [0, 1] — the
 *  wave's clock. s(0) = 0 exactly (fold-flat), s(rest) = 1. */
export function swarmOpenness(geom: SwarmArcGeom, beta: number): number {
  return clamp(beta / rad(geom.restAtDeg ?? DEFAULT_REST_DEG), 0, 1)
}

/** Wave-window deploy fraction for wave key `w` at openness `s`: smoothstep
 *  over [c0, 1], c0 = 0.34·w (outriders w < 0 floor at 0).
 *  DERIVED CHANGE vs the pack's §3 windows a_i(E) = smoothstep(b0, b0+0.38, E):
 *  the wave clock is the DIHEDRAL FRACTION s = beta/rest, not the envelope E,
 *  and every window closes at s = 1. Two house gates forced this, both
 *  measured against the real code:
 *  (1) A10 wedge containment — a strut anchored near the gutter subtends a
 *      spine angle atan(L_eff·sin a / F_inner) far LARGER than its deploy
 *      angle a (the crown: F−r ≈ 0.079 vs reach 0.61 → 83° at full deploy).
 *      E(beta) front-loads deploy into NARROW wedges (E(60°) = 0.70), so
 *      E-clocked crown struts pierced the moving page mid-close (measured
 *      poke 0.06°–10°+). Clocking on s keeps a(beta) growing no faster than
 *      the wedge itself opens: worst crown spine-angle 47° inside an 82.5°
 *      wedge.
 *  (2) D-G5 Gate 2 — 0.38-wide E-windows quadruple the deploy rate and land
 *      the crown's window on easeTurnWeighted's peak-speed station (measured
 *      step 0.075 > 0.0497 cap); s-clocked windows spread deploy across the
 *      turn's back two-thirds where the eased clock decelerates (measured
 *      worst combined step ~0.033).
 *  The pour SURVIVES: starts staggered by w (outriders/front limbs first,
 *  crown last), per-strut monotone, q(0) = 0 exact, all full at rest and
 *  ≥ 0.99 by s = 0.98. */
export function swarmWaveWindow(w: number, s: number): number {
  const c0 = Math.max(0, 0.34 * w)
  return smoothstep(c0, 1, s)
}

/** Stir ripple delta (deg) for rank `k` at tab stroke `s` (§3 formula, plus the
 *  Wave-2 `crest` limiter — see the module header). */
export function swarmStirDelta(spec: SwarmStirSpec, k: number, s: number): number {
  if (k < 0) return 0
  const crest = spec.crest ?? 1
  return spec.deg * Math.sin(Math.PI * clamp((crest * s) / spec.stroke - spec.phaseStep * k, 0, 1))
}

/** The strut's SHOWN deploy angle (radians) at dihedral `beta` and tab stroke
 *  `stirS` — the liftflap persistence composition: the wave term rides the
 *  openness clock s(beta) and the user ripple rides the envelope E(beta),
 *  both exactly 0 at beta = 0, so a(0) = 0 for ANY held stir state
 *  (fold-flat law). */
export function swarmDeployAngle(geom: SwarmArcGeom, strut: SwarmStrut, beta: number, stirS: number): number {
  const restTerm = rad(strut.aRestDeg) * swarmWaveWindow(strut.wave, swarmOpenness(geom, beta))
  const stirTerm = rad(swarmStirDelta(geom.stir, strut.stir, stirS)) * swarmArcEnvelope(geom, beta)
  return restTerm + stirTerm
}

/** Spine-axis radius R(a) = √(F² + (L_eff·sin a)²) — the page-turn step is
 *  R·dθ (pure page sweep). Monotone in a; R(0) = F. */
export function swarmStrutRadius(strut: SwarmStrut, aDeg: number): number {
  const reach = (strut.L + strut.r) * Math.sin(rad(clamp(aDeg, 0, 90)))
  return Math.hypot(strut.F, reach)
}

/** The carrying page's own moving frame (u toward the fore edge, n the page
 *  normal into the wedge) — identical to the skyline's pageFrame. */
function pageFrame(side: 'left' | 'right', thetaL: number, thetaR: number): { u: Vec3; n: Vec3 } {
  const t = side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  return { u, n }
}

/** How far SHORT of the rider's centre the opaque hairline stalk now stops, in
 *  units of the rider radius r. The rider quad still spans rho ∈ [L−r, L+r]
 *  (reach, radius wall and every containment proof are untouched — this only
 *  shortens the stalk), but the stalk used to run all the way to rho = L, i.e.
 *  to the rider sprite's exact CENTRE, and the s3 blind reader's first reading
 *  of the result was "bees skewered on sticks" / "bee lollipops". Stopping at
 *  rho = L − 0.30·r lands the stalk tip at 35% of the sprite cell's height,
 *  measured from the cell's foot edge; the atlas paints each courier's body in
 *  the cell's upper 60% with a hairline FLIGHT THREAD continuing the stalk up
 *  to its belly, so the die stays ONE continuous cut (no floating alpha island,
 *  paper truth intact) while the bee reads as hovering at the top of a thread
 *  rather than impaled on the middle of a pole. */
export const SWARM_RIDER_SEAT = 0.3

export type SwarmStrutPose = {
  /** Hairline strut quad [foot-in, foot-out, tip-out, tip-in] (u across width, v foot→tip). */
  strut: PanelQuad
  /** Rider quad (2r × 2r about the strut tip), same corner/uv order. */
  rider: PanelQuad
  /** Shown deploy angle (radians). */
  a: number
}

/** One strut's posed quads at the current dihedral, optional tab stroke. */
export function solveSwarmStrut(
  geom: SwarmArcGeom,
  strut: SwarmStrut,
  thetaL: number,
  thetaR: number,
  stirS = 0
): SwarmStrutPose {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const a = swarmDeployAngle(geom, strut, beta, stirS)
  const { u, n } = pageFrame(strut.side, thetaL, thetaR)
  const sa = Math.sin(a)
  const ca = Math.cos(a)
  const P = (d: number, rho: number): Vec3 => [
    d * u[0] + rho * sa * n[0],
    d * u[1] + rho * sa * n[1],
    strut.z0 + rho * ca,
  ]
  const hw = geom.strutW / 2
  const L = strut.L
  const r = strut.r
  // the stalk stops short of the rider's centre (SWARM_RIDER_SEAT) so the
  // courier hovers at the head of a painted thread instead of on a spike
  const stalk = L - r * SWARM_RIDER_SEAT
  const strutQuad: PanelQuad = [
    P(strut.F - hw, 0),
    P(strut.F + hw, 0),
    P(strut.F + hw, stalk),
    P(strut.F - hw, stalk),
  ]
  const rider: PanelQuad = [
    P(strut.F - r, L - r),
    P(strut.F + r, L - r),
    P(strut.F + r, L + r),
    P(strut.F - r, L + r),
  ]
  return { strut: strutQuad, rider, a }
}

/** Every strut's posed quads for the renderer. */
export function solveSwarmArcPose(
  geom: SwarmArcGeom,
  thetaL: number,
  thetaR: number,
  stirS = 0
): readonly SwarmStrutPose[] {
  return geom.struts.map((s) => solveSwarmStrut(geom, s, thetaL, thetaR, stirS))
}

/** STIR tab die-cut footprint on its page (world units, page-flat). Lives here
 *  rather than in the layer so the drag-regression bench can aim a ray at the
 *  handle the reader actually sees.
 *
 *  E3 WAVE-2 REBUILD (blind reader s3, findings 4 + BW-13). The shipped tab was
 *  0.12 x 0.12 at d0 1.0, which projects to 57 x 34 screen px at the pinned
 *  camera — "cap height ~4px; nearest-neighbour zoom shows two rows of grey
 *  mush", and parked alone in the emptiest corner of the composition. Worse, a
 *  world-SQUARE page-flat quad foreshortens to a 1.7:1 screen parallelogram, so
 *  the 1:1 atlas region it sampled was being stretched 1.7x horizontally —
 *  half of why the lettering was illegible even before the size.
 *  Rebuilt as 0.30 (radial) x 0.32 (z) at d0 0.82: 145 x 85 screen px centred
 *  at (1243, 599), i.e. 6.4x the area, and seated right beside the right arm of
 *  the ring it drives (the arm's front anchors run x 0.35..0.65, z 0.20..0.27)
 *  instead of out in the bare corner. Its atlas region moves to a 5x3 cell
 *  block (aspect 1.667 ≈ the 1.71 screen aspect), so letterforms land
 *  unstretched. Still fully inside the page at rest (d1 1.12 < PAGE_W 1.15) and
 *  still clear of the fringe die (|x| <= 0.6) and the printed compass yard
 *  (radial 0.62), both inboard of d0. */
export const SWARM_TAB_D0 = 0.82
export const SWARM_TAB_W = 0.3
export const SWARM_TAB_Z0 = 0.14
export const SWARM_TAB_Z1 = 0.46
export const SWARM_TAB_Y_LIFT = 0.003

/**
 * HAND-TO-STROKE GEARING — world units of stroke per world unit of pointer
 * travel along the page's fore axis. The layer's drive line reads
 * `sUser = sGrabStart + (dNow - dGrab) * SWARM_STIR_GEAR`.
 *
 * WHY IT IS NOT 1 (s3 round-2, "the stroke saturates in under 90px of hand
 * motion; a satisfying pull should span ~200px+"). Ungeared, the projector's
 * scalar IS the page-plane distance the pointer covers, so the whole 0.14 stroke
 * was spent in a thumb-twitch — measured through the real projector at the
 * pinned reading camera, 58 reference px along the axis of steepest response and
 * 64 px along the axis the tab visibly slides. A pull strip that bottoms out
 * that fast reads as a switch, not as something drawn out of a page.
 *
 * 0.26 buys 210 px / 248 px on those same two measurements (gesture-axis.test.ts
 * benches both by bisecting the real pipeline, so the numbers cannot drift from
 * the code), inside the 200-260 px window a full-arm pull wants. Nothing
 * downstream sees it: the drive domain is still [0, stroke], so every solver
 * proof, the fold-flat envelope and the `?sbdrive=<id>~stir:<s>` capture override
 * are untouched — this only changes how much hand buys a given s.
 */
export const SWARM_STIR_GEAR = 0.26

/** The STIR pull tab's quad at stroke `s`: it rides its page at the fore edge
 *  and slides out by exactly s·E(beta) (Birmingham 84 pull-strip grammar).
 *  Position-only — the quad lies IN the page plane, so fold-flat containment
 *  is trivial. */
export function swarmStirTabQuad(
  geom: SwarmArcGeom,
  s: number,
  thetaL: number,
  thetaR: number
): PanelQuad {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const { u, n } = pageFrame(geom.stir.side, thetaL, thetaR)
  const d0 = SWARM_TAB_D0 + clamp(s, 0, geom.stir.stroke) * swarmArcEnvelope(geom, beta)
  const d1 = d0 + SWARM_TAB_W
  const P = (d: number, z: number): Vec3 => [
    d * u[0] + SWARM_TAB_Y_LIFT * n[0],
    d * u[1] + SWARM_TAB_Y_LIFT * n[1],
    z,
  ]
  return [P(d0, SWARM_TAB_Z1), P(d1, SWARM_TAB_Z1), P(d1, SWARM_TAB_Z0), P(d0, SWARM_TAB_Z0)]
}

/** Every world-space quad the swarm poses (strut + rider per member) — for
 *  the collision / motion / depth dispatchers. */
export function swarmArcQuads(geom: SwarmArcGeom, thetaL: number, thetaR: number): PanelQuad[] {
  const out: PanelQuad[] = []
  for (const pose of solveSwarmArcPose(geom, thetaL, thetaR)) {
    out.push(pose.strut, pose.rider)
  }
  return out
}

// ---------------------------------------------------------------------------
// RING GENERATION — the bench constants verbatim (e3s3-swarmarc.mjs). The
// content entry regenerates the 28-strut table from these rather than pasting
// 28 rows; the unit suite gates the output against the pack's spot values.
// ---------------------------------------------------------------------------

const RX = 0.66
const ZC = 0.05
const RZ = 0.35
const Y0 = 0.12
const YA = 0.49
const YEXP = 2.1
const YSKEW = 0.04
const A0 = 57
const A1 = 21
const R0 = 0.052
const R1 = 0.016
/** E3 WAVE-2 THINNING (blind reader s3, finding 8): 12 struts a side put ~25
 *  near-identical pale stalks across the ground and the reader called the middle
 *  ground "a picket fence of vertical sticks — visual noise that flattens the
 *  whole field into wallpaper". 9 a side (18 ring + 4 outriders = 22 pieces)
 *  opens the plan spacing by a third; the multiplicity the ring gave up is paid
 *  back by the painted swarm on the backdrop and the printed floor couriers,
 *  which cost no radius margin at all. */
const N_SIDE = 9
const TH_MIN = 10
const TH_MAX = 150
/** Ring thetas that the stir tab rocks (right page, θ ≥ 97° — the 4 outermost
 *  right-arm members; with N_SIDE 9 the next one in is 0.31 long and would need
 *  the ripple amplitude cut in half to stay inside the radius wall). */
const STIR_MIN_THETA = 97
/** Outriders erect just before the front ends (wave floor clamps b0 at 0). */
const OUTRIDER_WAVE = -0.05
const SPRITE_COUNT = 16
const SPRITE_STRIDE = 7 // coprime with 16 → consecutive struts never share a cell
const SWATCH_COUNT = 3 // reed / twine / twig hairline stalks

/** DETERMINISTIC RING DETUNE (E3 Wave-2, same finding 8). The ring's laws are
 *  smooth in θ, which is what makes the vortex read as ONE wheeling sweep — and
 *  is also what made every stalk look machined to the same pattern. Each strut
 *  therefore carries a bounded, index-keyed detune (a pure sine of the ring
 *  index: no RNG anywhere near the engine, so the table stays byte-stable):
 *    θ  ± 2.8°       uneven plan spacing — kills the picket RHYTHM
 *    y  0 .. −7%     height wobble on top of the graded crest
 *    a  0 .. +9°     the stalks stop being parallel (neighbours lean up to 9° apart)
 *  The two SIGNED-ONE-WAY terms are signed one way for a measured reason, not
 *  for tidiness. A strut's hinge depth is z0 = z − L·cos(a) with L = y/sin(a), so
 *  a TALLER or a FLATTER strut plants its foot further upstage, toward the
 *  backdrop wall. Two-sided jitter (±6% y, ±6° a) pushed the D-G2 near-rest
 *  ratchet for spread 3 from 8 illegal brushes to 9 (a crown strut and the
 *  backdrop panel, plus a strut and the right cut-paper cloud, at the landing
 *  tail β 168–170°). Shortening-only y and straightening-only a move every foot
 *  DOWNSTAGE instead, and the count lands back on 8 with the variety kept.
 *  The remaining ceiling is the S4 vortex-coherence gate (curvature-sign flips
 *  along the projected tip chain): at y −10% the chain reads as a ragged scatter
 *  rather than one arc (measured 4 flips, gate ≤ 2); at −7% it is 0. */
const TH_JIT_DEG = 2.8
const Y_JIT = 0.07
const A_JIT_DEG = 9
const detune = (index: number, k: number, phase: number): number => Math.sin(index * k + phase)

function ringStrut(thetaNom: number, side: 'left' | 'right', index: number): SwarmStrut {
  const sideSign = side === 'left' ? -1 : 1
  const thetaDeg = clamp(thetaNom + TH_JIT_DEG * detune(index, 2.399, 0.7), TH_MIN, TH_MAX)
  const th = rad(thetaDeg)
  const c = 0.5 + 0.5 * Math.cos(th)
  const x = RX * Math.sin(th)
  const z = ZC - RZ * Math.cos(th)
  const y =
    (Y0 + YA * Math.pow(c, YEXP) + YSKEW * sideSign * Math.sin(th)) *
    (1 - Y_JIT * 0.5 * (1 + detune(index, 1.723, 2.1)))
  const aRest = A0 + A1 * c + A_JIT_DEG * (0.5 + 0.5 * detune(index, 2.917, 1.3))
  const r = R0 - R1 * c
  const L = y / Math.sin(rad(aRest))
  const z0 = z - L * Math.cos(rad(aRest))
  const stirred = side === 'right' && thetaDeg >= STIR_MIN_THETA
  // Ripple rank counts from the TAB (fore edge, θ = 150°) inward.
  const stir = stirred ? Math.round(((TH_MAX - thetaDeg) * (N_SIDE - 1)) / (TH_MAX - TH_MIN)) : -1
  return {
    side,
    F: x,
    z0,
    L,
    r,
    aRestDeg: aRest,
    wave: (TH_MAX - thetaDeg) / 140,
    stir,
    sprite: (index * SPRITE_STRIDE) % SPRITE_COUNT,
    flip: index % 2 === 1,
    swatch: index % SWATCH_COUNT,
  }
}

function outriderStrut(
  x: number,
  y: number,
  z: number,
  aRestDeg: number,
  r: number,
  index: number
): SwarmStrut {
  const L = y / Math.sin(rad(aRestDeg))
  const z0 = z - L * Math.cos(rad(aRestDeg))
  return {
    side: x < 0 ? 'left' : 'right',
    F: Math.abs(x),
    z0,
    L,
    r,
    aRestDeg,
    wave: OUTRIDER_WAVE,
    stir: -1,
    sprite: (index * SPRITE_STRIDE) % SPRITE_COUNT,
    flip: index % 2 === 1,
    swatch: index % SWATCH_COUNT,
  }
}

/** The full 22-member swarm: 18 ring struts ordered θ −150° → +150° (left arm
 *  front→crown, right arm crown→front), then the 4 outrider strays. Matches
 *  the bench table e3s3-swarmarc.mjs row for row. */
export function buildSwarmStruts(): readonly SwarmStrut[] {
  const thetas = Array.from({ length: N_SIDE }, (_, i) => TH_MIN + (i * (TH_MAX - TH_MIN)) / (N_SIDE - 1))
  const leftArm = [...thetas].reverse().map((t, i) => ringStrut(t, 'left', i))
  const rightArm = thetas.map((t, i) => ringStrut(t, 'right', N_SIDE + i))
  const outriders = [
    outriderStrut(-0.73, 0.1, 0.42, 56, 0.05, 2 * N_SIDE),
    outriderStrut(-0.7, 0.14, 0.16, 58, 0.048, 2 * N_SIDE + 1),
    outriderStrut(0.73, 0.09, 0.44, 56, 0.05, 2 * N_SIDE + 2),
    outriderStrut(0.71, 0.13, 0.2, 58, 0.048, 2 * N_SIDE + 3),
  ]
  return [...leftArm, ...rightArm, ...outriders]
}
