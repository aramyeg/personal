/**
 * Powder Lines sky — the first Alto-atmosphere layer (Task 7).
 *
 * Two concerns live here:
 *   1. `skyColors(p)` — pure, unit-testable phase math. A run's progress
 *      `p = clamp(rider.x / course.finishX, 0, 1)` drives a piecewise-linear
 *      walk through the pinned PHASES palette (dawn → noon → alpenglow →
 *      night), returning every color the atmosphere layers need this frame.
 *   2. `drawSky(ctx, w, h, p, t)` — the flat background fill's replacement:
 *      a cached top→horizon gradient, the one sanctioned soft-halo sun that
 *      arcs down toward the horizon (and reads as a moon once the palette
 *      goes night), and snowfall that ramps in over the back half of the run.
 *
 * Render-layer state exception (documented, mirrors render/particles.ts):
 * the gradient cache and the snowfall seed pool are private, immutable-after-
 * seed module state kept for zero per-frame allocation. Sim state is never
 * touched; the renderer is the sole caller.
 */

export type PhaseColors = {
  top: string
  horizon: string
  sun: string
  haze: string
  snow: string
  band: string
  /** 0→1 across the night phase — drives Task 12's marker glow. */
  glow01: number
}

/**
 * Pinned day-cycle stops (GATE C tunes). `at` is progress 0..1; between two
 * stops every channel lerps in RGB. Values past the last stop hold night.
 */
export const PHASES = [
  { at: 0.0, top: '#cfe0ec', horizon: '#f2dfc4', sun: '#e6b95c', haze: '#dfe9f0', snow: '#f3f7fa', band: '#9db6c8' },
  { at: 0.3, top: '#d8e9f2', horizon: '#eef3f6', sun: '#e9c97e', haze: '#e4edf2', snow: '#eef3f6', band: '#8fa9bd' },
  { at: 0.58, top: '#a9bcd8', horizon: '#eab387', sun: '#d9843f', haze: '#c9c3cf', snow: '#e8e3e6', band: '#6d7f9e' },
  { at: 0.82, top: '#0e1f30', horizon: '#2c4a62', sun: '#d8e4ee', haze: '#16293a', snow: '#adc3d4', band: '#22384c' },
] as const

export const SKY = {
  /** night-glow ramp window (progress) */
  GLOW_LO: 0.78,
  GLOW_HI: 0.92,
  /** sun arc: screen-fraction position as a function of p */
  SUN_X0: 0.78,
  SUN_X1: 0.5,
  SUN_Y0: 0.16,
  SUN_Y1: 0.42,
  /** disc radius as a fraction of height; halo extends to HALO_MUL× that */
  SUN_R: 0.055,
  HALO_MUL: 2.2,
  HALO_ALPHA: 0.35,
  /** snowfall: begins past START_P, count ramps to MAX at p=1 */
  SNOW_START: 0.62,
  SNOW_MAX: 60,
  SNOW_FALL_MIN: 32,
  SNOW_FALL_MAX: 70,
  /** leftward drift as a fraction of each flake's fall speed */
  SNOW_DRIFT: 0.45,
  SNOW_SIZE_MIN: 1.5,
  SNOW_SIZE_MAX: 2.5,
  SNOW_ALPHA: 0.7,
} as const

const TAU = Math.PI * 2

// --- pure phase math --------------------------------------------------------

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function channel(v: number): string {
  return Math.round(v).toString(16).padStart(2, '0')
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const r = ar + (br - ar) * t
  const g = ag + (bg - ag) * t
  const bl = ab + (bb - ab) * t
  return `#${channel(r)}${channel(g)}${channel(bl)}`
}

/**
 * Colors for progress `p`. Piecewise-linear RGB lerp between the two PHASES
 * stops that bracket `p`; at a stop (or past the last one) returns that stop
 * exactly. Pure — the same `p` always yields the same colors.
 */
export function skyColors(p: number): PhaseColors {
  const c = clamp01(p)
  let i = 0
  while (i < PHASES.length - 1 && c > PHASES[i + 1].at) i++
  const a = PHASES[i]
  const b = PHASES[Math.min(i + 1, PHASES.length - 1)]
  const span = b.at - a.at
  const t = span > 0 ? clamp01((c - a.at) / span) : 0
  return {
    top: lerpHex(a.top, b.top, t),
    horizon: lerpHex(a.horizon, b.horizon, t),
    sun: lerpHex(a.sun, b.sun, t),
    haze: lerpHex(a.haze, b.haze, t),
    snow: lerpHex(a.snow, b.snow, t),
    band: lerpHex(a.band, b.band, t),
    glow01: smoothstep(SKY.GLOW_LO, SKY.GLOW_HI, c),
  }
}

// --- gradient cache ---------------------------------------------------------

// Rebuilt only when the two hex stops (or the canvas height / context) change.
// skyColors quantizes to #rrggbb, so tiny per-frame p changes collapse to the
// same string most frames and the gradient is reused.
let gradCtx: CanvasRenderingContext2D | null = null
let gradTop = ''
let gradHorizon = ''
let gradH = 0
let gradient: CanvasGradient | null = null

function skyGradient(
  ctx: CanvasRenderingContext2D,
  h: number,
  top: string,
  horizon: string,
): CanvasGradient {
  if (gradient && ctx === gradCtx && h === gradH && top === gradTop && horizon === gradHorizon) {
    return gradient
  }
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, top)
  g.addColorStop(1, horizon)
  gradient = g
  gradCtx = ctx
  gradH = h
  gradTop = top
  gradHorizon = horizon
  return g
}

// --- snowfall pool ----------------------------------------------------------

/** Deterministic 0..1 hash — the v1 convention from render/particles.ts. */
function hash(i: number, n: number): number {
  const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
  return v - Math.floor(v)
}

function mod(a: number, m: number): number {
  return ((a % m) + m) % m
}

/**
 * Fixed pool of per-flake constants, seeded once. Each flake's on-screen
 * position is a closed form of these seeds and sim-time `t` (base fraction +
 * fall/drift), so there is no per-frame mutation, no allocation, and the field
 * is identical for a given `t` — no Math.random anywhere.
 */
type SnowPool = {
  baseX: Float64Array
  baseY: Float64Array
  fall: Float64Array
  size: Float64Array
}

function createSnowPool(n: number): SnowPool {
  const baseX = new Float64Array(n)
  const baseY = new Float64Array(n)
  const fall = new Float64Array(n)
  const size = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    baseX[i] = hash(i, 1)
    baseY[i] = hash(i, 2)
    fall[i] = SKY.SNOW_FALL_MIN + hash(i, 3) * (SKY.SNOW_FALL_MAX - SKY.SNOW_FALL_MIN)
    size[i] = SKY.SNOW_SIZE_MIN + hash(i, 4) * (SKY.SNOW_SIZE_MAX - SKY.SNOW_SIZE_MIN)
  }
  return { baseX, baseY, fall, size }
}

const snowPool = createSnowPool(SKY.SNOW_MAX)

function drawSnow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  t: number,
  snowHex: string,
): void {
  if (p <= SKY.SNOW_START) return
  const density = clamp01((p - SKY.SNOW_START) / (1 - SKY.SNOW_START))
  const count = Math.round(density * SKY.SNOW_MAX)
  if (count === 0) return
  const cycleW = w + 40
  const cycleH = h + 20
  ctx.globalAlpha = SKY.SNOW_ALPHA
  ctx.fillStyle = snowHex
  for (let i = 0; i < count; i++) {
    const fall = snowPool.fall[i]
    const y = mod(snowPool.baseY[i] * cycleH + t * fall, cycleH) - 10
    const x = mod(snowPool.baseX[i] * cycleW - t * fall * SKY.SNOW_DRIFT, cycleW) - 20
    ctx.beginPath()
    ctx.arc(x, y, snowPool.size[i], 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// --- draw -------------------------------------------------------------------

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/**
 * Screen-space background (drawn before the camera transform). Fills the
 * cached day-cycle gradient, lays the arcing sun with its one soft halo, then
 * the ramping snowfall on top. `t` is sim-time (`state.time`), used only for
 * snowfall drift.
 */
export function drawSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  t: number,
): void {
  const c = skyColors(p)

  ctx.fillStyle = skyGradient(ctx, h, c.top, c.horizon)
  ctx.fillRect(0, 0, w, h)

  // Sun arcs from upper-right toward the horizon as p rises; past night it is
  // the same disc reading as a moon via the night sun color.
  const sunX = (SKY.SUN_X0 - (SKY.SUN_X0 - SKY.SUN_X1) * p) * w
  const sunY = (SKY.SUN_Y0 + (SKY.SUN_Y1 - SKY.SUN_Y0) * p) * h
  const sunR = SKY.SUN_R * h
  const haloR = sunR * SKY.HALO_MUL

  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, haloR)
  halo.addColorStop(0, rgba(c.sun, SKY.HALO_ALPHA))
  halo.addColorStop(1, rgba(c.sun, 0))
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(sunX, sunY, haloR, 0, TAU)
  ctx.fill()

  ctx.fillStyle = c.sun
  ctx.beginPath()
  ctx.arc(sunX, sunY, sunR, 0, TAU)
  ctx.fill()

  drawSnow(ctx, w, h, p, t, c.snow)
}
