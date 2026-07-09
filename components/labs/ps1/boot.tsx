'use client'

import { useEffect, useRef } from 'react'

/**
 * The boot flash: a pure DOM/CSS overlay that evokes a PSX power-on without any
 * Sony mark, font, or logo. Runs black → a brief dithered flash → an `AY-01`
 * bitmap-style title card in ≤1.5s, then calls `onDone`. Any input (key, click,
 * touch) skips it immediately. Nothing here renders three.js — it sits on top of
 * the scene and unmounts cleanly (timer + listeners torn down) once done.
 */

const TOTAL_MS = 1500

export function Boot({ onDone }: { onDone: () => void }) {
  // Guard so the timer and every input path resolve exactly once.
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      onDoneRef.current()
    }

    const timer = window.setTimeout(finish, TOTAL_MS)

    // Any keypress skips. Capture-phase + consume so the same Escape that skips
    // the boot does not also bubble to GalleryChrome and navigate away.
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      finish()
    }
    window.addEventListener('keydown', onKey, true)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [])

  const skip = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDoneRef.current()
  }

  return (
    <div
      role="presentation"
      onPointerDown={skip}
      onTouchStart={skip}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      style={{ cursor: 'pointer' }}
    >
      <style>{`
        @keyframes ay01-flash {
          0%, 24% { opacity: 0 }
          30% { opacity: 0.85 }
          44% { opacity: 0 }
          100% { opacity: 0 }
        }
        @keyframes ay01-title {
          0%, 42% { opacity: 0; transform: translateY(2px) }
          52% { opacity: 1; transform: translateY(0) }
          92% { opacity: 1; transform: translateY(0) }
          100% { opacity: 0.85; transform: translateY(0) }
        }
      `}</style>

      {/* Dithered flash: a locked 3px checker that blinks once, PSX grain with
          no logo. image-rendering pins it to hard pixels. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            'repeating-conic-gradient(#2b3d3a 0% 25%, #0b1413 0% 50%)',
          backgroundSize: '3px 3px',
          imageRendering: 'pixelated',
          animation: 'ay01-flash 1.5s steps(24) forwards',
        }}
      />

      {/* AY-01 title card — bitmap-style DOM text (blocky monospace, hard pixel
          glow), the boot handle the rest of the shell also badges. */}
      <div
        className="relative select-none"
        style={{
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: 'clamp(2.2rem, 9vw, 5rem)',
          letterSpacing: '0.22em',
          color: '#e8f6f4',
          textShadow: '0 0 2px #7de8e0, 0 0 12px rgba(125,232,224,0.4)',
          animation: 'ay01-title 1.5s steps(20) forwards',
        }}
      >
        AY-01
      </div>
    </div>
  )
}
