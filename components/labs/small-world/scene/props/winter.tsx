'use client'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { anchorTransform } from '../stage'
import { activeVariantAt, canonicalTheta } from '../renewal'
import { ClayFox, ClayFrozenFall, ClayOwl, ClaySnowConifer, ClaySnowHare } from './clay-kit'
import type { JourneyRef } from '../use-journey'

// The B2 xDataGroup wedge (band 2, variant B) is the WINTER scene (Task 50). All of this feel
// dressing is variant-B (lap-2) content: each figure shows only while variant 1 is active at its
// longitude, flipping to the A2 delta behind the horizon (renewal-scan), so it never pops on
// camera — the same per-figure gating as the Forest/Jungle/DeltaLife/CanyonGeysers. Every anchor
// is off the girl's lane, on DRY winter terrain (verified in scan-task26/33), and clear of the
// icy lake (the sacred B2 ponds) and the beloved right-side conifer forest.

/**
 * One lurking winter figure: anchored on the variant-B winter terrain, shown only while variant B
 * is active at its longitude (like the delta's Lurker / canyon's CanyonProp), with an optional
 * subtle idle bob driven by rotation (deterministic — no clock; rests calm at the chapter stop
 * where rotation freezes). `theta` is an absolute band-2 longitude (~5.3–5.95).
 */
function WinterLurker({
  theta,
  x,
  journeyRef,
  bob = 0,
  phase = 0,
  children,
}: {
  theta: number
  x: number
  journeyRef: JourneyRef
  bob?: number
  phase?: number
  children: ReactNode
}) {
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const tc = useMemo(() => canonicalTheta(theta), [theta])
  const { position, quaternion } = useMemo(() => anchorTransform(theta, x, 1), [theta, x])
  useFrame(() => {
    const g = outer.current
    if (!g) return
    const rot = journeyRef.current.rotation
    g.visible = activeVariantAt(tc, rot) === 1
    if (g.visible && bob > 0 && inner.current) {
      inner.current.position.y = bob * Math.sin(rot * 5 + phase)
    }
  })
  return (
    <group ref={outer} position={position} quaternion={quaternion}>
      <group ref={inner}>{children}</group>
    </group>
  )
}

/**
 * The winter wedge's cold feel (Task 50): hidden wildlife lurking in the drifts (a fox curled by a
 * drift, an owl on a snag, a snow hare by its burrow), a frozen waterfall spilling off a snowy
 * ledge, and snow-laden conifers filling the flanks (distinct from the Forest's clean cones). All
 * variant-B gated so lap 1 (the A2 delta) stays clear; the icy lake + right forest he likes are
 * untouched. The ONLY warm note is the red fox's coat — everything else is cold blue-white / spruce.
 */
export function WinterLife({ journeyRef }: { journeyRef: JourneyRef }) {
  return (
    <>
      {/* a red fox curled asleep in a left-flank drift — the one warm accent, breathing softly */}
      <WinterLurker theta={5.4} x={-0.55} journeyRef={journeyRef} bob={0.003} phase={0.5}>
        <ClayFox rotation={[0, 2.4, 0]} />
      </WinterLurker>
      {/* an owl perched on a snag at the edge of the winter wood */}
      <WinterLurker theta={5.86} x={0.5} journeyRef={journeyRef}>
        <ClayOwl rotation={[0, -1.9, 0]} />
      </WinterLurker>
      {/* a snow hare crouched by its burrow in a drift hollow */}
      <WinterLurker theta={5.5} x={-0.72} journeyRef={journeyRef} bob={0.004} phase={2.1}>
        <ClaySnowHare rotation={[0, 0.8, 0]} />
      </WinterLurker>

      {/* a frozen waterfall spilling off the snowy ledge on the far flank */}
      <WinterLurker theta={5.8} x={-0.95} journeyRef={journeyRef}>
        <ClayFrozenFall rotation={[0, 1.4, 0]} />
      </WinterLurker>

      {/* snow-laden conifers filling the flanks (drooping, snow-topped — distinct from the Forest) */}
      <WinterLurker theta={5.4} x={0.58} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.52} />
      </WinterLurker>
      <WinterLurker theta={5.9} x={0.64} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.44} rotation={[0, 1.2, 0]} />
      </WinterLurker>
      <WinterLurker theta={5.52} x={-0.86} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.48} rotation={[0, 2.6, 0]} />
      </WinterLurker>
    </>
  )
}
