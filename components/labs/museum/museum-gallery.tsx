'use client'

import { useCallback, useMemo, useRef, useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { labs } from '@/lib/labs-manifest'
import { hallLength, paintingPlacements, PLAYER } from './layout'
import { Hall } from './hall'
import { Painting } from './painting'
import { FocusProbe } from './use-painting-focus'
import { PlayerControls, type MoveVec } from './player-controls'
import { MobileJoystick } from './mobile-joystick'

/**
 * The /labs museum: a first-person classical gallery.
 * Everything inside <Canvas> is three.js; overlay UI is plain DOM.
 */
export default function MuseumGallery() {
  const router = useRouter()
  const length = useMemo(() => hallLength(labs.length), [])
  const placements = useMemo(() => paintingPlacements(labs), [])
  const targets = useRef(new Map<string, THREE.Object3D>())
  const [focused, setFocused] = useState<string | null>(null)
  const focusedLab = labs.find((l) => l.slug === focused) ?? null
  const moveRef = useRef<MoveVec>({ x: 0, y: 0 })
  const [coarse, setCoarse] = useState(false)
  useEffect(() => setCoarse(window.matchMedia('(pointer: coarse)').matches), [])

  const register = useCallback((slug: string, obj: THREE.Object3D | null) => {
    if (obj) targets.current.set(slug, obj)
    else targets.current.delete(slug)
  }, [])

  const enterFocused = useCallback(() => {
    if (focused) router.push(`/labs/${focused}`)
  }, [focused, router])

  return (
    <div className="fixed inset-0 z-40 bg-black">
      {/* The 3D scene is decorative to assistive tech; the list view is the
          accessible alternative. The overlay links/buttons stay reachable. */}
      <Canvas
        aria-hidden="true"
        camera={{ fov: 62, near: 0.1, far: 80, position: [0, PLAYER.eyeHeight, -2] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onClick={enterFocused}
      >
        <ambientLight intensity={0.35} color="#fff3e0" />
        <Hall length={length} />
        <Suspense fallback={null}>
          {placements.map((p) => (
            <Painting key={p.slug} placement={p} focused={focused === p.slug} register={register} />
          ))}
        </Suspense>
        <FocusProbe targets={targets} onChange={setFocused} />
        <PlayerControls length={length} moveRef={moveRef} />
      </Canvas>

      {coarse && <MobileJoystick moveRef={moveRef} />}

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
        {coarse ? 'Joystick to walk · drag to look · tap art to enter' : 'Click to walk · WASD + mouse · Esc to release'}
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
