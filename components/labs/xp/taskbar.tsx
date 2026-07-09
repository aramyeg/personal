'use client'

import { useEffect, useState } from 'react'
import { useXpStore } from './store'
import { APPS } from './apps'
import styles from './xp.module.css'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function Taskbar() {
  const windows = useXpStore((s) => s.windows)
  const activeId = useXpStore((s) => s.activeId)
  const startOpen = useXpStore((s) => s.startOpen)
  const muted = useXpStore((s) => s.muted)
  const clock = useClock()

  return (
    <div className={styles.taskbar}>
      <button
        type="button"
        className={styles.startButton}
        aria-label="start"
        aria-expanded={startOpen}
        onClick={() => useXpStore.getState().setStartOpen(!startOpen)}
      >
        <span aria-hidden>⊞</span> start
      </button>
      {windows.map((w) => (
        <button
          key={w.id}
          type="button"
          className={`${styles.taskButton} ${activeId === w.id && !w.minimized ? styles.taskButtonActive : ''}`}
          onClick={() => useXpStore.getState().clickTaskButton(w.id)}
        >
          <span aria-hidden>{APPS[w.app].icon}</span> {w.title}
        </button>
      ))}
      <div className={styles.tray}>
        <button
          type="button"
          aria-label="Toggle sound"
          onClick={() => useXpStore.getState().toggleMuted()}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <span data-testid="tray-clock">{clock}</span>
      </div>
    </div>
  )
}
