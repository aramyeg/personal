import { useEffect, useRef } from 'react'

export function useIdle(ms: number, onIdle: () => void, enabled: boolean) {
  const cb = useRef(onIdle)
  cb.current = onIdle

  useEffect(() => {
    if (!enabled) return
    let t = setTimeout(() => cb.current(), ms)
    const reset = () => {
      clearTimeout(t)
      t = setTimeout(() => cb.current(), ms)
    }
    const events = ['pointermove', 'pointerdown', 'keydown'] as const
    events.forEach((e) => window.addEventListener(e, reset))
    return () => {
      clearTimeout(t)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [ms, enabled])
}
