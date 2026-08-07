import {
  DESK_NUDGE_ZONES,
  DESK_PAD,
  type DeskMeshName,
  type DeskNudgeKind,
} from './desk-glb-contract'
import { DESK_NOTE } from '../desk-stage'
import { STUDIO_LIGHTS_FULL } from '../desk-studio'
import type { EndingState } from '../../ending-timeline'

/**
 * THE DESK ANSWERS THE POINTER (Task 89) — every number and function the interactions are made of,
 * and none of the three.js or React they reach the screen through. `desk-interactions.tsx` is the
 * plumbing; `desk-nudge.test.ts` drives THIS module without a canvas.
 *
 * ============================================================================
 * THE LAW THIS FEATURE CREATES
 * ============================================================================
 * Scroll purity holds everywhere: the scene remains a pure function of scroll position, and the
 * ending remains provable by `Object.is` sweeps. This task adds ONE new sanctioned class of motion —
 * POINTER-DRIVEN MICRO-ANIMATIONS on desk objects. Their contract, every clause load-bearing:
 *
 *  - INITIATED BY THE VISITOR'S POINTER, never by the scene: a hover crossing into an object's zone
 *    or a click/tap on it. The same exception class as the yeti's peek (Task 61) and the arrival
 *    reveal (Task 54) — user-initiated, so determinism-under-scrub survives: no pointer, no motion,
 *    and a scrub with the pointer parked is bit-identical to a build without this feature (the
 *    shader guards every zone behind `angle != 0.0`, so the rest path is the untouched path — the
 *    same IEEE lesson as `orbitEyeInto`: (v − p) + p is not v, so at rest we never compute it).
 *  - DETERMINISTIC: the same input sequence produces the same frames. Every response is a CLOSED
 *    FORM of (trigger time, direction, strength) — no integration drift, no Math.random anywhere,
 *    every constant authored. The module's clock advances only while the interactions are armed.
 *  - ALWAYS DECAYING BACK TO THE AUTHORED REST STATE. Rest is exact: springs snap to +0 below
 *    REST_EPS and the note's curl returns to exactly 1, so "settled" is `Object.is`-testable, not
 *    asymptotic. Nothing here has an autonomous life — the steam's wall clock (Task 72) remains the
 *    ending's ONLY autonomous motion, and the mug's steam response rides THAT clock as a stamped
 *    impulse rather than adding a second one.
 *  - REDUCED MOTION: an interaction's end state IS its rest state, so the honest rendering of
 *    "produce the end state" is to produce nothing: the module is inert, no listener, no cursor.
 *
 * ============================================================================
 * ONE GRAMMAR, SIX VOICES
 * ============================================================================
 * Every response is the same physical sentence — the object rocks about its real contact with the
 * desk and settles — spoken with object-appropriate mass. The mug is heavy and brief; the donut is
 * light and springy; the pen cup is tall and slow; the bird is quick; the penguin, taller, swings
 * lower and longer. The note is paper, so its verb differs: its curled corner can be pressed FLAT
 * and springs back. All responses are under 700 ms, and all are RIGID rotations of baked vertices
 * (see `DESK_NUDGE_ZONES` for why boxes over the merged mesh, and the no-tear gate that makes them
 * safe) — zero new meshes, zero new draw calls, zero added GLB bytes.
 *
 * The note's press is DOWNWARD-ONLY by construction: uCurl ≤ 1 always, so the sheet never rises
 * above the published `DESK_NOTE.top` ceiling the containment and connect-clearance gates are made
 * against. Mid-interaction the clearance can only grow.
 */

// --- the springs ------------------------------------------------------------

/**
 * Per-object mass, as a damped oscillator. `hz` is the rock's natural frequency, `zeta` its damping
 * ratio, `peakDeg` the first crest of a full click (hover crossings use HOVER_SCALE of it).
 *
 * The settle bound is arithmetic, not hope: the envelope decays as e^(−ζωt), so the slowest of
 * these (bird: ζω = 5.7/s) is at 1.9% of its peak by 700 ms. `desk-nudge.test.ts` sweeps it.
 */
export const NUDGE_PARAMS: Record<
  DeskNudgeKind,
  { hz: number; zeta: number; peakDeg: number }
> = {
  mug: { hz: 3.4, zeta: 0.32, peakDeg: 3.0 },
  donut: { hz: 5.0, zeta: 0.2, peakDeg: 5.0 },
  pencup: { hz: 4.2, zeta: 0.26, peakDeg: 2.8 },
  bird: { hz: 5.8, zeta: 0.157, peakDeg: 6.0 },
  penguin: { hz: 4.6, zeta: 0.19, peakDeg: 4.5 },
}

/** A hover crossing is a brush, not a tap. */
export const HOVER_SCALE = 0.35

/** Below this combined envelope (radians) a spring is DONE and writes exact +0. ~0.02°. */
export const REST_EPS = 0.0004

/** No pile-up: impulses that would swing past this multiple of the authored peak are clamped. */
export const AMP_CAP = 1.75

/**
 * One axis of a rock: closed-form underdamped oscillator from initial conditions. Two of these per
 * zone (rotation about world x and world z) compose any horizontal tipping direction, because
 * micro-angles commute. Closed form is what makes the law's determinism clause cheap to keep:
 * the state is (x0, v0, t0) and every frame is a pure function of it.
 */
export type SpringAxis = { x0: number; v0: number }
export type NudgeSpring = { t0: number; x: SpringAxis; z: SpringAxis; active: boolean }

export const restingSpring = (): NudgeSpring => ({
  t0: 0,
  x: { x0: 0, v0: 0 },
  z: { x0: 0, v0: 0 },
  active: false,
})

const omegaOf = (kind: DeskNudgeKind): number => NUDGE_PARAMS[kind].hz * Math.PI * 2

/** Position and velocity of one axis at `tau` seconds after its initial conditions. */
export function sampleAxis(
  s: SpringAxis,
  omega: number,
  zeta: number,
  tau: number
): { x: number; v: number } {
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const decay = Math.exp(-zeta * omega * tau)
  const b = (s.v0 + zeta * omega * s.x0) / wd
  const c = Math.cos(wd * tau)
  const sn = Math.sin(wd * tau)
  return {
    x: decay * (s.x0 * c + b * sn),
    v: decay * ((b * wd - zeta * omega * s.x0) * c - (s.x0 * wd + zeta * omega * b) * sn),
  }
}

/**
 * The impulse velocity that makes a from-rest response crest at exactly `peakDeg`. The impulse
 * response (V/ωd)·e^(−ζωτ)·sin(ωd τ) peaks at τp = atan2(ωd, ζω)/ωd; divide the wanted peak by
 * that factor and the crest is authored rather than tuned.
 */
export function impulseFor(kind: DeskNudgeKind): number {
  const { zeta, peakDeg } = NUDGE_PARAMS[kind]
  const omega = omegaOf(kind)
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const tp = Math.atan2(wd, zeta * omega) / wd
  const factor = (Math.exp(-zeta * omega * tp) * Math.sin(wd * tp)) / wd
  return (peakDeg * Math.PI) / 180 / factor
}

/**
 * Kick a zone: tip direction `d` (unit, xz), strength 1 for a click, HOVER_SCALE for a hover.
 *
 * VELOCITY-CONTINUOUS: the current state is sampled first and the impulse is ADDED to it, so a
 * re-poke mid-swing stirs the motion instead of restarting it — wandering the pointer across the
 * desk reads as running a finger along it, not as resetting five metronomes. The energy cap keeps
 * spam from winding it up: past AMP_CAP× the authored peak, extra impulse is discarded.
 */
export function triggerNudge(
  s: NudgeSpring,
  kind: DeskNudgeKind,
  now: number,
  dx: number,
  dz: number,
  strength: number
): void {
  const { zeta } = NUDGE_PARAMS[kind]
  const omega = omegaOf(kind)
  const tau = now - s.t0
  const cx = s.active ? sampleAxis(s.x, omega, zeta, tau) : { x: 0, v: 0 }
  const cz = s.active ? sampleAxis(s.z, omega, zeta, tau) : { x: 0, v: 0 }
  // rotation about a = up × d tips the top toward d; a = (dz, 0, −dx) — impulse lands on (x, z)
  const v = impulseFor(kind) * strength
  let vx = cx.v + v * dz
  let vz = cz.v - v * dx
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const env = Math.hypot(
    Math.hypot(cx.x, (vx + zeta * omega * cx.x) / wd),
    Math.hypot(cz.x, (vz + zeta * omega * cz.x) / wd)
  )
  const cap = ((NUDGE_PARAMS[kind].peakDeg * Math.PI) / 180) * AMP_CAP
  if (env > cap) {
    const k = cap / env
    vx = cx.v + (vx - cx.v) * k
    vz = cz.v + (vz - cz.v) * k
  }
  s.t0 = now
  s.x = { x0: cx.x, v0: vx }
  s.z = { x0: cz.x, v0: vz }
  s.active = true
}

/**
 * The zone's uniform for this frame: (axis.x, axis.y, axis.z, angle), angle ≥ 0, axis unit — or
 * exact rest. Writes into `out` (length 4) and returns whether the spring is still live; a spring
 * whose envelope has fallen under REST_EPS is snapped to +0 and deactivated, which is the law's
 * "always decays back to the authored rest state" made `Object.is`-checkable.
 */
export function sampleNudge(s: NudgeSpring, kind: DeskNudgeKind, now: number, out: Float32Array): boolean {
  if (!s.active) return false
  const { zeta } = NUDGE_PARAMS[kind]
  const omega = omegaOf(kind)
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const tau = now - s.t0
  const ax = sampleAxis(s.x, omega, zeta, tau)
  const az = sampleAxis(s.z, omega, zeta, tau)
  const env = Math.hypot(
    Math.hypot(ax.x, (ax.v + zeta * omega * ax.x) / wd),
    Math.hypot(az.x, (az.v + zeta * omega * az.x) / wd)
  )
  if (env < REST_EPS) {
    s.active = false
    out[0] = 0
    out[1] = 0
    out[2] = 0
    out[3] = 0
    return false
  }
  const m = Math.hypot(ax.x, az.x)
  if (m > 0) {
    out[0] = ax.x / m
    out[1] = 0
    out[2] = az.x / m
    out[3] = m
  } else {
    // at a zero crossing the rock is passing flat through rest — angle exactly 0 this frame
    out[0] = 0
    out[1] = 0
    out[2] = 0
    out[3] = 0
  }
  return true
}

// --- the note's press -------------------------------------------------------

/**
 * Paper is not a rocking solid, so the note's verb is different: press the curled corner flat and
 * it springs back to its authored curl. A double exponential — fast attack, slower release —
 * normalised so its crest is exactly the requested depth; two slots overlap by max() so a re-press
 * mid-release deepens instead of popping.
 */
export const PRESS_ATTACK = 0.045
/** 0.14 rather than 0.16 so the release's exponential tail is under 2% of the press by the 700 ms
 *  budget — the same arithmetic bound the rocks are held to. */
export const PRESS_RELEASE = 0.14
export const PRESS_CLICK = 0.7
export const PRESS_HOVER = 0.28
/** Below this depth the press is DONE and uCurl is exactly 1 again. */
export const PRESS_EPS = 0.001

const PRESS_PEAK_T =
  (Math.log(PRESS_RELEASE / PRESS_ATTACK) * PRESS_ATTACK * PRESS_RELEASE) /
  (PRESS_RELEASE - PRESS_ATTACK)
const PRESS_NORM =
  1 / (Math.exp(-PRESS_PEAK_T / PRESS_RELEASE) - Math.exp(-PRESS_PEAK_T / PRESS_ATTACK))

export type NotePress = { t0: number; amp: number }
export type NotePressState = { slots: [NotePress, NotePress] }
export const restingPress = (): NotePressState => ({
  slots: [
    { t0: -1e9, amp: 0 },
    { t0: -1e9, amp: 0 },
  ],
})

const pressDepth = (p: NotePress, now: number): number => {
  const tau = now - p.t0
  if (tau <= 0 || p.amp <= 0) return 0
  return p.amp * PRESS_NORM * (Math.exp(-tau / PRESS_RELEASE) - Math.exp(-tau / PRESS_ATTACK))
}

export function triggerPress(s: NotePressState, now: number, amp: number): void {
  // replace the deader slot, keep the livelier one so max() carries continuity across the re-press
  const d0 = pressDepth(s.slots[0], now)
  const d1 = pressDepth(s.slots[1], now)
  s.slots[d0 <= d1 ? 0 : 1] = { t0: now, amp }
}

/** uCurl for this frame: 1 at rest (exactly), dipping toward 1 − depth under a press. Never > 1
 *  and never < 1 − PRESS_CLICK — the corner can only move DOWN from its authored curl. */
export function samplePress(s: NotePressState, now: number): number {
  const d = Math.max(pressDepth(s.slots[0], now), pressDepth(s.slots[1], now))
  if (d < PRESS_EPS) return 1
  return 1 - Math.min(d, 1)
}

// --- the steam's answer -----------------------------------------------------

/**
 * The mug's clink reaches the plume as a MAILBOX, not a clock: the interactions bump `seq` with a
 * direction and strength, and `desk-steam.tsx` stamps the kick onto its OWN accumulator the frame
 * it notices. The sway is then a closed form of (steam time − stamp) inside the steam's existing
 * deviation — no second wall clock enters the ending, and a kick that never happens costs the
 * shader nothing (`uKick.w` stays 0 behind the same `!= 0` discipline as the zones).
 */
export type SteamKickMail = { seq: number; dirX: number; dirZ: number; amp: number }
export const steamKickMail: SteamKickMail = { seq: 0, dirX: 0, dirZ: 0, amp: 0 }

/** Sideways sway per unit amp at the column's top, in coffee radii. */
export const KICK_SWAY = 0.9
/** The sway's decay (1/s) and swing (rad/s): one lean and most of a return inside ~700 ms. */
export const KICK_DECAY = 4.5
export const KICK_FREQ = 5.5
/** Seconds for the disturbance to travel the column's full height — the waft visibly climbs. */
export const KICK_LAG = 0.35

// --- arming -----------------------------------------------------------------

/**
 * Interactions arm when the studio is FULLY lit — the same beat the dpr floor latches and the
 * parallax reaches full gain, i.e. when the desk has become the subject. Before that the pointer
 * is watching a journey, and a desk that flinches while receding would be an event in someone
 * else's shot. A relation, not a literal, for the reason every gate here is one.
 */
export const nudgeArmedFor = (ending: EndingState): boolean => ending.zoom >= STUDIO_LIGHTS_FULL

// --- hit testing ------------------------------------------------------------

/** Ray/AABB slab test. Returns the entry distance, or null. Pure — the component feeds it the
 *  camera ray; the tests feed it fixtures. */
export function rayBoxHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  min: readonly [number, number, number],
  max: readonly [number, number, number]
): number | null {
  let tmin = -Infinity
  let tmax = Infinity
  const o = [ox, oy, oz]
  const d = [dx, dy, dz]
  for (let i = 0; i < 3; i++) {
    if (d[i] === 0) {
      if (o[i] < min[i] || o[i] > max[i]) return null
      continue
    }
    const inv = 1 / d[i]
    let t0 = (min[i] - o[i]) * inv
    let t1 = (max[i] - o[i]) * inv
    if (t0 > t1) {
      const t = t0
      t0 = t1
      t1 = t
    }
    if (t0 > tmin) tmin = t0
    if (t1 < tmax) tmax = t1
    if (tmin > tmax) return null
  }
  if (tmax < 0) return null
  return tmin >= 0 ? tmin : 0
}

/**
 * The phone's 44 px: how far to grow a zone's box so its screen target is never smaller.
 *
 * `worldPerPx` at the zone's depth is 2·dist·tan(fov/2)/frameHeightPx; a box whose extent projects
 * under `minPx` is padded by half the shortfall on both sides. Desktop boxes come back untouched —
 * the mug is ~130 px tall at the money shot — so this is a floor, never a resize.
 */
export function hitPadFor(extent: number, dist: number, fovDeg: number, heightPx: number, minPx = 44): number {
  const worldPerPx = (2 * dist * Math.tan((fovDeg * Math.PI) / 360)) / heightPx
  const short = minPx * worldPerPx - extent
  return short > 0 ? short / 2 : 0
}

/** Tip direction for a poke at `hit`: away from the poked side, i.e. from the hit point through
 *  the zone's centre, flattened to the desk plane. A dead-centre poke falls back to `fb` (the
 *  camera's forward, so a top poke pushes the object away from the viewer). */
export function tipDirFrom(
  hit: readonly [number, number, number],
  center: readonly [number, number, number],
  fb: readonly [number, number]
): [number, number] {
  const dx = center[0] - hit[0]
  const dz = center[2] - hit[2]
  const m = Math.hypot(dx, dz)
  if (m < 0.02) {
    const fm = Math.hypot(fb[0], fb[1]) || 1
    return [fb[0] / fm, fb[1] / fm]
  }
  return [dx / m, dz / m]
}

// --- the note corner's zone -------------------------------------------------

/**
 * The curled corner's hit box, derived from the sheet's own authoring (`desk-note.tsx` buildSheet):
 * the region u, v ∈ [0.62, 1] — where the curl ramp is meaningfully non-zero — swept through the
 * note's yaw. Derived, not typed, so a re-authored note moves its own hotspot.
 */
export const NOTE_CORNER_ZONE = (() => {
  const cos = Math.cos(DESK_NOTE.rot)
  const sin = Math.sin(DESK_NOTE.rot)
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const u of [0.62, 1]) {
    for (const v of [0.62, 1]) {
      const lx = (u - 0.5) * DESK_NOTE.width
      const lz = (0.5 - v) * DESK_NOTE.depth
      const x = DESK_NOTE.x + lx * cos + lz * sin
      const z = DESK_NOTE.z - lx * sin + lz * cos
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
  }
  return {
    min: [minX, DESK_PAD.top, minZ] as const,
    max: [maxX, DESK_PAD.top + DESK_NOTE.top + 0.05, maxZ] as const,
  }
})()

/** The curl's full height, the term the shader scales: (top − lift)·ramp(u)·ramp(v). */
export const NOTE_CURL_MAX = DESK_NOTE.top - DESK_NOTE.lift

// --- the shader chunks ------------------------------------------------------

/** One shared vec4 per zone — (axis, angle) — written once by the driver and read by every
 *  material the zone is registered in, so the bake and the metal can never disagree mid-rock. */
export const NUDGE_UNIFORMS: Record<DeskNudgeKind, { value: Float32Array }> = {
  mug: { value: new Float32Array(4) },
  donut: { value: new Float32Array(4) },
  pencup: { value: new Float32Array(4) },
  bird: { value: new Float32Array(4) },
  penguin: { value: new Float32Array(4) },
}

/** ...and the note's one scalar. 1 is the authored curl; a press dips below it, never above. */
export const NOTE_CURL_UNIFORM = { value: 1 }

const f = (v: number): string => v.toFixed(5)

export const zonesForMesh = (mesh: DeskMeshName) =>
  DESK_NUDGE_ZONES.filter((z) => z.meshes.includes(mesh))

/**
 * The vertex-shader block for one mesh: per zone, a rest-position box test and a Rodrigues
 * rotation about the pivot plus the edge-rock lift. Boxes, pivots and radii are compile-time
 * literals (they are measurements — see the contract); only (axis, angle) crosses per frame.
 *
 * `transformed` is displaced; when `normalVar` is given the same rotation is applied to it, for
 * the two meshes whose materials actually read normals. THE GUARD IS THE LAW: at angle exactly 0
 * the vertex takes the untouched path, so a pointerless scrub is bit-identical by construction.
 */
export function nudgeVertexChunk(mesh: DeskMeshName, normalVar?: string): { decl: string; body: string } {
  const zones = zonesForMesh(mesh)
  const decl = zones.map((z) => `uniform vec4 uNudge_${z.kind};`).join('\n')
  const body = zones
    .map((z) => {
      const [px, py, pz] = z.pivot
      const rot = normalVar
        ? `${normalVar} = ${normalVar} * swC + cross( swAx, ${normalVar} ) * swS + swAx * dot( swAx, ${normalVar} ) * ( 1.0 - swC );`
        : ''
      return `if ( uNudge_${z.kind}.w != 0.0 &&
     position.x >= ${f(z.min[0])} && position.x <= ${f(z.max[0])} &&
     position.y >= ${f(z.min[1])} && position.y <= ${f(z.max[1])} &&
     position.z >= ${f(z.min[2])} && position.z <= ${f(z.max[2])} ) {
  vec3 swAx = uNudge_${z.kind}.xyz;
  float swC = cos( uNudge_${z.kind}.w );
  float swS = sin( uNudge_${z.kind}.w );
  vec3 swP = vec3( ${f(px)}, ${f(py)}, ${f(pz)} );
  vec3 swQ = transformed - swP;
  transformed = swP + swQ * swC + cross( swAx, swQ ) * swS + swAx * dot( swAx, swQ ) * ( 1.0 - swC )
    + vec3( 0.0, ${f(z.baseR)} * uNudge_${z.kind}.w, 0.0 );
  ${rot}
}`
    })
    .join('\n')
  return { decl, body }
}

/**
 * The normal-only twin, for `MeshStandardMaterial`: its chunk order consumes `objectNormal` in
 * `defaultnormal_vertex` BEFORE `begin_vertex` runs, so the rotation has to land in
 * `beginnormal_vertex` where the variable is born — patching it later rotates a value nobody
 * reads. Same guards, same literals, no translation (normals have no pivot).
 */
export function nudgeNormalChunk(mesh: DeskMeshName, normalVar: string): string {
  return zonesForMesh(mesh)
    .map(
      (z) => `if ( uNudge_${z.kind}.w != 0.0 &&
     position.x >= ${f(z.min[0])} && position.x <= ${f(z.max[0])} &&
     position.y >= ${f(z.min[1])} && position.y <= ${f(z.max[1])} &&
     position.z >= ${f(z.min[2])} && position.z <= ${f(z.max[2])} ) {
  vec3 swNAx = uNudge_${z.kind}.xyz;
  float swNC = cos( uNudge_${z.kind}.w );
  float swNS = sin( uNudge_${z.kind}.w );
  ${normalVar} = ${normalVar} * swNC + cross( swNAx, ${normalVar} ) * swNS + swNAx * dot( swNAx, ${normalVar} ) * ( 1.0 - swNC );
}`
    )
    .join('\n')
}
