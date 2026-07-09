'use client'

import { useEffect, useRef, useState } from 'react'
import { useXpStore } from './store'
import { playSound } from './sounds'
import styles from './xp.module.css'

const ERROR_MESSAGES = [
  'free_ringtones.exe has encountered a problem and needs to close. We are sorry for the inconvenience.',
  'Catastrophic failure (0x8000FFFF).',
  'The instruction at 0x0000BEEF referenced memory at 0x00000000. The memory could not be "read".',
  'Not enough ringtones. Please insert 3 more ringtones and press OK.',
  'A required .dll (vibes.dll) was not found.',
  'Windows has detected that your computer now belongs to free_ringtones.exe.',
  'Error: the error dialog responsible for showing this error has crashed.',
  'Buffer overflow in NOSTALGIA.SYS.',
]

export function ChaosLayer() {
  const chaos = useXpStore((s) => s.chaos)
  const dialogs = useXpStore((s) => s.chaosDialogs)
  const [rebooting, setRebooting] = useState(false)
  const rebootingRef = useRef(false)

  useEffect(() => {
    if (chaos !== 'bsod') return
    let timeoutId: NodeJS.Timeout | undefined
    const reboot = (e: Event) => {
      if (rebootingRef.current) return
      rebootingRef.current = true
      e.preventDefault()
      setRebooting(true)
      timeoutId = setTimeout(() => {
        setRebooting(false)
        useXpStore.getState().rebootFromBsod()
      }, 900)
    }
    window.addEventListener('keydown', reboot, { capture: true })
    window.addEventListener('pointerdown', reboot, { capture: true })
    return () => {
      window.removeEventListener('keydown', reboot, { capture: true })
      window.removeEventListener('pointerdown', reboot, { capture: true })
      if (timeoutId) clearTimeout(timeoutId)
      rebootingRef.current = false
    }
  }, [chaos])

  if (chaos === 'idle') return null

  if (chaos === 'bsod') {
    return (
      <div data-testid="bsod" style={{ position: 'fixed', inset: 0, zIndex: 40000, background: '#0827a2', color: '#fff', fontFamily: '"Lucida Console", monospace', fontSize: 13, padding: '10% 12%', lineHeight: 1.7 }}>
        {rebooting ? (
          <p>Rebooting…</p>
        ) : (
          <>
            <p>A problem has been detected and Windows has been shut down to prevent damage to your computer.</p>
            <p style={{ margin: '16px 0' }}>FREE_RINGTONES_OVERDOSE</p>
            <p>Technical information:</p>
            <p>*** STOP: 0x000000FE (0xBADA55, 0xC0FFEE, 0x000000, 0x2001)</p>
            <p style={{ marginTop: 24 }}>Press any key to restart your desktop. Your windows will survive. Probably.</p>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {dialogs.map((seed) => (
        <div
          key={seed}
          role="alertdialog"
          className={styles.dialog}
          style={{ left: 120 + ((seed * 47) % 320), top: 80 + ((seed * 31) % 240), zIndex: 25000 + seed }}
        >
          <header className={styles.titleBar}>
            <span className={styles.titleText}>free_ringtones.exe</span>
          </header>
          <div style={{ display: 'flex', gap: 12, padding: 14, alignItems: 'center', maxWidth: 340, fontSize: 11 }}>
            <span style={{ fontSize: 28 }} aria-hidden>❌</span>
            <p style={{ margin: 0 }}>{ERROR_MESSAGES[seed % ERROR_MESSAGES.length]}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
            <button
              type="button"
              className={styles.bevelBtn}
              onClick={() => {
                playSound('error')
                useXpStore.getState().closeChaosDialog(seed)
              }}
            >
              OK
            </button>
          </div>
        </div>
      ))}
    </>
  )
}
