'use client'

import { useRef, useState } from 'react'
import { siteConfig, socialLinks } from '@/lib/constants'
import { playSound } from './sounds'
import styles from './xp.module.css'

export function WinMessenger() {
  const [nudged, setNudged] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const nudge = () => {
    playSound('nudge')
    setNudged(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setNudged(false), 600)
  }

  return (
    <div data-nudged={nudged || undefined} style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 11, animation: nudged ? 'xp-nudge .12s linear 5' : undefined }}>
      <style>{'@keyframes xp-nudge { 25% { transform: translate(3px,2px) } 75% { transform: translate(-3px,-2px) } }'}</style>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'linear-gradient(180deg,#f5f9ff,#cfe1f7)', borderBottom: '1px solid #a6c8f0' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: siteConfig.available ? '#43a047' : '#e65100' }} aria-hidden />
        <strong>Aram</strong>
        <span style={{ color: '#555' }}>{siteConfig.available ? '(Online)' : '(Busy)'} — {siteConfig.location}</span>
      </header>
      <div style={{ flex: 1, overflow: 'auto', padding: 10, userSelect: 'text' }}>
        <p><strong style={{ color: '#00309c' }}>Aram says:</strong></p>
        <p style={{ margin: '2px 0 10px 10px' }}>hey! 👋 {siteConfig.description}</p>
        <p><strong style={{ color: '#00309c' }}>Aram says:</strong></p>
        <p style={{ margin: '2px 0 10px 10px' }}>fastest way to reach me:</p>
        <ul style={{ margin: '0 0 0 20px' }}>
          <li><a href={`mailto:${siteConfig.email}`} style={{ color: '#0026b8' }}>{siteConfig.email}</a></li>
          {socialLinks.map((l) => (
            <li key={l.name}><a href={l.url} target="_blank" rel="noreferrer" style={{ color: '#0026b8' }}>{l.name}</a></li>
          ))}
        </ul>
      </div>
      <footer style={{ borderTop: '1px solid #a6c8f0', padding: 8, display: 'flex', gap: 6 }}>
        <span style={{ flex: 1, border: '1px solid #7f9db9', background: '#fff', padding: '3px 6px', color: '#999' }}>
          Type a message… (he answers email faster)
        </span>
        <button type="button" className={styles.bevelBtn} aria-label="Send nudge" onClick={nudge}>Nudge!</button>
      </footer>
    </div>
  )
}
