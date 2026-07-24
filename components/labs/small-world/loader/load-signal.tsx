'use client'

import { useEffect } from 'react'
import { useProgress } from '@react-three/drei'

/**
 * Bridges three's DefaultLoadingManager (which the scene's useGLTF girl feeds)
 * to the DOM planet loader. `ready` fires after the manager has been idle for
 * 300ms — covering both the normal case (the GLB finishes at 100) and the
 * warm-cache case where the asset is already cached so no load ever starts
 * (`active` never flips true, progress stays 0). Mirrors the museum curtain's
 * LoadSignal; lives inside the Canvas so it mounts with the scene chunk.
 *
 * Task 47 — the land TERRAIN bake now runs in a Web Worker, so the scene is not truly
 * ready until the first bake has been applied (otherwise the loader would reveal an empty
 * planet). `bakeReady` (raised by Planet's first applied bake, plumbed through scene.tsx) is
 * ANDed into the ready condition alongside the GLB manager going idle.
 */
export function LoadSignal({
  onChange,
  bakeReady = true,
}: {
  onChange: (progress: number, ready: boolean) => void
  bakeReady?: boolean
}) {
  const { active, progress } = useProgress()

  useEffect(() => {
    onChange(progress, false)
    if (active || !bakeReady) return
    const t = setTimeout(() => onChange(progress, true), 300)
    return () => clearTimeout(t)
  }, [active, progress, onChange, bakeReady])

  return null
}
