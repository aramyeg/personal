'use client'

/**
 * Client shell: WebGL/reduced-motion detection, dynamic scene import so the
 * museum pays nothing for three, and the static fallback banner.
 */

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const ClothPullScene = dynamic(
  () => import('./scene').then((m) => m.ClothPullScene),
  { ssr: false }
)

function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(
      c.getContext('webgl2') ?? c.getContext('webgl')
    )
  } catch {
    return false
  }
}

/** Static cream banner with the message — the no-WebGL / no-JS floor. */
export function StaticBanner({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#F7EFE1]">
      <div
        className="mx-6 max-w-3xl border-4 border-[#baa482] bg-gradient-to-b from-[#FFFDF6] to-[#F1E7D0] px-12 py-14 text-center shadow-[0_24px_60px_rgba(92,74,51,0.25)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        <p className="text-4xl font-bold text-[#2A211A] md:text-6xl">
          {message}
        </p>
      </div>
    </div>
  )
}

export function ClothPullLoader({ message }: { message: string }) {
  const [state, setState] = useState<'probing' | 'webgl' | 'fallback'>(
    'probing'
  )
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
    setState(supportsWebGL() ? 'webgl' : 'fallback')
  }, [])

  if (state !== 'webgl') {
    return (
      <div className="h-full w-full" aria-hidden="true">
        {state === 'fallback' ? <StaticBanner message={message} /> : null}
      </div>
    )
  }

  return (
    <div
      className="h-full w-full"
      role="img"
      aria-label={`A chibi character hauls a cloth banner along a rope. The banner reads: ${message}. Drag horizontally or use the arrow keys to pull the rope.`}
    >
      <ClothPullScene message={message} reduced={reduced} />
    </div>
  )
}
