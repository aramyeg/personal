'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { PALETTE } from '../palette'
import { CvDocument, CV_HEADING_ID } from './cv-document'
import { CV_CLOSE_TESTID, CV_TESTID } from './cv-open'

/**
 * THE ESCAPE HATCH'S SURFACE — the plain CV, stopping the medium (Task 83).
 *
 * ============================================================================
 * WHY A LIGHTBOX AND NOT A ROUTED PAGE, WHICH WAS THE OTHER CANDIDATE
 * ============================================================================
 * Task 77's working precedent is a plain page one click behind the world, and a
 * route has two real advantages this does not: a URL a recruiter can be sent, and
 * printing with no stylesheet at all. It was still the wrong call HERE, and the
 * reason is in the lab rather than in the genre.
 *
 * `small-world-experience.tsx` opens with `beginManualScrollRestoration()` and
 * `pinScrollToTop()` in a layout effect, and pins again the moment the tall track
 * mounts. That is not incidental — it is the fix for a reload-while-deep sampling
 * a stale scroll — but it means the lab CANNOT be returned to at depth. Leaving
 * for a route unmounts the whole 3D experience, and coming back re-mounts it: new
 * WebGL context, the planet loader again, the land re-baked, and the reader
 * deposited at progress 0. The brief's access requirement is that returning must
 * not move the world; on a route, returning DESTROYS and rebuilds it.
 *
 * A lightbox has none of that to argue about. The world is never unmounted, so
 * "returns to the exact scroll position" is true by construction rather than by
 * restoration. It also composes with what is already here: `manga-lightbox.tsx`
 * established the lab's modal shape, its Escape protocol and its backdrop click
 * model, and this is the second tenant of it.
 *
 * WHAT WAS GIVEN UP, RECORDED: there is no shareable URL for the plain CV. If
 * that turns out to matter, the cheapest answer is a routed page that renders
 * `CvDocument` directly — the document is already a standalone component with no
 * dependency on this shell, which is why it is a separate file.
 *
 * ============================================================================
 * IT IS PORTALLED, AND THAT IS THE PRINT STORY
 * ============================================================================
 * The lab's document contains a 1600vh scroll track. Printed as-is that is dozens
 * of blank sheets around one page of CV, which is exactly the "embarrassing" the
 * brief names. The rules below hide every direct child of `<body>` except this
 * one, which requires this to BE a direct child of body — hence the portal.
 *
 * The cost of leaving the app subtree is the font variables, which `page.tsx`
 * scopes to a `[data-sw-fonts]` div by className. So the portal root wears that
 * element's className, read off the DOM. `desk-note.tsx` already resolves
 * `--sw-font-hand` through the same handle for the same reason.
 *
 * ============================================================================
 * NO ENTRANCE, FOR ANYONE
 * ============================================================================
 * There is no transition, no fade and no scale — not a reduced-motion branch, but
 * one behaviour. A reader who asked for the plain version asked to stop looking at
 * a moving world, and animating the thing that stops the motion is the joke
 * telling itself. It also deletes a class of bug: there is no state that can be
 * caught half-arrived, which is the defect Task 82 spent a round removing from the
 * leaf beside it.
 */

/** How far the page may have drifted before the close restores it. Sub-pixel is noise. */
export const SCROLL_EPSILON_PX = 0.5

/**
 * Where the close should put the scroll back, or `null` when it never moved.
 *
 * Pure and exported so the policy is a unit test rather than a browser: the
 * backdrop is a scroll container with `overscroll-behavior: contain`, so in
 * practice a wheel over the CV never reaches the track at all and this returns
 * `null` every time. It is the guarantee for the engines where containment does
 * not hold — a restore that fires is a bug being absorbed, and the test that
 * proves the arithmetic is what stops it being absorbed silently.
 */
export function scrollRestoreTarget(saved: number, current: number): number | null {
  return Math.abs(current - saved) > SCROLL_EPSILON_PX ? saved : null
}

/**
 * Hide the whole document and lay the CV out as a plain static block.
 *
 * `body > *:not(...)` rather than a `visibility` sweep: visibility leaves the
 * hidden boxes occupying layout, and the box being left behind here is a track
 * sixteen viewport-heights tall.
 */
const PRINT_CSS = `
@media print {
  html, body {
    background: #fff !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }
  body > *:not([data-sw-cv-root]) { display: none !important; }
  body > [data-sw-cv-root] {
    display: block !important;
    position: static !important;
    inset: auto !important;
    padding: 0 !important;
    background: #fff !important;
    overflow: visible !important;
  }
  [data-sw-cv-panel] {
    max-width: none !important;
    width: auto !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: #fff !important;
  }
  [data-sw-cv-doc] { padding: 0 !important; background: #fff !important; }
  [data-sw-cv-chrome] { display: none !important; }
  @page { margin: 16mm; }
}
`

/** Everything a Tab may land on inside the panel. */
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function CvOverlay({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Read once, on the client: the class that carries `--sw-font-*` outside the app subtree.
  const [fontClass, setFontClass] = useState('')

  useEffect(() => {
    setFontClass(document.querySelector('[data-sw-fonts]')?.className ?? '')
  }, [])

  /**
   * THE LAB'S ESCAPE PROTOCOL. Claim the key in the CAPTURE phase and mark it
   * handled: `gallery-chrome.tsx` listens on the bubble and checks
   * `defaultPrevented` before navigating to the museum, so without this, closing
   * the CV would also leave the lab.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [onClose])

  /**
   * SCROLL PURITY, AND FOCUS BACK WHERE IT CAME FROM.
   *
   * Both are the same promise from two directions: the reader must come back to
   * exactly where they left, on screen and in the tab order. The opener is
   * whatever had focus at mount — the sheet's link or the ending's — and it is
   * restored only if it is still in the document, because the ending's own
   * controls can scroll out of existence while the CV is open.
   */
  useEffect(() => {
    const savedScroll = window.scrollY
    const opener = document.activeElement as HTMLElement | null
    // The document itself, so a screen reader starts at her name rather than at
    // the close button, and so the first Tab moves forward through the page.
    //
    // `preventScroll` ON BOTH CALLS, and it is not belt-and-braces — it is the fix
    // for a measured defect. `focus()` scrolls the element's ancestors to reveal
    // it, so handing focus back to the sheet's link scrolled the track under the
    // reader: e2e caught the return landing 222px away from where Escape was
    // pressed, on a page whose whole promise is that it does not move the world.
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      // FOCUS FIRST, THEN THE GUARD. The restore used to run before the focus,
      // which is exactly why it absorbed nothing: it corrected a scroll and then
      // the focus call moved it again. Whatever still shifts the page is now
      // upstream of the thing that puts it back.
      if (opener?.isConnected) opener.focus({ preventScroll: true })
      const back = scrollRestoreTarget(savedScroll, window.scrollY)
      if (back !== null) window.scrollTo({ top: back, behavior: 'instant' as ScrollBehavior })
    }
  }, [])

  /**
   * Tab cycles inside the dialog; it may not walk out into a world nobody can see.
   *
   * The stops are queried on the ROOT rather than on the panel, because the Close
   * button is the panel's sibling — trapping on the panel alone would have let a
   * forward Tab off the page's last link escape to whatever the lab has behind the
   * scrim, and left Close reachable only by pointer.
   */
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const root = rootRef.current
    if (!root) return
    const stops = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (stops.length === 0) {
      e.preventDefault()
      return
    }
    const first = stops[0]
    const last = stops[stops.length - 1]
    const active = document.activeElement
    if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    } else if (e.shiftKey && (active === first || active === panelRef.current)) {
      // Backwards off the first stop wraps to the last; backwards off the PANEL
      // does too, because the panel holds focus on open and has nothing before it.
      e.preventDefault()
      last.focus()
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={rootRef}
      data-sw-cv-root=""
      data-testid={CV_TESTID}
      className={fontClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby={CV_HEADING_ID}
      style={backdrop}
      onClick={onClose}
      onKeyDown={trapTab}
    >
      <style>{PRINT_CSS}</style>
      <div
        ref={panelRef}
        data-sw-cv-panel=""
        tabIndex={-1}
        style={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <CvDocument />
      </div>
      <button
        type="button"
        data-sw-cv-chrome=""
        data-testid={CV_CLOSE_TESTID}
        // The scrim closes on any click it receives, and this button sits ON the scrim —
        // without the stop, pressing Close ran the close twice. Both closes happen to be
        // idempotent today, which is exactly why it would have gone on being invisible.
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        style={close}
      >
        Close
      </button>
    </div>,
    document.body
  )
}

/**
 * A DARK SCRIM, and it is doing three jobs rather than looking moody: it stops the
 * clay world competing with a page of small type, it takes every click so the
 * canvas underneath never sees one (r3f's `onPointerMissed` would otherwise scroll
 * the reader out from under the page they just opened), and `overscroll-behavior:
 * contain` keeps a wheel over the CV from chaining into the track.
 */
const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: 'rgba(20, 18, 24, 0.86)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: 'min(6vh, 44px) min(4vw, 24px)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  pointerEvents: 'auto',
  cursor: 'zoom-out',
}

const panel: CSSProperties = {
  width: '100%',
  // WIDE ENOUGH FOR THE LONGEST FACT, which is the degree: at 660 it ran 640px and
  // wrapped, leaving "2019" alone under it. This is a page of single-line records
  // rather than of prose, so the column is sized to the records — 780 less the
  // document's own 52px margins is 676, and the degree measures 640.
  maxWidth: 780,
  margin: 'auto',
  background: PALETTE.pagePaper,
  borderRadius: 4,
  boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
  cursor: 'default',
  // A focused panel is where the reader IS, not an error — the dialog's own edge
  // is the indicator and a browser ring drawn around a full sheet of paper is not.
  outline: 'none',
}

/**
 * A WORD, NOT A GLYPH. The lab's other lightbox closes with a drawn cross, which
 * is right for a picture the reader opened to LOOK at; this page is the one a
 * visitor arrived at to read, and the research's own finding about this surface is
 * that the genre hides it behind unlabelled icons.
 */
const close: CSSProperties = {
  position: 'fixed',
  top: 'min(2.4vh, 18px)',
  right: 'min(3vw, 22px)',
  appearance: 'none',
  fontFamily: 'var(--sw-font-display), ui-sans-serif, system-ui, sans-serif',
  fontWeight: 700,
  fontSize: 15,
  letterSpacing: 0.3,
  padding: '9px 18px',
  minHeight: 44,
  borderRadius: 999,
  border: `2px solid ${PALETTE.ink}`,
  background: PALETTE.pagePaper,
  color: PALETTE.ink,
  cursor: 'pointer',
}
