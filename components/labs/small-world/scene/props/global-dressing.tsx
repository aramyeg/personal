'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { PLANET_RADIUS, WATER_LEVEL, terrainBump, terrainBumpB } from '../planet'
import { FOREST, SNOW, SNOW_B, capMask, canyonDist } from '../biomes'
import { GatedProp } from './gated-prop'
import type { JourneyRef } from '../use-journey'
import { ClayBlossom, ClayMound, ClayRock, ClaySprout, ClayTree } from './clay-kit'

const DRESSING_COUNT = 36

/** Deterministic 0→1 hash of an integer — no Math.random, stable per index. */
const fract = (v: number): number => v - Math.floor(v)
const seeded = (i: number): number => fract(Math.sin(i * 127.1 + 311.7) * 43758.5453)

type Anchor = { i: number; theta: number; x: number; scale: number }

/** The unit direction an anchor plants on, matching anchorTransform. */
function anchorDir(theta: number, x: number): THREE.Vector3 {
  const xN = THREE.MathUtils.clamp(x / PLANET_RADIUS, -0.95, 0.95)
  const ring = Math.sqrt(1 - xN * xN)
  return new THREE.Vector3(xN, ring * Math.cos(theta), ring * Math.sin(theta))
}

/**
 * Always-visible flank scatter that keeps the planet from reading bare between
 * chapter arcs. Deterministic, not chapter-gated, not morphing — it lives on
 * the flanks (|x| ≥ 0.5) and leaves the spine band to the chapter sets, which
 * stay the visibly larger, denser stars.
 *
 * Perf: ~36 props ≈ 80–100 draw calls. Phase-3 optimization is instancing if
 * mobile complains.
 *
 * Renewal: each item is a variant-A GatedProp — visible only while its own
 * longitude has not flipped to autumn (gate < 0.5). Its autumn counterpart lives
 * in GlobalDressingAutumn; the two swap behind the horizon, one item at a time.
 */
export function GlobalDressing({ journeyRef }: { journeyRef: JourneyRef }) {
  const anchors = useMemo<Anchor[]>(() => {
    const list: Anchor[] = []
    for (let i = 0; i < DRESSING_COUNT; i++) {
      const theta = seeded(i) * Math.PI * 2
      const sign = i % 2 === 0 ? 1 : -1
      const x = sign * (0.5 + seeded(i + 100) * 0.55)
      const dir = anchorDir(theta, x)
      const bump = terrainBump(dir.x * PLANET_RADIUS, dir.y * PLANET_RADIUS, dir.z * PLANET_RADIUS)
      // authored regions own their own dressing — stay out of them
      if (1 + bump < WATER_LEVEL) continue // water
      if (capMask(dir.x, dir.y, dir.z, FOREST) > 0.3) continue // forest.tsx owns it
      if (capMask(dir.x, dir.y, dir.z, SNOW) > 0.5) continue // snow boulders below
      if (canyonDist(dir.x, dir.y, dir.z) < 0.14) continue // canyon rocks below
      const scale = 0.75 + seeded(i + 200) * 0.35
      list.push({ i, theta, x, scale })
    }
    return list
  }, [])

  return (
    <>
      {anchors.map(({ i, theta, x, scale }) => (
        <GatedProp key={i} theta={theta} x={x} variant={0} journeyRef={journeyRef}>
          {renderProp(i, scale)}
        </GatedProp>
      ))}
      {/* snow boulders on the cold pole (replacing the skipped snow scatter) */}
      {[0.5, 2.1, 4.4].map((theta, k) => (
        <GatedProp key={`snow-${k}`} theta={theta} x={-1.95} variant={0} journeyRef={journeyRef}>
          <ClayRock color={PALETTE.snow} r={0.09 + k * 0.015} />
        </GatedProp>
      ))}
      {/* earth rocks on the canyon rim, reinforcing the brown clay read */}
      {([[1.05, 1.5], [1.2, 1.72], [1.36, 1.55]] as const).map(([theta, x], k) => (
        <GatedProp key={`canyon-${k}`} theta={theta} x={x} variant={0} journeyRef={journeyRef}>
          <ClayRock color={PALETTE.earth} r={0.08 + k * 0.01} />
        </GatedProp>
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

/**
 * Lap-2 flank scatter: the same always-on role as GlobalDressing but an autumn
 * cast — amber/deep-blossom crowns, bare earth-trunk trees, more earth rocks and
 * pumpkin-ish honey mounds. A DIFFERENT seed offset scatters it to new spots, and
 * it grounds on the lap-2 terrain (terrainBumpB / SNOW_B, variant-B GatedProp).
 * Lives on the flanks; the spine band stays the chapter sets' stage. Each item is
 * visible only once its own longitude has flipped to autumn (gate ≥ 0.5).
 */
export function GlobalDressingAutumn({ journeyRef }: { journeyRef: JourneyRef }) {
  const anchors = useMemo<Anchor[]>(() => {
    const list: Anchor[] = []
    for (let i = 0; i < DRESSING_COUNT; i++) {
      const theta = seeded(i + 500) * Math.PI * 2
      const sign = i % 2 === 0 ? -1 : 1
      const x = sign * (0.5 + seeded(i + 600) * 0.55)
      const dir = anchorDir(theta, x)
      const bump = terrainBumpB(dir.x * PLANET_RADIUS, dir.y * PLANET_RADIUS, dir.z * PLANET_RADIUS)
      if (1 + bump < WATER_LEVEL) continue // water
      if (capMask(dir.x, dir.y, dir.z, FOREST) > 0.3) continue // forest.tsx owns it
      if (capMask(dir.x, dir.y, dir.z, SNOW_B) > 0.5) continue // (wider) snow core
      if (canyonDist(dir.x, dir.y, dir.z) < 0.14) continue // canyon rocks below
      const scale = 0.75 + seeded(i + 700) * 0.35
      list.push({ i, theta, x, scale })
    }
    return list
  }, [])

  return (
    <>
      {anchors.map(({ i, theta, x, scale }) => (
        <GatedProp key={i} theta={theta} x={x} variant={1} journeyRef={journeyRef}>
          {renderPropAutumn(i, scale)}
        </GatedProp>
      ))}
      {/* snow boulders across the (wider) cold pole */}
      {[0.5, 2.1, 3.3, 4.4].map((theta, k) => (
        <GatedProp key={`snow-${k}`} theta={theta} x={-1.95} variant={1} journeyRef={journeyRef}>
          <ClayRock color={PALETTE.snow} r={0.09 + k * 0.015} />
        </GatedProp>
      ))}
      {/* extra earth rocks on the canyon rim (richer autumn walls) */}
      {([[1.05, 1.5], [1.2, 1.72], [1.36, 1.55], [1.15, 1.9]] as const).map(([theta, x], k) => (
        <GatedProp key={`canyon-${k}`} theta={theta} x={x} variant={1} journeyRef={journeyRef}>
          <ClayRock color={PALETTE.earth} r={0.08 + k * 0.01} />
        </GatedProp>
      ))}
    </>
  )
}

function renderPropAutumn(i: number, scale: number) {
  switch (i % 5) {
    case 0:
      return (
        <ClayTree
          height={0.3 + seeded(i + 800) * 0.12}
          crown={i % 2 === 0 ? PALETTE.honey : PALETTE.dune}
          scale={scale}
        />
      )
    case 1:
      return <ClayRock color={PALETTE.earth} r={0.07 + seeded(i + 800) * 0.03} scale={scale} />
    case 2:
      // pumpkin-ish honey mound
      return <ClayMound r={0.13 + seeded(i + 800) * 0.06} color={PALETTE.honey} squash={0.6} scale={scale} />
    case 3:
      // bare earth-trunk tree (leafless autumn)
      return <ClayTree height={0.34 + seeded(i + 800) * 0.1} crown={PALETTE.earth} scale={scale * 0.9} />
    default:
      return <ClayRock color={PALETTE.earth} r={0.09 + seeded(i + 800) * 0.03} scale={scale} />
  }
}
