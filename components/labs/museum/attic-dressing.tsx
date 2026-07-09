'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { ATTIC, STAIR, atticDepth, type PaintingPlacement } from './layout'

const SHEET = '#b9b3a6'

/** Deterministic pseudo-random (local copy; textures.ts keeps its own). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A cloth plane with seeded sine folds — the shared dust-sheet look. */
function clothGeometry(w: number, h: number, seed: number, sag = 0.06): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, h, 18, 24)
  const rnd = mulberry32(seed)
  const phase = rnd() * Math.PI * 2
  const freq = 3 + rnd() * 3
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const folds = Math.sin((x / w) * Math.PI * freq + phase) * sag
    const belly = Math.cos((y / h) * Math.PI) * sag * 0.8
    pos.setZ(i, folds + belly)
  }
  geo.computeVertexNormals()
  return geo
}

function sheetMaterialProps() {
  return { color: SHEET, roughness: 0.95, side: THREE.DoubleSide } as const
}

/** Cloth thrown carelessly over one top corner of an exhibit — pulled aside,
 * as if someone recently looked. Covers only the top-left; the painting
 * center and right half stay clear for the focus raycast. */
export function CornerDrape({ placement }: { placement: PaintingPlacement }) {
  const cloth = useMemo(() => clothGeometry(1.25, 1.5, 41, 0.08), [])
  return (
    <group position={placement.position} rotation-y={placement.rotationY}>
      <mesh geometry={cloth} position={[-0.72, 0.9, 0.14]} rotation-z={-0.18}>
        <meshStandardMaterial {...sheetMaterialProps()} />
      </mesh>
    </group>
  )
}

/** A frame leaning against a knee wall, fully under a dust sheet. */
function CoveredFrame({
  x,
  z,
  lean,
  seed,
  w = 1.3,
  h = 1.7,
}: {
  x: number
  z: number
  lean: number
  seed: number
  w?: number
  h?: number
}) {
  const cloth = useMemo(() => clothGeometry(w + 0.35, h + 0.4, seed, 0.07), [w, h, seed])
  // Tops rest against the knee wall, bottoms kick toward the room — how a
  // frame actually leans. The slight overhang past the wall plane stays
  // hidden behind the opaque knee wall (no exterior camera exists).
  const side = x > 0 ? -1 : 1
  return (
    <group position={[x, STAIR.rise, z]} rotation-z={side * lean} rotation-y={side > 0 ? 0.35 : -0.35}>
      {/* The hidden frame gives the sheet its silhouette */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, 0.09]} />
        <meshStandardMaterial color="#54452f" roughness={0.8} />
      </mesh>
      <mesh geometry={cloth} position={[0, h / 2 + 0.05, 0.09]}>
        <meshStandardMaterial {...sheetMaterialProps()} />
      </mesh>
      <mesh geometry={cloth} position={[0, h / 2 + 0.05, -0.09]} rotation-y={Math.PI}>
        <meshStandardMaterial {...sheetMaterialProps()} />
      </mesh>
    </group>
  )
}

/** A sheeted statue: lathe silhouette under cloth — base, shoulders, head. */
function CoveredStatue({ x, z, height, seed }: { x: number; z: number; height: number; seed: number }) {
  const geo = useMemo(() => {
    const rnd = mulberry32(seed)
    const pts: THREE.Vector2[] = []
    const steps = 14
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      // base 0.42 -> waist 0.3 -> shoulder bump 0.26 -> head 0.13, with cloth wobble
      const base = 0.42 * (1 - t) + 0.13 * t
      const shoulder = Math.exp(-Math.pow((t - 0.72) * 5, 2)) * 0.07
      const wobble = Math.sin(t * Math.PI * 6 + rnd() * 6) * 0.015
      pts.push(new THREE.Vector2(Math.max(0.02, base + shoulder + wobble), t * height))
    }
    return new THREE.LatheGeometry(pts, 20)
  }, [height, seed])
  return (
    <mesh geometry={geo} position={[x, STAIR.rise, z]}>
      <meshStandardMaterial {...sheetMaterialProps()} />
    </mesh>
  )
}

/** All inert attic props. No focus targets, nothing on the exhibit sight line. */
export function AtticDressing({ hallLen }: { hallLen: number }) {
  const far = atticDepth(hallLen)
  const entryZ = -(hallLen + STAIR.run)
  return (
    <group>
      <CoveredFrame x={-(ATTIC.halfWidth - 0.55)} z={entryZ - 1.6} lean={0.16} seed={7} />
      <CoveredFrame x={-(ATTIC.halfWidth - 0.7)} z={entryZ - 2.1} lean={0.22} seed={11} w={1.0} h={1.4} />
      <CoveredFrame x={ATTIC.halfWidth - 0.6} z={entryZ - 3.4} lean={0.14} seed={19} />
      <CoveredStatue x={-2.6} z={-(far - 1.2)} height={1.7} seed={23} />
      <CoveredStatue x={2.7} z={entryZ - 1.4} height={1.1} seed={31} />
    </group>
  )
}
