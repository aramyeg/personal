'use client'

import * as THREE from 'three'

/** Deterministic pseudo-random for repeatable textures. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')!]
}

/** Herringbone parquet, warm oak tones. */
export function makeParquetTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512)
  const rnd = mulberry32(7)
  g.fillStyle = '#7a4f2c'
  g.fillRect(0, 0, 512, 512)
  const w = 64, h = 16
  for (let row = -1; row < 512 / h + 1; row++) {
    for (let col = -1; col < 512 / w + 1; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0)
      const y = row * h
      const tone = 0.82 + rnd() * 0.36
      g.fillStyle = `rgb(${Math.round(138 * tone)}, ${Math.round(90 * tone)}, ${Math.round(51 * tone)})`
      g.fillRect(x + 1, y + 1, w - 2, h - 2)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Wine-red fabric wall with a subtle weave. */
export function makeWallTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256)
  const rnd = mulberry32(13)
  g.fillStyle = '#5a2028'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * 256, y = rnd() * 256
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,220,220,0.03)' : 'rgba(0,0,0,0.05)'
    g.fillRect(x, y, 2, 1)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Brass museum placard with engraved lab copy. */
export function makePlacardTexture(title: string, date: string, thesis: string): THREE.CanvasTexture {
  const [c, g] = canvas(512)
  c.height = 256
  const grad = g.createLinearGradient(0, 0, 512, 256)
  grad.addColorStop(0, '#b08d3f')
  grad.addColorStop(0.5, '#d6b968')
  grad.addColorStop(1, '#a5813a')
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 256)
  g.strokeStyle = 'rgba(60,40,0,0.55)'
  g.lineWidth = 6
  g.strokeRect(10, 10, 492, 236)
  g.fillStyle = '#2c1f08'
  g.textAlign = 'center'
  g.font = '700 44px Georgia, serif'
  g.fillText(title, 256, 78)
  g.font = 'italic 24px Georgia, serif'
  g.fillText(date, 256, 118)
  g.font = '20px Georgia, serif'
  // naive two-line wrap for the thesis
  const words = thesis.split(' ')
  let line = ''
  const lines: string[] = []
  for (const w of words) {
    if ((line + ' ' + w).length > 44 && line) { lines.push(line); line = w }
    else line = line ? line + ' ' + w : w
    if (lines.length === 2) break
  }
  if (lines.length < 2 && line) lines.push(line)
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, 256, 160 + i * 30))
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
