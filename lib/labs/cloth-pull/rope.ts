/**
 * Verlet rope sprung toward an art-directed baseline (jerry's trick):
 * the sim only supplies deviation — wind, banner weight, hauls — while the
 * macro shape stays designed. Pinned at the hand (i = 0) and the far anchor.
 *
 * Pure module: no three.js, no DOM. Coordinates are y-DOWN pixels.
 * Hot-loop state is mutated in place by design — this is a 60 Hz particle
 * sim, not app state.
 */

import { CFG } from './config'

export interface RopePoint {
  x: number
  y: number
  px: number
  py: number
  fx: number
  fy: number
  pin: boolean
}

export interface Rope {
  pts: RopePoint[]
  n: number
  /** unstretched segment rest length */
  seg: number
  /** cumulative arc-length table, rebuilt each step */
  cum: number[]
  hand: { x: number; y: number }
  anchor: { x: number; y: number }
  /** designed sag depth in px */
  sagPx: number
}

export interface RopeStepEnv {
  time: number
  /** 0..1+, tautens the line and scales wind down */
  tension: number
  /** wind energy multiplier */
  wind: number
}

export function createRope(opts: {
  handX: number
  handY: number
  anchorX: number
  anchorY: number
  viewportH: number
  n?: number
}): Rope {
  const n = opts.n ?? CFG.rope.n
  const hand = { x: opts.handX, y: opts.handY }
  const anchor = { x: opts.anchorX, y: opts.anchorY }
  const sagPx = opts.viewportH * CFG.rope.sag
  const pts: RopePoint[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const x = hand.x + (anchor.x - hand.x) * t
    const y = hand.y + (anchor.y - hand.y) * t + Math.sin(Math.PI * t) * sagPx
    pts.push({ x, y, px: x, py: y, fx: 0, fy: 0, pin: i === 0 || i === n - 1 })
  }
  const seg =
    (Math.hypot(anchor.x - hand.x, anchor.y - hand.y) / (n - 1)) *
    CFG.rope.slack
  const rope: Rope = { pts, n, seg, cum: [0], hand, anchor, sagPx }
  rebuildArcTable(rope)
  return rope
}

export function rebuildArcTable(rope: Rope): void {
  const { pts, cum, n } = rope
  cum[0] = 0
  for (let i = 1; i < n; i++) {
    cum[i] =
      cum[i - 1] +
      Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  }
}

export function ropeLength(rope: Rope): number {
  return rope.cum[rope.n - 1]
}

/** Position at s px along the rope (arc-length parametrized, binary search). */
export function atLength(rope: Rope, s: number): { x: number; y: number } {
  const { pts, cum, n } = rope
  const sc = Math.max(0, Math.min(s, cum[n - 1] - 1e-3))
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (cum[m] <= sc) lo = m
    else hi = m
  }
  const t = (sc - cum[lo]) / (cum[lo + 1] - cum[lo] || 1)
  const a = pts[lo]
  const b = pts[lo + 1]
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Spread an external force over a 5-tap kernel around arc position s. */
const KERNEL = [0.15, 0.22, 0.26, 0.22, 0.15]

export function addForceAt(rope: Rope, s: number, fx: number, fy: number): void {
  const { pts, cum, n } = rope
  const sc = Math.max(0, Math.min(s, cum[n - 1] - 1e-3))
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (cum[m] <= sc) lo = m
    else hi = m
  }
  for (let k = -2; k <= 2; k++) {
    const i = lo + k
    if (i <= 0 || i >= n - 1) continue
    const w = KERNEL[k + 2]
    pts[i].fx += fx * w
    pts[i].fy += fy * w
  }
}

export function setHand(rope: Rope, x: number, y: number): void {
  rope.hand.x = x
  rope.hand.y = y
}

/**
 * One fixed step: integrate toward the designed baseline, satisfy distance
 * constraints (tension shortens rest length), then one smoothing pass.
 */
export function stepRope(rope: Rope, dt: number, env: RopeStepEnv): void {
  const { pts, n, hand, anchor, sagPx } = rope
  const C = CFG.rope
  const last = n - 1

  pts[0].x = hand.x
  pts[0].y = hand.y
  pts[0].px = hand.x
  pts[0].py = hand.y

  const tautSag = sagPx * Math.max(0.25, 1 - env.tension * 0.7)
  const windAmp = env.wind * Math.max(0.2, 1 - env.tension * 0.6)

  for (let i = 1; i < last; i++) {
    const q = pts[i]
    const t = i / last
    const bx = hand.x + (anchor.x - hand.x) * t
    const by =
      hand.y + (anchor.y - hand.y) * t + Math.sin(Math.PI * t) * tautSag
    const ax =
      q.fx +
      (bx - q.x) * C.baselineStiffness +
      C.windX * windAmp * Math.sin(env.time * 1.7 + q.x * 0.01)
    const ay =
      q.fy +
      C.gravity +
      (by - q.y) * C.baselineStiffness +
      C.windY * windAmp * Math.sin(env.time * 2.3 + q.x * 0.02)
    const vx = (q.x - q.px) * C.damping
    const vy = (q.y - q.py) * C.damping
    q.px = q.x
    q.py = q.y
    q.x += vx + ax * dt * dt
    q.y += vy + ay * dt * dt
    q.fx = 0
    q.fy = 0
  }

  const rest = rope.seg * (1 - Math.min(env.tension, 1.4) * C.tensionShorten)
  for (let k = 0; k < C.iterations; k++) {
    for (let i = 0; i < last; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 1e-4
      const f = ((d - rest) / d) * 0.5
      const ox = dx * f
      const oy = dy * f
      if (!a.pin) {
        a.x += ox
        a.y += oy
      }
      if (!b.pin) {
        b.x -= ox
        b.y -= oy
      }
    }
  }

  for (let i = 1; i < last; i++) {
    const q = pts[i]
    const mx = (pts[i - 1].x + pts[i + 1].x) * 0.5
    const my = (pts[i - 1].y + pts[i + 1].y) * 0.5
    q.x += (mx - q.x) * C.smooth
    q.y += (my - q.y) * C.smooth
  }

  rebuildArcTable(rope)
}
