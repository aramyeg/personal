'use client'

/**
 * Fixed top-right inkwell button that toggles the lab's procedural paper
 * sounds (default off — see store.ts's `soundOn`). `<GalleryChrome>` owns
 * the top-left corner, so top-right is free. Also registers the one-time
 * pointerdown/keydown unlock listeners here (see sound.ts's file header for
 * why both are needed, not just pointerdown).
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
      className="fixed top-4 right-4 z-40 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--sb-gold)] bg-black/30 backdrop-blur-sm transition-colors hover:bg-[var(--sb-gold)]/15"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ opacity: soundOn ? 1 : 0.45, transition: 'opacity 150ms ease' }}
      >
        {/* Inkwell body */}
        <path
          d="M4 13.5c0-.55.45-1 1-1h9c.55 0 1 .45 1 1l-1.3 6.4c-.15.75-.8 1.3-1.6 1.3H6.9c-.8 0-1.45-.55-1.6-1.3L4 13.5z"
          fill="var(--sb-ink)"
        />
        {/* Brass collar */}
        <ellipse
          cx="9.5"
          cy="13.4"
          rx="5.5"
          ry="1.5"
          fill="var(--sb-gold)"
          stroke="var(--sb-gold-deep)"
          strokeWidth="0.4"
        />
        {/* Ink surface */}
        <ellipse cx="9.5" cy="13.4" rx="4.3" ry="1" fill="var(--sb-ink)" />
        {/* Quill shaft, tip dipping into the ink */}
        <path
          d="M20.5 2.5c-5 2-8.5 5.4-10.6 9.8"
          stroke="var(--sb-ink)"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        {/* Feather */}
        <path
          d="M20.5 2.5c-4.2 1-7.3 3-9.4 6 1.7-.5 3.4-.7 5.1-.5-1.1 1.5-1.9 3.1-2.2 4.9 2.1-1.1 3.7-2.7 4.5-4.8.8-1.9 1.4-3.7 2-5.6z"
          fill="var(--sb-gold-bright)"
          stroke="var(--sb-gold-deep)"
          strokeWidth="0.5"
        />
      </svg>
    </button>
  )
}
