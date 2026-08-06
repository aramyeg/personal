'use client'
import { mangaPageFor } from '../manga'
import { mangaPageSrc, type MangaPage } from '../manga/types'
import { usePrefersReducedMotion } from '../scene/use-reduced-motion'
import { BookLeaf } from './book-leaf'
import { MangaPageArt } from './manga-page'

/**
 * The book's LEFT leaf: one manga page of her story.
 *
 * SIZE. It used to be `min(24vw, 300px)`, which was fine for a placeholder and
 * far too small for this linework — at 300px the fine crosshatch on a page like
 * the river delta turns to grey. The art pipeline is built around the ceiling:
 * `prepare-manga.mjs` ships 840px-wide pages so the leaf is served at 2x.
 *
 * TASK 75 MOVED THE GEOMETRY OUT of this file, into `book.ts`. Two reasons, and
 * the second is the one that matters:
 *
 *  - This leaf and the info leaf beside it are two pages of ONE book, so their
 *    size, stock, binding weight and shadow have to be the same thing rather
 *    than two things that agree today.
 *  - `scene/props/peeker-stage.ts` keeps the checkpoint mascots clear of these
 *    boxes, and it did so by transcribing the numbers from this file. Task 73's
 *    growth here was never transcribed there, and the shipped card ended up
 *    covering 47%–61% of the left mascot — the defect Aram reported. The model
 *    imports the geometry now; it cannot go stale again.
 *
 * The ceiling still exists as `PAGE_MAX_PX` and the 2x pipeline argument still
 * holds, but the ceiling is no longer what binds: measured across the desktop
 * suite the page is sized by `PAGE_VH`, because the book gives way to the
 * mascots rather than the other way round.
 */
export const CARD_MAX_PX = 380

export function MangaCard({
  page,
  chapterNumber,
  enter,
  onExpand,
}: {
  page: MangaPage
  /** 1-based. The label is read aloud, so it counts the way a reader counts. */
  chapterNumber: number
  /** The spread's entrance clock, 0→1, already eased. */
  enter: number
  onExpand: () => void
}) {
  const reduced = usePrefersReducedMotion()

  return (
    <BookLeaf
      side="left"
      enter={enter}
      className="sw-panel-art"
      testId="sw-manga-card"
      onClick={onExpand}
      // Was "Open page 0 full size" — the file's own 0-based stem, read out as if
      // the reader were counting from zero.
      ariaLabel={`Open chapter ${chapterNumber}'s comic page full size`}
    >
      {/* The page starts inking once the leaf is most of the way in, so the
          frames land on a page that has stopped moving. */}
      <MangaPageArt page={page} running={enter > 0.55} instant={reduced} />
    </BookLeaf>
  )
}

/**
 * Requests a chapter's page while the girl is still walking toward it.
 *
 * LAZY IS THE POINT: seven pages at ~250KB is 1.7MB, and none of it may land on
 * first paint. Mounting this against the journey's CURRENT chapter means page N
 * is requested when travel into chapter N begins — a whole travel segment ahead
 * of the leaf that shows it, which is plenty for a decode, and page 0 is not
 * requested until the visitor has actually started moving.
 *
 * It now feeds BOTH leaves: the info page's spot illustration is a crop of the
 * same file, so one request still covers the whole spread.
 *
 * It renders an `<img>` rather than a `<link rel=preload>` so the fetch shares
 * the cache entry (and the decode) with the leaf's own `<img>` for the same
 * URL, and so it costs nothing on a browser that ignores preload hints.
 */
export function MangaPreload({ chapter }: { chapter: number }) {
  const page = mangaPageFor(chapter)
  if (!page) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mangaPageSrc(page.id)}
      alt=""
      aria-hidden
      width={1}
      height={1}
      decoding="async"
      data-testid="sw-manga-preload"
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
    />
  )
}
