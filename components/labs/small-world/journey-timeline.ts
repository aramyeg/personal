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

/**
 * The chapter whose panel dwell straddles the lap boundary (rotation = 2π). The
 * girl laps the planet twice, so the boundary falls at the END of the chapter
 * whose travel completes the first full turn: (i+1)·CHAPTER_SLICE = 2π ⟹
 * i = 2π/CHAPTER_SLICE − 1. With CHAPTER_SLICE = ROTATION_TOTAL/CHAPTER_COUNT
 * and ROTATION_TOTAL = 4π this is index 2. The world morphs across this panel.
 */
export const LAP_BOUNDARY_CHAPTER = Math.round((Math.PI * 2) / CHAPTER_SLICE) - 1

export type PanelState = { chapter: number; t: number }
export type JourneyState = {
  progress: number
  rotation: number
  chapter: number
  morph: number[]
  burst: number | null
  panel: PanelState | null
  /** 0 = lap-1 (spring) world, 1 = lap-2 (autumn→winter) world. Ramps
   *  smoothstep across the lap-boundary chapter's panel dwell; a pure function
   *  of progress, so scrolling back un-morphs the world. */
  worldBlend: number
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

  // The world is lap-1 before the boundary chapter, lap-2 after it, and ramps
  // across that chapter's panel window. smoothstep clamps the local fraction,
  // so this is 0 through the boundary chapter's travel+burst and 1 past its panel.
  const worldBlend =
    chapter < LAP_BOUNDARY_CHAPTER
      ? 0
      : chapter > LAP_BOUNDARY_CHAPTER
        ? 1
        : smoothstep((local - BURST_END) / (PANEL_END - BURST_END))

  return { progress, rotation, chapter, morph, burst, panel, worldBlend }
}
