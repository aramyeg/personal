'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { HALL, STAIR } from './layout'
import { makeParquetTexture, makeWallTexture, makePlacardTexture } from './textures'

const GOLD = '#b08d3f'
const MARBLE = '#d8d3c8'
const WOOD = '#4a3120'

/** One wall as fabric panel + marble baseboard + gilt crown strip. */
function Wall({
  width,
  position,
  rotationY,
  fabric,
}: {
  width: number
  position: [number, number, number]
  rotationY: number
  fabric: THREE.Texture
}) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, HALL.height / 2, 0]}>
        <planeGeometry args={[width, HALL.height]} />
        <meshStandardMaterial map={fabric} roughness={0.9} />
      </mesh>
      {/* marble baseboard */}
      <mesh position={[0, 0.3, 0.06]}>
        <boxGeometry args={[width, 0.6, 0.12]} />
        <meshStandardMaterial color={MARBLE} roughness={0.35} />
      </mesh>
      {/* gilt crown strip */}
      <mesh position={[0, HALL.height - 0.25, 0.05]}>
        <boxGeometry args={[width, 0.18, 0.1]} />
        <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  )
}

function Bench({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[2, 0.12, 0.6]} />
        <meshStandardMaterial color={WOOD} roughness={0.6} />
      </mesh>
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.18, 0]}>
          <boxGeometry args={[0.12, 0.36, 0.5]} />
          <meshStandardMaterial color={WOOD} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/** Two stanchion posts joined by a sagging velvet rope. */
function Stanchions({ z }: { z: number }) {
  const rope = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-1.1, 0.85, 0),
      new THREE.Vector3(0, 0.55, 0),
      new THREE.Vector3(1.1, 0.85, 0)
    )
    return new THREE.TubeGeometry(curve, 16, 0.035, 6)
  }, [])
  return (
    <group position={[0, 0, z]}>
      {[-1.1, 1.1].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.9, 10]} />
            <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.16, 0.18, 0.05, 12]} />
            <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.92, 0]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <mesh geometry={rope}>
        <meshStandardMaterial color="#7a1f2b" roughness={0.85} />
      </mesh>
    </group>
  )
}

/** End wall split around the attic doorway, with a lintel and a small sign. */
function EndWall({ length, fabric }: { length: number; fabric: THREE.Texture }) {
  const doorLeft = STAIR.doorX - STAIR.doorWidth / 2
  const doorRight = STAIR.doorX + STAIR.doorWidth / 2
  const leftW = doorLeft - -(HALL.width / 2)
  const rightW = HALL.width / 2 - doorRight
  const sign = useMemo(() => makePlacardTexture('attic', '', ''), [])
  return (
    <group position={[0, 0, -length]}>
      <Wall
        width={leftW}
        position={[-(HALL.width / 2) + leftW / 2 - 0, 0, 0]}
        rotationY={0}
        fabric={fabric}
      />
      <Wall width={rightW} position={[doorRight + rightW / 2, 0, 0]} rotationY={0} fabric={fabric} />
      {/* Lintel above the door opening */}
      <mesh position={[STAIR.doorX, STAIR.doorHeight + (HALL.height - STAIR.doorHeight) / 2, 0]}>
        <planeGeometry args={[STAIR.doorWidth, HALL.height - STAIR.doorHeight]} />
        <meshStandardMaterial map={fabric} roughness={0.9} />
      </mesh>
      {/* The stair shaft's own lit interior shows through the opening (the
          old dark reveal plane masked it — the doorway read as a void). */}
      {/* Small lowercase sign above the lintel */}
      <mesh position={[STAIR.doorX, STAIR.doorHeight + 0.35, 0.02]}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshStandardMaterial map={sign} roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  )
}

/** The museum room: floor, walls, coved ceiling with skylight, dressing. */
export function Hall({ length }: { length: number }) {
  const parquet = useMemo(() => {
    const t = makeParquetTexture()
    t.repeat.set(HALL.width / 2.5, length / 2.5)
    return t
  }, [length])
  const fabric = useMemo(() => {
    const t = makeWallTexture()
    t.repeat.set(6, 3)
    return t
  }, [])

  const midZ = -length / 2
  // one warm light pool every ~6m down the center line
  const lightZs = useMemo(() => {
    const zs: number[] = []
    for (let z = -4; z > -length + 3; z -= 6) zs.push(z)
    return zs
  }, [length])

  return (
    <group>
      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, midZ]}>
        <planeGeometry args={[HALL.width, length]} />
        <meshStandardMaterial map={parquet} roughness={0.5} />
      </mesh>

      {/* Ceiling: two coved side panels + glowing skylight band */}
      <mesh rotation-x={Math.PI / 2} position={[-HALL.width / 4 - 0.5, HALL.height, midZ]}>
        <planeGeometry args={[HALL.width / 2 - 1, length]} />
        <meshStandardMaterial color="#efe8da" roughness={0.95} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[HALL.width / 4 + 0.5, HALL.height, midZ]}>
        <planeGeometry args={[HALL.width / 2 - 1, length]} />
        <meshStandardMaterial color="#efe8da" roughness={0.95} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, HALL.height + 0.01, midZ]}>
        <planeGeometry args={[2, length]} />
        <meshBasicMaterial color="#fff6e6" />
      </mesh>

      {/* Walls */}
      <Wall width={length} position={[-HALL.width / 2, 0, midZ]} rotationY={Math.PI / 2} fabric={fabric} />
      <Wall width={length} position={[HALL.width / 2, 0, midZ]} rotationY={-Math.PI / 2} fabric={fabric} />
      {/* End wall with the attic doorway cut beside the draped frame */}
      <EndWall length={length} fabric={fabric} />
      <Wall width={HALL.width} position={[0, 0, 0]} rotationY={Math.PI} fabric={fabric} />

      {/* Dressing down the center line */}
      <Bench z={-9} />
      {length > 24 && <Bench z={-(length - 10)} />}
      <Stanchions z={-13} />

      {/* Warm skylight pools */}
      {lightZs.map((z) => (
        <pointLight key={z} position={[0, HALL.height - 0.4, z]} intensity={22} distance={13} decay={1.9} color="#ffe7c4" />
      ))}
    </group>
  )
}
