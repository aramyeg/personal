/**
 * WILD lane — "Lamplight": the inn's procedural surfaces.
 *
 * Hand-written canvas painters, one per skin named in `inn-model.ts`, plus a Sobel-derived
 * normal map for each so the raking moonlight catches the timber lattice and the shingle
 * courses. Everything is memoised at module level: hot reload and remounts reuse the same
 * GPU uploads instead of repainting a dozen 1024s.
 *
 * These are NIGHT surfaces. Albedo stays low-value and desaturated around `PALETTE`; the
 * lighting rig supplies the range. A texture painted at daylight brightness reads as plastic
 * under a moon.
 *
 * Every tile is authored to be seamless in both axes, because the building projects its UVs
 * planar in world units (see `uvProject` in inn-building.tsx) rather than per-face 0..1.
 */
import * as THREE from 'three'

import { createCanvas } from '../procedural/canvas-utils'
import { PALETTE } from './inn-model'
import { applyRiseClip } from './rise-clip'

// ---------------------------------------------------------------------------------------------
// deterministic noise
// ---------------------------------------------------------------------------------------------

/** Mulberry32 — same texture every reload, so captures are comparable. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Jitter a hex colour in HSL-ish terms without a colour library. */
function shade(hex: string, mulL: number, addR = 0, addG = 0, addB = 0): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * mulL + addR)))
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * mulL + addG)))
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * mulL + addB)))
  return `rgb(${r},${g},${b})`
}

/** Soft blotches — used for weathering, damp, patchy plaster repair. */
function blotches(
  ctx: CanvasRenderingContext2D,
  r: Rng,
  size: number,
  count: number,
  rad: readonly [number, number],
  colour: (i: number) => string,
  alpha: readonly [number, number],
): void {
  for (let i = 0; i < count; i += 1) {
    const x = r() * size
    const y = r() * size
    const rr = lerp(rad[0], rad[1], r()) * size
    // Draw the wrapped copies too so the tile stays seamless.
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        if (Math.abs(x + dx - size / 2) > size * 1.2) continue
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rr)
        const c = colour(i)
        g.addColorStop(0, c)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = lerp(alpha[0], alpha[1], r())
        ctx.fillStyle = g
        ctx.fillRect(x + dx - rr, y + dy - rr, rr * 2, rr * 2)
      }
    }
  }
  ctx.globalAlpha = 1
}

/** Fine grain, cheap: per-pixel value jitter over the whole tile. */
function grain(ctx: CanvasRenderingContext2D, size: number, r: Rng, amount: number): void {
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount
    d[i] = Math.min(255, Math.max(0, d[i] + n))
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n))
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)
}

// ---------------------------------------------------------------------------------------------
// normal map from luminance (Sobel)
// ---------------------------------------------------------------------------------------------

/**
 * Derive a tangent-space normal map from the albedo's luminance. Crude but exactly right for
 * this job: mortar joints, timber edges and shingle butts are all darker than what surrounds
 * them, so the luminance gradient IS the relief.
 */
function normalFromLuminance(source: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const size = source.width
  const src = source.getContext('2d')
  if (!src) throw new Error('wild/inn-materials: 2d context unavailable')
  const d = src.getImageData(0, 0, size, size).data
  const lum = new Float32Array(size * size)
  for (let i = 0; i < size * size; i += 1) {
    lum[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255
  }
  const at = (x: number, y: number) => lum[((y + size) % size) * size + ((x + size) % size)]

  const { canvas, ctx } = createCanvas(size, size)
  const out = ctx.createImageData(size, size)
  const o = out.data
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const tl = at(x - 1, y - 1)
      const tc = at(x, y - 1)
      const tr = at(x + 1, y - 1)
      const ml = at(x - 1, y)
      const mr = at(x + 1, y)
      const bl = at(x - 1, y + 1)
      const bc = at(x, y + 1)
      const br = at(x + 1, y + 1)
      const gx = tl + 2 * ml + bl - (tr + 2 * mr + br)
      const gy = tl + 2 * tc + tr - (bl + 2 * bc + br)
      let nx = gx * strength
      let ny = gy * strength
      const nz = 1
      const inv = 1 / Math.hypot(nx, ny, nz)
      nx *= inv
      ny *= inv
      const i = (y * size + x) * 4
      o[i] = Math.round((nx * 0.5 + 0.5) * 255)
      o[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      o[i + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255)
      o[i + 3] = 255
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

/** Same Sobel input, used as a roughness map so recesses read wetter/duller than faces. */
function roughFromLuminance(
  source: HTMLCanvasElement,
  lo: number,
  hi: number,
): HTMLCanvasElement {
  const size = source.width
  const src = source.getContext('2d')
  if (!src) throw new Error('wild/inn-materials: 2d context unavailable')
  const d = src.getImageData(0, 0, size, size).data
  const { canvas, ctx } = createCanvas(size, size)
  const out = ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i += 1) {
    const l = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255
    // Darker (recessed, damp) => rougher.
    const v = Math.round(255 * (hi - (hi - lo) * l))
    out.data[i * 4] = v
    out.data[i * 4 + 1] = v
    out.data[i * 4 + 2] = v
    out.data[i * 4 + 3] = 255
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

// ---------------------------------------------------------------------------------------------
// PAINTER — rubble stone (HALL, TOWER, STEP, WELL)
// ---------------------------------------------------------------------------------------------

/** Draw a shape and its wrapped copies so the tile has no visible seam. */
function wrapped(
  ctx: CanvasRenderingContext2D,
  size: number,
  x: number,
  draw: (ox: number) => void,
): void {
  draw(x)
  if (x < size * 0.2) draw(x + size)
  if (x > size * 0.8) draw(x - size)
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function paintRubbleStone(size: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(size, size)
  const r = rng(0x51a7e)
  const base = PALETTE.stoneCold

  // Mortar bed, darker than the stones so joints read as recesses.
  ctx.fillStyle = shade(base, 0.52)
  ctx.fillRect(0, 0, size, size)
  blotches(ctx, r, size, 22, [0.06, 0.2], () => shade(base, 0.42), [0.2, 0.5])

  // Irregular courses: heights vary, and the tile's total is forced to `size` so it wraps.
  const nCourses = 9
  const raw: number[] = []
  for (let i = 0; i < nCourses; i += 1) raw.push(lerp(0.7, 1.35, r()))
  const total = raw.reduce((a, b) => a + b, 0)
  let y = 0
  for (let c = 0; c < nCourses; c += 1) {
    const h = (raw[c] / total) * size
    // Stones inside the course. Widths vary; the run is closed exactly at the tile edge.
    const widths: number[] = []
    let acc = 0
    while (acc < size) {
      const w = lerp(size * 0.055, size * 0.19, r() ** 1.4)
      widths.push(w)
      acc += w
    }
    const k = size / acc
    let x = c % 2 === 0 ? 0 : -widths[widths.length - 1] * k * 0.45
    for (let i = 0; i < widths.length; i += 1) {
      const w = widths[i] * k
      const joint = lerp(size * 0.004, size * 0.009, r())
      const sx = x + joint
      const sy = y + joint + (r() - 0.5) * joint
      const sw = w - joint * 2
      const sh = h - joint * 2
      if (sw > 2 && sh > 2) {
        const tone = lerp(0.78, 1.22, r() ** 0.85)
        const warm = r() < 0.18 ? 6 : 0
        wrapped(ctx, size, sx, (ox) => {
          roundRectPath(ctx, ox, sy, sw, sh, Math.min(sw, sh) * 0.18)
          ctx.fillStyle = shade(base, tone, warm, warm * 0.6, 0)
          ctx.fill()
          // Moonlit top arris and shaded underside — this is what the normal map reads.
          const lw = Math.max(1, size * 0.0022)
          ctx.lineWidth = lw
          ctx.strokeStyle = shade(base, tone * 1.5)
          ctx.beginPath()
          ctx.moveTo(ox + sw * 0.08, sy + lw)
          ctx.lineTo(ox + sw * 0.92, sy + lw)
          ctx.stroke()
          ctx.strokeStyle = shade(base, tone * 0.5)
          ctx.beginPath()
          ctx.moveTo(ox + sw * 0.08, sy + sh - lw)
          ctx.lineTo(ox + sw * 0.92, sy + sh - lw)
          ctx.stroke()
        })
      }
      x += w
    }
    y += h
  }

  // Weathering: vertical damp streaks, then sparse moss clumps.
  ctx.globalAlpha = 0.16
  for (let i = 0; i < 26; i += 1) {
    const x = r() * size
    const w = lerp(size * 0.01, size * 0.05, r())
    const g = ctx.createLinearGradient(0, 0, 0, size)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(lerp(0.15, 0.5, r()), shade(base, 0.55))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, w, size)
  }
  ctx.globalAlpha = 1
  blotches(ctx, r, size, 14, [0.03, 0.09], () => 'rgb(46,62,52)', [0.1, 0.26])
  grain(ctx, size, r, 14)
  return canvas
}

// ---------------------------------------------------------------------------------------------
// PAINTER — timber frame + lime plaster (JETTY). The signature surface.
// ---------------------------------------------------------------------------------------------

/** Grain streaks running the length of a timber member. */
function timberGrain(
  ctx: CanvasRenderingContext2D,
  r: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
): void {
  const along = w > h
  const n = Math.round((along ? w : h) * 0.09) + 6
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  for (let i = 0; i < n; i += 1) {
    const t = r()
    ctx.globalAlpha = lerp(0.1, 0.34, r())
    ctx.strokeStyle = shade(base, r() < 0.5 ? 0.6 : 1.5)
    ctx.lineWidth = lerp(0.8, 2.4, r())
    ctx.beginPath()
    if (along) {
      const yy = y + t * h
      ctx.moveTo(x, yy)
      ctx.bezierCurveTo(
        x + w * 0.3,
        yy + (r() - 0.5) * h * 0.4,
        x + w * 0.7,
        yy + (r() - 0.5) * h * 0.4,
        x + w,
        yy + (r() - 0.5) * h * 0.2,
      )
    } else {
      const xx = x + t * w
      ctx.moveTo(xx, y)
      ctx.bezierCurveTo(
        xx + (r() - 0.5) * w * 0.4,
        y + h * 0.3,
        xx + (r() - 0.5) * w * 0.4,
        y + h * 0.7,
        xx + (r() - 0.5) * w * 0.2,
        y + h,
      )
    }
    ctx.stroke()
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function member(
  ctx: CanvasRenderingContext2D,
  r: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
): void {
  ctx.fillStyle = shade(base, lerp(0.85, 1.15, r()))
  ctx.fillRect(x, y, w, h)
  timberGrain(ctx, r, x, y, w, h, base)
  // Chamfered highlight on one arris, shadow on the other — sells the lattice in relief.
  ctx.globalAlpha = 0.5
  ctx.fillStyle = shade(base, 1.75)
  if (w > h) ctx.fillRect(x, y, w, Math.max(1, h * 0.12))
  else ctx.fillRect(x, y, Math.max(1, w * 0.14), h)
  ctx.fillStyle = shade(base, 0.4)
  if (w > h) ctx.fillRect(x, y + h - Math.max(1, h * 0.14), w, Math.max(1, h * 0.14))
  else ctx.fillRect(x + w - Math.max(1, w * 0.16), y, Math.max(1, w * 0.16), h)
  ctx.globalAlpha = 1
}

function paintTimberFrame(size: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(size, size)
  const r = rng(0x7a13c)
  const timber = PALETTE.timberCold
  // Lime wash: cream by day, a cool bone under this moon.
  const plaster = '#6d7488'

  ctx.fillStyle = shade(plaster, 0.86)
  ctx.fillRect(0, 0, size, size)

  // Plaster first — mottling, patchy re-render, hairline cracks — so the frame stays crisp.
  blotches(ctx, r, size, 34, [0.05, 0.17], () => shade(plaster, lerp(0.72, 1.1, r())), [0.18, 0.5])
  for (let i = 0; i < 7; i += 1) {
    const w = lerp(size * 0.08, size * 0.22, r())
    const h = lerp(size * 0.06, size * 0.18, r())
    ctx.globalAlpha = lerp(0.08, 0.2, r())
    ctx.fillStyle = shade(plaster, r() < 0.5 ? 0.8 : 1.12)
    ctx.fillRect(r() * size, r() * size, w, h)
  }
  ctx.globalAlpha = 1
  ctx.strokeStyle = shade(plaster, 0.55)
  for (let i = 0; i < 22; i += 1) {
    ctx.globalAlpha = lerp(0.15, 0.4, r())
    ctx.lineWidth = lerp(0.7, 1.6, r())
    let x = r() * size
    let y = r() * size
    ctx.beginPath()
    ctx.moveTo(x, y)
    const steps = 3 + Math.floor(r() * 4)
    for (let s = 0; s < steps; s += 1) {
      x += (r() - 0.5) * size * 0.09
      y += (r() - 0.5) * size * 0.09
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // The frame. A stud straddles u=0/u=1 so the bay tiles seamlessly.
  const stud = size * 0.052
  const rail = size * 0.062
  const plate = size * 0.085
  member(ctx, r, -stud / 2, 0, stud, size, timber)
  member(ctx, r, size - stud / 2, 0, stud, size, timber)
  member(ctx, r, size * 0.5 - stud / 2, 0, stud, size, timber)
  // Two intermediate studs, deliberately off-centre in their halves.
  member(ctx, r, size * 0.27, 0, stud * 0.82, size, timber)
  member(ctx, r, size * 0.71, 0, stud * 0.78, size, timber)
  // Top plate, mid rail, bottom sill.
  member(ctx, r, 0, 0, size, plate, timber)
  member(ctx, r, 0, size * 0.47, size, rail, timber)
  member(ctx, r, 0, size - plate * 0.95, size, plate * 0.95, timber)

  // Diagonal braces — differing pitch and length, never a mirrored pair.
  const brace = (x0: number, y0: number, x1: number, y1: number, thick: number) => {
    ctx.save()
    ctx.translate(x0, y0)
    ctx.rotate(Math.atan2(y1 - y0, x1 - x0))
    member(ctx, r, 0, -thick / 2, Math.hypot(x1 - x0, y1 - y0), thick, timber)
    ctx.restore()
  }
  brace(size * 0.03, size * 0.45, size * 0.26, size * 0.1, stud * 0.86)
  brace(size * 0.53, size * 0.95, size * 0.7, size * 0.56, stud * 0.8)
  brace(size * 0.74, size * 0.1, size * 0.97, size * 0.42, stud * 0.72)

  // Pegs at the joints.
  ctx.fillStyle = shade(timber, 1.55)
  ctx.globalAlpha = 0.6
  for (const [px, py] of [
    [size * 0.5, size * 0.5],
    [size * 0.27, size * 0.5],
    [size * 0.71, size * 0.5],
    [size * 0.5, size * 0.045],
    [size * 0.27, size * 0.045],
  ] as const) {
    ctx.beginPath()
    ctx.arc(px, py, size * 0.006, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  grain(ctx, size, r, 11)
  return canvas
}

// ---------------------------------------------------------------------------------------------
// PAINTER — shingle / slate (ROOF, dormer roofs, tower cap)
// ---------------------------------------------------------------------------------------------

function paintShingle(size: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(size, size)
  const r = rng(0x2be91)
  const base = PALETTE.shingleCold

  ctx.fillStyle = shade(base, 0.45)
  ctx.fillRect(0, 0, size, size)

  const courses = 11
  const ch = size / courses
  const perRow = 8
  for (let c = 0; c < courses; c += 1) {
    // One full sine period across the tile keeps the sag seamless.
    const sag = (x: number) => Math.sin((x / size) * Math.PI * 2 + c * 0.7) * ch * 0.09
    const offset = (c % 2 === 0 ? 0 : 0.5) + (r() - 0.5) * 0.12
    for (let i = -1; i <= perRow; i += 1) {
      const w = (size / perRow) * lerp(0.92, 1.08, r())
      const x = ((i + offset) * size) / perRow
      const y = c * ch + sag(x)
      const h = ch * lerp(1.5, 1.7, r())
      const tone = lerp(0.72, 1.3, r() ** 0.9)
      const ragged = ch * lerp(0.05, 0.2, r())
      wrapped(ctx, size, x, (ox) => {
        ctx.beginPath()
        ctx.moveTo(ox + 1, y)
        ctx.lineTo(ox + w - 1, y)
        ctx.lineTo(ox + w - 1, y + h - ch * 0.12)
        ctx.lineTo(ox + w * 0.55, y + h)
        ctx.lineTo(ox + 1, y + h - ragged)
        ctx.closePath()
        ctx.fillStyle = shade(base, tone)
        ctx.fill()
        // Butt shadow: the course below tucks under this one.
        ctx.globalAlpha = 0.85
        ctx.fillStyle = shade(base, 0.34)
        ctx.fillRect(ox + 1, y + h - ch * 0.16, w - 2, ch * 0.16)
        ctx.globalAlpha = 1
        const lw = Math.max(1, size * 0.0018)
        ctx.lineWidth = lw
        ctx.strokeStyle = shade(base, tone * 1.9)
        ctx.beginPath()
        ctx.moveTo(ox + 1.5, y + 1)
        ctx.lineTo(ox + w - 1.5, y + 1)
        ctx.stroke()
        ctx.strokeStyle = shade(base, 0.3)
        ctx.beginPath()
        ctx.moveTo(ox + 0.5, y)
        ctx.lineTo(ox + 0.5, y + h)
        ctx.stroke()
      })
    }
  }
  blotches(ctx, r, size, 18, [0.04, 0.14], () => shade(base, lerp(0.6, 1.35, r())), [0.1, 0.3])
  blotches(ctx, r, size, 8, [0.02, 0.06], () => 'rgb(52,64,54)', [0.08, 0.2])
  grain(ctx, size, r, 12)
  return canvas
}

// ---------------------------------------------------------------------------------------------
// PAINTER — brick (CHIMNEY). Mapped once over the stack, so the soot gradient is real.
// ---------------------------------------------------------------------------------------------

function paintBrick(size: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(size, size)
  const r = rng(0x9c40d)
  // Fired clay at night: dull warm-grey, not terracotta.
  const base = '#3a3140'

  ctx.fillStyle = shade(base, 0.55)
  ctx.fillRect(0, 0, size, size)

  const courses = 26
  const bh = size / courses
  const perRow = 6
  for (let c = 0; c < courses; c += 1) {
    const offset = c % 2 === 0 ? 0 : 0.5
    for (let i = -1; i <= perRow; i += 1) {
      const w = size / perRow
      const x = (i + offset) * w
      const joint = Math.max(1, bh * 0.13)
      const tone = lerp(0.78, 1.24, r() ** 0.8)
      const warm = r() < 0.25 ? 10 : 0
      wrapped(ctx, size, x, (ox) => {
        roundRectPath(ctx, ox + joint, c * bh + joint, w - joint * 2, bh - joint * 2, bh * 0.12)
        ctx.fillStyle = shade(base, tone, warm, warm * 0.3, warm * 0.2)
        ctx.fill()
        const lw = Math.max(1, size * 0.0016)
        ctx.lineWidth = lw
        ctx.strokeStyle = shade(base, tone * 1.6)
        ctx.beginPath()
        ctx.moveTo(ox + joint + 1, c * bh + joint + lw)
        ctx.lineTo(ox + w - joint - 1, c * bh + joint + lw)
        ctx.stroke()
      })
    }
  }
  blotches(ctx, r, size, 16, [0.04, 0.13], () => shade(base, lerp(0.65, 1.15, r())), [0.12, 0.3])

  // Soot. v = 0 is the top of the stack in the building's chimney UV mapping.
  const soot = ctx.createLinearGradient(0, 0, 0, size)
  soot.addColorStop(0, 'rgba(6,7,12,0.72)')
  soot.addColorStop(0.22, 'rgba(6,7,12,0.34)')
  soot.addColorStop(0.5, 'rgba(6,7,12,0.08)')
  soot.addColorStop(1, 'rgba(6,7,12,0)')
  ctx.fillStyle = soot
  ctx.fillRect(0, 0, size, size)
  grain(ctx, size, r, 12)
  return canvas
}

// ---------------------------------------------------------------------------------------------
// PAINTER — the hanging sign board. Terminus of the reading diagonal, so it gets a device.
// ---------------------------------------------------------------------------------------------

function paintSignBoard(size: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(size, size)
  const r = rng(0x3f11a)
  const ground = '#1b2130'

  ctx.fillStyle = ground
  ctx.fillRect(0, 0, size, size)
  // Board planks, running vertically.
  for (let i = 0; i < 4; i += 1) {
    const x = (i * size) / 4
    ctx.fillStyle = shade(ground, lerp(0.85, 1.2, r()))
    ctx.fillRect(x, 0, size / 4, size)
    timberGrain(ctx, r, x, 0, size / 4, size, ground)
    ctx.globalAlpha = 0.5
    ctx.fillStyle = shade(ground, 0.5)
    ctx.fillRect(x, 0, Math.max(1, size * 0.006), size)
    ctx.globalAlpha = 1
  }

  // Gilt border and a key device — the chapter's emblem, worn thin.
  const gilt = PALETTE.brass
  ctx.strokeStyle = shade(gilt, 0.8)
  ctx.lineWidth = size * 0.028
  ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84)
  ctx.strokeStyle = shade(gilt, 1.05)
  ctx.lineWidth = size * 0.012
  ctx.strokeRect(size * 0.13, size * 0.13, size * 0.74, size * 0.74)

  ctx.strokeStyle = shade(gilt, 1.1)
  ctx.fillStyle = shade(gilt, 1.1)
  ctx.lineWidth = size * 0.035
  ctx.lineCap = 'round'
  // Bow.
  ctx.beginPath()
  ctx.arc(size * 0.5, size * 0.33, size * 0.11, 0, Math.PI * 2)
  ctx.stroke()
  // Shank.
  ctx.beginPath()
  ctx.moveTo(size * 0.5, size * 0.44)
  ctx.lineTo(size * 0.5, size * 0.76)
  ctx.stroke()
  // Wards.
  ctx.fillRect(size * 0.5, size * 0.62, size * 0.14, size * 0.035)
  ctx.fillRect(size * 0.5, size * 0.71, size * 0.1, size * 0.035)

  // Wear: the gilt is rubbed and the board is grimy.
  blotches(ctx, r, size, 18, [0.04, 0.14], () => shade(ground, lerp(0.6, 1.1, r())), [0.14, 0.34])
  grain(ctx, size, r, 12)
  return canvas
}

// ---------------------------------------------------------------------------------------------
// TEXTURE + MATERIAL CACHE — module level, so hot reload and remounts never repaint
// ---------------------------------------------------------------------------------------------

export type InnSkin = 'stone' | 'timber' | 'shingle' | 'brick' | 'sign'

type SkinRecipe = {
  readonly paint: (size: number) => HTMLCanvasElement
  readonly size: number
  /** Sobel gain for the derived normal map. */
  readonly bump: number
  readonly rough: readonly [number, number]
}

const RECIPES: Record<InnSkin, SkinRecipe> = {
  stone: { paint: paintRubbleStone, size: 1024, bump: 2.4, rough: [0.72, 0.98] },
  timber: { paint: paintTimberFrame, size: 1024, bump: 2.9, rough: [0.6, 0.95] },
  shingle: { paint: paintShingle, size: 1024, bump: 3.2, rough: [0.66, 0.96] },
  brick: { paint: paintBrick, size: 512, bump: 2.2, rough: [0.74, 0.98] },
  sign: { paint: paintSignBoard, size: 512, bump: 1.6, rough: [0.5, 0.92] },
}

export type SkinTextures = {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
}

const texCache = new Map<InnSkin, SkinTextures>()

function makeTexture(source: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(source)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

export function skinTextures(skin: InnSkin): SkinTextures {
  const cached = texCache.get(skin)
  if (cached) return cached
  const recipe = RECIPES[skin]
  const albedo = recipe.paint(recipe.size)
  const set: SkinTextures = {
    map: makeTexture(albedo, true),
    normalMap: makeTexture(normalFromLuminance(albedo, recipe.bump), false),
    roughnessMap: makeTexture(roughFromLuminance(albedo, recipe.rough[0], recipe.rough[1]), false),
  }
  texCache.set(skin, set)
  return set
}

// ---------------------------------------------------------------------------------------------
// MATERIALS — one per skin plus the plain joinery/metal/glass set. Merge geometry by these.
// ---------------------------------------------------------------------------------------------

export type InnMaterials = {
  /** Textured skins. */
  stone: THREE.MeshStandardMaterial
  timber: THREE.MeshStandardMaterial
  shingle: THREE.MeshStandardMaterial
  brick: THREE.MeshStandardMaterial
  sign: THREE.MeshStandardMaterial
  /** Small dark members: joists, verge boards, frames, doors, dormer cheeks. */
  joinery: THREE.MeshStandardMaterial
  /** Wrought iron: bracket, lantern body, hooks. */
  iron: THREE.MeshStandardMaterial
  /** The only metal in the diorama. Keys, gilt, lantern trim. */
  brass: THREE.MeshStandardMaterial
  /** Anything the eye should read as an unlit hole: window reveals, arch soffit shadow. */
  interior: THREE.MeshStandardMaterial
  /** Lantern glazing. */
  glass: THREE.MeshStandardMaterial
}

let cachedMaterials: InnMaterials | null = null

function skinned(skin: InnSkin, colour: string, extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  const tex = skinTextures(skin)
  return applyRiseClip(
    new THREE.MeshStandardMaterial({
      color: colour,
      map: tex.map,
      normalMap: tex.normalMap,
      normalScale: new THREE.Vector2(1, 1),
      roughnessMap: tex.roughnessMap,
      roughness: 1,
      metalness: 0,
      ...extra,
    }),
  )
}

function plain(params: THREE.MeshStandardMaterialParameters) {
  return applyRiseClip(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...params }))
}

/**
 * The inn's whole material set. Client-only (the painters need a canvas) and memoised, so the
 * first mount pays for the paint and every later mount is free.
 */
export function innMaterials(): InnMaterials {
  if (cachedMaterials) return cachedMaterials
  cachedMaterials = {
    stone: skinned('stone', '#ffffff'),
    timber: skinned('timber', '#ffffff'),
    shingle: skinned('shingle', '#ffffff'),
    brick: skinned('brick', '#ffffff'),
    sign: skinned('sign', '#ffffff', { normalScale: new THREE.Vector2(0.6, 0.6) }),
    joinery: plain({ color: shade(PALETTE.timberCold, 0.82) }),
    iron: plain({ color: '#14171f', roughness: 0.72, metalness: 0.25 }),
    brass: plain({ color: PALETTE.brass, roughness: 0.38, metalness: 0.85 }),
    interior: plain({ color: '#080b13', roughness: 1 }),
    glass: applyRiseClip(
      new THREE.MeshStandardMaterial({
        color: PALETTE.glassDark,
        roughness: 0.16,
        metalness: 0,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
    ),
  }
  return cachedMaterials
}
