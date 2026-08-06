import { CHAPTER_COUNT } from '../chapters'
import {
  BURST_END,
  CHAPTER_SLICE,
  PANEL_END,
  PARK_FRAC,
  chapterStartRotation,
  rotationAt,
  smoothstep,
} from '../journey-timeline'
import { PALETTE } from '../palette'
import { BOUNDARY_WANDER, MERIDIANS, boundaryWander } from '../scene/biomes'
import { STANCE_ALPHA } from '../scene/renewal'

/**
 * Task 55 — CINEMATIC BIOME GRADE (the numbers).
 *
 * Each chapter casts a mood over the WHOLE page, brought in around the moment the traveller
 * arrives at its checkpoint — "the mascots bring it in". This module owns the six authored moods
 * and the pure progress → strength mapping. Three consumers read it and nothing else does:
 *   • scene/sky.tsx             — repaints the backdrop gradient (the background colour shift)
 *   • scene/biome-atmosphere.tsx — tints the key + ambient light (the cinematic shading proper)
 *   • overlay/biome-grade.tsx   — the document-level haze + vignette above the canvas
 *
 * WHY THE GRADE LIVES IN THE SCENE AND NOT IN A DOM VEIL. The first cut was a single tinted
 * overlay across the frame. It read as fog: it drained the corner mascots (a scarlet macaw went
 * brown-green) and left a bright halo where the planet had to be masked out of it. Colour that
 * arrives as LIGHT does what a film grade does instead — every clay figure keeps its own hue and
 * simply sits under the biome's light, and the backdrop can move a long way without touching the
 * things in front of it. So the sky and the lights carry the mood, and the DOM layer is left with
 * only what a lens does: a whisper of haze and an edge falloff.
 *
 * THE RAILS. `lightMix` is the one that decides whether the world still reads as its own clay —
 * capped at LIGHT_MIX_MAX and always a mix toward a PALE colour, so it tints illumination rather
 * than repainting material. Card text is never touched at all: the DOM layer mounts first in the
 * overlay, so the panels paint above it.
 *
 * TIMING — THE SKY CHANGES WITH THE GROUND UNDER HER FEET (Task 59). Aram: "right when scrolling
 * and our girl passes to the new biome, the mood shift should happen there and carry on towards
 * the next checkpoint when the cards are shown."
 *
 * So the crossfade is keyed to the moment the girl's lane crosses the painted boundary onto the
 * new wedge — see LANE_CROSSINGS for how those six rotations are derived — and it runs over a
 * fixed span of ROTATION from there. Rotation, not scroll progress, is the keying variable, and
 * that one choice buys three things that used to need machinery:
 *
 *   1. The mood cannot move while a checkpoint is parked. `rotationAt` freezes rotation for the
 *      whole dwell, so the cards, the mascots and the "!" all land under a mood that is not only
 *      already arrived but provably STILL. No arrival clock is needed to carry the crossfade over
 *      T54's scroll absorption, because there is nothing left to carry.
 *   2. Before her lane reaches the boundary the mood is EXACTLY the old biome's, to the byte (the
 *      previous crossfade has long since saturated). Girl on old terrain ⇒ old mood, with no
 *      tolerance in the claim.
 *   3. It is a pure function of one number. Forward and backward scrubs are bit-identical by
 *      construction and preemption is not expressible.
 *
 * WHAT THIS REPLACED, AND WHY NONE OF IT SURVIVES. Until Task 59 the crossfade sat on the FINAL
 * APPROACH to each checkpoint (a local-progress window ending inside the dwell), which meant it
 * had to survive T54's absorption: the arrival clock was folded in as a PULL toward the revealed
 * chapter's mood, that pull needed a proximity weight to stop preemption releasing its stored
 * displacement in one frame, and the weight needed the dwell geometry derived from the timeline.
 * Three layers of correction, all of them consequences of keying the mood to an event (the
 * arrival) that scroll alone cannot finish. Keyed to the boundary the crossfade is over long
 * before the absorption starts, so `moodBlendAt` takes no reveal at all now and the pull,
 * the proximity weight and the dwell derivation are deleted rather than fixed.
 *
 * On top of the crossfade the whole grade BLOOMS: full strength through the checkpoint and its
 * dwell, resting at BLOOM_FLOOR between them, so each arrival gets a swell of its own. It stays
 * keyed to local PROGRESS — a slow envelope across a whole leg rather than a thing that happens at
 * a place.
 *
 * TASK 73 MOVED THE CHECKPOINT, AND BOTH HALVES HAD TO FOLLOW. The stop used to be at the END of a
 * chapter's rotation slice, which put the card over the NEXT biome; it is at `PARK_FRAC` of the
 * slice now. That change alone would have traded a scenery mismatch for a colour one — the
 * crossfade had a whole slice to finish in and now has 21% of one, so a card would have opened
 * three quarters of the way back at the previous chapter's grade. So `MOOD_SPAN_FRAC` is solved
 * from `PARK_FRAC` rather than chosen (see below), and the bloom's window is re-tied to the beats
 * it exists for rather than to the numbers it used to sit at. Every card opening under its own
 * chapter's fully-arrived mood is asserted per chapter, not on average.
 */

/** Kill switch for the entire grade — sky, lights and overlay — for a clean A/B. */
export const SHOW_GRADE = true

export type BiomeMood = {
  /** Journey order: spring, jungle, delta, desert, canyon, winter. */
  readonly id: string
  /** Colour the high backdrop is pulled toward. */
  readonly sky: string
  /** Colour the low horizon band is pulled toward — the light behind the little world. */
  readonly glow: string
  /** 0..1 how far the backdrop travels toward those two at full strength. */
  readonly skyMix: number
  /** Pale colour the scene's key + ambient light are tinted toward. */
  readonly cast: string
  /** 0..1 how far the lights travel toward `cast` — the identity rail lives here. */
  readonly lightMix: number
  /** Opacity of the document-level haze above the canvas. */
  readonly hazeAlpha: number
  /** Opacity of the document-level edge vignette. */
  readonly vignetteAlpha: number
}

/**
 * Hard rails on how far a mood may be pushed. Tripwires, not tuning knobs: LIGHT_MIX_MAX is what
 * keeps the planet's biome palettes recognisable and the girl out of a tint, and HAZE_ALPHA_MAX
 * is what keeps the mascots' own colours from being veiled the way the first cut veiled them.
 */
export const SKY_MIX_MAX = 0.7
export const LIGHT_MIX_MAX = 0.42
export const HAZE_ALPHA_MAX = 0.12
export const VIGNETTE_ALPHA_MAX = 0.28

/**
 * The UNGRADED colours every mood is mixed out of — the backdrop's two gradient stops and the two
 * lights, as they stand with the grade switched off. Named here rather than reached for out of the
 * palette by each consumer so that there is exactly one place that says what the grade mixes FROM;
 * `resolvedMood` below then resolves what a checkpoint actually puts on screen, and the
 * distinctness gate can be written against that rather than against raw palette entries. For the
 * SKY that resolution is exact — the shader shows those bytes; for the light it is the colour the
 * renderer computes before the material and the toon ramp have their say.
 */
export const GRADE_BASE = {
  sky: PALETTE.sky,
  glow: PALETTE.horizon,
  key: PALETTE.keyWarm,
  ambient: PALETTE.ambientBase,
} as const

/**
 * sRGB transfer functions, matching three.js's own (`SRGBToLinear` / `LinearToSRGB` in Color.js)
 * down to its 0.41666 exponent.
 *
 * They are here because THE TWO HALVES OF THE GRADE MIX IN DIFFERENT SPACES, and a gate that
 * ignores that measures a colour the renderer never produces. `sky.tsx` carries its stops as bare
 * `THREE.Vector3` components through a `ShaderMaterial` that writes `gl_FragColor` directly, with
 * no output-encoding chunk — so the backdrop crossfades in GAMMA-encoded sRGB. The lights are
 * `THREE.Color`, and with `ColorManagement` enabled (three.js's default since r152) a hex string
 * is converted to linear working space on assignment, so `Color.lerp` interpolates LINEARLY.
 */
const srgbToLinear = (c: number): number =>
  c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4)
const linearToSrgb = (c: number): number =>
  c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055

/** Channel lerp in LINEAR light, returned as an `#RRGGBB` sRGB string — what `Color.lerp` gives. */
export function mixHexLinear(from: string, to: string, t: number): string {
  const k = clamp01(t)
  const a = parseInt(from.slice(1), 16)
  const b = parseInt(to.slice(1), 16)
  let out = '#'
  for (const shift of [16, 8, 0]) {
    const ca = srgbToLinear(((a >> shift) & 255) / 255)
    const cb = srgbToLinear(((b >> shift) & 255) / 255)
    out += Math.round(linearToSrgb(ca + (cb - ca) * k) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  }
  return out
}

/**
 * ADJACENT-PAIR DISTINCTNESS (Task 57) — the rail that keeps every arrival an event.
 *
 * Round 16 opened on Aram's report that "the cinematic color change is not happening during each
 * checkpoint, but rather during each 2 checkpoints". Nothing in the mechanism was broken: driven
 * by real wheel events with hands off, every checkpoint landed byte-exactly on its own mood. The
 * defect was in the COLOURS. Measured as CIEDE2000 between what consecutive parked checkpoints
 * actually put on screen, the five adjacent transitions ran 33.6 / 7.3 / 29.8 / 18.4 / 29.7 — so
 * arrivals 2, 4 and 6 announced themselves and arrivals 3 and 5 did not, which is exactly the
 * every-other-checkpoint rhythm reported. Jungle and delta had both resolved to greenish teals
 * and desert and canyon to two ambers, because a mood's distance from its neighbour is a property
 * of the colour AFTER it has been mixed into the cream base, not of the palette hex.
 *
 * The thresholds are derived from that labelled evidence rather than from a textbook JND (which
 * is about colours seen side by side; these are separated by seconds of scrolling). Each dial's
 * accepted and rejected pairs bracket a decision boundary, and the gate sits inside the bracket:
 *   sky   — rejected at 7.3 and 18.4, accepted at 29.7 / 29.8 / 33.6  → boundary in (18.4, 29.7)
 *   light — rejected at 4.2 and 5.8,  accepted at 12.2 / 12.5 / 12.7  → boundary in (5.8, 12.2)
 * Each gate then sits at the middle of its own bracket, clear of both bands.
 *
 * The light's numbers are SMALLER than the sky's for two compounding reasons, and both are
 * structural rather than a sign the light is doing less: LIGHT_MIX_MAX and the pale-cast rule keep
 * every cast near the same cream, and the lights interpolate in LINEAR light, which compresses
 * differences between pale colours further still. desert→canyon is the hardest pair on that dial,
 * since both biomes are warm by identity, and ~10 is about all it can reach inside the rails.
 *
 * Tripwires, not targets: the shipped set clears them at 30.4 and 10.0. A retune that walks a mood
 * back into its neighbour's family fails in grade-mood.test.ts, which also keeps the pre-Task-57
 * colours as a fixture so the gate is proven to have teeth rather than merely asserted to.
 */
export const MOOD_SKY_MIN_DE = 24
export const MOOD_LIGHT_MIN_DE = 9

/**
 * What a PARKED checkpoint puts on screen: the mood mixed into the ungraded base. At a checkpoint
 * the bloom is 1 and the arrival pull is 1, so these are the values `scene/sky.tsx` writes into its
 * high backdrop stop and `scene/biome-atmosphere.tsx` writes into the key light — each mixed the
 * way ITS OWN consumer mixes it, which is not the same way. The sky is a gamma-space lerp of raw
 * components bound for a bare `gl_FragColor`; the key is a `THREE.Color.lerp`, and that runs in
 * linear working space. Mixing both in gamma reads plausible and is wrong by up to ~5 bytes a
 * channel on the light — enough to move an adjacent-pair distance by a whole point of dE.
 */
export function resolvedMood(mood: BiomeMood): { sky: string; key: string } {
  return {
    sky: mixHex(GRADE_BASE.sky, mood.sky, mood.skyMix),
    key: mixHexLinear(GRADE_BASE.key, mood.cast, mood.lightMix),
  }
}

/** Journey-order moods. Chapter → wedge is fixed by the scene mounts (see peeker-stage.ts). */
export const BIOME_MOODS: readonly BiomeMood[] = [
  // Spring opens the journey and has to feel like today's page: the mood is present but nearly
  // weightless, so the grade properly announces itself for the first time at the jungle.
  {
    id: 'spring',
    sky: PALETTE.gradeSpringSky,
    glow: PALETTE.gradeSpringGlow,
    skyMix: 0.34,
    cast: PALETTE.gradeSpringCast,
    lightMix: 0.12,
    hazeAlpha: 0.03,
    vignetteAlpha: 0.1,
  },
  {
    id: 'jungle',
    sky: PALETTE.gradeJungleSky,
    glow: PALETTE.gradeJungleGlow,
    skyMix: 0.66,
    cast: PALETTE.gradeJungleCast,
    lightMix: 0.36,
    hazeAlpha: 0.06,
    vignetteAlpha: 0.24,
  },
  // The delta is deliberately the LIGHT one between two darker neighbours. Reading it as a second
  // dark teal is what made chapter 3 announce nothing after the jungle; out on open water the air
  // is bright and hazy, which is both truer to the biome and the largest separation available.
  {
    id: 'delta',
    sky: PALETTE.gradeDeltaSky,
    glow: PALETTE.gradeDeltaGlow,
    skyMix: 0.6,
    cast: PALETTE.gradeDeltaCast,
    lightMix: 0.36,
    hazeAlpha: 0.07,
    vignetteAlpha: 0.22,
  },
  {
    id: 'desert',
    sky: PALETTE.gradeDesertSky,
    glow: PALETTE.gradeDesertGlow,
    skyMix: 0.58,
    cast: PALETTE.gradeDesertCast,
    lightMix: 0.3,
    hazeAlpha: 0.06,
    vignetteAlpha: 0.18,
  },
  // Canyon spends the light headroom deliberately. Desert and canyon are both warm by identity, so
  // the pale-cast rail leaves their two lights closer together than any other adjacent pair can
  // be; the sky and the horizon glow carry most of this arrival, and `lightMix` at 0.40 buys back
  // what is left. Raising `skyMix` instead would only mix further into the cream base, which is
  // what made the frame go gloomy rather than ember when this was first tried.
  {
    id: 'canyon',
    sky: PALETTE.gradeCanyonSky,
    glow: PALETTE.gradeCanyonGlow,
    skyMix: 0.62,
    cast: PALETTE.gradeCanyonCast,
    lightMix: 0.4,
    hazeAlpha: 0.07,
    vignetteAlpha: 0.26,
  },
  {
    id: 'winter',
    sky: PALETTE.gradeWinterSky,
    glow: PALETTE.gradeWinterGlow,
    skyMix: 0.6,
    cast: PALETTE.gradeWinterCast,
    lightMix: 0.34,
    hazeAlpha: 0.06,
    vignetteAlpha: 0.2,
  },
]

const TWO_PI = Math.PI * 2

/**
 * THE SIX LANE CROSSINGS — the rotations at which the ground under the girl's feet becomes the
 * next biome's. Derived here from the geometry that owns each piece, never restated:
 *
 *  • WHERE SHE IS. The girl is fixed at the stance; the planet turns under her. The planet-local
 *    longitude beneath her feet is `rotation + STANCE_ALPHA` (stage.chapterTheta), and she walks
 *    the great circle at latitude nx = 0 (biomes.ts's coordinate note).
 *  • WHERE THE PAINT CHANGES. Abutting wedges meet at a TORN curve, not at the ruled meridian:
 *    `paintBand` hard-switches at `MERIDIANS[i] + boundaryWander(nx, i, BOUNDARY_WANDER)`. At her
 *    lane that offset is `boundaryWander(0, i, …)` — small (|·| ≤ 0.018 rad) but SIGNED, and the
 *    sign is what makes this worth deriving instead of eyeballing: meridians 0 and 2 lean one way
 *    and meridian 1 leans the other, so four crossings fall a hair AFTER their chapter's start
 *    rotation and TWO fall before it — before the checkpoint that precedes them, in fact, since
 *    rotation stops at exactly that meridian for the dwell. The crossfade-window suite measures
 *    what that costs (5.1e-4 of one crossfade, frozen) and why it is not a margin problem.
 *  • WHICH LAP. A band carries a different scene on each lap, so chapter c needs band c % 3 AND
 *    variant floor(c / 3). Under the lane the variant flips exactly as the unwrapped rotation
 *    passes a multiple of 2π: `canonicalTheta` wraps there, which sends `rotation − thetaC`
 *    straight past renewalGate's window in one step. Hence the max: chapter 3 is only reached
 *    once BOTH the lap and the paint have turned over. (Today the paint term wins by 12.9 mrad,
 *    so there is a sliver of B2 winter paint under her between the delta and the desert; if the
 *    band-0 wander ever went negative the max would correctly pick the lap instead.)
 *
 * `chapterStartRotation(c) + STANCE_ALPHA` lands on `MERIDIANS[c % 3]` only because the chapter
 * slice and the band span are the same angle. That is a real coupling between the timeline and the
 * biome map, so it is asserted in grade-mood.test.ts rather than assumed here.
 */
export function crossingRotation(chapter: number): number {
  const bands = MERIDIANS.length
  const i = ((chapter % bands) + bands) % bands
  const lap = Math.floor(chapter / bands)
  const paint =
    MERIDIANS[i] - STANCE_ALPHA + lap * TWO_PI + boundaryWander(0, i, BOUNDARY_WANDER)
  return Math.max(lap * TWO_PI, paint)
}

/** The six crossings, resolved once. Strictly increasing (pinned in the tests). */
export const LANE_CROSSINGS: readonly number[] = Array.from({ length: CHAPTER_COUNT }, (_, c) =>
  crossingRotation(c)
)

/**
 * How far the crossfade LEADS its chapter's start, in slice units — the wander on the torn
 * boundary, which is signed and differs per meridian. Taken as the WORST case across the six so
 * the span below is safe for all of them rather than for the average.
 */
const MAX_CROSSING_LEAD = Math.max(
  0,
  ...Array.from(
    { length: CHAPTER_COUNT },
    (_, c) => (crossingRotation(c) - chapterStartRotation(c)) / CHAPTER_SLICE
  )
)

/**
 * Fraction of the approach the crossfade is allowed to use.
 *
 * Spent generously ON PURPOSE, because the stillness margin does not have to come out of here.
 * Rotation freezes at `TRAVEL_END` and the cards do not open until `BURST_END`, so there is a
 * whole BURST_SPAN of leg — 0.10, nearly half the approach again — in which the mood is frozen at
 * whatever it reached, before the reader ever sees a card. The approach is therefore better spent
 * making the crossfade as gradual as the geometry allows than on a second margin behind the one
 * the burst already provides. The 15% left over is the arrival's own headroom against the wander.
 */
const MOOD_SATURATION_MARGIN = 0.85

/**
 * How much of a chapter's ROTATION slice the crossfade takes, measured from that chapter's
 * crossing — SOLVED, since Task 73, rather than chosen.
 *
 * The rails have not changed but one of them got much tighter. It must still saturate before the
 * next crossing (trivially true now). And it must still COMPLETE before she stops — except that
 * she now stops at `PARK_FRAC` of the slice rather than at the end of it, so the whole crossfade
 * has to fit inside the approach instead of having a whole slice to play with. At the old 0.65 the
 * card would have opened at mix ≈ 0.246, i.e. three quarters of the way back at the PREVIOUS
 * chapter's grade: a card describing the canyon, read under the desert's light. That is the trade
 * the framing fix would have made if this number had been left alone — scenery mismatch swapped
 * for a colour one — which is why the two had to ship together.
 *
 * So: the approach is `PARK_FRAC`, the crossing can lead it by `MAX_CROSSING_LEAD`, and the
 * crossfade takes `MOOD_SATURATION_MARGIN` of what is left. Every card then opens at mix exactly
 * 1, asserted per chapter in grade-mood.test.ts.
 *
 * WHAT THIS COSTS, stated plainly: the shift is a faster beat than it was — about 1.4% of the
 * scroll track against 5.9%. That is structural, not a regression to tune away. The law it obeys
 * is Aram's ("right when scrolling and our girl passes to the new biome, the mood shift should
 * happen there"), the approach is short by design now, and the only way to make the crossfade long
 * again would be to start it BEFORE she crosses — which is the one thing that law forbids.
 */
export const MOOD_SPAN_FRAC = (PARK_FRAC - MAX_CROSSING_LEAD) * MOOD_SATURATION_MARGIN
export const MOOD_SPAN_ROT = MOOD_SPAN_FRAC * CHAPTER_SLICE

/** Strength the grade settles back to between checkpoints — the bloom's resting level. */
export const BLOOM_FLOOR = 0.84
/**
 * The bloom's window, in a chapter's LOCAL PROGRESS, RE-DERIVED for Task 73's segment shape.
 *
 * The envelope's job never changed: full strength through the checkpoint and its dwell, resting at
 * BLOOM_FLOOR between them, so each arrival gets a swell of its own. What changed is where the
 * checkpoint IS. It used to sit at the END of a segment, so the bloom rose across [0.42, 0.72] and
 * settled over the next chapter's first 0.3. The dwell is now at [0.226, 0.526] — near the front —
 * and that old window would have swelled the grade AFTER the cards had gone.
 *
 * So both ends are tied to the beats they exist for rather than to numbers: full by the moment the
 * "!" pops, held for exactly as long as the cards are up, then released across the long walk out.
 * The fall completes with 30% of the release leg to spare, so the grade is provably resting before
 * the next boundary hands it a new pair to crossfade.
 *
 * Continuity across the segment seam is what makes chapter boundaries invisible, and it still
 * holds by construction: `bloomAt(1)` and `bloomAt(0)` are both exactly BLOOM_FLOOR.
 */
export const BLOOM_RISE_END = BURST_END
export const BLOOM_FALL_START = PANEL_END
export const BLOOM_FALL_END = PANEL_END + (1 - PANEL_END) * 0.7

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/**
 * sRGB channel lerp between two `#RRGGBB` strings, emitted in the palette's uppercase form so a
 * fully-crossfaded mood compares equal to the palette entry it came from.
 */
export function mixHex(from: string, to: string, t: number): string {
  const k = clamp01(t)
  const a = parseInt(from.slice(1), 16)
  const b = parseInt(to.slice(1), 16)
  let out = '#'
  for (const shift of [16, 8, 0]) {
    const ca = (a >> shift) & 255
    const cb = (b >> shift) & 255
    out += Math.round(ca + (cb - ca) * k)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  }
  return out
}

/**
 * Strength envelope across one chapter: rises from BLOOM_FLOOR as she walks into the biome, is
 * fully in by the "!", holds for the whole dwell, then releases back to the floor across the walk
 * out. Continuous at both ends (BLOOM_FLOOR at local 0 and at local 1), so chapter boundaries are
 * invisible.
 */
export function bloomAt(local: number): number {
  const l = clamp01(local)
  if (l < BLOOM_RISE_END) return BLOOM_FLOOR + (1 - BLOOM_FLOOR) * smoothstep(l / BLOOM_RISE_END)
  if (l < BLOOM_FALL_START) return 1
  const fall = smoothstep((l - BLOOM_FALL_START) / (BLOOM_FALL_END - BLOOM_FALL_START))
  return 1 - (1 - BLOOM_FLOOR) * fall
}

export type MoodBlend = {
  /** Chapter the JOURNEY is in — the bloom's basis. Not necessarily the wedge she is standing on:
   *  around a crossing those differ, which is the whole point of Task 59. Use `toIndex` for that. */
  chapter: number
  /** The planet's unwrapped rotation here — what the crossfade is actually keyed to. */
  rotation: number
  /**
   * Indices of `from` and `to` in BIOME_MOODS. Consumers that keep their own parallel colour
   * tables (the scene ones do, to avoid per-frame allocation) MUST index with these rather than
   * re-derive `chapter - 1` — otherwise a change to the pairing rule here silently leaves the sky
   * and the lights crossfading a different pair than the overlay does.
   */
  fromIndex: number
  toIndex: number
  /** Mood being left behind — the wedge she has just walked off. */
  from: BiomeMood
  /** Mood of the wedge she is standing on now. */
  to: BiomeMood
  /** 0→1 crossfade between them, keyed to rotation past `LANE_CROSSINGS[toIndex]`. */
  mix: number
  /** Overall strength — 1 at a checkpoint, BLOOM_FLOOR between them, 0 with the grade off. */
  bloom: number
  /** Applied strengths: the crossfade times `bloom`. 0 with the grade off. */
  skyMix: number
  lightMix: number
  hazeAlpha: number
  vignetteAlpha: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Which wedge the girl's lane is standing on at an unwrapped rotation — the index into
 * BIOME_MOODS the crossfade is heading for. A scan rather than arithmetic because the crossings
 * are not evenly spaced (the torn boundary leans differently at each meridian) and six is six.
 *
 * Before the first crossing she is technically still on the tail of band 2's paint, for 12.9 mrad
 * of rotation at the very start of the journey. That resolves to chapter 0 anyway: there is no
 * mood before spring, and the page must open wearing it.
 */
function wedgeIndexAt(rotation: number): number {
  let c = 0
  while (c + 1 < CHAPTER_COUNT && rotation >= LANE_CROSSINGS[c + 1]) c++
  return c
}

/**
 * The grade at a scroll position. Total and pure in ONE input, which is the whole safety argument:
 * the same progress always yields the same numbers, so scrubbing backwards retraces them exactly
 * and there is no clocked term that could be preempted, dropped or gated.
 *
 * Two different views of "where we are" are in play here and they are not the same number:
 * `chapter`/`local` come from PROGRESS and drive the bloom envelope, while the mood pairing and
 * the crossfade come from ROTATION and the lane crossings. They agree in the middle of a leg and
 * deliberately disagree near a boundary — progress steps at the chapter line, the ground does not.
 */
export function moodBlendAt(progress: number): MoodBlend {
  const p = clamp01(progress)
  const segLen = 1 / CHAPTER_COUNT
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(p / segLen))
  const local = (p - chapter * segLen) / segLen
  const rotation = rotationAt(p)

  const toIndex = wedgeIndexAt(rotation)
  const fromIndex = Math.max(0, toIndex - 1)
  const to = BIOME_MOODS[toIndex]
  const from = BIOME_MOODS[fromIndex]

  const mix = smoothstep((rotation - LANE_CROSSINGS[toIndex]) / MOOD_SPAN_ROT)
  const bloom = SHOW_GRADE ? bloomAt(local) : 0

  const dial = (pick: (m: BiomeMood) => number): number =>
    lerp(pick(from), pick(to), mix) * bloom

  return {
    chapter,
    rotation,
    fromIndex,
    toIndex,
    from,
    to,
    mix,
    bloom,
    skyMix: dial((m) => m.skyMix),
    lightMix: dial((m) => m.lightMix),
    hazeAlpha: dial((m) => m.hazeAlpha),
    vignetteAlpha: dial((m) => m.vignetteAlpha),
  }
}

export type GradeSample = {
  chapter: number
  mix: number
  bloom: number
  /** Blended mood colour of the document-level haze. */
  haze: string
  hazeAlpha: number
  vignetteAlpha: number
}

/** The DOM half's view of the grade — the overlay needs colours as strings, once per frame. */
export function gradeAt(progress: number): GradeSample {
  const b = moodBlendAt(progress)
  return {
    chapter: b.chapter,
    mix: b.mix,
    bloom: b.bloom,
    haze: mixHex(b.from.cast, b.to.cast, b.mix),
    hazeAlpha: b.hazeAlpha,
    vignetteAlpha: b.vignetteAlpha,
  }
}
