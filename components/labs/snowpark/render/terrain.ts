/**
 * Powder Lines terrain (Task 8) — the layer that turns the diagram into a place.
 *
 * Three concerns live here:
 *   1. `drawTerrain` — the near snowfield as a FILLED body (vertical snow
 *      gradient) with a rim-lit crest and the rider's carve line raked into the
 *      surface. Replaces the v1 single stroke line.
 *   2. `drawParallax` — one of three distance bands, each a filled ridge
 *      silhouette hazed toward the horizon, sprinkled with pine props, cached
 *      to an offscreen canvas and scrolled by a per-band parallax factor.
 *   3. `drawForeground` — a rare, fast foreground occluder (a large dark pine)
 *      that sweeps past to sell depth on the near side.
 *
 * Color helpers (`mix`, `darken` on #rrggbb hex) live here too; the renderer
 * reuses `mix` for phase-aware obstacle strokes.
 *
 * Render-layer state exception (documented, mirrors render/particles.ts and
 * render/sky.ts): the three band offscreen caches and the body gradient are
 * private, mutable module state kept for zero per-frame allocation. Each band
 * is rasterized once and re-rasterized only when its phase colors (string
 * compare) or the viewport size change; every other frame is a single
 * translated drawImage. Sim state is never touched; the renderer is the sole
 * caller, and there is no Math.random anywhere — scatter is a fixed hash.
 */
import { slopeY } from '../slope'
import { palette } from '../palette'
import type { Course, Stretch } from '../course'
import type { PhaseColors } from './sky'

/**
 * Everything a terrain/band layer needs to place world points on screen. The
 * brief's sketch is `{ camX, camY, zoom, w, h, p }`; `ox`/`oy` are added
 * because the screen transform needs the viewport anchor (and camera shake)
 * baked into it — the same offset the obstacle layer uses, so terrain shakes
 * in lockstep with the course.
 */
export type TerrainView = {
  camX: number
  camY: number
  zoom: number
  ox: number
  oy: number
  w: number
  h: number
  /** run progress 0..1 (available for future phase-tuned depth) */
  p: number
}

/** Live view of the particle trail ring — the carve line's source. */
export type CarveLine = { x: Float64Array; y: Float64Array; len: number }

/**
 * The three distance bands, farthest first. `factor` is the parallax scroll
 * fraction (smaller = farther, slower), `height` the ridge base as a fraction
 * of viewport height, `ampScale` the ridge amplitude multiplier, `alpha` the
 * blit opacity. GATE C tunes these.
 */
export const BANDS = [
  { factor: 0.12, height: 0.42, ampScale: 2.6, alpha: 1.0 },
  { factor: 0.28, height: 0.55, ampScale: 1.8, alpha: 1.0 },
  { factor: 0.5, height: 0.7, ampScale: 1.2, alpha: 1.0 },
] as const

export type Band = (typeof BANDS)[number]

const TAU = Math.PI * 2
const TERRAIN_STEP_PX = 16
const RIDGE_STEP_PX = 8
/** Ridge octave wavelengths (px). Sampled at tile-locked frequencies so the
 * cached strip repeats seamlessly (see `tileFreq`). */
const RIDGE_WAVE1 = 340
const RIDGE_WAVE2 = 130
/** Per-band ridge phase — keeps the three silhouettes from rhyming. */
const BAND_SEED = [0.7, 2.4, 4.2] as const
/** Haze mix per band (index 0 = farthest = most fogged toward `colors.haze`). */
const HAZE_BY_INDEX = [0.6, 0.375, 0.15] as const
/** Full-width fog veil laid between bands. */
const HAZE_VEIL_ALPHA = 0.22
/** Snow body gradient: crest → `darken(snow, BODY_DARKEN)` at the bottom. */
const BODY_DARKEN = 0.12
/** Rim light: 3px lit crest then a 1px snow core. */
const RIM_WIDTH = 3
const RIM_ALPHA = 0.9
const RIM_TINT = 0.5
const CORE_WIDTH = 1
/** Carve line raked into the surface. */
const CARVE_WIDTH = 1.5
const CARVE_DARKEN = 0.25
/** Band pines: sparse, hashed along the ridge, taller on nearer bands. */
const PINE_STEP = 210
const PINE_SPARSITY = 0.45
const PINE_MIX = 0.5
const PINE_BASE_H = 34
/** Foreground occluder pine. */
const FG_FACTOR = 1.35
const FG_ALPHA = 0.9
const FG_SPACING_MUL = 4.5
const FG_MARGIN = 0.35
const FG_HEIGHT = 0.3
const FG_SEED = 91

// --- color helpers ----------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => clampByte(Math.round(v)).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** Linear RGB blend of two #rrggbb colors; t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

/** Pull a color `amt` (0..1) toward black. */
export function darken(hex: string, amt: number): string {
  return mix(hex, '#000000', amt)
}

// --- deterministic scatter --------------------------------------------------

/** 0..1 hash of two integers — the module-wide scatter convention
 * (`fract(sin(...)*43758.5453)`); never Math.random. */
function hash(i: number, n: number): number {
  const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
  return v - Math.floor(v)
}

function mod(a: number, m: number): number {
  return ((a % m) + m) % m
}

// --- screen transform -------------------------------------------------------

const tsx = (v: TerrainView, wx: number): number => (wx - v.camX) * v.zoom + v.ox
const tsy = (v: TerrainView, wy: number): number => (wy - v.camY) * v.zoom + v.oy
const twx = (v: TerrainView, sx: number): number => (sx - v.ox) / v.zoom + v.camX

// --- terrain body -----------------------------------------------------------

// Rebuilt only when the snow color or viewport height changes; skyColors
// quantizes to #rrggbb so most frames reuse the same gradient.
let bodyGrad: CanvasGradient | null = null
let bodyGradCtx: CanvasRenderingContext2D | null = null
let bodyGradKey = ''

function bodyGradient(ctx: CanvasRenderingContext2D, h: number, snow: string): CanvasGradient {
  const key = `${snow}|${h}`
  if (bodyGrad && ctx === bodyGradCtx && key === bodyGradKey) return bodyGrad
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, snow)
  g.addColorStop(1, darken(snow, BODY_DARKEN))
  bodyGrad = g
  bodyGradCtx = ctx
  bodyGradKey = key
  return g
}

/** Trace the snowline across the viewport (screen space, every 16px) — the
 * open top edge shared by the body fill and the rim stroke. */
function traceSnowlineTop(ctx: CanvasRenderingContext2D, v: TerrainView): void {
  let first = true
  for (let px = -TERRAIN_STEP_PX; px <= v.w + TERRAIN_STEP_PX; px += TERRAIN_STEP_PX) {
    const py = tsy(v, slopeY(twx(v, px)))
    if (first) {
      ctx.moveTo(px, py)
      first = false
    } else {
      ctx.lineTo(px, py)
    }
  }
}

/**
 * The near snowfield: a filled body under the snowline (vertical snow
 * gradient), a rim-lit crest, and the rider's carve line raked into it.
 */
export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  v: TerrainView,
  colors: PhaseColors,
  carve: CarveLine,
): void {
  // Filled body down to the viewport floor.
  ctx.beginPath()
  traceSnowlineTop(ctx, v)
  ctx.lineTo(v.w + TERRAIN_STEP_PX, v.h)
  ctx.lineTo(-TERRAIN_STEP_PX, v.h)
  ctx.closePath()
  ctx.fillStyle = bodyGradient(ctx, v.h, colors.snow)
  ctx.fill()

  // Rim light: a broad lit crest, then a thin snow core inside it.
  ctx.beginPath()
  traceSnowlineTop(ctx, v)
  ctx.globalAlpha = RIM_ALPHA
  ctx.lineWidth = RIM_WIDTH
  ctx.strokeStyle = mix(colors.sun, '#ffffff', RIM_TINT)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.lineWidth = CORE_WIDTH
  ctx.strokeStyle = colors.snow
  ctx.stroke()

  // Carve line: the board's recent path raked into the surface.
  if (carve.len >= 2) {
    ctx.strokeStyle = darken(colors.snow, CARVE_DARKEN)
    ctx.lineWidth = CARVE_WIDTH
    ctx.beginPath()
    ctx.moveTo(tsx(v, carve.x[0]), tsy(v, carve.y[0]))
    for (let i = 1; i < carve.len; i++) {
      ctx.lineTo(tsx(v, carve.x[i]), tsy(v, carve.y[i]))
    }
    ctx.stroke()
  }
}

// --- parallax bands ---------------------------------------------------------

type BandCache = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  key: string
}

const bandCaches: (BandCache | null)[] = BANDS.map(() => null)

/** Dev probe for GATE C: how often the band blit hit vs missed the cache. */
export const bandCacheStats = { hits: 0, misses: 0 }

/** Tile-locked angular frequency nearest `1/wave`, so a ridge sampled over
 * [0, bandW] meets itself at the seam (ridge(0) === ridge(bandW)). */
function tileFreq(bandW: number, wave: number): number {
  const k = Math.max(1, Math.round(bandW / (TAU * wave)))
  return (TAU * k) / bandW
}

function ridgeY(
  x: number,
  base: number,
  ampScale: number,
  seed: number,
  a1: number,
  a2: number,
): number {
  return base + ampScale * (55 * Math.sin(x * a1 + seed) + 24 * Math.sin(x * a2 + seed * 2))
}

/** Two stacked triangles — a distant pine silhouette. Caller sets fillStyle. */
function drawPine(ctx: CanvasRenderingContext2D, x: number, baseY: number, hgt: number): void {
  const wd = hgt * 0.42
  ctx.beginPath()
  ctx.moveTo(x, baseY - hgt)
  ctx.lineTo(x - wd, baseY)
  ctx.lineTo(x + wd, baseY)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x, baseY - hgt * 1.45)
  ctx.lineTo(x - wd * 0.62, baseY - hgt * 0.5)
  ctx.lineTo(x + wd * 0.62, baseY - hgt * 0.5)
  ctx.closePath()
  ctx.fill()
}

function renderBandPines(
  ctx: CanvasRenderingContext2D,
  bandW: number,
  h: number,
  index: number,
  fill: string,
  seed: number,
  a1: number,
  a2: number,
  ampScale: number,
  base: number,
): void {
  ctx.fillStyle = mix(palette.ink, fill, PINE_MIX)
  const size = PINE_BASE_H * (0.6 + index * 0.35)
  let i = 0
  for (let x = PINE_STEP * 0.5; x < bandW - PINE_STEP * 0.5; x += PINE_STEP) {
    i += 1
    if (hash(i, index * 3 + 1) < PINE_SPARSITY) continue
    const jx = x + (hash(i, index * 3 + 2) - 0.5) * PINE_STEP * 0.5
    const y = ridgeY(jx, base, ampScale, seed, a1, a2)
    drawPine(ctx, jx, y, size * (0.75 + hash(i, index * 3 + 3) * 0.5))
  }
}

/** Rasterize one band (ridge fill + pines) into its offscreen strip. */
function renderBand(
  ctx: CanvasRenderingContext2D,
  bandW: number,
  h: number,
  band: Band,
  index: number,
  fill: string,
): void {
  ctx.clearRect(0, 0, bandW, h)
  const base = band.height * h
  const seed = BAND_SEED[index]
  const a1 = tileFreq(bandW, RIDGE_WAVE1)
  const a2 = tileFreq(bandW, RIDGE_WAVE2)

  ctx.beginPath()
  ctx.moveTo(0, ridgeY(0, base, band.ampScale, seed, a1, a2))
  for (let x = RIDGE_STEP_PX; x <= bandW; x += RIDGE_STEP_PX) {
    ctx.lineTo(x, ridgeY(x, base, band.ampScale, seed, a1, a2))
  }
  ctx.lineTo(bandW, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()

  renderBandPines(ctx, bandW, h, index, fill, seed, a1, a2, band.ampScale, base)
}

/** Reuse or (re)build the band's offscreen strip; rebuild only on color or
 * size change. Strip is 2× viewport wide so one translated blit (or two at a
 * wrap) always covers the screen. */
function ensureBandCache(
  index: number,
  v: TerrainView,
  colors: PhaseColors,
  band: Band,
  fill: string,
): BandCache {
  const bandW = Math.max(2, Math.round(v.w * 2))
  const h = Math.max(2, Math.round(v.h))
  const key = `${fill}|${bandW}|${h}`

  let cache = bandCaches[index]
  if (cache && cache.key === key) {
    bandCacheStats.hits += 1
    return cache
  }
  bandCacheStats.misses += 1

  if (!cache) {
    const canvas = document.createElement('canvas')
    const c = canvas.getContext('2d')
    if (!c) throw new Error('snowpark terrain: band cache 2D context unavailable')
    cache = { canvas, ctx: c, key: '' }
    bandCaches[index] = cache
  }
  if (cache.canvas.width !== bandW || cache.canvas.height !== h) {
    cache.canvas.width = bandW
    cache.canvas.height = h
  }
  renderBand(cache.ctx, bandW, h, band, index, fill)
  cache.key = key
  return cache
}

/** Blit one parallax band, scrolled by `camX * factor`. */
export function drawParallax(
  ctx: CanvasRenderingContext2D,
  v: TerrainView,
  colors: PhaseColors,
  band: Band,
  index: number,
): void {
  const fill = mix(colors.band, colors.haze, HAZE_BY_INDEX[index])
  const cache = ensureBandCache(index, v, colors, band, fill)
  const bandW = cache.canvas.width
  const shift = mod(v.camX * band.factor, bandW)

  ctx.globalAlpha = band.alpha
  ctx.drawImage(cache.canvas, -shift, 0)
  if (-shift + bandW < v.w) ctx.drawImage(cache.canvas, -shift + bandW, 0)
  ctx.globalAlpha = 1
}

/** Full-width fog veil, laid between bands for atmospheric depth. */
export function drawHazeVeil(
  ctx: CanvasRenderingContext2D,
  colors: PhaseColors,
  w: number,
  h: number,
): void {
  ctx.globalAlpha = HAZE_VEIL_ALPHA
  ctx.fillStyle = colors.haze
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 1
}

// --- foreground occluder ----------------------------------------------------

/**
 * A rare, fast foreground pine sweeping past on the near side (factor 1.35).
 * Occluders are anchored to a fixed world spacing wide enough that at most one
 * is on screen; the nearest is drawn per frame with hashed size/jitter, no
 * allocation, no Math.random.
 */
export function drawForeground(
  ctx: CanvasRenderingContext2D,
  v: TerrainView,
  colors: PhaseColors,
): void {
  const spacing = FG_SPACING_MUL * v.w
  const scroll = v.camX * FG_FACTOR
  const k0 = Math.floor(scroll / spacing)
  ctx.fillStyle = darken(mix(palette.ink, colors.band, 0.2), 0.15)
  for (let k = k0; k <= k0 + 1; k++) {
    const screenX = v.ox + (k * spacing - scroll)
    if (screenX < -v.w * FG_MARGIN || screenX > v.w * (1 + FG_MARGIN)) continue
    const jitter = (hash(k, FG_SEED) - 0.5) * v.w * 0.1
    const hgt = v.h * (FG_HEIGHT + hash(k, FG_SEED + 1) * 0.15)
    ctx.globalAlpha = FG_ALPHA
    drawPine(ctx, screenX + jitter, v.h + hgt * 0.1, hgt)
    ctx.globalAlpha = 1
  }
}

// --- per-stretch props (Task 12) --------------------------------------------
//
// course.stretches carries real course geometry — the same world-x units as
// the obstacles and the carve line. The three parallax bands above are the
// opposite: rasterized once into 2×-viewport offscreen strips and tiled by a
// scroll factor (see ensureBandCache/drawParallax), with no fixed
// relationship to world x — baking stretch-specific props into a strip would
// desync from the actual stretch boundary the moment that strip repeats. So
// stretch flavor is a separate, uncached, live pass: drawn every frame with
// the SAME factor-1 world transform (tsx/tsy) as the near terrain body,
// scattered directly against `slopeY`, so a prop sits exactly where its
// stretch is and scrolls in lockstep with the obstacles it borders.

const STRETCH_PROP_STEP = 150
const STRETCH_PROP_MARGIN = 0.2
const STRETCH_PROP_MIX = 0.45
/** hash namespace offset so this pass never rhymes with band-pine scatter */
const STRETCH_SEED = 500

type PropKind = 'pine-dense' | 'rock-spur' | 'flag' | 'sparse' | 'boulder' | 'gate'

/** Spec: "each stretch shifts palette/props subtly" — one silhouette
 * variation per category, same ink-line language, no new colors. */
const PROP_KIND_BY_CATEGORY: Record<Stretch['category'], PropKind> = {
  frontend: 'pine-dense',
  mobile: 'rock-spur',
  state: 'flag',
  styling: 'sparse',
  backend: 'boulder',
  tools: 'gate',
  fun: 'sparse', // course.stretches never emits a 'fun' stretch; exhaustive fallback
}

/** Spacing multiplier, skip-chance, and height multiplier per prop kind —
 * the "subtly" in the spec: denser/sparser/taller, never a new shape family
 * for kinds that share one (pine-dense and sparse both reuse `drawPine`). */
const PROP_TUNING: Record<PropKind, { stepMul: number; sparsity: number; heightMul: number }> = {
  'pine-dense': { stepMul: 0.55, sparsity: 0.2, heightMul: 1 },
  'rock-spur': { stepMul: 1, sparsity: 0.35, heightMul: 0.8 },
  flag: { stepMul: 1.3, sparsity: 0.3, heightMul: 0.6 },
  // styling bowl: sparse and pulled back — mostly skipped, and small when it
  // does spawn, so the bowl reads open rather than tree-lined.
  sparse: { stepMul: 2.2, sparsity: 0.75, heightMul: 0.55 },
  boulder: { stepMul: 1.1, sparsity: 0.4, heightMul: 0.7 },
  gate: { stepMul: 0.8, sparsity: 0.25, heightMul: 0.9 },
}

/** Mobile ridge: an angular rock outcrop silhouette (vs. the pine's soft
 * triangles) — same ink-fill convention, different shape family. */
function drawRockSpur(ctx: CanvasRenderingContext2D, x: number, baseY: number, hgt: number): void {
  const w = hgt * 0.55
  ctx.beginPath()
  ctx.moveTo(x - w, baseY)
  ctx.lineTo(x - w * 0.25, baseY - hgt * 0.6)
  ctx.lineTo(x + w * 0.1, baseY - hgt)
  ctx.lineTo(x + w * 0.5, baseY - hgt * 0.35)
  ctx.lineTo(x + w, baseY)
  ctx.closePath()
  ctx.fill()
}

/** State park: a small flag on a post — caller sets fill/stroke once per
 * stretch, so this only draws. */
function drawFlagPost(ctx: CanvasRenderingContext2D, x: number, baseY: number, hgt: number): void {
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, baseY)
  ctx.lineTo(x, baseY - hgt)
  ctx.stroke()
  const fw = hgt * 0.55
  ctx.beginPath()
  ctx.moveTo(x, baseY - hgt)
  ctx.lineTo(x + fw, baseY - hgt * 0.82)
  ctx.lineTo(x, baseY - hgt * 0.66)
  ctx.closePath()
  ctx.fill()
}

/** Backend flats: a small cluster of round boulders, hashed off `seedI` so a
 * reused step index never repeats the same cluster shape. */
function drawBoulderCluster(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  hgt: number,
  seedI: number,
): void {
  for (let k = 0; k < 3; k++) {
    const bx = x + (hash(seedI, STRETCH_SEED + 10 + k) - 0.5) * hgt * 1.3
    const br = hgt * (0.22 + hash(seedI, STRETCH_SEED + 20 + k) * 0.2)
    ctx.beginPath()
    ctx.arc(bx, baseY - br, br, 0, TAU)
    ctx.fill()
  }
}

/** Tooling run-out: a slalom-style gate pole — thin post with a small ball
 * tip, spaced tighter than the other kinds (see PROP_TUNING) for the
 * run-out's gate rhythm. */
function drawGatePole(ctx: CanvasRenderingContext2D, x: number, baseY: number, hgt: number): void {
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, baseY)
  ctx.lineTo(x, baseY - hgt)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, baseY - hgt, 2.5, 0, TAU)
  ctx.fill()
}

function drawStretchProp(
  ctx: CanvasRenderingContext2D,
  kind: PropKind,
  x: number,
  baseY: number,
  hgt: number,
  seedI: number,
): void {
  switch (kind) {
    case 'pine-dense':
    case 'sparse':
      drawPine(ctx, x, baseY, hgt)
      return
    case 'rock-spur':
      drawRockSpur(ctx, x, baseY, hgt)
      return
    case 'flag':
      drawFlagPost(ctx, x, baseY, hgt)
      return
    case 'boulder':
      drawBoulderCluster(ctx, x, baseY, hgt, seedI)
      return
    case 'gate':
      drawGatePole(ctx, x, baseY, hgt)
      return
  }
}

function stretchOnScreen(v: TerrainView, stretch: Stretch): boolean {
  const left = tsx(v, stretch.startX)
  const right = tsx(v, stretch.endX)
  return right > -v.w * STRETCH_PROP_MARGIN && left < v.w * (1 + STRETCH_PROP_MARGIN)
}

function drawOneStretch(
  ctx: CanvasRenderingContext2D,
  v: TerrainView,
  stretch: Stretch,
  fill: string,
): void {
  if (!stretchOnScreen(v, stretch)) return
  const kind = PROP_KIND_BY_CATEGORY[stretch.category]
  const tuning = PROP_TUNING[kind]
  const step = STRETCH_PROP_STEP * tuning.stepMul
  ctx.fillStyle = fill
  ctx.strokeStyle = fill
  const start = Math.floor(stretch.startX / step) * step
  let i = Math.round(start / step)
  for (let wx = start; wx < stretch.endX; wx += step, i++) {
    if (wx < stretch.startX) continue
    if (hash(i, STRETCH_SEED) < tuning.sparsity) continue
    const jx = wx + (hash(i, STRETCH_SEED + 1) - 0.5) * step * 0.4
    if (jx < stretch.startX || jx >= stretch.endX) continue
    const hgt = PINE_BASE_H * tuning.heightMul * (0.75 + hash(i, STRETCH_SEED + 2) * 0.5)
    drawStretchProp(ctx, kind, tsx(v, jx), tsy(v, slopeY(jx)), hgt, i)
  }
}

/** Live per-stretch prop pass — each category stretch reads distinct without
 * a new color or a new silhouette family. See the file-level note above for
 * why this can't be baked into the cached band strips. */
export function drawStretchProps(
  ctx: CanvasRenderingContext2D,
  v: TerrainView,
  colors: PhaseColors,
  course: Course,
): void {
  const fill = mix(palette.ink, colors.band, STRETCH_PROP_MIX)
  for (const stretch of course.stretches) {
    drawOneStretch(ctx, v, stretch, fill)
  }
}
