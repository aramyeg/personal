import {
  DESK_NUDGE_ZONES,
  DESK_PAD,
  type DeskMeshName,
  type DeskNudgeKind,
} from './desk-glb-contract'
import { DESK_NOTE } from '../desk-stage'
import { STUDIO_LIGHTS_FULL } from '../desk-studio'
import type { EndingState } from '../../ending-timeline'
import { sampleAxis, type SpringAxis } from './desk-nudge-spring'
import { PEN_CLATTER_DECL, penClatterNormalBlock, penClatterVertexBlock, RATTLE_UNIFORM } from './desk-pens'

/** The one damped oscillator, re-exported from where it now lives — see desk-nudge-spring.ts for
 *  why it moved (the pens needed it BELOW desk-station's import of this file). */
export { sampleAxis, type SpringAxis }
export {
  CLATTER,
  PENCUP_AXIS,
  PENCUP_PENS,
  PEN_EPS,
  PEN_GEOM,
  PEN_RIM_Y,
  RATTLE_UNIFORM,
  restingRattle,
  sampleRattle,
  triggerRattle,
  type RattleState,
} from './desk-pens'

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
 *    shader guards every zone behind an exact-zero test, so the rest path is the untouched path —
 *    the same IEEE lesson as `orbitEyeInto`: (v − p) + p is not v, so at rest we never compute it).
 *  - DETERMINISTIC: the same input sequence produces the same frames. Every response is a CLOSED
 *    FORM of (trigger time, direction, strength) — no integration drift, no Math.random anywhere,
 *    every constant authored. The module's clock advances only while the interactions are armed.
 *    The pen rattle's oscillation is evaluated in-shader, but from a CPU-stamped time and envelope,
 *    so it is the same closed form one multiplication later.
 *  - ALWAYS DECAYING BACK TO THE AUTHORED REST STATE. Rest is exact: every envelope snaps to +0
 *    below its epsilon and the note's curl returns to exactly 1, so "settled" is
 *    `Object.is`-testable, not asymptotic. Nothing here has an autonomous life — the steam's wall
 *    clock (Task 72) remains the ending's ONLY autonomous motion, and the mug's steam response
 *    rides THAT clock as a stamped impulse rather than adding a second one.
 *  - REDUCED MOTION: an interaction's end state IS its rest state, so the honest rendering of
 *    "produce the end state" is to produce nothing: the module is inert, no listener, no cursor.
 *
 * ============================================================================
 * ONE PHYSICS, SIX SIGNATURES (the Aram redirect: "each one unique and special to the item")
 * ============================================================================
 * Every response is still an honest, small disturbance that settles — but each object answers in
 * its own material's voice, not as a scaled copy of its neighbour's:
 *
 *  - the MUG is heavy ceramic: a brief 4.5° rock about its base edge, the COFFEE STAYS LEVEL
 *    inside it, and the steam flinches;
 *  - the DONUT is soft: it does not rock at all — it SQUASHES toward the pad, bulges, overshoots
 *    into a stretch and jiggles out, icing and sprinkles riding the jelly;
 *  - the PEN CUP barely moves — the signature is the PENS, levering about the rim line with
 *    per-pen phases: a rattle, not a body;
 *  - the BLUEBIRD is a bird: a quick peck-peck bow — a clay bend at the neck, head and beak
 *    dipping forward twice — with a whisper of body recoil;
 *  - the PENGUIN is a roly-poly toy: a deep, slow weeble whose axis PRECESSES as it settles, and
 *    which takes visibly longer than anything else — that contrast is the character (the 700 ms
 *    budget flexes for it by sanction; everything else keeps it);
 *  - the NOTE is paper: its curled corner presses FLAT and springs back, downward-only, so the
 *    sheet never rises above the published `DESK_NOTE.top` ceiling and the connect-clearance
 *    envelope can only grow mid-press.
 *
 * All of it is rendered by fields over REST POSITION inside the contract's zone boxes (see
 * `DESK_NUDGE_ZONES` for the no-tear derivation): rigid rotations for the rockers, a scale field
 * for the jelly, a rim-lever field for the rattle, a smooth neck-weighted bend for the peck. The
 * fields are continuous in rest position and vanish at their own boundaries, so they introduce no
 * new tear class. Zero new meshes, zero new draw calls, zero added GLB bytes.
 *
 * Shading under motion, for the record: `DeskBaked` ships no normals and is unlit — its shading is
 * baked into vertex colours that travel WITH the vertices, so a rocked mug's modelling rocks with
 * it by construction. The two view-dependent materials rotate (metal) or correct (gloss squash)
 * their normals under the same guards. There is no shadow pass in this lab to desync — every
 * shadow is baked into the pad's atlas, and the baked contact shadow staying put under a rocking
 * base is the visual budget the "micro" in micro-animation buys.
 */

// --- the rockers ------------------------------------------------------------

/**
 * A rock: two damped angular axes about the base pivot. `hzZ` may be DETUNED from `hzX` — with a
 * quadrature impulse (`quad`) the two axes trace a slowly rotating ellipse, which is the roly-poly
 * precession; everyone but the penguin runs both at the same frequency and quad 0.
 */
export type RockParams = { hzX: number; hzZ: number; zeta: number; peakDeg: number; quad: number }

export const ROCK_PARAMS: Partial<Record<DeskNudgeKind, RockParams>> = {
  /** 4.5° at 2.9 Hz, up from 3° at 3.4 Hz (T97 S5): measured on the composed frame, the 3° rock
   *  moved the rim ~4 px and crested inside 4 frames — the blind review read it as a one-frame
   *  glitch. Slower and deeper is the same heavy-ceramic voice made legible; the visible life
   *  stays under ~0.5 s (decay ζω = 5.5/s), inside the micro budget. */
  mug: { hzX: 2.9, hzZ: 2.9, zeta: 0.3, peakDeg: 4.5, quad: 0 },
  /** A whisper — the cup's job is to hold still while its pens rattle. */
  pencup: { hzX: 4.2, hzZ: 4.2, zeta: 0.26, peakDeg: 0.8, quad: 0 },
  /** The peck's body recoil only; the peck itself is the bend below. */
  bird: { hzX: 5.8, hzZ: 5.8, zeta: 0.157, peakDeg: 2.0, quad: 0 },
  /** The weeble: deep, slow, lightly damped. The z axis runs 8.3% fast and the impulse sends a
   *  45% quadrature share — together the wobble traces a rotating ellipse (~0.5 rad of axis turn
   *  over the visible life), which is the roly-poly's circling settle. */
  penguin: { hzX: 1.8, hzZ: 1.95, zeta: 0.12, peakDeg: 7.0, quad: 0.45 },
}

/** A hover crossing is a brush, not a tap — every signature scales by this on hover. */
export const HOVER_SCALE = 0.35

/** Below this combined envelope (radians) a rock is DONE and writes exact +0. ~0.02°. */
export const REST_EPS = 0.0004

/** No pile-up: impulses that would swing past this multiple of the authored peak are clamped. */
export const AMP_CAP = 1.75

export type NudgeSpring = { t0: number; x: SpringAxis; z: SpringAxis; active: boolean }

export const restingSpring = (): NudgeSpring => ({
  t0: 0,
  x: { x0: 0, v0: 0 },
  z: { x0: 0, v0: 0 },
  active: false,
})

const TAU = Math.PI * 2

/** The impulse velocity that makes a from-rest response crest at exactly `peakDeg` (on the x-tuned
 *  axis; the quadrature share rides on top for the one kind that has it). */
export function impulseFor(p: RockParams): number {
  const omega = p.hzX * TAU
  const wd = omega * Math.sqrt(1 - p.zeta * p.zeta)
  const tp = Math.atan2(wd, p.zeta * omega) / wd
  const factor = (Math.exp(-p.zeta * omega * tp) * Math.sin(wd * tp)) / wd
  return (p.peakDeg * Math.PI) / 180 / factor
}

const envelopeOf = (s: NudgeSpring, p: RockParams, now: number): number => {
  const tau = now - s.t0
  const wx = p.hzX * TAU
  const wz = p.hzZ * TAU
  const ax = sampleAxis(s.x, wx, p.zeta, tau)
  const az = sampleAxis(s.z, wz, p.zeta, tau)
  const wdx = wx * Math.sqrt(1 - p.zeta * p.zeta)
  const wdz = wz * Math.sqrt(1 - p.zeta * p.zeta)
  return Math.hypot(
    Math.hypot(ax.x, (ax.v + p.zeta * wx * ax.x) / wdx),
    Math.hypot(az.x, (az.v + p.zeta * wz * az.x) / wdz)
  )
}

/**
 * Kick a rock: tip direction `d` (unit, xz), strength 1 for a click, HOVER_SCALE for a hover.
 * VELOCITY-CONTINUOUS: the current state is sampled and the impulse ADDED, so a re-poke stirs the
 * motion instead of restarting it. `quad` sends a share of the impulse to the perpendicular axis a
 * quarter-turn out of phase — with detuned axes that is what makes a weeble circle. Energy-capped.
 */
export function triggerRock(
  s: NudgeSpring,
  p: RockParams,
  now: number,
  dx: number,
  dz: number,
  strength: number
): void {
  const tau = now - s.t0
  const wx = p.hzX * TAU
  const wz = p.hzZ * TAU
  const cx = s.active ? sampleAxis(s.x, wx, p.zeta, tau) : { x: 0, v: 0 }
  const cz = s.active ? sampleAxis(s.z, wz, p.zeta, tau) : { x: 0, v: 0 }
  // rotation about a = up × d tips the top toward d; a = (dz, 0, −dx)
  const v = impulseFor(p) * strength
  let vx = cx.v + v * dz - v * p.quad * dx
  let vz = cz.v - v * dx - v * p.quad * dz
  s.t0 = now
  s.x = { x0: cx.x, v0: vx }
  s.z = { x0: cz.x, v0: vz }
  s.active = true
  const cap = ((p.peakDeg * Math.PI) / 180) * AMP_CAP
  const env = envelopeOf(s, p, now)
  if (env > cap) {
    const k = cap / env
    vx = cx.v + (vx - cx.v) * k
    vz = cz.v + (vz - cz.v) * k
    s.x = { x0: cx.x, v0: vx }
    s.z = { x0: cz.x, v0: vz }
  }
}

/**
 * The rock's uniform for this frame: (axis.x, axis.y, axis.z, angle), angle ≥ 0, axis unit — or
 * exact rest. A spring whose envelope has fallen under REST_EPS is snapped to +0 and deactivated —
 * the law's "always decays back to the authored rest state" made `Object.is`-checkable.
 */
export function sampleRock(s: NudgeSpring, p: RockParams, now: number, out: Float32Array): boolean {
  if (!s.active) return false
  if (envelopeOf(s, p, now) < REST_EPS) {
    s.active = false
    out.fill(0)
    return false
  }
  const tau = now - s.t0
  const ax = sampleAxis(s.x, p.hzX * TAU, p.zeta, tau)
  const az = sampleAxis(s.z, p.hzZ * TAU, p.zeta, tau)
  const m = Math.hypot(ax.x, az.x)
  if (m > 0) {
    out[0] = ax.x / m
    out[1] = 0
    out[2] = az.x / m
    out[3] = m
  } else {
    out.fill(0)
  }
  return true
}

// --- the donut's squish -----------------------------------------------------

/**
 * Jelly, not a solid: a 1-D underdamped spring on a SQUASH scalar. Positive squashes the donut
 * toward the pad and bulges it radially (half as much — sugary, not incompressible); the overshoot
 * swings negative, which is the stretch-tall half of the classic squash-and-stretch jiggle. The
 * poke's direction is deliberately ignored — jelly answers every finger the same way.
 */
export const SQUASH_PARAMS = { hz: 6.0, zeta: 0.13, peak: 0.16 }
export const SQUASH_EPS = 0.002

export type SquashSpring = { t0: number; x0: number; v0: number; active: boolean }
export const restingSquash = (): SquashSpring => ({ t0: 0, x0: 0, v0: 0, active: false })

const squashImpulse = (() => {
  const { hz, zeta, peak } = SQUASH_PARAMS
  const omega = hz * TAU
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const tp = Math.atan2(wd, zeta * omega) / wd
  return peak / ((Math.exp(-zeta * omega * tp) * Math.sin(wd * tp)) / wd)
})()

export function triggerSquash(s: SquashSpring, now: number, strength: number): void {
  const { hz, zeta } = SQUASH_PARAMS
  const omega = hz * TAU
  const cur = s.active ? sampleAxis({ x0: s.x0, v0: s.v0 }, omega, zeta, now - s.t0) : { x: 0, v: 0 }
  s.t0 = now
  s.x0 = cur.x
  s.v0 = Math.min(cur.v + squashImpulse * strength, squashImpulse * AMP_CAP)
  s.active = true
}

/** The squash scalar for this frame, snapped to exact 0 at rest. */
export function sampleSquash(s: SquashSpring, now: number): number {
  if (!s.active) return 0
  const { hz, zeta } = SQUASH_PARAMS
  const omega = hz * TAU
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const cur = sampleAxis({ x0: s.x0, v0: s.v0 }, omega, zeta, now - s.t0)
  if (Math.hypot(cur.x, (cur.v + zeta * omega * cur.x) / wd) < SQUASH_EPS) {
    s.active = false
    return 0
  }
  return cur.x
}

// --- the pens' clatter ------------------------------------------------------
//
// The cup's signature used to live in a CONTINUOUS FIELD here — lateral sway proportional to
// height over the rim, phased by rest position. T100 replaced it with a per-pen RIGID
// displacement, which needs the per-pen identity `desk-station.ts` had already measured; both now
// live in `desk-pens.ts` (one owner, two importers) and are re-exported above. The diagnosis that
// forced the move — 3.6 px of shear at 7 Hz on the measured money shot — is written down there.

// --- the bird's peck --------------------------------------------------------

/**
 * A bird pecks the way it faces, twice, quickly. The motion is a CLAY BEND, not a head sub-zone —
 * the body's dome overlaps any head box (the no-tear condition forbids a rigid split), and a
 * smooth neck-weighted bend is the more honest motion for a clay figurine anyway. The bend angle
 * runs a fast double pulse (peck, lighter peck), and the body takes a 30% recoil on its rock
 * spring so the whole figure answers.
 */
export const PECK = {
  /** Full bend at the first peck's bottom, radians (~19.5°). 0.24 → 0.34 with a slower attack and
   *  release (T97 S5): the shipped double-pulse lived ~0.3 s and read as a flat twitch beside the
   *  penguin's weeble. Deeper, a beat slower, and with a wider gap it reads as peck-peck; the
   *  whole figure is still settled inside the 700 ms budget (pinned by desk-nudge.test.ts). */
  depth: 0.34,
  attack: 0.05,
  release: 0.12,
  /** The second, lighter peck. */
  gap: 0.2,
  second: 0.65,
  /** The neck band: bend weight ramps 0 → 1 across these rest heights. */
  neckLo: 1.48,
  neckHi: 1.7,
  /** The neck pivot line (rotation about world x through this y, z). */
  pivotY: 1.6,
  pivotZ: 9.55,
  recoil: 0.3,
}
export const PECK_EPS = 0.0015

const peckNorm = (() => {
  const t = (Math.log(PECK.release / PECK.attack) * PECK.attack * PECK.release) / (PECK.release - PECK.attack)
  return 1 / (Math.exp(-t / PECK.release) - Math.exp(-t / PECK.attack))
})()

const peckPulse = (tau: number): number =>
  tau <= 0 ? 0 : peckNorm * (Math.exp(-tau / PECK.release) - Math.exp(-tau / PECK.attack))

export type PeckState = { slots: [{ t0: number; amp: number }, { t0: number; amp: number }] }
export const restingPeck = (): PeckState => ({
  slots: [
    { t0: -1e9, amp: 0 },
    { t0: -1e9, amp: 0 },
  ],
})

const peckOf = (slot: { t0: number; amp: number }, now: number): number =>
  slot.amp * (peckPulse(now - slot.t0) + PECK.second * peckPulse(now - slot.t0 - PECK.gap))

/** Two slots overlapped by max(), like the note's press: a re-peck mid-peck deepens, never pops. */
export function triggerPeck(s: PeckState, now: number, strength: number): void {
  const d0 = peckOf(s.slots[0], now)
  const d1 = peckOf(s.slots[1], now)
  s.slots[d0 <= d1 ? 0 : 1] = { t0: now, amp: PECK.depth * strength }
}

/** The bend angle for this frame, snapped to exact 0 once both pulses are spent. */
export function samplePeck(s: PeckState, now: number): number {
  const d = Math.max(peckOf(s.slots[0], now), peckOf(s.slots[1], now))
  if (d < PECK_EPS) return 0
  return d
}

// --- the note's press -------------------------------------------------------

/**
 * Paper: press the curled corner flat and it springs back. A double exponential — fast attack,
 * slower release — normalised so its crest is exactly the requested depth; two slots overlap by
 * max() so a re-press mid-release deepens instead of popping.
 */
export const PRESS_ATTACK = 0.045
/** 0.14 so the release's exponential tail is under 2% of the press by the 700 ms budget. */
export const PRESS_RELEASE = 0.14
export const PRESS_CLICK = 0.7
export const PRESS_HOVER = 0.28
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
  const d0 = pressDepth(s.slots[0], now)
  const d1 = pressDepth(s.slots[1], now)
  s.slots[d0 <= d1 ? 0 : 1] = { t0: now, amp }
}

/** uCurl for this frame: 1 at rest (exactly), dipping toward 1 − depth under a press. Never > 1 —
 *  the corner only ever moves DOWN from its authored curl. */
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
 * shader nothing (`uKick.w` stays 0 behind the same exact-zero discipline as the zones).
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
 * parallax reaches full gain, i.e. when the desk has become the subject. A relation, not a
 * literal, for the reason every gate here is one.
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
 * `worldPerPx` at the zone's depth is 2·dist·tan(fov/2)/frameHeightPx; a box whose extent projects
 * under `minPx` is padded by half the shortfall on both sides. Desktop boxes come back untouched.
 */
export function hitPadFor(extent: number, dist: number, fovDeg: number, heightPx: number, minPx = 44): number {
  const worldPerPx = (2 * dist * Math.tan((fovDeg * Math.PI) / 360)) / heightPx
  const short = minPx * worldPerPx - extent
  return short > 0 ? short / 2 : 0
}

/** Tip direction for a poke at `hit`: away from the poked side, i.e. from the hit point through
 *  the zone's centre, flattened to the desk plane; `fb` (the camera's forward) for dead-centre. */
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

/** One shared vec4 per zone, written once by the driver and read by every material the zone is
 *  registered in, so the bake and the metal can never disagree mid-motion. Semantics per kind:
 *  rockers carry (axis.xyz, angle); the donut carries its squash scalar in w. */
export const NUDGE_UNIFORMS: Record<DeskNudgeKind, { value: Float32Array }> = {
  mug: { value: new Float32Array(4) },
  donut: { value: new Float32Array(4) },
  pencup: { value: new Float32Array(4) },
  bird: { value: new Float32Array(4) },
  penguin: { value: new Float32Array(4) },
}

/** The bird's bend angle: (θ, 0, 0, 0). */
export const BEND_UNIFORM = { value: new Float32Array(4) }
/** ...and the note's one scalar. 1 is the authored curl; a press dips below it, never above. */
export const NOTE_CURL_UNIFORM = { value: 1 }

const f = (v: number): string => v.toFixed(5)

export const zonesForMesh = (mesh: DeskMeshName) =>
  DESK_NUDGE_ZONES.filter((z) => z.meshes.includes(mesh))

type Zone = (typeof DESK_NUDGE_ZONES)[number]

const boxTest = (z: Zone): string =>
  `position.x >= ${f(z.min[0])} && position.x <= ${f(z.max[0])} &&
     position.y >= ${f(z.min[1])} && position.y <= ${f(z.max[1])} &&
     position.z >= ${f(z.min[2])} && position.z <= ${f(z.max[2])}`

/** Rigid rock about the base pivot plus the edge-rock lift (lift = baseR·angle IS the first-order
 *  rock about the base's edge — the far rim stays seated instead of sinking through the desk). */
const rockBlock = (z: Zone, normalVar?: string): string => {
  const [px, py, pz] = z.pivot
  const rot = normalVar
    ? `${normalVar} = ${normalVar} * swC + cross( swAx, ${normalVar} ) * swS + swAx * dot( swAx, ${normalVar} ) * ( 1.0 - swC );`
    : ''
  return `if ( uNudge_${z.kind}.w != 0.0 &&
     ${boxTest(z)} ) {
  vec3 swAx = uNudge_${z.kind}.xyz;
  float swC = cos( uNudge_${z.kind}.w );
  float swS = sin( uNudge_${z.kind}.w );
  vec3 swP = vec3( ${f(px)}, ${f(py)}, ${f(pz)} );
  vec3 swQ = transformed - swP;
  transformed = swP + swQ * swC + cross( swAx, swQ ) * swS + swAx * dot( swAx, swQ ) * ( 1.0 - swC )
    + vec3( 0.0, ${f(z.baseR)} * uNudge_${z.kind}.w, 0.0 );
  ${rot}
}`
}

/** The donut's jelly: squash about the base pivot — y compresses, the radius bulges half as much.
 *  The normal takes the inverse-transpose of the scale so the icing's sheen flattens with it. */
const squashBlock = (z: Zone, normalVar?: string): string => {
  const [px, py, pz] = z.pivot
  const nrm = normalVar
    ? `${normalVar} = normalize( vec3( ${normalVar}.x / swR, ${normalVar}.y / swY, ${normalVar}.z / swR ) );`
    : ''
  return `if ( uNudge_${z.kind}.w != 0.0 &&
     ${boxTest(z)} ) {
  float swY = 1.0 - uNudge_${z.kind}.w;
  float swR = 1.0 + 0.5 * uNudge_${z.kind}.w;
  transformed.y = ${f(py)} + ( transformed.y - ${f(py)} ) * swY;
  transformed.xz = vec2( ${f(px)}, ${f(pz)} ) + ( transformed.xz - vec2( ${f(px)}, ${f(pz)} ) ) * swR;
  ${nrm}
}`
}

/** The pens' clatter: five rigid per-pen displacements, selected by `gl_VertexID` range and
 *  levered about each pen's own crossing of the cup rim. Built in `desk-pens.ts`, where the
 *  geometry it reads also lives. */
const clatterBlock = (mesh: DeskMeshName): string =>
  mesh === 'DeskBaked' || mesh === 'DeskMetal' ? penClatterVertexBlock(mesh) : ''

/** The bird's peck: a clay bend about the neck line, weight ramping smoothly over the neck band —
 *  no rigid split of a merged body, no tear possible from a continuous field. */
const bendBlock = (z: Zone): string =>
  `if ( uBend_bird.x != 0.0 &&
     ${boxTest(z)} ) {
  float swW = smoothstep( ${f(PECK.neckLo)}, ${f(PECK.neckHi)}, position.y );
  if ( swW > 0.0 ) {
    float swTh = uBend_bird.x * swW;
    float swC = cos( swTh );
    float swS = sin( swTh );
    vec2 swYZ = transformed.yz - vec2( ${f(PECK.pivotY)}, ${f(PECK.pivotZ)} );
    transformed.yz = vec2( ${f(PECK.pivotY)}, ${f(PECK.pivotZ)} ) + vec2( swYZ.x * swC - swYZ.y * swS, swYZ.x * swS + swYZ.y * swC );
  }
}`

const blocksFor = (z: Zone, mesh: DeskMeshName, normalVar?: string): string => {
  switch (z.kind) {
    case 'donut':
      return squashBlock(z, normalVar)
    case 'pencup':
      // the cup rocks as a body; its PENS are displaced one by one, after it (deep-then-micro
      // order is irrelevant here — the two touch disjoint vertex sets by construction)
      return rockBlock(z, normalVar) + '\n' + clatterBlock(mesh)
    case 'bird':
      return rockBlock(z, normalVar) + '\n' + bendBlock(z)
    default:
      return rockBlock(z, normalVar)
  }
}

export type NudgeChunk = {
  decl: string
  body: string
  uniforms: Record<string, { value: Float32Array }>
}

/**
 * The vertex-shader block for one mesh: per zone, a rest-position box test and that object's OWN
 * field — rock, squash, rattle or bend. Boxes, pivots and field constants are compile-time
 * literals (they are measurements — see the contract); only the per-frame scalars cross as
 * uniforms. THE GUARD IS THE LAW: at exact zero every vertex takes the untouched path, so a
 * pointerless scrub is bit-identical by construction.
 */
export function nudgeVertexChunk(mesh: DeskMeshName, normalVar?: string): NudgeChunk {
  const zones = zonesForMesh(mesh)
  const uniforms: Record<string, { value: Float32Array }> = {}
  const decls: string[] = []
  for (const z of zones) {
    uniforms[`uNudge_${z.kind}`] = NUDGE_UNIFORMS[z.kind]
    decls.push(`uniform vec4 uNudge_${z.kind};`)
    if (z.kind === 'pencup') {
      uniforms.uPenClatter = RATTLE_UNIFORM
      decls.push(PEN_CLATTER_DECL)
    }
    if (z.kind === 'bird') {
      uniforms.uBend_bird = BEND_UNIFORM
      decls.push('uniform vec4 uBend_bird;')
    }
  }
  return {
    decl: decls.join('\n'),
    body: zones.map((z) => blocksFor(z, mesh, normalVar)).join('\n'),
    uniforms,
  }
}

/**
 * The normal-only twin, for `MeshStandardMaterial`: its chunk order consumes `objectNormal` in
 * `defaultnormal_vertex` BEFORE `begin_vertex` runs, so the rotation has to land in
 * `beginnormal_vertex` where the variable is born. The rockers turn normals; so — since T100 — do
 * the PENS, whose clatter became a rigid 11° rotation (the T89 rattle was a pure translation and
 * correctly turned nothing; the rose gold would otherwise slide out from under its own highlight).
 * The squash's hosts are not in the metal mesh.
 */
export function nudgeNormalChunk(mesh: DeskMeshName, normalVar: string): string {
  const rockers = zonesForMesh(mesh)
    .filter((z) => z.kind !== 'donut')
    .map(
      (z) => `if ( uNudge_${z.kind}.w != 0.0 &&
     ${boxTest(z)} ) {
  vec3 swNAx = uNudge_${z.kind}.xyz;
  float swNC = cos( uNudge_${z.kind}.w );
  float swNS = sin( uNudge_${z.kind}.w );
  ${normalVar} = ${normalVar} * swNC + cross( swNAx, ${normalVar} ) * swNS + swNAx * dot( swNAx, ${normalVar} ) * ( 1.0 - swNC );
}`
    )
    .join('\n')
  const pens =
    mesh === 'DeskBaked' || mesh === 'DeskMetal' ? penClatterNormalBlock(mesh, normalVar) : ''
  return pens ? rockers + '\n' + pens : rockers
}
