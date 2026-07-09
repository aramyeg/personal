'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { compileCourse } from './course'
import {
  BAIL_LINE,
  createRider,
  stepRider,
  type CollectEvent,
  type RiderMode,
  type RiderState,
} from './rider'
import { createInput, type InputController } from './input'
import { useGameLoop } from './use-game-loop'
import { createRenderer, type Renderer } from './render/renderer'
import { addShake, createCamera, updateCamera, type CameraState } from './camera'
import { palette } from './palette'
import { CHAIN_STEP } from './tricks'
import { SkillsSummary, type SkillMarks } from './skills-summary'
import styles from './snowpark.module.css'

/** The course is pure geometry over static data — compiled once at module load. */
const course = compileCourse()

type Phase = 'playing' | 'paused' | 'finished' | 'sheet'

type Hud = {
  score: number
  chain: number
  stretchName: string
  lastEvent: CollectEvent | null
  bailed: boolean
  mode: RiderMode
}

const INITIAL_HUD: Hud = {
  score: 0,
  chain: 0,
  stretchName: '',
  lastEvent: null,
  bailed: false,
  mode: 'snow',
}

/** mm:ss for the recap clock. */
function formatTime(seconds: number): string {
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** `×2.5` / `×1.25` — trailing zeros trimmed, the loud HUD multiplier. */
function formatMultiplier(chain: number): string {
  return (1 + CHAIN_STEP * chain).toFixed(2).replace(/\.?0+$/, '')
}

/**
 * Task 12: the finish crescendo (rider.ts's FINISH_DECEL) only plays out if
 * `step` keeps running after mode flips to 'finish' — but useGameLoop's
 * `paused` (driven by `phase !== 'playing'`) freezes `step` the instant
 * `phase` becomes 'finished'. So the recap is deliberately delayed past the
 * mode transition, until the glide has mostly bled off speed, rather than
 * opening on the same frame the rider crosses the line.
 */
const FINISH_RECAP_SPEED = 40

/**
 * The lab entry point. Honours reduced-motion by never auto-running the loop:
 * it offers a static skill sheet first, and only mounts the game on request.
 * `reduced === null` until the media query is read, keeping SSR/CSR in step.
 */
export function SnowparkGame() {
  const [reduced, setReduced] = useState<boolean | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  if (reduced === null) return null
  if (reduced && !started)
    return (
      <SkillsSheet onStart={() => setStarted(true)} startLabel="start the run anyway" />
    )
  return <GameShell />
}

// --- the running game -------------------------------------------------------

function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const inputRef = useRef<InputController | null>(null)
  const riderRef = useRef<RiderState>(createRider(course))
  const cameraRef = useRef<CameraState | null>(null)
  const hudRef = useRef<Hud | null>(null)
  // useGameLoop's freeze() is consumed by `step`, which is defined (and
  // passed into useGameLoop) before that call returns it — routed through a
  // ref so `step` can call the latest freeze without a circular dependency.
  const freezeRef = useRef<(frames: number) => void>(() => {})

  const [phase, setPhase] = useState<Phase>('playing')
  const [hud, setHud] = useState<Hud>(INITIAL_HUD)

  // The collect card renders `event`; `eventShown` drives its fade after ~2s.
  const [event, setEvent] = useState<CollectEvent | null>(null)
  const [eventShown, setEventShown] = useState(false)

  // Combo/score pop: bumped whenever score rises, keyed onto the HUD block
  // below to restart its CSS animation (snowpark.module.css).
  const [scoreBump, setScoreBump] = useState(0)
  const prevScoreRef = useRef(hud.score)
  // Chain pop: bumped whenever chain rises. Chain can rise on a clean landing
  // with no attributed/uncollected obstacle (a plain pop, a crest detach, a
  // buffered relaunch), which doesn't move the score — so the multiplier
  // needs its own trigger, not just scoreBump, or it'd change value silently.
  const [chainBump, setChainBump] = useState(0)
  const prevChainRef = useRef(hud.chain)

  // Renderer + input live for the lifetime of the shell.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = createRenderer(canvas)
    rendererRef.current = renderer
    renderer.resize()
    const input = createInput()
    inputRef.current = input
    const detach = input.attach(canvas)
    const onResize = () => renderer.resize()
    window.addEventListener('resize', onResize)
    return () => {
      detach()
      window.removeEventListener('resize', onResize)
      rendererRef.current = null
      inputRef.current = null
    }
  }, [])

  // Keep the input controller's Esc handling in sync: it only swallows Esc
  // while playing, so a paused Esc bubbles up to GalleryChrome → /labs.
  useEffect(() => {
    inputRef.current?.setPlaying(phase === 'playing')
  }, [phase])

  // Dev-only probe for milestone-gate playtests (never ships behavior).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const w = window as Window & { __powder?: () => RiderState }
    w.__powder = () => riderRef.current
    return () => {
      delete w.__powder
    }
  }, [])

  // P toggles pause (spec: keyboard pause); ignored once finished.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyP') return
      e.preventDefault()
      setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Fade the collect card: re-arm on every fresh scored landing.
  useEffect(() => {
    if (!hud.lastEvent) return
    setEvent(hud.lastEvent)
    setEventShown(true)
    const hide = setTimeout(() => setEventShown(false), 2000)
    return () => clearTimeout(hide)
  }, [hud.lastEvent])

  // Combo pop: bump the key whenever score rises (never on restart's reset
  // to 0, since that's a decrease).
  useEffect(() => {
    if (hud.score > prevScoreRef.current) setScoreBump((n) => n + 1)
    prevScoreRef.current = hud.score
  }, [hud.score])

  // Chain pop: bump the key whenever chain rises (never on a scrub-hold or a
  // bail's reset to 0, since neither is an increase).
  useEffect(() => {
    if (hud.chain > prevChainRef.current) setChainBump((n) => n + 1)
    prevChainRef.current = hud.chain
  }, [hud.chain])

  const mirrorHud = useCallback((s: RiderState) => {
    const stretch = course.stretches.find((st) => s.x >= st.startX && s.x < st.endX)
    const snap: Hud = {
      score: s.score,
      chain: s.chain,
      stretchName: stretch ? stretch.name : '',
      lastEvent: s.lastEvent,
      bailed: s.bailed,
      mode: s.mode,
    }
    const prev = hudRef.current
    if (
      prev &&
      prev.score === snap.score &&
      prev.chain === snap.chain &&
      prev.stretchName === snap.stretchName &&
      prev.lastEvent === snap.lastEvent &&
      prev.bailed === snap.bailed &&
      prev.mode === snap.mode
    ) {
      return
    }
    hudRef.current = snap
    setHud(snap)
  }, [])

  const step = useCallback(
    (dt: number) => {
      const input = inputRef.current
      if (!input) return
      const frame = input.sample()
      if (input.consumeEscape() && phase === 'playing') setPhase('paused')
      const prev = riderRef.current
      const next = stepRider(prev, frame, dt, course)
      riderRef.current = next
      let cam = updateCamera(cameraRef.current ?? createCamera(next), next, dt)
      if (next.justLanded) cam = addShake(cam, next.impact * 12)
      if (next.mode === 'bail' && prev.mode !== 'bail') cam = addShake(cam, 14)
      cameraRef.current = cam
      if (next.bigMoment) freezeRef.current(4)
      if (next.mode === 'finish' && next.speed < FINISH_RECAP_SPEED && phase !== 'finished') {
        setPhase('finished')
      }
      mirrorHud(next)
    },
    [phase, mirrorHud]
  )

  const render = useCallback(() => {
    const cam = cameraRef.current ?? createCamera(riderRef.current)
    rendererRef.current?.draw(riderRef.current, course, cam)
  }, [])

  const { freeze } = useGameLoop({
    step,
    render,
    paused: phase !== 'playing',
    onHidden: () => setPhase((p) => (p === 'playing' ? 'paused' : p)),
  })
  useEffect(() => {
    freezeRef.current = freeze
  }, [freeze])

  const restart = useCallback(() => {
    riderRef.current = createRider(course)
    cameraRef.current = null
    hudRef.current = null
    setHud(INITIAL_HUD)
    setEvent(null)
    setEventShown(false)
    setPhase('playing')
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 block h-full w-full"
        style={{ background: palette.ice, touchAction: 'none' }}
      />

      {/* HUD — DOM overlay, nothing else on it */}
      <div className="pointer-events-none fixed inset-0 z-10 select-none">
        {/* top-left: current stretch */}
        {hud.stretchName && (
          <div
            className="absolute left-4 top-16 font-mono text-xs lowercase tracking-wide"
            style={{ color: palette.ink }}
          >
            {hud.stretchName}
          </div>
        )}

        {/* top-right: score, chain multiplier, pause glyph */}
        <div className="absolute right-4 top-16 flex flex-col items-end gap-2">
          <div
            key={`${scoreBump}-${chainBump}`}
            className={`flex flex-col items-end gap-1 ${styles.comboPop}`}
          >
            <div
              data-testid="hud-score"
              className="font-mono text-sm tabular-nums"
              style={{ color: palette.amber }}
            >
              {hud.score}
            </div>
            {hud.chain >= 1 && (
              <div className="font-mono text-3xl tabular-nums" style={{ color: palette.amber }}>
                ×{formatMultiplier(hud.chain)}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="pause"
            onClick={() => setPhase('paused')}
            className="pointer-events-auto flex items-center gap-1 p-1"
          >
            <span style={{ width: 5, height: 16, background: palette.ink }} />
            <span style={{ width: 5, height: 16, background: palette.ink }} />
          </button>
        </div>

        {/* bottom-center: collect card or bail line */}
        {hud.bailed ? (
          <div
            className="absolute bottom-24 left-1/2 -translate-x-1/2 font-mono text-sm lowercase"
            style={{ color: palette.ink }}
          >
            {BAIL_LINE}
          </div>
        ) : (
          event && (
            <div
              className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-md border px-4 py-2 font-mono text-sm"
              style={{
                borderColor: palette.ink,
                color: palette.ink,
                background: palette.ice,
                opacity: eventShown ? 1 : 0,
                transform: `translate(-50%, ${eventShown ? 0 : 8}px)`,
                transition: 'opacity 400ms ease, transform 400ms ease',
              }}
            >
              {event.line} <span style={{ color: palette.amber }}>+{event.points}</span>
            </div>
          )
        )}

        {/* bottom-right: quiet control hint */}
        <div
          className="absolute bottom-4 right-4 font-mono text-[11px] lowercase tracking-wide"
          style={{ color: palette.ink, opacity: 0.6 }}
        >
          space jump/flip · ←/→ spin · ↑/↓ grab · R retry · P pause
        </div>
      </div>

      {/* bottom-left: skip affordance — outside the pointer-events-none HUD
          wrapper (needs clicks) and above the pause overlay so it's reachable
          in both 'playing' and 'paused'. */}
      {(phase === 'playing' || phase === 'paused') && (
        <button
          type="button"
          onClick={() => setPhase('sheet')}
          className="fixed bottom-4 left-16 z-30 select-none font-mono text-[11px] lowercase tracking-wide"
          style={{ color: palette.ink, opacity: 0.6 }}
        >
          skip to the skills
        </button>
      )}

      {phase === 'paused' && (
        <PauseOverlay onResume={() => setPhase('playing')} onRestart={restart} />
      )}
      {phase === 'finished' && <Recap rider={riderRef.current} onReplay={restart} />}
      {phase === 'sheet' && <SkillsSheet onStart={restart} startLabel="start the run" />}
    </>
  )
}

// --- overlays ---------------------------------------------------------------

function PauseOverlay({ onResume, onRestart }: { onResume: () => void; onRestart: () => void }) {
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-6"
      style={{ background: 'rgba(18,38,48,0.55)' }}
    >
      <h2 className="font-mono text-3xl lowercase" style={{ color: palette.ice }}>
        paused
      </h2>
      <div className="flex gap-4">
        <PillButton onClick={onResume}>resume</PillButton>
        <PillButton onClick={onRestart}>restart run</PillButton>
      </div>
      <p className="font-mono text-xs lowercase" style={{ color: palette.bluePale }}>
        Esc again → gallery
      </p>
    </div>
  )
}

function Recap({ rider, onReplay }: { rider: RiderState; onReplay: () => void }) {
  const marks: SkillMarks = new Map()
  course.obstacles.forEach((o, i) => {
    marks.set(o.skill.name, rider.collected[i] ? 'collected' : 'missed')
  })

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto" style={{ background: palette.ice }}>
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="font-mono text-3xl lowercase" style={{ color: palette.ink }}>
          expedition log
        </h2>

        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-2 font-mono text-sm">
          <Stat label="run time" value={formatTime(rider.time)} />
          <Stat label="score" value={String(rider.score)} accent />
          {rider.bestTrick && (
            <Stat label="best trick" value={`${rider.bestTrick.name} — ${rider.bestTrick.points}`} />
          )}
        </dl>

        <div className="mt-10">
          <SkillsSummary marks={marks} />
        </div>

        <div className="mt-12 flex gap-4">
          <PillButton onClick={onReplay}>run it back</PillButton>
          <Link
            href="/labs"
            className="rounded-full border px-5 py-2 font-mono text-sm lowercase transition-colors"
            style={{ borderColor: palette.ink, color: palette.ink }}
          >
            ← gallery
          </Link>
        </div>
      </div>
    </div>
  )
}

/**
 * The skill list as a static sheet with a start button — no run, no marks.
 * Doubles as the reduced-motion landing (motion never auto-runs) and the
 * skip-link target mid-game; `onStart` decides what "starting" means for
 * each caller, `startLabel` keeps each context's own kept-from-v1/new copy.
 */
function SkillsSheet({
  onStart,
  startLabel,
}: {
  onStart: () => void
  startLabel: string
}) {
  return (
    <div className="fixed inset-0 z-20 overflow-y-auto" style={{ background: palette.ice }}>
      <div className="mx-auto max-w-3xl px-6 py-20">
        <SkillsSummary />

        <div className="mt-12 flex gap-4">
          <PillButton onClick={onStart}>{startLabel}</PillButton>
          <Link
            href="/labs"
            className="rounded-full border px-5 py-2 font-mono text-sm lowercase transition-colors"
            style={{ borderColor: palette.ink, color: palette.ink }}
          >
            ← gallery
          </Link>
        </div>
      </div>
    </div>
  )
}

// --- small building blocks --------------------------------------------------

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest" style={{ color: palette.blueMid }}>
        {label}
      </dt>
      <dd style={{ color: accent ? palette.amber : palette.ink }}>{value}</dd>
    </div>
  )
}

function PillButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-5 py-2 font-mono text-sm lowercase transition-opacity hover:opacity-85"
      style={{ background: palette.ink, color: palette.ice }}
    >
      {children}
    </button>
  )
}
