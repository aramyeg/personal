'use client'

/**
 * MemoryCardChrome — the fixed top bar for the Memory Card lab.
 *
 * A quiet, solid ink strip: wordmark on the left, section anchors and a
 * (still-inert) sound toggle on the right, and a keyboard skip link ahead of
 * everything. It sits alongside GalleryChrome's floating "← Gallery" pill, so
 * the left group is inset far enough to clear it. Section anchors and the
 * toggle carry 44px hit areas and an accent focus ring; the sound button is
 * rendered disabled here and wired for real in a later task via `onToggleSound`.
 */

import { MC, SECTION_ACCENT, paperAlpha } from '../tokens'
import { monoFamily } from '../fonts'

const NAV_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'work', href: '#work' },
  { label: 'skills', href: '#skills' },
  { label: 'about', href: '#about' },
  { label: 'contact', href: '#contact' },
]

const monoLabel: React.CSSProperties = {
  fontFamily: monoFamily,
  fontSize: '0.75rem',
  letterSpacing: '0.18em',
  textTransform: 'lowercase',
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:3px] rounded-sm'

export type MemoryCardChromeProps = {
  soundOn?: boolean
  onToggleSound?: () => void
}

export function MemoryCardChrome({
  soundOn = false,
  onToggleSound,
}: MemoryCardChromeProps) {
  return (
    <header
      style={{
        ['--mc-ring' as string]: MC.glyphs[SECTION_ACCENT.hero],
        background: MC.ink,
        borderBottom: `1px solid ${paperAlpha(0.14)}`,
      }}
      className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-end pl-4 pr-4 sm:justify-between sm:pl-[7.5rem] sm:pr-6"
    >
      <a
        href="#work"
        style={monoLabel}
        className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-14 focus:z-50 focus:inline-flex focus:items-center focus:bg-[color:var(--mc-ring)] focus:px-3 focus:py-2 focus:text-[#101014] ${FOCUS_RING}`}
      >
        skip to the content
      </a>

      <span
        style={{ ...monoLabel, color: MC.paper }}
        className="hidden select-none items-baseline gap-1 sm:flex"
      >
        AY-01
        <span style={{ color: paperAlpha(0.55) }}>· memory card</span>
      </span>

      <nav
        aria-label="Sections"
        className="flex items-center gap-1 sm:gap-2"
      >
        {NAV_LINKS.map(({ label, href }) => (
          <a
            key={href}
            href={href}
            style={{ ...monoLabel, color: paperAlpha(0.7) }}
            className={`hidden min-h-[44px] items-center px-2 transition-colors hover:text-[#e9e7e0] sm:inline-flex ${FOCUS_RING}`}
          >
            {label}
          </a>
        ))}

        <button
          type="button"
          aria-disabled="true"
          aria-label={`sound: ${soundOn ? 'on' : 'off'}`}
          onClick={onToggleSound}
          style={{ ...monoLabel, color: paperAlpha(0.4) }}
          className={`ml-1 inline-flex min-h-[44px] cursor-not-allowed items-center whitespace-nowrap px-2 ${FOCUS_RING}`}
        >
          sound: {soundOn ? 'on' : 'off'}
        </button>
      </nav>
    </header>
  )
}

export default MemoryCardChrome
