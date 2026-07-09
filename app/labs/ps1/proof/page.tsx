'use client'
import { useRef } from 'react'
import * as THREE from 'three'
import { PSXCanvas } from '@/components/labs/ps1/scene/psx-pipeline'
import { ProofScene } from '@/components/labs/ps1/scene/proof-scene'
import { PSX } from '@/components/labs/ps1/scene/psx-constants'

/**
 * Temporary GATE-A page (removed in a later task): mounts the proof room in the
 * PSX pipeline, full-viewport, no chrome. onFrame spins the cube — exercising
 * the pipeline's per-frame hook — on both axes so the warp/wobble reads clearly.
 */
export default function PS1ProofPage() {
  const cube = useRef<THREE.Mesh>(null)

  return (
    <main className="fixed inset-0 bg-black">
      <PSXCanvas
        onFrame={(t) => {
          const mesh = cube.current
          if (!mesh) return
          mesh.rotation.y = t * PSX.PROOF_CUBE_SPIN
          mesh.rotation.x = t * PSX.PROOF_CUBE_SPIN * 0.5
        }}
      >
        <ProofScene cubeRef={cube} />
      </PSXCanvas>
    </main>
  )
}
