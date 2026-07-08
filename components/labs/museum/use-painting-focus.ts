'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const FOCUS_RANGE = 6

/**
 * Raycasts from the camera center toward whatever the visitor faces.
 * Calls onChange with the focused painting slug (or null). Runs every
 * 6th frame — focus doesn't need 60hz.
 */
export function FocusProbe({
  targets,
  onChange,
}: {
  targets: React.RefObject<Map<string, THREE.Object3D>>
  onChange: (slug: string | null) => void
}) {
  const { camera } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  const dir = useRef(new THREE.Vector3())
  const frame = useRef(0)
  const last = useRef<string | null>(null)

  useFrame(() => {
    frame.current = (frame.current + 1) % 6
    if (frame.current !== 0) return
    const map = targets.current
    if (!map || map.size === 0) return

    camera.getWorldDirection(dir.current)
    raycaster.current.set(camera.position, dir.current)
    raycaster.current.far = FOCUS_RANGE

    let found: string | null = null
    let nearest = Infinity
    for (const [slug, obj] of map) {
      const hits = raycaster.current.intersectObject(obj, true)
      if (hits.length > 0 && hits[0].distance < nearest) {
        nearest = hits[0].distance
        found = slug
      }
    }
    if (found !== last.current) {
      last.current = found
      onChange(found)
    }
  })

  return null
}
