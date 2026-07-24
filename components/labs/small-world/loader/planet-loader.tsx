'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PALETTE } from '../palette'
import styles from './planet-loader.module.css'

export const SW_LOADER_MIN_HOLD_MS = 800
export const SW_LOADER_MAX_WAIT_MS = 8000
export const SW_LOADER_REVEAL_MS = 400

type Phase = 'holding' | 'revealing' | 'done'

/** Palette tokens the CSS module paints with — kept here so palette.ts stays the
 *  single source of truth (mirrors the fallback-style / tune-panel no-new-dep house style). */
const PALETTE_VARS: Record<string, string> = {
  '--swl-sky': PALETTE.sky,
  '--swl-horizon': PALETTE.horizon,
  '--swl-sprout': PALETTE.sprout,
  '--swl-meadow': PALETTE.meadow,
  '--swl-meadow-dry': PALETTE.meadowDry,
  '--swl-leaf': PALETTE.leaf,
  '--swl-pine': PALETTE.pineDeep,
  '--swl-foliage': PALETTE.foliageDeep,
  '--swl-clay': PALETTE.clayPath,
  '--swl-blossom': PALETTE.blossom,
  '--swl-blossom-deep': PALETTE.blossomDeep,
  '--swl-ink': PALETTE.ink,
}

/**
 * Themed loading screen for the Small World lab: a pastel sky over a tiny clay
 * planet with a cheerful pink bird circling its orbit, a clay progress ring that
 * rolls up to completion, and a Baloo 2 caption. Paints before the 3D chunk resolves
 * (rendered by the non-lazy parent), then reveals into the live scene.
 *
 * Phase machine mirrors the museum curtain's hard-won lessons: a minimum hold so
 * warm caches never flicker, a failsafe so a stuck asset can't trap the visitor,
 * and a self-unmount so it costs nothing once `done`. `data-phase` is the e2e
 * contract; the whole overlay fades (backdrop → transparent) on reveal.
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

  // Unmount after the fade finishes — zero cost once gone.
  useEffect(() => {
    if (phase !== 'revealing') return
    const t = setTimeout(() => setPhase('done'), SW_LOADER_REVEAL_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'done') return null

  // Fill the clay ring from real progress; snap to complete on ready so it only
  // ever closes the loop at the moment the scene takes over.
  const pct = ready ? 100 : Math.min(99, Math.max(0, Math.round(progress)))

  return (
    <div
      className={phase === 'revealing' ? `${styles.loader} ${styles.revealing}` : styles.loader}
      data-sw-loader=""
      data-phase={phase}
      aria-hidden="true"
      style={{ ...PALETTE_VARS, '--swl-progress': pct } as CSSProperties}
    >
      <div className={styles.stage}>
        <div className={styles.system}>
          <div className={styles.ring} />
          <div className={styles.planet} />
          <div className={styles.orbit}>
            <div className={styles.bird}>
              <span className={styles.tail} />
              <span className={styles.body} />
              <span className={styles.wing} />
              <span className={styles.head} />
              <span className={styles.beak} />
              <span className={styles.eye} />
            </div>
          </div>
        </div>
        <p className={styles.caption}>rolling up a small world…</p>
      </div>
    </div>
  )
}
