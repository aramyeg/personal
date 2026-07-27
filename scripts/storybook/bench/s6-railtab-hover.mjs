/**
 * N-3 GROUND TRUTH — does the RAIL TAB itself answer a hover?
 *
 * At rest the rail card sits directly under the stall body's own footprint, so a
 * hover map cannot tell which of the two answered. RAISED, the card has slid
 * fore by 2*legW*(1-cos 88) = 0.3474 and the body has stood up: derived through
 * the reading camera (reading-stage.toScreenPx) the card lands at x 245..331,
 * y 748..779 while the nearest body face starts at x 346. Probing that gap is
 * unambiguous — nothing else in the scene is there.
 *
 * Usage: node scripts/storybook/bench/s6-railtab-hover.mjs [port]
 */
import { chromium } from 'playwright'

const PORT = process.argv[2] ?? '3164'
const URL = `http://localhost:${PORT}/labs/storybook?sbpose=6&sbidle=1`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('canvas', { timeout: 30000 })
await page.waitForTimeout(3500)

const hovering = () =>
  page.evaluate(
    () =>
      document.querySelector('.sb-quill-cursor')?.classList.contains('sb-quill-cursor--pinch') ??
      false
  )

// Raise the stall: press on the body and drag up past the mechanical stop.
await page.mouse.move(450, 700)
await page.waitForTimeout(120)
await page.mouse.down()
for (let i = 1; i <= 8; i++) await page.mouse.move(450, 700 - i * 50)
await page.mouse.up()
await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/storybook/bench/out-s6-raised.png' })

console.log("hover over the RAISED spread ('#' = hover, '.' = dead), x 200..700 step 20")
for (let y = 690; y <= 820; y += 15) {
  const row = []
  for (let x = 200; x <= 700; x += 20) {
    await page.mouse.move(x, y)
    await page.waitForTimeout(80)
    row.push((await hovering()) ? '#' : '.')
  }
  console.log(`y=${String(y).padStart(3)} ${row.join('')}`)
}
console.log('        ^ x=200        x=400        x=600')
console.log('derived RAISED rail card: x 245..331, y 748..779 (nearest body face starts x 346)')

await browser.close()
