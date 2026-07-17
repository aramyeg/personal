'use client'
import { createContext, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'

/**
 * The one shared 4-step clay toon ramp. Created once per canvas via
 * ToonRampProvider and disposed on unmount (Phase 1 review backlog: the
 * DataTexture used to leak on scene teardown).
 *
 * Four steps with a real shadow floor (96) give pinched-clay CREASE shadows —
 * the flat facets of the planet + water snap to one of four hard bands, so the
 * surface reads as hand-pushed claymation instead of a smooth soft blob, while
 * the pastel vertex colors still carry the hue (facets + bands, never gloom).
 * Shared by planet, water, every clay prop and the burst badge (the girl GLB
 * keeps its own materials).
 */
export function useToonRamp(): THREE.DataTexture {
  const ramp = useMemo(() => {
    const steps = new Uint8Array([96, 150, 205, 255])
    const data = new Uint8Array(steps.length * 4)
    steps.forEach((v, i) => data.set([v, v, v, 255], i * 4))
    const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat)
    tex.needsUpdate = true
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    return tex
  }, [])
  useEffect(() => () => ramp.dispose(), [ramp])
  return ramp
}

const RampContext = createContext<THREE.DataTexture | null>(null)

export function ToonRampProvider({ children }: { children: ReactNode }) {
  const ramp = useToonRamp()
  return <RampContext.Provider value={ramp}>{children}</RampContext.Provider>
}

export function useClayRamp(): THREE.DataTexture {
  const ramp = useContext(RampContext)
  if (!ramp) throw new Error('useClayRamp must be used inside ToonRampProvider')
  return ramp
}
