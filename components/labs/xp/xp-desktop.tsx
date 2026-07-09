'use client'

import { useEffect } from 'react'
import { useXpStore } from './store'
import { DesktopIcons } from './desktop-icons'
import { WindowsLayer } from './windows-layer'
import styles from './xp.module.css'

export function XpDesktop() {
  const phase = useXpStore((s) => s.phase)

  useEffect(() => {
    // Until the boot flow lands (Task 9), jump straight to the desktop.
    if (useXpStore.getState().phase !== 'desktop') useXpStore.getState().setPhase('desktop')
  }, [])

  if (phase !== 'desktop') return <div className={styles.desktop} />
  return (
    <div className={styles.desktop}>
      <div
        className={styles.wallpaper}
        style={{ backgroundImage: 'url(/labs/xp/bliss.jpg)' }}
      />
      <DesktopIcons />
      <WindowsLayer />
    </div>
  )
}
