/**
 * Minimal real-arithmetic Canvas 2D shim for jsdom.
 *
 * jsdom does not implement CanvasRenderingContext2D on its own — it only
 * gets one via the optional native `canvas` peer dependency, which this
 * repo does not install (zero-new-deps constraint; native module install
 * risk on Windows). `HTMLCanvasElement.prototype.getContext('2d')`
 * therefore returns null in the `unit` vitest project.
 *
 * This module patches that prototype method with a tiny in-memory 2D
 * context backed by a real Uint8ClampedArray pixel buffer. Every pixel
 * produced is computed, never stubbed: solid fills alpha-composite onto
 * the buffer, gradients interpolate linearly along their axis, and
 * getImageData/putImageData round-trip the same buffer.
 *
 * Import this file for its side effect at the top of a test file to opt
 * in — it is not registered in vitest.setup.ts, so it only patches
 * canvases in files that import it.
 *
 * Implements only what's exercised today: fillStyle (hex3/hex6 and
 * rgb()/rgba()), fillRect, createLinearGradient/addColorStop,
 * beginPath/moveTo/lineTo/closePath/fill (an even-odd scanline polygon
 * rasterizer used by the poster/sticker/deck graphic generators), and
 * getImageData/putImageData. Extend as later tasks need more of the API.
 */

type RGBA = [r: number, g: number, b: number, a: number]

function parseColor(color: string): RGBA {
  const hex6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (hex6) {
    return [parseInt(hex6[1], 16), parseInt(hex6[2], 16), parseInt(hex6[3], 16), 1]
  }
  const hex3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color)
  if (hex3) {
    return [parseInt(hex3[1] + hex3[1], 16), parseInt(hex3[2] + hex3[2], 16), parseInt(hex3[3] + hex3[3], 16), 1]
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(color)
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])]
  }
  throw new Error(`canvas-2d shim: unsupported color "${color}" — extend parseColor`)
}

class LinearGradientShim {
  private stops: { offset: number; color: RGBA }[] = []

  constructor(
    private x0: number,
    private y0: number,
    private x1: number,
    private y1: number
  ) {}

  addColorStop(offset: number, color: string): void {
    this.stops.push({ offset, color: parseColor(color) })
    this.stops.sort((a, b) => a.offset - b.offset)
  }

  /** Project (px, py) onto the gradient axis and lerp between the bracketing stops. */
  colorAt(px: number, py: number): RGBA {
    if (this.stops.length === 0) return [0, 0, 0, 1]
    const dx = this.x1 - this.x0
    const dy = this.y1 - this.y0
    const lenSq = dx * dx + dy * dy
    const rawT = lenSq === 0 ? 0 : ((px - this.x0) * dx + (py - this.y0) * dy) / lenSq
    const t = Math.max(0, Math.min(1, rawT))
    if (t <= this.stops[0].offset) return this.stops[0].color
    const last = this.stops[this.stops.length - 1]
    if (t >= last.offset) return last.color
    for (let i = 0; i < this.stops.length - 1; i++) {
      const a = this.stops[i]
      const b = this.stops[i + 1]
      if (t >= a.offset && t <= b.offset) {
        const span = b.offset - a.offset
        const localT = span === 0 ? 0 : (t - a.offset) / span
        return [
          a.color[0] + (b.color[0] - a.color[0]) * localT,
          a.color[1] + (b.color[1] - a.color[1]) * localT,
          a.color[2] + (b.color[2] - a.color[2]) * localT,
          a.color[3] + (b.color[3] - a.color[3]) * localT,
        ]
      }
    }
    return last.color
  }
}

type Point = { x: number; y: number }

class Context2DShim {
  fillStyle: string | LinearGradientShim = '#000000'
  private readonly width: number
  private readonly height: number
  private readonly data: Uint8ClampedArray
  /** Current path as a list of subpaths; each is auto-closed at fill time. */
  private subpaths: Point[][] = []

  constructor(canvasEl: HTMLCanvasElement) {
    this.width = canvasEl.width
    this.height = canvasEl.height
    this.data = new Uint8ClampedArray(this.width * this.height * 4)
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): LinearGradientShim {
    return new LinearGradientShim(x0, y0, x1, y1)
  }

  /** The fill color at (px, py) — a flat color or a projected gradient sample. */
  private sample(px: number, py: number): RGBA {
    return this.fillStyle instanceof LinearGradientShim
      ? this.fillStyle.colorAt(px, py)
      : parseColor(this.fillStyle)
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const x0 = Math.max(0, Math.floor(x))
    const y0 = Math.max(0, Math.floor(y))
    const x1 = Math.min(this.width, Math.ceil(x + w))
    const y1 = Math.min(this.height, Math.ceil(y + h))
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const [r, g, b, a] = this.sample(px, py)
        this.blend(px, py, r, g, b, a)
      }
    }
  }

  beginPath(): void {
    this.subpaths = []
  }

  moveTo(x: number, y: number): void {
    this.subpaths.push([{ x, y }])
  }

  lineTo(x: number, y: number): void {
    if (this.subpaths.length === 0) this.subpaths.push([])
    this.subpaths[this.subpaths.length - 1].push({ x, y })
  }

  /** No-op: fill() implicitly closes each subpath, matching canvas fill semantics. */
  closePath(): void {}

  /**
   * Even-odd scanline fill of the current path. Each subpath is treated as a
   * closed polygon; a pixel is inside when its center crosses an odd number of
   * edges to its left. All the generators' shapes (torn edges, stars, bolts,
   * arrows, polygonal circles) are simple polygons, for which even-odd and the
   * canvas default nonzero rule agree.
   */
  fill(): void {
    const polys = this.subpaths.filter((sp) => sp.length >= 2)
    if (polys.length === 0) return
    let minY = Infinity
    let maxY = -Infinity
    for (const sp of polys) {
      for (const p of sp) {
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
    }
    const yStart = Math.max(0, Math.floor(minY))
    const yEnd = Math.min(this.height - 1, Math.ceil(maxY))
    for (let py = yStart; py <= yEnd; py++) {
      const yc = py + 0.5
      const crossings: number[] = []
      for (const sp of polys) {
        const n = sp.length
        for (let i = 0; i < n; i++) {
          const a = sp[i]
          const b = sp[(i + 1) % n]
          // Half-open edge test avoids double-counting shared vertices.
          if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) {
            crossings.push(a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x))
          }
        }
      }
      crossings.sort((p, q) => p - q)
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const xStart = Math.max(0, Math.ceil(crossings[k] - 0.5))
        const xEnd = Math.min(this.width - 1, Math.floor(crossings[k + 1] - 0.5))
        for (let px = xStart; px <= xEnd; px++) {
          const [r, g, b, a] = this.sample(px, py)
          this.blend(px, py, r, g, b, a)
        }
      }
    }
  }

  /** Source-over alpha compositing onto the opaque backing buffer. */
  private blend(px: number, py: number, r: number, g: number, b: number, a: number): void {
    const i = (py * this.width + px) * 4
    this.data[i] = r * a + this.data[i] * (1 - a)
    this.data[i + 1] = g * a + this.data[i + 1] * (1 - a)
    this.data[i + 2] = b * a + this.data[i + 2] * (1 - a)
    this.data[i + 3] = 255
  }

  getImageData(x: number, y: number, w: number, h: number): ImageData {
    const out = new Uint8ClampedArray(w * h * 4)
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const srcX = x + px
        const srcY = y + py
        if (srcX < 0 || srcY < 0 || srcX >= this.width || srcY >= this.height) continue
        const oi = (py * w + px) * 4
        const si = (srcY * this.width + srcX) * 4
        out[oi] = this.data[si]
        out[oi + 1] = this.data[si + 1]
        out[oi + 2] = this.data[si + 2]
        out[oi + 3] = this.data[si + 3]
      }
    }
    return { data: out, width: w, height: h, colorSpace: 'srgb' } as ImageData
  }

  putImageData(imageData: ImageData, x: number, y: number): void {
    const { data, width: w, height: h } = imageData
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dstX = x + px
        const dstY = y + py
        if (dstX < 0 || dstY < 0 || dstX >= this.width || dstY >= this.height) continue
        const si = (py * w + px) * 4
        const di = (dstY * this.width + dstX) * 4
        this.data[di] = data[si]
        this.data[di + 1] = data[si + 1]
        this.data[di + 2] = data[si + 2]
        this.data[di + 3] = data[si + 3]
      }
    }
  }
}

const contexts = new WeakMap<HTMLCanvasElement, Context2DShim>()
const originalGetContext = HTMLCanvasElement.prototype.getContext

function patchedGetContext(
  this: HTMLCanvasElement,
  contextId: string,
  ...rest: unknown[]
): RenderingContext | null {
  if (contextId !== '2d') {
    return (originalGetContext as (...args: unknown[]) => RenderingContext | null).apply(this, [
      contextId,
      ...rest,
    ])
  }
  let ctx = contexts.get(this)
  if (!ctx) {
    ctx = new Context2DShim(this)
    contexts.set(this, ctx)
  }
  return ctx as unknown as RenderingContext
}

HTMLCanvasElement.prototype.getContext = patchedGetContext as typeof HTMLCanvasElement.prototype.getContext
