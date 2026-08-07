'use client'
import type { CSSProperties } from 'react'
import { chapters } from '../chapters'
import { INFO_PAGES } from './info-page-spec'
import { PALETTE } from '../palette'

/**
 * THE CHAPTER STRIP — the facts, present for the whole chapter, spread or no spread.
 *
 * ============================================================================
 * WHY IT EXISTS
 * ============================================================================
 * The blind audit scored information conveyance 3/10, and the geometry behind
 * that score is stark: the spread only exists during a chapter's DWELL, which is
 * roughly 700px of a 2133px chapter. The other two thirds are travel — a bare
 * planet carrying nothing at all — and a visitor who flicks passes through the
 * whole chapter without a single fact reaching them.
 *
 * The leaf now renders its facts instantly (see the inversion note in
 * `info-page.tsx`), but that only fixes the dwell. This fixes the SPAN: a small
 * printed strip that is up for the entire chapter, travel included, carrying the
 * three things a reader scanning a CV actually needs —
 *
 *     WHO SHE WAS THEN (role), WHERE (company), WHEN (years), and her HOOK.
 *
 * ============================================================================
 * THE HOOKS WERE INVISIBLE
 * ============================================================================
 * `alwina-story.ts` has carried a `hook` per chapter since the story swap — the
 * single most scannable line in the deck — and it rendered NOWHERE in the real
 * experience. Its only consumer was `fallback-timeline.tsx`, the no-WebGL path.
 * The audit found it; this is where it surfaces.
 *
 * ============================================================================
 * IT IS NOT A SECOND CARD
 * ============================================================================
 * A strip, deliberately: one line of ink on paper, pinned low, out of the world's
 * way and out of the leaves' way. If it grew a panel border and a hero it would
 * be competing with the spread it is there to precede. It is the running head of
 * a printed page, and it behaves like one.
 *
 * On the phone it is the ONLY thing carrying a fact on the default face — the
 * audit's other finding was that every fact there sat behind an unlabelled tab.
 */

/** How wide the strip is allowed to get before it stops being a strip. */
const MAX_W = 'min(92vw, 760px)'

export function ChapterStrip({ chapter, present }: { chapter: number; present: number }) {
  const story = chapters[chapter]
  const info = INFO_PAGES[chapter]
  if (!story || !info) return null

  const style: Record<string, string | number> = {
    position: 'absolute',
    left: '50%',
    // Clear of the progress rail, which sits at bottom 22px and stands about 40px
    // tall — captured with the strip's shadow landing on the chapter counter.
    bottom: 'max(76px, calc(env(safe-area-inset-bottom) + 76px))',
    width: MAX_W,
    transform: `translateX(-50%) translateY(${(1 - present) * 10}px)`,
    // Present is a FADE ONLY, and a shallow one: the strip is the piece that has
    // to survive a flick, so it may never be fully absent while its chapter is.
    opacity: 0.25 + 0.75 * present,
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    textAlign: 'center',
    background: `${PALETTE.pagePaper}F2`,
    border: `2px solid ${PALETTE.ink}`,
    borderRadius: 3,
    boxShadow: `3px 4px 0 ${PALETTE.ink}`,
    padding: '6px 14px',
    boxSizing: 'border-box',
  }

  return (
    <div data-testid="sw-chapter-strip" className="sw-chapter-strip" style={style as CSSProperties}>
      {/* ON THE PHONE IT MOVES TO THE TOP. The stack owns the bottom half of a
          phone screen, so a strip pinned low would sit behind the very card it
          exists to precede. A running head belongs at the top of a page anyway. */}
      <style>{`
        @media (max-width: 900px) {
          .sw-chapter-strip {
            top: max(56px, calc(env(safe-area-inset-top) + 56px)) !important;
            bottom: auto !important;
            width: min(94vw, 460px) !important;
          }
        }
      `}</style>
      <span
        data-sw-text="strip-hook"
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: 'clamp(12px, 1.35vw, 17px)',
          letterSpacing: '0.02em',
          lineHeight: 1.15,
          color: PALETTE.ink,
        }}
      >
        {story.hook}
      </span>
      <span
        data-sw-text="strip-credit"
        style={{
          fontFamily: 'var(--sw-font-body)',
          fontSize: 'clamp(10px, 0.95vw, 12.5px)',
          lineHeight: 1.2,
          color: PALETTE.ink,
          opacity: 0.78,
        }}
      >
        {info.footer.role} · {info.footer.org} · {info.footer.period}
      </span>
    </div>
  )
}
