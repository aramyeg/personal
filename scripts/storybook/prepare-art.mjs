#!/usr/bin/env node
/**
 * Storybook lab art pipeline: turns user-generated ChatGPT PNGs (dropped in
 * public/labs/storybook/art-src/, one per asset id — see the prompt call
 * sheet at docs/superpowers/research/2026-07-10-storybook-art-prompts.md)
 * into the webp cutouts the book actually renders.
 *
 * Every prompt asks for a transparent background but also carries a magenta
 * (#FF00FF) fallback for when the model flattens it anyway (spec §8.2), so
 * this script chroma-keys magenta out first (only when the source actually
 * looks magenta-backed — real transparent art passes through untouched),
 * de-fringes the magenta cast that survives on semi-transparent edge
 * pixels, trims dead space, caps the long edge at 1536px, and re-encodes as
 * webp.
 *
 * Usage: node scripts/storybook/prepare-art.mjs
 * No-op (clean exit) when art-src is missing or empty.
 */

import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(SCRIPT_DIR, '..', '..')
const SRC_DIR = path.join(REPO_ROOT, 'public', 'labs', 'storybook', 'art-src')
const OUT_DIR = path.join(REPO_ROOT, 'public', 'labs', 'storybook', 'art')

// Pure magenta chroma-key tolerances (spec §8.2 / task brief).
const CORNER_TOLERANCE = 60 // corner-sample gate: is this source magenta-backed at all?
const KEY_LOW = 40 // below this distance from magenta: fully transparent
const KEY_HIGH = 90 // above this distance: untouched, original alpha kept
const MAX_DIM = 1536 // long-edge cap; sharp's `fit: 'inside'` never upscales

/** Distance of an (r,g,b) pixel from pure magenta (255,0,255), collapsed to
 *  one number: how far red/blue sit below full and green sits above zero. */
function magentaDistance(r, g, b) {
  return Math.max(Math.abs(r - 255), g, Math.abs(b - 255))
}

const isBackdropId = (id) => id.endsWith('-backdrop')
// Cover decals sit on leather as gold foil, not as paper cutouts on a page —
// a raw-paper rim would read as a sticker there. Page prints are full-bleed
// page faces, not cutouts, so they get no rim either.
const skipsRim = (id) => id.startsWith('cover-') || id.startsWith('page-')

// Die-cut edge: real pop-up pieces show a sliver of raw paper where the
// blade cut through the printed sheet. Approximated by dilating the alpha
// mask (separable Chebyshev max-filter) and compositing the art over a
// cream rim of that dilated silhouette.
const RIM_RADIUS = 6
const RIM_COLOR = [242, 231, 201] // raw paper cream, a touch lighter than the page

function dilateAlpha(alpha, width, height, radius) {
  const horizontal = new Uint8Array(alpha.length)
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      let max = 0
      const lo = Math.max(0, x - radius)
      const hi = Math.min(width - 1, x + radius)
      for (let k = lo; k <= hi; k++) {
        const v = alpha[row + k]
        if (v > max) max = v
      }
      horizontal[row + x] = max
    }
  }
  const dilated = new Uint8Array(alpha.length)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let max = 0
      const lo = Math.max(0, y - radius)
      const hi = Math.min(height - 1, y + radius)
      for (let k = lo; k <= hi; k++) {
        const v = horizontal[k * width + x]
        if (v > max) max = v
      }
      dilated[y * width + x] = max
    }
  }
  return dilated
}

/** Composites the art over its own dilated-silhouette cream rim ("over"
 *  operator per pixel; returns a new buffer). */
function addPaperRim(raw, width, height) {
  const pixelCount = width * height
  const alpha = new Uint8Array(pixelCount)
  for (let i = 0; i < pixelCount; i++) alpha[i] = raw[i * 4 + 3]
  const rim = dilateAlpha(alpha, width, height, RIM_RADIUS)

  const out = Buffer.from(raw)
  for (let i = 0; i < pixelCount; i++) {
    const rimA = rim[i] / 255
    if (rimA <= 0) continue
    const topA = raw[i * 4 + 3] / 255
    const outA = topA + rimA * (1 - topA)
    if (outA <= 0) continue
    for (let c = 0; c < 3; c++) {
      const top = raw[i * 4 + c] * topA
      const under = RIM_COLOR[c] * rimA * (1 - topA)
      out[i * 4 + c] = Math.round((top + under) / outA)
    }
    out[i * 4 + 3] = Math.round(outA * 255)
  }
  return out
}

async function readSourceFiles() {
  try {
    const entries = await readdir(SRC_DIR, { withFileTypes: true })
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.png'))
      .map((e) => e.name)
      .sort()
  } catch (err) {
    if (err.code === 'ENOENT') return [] // no art-src dir yet: clean no-op
    throw err
  }
}

/** Only chroma-key sources that actually look magenta-backed: sample the
 *  four corners and require at least 3 of 4 within tolerance. Protects
 *  genuinely transparent or unrelated art from being mangled. */
function hasMagentaCorners(raw, info) {
  const { width, height, channels } = info
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ]
  let hits = 0
  for (const [x, y] of corners) {
    const idx = (y * width + x) * channels
    if (magentaDistance(raw[idx], raw[idx + 1], raw[idx + 2]) <= CORNER_TOLERANCE) hits += 1
  }
  return hits >= 3
}

/** Per-pixel chroma-key + de-fringe over a raw RGBA buffer (returns a new
 *  buffer; never mutates the input). */
function chromaKey(raw, info) {
  const { channels } = info
  const out = Buffer.from(raw)
  for (let i = 0; i < out.length; i += channels) {
    const r = out[i]
    const g = out[i + 1]
    const b = out[i + 2]
    const a = out[i + 3]
    const d = magentaDistance(r, g, b)

    let alpha = a
    if (d < KEY_LOW) {
      alpha = 0
    } else if (d < KEY_HIGH) {
      alpha = Math.round(a * ((d - KEY_LOW) / (KEY_HIGH - KEY_LOW)))
    }
    out[i + 3] = alpha

    // De-fringe: a magenta cast lingers on semi-transparent edge pixels as
    // a green deficit relative to red. Both red and blue were pushed up by
    // the magenta key color, so pulling red down to match blue desaturates
    // the cast without touching pixels that were never keyed.
    if (g < r * 0.6) {
      const desaturated = Math.min(r, b)
      out[i] = desaturated
      out[i + 2] = desaturated
    }
  }
  return out
}

async function processOne(fileName) {
  const id = fileName.replace(/\.png$/i, '')
  const srcPath = path.join(SRC_DIR, fileName)

  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const pixels = hasMagentaCorners(data, info) ? chromaKey(data, info) : data

  let pipeline = sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
  if (!isBackdropId(id)) {
    // Backdrops keep their full canvas width (spec §8.5: they're only
    // transparent above the skyline, not on the sides); everything else
    // trims dead transparent margin from a die-cut subject.
    pipeline = pipeline.trim()
  }
  pipeline = pipeline.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })

  // The rim pass needs raw pixels at final size, so the pipeline is
  // materialized once here and re-wrapped for encoding.
  const sized = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const finalPixels = skipsRim(id)
    ? sized.data
    : addPaperRim(sized.data, sized.info.width, sized.info.height)

  const outPath = path.join(OUT_DIR, `${id}.webp`)
  const outInfo = await sharp(finalPixels, {
    raw: { width: sized.info.width, height: sized.info.height, channels: 4 },
  })
    .webp({ quality: 82 })
    .toFile(outPath)
  return { id, width: outInfo.width, height: outInfo.height, bytes: outInfo.size }
}

function printTable(rows) {
  if (rows.length === 0) {
    process.stdout.write(
      'prepare-art: no source PNGs in public/labs/storybook/art-src — nothing to do.\n'
    )
    return
  }
  const idCol = Math.max(2, ...rows.map((r) => r.id.length))
  const sizeCol = Math.max(4, ...rows.map((r) => `${r.width}x${r.height}`.length))
  const lines = [
    `${'id'.padEnd(idCol)}  ${'size'.padEnd(sizeCol)}  kb`,
    ...rows.map((r) => {
      const size = `${r.width}x${r.height}`.padEnd(sizeCol)
      const kb = (r.bytes / 1024).toFixed(1).padStart(6)
      return `${r.id.padEnd(idCol)}  ${size}  ${kb}`
    }),
  ]
  process.stdout.write(lines.join('\n') + '\n')
}

async function main() {
  const files = await readSourceFiles()
  if (files.length === 0) {
    printTable([])
    return
  }

  await mkdir(OUT_DIR, { recursive: true })
  const rows = []
  for (const file of files) {
    rows.push(await processOne(file))
  }
  printTable(rows)
}

main().catch((err) => {
  process.stderr.write(`prepare-art: ${err?.stack ?? err?.message ?? err}\n`)
  process.exitCode = 1
})
