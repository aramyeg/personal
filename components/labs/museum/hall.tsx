'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { HALL } from './layout'
import { makeParquetTexture } from './textures'

/** The museum room: floor, walls, ceiling, dressing. */
export function Hall({ length }: { length: number }) {
  const parquet = useMemo(() => {
    const t = makeParquetTexture()
    t.repeat.set(HALL.width / 2.5, length / 2.5)
    return t
  }, [length])

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -length / 2]}>
        <planeGeometry args={[HALL.width, length]} />
        <meshStandardMaterial map={parquet} roughness={0.55} />
      </mesh>
      <mesh position={[0, HALL.height / 2, -length / 2]}>
        <boxGeometry args={[HALL.width, HALL.height, length]} />
        <meshStandardMaterial color="#5a2028" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}
