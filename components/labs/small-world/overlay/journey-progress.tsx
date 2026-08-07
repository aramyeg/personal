'use client'
import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { CHAPTER_COUNT } from '../chapters'
import { chapters } from '../chapters'
import { STAND_END, endingStateAt } from '../ending-timeline'
import { standBelowJourneyFrame } from '../scene/globe-stand'
import { PALETTE } from '../palette'

/**
 * A slim journey progress rail: six clay dots + a filling ink line at the bottom
 * of the frame, telling the traveller "chapter N of 6" and how far around the
 * little world they are. It answers the journey's biggest missing affordance —
 * during the frozen discovery + panel dwells the planet stops turning, and with
 * nothing else moving the scroll reads as "stuck"; the fill keeps creeping as
 * you scroll, so the input still visibly registers.
 *
 * DELIBERATELY NON-INTERACTIVE (Phase B): the dots do not jump chapters — that
 * is a feel-changing navigation decision left for Aram's pick (Phase C). Only
 * the small dismiss control takes pointer events, so this element cannot
 * intercept a scroll, tap, or the panel's tap-to-advance. It reads the RAW
 * progress ref (never the damped canvas value) so it tracks the finger exactly,
 * like the panels do. Reversible whole-cloth via SHOW_PROGRESS_RAIL in
 * journey-overlay.tsx.
 *
 * Cheap by construction: the fill width is written straight to the DOM every
 * scroll frame (no React churn); state updates only when the integer chapter
 * changes — at most CHAPTER_COUNT times across the whole journey.
 *
 * TASK 65 — IT LEAVES WHEN THE WORLD DOES.
 * Task 63 left the rail flagged rather than decided: it clamps, so through the
 * whole ending it reads a truthful "6 / 6" with a full bar — floating over a
 * desk, a hand-written note and three contact links. Truthful and wrong. The
 * decision there was to FADE it rather than to kill it (`SHOW_PROGRESS_RAIL` is
 * still the whole-cloth revert), and that decision stands. What moved is WHEN.
 *
 * ============================================================================
 * TASK 72 — THE BEAT MOVED, AND THE OLD ARGUMENT IS KEPT BECAUSE HALF OF IT WAS RIGHT
 * ============================================================================
 * Task 65 keyed the fade to `zoom` and reasoned: through the still beat the rail
 * is still doing its original job, which is to answer "did my scroll register"
 * while the world stands still — and the ending's first beat is the stillest the
 * lab ever gets. Only once the camera starts moving does the frame answer that
 * question by itself. Every sentence of that is true, and it is why this file
 * does not simply cut the rail off at progress = 1.
 *
 * What it missed is that the still beat is not empty. The camera holds, but the
 * GLOBE STAND is rising through it — that is the whole point of the beat
 * (`scene/globe-stand.ts`: "the still beat used to hold a bow; now it holds
 * this"). Keying the fade to `zoom` meant the rail was still at full opacity for
 * the entire rise and most of the way into the pull-back. A blind playthrough of
 * the shipped build caught the consequence at ~90% of the track: the pink fill
 * line and the "6 / 6" counter drawn dark-on-dark across the stand's column and
 * struts, which is a legibility failure on top of a composition one.
 *
 * Aram's call: fade it out as the ending phase begins, and pick the beat so it
 * never overlaps the pedestal. So the fade is keyed to the ending's own `t` and
 * not to `zoom`, and it starts on the ending's first frame.
 *
 * THE BEAT IS SOLVED, NOT PICKED. The binding event is the moment the stand's
 * crown crosses the journey camera's bottom frame edge — before that the stand
 * is geometrically incapable of touching the rail, and after it the two share
 * pixels. `standBelowJourneyFrame` is exactly that predicate and it already
 * ships, so the beat is a bisection on it rather than a number in this file. It
 * comes out at stand = 0.1985, i.e. t = 0.0595 (86.56% of the track), against
 * the old fade which did not finish until 93.6%.
 *
 * THE WINDOW IS SHORT AND THAT IS THE GEOMETRY'S DOING. 0.0595 of a 240vh ending
 * is about 14vh of scroll, and the fade takes three quarters of it. That is one
 * wheel notch, which is fast for a fade and is all the room there is: the stand
 * clears the frame edge a fifteenth of the way into its own rise. The
 * alternatives were to start the fade during chapter six (Aram said "as the
 * ending phase begins", and dimming the counter while the traveller is still
 * using it is the one thing the Task 65 argument correctly forbids) or to cut it
 * dead at progress = 1, which reads as a glitch on the exact frame the journey
 * lands. A short eased fade is the honest third option, and it is eased on
 * SMOOTHERSTEP rather than linearly for that reason — over a window this short a
 * linear ramp's start and stop are both visible events.
 *
 * When it is gone the whole rail is `visibility: hidden` as well as transparent.
 *
 * THE DISMISS CONTROL LEAVES FIRST, and on a LEGIBILITY threshold rather than on
 * a non-zero one. Hiding the rail only at exactly `opacity === 0` answered the
 * trap at its endpoint and not on its approach: review swept real frames and
 * found the button still topmost at its own centre, and still focusable, with
 * the wrapper at 0.0247 — an effective alpha of 0.0099 once its own 0.4 is
 * applied. A ~43 px window on a 15840 px track, and bounded in consequence, but
 * it is the same defect `ending-connect.tsx` refuses three files over. It now
 * uses that file's standard: a control is live only while it is legible.
 */

const DOT = 9
const DOT_ACTIVE = 14

/**
 * The `stand` value at which the globe stand's crown first enters the journey camera's frame —
 * SOLVED against `globe-stand.ts`'s own containment predicate rather than restated, so retuning the
 * cradle, the park drop or the camera walks this beat instead of stranding it.
 *
 * The bisection is honest because the predicate is monotone: `standOffsetY` eases the whole stand
 * upward on a smootherstep that never reverses, so the crown's height climbs without a turning
 * point and `standBelowJourneyFrame` is true then false, exactly once.
 *
 * It lands at 0.19847. In closed form the crossing is where the rise has spent `DESK_CLEARANCE` of
 * its travel — the parked pose is defined as exactly that far below the frame edge — which is a
 * useful check on the number but not a substitute for asking the shipped predicate.
 */
const STAND_ENTERS_FRAME = (() => {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (standBelowJourneyFrame(mid)) lo = mid
    else hi = mid
  }
  return hi
})()

/**
 * How much of the stand's approach the rail leaves clear behind it.
 *
 * Three quarters: the rail is gone by 0.75 of the way from "parked below the frame" to "first pixel
 * on screen", so the last quarter of the approach is empty of chrome before anything arrives in it.
 * A margin rather than a coincidence — gating exactly ON the crossing would put the rail's last
 * visible frame and the stand's first on the same scroll position, which is the kind of boundary
 * that is true in arithmetic and wrong on a screen that renders at 60 discrete stops.
 */
const RAIL_LEAD = 0.75

/**
 * The rail is fully gone by this much of the ENDING'S OWN `t` — 0.04466, about 10.7vh of scroll.
 *
 * `t` and not `zoom`: the whole of Task 72's finding is that `zoom` is 0 for the entire still beat,
 * which is precisely the beat the stand arrives on. `stand` is `t / STAND_END` clamped, so the
 * crossing above maps back through the timeline rather than through a second copy of it.
 */
const RAIL_GONE_AT = STAND_ENTERS_FRAME * STAND_END * RAIL_LEAD

/**
 * How much of the rail has to be up for its dismiss control to be honest about being clickable.
 * The same number `ending-connect.tsx` uses, applied to the same question.
 */
const DISMISS_LIVE_AT = 0.85

/** Whether the dismiss control may take a pointer or the keyboard at a scroll position. */
export function railDismissLive(progress: number): boolean {
  return railOpacity(progress) >= DISMISS_LIVE_AT
}

/**
 * Its opacity at a scroll position, from the ending's own clock.
 *
 * Exact at both ends, which is what lets the rest of the file compare against 0 and 1 rather than
 * against an epsilon: the journey's whole domain gives `t = 0` (`endingStateAt` returns the shared
 * idle state for every progress <= 1), and `smootherstep(1)` is exactly 1 · 1 · 1 · (6 − 15 + 10);
 * past RAIL_GONE_AT the clamp gives exactly 0 and `smootherstep(0)` is exactly 0. Pure in one
 * input, so a scrub backwards rewinds it bit for bit.
 */
export function railOpacity(progress: number): number {
  const { t } = endingStateAt(progress)
  const x = 1 - t / RAIL_GONE_AT
  const v = x < 0 ? 0 : x > 1 ? 1 : x
  return v * v * v * (v * (v * 6 - 15) + 10)
}

function chapterAt(progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  return Math.min(CHAPTER_COUNT - 1, Math.floor(p * CHAPTER_COUNT))
}

export function JourneyProgress({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const [chapter, setChapter] = useState(() => chapterAt(progressRef.current))
  const [dismissed, setDismissed] = useState(false)
  const fillRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dismissRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (dismissed) return
    let raf = 0
    const compute = () => {
      // the RAW value, unclamped: `railOpacity` reads the ending, and the clamp is what hides it
      const raw = progressRef.current
      const p = Math.min(1, Math.max(0, raw))
      if (fillRef.current) fillRef.current.style.width = `${p * 100}%`
      if (wrapRef.current) {
        const o = railOpacity(raw)
        wrapRef.current.style.opacity = `${o}`
        wrapRef.current.style.visibility = o === 0 ? 'hidden' : 'visible'
      }
      if (dismissRef.current) {
        // `visibility` and not just `pointerEvents`: the second stops a click, the first is what
        // takes the control out of sequential focus as well
        const live = railDismissLive(raw)
        dismissRef.current.style.pointerEvents = live ? 'auto' : 'none'
        dismissRef.current.style.visibility = live ? 'visible' : 'hidden'
      }
      const c = chapterAt(p)
      setChapter((prev) => (prev === c ? prev : c))
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(compute)
    }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [progressRef, dismissed])

  if (dismissed) return null

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={`Journey progress: chapter ${chapter + 1} of ${CHAPTER_COUNT}`}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 'max(22px, env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        pointerEvents: 'none',
      }}
    >
      {/* THE CHAPTER'S TITLE, and it is a PARITY FIX rather than decoration
          (Task 85, finding 10). `theme` — "The page builder", "The dashboards",
          "The small stuff" — reached only the reduced-motion fallback, so the
          animated build was a strict subset of the static one on the six facts
          a reader is most likely to repeat.
          THE RAIL IS WHERE IT COSTS NOTHING AND EARNS MOST. It is already
          mounted for the whole journey, it already knows the chapter, and it is
          the one piece of chrome that is up during the long travel stretches —
          the audit measured text visible at 7 of 24 sampled positions, so a
          title here is also the only words in about eight screens of scrolling.
          Not aria-hidden, unlike the counter beside it: the counter restates
          the group's own label, this does not. */}
      <span
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: 15,
          letterSpacing: 1,
          color: PALETTE.ink,
          opacity: 0.86,
          lineHeight: 1,
          maxWidth: 'min(86vw, 420px)',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {chapters[chapter]?.theme}
      </span>
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: 13,
          letterSpacing: 2,
          color: PALETTE.ink,
          opacity: 0.72,
          lineHeight: 1,
        }}
      >
        {chapter + 1} / {CHAPTER_COUNT}
      </span>

      <div aria-hidden="true" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {/* track + fill sit behind the dots, threading their centres */}
        <div
          style={{
            position: 'absolute',
            left: DOT_ACTIVE / 2,
            right: DOT_ACTIVE / 2,
            height: 3,
            borderRadius: 3,
            background: `${PALETTE.ink}24`,
          }}
        >
          <div
            ref={fillRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '0%',
              borderRadius: 3,
              background: PALETTE.blossomDeep,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
          {chapters.map((ch, i) => {
            const isActive = i === chapter
            const isPassed = i < chapter
            const size = isActive ? DOT_ACTIVE : DOT
            return (
              <span
                key={ch.id}
                style={{
                  width: DOT_ACTIVE,
                  height: DOT_ACTIVE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    border: `2px solid ${PALETTE.ink}`,
                    // TASK 74 — the rail was the last biome tint left on the chrome.
                    // The active dot took `ch.accent`, so the bar under a black-and-
                    // white spread cycled honey, river, dune, tuff while its own fill
                    // line was already the lab pink. One ink for "here" (the pink the
                    // fill is drawn in), ink for "passed", paper for "ahead" — which
                    // is also the only reading the rail ever needed.
                    background: isActive ? PALETTE.blossomDeep : isPassed ? PALETTE.ink : PALETTE.pagePaper,
                    boxShadow: isActive ? `2px 2px 0 ${PALETTE.ink}` : 'none',
                    transition: 'width 180ms ease, height 180ms ease, background 180ms ease',
                  }}
                />
              </span>
            )
          })}
        </div>
      </div>

      <button
        ref={dismissRef}
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Hide journey progress"
        style={{
          position: 'absolute',
          right: 'max(12px, env(safe-area-inset-right))',
          bottom: 2,
          // inert until the first compute says otherwise — the safe direction to be wrong in
          pointerEvents: 'none',
          visibility: 'hidden',
          appearance: 'none',
          border: 'none',
          background: 'transparent',
          color: PALETTE.ink,
          opacity: 0.4,
          fontFamily: 'var(--sw-font-body)',
          fontSize: 16,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 6,
        }}
      >
        ×
      </button>
    </div>
  )
}
