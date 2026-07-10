'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Pause-screen state for the museum. Opens when the visitor leaves pointer
 * lock (the browser's Esc) or right-clicks; closes by the same means (Esc /
 * right-click — backdrop click is wired by the caller). Entering a lab also
 * drops pointer lock, so callers flag navigation via `suppressRef` to keep
 * the pause screen from flashing during the route change.
 */
export function usePause(suppressRef: RefObject<boolean>) {
  const [paused, setPaused] = useState(false)
  const wasLocked = useRef(false)

  const open = useCallback(() => setPaused(true), [])
  const close = useCallback(() => setPaused(false), [])

  // Esc closes while open — capture + preventDefault per the project's
  // Esc discipline (GalleryChrome-style bubble listeners must not also fire).
  useEffect(() => {
    if (!paused) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setPaused(false)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [paused])

  // Losing pointer lock (browser-native Esc while walking) opens the pause.
  useEffect(() => {
    const onLockChange = () => {
      const locked = document.pointerLockElement != null
      if (!locked && wasLocked.current && !suppressRef.current) setPaused(true)
      wasLocked.current = locked
    }
    document.addEventListener('pointerlockchange', onLockChange)
    return () => document.removeEventListener('pointerlockchange', onLockChange)
  }, [suppressRef])

  // Right-click: exit the walk into pause, or toggle the pause when idle.
  // Opening (not toggling) in the locked branch avoids a race with the
  // pointerlockchange handler above, which also opens.
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      if (document.pointerLockElement != null) {
        document.exitPointerLock()
        setPaused(true)
        return
      }
      setPaused((p) => !p)
    }
    window.addEventListener('contextmenu', onContextMenu)
    return () => window.removeEventListener('contextmenu', onContextMenu)
  }, [])

  return { paused, open, close }
}
