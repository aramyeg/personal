'use client'

import { useEffect, type CSSProperties } from 'react'
import type { LabEntry } from '@/lib/labs-manifest'
import styles from './small-world-sign.module.css'

/**
 * Small World's own loading plate, kept as the attic's sign.
 *
 * The room it used to load was never built in this museum, so the frame opens
 * onto the loader instead of onto a route — and the loader never finishes. The
 * bluebird laps the rim forever with the same small gap of road ahead of it and
 * the same unfinished corner of the page behind it; the counter is stuck one
 * notch short. Everything is on one endless lap (`--swl-lap`), so the loop has
 * no seam to snap at: the bird's orbit, the colour wedge and the road's gap are
 * all derived from that single rotation.
 *
 * Ported from components/labs/small-world/loader/planet-loader.tsx on the lab's
 * own branch. That lab does not exist in this build, so its palette arrives here
 * as literals rather than as an import.
 */

/** Small World palette values (lab palette.ts), inlined — see above. */
const SW = {
  paper: '#FAFAFA',
  ink: '#2B2B33',
  cream: '#FFF3D6',
  clay: '#D98E6A',
  meadow: '#7BC47F',
  meadowDry: '#A3BE96',
  sprout: '#A8DCA0',
  goldSand: '#E6B24C',
  river: '#6FB7D9',
  riverDeep: '#4E9EC7',
  blossom: '#F7A8C4',
  ice: '#DCEAF2',
  earth: '#7E4E2E',
  foliageDeep: '#3F9A55',
  pineDeep: '#357E48',
} as const

/** The counter the loader is stuck on. Short of 100 by exactly enough to look
 *  like it is still working on it. */
const STUCK_PCT = 97

/** How much of the lap stays unlaid, in degrees: the gap of road ahead of the
 *  bird and the uncoloured wedge of page it is about to reach. */
const GAP_DEG = 26

/** Deterministic wobbly circle — the clay road the bluebird lays around the rim.
 *  Computed once at module scope, never per-render. Returns the polyline path
 *  and its length so the dash trick needs no getTotalLength() at runtime. */
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
/** Dash length rounded UP so the laid road and its gap always sum to the whole
 *  rim — a fractional shortfall would leave a pin-hole at the seam. */
const ROAD_LEN = Math.ceil(ROAD.length)
/** The laid stretch: everything except the gap the bird is always ahead of. */
const ROAD_TAIL = Math.round(ROAD_LEN * (1 - GAP_DEG / 360))

/** The coloring-book plate of her planet: flat clay landscape with ink contours.
 *  Rendered twice — a faint sketch pass (line art only, via CSS) under a colour
 *  pass the rotating wedge leaves one corner of, forever. `clipSuffix` keeps the
 *  two instances' clipPath ids from colliding in the one document. */
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
        <circle className="fill" cx="50" cy="50" r="37" fill={SW.meadow} />
        <path className="fill" d="M64 76 C72 68 86 68 94 76 L94 94 L60 94 Z" fill={SW.goldSand} />
        <path className="fill" d="M12 66 C19 61 30 62 34 70 C29 77 16 76 12 71 Z" fill={SW.river} />
        <path className="fill" d="M28 40 C32 35 40 35 44 40 C40 45 32 45 28 40 Z" fill={SW.blossom} />
        <path className="fill" d="M64 26 C69 21 78 22 82 28 C77 33 68 32 64 26 Z" fill={SW.ice} />
        <path className="fill" d="M46 58 C50 54 57 54 60 58 C57 62 49 62 46 58 Z" fill={SW.meadowDry} opacity="0.55" />
        <path className="fill" d="M24 52 C27 49 32 49 34 52 C32 55 26 55 24 52 Z" fill={SW.sprout} opacity="0.8" />
        <path className="fill" d="M56 42 C58 40 62 40 64 42 C62 44 58 44 56 42 Z" fill={SW.sprout} opacity="0.7" />
      </g>
      {/* trees standing inside the rim, like the scene's planet edge */}
      <g>
        <rect className="fill" x="63" y="27" width="3" height="6.5" rx="1.2" fill={SW.earth} stroke={SW.ink} strokeWidth="1.1" transform="rotate(33 64.5 30)" />
        <path className="fill" d="M66.5 15.5 C72 17 74.5 22.5 71.8 27 C69 30 63.5 29.5 62 25.5 C60.5 21 62.5 16.5 66.5 15.5 Z" fill={SW.foliageDeep} stroke={SW.ink} strokeWidth="1.6" strokeLinejoin="round" />
      </g>
      <g>
        <rect className="fill" x="25.5" y="33" width="2.8" height="6" rx="1.1" fill={SW.earth} stroke={SW.ink} strokeWidth="1" transform="rotate(-38 27 36)" />
        <path className="fill" d="M22 24.5 C26 21 31 22 32.5 26 C33.5 29.5 30 32.5 26.5 32 C23 31.5 21 27.5 22 24.5 Z" fill={SW.pineDeep} stroke={SW.ink} strokeWidth="1.4" strokeLinejoin="round" />
      </g>
      <g>
        <path className="fill" d="M76 40 C80 38 84 40 84.5 43.5 C85 47 81 49 78 47.5 C75.5 46 74.5 42.5 76 40 Z" fill={SW.blossom} stroke={SW.ink} strokeWidth="1.4" strokeLinejoin="round" />
      </g>
      {/* the planet's own ink contour */}
      <circle className="fill" cx="50" cy="50" r="36.8" fill="none" stroke={SW.ink} strokeWidth="2.4" />
    </svg>
  )
}

/** Tiny bluebird, flat colour + ink contour, nose to the right, wing raised. */
function BirdArt() {
  return (
    <svg className={styles.bird} viewBox="0 0 44 30" aria-hidden="true">
      <path d="M4 17 L10 19 C9 15 10 12 13 12 L7 8 L11 11 Z" fill={SW.riverDeep} stroke={SW.ink} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 18 C9 13 15 10 22 10 C30 10 35 14 35 18 C35 22 29 25 21 25 C14 25 9 22 9 18 Z" fill={SW.river} stroke={SW.ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M34 15 L42 17 L34 20 Z" fill={SW.goldSand} stroke={SW.ink} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 12 C14 6 20 2 26 4 C24 7 23 10 21 12 Z" fill={SW.riverDeep} stroke={SW.ink} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M28 20 C26 23 22 24 19 23 C21 21 24 20 28 20 Z" fill={SW.riverDeep} stroke="none" opacity="0.7" />
      <circle cx="30" cy="15" r="1.5" fill={SW.ink} />
    </svg>
  )
}

/**
 * The sign the remnant's frame opens onto instead of a room. Dismissed by the
 * button, by the backdrop, or by Esc — a visitor can always get back to the
 * attic, which is the whole point of the frame not being a link.
 */
export function SmallWorldSign({ lab, onClose }: { lab: LabEntry; onClose: () => void }) {
  // Capture-phase Esc, per the museum's Esc discipline: the pause screen and
  // the gallery chrome both listen too, and only the topmost layer may act.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [onClose])

  return (
    <div
      className={styles.sign}
      data-small-world-sign=""
      role="dialog"
      aria-modal="true"
      aria-label={`${lab.title} — the sign`}
      onClick={onClose}
      style={
        {
          '--swl-paper': SW.paper,
          '--swl-ink': SW.ink,
          '--swl-cream': SW.cream,
          '--swl-clay': SW.clay,
          '--swl-gap': `${GAP_DEG}deg`,
          '--swl-road-len': `${ROAD_LEN}px`,
          '--swl-road-tail': `${ROAD_TAIL}px`,
        } as CSSProperties
      }
    >
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.plate}>
          <div className={styles.title}>SMALL WORLD</div>
          <div className={styles.sub}>a journey, chapter by chapter</div>
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
            <span>colouring her world</span>
            <span className={styles.pct}>{STUCK_PCT}%</span>
          </div>
        </div>

        <div className={styles.remark}>
          <p className={styles.retrospective}>{lab.retrospective}</p>
          <button type="button" className={styles.dismiss} onClick={onClose}>
            back to the attic
          </button>
        </div>
      </div>
    </div>
  )
}
