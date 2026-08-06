#!/usr/bin/env node
/**
 * Small World lab — Alwina's manga pages, from generated PNG to shipped webp.
 *
 * Sources live OUTSIDE the repo tree at `.superpowers/manga/` (gitignored);
 * the OUTPUTS in `public/labs/small-world/manga/` are what gets committed, so
 * a clean clone builds and runs without the 26MB of source art. Running this
 * with no sources is a clean no-op, not an error.
 *
 * Usage: node scripts/small-world/prepare-manga.mjs
 *
 * ─── the three decisions, and the numbers behind them ────────────────────────
 *
 * 1. GRAYSCALE, ALWAYS. Four of the seven pages came back off-neutral (measured
 *    per-channel-mean drift: page-4 5.69, epilogue 3.86, page-5 1.28, the rest
 *    ≤0.11) — the generator warmed them toward sepia. The lab's whole colour
 *    argument is that the ONE colour on a manga page is the lab pink, applied by
 *    the site so it is exactly the lab pink. A page that arrives faintly brown
 *    breaks that, so every page is forced to true neutral here rather than
 *    corrected per page: it costs nothing on the four already-neutral ones.
 *
 * 2. 840px WIDE, which is exactly 2x the card. The art card renders at
 *    min(30vw, 420px) (`overlay/manga-card.tsx` — CARD_MAX_PX), so 840 is a
 *    clean 2x: on a 2x display it is pixel-for-pixel, and on a 1x display the
 *    browser downsamples by exactly 2, which is the most benign ratio there is
 *    for halftone screentone. MOIRE COMES FROM NON-INTEGER RATIOS; picking the
 *    width to make the ratio integral is the actual defence, and the rendered
 *    card was captured at both densities to confirm it (see task-73-report).
 *    The lightbox shows the same file near-full-height (~550-650 CSS px tall on
 *    a laptop), so one file serves both surfaces and no page is ever upscaled
 *    more than ~1.08x.
 *
 * 3. WEBP q70. Benched against avif at three quality points each and against a
 *    lossless encode at the same size. The eye could not separate webp72,
 *    webp80, avif48 and avif58 at 2x, so the pick was made on a measurement
 *    instead — HATCHING ENERGY (below), which is what this art is almost
 *    entirely made of. At equal bytes webp and avif were a tie (~97.5%
 *    retention at ~250KB); webp won on decode cost and universal support.
 *    avif48 was the one clearly-cheap option and it is the one that fails:
 *    95.3% mean, 91.0% on the epilogue — i.e. it quietly eats a tenth of the
 *    screentone on the page that is a close-up of her face.
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSharp } from './load-sharp.mjs'

const sharp = loadSharp()

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(SCRIPT_DIR, '..', '..')
const SRC_DIR = path.join(REPO_ROOT, '.superpowers', 'manga')
const OUT_DIR = path.join(REPO_ROOT, 'public', 'labs', 'small-world', 'manga')

/** Twice the card's max CSS width — see decision 2 above. Keep in step with
 *  CARD_MAX_PX in components/labs/small-world/overlay/manga-card.tsx. */
const ART_WIDTH = 840
const QUALITY = 70

/** Gates. Both are budgets the round agreed to, asserted rather than hoped. */
const MEAN_KB_BUDGET = 250
const MIN_HATCH_RETAINED = 0.95

/**
 * Mean |pixel − its 3x3 neighbourhood mean| — how much high-frequency ink the
 * page carries. Crosshatch and screentone are almost purely this quantity, and
 * a blur soft enough for a still eye to forgive drops it at once, which is why
 * it and not a pixel diff is the encoder gate. Compared as a RATIO against a
 * LOSSLESS encode at the same size, so it measures the ENCODER and not the
 * downscale.
 */
function hatchEnergy(data, width, height) {
  let sum = 0
  let count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let box = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) box += data[(y + dy) * width + x + dx]
      }
      sum += Math.abs(data[y * width + x] - box / 9)
      count++
    }
  }
  return sum / count
}

function meanAbsError(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  return sum / a.length
}

/** First channel of an encoded buffer as a raw single-channel plane. */
async function plane(buffer) {
  const { data, info } = await sharp(buffer).extractChannel(0).raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/** Per-channel mean drift — >1 means the generator warmed the page off neutral. */
async function colourDrift(file) {
  const { channels } = await sharp(file).stats()
  if (channels.length < 3) return 0
  const [r, g, b] = channels.map((c) => c.mean)
  return Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))
}

async function processOne(fileName) {
  const id = fileName.replace(/\.png$/i, '')
  const srcPath = path.join(SRC_DIR, fileName)
  const drift = await colourDrift(srcPath)

  // One normalized master, encoded twice: losslessly as the fidelity reference,
  // then as the shipped webp. Both come off the SAME pixels, so the retention
  // ratio below cannot be contaminated by the resize.
  const master = await sharp(srcPath)
    .grayscale()
    .resize({ width: ART_WIDTH, kernel: 'lanczos3', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer()

  const encoded = await sharp(master).webp({ quality: QUALITY, effort: 6 }).toBuffer()
  await mkdir(OUT_DIR, { recursive: true })
  // WRITE THE BYTES, don't hand them back to sharp. `sharp(encoded).toFile()`
  // DECODES and RE-ENCODES at sharp's own webp defaults, so the file on disk
  // was 10-15% heavier than the buffer this script had just measured and gated
  // — the budget would have been asserted against a file nobody ships.
  await writeFile(path.join(OUT_DIR, `${id}.webp`), encoded)
  const info = await sharp(master).metadata()

  const reference = await plane(master)
  const shipped = await plane(encoded)
  const retained =
    hatchEnergy(shipped.data, shipped.width, shipped.height) /
    hatchEnergy(reference.data, reference.width, reference.height)

  return {
    id,
    width: info.width,
    height: info.height,
    kb: encoded.length / 1024,
    drift,
    retained,
    mae: meanAbsError(reference.data, shipped.data),
  }
}

function printTable(rows) {
  const idCol = Math.max(4, ...rows.map((r) => r.id.length))
  console.log(`\nwebp q${QUALITY} at ${ART_WIDTH}px wide`)
  console.log(
    `${'page'.padEnd(idCol)}  ${'size'.padEnd(9)}  ${'KB'.padStart(7)}  ${'src drift'.padStart(9)}  ${'mae/255'.padStart(7)}  ${'hatch kept'.padStart(10)}`
  )
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(idCol)}  ${`${r.width}x${r.height}`.padEnd(9)}  ${r.kb.toFixed(1).padStart(7)}  ${r.drift.toFixed(2).padStart(9)}  ${r.mae.toFixed(2).padStart(7)}  ${`${(r.retained * 100).toFixed(1)}%`.padStart(10)}`
    )
  }
}

async function main() {
  let files
  try {
    files = (await readdir(SRC_DIR)).filter((f) => f.toLowerCase().endsWith('.png')).sort()
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    files = []
  }
  if (files.length === 0) {
    console.log(`prepare-manga: no source pages in ${path.relative(REPO_ROOT, SRC_DIR)} — nothing to do.`)
    return
  }

  const rows = []
  for (const file of files) rows.push(await processOne(file))
  printTable(rows)

  const meanKb = rows.reduce((s, r) => s + r.kb, 0) / rows.length
  const worst = rows.reduce((w, r) => (r.retained < w.retained ? r : w))
  console.log(
    `\nmean ${meanKb.toFixed(1)} KB/page (budget ${MEAN_KB_BUDGET})   worst hatching ${(worst.retained * 100).toFixed(1)}% on ${worst.id} (floor ${(MIN_HATCH_RETAINED * 100).toFixed(0)}%)`
  )

  const failures = []
  if (meanKb > MEAN_KB_BUDGET) failures.push(`mean page weight ${meanKb.toFixed(1)} KB exceeds the ${MEAN_KB_BUDGET} KB budget`)
  if (worst.retained < MIN_HATCH_RETAINED) {
    failures.push(`${worst.id} kept only ${(worst.retained * 100).toFixed(1)}% of its hatching energy`)
  }
  if (failures.length > 0) {
    console.error(`\nprepare-manga FAILED:\n  ${failures.join('\n  ')}`)
    process.exitCode = 1
    return
  }
  console.log(`GATES PASS — ${rows.length} pages -> ${path.relative(REPO_ROOT, OUT_DIR)}`)
}

main().catch((err) => {
  console.error(`prepare-manga: ${err?.stack ?? err}`)
  process.exitCode = 1
})
