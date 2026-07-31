'use client'
import type { MutableRefObject } from 'react'
import { CHAPTER_COUNT, chapters } from '../chapters'
import type { ArrivalJourney } from '../use-arrival-journey'
import { BiomeGrade, SHOW_GRADE } from './biome-grade'
import { ChapterPanels } from './chapter-panels'
import { EndingConnect } from './ending-connect'
import { JourneyProgress } from './journey-progress'
import { SpeedLines } from './speed-lines'
import { useJourneyUi } from './use-journey-ui'

/** Set false to remove the bottom progress rail entirely (one-line revert). */
const SHOW_PROGRESS_RAIL = true

/** Everything DOM above the canvas: speed lines, chapter panels, ending. */
export function JourneyOverlay({
  progressRef,
  journey,
  onAdvance,
}: {
  progressRef: MutableRefObject<number>
  /** Supplies the arrival reveal clock; absent → panels key to the dwell as before (Task 54). */
  journey?: ArrivalJourney
  onAdvance: (targetProgress: number) => void
}) {
  const ui = useJourneyUi(progressRef, journey)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* FIRST child on purpose: the per-biome grade must paint under the cards and the rail, so
          panel text can never be tinted by it (see biome-grade.tsx). */}
      {SHOW_GRADE && <BiomeGrade progressRef={progressRef} journey={journey} />}
      <SpeedLines active={ui.burst} />
      {/* No `ended` gate any more (Task 63). It existed to clear the stage for the retired
          `EndPanel`, and at END_AT = 0.985 it cut chapter 6's dwell short — the cards were
          yanked mid-read at 0.985 while the dwell ran to 0.9917. The cards now retract the
          way every other chapter's do, on their own clock, and the ending begins after.

          TAP-TO-ADVANCE IS GATED INSTEAD OF THE RENDER (fix round). Chapter 6's retraction is a
          wall clock, so the spread can still be mounted a fraction of a second into the ending —
          and `advanceTo` there would smooth-scroll the visitor back out of the curtain call to
          progress 1. Passing `null` un-arms the tap while the exit animation finishes, which is
          the half that has to change: hard-cutting a retracting spread is worse than letting it
          play, and a live click target under the ending is the trap the canvas-first model
          (aa399f6) exists to forbid. */}
      {ui.panel && (
        <ChapterPanels
          chapter={chapters[ui.panel.chapter]}
          index={ui.panel.chapter}
          enter={ui.panel.enter}
          onAdvance={
            ui.ending ? null : () => onAdvance((ui.panel!.chapter + 1) / CHAPTER_COUNT)
          }
        />
      )}
      {/* THE ENDING SLOT — mounted for the whole ending segment, empty on purpose. T64 hangs the
          curtain call's DOM (if it needs any) here and T65 the connect note; the phase attribute
          is the ending's own timeline, so a consumer can style off it without re-deriving it.
          `pointerEvents: none` is inherited from the overlay root and must STAY that way until
          something in here is genuinely clickable: the click model is canvas-first
          (onPointerMissed advances panels), and a transparent full-viewport catcher is exactly
          the tap blanket Task 61 removed. */}
      {ui.ending && (
        <div
          data-testid="sw-ending"
          data-phase={ui.ending.phase}
          style={{ position: 'absolute', inset: 0 }}
        >
          <EndingConnect t={ui.ending.t} onRestart={() => onAdvance(0)} />
        </div>
      )}
      {/* The rail reads RAW scroll: it is the "your input registered" affordance, so it must
          keep creeping even while an arrival absorbs the journey's own progress (Task 54). */}
      {SHOW_PROGRESS_RAIL && <JourneyProgress progressRef={journey?.rawProgressRef ?? progressRef} />}
    </div>
  )
}
