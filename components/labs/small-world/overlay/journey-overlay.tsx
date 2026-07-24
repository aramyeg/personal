'use client'
import type { MutableRefObject } from 'react'
import { CHAPTER_COUNT, chapters } from '../chapters'
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
  onAdvance,
}: {
  progressRef: MutableRefObject<number>
  onAdvance: (targetProgress: number) => void
}) {
  const ui = useJourneyUi(progressRef)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <SpeedLines active={ui.burst} />
      {ui.panel && !ui.ended && (
        <ChapterPanels
          chapter={chapters[ui.panel.chapter]}
          index={ui.panel.chapter}
          t={ui.panel.t}
          onAdvance={() => onAdvance((ui.panel!.chapter + 1) / CHAPTER_COUNT)}
        />
      )}
      {ui.ended && <EndPanel />}
      {SHOW_PROGRESS_RAIL && <JourneyProgress progressRef={progressRef} />}
    </div>
  )
}
