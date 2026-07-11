'use client'

/**
 * PanelShell — the paper dialog a save opens into over the character-select
 * void. Where the screen is light type on the ink void, the opened save inverts
 * to printed ink-on-paper: a paper field (MC.paper) carrying a printed keyline
 * (the same 1px inkAlpha sticker language the rail labels use), a close control,
 * and whatever save content is passed as children.
 *
 * It owns the modal contract so the content components don't have to: a hand-
 * rolled focus trap (Tab/Shift+Tab cycle inside, no library), focus moved to the
 * close button on mount and returned to the launching control on unmount, and
 * Escape — the overlay owns Esc while open, closing via `onClose` and stopping
 * the event so GalleryChrome's window-level Esc→/labs never fires underneath
 * (its handler bails on `defaultPrevented`). The close blip and the actual
 * navigation both live in the injected `onClose`, keeping this shell a pure,
 * audio-agnostic frame.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { MC, inkAlpha } from '../tokens'
import { monoFamily } from '../fonts'

/** Everything inside the panel that can hold focus, in DOM order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
}

export type PanelShellProps = {
  /** Dialog accessible name (the save's title). */
  title: string
  /** Close the overlay — fires the back() blip and navigates. */
  onClose: () => void
  children: ReactNode
}

export function PanelShell({ title, onClose, children }: PanelShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Latest onClose, read by the mount-once window listener below.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Focus the close button on mount; return focus to the launching control
  // (the rail item / LOAD button that was focused when navigation fired) on
  // unmount.
  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => {
      restoreTo?.focus?.()
    }
  }, [])

  // Own Escape at the window level for as long as the overlay is mounted. The
  // dialog's onKeyDown below only sees keys while focus is INSIDE it, but a
  // click on non-interactive panel content (a paragraph, a metric, the CRT)
  // blurs focus to <body> — Escape from there must still close the panel, never
  // fall through to GalleryChrome's window listener (which would leave the whole
  // lab). Capture phase + stopPropagation so that listener never runs;
  // preventDefault as a belt-and-suspenders for its `defaultPrevented` bail.
  useEffect(() => {
    const controller = new AbortController()
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
      },
      { capture: true, signal: controller.signal }
    )
    return () => controller.abort()
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Tab-trap only — Escape is owned by the window listener above so it works
    // regardless of where focus currently sits.
    if (e.key !== 'Tab') return

    const items = focusables(dialogRef.current)
    if (items.length === 0) {
      e.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    const inside = dialogRef.current?.contains(active as Node) ?? false
    if (e.shiftKey) {
      if (active === first || !inside) {
        e.preventDefault()
        last.focus()
      }
    } else if (active === last || !inside) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      className="relative flex h-full w-full flex-col overflow-hidden rounded-none lg:h-auto lg:max-h-[86vh] lg:rounded-2xl"
      style={{
        background: MC.paper,
        color: MC.ink,
        boxShadow: `0 24px 80px ${inkAlpha(0.55)}`,
      }}
    >
      {/* Printed keyline — the sticker language, inset a hair from the edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-lg"
        style={{ inset: 10, border: `1px solid ${inkAlpha(0.16)}` }}
      />

      {/* Close control — first focusable in DOM order so the trap seeds here. */}
      <div className="relative flex shrink-0 items-center justify-end px-4 pt-4 sm:px-6">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="close"
          data-cursor="triangle"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 uppercase transition-colors hover:text-[color:var(--mc-ring)] focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:2px]"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.625rem',
            letterSpacing: '0.18em',
            color: inkAlpha(0.55),
          }}
        >
          <span aria-hidden="true">esc</span>
          <span aria-hidden="true" style={{ fontSize: '0.875rem', lineHeight: 1 }}>
            ✕
          </span>
        </button>
      </div>

      {/* Body — the save content, scrolling independently of the frame. */}
      <div className="relative min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-1 sm:px-9 sm:pb-10">
        {children}
      </div>
    </div>
  )
}

export default PanelShell
