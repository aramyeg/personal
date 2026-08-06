'use client'
import type { CSSProperties } from 'react'
import { mangaPageFor } from '../manga'
import { mangaPageSrc, type MangaPage } from '../manga/types'
import { usePrefersReducedMotion } from '../scene/use-reduced-motion'
import { PALETTE } from '../palette'
import { MangaPageArt } from './manga-page'

/**
 * The art card: one manga page, in a comic frame, on the left of the spread.
 *
 * SIZE. It used to be `min(24vw, 300px)`, which was fine for a placeholder and
 * far too small for this linework — at 300px the fine crosshatch on a page like
 * the river delta turns to grey. 420 is the ceiling now, and it is also the
 * number the art pipeline is built around: `prepare-manga.mjs` ships 840px-wide
 * pages so the card is served at exactly 2x. Change one and change the other.
 */
export const CARD_MAX_PX = 420

const INK_BORDER = `4px solid ${PALETTE.ink}`

export function MangaCard({
  page,
  enter,
  onExpand,
}: {
  page: MangaPage
  /** The spread's entrance clock, 0→1, already eased. */
  enter: number
  onExpand: () => void
}) {
  const reduced = usePrefersReducedMotion()

  // `--sw-rotate` is read by the mobile stack's CSS, which cannot see this
  // component's inline transform; the Record cast is how a custom property gets
  // past CSSProperties' key type.
  const style: Record<string, string | number> = {
    '--sw-rotate': '-3deg',
    position: 'absolute',
    left: 'min(4vw, 48px)',
    top: '34vh',
    width: `min(30vw, ${CARD_MAX_PX}px)`,
    border: INK_BORDER,
    borderRadius: 6,
    boxShadow: `10px 12px 0 ${PALETTE.ink}`,
    background: PALETTE.sky,
    overflow: 'hidden',
    transform: `translateY(-50%) translateX(calc(-120% * (1 - ${enter}))) rotate(${-3 * enter}deg) scale(${0.85 + 0.15 * enter})`,
    // THE ONE PLACE ON THE SPREAD THAT TAKES A CLICK. The overlay root stays
    // `pointer-events: none` and the canvas keeps taking every other click, so
    // tap-to-advance and the canvas easter eggs are untouched (Task 61's rule
    // was against a full-viewport catcher, not against a visible card being
    // clickable). This element's footprint is its own painted box.
    pointerEvents: 'auto',
    cursor: 'zoom-in',
    padding: 0,
    display: 'block',
    textAlign: 'left',
  }

  return (
    <button
      type="button"
      className="sw-panel-art"
      style={style as CSSProperties}
      onClick={onExpand}
      aria-label={`Open page ${page.id.replace('page-', '')} full size`}
      data-testid="sw-manga-card"
    >
      {/* The page starts inking once the card is most of the way in, so the
          frames land on a card that has stopped moving. */}
      <MangaPageArt page={page} running={enter > 0.55} instant={reduced} />
    </button>
  )
}

/**
 * Requests a chapter's page while the girl is still walking toward it.
 *
 * LAZY IS THE POINT: seven pages at ~250KB is 1.7MB, and none of it may land on
 * first paint. Mounting this against the journey's CURRENT chapter means page N
 * is requested when travel into chapter N begins — a whole travel segment ahead
 * of the card that shows it, which is plenty for a decode, and page 0 is not
 * requested until the visitor has actually started moving.
 *
 * It renders an `<img>` rather than a `<link rel=preload>` so the fetch shares
 * the cache entry (and the decode) with the card's own `<img>` for the same
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
