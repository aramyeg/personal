'use client'

/**
 * WorkSection — act 2, the pinned memory-card rail.
 *
 * The page's single pinned moment. A wrapper `projects.length × 90vh` tall holds
 * a sticky 100svh stage; scrolling through the wrapper drives a horizontal rail
 * of real 3D memory cards across the stage (spring-smoothed), one save-slot per
 * project. The card nearest center tilts to the cursor and flips on click to
 * show its metrics. A mono readout tracks the active slot.
 *
 * Below the pinned scene, in normal flow, sits the crawlable list — every
 * project as an article with its slot, title, company · year, and all metrics.
 * That list is the truth: it's what a crawler, a reduced-motion visitor, or a
 * no-WebGL browser reads, and it's identical in both motion modes. Under reduced
 * motion the wrapper collapses to a single static stage (first card centered at
 * a still three-quarter pose; no scroll math, tilt, or flip).
 *
 * Sound: hovering the stage plays `blip()` (menu-move); flipping a card
 * forward plays `select()`, flipping it back plays `back()` — both through
 * the shared `MemoryCardAudioProvider` context, with the flip direction also
 * surfaced on `onCardFlip` for callers/tests that need the raw seam.
 */

import { useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { projects } from '@/data/projects'
import { MC, TYPE, GLYPH_PATHS, SECTION_ACCENT, accentFor, paperAlpha } from '../tokens'
import { grotesk, monoFamily } from '../fonts'
import { VignetteCanvas } from '../three/stage'
import { CardRail, RAIL_GAP } from '../three/card-rail'
import { useMemoryCardAudioContext } from '../audio-context'

const WORK_ACCENT = MC.glyphs[SECTION_ACCENT.work]
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
const TILT = 0.12

const N = projects.length
const CAMERA = { position: [0, 0.95, 6] as [number, number, number], fov: 40 }
const TARGET: [number, number, number] = [0, 0.95, 0]

const pad = (i: number) => String(i + 1).padStart(2, '0')

export type WorkSectionProps = {
  /** Override the media query (client islands otherwise read it themselves). */
  reduced?: boolean
  /** Fired when the centered card flips, with the direction it flipped in. */
  onCardFlip?: (direction: 'reveal' | 'return') => void
}

export function WorkSection({ reduced: reducedProp, onCardFlip }: WorkSectionProps) {
  const systemReduced = useReducedMotion()
  const audio = useMemoryCardAudioContext()

  // This section branches its SSR-visible markup (wrapper height, cursor, hint)
  // on `reduced`, so the media-query value can't be read until after mount or
  // the first client render diverges from the server's. Until then the layout
  // is the deterministic motion-on one — SSR and both client modes agree.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const reduced = reducedProp ?? (mounted ? (systemReduced ?? false) : false)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end end'],
  })
  const railTarget = useTransform(scrollYProgress, [0, 1], [0, -(N - 1) * RAIL_GAP])
  const railX = useSpring(railTarget, { stiffness: 90, damping: 24 })

  const [activeIdx, setActiveIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const prevIdx = useRef(0)
  const tiltRef = useRef({ x: 0, y: 0 })

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    // Reduced motion collapses the wrapper to one viewport, making this progress
    // range degenerate — ignore it and let the display pin to the first card.
    if (reduced) return
    const i = Math.min(N - 1, Math.max(0, Math.round(v * (N - 1))))
    if (i !== prevIdx.current) {
      prevIdx.current = i
      setActiveIdx(i)
      setFlipped(false) // a fresh card always presents its front first
    }
  })

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1
    tiltRef.current = { x: -ny * TILT, y: nx * TILT }
  }
  const handleLeave = () => {
    tiltRef.current = { x: 0, y: 0 }
  }
  const handleEnter = () => {
    if (reduced) return
    audio.blip()
  }
  const handleFlip = () => {
    if (reduced) return
    // Reads `flipped` from the render closure rather than an updater
    // function: React (Strict Mode, dev-only) double-invokes updater
    // functions to catch impure ones, which would double-fire select()/back().
    const next = !flipped
    const direction = next ? 'reveal' : 'return'
    setFlipped(next)
    if (next) audio.select()
    else audio.back()
    onCardFlip?.(direction)
  }

  // Reduced motion parks on the first card; otherwise track the scroll.
  const displayIdx = reduced ? 0 : activeIdx
  const active = projects[displayIdx]

  return (
    <section
      id="work"
      style={{ ['--mc-ring' as string]: WORK_ACCENT, background: MC.ink, color: MC.paper }}
      className="relative"
    >
      {/* Pinned scene. Wrapper is tall (scroll drives the rail); under reduced
          motion it collapses to a single static viewport so nothing pins. */}
      <div ref={wrapperRef} style={{ height: reduced ? '100svh' : `${N * 90}vh` }}>
        <div
          data-testid="work-stage"
          data-cursor="circle"
          onPointerEnter={handleEnter}
          onPointerMove={handleMove}
          onPointerLeave={handleLeave}
          onClick={handleFlip}
          className="sticky top-0 flex h-[100svh] flex-col overflow-hidden"
          style={{ cursor: reduced ? 'default' : 'pointer' }}
        >
          {/* The rail canvas — decorative; the list below is the real content. */}
          <div className="absolute inset-0" aria-hidden="true">
            <VignetteCanvas
              height="100%"
              reduced={reduced}
              camera={CAMERA}
              target={TARGET}
              shadowRadius={1.4}
              envIntensity={0.35}
              fallbackGlyph={SECTION_ACCENT.work}
            >
              <CardRail
                projects={projects}
                railX={railX}
                tiltRef={tiltRef}
                flipped={flipped}
                reduced={reduced}
              />
            </VignetteCanvas>
          </div>

          {/* Eyebrow, top-left — the section marker + its one accent glyph. */}
          <div className="pointer-events-none relative z-10 flex items-center gap-3 px-6 pt-20 sm:px-12">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none">
              <path d={GLYPH_PATHS.circle} stroke={WORK_ACCENT} strokeWidth={2} />
            </svg>
            <span
              style={{ fontFamily: monoFamily, fontSize: TYPE.label, letterSpacing: '0.24em', color: paperAlpha(0.6) }}
              className="lowercase"
            >
              act 02 · work
            </span>
          </div>

          {/* Slot readout, bottom-left — active slot + crossfading title. */}
          <div className="pointer-events-none relative z-10 mt-auto px-6 pb-10 sm:px-12">
            <div className="flex items-baseline gap-3">
              <span
                aria-hidden="true"
                style={{ fontFamily: monoFamily, fontSize: TYPE.label, letterSpacing: '0.22em', color: WORK_ACCENT }}
                className="lowercase"
              >
                slot
              </span>
              <span
                aria-hidden="true"
                style={{ fontFamily: monoFamily, fontSize: TYPE.label, letterSpacing: '0.22em', color: paperAlpha(0.55) }}
              >
                {pad(displayIdx)} / {pad(N - 1)}
              </span>
            </div>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.p
                key={displayIdx}
                aria-hidden="true"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={reduced ? { duration: 0 } : { duration: 0.4, ease: EASE }}
                style={{ fontFamily: grotesk.style.fontFamily, fontWeight: 700 }}
                className="mt-1 text-[1.5rem] leading-tight sm:text-[2rem]"
              >
                {active.title}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Interaction hint, bottom-right — hidden when there's nothing to do. */}
          {!reduced && (
            <div className="pointer-events-none absolute bottom-10 right-6 z-10 hidden sm:block">
              <span
                style={{ fontFamily: monoFamily, fontSize: '0.6875rem', letterSpacing: '0.24em', color: paperAlpha(0.4) }}
                className="lowercase"
              >
                scroll to browse · click a card to flip
              </span>
            </div>
          )}
        </div>
      </div>

      {/* The crawlable truth: every project, always in the DOM, identical in
          both motion modes. This is what carries the content of the section. */}
      <div className="border-t px-6 py-16 sm:px-12 sm:py-24" style={{ borderColor: paperAlpha(0.12) }}>
        <div className="mx-auto max-w-[64rem]">
          <div className="mb-10 flex items-center gap-3">
            <span
              style={{ fontFamily: monoFamily, fontSize: TYPE.label, letterSpacing: '0.22em', color: paperAlpha(0.5) }}
              className="lowercase"
            >
              save files · {pad(N - 1)}
            </span>
            <span aria-hidden="true" className="h-px flex-1" style={{ background: paperAlpha(0.12) }} />
          </div>

          <div data-testid="work-crawl" className="flex flex-col">
            {projects.map((project, idx) => (
              <article
                key={project.id}
                className="grid gap-x-8 gap-y-3 border-b py-8 sm:grid-cols-[auto_1fr] sm:py-10"
                style={{ borderColor: paperAlpha(0.1) }}
              >
                <span
                  style={{ fontFamily: monoFamily, fontSize: '0.8125rem', letterSpacing: '0.16em', color: accentFor(idx) }}
                  className="lowercase"
                >
                  slot {pad(idx)}
                </span>
                <div className="flex flex-col gap-3">
                  <h3
                    style={{ fontFamily: grotesk.style.fontFamily, fontWeight: 700, color: MC.paper }}
                    className="text-[1.5rem] leading-tight sm:text-[1.875rem]"
                  >
                    {project.title}
                  </h3>
                  <p
                    style={{ fontFamily: monoFamily, fontSize: TYPE.label, letterSpacing: '0.08em', color: paperAlpha(0.6) }}
                    className="lowercase"
                  >
                    {project.company} · {project.year}
                  </p>
                  <ul className="mt-1 flex flex-col gap-2">
                    {(project.metrics ?? []).map((metric) => (
                      <li
                        key={metric}
                        style={{ fontFamily: grotesk.style.fontFamily, color: paperAlpha(0.78) }}
                        className="flex items-baseline gap-3 text-[1.0625rem]"
                      >
                        <span aria-hidden="true" style={{ color: accentFor(idx) }}>
                          ›
                        </span>
                        {metric}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default WorkSection
