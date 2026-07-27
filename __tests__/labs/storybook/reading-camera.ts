/**
 * THE PINNED READING CAMERA, as the tests are allowed to use it.
 *
 * Every "screen px" claim in this lab has to come from book-scene.tsx's own
 * camera at the shipped 16:9 frame — never off a screenshot, never a number a
 * reviewer typed. This is that projection, lifted out of s5-vault.test.ts once a
 * second file (s5-round2.test.ts) needed it, so the two can never disagree about
 * where a piece lands.
 *
 * Not a `.test.ts`: it is a helper the runner must not collect.
 */

import type { Vec3 } from '@/components/labs/storybook/book/popup-mechanics'

const rad = (d: number): number => (d * Math.PI) / 180

export const EYE: Vec3 = [0, 1.85, 3.05]
export const LOOKAT: Vec3 = [0, 0.38, 0.05]
export const FOV_Y = rad(34)
export const FRAME_W = 1600
export const FRAME_H = 900

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}

const FWD = unit(sub(LOOKAT, EYE))
const RIGHT = unit(cross(FWD, [0, 1, 0]))
const UP = cross(RIGHT, FWD)
const TAN_H = Math.tan(FOV_Y / 2)
const ASPECT = FRAME_W / FRAME_H

export function toScreen(p: Vec3): [number, number] {
  const rel = sub(p, EYE)
  const cz = dot(rel, FWD)
  return [
    ((dot(rel, RIGHT) / (cz * TAN_H * ASPECT)) * 0.5 + 0.5) * FRAME_W,
    (1 - ((dot(rel, UP) / (cz * TAN_H)) * 0.5 + 0.5)) * FRAME_H,
  ]
}

export type ScreenBox = { w: number; h: number; x0: number; y0: number; x1: number; y1: number; area: number }

export function screenBox(quad: readonly Vec3[]): ScreenBox {
  const pts = quad.map(toScreen)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const x1 = Math.max(...xs)
  const y1 = Math.max(...ys)
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, area: (x1 - x0) * (y1 - y0) }
}

/** Do two screen boxes share any pixel? */
export const boxesOverlap = (a: ScreenBox, b: ScreenBox): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/** Shortest world edge of a quad — what handle-hit.ts's HANDLE_MIN_HIT floor is
 *  measured against before the slop pad is even applied. */
export function shortestEdge(quad: readonly Vec3[]): number {
  let m = Infinity
  for (let i = 0; i < 4; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % 4]
    m = Math.min(m, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))
  }
  return m
}
