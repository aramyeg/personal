'use client'

/**
 * BootBeat — a skippable, PS1-flavored boot moment shown once per browser
 * session, the instant the Save Select screen first mounts. A full-viewport
 * ink overlay holds the four glyphs in the PS1 controller's own diamond
 * layout (triangle north, circle east, cross south, square west) shimmering
 * in place while the `memory card` wordmark sits below, then the overlay
 * removes itself and the screen appears underneath — a console warming up
 * before the game's own title screen.
 *
 * Session-gated via `sessionStorage['memory-card-booted']`, written only
 * once the beat actually finishes (timer OR skip) — never at mount. React
 * Strict Mode's dev double-invoke mounts this effect, tears it down, and
 * mounts it again in the same tick; writing the guard eagerly at mount would
 * let the torn-down first pass "spend" the flag before the surviving pass
 * ever ran, silently skipping the only beat a fresh session gets.
 *
 * `actions.boot()` is called plainly, every time this effect (re-)runs, with
 * NO ref guard — that was tried and is wrong: `useMemoryCardAudioActions()`
 * reads a NOOP-shaped `boot` on this component's very first render (the real
 * `PS1Audio` instance is built lazily, inside `useMemoryCardAudio`'s own
 * effect, one commit later — see `audio.ts`), so a "fire once" ref set on
 * that first call permanently latches on the NOOP and the real recording
 * never plays, session after session. `actions` only changes identity once
 * this transition settles (`[actions]` below then tears down and re-runs the
 * effect with the real handler); after that it's stable for the rest of the
 * session, so the *effective* fire count is still one meaningful call — the
 * NOOP call before it is a true no-op (touches no audio state) and costs
 * nothing to repeat.
 *
 * Reduced motion never sees this at all — every render is `null` in that
 * mode and no sessionStorage guard is written, so if a visitor starts a
 * session with the OS preference on and turns it off mid-session, the beat
 * they never spent is still there waiting. Hydration law: server and the
 * first client paint both render `null` unconditionally — the sessionStorage
 * and reduced-motion checks only ever run inside an effect — so the two
 * outputs are byte-identical before React has any chance to disagree with
 * itself, in both reduced modes.
 *
 * The boot recording (`bootMusic()` / `stopBoot()` in `audio.ts`) is a 17s
 * file; only its opening SCE swell is ever heard because `stopBoot()` pauses
 * the shared element the instant the beat ends, whether that's the timer
 * firing or a skip — no manual gain ramp, the recording's own decay in those
 * opening seconds already reads as a fade once it's cut.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { MC, GLYPH_PATHS, paperAlpha, type GlyphName } from './tokens'
import { anton } from './fonts'
import { useMemoryCardAudioActions } from './audio-context'

const SESSION_KEY = 'memory-card-booted'
const BEAT_DURATION_MS = 3000

/** PS1 controller face-button layout, clockwise from the top. */
const DIAMOND: { glyph: GlyphName; className: string }[] = [
  { glyph: 'triangle', className: 'left-1/2 top-0 -translate-x-1/2' },
  { glyph: 'circle', className: 'right-0 top-1/2 -translate-y-1/2' },
  { glyph: 'cross', className: 'bottom-0 left-1/2 -translate-x-1/2' },
  { glyph: 'square', className: 'left-0 top-1/2 -translate-y-1/2' },
]

function readSessionBooted(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    // Private-mode sessionStorage throws on read — treat as an unbooted
    // session; the beat just replays every load in that lane, which is fine.
    return false
  }
}

function writeSessionBooted(): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // Private-mode sessionStorage throws on write — the beat still ran once
    // for this page load, which is the best that lane can offer.
  }
}

export function BootBeat() {
  const actions = useMemoryCardAudioActions()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (readSessionBooted()) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    setVisible(true)
    actions.boot()

    const controller = new AbortController()
    const finish = () => {
      actions.stopBoot()
      writeSessionBooted()
      setVisible(false)
      clearTimeout(timer)
      controller.abort()
    }
    const timer = setTimeout(finish, BEAT_DURATION_MS)
    window.addEventListener('keydown', finish, { capture: true, signal: controller.signal })
    window.addEventListener('pointerdown', finish, { capture: true, signal: controller.signal })

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [actions])

  if (!visible) return null

  return (
    <div
      data-testid="boot-beat"
      role="presentation"
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-10"
      style={{ background: MC.ink }}
    >
      <div className="relative h-24 w-24 sm:h-28 sm:w-28">
        {DIAMOND.map(({ glyph, className }, i) => (
          <motion.svg
            key={glyph}
            viewBox="0 0 24 24"
            fill="none"
            className={`absolute h-7 w-7 ${className}`}
            style={{ filter: `drop-shadow(0 0 6px ${MC.glyphs[glyph]})` }}
            initial={{ opacity: 0.25, scale: 0.85 }}
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
          >
            <path
              d={GLYPH_PATHS[glyph]}
              stroke={MC.glyphs[glyph]}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </motion.svg>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{
          fontFamily: anton.style.fontFamily,
          fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: paperAlpha(0.92),
        }}
      >
        memory card
      </motion.p>
    </div>
  )
}

export default BootBeat
