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
 */
export function LoadSignal({
  onChange,
}: {
  onChange: (progress: number, ready: boolean) => void
}) {
  const { active, progress } = useProgress()

  useEffect(() => {
    onChange(progress, false)
    if (active) return
    const t = setTimeout(() => onChange(progress, true), 300)
    return () => clearTimeout(t)
  }, [active, progress, onChange])

  return null
}
