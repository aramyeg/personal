import { useEffect, useRef } from 'react'

export const FIXED_DT = 1 / 120

/** Never advance more than this much sim time in one frame (anti-spiral). */
const MAX_ACCUMULATOR = 0.25

type GameLoopOptions = {
  step: (dt: number) => void
  render: () => void
  paused: boolean
  onHidden?: () => void
}

export function useGameLoop(opts: GameLoopOptions): void {
  // Latest opts live in a ref so the effect attaches once and the rAF loop
  // never restarts mid-game when props change.
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    let accumulator = 0
    let wasPaused = optsRef.current.paused

    const tick = (now: number): void => {
      const current = optsRef.current
      const elapsed = (now - last) / 1000
      last = now

      if (current.paused) {
        // Hold the accumulator empty so unpausing never catches up.
        accumulator = 0
        wasPaused = true
      } else {
        if (wasPaused) accumulator = 0
        wasPaused = false
        accumulator = Math.min(accumulator + elapsed, MAX_ACCUMULATOR)
        while (accumulator >= FIXED_DT) {
          current.step(FIXED_DT)
          accumulator -= FIXED_DT
        }
      }

      current.render()
      frame = requestAnimationFrame(tick)
    }

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        optsRef.current.onHidden?.()
      } else {
        // Reset the clock so time spent hidden isn't replayed on return.
        last = performance.now()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
}
