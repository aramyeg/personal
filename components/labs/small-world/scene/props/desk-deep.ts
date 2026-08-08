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
  /** The opening spring: ζ 0.7 overshoots ~4% (paper-on-board mass, but calm — past ~112° the
   *  camera sees the sheet's back, so the overshoot stays under it), ω settles in ~0.55 s. */
  zetaOpen: 0.7,
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
  /** Mid-thickness point on the spine line, derived in Blender off Book2's own mesh
   *  (t92_book_build.py, T92_BOOK_AXIS) — the first provisional pivot sat 7 mm off the line. */
  p0: [-3.366668, 1.649, 8.887815],
  /** Points spine-long, SIGNED so that +θ about it lifts the front edge (right-hand rule; the
   *  first capture round shipped the mirror and the cover dove through the stack). */
  dir: [-0.995003, 0, -0.099841],
  across: [-0.099841, 0, 0.995003],
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
 * The verso's own chunk — the SAME axis, angle and flex ramp as the cover's, minus the box (this
 * material renders only the verso mesh). The verso was first opened as a rigid OBJECT rotation,
 * and the capture round showed why that is wrong: the cover's flex zone curls, a rigid sheet
 * cannot follow it, and the fillet showed the slab's unlit underside as a black band. Paper glued
 * to board curls WITH the board; giving the verso the same weighted field is both the fix and the
 * physically honest statement. One uniform writes both — they cannot disagree.
 */
export const VERSO_VERTEX_DECL = 'uniform vec4 uBookHinge;'
export const VERSO_VERTEX_BODY = (() => {
  const b = BOOK_HINGE
  return `if ( uBookHinge.x != 0.0 ) {
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

// --- the watering ------------------------------------------------------------

/**
 * Click the watering can and it waters the plant: the can lifts clear of the foliage (it is
 * shorter than the pot — the lift IS the story beat), tips 44°, and lays a ribbon of seven
 * authored beads onto the rosette; the succulent answers by PERKING — every leaf pivots 6.5° up
 * about the rosette centre and swells 4.5%, then eases back as the drink soaks in, and the soil
 * darkens on the same envelope. The pour is the arm's baked clip (48 frames, LINEAR, every bead a
 * closed form of its own phase — no particles), scrubbed from a PAUSED action whose `.time` is
 * written from this state and never from the frame delta (the T89/T91 law, the `girl.tsx`
 * contract). The eight exported actions were merged into ONE animation at splice time
 * (`WaterAction`), so one written number drives the can and all seven beads — they cannot
 * desynchronise even in principle.
 *
 * The PLANT'S RESPONSE ships as a shader chunk, not a clip (the arm's own redirect): the 30
 * leaves live inside the `DeskBaked` join with no nodes of their own, and all 30 leaf origins
 * coincide at the rosette centre, so the perk is a closed form over rest position vs one point —
 * zero bytes, zero nodes, zero draws.
 */
export const WATER = {
  /** The pour clip's length, seconds — 48 frames at 24 fps, measured off the exported samplers. */
  duration: 2.0,
  /** When the first bead reaches the rosette (frame 22): the perk cannot start before the water. */
  land: 22 / 24,
  /** The perk's envelope: up over 0.5 s as the drink arrives... */
  perkRise: 0.5,
  /** ...held while the can finishes and settles... */
  perkHold: 0.9,
  /** ...and eased back over 1.1 s — the plant relaxes rather than snapping. */
  perkFall: 1.1,
  /** Leaf pivot at full perk, radians (6.5° — amplitude MEASURED by the arm: 16.9% of the plant's
   *  crop changes by more than 8/255, max delta 204/255; unmistakable, not subtle). */
  perkAngle: 0.1134464,
  /** ...with a 4.5% swell about the same centre. */
  swell: 0.045,
  /** How far the soil's baked colour is pulled down at full drink. */
  soilDark: 0.22,
} as const

/** The whole watering arc, after which the state snaps to exact rest. */
export const WATER_TOTAL = WATER.land + WATER.perkRise + WATER.perkHold + WATER.perkFall

/**
 * The can's click zone: its measured rest footprint (the mesh AABB of the spliced `Can_B` under
 * its authored node TRS — behind the pot at (−3.72, 10.03), yaw −119°), grown 0.001 for float
 * slack. `desk-deep.test.ts` re-derives the box from the shipped bytes.
 */
export const CAN_ZONE = {
  min: [-4.079, 1.299, 9.695],
  max: [-3.447, 1.705, 10.52],
} as const

/**
 * The plant, as the shader sees it. The leaves and the soil are runs of vertices inside
 * `DeskBaked`, and no box or cylinder can cut them free: the pot's rim interpenetrates the
 * rosette's own envelope (560 pot vertices sit inside the measured leaf cylinder), and two
 * leaves reach past the arm's 0.393 radius. What IS exact is the accessor itself — the T81 join
 * wrote each object contiguously, so the leaves and the soil are contiguous `gl_VertexID`
 * ranges, and an index-range select cannot tear a neighbour BY CONSTRUCTION. Derived by
 * union-find over the shipped triangles; held by `desk-deep.test.ts` the same way.
 */
export const PLANT = {
  /** All 30 leaf origins coincide here — the rosette centre (glTF frame). */
  origin: [-4.05, 1.6705, 10.6],
  /** The 30 leaves: 5,028 vertices, one contiguous run. */
  leaves: [5408, 10435],
  /** The soil disc: 278 vertices. */
  soil: [21526, 21803],
} as const

export type WaterState = { t0: number; active: boolean }
export const restingWater = (): WaterState => ({ t0: 0, active: false })

/** A click starts the pour; clicks mid-arc are absorbed (the set piece finishes its sentence). */
export function triggerWater(s: WaterState, now: number): void {
  if (s.active) return
  s.t0 = now
  s.active = true
}

const smooth01 = (x: number): number => {
  const t = Math.min(Math.max(x, 0), 1)
  return t * t * (3 - 2 * t)
}

/**
 * The watering frame: writes the perk envelope into `out[0]` and returns the pour clip's time —
 * both pure in (now − t0), scrub-safe, deterministic. Past the whole arc everything snaps to
 * exact +0 and the state disarms, so a watered plant is `Object.is`-identical to one never
 * watered.
 */
export function sampleWater(s: WaterState, now: number, out: Float32Array): number {
  if (!s.active) return 0
  const tau = now - s.t0
  if (tau <= 0) return 0
  if (tau >= WATER_TOTAL) {
    s.active = false
    out[0] = 0
    return 0
  }
  const clip = Math.min(tau, WATER.duration)
  const drink = tau - WATER.land
  const w =
    drink <= 0
      ? 0
      : drink < WATER.perkRise + WATER.perkHold
        ? smooth01(drink / WATER.perkRise)
        : 1 - smooth01((drink - WATER.perkRise - WATER.perkHold) / WATER.perkFall)
  out[0] = w
  return clip
}

/** The watering uniform: (perk w, 0, 0, 0). One writer (the deep frame loop), two readers (the
 *  leaf chunk and the soil tint), so they cannot disagree. */
export const WATER_UNIFORM = { value: new Float32Array(4) }

/**
 * The mail slot the deep tier writes CLIP TIMES into and `desk-glb.tsx` stamps onto the paused
 * actions (the mixer lives with the meshes; the state lives with the pointer — the `mugStirMail`
 * pattern, one frame of pickup latency at most, order fixed by mount order in `desk-set.tsx`).
 */
export const deepClipMail = { water: 0, bird: 0 }

/** The can's claim — same shape as the book's: x/z inflated to the 44 px floor, y as authored. */
export function canRayHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  fovDeg: number,
  heightPx: number
): { t: number; point: [number, number, number] } | null {
  const z = CAN_ZONE
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

// --- the watering's shader chunks (DeskBaked) --------------------------------

/**
 * The vertex half: the leaf perk and the soil's varying. Selection is by `gl_VertexID` range
 * (see PLANT for why nothing geometric can do it), the motion is the arm's closed form — rotate
 * the vertex's offset from the rosette centre about the horizontal axis perpendicular to its own
 * radial direction (every leaf pivots up in its own plane), plus the swell. Applied as a DELTA to
 * `transformed`, and guarded to exact zero: a dry plant takes the untouched path.
 */
export const WATER_VERTEX_DECL = 'uniform vec4 uWater;\nvarying float vWaterDark;'
export const WATER_VERTEX_BODY = (() => {
  const p = PLANT
  return `vWaterDark = 1.0;
if ( uWater.x != 0.0 ) {
  if ( gl_VertexID >= ${p.leaves[0]} && gl_VertexID <= ${p.leaves[1]} ) {
    vec3 wpD = position - vec3( ${f(p.origin[0])}, ${f(p.origin[1])}, ${f(p.origin[2])} );
    float wpL = length( wpD.xz );
    if ( wpL > 1e-4 ) {
      vec3 wpAx = vec3( -wpD.z, 0.0, wpD.x ) / wpL;
      float wpTh = ${f(WATER.perkAngle)} * uWater.x;
      float wpC = cos( wpTh );
      float wpS = sin( wpTh );
      vec3 wpQ = wpD * wpC + cross( wpAx, wpD ) * wpS + wpAx * dot( wpAx, wpD ) * ( 1.0 - wpC );
      transformed += wpQ * ( 1.0 + ${f(WATER.swell)} * uWater.x ) - wpD;
    }
  }
  if ( gl_VertexID >= ${p.soil[0]} && gl_VertexID <= ${p.soil[1]} ) {
    vWaterDark = 1.0 - ${f(WATER.soilDark)} * uWater.x;
  }
}`
})()

/** The fragment half: the soil drinks — its baked colour pulled down by the same envelope. */
export const WATER_FRAGMENT_DECL = 'uniform vec4 uWater;\nvarying float vWaterDark;'
export const WATER_FRAGMENT_BODY = `if ( uWater.x != 0.0 ) diffuseColor.rgb *= vWaterDark;`

// --- the bird ---------------------------------------------------------------

/**
 * Click the clay lane and it becomes the bird — the deep tier's centrepiece. The flat lane on the
 * desk rolls into a ball, kneads, forms a standing bird facing the camera's 3/4, holds the pose,
 * and unrolls back to exactly the flat lane it was. The whole arc is the arm's baked clip: 8 roll
 * bones + one morph target (`BirdForm`, the entire standing bird — glTF applies morphs BEFORE
 * skinning, so the roll bones are back at identity by the time the form weight reaches 1, and the
 * crossfade between them IS the reshape). The two exported actions (bones + morph weights) were
 * merged into ONE `BirdAction` at splice time — 25 channels, one span, one `.time` — so the
 * two-actions desync trap is closed structurally, not by care.
 *
 * THE SWAP: the lane the visitor sees at rest is baked into `DeskBaked` (no node, unreachable).
 * The skinned `Bar_river` mesh is a DUPLICATE of it, authored at the ORIGIN (the inverse-bind
 * identity holds to 3e-8 there; a desk-positioned rig is 160x worse) and placed by a runtime
 * wrapper. While the clip runs, the baked lane's vertices collapse behind `uBird.x` (an index-
 * range select — the lanes interleave diagonally, so no box can cut this one free) and the skinned
 * twin renders in its place; at rest the swap runs backwards. Rest frame 1 equals the shipped lane
 * bit-for-bit in colour (transferred from the lane's own baked bytes at splice) and to 3e-8 in
 * position, so the handover is invisible by measurement, not by hope.
 */
export const BIRD = {
  /** The clip's length, seconds — 98 frames at 24 fps, measured off the exported samplers
   *  (span 0.0417..4.0833; `.time` below the first key clamps to the flat rest pose). */
  duration: 4.083333333333333,
} as const

/**
 * The runtime wrapper's TRS — read off a real desk-positioned export, NOT hand-converted (the
 * arm's recipe §1.5/§2). It maps the origin-authored rig onto the shipped lane's desk position;
 * in three the mesh's matrixWorld applies after skinning, so the wrapper never enters the bind
 * arithmetic and the 3e-8 rest identity survives. One owner: the runtime wrapper AND the
 * containment gate in `desk-glb.test.ts` both read these numbers.
 */
export const BIRD_WRAPPER = {
  position: [2.2072, 1.3727, 9.8122],
  /** Normalize before use — four printed decimals do not make a unit quaternion. */
  quaternion: [0, 0.1692, 0, 0.9856],
  scale: 0.9,
} as const

/**
 * The baked lane inside `DeskBaked`, as the hide chunk selects it: a contiguous `gl_VertexID`
 * run (the T81 join wrote objects contiguously — same fact the plant perk stands on), because no
 * AABB can work here: the pad's lanes are diagonal bars and any box around this one passes
 * through the floor sheet (measured, not assumed). `desk-deep.test.ts` re-derives the range as
 * one whole connected component of the shipped bytes.
 */
export const LANE = {
  /** The lane's vertices in DeskBaked, inclusive. */
  range: [29107, 29536],
  /** Where hidden vertices collapse to — inside the bird's own body, so even a stray fragment
   *  of a degenerate triangle would be occluded by the thing replacing it. */
  hidePoint: [2.2072, 1.3727, 9.8122],
} as const

/** The lane's click zone — the lane component's own measured AABB, fine for the RAY box even
 *  though the shader select must be index-range (a ray claim may be generous; a vertex select
 *  may not tear). */
export const LANE_ZONE = {
  min: [1.8015, 1.3031, 9.6367],
  max: [2.5661, 1.4375, 10.0016],
} as const

export type BirdState = { t0: number; active: boolean }
export const restingBird = (): BirdState => ({ t0: 0, active: false })

/** A click starts the arc; clicks mid-arc are absorbed (the set piece finishes its sentence). */
export function triggerBird(s: BirdState, now: number): void {
  if (s.active) return
  s.t0 = now
  s.active = true
}

/**
 * The bird's clip time: `.time` = τ, 1:1 — the clip IS the closed form (LINEAR keys, every frame
 * a pure function of its phase, scrub-backwards lands on the numbers it came from). Pure in
 * (now − t0). Past the clip's end the state disarms and returns exact 0, so a lane that has
 * been a bird is `Object.is`-identical to one that never was.
 */
export function sampleBird(s: BirdState, now: number): number {
  if (!s.active) return 0
  const tau = now - s.t0
  if (tau <= 0) return 0
  if (tau >= BIRD.duration) {
    s.active = false
    return 0
  }
  return tau
}

/** The bird uniform: (active, 0, 0, 0). ONE writer — the desk-glb frame loop, which flips it in
 *  the same statement that toggles the skinned mesh's visibility, so the two halves of the swap
 *  cannot disagree for even a frame. */
export const BIRD_UNIFORM = { value: new Float32Array(4) }

/** The claim — same shape as the can's: x/z inflated to the 44 px floor, y as authored. */
export function laneRayHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  fovDeg: number,
  heightPx: number
): { t: number; point: [number, number, number] } | null {
  const z = LANE_ZONE
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

// --- the bird's shader chunk (DeskBaked) -------------------------------------

/**
 * The lane-hide half of the swap: while the skinned twin is active, the baked lane's vertices
 * collapse to one point — zero-area triangles emit no fragments. Behind the exact-zero guard the
 * rest path is the untouched path over unchanged bytes, so rest pixel-diff-0 is STRUCTURAL.
 */
export const BIRD_VERTEX_DECL = 'uniform vec4 uBird;'
export const BIRD_VERTEX_BODY = `if ( uBird.x != 0.0 && gl_VertexID >= ${LANE.range[0]} && gl_VertexID <= ${LANE.range[1]} ) {
  transformed = vec3( ${f(LANE.hidePoint[0])}, ${f(LANE.hidePoint[1])}, ${f(LANE.hidePoint[2])} );
}`

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
