'use client'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import {
  DESK_BACK_Z,
  DESK_HALF_W,
  DESK_NEAR_Z,
  DESK_NOTE,
  DESK_PROPS,
  DESK_TOP_Y,
} from '../desk-stage'
import { useClayRamp } from '../toon-ramp'
import type { JourneyRef } from '../use-journey'
import { buildMergedClay } from './clay-kit'
import { deskNoteShadowPart, deskPropParts, tiltTowardKey } from './desk-kit'
import { DeskNote } from './desk-note'

/**
 * THE DESK (Task 65) — the surface the little world turns out to be sitting on.
 *
 * A SIBLING of the planet, never a child: the planet is a wheel that has spun four times by the
 * time anyone sees this, and a desk parented to it would have spun with it. It is also completely
 * static — no gate, no fade, no `useFrame`, not one number read per frame. It is mounted from the
 * first paint of the lab and the journey camera simply cannot see it (`desk-stage.ts` carries the
 * proof and `desk-stage.test.ts` re-derives it from the real frustum corner rays at every aspect).
 *
 * That was a choice with a cheaper-looking alternative — gate the whole set on `ending.zoom` and
 * fade it in — and the reason to refuse it is that a fade is a thing the eye can catch. The
 * pull-back already has one job, which is to make the world small; a desk arriving during it is a
 * second event competing with the first, and against a moving camera "materialised" and "was always
 * there" look different in a way no amount of easing fixes. Parked geometry has no entrance to get
 * wrong, forwards or backwards, at any scrub speed.
 *
 * DRAW CALLS: three. The slab, every prop merged into one vertex-coloured geometry, and the note
 * (its own material, because it carries a texture). Per frame: nothing at all — this component
 * subscribes to no frame loop and allocates nothing after mount.
 */

/** How far the hand-formed back edge may wander FORWARD of DESK_BACK_Z. Never backward: back is
 *  where the journey camera lives, so the wobble is authored as a one-sided offset rather than as
 *  a symmetric one that would eat half the clearance. */
export const EDGE_WOBBLE = 0.55

/** Columns across the slab. The back edge is the only line of it anyone ever sees, so the grid is
 *  spent on x — 96 columns puts a wobble sample every ~0.9 world units at the width the slab is. */
const SLAB_NX = 96
const SLAB_NZ = 10

/**
 * Deterministic hand-formed edge. Three incommensurable sines, so it never visibly repeats.
 *
 * The one-sidedness is the load-bearing property and it rests on the three amplitudes summing to
 * exactly 1, which is the sort of fact that survives until someone retunes one of them. Exported so
 * `desk-kit.test.ts` can hold it to `[0, EDGE_WOBBLE]` directly, rather than leaving the slab as the
 * one piece of geometry in the set whose emitted vertices nothing measures.
 */
export function edgeOffset(x: number): number {
  const w =
    0.42 * Math.sin(x * 0.31 + 1.1) + 0.34 * Math.sin(x * 0.87 + 0.35) + 0.24 * Math.sin(x * 2.13)
  return ((w + 1) / 2) * EDGE_WOBBLE
}

/** Low-frequency mottle, the same trick the meadow's field clay uses to keep a flat area alive. */
function mottle(x: number, z: number): number {
  return (
    0.5 +
    0.28 * Math.sin(x * 0.23 + z * 0.41) +
    0.16 * Math.sin(x * 0.71 - z * 0.19 + 2.2) +
    0.06 * Math.sin(x * 1.9 + z * 1.3)
  )
}

export function buildSlab(): THREE.BufferGeometry {
  const base = new THREE.Color(PALETTE.deskTop)
  const grain = new THREE.Color(PALETTE.deskGrain)
  const c = new THREE.Color()

  const positions: number[] = []
  const colors: number[] = []
  const index: number[] = []

  for (let iz = 0; iz <= SLAB_NZ; iz++) {
    const tz = iz / SLAB_NZ
    for (let ix = 0; ix <= SLAB_NX; ix++) {
      const x = -DESK_HALF_W + (ix / SLAB_NX) * 2 * DESK_HALF_W
      const wob = edgeOffset(x)
      // the wobble applies to the back edge and relaxes out of the surface within two rows
      const z = DESK_BACK_Z + wob * Math.max(0, 1 - tz * SLAB_NZ * 0.5) + tz * (DESK_NEAR_Z - DESK_BACK_Z)
      // the very back row rolls off a touch, so the edge reads as pressed clay rather than as a cut
      const roll = iz === 0 ? 0.055 : 0
      positions.push(x, DESK_TOP_Y - roll, z)

      c.copy(base).lerp(grain, 0.16 * mottle(x, z))
      // a shadow lip under the back edge, and a soft fall-off at the far left and right, so the
      // slab has somewhere to recede to instead of reading as one flat wall of tan
      const lip = Math.max(0, 1 - tz * SLAB_NZ * 0.34)
      const wings = Math.min(1, Math.abs(x) / DESK_HALF_W / 0.55) ** 2
      c.lerp(grain, 0.42 * lip * lip + 0.26 * wings)
      colors.push(c.r, c.g, c.b)
    }
  }

  const row = SLAB_NX + 1
  for (let iz = 0; iz < SLAB_NZ; iz++) {
    for (let ix = 0; ix < SLAB_NX; ix++) {
      const a = iz * row + ix
      index.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  // the slab is flat, so it has no shading gradient for an authored normal to distort — and being
  // flat is exactly why it needed one. See tiltTowardKey.
  tiltTowardKey(geo, 0.15)
  return geo
}

/**
 * `journeyRef` is a pass-through for the NOTE alone (see desk-note.tsx): the sheet reads it at one
 * instant, to decide whether a late webfont may still be swapped in unseen. Nothing else in the set
 * reads it and nothing here subscribes to a frame loop.
 */
export function DeskSet({ journeyRef }: { journeyRef: JourneyRef }) {
  const ramp = useClayRamp()
  const slab = useMemo(buildSlab, [])
  const props = useMemo(
    () => buildMergedClay([deskNoteShadowPart(DESK_NOTE), ...DESK_PROPS.flatMap(deskPropParts)]),
    []
  )
  useEffect(() => {
    return () => {
      slab.dispose()
      props.dispose()
    }
  }, [slab, props])

  return (
    <group>
      <mesh geometry={slab}>
        <meshToonMaterial vertexColors gradientMap={ramp} />
      </mesh>
      <mesh geometry={props}>
        <meshToonMaterial vertexColors gradientMap={ramp} />
      </mesh>
      <DeskNote journeyRef={journeyRef} />
    </group>
  )
}
