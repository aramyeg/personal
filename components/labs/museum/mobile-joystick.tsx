'use client'

import { useRef, type RefObject } from 'react'
import type { MoveVec } from './player-controls'

const RADIUS = 48

/** Thumb joystick for touch devices; writes into moveRef, renders a nub. */
export function MobileJoystick({ moveRef }: { moveRef: RefObject<MoveVec> }) {
  const baseRef = useRef<HTMLDivElement>(null)
  const nubRef = useRef<HTMLDivElement>(null)

  const setVec = (clientX: number, clientY: number) => {
    const base = baseRef.current!
    const r = base.getBoundingClientRect()
    let dx = clientX - (r.left + r.width / 2)
    let dy = clientY - (r.top + r.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len }
    nubRef.current!.style.transform = `translate(${dx}px, ${dy}px)`
    moveRef.current = { x: dx / RADIUS, y: -dy / RADIUS }
  }
  const reset = () => {
    nubRef.current!.style.transform = 'translate(0, 0)'
    moveRef.current = { x: 0, y: 0 }
  }

  return (
    <div
      ref={baseRef}
      className="absolute bottom-8 left-8 z-50 h-28 w-28 touch-none rounded-full border border-white/25 bg-white/5"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setVec(e.clientX, e.clientY) }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) setVec(e.clientX, e.clientY) }}
      onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); reset() }}
      onPointerCancel={reset}
    >
      <div
        ref={nubRef}
        className="absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white/30"
      />
    </div>
  )
}
