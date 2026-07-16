'use client'
import { createContext, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'

/**
 * The one shared 3-step clay toon ramp. Created once per canvas via
 * ToonRampProvider and disposed on unmount (Phase 1 review backlog: the
 * DataTexture used to leak on scene teardown).
 */
export function useToonRamp(): THREE.DataTexture {
  const ramp = useMemo(() => {
    const steps = new Uint8Array([140, 200, 255])
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
