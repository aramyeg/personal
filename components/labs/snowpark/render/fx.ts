/**
 * FX layer (M2 juice, Task 6): a damped squash/stretch spring for the rider
 * and ambient speed lines at real speed. Hit-stop itself lives in
 * use-game-loop.ts (it needs to hold the whole sim, not just draw calls);
 * this module is the pure per-frame visual state the renderer reads.
 *
 * Same convention as particles.ts: private mutable state for a zero-alloc
 * per-frame update, RiderState is never touched, the renderer is the sole
 * caller. Gating decisions (which flags fire onLand/onLaunch) live in the
 * renderer, not here — this module only knows "land" and "launch" happened.
 */
import { palette } from '../palette'

export type Fx = {
  onLand(impact: number): void
  onLaunch(): void
  update(dt: number): void
  riderScale(): { sx: number; sy: number }
  drawSpeedLines(ctx: CanvasRenderingContext2D, w: number, h: number, speed01: number): void
}

export const FX = {
  /** spring constants pulling (sx, sy) back to (1, 1) */
  STIFF: 90,
  DAMP: 12,
  /** landing squash: opposed, area-conserving */
  LAND_SY: 0.35,
  LAND_SX: 0.35,
  /** launch stretch: smaller, fixed (not impact-scaled) */
  LAUNCH_SY: 1.12,
  LAUNCH_SX: 0.92,
  /** speed lines only draw above this speed01 */
  SPEED_LINE_THRESHOLD: 0.72,
  SPEED_LINE_COUNT: 12,
  SPEED_LINE_LEN_MIN: 40,
  SPEED_LINE_LEN_SPAN: 120,
  SPEED_LINE_ALPHA_MAX: 0.18,
} as const

/** Deterministic 0..1 hash of two integers — same convention as particles.ts
 * (`fract(sin(n)*43758.5453)`) so speed lines shimmer over time without ever
 * calling into an RNG. */
function hash(i: number, n: number): number {
  const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
  return v - Math.floor(v)
}

export function createFx(): Fx {
  // Rider scale spring, at rest (1, 1).
  let scaleX = 1
  let scaleY = 1
  let velX = 0
  let velY = 0
  // Own clock (fed by update(dt)), not sim time — this is what freezes
  // the shimmer during hit-stop, since the renderer passes dt === 0 then.
  let time = 0

  function onLand(impact: number): void {
    scaleY = 1 - FX.LAND_SY * impact
    scaleX = 1 + FX.LAND_SX * impact
    velY = 0
    velX = 0
  }

  function onLaunch(): void {
    scaleY = FX.LAUNCH_SY
    scaleX = FX.LAUNCH_SX
    velY = 0
    velX = 0
  }

  function update(dt: number): void {
    time += dt
    if (dt <= 0) return
    // Semi-implicit Euler on a damped spring toward (1, 1) — stabler than
    // explicit Euler for these stiffness/damping values.
    const ax = -FX.STIFF * (scaleX - 1) - FX.DAMP * velX
    const ay = -FX.STIFF * (scaleY - 1) - FX.DAMP * velY
    velX += ax * dt
    velY += ay * dt
    scaleX += velX * dt
    scaleY += velY * dt
  }

  function riderScale(): { sx: number; sy: number } {
    return { sx: scaleX, sy: scaleY }
  }

  function drawSpeedLines(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    speed01: number
  ): void {
    if (speed01 <= FX.SPEED_LINE_THRESHOLD) return
    const intensity =
      (speed01 - FX.SPEED_LINE_THRESHOLD) / (1 - FX.SPEED_LINE_THRESHOLD)
    const len = FX.SPEED_LINE_LEN_MIN + FX.SPEED_LINE_LEN_SPAN * intensity
    const alpha = FX.SPEED_LINE_ALPHA_MAX * intensity

    ctx.strokeStyle = palette.ink
    ctx.lineWidth = 2
    for (let i = 0; i < FX.SPEED_LINE_COUNT; i++) {
      // Seed combines the shimmer clock and the line index, per line — never
      // Math.random, just a slowly-stepping hash (8 buckets/sec).
      const seed = Math.floor(time * 8) + i
      const inTopThird = i < FX.SPEED_LINE_COUNT / 2
      const band = hash(0, seed)
      const bandY = inTopThird ? h * (band / 3) : h * (2 / 3 + band / 3)
      const xEnd = w * hash(1, seed)
      const x0 = xEnd - len
      const shimmer = 0.55 + 0.45 * hash(2, seed)

      ctx.globalAlpha = alpha * shimmer
      ctx.beginPath()
      ctx.moveTo(x0, bandY)
      ctx.lineTo(xEnd, bandY)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  return { onLand, onLaunch, update, riderScale, drawSpeedLines }
}
