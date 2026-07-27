/**
 * N-1 LIVE REPRO — "repeated press-dragging in the lower-left paged the book
 * forward through three spreads to The End and the closed cover, no nav control
 * touched." (blind s6 re-re-review, finding 7.)
 *
 * Mode `sequence` replays the reviewer's own alternation. Mode `grid` scans the
 * lower-left quadrant with a short brisk up-drag from each point and reports
 * every one that moved the book — the honest way to find a MISS that turns the
 * page, since a drag that takes the grab is suppressed and a drag that misses
 * is not.
 *
 * Usage: node scripts/storybook/bench/n1-phantom-turn.mjs [port] [grid|sequence]
 */
import { chromium } from 'playwright'

const PORT = process.argv[2] ?? '3164'
const MODE = process.argv[3] ?? 'grid'
const URL = `http://localhost:${PORT}/labs/storybook?sbpose=6&sbidle=1`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('canvas', { timeout: 30000 })
await page.waitForTimeout(3500)

const caption = () =>
  page.evaluate(() => document.querySelector('.sb-nav-folio')?.textContent?.trim() ?? null)

/** A press-drag: down at (x0,y0), n steps to (x1,y1), up. `ms` = total hold. */
async function pressDrag(x0, y0, x1, y1, ms = 220, steps = 12) {
  await page.mouse.move(x0, y0)
  await page.waitForTimeout(40)
  await page.mouse.down()
  const grabbed = await page.evaluate(() => document.documentElement.style.cursor || 'n/a')
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps)
    await page.waitForTimeout(Math.max(1, Math.round(ms / steps)))
  }
  await page.mouse.up()
  await page.waitForTimeout(450)
  return grabbed
}

if (MODE === 'sequence') {
  const log = []
  const note = async (label) => {
    log.push(`${label.padEnd(46)} -> ${await caption()}`)
    console.log(log[log.length - 1])
  }
  await note('AT REST')
  await pressDrag(300, 700, 300, 400, 600)
  await note('1. raise the stall (up-drag ON the kit)')
  for (let i = 0; i < 4; i++) {
    await pressDrag(320, 400, 320, 720, 700)
    await note(`${2 + i * 2}. long down-drag`)
    await pressDrag(340, 700, 340, 600, 180)
    await note(`${3 + i * 2}. short up-drag`)
  }
} else {
  // Lower-left quadrant. A brisk 120px up-drag from each point: over the 60px
  // swipe bar, under the 600ms swipe clock — the gesture a reader makes when
  // they try to raise the kit and miss it.
  const hits = []
  let probes = 0
  for (let y = 560; y <= 860; y += 60) {
    const row = []
    for (let x = 120; x <= 780; x += 60) {
      const before = await caption()
      await pressDrag(x, y, x, y - 120, 200)
      const after = await caption()
      probes++
      if (after !== before) {
        hits.push(`(${x},${y})  ${before}  ->  ${after}`)
        row.push('T')
      } else row.push('.')
    }
    console.log(`y=${String(y).padStart(3)}  ${row.join('')}`)
  }
  console.log('\n--- TURNS FIRED BY A MISSED UP-DRAG ---')
  for (const h of hits) console.log(h)
  console.log(hits.length === 0 ? 'NONE' : `${hits.length} of ${probes} probes turned the page`)
  console.log(`ended on: ${await caption()}`)
}

await browser.close()
