'use client'
import * as THREE from 'three'
import { PSX } from './psx-constants'

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
