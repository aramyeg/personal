import { hitPadFor, rayBoxHit } from './desk-nudge'

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

const f = (v: number): string => v.toFixed(5)

const stirBox = (px: string, py: string, pz: string): string =>
  `${px} >= ${f(COFFEE_ZONE.min[0])} && ${px} <= ${f(COFFEE_ZONE.max[0])} &&
     ${py} >= ${f(COFFEE_ZONE.min[1])} && ${py} <= ${f(COFFEE_ZONE.max[1])} &&
     ${pz} >= ${f(COFFEE_ZONE.min[2])} && ${pz} <= ${f(COFFEE_ZONE.max[2])}`

const INV_R2 = 1 / (COFFEE_ZONE.radius * COFFEE_ZONE.radius)

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
