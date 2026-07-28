'use client'
import type { MutableRefObject } from 'react'
import { CHAPTER_COUNT, chapters } from '../chapters'
import type { ArrivalJourney } from '../use-arrival-journey'
import { BiomeGrade, SHOW_GRADE } from './biome-grade'
import { ChapterPanels } from './chapter-panels'
import { EndPanel } from './end-panel'
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
      {ui.panel && !ui.ended && (
        <ChapterPanels
          chapter={chapters[ui.panel.chapter]}
          index={ui.panel.chapter}
          enter={ui.panel.enter}
          onAdvance={() => onAdvance((ui.panel!.chapter + 1) / CHAPTER_COUNT)}
        />
      )}
      {ui.ended && <EndPanel />}
      {/* The rail reads RAW scroll: it is the "your input registered" affordance, so it must
          keep creeping even while an arrival absorbs the journey's own progress (Task 54). */}
      {SHOW_PROGRESS_RAIL && <JourneyProgress progressRef={journey?.rawProgressRef ?? progressRef} />}
    </div>
  )
}
