import { hitPadFor, rayBoxHit } from './desk-nudge'

/** Compile-time literal formatting for every chunk in this file (measurements → GLSL). */
const f = (v: number): string => v.toFixed(5)

/**
 * THE DESK'S DEEP TIER (Task 92) — set-piece interactions, one per prop, built on the micro-tier's
 * law (`desk-nudge.ts`) and adding nothing to it: pointer-initiated, deterministic closed forms of
 * the trigger sequence on an armed clock, always decaying to the authored rest, exact-zero guarded
 * so a pointerless scrub is bit-identical to a build without the feature, inert under reduced
 * motion. This module is the PURE half — constants, closed forms, zone geometry, shader chunk text —
 * and `desk-deep-interactions.tsx` is the plumbing. `desk-deep.test.ts` drives THIS file without a
 * canvas and holds the zone to the shipped GLB.
 *
 * ============================================================================
 * ONE OWNER PER VERTEX (the composition law, T91 §3)
 * ============================================================================
 * A vertex has at most one deep owner; micro and deep may share an object only on disjoint vertex
 * sets or composed transforms ordered deep-then-micro. The coffee stir touches only the liquid
 * disc — a DeskGloss component the mug's micro zone deliberately does not register (see
 * `DESK_NUDGE_ZONES`), so a simultaneous mug rock and coffee stir move disjoint vertex sets by
 * construction.
 */

// --- the coffee stir ---------------------------------------------------------

/**
 * Click the liquid and it spins: damped angular velocity ω(τ) = ω0·e^(−λτ), total turn
 * θ(τ) = θacc + (ω0/λ)(1 − e^(−λτ)) — both closed forms, no integration. The surface dips into a
 * shallow vortex paraboloid ∝ ω² and a faint cream spiral shears tighter as θ grows (differential
 * rotation: the centre has turned further than the rim, so an initially radial streak winds into
 * an archimedean spiral all by itself). Zero GLB bytes, zero draw calls: two shader chunks on the
 * material the disc already ships in.
 */
export const STIR = {
  /** rad/s the liquid picks up from one full click — 9.4 rad ≈ 1.5 turns over the whole settle. */
  omega0: 15.0,
  /** 1/s. Dip (∝ ω²) is under 2% by 1.4 s — the T91 arc — while the cream lingers a beat longer. */
  lambda: 1.6,
  /** The vortex's centre depth at ω0, world units. The disc's own bowl is 0.0165 deep; the stir
   *  at full click triples it, and the paraboloid is zero AT the rim so the join to the mug's
   *  inner wall never opens. */
  dipMax: 0.032,
  /** The cream band's strength at ω0 — an additive highlight, so it fades with ω by construction.
   *  0.5 because the money-shot camera sees the disc at a 25° grazing angle: the first capture
   *  round proved 0.3 with thin arms vanishes entirely into the foreshortening. */
  cream: 0.5,
  /** No pile-up: re-stirs top ω out at this multiple of ω0 (the micro tier's AMP_CAP stance). */
  cap: 1.75,
  /** The stir hands the MUG a low-strength micro rock — the cup answers the spoon. */
  mugNudge: 0.45,
  /** ...and the steam a strong stamp on its own mailbox — the plume answers too. */
  steamAmp: 1.0,
  /** ω below which the stir is DONE: uniform snaps to exact zeros, θacc resets. 1% of ω0, where
   *  the dip is 3e-6 world units and the cream 0.003 — both under one 8-bit step on screen. */
  restW: 0.15,
} as const

/**
 * The liquid disc's zone, measured off the shipped GLB (centre and radius agree with the
 * `CoffeeAnchor` empty the file also carries: centre (−2.595, 11.30), r 0.2995). The box is the
 * disc's own AABB padded 0.05 — the nearest foreign DeskGloss vertex (the donut's icing) is 0.396
 * away, so the pad cannot swallow it. `desk-deep.test.ts` re-derives the disc as a connected
 * component of the shipped bytes and holds it entirely inside, everything else entirely outside.
 */
export const COFFEE_ZONE = {
  min: [-2.945, 1.828, 10.951],
  max: [-2.246, 1.945, 11.649],
  /** The vortex axis and rim, straight from the anchor. */
  center: [-2.595, 11.3],
  radius: 0.2995,
} as const

/**
 * PRECEDENCE with the micro tier (the one overlap in the whole deep set): the disc's zone sits
 * INSIDE the mug's micro box, so a tap on the liquid would otherwise fire a full-strength mug
 * rock over the stir. The rule — checked by both tiers against the same geometry, so they cannot
 * disagree — is that a tap whose ray crosses the liquid's slab belongs to the DEEP tier, which
 * answers with the stir plus a low-strength mug nudge of its own (`mugStirMail`). Hovers stay
 * micro: a brush over the rim is the mug's, and the cursor it raises promises a click the desk
 * answers either way.
 *
 * The 44 px floor inflates x and z only: the slab is thin in y by nature, and growing it there
 * would swallow taps meant for the mug's body above the rim.
 */
export function coffeeRayHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  fovDeg: number,
  heightPx: number
): { t: number; point: [number, number, number] } | null {
  const z = COFFEE_ZONE
  const cx = (z.min[0] + z.max[0]) / 2
  const cy = (z.min[1] + z.max[1]) / 2
  const cz = (z.min[2] + z.max[2]) / 2
  const dist = Math.hypot(cx - ox, cy - oy, cz - oz)
  const extent = Math.min(z.max[0] - z.min[0], z.max[2] - z.min[2])
  const pad = hitPadFor(extent, dist, fovDeg, heightPx)
  const t = rayBoxHit(
    ox,
    oy,
    oz,
    dx,
    dy,
    dz,
    [z.min[0] - pad, z.min[1], z.min[2] - pad],
    [z.max[0] + pad, z.max[1], z.max[2] + pad]
  )
  return t === null ? null : { t, point: [ox + dx * t, oy + dy * t, oz + dz * t] }
}

/** The book's claim, same shape as the coffee's: x/z inflated to the 44 px floor, y as authored.
 *  The micro tier reads this too — not to fire, only to keep the cursor honest over a prop whose
 *  click the DEEP tier answers. */
export function bookRayHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  fovDeg: number,
  heightPx: number
): { t: number; point: [number, number, number] } | null {
  const z = BOOK_ZONE
  const cx = (z.min[0] + z.max[0]) / 2
  const cy = (z.min[1] + z.max[1]) / 2
  const cz = (z.min[2] + z.max[2]) / 2
  const dist = Math.hypot(cx - ox, cy - oy, cz - oz)
  const extent = Math.min(z.max[0] - z.min[0], z.max[2] - z.min[2])
  const pad = hitPadFor(extent, dist, fovDeg, heightPx)
  const t = rayBoxHit(
    ox,
    oy,
    oz,
    dx,
    dy,
    dz,
    [z.min[0] - pad, z.min[1], z.min[2] - pad],
    [z.max[0] + pad, z.max[1], z.max[2] + pad]
  )
  return t === null ? null : { t, point: [ox + dx * t, oy + dy * t, oz + dz * t] }
}

/**
 * The stir's mug nudge, as a MAILBOX (the `steamKickMail` pattern, and for the same reason): the
 * micro tier owns the mug's spring state, so the deep tier posts and the micro frame loop stamps.
 * One frame of pickup latency at most, deterministic either way — consumption order is fixed by
 * mount order in `desk-set.tsx`.
 */
export type MugStirMail = { seq: number; dirX: number; dirZ: number; amp: number }
export const mugStirMail: MugStirMail = { seq: 0, dirX: 0, dirZ: 0, amp: 0 }

export type StirState = { t0: number; w0: number; thetaAcc: number; active: boolean }
export const restingStir = (): StirState => ({ t0: 0, w0: 0, thetaAcc: 0, active: false })

/**
 * Kick the liquid. VELOCITY-CONTINUOUS like every micro trigger: the current ω is sampled and the
 * new impulse ADDED, and the turn already made is banked into θacc so the spiral's phase cannot
 * jump under a re-stir.
 */
export function triggerStir(s: StirState, now: number, strength: number): void {
  const tau = now - s.t0
  const wCur = s.active ? s.w0 * Math.exp(-STIR.lambda * tau) : 0
  if (s.active) s.thetaAcc += (s.w0 / STIR.lambda) * (1 - Math.exp(-STIR.lambda * tau))
  s.w0 = Math.min(wCur + STIR.omega0 * strength, STIR.omega0 * STIR.cap)
  s.t0 = now
  s.active = true
}

/**
 * The stir uniform for this frame: (dip, θ, cream, 0) — or exact rest. Below `restW` everything
 * snaps to +0 and the banked turn resets, so a settled coffee is `Object.is`-identical to one
 * never stirred.
 */
export function sampleStir(s: StirState, now: number, out: Float32Array): boolean {
  if (!s.active) return false
  const tau = now - s.t0
  const w = s.w0 * Math.exp(-STIR.lambda * tau)
  if (w < STIR.restW) {
    s.active = false
    s.w0 = 0
    s.thetaAcc = 0
    out.fill(0)
    return false
  }
  const r = w / STIR.omega0
  out[0] = STIR.dipMax * r * r
  out[1] = s.thetaAcc + (s.w0 / STIR.lambda) * (1 - Math.exp(-STIR.lambda * tau))
  out[2] = STIR.cream * Math.min(r, 1)
  out[3] = 0
  return true
}

/** One uniform, written by the deep frame loop, read by the gloss material. */
export const STIR_UNIFORM = { value: new Float32Array(4) }

// --- the stir's shader chunks ------------------------------------------------

const stirBox = (px: string, py: string, pz: string): string =>
  `${px} >= ${f(COFFEE_ZONE.min[0])} && ${px} <= ${f(COFFEE_ZONE.max[0])} &&
     ${py} >= ${f(COFFEE_ZONE.min[1])} && ${py} <= ${f(COFFEE_ZONE.max[1])} &&
     ${pz} >= ${f(COFFEE_ZONE.min[2])} && ${pz} <= ${f(COFFEE_ZONE.max[2])}`

const INV_R2 = 1 / (COFFEE_ZONE.radius * COFFEE_ZONE.radius)

// --- the notebook ------------------------------------------------------------

/**
 * Click the notebook and the cover opens on a spring, holds a beat over a pencil sketch of the two
 * souvenirs, and falls shut with a bounce. The mechanism the measurements chose: `Book2` ships as
 * a real hardcover — bottom board + spine + top slab, ONE component attached only along the spine
 * (48 boundary triangles, all in z 8.779..8.965; the shell has no side walls — verified against
 * the shipped bytes by `desk-deep.test.ts`). So the cover is NOT split out into its own mesh: its
 * shipped bytes stay exactly where they are, and the open is a weighted rotation about the spine
 * axis in the vertex shader — the same field family as the micro tier's bends, which makes rest
 * bit-identity STRUCTURAL (guarded untouched path over unchanged bytes) instead of achieved.
 * T91 §2.3 priced a separate rigid cover mesh; this diverges deliberately, for that reason.
 *
 * What IS new geometry (Task 92's Blender round): the interior the open reveals — the revealed
 * page and a gutter shadow spliced into `DeskBaked` (static, hidden inside the closed book, so
 * rest pixels cannot change), and `BookVerso` (+1 draw): the paper glued to the cover's underside,
 * carrying the graphite sketch, riding the SAME axis/angle as an object transform.
 */
export const BOOK = {
  /** Open pose, radians (108° — the spike's legibility verdict: the cover stands like a screen). */
  open: 1.8849555921538759,
  /** The opening spring: ζ 0.55 overshoots ~12% (paper-on-board mass), ω settles it in ~0.55 s. */
  zetaOpen: 0.55,
  omegaOpen: 13.2,
  /** The cover starts falling shut this long after the click — open + the reading hold. */
  holdUntil: 1.8,
  /** The shut: a free fall toward closed whose undershoot is REFLECTED — |underdamped| is a
   *  bounce with restitution built in, and a cover that slaps and micro-bounces is how a real
   *  hardcover closes. */
  zetaClose: 0.6,
  omegaClose: 11.0,
  /** Below this angle (rad) in the closing phase the book is DONE: exact +0. ~0.06°. */
  restEps: 0.001,
} as const

/**
 * The spine axis, measured off the shipped GLB (the slab's attachment line; direction is the
 * book's own −5.7° yaw). `P0` sits on the line at slab mid-thickness; `dir` is unit, spine-long;
 * `across` is unit, perpendicular in the desk plane, pointing from the spine toward the book's
 * front edge — the coordinate the flex ramp reads.
 */
export const BOOK_HINGE = {
  p0: [-3.4, 1.649, 8.8914],
  dir: [0.99506, 0, 0.09932],
  across: [-0.09932, 0, 0.99506],
  /** The flex ramp: rotation weight 0 at the spine, 1 past the crease — the spine band curls the
   *  way cardstock does instead of shearing (the slab's 48 attachment triangles live at u < 0.1). */
  rampLo: 0.02,
  rampHi: 0.15,
  /** The shader box: the cover slab and ONLY it. Floor 1.63995 sits between the spliced interior
   *  (PageR 1.6398, gutter 1.6399 — static) and the slab's own bottom face (1.6410). */
  box: { min: [-3.99, 1.63995, 8.8, 0], max: [-2.81, 1.68, 9.69, 0] },
} as const

/** The whole notebook is the click target — its measured footprint, grown a little. */
export const BOOK_ZONE = {
  min: [-3.99, 1.54, 8.75],
  max: [-2.81, 1.68, 9.69],
} as const

export type BookState = { t0: number; active: boolean }
export const restingBook = (): BookState => ({ t0: 0, active: false })

/** A click starts the arc; clicks mid-arc are absorbed (the set piece finishes its sentence). */
export function triggerBook(s: BookState, now: number): void {
  if (s.active) return
  s.t0 = now
  s.active = true
}

const springStep = (tau: number, zeta: number, omega: number): number => {
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  return 1 - Math.exp(-zeta * omega * tau) * (Math.cos(wd * tau) + ((zeta * omega) / wd) * Math.sin(wd * tau))
}

const springStepVel = (tau: number, zeta: number, omega: number): number => {
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  return Math.exp(-zeta * omega * tau) * ((omega * omega) / wd) * Math.sin(wd * tau)
}

/**
 * The cover's angle at `now` — one closed form per phase, velocity-matched at the handover, exact
 * +0 at the end. Pure in (now − t0): scrub-safe and deterministic by construction.
 */
export function sampleBook(s: BookState, now: number): number {
  if (!s.active) return 0
  const tau = now - s.t0
  if (tau <= 0) return 0
  if (tau < BOOK.holdUntil) return BOOK.open * springStep(tau, BOOK.zetaOpen, BOOK.omegaOpen)
  // the shut: free response from the handover state toward 0, undershoot reflected into a bounce
  const th1 = BOOK.open * springStep(BOOK.holdUntil, BOOK.zetaOpen, BOOK.omegaOpen)
  const v1 = BOOK.open * springStepVel(BOOK.holdUntil, BOOK.zetaOpen, BOOK.omegaOpen)
  const tc = tau - BOOK.holdUntil
  const wz = BOOK.omegaClose
  const wd = wz * Math.sqrt(1 - BOOK.zetaClose * BOOK.zetaClose)
  const decay = Math.exp(-BOOK.zetaClose * wz * tc)
  const b = (v1 + BOOK.zetaClose * wz * th1) / wd
  const raw = decay * (th1 * Math.cos(wd * tc) + b * Math.sin(wd * tc))
  const env = decay * Math.hypot(th1, b)
  if (env < BOOK.restEps) {
    s.active = false
    return 0
  }
  return Math.abs(raw)
}

/** The cover's hinge uniform: (θ, 0, 0, 0). Written by the deep frame loop; read by the baked
 *  material's hinge chunk AND by the verso mesh's object transform, so they cannot disagree. */
export const BOOK_UNIFORM = { value: new Float32Array(4) }

/**
 * The cover's vertex chunk, for `DeskBaked` only. Selects the slab by rest-position box (the
 * spliced interior sits under its floor; the shell and pages under that), rotates about the spine
 * axis with the flex ramp's weight, and is guarded to exact zero like every field in this file.
 */
export const BOOK_VERTEX_DECL = 'uniform vec4 uBookHinge;'
export const BOOK_VERTEX_BODY = (() => {
  const b = BOOK_HINGE
  return `if ( uBookHinge.x != 0.0 &&
     position.x >= ${f(b.box.min[0])} && position.x <= ${f(b.box.max[0])} &&
     position.y >= ${f(b.box.min[1])} && position.y <= ${f(b.box.max[1])} &&
     position.z >= ${f(b.box.min[2])} && position.z <= ${f(b.box.max[2])} ) {
  vec3 bkP = vec3( ${f(b.p0[0])}, ${f(b.p0[1])}, ${f(b.p0[2])} );
  vec3 bkAx = vec3( ${f(b.dir[0])}, ${f(b.dir[1])}, ${f(b.dir[2])} );
  float bkU = dot( position - bkP, vec3( ${f(b.across[0])}, ${f(b.across[1])}, ${f(b.across[2])} ) );
  float bkW = smoothstep( ${f(b.rampLo)}, ${f(b.rampHi)}, bkU );
  float bkTh = uBookHinge.x * bkW;
  float bkC = cos( bkTh );
  float bkS = sin( bkTh );
  vec3 bkQ = transformed - bkP;
  transformed = bkP + bkQ * bkC + cross( bkAx, bkQ ) * bkS + bkAx * dot( bkAx, bkQ ) * ( 1.0 - bkC );
}`
})()

/**
 * The vertex half: the vortex dip, a paraboloid-squared of rest radius — C1 at the rim, so the
 * liquid meets the mug's inner wall with no crease and NO tear (the rim ring moves exactly zero).
 * `swNrm` is the gloss material's normal variable; the dip's analytic gradient tilts it toward the
 * axis, so the sheen slides into the funnel the way a real reflection would. THE GUARD IS THE LAW:
 * at exact zero every vertex takes the untouched path.
 */
export const STIR_VERTEX_DECL = 'uniform vec4 uStir;\nvarying vec2 vStirP;'
export const STIR_VERTEX_BODY = `vStirP = position.xz;
if ( uStir.x != 0.0 &&
     ${stirBox('position.x', 'position.y', 'position.z')} ) {
  vec2 swD = position.xz - vec2( ${f(COFFEE_ZONE.center[0])}, ${f(COFFEE_ZONE.center[1])} );
  float swQ = max( 0.0, 1.0 - dot( swD, swD ) * ${f(INV_R2)} );
  transformed.y -= uStir.x * swQ * swQ;
  float swK = -4.0 * uStir.x * swQ * ${f(INV_R2)};
  swNrm = normalize( swNrm + vec3( swK * swD.x, 0.0, swK * swD.y ) );
}`

/**
 * The fragment half: the cream. Two thin arms, periodic in (φ − θ·g(r)) with g falling from centre
 * to rim — pure differential rotation, so the arms wind tighter exactly as long as the liquid
 * keeps turning and the whole figure fades with ω through uStir.z. Additive, like the glaze's own
 * specular term, and guarded the same way.
 */
export const STIR_FRAGMENT_DECL = 'uniform vec4 uStir;\nvarying vec2 vStirP;'
export const STIR_FRAGMENT_BODY = `if ( uStir.z != 0.0 &&
     vStirP.x >= ${f(COFFEE_ZONE.min[0])} && vStirP.x <= ${f(COFFEE_ZONE.max[0])} &&
     vStirP.y >= ${f(COFFEE_ZONE.min[2])} && vStirP.y <= ${f(COFFEE_ZONE.max[2])} ) {
  vec2 sfD = vStirP - vec2( ${f(COFFEE_ZONE.center[0])}, ${f(COFFEE_ZONE.center[1])} );
  float sfR = length( sfD ) * ${f(1 / COFFEE_ZONE.radius)};
  if ( sfR < 1.0 ) {
    float sfPhi = atan( sfD.y, sfD.x );
    // wide arms (pow 3.5), because the camera squashes the disc to 0.42 of its height — the
    // capture round showed pow-6 arms thinner than the pixels left to draw them in
    float sfArm = pow( 0.5 + 0.5 * sin( 2.0 * sfPhi - uStir.y * ( 1.35 - 0.85 * sfR ) ), 3.5 );
    float sfMask = smoothstep( 1.0, 0.88, sfR ) * smoothstep( 0.03, 0.15, sfR );
    outgoingLight += vec3( 0.62, 0.51, 0.38 ) * ( uStir.z * sfArm * sfMask );
  }
}`
