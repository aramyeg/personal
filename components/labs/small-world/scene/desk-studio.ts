import type { EndingState } from '../ending-timeline'

/**
 * THE STUDIO LIGHTS COMING UP (Task 68) — one number, and the argument for where it comes from.
 *
 * ============================================================================
 * WHAT IS ACTUALLY BEING BLENDED
 * ============================================================================
 * Two Blender bakes of the same set: the studio with its four lights nearly out and the room's
 * ambient only partly down (`dim`), and the studio as the approved render has it (`lit`). Not one
 * bake and a multiplier — a dimmer scales every light equally and gives you the same picture
 * darker, where lights COMING UP adds directional modelling and shadows to a flat room. The two
 * ends measured a per-vertex `dim/lit` ratio spanning 0.008 to 0.436 — measured on the SHIPPED
 * COLOR_0/COLOR_1, not on an intermediate bake — which is the number that says they are different
 * light distributions rather than one scaled. (A fifty-fold span, not the five-fold an earlier
 * draft of this line claimed; the argument is stronger than the number that was standing here.)
 *
 * ============================================================================
 * WHY IT IS KEYED ON `zoom` AND NOT ON `t`
 * ============================================================================
 * The desk does not exist, as far as anyone can see, until the camera has begun to withdraw: it is
 * parked below the journey frustum and the pull-back is what brings its back edge into frame. So
 * the beat has to be tied to the thing that reveals it. `zoom` is also the parameter the camera and
 * the sky already run on, which keeps the whole ending on ONE clock — and `ending.zoom` is exactly
 * 0 for the entire journey and the entire still beat, so this is exactly 0 there too.
 *
 * ============================================================================
 * DETERMINISM
 * ============================================================================
 * A pure function of one number, with no clock and no state. `smootherstep(0)` is exactly 0 and
 * `smootherstep(1)` is exactly 1 (1·1·1·(6−15+10)), so both ends are exact rather than asymptotic:
 * the money shot is bit-for-bit the `lit` bake, and every frame of the journey is bit-for-bit the
 * `dim` one. Scrubbing backwards runs the identical arithmetic. `desk-studio.test.ts` pins the
 * forward/backward identity rather than trusting this paragraph.
 */

/**
 * Where the lights start coming up, as a fraction of the pull-back.
 *
 * Not 0. The first sliver of desk to enter the frame should arrive DARK — that is the whole point
 * of having a dim end — and a ramp that starts at the same instant the camera does would already
 * be a few percent up by the time there is anything to see it on.
 */
export const STUDIO_LIGHTS_START = 0.06

/**
 * ...and where they reach full.
 *
 * Not 1, for the opposite reason: the money shot is the LAST frame of the track, and a transition
 * that is still moving when it arrives makes the picture Aram approved a frame that the ending
 * passes through rather than one it lands on. Full by 0.82 leaves the closing fifth of the
 * pull-back settled at the approved studio.
 */
export const STUDIO_LIGHTS_FULL = 0.82

/** Zero in the first and second derivative at both ends — the same easing the stand's rise uses,
 *  and for the same reason: this is a reveal, not a transition, so neither end may be catchable. */
const smootherstep = (t: number): number => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * How far up the studio lights are: 0 is the dim bake, 1 is the approved one.
 *
 * Every consumer — the desk's two materials, the metal's environment, the backdrop's studio mode
 * and the DOM grade's fade — reads THIS, so they can never disagree about how lit the ending is.
 */
export function studioLightsAt(zoom: number): number {
  return smootherstep((zoom - STUDIO_LIGHTS_START) / (STUDIO_LIGHTS_FULL - STUDIO_LIGHTS_START))
}

/** The same, from an ending state — the form the scene components actually call. */
export const studioLightsFor = (ending: EndingState): number => studioLightsAt(ending.zoom)

/**
 * What the metal's environment is worth at the dim end.
 *
 * The matte set gets its two ends from two bakes; the metal has no bake to interpolate, so its
 * dimming is a scalar on the environment it reflects. 0.12 rather than 0 because a metal that
 * reflects nothing is not a dim metal, it is a black hole in the frame — the rose gold has to stay
 * legible as a turned ring the whole way up.
 */
export const STUDIO_ENV_FLOOR = 0.12

/** The environment intensity for the metal props at a given lights-up. */
export const studioEnvIntensity = (lights: number): number =>
  STUDIO_ENV_FLOOR + (1 - STUDIO_ENV_FLOOR) * lights
