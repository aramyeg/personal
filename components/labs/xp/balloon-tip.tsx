'use client'

import { useEffect, useState } from 'react'
import { useXpStore } from './store'
import { playSound } from './sounds'

export function BalloonTip() {
  const phase = useXpStore((s) => s.phase)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (phase !== 'desktop') return
    if (window.sessionStorage.getItem('xp-balloon-shown') === '1') return
    const show = setTimeout(() => {
      window.sessionStorage.setItem('xp-balloon-shown', '1')
      playSound('balloon')
      setVisible(true)
    }, 25_000)
    return () => clearTimeout(show)
  }, [phase])

  useEffect(() => {
    if (!visible) return
    const hide = setTimeout(() => setVisible(false), 8_000)
    return () => clearTimeout(hide)
  }, [visible])

  if (!visible) return null
  return (
    <div
      role="status"
      style={{ position: 'absolute', right: 96, bottom: 40, zIndex: 14000, maxWidth: 240, background: '#ffffe1', border: '1px solid #000', borderRadius: 6, padding: '8px 10px', fontFamily: 'Tahoma, sans-serif', fontSize: 11, boxShadow: '2px 2px 6px rgba(0,0,0,.3)' }}
    >
      <button
        type="button"
        aria-label="Close balloon"
        onClick={() => setVisible(false)}
        style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}
      >
        ✕
      </button>
      <strong style={{ display: 'block', marginBottom: 3 }}>ℹ️ Portfolio is up to date</strong>
      Click the paperclip&apos;s buttons to hire the owner.
    </div>
  )
}
