'use client'

/**
 * Fixed bottom chrome for the book: back/next arrow buttons, a center folio
 * naming the current spread, an sr-only live region for screen readers, and
 * two invisible corner hotspots so a single tap advances/retreats on coarse
 * (touch) pointers — the XP lab's single-tap lesson. Mounted by the loader
 * alongside the canvas; always present (including at the cover, so the
 * "next" arrow/hotspot is itself an alternate way to open the book).
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
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--sb-gold)] bg-black/30 text-lg text-[var(--sb-gold)] backdrop-blur-sm transition-colors hover:bg-[var(--sb-gold)]/15 disabled:pointer-events-none disabled:opacity-30"
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
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--sb-gold)] bg-black/30 text-lg text-[var(--sb-gold)] backdrop-blur-sm transition-colors hover:bg-[var(--sb-gold)]/15 disabled:pointer-events-none disabled:opacity-30"
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
        onClick={() => requestTurn('prev')}
        className="fixed bottom-0 left-0 z-30"
        style={HOTSPOT_STYLE}
      />
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => requestTurn('next')}
        className="fixed right-0 bottom-0 z-30"
        style={HOTSPOT_STYLE}
      />
    </>
  )
}
