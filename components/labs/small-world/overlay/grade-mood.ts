import { CHAPTER_COUNT } from '../chapters'
import { smoothstep } from '../journey-timeline'
import { PALETTE } from '../palette'

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
 * TIMING. Everything here is a PURE function of scroll progress, so scrubbing is exactly
 * symmetric in both directions and nothing can step or flicker. The mood of chapter c crossfades
 * in from the previous chapter's over the local window [MOOD_IN_START, MOOD_IN_END] — starting on
 * the final approach, complete just after the panel opens — then holds. On top of that the whole
 * grade BLOOMS: full strength through the checkpoint and its dwell, settling back to BLOOM_FLOOR
 * over the next chapter's early travel, so each arrival gets a swell of its own.
 *
 * T54 RE-KEY (one line, when the reveal clock lands): `moodBlendAt` takes an optional `revealT`.
 * Pass `journey.reveal?.t` and the crossfade rides T54's arrival clock instead of the
 * scroll-derived window; every consumer is unchanged.
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
    skyMix: 0.64,
    cast: PALETTE.gradeJungleCast,
    lightMix: 0.34,
    hazeAlpha: 0.06,
    vignetteAlpha: 0.24,
  },
  {
    id: 'delta',
    sky: PALETTE.gradeDeltaSky,
    glow: PALETTE.gradeDeltaGlow,
    skyMix: 0.6,
    cast: PALETTE.gradeDeltaCast,
    lightMix: 0.32,
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
  {
    id: 'canyon',
    sky: PALETTE.gradeCanyonSky,
    glow: PALETTE.gradeCanyonGlow,
    skyMix: 0.62,
    cast: PALETTE.gradeCanyonCast,
    lightMix: 0.34,
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

/**
 * Crossfade window in a chapter's local progress. Travel ends at 0.55 and the panel opens at
 * 0.65, so the mood starts moving on the last stretch of the approach and is fully in just after
 * the cards land — the arrival brings it, and nothing about it is abrupt (the window is 30% of a
 * chapter's scroll, ~72vh of travel).
 */
export const MOOD_IN_START = 0.42
export const MOOD_IN_END = 0.72
/** Strength the grade settles back to between checkpoints — the bloom's resting level. */
export const BLOOM_FLOOR = 0.84
/** Local progress by which the previous checkpoint's bloom has fully settled. */
export const BLOOM_SETTLE_END = 0.3

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
 * Strength envelope across one chapter: holds 1 from the previous checkpoint, settles to
 * BLOOM_FLOOR over the first BLOOM_SETTLE_END of the travel, sits there through the middle of the
 * leg, then swells back to 1 across the same window the mood crossfades in. Continuous at both
 * ends (1 at local 0 and at local 1), so chapter boundaries are invisible.
 */
export function bloomAt(local: number): number {
  const l = clamp01(local)
  if (l < BLOOM_SETTLE_END) return 1 - (1 - BLOOM_FLOOR) * smoothstep(l / BLOOM_SETTLE_END)
  const rise = smoothstep((l - MOOD_IN_START) / (MOOD_IN_END - MOOD_IN_START))
  return BLOOM_FLOOR + (1 - BLOOM_FLOOR) * rise
}

export type MoodBlend = {
  /** Chapter whose mood is being moved toward. */
  chapter: number
  /** Mood being left behind (the chapter's own mood at the start of the journey). */
  from: BiomeMood
  /** Mood being moved toward. */
  to: BiomeMood
  /** 0→1 crossfade between them. */
  mix: number
  /** Overall strength — 1 at a checkpoint, BLOOM_FLOOR between them, 0 with the grade off. */
  bloom: number
  /** Applied strengths: the blended per-mood dial times `bloom`. All 0 with the grade off. */
  skyMix: number
  lightMix: number
  hazeAlpha: number
  vignetteAlpha: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * The grade at a scroll position. Pure and total: the same progress always yields the same
 * numbers, and scrubbing backwards retraces them exactly.
 *
 * `revealT` is the T54 hook: pass the arrival clock (0→1) to key the crossfade to the
 * choreographed roll-out instead of the scroll window.
 */
export function moodBlendAt(progress: number, revealT?: number): MoodBlend {
  const p = clamp01(progress)
  const segLen = 1 / CHAPTER_COUNT
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(p / segLen))
  const local = (p - chapter * segLen) / segLen

  const mix =
    revealT === undefined
      ? smoothstep((local - MOOD_IN_START) / (MOOD_IN_END - MOOD_IN_START))
      : clamp01(revealT)
  const bloom = SHOW_GRADE ? bloomAt(local) : 0

  const to = BIOME_MOODS[chapter]
  const from = BIOME_MOODS[Math.max(0, chapter - 1)]

  return {
    chapter,
    from,
    to,
    mix,
    bloom,
    skyMix: lerp(from.skyMix, to.skyMix, mix) * bloom,
    lightMix: lerp(from.lightMix, to.lightMix, mix) * bloom,
    hazeAlpha: lerp(from.hazeAlpha, to.hazeAlpha, mix) * bloom,
    vignetteAlpha: lerp(from.vignetteAlpha, to.vignetteAlpha, mix) * bloom,
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

/** The DOM half's view of the grade — the overlay needs colours as strings, once per scroll frame. */
export function gradeAt(progress: number, revealT?: number): GradeSample {
  const b = moodBlendAt(progress, revealT)
  return {
    chapter: b.chapter,
    mix: b.mix,
    bloom: b.bloom,
    haze: mixHex(b.from.cast, b.to.cast, b.mix),
    hazeAlpha: b.hazeAlpha,
    vignetteAlpha: b.vignetteAlpha,
  }
}
