'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useXpStore } from './store'
import { openApp } from './apps'
import styles from './xp.module.css'

type Bubble = 'hire' | 'tip' | null

function PaperclipSvg() {
  return (
    <svg width="64" height="80" viewBox="0 0 64 80" aria-hidden>
      <path
        d="M22 66 V22 a10 10 0 0 1 20 0 v36 a6 6 0 0 1 -12 0 V26"
        fill="none" stroke="#8a8a8a" strokeWidth="6" strokeLinecap="round"
      />
      <circle cx="27" cy="18" r="5" fill="#fff" stroke="#333" strokeWidth="1.5" />
      <circle cx="41" cy="18" r="5" fill="#fff" stroke="#333" strokeWidth="1.5" />
      <circle cx="28" cy="19" r="2" fill="#111">
        <animate attributeName="r" values="2;2;0.3;2" keyTimes="0;0.9;0.95;1" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx="42" cy="19" r="2" fill="#111">
        <animate attributeName="r" values="2;2;0.3;2" keyTimes="0;0.9;0.95;1" dur="4s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

export function Clippy() {
  const phase = useXpStore((s) => s.phase)
  const dismissed = useXpStore((s) => s.clippyDismissed)
  const [bubble, setBubble] = useState<Bubble>(null)
  const [tipCount, setTipCount] = useState(0)

  useEffect(() => {
    if (window.sessionStorage.getItem('xp-clippy-dismissed') === '1') {
      useXpStore.getState().dismissClippy()
    }
  }, [])

  useEffect(() => {
    if (phase !== 'desktop' || dismissed || bubble !== null || tipCount >= 2) return
    const t = setTimeout(
      () => setBubble(tipCount === 0 ? 'hire' : 'tip'),
      tipCount === 0 ? 10_000 : 45_000
    )
    return () => clearTimeout(t)
  }, [phase, dismissed, bubble, tipCount])

  if (phase !== 'desktop' || dismissed) return null

  const dismiss = () => {
    window.sessionStorage.setItem('xp-clippy-dismissed', '1')
    useXpStore.getState().dismissClippy()
  }
  const closeBubble = () => {
    setBubble(null)
    setTipCount((c) => c + 1)
  }
  const action = (fn: () => void) => () => {
    fn()
    closeBubble()
  }

  return (
    <div style={{ position: 'absolute', right: 24, bottom: 50, zIndex: 15000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      {bubble === 'hire' && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          style={{ maxWidth: 230, background: '#ffffcc', border: '1px solid #000', borderRadius: 8, padding: 10, fontSize: 11, fontFamily: 'Tahoma, sans-serif', boxShadow: '2px 2px 6px rgba(0,0,0,.3)' }}
        >
          <p style={{ margin: '0 0 8px' }}>
            It looks like you&apos;re trying to hire a frontend engineer. Would you like help?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button type="button" className={styles.bevelBtn} onClick={action(() => openApp('my-projects'))}>Show me the projects</button>
            <button type="button" className={styles.bevelBtn} onClick={action(() => openApp('resume'))}>Show me the CV</button>
            <button type="button" className={styles.bevelBtn} onClick={dismiss} aria-label="Don't show tips">✕ Don&apos;t show tips</button>
          </div>
        </motion.div>
      )}
      {bubble === 'tip' && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          style={{ maxWidth: 230, background: '#ffffcc', border: '1px solid #000', borderRadius: 8, padding: 10, fontSize: 11, fontFamily: 'Tahoma, sans-serif', boxShadow: '2px 2px 6px rgba(0,0,0,.3)' }}
        >
          <p style={{ margin: '0 0 8px' }}>Psst — the Recycle Bin has history in it.</p>
          <button type="button" className={styles.bevelBtn} onClick={closeBubble}>OK</button>
        </motion.div>
      )}
      <motion.div
        initial={{ y: 120 }}
        animate={{ y: 0 }}
        transition={{ delay: 9.5, type: 'spring', stiffness: 120 }}
      >
        <PaperclipSvg />
      </motion.div>
    </div>
  )
}
