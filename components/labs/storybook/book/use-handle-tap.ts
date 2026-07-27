'use client'

/**
 * The tap detector every handle family shares (see handle-nudge.ts for WHY a
 * tap must answer at all). A press that never moves the piece's drive value
 * materially is a tap; on release it fires the nudge pulse instead of leaving
 * the reader with silence.
 *
 * Kept as a three-call hook rather than nine copies of the same ref because
 * the families' grab records are all different shapes (a flap keeps an angle
 * offset, a tab keeps a strip draw, a disc keeps a last angle) and the ONE
 * thing they agree on is "did this press move anything".
 */

import { useRef } from 'react'
import { pulseHandle } from './handle-nudge'

export type HandleTap = {
  /** Call from onPointerDown, with the drive value the grab starts from. */
  begin: (seed: number) => void
  /** Call from onPointerMove with the drive value just written. Past `eps` of
   *  travel (in the family's own drive domain) the press is a drag, not a tap. */
  track: (value: number, eps: number) => void
  /**
   * Call from the release path. Fires the nudge pulse iff nothing moved — or,
   * when the family passes `onTap`, ITS OWN answer instead (S5R2-3: a two-faced
   * dial's obvious reply to a click is "show me the other face", and a twitch
   * where a real answer exists is the "clicking fires neither" finding).
   */
  end: (id: string, onTap?: () => void) => void
}

export function useHandleTap(): HandleTap {
  const seed = useRef<number | null>(null)
  const moved = useRef(false)

  return {
    begin: (value) => {
      seed.current = value
      moved.current = false
    },
    track: (value, eps) => {
      if (seed.current !== null && Math.abs(value - seed.current) > eps) moved.current = true
    },
    end: (id, onTap) => {
      const wasTap = seed.current !== null && !moved.current
      seed.current = null
      moved.current = false
      if (!wasTap) return
      if (onTap) onTap()
      else pulseHandle(id)
    },
  }
}
