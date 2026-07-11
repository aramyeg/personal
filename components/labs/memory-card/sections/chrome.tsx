'use client'

/**
 * MemoryCardChrome — the fixed frame around the Save Select screen: a quiet ink
 * bar across the top and a hairline credits strip across the bottom.
 *
 * The top bar carries a keyboard skip link, the wordmark, and a live sound
 * toggle. The Save Select rework retired the old section-scroll anchors (there
 * are no sections to jump to any more), so the skip link now lands on the save
 * strips themselves. The bottom strip keeps the two CC-BY asset attributions
 * always on screen (license law), alongside the copyright line and a way back
 * to the gallery.
 *
 * `soundOn`/`onToggleSound` stay explicit prop overrides for isolated tests;
 * when omitted they fall back to the shared `MemoryCardAudioProvider` context so
 * chrome and the screen stay in sync without prop-drilling.
 */

import Link from 'next/link'
import { MC, paperAlpha } from '../tokens'
import { monoFamily } from '../fonts'
import { useMemoryCardAudioContext } from '../audio-context'

const RING = MC.glyphs.triangle

/** Attributions for the lab's 3D assets — both lines are required to render
 *  (license law); lowercase per lab copy law. The CRT ships under CC BY 4.0;
 *  the figure is dressed on a quaternius CC0 character base (courtesy credit). */
const ATTRIBUTIONS = [
  'crt model by meipal (cc by 4.0)',
  'character base by quaternius (cc0)',
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
  soundOn: soundOnProp,
  onToggleSound: onToggleSoundProp,
}: MemoryCardChromeProps) {
  const audio = useMemoryCardAudioContext()
  const soundOn = soundOnProp ?? audio.soundOn
  const onToggleSound = onToggleSoundProp ?? audio.toggleSound
  const year = new Date().getFullYear()

  return (
    <>
      <header
        style={{
          ['--mc-ring' as string]: RING,
          ['--mc-ink' as string]: MC.ink,
          background: MC.ink,
          borderBottom: `1px solid ${paperAlpha(0.14)}`,
        }}
        className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between pl-4 pr-4 sm:pl-[7.5rem] sm:pr-6"
      >
        <a
          href="#save-strips"
          style={monoLabel}
          className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-14 focus:z-50 focus:inline-flex focus:items-center focus:bg-[color:var(--mc-ring)] focus:px-3 focus:py-2 focus:text-[color:var(--mc-ink)] ${FOCUS_RING}`}
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

        <button
          type="button"
          aria-pressed={soundOn}
          aria-label={`sound: ${soundOn ? 'on' : 'off'}`}
          data-cursor="triangle"
          onClick={onToggleSound}
          style={{ ...monoLabel, color: paperAlpha(0.7) }}
          className={`ml-auto inline-flex min-h-[44px] items-center whitespace-nowrap px-2 transition-colors hover:text-[color:var(--mc-ring)] ${FOCUS_RING}`}
        >
          sound: {soundOn ? 'on' : 'off'}
        </button>
      </header>

      <footer
        aria-label="Credits"
        style={{
          ['--mc-ring' as string]: RING,
          background: MC.ink,
          borderTop: `1px solid ${paperAlpha(0.16)}`,
          fontFamily: monoFamily,
          fontSize: '0.625rem',
          letterSpacing: '0.06em',
          color: paperAlpha(0.42),
        }}
        className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 px-4 py-2 lowercase sm:px-6"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {ATTRIBUTIONS.map((line, i) => (
            <span key={line} className="whitespace-nowrap">
              {i > 0 && (
                <span aria-hidden="true" className="mr-2" style={{ color: paperAlpha(0.22) }}>
                  ·
                </span>
              )}
              {line}
            </span>
          ))}
        </span>

        <span className="flex items-center gap-x-4">
          <span className="whitespace-nowrap">© {year} aram yeghiazaryan</span>
          <Link
            href="/"
            data-cursor="triangle"
            className={`whitespace-nowrap transition-colors hover:text-[color:var(--mc-ring)] ${FOCUS_RING}`}
          >
            gallery
          </Link>
        </span>
      </footer>
    </>
  )
}

export default MemoryCardChrome
