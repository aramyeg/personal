/**
 * The renewal-front gate — pure scalar math, ZERO imports. A leaf module so both
 * planet.ts (terrainBumpAt, surfaceYAt, the bucketed per-frame morph) and stage.ts
 * can share the gate without an import cycle: stage.ts imports planet's terrain
 * and would cycle if the gate lived there. stage.ts RE-EXPORTS everything here, so
 * `import { renewalGate } from './stage'` remains the public entry (tests + benches
 * import the pure math cheaply from either).
 *
 * The machine (Round 5): the one-shot lap-boundary world morph is replaced by a
 * per-vertex traveling flip. Each surface point flips its content once from
 * variant A (lap-1 spring) to variant B (lap-2 autumn→winter) as the planet turns
 * — and ALWAYS while it is provably occluded, so the girl only ever sees the
 * finished scene arrive over the horizon.
 */

// Primitive geometry constants. PLANET_RADIUS is owned by planet.ts; the value is
// duplicated here (not imported) to keep this a zero-import leaf — importing it
// from planet.ts would form planet→renewal→planet and crash on STANCE_ALPHA's
// eval-time use before planet finished initializing.
const PLANET_RADIUS = 2.2

/** Where the girl stands, in world z (mirrors STANCE_Z historically in stage). */
export const STANCE_Z = 0.75
/** The girl's angular offset from the planet apex, about the x axis. */
export const STANCE_ALPHA = Math.asin(STANCE_Z / PLANET_RADIUS)

const TWO_PI = Math.PI * 2
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
const smoothstep = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/**
 * Flip window (in `rotation − thetaC`, radians). A vertex flips A→B as this offset
 * crosses [FLIP_START, FLIP_START + FLIP_WIDTH], which parks the transition at
 * world angle w = thetaC − rotation ∈ (−2.4, −1.4): the back-bottom, diametrically
 * opposite the 70° view axis. Proven by `.superpowers/sdd/bench/renewal-scan.mjs`
 * against the exact finite camera (dist 5.5·R, fov 38, 20° pitch) with realistic
 * relief + prop tips: the hidden `rotation − thetaC` band is (0.9425, 2.9060);
 * this window sits inside it with 0.4575 / 0.5060 rad of margin, at EVERY latitude nx.
 * (Task 19 first reported (1.31, 2.53) from a coarser prop-tip model; the band above is
 * what the shipped bench measures today, and the window fits inside either one.)
 */
export const FLIP_START = 1.4
export const FLIP_WIDTH = 1.0

/**
 * Wrap a raw local angle (e.g. `atan2(nz, ny)` of a planet-LOCAL direction) into
 * the canonical vertex-theta range [STANCE_ALPHA, STANCE_ALPHA + 2π). The wrap
 * seam then coincides with the band-0 meridian under the girl, which today's
 * longitude-smooth content leaves content-free (Task 20 keeps a neutral band
 * there). Pure; 2π-consistent (any 2π-equivalent input maps to the same output).
 */
export function canonicalTheta(a: number): number {
  let t = a
  while (t < STANCE_ALPHA) t += TWO_PI
  while (t >= STANCE_ALPHA + TWO_PI) t -= TWO_PI
  return t
}

/**
 * A→B flip weight for a vertex at canonical `thetaC` under the unwrapped scroll
 * `rotation` ∈ [0, 4π]. Monotone in rotation, NO mod anywhere, so each vertex
 * flips exactly once across the two laps. Returns EXACTLY 0 before the window and
 * EXACTLY 1 after (smoothstep clamps), so wherever a vertex is on camera — hence
 * outside the window, by the bench — its content is a crisp variant, never a lerp.
 */
export function renewalGate(thetaC: number, rotation: number): number {
  return smoothstep((rotation - thetaC - FLIP_START) / FLIP_WIDTH)
}

/**
 * The active variant at a canonical `thetaC` under the current `rotation`:
 * 0 = A (spring), 1 = B (autumn). One shared 0.5 threshold so no consumer
 * (decks, prop toggles) hand-rolls the comparison.
 */
export function activeVariantAt(thetaC: number, rotation: number): 0 | 1 {
  return renewalGate(thetaC, rotation) >= 0.5 ? 1 : 0
}

/**
 * THE EPILOGUE WINDOW (Task 60) — the same flip, one whole turn later.
 *
 * The journey ends facing band 0, whose variant-B content is the DESERT the girl walked as
 * chapter 4. It must read as continued snow, and no static repaint can do it: the pixels are
 * literally chapter 4's entry. So the affected region gets a THIRD state, and it is switched on
 * by the same machine — one turn further round.
 *
 * Why the proof comes for free: occlusion depends only on where a vertex is on screen, i.e. on
 * `rotation − thetaC` MODULO 2π. The hidden band renewal-scan.mjs proves — q ∈ (0.9425, 2.9060),
 * measured against the finite camera at realistic relief + prop tips — therefore repeats at every
 * q + 2πk. Putting this window at exactly FLIP_START + 2π reuses that band with the SAME margins
 * (0.4575 before, 0.5060 after), one full rotation later, and needs no new hiding place.
 *
 * Two consequences worth stating, because they are what make the mechanism safe rather than
 * merely plausible:
 *  - CHAPTER 4 CANNOT BE CORRUPTED. `epilogueGate > 0` requires q > 7.6832, while a vertex is
 *    visible only for q < 0.9425 + 2π = 7.2257. The desert is therefore untouched everywhere the
 *    visitor can see it, by arithmetic rather than by tuning — during chapter 4 the whole band
 *    still paints gold.
 *  - SCRUB-BACK IS THE SAME PROOF. This is a pure function of rotation with no state and no
 *    hysteresis, so running rotation backwards runs the flip backwards through the identical
 *    window. There is no separate reverse case to prove.
 *
 * The two windows never overlap (2.4 < 7.6832), so a vertex mid-A→B is never also mid-epilogue.
 */
export const EPILOGUE_START = FLIP_START + TWO_PI
export const EPILOGUE_WIDTH = FLIP_WIDTH

/**
 * B→epilogue weight for a vertex at canonical `thetaC` under unwrapped `rotation`. Exactly 0
 * before the window and exactly 1 after, like `renewalGate` — so wherever a vertex is on camera
 * its epilogue state is crisp, never a lerp. Consumers combine it with the epilogue REGION mask
 * (biomes.ts owns how far the snow reaches); outside that region the two states are identical
 * and this gate is a no-op.
 */
export function epilogueGate(thetaC: number, rotation: number): number {
  return smoothstep((rotation - thetaC - EPILOGUE_START) / EPILOGUE_WIDTH)
}

/** Whether the epilogue state has taken over at a canonical `thetaC`. Shares `activeVariantAt`'s
 *  0.5 threshold, so a prop toggle and a vertex agree on when the world changed. */
export function epilogueActiveAt(thetaC: number, rotation: number): boolean {
  return epilogueGate(thetaC, rotation) >= 0.5
}

/**
 * How far the epilogue snow reaches, as a canonical longitude. Derived in biomes.ts (which owns
 * the geography and carries the derivation), and MIRRORED here so this stays a zero-import leaf —
 * the same arrangement STANCE_ALPHA already has. `biomes.test` pins the two equal.
 */
export const EPILOGUE_END = 3.0

/**
 * Which of the three world states a PROP at a canonical longitude should be showing:
 * 0 = A, 1 = B, 2 = epilogue. Props declare the state they belong to and compare.
 *
 * This is the whole prop story for the epilogue: a variant-B prop standing inside the snow field
 * stops matching and hides itself, and an epilogue prop starts matching — both at the epilogue
 * gate's 0.5 crossing, which sits at q = 8.1832, dead centre of the hidden band (0.957 / 1.006 rad
 * of margin either side). So the desert's camels and palms are not removed from the ending; they
 * walk off behind the horizon, and the igloos walk on the same way.
 *
 * Props test the UNTORN span, not the wandering per-vertex curve: the ±0.035 rad tear only decides
 * which side of the handoff a vertex paints, and no prop is placed within 0.2 rad of it. A prop
 * that ever did sit on the tear could disagree with the ground beneath it by a rock's width.
 */
export function sceneVariantAt(thetaC: number, rotation: number): 0 | 1 | 2 {
  if (thetaC < EPILOGUE_END && epilogueActiveAt(thetaC, rotation)) return 2
  return activeVariantAt(thetaC, rotation)
}
