'use client'
import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { ArrivalJourney } from '../use-arrival-journey'
import { BiomeGrade, SHOW_GRADE } from './biome-grade'
import { ChapterPanels } from './chapter-panels'
import { CvOverlay } from './cv-overlay'
import { setCvOpener } from './cv-open'
import { MangaPreload } from './manga-card'
import { EndingConnect } from './ending-connect'
import { JourneyProgress } from './journey-progress'
import { SpeedLines } from './speed-lines'
import { IRIS_DESK, IRIS_START } from './iris-transition'
import { useIrisVeil } from './iris-veil'
import { advanceTargetFrom } from '../story-stops'
import { useJourneyUi } from './use-journey-ui'

/** Set false to remove the bottom progress rail entirely (one-line revert). */
const SHOW_PROGRESS_RAIL = true


/** Everything DOM above the canvas: speed lines, chapter panels, ending. */
export function JourneyOverlay({
  progressRef,
  journey,
  onAdvance,
  onSeek,
}: {
  progressRef: MutableRefObject<number>
  /** Supplies the arrival reveal clock; absent → panels key to the dwell as before (Task 54). */
  journey?: ArrivalJourney
  onAdvance: (targetProgress: number) => void
  /**
   * The same destination as `onAdvance`, arrived at INSTANTLY — the iris's one call to the
   * document, made while the frame is covered. Absent → the skip control is not drawn, which is
   * what keeps every existing unit mount of this tree unchanged.
   */
  onSeek?: (targetProgress: number) => void
}) {
  const ui = useJourneyUi(progressRef, journey)
  /**
   * THE PLAIN CV (Task 83) is owned here and nowhere else, because its two doors
   * are on opposite sides of this tree: one is printed on the first sheet, four
   * components down inside `ChapterPanels`; the other is beside the restart in
   * `EndingConnect`. `cv-open.ts` is the seam, on the same terms as `panel-tap.ts`.
   *
   * It is mounted OUTSIDE the `ui.ending` gate and outside the panel, so the
   * surface survives whatever the scroll does while it is open — and it does not
   * unmount the world, which is the whole reason it is a lightbox and not a route.
   */
  const [cvOpen, setCvOpen] = useState(false)
  useEffect(() => setCvOpener(() => setCvOpen(true)), [])
  /**
   * THE RESTART NO LONGER SCROLLS THE VISITOR BACKWARDS (Task 106). It used to be `onAdvance(0)`,
   * i.e. the panels' own smooth-scroll aimed at the top of a 1680 vh track — measured, that is
   * six authored worlds on screen for three frames apiece. `iris-transition.ts` carries the
   * measurement and the replacement; all this file needs to know is that the ending's restart and
   * the panels' tap-to-advance are no longer the same gesture and no longer share a handler.
   *
   * Task 108 pointed the same iris at a second destination, so the hook is no longer named for the
   * restart: `iris(target)` takes a journey progress, and the two controls differ only in which
   * one they hand it.
   */
  const { veil, iris } = useIrisVeil((p) => onSeek?.(p))
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
      {/* NO TITLE CARD, AND NO BOTTOM STRIP (Task 82).
          Both were the audit's answers to "her name appears nowhere" and "a flick
          leaves with nothing", and Aram's verdict is that the cure was worse: a
          card floating on the planet at load is a splash screen in front of the
          world, and a persistent box pinned across the bottom of every chapter is
          the shape readers have spent twenty years learning not to look at.
          The facts they carried have not been dropped — they moved onto the SHEET
          the chibi unrolls (`cloth-drag.tsx`), which is diegetic, is where a
          reader is already looking, and carries her name on the first one. */}
      {ui.panel && (
        <ChapterPanels
          index={ui.panel.chapter}
          enter={ui.panel.enter}
          page={ui.panel.page}
          onAdvance={
            /* The next STORY STOP, not the next chapter's boundary (Task 75): a tap and a fling
               have to land in the same place or the stops read as arbitrary. `advanceTargetFrom`
               owns both that and the last card's hand-off to the ending.

               ARMED ONLY AT THE STOP (T93, bug A). A retracting spread stays mounted for up to
               RETRACT_SECONDS after the visitor scrolls away, and with the tap armed through it a
               click landing in that window seized a scroll already in the visitor's hands —
               measured mid-travel, a whole chapter's smooth-scroll from a single click. `atStop`
               is false for the entire walk-out (either direction, ending included, which is what
               the `ui.ending` gate caught before this generalised it), so the click target's
               lifetime is the visit, not the mount. */
            ui.ending || !ui.panel.atStop
              ? null
              : () => onAdvance(advanceTargetFrom(ui.panel!.chapter))
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
          {/* THE INK ARRIVAL IS GONE (Task 82). Task 76 hung the epilogue page in
              the ending as a full-frame drawing; Aram's verdict is that it reads
              as a poster dropped over the last shot and stops the pull-back being
              the ending. The ending is the clean pull-back and the crest exit
              again, with the connect note the only thing that hangs here.
              `EndingConnect` never keyed off the page — it runs on `ui.ending.t`
              directly — so removing it leaves no hole to close. */}
          <EndingConnect t={ui.ending.t} onRestart={() => iris(IRIS_START)} />
        </div>
      )}
      {/* The rail reads RAW scroll: it is the "your input registered" affordance, so it must
          keep creeping even while an arrival absorbs the journey's own progress (Task 54). */}
      {/* THE SKIP RIDES THE SAME IRIS AS THE RESTART, pointed the other way (Task 108) — one
          mechanism, two destinations, so the lab's two "leave where you are" gestures cannot drift
          apart in timing or in look. It hangs on the rail because the rail is the journey's own
          chrome: it is already the thing that says where you are in the story, so it is the honest
          place for the control that says you can stop being there. */}
      {SHOW_PROGRESS_RAIL && (
        <JourneyProgress
          progressRef={journey?.rawProgressRef ?? progressRef}
          onSkip={onSeek ? () => iris(IRIS_DESK) : undefined}
        />
      )}
      {cvOpen && <CvOverlay onClose={() => setCvOpen(false)} />}
      {/* LAST, so it covers everything this tree draws — including the CV lightbox, which is the
          only thing here that outranks the ending. Mounted only while the gesture runs. */}
      {veil}
    </div>
  )
}
