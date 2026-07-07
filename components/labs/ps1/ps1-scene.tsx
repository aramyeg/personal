'use client'

import { useEffect, useRef } from 'react'
import styles from './ps1.module.css'

/**
 * PS1-era software renderer: low-poly shapes rasterized on a 384px-wide
 * canvas 2D buffer with flat shading, 2x2 ordered dithering, and whole-pixel
 * vertex snapping, upscaled with hard pixels. No WebGL on purpose — the
 * artifacts ARE the aesthetic.
 */

const PAL = {
  void: '#07090d',
  grid: '#4a5468',
  gridFar: '#232a35',
  horizon: '#5583ff',
  star: '#87919f',
}

const hex = (h: string): number[] => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`
const lerp3 = (a: number[], b: number[], t: number) =>
  [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t))

const T = (1 + Math.sqrt(5)) / 2
const ICO_V = [
  [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0],
  [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T],
  [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
].map((v) => {
  const l = Math.hypot(...v)
  return v.map((c) => c / l)
})
const ICO_F = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
]
const CUBE_V = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
].map((v) => v.map((c) => c * 0.72))
const CUBE_F = [
  [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [4, 5, 1, 0], [3, 2, 6, 7],
]
const OCT_V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const OCT_F = [
  [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
  [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5],
]

const MORPHS = [
  { v: ICO_V, f: ICO_F, s: [1, 1, 1] }, // icosahedron
  { v: OCT_V, f: OCT_F, s: [0.85, 1.45, 0.85] }, // PS1 boot diamond
  { v: CUBE_V, f: CUBE_F, s: [1, 1, 1] }, // cube
]

const LOW_W = 384
const LEVELS = 6

type Shape = {
  morph: number
  mat: 'blue' | 'green' | 'white'
  ax: number
  ay: number
  r: number
  rx: number
  ry: number
  sx: number
  sy: number
  main?: boolean
}

export function PS1Scene() {
  const crtRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const crt = crtRef.current
    const canvas = canvasRef.current
    if (!crt || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let LOW_H = 216
    let CX = LOW_W / 2
    let HY = 125

    const resize = () => {
      const r = crt.getBoundingClientRect()
      LOW_H = Math.max(160, Math.round((LOW_W * r.height) / r.width))
      canvas.width = LOW_W
      canvas.height = LOW_H
      CX = LOW_W / 2
      HY = Math.round(LOW_H * 0.58)
      ctx.imageSmoothingEnabled = false
      seedStars()
    }

    // Shade ramps: solid levels interleaved with 2x2 dither patterns
    const ramp = (dark: string, base: string, light: string) => {
      const out: number[][] = []
      for (let i = 0; i < LEVELS; i++) {
        const t = i / (LEVELS - 1)
        out.push(
          t < 0.5
            ? lerp3(hex(dark), hex(base), t * 2)
            : lerp3(hex(base), hex(light), (t - 0.5) * 2)
        )
      }
      return out
    }
    const dither = (a: number[], b: number[]) => {
      const c = document.createElement('canvas')
      c.width = 2
      c.height = 2
      const x = c.getContext('2d')!
      x.fillStyle = rgb(a)
      x.fillRect(0, 0, 2, 2)
      x.fillStyle = rgb(b)
      x.fillRect(0, 0, 1, 1)
      x.fillRect(1, 1, 1, 1)
      return ctx.createPattern(c, 'repeat')!
    }
    const material = (dark: string, base: string, light: string) => {
      const solids = ramp(dark, base, light)
      const styles: (string | CanvasPattern)[] = []
      for (let i = 0; i < LEVELS; i++) {
        styles.push(rgb(solids[i]))
        if (i < LEVELS - 1) styles.push(dither(solids[i], solids[i + 1]))
      }
      return styles
    }
    const MAT = {
      blue: material('#101a33', '#5583ff', '#d5e2ff'),
      green: material('#0b2e22', '#37e39f', '#d2ffe9'),
      white: material('#2a303c', '#87919f', '#e8edf4'),
    }

    const L = (() => {
      const v = [-0.45, -0.6, -0.65]
      const l = Math.hypot(...v)
      return v.map((c) => c / l)
    })()

    const shapes: Shape[] = [
      { morph: 0, mat: 'blue', ax: 0.66, ay: 0.4, r: 52, rx: 0, ry: 0, sx: 0.3, sy: 0.42, main: true },
      { morph: 2, mat: 'white', ax: 0.16, ay: 0.24, r: 15, rx: 0.7, ry: 0.2, sx: -0.55, sy: 0.3 },
      { morph: 1, mat: 'green', ax: 0.87, ay: 0.74, r: 13, rx: 0.2, ry: 0.9, sx: 0.45, sy: -0.62 },
    ]

    let userRX = 0
    let userRY = 0
    let targRX = 0
    let targRY = 0
    let dragging = false
    let moved = false
    let lastPX = 0
    let lastPY = 0

    const rotate = (v: number[], rx: number, ry: number, s: number[]) => {
      let [x, y, z] = [v[0] * s[0], v[1] * s[1], v[2] * s[2]]
      const cy = Math.cos(ry)
      const sy = Math.sin(ry)
      ;[x, z] = [x * cy - z * sy, x * sy + z * cy]
      const cx = Math.cos(rx)
      const sx = Math.sin(rx)
      ;[y, z] = [y * cx - z * sx, y * sx + z * cx]
      return [x, y, z]
    }

    const drawShape = (sh: Shape, t: number) => {
      const m = MORPHS[sh.morph]
      const rx = sh.rx + t * sh.sx * 0.6 + (sh.main ? userRX : 0)
      const ry = sh.ry + t * sh.sy * 0.6 + (sh.main ? userRY : 0)
      const ax = Math.round(sh.ax * LOW_W)
      const ay = Math.round(sh.ay * (HY + 10) + (sh.main ? Math.round(Math.sin(t * 0.8) * 3) : 0))
      const styles = MAT[sh.mat]

      const rv = m.v.map((v) => rotate(v, rx, ry, m.s))
      const faces: { f: number[]; z: number; bright: number }[] = []
      for (const f of m.f) {
        const a = rv[f[0]]
        const b = rv[f[1]]
        const c = rv[f[2]]
        let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1])
        let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2])
        let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        const cx0 = f.reduce((s, i) => s + rv[i][0], 0) / f.length
        const cy0 = f.reduce((s, i) => s + rv[i][1], 0) / f.length
        const cz0 = f.reduce((s, i) => s + rv[i][2], 0) / f.length
        // Convex + centered models: orient the normal outward via the centroid
        if (nx * cx0 + ny * cy0 + nz * cz0 < 0) {
          nx = -nx
          ny = -ny
          nz = -nz
        }
        if (nz >= 0) continue // backface
        const nl = Math.hypot(nx, ny, nz) || 1
        const b0 = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / nl)
        faces.push({ f, z: cz0, bright: Math.min(1, 0.12 + b0 * 0.95) })
      }
      faces.sort((p, q) => q.z - p.z)

      for (const { f, bright } of faces) {
        const idx = Math.min(styles.length - 1, Math.round(bright * (styles.length - 1)))
        ctx.fillStyle = styles[idx]
        ctx.beginPath()
        f.forEach((vi, k) => {
          const v = rv[vi]
          const p = 3 / (3 + v[2])
          const px = Math.round(ax + v[0] * sh.r * p)
          const py = Math.round(ay + v[1] * sh.r * p)
          if (k) ctx.lineTo(px, py)
          else ctx.moveTo(px, py)
        })
        ctx.closePath()
        ctx.fill()
        if (typeof styles[idx] === 'string') {
          ctx.strokeStyle = styles[idx] as string
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }
    }

    let stars: number[][] = []
    const seedStars = () => {
      stars = []
      let s = 42
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
      for (let i = 0; i < 42; i++) {
        stars.push([Math.floor(rnd() * LOW_W), Math.floor(rnd() * (HY - 12)), rnd()])
      }
    }

    const drawWorld = (t: number) => {
      ctx.fillStyle = PAL.void
      ctx.fillRect(0, 0, LOW_W, LOW_H)

      for (const [x, y, k] of stars) {
        ctx.fillStyle = k > 0.8 ? PAL.horizon : PAL.star
        ctx.globalAlpha = 0.25 + k * 0.4
        ctx.fillRect(x, y, 1, 1)
      }
      ctx.globalAlpha = 1

      const g = ctx.createLinearGradient(0, HY - 22, 0, HY + 14)
      g.addColorStop(0, 'rgba(85,131,255,0)')
      g.addColorStop(0.85, 'rgba(85,131,255,.16)')
      g.addColorStop(1, 'rgba(85,131,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, HY - 22, LOW_W, 36)

      ctx.lineWidth = 1

      for (let k = -14; k <= 14; k++) {
        if (k === 0) continue
        ctx.strokeStyle = Math.abs(k) < 5 ? PAL.grid : PAL.gridFar
        ctx.beginPath()
        ctx.moveTo(CX + 0.5, HY + 0.5)
        ctx.lineTo(Math.round(CX + k * 34) + 0.5, LOW_H + 4)
        ctx.stroke()
      }

      const frac = reduced ? 0.3 : (t * 0.55) % 1
      for (let i = 1; i <= 14; i++) {
        const z = i - frac
        if (z < 0.12) continue
        const y = Math.round(HY + (LOW_H - HY) / z)
        if (y > LOW_H + 2) continue
        ctx.strokeStyle = z < 2.5 ? PAL.grid : PAL.gridFar
        ctx.beginPath()
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(LOW_W, y + 0.5)
        ctx.stroke()
      }

      ctx.strokeStyle = PAL.grid
      ctx.beginPath()
      ctx.moveTo(0, HY + 0.5)
      ctx.lineTo(LOW_W, HY + 0.5)
      ctx.stroke()
    }

    const frame = (t: number) => {
      drawWorld(t)
      userRX += (targRX - userRX) * 0.12
      userRY += (targRY - userRY) * 0.12
      for (const sh of shapes) drawShape(sh, t)
    }

    let rafId = 0
    let last = 0
    const loop = () => {
      const t = performance.now() / 1000
      if (t - last >= 1 / 30) {
        last = t
        frame(t) // 30fps lock, era-appropriate
      }
      rafId = requestAnimationFrame(loop)
    }

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      moved = false
      lastPX = e.clientX
      lastPY = e.clientY
    }
    const onPointerUp = () => {
      dragging = false
    }
    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        moved = true
        targRY += (e.clientX - lastPX) * 0.008
        targRX += (e.clientY - lastPY) * 0.008
        lastPX = e.clientX
        lastPY = e.clientY
      } else {
        const r = crt.getBoundingClientRect()
        targRY = ((e.clientX - r.left) / r.width - 0.5) * 0.5
        targRX = ((e.clientY - r.top) / r.height - 0.5) * 0.35
      }
      if (reduced) frame(0.3)
    }
    const morph = () => {
      shapes[0].morph = (shapes[0].morph + 1) % MORPHS.length
      if (reduced) frame(0.3)
    }
    const onClick = () => {
      if (!moved) morph()
      moved = false
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        morph()
      }
    }

    resize()
    window.addEventListener('resize', resize)
    crt.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    crt.addEventListener('click', onClick)
    crt.addEventListener('keydown', onKeyDown)

    if (reduced) frame(0.3)
    else rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      crt.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      crt.removeEventListener('click', onClick)
      crt.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div
      ref={crtRef}
      tabIndex={0}
      role="button"
      aria-label="Rotating low-poly figure. Click or press Enter to morph the shape."
      className="relative h-dvh min-h-[540px] overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#5583ff] focus-visible:ring-inset"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full cursor-pointer [image-rendering:pixelated]"
      />
      <div className={styles.scanlines} aria-hidden="true" />

      {/* HUD */}
      <div className="absolute top-0 inset-x-0 z-[3] flex justify-between items-baseline px-6 py-4 text-[11px] tracking-[.18em] uppercase text-[#87919f] pointer-events-none">
        <span>
          <b className="font-normal text-[#e8edf4]">AY-01</b> · SLOT 1
        </span>
        <span className="hidden sm:inline">
          SYS.PORTFOLIO / <b className="font-normal text-[#e8edf4]">CONCEPT.Y2K</b>
        </span>
        <span>
          <span className="text-[#37e39f]">●</span> GRID ONLINE
        </span>
      </div>

      {/* Title block */}
      <div className="absolute left-[clamp(20px,6vw,90px)] bottom-[clamp(72px,16vh,160px)] z-[2] pointer-events-none">
        <div className="text-[#5583ff] text-xs tracking-[.3em] uppercase mb-3.5">
          Senior Frontend Engineer
        </div>
        <h1 className="m-0 [font-family:'Arial_Black','Arial_Bold','Helvetica_Neue',Arial,sans-serif] text-[clamp(2.4rem,7.2vw,5.2rem)] leading-[.93] tracking-[-.01em] uppercase text-[#e8edf4] [text-shadow:0_0_24px_rgba(85,131,255,.25)]">
          Aram
          <br />
          Yeghiazaryan
        </h1>
        <div className="mt-4 text-xs tracking-[.14em] uppercase text-[#87919f]">
          <span className="text-[#37e39f]">■</span> 8 yrs · fintech systems · Yerevan → worldwide
        </div>
        <div className={`mt-7 text-xs tracking-[.28em] uppercase text-[#e8edf4] ${styles.blink}`}>
          Press start — scroll to continue
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 z-[3] flex justify-between items-baseline px-6 py-4 text-[11px] tracking-[.18em] uppercase text-[#87919f] pointer-events-none">
        <span className="hidden sm:inline">RENDER: 384PX · 30FPS LOCK · DITHER ON</span>
        <span>
          <span className="text-[#5583ff]">✛</span> DRAG ROTATE · CLICK MORPH
        </span>
      </div>
    </div>
  )
}
