'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Canvas } from '@react-three/fiber'
import { labs } from '@/lib/labs-manifest'
import { hallLength, PLAYER } from './layout'
import { Hall } from './hall'

/**
 * The /labs museum: a first-person classical gallery.
 * Everything inside <Canvas> is three.js; overlay UI is plain DOM.
 */
export default function MuseumGallery() {
  const length = useMemo(() => hallLength(labs.length), [])
  const [focused, setFocused] = useState<string | null>(null)
  const focusedLab = labs.find((l) => l.slug === focused) ?? null

  return (
    <div className="fixed inset-0 z-40 bg-black">
      {/* The 3D scene is decorative to assistive tech; the list view is the
          accessible alternative. The overlay links/buttons stay reachable. */}
      <Canvas
        aria-hidden="true"
        camera={{ fov: 62, near: 0.1, far: 80, position: [0, PLAYER.eyeHeight, -2] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.35} color="#fff3e0" />
        <Hall length={length} />
      </Canvas>

      {/* Crosshair */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />

      {/* Focused painting hint */}
      {focusedLab && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white">
          Click to enter — {focusedLab.title}
        </div>
      )}

      {/* Controls hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-widest text-white/50">
        Click to walk · WASD + mouse · Esc to release
      </div>

      {/* Escape hatch to the list */}
      <Link
        href="/labs?view=list"
        className="absolute top-4 right-4 rounded-full bg-black/50 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white"
      >
        List view
      </Link>
    </div>
  )
}
