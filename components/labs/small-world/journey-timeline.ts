import { CHAPTER_COUNT } from './chapters'
import { endingStateAt, type EndingState } from './ending-timeline'

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

/**
 * WHERE SHE STOPS, as a fraction of the chapter's rotation slice — and the number the whole
 * segment shape below is derived from.
 *
 * THE DEFECT IT FIXES (Task 73). `CHAPTER_SLICE === BAND_SPAN === 2π/3`, and rotation used to
 * spend the ENTIRE slice before the freeze. So the stop landed exactly on the FAR MERIDIAN of the
 * chapter's own band: the biome the card was about was behind her, compressed into the top tenth
 * of the globe, while the NEXT chapter's biome filled the frame. Measured over the on-screen
 * planet at every dwell, desktop and phone: the chapter's own scene owned 8.5–12.6% and its
 * successor owned 80–87%. All six checkpoints, not a bug in one of them.
 *
 * It could not be fixed by moving the windows below — rotation reached the full slice by
 * `TRAVEL_END` whatever `TRAVEL_END` was — so the fix is here, in the rule itself.
 *
 * 0.21 is a solve, not a taste: the camera looks AHEAD of the girl (she stands at world angle
 * STANCE_ALPHA = 0.348, the screen centre is at π/2 − 20° = 1.222), so stopping EARLY in a slice
 * is what puts the slice's own scenery across the frame. Sweeping the same projected-area census
 * that `bench/task60-vista.mjs` uses: 0.083 → ~85% (the theoretical best, she barely moves),
 * 0.21 → 78.5–83.3% per chapter, 0.36 → ~70%, 0.50 → ~56%, 1.00 → ~10% (what it was). 0.21 buys
 * essentially all of the available framing while still leaving her a walk into the biome.
 */
export const PARK_FRAC = 0.21

/**
 * The two spans the reshape below PRESERVES exactly, rather than letting them fall out of the
 * arithmetic: the "!" beat and the cards' dwell are choreography Aram has already signed off, and
 * a rotation fix has no business shortening either. Everything else is solved around them.
 */
export const BURST_SPAN = 0.1
export const DWELL_SPAN = 0.3

/**
 * The segment shape, SOLVED from `PARK_FRAC` and the two preserved spans.
 *
 * The requirement is that the world turns at ONE rate whenever it is turning at all — the approach
 * leg carries `PARK_FRAC` of the slice and the release leg carries the rest, and a visitor
 * scrolling at a steady speed must not feel the planet change gear across a dwell. Writing that
 * out — `TRAVEL_END / PARK_FRAC === (1 − PANEL_END) / (1 − PARK_FRAC)` with
 * `PANEL_END = TRAVEL_END + BURST_SPAN + DWELL_SPAN` — has exactly one solution, and it is the
 * line below. (0.126 / 0.226 / 0.526, from 0.55 / 0.65 / 0.95.)
 *
 * The shape of a chapter is now: cross onto the new biome at local 0, walk a short approach into
 * it, stop while its own scenery fills the frame, read — then walk the long way out across it to
 * the next boundary. It used to be the reverse, which is why the cards were over the wrong world.
 */
export const TRAVEL_END = PARK_FRAC * (1 - BURST_SPAN - DWELL_SPAN)
export const BURST_END = TRAVEL_END + BURST_SPAN
export const PANEL_END = BURST_END + DWELL_SPAN

/**
 * The planet's unwrapped rotation at a scroll position — `journeyStateAt(p).rotation` without
 * building a whole JourneyState. Read-only extraction (Task 59): `journeyStateAt` now calls THIS
 * rather than restating the formula, so there is exactly one rule for how scroll turns the world
 * and a consumer that needs the angle alone cannot drift from the one the scene renders.
 *
 * Note the shape rather than just the value: rotation advances over the approach, is FROZEN for
 * the whole of the burst and the dwell, and resumes for the release. Anything keyed to rotation
 * therefore cannot move while a checkpoint is parked — which is what Task 59's boundary-keyed
 * grade rests on, and it is still true.
 *
 * THE RELEASE LEG IS A LERP TO THE NEXT CHAPTER'S START, not `park + (1 − PARK_FRAC) · slice · u`.
 * The two are the same number in exact arithmetic and not in floating point, and this one lands on
 * `chapterStartRotation(c) + CHAPTER_SLICE` EXACTLY at local 1 — which at chapter 5 is the value
 * the whole ending holds frozen. `ending-timeline.test.ts` compares the ending's rotation against
 * `rotationAt(1)` with `toBe`, so "the same to twelve places" would not have been enough.
 */
export function rotationAt(progress: number): number {
  const p = clamp01(progress)
  const segLen = 1 / CHAPTER_COUNT
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(p / segLen))
  const local = (p - chapter * segLen) / segLen
  const start = chapterStartRotation(chapter)
  const park = start + PARK_FRAC * CHAPTER_SLICE
  if (local < TRAVEL_END) return start + (park - start) * (local / TRAVEL_END)
  if (local < PANEL_END) return park
  const end = start + CHAPTER_SLICE
  return park + (end - park) * clamp01((local - PANEL_END) / (1 - PANEL_END))
}

/** The rotation a chapter's checkpoint is parked at — where its card is read. */
export function chapterParkRotation(chapter: number): number {
  return chapterStartRotation(chapter) + PARK_FRAC * CHAPTER_SLICE
}

/**
 * Local progress in the middle of a chapter's dwell: cards up, settled, rotation frozen.
 * Exported so probes and e2e scroll targets name the beat instead of hard-coding a fraction that
 * the next reshape would silently move out from under them.
 */
export const DWELL_MID = (BURST_END + PANEL_END) / 2

/** Absolute scroll progress at the middle of chapter `c`'s dwell. */
export function chapterDwellProgress(chapter: number): number {
  return (chapter + DWELL_MID) / CHAPTER_COUNT
}

/** Absolute scroll progress mid-way along chapter `c`'s release leg — travelling, no card up. */
export function chapterTravelProgress(chapter: number): number {
  return (chapter + (PANEL_END + 1) / 2) / CHAPTER_COUNT
}

/**
 * A fraction of the APPROACH, expressed in the slice units `approachRevealGrow` wants.
 *
 * Props that must be standing BEFORE the cards open (the desert's camels and palms, the winter
 * bergs) used to name their windows as fractions of the whole slice, which was the same thing back
 * when the approach WAS the whole slice. It is 21% of it now, so a window written as 0.45 of a
 * slice would fire after the card rather than before it. Saying "0.45 of the approach" instead is
 * both what those windows always meant and structurally safe: anything ending at or below 1 of the
 * approach is finished before she stops.
 */
export function approachFrac(fractionOfApproach: number): number {
  return fractionOfApproach * PARK_FRAC
}
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
 *   PREEMPTION — the one way that stability ends early: arriving at a NEW checkpoint
 *   while an old reveal is still retracting replaces it outright, so `chapter` changes
 *   and `t` restarts at 0 in the SAME frame (measured: chapter 1 at t=0.762 → chapter 4
 *   at t=0). One field cannot carry two reveals, so the outgoing one is cut, not
 *   finished. Reachable by any teleport and by any fling crossing two checkpoints
 *   inside RETRACT_SECONDS (>0.238 progress/s). A consumer that animates its exit off
 *   `reveal.chapter` MUST treat a chapter change as a hard cut and snap its outgoing
 *   element, or hold its own copy of what it was showing. The rule below — that `t`
 *   never jumps — holds WITHIN one reveal's life; preemption ends that life.
 * `t` — 0 at the arrival instant, rising to 1 over REVEAL_SECONDS of wall clock
 *   once the girl reaches the stop (dwell entry, local >= TRAVEL_END). It then
 *   PARKS at exactly 1 for as long as the journey stays in that dwell, however
 *   long the visitor lingers or scrubs inside it. On leaving the dwell — either
 *   direction — it walks BACK DOWN to 0 over RETRACT_SECONDS and the whole field
 *   becomes null. Always in [0,1]; monotone within a phase; never jumps WITHIN one
 *   reveal's life — preemption above is the one way a life ends early.
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
 *    scrubbing across the window edge does not re-trigger a replay. Precisely: no
 *    replay within ~RETRACT_SECONDS of NET time spent outside the window. Retract is
 *    2.5x faster than the roll-out, so a thrash symmetric in frames drains t; once it
 *    reaches 0 the reveal ends and the next entry is a fresh arrival, absorption and
 *    all. That is correct — by then the visitor has genuinely been away — but it does
 *    mean "never replays" is too strong a thing to build on.
 *  - Under prefers-reduced-motion t is 1 for the whole dwell and null outside it:
 *    an instant reveal with no animation and no scroll absorption.
 */
export type RevealState = { chapter: number; t: number; phase: 'in' | 'out' }

export type JourneyState = {
  /**
   * CLAMPED to [0, 1]. Every consumer of this field has always been able to rely on
   * that, which is exactly why the ending could be bolted on past 1 without touching
   * any of them — but it also means this field CANNOT tell you the journey is over.
   * It reads 1 for the whole ending. Use `ending.active` (Task 63).
   */
  progress: number
  rotation: number
  chapter: number
  morph: number[]
  burst: number | null
  panel: PanelState | null
  /** See RevealState. Non-null only when a driver supplies it (see use-arrival-journey). */
  reveal: RevealState | null
  /**
   * The ONE field derived from the UN-clamped progress: the ending's own timeline
   * (see EndingState in ending-timeline.ts). Idle — a shared frozen object — for the
   * whole journey. Carried here rather than plumbed separately so the camera rig and
   * the scene read the ending from the SAME progress value the rotation was built
   * from; that single-source property is what makes the camera invariant a statement
   * about one scalar instead of two that could drift.
   */
  ending: EndingState
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
 *
 * `rawProgress` may now run past 1 (Task 63 — the scroll track has an ending segment
 * after the journey). Everything below the clamp on the next line is therefore frozen
 * at its end state for the whole ending, which is the ending's entire safety argument;
 * only `ending` sees the un-clamped value. See ending-timeline.ts.
 */
export function journeyStateAt(
  rawProgress: number,
  morphOut?: number[],
  reveal: RevealState | null = null,
  burstOverride?: number | null
): JourneyState {
  const progress = clamp01(rawProgress)
  const segLen = 1 / CHAPTER_COUNT
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(progress / segLen))
  const local = (progress - chapter * segLen) / segLen

  const rotation = rotationAt(progress)

  const morph =
    morphOut && morphOut.length === CHAPTER_COUNT ? morphOut : new Array<number>(CHAPTER_COUNT)
  const growT = smoothstep(local / MORPH_WINDOW)
  for (let i = 0; i < CHAPTER_COUNT; i++) {
    if (i === chapter) morph[i] = chapter === 0 ? 1 : growT
    else if (i === chapter - 1) morph[i] = 1 - growT
    else morph[i] = 0
  }

  // The "!" must pop on arrival with no further scrolling, and must NOT pop again on
  // the way out (hence the 'in' gate). But WHOSE arrival? The girl's locomotion runs on
  // the DAMPED timeline, and her celebrate jump is fired by this value's rising edge and
  // reclaimed the moment she is still moving — so on the canvas the edge has to land on
  // the frame the damped rotation clamps, not when the undamped clock starts. A caller
  // that owns a timeline (useDampedJourney's latch) therefore passes its own value here
  // and it is used verbatim, null included. Callers that pass nothing — the DOM, whose
  // burst only drives the speed lines — get the clock-driven ramp, which is the same
  // undamped timing the speed lines had before this clock existed.
  const burst =
    burstOverride !== undefined
      ? burstOverride
      : reveal !== null && reveal.chapter === chapter
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
  //
  // Task 63: `ending` reads `rawProgress`, NOT the clamped `progress` — it is the one
  // consumer that wants what the clamp throws away.
  return { progress, rotation, chapter, morph, burst, panel, reveal, ending: endingStateAt(rawProgress) }
}
