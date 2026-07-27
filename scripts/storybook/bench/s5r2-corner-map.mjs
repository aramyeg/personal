/**
 * S5R2-3 LIVE — who owns each pixel of the two corner hotspots on spread 5.
 *
 * "The invisible page-turn corner hotspots overlap both movers... hovering the
 * panel at y~690 SIMULTANEOUSLY lights up the dog-ear (measured: 745 changed px
 * inside the dog-ear box) while the cursor shows a pinch grip — two
 * contradictory promises at one pixel — and clicking there fires neither."
 *
 * Walks a grid over each corner rect (the rect itself is read out of the page,
 * from the very constants overlay/corner-hotspot.ts hands nav.tsx, so this file
 * never types a box) and records, with the pointer PARKED so parallax cannot
 * move anything between the two reads:
 *   hover   — the scene's own claim on the pixel (store.hover)
 *   corner  — the overlay's claim (documentElement.dataset.sbCorner)
 *   quill   — whether the cursor is showing its grab shape
 * A pixel with BOTH claims is the contradiction; a pixel with neither and no
 * paper under it is fine (that is desk).
 *
 * Usage: node scripts/storybook/bench/s5r2-corner-map.mjs [port] [step]
 */
import { chromium } from 'playwright'
import { acquireLock, releaseLock } from './capture-lock.mjs'

const PORT = process.argv[2] ?? '3165'
const STEP = Number(process.argv[3] ?? 24)
const URL = `http://localhost:${PORT}/labs/storybook?sbpose=5&sbidle=1`

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas', { timeout: 40000 })
  await page.waitForTimeout(3200)

  // The rects, read off the live DOM (nav.tsx positions its hotspot buttons
  // from corner-hotspot.ts's own percentages).
  const rects = await page.evaluate(() => {
    const grab = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }
    }
    return { prev: grab('.sb-corner--left'), next: grab('.sb-corner--right') }
  })

  const read = () =>
    page.evaluate(() => {
      const st = window.__sbStore?.getState?.()
      return {
        hover: st?.hover ?? null,
        corner: document.documentElement.dataset.sbCorner ?? '',
      }
    })

  const rows = []
  for (const [name, r] of Object.entries(rects)) {
    if (!r) continue
    for (let y = r.y0 + 6; y <= r.y1 - 6; y += STEP) {
      for (let x = r.x0 + 6; x <= r.x1 - 6; x += STEP) {
        await page.mouse.move(x, y)
        await page.waitForTimeout(70)
        const s = await read()
        rows.push({ name, x: Math.round(x), y: Math.round(y), ...s })
      }
    }
  }

  const both = rows.filter((r) => r.hover !== null && r.corner !== '')
  const sceneOnly = rows.filter((r) => r.hover !== null && r.corner === '')
  const cornerOnly = rows.filter((r) => r.hover === null && r.corner !== '')
  const neither = rows.filter((r) => r.hover === null && r.corner === '')
  console.log(
    JSON.stringify(
      {
        rects,
        step: STEP,
        probes: rows.length,
        contradictions: both.length,
        sceneOnly: sceneOnly.length,
        cornerOnly: cornerOnly.length,
        neither: neither.length,
        contradictionSample: both.slice(0, 12),
        sceneOwned: [...new Set(sceneOnly.map((r) => r.hover))],
        cornerOnlySample: cornerOnly.slice(0, 10),
      },
      null,
      2
    )
  )
  await browser.close()
}

await acquireLock('s5r2-corner-map')
try {
  await run()
} finally {
  releaseLock()
}
