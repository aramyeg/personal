'use client'

import { useXpStore } from './store'
import { playSound, unlockSounds } from './sounds'
import { PixelAvatar } from './pixel-avatar'

export function WelcomeScreen() {
  const logOn = () => {
    window.sessionStorage.setItem('xp-booted', '1')
    unlockSounds()
    playSound('startup')
    useXpStore.getState().setPhase('desktop')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#5a7edc 0%,#3f62c4 8%,#2b4fa8 90%,#1f3c85 100%)', fontFamily: 'Tahoma, sans-serif' }}>
      <header style={{ height: '18%', borderBottom: '2px solid #dfa548', background: 'linear-gradient(180deg,#1e3c95,#2c50b8)' }} />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, textAlign: 'right', paddingRight: 40, color: '#fff', fontSize: 22 }}>
          To begin, click your user name
        </div>
        <div style={{ width: 2, alignSelf: 'stretch', background: 'linear-gradient(180deg,transparent,#8fa8e0,transparent)' }} />
        <div style={{ flex: 1, paddingLeft: 40 }}>
          <button
            type="button"
            aria-label="Log on as Aram"
            onClick={logOn}
            style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}
          >
            <span style={{ display: 'inline-flex', border: '2px solid #fff', borderRadius: 6, overflow: 'hidden' }}>
              <PixelAvatar size={56} />
            </span>
            <span style={{ fontSize: 22 }}>Aram</span>
          </button>
        </div>
      </main>
      <footer style={{ height: '14%', borderTop: '2px solid #dfa548', background: 'linear-gradient(180deg,#2c50b8,#16307c)' }} />
    </div>
  )
}
