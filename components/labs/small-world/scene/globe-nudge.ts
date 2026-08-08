import { AMP_CAP, triggerRock, type NudgeSpring, type RockParams } from './props/desk-nudge'
import { WORLD_RADIUS } from './camera'

/**
 * THE GLOBE ANSWERS THE POINTER (T97 fix S1) — the ending's planet, made touchable, and none of
 * the three.js or React it reaches the screen through. `desk-interactions.tsx` is the plumbing
 * (pick, fire, sample, disarm — the same loop every desk toy rides); `planet.tsx` reads one
 * uniform; `globe-nudge.test.ts` drives THIS module without a canvas.
 *
 * WHY IT ANSWERS. The blind review's S1 finding was an inversion of the scene's own hierarchy:
 * every toy on the desk answers the pointer — the mug clinks, the donut jiggles, the penguin
 * weebles — while the planet, the most inviting object in the frame and the thing the whole
 * journey was ABOUT, answered nothing. No cursor, zero pixel diff on click and drag. The ending
 * poses the world as a desk globe seated in a cradle, and a desk globe you cannot nudge is a
 * picture of one.
 *
 * WHY THESE ARE THE T89 CLOSED FORMS AND NOT NEW PHYSICS. The desk-interaction law
 * (`desk-nudge.ts`, header) already prices exactly this class of motion: pointer-initiated,
 * deterministic closed forms on the armed clock, always decaying to EXACT rest, inert under
 * reduced motion, exact-zero guarded so a scrub with the pointer parked is bit-identical to a
 * build without the feature. A second spring implementation would be a second thing to prove;
 * `triggerRock`/`sampleRock` are already proven (velocity-continuous re-pokes, the AMP_CAP
 * energy clamp, the +0 snap below REST_EPS), so the globe is one more `RockParams` voice in the
 * same family — the heaviest one. Slow (1.35 Hz where the mug runs 2.9) and lightly damped
 * (ζ = 0.2), because mass is a frequency statement; and with the z axis detuned 7.4% fast plus a
 * 35% quadrature share, the settling wobble PRECESSES in its cradle — the penguin's mechanism at
 * a fraction of the amplitude, a globe circling its bearing rather than metronoming.
 *
 * THE T90 AMPLITUDE CONSTRAINT. The planet's shading is baked (T90): at the parked rotation it is
 * effectively SURFACE-ATTACHED, so a large rotation of the group would visibly carry the lit side
 * around the ball and break the studio's light direction. The peak is therefore small by design:
 * `peakDeg` 3.0°, and even under the re-poke energy cap the envelope cannot pass
 * peakDeg · AMP_CAP = 5.25° — small enough that the lit side visibly stays put while the globe
 * still reads as nudged. The pin lives in `globe-nudge.test.ts`, not in a comment.
 *
 * ...AND THE ONE CLAUSE THE GLOBE ADDS TO KEEP IT. `triggerRock`'s AMP_CAP clamp rescales only the
 * FRESH impulse, which is airtight for the fast desk rockers — their re-pokes arrive a large
 * fraction of a period apart, out of phase, so capped additions cannot stack — but the globe is
 * SLOW: at 1.35 Hz, pokes 50 ms apart are only 24° of phase apart, nearly coherent, and the
 * leaked envelope measured 8° on the bench, past the T90 ceiling. So `triggerGlobeRock` runs the
 * family trigger and then clamps the TOTAL envelope exactly onto the cap — by rescaling
 * VELOCITIES ONLY (the positions are the visible state; untouched, so the clamp can never pop the
 * angle mid-wobble). Deterministic arithmetic like everything else here, and the reason the 6°
 * ceiling is a guarantee rather than a hope.
 *
 * WHY REST IS EXACT. `sampleRock` snaps the uniform to +0 below REST_EPS and deactivates the
 * spring, and `planet.tsx` guards the premultiply behind `angle !== 0` — so at rest the group's
 * pose arithmetic is the UNTOUCHED path, `Object.is`-checkable, and the ending's scroll-purity
 * sweeps survive unchanged.
 */

/** The globe's voice: the heaviest rocker on the desk. See the header for every number's why. */
export const GLOBE_ROCK: RockParams = { hzX: 1.35, hzZ: 1.45, zeta: 0.2, peakDeg: 3.0, quad: 0.35 }

/** (axis.x, axis.y, axis.z, angle) — one writer (desk-interactions' frame loop), one reader
 *  (planet.tsx). All-zero IS rest: the reader's exact-zero guard takes the untouched path. */
export const GLOBE_UNIFORM = { value: new Float32Array(4) }

const TAU = Math.PI * 2

/**
 * Kick the globe: the T89 family trigger, then the hard envelope clamp the header derives. The
 * clamp is exact — env is 2-homogeneous in (x0, b), so with positions held fixed the velocity
 * share is solved in closed form to land env² on cap² — and it is inductively sound: positions
 * never exceed a cap-bounded envelope's reach, so `cap² − Σx0²` cannot go negative (the
 * `Math.max` is float armour, not a code path).
 */
export function triggerGlobeRock(
  s: NudgeSpring,
  now: number,
  dx: number,
  dz: number,
  strength: number
): void {
  triggerRock(s, GLOBE_ROCK, now, dx, dz, strength)
  const cap = ((GLOBE_ROCK.peakDeg * Math.PI) / 180) * AMP_CAP
  const root = Math.sqrt(1 - GLOBE_ROCK.zeta * GLOBE_ROCK.zeta)
  const wdx = GLOBE_ROCK.hzX * TAU * root
  const wdz = GLOBE_ROCK.hzZ * TAU * root
  const zwx = GLOBE_ROCK.zeta * GLOBE_ROCK.hzX * TAU
  const zwz = GLOBE_ROCK.zeta * GLOBE_ROCK.hzZ * TAU
  const bx = (s.x.v0 + zwx * s.x.x0) / wdx
  const bz = (s.z.v0 + zwz * s.z.x0) / wdz
  const pos2 = s.x.x0 * s.x.x0 + s.z.x0 * s.z.x0
  const b2 = bx * bx + bz * bz
  if (pos2 + b2 <= cap * cap) return
  const kb = b2 > 0 ? Math.sqrt(Math.max(cap * cap - pos2, 0) / b2) : 0
  s.x = { x0: s.x.x0, v0: kb * bx * wdx - zwx * s.x.x0 }
  s.z = { x0: s.z.x0, v0: kb * bz * wdz - zwz * s.z.x0 }
}

/**
 * Analytic ray vs the world sphere (centre origin, radius WORLD_RADIUS): the standard quadratic,
 * nearest non-negative root — and if the ray STARTS inside the ball, the exit point, so a poke is
 * never lost to a degenerate entry. No 44 px pad, deliberately: the globe's screen target is
 * hundreds of pixels at the ending, and padding it would only steal near-misses from the desk.
 */
export function globeRayHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number
): { t: number; point: [number, number, number] } | null {
  const a = dx * dx + dy * dy + dz * dz
  if (a === 0) return null
  const b = 2 * (ox * dx + oy * dy + oz * dz)
  const c = ox * ox + oy * oy + oz * oz - WORLD_RADIUS * WORLD_RADIUS
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const sq = Math.sqrt(disc)
  const t1 = (-b - sq) / (2 * a)
  const t2 = (-b + sq) / (2 * a)
  const t = t1 >= 0 ? t1 : t2
  if (t < 0) return null
  return { t, point: [ox + dx * t, oy + dy * t, oz + dz * t] }
}
