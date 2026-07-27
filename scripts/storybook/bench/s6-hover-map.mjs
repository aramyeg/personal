/**
 * S6 HOVER / GRAB COVERAGE MAP — the live answer to N-3 ("the rail-path tab has
 * no hover response and no cursor change") and N-5 ("six flat stall kits read
 * inert beside the working one").
 *
 * The quill is the book's one cursor, and it takes the `sb-quill-cursor--pinch`
 * class exactly when the store's `hover` is non-null (overlay/quill-cursor.tsx),
 * so that class IS the reader's hover cue. Scanning it over the spread gives the
 * hover map a blind reader would feel.
 *
 * Usage: node scripts/storybook/bench/s6-hover-map.mjs [port] [step]
 */
import { chromium } from 'playwright'

const PORT = process.argv[2] ?? '3164'
const STEP = Number(process.argv[3] ?? 25)
const URL = `http://localhost:${PORT}/labs/storybook?sbpose=6&sbidle=1`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('canvas', { timeout: 30000 })
await page.waitForTimeout(3500)

/** Non-null store `hover` as the reader sees it: the quill's pinch pose. */
const hovering = () =>
  page.evaluate(
    () => document.querySelector('.sb-quill-cursor')?.classList.contains('sb-quill-cursor--pinch') ?? false
  )

const X0 = 150
const X1 = 1500
const Y0 = 400
const Y1 = 880

console.log(`hover map  x ${X0}..${X1}  y ${Y0}..${Y1}  step ${STEP}  ('#' = hover, '.' = dead)`)
const header = []
for (let x = X0; x <= X1; x += STEP) header.push(x % 200 < STEP ? '|' : ' ')
console.log(`      ${header.join('')}`)

const hits = []
for (let y = Y0; y <= Y1; y += STEP) {
  const row = []
  for (let x = X0; x <= X1; x += STEP) {
    await page.mouse.move(x, y)
    await page.waitForTimeout(90) // the pinch eases in; give it frames
    const on = await hovering()
    row.push(on ? '#' : '.')
    if (on) hits.push([x, y])
  }
  console.log(`y=${String(y).padStart(3)} ${row.join('')}`)
}

console.log(`\n${hits.length} hovering probes of ${Math.round(((X1 - X0) / STEP + 1) * ((Y1 - Y0) / STEP + 1))}`)
if (hits.length > 0) {
  const xs = hits.map((h) => h[0])
  const ys = hits.map((h) => h[1])
  console.log(`hover bbox: x ${Math.min(...xs)}..${Math.max(...xs)}  y ${Math.min(...ys)}..${Math.max(...ys)}`)
}
await browser.close()
