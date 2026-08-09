/**
 * The towed chain: a verlet chain pinned ONLY at the chibi's fists (index 0),
 * free at the far end. The first `stringLen` px are the visible string; the
 * rest is the cloth's top hem. Every point is sprung toward an art-directed
 * trailing baseline (droop shrinks with travel speed) so the macro shape is
 * designed while wind, grabs and her strides supply the motion — jerry's
 * trick, re-aimed.
 *
 * A visitor grab pins one chain point to the pointer; tension propagates to
 * the fist through the distance constraints, and the release whip falls out
 * of the verlet for free (the pinned point keeps its last displacement as
 * velocity).
 *
 * Pure module: no three.js, no DOM. Coordinates are y-DOWN pixels. Hot-loop
 * state is mutated in place by design — this is a 60 Hz particle sim, not
 * app state.
 */

import { CFG } from './config'

export interface ChainPoint {
  x: number
  y: number
  px: number
  py: number
  fx: number
  fy: number
}

export interface Chain {
  pts: ChainPoint[]
  n: number
  /** unstretched segment rest length */
  seg: number
  /** cumulative arc-length table, rebuilt each step */
  cum: number[]
  fist: { x: number; y: number }
  /** string run before the cloth's leading corner, px */
  stringLen: number
  /** total designed length (string + hem), px */
  length: number
  /** designed droop depth at zero speed, px */
  droopPx: number
  /** index of the currently grabbed point, or -1 */
  grabIndex: number
  /** grabbed point minus the pointer at grab time, px. The pin follows the
   * pointer THROUGH this offset, so taking hold displaces nothing: a click
   * that teleported the point to the cursor injected a tension spike the
   * chibi read as a heave (measured stretch 1.4 against a 0.06 reference). */
  grabDX: number
  grabDY: number
}

export interface ChainStepEnv {
  time: number
  /** travel speed, px/s — streams the chain and flattens the droop */
  speed: number
  /** wind energy multiplier */
  wind: number
  /** pointer position while a grab is active (grabIndex >= 0) */
  grabX?: number
  grabY?: number
}

export function createChain(opts: {
  fistX: number
  fistY: number
  stringLen: number
  hemLen: number
  viewportH: number
  n?: number
}): Chain {
  const n = opts.n ?? CFG.chain.n
  const length = opts.stringLen + opts.hemLen
  const droopPx = opts.viewportH * CFG.chain.droop
  const pts: ChainPoint[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const x = opts.fistX - t * length
    const y = opts.fistY + droopPx * Math.pow(t, 1.35)
    pts.push({ x, y, px: x, py: y, fx: 0, fy: 0 })
  }
  const chain: Chain = {
    pts,
    n,
    seg: (length / (n - 1)) * CFG.chain.slack,
    cum: [0],
    fist: { x: opts.fistX, y: opts.fistY },
    stringLen: opts.stringLen,
    length,
    droopPx,
    grabIndex: -1,
    grabDX: 0,
    grabDY: 0,
  }
  rebuildArcTable(chain)
  return chain
}

export function rebuildArcTable(chain: Chain): void {
  const { pts, cum, n } = chain
  cum[0] = 0
  for (let i = 1; i < n; i++) {
    cum[i] =
      cum[i - 1] +
      Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  }
}

export function chainLength(chain: Chain): number {
  return chain.cum[chain.n - 1]
}

/** Position at s px along the chain (arc-length parametrized). */
export function atLength(chain: Chain, s: number): { x: number; y: number } {
  const { pts, cum, n } = chain
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

export function addForceAt(
  chain: Chain,
  s: number,
  fx: number,
  fy: number
): void {
  const { pts, cum, n } = chain
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
    if (i <= 0 || i >= n) continue
    const w = KERNEL[k + 2]
    pts[i].fx += fx * w
    pts[i].fy += fy * w
  }
}

export function setFist(chain: Chain, x: number, y: number): void {
  chain.fist.x = x
  chain.fist.y = y
}

/** Index of the chain point nearest to (x, y), hem points only. */
export function nearestHemIndex(chain: Chain, x: number, y: number): number {
  const { pts, cum, n, stringLen } = chain
  let best = -1
  let bestD = Infinity
  for (let i = 1; i < n; i++) {
    if (cum[i] < stringLen) continue
    const d = Math.hypot(pts[i].x - x, pts[i].y - y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** Index of the chain point at s px along the chain. */
export function indexAtLength(chain: Chain, s: number): number {
  const { cum, n } = chain
  let best = 1
  let bestD = Infinity
  for (let i = 1; i < n; i++) {
    const d = Math.abs(cum[i] - s)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** Take hold of a point. Pass the pointer position to hold it where it is
 * rather than snapping it to the cursor. */
export function grabChain(
  chain: Chain,
  index: number,
  pointerX?: number,
  pointerY?: number
): void {
  const i = Math.max(1, Math.min(chain.n - 1, index))
  chain.grabIndex = i
  chain.grabDX = pointerX === undefined ? 0 : chain.pts[i].x - pointerX
  chain.grabDY = pointerY === undefined ? 0 : chain.pts[i].y - pointerY
}

export function releaseChain(chain: Chain): void {
  chain.grabIndex = -1
  chain.grabDX = 0
  chain.grabDY = 0
}

/** Mean stretch of the leading segments — the tension the chibi feels. */
export function fistStretch(chain: Chain): number {
  const { pts, seg } = chain
  let acc = 0
  const k = 3
  for (let i = 0; i < k; i++) {
    const d = Math.hypot(
      pts[i + 1].x - pts[i].x,
      pts[i + 1].y - pts[i].y
    )
    acc += Math.max(0, d - seg) / seg
  }
  return acc / k
}

export function stepChain(chain: Chain, dt: number, env: ChainStepEnv): void {
  const { pts, n, fist, droopPx, length } = chain
  const C = CFG.chain

  pts[0].x = fist.x
  pts[0].y = fist.y
  pts[0].px = fist.x
  pts[0].py = fist.y

  const speedN = Math.min(1, env.speed / CFG.motion.cruise)
  const droop =
    droopPx * (1 - (1 - C.droopMovingFrac) * speedN)
  const gi = chain.grabIndex

  for (let i = 1; i < n; i++) {
    const q = pts[i]
    if (i === gi && env.grabX !== undefined && env.grabY !== undefined) {
      // pointer pin: keep last displacement so release inherits velocity
      q.px = q.x
      q.py = q.y
      q.x = env.grabX + chain.grabDX
      q.y = env.grabY + chain.grabDY
      q.fx = 0
      q.fy = 0
      continue
    }
    const t = i / (n - 1)
    const bx = fist.x - t * length
    const by = fist.y + droop * Math.pow(t, 1.35)
    const ax =
      q.fx +
      (bx - q.x) * C.baselineStiffness -
      env.speed * C.travelDrag +
      C.windX * env.wind * Math.sin(env.time * 1.7 + q.x * 0.01)
    const ay =
      q.fy +
      C.gravity +
      (by - q.y) * C.baselineStiffness +
      C.windY * env.wind * Math.sin(env.time * 2.3 + q.x * 0.02)
    const vx = (q.x - q.px) * C.damping
    const vy = (q.y - q.py) * C.damping
    q.px = q.x
    q.py = q.y
    q.x += vx + ax * dt * dt
    q.y += vy + ay * dt * dt
    q.fx = 0
    q.fy = 0
  }

  for (let k = 0; k < C.iterations; k++) {
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 1e-4
      const f = ((d - chain.seg) / d) * 0.5
      const ox = dx * f
      const oy = dy * f
      const aPinned = i === 0
      const bPinned = i + 1 === gi
      const aGrabbed = i === gi
      if (!aPinned && !aGrabbed) {
        a.x += ox
        a.y += oy
      }
      if (!bPinned) {
        b.x -= ox
        b.y -= oy
      }
    }
  }

  for (let i = 1; i < n - 1; i++) {
    if (i === gi) continue
    const q = pts[i]
    const mx = (pts[i - 1].x + pts[i + 1].x) * 0.5
    const my = (pts[i - 1].y + pts[i + 1].y) * 0.5
    q.x += (mx - q.x) * C.smooth
    q.y += (my - q.y) * C.smooth
  }

  rebuildArcTable(chain)
}
