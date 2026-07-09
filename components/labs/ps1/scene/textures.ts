'use client'
import * as THREE from 'three'
import type { SkillCategory } from '@/types'
import { getSkillsByCategory } from '@/data/skills'
import { labs } from '@/lib/labs-manifest'
import { PSX } from './psx-constants'
import { drawBitmapText, measureBitmapText } from './bitmap-font'

/** Deterministic PRNG — the repo's convention; never Math.random. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Snap a 0-255 channel to the nearest of 32 levels (15-bit color). */
export function quantize15(v: number): number {
  return Math.round(Math.round((v / 255) * 31) * (255 / 31))
}

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

/** 4x4 ordered dither + 5-bit quantize, in place. The era's color pipeline. */
export function ditherQuantizeCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const g = canvas.getContext('2d')!
  const img = g.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const step = 255 / 31
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4
      const t = (BAYER4[y & 3][x & 3] / 16 - 0.5) * step
      for (let c = 0; c < 3; c++) {
        d[i + c] = quantize15(Math.max(0, Math.min(255, d[i + c] + t)))
      }
    }
  }
  g.putImageData(img, 0, 0)
  return canvas
}

export function makeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(ditherQuantizeCanvas(canvas))
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function canvas128(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  return [c, c.getContext('2d')!]
}

/** Plaster wall: flat base + sparse tonal blotches + a horizontal scuff band. */
export function makeWallTexture(): THREE.CanvasTexture {
  const [c, g] = canvas128()
  const rnd = mulberry32(101)
  g.fillStyle = PSX.TEX.wall
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'
    g.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), 2 + Math.floor(rnd() * 3), 2)
  }
  g.fillStyle = 'rgba(0,0,0,0.07)'
  g.fillRect(0, 96, 128, 6)
  return makeTexture(c)
}

/** Plywood: warm base, long grain streaks, two darker knots. */
export function makePlywoodTexture(): THREE.CanvasTexture {
  const [c, g] = canvas128()
  const rnd = mulberry32(102)
  g.fillStyle = PSX.TEX.plywood
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 90; i++) {
    const y = Math.floor(rnd() * 128)
    g.fillStyle = rnd() > 0.5 ? 'rgba(60,40,20,0.10)' : 'rgba(255,230,200,0.06)'
    g.fillRect(0, y, 128, 1)
  }
  for (const [kx, ky] of [[34, 40], [92, 88]]) {
    g.fillStyle = PSX.TEX.plywoodDark
    g.beginPath(); g.ellipse(kx, ky, 5, 3, 0, 0, Math.PI * 2); g.fill()
  }
  return makeTexture(c)
}

/** Carpet: two-tone speckle, low contrast. */
export function makeCarpetTexture(): THREE.CanvasTexture {
  const [c, g] = canvas128()
  const rnd = mulberry32(103)
  g.fillStyle = PSX.TEX.carpet
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = rnd() > 0.5 ? PSX.TEX.carpetDark : 'rgba(255,255,255,0.05)'
    g.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), 1, 1)
  }
  return makeTexture(c)
}

/** Concrete (window sill / street below): grey base + cracks + stains. */
export function makeConcreteTexture(): THREE.CanvasTexture {
  const [c, g] = canvas128()
  const rnd = mulberry32(104)
  g.fillStyle = PSX.TEX.concrete
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 6; i++) {
    let x = rnd() * 128, y = rnd() * 128
    g.strokeStyle = 'rgba(0,0,0,0.12)'
    g.beginPath(); g.moveTo(x, y)
    for (let s = 0; s < 6; s++) { x += (rnd() - 0.5) * 24; y += rnd() * 14; g.lineTo(x, y) }
    g.stroke()
  }
  for (let i = 0; i < 5; i++) {
    g.fillStyle = 'rgba(0,0,0,0.05)'
    const x = rnd() * 128, y = rnd() * 128
    g.beginPath(); g.ellipse(x, y, 8 + rnd() * 12, 5 + rnd() * 8, 0, 0, Math.PI * 2); g.fill()
  }
  return makeTexture(c)
}

// ── Graphic textures: the accent-saturation budget of the lab is spent here.
// These are the 1999 skate/band-poster props — the only place fully saturated
// toy-plastic accents (§5 palette) appear, layered over near-black print stock.

type Pt = { x: number; y: number }

/** Poster print stock — a near-black paper field, not a flat `#000`. */
const INK = '#15171a'
/** Bone-white paper / sticker vinyl for outlines and footer text. */
const BONE = '#e8e6e0'
/** Masking-tape strip color (from the brief). */
const TAPE = '#c9c2ae'

/** Accents cycle by category index — one dominant saturated color per poster. */
const POSTER_ACCENTS = [
  PSX.TEX.accentOrange,
  PSX.TEX.accentRed,
  PSX.TEX.accentBlue,
  PSX.TEX.accentYellow,
]
/** Stable category order → the seed and accent index for each poster. */
const CATEGORY_ORDER: SkillCategory[] = [
  'frontend',
  'mobile',
  'state',
  'styling',
  'backend',
  'tools',
  'fun',
]

/** Fill a simple polygon with the current fillStyle. */
function fillPolygon(g: CanvasRenderingContext2D, pts: Pt[]): void {
  g.beginPath()
  g.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
  g.closePath()
  g.fill()
}

/** Push each vertex `px` outward from the polygon centroid — a crude but even outline halo. */
function expandFromCentroid(pts: Pt[], px: number): Pt[] {
  let cx = 0, cy = 0
  for (const p of pts) { cx += p.x; cy += p.y }
  cx /= pts.length; cy /= pts.length
  return pts.map((p) => {
    const dx = p.x - cx, dy = p.y - cy
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / len) * px, y: p.y + (dy / len) * px }
  })
}

/** Draw a shape as a filled color with a contrasting outline (sticker-vinyl look). */
function outlinedPolygon(
  g: CanvasRenderingContext2D,
  pts: Pt[],
  fill: string,
  outline: string,
  px: number
): void {
  g.fillStyle = outline
  fillPolygon(g, expandFromCentroid(pts, px))
  g.fillStyle = fill
  fillPolygon(g, pts)
}

/** N-pointed star as a 2N-vertex polygon, first spike pointing up. */
function starPoints(cx: number, cy: number, outerR: number, innerR: number, spikes = 5): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const a = -Math.PI / 2 + (i * Math.PI) / spikes
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return pts
}

/** Circle approximated as a 16-gon (the shim has no arc; a polygon reads fine at texel res). */
function circlePoints(cx: number, cy: number, r: number, seg = 16): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return pts
}

/** Lightning bolt (top→bottom) mapped into the box (x, y, w, h). */
function boltPoints(x: number, y: number, w: number, h: number): Pt[] {
  const norm: Pt[] = [
    { x: 0.62, y: 0.0 }, { x: 0.16, y: 0.54 }, { x: 0.44, y: 0.54 },
    { x: 0.30, y: 1.0 }, { x: 0.86, y: 0.40 }, { x: 0.54, y: 0.40 }, { x: 0.72, y: 0.0 },
  ]
  return norm.map((p) => ({ x: x + p.x * w, y: y + p.y * h }))
}

/** Right-pointing arrow (shaft + head) mapped into the box (x, y, w, h). */
function arrowPoints(x: number, y: number, w: number, h: number): Pt[] {
  const norm: Pt[] = [
    { x: 0.0, y: 0.32 }, { x: 0.55, y: 0.32 }, { x: 0.55, y: 0.08 }, { x: 1.0, y: 0.5 },
    { x: 0.55, y: 0.92 }, { x: 0.55, y: 0.68 }, { x: 0.0, y: 0.68 },
  ]
  return norm.map((p) => ({ x: x + p.x * w, y: y + p.y * h }))
}

/** A word "printed" on a taped rectangle sticker — accent fill, bone border, ink text. */
function textSticker(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  accent: string
): void {
  const w = measureBitmapText(text, scale) + 8
  const h = 7 * scale + 6
  g.fillStyle = BONE
  g.fillRect(x - 2, y - 2, w + 4, h + 4)
  g.fillStyle = accent
  g.fillRect(x, y, w, h)
  drawBitmapText(g, text, x + 4, y + 3, { scale, color: INK })
}

/**
 * Skills wall poster — one per category, seeded by category index. A torn-edge
 * field of the category's accent over near-black stock, a big diagonal stencil
 * category word (bitmap font ×3, clipped off both edges THPS-style), a halftone
 * dot patch, a bone star, one masking-tape strip, and a footer "setlist" of the
 * category's top-3 skills. This is where the accent saturation lives.
 */
export function makePosterTexture(category: SkillCategory): THREE.CanvasTexture {
  const W = 128, H = 192
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const idx = Math.max(0, CATEGORY_ORDER.indexOf(category))
  const rnd = mulberry32(1301 + idx * 61)
  const accent = POSTER_ACCENTS[idx % POSTER_ACCENTS.length]

  // Near-black paper field — shows through the torn edges.
  g.fillStyle = INK
  g.fillRect(0, 0, W, H)

  // Torn-edge accent rectangle: straight sides, jagged top and bottom.
  const left = 6, right = W - 6
  const ring: Pt[] = []
  for (let x = left; x <= right; x += 10) ring.push({ x, y: 8 + rnd() * 7 })
  ring.push({ x: right, y: 8 + rnd() * 7 })
  for (let x = right; x >= left; x -= 10) ring.push({ x, y: 156 - rnd() * 7 })
  ring.push({ x: left, y: 156 - rnd() * 7 })
  g.fillStyle = accent
  fillPolygon(g, ring)

  // Halftone dot patch (2px dot grid), density ramping downward — print shading.
  g.fillStyle = INK
  for (let y = 106; y < 150; y += 4) {
    const t = (y - 106) / 44
    for (let x = 66; x < 120; x += 4) {
      if (rnd() < t * 0.9 + 0.06) g.fillRect(x, y, 2, 2)
    }
  }

  // Big diagonal stencil category word, drawn glyph-by-glyph up a stepped baseline.
  const word = category.toUpperCase()
  const S = 3
  for (let i = 0; i < word.length; i++) {
    drawBitmapText(g, word[i], -6 + i * 6 * S, 122 - i * 3, { scale: S, color: INK })
  }

  // Bone star, top-right corner.
  outlinedPolygon(g, starPoints(101, 30, 12, 5), BONE, INK, 1.5)

  // Masking-tape strip pinning the top-left corner.
  g.fillStyle = TAPE
  g.fillRect(-4, 5, 40, 12)

  // Footer: full-width dark strip with the category's top-3 skills as a setlist.
  const footerTop = 158
  g.fillStyle = INK
  g.fillRect(0, footerTop, W, H - footerTop)
  const top3 = getSkillsByCategory(category)
    .slice()
    .sort((a, b) => b.years - a.years)
    .slice(0, 3)
    .map((s) => s.name.toUpperCase())
  top3.forEach((name, i) => {
    drawBitmapText(g, name, 8, footerTop + 3 + i * 9, { scale: 1, color: BONE })
  })

  return makeTexture(c)
}

/**
 * Sticker sheet for the tower-PC case — a transparent-background cluster of
 * bold, white-outlined skate stickers (star, circle, bolt, arrow) in mixed
 * accents plus two era-generic word stickers. Silhouettes stay legible small.
 */
export function makeStickerSheetTexture(): THREE.CanvasTexture {
  const W = 128, H = 128
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const O = PSX.TEX.accentOrange
  const R = PSX.TEX.accentRed
  const B = PSX.TEX.accentBlue
  const Y = PSX.TEX.accentYellow
  const T = PSX.TEX.crtTeal

  outlinedPolygon(g, starPoints(30, 46, 15, 6.5), Y, BONE, 2)
  outlinedPolygon(g, circlePoints(100, 24, 14), B, BONE, 2)
  outlinedPolygon(g, boltPoints(54, 44, 30, 46), O, BONE, 2)
  outlinedPolygon(g, arrowPoints(6, 74, 46, 28), R, BONE, 2)
  outlinedPolygon(g, starPoints(110, 108, 11, 4.8), T, BONE, 2)
  outlinedPolygon(g, circlePoints(26, 110, 10), O, BONE, 2)
  textSticker(g, 'NO FEAR', 6, 6, 1, B)
  textSticker(g, 'RAD', 86, 70, 2, R)

  return makeTexture(c)
}

/**
 * Skate-deck bottom graphic (portrait) — a vertical two-accent gradient inside
 * a plywood margin, a bone lightning bolt down the center, and small yellow
 * stars marching down both rails.
 */
export function makeDeckTexture(): THREE.CanvasTexture {
  const W = 64, H = 256
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!

  // Plywood base — the 4px edge margin left visible around the graphic.
  g.fillStyle = PSX.TEX.plywood
  g.fillRect(0, 0, W, H)

  // Two-accent vertical gradient field.
  const grad = g.createLinearGradient(0, 4, 0, H - 4)
  grad.addColorStop(0, PSX.TEX.accentBlue)
  grad.addColorStop(1, PSX.TEX.accentOrange)
  g.fillStyle = grad
  g.fillRect(4, 4, W - 8, H - 8)

  // Center lightning bolt, bone with an ink edge so it reads at grazing angles.
  outlinedPolygon(g, boltPoints(15, 40, 34, 176), BONE, INK, 2)

  // Small stars marching down both rails.
  for (let i = 0; i < 5; i++) {
    const y = 30 + i * 46
    outlinedPolygon(g, starPoints(11, y, 6, 2.4), PSX.TEX.accentYellow, INK, 1)
    outlinedPolygon(g, starPoints(53, y + 23, 6, 2.4), PSX.TEX.accentYellow, INK, 1)
  }

  return makeTexture(c)
}

// ── Screen / prop textures: the CRT is the lab's single teal accent moment, the
// window a hero piece bound by the crude-tone law. Screens read as real BIOS /
// broadcast surfaces at texel resolution; the outside world stays flat and grey.

/** CRT-black screen field — a near-black with a teal cast, not `#000`. */
const CRT_BG = '#0c1a18'
/** Dull ochre of a distant lit window — the window view's only warm accent. */
const LIT_WINDOW = '#c9a94e'

/** Blank a canvas element and hand back its 2D context. */
function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

/** Draw `text` as a column of stacked glyphs centered in a `w`-wide field. */
function drawVerticalText(
  g: CanvasRenderingContext2D,
  text: string,
  w: number,
  topY: number,
  step: number,
  color: string,
  shadow?: string
): void {
  const gx = Math.floor((w - 5) / 2)
  for (let i = 0; i < text.length; i++) {
    const y = topY + i * step
    if (shadow) drawBitmapText(g, text[i], gx + 1, y + 1, { scale: 1, color: shadow })
    drawBitmapText(g, text[i], gx, y, { scale: 1, color })
  }
}

/**
 * The desk CRT's menu — a BIOS/memory-manager mock in crtTeal on near-black.
 * Title bar `AY-01 · MENU`, five stacked menu rows (the site's real sections),
 * an inverse-video highlight on the first row, and 2px scanline stripes at 12%
 * black over the whole tube. This is where the lab spends its teal.
 */
export function makeCRTScreenTexture(): THREE.CanvasTexture {
  const W = 128, H = 96
  const [c, g] = canvasOf(W, H)

  g.fillStyle = CRT_BG
  g.fillRect(0, 0, W, H)

  // Title bar.
  g.fillStyle = PSX.TEX.crtTealDark
  g.fillRect(0, 0, W, 12)
  drawBitmapText(g, 'AY-01 · MENU', 4, 3, { scale: 1, color: PSX.TEX.crtTeal })

  // Five menu rows; the first is the selected/highlighted entry (inverse video).
  const rows = ['ABOUT', 'PROJECTS', 'SKILLS', 'CONTACT', 'LABS']
  rows.forEach((label, i) => {
    const y = 20 + i * 14
    if (i === 0) {
      g.fillStyle = PSX.TEX.crtTeal
      g.fillRect(4, y - 2, W - 8, 11)
      drawBitmapText(g, label, 8, y, { scale: 1, color: CRT_BG })
    } else {
      drawBitmapText(g, label, 8, y, { scale: 1, color: PSX.TEX.crtTeal })
    }
  })

  // Scanlines: a 1px dark line every 2px, faint, over everything.
  g.fillStyle = 'rgba(0,0,0,0.12)'
  for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1)

  return makeTexture(c)
}

/**
 * The floor tube-TV — a seeded broadcast-static field (per-pixel random greys),
 * darkened toward the corners like a curved tube, with a bright `ABOUT` caps
 * word on a dim backing plate so it reads through the snow.
 */
export function makeTVScreenTexture(): THREE.CanvasTexture {
  const W = 96, H = 72
  const [c, g] = canvasOf(W, H)
  const rnd = mulberry32(701)

  // Broadcast static: an independent random grey per pixel.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = Math.floor(rnd() * 256)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(x, y, 1, 1)
    }
  }

  // Tube vignette: darken by squared distance from center (real, deterministic).
  const cx = (W - 1) / 2, cy = (H - 1) / 2
  const maxD = Math.hypot(cx, cy)
  const img = g.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = Math.hypot(x - cx, y - cy) / maxD
      const vig = Math.max(0.15, 1 - 0.95 * t * t)
      const i = (y * W + x) * 4
      d[i] *= vig
      d[i + 1] *= vig
      d[i + 2] *= vig
    }
  }
  g.putImageData(img, 0, 0)

  // Bright caps word on a dim plate, centered.
  const word = 'ABOUT'
  const tw = measureBitmapText(word, 2)
  const tx = Math.floor((W - tw) / 2)
  const ty = Math.floor((H - 14) / 2)
  g.fillStyle = 'rgba(0,0,0,0.55)'
  g.fillRect(tx - 4, ty - 3, tw + 8, 20)
  drawBitmapText(g, word, tx, ty, { scale: 2, color: BONE })

  return makeTexture(c)
}

/** Jewel-case spines cycle the saturated accents by index. */
const SPINE_ACCENTS = [
  PSX.TEX.accentOrange,
  PSX.TEX.accentYellow,
  PSX.TEX.accentRed,
  PSX.TEX.accentBlue,
]

/**
 * A game-box spine (24×96) for the shelf of jewel cases — a saturated accent
 * field cycled by `i`, a thin bone "publisher" band across the top, and the
 * lab's real title in vertical bone caps (per-glyph stacked baselines, with a
 * 1px ink drop-shadow so the letters read over any accent).
 */
export function makeBoxSpineTexture(i: number): THREE.CanvasTexture {
  const W = 24, H = 96
  const [c, g] = canvasOf(W, H)
  const accent = SPINE_ACCENTS[i % SPINE_ACCENTS.length]
  const lab = labs[((i % labs.length) + labs.length) % labs.length]

  g.fillStyle = accent
  g.fillRect(0, 0, W, H)

  // Thin publisher strip across the top.
  const band = 4
  g.fillStyle = BONE
  g.fillRect(0, 0, W, band)

  // Vertical title, centered in the space below the band.
  const title = lab.title.toUpperCase()
  const availTop = band + 4
  const availH = H - availTop - 3
  const step = Math.min(9, Math.max(6, Math.floor(availH / title.length)))
  const blockH = (title.length - 1) * step + 7
  const topY = availTop + Math.max(0, Math.floor((availH - blockH) / 2))
  drawVerticalText(g, title, W, topY, step, BONE, INK)

  return makeTexture(c)
}

/**
 * The bedroom window's overcast view (crude-tone law): a flat grey-white sky
 * with a hair of vertical darkening, a ragged row of flat rooftop silhouettes,
 * a water tower and a distant crane in darker grey, three dull-yellow lit
 * windows (the only warm accent), and a wet grey street band with faint
 * reflection streaks. No sunset, no neon — grey THPS, not golden hour.
 */
export function makeWindowViewTexture(): THREE.CanvasTexture {
  const W = 192, H = 144
  const [c, g] = canvasOf(W, H)
  const rnd = mulberry32(709)
  const ROOF = PSX.TEX.wallShade // '#968f7e' reads as flat far-building grey
  const STRUCT = '#5f625f' // darker silhouette grey for tower/crane
  const streetTop = 120

  // Sky: near-flat grey-white, a touch darker toward the rooftops.
  const sky = g.createLinearGradient(0, 0, 0, streetTop)
  sky.addColorStop(0, '#cdcfc8')
  sky.addColorStop(1, '#b8bab2')
  g.fillStyle = sky
  g.fillRect(0, 0, W, streetTop)

  // Rooftop silhouettes: a ragged skyline of flat blocks down to the street.
  const roofColor = '#6f7270'
  const tops: number[] = []
  const lefts: number[] = []
  let x = -4
  while (x < W) {
    const bw = 16 + Math.floor(rnd() * 16)
    const top = 60 + Math.floor(rnd() * 34)
    g.fillStyle = roofColor
    g.fillRect(x, top, bw + 1, streetTop - top)
    lefts.push(x)
    tops.push(top)
    // A slightly darker seam so adjacent blocks read as separate buildings.
    g.fillStyle = ROOF
    g.fillRect(x, top, 1, streetTop - top)
    x += bw
  }

  // Water tower on an early building: legs, tank body, conical cap.
  {
    const bx = 44, baseTop = 66
    g.fillStyle = STRUCT
    g.fillRect(bx, baseTop - 14, 2, 14) // left leg
    g.fillRect(bx + 12, baseTop - 14, 2, 14) // right leg
    g.fillRect(bx - 1, baseTop - 24, 16, 11) // tank body
    fillPolygon(g, [
      { x: bx - 1, y: baseTop - 24 },
      { x: bx + 15, y: baseTop - 24 },
      { x: bx + 7, y: baseTop - 30 },
    ]) // conical cap
  }

  // Distant crane: mast, jib, short counter-jib, hanging cable.
  {
    const mx = 150, top = 40, jibY = 46
    g.fillStyle = STRUCT
    g.fillRect(mx, top, 2, streetTop - top) // mast
    g.fillRect(mx - 22, jibY, 46, 2) // jib + counter-jib
    g.fillRect(mx + 20, jibY, 1, 12) // hanging cable
    g.fillRect(mx - 20, jibY - 3, 4, 5) // counterweight block
  }

  // Three dull-yellow lit windows scattered on the rooftops.
  const lit: Array<[number, number]> = [
    [lefts[1] + 6, tops[1] + 8],
    [lefts[3] + 5, tops[3] + 14],
    [lefts[5] + 8, tops[5] + 10],
  ]
  g.fillStyle = LIT_WINDOW
  for (const [wx, wy] of lit) {
    if (wx < W && wy < streetTop) g.fillRect(wx, wy, 3, 4)
  }

  // Wet street band with faint window reflections.
  g.fillStyle = '#82857f'
  g.fillRect(0, streetTop, W, H - streetTop)
  g.fillStyle = 'rgba(201,169,78,0.18)'
  for (const [wx] of lit) {
    if (wx < W) g.fillRect(wx, streetTop, 3, H - streetTop)
  }
  // A couple of horizontal wet-sheen streaks.
  g.fillStyle = 'rgba(255,255,255,0.05)'
  for (let i = 0; i < 3; i++) g.fillRect(0, streetTop + 4 + i * 7, W, 1)

  return makeTexture(c)
}

/**
 * The corkboard over the desk — a speckled cork field with three pinned
 * polaroids (bone border, grey photo, a red pin dot at the top). Straight
 * rectangles only; the era look comes from the speckle and the flat photos.
 */
export function makeCorkboardTexture(): THREE.CanvasTexture {
  const W = 128, H = 96
  const [c, g] = canvasOf(W, H)
  const rnd = mulberry32(713)

  // Cork base + two-tone speckle.
  g.fillStyle = '#c2a878'
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(90,60,30,0.14)' : 'rgba(255,240,210,0.10)'
    g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1 + Math.floor(rnd() * 2), 1)
  }

  // Three pinned polaroids.
  const cards: Array<[number, number]> = [[12, 14], [52, 30], [92, 12]]
  for (const [px, py] of cards) {
    const cw = 30, ch = 34
    g.fillStyle = BONE
    g.fillRect(px, py, cw, ch) // white border
    g.fillStyle = '#8a8b86'
    g.fillRect(px + 3, py + 3, cw - 6, ch - 12) // grey photo
    outlinedPolygon(g, circlePoints(px + cw / 2, py + 3, 3), PSX.TEX.accentRed, INK, 1) // pin
  }

  return makeTexture(c)
}

/**
 * A memory card on the desk tray — grey shell tone with a speckle of wear, a
 * dark ribbed connector band along one edge, and a tiny bone label chip with a
 * hand-stamped code. The literal "projects" object, palm-sized.
 */
export function makeMemcardTexture(): THREE.CanvasTexture {
  const W = 64, H = 64
  const [c, g] = canvasOf(W, H)
  const rnd = mulberry32(719)

  // Grey plastic shell + faint wear speckle.
  g.fillStyle = '#b8b4a8'
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
    g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1, 1)
  }

  // Ribbed connector band along the top edge.
  g.fillStyle = '#3a3d3a'
  g.fillRect(0, 0, W, 12)
  g.fillStyle = '#5a5d59'
  for (let x = 4; x < W - 3; x += 6) g.fillRect(x, 3, 3, 6)

  // Label chip with a hand-stamped code.
  g.fillStyle = BONE
  g.fillRect(10, 26, 44, 18)
  drawBitmapText(g, 'AY-01', 14, 30, { scale: 1, color: INK })
  drawBitmapText(g, 'SAVE', 14, 38, { scale: 1, color: PSX.TEX.crtTealDark })

  return makeTexture(c)
}
