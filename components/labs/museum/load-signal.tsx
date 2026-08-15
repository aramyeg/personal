'use client'

import { useEffect } from 'react'
import { useProgress } from '@react-three/drei'

/**
 * Bridges three's DefaultLoadingManager (which drei's useTexture feeds) to
 * the DOM curtain. `ready` fires after the manager has been idle for 300ms —
 * covering both the normal case (posters finish at 100) and the warm-cache
 * case where no load ever starts (`active` never flips true, progress stays 0).
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
