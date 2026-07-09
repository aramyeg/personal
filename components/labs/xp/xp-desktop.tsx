'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useXpStore } from './store'
import { useIdle } from './use-idle'
import { isCoarse } from './apps'
import { unlockSounds } from './sounds'
import { DesktopIcons } from './desktop-icons'
import { WindowsLayer } from './windows-layer'
import { Taskbar } from './taskbar'
import { StartMenu } from './start-menu'
import { BootScreen } from './boot-screen'
import { WelcomeScreen } from './welcome-screen'
import { Clippy } from './clippy'
import { BalloonTip } from './balloon-tip'
import { ChaosLayer } from './chaos-layer'
import styles from './xp.module.css'

const Screensaver = dynamic(() => import('./screensaver').then((m) => m.Screensaver), { ssr: false })

export function XpDesktop() {
  const phase = useXpStore((s) => s.phase)
  const chaos = useXpStore((s) => s.chaos)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const booted = window.sessionStorage.getItem('xp-booted') === '1'
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (booted || reduced) {
      window.sessionStorage.setItem('xp-booted', '1')
      useXpStore.getState().setPhase('desktop')
    }
    if (window.sessionStorage.getItem('xp-muted') === '1') {
      useXpStore.setState({ muted: true })
    }
    window.addEventListener('pointerdown', unlockSounds, { once: true })
    window.addEventListener('keydown', unlockSounds, { once: true })
    setResolved(true)
    return () => {
      window.removeEventListener('pointerdown', unlockSounds)
      window.removeEventListener('keydown', unlockSounds)
    }
  }, [])

  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useIdle(
    60_000,
    () => useXpStore.getState().setScreensaver(true),
    phase === 'desktop' && !reduced && !isCoarse() && chaos === 'idle'
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useXpStore.getState()
      if (s.startOpen) {
        e.preventDefault()
        s.setStartOpen(false)
      }
      // screensaver, bsod and boot each own their keys via their own
      // capture listeners; anything else falls through to GalleryChrome.
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
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
      <Clippy />
      <BalloonTip />
      <Taskbar />
      <Screensaver />
      <ChaosLayer />
    </div>
  )
}
