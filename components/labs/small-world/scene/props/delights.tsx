'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { PLANET_RADIUS, WATER_LEVEL } from '../planet'
import { ISLANDS, SEA } from '../biomes'
import { PropAnchor } from './prop-anchor'
import { ClayBlossom, ClayDisc, ClayPalm, ClayRock, ClaySprout } from './clay-kit'
import { useClayRamp } from '../toon-ramp'

const Y_UP = new THREE.Vector3(0, 1, 0)

/** PropAnchor params reproducing a unit direction (island tops sit on terrain). */
function anchorFor(dir: readonly [number, number, number]): { theta: number; x: number } {
  return { theta: Math.atan2(dir[2], dir[1]), x: dir[0] * PLANET_RADIUS }
}

/** A frozen pond inside the snow cap: a flat snow-tinted ice disc ringed by a
 *  slightly wider river-blue rim, flat-shaded under the ramp so it reads as ice. */
function FrozenPond({ theta, x }: { theta: number; x: number }) {
  const ramp = useClayRamp()
  return (
    <PropAnchor theta={theta} x={x}>
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.19, 0.2, 0.024, 16]} />
        <meshToonMaterial color={PALETTE.river} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.15, 0.155, 0.02, 14]} />
        <meshToonMaterial color={PALETTE.snow} gradientMap={ramp} />
      </mesh>
    </PropAnchor>
  )
}

/** A bare dead winter tree — a dark earth trunk with a couple of leafless
 *  branches, no crown. Sits on the snowy ground for the cold-region read. */
function WinterTree({ theta, x, scale = 1 }: { theta: number; x: number; scale?: number }) {
  const ramp = useClayRamp()
  return (
    <PropAnchor theta={theta} x={x}>
      <group scale={scale}>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.018, 0.03, 0.32, 6]} />
          <meshToonMaterial color={PALETTE.earth} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.05, 0.26, 0]} rotation={[0, 0, -0.8]}>
          <cylinderGeometry args={[0.01, 0.014, 0.16, 5]} />
          <meshToonMaterial color={PALETTE.earth} gradientMap={ramp} />
        </mesh>
        <mesh position={[-0.045, 0.3, 0.02]} rotation={[0.3, 0, 0.9]}>
          <cylinderGeometry args={[0.008, 0.012, 0.13, 5]} />
          <meshToonMaterial color={PALETTE.earth} gradientMap={ramp} />
        </mesh>
      </group>
    </PropAnchor>
  )
}

/** Snow-cap delights: a frozen pond and bare winter trees inside the cold cap. */
function SnowRegion() {
  const pond = anchorFor([-0.6, 0.05, 0.62])
  const trees: Array<[number, number, number]> = [
    ...([[-0.7, 0.2, 0.45], [-0.62, -0.06, 0.62], [-0.68, 0.3, 0.5]] as const).map(
      (d) => anchorForTuple(d)
    ),
  ]
  return (
    <>
      <FrozenPond theta={pond.theta} x={pond.x} />
      {trees.map(([theta, x, s], i) => (
        <WinterTree key={i} theta={theta} x={x} scale={s} />
      ))}
    </>
  )
}

/** anchorFor packed with a scale for the winter-tree list. */
function anchorForTuple(dir: readonly [number, number, number]): [number, number, number] {
  const a = anchorFor(dir)
  return [a.theta, a.x, 0.9 + 0.25 * Math.abs(dir[1])]
}

/** Flat ice floes floating on the cold sea's surface (at the waterline). */
function IceFloes() {
  const ramp = useClayRamp()
  const floes = useMemo(() => {
    const c = new THREE.Vector3(SEA.dir[0], SEA.dir[1], SEA.dir[2])
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
  // authored dry-meadow flower patches at two longitudes
  const flowers: Array<[number, number]> = [
    [2.0, 0.8], [2.1, 0.9], [2.2, 0.78], [2.05, 0.72], [2.15, 0.85],
    [0.45, 0.85], [0.55, 1.0], [0.65, 0.8], [0.5, 0.7],
  ]
  // winding dirt path segment
  const path: Array<[number, number]> = [
    [5.24, 0.72], [5.35, 0.82], [5.46, 0.72], [5.57, 0.85], [5.68, 0.75],
  ]
  // rock formations at two longitudes
  const rocks: Array<[number, number, number]> = [
    [3.9, 0.95, 0.11], [4.0, 1.1, 0.08], [3.95, 0.8, 0.09],
    [4.85, 0.95, 0.1], [4.95, 1.1, 0.075], [5.05, 0.85, 0.09],
  ]
  const island = ISLANDS.map((p) => anchorFor(p.dir))

  return (
    <>
      {/* islands */}
      <PropAnchor theta={island[0].theta} x={island[0].x}><ClayPalm /></PropAnchor>
      <PropAnchor theta={island[1].theta} x={island[1].x}><ClayRock color={PALETTE.dune} r={0.09} /></PropAnchor>
      <PropAnchor theta={island[2].theta} x={island[2].x}><ClaySprout scale={1.2} /></PropAnchor>

      <IceFloes />
      <SnowRegion />

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
