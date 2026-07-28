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

/**
 * ARRIVAL REVEAL CLOCK (Round 15, Task 54) — the ONE wall-clock-driven signal in
 * an otherwise scroll-scrubbed journey. Aram sanctioned this exception so that
 * reaching a checkpoint plays its entrance by itself: cards and mascots roll out
 * on arrival with the visitor's hands off the wheel. Everything else (rotation,
 * morph, renewal windows) stays a pure function of scroll.
 *
 * `chapter` — the checkpoint that owns this reveal. Stable for the reveal's whole
 *   life INCLUDING its retraction, so a consumer animating out never has to guess
 *   which biome is leaving. While rising it equals `JourneyState.chapter`; during
 *   a retraction the journey may already have moved on to the next chapter.
 * `t` — 0 at the arrival instant, rising to 1 over REVEAL_SECONDS of wall clock
 *   once the girl reaches the stop (dwell entry, local >= TRAVEL_END). It then
 *   PARKS at exactly 1 for as long as the journey stays in that dwell, however
 *   long the visitor lingers or scrubs inside it. On leaving the dwell — either
 *   direction — it walks BACK DOWN to 0 over RETRACT_SECONDS and the whole field
 *   becomes null. Always in [0,1]; never jumps; monotone within a phase.
 * `phase` — 'in' while rolling out or parked, 'out' while retracting. Use it for
 *   one-shot beats that must not re-fire on the way out (the "!" burst does), and
 *   for staged exits. Entrances that simply reverse need only `t`.
 * `null` — no checkpoint is revealed: travelling, or a retraction has finished.
 *
 * CONSUMER CONTRACT (Task 55 grade, Task 56 mascots):
 *  - Read it EVERY FRAME from the journey ref. It advances with no scroll input
 *    at all, so anything that recomputes only on scroll events will freeze
 *    mid-entrance.
 *  - Drive entrances from `t` and ease it yourself; stage sub-beats with
 *    `revealPhase(t, start, end)` so every element shares one clock. Windows in
 *    use: burst [0, BURST_PHASE_END], cards [CARD_PHASE_START, 1]. Suggested for
 *    mascots: dressing [0.30, 0.85], figures [0.45, 1.0] — dressing leads.
 *  - It is NOT frame-deterministic (the same scroll position can show different
 *    t). Never derive geometry, rotation, renewal or any baked value from it —
 *    those stay scroll-pure. Screen-space entrance transforms only.
 *  - Re-entering a dwell RESUMES from the current t rather than restarting, so
 *    scrubbing across the window edge can never re-trigger a replay.
 *  - Under prefers-reduced-motion t is 1 for the whole dwell and null outside it:
 *    an instant reveal with no animation and no scroll absorption.
 */
export type RevealState = { chapter: number; t: number; phase: 'in' | 'out' }

export type JourneyState = {
  progress: number
  rotation: number
  chapter: number
  morph: number[]
  burst: number | null
  panel: PanelState | null
  /** See RevealState. Non-null only when a driver supplies it (see use-arrival-journey). */
  reveal: RevealState | null
}

/** The reveal's first beat: the "!" discovery pop owns t in [0, this). */
export const BURST_PHASE_END = 0.42
/** The comic cards start sliding in here, so the "!" leads them by a beat. */
export const CARD_PHASE_START = 0.26

/**
 * Remaps a sub-window of the reveal clock to its own 0→1 — the staging helper every
 * arrival element shares, so beats stay in lockstep when the clock's duration is tuned.
 */
export function revealPhase(t: number, start: number, end: number): number {
  return clamp01((t - start) / (end - start))
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

/**
 * The journey's whole scene state at a scroll position. `reveal` is the one input
 * that is NOT derived from progress: the arrival clock owns it (use-arrival-journey
 * drives it, this function only passes it through and re-keys the discovery burst
 * to it). Callers that do not drive a clock pass nothing and get `reveal: null` —
 * the burst then falls back to its original scroll window.
 */
export function journeyStateAt(
  rawProgress: number,
  morphOut?: number[],
  reveal: RevealState | null = null
): JourneyState {
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

  // The "!" is the reveal's opening beat whenever a clock is driving this chapter's
  // arrival: it must pop on arrival with no further scrolling, and it must NOT pop a
  // second time on the way out (hence the 'in' gate). Without a clock it keeps its
  // original scroll window.
  const burst =
    reveal !== null && reveal.chapter === chapter
      ? reveal.phase === 'in' && reveal.t < BURST_PHASE_END
        ? reveal.t / BURST_PHASE_END
        : null
      : local >= TRAVEL_END && local < BURST_END
        ? (local - TRAVEL_END) / (BURST_END - TRAVEL_END)
        : null

  const panel: PanelState | null =
    local >= BURST_END && local < PANEL_END
      ? { chapter, t: (local - BURST_END) / (PANEL_END - BURST_END) }
      : null

  // Round 5: the world no longer morphs on a lap-boundary panel. Each surface
  // point restages itself per-vertex behind the horizon (renewal.ts / planet.tsx),
  // so there is no global worldBlend — the render reads rotation directly.
  return { progress, rotation, chapter, morph, burst, panel, reveal }
}
