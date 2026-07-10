'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './curtain.module.css'
import { VisitorGuide } from './visitor-guide'

export const CURTAIN_MIN_HOLD_MS = 800
export const CURTAIN_MAX_WAIT_MS = 8000
export const CURTAIN_OPEN_MS = 1400

type Phase = 'closed' | 'opening' | 'gone'

/**
 * Red theater drapes over the museum while it loads. Parts once `ready`
 * (a minimum hold so warm caches never flicker, a failsafe so one broken
 * poster can't trap the visitor), then unmounts itself.
 */
export function Curtain({ ready, progress }: { ready: boolean; progress: number }) {
  const [phase, setPhase] = useState<Phase>('closed')
  const mountedAt = useRef<number>(Date.now())

  // Open when ready, but never before the minimum hold.
  useEffect(() => {
    if (phase !== 'closed' || !ready) return
    const wait = Math.max(0, CURTAIN_MIN_HOLD_MS - (Date.now() - mountedAt.current))
    const t = setTimeout(() => setPhase('opening'), wait)
    return () => clearTimeout(t)
  }, [ready, phase])

  // Failsafe: open even if the ready signal never arrives.
  useEffect(() => {
    if (phase !== 'closed') return
    const t = setTimeout(() => setPhase('opening'), CURTAIN_MAX_WAIT_MS)
    return () => clearTimeout(t)
  }, [phase])

  // Unmount after the panels finish parting.
  useEffect(() => {
    if (phase !== 'opening') return
    const t = setTimeout(() => setPhase('gone'), CURTAIN_OPEN_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'gone') return null

  return (
    <div
      className={phase === 'opening' ? `${styles.curtain} ${styles.open}` : styles.curtain}
      data-phase={phase}
      aria-hidden="true"
    >
      <div className={`${styles.panel} ${styles.panelLeft}`} />
      <div className={`${styles.panel} ${styles.panelRight}`} />
      <div className={styles.stage}>
        <VisitorGuide />
        <p className={styles.progress}>
          {ready ? 'The gallery is ready' : `Preparing the gallery — ${Math.round(progress)}%`}
        </p>
      </div>
    </div>
  )
}
