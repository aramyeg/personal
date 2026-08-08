'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PALETTE } from '../palette'
import styles from './planet-loader.module.css'

export const SW_LOADER_MIN_HOLD_MS = 800
export const SW_LOADER_MAX_WAIT_MS = 8000
export const SW_LOADER_REVEAL_MS = 1150
/** The byte-driven share of the lap: the girl GLB's fetched bytes fill 0–88.
 *  The last 12% belongs to parse/bake and only ever completes on `ready`, so the
 *  road never closes before the scene actually takes over. */
export const SW_LOADER_BYTE_ARC = 88

type Phase = 'holding' | 'revealing' | 'done'

/** Palette tokens the CSS module paints with — kept here so palette.ts stays the
 *  single source of truth. The world/bird SVGs below take their fills straight
 *  from PALETTE as presentation attributes instead (var() is not valid inside an
 *  SVG presentation attribute, and inline styles would defeat the sketch pass's
 *  CSS line-art override, which must win over the colour fills). */
const PALETTE_VARS: Record<string, string> = {
  '--swl-paper': PALETTE.pagePaper,
  '--swl-ink': PALETTE.ink,
  '--swl-cream': PALETTE.sky,
  '--swl-clay': PALETTE.clayPath,
}

/** Deterministic wobbly circle — the clay road the bluebird lays around the rim.
 *  Same generator as the approved lookdev (t95/lookdev/d.html); computed once at
 *  module scope, never per-render. Returns the polyline path and its length so
 *  the dash trick needs no getTotalLength() at runtime. */
function wobble(cx: number, cy: number, r: number, seed: number) {
  const pts = Array.from({ length: 49 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2 - Math.PI / 2
    const rr = r + Math.sin(i * 2.8 + seed) * 0.28 + Math.sin(i * 1.5 + seed * 2) * 0.22
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as const
  })
  const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')
  const length = pts.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])),
    0
  )
  return { d, length }
}

const ROAD = wobble(50, 50, 43.2, 3)
/** Dash length rounded UP so offset=len always hides the whole path and offset=0
 *  always shows it — a fractional shortfall would leave a pin-hole at the seam. */
const ROAD_LEN = Math.ceil(ROAD.length)

/** The coloring-book plate of her planet: flat clay landscape with ink contours.
 *  Rendered twice — a faint sketch pass (line art only, via CSS) under a colour
 *  pass that a conic mask wipes in radially with the bytes. `clipSuffix` keeps
 *  the two instances' clipPath ids from colliding in the one document. */
function WorldArt({ clipSuffix }: { clipSuffix: string }) {
  const clipId = `swl-ball-${clipSuffix}`
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="36.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <circle className="fill" cx="50" cy="50" r="37" fill={PALETTE.meadow} />
        <path className="fill" d="M64 76 C72 68 86 68 94 76 L94 94 L60 94 Z" fill={PALETTE.goldSand} />
        <path className="fill" d="M12 66 C19 61 30 62 34 70 C29 77 16 76 12 71 Z" fill={PALETTE.river} />
        <path className="fill" d="M28 40 C32 35 40 35 44 40 C40 45 32 45 28 40 Z" fill={PALETTE.blossom} />
        <path className="fill" d="M64 26 C69 21 78 22 82 28 C77 33 68 32 64 26 Z" fill={PALETTE.ice} />
        <path className="fill" d="M46 58 C50 54 57 54 60 58 C57 62 49 62 46 58 Z" fill={PALETTE.meadowDry} opacity="0.55" />
        <path className="fill" d="M24 52 C27 49 32 49 34 52 C32 55 26 55 24 52 Z" fill={PALETTE.sprout} opacity="0.8" />
        <path className="fill" d="M56 42 C58 40 62 40 64 42 C62 44 58 44 56 42 Z" fill={PALETTE.sprout} opacity="0.7" />
      </g>
      {/* trees standing inside the rim, like the scene's planet edge */}
      <g>
        <rect className="fill" x="63" y="27" width="3" height="6.5" rx="1.2" fill={PALETTE.earth} stroke={PALETTE.ink} strokeWidth="1.1" transform="rotate(33 64.5 30)" />
        <path className="fill" d="M66.5 15.5 C72 17 74.5 22.5 71.8 27 C69 30 63.5 29.5 62 25.5 C60.5 21 62.5 16.5 66.5 15.5 Z" fill={PALETTE.foliageDeep} stroke={PALETTE.ink} strokeWidth="1.6" strokeLinejoin="round" />
      </g>
      <g>
        <rect className="fill" x="25.5" y="33" width="2.8" height="6" rx="1.1" fill={PALETTE.earth} stroke={PALETTE.ink} strokeWidth="1" transform="rotate(-38 27 36)" />
        <path className="fill" d="M22 24.5 C26 21 31 22 32.5 26 C33.5 29.5 30 32.5 26.5 32 C23 31.5 21 27.5 22 24.5 Z" fill={PALETTE.pineDeep} stroke={PALETTE.ink} strokeWidth="1.4" strokeLinejoin="round" />
      </g>
      <g>
        <path className="fill" d="M76 40 C80 38 84 40 84.5 43.5 C85 47 81 49 78 47.5 C75.5 46 74.5 42.5 76 40 Z" fill={PALETTE.blossom} stroke={PALETTE.ink} strokeWidth="1.4" strokeLinejoin="round" />
      </g>
      {/* the planet's own ink contour */}
      <circle className="fill" cx="50" cy="50" r="36.8" fill="none" stroke={PALETTE.ink} strokeWidth="2.4" />
    </svg>
  )
}

/** Tiny bluebird, flat colour + ink contour, nose to the right, wing raised. */
function BirdArt() {
  return (
    <svg className={styles.bird} viewBox="0 0 44 30" aria-hidden="true">
      <path d="M4 17 L10 19 C9 15 10 12 13 12 L7 8 L11 11 Z" fill={PALETTE.riverDeep} stroke={PALETTE.ink} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 18 C9 13 15 10 22 10 C30 10 35 14 35 18 C35 22 29 25 21 25 C14 25 9 22 9 18 Z" fill={PALETTE.river} stroke={PALETTE.ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M34 15 L42 17 L34 20 Z" fill={PALETTE.goldSand} stroke={PALETTE.ink} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 12 C14 6 20 2 26 4 C24 7 23 10 21 12 Z" fill={PALETTE.riverDeep} stroke={PALETTE.ink} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M28 20 C26 23 22 24 19 23 C21 21 24 20 28 20 Z" fill={PALETTE.riverDeep} stroke="none" opacity="0.7" />
      <circle cx="30" cy="15" r="1.5" fill={PALETTE.ink} />
    </svg>
  )
}

/**
 * THE WORLD COLOURS IN — the Small World loading plate. A coloring-book page of
 * her planet: faint ink line art from the first frame, real colour wiping in
 * radially with the girl GLB's bytes, a bluebird laying the clay road around the
 * rim, a cream narrator chip calling the stage, then a paper iris opens into
 * chapter 1. Paints before the 3D chunk resolves (rendered by the non-lazy
 * parent), then reveals into the live scene.
 *
 * Phase machine keeps the museum curtain's hard-won lessons: a minimum hold so
 * warm caches never flicker, a failsafe so a stuck asset can't trap the visitor,
 * and a self-unmount so it costs nothing once `done`. `data-phase` is the e2e
 * contract; e2e waits on [data-sw-loader] detaching.
 */
export function PlanetLoader({ ready, progress }: { ready: boolean; progress: number }) {
  const [phase, setPhase] = useState<Phase>('holding')
  const mountedAt = useRef<number>(Date.now())

  // Reveal once ready, but never before the minimum hold (no warm-cache blink).
  useEffect(() => {
    if (phase !== 'holding' || !ready) return
    const wait = Math.max(0, SW_LOADER_MIN_HOLD_MS - (Date.now() - mountedAt.current))
    const t = setTimeout(() => setPhase('revealing'), wait)
    return () => clearTimeout(t)
  }, [ready, phase])

  // Failsafe: reveal even if the ready signal never arrives.
  useEffect(() => {
    if (phase !== 'holding') return
    const t = setTimeout(() => setPhase('revealing'), SW_LOADER_MAX_WAIT_MS)
    return () => clearTimeout(t)
  }, [phase])

  // Unmount after the iris finishes — zero cost once gone.
  useEffect(() => {
    if (phase !== 'revealing') return
    const t = setTimeout(() => setPhase('done'), SW_LOADER_REVEAL_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'done') return null

  // Bytes fill the first 88% of the lap; only `ready` closes it.
  const arc = ready
    ? 100
    : Math.min(SW_LOADER_BYTE_ARC, Math.max(0, Math.round((progress * SW_LOADER_BYTE_ARC) / 100)))

  return (
    <div
      className={phase === 'revealing' ? `${styles.loader} ${styles.revealing}` : styles.loader}
      data-sw-loader=""
      data-phase={phase}
      aria-hidden="true"
      style={
        {
          ...PALETTE_VARS,
          '--swl-progress': arc,
          '--swl-road-len': `${ROAD_LEN}px`,
        } as CSSProperties
      }
    >
      <div className={styles.plate}>
        <div className={styles.title}>{'SMALL WORLD'}</div>
        <div className={styles.sub}>{'Alwi’s journey, chapter by chapter'}</div>
        <div className={styles.world}>
          <div className={`${styles.art} ${styles.sketch}`}>
            <WorldArt clipSuffix="sketch" />
          </div>
          <div className={`${styles.art} ${styles.color}`}>
            <WorldArt clipSuffix="color" />
          </div>
          <svg className={styles.road} viewBox="0 0 100 100" aria-hidden="true">
            <path className={styles.roadPlan} d={ROAD.d} />
            <path className={styles.roadInk} d={ROAD.d} />
            <path className={styles.roadClay} d={ROAD.d} />
          </svg>
          <div className={styles.birdBox}>
            <BirdArt />
          </div>
        </div>
        <div className={styles.chip}>
          <span>{arc < SW_LOADER_BYTE_ARC ? 'colouring her world' : 'rolling the clay'}</span>
          <span className={styles.pct}>{arc}%</span>
        </div>
      </div>
      {/* the iris sheet: a round hole that grows; box-shadow paints the paper around it */}
      <div className={styles.iris} />
    </div>
  )
}
