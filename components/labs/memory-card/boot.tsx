'use client'

/**
 * BootBeat — the lab's brand moment: a skippable, PS1-flavored boot sequence
 * shown once per browser session, the instant the Save Select screen first
 * mounts. A full-viewport ink surface (page grain + a centred haze pool) holds
 * the four PS controller glyphs at real scale in their own diamond layout
 * (triangle north, circle east, cross south, square west), each in its accent
 * colour. They stage in on the entrance ease, hold with a slow breath, and the
 * whole surface fades out to reveal the select screen underneath — a console
 * warming up before the game's own title screen. The 'AY-01 · memory card'
 * wordmark sits below the diamond.
 *
 * ── Lifecycle is decoupled from audio (the load-bearing fix) ──────────────
 * The beat's visibility + its fixed BEAT_DURATION_MS window live in ONE
 * mount-anchored effect (deps `[]`). It is never re-run by anything downstream,
 * so the countdown is a single deterministic window from first paint. This is
 * deliberate: an earlier version keyed this effect on `[actions]`, which tore
 * down and rebuilt the timer every time the audio instance settled from its
 * NOOP stand-in to the real one (a commit or two after mount — see `audio.ts`).
 * That RESTARTED the 3s timer mid-beat, so the beat's true length drifted with
 * audio-init timing instead of being a stable 3s, and any parent re-render that
 * changed `actions` identity could re-arm it. Splitting the audio trigger into
 * its own effect (below) keeps the window fixed and immune to that churn.
 *
 * ── Audio arming is unchanged (gesture law) ──────────────────────────────
 * A SECOND effect, keyed on `[actions]`, is the only thing that touches audio.
 * It calls `actions.boot()` whenever the beat is active AND the actions object
 * changes — with NO "fire once" ref. That ref was tried and is wrong:
 * `useMemoryCardAudioActions()` returns a NOOP-shaped `boot` on this component's
 * very first render (the real `PS1Audio` is built lazily inside
 * `useMemoryCardAudio`'s own effect, one commit later — see `audio.ts`), so a
 * ref latched on that first NOOP call would permanently swallow the real
 * recording, session after session. Instead we re-fire on identity change: the
 * NOOP call is a true no-op (touches no audio state), and once `actions`
 * settles to the real instance the same effect re-runs and the recording plays.
 * The beat NEVER creates audio itself; `bootMusic` gates internally on the
 * browser's sticky user-activation flag. End-of-beat audio reaches the CURRENT
 * actions through a ref, so the mount-anchored lifecycle effect (which closes
 * over the initial NOOP actions) never fades/stops a stale handle.
 *
 * ── Session + reduced-motion + hydration laws ────────────────────────────
 * Session-gated via `sessionStorage['memory-card-booted']`, written only once
 * the beat actually finishes (timer OR skip) — never at mount. React Strict
 * Mode's dev double-invoke mounts the lifecycle effect, tears it down, and
 * mounts it again in the same tick; writing the guard eagerly at mount would let
 * the torn-down first pass "spend" the flag before the surviving pass ran,
 * silently skipping the only beat a fresh session gets. Reduced motion renders
 * `null` every time and writes no guard, so a visitor who turns the OS
 * preference off mid-session still has their unspent beat waiting. Hydration
 * law: server and the first client paint both render `null` unconditionally (the
 * sessionStorage + reduced-motion checks only ever run inside an effect), so the
 * two outputs are byte-identical before React can disagree with itself.
 *
 * ── End paths + Escape ownership ─────────────────────────────────────────
 * The two ways the beat ends have deliberately different audio behavior: the
 * timer firing naturally calls `fadeOutBoot()` (a short ramp then pause) so the
 * recording doesn't cut off mid-swell and the surface fades out gracefully; a
 * skip (keydown/pointerdown) calls `stopBoot()` — an instant cut of both visual
 * and audio, matching "any skip cuts everything instantly." Escape is
 * special-cased on the skip path: the overlay owns Escape while showing
 * (`preventDefault` + `stopPropagation`, capture phase — the same "dialog owns
 * Esc while open" contract `PanelShell` uses), so `GalleryChrome`'s bubble-phase
 * Escape-to-`/labs` listener never sees it. Without this, the single most
 * natural "skip this" key would eject the visitor out of the lab AND spend the
 * session's one beat on the way out.
 *
 * ── Turntable handoff ────────────────────────────────────────────────────
 * While the beat is up the hero turntable must not spin behind it. BootBeat
 * reports its active state via `onActiveChange`; the screen folds that into the
 * SAME `heroPaused` signal it already computes for an open dialog / save route
 * (E5), which flows to the figure stage as its `paused` prop — no parallel
 * pause channel.
 */

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { MC, GLYPH_PATHS, GRAIN, MOTION, paperAlpha, withAlpha, type GlyphName } from './tokens'
import { anton, monoFamily } from './fonts'
import { useMemoryCardAudioActions } from './audio-context'

const SESSION_KEY = 'memory-card-booted'
const BEAT_DURATION_MS = 3000
/** How long before the hard end the surface begins fading out to reveal the
 *  select screen. Kept shorter than the fade duration below so it reaches ~0
 *  right as the overlay unmounts (no flash on the cut). Timer-end only — a skip
 *  removes the overlay instantly, no fade. */
const EXIT_MS = 460

/** PS controller face-button layout, clockwise from the top; each glyph reveals
 *  on this order so the diamond fills in a clean sweep. */
const DIAMOND: { glyph: GlyphName; position: string }[] = [
  { glyph: 'triangle', position: 'left-1/2 top-0 -translate-x-1/2' },
  { glyph: 'circle', position: 'right-0 top-1/2 -translate-y-1/2' },
  { glyph: 'cross', position: 'bottom-0 left-1/2 -translate-x-1/2' },
  { glyph: 'square', position: 'left-0 top-1/2 -translate-y-1/2' },
]

/** The three closed glyphs carry a faint accent fill for body at scale; the
 *  cross is two open strokes, so it stays stroke-only. */
const GLYPH_FILLED: Record<GlyphName, boolean> = {
  triangle: true,
  circle: true,
  cross: false,
  square: true,
}

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

export type BootBeatProps = {
  /** Fires `true` when the beat becomes visible and `false` when it ends, so the
   *  screen can pause the hero turntable for the beat's duration via its existing
   *  `heroPaused` signal (never a second pause channel). */
  onActiveChange?: (active: boolean) => void
}

export function BootBeat({ onActiveChange }: BootBeatProps) {
  const actions = useMemoryCardAudioActions()
  // Latest actions, reachable from the mount-anchored lifecycle effect (which
  // closes over the initial NOOP) so end-of-beat audio hits the real instance.
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const onActiveChangeRef = useRef(onActiveChange)
  onActiveChangeRef.current = onActiveChange

  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  // True only while a fresh, non-reduced beat is on screen — gates the audio
  // effect so it never plays for a booted/reduced session or after the end.
  const activeRef = useRef(false)

  // Lifecycle — visibility + the fixed BEAT_DURATION_MS window + skip handling +
  // the session guard. Mount-anchored (deps `[]`): this is the whole point of
  // the fix — the countdown is one deterministic window, never re-armed by an
  // audio settle or a parent re-render.
  useEffect(() => {
    if (readSessionBooted()) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    setVisible(true)
    activeRef.current = true

    const controller = new AbortController()
    let exitTimer = 0
    // Shared teardown for both end paths — only the audio call differs. Audio
    // goes through actionsRef so the real (settled) instance is faded/stopped,
    // not the NOOP this effect closed over at mount.
    const endBeat = (endAudio: () => void) => {
      endAudio()
      writeSessionBooted()
      activeRef.current = false
      window.clearTimeout(exitTimer)
      window.clearTimeout(endTimer)
      controller.abort()
      setVisible(false)
    }
    // Natural end: nobody skipped — fade the recording out and let the surface
    // fade (the exit timer already began the visual fade EXIT_MS earlier).
    const onTimerEnd = () => endBeat(() => actionsRef.current.fadeOutBoot())
    // Skip: any keydown or pointerdown — instant cut, both visual and audio.
    const onSkip = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
      }
      endBeat(() => actionsRef.current.stopBoot())
    }
    exitTimer = window.setTimeout(() => setExiting(true), BEAT_DURATION_MS - EXIT_MS)
    const endTimer = window.setTimeout(onTimerEnd, BEAT_DURATION_MS)
    window.addEventListener('keydown', onSkip, { capture: true, signal: controller.signal })
    window.addEventListener('pointerdown', onSkip, { capture: true, signal: controller.signal })

    return () => {
      activeRef.current = false
      window.clearTimeout(exitTimer)
      window.clearTimeout(endTimer)
      controller.abort()
    }
    // Mount-anchored on purpose (empty deps): the countdown is one fixed window.
    // Audio identity is read through actionsRef, never as a dependency, so an
    // audio settle can't re-arm this timer.
  }, [])

  // Audio — the ONLY effect that touches sound. Fires `boot()` on each actions
  // identity change while the beat is active, so the NOOP-then-real transition
  // lands the real recording without a "fire once" ref latching on the NOOP.
  useEffect(() => {
    if (!activeRef.current) return
    actions.boot()
  }, [actions])

  // Turntable handoff — pause while visible, resume the instant it ends.
  useEffect(() => {
    onActiveChangeRef.current?.(visible)
  }, [visible])

  if (!visible) return null

  return (
    <motion.div
      data-testid="boot-beat"
      role="presentation"
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        background: `radial-gradient(72% 60% at 50% 44%, ${withAlpha(MC.haze, 0.85)} 0%, transparent 68%), ${MC.abyss}`,
      }}
      initial={false}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: MOTION.easeMoveArr }}
    >
      {/* Page grain over the ink surface — reuses the screen's own filter def so
          the boot surface carries the same texture (kills the flat-black tell). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ filter: 'url(#mc-grain)', opacity: GRAIN.opacity, mixBlendMode: GRAIN.blendMode }}
      />

      {/* Glyph diamond — the centrepiece, at real scale. */}
      <motion.div
        className="relative"
        style={{ width: 'clamp(200px, 40vmin, 360px)', height: 'clamp(200px, 40vmin, 360px)' }}
        // A slow shared breath after the reveal settles — confident, not a flicker.
        animate={{ scale: [1, 1.025, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
      >
        {DIAMOND.map(({ glyph, position }, i) => (
          <div
            key={glyph}
            className={`absolute ${position} grid place-items-center`}
            style={{ width: 'clamp(52px, 13vmin, 104px)', height: 'clamp(52px, 13vmin, 104px)' }}
          >
            <motion.svg
              viewBox="0 0 24 24"
              className="h-full w-full"
              style={{ filter: `drop-shadow(0 0 16px ${withAlpha(MC.glyphs[glyph], 0.55)})` }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.62, delay: i * 0.11, ease: MOTION.easeEntranceArr }}
            >
              <path
                d={GLYPH_PATHS[glyph]}
                stroke={MC.glyphs[glyph]}
                strokeWidth={1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill={GLYPH_FILLED[glyph] ? withAlpha(MC.glyphs[glyph], 0.1) : 'none'}
              />
            </motion.svg>
          </div>
        ))}
      </motion.div>

      {/* Wordmark lockup — mono tag over the Anton brand. */}
      <div className="mt-[clamp(2rem,5vh,3.5rem)] flex flex-col items-center gap-2">
        <motion.span
          className="tabular-nums uppercase"
          style={{
            fontFamily: monoFamily,
            fontSize: 'clamp(0.625rem, 1.6vw, 0.8rem)',
            letterSpacing: '0.42em',
            color: paperAlpha(0.5),
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.5, ease: MOTION.easeEntranceArr }}
        >
          AY-01
        </motion.span>
        <motion.span
          className="uppercase"
          style={{
            fontFamily: anton.style.fontFamily,
            fontSize: 'clamp(1.75rem, 5.5vw, 3rem)',
            lineHeight: 0.9,
            letterSpacing: '0.02em',
            color: paperAlpha(0.94),
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, delay: 0.62, ease: MOTION.easeEntranceArr }}
        >
          memory card
        </motion.span>

        {/* A thin loading hairline that fills over the beat — a quiet "booting" cue. */}
        <div
          className="mt-[clamp(1rem,3vh,1.75rem)] overflow-hidden"
          style={{ width: 'clamp(120px, 22vw, 220px)', height: 1, background: paperAlpha(0.14) }}
        >
          <motion.div
            className="h-full"
            style={{ background: paperAlpha(0.6) }}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.4, delay: 0.4, ease: MOTION.easeMoveArr }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export default BootBeat
