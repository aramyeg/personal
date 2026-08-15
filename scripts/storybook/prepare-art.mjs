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

import { mkdir, readdir, writeFile } from 'node:fs/promises'
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

// Cover decals sit on leather as gold foil, not as paper cutouts on a page —
// a raw-paper rim would read as a sticker there. Page prints are full-bleed
// page faces, not cutouts, so they get no rim either.
const skipsRim = (id) => id.startsWith('cover-') || id.startsWith('page-')

// PAD-TO-ASPECT (per id, target width/height): after the alpha trim, pad the
// SHORTER axis with centered transparent pixels so the piece renders at the
// mesh aspect its quad demands — for radial/round cutouts whose trim landed a
// hair off-square (a 2% off-square disc renders as a visible ellipse). Padding
// is transparent and centered, so it never touches the artwork or its die-cut
// rim (the rim follows the alpha silhouette, which padding leaves untouched).
// ONLY for pieces whose mesh aspect is fixed AND whose art should stay centered
// in a larger transparent field — never for full-bleed faces (which must be
// redrawn to the mesh aspect, not letterboxed). See the keep art-aspect bench
// (.superpowers/sdd/bench/check-keep-art-aspects.mjs).
// (Empty since E3 s4 wave 2: the only entry was `ch3-keep-winch-disc`, and the
// whole tower-hoist winch — disc, mast, semaphore, iris, counterweight — plus
// `ch3-keep-balcony` are now PROCEDURAL bakes owned by generate-art.mjs, which
// emits each at its quad's exact mesh aspect. Do NOT re-add a source PNG for any
// of those ids: prepare-art runs BEFORE generate-art, but a delivery landing
// under one of those names would put a second file in play for the same id and
// the next person to reorder the two scripts would silently lose the bake.)
//
// E4 PAINTED — the one sanctioned exception, and it is now MECHANISED rather
// than trusted to prose. An id may live in BOTH art-src/ and generate-art's
// PIECES if and only if it is listed in that file's `HAND_PAINTED` set, in
// which case the procedural bake yields and this script's output is what ships.
// Any other overlap now throws in generate-art's `assertNoSilentOverwrite()`
// instead of quietly clobbering the delivery.
const PAD_TO_ASPECT = {}

// CROP-TO-ASPECT (per id, target width/height): centered cover-crop applied
// after the trim, for FULL-BLEED texture-like faces (pavement, deck boards,
// roof pitch) delivered wider/taller than their mesh. Cropping a texture
// surface loses only more-of-the-same at the margins — unlike composed faces
// (walls with windows, skyline scenes), which must be redrawn to the mesh
// aspect instead. Sources in art-src keep the full frame, so crops are
// reversible. See the keep art-aspect bench.
// Values: a number (centered crop) or { aspect, anchor: 'bottom' } to keep
// the LOWER content when cropping height (tier faces whose deliveries added
// roofs/spires above the architectural band the mesh actually shows).
const CROP_TO_ASPECT = {
  // E1.5 re-massed story dims (content.ts ch3-keep: hall a .40 H .25 z .68,
  // gallery a .34 H .22 z .56, loft a .27 H .18 z .40, crown a .15 gable .10
  // z .28): top aspect = 2a / z-span (gable: 2*hypot(a, rise) / z-span).
  'ch3-keep-hall-top': 0.8 / 0.68, // slate flagstone paving
  'ch3-keep-gallery-top': 0.68 / 0.56, // weathered deck boards
  'ch3-keep-loft-top': 0.54 / 0.4, // plain cap slab
  'ch3-keep-crown-top': (2 * Math.hypot(0.15, 0.1)) / 0.28, // gable pitch
  // NOTE: the hall/loft/crown `-front` faces are NO LONGER cropped to the cap
  // aspect. E1.5.1 renders each tier front as a DIE-CUT FACADE PLATE
  // (keepStackFacadePlate) sized to the art's TRUE (uncropped) aspect, so the
  // silhouette (curtain wall, belfry roof + bell, spire cone) shows past the cap
  // edges — cropping to the rectangular cap would defeat the whole point. The
  // plate dims in content.ts (ch3-keep stories) carry the uncropped aspect.
}

// FAN-OUT (per source id, dest ids): one processed panel saved under several
// art ids.
//
// E2.1: the citadel rank (ch3-skyline-{l,r}-mound{0,1,2}) is now CODE-GENERATED
// per slot by scripts/storybook/generate-art.mjs — six unique strips, each at
// its own mesh aspect + a shaped-outline sidecar. Its former FAN_OUT entries
// (ch3-citadel-a/b/c -> the six mounds) were REMOVED so prepare-art no longer
// overwrites those procedural bakes. The art-src citadel PNGs are left in place
// (untouched); prepare-art now emits them under their own ids (harmless, unused
// by content). FAN_OUT stays as a mechanism for any future reuse.
const FAN_OUT = {}

// ROTATE (per id, degrees clockwise): lossless quarter-turn applied at load,
// for deliveries authored transposed relative to their mesh's texture axes.
//
// (Empty since E3 s4 wave 2: the only entry was `ch3-keep-winch-semaphore`,
// which is now a procedural bake authored directly in its mesh's texture axes —
// pivot at the image bottom, tip at the top — so there is nothing to transpose.
// See the PAD_TO_ASPECT note above before adding a source PNG for any winch id.)
const ROTATE = {}

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

// Some generations ignore BOTH the transparency ask and the magenta
// fallback and land on a flat white (or near-white) card. Those are keyed
// by FLOOD FILL from the border: only background connected to the image
// edge is removed, so interior whites (glowing windows, snow, cream
// paper) survive untouched.
const BACKED_TOLERANCE = 22 // max per-channel distance from the corner color
const BACKED_BORDER_FRACTION = 0.8 // border ring must be this uniform

/** Detects a flat opaque background color from the corners + border ring.
 *  Returns the color, or null when the image is transparent-backed or a
 *  genuine full-bleed painting (page prints, tent strips): those have
 *  VARIED border colors and fail the uniformity vote. */
function uniformBorderColor(raw, info) {
  const { width, height, channels } = info
  const px = (x, y) => {
    const i = (y * width + x) * channels
    return [raw[i], raw[i + 1], raw[i + 2], raw[i + 3]]
  }
  const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)]
  if (corners.some((c) => c[3] < 250)) return null // transparent-backed
  const bg = [0, 1, 2].map((ch) => Math.round(corners.reduce((s, c) => s + c[ch], 0) / 4))
  if (corners.some((c) => Math.max(...[0, 1, 2].map((ch) => Math.abs(c[ch] - bg[ch]))) > BACKED_TOLERANCE)) {
    return null // corners disagree with each other
  }
  if (magentaDistance(bg[0], bg[1], bg[2]) <= CORNER_TOLERANCE) return null // magenta path owns this
  let hits = 0
  let total = 0
  const matches = (x, y) => {
    const i = (y * width + x) * channels
    return (
      raw[i + 3] >= 250 &&
      Math.abs(raw[i] - bg[0]) <= BACKED_TOLERANCE &&
      Math.abs(raw[i + 1] - bg[1]) <= BACKED_TOLERANCE &&
      Math.abs(raw[i + 2] - bg[2]) <= BACKED_TOLERANCE
    )
  }
  for (let x = 0; x < width; x += 2) {
    total += 2
    if (matches(x, 0)) hits += 1
    if (matches(x, height - 1)) hits += 1
  }
  for (let y = 0; y < height; y += 2) {
    total += 2
    if (matches(0, y)) hits += 1
    if (matches(width - 1, y)) hits += 1
  }
  return hits / total >= BACKED_BORDER_FRACTION ? bg : null
}

/** Clears (alpha 0) every pixel within tolerance of `bg` that is 4-connected
 *  to the image border — the classic background flood, leaving interior
 *  regions of the same color alone. Returns a new buffer. */
function floodKeyBackground(raw, info, bg) {
  const { width, height, channels } = info
  const out = Buffer.from(raw)
  const visited = new Uint8Array(width * height)
  const stack = []
  const tryPush = (x, y) => {
    const p = y * width + x
    if (visited[p]) return
    const i = p * channels
    if (
      Math.abs(out[i] - bg[0]) <= BACKED_TOLERANCE &&
      Math.abs(out[i + 1] - bg[1]) <= BACKED_TOLERANCE &&
      Math.abs(out[i + 2] - bg[2]) <= BACKED_TOLERANCE
    ) {
      visited[p] = 1
      stack.push(p)
    }
  }
  for (let x = 0; x < width; x++) {
    tryPush(x, 0)
    tryPush(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y)
    tryPush(width - 1, y)
  }
  while (stack.length > 0) {
    const p = stack.pop()
    out[p * channels + 3] = 0
    const x = p % width
    const y = (p - x) / width
    if (x > 0) tryPush(x - 1, y)
    if (x < width - 1) tryPush(x + 1, y)
    if (y > 0) tryPush(x, y - 1)
    if (y < height - 1) tryPush(x, y + 1)
  }
  return out
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

  let source = sharp(srcPath)
  if (ROTATE[id]) source = source.rotate(ROTATE[id])
  const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let pixels = hasMagentaCorners(data, info) ? chromaKey(data, info) : data
  // Page prints are full-bleed page faces by design — never background-key
  // them even if a sky corner happens to read uniform.
  if (!id.startsWith('page-')) {
    const backed = uniformBorderColor(pixels, info)
    if (backed) pixels = floodKeyBackground(pixels, info, backed)
  }

  let pipeline = sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
  // Every cutout trims its dead transparent margin — including backdrops.
  // The v-fold physics maps each texture edge-to-edge onto a rigid panel
  // whose bottom edge is glued to the page (popup-mechanics.ts), so any
  // leftover padding reads as the piece floating above the paper.
  pipeline = pipeline.trim()

  // Cover-crop to the mesh aspect for full-bleed texture faces delivered at
  // the wrong aspect, computed from the true post-trim size. Centered by
  // default; 'bottom' anchor keeps the lower content when trimming height.
  const cropSpec = CROP_TO_ASPECT[id]
  if (cropSpec) {
    const cropAspect = typeof cropSpec === 'number' ? cropSpec : cropSpec.aspect
    const anchor = typeof cropSpec === 'number' ? 'center' : (cropSpec.anchor ?? 'center')
    const trimmed = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width: tw, height: th, channels } = trimmed.info
    let cw = tw
    let chh = th
    if (tw / th > cropAspect) cw = Math.round(th * cropAspect)
    else if (tw / th < cropAspect) chh = Math.round(tw / cropAspect)
    pipeline = sharp(trimmed.data, { raw: { width: tw, height: th, channels } })
    if (cw < tw || chh < th) {
      pipeline = pipeline.extract({
        left: Math.floor((tw - cw) / 2),
        top: anchor === 'bottom' ? th - chh : Math.floor((th - chh) / 2),
        width: cw,
        height: chh,
      })
    }
  }

  // Pad to the mesh aspect (centered transparent) for the handful of round/
  // fixed-aspect cutouts, computed from the true post-trim dimensions.
  const targetAspect = PAD_TO_ASPECT[id]
  if (targetAspect) {
    const trimmed = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width: tw, height: th, channels } = trimmed.info
    let addW = 0
    let addH = 0
    if (tw / th < targetAspect) addW = Math.round(th * targetAspect) - tw
    else if (tw / th > targetAspect) addH = Math.round(tw / targetAspect) - th
    pipeline = sharp(trimmed.data, { raw: { width: tw, height: th, channels } })
    if (addW > 0 || addH > 0) {
      pipeline = pipeline.extend({
        left: Math.floor(addW / 2),
        right: addW - Math.floor(addW / 2),
        top: Math.floor(addH / 2),
        bottom: addH - Math.floor(addH / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
    }
  }

  pipeline = pipeline.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })

  // The rim pass needs raw pixels at final size, so the pipeline is
  // materialized once here and re-wrapped for encoding.
  const sized = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const finalPixels = skipsRim(id)
    ? sized.data
    : addPaperRim(sized.data, sized.info.width, sized.info.height)

  const destIds = FAN_OUT[id] ?? [id]
  const rows = []
  for (const destId of destIds) {
    const outPath = path.join(OUT_DIR, `${destId}.webp`)
    const outInfo = await sharp(finalPixels, {
      raw: { width: sized.info.width, height: sized.info.height, channels: 4 },
    })
      .webp({ quality: 82 })
      .toFile(outPath)
    rows.push({ id: destId, width: outInfo.width, height: outInfo.height, bytes: outInfo.size })
  }
  return rows
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

/** The runtime consults this manifest before requesting any art, so ids
 *  without generated files cost zero network requests and zero console
 *  noise (use-layer-texture.ts). Rebuilt from the OUTPUT directory listing
 *  on every run, so it also picks up files from earlier batches. */
async function writeManifest() {
  const entries = await readdir(OUT_DIR, { withFileTypes: true })
  const ids = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.webp'))
    .map((e) => e.name.replace(/\.webp$/i, ''))
    .sort()
  const manifestPath = path.join(OUT_DIR, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(ids, null, 2) + '\n')
  process.stdout.write(`manifest: ${ids.length} art ids -> ${path.relative(REPO_ROOT, manifestPath)}\n`)
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
    rows.push(...(await processOne(file)))
  }
  printTable(rows)
  await writeManifest()
}

main().catch((err) => {
  process.stderr.write(`prepare-art: ${err?.stack ?? err?.message ?? err}\n`)
  process.exitCode = 1
})
