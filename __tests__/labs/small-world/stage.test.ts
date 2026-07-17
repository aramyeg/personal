import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  anchorTransform,
  chapterTheta,
  STANCE_ALPHA,
  STANCE_Z,
  walkYAt,
} from '@/components/labs/small-world/scene/stage'
import { PLANET_RADIUS, surfaceYAt, terrainBump } from '@/components/labs/small-world/scene/planet'
import { RIVER_CROSSINGS, CROSSINGS_A, CROSSINGS_B } from '@/components/labs/small-world/scene/biomes'
import { chapterStartRotation, CHAPTER_SLICE } from '@/components/labs/small-world/journey-timeline'

describe('stage math', () => {
  it('STANCE_ALPHA is the stance angle from the apex', () => {
    expect(Math.sin(STANCE_ALPHA) * PLANET_RADIUS).toBeCloseTo(STANCE_Z, 10)
  })

  it('chapterTheta spans exactly one slice per chapter, offset by the stance angle', () => {
    expect(chapterTheta(2, 0)).toBeCloseTo(chapterStartRotation(2) + STANCE_ALPHA, 10)
    expect(chapterTheta(2, 1) - chapterTheta(2, 0)).toBeCloseTo(CHAPTER_SLICE, 10)
  })

  it('anchorTransform sits exactly on the displaced terrain', () => {
    for (const [theta, x] of [
      [0.3, 0],
      [1.4, 0.6],
      [4.0, -0.8],
    ] as const) {
      const { position } = anchorTransform(theta, x)
      const pre = position.clone().normalize().multiplyScalar(PLANET_RADIUS)
      const expected = PLANET_RADIUS * (1 + terrainBump(pre.x, pre.y, pre.z))
      expect(position.length()).toBeCloseTo(expected, 6)
    }
  })

  it('the anchor under the girl matches surfaceYAt after the planet rotation', () => {
    // rhos sit clear of every crossing so the ground is gentle (Task 20 R2 deepened
    // the A2 delta crossing, so rho=5.5 → theta≈5.85 now grazes that carved channel
    // and its radial dip drifts world.z past the 0.05 tolerance — use 4.9, matching
    // the walkYAt test's clear-of-crossings sample).
    for (const rho of [0, 0.7, 2.1, 4.9]) {
      const { position } = anchorTransform(STANCE_ALPHA + rho, 0)
      const world = position.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -rho)
      expect(world.x).toBeCloseTo(0, 6)
      expect(world.z).toBeCloseTo(STANCE_Z, 1)
      expect(world.y).toBeCloseTo(surfaceYAt(STANCE_Z, rho), 1)
    }
  })

  it('quaternion maps +Y to the radial direction', () => {
    const { position, quaternion } = anchorTransform(2.0, 0.5)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion)
    expect(up.dot(position.clone().normalize())).toBeCloseTo(1, 6)
  })
})

describe('walkYAt (bridge decks)', () => {
  /** rotation that puts local theta under the girl's stance. */
  const rotationFor = (theta: number): number => theta - STANCE_ALPHA

  it('equals surfaceYAt away from every crossing', () => {
    // the pinned rhos sit clear of all crossings, so no deck applies (updated for
    // Task 20's crossings 1.70 / 3.52 / 5.80 — 5.5 now grazes the A2 deck)
    for (const rho of [0, 0.7, 2.1, 4.9]) {
      expect(walkYAt(STANCE_Z, rho)).toBeCloseTo(surfaceYAt(STANCE_Z, rho), 10)
    }
  })

  it('lifts above the carved river at each crossing centre', () => {
    for (const tc of RIVER_CROSSINGS) {
      const rot = rotationFor(tc)
      const deck = walkYAt(STANCE_Z, rot)
      const terrain = surfaceYAt(STANCE_Z, rot)
      expect(deck).toBeGreaterThan(terrain)
    }
  })

  it('is continuous across a ramp — no step in the deck profile', () => {
    const tc = RIVER_CROSSINGS[0]
    let prev = walkYAt(STANCE_Z, rotationFor(tc) - 0.2)
    let maxDelta = 0
    for (let k = 1; k <= 20; k++) {
      const theta = tc - 0.2 + (0.4 * k) / 20
      const y = walkYAt(STANCE_Z, rotationFor(theta))
      maxDelta = Math.max(maxDelta, Math.abs(y - prev))
      prev = y
    }
    expect(maxDelta).toBeLessThan(0.05)
  })

  it('lap 2: the girl rides the B-variant deck at each B crossing (spine per-lap)', () => {
    // Task 20: the crossings diverge per lap (CROSSINGS_A on lap 1, CROSSINGS_B on
    // lap 2). Over each B crossing longitude on lap 2 she must land on the plank —
    // a real lift over the B-terrain-carved creek floor beneath it.
    const TWO_PI = Math.PI * 2
    for (const tc of CROSSINGS_B) {
      const rot = tc - STANCE_ALPHA + TWO_PI // girl over this longitude on lap 2
      const deck = walkYAt(STANCE_Z, rot)
      const terrain = surfaceYAt(STANCE_Z, rot)
      expect(deck).toBeGreaterThan(terrain)
      expect(deck - terrain).toBeGreaterThan(0.02) // genuinely on the deck, not a graze
    }
  })

  it('lap 2: the A-crossing longitudes are DRY (their decks retired to B) + dry lane follows B terrain', () => {
    // The complement pin: the lap-1 (A) crossings carry no deck on lap 2 — proof
    // the spine truly changed — and plain lane longitudes follow the B surface with
    // no deck lift.
    const TWO_PI = Math.PI * 2
    for (const tc of CROSSINGS_A) {
      const rot = tc - STANCE_ALPHA + TWO_PI
      expect(walkYAt(STANCE_Z, rot)).toBeCloseTo(surfaceYAt(STANCE_Z, rot), 10)
    }
    for (const tc of [1.0, 2.9, 5.0]) {
      const rot = tc - STANCE_ALPHA + TWO_PI
      expect(walkYAt(STANCE_Z, rot)).toBeCloseTo(surfaceYAt(STANCE_Z, rot), 10)
    }
  })
})
