/**
 * Runtime canvas-texture generators for the memory-card rail's printed
 * save-labels — the small stickers that float over each card's blank recess.
 *
 * These are NOT UI panels: they read as a label printed on paper and stuck to
 * the card. Paper field (MC.paper family), ink text, a single accent hit (the
 * slot chip), grotesk for the title / mono for the slot + metrics. The front
 * sticker carries the slot number + project title; the back sticker carries the
 * metrics list, revealed when the card flips.
 *
 * The drawing space matches the recess aspect (measured 1.117 × 0.703 world =
 * 1.589:1) so the sticker maps 1:1 onto its float quad without distortion. All
 * drawing is browser-only (2D canvas); the module is never pulled into jsdom
 * (the rail component that imports it is mocked in the section tests).
 */

import * as THREE from 'three'
import { MC } from '../tokens'
import { monoFamily } from '../fonts'

const STICKER_W = 768
const STICKER_H = 483
const PAD = 44

/** Rounded-rect path helper (printed keyline + slot chip corners). */
function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Word-wrap `text` to `maxW`, uppercased, at most `maxLines` lines. */
function wrapCaps(
  g: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number
): string[] {
  const words = text.toUpperCase().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (g.measureText(next).width > maxW && line) {
      lines.push(line)
      line = word
      if (lines.length === maxLines) return lines
    } else {
      line = next
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  return lines
}

/**
 * Shared sticker base: warm paper field with a faint top sheen, a hairline
 * printed keyline, the accent slot chip (paper text on accent), and a small
 * mono tag on the right. Returns the y baseline where body content should start.
 */
function paintBase(
  g: CanvasRenderingContext2D,
  slot: string,
  accent: string,
  tag: string
): number {
  // Paper field with a subtle printed gradient (top slightly brighter).
  const grad = g.createLinearGradient(0, 0, 0, STICKER_H)
  grad.addColorStop(0, '#f2f0ea')
  grad.addColorStop(1, MC.paper)
  g.fillStyle = grad
  g.fillRect(0, 0, STICKER_W, STICKER_H)

  // Printed hairline keyline just inside the edge.
  g.strokeStyle = 'rgba(16,16,20,0.16)'
  g.lineWidth = 2
  roundRect(g, 12, 12, STICKER_W - 24, STICKER_H - 24, 12)
  g.stroke()

  // Slot chip — the section's one accent hit.
  const chipW = 108
  const chipH = 58
  g.fillStyle = accent
  roundRect(g, PAD, PAD, chipW, chipH, 8)
  g.fill()
  g.fillStyle = '#f6f5f1'
  g.font = `600 34px ${monoFamily}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(slot, PAD + chipW / 2, PAD + chipH / 2 + 1)

  // Right-hand mono tag.
  g.fillStyle = 'rgba(16,16,20,0.42)'
  g.font = `500 22px ${monoFamily}`
  g.textAlign = 'right'
  g.textBaseline = 'middle'
  g.fillText(tag.toUpperCase(), STICKER_W - PAD, PAD + chipH / 2 + 1)

  return PAD + chipH + 62
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export type FrontSticker = { slot: string; title: string; year: string; accent: string }
export type BackSticker = { slot: string; metrics: string[]; accent: string }

/** Front label: slot chip + project title in grotesk caps, a mono saved-date. */
export function makeFrontSticker(
  { slot, title, year, accent }: FrontSticker,
  titleFont: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = STICKER_W
  canvas.height = STICKER_H
  const g = canvas.getContext('2d')!
  const bodyTop = paintBase(g, slot, accent, 'save')

  g.fillStyle = MC.ink
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.font = `700 66px ${titleFont}`
  const lines = wrapCaps(g, title, STICKER_W - PAD * 2, 2)
  let ty = bodyTop + 52
  for (const line of lines) {
    g.fillText(line, PAD, ty)
    ty += 74
  }

  // Saved-date line — the printed metadata a real save label carries.
  g.fillStyle = 'rgba(16,16,20,0.5)'
  g.font = `500 25px ${monoFamily}`
  g.fillText(`SAVED · ${year.toUpperCase()}`, PAD, ty + 8)

  // Accent underline tick — a printed rule under the label body.
  g.strokeStyle = accent
  g.lineWidth = 5
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(PAD, STICKER_H - PAD)
  g.lineTo(PAD + 96, STICKER_H - PAD)
  g.stroke()

  return toTexture(canvas)
}

/** Back label: slot chip + the metrics list in mono, each led by an accent tick. */
export function makeBackSticker({
  slot,
  metrics,
  accent,
}: BackSticker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = STICKER_W
  canvas.height = STICKER_H
  const g = canvas.getContext('2d')!
  const bodyTop = paintBase(g, slot, accent, 'save data')

  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.font = `500 27px ${monoFamily}`
  let my = bodyTop + 30
  for (const metric of metrics.slice(0, 4)) {
    const [line] = wrapCaps(g, metric, STICKER_W - PAD * 2 - 34, 1)
    g.fillStyle = accent
    g.fillText('›', PAD, my)
    g.fillStyle = 'rgba(16,16,20,0.82)'
    g.fillText(line, PAD + 34, my)
    my += 58
  }

  return toTexture(canvas)
}
