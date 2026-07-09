'use client'
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PSXCanvas } from '@/components/labs/ps1/scene/psx-pipeline'
import { Room } from '@/components/labs/ps1/scene/room'
import { ANGLES, ANGLE_ORDER, type AngleId } from '@/components/labs/ps1/scene/cameras'

/** Places the fixed camera for the requested angle (per cameras.ts). The PSX
 * compositor keeps the aspect pinned to 384×216 each frame; we own position,
 * target and fov. */
function CameraRig({ angle }: { angle: AngleId }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    const a = ANGLES[angle]
    camera.position.set(...a.position)
    camera.up.set(0, 1, 0)
    camera.lookAt(...a.lookAt)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = a.fov
      camera.updateProjectionMatrix()
    }
  }, [camera, angle])
  return null
}

/**
 * GATE-B page (removed in Task 12): mounts the real dev room in the PSX
 * pipeline, full-viewport, no chrome. `?angle=room|desk|shelf|tv` places the
 * camera at that fixed diorama shot for the gate screenshots (default room).
 */
export default function PS1ProofPage() {
  const angle = useMemo<AngleId>(() => {
    if (typeof window === 'undefined') return 'room'
    const p = new URLSearchParams(window.location.search).get('angle') ?? ''
    return (ANGLE_ORDER as string[]).includes(p) ? (p as AngleId) : 'room'
  }, [])

  return (
    <main className="fixed inset-0 bg-black">
      <PSXCanvas>
        <CameraRig angle={angle} />
        <Room staticFrame />
      </PSXCanvas>
    </main>
  )
}
