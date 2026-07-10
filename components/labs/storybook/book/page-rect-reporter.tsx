'use client'

/**
 * r3f child, renders nothing: projects the open spread's four page corners
 * to viewport pixels and writes the result to the store as `pageRect`, so
 * `overlay/spread-overlay.tsx` (plain HTML, outside the canvas) can position
 * itself exactly over the resting spread. Mounted directly under `<Canvas>`
 * in `book-scene.tsx` — a sibling of `<ParallaxRig>`, not nested inside it,
 * so the projection uses the book's rest transform (identity) rather than
 * chasing the parallax tilt frame by frame; the spec treats the camera as
 * fixed and the mapping as a stable rect, recomputed only on resize.
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { useStorybookStore } from '../store'
import { PAGE_H, PAGE_W } from './page-geometry'
import { ndcToPageRect } from './viewport-rect'

// The open spread's four corners in world space: spine at x=0, the two page
// blocks extending to ±PAGE_W, page height spanning ±PAGE_H/2.
const SPREAD_CORNERS: readonly [number, number, number][] = [
  [-PAGE_W, 0, -PAGE_H / 2],
  [-PAGE_W, 0, PAGE_H / 2],
  [PAGE_W, 0, -PAGE_H / 2],
  [PAGE_W, 0, PAGE_H / 2],
]

export function PageRectReporter() {
  const { camera, size } = useThree()
  const setPageRect = useStorybookStore((s) => s.setPageRect)
  const vector = useRef(new THREE.Vector3())

  useEffect(() => {
    const v = vector.current
    const ndcCorners = SPREAD_CORNERS.map(([x, y, z]) => {
      v.set(x, y, z)
      v.project(camera)
      return { x: v.x, y: v.y }
    })
    setPageRect(ndcToPageRect(ndcCorners, size.width, size.height))
  }, [camera, size, setPageRect])

  return null
}
