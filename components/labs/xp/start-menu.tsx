'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useXpStore, type XpAppId } from './store'
import { playSound } from './sounds'
import { APPS, openApp } from './apps'
import { PixelAvatar } from './pixel-avatar'
import styles from './xp.module.css'

const LEFT: XpAppId[] = ['internet-explorer', 'messenger', 'my-projects', 'resume', 'about']
const RIGHT: XpAppId[] = ['my-computer', 'recycle-bin', 'add-remove']

export function StartMenu() {
  const open = useXpStore((s) => s.startOpen)
  const [confirming, setConfirming] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!confirming) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setConfirming(false)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [confirming])

  if (!open && !confirming) return null

  const turnOff = () => {
    playSound('shutdown')
    router.push('/')
  }
  const restart = () => {
    window.sessionStorage.removeItem('xp-booted')
    setConfirming(false)
    useXpStore.getState().setStartOpen(false)
    useXpStore.getState().setPhase('boot')
  }

  return (
    <>
      {open && (
        <nav className={styles.startMenu} aria-label="Start menu">
          <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'linear-gradient(180deg,#1c68d6,#0f47ad)', color: '#fff', fontWeight: 700, fontSize: 14 }}>
            <PixelAvatar size={32} />
            Aram
          </header>
          <div style={{ display: 'flex' }}>
            <ul style={{ flex: 1.2, listStyle: 'none', margin: 0, padding: 6, background: '#fff' }}>
              {LEFT.map((app) => (
                <li key={app}>
                  <button type="button" onClick={() => openApp(app)} style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '6px 8px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
                    <span aria-hidden style={{ fontSize: 22 }}>{APPS[app].icon}</span>
                    {APPS[app].menuLabel}
                  </button>
                </li>
              ))}
            </ul>
            <ul style={{ flex: 1, listStyle: 'none', margin: 0, padding: 6, background: '#d3e5fa', borderLeft: '1px solid #a6c8f0', color: '#00136b' }}>
              {RIGHT.map((app) => (
                <li key={app}>
                  <button type="button" onClick={() => openApp(app)} style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '6px 8px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: 'inherit' }}>
                    <span aria-hidden style={{ fontSize: 18 }}>{APPS[app].icon}</span>
                    {APPS[app].menuLabel}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <footer style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 10px', background: 'linear-gradient(180deg,#1c68d6,#0f47ad)' }}>
            <button type="button" onClick={() => { setConfirming(true); useXpStore.getState().setStartOpen(false) }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
              <span aria-hidden>⏻</span> Turn Off Computer
            </button>
          </footer>
        </nav>
      )}
      {confirming && (
        <div role="dialog" aria-label="Turn off computer" className={styles.dialog} style={{ left: '50%', top: '40%', transform: 'translate(-50%,-50%)', zIndex: 20000 }}>
          <header className={styles.titleBar}><span className={styles.titleText}>Turn off computer</span></header>
          <div style={{ display: 'flex', gap: 10, padding: 20, justifyContent: 'center' }}>
            <button type="button" className={styles.bevelBtn} onClick={turnOff}>Turn Off</button>
            <button type="button" className={styles.bevelBtn} onClick={restart}>Restart</button>
            <button type="button" className={styles.bevelBtn} onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  )
}
