'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { PLANET_RADIUS, WATER_LEVEL } from '../planet'
import { ISLANDS, LAKE } from '../biomes'
import { PropAnchor } from './prop-anchor'
import { ClayBlossom, ClayDisc, ClayPalm, ClayRock, ClaySprout } from './clay-kit'
import { useClayRamp } from '../toon-ramp'

const Y_UP = new THREE.Vector3(0, 1, 0)

/** PropAnchor params reproducing a unit direction (island tops sit on terrain). */
function anchorFor(dir: readonly [number, number, number]): { theta: number; x: number } {
  return { theta: Math.atan2(dir[2], dir[1]), x: dir[0] * PLANET_RADIUS }
}

/** Flat ice floes floating on the highland lake's surface (at the waterline). */
function IceFloes() {
  const ramp = useClayRamp()
  const floes = useMemo(() => {
    const c = new THREE.Vector3(LAKE.dir[0], LAKE.dir[1], LAKE.dir[2])
    const t1 = new THREE.Vector3().crossVectors(c, Y_UP).normalize()
    const t2 = new THREE.Vector3().crossVectors(c, t1).normalize()
    // [tangent a, tangent b, radius] offsets inside the lake
    const spec: Array<[number, number, number]> = [
      [0.06, 0.08, 0.09], [-0.11, 0.03, 0.07], [0.05, -0.1, 0.08], [-0.04, -0.13, 0.055],
    ]
    return spec.map(([a, b, r]) => {
      const dir = c.clone().addScaledVector(t1, a).addScaledVector(t2, b).normalize()
      const pos = dir.clone().multiplyScalar(PLANET_RADIUS * WATER_LEVEL + 0.012)
      const quat = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir)
      return { pos, quat, r }
    })
  }, [])
  return (
    <>
      {floes.map(({ pos, quat, r }, i) => (
        <mesh key={i} position={pos} quaternion={quat}>
          <cylinderGeometry args={[r, r * 0.88, 0.03, 7]} />
          <meshToonMaterial color={PALETTE.snow} gradientMap={ramp} />
        </mesh>
      ))}
    </>
  )
}

/**
 * Curated delights beyond the core biome list (per Aram's creative-license
 * note): islands in the ocean, ice floes on the highland lake, a flower-meadow
 * patch, a winding dirt path, and a little rock formation — placed on verified
 * dry, feature-clear ground so every stretch of the lap has something new.
 */
export function Delights() {
  // authored dry-meadow flower patch
  const flowers: Array<[number, number]> = [
    [2.0, 0.8], [2.1, 0.9], [2.2, 0.78], [2.05, 0.72], [2.15, 0.85],
  ]
  // winding dirt path segment
  const path: Array<[number, number]> = [
    [5.24, 0.72], [5.35, 0.82], [5.46, 0.72], [5.57, 0.85], [5.68, 0.75],
  ]
  // little rock formation
  const rocks: Array<[number, number, number]> = [
    [3.9, 0.95, 0.11], [4.0, 1.1, 0.08], [3.95, 0.8, 0.09],
  ]
  const island = ISLANDS.map((p) => anchorFor(p.dir))

  return (
    <>
      {/* islands */}
      <PropAnchor theta={island[0].theta} x={island[0].x}><ClayPalm /></PropAnchor>
      <PropAnchor theta={island[1].theta} x={island[1].x}><ClayRock color={PALETTE.dune} r={0.09} /></PropAnchor>
      <PropAnchor theta={island[2].theta} x={island[2].x}><ClaySprout scale={1.2} /></PropAnchor>

      <IceFloes />

      {flowers.map(([theta, x], i) => (
        <PropAnchor key={`fl-${i}`} theta={theta} x={x}>
          <ClayBlossom color={i % 2 === 0 ? PALETTE.blossom : PALETTE.blossomDeep} scale={1.1} />
        </PropAnchor>
      ))}

      {path.map(([theta, x], i) => (
        <PropAnchor key={`pa-${i}`} theta={theta} x={x}>
          <ClayDisc color={PALETTE.clayPath} r={0.11} h={0.025} />
        </PropAnchor>
      ))}

      {rocks.map(([theta, x, r], i) => (
        <PropAnchor key={`rk-${i}`} theta={theta} x={x}>
          <ClayRock color={i === 1 ? PALETTE.earth : PALETTE.dune} r={r} />
        </PropAnchor>
      ))}
    </>
  )
}
