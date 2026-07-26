'use client'

/**
 * Fixed top-right chrome button that toggles the lab's procedural paper
 * sounds (default off — see store.ts's `soundOn`). `<GalleryChrome>` owns
 * the top-left corner, so top-right is free. Also registers the one-time
 * pointerdown/keydown unlock listeners here (see sound.ts's file header for
 * why both are needed, not just pointerdown).
 *
 * GLYPH (blind sweep 2026-07-26): this used to be a gold quill dipping into
 * an inkwell — a "write" glyph, and worse, the IDENTICAL mark the page's
 * custom cursor already uses for its own identity (storybook-responsive.css'
 * quill cursor). Every reader who clicked it reported "changed exactly
 * nothing... I still have no idea what it is for" — the aria-label flipped
 * correctly, so the DOM was right and only the pixels were mute. A bell is
 * the one glyph family a reading-lamp illuminated-manuscript prop can wear
 * without borrowing the cursor's identity or reaching for a modern speaker-
 * icon look: it rings (unmuted) or sits crossed out (muted), on ANY culture's
 * reading. The two states differ in three independent, unmissable ways —
 * the ring color (bright gold vs a sealed-wax red, `--sb-seal`), the bell's
 * own fill (bright gold vs a dimmed ink-brown), and glyph SHAPE itself (two
 * chime marks vs a diagonal strike) — so no single color-blind-unfriendly
 * channel carries the whole state.
 */

import { useEffect } from 'react'
import { sbSound } from '../sound'
import { useStorybookStore } from '../store'

export function SoundToggle() {
  const soundOn = useStorybookStore((s) => s.soundOn)
  const toggleSound = useStorybookStore((s) => s.toggleSound)

  useEffect(() => {
    const unlock = () => sbSound.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-pressed={soundOn}
      aria-label={soundOn ? 'Mute paper sounds' : 'Unmute paper sounds'}
      data-sb-hover
      data-sb-sound-state={soundOn ? 'on' : 'off'}
      className={
        'fixed top-4 right-4 z-40 grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-black/30 backdrop-blur-sm transition-colors ' +
        (soundOn
          ? 'border-[var(--sb-gold-bright)] shadow-[0_0_10px_-2px_var(--sb-gold-bright)] hover:bg-[var(--sb-gold)]/15'
          : 'border-[var(--sb-seal)] hover:bg-[var(--sb-seal)]/15')
      }
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {/* Bell body: dome + flared mouth, gold when ringing, dimmed to a
            flat ink-brown when muted — a second, color-only state cue on
            top of the shape/ring changes below. */}
        <path
          d="M12 5.2c-.6 0-1.05.48-1.05 1.05v.5C8.6 7.35 7 9.35 7 11.7v3l-1.3 2.1c-.3.5.06 1.1.63 1.1h11.34c.57 0 .93-.6.63-1.1L17 14.7v-3c0-2.35-1.6-4.35-3.95-4.95v-.5c0-.57-.45-1.05-1.05-1.05z"
          fill={soundOn ? 'var(--sb-gold-bright)' : 'var(--sb-ink)'}
          stroke="var(--sb-gold-deep)"
          strokeWidth="0.5"
          style={{ transition: 'fill 150ms ease' }}
        />
        {/* Clapper */}
        <circle
          cx="12"
          cy="19"
          r="1.15"
          fill={soundOn ? 'var(--sb-gold-bright)' : 'var(--sb-ink)'}
          stroke="var(--sb-gold-deep)"
          strokeWidth="0.4"
          style={{ transition: 'fill 150ms ease' }}
        />
        {soundOn ? (
          /* Ringing: two chime marks fanning off the mouth — present ONLY
             while sound is on, so the glyph's SILHOUETTE (not just its
             color) reads differently at a glance. */
          <g
            data-sb-sound-glyph="ring"
            stroke="var(--sb-gold-bright)"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M18.3 8.4c1.1 1 1.7 2.3 1.7 3.6" />
            <path d="M20.4 6.6c1.7 1.5 2.6 3.5 2.6 5.6" />
          </g>
        ) : (
          /* Muted: a single strike through the bell — present ONLY while
             muted. A paler outer stroke keeps it legible crossing the
             bright gold ring behind it. */
          <g data-sb-sound-glyph="mute" strokeLinecap="round">
            <path d="M4.5 4.5l15 15" stroke="var(--sb-desk)" strokeWidth="3" />
            <path d="M4.5 4.5l15 15" stroke="var(--sb-seal)" strokeWidth="1.6" />
          </g>
        )}
      </svg>
    </button>
  )
}
