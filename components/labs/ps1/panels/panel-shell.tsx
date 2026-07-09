'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * DOM chrome palette for the era panels. These are plain overlays — outside the
 * shader's runtime palette system — so the hexes are hardcoded here, kept in the
 * same PSX teal/accent family as scene/psx-constants.ts (PSX.TEX). One source so
 * every panel reads as one system.
 */
export const PSX_UI = {
  bg: '#0b1413',
  bgRaised: '#0f1c1a',
  border: '#2e6b66', // crtTealDark
  borderSoft: '#3a5b57',
  ink: '#e8f6f4',
  inkDim: '#8fb0ac',
  teal: '#7de8e0', // crtTeal
  orange: '#d96b2f',
  yellow: '#d9b23a',
  red: '#b8402e',
  blue: '#3e6fb8',
} as const

// Beveled "tape-edge" corners — a hard-cut octagon, not a rounded pill. The
// inset box-shadow border is clipped along with it, so the 2px edge follows the
// bevel cleanly (a plain CSS border would poke past the clip).
const TAPE_CLIP =
  'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'

// Everything inside a panel that can hold focus, in DOM order.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
}

/**
 * The era chrome: a boxy BIOS/GT dialog carrying THPS-grunge accents (a rotated
 * sticker chip, tape-edge corners). Owns the focus trap and focus return; it
 * does NOT touch Escape — the experience's capture-phase window listener owns
 * the Esc chain, and a second handler here would break it.
 */
export function PanelShell({
  title,
  onClose,
  sound,
  sticker = 'ay-01',
  children,
}: {
  title: string
  onClose: () => void
  /** Optional close blip hook — Task 11 (audio) hangs here. */
  sound?: () => void
  /** Rotated grunge sticker chip, top-right. */
  sticker?: string
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Focus the close button on mount; return focus to wherever it was on unmount.
  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => {
      restoreTo?.focus?.()
    }
  }, [])

  // Hand-rolled trap: Tab/Shift+Tab cycle inside the panel, no library. Escape
  // is deliberately untouched.
  const onKeyDown = (e: React.KeyboardEvent) => {
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

  const handleClose = () => {
    sound?.()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(10,12,11,0.72)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
        className="relative flex max-h-[86dvh] w-full max-w-[720px] flex-col"
        style={{
          background: PSX_UI.bg,
          boxShadow: `inset 0 0 0 2px ${PSX_UI.border}`,
          clipPath: TAPE_CLIP,
        }}
      >
        {/* Title bar — dithered grey gradient + a metallic vertical sweep. */}
        <div
          className="flex items-center justify-between gap-3 border-b-2 px-4 py-2.5"
          style={{
            borderColor: PSX_UI.border,
            backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.07), rgba(0,0,0,0.32)), repeating-linear-gradient(0deg, #2a302e 0 2px, #363d3a 2px 4px)`,
          }}
        >
          <span
            className="truncate text-[13px] font-black uppercase tracking-[0.18em]"
            style={{
              color: PSX_UI.ink,
              fontFamily: "'Arial Black','Helvetica Neue',Arial,sans-serif",
            }}
          >
            {title}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={handleClose}
            className="flex min-h-[36px] shrink-0 items-center rounded-none border-2 px-3 font-mono text-[11px] lowercase tracking-[0.12em] outline-none transition-colors focus-visible:ring-2"
            style={{
              borderColor: PSX_UI.borderSoft,
              color: PSX_UI.teal,
              background: 'rgba(0,0,0,0.35)',
            }}
          >
            close (esc)
          </button>
        </div>

        {/* Rotated sticker chip — THPS grunge personality, slapped over the edge. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-[46px] z-10 select-none px-2 py-0.5 font-mono text-[10px] lowercase tracking-[0.2em]"
          style={{
            color: '#1a120c',
            background: PSX_UI.orange,
            transform: 'rotate(-4deg)',
            boxShadow: '2px 2px 0 rgba(0,0,0,0.45)',
          }}
        >
          {sticker}
        </span>

        {/* Body — the panel's real content, scrolls independently of the chrome. */}
        <div
          className="relative flex-1 overflow-y-auto px-4 py-5 sm:px-6"
          style={{ color: PSX_UI.ink }}
        >
          {children}
        </div>

        {/* Faint CRT scanline wash tying the panel to the room. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 1px, transparent 1px 3px)',
          }}
        />
      </div>
    </div>
  )
}
