'use client'

import { useCallback, useMemo, useRef, useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { hallLabs, labs } from '@/lib/labs-manifest'
import { hallLength, paintingPlacements, PLAYER } from './layout'
import { Hall } from './hall'
import { Painting, PaintingBoundary } from './painting'
import { DrapedFrame } from './draped-frame'
import { AtticRoom } from './attic-room'
import { FocusProbe } from './use-painting-focus'
import { PlayerControls, type MoveVec } from './player-controls'
import { MobileJoystick } from './mobile-joystick'
import { LoadSignal } from './load-signal'
import { FocusCard } from './focus-card'
import { VisitorGuide } from './visitor-guide'
import { usePause } from './use-pause'

/**
 * The /labs museum: a first-person classical gallery.
 * Everything inside <Canvas> is three.js; overlay UI is plain DOM.
 */
export default function MuseumGallery({
  onLoadChange,
}: {
  onLoadChange?: (progress: number, ready: boolean) => void
}) {
  const router = useRouter()
  const length = useMemo(() => hallLength(hallLabs.length), [])
  const placements = useMemo(() => paintingPlacements(hallLabs), [])
  const targets = useRef(new Map<string, THREE.Object3D>())
  const [focused, setFocused] = useState<string | null>(null)
  const focusedLab = labs.find((l) => l.slug === focused) ?? null
  const moveRef = useRef<MoveVec>({ x: 0, y: 0 })
  const [coarse, setCoarse] = useState(false)
  useEffect(() => setCoarse(window.matchMedia('(pointer: coarse)').matches), [])

  const navigatingRef = useRef(false)
  const { paused, open: openPause, close: closePause } = usePause(navigatingRef)

  const register = useCallback((slug: string, obj: THREE.Object3D | null) => {
    if (obj) targets.current.set(slug, obj)
    else targets.current.delete(slug)
  }, [])

  const enterFocused = useCallback(() => {
    if (!focused) return
    navigatingRef.current = true
    const lab = labs.find((l) => l.slug === focused)
    router.push(lab?.href ?? `/labs/${focused}`)
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
            <PaintingBoundary key={p.slug}>
              <Painting placement={p} focused={focused === p.slug} register={register} />
            </PaintingBoundary>
          ))}
        </Suspense>
        <DrapedFrame labCount={hallLabs.length} />
        <AtticRoom hallLen={length} register={register} focused={focused} />
        <FocusProbe targets={targets} onChange={setFocused} />
        <PlayerControls length={length} moveRef={moveRef} />
        {onLoadChange && <LoadSignal onChange={onLoadChange} />}
      </Canvas>

      {coarse && <MobileJoystick moveRef={moveRef} />}

      {/* Crosshair */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />

      {/* Lean-in preview of the focused painting */}
      {focusedLab && <FocusCard lab={focusedLab} />}

      {/* Controls hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-widest text-white/50">
        {coarse ? 'Joystick to walk · drag to look · center art, tap to enter' : 'Click to walk · WASD + mouse · Shift to run · Space to jump · Esc to release'}
      </div>

      {/* Escape hatch to the list */}
      <Link
        href="/?view=list"
        className="absolute top-4 right-4 rounded-full bg-black/50 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white"
      >
        List view
      </Link>

      <button
        type="button"
        onClick={openPause}
        aria-label="Show controls guide"
        className="absolute top-4 right-32 rounded-full bg-black/50 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white"
      >
        ?
      </button>

      {paused && (
        <div
          className="absolute inset-0 z-10 grid place-items-center bg-black/60"
          onClick={closePause}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-md border border-[#d6b968]/45 bg-[#16090d]/95 px-10 py-8 shadow-2xl backdrop-blur-sm"
          >
            <VisitorGuide />
            <p className="mt-6 border-t border-[#d6b968]/30 pt-4 text-center font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-[#f0d998]">
              Right-click or Esc to resume &middot; then click to walk
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
