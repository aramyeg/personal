/**
 * Banner texture painting. The layout math (`fitBannerText`) is pure with an
 * injected measure function so it unit-tests headlessly; `paintBanner` is the
 * thin Canvas 2D shell around it.
 */

import { CFG } from './config'

export type MeasureFn = (text: string, fontPx: number) => number

export interface FitResult {
  lines: string[]
  fontPx: number
}

/** Greedy word-wrap at a given size; returns null when it needs > maxLines. */
function wrapAt(
  words: string[],
  fontPx: number,
  maxWidth: number,
  measure: MeasureFn,
  maxLines: number
): string[] | null {
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const probe = cur ? `${cur} ${w}` : w
    if (measure(probe, fontPx) <= maxWidth || !cur) {
      cur = probe
    } else {
      lines.push(cur)
      cur = w
      if (lines.length >= maxLines) return null
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) return null
  for (const ln of lines) {
    if (measure(ln, fontPx) > maxWidth) return null
  }
  return lines
}

/**
 * Largest font size (binary search, px-resolution) whose greedy wrap fits in
 * maxLines within the padded width, clamped to the config's size range.
 */
export function fitBannerText(
  message: string,
  bannerW: number,
  bannerH: number,
  measure: MeasureFn
): FitResult {
  const P = CFG.paint
  const words = message.trim().split(/\s+/).filter(Boolean)
  const maxWidth = bannerW * (1 - P.padX * 2)
  const maxPx = Math.max(P.minFontPx, Math.floor(bannerH * P.maxFontFrac))

  let lo = P.minFontPx
  let hi = maxPx
  let best: FitResult = {
    lines: wrapAt(words, P.minFontPx, maxWidth, measure, P.maxLines) ?? [
      words.join(' '),
    ],
    fontPx: P.minFontPx,
  }
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const lines = wrapAt(words, mid, maxWidth, measure, P.maxLines)
    if (lines && mid * P.lineHeight * lines.length <= bannerH * 0.8) {
      best = { lines, fontPx: mid }
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

/** Deterministic tiny PRNG for the fibre flecks (no Math.random in render). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Paint the banner to an offscreen canvas: paper gradient, fibre flecks,
 * stitched border, auto-fit message. Call after `document.fonts.ready`.
 * Repaint only on message/size change — never per frame.
 */
export function paintBanner(
  message: string,
  bannerW: number,
  bannerH: number,
  devicePixelRatio: number
): HTMLCanvasElement {
  const P = CFG.paint
  let dpr = Math.min(devicePixelRatio || 1, P.dprCap) * P.oversample
  if (bannerW * dpr > P.maxTexWidth) dpr = P.maxTexWidth / bannerW

  const c = document.createElement('canvas')
  c.width = Math.round(bannerW * dpr)
  c.height = Math.round(bannerH * dpr)
  const x = c.getContext('2d')
  if (!x) return c
  x.scale(dpr, dpr)

  const g = x.createLinearGradient(0, 0, 0, bannerH)
  g.addColorStop(0, '#FFFDF6')
  g.addColorStop(0.55, '#FAF3E3')
  g.addColorStop(1, '#F1E7D0')
  x.fillStyle = g
  x.fillRect(0, 0, bannerW, bannerH)

  const rand = mulberry32(1337)
  x.fillStyle = 'rgba(158, 138, 105, 0.10)'
  const flecks = Math.round((bannerW * bannerH) / 900)
  for (let i = 0; i < flecks; i++) {
    const fx = rand() * bannerW
    const fy = rand() * bannerH
    const fw = 1 + rand() * 2.4
    x.fillRect(fx, fy, fw, 0.8)
  }

  const inset = Math.max(6, bannerH * 0.035)
  x.strokeStyle = 'rgba(186, 164, 130, 0.65)'
  x.lineWidth = Math.max(2, bannerH * 0.012)
  x.strokeRect(inset, inset, bannerW - inset * 2, bannerH - inset * 2)
  x.setLineDash([7, 5])
  x.strokeStyle = 'rgba(186, 164, 130, 0.35)'
  x.lineWidth = 1.5
  x.strokeRect(
    inset * 1.9,
    inset * 1.9,
    bannerW - inset * 3.8,
    bannerH - inset * 3.8
  )
  x.setLineDash([])

  const measure: MeasureFn = (text, fontPx) => {
    x.font = `700 ${fontPx}px ${P.fontFamily}`
    return x.measureText(text).width
  }
  const fit = fitBannerText(message, bannerW, bannerH, measure)

  x.fillStyle = '#2A211A'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.font = `700 ${fit.fontPx}px ${P.fontFamily}`
  const lineH = fit.fontPx * P.lineHeight
  const y0 = bannerH / 2 - ((fit.lines.length - 1) * lineH) / 2
  fit.lines.forEach((ln, i) => {
    x.fillText(ln, bannerW / 2, y0 + i * lineH)
  })

  return c
}
