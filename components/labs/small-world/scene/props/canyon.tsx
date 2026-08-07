'use client'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { chapterTheta, anchorTransform } from '../stage'
import { activeVariantAt, canonicalTheta } from '../renewal'
import { geyserPlume } from '../geyser'
import { DIALS } from '../tunables'
import { ClayGeyser, ClayGeyserPlume, ClayHoodoo } from './clay-kit'
import type { JourneyRef } from '../use-journey'

// The B1 AKNA wedge (band 1, variant B) is the CANYON (Task 49). These geysers + hoodoos are
// variant-B (lap-2) content: each figure shows only while variant 1 is active at its longitude,
// flipping to the A1 jungle behind the horizon (renewal-scan), so it never pops on camera — the
// same per-figure gating as the Forest/Jungle/DeltaLife. Every anchor is off the girl's lane and
// on DRY canyon floor (verified in the task probe), and clear of the beloved creek/cliffs.

/** The canyon is chapter 4 (band 1, variant B); T maps a travel fraction to its longitude. */
const T = (t: number) => chapterTheta(4, t)
const CANYON_CHAPTER = 4

/** The height (world Y) the plume's vent sits above each geyser's base — matches the ClayGeyser
 *  cone mouth, so the plume erupts from the vent. */
const VENT_Y = 0.25

/** Wrap a signed angle into (−π, π]. */
const wrapPi = (a: number): number => {
  const TWO_PI = Math.PI * 2
  let d = a % TWO_PI
  if (d <= -Math.PI) d += TWO_PI
  if (d > Math.PI) d -= TWO_PI
  return d
}

/**
 * THE LIMB REST (Task 86) — how tall the plume is allowed to grow at the world angle it
 * currently occupies.
 *
 * A geyser rides from the bottom of the frame to the top over its wedge's approach: the
 * camera is static and the planet turns under it, so a prop's world angle is
 * `theta − rotation`, running from about 160° (the grazing bottom limb) up to about −20°
 * (the top). The plume is a tall thing — the vent sits 0.25 above the ground and the column
 * reaches 0.62 beyond that, so a full eruption is nearly 0.4 of a planet RADIUS. Anywhere in
 * the upper frame that is the point. At the bottom limb it is the defect the T84 audit found
 * at chapter 4: "a tan dome with grey drips dangling from the bottom edge" — two plumes
 * projecting past the silhouette into empty background, seen end-on, reading as drips
 * because at that grazing angle nothing around them reads as ground.
 *
 * So the eruption rests while the vent is on the limb and climbs as the vent does. This is
 * not a fade or a cheat: geyser.ts already gives every vent a dormant phase, and a dormant
 * vent is what the reader sees — the sinter cone and its bubbling pool are drawn either way.
 * It is a pure function of rotation like everything else here, so scrubbing back and forth
 * reproduces it exactly, and at the canyon's OWN checkpoint every geyser sits at 28°–58°,
 * far inside the full-eruption band, so chapter 5's frame is unchanged.
 */
const REST_LO = 95
const REST_SPAN = 35
function limbRest(theta: number, rotation: number): number {
  const deg = (wrapPi(theta - rotation) * 180) / Math.PI
  const t = (deg - REST_LO) / REST_SPAN
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return 1 - x * x * (3 - 2 * x)
}

/**
 * One geyser: the mineral cone/pool (always present while variant B is active) plus the erupting
 * plume, which the render GROWS and SHRINKS by the rotation-driven cycle (geyser.ts) scaled by the
 * live `geyserAmp` dial. Deterministic (rotation only — no wall-clock); at the chapter stop the
 * rotation freezes, so the plume holds a pose. Off-lane, dry, variant-B gated (hidden on lap 1).
 */
function Geyser({
  t,
  x,
  phase,
  journeyRef,
}: {
  t: number
  x: number
  phase: number
  journeyRef: JourneyRef
}) {
  const theta = useMemo(() => T(t), [t])
  const tc = useMemo(() => canonicalTheta(theta), [theta])
  const { position, quaternion } = useMemo(() => anchorTransform(theta, x, 1), [theta, x])
  const outer = useRef<THREE.Group>(null)
  const plume = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = outer.current
    if (!g) return
    const rot = journeyRef.current.rotation
    const active = activeVariantAt(tc, rot) === 1
    g.visible = active
    if (active && plume.current) {
      const amp =
        geyserPlume(rot, phase, DIALS.geyserPeriod.value) *
        DIALS.geyserAmp.value *
        limbRest(theta, rot)
      plume.current.scale.setScalar(Math.max(amp, 0.0001))
    }
  })
  return (
    <group ref={outer} position={position} quaternion={quaternion}>
      <ClayGeyser />
      <group ref={plume} position={[0, VENT_Y, 0]}>
        <ClayGeyserPlume />
      </group>
    </group>
  )
}

/** One variant-B gated static canyon prop (hoodoo cluster), seated on the lap-2 canyon terrain
 *  and shown only while variant B is active at its longitude — hidden on lap 1 (the jungle). */
function CanyonProp({
  t,
  x,
  journeyRef,
  children,
}: {
  t: number
  x: number
  journeyRef: JourneyRef
  children: ReactNode
}) {
  const theta = useMemo(() => T(t), [t])
  const tc = useMemo(() => canonicalTheta(theta), [theta])
  const { position, quaternion } = useMemo(() => anchorTransform(theta, x, 1), [theta, x])
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.visible = activeVariantAt(tc, journeyRef.current.rotation) === 1
  })
  return (
    <group ref={ref} position={position} quaternion={quaternion}>
      {children}
    </group>
  )
}

/**
 * The canyon's geysers + hoodoos (Task 49). Composed into the scene alongside the
 * Forest/Jungle/DeltaLife/DesertLife; variant-B gated so lap 1 (the A1 jungle) stays clear. Three
 * geysers erupt out of sync (staggered phases) in the terrace pockets beside the gorge, and two
 * hoodoo clusters add badland-spire variety — all without touching the beloved dirt ridge/cliffs.
 */
export function CanyonGeysers({ journeyRef }: { journeyRef: JourneyRef }) {
  return (
    <>
      {/* three geysers in dry terrace pockets, staggered so they never erupt in lockstep */}
      <Geyser t={0.467} x={0.3} phase={0} journeyRef={journeyRef} />
      <Geyser t={0.58} x={-0.32} phase={0.4} journeyRef={journeyRef} />
      <Geyser t={0.714} x={0.36} phase={0.72} journeyRef={journeyRef} />
      {/* hoodoo clusters flanking the gorge (badland spires, off the sacred cliffs) */}
      <CanyonProp t={0.42} x={-0.4} journeyRef={journeyRef}>
        <ClayHoodoo rotation={[0, 0.6, 0]} />
      </CanyonProp>
      <CanyonProp t={0.66} x={0.42} journeyRef={journeyRef}>
        <ClayHoodoo rotation={[0, -1.1, 0]} scale={0.86} />
      </CanyonProp>
    </>
  )
}
