'use client'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { POLAR_L, WATER_LEVEL } from '../biomes'
import { PLANET_RADIUS } from '../planet'
import { GatedProp } from './gated-prop'
import { ClayBlossom, ClayPalm, ClayRock, ClaySprout } from './clay-kit'
import { useClayRamp } from '../toon-ramp'
import type { JourneyRef } from '../use-journey'

const Y_UP = new THREE.Vector3(0, 1, 0)

/** Flat ice floes sitting on a polar ocean's surface (variant-INVARIANT — the
 *  polar oceans never morph, so these never pop). Tangent offsets around the
 *  pole centre; each floe rides at the waterline. */
function PolarFloes({ cap, spec }: { cap: { dir: readonly [number, number, number] }; spec: Array<[number, number, number]> }) {
  const ramp = useClayRamp()
  const c = new THREE.Vector3(cap.dir[0], cap.dir[1], cap.dir[2]).normalize()
  const t1 = new THREE.Vector3().crossVectors(c, Y_UP).normalize()
  const t2 = new THREE.Vector3().crossVectors(c, t1).normalize()
  return (
    <>
      {spec.map(([a, b, r], i) => {
        const dir = c.clone().addScaledVector(t1, a).addScaledVector(t2, b).normalize()
        const pos = dir.clone().multiplyScalar(PLANET_RADIUS * WATER_LEVEL + 0.012)
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
        <ClayRock color={PALETTE.snow} r={0.1} />
      </GatedProp>
    </>
  )
}
