/**
 * Shimmer save-icons — the small blocky marks next to each save slot on a
 * PS1 memory-card screen. Each icon is a symmetric 16x16 pixel mark,
 * deterministic per slot (same `seed` always draws the same mark) via
 * `mulberry32` — never `Math.random`. Three animation frames give the
 * "shimmer": frames 1 and 2 each flip a couple of cells from frame 0, the
 * PS1 memory-card icon flicker.
 *
 * The pattern math is pure and exported on its own (`saveIconPattern`) so it
 * can be unit-tested without a working canvas 2D context; `makeSaveIconFrames`
 * just paints that grid onto canvases and stays thin.
 */
import { mulberry32 } from './mulberry'
import { MC } from '../tokens'

export const ICON_FRAMES = 3

const GRID = 16
const HALF = GRID / 2
const CELL_PX = 4
const CANVAS_PX = GRID * CELL_PX

/** One frame: 16 rows of 16 cell values, each 0 (empty) / 1 (ink) / 2 (accent). */
type Grid = number[][]

/** Deterministic numeric seed from a string (djb2-style fold) — never Math.random. */
function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) | 0
  }
  return hash
}

function emptyGrid(): Grid {
  return Array.from({ length: GRID }, () => Array(GRID).fill(0))
}

/** Mirror the left half (cols 0..HALF-1) onto the right half — a deliberate, symmetric mark. */
function mirrorHalf(grid: Grid): void {
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < HALF; col++) {
      grid[row][GRID - 1 - col] = grid[row][col]
    }
  }
}

/**
 * Three 16x16 frames of pixel state (0 empty / 1 ink / 2 accent), deterministic
 * from `seed`. Frame 0 is the base mark, drawn on the left half then mirrored.
 * Frames 1 and 2 each cycle two left-half cells to a different value and
 * re-mirror — four cells change per frame once mirrored, the shimmer.
 */
export function saveIconPattern(seed: string): Grid[] {
  const rand = mulberry32(hashSeed(seed))

  const base = emptyGrid()
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < HALF; col++) {
      const roll = rand()
      base[row][col] = roll < 0.55 ? 0 : roll < 0.8 ? 1 : 2
    }
  }
  mirrorHalf(base)

  const frames: Grid[] = [base]
  for (let f = 1; f < ICON_FRAMES; f++) {
    const frame = base.map((row) => [...row])
    const picked = new Set<string>()
    while (picked.size < 2) {
      const row = Math.floor(rand() * GRID)
      const col = Math.floor(rand() * HALF)
      picked.add(`${row},${col}`)
    }
    for (const key of picked) {
      const [row, col] = key.split(',').map(Number)
      frame[row][col] = (frame[row][col] + 1) % 3
    }
    mirrorHalf(frame)
    frames.push(frame)
  }
  return frames
}

/** Draw one frame's grid onto a fresh 64x64 canvas at 4px/cell (crisp, no smoothing). */
function drawFrame(grid: Grid, accent: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_PX
  canvas.height = CANVAS_PX
  const ctx = canvas.getContext('2d')!
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const value = grid[row][col]
      if (value === 0) continue
      ctx.fillStyle = value === 1 ? MC.ink : accent
      ctx.fillRect(col * CELL_PX, row * CELL_PX, CELL_PX, CELL_PX)
    }
  }
  return canvas
}

/** Three 64x64 canvases — the shimmer animation frames for one save slot's icon. */
export function makeSaveIconFrames(seed: string, accent: string): HTMLCanvasElement[] {
  return saveIconPattern(seed).map((grid) => drawFrame(grid, accent))
}
