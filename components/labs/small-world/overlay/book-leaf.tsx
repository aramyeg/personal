'use client'
import type { CSSProperties, ReactNode } from 'react'
import {
  PAGE_ASPECT,
  PAGE_CENTRE_VH,
  PAGE_INSET_CSS,
  PAGE_TILT_LEFT_DEG,
  PAGE_TILT_RIGHT_DEG,
  PAGE_WIDTH_CSS,
} from '../book'
import { PALETTE } from '../palette'

/**
 * ONE LEAF OF THE OPEN BOOK.
 *
 * The chapter stop is a book held open with the little world in its gutter: her
 * story page on the left, the page about her work on the right. Both leaves are
 * drawn by this component, and that is the point of it existing — they are two
 * leaves of ONE book, so they share a size, a stock, a binding weight and a
 * shadow, and a change to any of those cannot reach one and miss the other.
 *
 * The two used to be independent components with independently-typed geometry,
 * which is how the left one grew 40% in Task 73 while the right one did not, and
 * how the mascot staging model came to believe in a card that had not existed
 * for two rounds (see `book.ts`).
 *
 * THE GEOMETRY IS NOT DECLARED HERE. It comes from `book.ts`, which is also what
 * `peeker-stage.ts` reads to decide where a mascot may stand. One source, two
 * consumers, no transcription.
 */
export function BookLeaf({
  side,
  enter,
  className,
  testId,
  children,
  onClick,
  ariaLabel,
  swallowClicks = false,
}: {
  side: 'left' | 'right'
  /** The spread's entrance clock, 0→1, already eased. */
  enter: number
  className: string
  testId: string
  children: ReactNode
  /** Present only on the leaf that opens full size. */
  onClick?: () => void
  ariaLabel?: string
  /**
   * Take clicks and do nothing with them.
   *
   * LEAST SURPRISE, and the blind audit's item 10. The overlay root is
   * `pointer-events: none` so the canvas can take every click that is not on a
   * leaf, and tap-anywhere advances the chapter. That is right for the world and
   * wrong for a printed page: clicking a card full of facts and being scrolled to
   * the NEXT chapter reads as a misfire, especially beside a comic page that
   * responds to a click by opening.
   *
   * So this leaf's own footprint absorbs the click. It is not a button — nothing
   * happens, and announcing an action that does not exist would be worse than the
   * misfire. If the stat page ever earns a lightbox of its own, this becomes an
   * `onClick` and the prop goes.
   */
  swallowClicks?: boolean
}) {
  const left = side === 'left'
  const tilt = left ? PAGE_TILT_LEFT_DEG : PAGE_TILT_RIGHT_DEG

  const style: Record<string, string | number> = {
    // Read by the phone stack's CSS, which cannot see this inline transform.
    '--sw-rotate': `${tilt}deg`,
    position: 'absolute',
    [left ? 'left' : 'right']: PAGE_INSET_CSS,
    top: `${PAGE_CENTRE_VH * 100}vh`,
    width: PAGE_WIDTH_CSS,
    aspectRatio: `1 / ${PAGE_ASPECT}`,
    border: `4px solid ${PALETTE.ink}`,
    borderRadius: 6,
    // The shadow falls away from the gutter, so the two leaves read as lifting
    // off the world between them rather than as two cards on one plane.
    boxShadow: `${left ? '10px' : '-10px'} 12px 0 ${PALETTE.ink}`,
    background: PALETTE.pagePaper,
    overflow: 'hidden',
    padding: 0,
    // Each leaf enters from its OWN edge — the book opens.
    transform: `translateY(-50%) translateX(calc(${left ? '-120%' : '120%'} * (1 - ${enter}))) rotate(${tilt * enter}deg) scale(${0.85 + 0.15 * enter})`,
    display: 'block',
    textAlign: 'left',
    // The overlay root stays `pointer-events: none` so the canvas keeps every
    // click that is not on a leaf; a leaf that does something takes its own.
    pointerEvents: onClick || swallowClicks ? 'auto' : 'none',
    ...(onClick ? { cursor: 'zoom-in' } : null),
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        data-testid={testId}
        aria-label={ariaLabel}
        onClick={onClick}
        style={style as CSSProperties}
      >
        {children}
      </button>
    )
  }
  return (
    <article
      className={className}
      data-testid={testId}
      style={style as CSSProperties}
      onClick={swallowClicks ? (e) => e.stopPropagation() : undefined}
    >
      {children}
    </article>
  )
}
