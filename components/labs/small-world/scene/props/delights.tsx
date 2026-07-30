'use client'
import { useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { POLAR_L, WATER_LEVEL } from '../biomes'
import { PLANET_RADIUS } from '../planet'
import { DIALS, subscribe, revisionSnapshot } from '../tunables'
import { GatedProp } from './gated-prop'
import { ClayBlossom, ClayBoulder, ClayIceberg, ClayPalm, ClayRock, ClaySprout } from './clay-kit'
import { useClayRamp } from '../toon-ramp'
import type { JourneyRef } from '../use-journey'

const Y_UP = new THREE.Vector3(0, 1, 0)

/** Flat ice floes sitting on a polar ocean's surface (variant-INVARIANT — the
 *  polar oceans never morph, so these never pop). Tangent offsets around the
 *  pole centre; each floe rides at the waterline. Task 33: they FLOAT on the risen
 *  water — the seat radius tracks the waterRise dial so the altitude rise never
 *  swallows them (subscribes to the tunables store so live tuning moves them). */
function PolarFloes({ cap, spec }: { cap: { dir: readonly [number, number, number] }; spec: Array<[number, number, number]> }) {
  const ramp = useClayRamp()
  // re-render on any dial change so the floes ride the current water altitude.
  useSyncExternalStore(subscribe, revisionSnapshot, revisionSnapshot)
  const waterR = PLANET_RADIUS * (WATER_LEVEL + DIALS.waterRise.value)
  const c = new THREE.Vector3(cap.dir[0], cap.dir[1], cap.dir[2]).normalize()
  const t1 = new THREE.Vector3().crossVectors(c, Y_UP).normalize()
  const t2 = new THREE.Vector3().crossVectors(c, t1).normalize()
  return (
    <>
      {spec.map(([a, b, r], i) => {
        const dir = c.clone().addScaledVector(t1, a).addScaledVector(t2, b).normalize()
        const pos = dir.clone().multiplyScalar(waterR + 0.012)
        const quat = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir)
        return (
          <mesh key={i} position={pos} quaternion={quat}>
            <cylinderGeometry args={[r, r * 0.86, 0.03, 7]} />
            <meshToonMaterial color={PALETTE.ice} gradientMap={ramp} />
          </mesh>
        )
      })}
    </>
  )
}

const FLOES_L: Array<[number, number, number]> = [
  [0.14, -0.1, 0.09], [-0.06, 0.2, 0.08], [0.2, 0.1, 0.075],
]

/**
 * Icebergs on the great left ocean (Task 60 — Aram asked for them with the winter ending set).
 *
 * They are VARIANT-INVARIANT on purpose, and that is a contract rather than a convenience. A prop
 * that flips has to flip while occluded, and renewal-scan.mjs models a WET cell's silhouette as
 * exactly the waterline with NO prop margin — the grazing limb is the one place the Task-19 work
 * proved tall things cannot be hidden at all. So a berg that appeared with the epilogue would be a
 * berg that pops on camera. Permanent ice on a polar ocean is also simply truer to the world: the
 * floes beside them have been there since Round 6.
 *
 * Placed at |nx| ≈ 0.84-0.88 and spread across the world angles the ocean occupies at the final
 * dwell, so they sit ON the visible blue rather than silhouetted on the rim (the first placement
 * put them at |nx| ≈ 0.93, which is 93% of the way to the limb — they read as spurs off the
 * planet's edge). That latitude still clears the coastline's divergence, which renewal-scan
 * measures topping out at |nx| = 0.745: below that the shore differs between variants and a berg
 * could find itself aground on one lap and afloat on the other.
 * [tangent a, tangent b, size, spin]
 */
const BERGS_L: Array<[number, number, number, number]> = [
  [-0.3954, -0.4244, 0.155, 0.7], // |nx| 0.865, world angle 0.75
  [-0.6263, -0.2081, 0.125, 2.3], // |nx| 0.835, world angle 1.25
  [-0.6038, 0.1409, 0.185, 4.1], // |nx| 0.850, world angle 1.80
  [-0.4447, 0.3237, 0.100, 5.2], // |nx| 0.876, world angle 2.20
]

/** Icebergs seated on the ocean surface, sharing PolarFloes' float math. The seat sits BELOW the
 *  nominal waterline (the floes' +0.012 is a hair less than the water's own relief crest, ~0.021
 *  world at default dials), so a berg's dark shelf is always cut by the surface instead of
 *  hovering over a swell. */
function PolarBergs({ cap, spec }: { cap: { dir: readonly [number, number, number] }; spec: Array<[number, number, number, number]> }) {
  useSyncExternalStore(subscribe, revisionSnapshot, revisionSnapshot)
  const waterR = PLANET_RADIUS * (WATER_LEVEL + DIALS.waterRise.value)
  const c = new THREE.Vector3(cap.dir[0], cap.dir[1], cap.dir[2]).normalize()
  const t1 = new THREE.Vector3().crossVectors(c, Y_UP).normalize()
  const t2 = new THREE.Vector3().crossVectors(c, t1).normalize()
  return (
    <>
      {spec.map(([a, b, r, spin], i) => {
        const dir = c.clone().addScaledVector(t1, a).addScaledVector(t2, b).normalize()
        const pos = dir.clone().multiplyScalar(waterR - 0.022)
        const quat = new THREE.Quaternion()
          .setFromUnitVectors(Y_UP, dir)
          .multiply(new THREE.Quaternion().setFromAxisAngle(Y_UP, spin))
        return (
          <group key={i} position={pos} quaternion={quat}>
            <ClayIceberg r={r} />
          </group>
        )
      })}
    </>
  )
}

/**
 * Curated water-side delights the flank scatter leaves out: lilies on the A0
 * spring pond, palms on the A2 delta islets, oasis palms in B0, ice floes on the
 * winter B2 pond, and floes on the one great left ocean (Round 6: the right limb
 * is coast now, so its floes are gone). Wedge items are variant-gated (swap behind
 * the horizon); the ocean floes are invariant.
 */
export function Delights({ journeyRef }: { journeyRef: JourneyRef }) {
  const ramp = useClayRamp()
  return (
    <>
      {/* permanent ice on the one great left ocean */}
      <PolarFloes cap={POLAR_L} spec={FLOES_L} />
      <PolarBergs cap={POLAR_L} spec={BERGS_L} />

      {/* A0 spring pond: lily blossoms on the near bank */}
      {([[1.22, 0.62], [1.34, 0.9], [1.28, 0.72]] as const).map(([t, x], i) => (
        <GatedProp key={`a0-${i}`} theta={t} x={x} variant={0} journeyRef={journeyRef}>
          <ClayBlossom color={i % 2 === 0 ? PALETTE.petal : PALETTE.blossom} scale={1.1} />
        </GatedProp>
      ))}

      {/* A2 delta: reeds + a palm on the sand islets */}
      {([[5.5, 0.66], [5.66, 1.05], [5.58, -0.8]] as const).map(([t, x], i) => (
        <GatedProp key={`a2-${i}`} theta={t} x={x} variant={0} journeyRef={journeyRef}>
          {i === 1 ? <ClayPalm scale={0.85} /> : <ClaySprout scale={1.5} />}
        </GatedProp>
      ))}

      {/* B0 oasis: a small palm grove by the pool */}
      {([[1.1, 0.6], [1.18, 0.78], [1.06, 0.86]] as const).map(([t, x], i) => (
        <GatedProp key={`b0-${i}`} theta={t} x={x} variant={1} journeyRef={journeyRef}>
          {i === 1 ? <ClayRock color={PALETTE.goldSand} r={0.09} /> : <ClayPalm scale={0.9} />}
        </GatedProp>
      ))}

      {/* B2 frozen pond: ice floes + a snowy boulder on its bank */}
      {([[5.5, 0.62], [5.6, 0.86]] as const).map(([t, x], i) => (
        <GatedProp key={`b2-${i}`} theta={t} x={x} variant={1} journeyRef={journeyRef}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.11, 0.1, 0.03, 8]} />
            <meshToonMaterial color={PALETTE.ice} gradientMap={ramp} />
          </mesh>
        </GatedProp>
      ))}
      <GatedProp theta={5.66} x={0.72} variant={1} journeyRef={journeyRef}>
        <ClayBoulder color={PALETTE.snow} r={0.11} />
      </GatedProp>
    </>
  )
}
