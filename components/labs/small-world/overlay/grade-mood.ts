import { CHAPTER_COUNT } from '../chapters'
import { revealPhase, smoothstep } from '../journey-timeline'
import type { RevealState } from '../journey-timeline'
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
 * TIMING — A SCROLL CROSSFADE, PULLED THE REST OF THE WAY BY THE ARRIVAL. The mood of chapter c
 * crossfades in from the previous chapter's over the local scroll window [MOOD_IN_START,
 * MOOD_IN_END], starting on the final approach. That alone would stall: T54's arrival absorbs
 * scroll while the checkpoint rolls out, so a purely scroll-keyed crossfade freezes part-way and
 * only finishes when the visitor scrolls again — the mood would arrive after the mascots instead
 * of with them.
 *
 * So the reveal clock is applied ON TOP of the scroll blend, as a PULL toward the mood of the
 * chapter the reveal names: `value = lerp(scrollBlend, revealedMood, pull)`. The shape matters
 * more than it looks. The pull contributes exactly nothing at strength 0 and lands exactly on the
 * revealed mood at 1, and — crucially — it does not care which pair of moods the scroll term
 * happens to be blending. That makes the whole thing continuous across a chapter boundary
 * unconditionally, in both directions and at any scrub speed, with no index gate anywhere.
 *
 * (The first cut instead took `max(scrolled, arrived)` in the journey's own chapter basis, which
 * needed a `reveal.chapter === chapter` gate — and that gate was a third, DISCONTINUOUS input.
 * Flinging backwards out of a dwell fast enough to cross a segment before the retraction finished
 * dropped a live term in one frame: measured, a scrollbar drag could snap a whole mood over
 * — winter to canyon — in a single frame. The pull has no gate to drop.)
 *
 * On top of the crossfade the whole grade BLOOMS: full strength through the checkpoint and its
 * dwell, settling back to BLOOM_FLOOR over the next chapter's early travel, so each arrival gets a
 * swell of its own. The bloom stays keyed to scroll — it is a slow envelope across a whole leg,
 * not an entrance beat.
 *
 * Scrubbing is exactly symmetric in both directions whenever the arrival clock is idle, and
 * nothing here can step or flicker in either mode.
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
 *
 * MOOD_IN_END CARRIES AN INVARIANT — it must stay at or below 1, so that `scrolled` has saturated
 * by the time a chapter boundary is crossed and the blend resolves to the same mood from either
 * side of it. Push the window past the end of a chapter and every boundary becomes a visible
 * colour step. Pinned by the boundary sweep in grade-mood.test.ts rather than left to this comment.
 */
export const MOOD_IN_START = 0.42
export const MOOD_IN_END = 0.72
/**
 * Where in the arrival clock the grade's crossfade completes. The cards start sliding at
 * CARD_PHASE_START (0.26) and land at 1, so finishing at 0.7 puts the mood UNDER them rather than
 * after them — the mascots and the light arrive together and the cards land into a graded frame.
 */
export const GRADE_PHASE_END = 0.7
/**
 * The reveal's pull is full while the journey is within REVEAL_NEAR chapters of the revealed
 * chapter's dwell centre and fades to nothing by REVEAL_FAR. The dwell itself spans +-0.20, so
 * NEAR must stay above that or an arrival would not land on its own mood.
 */
export const REVEAL_NEAR = 0.3
export const REVEAL_FAR = 0.8
/** Where the revealed chapter's dwell sits within its segment, in chapter units. */
const DWELL_CENTRE = 0.75

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
  /** Chapter whose mood the scroll blend is moving toward. */
  chapter: number
  /**
   * Indices of `from` and `to` in BIOME_MOODS. Consumers that keep their own parallel colour
   * tables (the scene ones do, to avoid per-frame allocation) MUST index with these rather than
   * re-derive `chapter - 1` — otherwise a change to the pairing rule here silently leaves the sky
   * and the lights crossfading a different pair than the overlay does.
   */
  fromIndex: number
  toIndex: number
  /** Mood being left behind (the chapter's own mood at the start of the journey). */
  from: BiomeMood
  /** Mood being moved toward. */
  to: BiomeMood
  /** 0→1 scroll-derived crossfade between them. */
  mix: number
  /** Chapter of the arrival being revealed, if any — what `revealPull` pulls toward. */
  revealChapter: number | null
  /** 0→1 pull from the scroll blend onto the revealed chapter's mood. */
  revealPull: number
  /** Overall strength — 1 at a checkpoint, BLOOM_FLOOR between them, 0 with the grade off. */
  bloom: number
  /** Applied strengths: scroll blend, pulled by the arrival, times `bloom`. 0 with the grade off. */
  skyMix: number
  lightMix: number
  hazeAlpha: number
  vignetteAlpha: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * The grade at a scroll position, carried the rest of the way by T54's arrival clock when one is
 * running. Total, and pure in both inputs: the same (progress, reveal) always yields the same
 * numbers.
 *
 * The reveal needs no chapter GATE — during a retraction it keeps naming the biome that is LEAVING
 * even after the journey has moved on, which is exactly right, because the pull is toward that
 * biome's mood and fades as the retraction completes.
 *
 * It does need a PROXIMITY WEIGHT, and this is the subtle one. The pull holds the revealed mood
 * against a scroll blend that may be moving away from it, so it stores up displacement that has to
 * be released. Released by the retraction it is smooth; but a reveal's life can END EARLY —
 * flinging backward out of one dwell lands in the PREVIOUS dwell, whose arrival PREEMPTS the
 * retraction, replacing `reveal` with a fresh one at t = 0 (T54's corrected contract). The stored
 * displacement then releases in a single frame. Measured on the real `stepArrival`, that was a
 * 94–117/255 haze channel step at 6000px/s against a 28–33/255 no-reveal control.
 *
 * So the pull is additionally weighted by how near the journey still is to the revealed chapter's
 * own dwell: it is full throughout that dwell and fades to nothing as the journey leaves, which
 * means there is never stored displacement left to snap when the field is reused. Position-keyed,
 * so it stays scrub-symmetric. This drops the same measurement to 17–33/255, at or below the
 * control, with every arrival still landing exactly on its mood.
 */
export function moodBlendAt(progress: number, reveal?: RevealState | null): MoodBlend {
  const p = clamp01(progress)
  const segLen = 1 / CHAPTER_COUNT
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(p / segLen))
  const local = (p - chapter * segLen) / segLen

  const mix = smoothstep((local - MOOD_IN_START) / (MOOD_IN_END - MOOD_IN_START))
  const bloom = SHOW_GRADE ? bloomAt(local) : 0

  const toIndex = chapter
  const fromIndex = Math.max(0, chapter - 1)
  const to = BIOME_MOODS[toIndex]
  const from = BIOME_MOODS[fromIndex]

  const revealChapter = reveal
    ? Math.min(CHAPTER_COUNT - 1, Math.max(0, reveal.chapter))
    : null
  const revealPull =
    revealChapter === null
      ? 0
      : smoothstep(revealPhase(reveal!.t, 0, GRADE_PHASE_END)) *
        (1 -
          smoothstep(
            (Math.abs(p * CHAPTER_COUNT - (revealChapter + DWELL_CENTRE)) - REVEAL_NEAR) /
              (REVEAL_FAR - REVEAL_NEAR)
          ))
  const revealed = revealChapter === null ? null : BIOME_MOODS[revealChapter]

  /** Scroll blend, then pulled onto the revealed mood, then scaled by the bloom. */
  const dial = (pick: (m: BiomeMood) => number): number => {
    const base = lerp(pick(from), pick(to), mix)
    return (revealed === null ? base : lerp(base, pick(revealed), revealPull)) * bloom
  }

  return {
    chapter,
    fromIndex,
    toIndex,
    from,
    to,
    mix,
    revealChapter,
    revealPull,
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
export function gradeAt(progress: number, reveal?: RevealState | null): GradeSample {
  const b = moodBlendAt(progress, reveal)
  const base = mixHex(b.from.cast, b.to.cast, b.mix)
  return {
    chapter: b.chapter,
    mix: b.mix,
    bloom: b.bloom,
    haze:
      b.revealChapter === null
        ? base
        : mixHex(base, BIOME_MOODS[b.revealChapter].cast, b.revealPull),
    hazeAlpha: b.hazeAlpha,
    vignetteAlpha: b.vignetteAlpha,
  }
}
