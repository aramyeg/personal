/**
 * Procedural canvas textures for the WebGL pop-up book: aged paper,
 * tooled leather, a page-gutter crease shadow, a desk light-pool, and a
 * soft contact-shadow sprite. Client-only — canvas 2D context doesn't
 * exist during SSR — every export throws a clear error if invoked before
 * the component mounts in the browser. Consumers wrap the result in
 * `new THREE.CanvasTexture(...)` (Task 9+).
 *
 * Color values mirror the `--sb-*` custom properties in ./storybook.css.
 * Canvas fillStyle/strokeStyle can't read CSS custom properties without an
 * extra DOM round-trip per draw, so the hex literals are duplicated here —
 * keep the two files in sync if the palette changes.
 */

import { assertBrowser, createCanvas, clampByte } from './canvas-utils'

const PAPER = '#e7d5a8' // --sb-paper
const PAPER_AGED = '#c9b078' // --sb-paper-aged
const LEATHER = '#641e26' // --sb-leather
const LEATHER_SHADOW = '#4a151c' // --sb-leather-shadow
const GOLD = '#c9a227' // --sb-gold
const INK_TRANSPARENT = '#3b2a1a00' // --sb-ink, alpha 0
const INK_CREASE = '#3b2a1a8c' // --sb-ink, alpha ~0.55
const DESK = '#17100b' // --sb-desk
const DESK_POOL = '#8a5326' // warm --sb-desk/--sb-candle blend, baked pool center

/** Adds per-pixel luminance noise in [-amount, amount] across the canvas. */
function applyGrain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number): void {
  const imageData = ctx.getImageData(0, 0, w, h)
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.round((Math.random() * 2 - 1) * amount)
    data[i] = clampByte(data[i] + noise)
    data[i + 1] = clampByte(data[i + 1] + noise)
    data[i + 2] = clampByte(data[i + 2] + noise)
  }
  ctx.putImageData(imageData, 0, 0)
}

/**
 * 512×512 aged paper texture: `--sb-paper` base fill, ±7 luminance grain,
 * an even `--sb-paper-aged` aging wash so the base tone reads as warm
 * cream rather than a lit-white sheet, a continuous radial vignette
 * darkening smoothly from center to edge (no flat untouched center disc,
 * which is what previously read as a blown-out hotspot under scene
 * lighting), and a faint gold frame inset 6% from each side.
 */
export function makePaperCanvas(w = 512, h = 512): HTMLCanvasElement {
  assertBrowser('makePaperCanvas')
  const { canvas, ctx } = createCanvas(w, h)

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, w, h)

  applyGrain(ctx, w, h, 7)

  ctx.fillStyle = PAPER_AGED
  ctx.globalAlpha = 0.14
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 1

  const vignette = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.75)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, PAPER_AGED)
  ctx.fillStyle = vignette
  ctx.globalAlpha = 0.6
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 1

  const insetX = w * 0.06
  const insetY = h * 0.06
  ctx.strokeStyle = GOLD
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 2
  ctx.strokeRect(insetX, insetY, w - insetX * 2, h - insetY * 2)
  ctx.globalAlpha = 1

  return canvas
}

/** Draws a single dark leather pore fleck at a random position. */
function drawPore(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const x = Math.random() * w
  const y = Math.random() * h
  const r = 0.4 + Math.random() * 1.1
  ctx.globalAlpha = 0.2 + Math.random() * 0.25
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** Strokes a rectangle inset by `inset` on all sides at the given width/color. */
function strokeInsetRect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  inset: number,
  color: string,
  lineWidth: number,
  alpha: number
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.globalAlpha = alpha
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2)
  ctx.globalAlpha = 1
}

/**
 * Embossed double gold border: a `--sb-leather-shadow` line offset
 * down-right beneath a `--sb-gold` line offset up-left, so the pair reads
 * as a pressed/tooled groove rather than a flat outline.
 */
function drawEmbossedBorder(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const outerInset = w * 0.05
  const innerInset = w * 0.075

  strokeInsetRect(ctx, w, h, outerInset + 1, LEATHER_SHADOW, 2, 0.8)
  strokeInsetRect(ctx, w, h, innerInset + 1, LEATHER_SHADOW, 2, 0.8)
  strokeInsetRect(ctx, w, h, outerInset, GOLD, 1.5, 0.9)
  strokeInsetRect(ctx, w, h, innerInset, GOLD, 1.5, 0.9)
}

/**
 * 512×512 tooled leather texture: `--sb-leather` base fill, coarser
 * grain, scattered darker pores, and an embossed double gold border.
 */
export function makeLeatherCanvas(): HTMLCanvasElement {
  assertBrowser('makeLeatherCanvas')
  const w = 512
  const h = 512
  const { canvas, ctx } = createCanvas(w, h)

  ctx.fillStyle = LEATHER
  ctx.fillRect(0, 0, w, h)

  applyGrain(ctx, w, h, 10)

  const poreCount = Math.floor((w * h) / 180)
  ctx.fillStyle = LEATHER_SHADOW
  for (let i = 0; i < poreCount; i++) {
    drawPore(ctx, w, h)
  }

  drawEmbossedBorder(ctx, w, h)

  return canvas
}

/**
 * 64×256 dark transparent gradient strip: fully transparent along both
 * long edges, `--sb-ink`-tinted and ~55% opaque along the centerline. Maps
 * onto a narrow plane laid over the open spread's gutter (x≈0) as the
 * crease shadow where the two pages meet.
 */
export function makeCreaseCanvas(w = 64, h = 256): HTMLCanvasElement {
  assertBrowser('makeCreaseCanvas')
  const { canvas, ctx } = createCanvas(w, h)

  const gradient = ctx.createLinearGradient(0, 0, w, 0)
  gradient.addColorStop(0, INK_TRANSPARENT)
  gradient.addColorStop(0.5, INK_CREASE)
  gradient.addColorStop(1, INK_TRANSPARENT)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  return canvas
}

/**
 * 512×512 desk surface texture: `--sb-desk` base fill with a soft warm
 * light-pool baked in near the canvas center (where the tome sits under
 * the candle), fading back to near-black toward the edges of the frame —
 * gives the desk a visible "surface" even though it's otherwise a flat,
 * near-black color that would else blend into the void background.
 */
export function makeDeskCanvas(w = 512, h = 512): HTMLCanvasElement {
  assertBrowser('makeDeskCanvas')
  const { canvas, ctx } = createCanvas(w, h)

  ctx.fillStyle = DESK
  ctx.fillRect(0, 0, w, h)

  const pool = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.3)
  pool.addColorStop(0, DESK_POOL)
  pool.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = pool
  ctx.fillRect(0, 0, w, h)

  applyGrain(ctx, w, h, 4)

  return canvas
}

/**
 * 128×64 radial gradient (black → transparent) used as a soft contact
 * shadow beneath standing pop-up layers.
 */
export function makeShadowCanvas(): HTMLCanvasElement {
  assertBrowser('makeShadowCanvas')
  const w = 128
  const h = 64
  const { canvas, ctx } = createCanvas(w, h)

  const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  return canvas
}
