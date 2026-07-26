'use client'

/**
 * Fixed bottom chrome for the book: back/next arrow buttons, a center folio
 * naming the current spread, an sr-only live region for screen readers, and
 * two corner hotspots so a single tap advances/retreats on coarse (touch)
 * pointers — the XP lab's single-tap lesson. Mounted by the loader alongside
 * the canvas; always present (including at the cover, so the "next"
 * arrow/hotspot is itself an alternate way to open the book).
 *
 * BW-3 / BW-16 (all five blind readers flagged the corners): they were
 * fully invisible — transparent, `default` cursor, no hover/focus state, no
 * curl preview — so a reader only ever found one by dragging across it by
 * accident. Fixed on three axes without restructuring the file:
 *  - aria: the corners stay OUT of the accessibility tree (aria-hidden +
 *    tabIndex={-1}), deliberately, not by omission. They are a second,
 *    touch-only route to the exact `requestTurn` action the labeled `‹`/`›`
 *    arrows already expose to keyboard/AT users a few pixels away with a
 *    real aria-label and a real focus stop. Giving the corners their own
 *    name would plant two same-purpose, differently-shaped controls in
 *    every screen-reader user's page-turn story — one of them a hit region
 *    they have no way to perceive the bounds of — for zero gain over the
 *    arrows. That's a worse AT experience, not a more honest one, so the
 *    hidden treatment stays; see the commit message for the full argument.
 *  - cursor: `data-sb-hover` (quill-cursor.tsx's growth/gold-catch trigger)
 *    now covers the corners too, matching the arrows. `.sb-nav-clickable`
 *    (storybook.css) gives every one of these buttons a `pointer` cursor on
 *    the coarse-pointer path where the native cursor is still the one the
 *    reader sees — arrows included, since reviewers found the arrows just
 *    as unlabeled-by-cursor as the corners.
 *  - a visible paper dog-ear (storybook.css `.sb-dogear`) now sits inside
 *    each corner button — a whisper-quiet fold at rest, lifting a touch on
 *    hover/focus — replacing "no visual sign at all" with a hint that
 *    reads as paper, not as UI. Rendered only on the side that can
 *    currently turn (never on "back" at the cover, never on "next" at the
 *    last spread), same rule the arrows already enforce with `disabled`.
 */

import { chapterForSpread, SPREAD_COUNT } from '../content'
import { useStorybookStore } from '../store'
import { useSpreadChoreography } from './use-spread-choreography'

const HOTSPOT_STYLE = {
  width: '18vw',
  height: '22vh',
  touchAction: 'manipulation' as const,
  background: 'transparent',
}

const spreadLabel = (spread: number): string => {
  const chapter = chapterForSpread(spread)
  if (chapter) return `${chapter.numeral} · ${chapter.title}`
  if (spread === 0) return 'Cover'
  if (spread === 1) return 'Title page'
  if (spread === 8) return "The Hero's Satchel"
  return 'The End' // the only spread left: SPREAD_COUNT - 1
}

export function BookNav() {
  const spread = useStorybookStore((s) => s.spread)
  const requestTurn = useStorybookStore((s) => s.requestTurn)
  // The label reads the choreography's displaySpread so it swaps with the
  // overlay text on the same land cue (a beat before the store commit), not
  // ~280ms after it. The arrows/hotspots stay on the COMMITTED `spread` — turn
  // bounds and requests must track the real position, not the previewed label.
  const { displaySpread } = useSpreadChoreography()

  const atStart = spread <= 0
  const atEnd = spread >= SPREAD_COUNT - 1
  const label = spreadLabel(displaySpread)

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-6 z-40 flex items-center justify-center gap-6 px-6"
        aria-label="Page navigation"
      >
        <button
          type="button"
          aria-label="Turn back"
          disabled={atStart}
          onClick={() => requestTurn('prev')}
          data-sb-hover
          className="sb-nav-clickable grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--sb-gold)] bg-black/30 text-lg text-[var(--sb-gold)] backdrop-blur-sm transition-colors hover:bg-[var(--sb-gold)]/15 disabled:pointer-events-none disabled:opacity-30"
        >
          <span aria-hidden="true">‹</span>
        </button>

        <p className="sb-chapter-kicker sb-nav-pill truncate rounded-full border border-[var(--sb-gold)]/40 bg-black/30 px-4 py-1.5 text-center backdrop-blur-sm">
          {label}
        </p>

        <button
          type="button"
          aria-label="Turn the page"
          disabled={atEnd}
          onClick={() => requestTurn('next')}
          data-sb-hover
          className="sb-nav-clickable grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--sb-gold)] bg-black/30 text-lg text-[var(--sb-gold)] backdrop-blur-sm transition-colors hover:bg-[var(--sb-gold)]/15 disabled:pointer-events-none disabled:opacity-30"
        >
          <span aria-hidden="true">›</span>
        </button>
      </nav>

      <div className="sr-only" aria-live="polite">
        {label}
      </div>

      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        disabled={atStart}
        onClick={() => requestTurn('prev')}
        data-sb-hover
        className="sb-nav-clickable fixed bottom-0 left-0 z-30 disabled:pointer-events-none"
        style={HOTSPOT_STYLE}
      >
        {!atStart && <span className="sb-dogear sb-dogear--left" aria-hidden="true" />}
      </button>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        disabled={atEnd}
        onClick={() => requestTurn('next')}
        data-sb-hover
        className="sb-nav-clickable fixed right-0 bottom-0 z-30 disabled:pointer-events-none"
        style={HOTSPOT_STYLE}
      >
        {!atEnd && <span className="sb-dogear sb-dogear--right" aria-hidden="true" />}
      </button>
    </>
  )
}
