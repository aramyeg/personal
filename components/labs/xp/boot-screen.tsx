'use client'

import { useEffect } from 'react'
import { useXpStore } from './store'

export function BootScreen() {
  useEffect(() => {
    const done = () => useXpStore.getState().setPhase('welcome')
    const t = setTimeout(done, 2500)
    const skip = (e: Event) => { e.preventDefault(); done() }
    window.addEventListener('keydown', skip, { capture: true })
    window.addEventListener('pointerdown', skip, { capture: true })
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', skip, { capture: true })
      window.removeEventListener('pointerdown', skip, { capture: true })
    }
  }, [])

  return (
    <div data-testid="boot-screen" style={{ position: 'fixed', inset: 0, background: '#000', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'Tahoma, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, fontWeight: 700, fontStyle: 'italic', marginBottom: 4 }}>
          Microsoft<sup style={{ fontSize: 12 }}>®</sup>
        </div>
        <div style={{ fontSize: 56, fontWeight: 700 }}>
          Windows <span style={{ color: '#f6821f' }}>XP</span>
        </div>
        <div style={{ margin: '48px auto 0', width: 200, height: 16, border: '2px solid #b0b0b0', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ width: 40, height: '100%', background: 'linear-gradient(90deg,#2838c7,#5979ef,#2838c7)', animation: 'xp-boot-crawl 1.4s linear infinite' }} />
        </div>
        <style>{'@keyframes xp-boot-crawl { from { transform: translateX(-48px) } to { transform: translateX(208px) } }'}</style>
      </div>
    </div>
  )
}
