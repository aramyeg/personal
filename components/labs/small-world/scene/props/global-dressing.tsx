'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { PLANET_RADIUS, WATER_LEVEL, terrainBump } from '../planet'
import { PropAnchor } from './prop-anchor'
import { ClayBlossom, ClayRock, ClaySprout, ClayTree } from './clay-kit'

const DRESSING_COUNT = 36

/** Deterministic 0→1 hash of an integer — no Math.random, stable per index. */
const fract = (v: number): number => v - Math.floor(v)
const seeded = (i: number): number => fract(Math.sin(i * 127.1 + 311.7) * 43758.5453)

type Anchor = { i: number; theta: number; x: number; scale: number }

/**
 * The direction an anchor plants on, matching anchorTransform's construction,
 * so we can skip any anchor that would land in a lake.
 */
function anchorDirBump(theta: number, x: number): number {
  const xN = THREE.MathUtils.clamp(x / PLANET_RADIUS, -0.95, 0.95)
  const ring = Math.sqrt(1 - xN * xN)
  const dir = new THREE.Vector3(xN, ring * Math.cos(theta), ring * Math.sin(theta))
  return terrainBump(dir.x * PLANET_RADIUS, dir.y * PLANET_RADIUS, dir.z * PLANET_RADIUS)
}

/**
 * Always-visible flank scatter that keeps the planet from reading bare between
 * chapter arcs. Deterministic, not chapter-gated, not morphing — it lives on
 * the flanks (|x| ≥ 0.5) and leaves the spine band to the chapter sets, which
 * stay the visibly larger, denser stars.
 *
 * Perf: ~36 props ≈ 80–100 draw calls. Phase-3 optimization is instancing if
 * mobile complains.
 */
export function GlobalDressing() {
  const anchors = useMemo<Anchor[]>(() => {
    const list: Anchor[] = []
    for (let i = 0; i < DRESSING_COUNT; i++) {
      const theta = seeded(i) * Math.PI * 2
      const sign = i % 2 === 0 ? 1 : -1
      const x = sign * (0.5 + seeded(i + 100) * 0.55)
      // no trees in the lakes
      if (1 + anchorDirBump(theta, x) < WATER_LEVEL) continue
      const scale = 0.75 + seeded(i + 200) * 0.35
      list.push({ i, theta, x, scale })
    }
    return list
  }, [])

  return (
    <>
      {anchors.map(({ i, theta, x, scale }) => (
        <PropAnchor key={i} theta={theta} x={x}>
          {renderProp(i, scale)}
        </PropAnchor>
      ))}
    </>
  )
}

function renderProp(i: number, scale: number) {
  switch (i % 5) {
    case 0:
      return (
        <ClayTree
          height={0.28 + seeded(i + 300) * 0.12}
          crown={i % 2 === 0 ? PALETTE.leaf : PALETTE.sprout}
          scale={scale}
        />
      )
    case 1:
      return <ClayRock r={0.06 + seeded(i + 300) * 0.03} scale={scale} />
    case 2:
      return <ClayBlossom scale={scale} />
    case 3:
      return <ClaySprout scale={scale} />
    default:
      return <ClayTree height={0.4 + seeded(i + 300) * 0.1} crown={PALETTE.blossom} scale={scale} />
  }
}
