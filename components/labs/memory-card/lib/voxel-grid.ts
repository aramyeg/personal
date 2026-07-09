/**
 * Voxel grid — the site's pixel avatar as blended cell data, for Task 5's
 * InstancedMesh voxel character. Rect data below is transcribed from
 * `components/labs/xp/pixel-avatar.tsx` (own copy, not imported: the XP lab
 * stays untouched and independently deletable).
 */

type Px = [number, number, number, number]

const BUZZ_TOP: Px[] = [[11, 2, 10, 1], [10, 3, 12, 1], [9, 4, 2, 1], [21, 4, 2, 1]]
const BUZZ_FADE: Px[] = [[11, 4, 10, 1], [9, 5, 1, 2], [22, 5, 1, 2]]
const FACE: Px[] = [
  [10, 5, 12, 2], [9, 7, 14, 2], [10, 9, 12, 3], [11, 12, 10, 1], [12, 13, 8, 1],
  [8, 7, 1, 2], [23, 7, 1, 2], [12, 14, 8, 2],
]
const NECK_SHADOW: Px[] = [[13, 14, 6, 1]]
const BROWS: Px[] = [[11, 5, 3, 1], [18, 5, 3, 1]]
const EYE_WHITES: Px[] = [[11, 7, 3, 2], [18, 7, 3, 2]]
const PUPILS: Px[] = [[12, 7, 1, 2], [19, 7, 1, 2]]
const NOSE_SHADOW: Px[] = [[15, 9, 2, 2]]
const MOUTH: Px[] = [[14, 11, 3, 1]]
const STUBBLE: Px[] = [[11, 12, 10, 1], [12, 13, 8, 1]]
const TEE: Px[] = [
  [10, 15, 3, 1], [19, 15, 3, 1], [6, 16, 20, 1], [4, 17, 24, 1], [4, 18, 24, 5],
  [6, 23, 20, 5], [1, 17, 3, 5], [28, 17, 3, 5],
]
const COLLAR: Px[] = [[13, 16, 6, 1]]
const PECS: Px[] = [[10, 20, 5, 1], [17, 20, 5, 1]]
const SWORD_BLADE: Px[] = [[14, 22, 2, 1], [15, 21, 2, 1], [16, 20, 2, 1], [17, 19, 2, 1], [18, 18, 2, 1]]
const SWORD_HILT: Px[] = [
  [12, 20, 1, 1], [13, 21, 1, 1], [15, 23, 1, 1], [16, 24, 1, 1],
  [13, 23, 1, 1], [12, 24, 1, 1], [11, 25, 1, 1],
]
const ARMS: Px[] = [[1, 22, 3, 5], [28, 22, 3, 5]]
const HANDS: Px[] = [[1, 27, 3, 2], [28, 27, 3, 2]]
const JEANS: Px[] = [[8, 28, 16, 2], [8, 30, 7, 4], [17, 30, 7, 4]]
const BOOTS: Px[] = [[7, 34, 8, 2], [17, 34, 8, 2]]

const LAYERS: { rects: Px[]; fill: string }[] = [
  { rects: BUZZ_TOP, fill: '#292524' },
  { rects: BUZZ_FADE, fill: '#57534e' },
  { rects: FACE, fill: '#eec9a2' },
  { rects: NECK_SHADOW, fill: 'rgba(217,168,120,0.7)' },
  { rects: BROWS, fill: '#57534e' },
  { rects: EYE_WHITES, fill: '#fafaf9' },
  { rects: PUPILS, fill: '#1c1917' },
  { rects: NOSE_SHADOW, fill: 'rgba(217,168,120,0.7)' },
  { rects: MOUTH, fill: '#c08862' },
  { rects: STUBBLE, fill: 'rgba(68,64,60,0.25)' },
  { rects: TEE, fill: '#1c1917' },
  { rects: COLLAR, fill: '#292524' },
  { rects: PECS, fill: '#292524' },
  { rects: SWORD_BLADE, fill: '#e0a878' },
  { rects: SWORD_HILT, fill: '#b0563d' },
  { rects: ARMS, fill: '#eec9a2' },
  { rects: HANDS, fill: '#dfb389' },
  { rects: JEANS, fill: '#57534e' },
  { rects: BOOTS, fill: '#292524' },
]

export type Voxel = { x: number; y: number; color: string } // y grows downward (grid space)
export const GRID_W = 32
export const GRID_H = 37

const RGBA_RE = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/

/** Parse a `#rrggbb` or `rgba(r,g,b,a)` fill into channels; solid hex gets alpha 1. */
function parseFill(fill: string): { r: number; g: number; b: number; a: number } {
  const m = RGBA_RE.exec(fill)
  if (m) {
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: Number(m[4]) }
  }
  const hex = fill.slice(1)
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: 1,
  }
}

function toHex(r: number, g: number, b: number): string {
  const ch = (n: number) => n.toString(16).padStart(2, '0')
  return `#${ch(r)}${ch(g)}${ch(b)}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** Paint the avatar's layered rects into a 32×37 grid (painter's order,
 *  alpha layers blended over what's beneath), return occupied cells. */
export function buildVoxelGrid(): Voxel[] {
  const cells: (string | null)[] = new Array(GRID_W * GRID_H).fill(null)

  for (const layer of LAYERS) {
    const { r: fr, g: fg, b: fb, a } = parseFill(layer.fill)
    for (const [x, y, w, h] of layer.rects) {
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          const idx = py * GRID_W + px
          if (a >= 1) {
            cells[idx] = toHex(fr, fg, fb)
            continue
          }
          const base = cells[idx]
          if (base === null) continue // alpha layer with no base beneath: skip
          const bg = hexToRgb(base)
          const outR = Math.round(fr * a + bg.r * (1 - a))
          const outG = Math.round(fg * a + bg.g * (1 - a))
          const outB = Math.round(fb * a + bg.b * (1 - a))
          cells[idx] = toHex(outR, outG, outB)
        }
      }
    }
  }

  const voxels: Voxel[] = []
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const color = cells[y * GRID_W + x]
      if (color) voxels.push({ x, y, color })
    }
  }
  return voxels
}
