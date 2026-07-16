import { CHAPTER_COUNT } from './chapters'

/**
 * Pure scroll→scene math. One scroll lap = one planet lap = the career.
 * Each chapter owns an equal progress segment, subdivided:
 *   [0, TRAVEL_END)          girl skips, planet rotates its slice
 *   [TRAVEL_END, BURST_END)  discovery animation ("!"), rotation frozen
 *   [BURST_END, PANEL_END)   comic panel dwell, rotation frozen
 *   [PANEL_END, 1]           release, next chapter's travel resumes rotation
 */
export const ROTATION_TOTAL = Math.PI * 2
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

export function journeyStateAt(rawProgress: number): JourneyState {
  const progress = clamp01(rawProgress)
  const segLen = 1 / CHAPTER_COUNT
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(progress / segLen))
  const local = (progress - chapter * segLen) / segLen

  const slice = ROTATION_TOTAL / CHAPTER_COUNT
  const rotation = chapter * slice + clamp01(local / TRAVEL_END) * slice

  const morph = Array.from({ length: CHAPTER_COUNT }, (_, i) => {
    const grow = chapter === 0 ? 1 : smoothstep(local / MORPH_WINDOW)
    if (i === chapter) return i === 0 ? 1 : grow
    if (i === chapter - 1) return 1 - smoothstep(local / MORPH_WINDOW)
    return 0
  })

  const burst =
    local >= TRAVEL_END && local < BURST_END
      ? (local - TRAVEL_END) / (BURST_END - TRAVEL_END)
      : null

  const panel: PanelState | null =
    local >= BURST_END && local < PANEL_END
      ? { chapter, t: (local - BURST_END) / (PANEL_END - BURST_END) }
      : null

  return { progress, rotation, chapter, morph, burst, panel }
}
