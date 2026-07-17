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
import { RIVER_CROSSINGS } from '@/components/labs/small-world/scene/biomes'
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
    for (const rho of [0, 0.7, 2.1, 5.5]) {
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
    // the pinned rhos sit clear of all crossings, so no deck applies
    for (const rho of [0, 0.7, 2.1, 5.5]) {
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

  it('lap 2: the deck is present again a full rotation later at every crossing', () => {
    // Two full planet laps (ROTATION_TOTAL = 4π) mean the girl passes each
    // crossing twice. bridgeDeckYAt must wrap the query theta so the second
    // pass still lands on the plank, not the carved river floor beneath it.
    const TWO_PI = Math.PI * 2
    for (const tc of RIVER_CROSSINGS) {
      const rot = rotationFor(tc)
      const lap1 = walkYAt(STANCE_Z, rot)
      const lap2 = walkYAt(STANCE_Z, rot + TWO_PI)
      expect(lap2).toBeCloseTo(lap1, 10)
      // and it's genuinely the deck, not a coincidental terrain match
      expect(lap2).toBeGreaterThan(surfaceYAt(STANCE_Z, rot + TWO_PI))
    }
  })

  it('lap 2: dry ground away from crossings is unchanged a full rotation later', () => {
    const TWO_PI = Math.PI * 2
    for (const rho of [0, 0.7, 2.1, 5.5]) {
      expect(walkYAt(STANCE_Z, rho + TWO_PI)).toBeCloseTo(walkYAt(STANCE_Z, rho), 10)
    }
  })
})
