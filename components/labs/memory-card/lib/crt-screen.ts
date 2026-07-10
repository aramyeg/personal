/**
 * CRT screen texture — the era terminal that replaces the crt.glb's baked
 * emissive image (a cat photo) on the About act's console.
 *
 * A `CanvasTexture` drawn as a phosphor terminal: a dark screen field, a soft
 * center glow, a `SAVE DATA` header, the bio condensed to short caps ticker
 * lines, CRT scanlines, and an edge vignette. Text is the salvaged 5x7 bitmap
 * font (no DOM webfont to wait on, and it reads as genuine pixel phosphor), so
 * the draw is fully synchronous — a single `draw(activeIndex)` repaints the
 * canvas and flags the texture for re-upload.
 *
 * This is browser-only (2D canvas + THREE.CanvasTexture); the module is pulled
 * in solely by `crt-vignette.tsx`, which the section tests mock, so it never
 * enters jsdom.
 */

import * as THREE from 'three'
import { drawBitmapText, measureBitmapText } from './bitmap-font'
import { MC } from '../tokens'

const W = 512
const H = 384
const PAD = 40

// Phosphor palette, derived from the lab's triangle accent (MC.glyphs.triangle,
// a teal-green) so the screen glows in a color the token system already owns —
// bright for the active line + header bloom, dim for idle lines, near-black
// field. Raw rgba is sanctioned here (canvas-draw colors, not layout tokens).
const PHOSPHOR = MC.glyphs.triangle // #00ac9f
const PHOSPHOR_BRIGHT = '#9df7ec' // lightened triangle — active line + header
const PHOSPHOR_DIM = 'rgba(0,172,159,0.5)' // triangle at reduced strength — idle lines
const SCREEN_BG = '#05100c'

/** 5x7 glyph advance (width + 1px kern), matching bitmap-font's own metric. */
const ADVANCE = 6

export type CrtScreen = {
  texture: THREE.CanvasTexture
  /** Repaint with `activeIndex` highlighted (`-1` = none, e.g. reduced motion). */
  draw: (activeIndex: number) => void
  dispose: () => void
}

/**
 * Build the offscreen canvas + its texture once. `flipY` is passed in from the
 * material's original emissive map so our replacement inherits the GLB's UV
 * orientation convention (glTF authors flipY=false; CanvasTexture defaults
 * true) — calibrated against a screenshot zoom-crop, never assumed.
 */
export function createCrtScreen(lines: string[], flipY: boolean): CrtScreen {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = flipY
  texture.anisotropy = 8

  const draw = (activeIndex: number) => {
    paint(g, lines, activeIndex)
    texture.needsUpdate = true
  }

  return { texture, draw, dispose: () => texture.dispose() }
}

/** Repaint the whole terminal for one active-line state. */
function paint(
  g: CanvasRenderingContext2D,
  lines: string[],
  activeIndex: number
): void {
  g.globalCompositeOperation = 'source-over'
  g.shadowBlur = 0

  // Screen field + soft center glow.
  g.fillStyle = SCREEN_BG
  g.fillRect(0, 0, W, H)
  const glow = g.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.46, W * 0.62)
  glow.addColorStop(0, 'rgba(0,172,159,0.14)')
  glow.addColorStop(1, 'rgba(0,172,159,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, W, H)

  // Header — the save/load vocabulary the whole lab speaks, plus the wordmark.
  g.shadowColor = PHOSPHOR
  g.shadowBlur = 6
  drawBitmapText(g, 'SAVE DATA', PAD, PAD, { scale: 3, color: PHOSPHOR_BRIGHT })
  const tag = 'AY-01'
  const tagW = measureBitmapText(tag, 2)
  drawBitmapText(g, tag, W - PAD - tagW, PAD + 4, { scale: 2, color: PHOSPHOR_DIM })

  // Divider under the header.
  g.shadowBlur = 0
  g.fillStyle = 'rgba(0,172,159,0.32)'
  g.fillRect(PAD, PAD + 34, W - 2 * PAD, 2)

  // Ticker body — one uniform scale sized so the longest line fits the width.
  const longest = Math.max(1, ...lines.map((l) => l.length))
  const bodyScale = Math.max(2, Math.floor((W - 2 * PAD) / (longest * ADVANCE - 1)))
  const lineH = 7 * bodyScale + Math.round(bodyScale * 6)
  let y = PAD + 62
  g.shadowColor = PHOSPHOR
  g.shadowBlur = 6
  lines.forEach((line, i) => {
    const active = i === activeIndex
    drawBitmapText(g, line, PAD, y, {
      scale: bodyScale,
      color: active ? PHOSPHOR_BRIGHT : PHOSPHOR_DIM,
    })
    // Block cursor trailing the active line — the terminal "reading" this row.
    if (active) {
      const lw = measureBitmapText(line, bodyScale)
      g.fillStyle = PHOSPHOR_BRIGHT
      g.fillRect(PAD + lw + bodyScale * 2, y, bodyScale * 5, 7 * bodyScale)
    }
    y += lineH
  })

  // CRT scanlines + edge vignette on top of everything.
  g.shadowBlur = 0
  g.fillStyle = 'rgba(0,0,0,0.22)'
  for (let sy = 0; sy < H; sy += 3) g.fillRect(0, sy, W, 1)
  const vig = g.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.78)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.55)')
  g.fillStyle = vig
  g.fillRect(0, 0, W, H)
}
