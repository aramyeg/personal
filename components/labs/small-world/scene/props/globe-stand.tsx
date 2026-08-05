'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CRADLE_DROP,
  CRADLE_RADIUS,
  CRADLE_TUBE,
  STAND_COLLAR_R,
  STAND_COLLAR_Y,
  STAND_FOOT_R,
  STAND_FOOT_Y,
  STAND_COLLAR_H,
  STAND_FOOT_H,
  STAND_STRUTS,
  STAND_STRUT_PHASE,
  STRUT_TUBE_BOTTOM,
  STRUT_TUBE_TOP,
  standOffsetY,
} from '../globe-stand'
import { useThree } from '@react-three/fiber'
import { PALETTE } from '../../palette'
import { studioEnvIntensity, studioLightsFor } from '../desk-studio'
import { studioEnvFor } from '../studio-env'
import type { JourneyRef } from '../use-journey'
import { buildMergedClay, type ClayPart } from './clay-kit'

/**
 * THE GLOBE STAND, as geometry. `scene/globe-stand.ts` carries the argument and every number;
 * this is only how it reaches the screen.
 *
 * ONE MESH, ONE LERP. Every piece merges into a single vertex-coloured geometry built once at
 * mount, and the frame loop writes exactly one number — the group's y — from a pure function of
 * `ending.stand`. There is no material to fade, no gate to arm and nothing to allocate. During the
 * whole journey `stand` is exactly 0, so the callback compares one float, finds the group already
 * parked, and returns.
 *
 * WHY IT IS NOT HIDDEN DURING THE JOURNEY. The parked pose is BELOW the journey camera's frustum by
 * construction (`standBelowJourneyFrame`, gated in `globe-stand.test.ts`), exactly as the desk is,
 * and that is a property the scene cannot get wrong later — where a `visible` flag is a property a
 * later edit can.
 *
 * The first version of this paragraph went on to say that the honesty cost one draw call. It costs
 * ZERO, and the correction is worth keeping because it was found by measuring rather than by
 * reasoning: `bench/task66-drawcalls` reads 146 draws at the journey's end both with this component
 * mounted and with it removed. three.js frustum-culls on the merged geometry's bounding sphere, and
 * the parked stand is six world units below the frame — far enough that the conservative sphere test
 * settles it without ever reaching the vertices. It starts costing its one draw when it rises.
 */

/** A turned ring, three struts, a waisted column and a foot — the pieces, in world space. */
export function standParts(): ClayPart[] {
  const parts: ClayPart[] = [
    // THE CRADLE. Its far arc is behind the world and hidden by it; its near arc hangs below the
    // silhouette. That pair is the whole "sitting in" read — see the module header.
    {
      geo: new THREE.TorusGeometry(CRADLE_RADIUS, CRADLE_TUBE, 10, 48),
      color: PALETTE.clayPath,
      pos: [0, -CRADLE_DROP, 0],
      rot: [Math.PI / 2, 0, 0],
      tag: 'cradle',
    },
  ]

  // THE STRUTS, from the collar up to the ring. Built BETWEEN THEIR TWO ENDPOINTS with a
  // `setFromUnitVectors` quaternion rather than posed with Euler angles: at this splay (56° off
  // vertical) an Euler triple built from a yaw and a lean is only exact on the axes, and the first
  // cut had the two off-axis struts missing the ring by a visible margin. Solving from the
  // endpoints also means moving the ring or the collar moves the struts instead of leaving them
  // pointing at where the ring used to be.
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < STAND_STRUTS; i++) {
    const yaw = STAND_STRUT_PHASE + (i / STAND_STRUTS) * Math.PI * 2
    const foot = new THREE.Vector3(
      Math.sin(yaw) * STAND_COLLAR_R,
      STAND_COLLAR_Y,
      Math.cos(yaw) * STAND_COLLAR_R
    )
    const head = new THREE.Vector3(
      Math.sin(yaw) * CRADLE_RADIUS,
      -CRADLE_DROP,
      Math.cos(yaw) * CRADLE_RADIUS
    )
    const span = head.clone().sub(foot)
    const geo = new THREE.CylinderGeometry(STRUT_TUBE_TOP, STRUT_TUBE_BOTTOM, span.length(), 8)
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, span.clone().normalize()))
    const mid = foot.clone().add(head).multiplyScalar(0.5)
    geo.translate(mid.x, mid.y, mid.z)
    parts.push({ geo, color: PALETTE.clayPath, tag: 'strut' })
  }

  const columnH = STAND_COLLAR_Y - STAND_FOOT_Y
  parts.push(
    {
      geo: new THREE.CylinderGeometry(STAND_COLLAR_R, STAND_COLLAR_R * 0.82, STAND_COLLAR_H, 20),
      color: PALETTE.clayPath,
      pos: [0, STAND_COLLAR_Y, 0],
      tag: 'collar',
    },
    // the waist: narrow at the top, swelling toward the foot, which is the profile of a turned stem
    {
      geo: new THREE.CylinderGeometry(STAND_COLLAR_R * 0.62, STAND_FOOT_R * 0.5, columnH, 20),
      color: PALETTE.clayPath,
      pos: [0, (STAND_COLLAR_Y + STAND_FOOT_Y) / 2, 0],
      tag: 'stem',
    },
    {
      geo: new THREE.CylinderGeometry(STAND_FOOT_R * 0.88, STAND_FOOT_R, STAND_FOOT_H, 24),
      color: PALETTE.clayPath,
      pos: [0, STAND_FOOT_Y + STAND_FOOT_H / 2, 0],
      tag: 'foot',
    }
  )
  return parts
}

/** The whole stand as ONE geometry, in its SEATED pose. Exported so a test can measure the vertices
 *  the renderer actually emits rather than the constants they were authored from. */
export function buildGlobeStand(): THREE.BufferGeometry {
  return buildMergedClay(standParts())
}

export function GlobeStand({ journeyRef }: { journeyRef: JourneyRef }) {
  const group = useRef<THREE.Group>(null)
  const geo = useMemo(buildGlobeStand, [])
  const renderer = useThree((s) => s.gl)
  // THE STAND IS ROSE GOLD (Task 68), and it is the ONE piece of the ending's metal the lab still
  // builds itself. The look-dev's stand was measured against this one and does not match it — T67
  // splayed its struts DOWN from the collar toward the foot instead of UP to the ring, and gave the
  // ring a thin central post where the lab has a waisted stem — so what shipped is this geometry,
  // whose terrain clearance and containment are proved in `globe-stand.test.ts`, wearing the
  // approved finish. Same environment as the desk's three metal props, so the ring and the trinket
  // dish beside it are lit by the same room.
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.standRoseGold,
        metalness: 1,
        roughness: 0.32,
        envMap: studioEnvFor(renderer),
        toneMapped: false,
      }),
    [renderer]
  )
  useEffect(() => {
    return () => {
      geo.dispose()
      material.dispose()
    }
  }, [geo, material])

  // NaN so the mount frame always applies once (NaN !== NaN) and the stand starts parked rather
  // than seated for one frame; every frame of the journey after it costs one float compare.
  const last = useRef(Number.NaN)
  const lastLights = useRef(Number.NaN)
  useFrame(() => {
    const g = group.current
    if (!g) return
    const { ending } = journeyRef.current
    if (ending.stand !== last.current) {
      last.current = ending.stand
      g.position.y = standOffsetY(ending.stand)
    }
    const u = studioLightsFor(ending)
    if (u !== lastLights.current) {
      lastLights.current = u
      material.envMapIntensity = studioEnvIntensity(u)
    }
  })

  return (
    <group ref={group} position={[0, standOffsetY(0), 0]}>
      <mesh geometry={geo} material={material} />
    </group>
  )
}
