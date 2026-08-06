'use client'
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { MangaPage } from '../manga/types'
import { PALETTE } from '../palette'
import { MangaPageArt } from './manga-page'

/**
 * The page, full size, over everything.
 *
 * THIS IS THE ONE THING ALLOWED TO BLANKET THE CANVAS, and only while it is
 * open. Task 61's rule is that the lab must not leave an invisible full-frame
 * click catcher over the canvas during normal reading — a modal that the
 * visitor deliberately opened is the opposite case, and it wants every click:
 * anywhere outside the page closes it, and because the backdrop consumes the
 * event the canvas never sees it, so tap-to-advance cannot fire underneath.
 * It unmounts on close, taking its pointer surface with it.
 *
 * The page renders `instant`: the reader has already watched it ink in on the
 * card, and replaying the reveal here would make them wait to see the thing
 * they just asked to see.
 */
export function MangaLightbox({ page, onClose }: { page: MangaPage; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // The lab's Escape protocol (see `gallery-chrome.tsx` and the curator's
      // `use-esc-capture.ts`): claim the key in the CAPTURE phase and mark it
      // handled with preventDefault, which the chrome's bubble listener checks
      // via `defaultPrevented` before navigating away. Without this, closing the
      // page would also leave the lab for the museum.
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [onClose])

  const backdrop: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 40,
    background: 'rgba(20, 18, 24, 0.82)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'min(4vh, 28px)',
    pointerEvents: 'auto',
    cursor: 'zoom-out',
  }

  // Height-led, because a 2:3 page on a landscape screen is limited by height
  // and letting it be width-led would push it off the top and bottom.
  const frame: CSSProperties = {
    height: 'min(92vh, 96vw * 1.5)',
    aspectRatio: `${page.size.w} / ${page.size.h}`,
    maxWidth: '96vw',
    border: `4px solid ${PALETTE.ink}`,
    borderRadius: 6,
    boxShadow: `0 24px 60px rgba(0,0,0,0.5)`,
    background: PALETTE.sky,
    overflow: 'hidden',
    cursor: 'default',
  }

  return (
    <div
      style={backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Page ${page.id.replace('page-', '')}, full size`}
      data-testid="sw-manga-lightbox"
    >
      <div style={frame} onClick={(e) => e.stopPropagation()}>
        <MangaPageArt page={page} running instant priority />
      </div>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close page"
        style={{
          position: 'absolute',
          top: 'min(3vh, 20px)',
          right: 'min(3vw, 24px)',
          width: 44,
          height: 44,
          borderRadius: 999,
          border: `3px solid ${PALETTE.ink}`,
          background: PALETTE.sky,
          color: PALETTE.ink,
          fontFamily: 'var(--sw-font-panel)',
          fontSize: 22,
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  )
}
