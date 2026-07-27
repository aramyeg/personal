/**
 * N-5 — "six identical stall kits sit inert beside the one that works... I
 * press-dragged them up, down, left and right, individually and as a row:
 * nothing." (blind s6 re-re-review, finding 5.)
 *
 * Presses each of the six printed cards in turn and measures whether the row
 * actually moved, by differencing the row's own pixels against a baseline taken
 * with the pointer ALREADY PARKED at the press point — so the parallax tilt is
 * common to both frames and cannot masquerade as motion. The idle clock is
 * PINNED (no `&sbidle=1`): a fluttering dove and twinkling stars are worth
 * several dRGB on their own.
 *
 * Card boxes are DERIVED, not eyeballed: solveStripFlapPoseAt through
 * reading-stage.toScreenPx puts the rest row at x 953..1267, y 711..765, columns
 * starting at 953/1000/1048/1096/1143/1191.
 *
 * Usage: node scripts/storybook/bench/s6-row-grab.mjs [port]
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const PORT = process.argv[2] ?? '3164'
const URL = `http://localhost:${PORT}/labs/storybook?sbpose=6`

const ROW_CLIP = { x: 900, y: 560, width: 620, height: 280 }
const KIT_CLIP = { x: 240, y: 480, width: 480, height: 340 }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

const shot = async (clip) =>
  sharp(await page.screenshot({ clip })).raw().toBuffer({ resolveWithObject: true })

/** Mean |dRGB| per channel between two same-size raw buffers, 0..255. */
const diff = (a, b) => {
  let sum = 0
  for (let i = 0; i < a.data.length; i++) sum += Math.abs(a.data[i] - b.data[i])
  return sum / a.data.length
}

const dragUp = async (x, y, dist) => {
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(x, y - (dist * i) / 10)
  await page.mouse.up()
  await page.waitForTimeout(800)
}

const probes = [
  ['card 0 (leftmost)', 983, 690, ROW_CLIP],
  ['card 1', 1032, 690, ROW_CLIP],
  ['card 2', 1081, 690, ROW_CLIP],
  ['card 3', 1131, 690, ROW_CLIP],
  ['card 4', 1179, 690, ROW_CLIP],
  ['card 5 (rightmost)', 1229, 690, ROW_CLIP],
  ['30px LEFT of the row (bare paper)', 920, 690, ROW_CLIP],
  ['CONTROL: the working RAISE-A-STALL kit', 450, 700, KIT_CLIP],
  ['CONTROL: bare paper mid-page', 800, 800, ROW_CLIP],
]

for (const [label, x, y, clip] of probes) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas', { timeout: 30000 })
  await page.waitForTimeout(2800)
  // Park at the press point FIRST so the baseline already carries this
  // pointer's parallax tilt: otherwise the tilt is the whole measurement.
  await page.mouse.move(x, y)
  await page.waitForTimeout(900)
  const before = await shot(clip)
  await dragUp(x, y, 240)
  await page.mouse.move(x, y)
  await page.waitForTimeout(700)
  const after = await shot(clip)
  const d = diff(before, after)
  console.log(`${label.padEnd(40)} mean dRGB ${d.toFixed(2).padStart(6)}   ${d > 2 ? 'MOVED' : 'inert'}`)
}

await browser.close()
