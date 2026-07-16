import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  anchorTransform,
  chapterTheta,
  STANCE_ALPHA,
  STANCE_Z,
} from '@/components/labs/small-world/scene/stage'
import { PLANET_RADIUS, surfaceYAt, terrainBump } from '@/components/labs/small-world/scene/planet'
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
