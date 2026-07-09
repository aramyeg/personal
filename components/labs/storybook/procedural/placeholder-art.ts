import type { LayerKind } from '../content'
import { assertBrowser, createCanvas, clampByte } from './canvas-utils'

/**
 * Placeholder "paper-cut" silhouettes for the pop-up book's four layer
 * kinds, standing in for hand-painted art until AI-generated art lands
 * (see .superpowers/sdd/task-8-brief.md). Client-only — canvas 2D doesn't
 * exist during SSR, so `makePlaceholderLayer` throws if called before the
 * component mounts in the browser.
 *
 * Every silhouette is bottom-anchored: the shapes' base sits on the
 * canvas's bottom edge, which stands for the layer's fold line in the
 * pop-up book. Shapes are generated from a seeded PRNG so the same
 * chapter always renders the same placeholder, and different chapters
 * (different seeds) get visibly different shapes.
 */

const CANVAS_W = 1024
const CANVAS_H = 512
const OUTLINE_LIGHTEN = 18
const OUTLINE_WIDTH = 3

/**
 * mulberry32: a tiny, fast, deterministic 32-bit PRNG. Same seed always
 * produces the same sequence, which is what makes a chapter's placeholder
 * shapes stable across re-renders.
 */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Lightens a `#rrggbb` hex color by `amount` per channel (clamped). */
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = clampByte(((n >> 16) & 255) + amount)
  const g = clampByte(((n >> 8) & 255) + amount)
  const b = clampByte((n & 255) + amount)
  return `rgb(${r}, ${g}, ${b})`
}

function pickAccent(accents: readonly string[], i: number): string {
  return accents[i % accents.length]
}

/** Fills a shape with `color`, then strokes a lighter cut-edge outline on top. */
function paintCutout(ctx: CanvasRenderingContext2D, path: Path2D, color: string): void {
  ctx.fillStyle = color
  ctx.fill(path)
  ctx.lineJoin = 'round'
  ctx.lineWidth = OUTLINE_WIDTH
  ctx.strokeStyle = lighten(color, OUTLINE_LIGHTEN)
  ctx.stroke(path)
}

/**
 * A rounded hump (mountain, skyline swell, or mound) built from two
 * quarter-ellipse arcs sharing an apex at `(cx, baseY - height)`. Using
 * ellipse arcs (rather than quadratic curves) guarantees a smoothly
 * rounded silhouette regardless of the radii; `leftR`/`rightR` may differ
 * so the hump leans — that asymmetry, not vertex jitter, is what makes
 * repeated humps read as organic rather than identical domes.
 */
function humpPath(cx: number, baseY: number, leftR: number, rightR: number, height: number): Path2D {
  const path = new Path2D()
  path.moveTo(cx - leftR, baseY)
  path.ellipse(cx, baseY, leftR, height, 0, Math.PI, 1.5 * Math.PI)
  path.ellipse(cx, baseY, rightR, height, 0, 1.5 * Math.PI, 2 * Math.PI)
  path.closePath()
  return path
}

/**
 * A rectangular wall topped with a triangular roof whose eaves overhang
 * the wall slightly — the overhang is what keeps the roof reading as a
 * distinct cap rather than merging into a single spike.
 */
function buildingPath(x: number, wallW: number, wallH: number, roofH: number, baseY: number): Path2D {
  const path = new Path2D()
  const left = x
  const right = x + wallW
  const wallTop = baseY - wallH
  const roofPeak = wallTop - roofH
  const midX = x + wallW / 2
  const eave = wallW * 0.1
  const eaveLeft = left - eave
  const eaveRight = right + eave

  path.moveTo(left, baseY)
  path.lineTo(left, wallTop)
  path.lineTo(eaveLeft, wallTop)
  path.lineTo(midX, roofPeak)
  path.lineTo(eaveRight, wallTop)
  path.lineTo(right, wallTop)
  path.lineTo(right, baseY)
  path.closePath()
  return path
}

/** A symmetric trapezoid — used for the hero figure's body. */
function trapezoidPath(cx: number, baseY: number, bottomW: number, topW: number, height: number): Path2D {
  const path = new Path2D()
  const topY = baseY - height

  path.moveTo(cx - bottomW / 2, baseY)
  path.lineTo(cx - topW / 2, topY)
  path.lineTo(cx + topW / 2, topY)
  path.lineTo(cx + bottomW / 2, baseY)
  path.closePath()
  return path
}

function circlePath(cx: number, cy: number, r: number): Path2D {
  const path = new Path2D()
  path.arc(cx, cy, r, 0, Math.PI * 2)
  return path
}

/** backdrop: 3 overlapping rounded mountain/skyline humps. */
function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, accents: readonly string[], rand: () => number): void {
  const baseY = h
  const count = 3
  for (let i = 0; i < count; i++) {
    const cx = w * (0.2 + 0.3 * i) + (rand() - 0.5) * w * 0.12
    const halfWidth = w * (0.24 + rand() * 0.12)
    const leftR = halfWidth * (0.75 + rand() * 0.5)
    const rightR = halfWidth * (0.75 + rand() * 0.5)
    const height = h * (0.38 + rand() * 0.22)
    paintCutout(ctx, humpPath(cx, baseY, leftR, rightR, height), pickAccent(accents, i))
  }
}

/** midground: 4-6 buildings with triangle roofs, spread across the width. */
function drawMidground(ctx: CanvasRenderingContext2D, w: number, h: number, accents: readonly string[], rand: () => number): void {
  const baseY = h
  const count = 4 + Math.floor(rand() * 3) // 4..6 inclusive
  const slot = w / count

  for (let i = 0; i < count; i++) {
    const wallW = slot * (0.6 + rand() * 0.3)
    const wallH = h * (0.14 + rand() * 0.16)
    const roofH = wallW * (0.3 + rand() * 0.25)
    const x = slot * i + (slot - wallW) * rand()
    paintCutout(ctx, buildingPath(x, wallW, wallH, roofH, baseY), pickAccent(accents, i))
  }
}

/** hero: a centered blob figure (circle head + trapezoid body) on a small mound. */
function drawHero(ctx: CanvasRenderingContext2D, w: number, h: number, accents: readonly string[], rand: () => number): void {
  const baseY = h
  const cx = w / 2 + (rand() - 0.5) * w * 0.06

  const moundHalf = w * (0.16 + rand() * 0.05)
  const moundLeftR = moundHalf * (0.85 + rand() * 0.3)
  const moundRightR = moundHalf * (0.85 + rand() * 0.3)
  const moundH = h * (0.12 + rand() * 0.04)
  paintCutout(ctx, humpPath(cx, baseY, moundLeftR, moundRightR, moundH), pickAccent(accents, 0))

  const bodyBaseY = baseY - moundH * 0.65
  const bodyH = h * (0.34 + rand() * 0.08)
  const bottomW = w * (0.16 + rand() * 0.03)
  const topW = bottomW * (0.6 + rand() * 0.15)
  paintCutout(ctx, trapezoidPath(cx, bodyBaseY, bottomW, topW, bodyH), pickAccent(accents, 1))

  const headR = w * (0.045 + rand() * 0.015)
  const headCy = bodyBaseY - bodyH - headR * 0.7
  paintCutout(ctx, circlePath(cx, headCy, headR), pickAccent(accents, 2))
}

/** foreground: a scalloped fringe strip running along the bottom edge. */
function drawForeground(ctx: CanvasRenderingContext2D, w: number, h: number, accents: readonly string[], rand: () => number): void {
  const baseY = h
  const stripH = h * (0.22 + rand() * 0.06)
  const topY = baseY - stripH
  const scallopCount = 10 + Math.floor(rand() * 5) // 10..14 inclusive
  const scallopW = w / scallopCount

  const path = new Path2D()
  path.moveTo(0, baseY)
  path.lineTo(0, topY)
  for (let i = 0; i < scallopCount; i++) {
    const xMid = scallopW * i + scallopW / 2
    const xEnd = scallopW * (i + 1)
    const bump = scallopW * 0.5 * (0.8 + rand() * 0.4)
    path.quadraticCurveTo(xMid, topY - bump, xEnd, topY)
  }
  path.lineTo(w, baseY)
  path.closePath()

  paintCutout(ctx, path, pickAccent(accents, 0))
}

/**
 * Draws a 1024×512 transparent placeholder silhouette for one pop-up
 * layer. `accents` supplies the chapter's cutout colors; `seed` makes the
 * shapes deterministic (same chapter → same art, different chapters →
 * different silhouettes).
 */
export function makePlaceholderLayer(kind: LayerKind, accents: readonly string[], seed: number): HTMLCanvasElement {
  assertBrowser('makePlaceholderLayer')
  if (accents.length === 0) {
    throw new Error('storybook/procedural: makePlaceholderLayer requires at least one accent color')
  }

  const { canvas, ctx } = createCanvas(CANVAS_W, CANVAS_H)
  const rand = mulberry32(seed)

  switch (kind) {
    case 'backdrop':
      drawBackdrop(ctx, CANVAS_W, CANVAS_H, accents, rand)
      break
    case 'midground':
      drawMidground(ctx, CANVAS_W, CANVAS_H, accents, rand)
      break
    case 'hero':
      drawHero(ctx, CANVAS_W, CANVAS_H, accents, rand)
      break
    case 'foreground':
      drawForeground(ctx, CANVAS_W, CANVAS_H, accents, rand)
      break
    default: {
      const exhaustiveCheck: never = kind
      throw new Error(`storybook/procedural: unknown layer kind ${String(exhaustiveCheck)}`)
    }
  }

  return canvas
}
