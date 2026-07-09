'use client'

import { useEffect, useState } from 'react'
import { useXpStore } from './store'
import { DesktopIcons } from './desktop-icons'
import { WindowsLayer } from './windows-layer'
import { Taskbar } from './taskbar'
import { StartMenu } from './start-menu'
import { BootScreen } from './boot-screen'
import { WelcomeScreen } from './welcome-screen'
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
      <Taskbar />
    </div>
  )
}
