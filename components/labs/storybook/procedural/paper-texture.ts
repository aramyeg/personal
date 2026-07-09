/**
 * Procedural canvas textures for the WebGL pop-up book: aged paper,
 * tooled leather, and a soft contact-shadow sprite. Client-only — canvas
 * 2D context doesn't exist during SSR — every export throws a clear error
 * if invoked before the component mounts in the browser. Consumers wrap
 * the result in `new THREE.CanvasTexture(...)` (Task 9+).
 *
 * Color values mirror the `--sb-*` custom properties in ./storybook.css.
 * Canvas fillStyle/strokeStyle can't read CSS custom properties without an
 * extra DOM round-trip per draw, so the hex literals are duplicated here —
 * keep the two files in sync if the palette changes.
 */

const PAPER = '#e7d5a8' // --sb-paper
const PAPER_AGED = '#c9b078' // --sb-paper-aged
const LEATHER = '#641e26' // --sb-leather
const LEATHER_SHADOW = '#4a151c' // --sb-leather-shadow
const GOLD = '#c9a227' // --sb-gold

function assertBrowser(fnName: string): void {
  if (typeof document === 'undefined') {
    throw new Error(`storybook/procedural: ${fnName}() is client-only and requires document`)
  }
}

function createCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('storybook/procedural: 2d canvas context unavailable')
  return { canvas, ctx }
}

function clampByte(v: number): number {
  return Math.min(255, Math.max(0, v))
}

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
 * 512×512 aged paper texture: `--sb-paper` base fill, ±6 luminance grain,
 * a `--sb-paper-aged` vignette darkening toward the edges, and a faint 1px
 * gold frame inset 6% from each side.
 */
export function makePaperCanvas(w = 512, h = 512): HTMLCanvasElement {
  assertBrowser('makePaperCanvas')
  const { canvas, ctx } = createCanvas(w, h)

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, w, h)

  applyGrain(ctx, w, h, 6)

  const vignette = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.32,
    w / 2,
    h / 2,
    Math.min(w, h) * 0.72
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, PAPER_AGED)
  ctx.fillStyle = vignette
  ctx.globalAlpha = 0.5
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 1

  const insetX = w * 0.06
  const insetY = h * 0.06
  ctx.strokeStyle = GOLD
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1
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
