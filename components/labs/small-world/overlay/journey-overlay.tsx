'use client'
import type { MutableRefObject } from 'react'
import type { ArrivalJourney } from '../use-arrival-journey'
import { BiomeGrade, SHOW_GRADE } from './biome-grade'
import { ChapterPanels } from './chapter-panels'
import { ChapterStrip } from './chapter-strip'
import { TitleCard } from './title-card'
import { MangaPreload } from './manga-card'
import { EndingConnect } from './ending-connect'
import { EndingInk } from './ending-ink'
import { JourneyProgress } from './journey-progress'
import { SpeedLines } from './speed-lines'
import { advanceTargetFrom } from '../story-stops'
import { useJourneyUi } from './use-journey-ui'
import { usePrefersReducedMotion } from '../scene/use-reduced-motion'

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
  const reduced = usePrefersReducedMotion()
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* FIRST child on purpose: the per-biome grade must paint under the cards and the rail, so
          panel text can never be tinted by it (see biome-grade.tsx). */}
      {SHOW_GRADE && <BiomeGrade progressRef={progressRef} journey={journey} />}
      <SpeedLines active={ui.burst} />
      {/* Fetches the CURRENT chapter's page while the girl is still walking to it,
          so the card opens on a decoded image. Keyed to the journey's chapter, which
          means nothing is requested until the visitor has actually started moving —
          the seven pages must never be on the first-paint route. */}
      {ui.started && <MangaPreload chapter={ui.chapter} />}
      {/* No `ended` gate any more (Task 63). It existed to clear the stage for the retired
          `EndPanel`, and at END_AT = 0.985 it cut chapter 6's dwell short — the cards were
          yanked mid-read at 0.985 while the dwell ran to 0.9917. The cards now retract the
          way every other chapter's do, on their own clock, and the ending begins after.

          TAP-TO-ADVANCE IS GATED INSTEAD OF THE RENDER (fix round). Chapter 6's retraction is a
          wall clock, so the spread can still be mounted a fraction of a second into the ending —
          and `advanceTo` there would smooth-scroll the visitor back out of the still beat to
          progress 1. Passing `null` un-arms the tap while the exit animation finishes, which is
          the half that has to change: hard-cutting a retracting spread is worse than letting it
          play, and a live click target under the ending is the trap the canvas-first model
          (aa399f6) exists to forbid. */}
      {/* HER NAME, at the top of her own book. The audit's plainest finding was
          that it appeared NOWHERE in the piece — a recruiter could read the whole
          thing without learning whose CV it was. It holds the frame before she
          starts walking and is gone by the time she does: `progress` here is the
          raw journey clock, so the card fades on the visitor's own first scroll
          rather than on a timer. */}
      <TitleCard present={ui.title} />
      {/* THE FACTS, for the WHOLE chapter and not just its dwell. The spread is up
          for about a third of a chapter's scroll; this is up for all of it, so a
          visitor who flicks still leaves with the role, the company, the years and
          her hook. See chapter-strip.tsx — it is the audit's headline fix. */}
      {ui.started && !ui.ending && <ChapterStrip chapter={ui.chapter} present={1} />}
      {ui.panel && (
        <ChapterPanels
          index={ui.panel.chapter}
          enter={ui.panel.enter}
          page={ui.panel.page}
          onAdvance={
            /* The next STORY STOP, not the next chapter's boundary (Task 75): a tap and a fling
               have to land in the same place or the stops read as arbitrary. `advanceTargetFrom`
               owns both that and the last card's hand-off to the ending. */
            ui.ending ? null : () => onAdvance(advanceTargetFrom(ui.panel!.chapter))
          }
        />
      )}
      {/* THE ENDING SLOT — mounted for the whole ending segment. T65's connect note is what hangs
          here; the phase attribute is the ending's own timeline, so a consumer can style off it
          without re-deriving it.
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
          {/* THE INK ARRIVAL (Task 76). The last page of the book the chapters were,
              and the one place in this story where her face is right — the 3D girl
              leaves the world over the crest and does not come back in three
              dimensions. `ending-ink.tsx` carries the DOM, `ink-arrival.ts` the
              argument and the staging. It is drawn BEFORE the connect note so the
              note and the pills always sit on top of it. */}
          <EndingInk t={ui.ending.t} reduced={reduced} />
          <EndingConnect t={ui.ending.t} onRestart={() => onAdvance(0)} />
        </div>
      )}
      {/* The rail reads RAW scroll: it is the "your input registered" affordance, so it must
          keep creeping even while an arrival absorbs the journey's own progress (Task 54). */}
      {SHOW_PROGRESS_RAIL && <JourneyProgress progressRef={journey?.rawProgressRef ?? progressRef} />}
    </div>
  )
}
