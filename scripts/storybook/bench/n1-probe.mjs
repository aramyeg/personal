/**
 * N-1 FORENSICS — "repeated press-dragging in the lower-left paged the book
 * forward through three spreads to The End and the closed cover, no nav control
 * touched" (blind s6 re-re-review, finding 7).
 *
 * Two probes, both against the live page:
 *   `dom`   — synthetic window pointer events, which never reach r3f, so nothing
 *             can take a grab: whatever turns here is the plain-DOM swipe rule.
 *   `mouse` — a REAL press-drag with the browser's own pointer, on bare paper,
 *             which is the reviewer's gesture ("press-drag on 14 targets x 4
 *             directions").
 *
 * Usage: node scripts/storybook/bench/n1-probe.mjs [port] [dom|mouse]
 */
import { chromium } from 'playwright'

const PORT = process.argv[2] ?? '3164'
const MODE = process.argv[3] ?? 'dom'
const URL = `http://localhost:${PORT}/labs/storybook?sbpose=6&sbidle=1`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('canvas', { timeout: 30000 })
await page.waitForTimeout(3500)

const caption = () =>
  page.evaluate(() => document.querySelector('.sb-nav-folio')?.textContent?.trim() ?? null)

/** Synthetic press-drag straight on `window` — bypasses the canvas entirely. */
async function domSwipe(x0, y0, dx, dy, holdMs) {
  await page.evaluate(
    async ([x0, y0, dx, dy, holdMs]) => {
      const opts = (x, y) => ({ clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1 })
      window.dispatchEvent(new PointerEvent('pointerdown', opts(x0, y0)))
      await new Promise((r) => setTimeout(r, holdMs))
      window.dispatchEvent(new PointerEvent('pointerup', opts(x0 + dx, y0 + dy)))
    },
    [x0, y0, dx, dy, holdMs]
  )
  await page.waitForTimeout(2200) // a turn is ~1.2s; let it land AND settle
}

/** A real press-drag with the browser's own pointer. */
async function mouseSwipe(x0, y0, dx, dy, holdMs, steps = 3) {
  await page.mouse.move(x0, y0)
  await page.waitForTimeout(60)
  const t0 = await page.evaluate(() => performance.now())
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + (dx * i) / steps, y0 + (dy * i) / steps)
  }
  await page.mouse.up()
  const dt = Math.round((await page.evaluate(() => performance.now())) - t0)
  await page.waitForTimeout(2200)
  return dt
}

const run = MODE === 'mouse' ? mouseSwipe : domSwipe

// Bare paper on the RIGHT page (nothing grabbable, clear of the text column).
const cases = [
  ['UP    120px / 200ms', 900, 700, 0, -120, 200],
  ['DOWN  120px / 200ms', 900, 560, 0, 120, 200],
  ['UP    120px / 200ms', 900, 700, 0, -120, 200],
  ['DOWN  120px / 200ms', 900, 560, 0, 120, 200],
  ['UP     40px / 200ms (under the bar)', 900, 700, 0, -40, 200],
  ['UP    120px / 900ms (past the clock)', 900, 700, 0, -120, 900],
]

console.log(`mode=${MODE}`)
for (const [label, x, y, dx, dy, ms] of cases) {
  const before = await caption()
  const dt = await run(x, y, dx, dy, ms)
  const after = await caption()
  const verdict = before === after ? 'no turn' : '*** TURNED ***'
  console.log(
    `${label.padEnd(38)} ${verdict.padEnd(15)} ${dt === undefined ? '' : `${dt}ms `}${before}  ->  ${after}`
  )
}

await browser.close()
