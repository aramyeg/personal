/**
 * Runtime canvas-texture generators for the memory-card save-labels — the small
 * stickers that float over each card's blank recess.
 *
 * These are NOT UI panels: they read as a label printed on paper and stuck to
 * the card. Paper field (MC.paper family), ink text, a single accent hit, grotesk
 * for the title / mono for the slot + metrics. Two audiences:
 *
 *  • The Work-act rail (`card-rail.tsx`) uses the plain `makeFrontSticker` /
 *    `makeBackSticker` pair (one template, front + back).
 *  • The character-select arc (`card-arc.tsx`) uses `makeSaveSticker`, which
 *    picks a per-save *layout variant* (bank-form / chat / app-badge for the
 *    three projects; quieter system-form layouts for the system saves) so the
 *    fan reads as a collection of distinct owned objects. Every variant speaks
 *    the same paper/ink/token language — only the composition changes — and each
 *    carries deterministic paper wear (see `card-wear.ts`) so no two feel new.
 *
 * The drawing space matches the recess aspect (measured 1.117 × 0.703 world =
 * 1.589:1) so the sticker maps 1:1 onto its float quad without distortion. All
 * drawing is browser-only (2D canvas); the module is never pulled into jsdom
 * (the components that import it are mocked in the section tests).
 */

import * as THREE from 'three'
import { MC, STICKER_PAPER, inkAlpha, paperAlpha, withAlpha } from '../tokens'
import { monoFamily } from '../fonts'
import { wearProfile, type WearProfile, type SaveLabelVariant } from './save-visuals'

const STICKER_W = 768
const STICKER_H = 483
const PAD = 44
const CONTENT_W = STICKER_W - PAD * 2

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

/** Clip a single line to `maxW` with an ellipsis (mono sub-notes never bleed). */
function clipLine(g: CanvasRenderingContext2D, text: string, maxW: number): string {
  let out = text
  while (out.length > 1 && g.measureText(out).width > maxW) {
    out = `${out.slice(0, -2)}…`
  }
  return out
}

// ---- Shared printed elements --------------------------------------------

/** Paper field with a subtle printed gradient (top brighter) + hairline keyline. */
function paintPaper(g: CanvasRenderingContext2D) {
  const grad = g.createLinearGradient(0, 0, 0, STICKER_H)
  grad.addColorStop(0, STICKER_PAPER.top)
  grad.addColorStop(1, MC.paper)
  g.fillStyle = grad
  g.fillRect(0, 0, STICKER_W, STICKER_H)

  g.strokeStyle = inkAlpha(0.16)
  g.lineWidth = 2
  roundRect(g, 12, 12, STICKER_W - 24, STICKER_H - 24, 12)
  g.stroke()
}

/** The accent slot chip — the section's one accent hit — with paper numerals. */
function paintChip(
  g: CanvasRenderingContext2D,
  slot: string,
  accent: string,
  x: number,
  y: number,
  w = 108,
  h = 58
) {
  g.fillStyle = accent
  roundRect(g, x, y, w, h, 8)
  g.fill()
  g.fillStyle = STICKER_PAPER.field
  g.font = `600 34px ${monoFamily}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(slot, x + w / 2, y + h / 2 + 1)
}

/** Right-hand mono tag, drawn against a middle baseline at `midY`. */
function paintTag(g: CanvasRenderingContext2D, tag: string, rightX: number, midY: number) {
  g.fillStyle = inkAlpha(0.42)
  g.font = `500 22px ${monoFamily}`
  g.textAlign = 'right'
  g.textBaseline = 'middle'
  g.fillText(tag.toUpperCase(), rightX, midY)
}

/**
 * Shared sticker base (chip top-left + right tag). Returns the y baseline where
 * body content starts. Kept for the plain front/back templates the Work rail uses.
 */
function paintBase(
  g: CanvasRenderingContext2D,
  slot: string,
  accent: string,
  tag: string
): number {
  paintPaper(g)
  const chipH = 58
  paintChip(g, slot, accent, PAD, PAD)
  paintTag(g, tag, STICKER_W - PAD, PAD + chipH / 2 + 1)
  return PAD + chipH + 62
}

/** A small five-point star — the app-badge variant's accent flourish. */
function drawStar(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string
) {
  g.beginPath()
  for (let i = 0; i < 5; i++) {
    const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    const inner = outer + Math.PI / 5
    g.lineTo(cx + Math.cos(outer) * r, cy + Math.sin(outer) * r)
    g.lineTo(cx + Math.cos(inner) * r * 0.45, cy + Math.sin(inner) * r * 0.45)
  }
  g.closePath()
  g.fillStyle = color
  g.fill()
}

/** An outlined mono pill (the save-dialog variant's yes/no options). */
function drawPill(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  stroke: string
) {
  g.font = `500 22px ${monoFamily}`
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  const w = g.measureText(text.toUpperCase()).width + 44
  const h = 46
  g.strokeStyle = stroke
  g.lineWidth = 2
  roundRect(g, x, y, w, h, h / 2)
  g.stroke()
  g.fillStyle = inkAlpha(0.7)
  g.fillText(text.toUpperCase(), x + 22, y + h / 2 + 1)
  return w
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// ---- Plain templates (Work-act rail) ------------------------------------

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
  const lines = wrapCaps(g, title, CONTENT_W, 2)
  let ty = bodyTop + 52
  for (const line of lines) {
    g.fillText(line, PAD, ty)
    ty += 74
  }

  g.fillStyle = inkAlpha(0.5)
  g.font = `500 25px ${monoFamily}`
  g.fillText(`SAVED · ${year.toUpperCase()}`, PAD, ty + 8)

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
    const [line] = wrapCaps(g, metric, CONTENT_W - 34, 1)
    g.fillStyle = accent
    g.fillText('›', PAD, my)
    g.fillStyle = inkAlpha(0.82)
    g.fillText(line, PAD + 34, my)
    my += 58
  }

  return toTexture(canvas)
}

// ---- Per-save layout variants (character-select arc) --------------------

export type SaveLabelSpec = {
  slot: string
  /** Project title, or a system save's label. */
  title: string
  /** Mono meta line — a project's year, or a system save's sub-note. */
  meta: string
  /** Right-hand mono tag ('save' | 'system' | 'log' | …). */
  tag: string
  accent: string
  variant: SaveLabelVariant
  /** Deterministic wear seed (from the slot id). */
  seed: number
}

/** Title in grotesk caps; returns the y baseline after the last line. */
function drawTitle(
  g: CanvasRenderingContext2D,
  title: string,
  titleFont: string,
  size: number,
  top: number,
  maxW: number,
  step: number
): number {
  g.fillStyle = MC.ink
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.font = `700 ${size}px ${titleFont}`
  const lines = wrapCaps(g, title, maxW, 2)
  let ty = top
  for (const line of lines) {
    g.fillText(line, PAD, ty)
    ty += step
  }
  return ty
}

/** Accent tick — the loud project variants' printed rule under the body. */
function accentTick(g: CanvasRenderingContext2D, accent: string) {
  g.strokeStyle = accent
  g.lineWidth = 5
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(PAD, STICKER_H - PAD)
  g.lineTo(PAD + 96, STICKER_H - PAD)
  g.stroke()
}

/** 01 — formal bank-form label: chip, ruled "saved" field carrying the year. */
function paintBankForm(g: CanvasRenderingContext2D, spec: SaveLabelSpec, titleFont: string) {
  paintChip(g, spec.slot, spec.accent, PAD, PAD)
  paintTag(g, 'save file', STICKER_W - PAD, PAD + 29)

  drawTitle(g, spec.title, titleFont, 60, PAD + 152, CONTENT_W, 66)

  const ruleY = STICKER_H - 116
  g.textAlign = 'left'
  g.fillStyle = inkAlpha(0.42)
  g.font = `500 18px ${monoFamily}`
  g.fillText('SAVED', PAD, ruleY - 20)
  g.fillStyle = inkAlpha(0.62)
  g.font = `500 26px ${monoFamily}`
  g.fillText(spec.meta.toUpperCase(), PAD, ruleY - 2)
  g.strokeStyle = inkAlpha(0.22)
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(PAD, ruleY + 8)
  g.lineTo(STICKER_W - PAD, ruleY + 8)
  g.stroke()
  g.strokeStyle = inkAlpha(0.1)
  g.beginPath()
  g.moveTo(PAD, ruleY + 42)
  g.lineTo(STICKER_W - PAD, ruleY + 42)
  g.stroke()

  accentTick(g, spec.accent)
}

/** 02 — messaging-app sticker: left accent bar, chip pill top-right, reply bubble. */
function paintChat(g: CanvasRenderingContext2D, spec: SaveLabelSpec, titleFont: string) {
  // Left accent side-bar (this variant's accent hit instead of a bottom tick).
  g.fillStyle = spec.accent
  roundRect(g, PAD, PAD, 8, STICKER_H - PAD * 2, 4)
  g.fill()

  paintChip(g, spec.slot, spec.accent, STICKER_W - PAD - 108, PAD)

  const lx = PAD + 30
  g.fillStyle = MC.ink
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.font = `700 58px ${titleFont}`
  const lines = wrapCaps(g, spec.title, CONTENT_W - 150, 2)
  let ty = PAD + 150
  for (const line of lines) {
    g.fillText(line, lx, ty)
    ty += 62
  }

  // Reply bubble carrying the meta, bottom-left, with a small tail.
  g.font = `500 24px ${monoFamily}`
  const label = spec.meta.toUpperCase()
  const bw = Math.min(CONTENT_W - 30, g.measureText(label).width + 48)
  const bh = 58
  const bx = lx
  const by = STICKER_H - PAD - bh
  g.fillStyle = withAlpha(spec.accent, 0.1)
  g.strokeStyle = withAlpha(spec.accent, 0.5)
  g.lineWidth = 2
  roundRect(g, bx, by, bw, bh, 16)
  g.fill()
  g.stroke()
  g.beginPath()
  g.moveTo(bx + 4, by + bh - 12)
  g.lineTo(bx - 12, by + bh + 6)
  g.lineTo(bx + 28, by + bh - 2)
  g.closePath()
  g.fillStyle = withAlpha(spec.accent, 0.1)
  g.fill()
  g.fillStyle = inkAlpha(0.72)
  g.textBaseline = 'middle'
  g.fillText(clipLine(g, label, bw - 40), bx + 24, by + bh / 2 + 1)
}

/** 03 — app-store badge: chip, accent icon tile, star row over the meta. */
function paintAppBadge(g: CanvasRenderingContext2D, spec: SaveLabelSpec, titleFont: string) {
  paintChip(g, spec.slot, spec.accent, PAD, PAD)

  // App-icon tile, top-right: accent rounded square with an inset paper square.
  const iw = 66
  const ix = STICKER_W - PAD - iw
  roundRect(g, ix, PAD, iw, iw, 15)
  g.fillStyle = spec.accent
  g.fill()
  roundRect(g, ix + 19, PAD + 19, iw - 38, iw - 38, 6)
  g.fillStyle = STICKER_PAPER.field
  g.fill()

  drawTitle(g, spec.title, titleFont, 56, PAD + 150, CONTENT_W, 62)

  // Star flourish + the meta beneath it.
  const starY = STICKER_H - 92
  for (let i = 0; i < 5; i++) drawStar(g, PAD + 15 + i * 40, starY, 13, spec.accent)
  g.fillStyle = inkAlpha(0.52)
  g.font = `500 22px ${monoFamily}`
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText(`SAVED · ${spec.meta.toUpperCase()}`, PAD, starY + 40)

  accentTick(g, spec.accent)
}

/** Quiet system chip + tag + a small accent marker (system saves stay understated). */
function paintSystemHead(g: CanvasRenderingContext2D, spec: SaveLabelSpec) {
  paintChip(g, spec.slot, spec.accent, PAD, PAD)
  paintTag(g, spec.tag, STICKER_W - PAD, PAD + 29)
}

function systemMarker(g: CanvasRenderingContext2D, accent: string) {
  g.fillStyle = accent
  g.fillRect(PAD, STICKER_H - PAD - 6, 28, 6)
}

/** 04 — system read-out: title, hairline rule, mono sub-note. */
function paintSysData(g: CanvasRenderingContext2D, spec: SaveLabelSpec, titleFont: string) {
  paintSystemHead(g, spec)
  const ty = drawTitle(g, spec.title, titleFont, 52, PAD + 150, CONTENT_W, 58)
  g.strokeStyle = inkAlpha(0.16)
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(PAD, ty + 2)
  g.lineTo(STICKER_W - PAD, ty + 2)
  g.stroke()
  g.fillStyle = inkAlpha(0.5)
  g.font = `500 22px ${monoFamily}`
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText(clipLine(g, spec.meta.toLowerCase(), CONTENT_W), PAD, ty + 40)
  systemMarker(g, spec.accent)
}

/** 05 — ledger / log: title, mono sub, faint ruled rows led by accent ticks. */
function paintSysLog(g: CanvasRenderingContext2D, spec: SaveLabelSpec, titleFont: string) {
  paintSystemHead(g, spec)
  const ty = drawTitle(g, spec.title, titleFont, 52, PAD + 150, CONTENT_W, 58)
  g.fillStyle = inkAlpha(0.5)
  g.font = `500 21px ${monoFamily}`
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText(clipLine(g, spec.meta.toLowerCase(), CONTENT_W), PAD, ty + 30)

  let ry = ty + 66
  for (let i = 0; i < 3; i++) {
    g.fillStyle = spec.accent
    g.fillText('›', PAD, ry)
    g.strokeStyle = inkAlpha(0.12)
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(PAD + 30, ry + 4)
    g.lineTo(STICKER_W - PAD, ry + 4)
    g.stroke()
    ry += 34
  }
}

/** 06 — save dialog: big prompt, mono sub, two outlined option pills. */
function paintSysPrompt(g: CanvasRenderingContext2D, spec: SaveLabelSpec, titleFont: string) {
  paintSystemHead(g, spec)
  g.fillStyle = MC.ink
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.font = `700 72px ${titleFont}`
  g.fillText(spec.title.toUpperCase(), PAD, PAD + 168)

  g.fillStyle = inkAlpha(0.5)
  g.font = `500 22px ${monoFamily}`
  g.fillText(clipLine(g, spec.meta.toLowerCase(), CONTENT_W), PAD, PAD + 210)

  const py = STICKER_H - PAD - 56
  const yesW = drawPill(g, 'yes', PAD, py, spec.accent)
  drawPill(g, 'no', PAD + yesW + 22, py, inkAlpha(0.3))
}

const PAINTERS: Record<
  SaveLabelVariant,
  (g: CanvasRenderingContext2D, spec: SaveLabelSpec, font: string) => void
> = {
  bankform: paintBankForm,
  chat: paintChat,
  appbadge: paintAppBadge,
  sysdata: paintSysData,
  syslog: paintSysLog,
  sysprompt: paintSysPrompt,
}

/**
 * Deterministic paper wear painted over the finished label: an inset grime
 * vignette, a lifted-corner curl (shadow + highlight sliver), and — where the
 * profile marks it — a faint light scuff streak. Kept low-alpha so the label
 * stays fully readable at fan scale; it reads as handling, not damage.
 */
function applyPaperWear(g: CanvasRenderingContext2D, profile: WearProfile) {
  const { grime, scuffCorner, scratchAngle, hasScratch } = profile
  const W = STICKER_W
  const H = STICKER_H

  const vign = g.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.34,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.62
  )
  vign.addColorStop(0, inkAlpha(0))
  vign.addColorStop(1, inkAlpha(0.06 * grime))
  g.fillStyle = vign
  g.fillRect(0, 0, W, H)

  // Lifted-corner curl at the worn corner.
  const corners: ReadonlyArray<readonly [number, number, number, number]> = [
    [12, 12, 1, 1],
    [W - 12, 12, -1, 1],
    [W - 12, H - 12, -1, -1],
    [12, H - 12, 1, -1],
  ]
  const [cx, cy, sx, sy] = corners[scuffCorner]
  const curl = g.createRadialGradient(cx, cy, 0, cx, cy, 96)
  curl.addColorStop(0, inkAlpha(0.11 * grime))
  curl.addColorStop(1, inkAlpha(0))
  g.fillStyle = curl
  g.fillRect(0, 0, W, H)
  g.strokeStyle = paperAlpha(0.4)
  g.lineWidth = 3
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(cx, cy + sy * 52)
  g.lineTo(cx + sx * 52, cy)
  g.stroke()

  if (hasScratch) {
    g.save()
    g.translate(W / 2, H / 2)
    g.rotate(scratchAngle)
    g.strokeStyle = paperAlpha(0.22)
    g.lineWidth = 2
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(-W * 0.32, 18)
    g.lineTo(W * 0.3, -14)
    g.stroke()
    g.restore()
  }
}

/**
 * A save's printed sticker: its per-save layout variant over shared paper, aged
 * with deterministic wear. This is what every card on the character-select arc
 * wears — the fan reads as a collection because no two labels compose alike.
 */
export function makeSaveSticker(spec: SaveLabelSpec, titleFont: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = STICKER_W
  canvas.height = STICKER_H
  const g = canvas.getContext('2d')!
  paintPaper(g)
  PAINTERS[spec.variant](g, spec, titleFont)
  applyPaperWear(g, wearProfile(spec.seed))
  return toTexture(canvas)
}
