import { CHAPTER_COUNT } from './chapters'

/**
 * Pure scroll→scene math. One scroll lap = TWO planet laps (720°, 120° per
 * chapter) — the career circles the little world twice. Each chapter owns an
 * equal progress segment, subdivided:
 *   [0, TRAVEL_END)          girl skips, planet rotates its slice
 *   [TRAVEL_END, BURST_END)  discovery animation ("!"), rotation frozen
 *   [BURST_END, PANEL_END)   comic panel dwell, rotation frozen
 *   [PANEL_END, 1]           release, next chapter's travel resumes rotation
 */
export const ROTATION_TOTAL = Math.PI * 4
/** Rotation each chapter owns. The spec's parked >360° question changes THIS
 * constant (and chapterStartRotation) only — nothing else may hardcode the slice. */
export const CHAPTER_SLICE = ROTATION_TOTAL / CHAPTER_COUNT

export function chapterStartRotation(chapter: number): number {
  return chapter * CHAPTER_SLICE
}

export const TRAVEL_END = 0.55
export const BURST_END = 0.65
export const PANEL_END = 0.95
/** Fraction of a segment over which the incoming prop set grows (and the outgoing sinks). */
export const MORPH_WINDOW = 0.35

export type PanelState = { chapter: number; t: number }
export type JourneyState = {
  progress: number
  rotation: number
  chapter: number
  morph: number[]
  burst: number | null
  panel: PanelState | null
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

export const smoothstep = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/** Springy overshoot easing for prop growth (easeOutBack, c = 1.70158). */
export function easeOutBack(t: number): number {
  const x = clamp01(t)
  const c = 1.70158
  const p = x - 1
  return 1 + (c + 1) * p * p * p + c * p * p
}

/**
 * Deterministic APPROACH-REVEAL grow [0 … 1] for props that emerge as the girl nears a
 * chapter's stop (Task 46 — the desert camels + oasis palms "appear as the girl approaches").
 * Driven ONLY by the unwrapped journey `rotation` (no wall-clock, so scrubbing back and forth
 * is bit-reproducible): it holds 0 until she is `startFrac` of the chapter's travel-slice in,
 * then eases up (easeOutBack springy pop) to full by `startFrac + spanFrac`, and stays full
 * through the stop + dwell (rotation freezes there). Distinct from ChapterSet's morph (which
 * grows the whole set from the chapter's first frame): this reveals LATER, mid-approach, so the
 * life pops in against the already-standing dunes + pyramids. `chapter` is the desert's chapter.
 */
export function approachRevealGrow(
  chapter: number,
  rotation: number,
  startFrac: number,
  spanFrac: number
): number {
  const start = chapterStartRotation(chapter) + CHAPTER_SLICE * startFrac
  const p = clamp01((rotation - start) / (CHAPTER_SLICE * spanFrac))
  return easeOutBack(p)
}

export function journeyStateAt(rawProgress: number, morphOut?: number[]): JourneyState {
  const progress = clamp01(rawProgress)
  const segLen = 1 / CHAPTER_COUNT
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(progress / segLen))
  const local = (progress - chapter * segLen) / segLen

  const rotation = chapterStartRotation(chapter) + clamp01(local / TRAVEL_END) * CHAPTER_SLICE

  const morph =
    morphOut && morphOut.length === CHAPTER_COUNT ? morphOut : new Array<number>(CHAPTER_COUNT)
  const growT = smoothstep(local / MORPH_WINDOW)
  for (let i = 0; i < CHAPTER_COUNT; i++) {
    if (i === chapter) morph[i] = chapter === 0 ? 1 : growT
    else if (i === chapter - 1) morph[i] = 1 - growT
    else morph[i] = 0
  }

  const burst =
    local >= TRAVEL_END && local < BURST_END
      ? (local - TRAVEL_END) / (BURST_END - TRAVEL_END)
      : null

  const panel: PanelState | null =
    local >= BURST_END && local < PANEL_END
      ? { chapter, t: (local - BURST_END) / (PANEL_END - BURST_END) }
      : null

  // Round 5: the world no longer morphs on a lap-boundary panel. Each surface
  // point restages itself per-vertex behind the horizon (renewal.ts / planet.tsx),
  // so there is no global worldBlend — the render reads rotation directly.
  return { progress, rotation, chapter, morph, burst, panel }
}
