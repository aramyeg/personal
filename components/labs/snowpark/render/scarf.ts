/**
 * The rider's scarf (M4, Task 9) — the Alto moment. A verlet chain pinned at
 * the neck that lags, swings, and whips on launches, drawn as a tapering amber
 * polyline.
 *
 * EXCEPTION (documented, mirrors render/particles.ts): the chain's point and
 * previous-point arrays are private, mutable render-layer state — the whole
 * point of verlet is that this frame's positions are integrated from the last.
 * Sim state (`RiderState`) is never touched; the renderer is the sole caller,
 * feeding it the (already fx-scaled) neck anchor, the wind, and dt each frame.
 * With dt === 0 (hit-stop) it freezes, exactly like the fx spring.
 *
 * Wind is the renderer's `-vxEquiv · 0.9` (rider speed opposes the scarf), plus
 * a small per-point hash flutter here so the cloth ripples — no RNG anywhere.
 */
import { palette } from '../palette'

export type Scarf = {
  update(anchorX: number, anchorY: number, windX: number, dt: number): void
  draw(ctx: CanvasRenderingContext2D): void
  reset(x: number, y: number): void
}

export const SCARF = {
  POINTS: 26,
  SEG: 3.2,
  ITER: 3,
  GRAVITY: 500,
  /** verlet velocity retention per step (drag) */
  DAMP: 0.98,
  /** per-point wind flutter amplitude (world units/s²) */
  FLUTTER: 40,
  /** taper: width at the neck → width at the tail (px, world) */
  WIDTH_HEAD: 4,
  WIDTH_TAIL: 1.5,
  ALPHA: 0.95,
} as const

/** Deterministic 0..1 hash — the shared v1 convention; the only scatter source
 * in the flutter, so nothing here calls into an RNG. */
function hash(i: number, n: number): number {
  const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
  return v - Math.floor(v)
}

export function createScarf(): Scarf {
  const n = SCARF.POINTS
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const px = new Float64Array(n)
  const py = new Float64Array(n)
  // Own clock, driven by update(dt) — the flutter phase. Freezes with the sim
  // during hit-stop since dt collapses to 0 then (see use-game-loop.ts).
  let clock = 0

  /** Collapse the chain onto the anchor, hanging straight down at rest — used
   * on spawn/respawn so a backward x-jump never leaves a stretched streak. */
  function reset(ax: number, ay: number): void {
    for (let i = 0; i < n; i++) {
      const cx = ax
      const cy = ay + i * SCARF.SEG
      x[i] = cx
      y[i] = cy
      px[i] = cx
      py[i] = cy
    }
  }

  function update(anchorX: number, anchorY: number, windX: number, dt: number): void {
    // Keep the root pinned but integrate nothing while frozen — the (pos−prev)
    // inertia would otherwise drift the cloth through a hit-stop.
    if (dt <= 0) {
      x[0] = anchorX
      y[0] = anchorY
      return
    }
    clock += dt
    const dt2 = dt * dt
    const flutterBucket = Math.floor(clock * 12)

    for (let i = 1; i < n; i++) {
      const flutter = (hash(i, flutterBucket) - 0.5) * 2 * SCARF.FLUTTER
      const accelX = windX + flutter
      const vx = (x[i] - px[i]) * SCARF.DAMP
      const vy = (y[i] - py[i]) * SCARF.DAMP
      px[i] = x[i]
      py[i] = y[i]
      x[i] += vx + accelX * dt2
      y[i] += vy + SCARF.GRAVITY * dt2
    }

    // Pin the root, then relax the segment-length constraints a few passes.
    x[0] = anchorX
    y[0] = anchorY
    px[0] = anchorX
    py[0] = anchorY
    for (let k = 0; k < SCARF.ITER; k++) {
      x[0] = anchorX
      y[0] = anchorY
      for (let i = 0; i < n - 1; i++) {
        const dx = x[i + 1] - x[i]
        const dy = y[i + 1] - y[i]
        const d = Math.hypot(dx, dy) || 1e-6
        const diff = (d - SCARF.SEG) / d
        // Point 0 is pinned: move only the far end of its segment.
        const m0 = i === 0 ? 0 : 0.5
        const m1 = i === 0 ? 1 : 0.5
        x[i] += dx * diff * m0
        y[i] += dy * diff * m0
        x[i + 1] -= dx * diff * m1
        y[i + 1] -= dy * diff * m1
      }
    }
  }

  function draw(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = palette.amber
    ctx.globalAlpha = SCARF.ALPHA
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const last = n - 1
    for (let i = 0; i < last; i++) {
      const t = i / last
      ctx.lineWidth = SCARF.WIDTH_HEAD + (SCARF.WIDTH_TAIL - SCARF.WIDTH_HEAD) * t
      ctx.beginPath()
      ctx.moveTo(x[i], y[i])
      ctx.lineTo(x[i + 1], y[i + 1])
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  return { update, draw, reset }
}
