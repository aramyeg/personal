/**
 * Pure math: turns a set of already-projected NDC points (from
 * `THREE.Vector3.project(camera)`, i.e. x/y in [-1, 1] with +y up) into a
 * viewport-pixel bounding rect, +y down (CSS coordinates). No three.js
 * import — this is the testable half of `page-rect-reporter.tsx`, which
 * supplies the projection itself (that part needs a live camera/canvas).
 */

import type { PageRect } from '../store'

export type NdcPoint = { x: number; y: number }

export function ndcToPageRect(
  corners: readonly NdcPoint[],
  canvasWidth: number,
  canvasHeight: number
): PageRect {
  const xs = corners.map((c) => ((c.x + 1) / 2) * canvasWidth)
  const ys = corners.map((c) => ((1 - c.y) / 2) * canvasHeight)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const right = Math.max(...xs)
  const bottom = Math.max(...ys)
  return { left, top, width: right - left, height: bottom - top }
}
