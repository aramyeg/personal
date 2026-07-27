/**
 * N-4 LIVE — the corner fold peels under the hand, and commits past the bar.
 *
 * The corner rect is derived in overlay/corner-hotspot.ts as percentages of the
 * viewport; at 1600x900 the right corner's centre is x = 1600*(1 - 0.18 - 0.09)
  * = 1168; y is taken at 640 rather than the rect centre because the stall
 * row owns the pixels around y 675-700 and the paper rightly wins there (R-4).
 *
 * Usage: node scripts/storybook/bench/n4-corner-peel.mjs [port]
 */
import { chromium } from 'playwright'

const PORT = process.argv[2] ?? '3164'
const URL = `http://localhost:${PORT}/labs/storybook?sbpose=6`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

const caption = () =>
  page.evaluate(() => document.querySelector('.sb-nav-folio')?.textContent?.trim() ?? null)

const peelState = () =>
  page.evaluate(() => ({
    peeling: document.documentElement.dataset.sbPeeling !== undefined,
    peel: document.documentElement.style.getPropertyValue('--sb-peel'),
    corner: document.documentElement.dataset.sbCorner ?? '',
    dogear: (() => {
      const el = document.querySelector('.sb-dogear--right')
      return el ? getComputedStyle(el).transform : null
    })(),
  }))

const RX = 1168
const RY = 640

const run = async (label, dx, dy, report) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas', { timeout: 30000 })
  await page.waitForTimeout(2800)
  await page.mouse.move(RX, RY)
  await page.waitForTimeout(400)
  const before = await caption()
  await page.mouse.down()
  let mid = null
  // A zero-travel tap sends NO moves: each CDP round trip costs ~350ms on this
  // dev page, and six of them would blow the 700ms tap clock all by themselves.
  if (dx !== 0 || dy !== 0) {
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(RX + (dx * i) / 6, RY + (dy * i) / 6)
      if (i === 3 && report) mid = await peelState()
    }
  }
  await page.mouse.up()
  await page.waitForTimeout(2200)
  const after = await caption()
  const rest = await peelState()
  console.log(
    `${label.padEnd(38)} ${before === after ? 'no turn' : '*** TURNED ***'}  -> ${after}`
  )
  if (mid) console.log(`    mid-drag: peeling=${mid.peeling} --sb-peel=${mid.peel} corner=${mid.corner}`)
  console.log(`    released: peeling=${rest.peeling} --sb-peel="${rest.peel}"`)
}

await run('plain tap (no moves)', 0, 0, false)
await run('pull 220px spineward (past the bar)', -220, 0, true)
await run('pull 100px spineward (falls short)', -100, 0, true)
await run('pull 300px OUTWARD (away from spine)', 300, 0, false)
await run('pull 300px UP out of the corner', 0, -300, false)

await browser.close()
