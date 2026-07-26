'use client'

/**
 * Behaviour for the compact-layout story drawer — the "unfold the tale" sheet
 * that slides the chapter text and the credential plaque up over the book on
 * phones and narrow tablets. Layout/paint lives in storybook-responsive.css;
 * everything the CSS can't do lives here:
 *
 *   - OPEN/CLOSE state, plus an auto-close whenever the shown spread changes:
 *     an open sheet must never keep covering a scene the reader just turned to.
 *   - DISMISS GESTURES beyond the handle: a downward drag on the sheet (armed
 *     only when it is scrolled to its top, so a normal read-scroll never
 *     closes it) and Escape. Escape calls `preventDefault()` because
 *     `<GalleryChrome>` also listens for it on `window` to leave the lab — it
 *     bails on `e.defaultPrevented`, so the innermost dismissable surface wins
 *     and one Escape never both closes the sheet and exits to the museum.
 *   - FOCUS RETURN. The sheet is a disclosure, not a modal, so focus stays on
 *     the handle when it opens (correct `aria-expanded` pattern — no focus
 *     trap, and no fight with use-book-input.ts's arrow-key page turns). But a
 *     scrim tap / swipe / Escape can close it while focus sits on something
 *     inside the panel that is about to become `inert`; when that happens
 *     focus is handed back to the handle instead of being dropped to <body>.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/** Downward travel (px) that counts as a dismiss flick rather than a scroll. */
const DISMISS_DRAG_PX = 56
/** A drag slower than this is a scroll attempt / an idle finger, not a flick. */
const DISMISS_MAX_MS = 900

type DragStart = { y: number; t: number }

export type DrawerSheet = {
  expanded: boolean
  toggle: () => void
  close: () => void
  /** The scroll container (`.sb-overlay`) — also the swipe surface. */
  sheetRef: React.RefObject<HTMLDivElement | null>
  /** The handle button, so focus can be handed back to it. */
  toggleRef: React.RefObject<HTMLButtonElement | null>
  /** Spread onto `.sb-overlay`. */
  sheetProps: {
    onKeyDown: (event: React.KeyboardEvent) => void
    onPointerDown: (event: ReactPointerEvent) => void
    onPointerUp: (event: ReactPointerEvent) => void
    onPointerCancel: () => void
  }
}

export function useDrawerSheet(compact: boolean, displaySpread: number): DrawerSheet {
  const [expanded, setExpanded] = useState(false)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const dragStart = useRef<DragStart | null>(null)
  const wasExpanded = useRef(false)

  const close = useCallback(() => setExpanded(false), [])
  const toggle = useCallback(() => setExpanded((open) => !open), [])

  // A fresh spread always starts folded away — otherwise the previous page's
  // open sheet would keep covering the newly turned scene the instant it lands.
  useEffect(() => setExpanded(false), [displaySpread])

  // Leaving the compact layout (rotate to a wide landscape, resize a desktop
  // window back up) drops the drawer state: the desktop columns are always
  // shown, so a stale `expanded` would linger as a wrong `aria-expanded`.
  useEffect(() => {
    if (!compact) setExpanded(false)
  }, [compact])

  // Focus return. Only ever fires on a real open → close, never on mount
  // (hence `wasExpanded`) — otherwise it would snatch focus off the page the
  // moment the lab loads. Focus is handed back to the handle when the collapse
  // stranded it: either still inside the sheet (about to go `inert`) or dropped
  // to <body> because the node it was on has just been unmounted by a turn.
  useEffect(() => {
    if (expanded) {
      wasExpanded.current = true
      return
    }
    if (!wasExpanded.current) return
    wasExpanded.current = false

    const active = document.activeElement
    if (active === toggleRef.current) return
    const stranded = !active || active === document.body || Boolean(sheetRef.current?.contains(active))
    if (stranded) toggleRef.current?.focus()
  }, [expanded])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== 'Escape' || !expanded) return
      event.preventDefault() // <GalleryChrome> bails on defaultPrevented
      close()
    },
    [close, expanded]
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      const sheet = sheetRef.current
      // Armed only at the very top of the sheet's own scroll: mid-read, a
      // downward drag is the reader scrolling back up, not a dismiss.
      if (!expanded || !sheet || sheet.scrollTop > 2) {
        dragStart.current = null
        return
      }
      dragStart.current = { y: event.clientY, t: event.timeStamp }
    },
    [expanded]
  )

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const start = dragStart.current
      dragStart.current = null
      if (!start) return
      if (event.timeStamp - start.t > DISMISS_MAX_MS) return
      if (event.clientY - start.y < DISMISS_DRAG_PX) return
      close()
    },
    [close]
  )

  const onPointerCancel = useCallback(() => {
    dragStart.current = null
  }, [])

  return {
    expanded,
    toggle,
    close,
    sheetRef,
    toggleRef,
    sheetProps: { onKeyDown, onPointerDown, onPointerUp, onPointerCancel },
  }
}
