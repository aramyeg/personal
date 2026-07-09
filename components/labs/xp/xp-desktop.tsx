'use client'

import { useEffect, useState } from 'react'
import { useXpStore } from './store'
import { useIdle } from './use-idle'
import { DesktopIcons } from './desktop-icons'
import { WindowsLayer } from './windows-layer'
import { Taskbar } from './taskbar'
import { StartMenu } from './start-menu'
import { BootScreen } from './boot-screen'
import { WelcomeScreen } from './welcome-screen'
import { Clippy } from './clippy'
import { BalloonTip } from './balloon-tip'
import { Screensaver } from './screensaver'
import { ChaosLayer } from './chaos-layer'
import styles from './xp.module.css'

export function XpDesktop() {
  const phase = useXpStore((s) => s.phase)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const booted = window.sessionStorage.getItem('xp-booted') === '1'
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (booted || reduced) {
      window.sessionStorage.setItem('xp-booted', '1')
      useXpStore.getState().setPhase('desktop')
    }
    setResolved(true)
  }, [])

  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useIdle(60_000, () => useXpStore.getState().setScreensaver(true), phase === 'desktop' && !reduced)

  if (!resolved) return <div className={styles.desktop} />
  if (phase === 'boot') return <BootScreen />
  if (phase === 'welcome') return <WelcomeScreen />
  return (
    <div className={styles.desktop}>
      <div
        className={styles.wallpaper}
        style={{ backgroundImage: 'url(/labs/xp/bliss.jpg)' }}
      />
      <DesktopIcons />
      <WindowsLayer />
      <StartMenu />
      <Clippy />
      <BalloonTip />
      <Taskbar />
      <Screensaver />
      <ChaosLayer />
    </div>
  )
}
