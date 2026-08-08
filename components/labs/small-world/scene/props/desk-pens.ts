/**
 * THE FIVE PENS — measured geometry, and the clatter that DISPLACES them (T100).
 *
 * ============================================================================
 * WHY THIS FILE EXISTS
 * ============================================================================
 * The pens' measurements had two consumers with no shared owner: `desk-station.ts` (which claims
 * them for the pick, as five fitted capsules) and `desk-nudge.ts` (which moves them). The T89
 * rattle moved them with a CONTINUOUS FIELD — lateral sway proportional to height over the rim,
 * phased by rest position — so it never needed to know which vertex belonged to which pen, and
 * the two consumers could stay apart. The T100 rework ends that: a pen that is *displaced* moves
 * as a PEN, rigidly, about its own contact, and that requires the per-pen identity the station
 * already measured. One owner, two importers (the geometry-needs-one-owner law).
 *
 * ============================================================================
 * WHAT CHANGED, AND WHY THE FIELD WAS NOT ENOUGH (the T100 diagnosis)
 * ============================================================================
 * Measured on the composed money shot at 1440×900: the desk projects at ≈134 px per world unit,
 * and the T89 rattle's own arithmetic gives a pen TIP excursion of `RATTLE.amp · lever` =
 * 0.045 · 0.60 ≈ 0.027 u ≈ 3.6 px, oscillating at 7 Hz. Three and a half pixels at seven hertz
 * is a shimmer: correct as physics, invisible as a picture, and — the note that decides it — it
 * is a SHEAR, not a displacement. Every vertex slid sideways in proportion to its own height, so
 * the pens got subtly bent; nothing ever left its place.
 *
 * So the pens now clatter as bodies. Each one takes a rigid rotation about the point where its
 * own axis crosses the cup's rim — which is where a real pen levers — plus a hop straight up, and
 * each leans along its OWN direction: outward from the cup's axis toward its own tip, with a
 * tangential share mixed in so the five do not open like one flower. The excursion is ~4-5x the
 * shipped one and the pens keep their length while they do it: the arrangement visibly opens and
 * closes again.
 *
 * ============================================================================
 * TWO SHARED WAVEFORMS, FIVE VOICES (and why not five springs)
 * ============================================================================
 * Per-pen springs would need five states on the CPU and five uniforms on the GPU, and would buy
 * nothing the mix does not: the whole point is that the pens differ, not that they are
 * independent. So there are exactly TWO 1-D damped oscillators — a fast one and a slow one — and
 * each pen reads its own signed mix of them. Different mixes peak at different instants and lean
 * in different directions, which is what a clatter looks like; and because BOTH waveforms are the
 * `sampleAxis` closed form, the whole thing keeps every law the micro tier already had:
 *
 *  - VELOCITY-CONTINUOUS re-trigger (the current state is sampled and the impulse added), so a
 *    second tap mid-clatter stirs the motion instead of restarting it — no pop.
 *  - ZERO AT THE TRIGGER: a from-rest kick starts at displacement 0 with velocity, so the pens
 *    never jump to a pose. (The T89 field read the module CLOCK, so its sine was mid-phase at the
 *    moment of the tap; at 3.6 px that was invisible, at 17 px it would have been a snap.)
 *  - EXACT REST: below `PEN_EPS` both springs snap to +0 and deactivate together, and the shader
 *    guard is `uPen.x != 0.0 || uPen.y != 0.0` — a settled cup takes the untouched path over
 *    unchanged bytes, so it is `Object.is`-identical to a cup never tapped.
 */

import { sampleAxis, type SpringAxis } from './desk-nudge-spring'

/** Compile-time literal formatting (measurements → GLSL). */
const f = (v: number): string => v.toFixed(5)

const TAU = Math.PI * 2

/**
 * The five pens, as the shipped bytes hold them. Each pen's SHAFT is one contiguous `gl_VertexID`
 * run — but three of the five also wear a CAP, and the T81 join wrote those caps as their own
 * blocks AFTER all four baked shafts, so a pen is not always one run. `range` is the shaft,
 * `cap` the cap block or null; `a` is the end that sits in the cup, `b` the tip; the CAPSULE is
 * fitted for the pick (banded-mean endpoints; max vert-to-segment 0.1026 → r 0.13).
 *
 * Union-find over the shipped triangles (`desk-pens.test.ts` re-derives every number below) finds
 * exactly this in the pen-cup neighbourhood: five shaft components, three 324-vertex cap
 * assemblies, and the cup body at 17240..19081 — which must never be claimed, because the pens
 * pass through it and an index range that swallowed it would tear the cup off the desk. The caps
 * are one model instanced three times, and each sits coaxially on ONE pen: 0.0719 max distance to
 * its own pen's axis against 0.224 to the next-nearest, with that pen's own vertex colour.
 * darkRed and white2 wear theirs at the tip; roseGold stands cap-down, so its cap is below the
 * rim. white1 and pink have none.
 *
 * THE CAPS WERE THE T100 BUG: they are separate connected components lying outside every pen's
 * range, so the shader levered each shaft about its rim while the cap stayed at rest in mid-air.
 * Claiming the cap block is the whole fix, and it disturbs nothing else — each cap lies strictly
 * INSIDE its own shaft's axial extent (darkRed's spans s 0.753..1.043 of a shaft that runs
 * -0.091..1.082), so `b` stays where it was measured and the leans do not re-solve; and it reaches
 * only 0.0719 from the segment against the shaft's own 0.1026, so the pick capsule is untouched.
 *
 * The pick reads the capsules; the clatter reads the ranges and the axis. Both from here.
 */
export const PENCUP_PENS: readonly {
  readonly id: string
  readonly mesh: 'DeskBaked' | 'DeskMetal'
  readonly range: readonly [number, number]
  readonly cap: readonly [number, number] | null
  readonly a: readonly [number, number, number]
  readonly b: readonly [number, number, number]
  readonly r: number
}[] = [
  { id: 'darkRed', mesh: 'DeskBaked', range: [14348, 14928], cap: [16592, 16915], a: [2.8033, 1.4615, 11.7933], b: [2.62, 2.5645, 11.6655], r: 0.13 },
  { id: 'white1', mesh: 'DeskBaked', range: [14929, 15489], cap: null, a: [2.9657, 1.4613, 11.8292], b: [3.1764, 2.4835, 11.7702], r: 0.13 },
  { id: 'pink', mesh: 'DeskBaked', range: [15490, 16030], cap: null, a: [2.9849, 1.4352, 11.8973], b: [3.166, 2.3957, 11.9857], r: 0.13 },
  { id: 'white2', mesh: 'DeskBaked', range: [16031, 16591], cap: [16916, 17239], a: [2.8766, 1.4615, 11.7367], b: [2.8936, 2.5345, 11.5203], r: 0.13 },
  { id: 'roseGold', mesh: 'DeskMetal', range: [1106, 1686], cap: [1687, 2010], a: [2.85, 1.452, 11.9415], b: [2.7856, 2.6162, 12.1518], r: 0.13 },
] as const

/** The cup's vertical axis, xz — the T89 pivot's own footprint centre. The lean directions are
 *  measured OUTWARD from this line, so the five pens fan apart instead of into each other. */
export const PENCUP_AXIS = [2.875, 11.855] as const

/** The rim line — `PenCup`'s measured top. Each pen levers about the point where its own axis
 *  crosses this plane, because that is the contact a real pen in a real cup turns on. */
export const PEN_RIM_Y = 1.9626

export const CLATTER = {
  /** The fast voice: the clack. */
  fastHz: 6.2,
  fastZeta: 0.13,
  /** ...and the slow one: the lean that opens the arrangement and closes it again. */
  slowHz: 3.4,
  slowZeta: 0.21,
  /**
   * THE BAR, stated where it can be measured: how far a pen's TIP travels at full clatter, in
   * world units. The money shot projects the desk at ≈134 px per unit, so 0.115 u ≈ 15 px —
   * against the shipped shear's 3.6 px. Each pen's ANGLE is derived from this and its own lever
   * (`lean = tipTravel · gain / tipArm`), so the short pens turn further than the long ones and
   * every tip covers about the same ground: the arrangement opens evenly instead of one pen
   * flailing while its neighbour twitches.
   */
  tipTravel: 0.115,
  /** The hop, world units, at coefficient 1: the pens come off the cup's floor and land again.
   *  ≈6 px at the money shot. Rides the POSITIVE half of the slow waveform only — a pen rises and
   *  rests, it does not swing below the floor it is standing on. */
  hop: 0.04,
  /** No pile-up: a re-tap tops each waveform out at this multiple of its own from-rest peak. */
  cap: 1.75,
} as const

/** Below this combined envelope both waveforms are DONE and write exact +0. */
export const PEN_EPS = 0.006

/**
 * The per-pen voices. `fast`/`slow` are SIGNED mixes of the two shared waveforms, NORMALISED to
 * |fast| + |slow| = 1 (the magnitude lives in `gain`, so the mix only ever says *character*): the
 * signs are what make some pens lean out first and others in, which is the difference between a
 * clatter and a flower opening. `gain` scales that pen's tip travel about the set's bar, `hop` its
 * jump, and `tang` mixes a tangential share into its outward lean direction so the fan is not
 * radially perfect. Hand-authored.
 */
const VOICES: Record<string, { fast: number; slow: number; hop: number; tang: number; gain: number }> = {
  darkRed: { fast: 0.72, slow: 0.28, hop: 1.0, tang: 0.32, gain: 1.12 },
  white1: { fast: -0.53, slow: 0.47, hop: 0.74, tang: -0.28, gain: 0.9 },
  pink: { fast: 0.66, slow: -0.34, hop: 0.86, tang: 0.4, gain: 1.0 },
  white2: { fast: -0.77, slow: -0.23, hop: 1.1, tang: -0.36, gain: 1.06 },
  roseGold: { fast: 0.4, slow: 0.6, hop: 0.66, tang: 0.24, gain: 0.82 },
}

export type PenGeom = {
  id: string
  mesh: 'DeskBaked' | 'DeskMetal'
  range: readonly [number, number]
  /** The pen's cap block, where the bytes carry one — it moves with the shaft or it is not a pen. */
  cap: readonly [number, number] | null
  /** Where the pen's axis crosses the rim plane — its lever point. */
  pivot: readonly [number, number, number]
  /** Unit horizontal lean direction (outward from the cup axis, with the tangential share). */
  dir: readonly [number, number]
  /** Distance from the pivot to the tip — the lever the lean's excursion is measured on. */
  tipArm: number
  /** Radians of lean per unit of mix — derived so this pen's tip covers `tipTravel · gain`. */
  lean: number
  fast: number
  slow: number
  hop: number
}

/**
 * The derived per-pen clatter geometry, solved once at module load off the measurements above.
 * ONE owner: the shader chunk and the tests both read this array, so a re-measured pen cannot
 * move in one and not the other.
 */
export const PEN_GEOM: readonly PenGeom[] = PENCUP_PENS.map((p) => {
  const v = VOICES[p.id]!
  const d = [p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]] as const
  // the pen's axis crosses the rim plane at this parameter (every pen's a is below it, b above)
  const s = (PEN_RIM_Y - p.a[1]) / d[1]
  const pivot = [p.a[0] + d[0] * s, PEN_RIM_Y, p.a[2] + d[2] * s] as const
  // outward, from the cup's axis toward this pen's own tip
  const ox = p.b[0] - PENCUP_AXIS[0]
  const oz = p.b[2] - PENCUP_AXIS[1]
  const ol = Math.hypot(ox, oz)
  const ux = ox / ol
  const uz = oz / ol
  // ...plus a tangential share, so the five do not open as one flower
  const mx = ux - v.tang * uz
  const mz = uz + v.tang * ux
  const ml = Math.hypot(mx, mz)
  const tipArm = Math.hypot(p.b[0] - pivot[0], p.b[1] - pivot[1], p.b[2] - pivot[2])
  return {
    id: p.id,
    mesh: p.mesh,
    range: p.range,
    cap: p.cap,
    pivot,
    dir: [mx / ml, mz / ml] as const,
    tipArm,
    lean: (CLATTER.tipTravel * v.gain) / tipArm,
    fast: v.fast,
    slow: v.slow,
    hop: v.hop,
  }
})

// --- the two waveforms -------------------------------------------------------

const spring = (hz: number, zeta: number) => {
  const omega = hz * TAU
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const tp = Math.atan2(wd, zeta * omega) / wd
  const impulse = 1 / ((Math.exp(-zeta * omega * tp) * Math.sin(wd * tp)) / wd)
  return {
    omega,
    zeta,
    wd,
    /** the impulse velocity whose from-rest response crests at exactly 1 */
    impulse,
    /** The ceiling, in the currency that matters: the envelope IS the amplitude the oscillation
     *  can still reach, so bounding it at `CLATTER.cap` bounds the DISPLACEMENT at `cap` authored
     *  crests — a tip may never travel more than `cap · tipTravel`, however hard the desk is
     *  spammed. (A single from-rest tap carries envelope ≈1.2-1.4 and crests at exactly 1, so it
     *  never meets this at all.) */
    capEnv: CLATTER.cap,
  }
}
type Spring = ReturnType<typeof spring>
const FAST = spring(CLATTER.fastHz, CLATTER.fastZeta)
const SLOW = spring(CLATTER.slowHz, CLATTER.slowZeta)

const envOf = (sp: Spring, x: number, v: number): number =>
  Math.hypot(x, (v + sp.zeta * sp.omega * x) / sp.wd)

/**
 * Add one impulse to a waveform and clamp the RESULT's energy — not the velocity delta, which is
 * what a naive `Math.min` on the impulse does and which does not bound anything once `x0` starts
 * carrying over (measured: 20 taps in 200 ms wound the pens to 7.2 crests). The envelope is
 * `hypot(x, (v + ζωx)/ω_d)`, so at fixed `x` it is solvable in one step for the largest `v` that
 * still fits — exact, and continuous in the velocity it clamps.
 */
const kick = (sp: Spring, cur: { x: number; v: number }, strength: number): SpringAxis => {
  const x0 = cur.x
  let v0 = cur.v + sp.impulse * strength
  if (envOf(sp, x0, v0) > sp.capEnv && Math.abs(x0) < sp.capEnv) {
    const b = Math.sqrt(sp.capEnv * sp.capEnv - x0 * x0)
    const bCur = (v0 + sp.zeta * sp.omega * x0) / sp.wd
    v0 = Math.max(-b, Math.min(b, bCur)) * sp.wd - sp.zeta * sp.omega * x0
  }
  return { x0, v0 }
}

export type RattleState = { t0: number; fast: SpringAxis; slow: SpringAxis; active: boolean }
export const restingRattle = (): RattleState => ({
  t0: 0,
  fast: { x0: 0, v0: 0 },
  slow: { x0: 0, v0: 0 },
  active: false,
})

/**
 * Kick the clatter. Velocity-continuous, energy-capped, and — the property the displacement made
 * load-bearing — a from-rest kick starts at exactly zero displacement, so the pens never pop into
 * a pose at the instant of the tap.
 */
export function triggerRattle(s: RattleState, now: number, strength: number): void {
  const tau = now - s.t0
  const cf = s.active ? sampleAxis(s.fast, FAST.omega, FAST.zeta, tau) : { x: 0, v: 0 }
  const cs = s.active ? sampleAxis(s.slow, SLOW.omega, SLOW.zeta, tau) : { x: 0, v: 0 }
  s.t0 = now
  s.fast = kick(FAST, cf, strength)
  s.slow = kick(SLOW, cs, strength)
  s.active = true
}

/**
 * The clatter's uniform for this frame: (fast, slow, 0, 0) — or exact rest. Below `PEN_EPS` the
 * combined envelope is spent: both waveforms snap to +0 together and the state deactivates, so a
 * settled cup is bit-identical to one never tapped.
 */
export function sampleRattle(s: RattleState, now: number, out: Float32Array): boolean {
  if (!s.active) return false
  const tau = now - s.t0
  const cf = sampleAxis(s.fast, FAST.omega, FAST.zeta, tau)
  const cs = sampleAxis(s.slow, SLOW.omega, SLOW.zeta, tau)
  const env = Math.hypot(envOf(FAST, cf.x, cf.v), envOf(SLOW, cs.x, cs.v))
  if (env < PEN_EPS) {
    s.active = false
    s.fast = { x0: 0, v0: 0 }
    s.slow = { x0: 0, v0: 0 }
    out[0] = 0
    out[1] = 0
    return false
  }
  out[0] = cf.x
  out[1] = cs.x
  return true
}

/** One shared vec4: (fast, slow, 0, 0). Written by the micro frame loop, read by both meshes that
 *  carry pens, so the baked four and the metal one cannot disagree mid-clatter. */
export const RATTLE_UNIFORM = { value: new Float32Array(4) }

// --- the shader chunks --------------------------------------------------------

/** One pen's id test: its shaft run, plus its cap's run where it has one. The two runs are
 *  disjoint and neither touches a neighbour, so the cascade below stays exclusive. */
const penIds = (g: PenGeom): string => {
  const run = (r: readonly [number, number]): string =>
    `gl_VertexID >= ${r[0]} && gl_VertexID <= ${r[1]}`
  return g.cap ? `( ${run(g.range)} ) || ( ${run(g.cap)} )` : run(g.range)
}

const penBranch = (g: PenGeom, first: boolean): string =>
  `${first ? '' : 'else '}if ( ${penIds(g)} ) {
    pnP = vec3( ${f(g.pivot[0])}, ${f(g.pivot[1])}, ${f(g.pivot[2])} );
    pnD = vec2( ${f(g.dir[0])}, ${f(g.dir[1])} );
    pnM = ${f(g.lean)} * ( ${f(g.fast)} * uPenClatter.x + ${f(g.slow)} * uPenClatter.y );
    pnH = ${f(g.hop)};
  }`

const pensIn = (mesh: 'DeskBaked' | 'DeskMetal'): readonly PenGeom[] =>
  PEN_GEOM.filter((g) => g.mesh === mesh)

/**
 * The clatter's vertex block for one mesh. Each pen is selected by its own `gl_VertexID` runs —
 * shaft and cap — because no box can do this (the shafts lean through each other's AABBs, and a
 * box that caught one pen whole would catch its neighbour's cap), and index runs cannot tear a
 * neighbour BY CONSTRUCTION: no triangle in the file straddles a cap block's edge. The motion is
 * a rigid rotation about the pen's own rim crossing plus a hop, so the pen keeps its length AND
 * its cap: it is displaced, not bent, and not shed.
 *
 * COMPOSITION with the cup's rock: the rock runs first and moves `transformed`; this block then
 * turns the already-rocked pen about its REST-space pivot. The cup's rock peaks at 0.8°, so the
 * pivot's own drift is under 0.005 u — second order, sub-pixel, and the same composition order
 * the T89 rattle already had. Deep-then-micro, one owner per vertex.
 */
export function penClatterVertexBlock(mesh: 'DeskBaked' | 'DeskMetal'): string {
  const pens = pensIn(mesh)
  if (pens.length === 0) return ''
  return `if ( uPenClatter.x != 0.0 || uPenClatter.y != 0.0 ) {
  vec3 pnP = vec3( 0.0 );
  vec2 pnD = vec2( 0.0 );
  float pnM = 0.0;
  float pnH = 0.0;
  ${pens.map((g, i) => penBranch(g, i === 0)).join('\n  ')}
  if ( pnH != 0.0 ) {
    float pnTh = pnM;
    vec3 pnAx = vec3( pnD.y, 0.0, -pnD.x );
    float pnC = cos( pnTh );
    float pnS = sin( pnTh );
    vec3 pnQ = transformed - pnP;
    transformed = pnP + pnQ * pnC + cross( pnAx, pnQ ) * pnS + pnAx * dot( pnAx, pnQ ) * ( 1.0 - pnC );
    transformed.y += ${f(CLATTER.hop)} * pnH * max( 0.0, uPenClatter.y );
  }
}`
}

/**
 * The normal twin, for the one pen that has a specular to lose: the rose gold lives in
 * `DeskMetal`, and a rigid 11° turn that left its normals behind would slide the pen out from
 * under its own highlight. (The T89 rattle was a pure translation and correctly turned nothing;
 * this one is a rotation, so it must.) The baked mesh is unlit vertex colour — it has no normal
 * chunk at all, which is why only the metal gets this.
 */
export function penClatterNormalBlock(mesh: 'DeskBaked' | 'DeskMetal', normalVar: string): string {
  const pens = pensIn(mesh)
  if (pens.length === 0) return ''
  return `if ( uPenClatter.x != 0.0 || uPenClatter.y != 0.0 ) {
  vec2 pnND = vec2( 0.0 );
  float pnNM = 0.0;
  float pnNSeen = 0.0;
  ${pens
    .map(
      (g, i) => `${i === 0 ? '' : 'else '}if ( ${penIds(g)} ) {
    pnND = vec2( ${f(g.dir[0])}, ${f(g.dir[1])} );
    pnNM = ${f(g.lean)} * ( ${f(g.fast)} * uPenClatter.x + ${f(g.slow)} * uPenClatter.y );
    pnNSeen = 1.0;
  }`
    )
    .join('\n  ')}
  if ( pnNSeen != 0.0 ) {
    float pnNTh = pnNM;
    vec3 pnNAx = vec3( pnND.y, 0.0, -pnND.x );
    float pnNC = cos( pnNTh );
    float pnNS = sin( pnNTh );
    ${normalVar} = ${normalVar} * pnNC + cross( pnNAx, ${normalVar} ) * pnNS + pnNAx * dot( pnNAx, ${normalVar} ) * ( 1.0 - pnNC );
  }
}`
}

export const PEN_CLATTER_DECL = 'uniform vec4 uPenClatter;'
