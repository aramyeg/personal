'use client'
import { useEffect, useMemo, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PSX } from './psx-constants'
import { makeCarpetTexture, makePlywoodTexture, makeWallTexture } from './textures'
import { makePSXMaterial } from './psx-materials'

/**
 * GATE-A proof subject (temporary — removed once real scene content lands): a
 * placeholder box room whose only job is to make the pipeline's artifacts
 * legible — affine warp on the floor and the spinning cube, vertex-snap wobble
 * on the moving cube, Lambert-only shading under the neutral-key/teal-shadow
 * light pair. It uses nothing but the landed neutral textures + materials.
 */
export function ProofScene({ cubeRef }: { cubeRef: RefObject<THREE.Mesh | null> }) {
  const camera = useThree((s) => s.camera)

  const { materials, textures } = useMemo(() => {
    const carpet = makeCarpetTexture()
    carpet.repeat.set(6, 6)
    const wall = makeWallTexture()
    wall.repeat.set(4, 2)
    const desk = makePlywoodTexture()
    desk.repeat.set(2, 1)
    const cube = makePlywoodTexture()

    const materials = {
      floor: makePSXMaterial({ map: carpet }),
      wall: makePSXMaterial({ map: wall }),
      desk: makePSXMaterial({ map: desk }),
      cube: makePSXMaterial({ map: cube }),
    }
    return { materials, textures: [carpet, wall, desk, cube] }
  }, [])

  // Fixed framing (PS1 rooms used fixed cameras): tilt down so the floor sits at
  // the grazing angle where affine texture warp is most obvious.
  useEffect(() => {
    camera.position.set(0, 3.4, 6.5)
    camera.lookAt(0, 1.4, -2)
  }, [camera])

  useEffect(
    () => () => {
      textures.forEach((t) => t.dispose())
      Object.values(materials).forEach((m) => m.dispose())
    },
    [materials, textures],
  )

  return (
    <>
      {/* Neutral key + teal-leaning ambient shadow, from the single tuning surface. */}
      <directionalLight color={PSX.LIGHTS.key} intensity={PSX.LIGHTS.keyIntensity} position={[5, 9, 4]} />
      <ambientLight color={PSX.LIGHTS.ambient} intensity={PSX.LIGHTS.ambientIntensity} />

      <mesh material={materials.floor} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[18, 16]} />
      </mesh>
      <mesh material={materials.wall} position={[0, 3, -7]}>
        <planeGeometry args={[18, 6]} />
      </mesh>
      <mesh material={materials.wall} position={[-9, 3, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[14, 6]} />
      </mesh>
      <mesh material={materials.wall} position={[9, 3, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[14, 6]} />
      </mesh>
      <mesh material={materials.desk} position={[0, 1, -2]}>
        <boxGeometry args={[4.5, 0.35, 2.2]} />
      </mesh>
      <mesh ref={cubeRef} material={materials.cube} position={[0, 2, -2]}>
        <boxGeometry args={[1.7, 1.7, 1.7]} />
      </mesh>
    </>
  )
}
