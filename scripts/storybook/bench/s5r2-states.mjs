/**
 * S5R2-1 LIVE — the four states the blind re-reviewer compared, captured with
 * the pointer parked so parallax cannot fake a difference.
 *
 * "Both mechanisms resolve to the same visual: a flat gold rectangle lying on
 * the deck. Work both and the spread loses both of its upright silhouettes and
 * gains two blank gold placemats. There is no reward state that beats the rest
 * state." (finding 10 — the user-law violation this round exists to answer.)
 *
 * Uses ?sbdrive=<id>:<value>, which freezes ONE handle in its own domain (tau in
 * DEGREES for the dissolve, strip draw s for the tab piece), so each state is a
 * separate deterministic load rather than a scripted drag whose end pose depends
 * on the machine's timing.
 *
 * Also reports, per state, the mean absolute local luminance gradient inside the
 * piece's OWN derived screen box — the same "is it a picture or a gold
 * rectangle" statistic the art gates use on the source paintings, measured here
 * on what the reading camera actually shows.
 *
 * Usage: node scripts/storybook/bench/s5r2-states.mjs [port]
 *   boxes come from SB_S5_STATIONS (derived in __tests__/.../reading-camera.ts)
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { acquireLock, releaseLock } from '../../../../labs-storybook/.superpowers/sdd/bench/lock.mjs'

const PORT = process.argv[2] ?? '3165'
const TAG = process.argv[3] ?? 'after'
const OUT = path.join(process.cwd(), '.superpowers', 'sdd', 'bench', 'out')
const STATIONS = JSON.parse(process.env.SB_S5_STATIONS ?? '{}')

const STATES = [
  { name: 'dissolve-closed', drive: 'ch4-dissolve:0', box: 'dissolveBase' },
  { name: 'dissolve-open', drive: 'ch4-dissolve:180', box: 'dissolveBase' },
  { name: 'goldpile-flat', drive: 'ch4-goldpile:0', box: 'goldpileBox' },
  { name: 'goldpile-raised', drive: 'ch4-goldpile:0.24', box: 'goldpileBox' },
]

/** Mean |local luminance gradient| over a crop — a picture has structure, a
 *  gold placemat does not. */
async function gradient(png, box) {
  if (!box) return null
  const left = Math.max(0, Math.round(box.x0))
  const top = Math.max(0, Math.round(box.y0))
  const width = Math.min(1600 - left, Math.round(box.x1 - box.x0))
  const height = Math.min(900 - top, Math.round(box.y1 - box.y0))
  if (width < 4 || height < 4) return null
  const { data, info } = await sharp(png)
    .extract({ left, top, width, height })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let sum = 0
  let n = 0
  for (let y = 0; y < info.height - 1; y++) {
    for (let x = 0; x < info.width - 1; x++) {
      const i = y * info.width + x
      sum += Math.abs(data[i + 1] - data[i]) + Math.abs(data[i + info.width] - data[i])
      n += 2
    }
  }
  return +(sum / n).toFixed(3)
}

async function run() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const rows = []
  for (const s of STATES) {
    await page.goto(`http://localhost:${PORT}/labs/storybook?sbpose=5&sbidle=1&sbdrive=${s.drive}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('canvas', { timeout: 40000 })
    // The pointer is parked at the SAME point for every state, so the parallax
    // rig contributes an identical offset to all four frames.
    await page.mouse.move(800, 200)
    await page.waitForTimeout(3200)
    const file = path.join(OUT, `s5r2-${TAG}-${s.name}.png`)
    await page.screenshot({ path: file })
    rows.push({ state: s.name, file, gradient: await gradient(file, STATIONS[s.box]) })
  }
  console.log(JSON.stringify(rows, null, 2))
  await browser.close()
}

await acquireLock('s5r2-states')
try {
  await run()
} finally {
  releaseLock()
}
