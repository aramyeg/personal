// scripts/posters/capture-memory-card.mjs
//
// Regenerates public/labs/memory-card/poster.jpg from the live save-select
// screen (unlike the other labs' posters, which are static canvas mockups —
// this one is a real screenshot of the app). Requires the dev server running
// at :3010 (`pnpm dev -p 3010`).
//
// The desktop grid (figure · rail · cards side by side) is too wide to crop
// into a 3:4 portrait without losing either the figure or the card fan — the
// two subjects sit ~1400px apart at 1440-wide. Below the `lg` breakpoint the
// screen already stacks figure -> cards -> rail -> story band in one column
// (screen.tsx's own responsive design for narrow viewports), which is a
// natural portrait composition, so this captures THAT layout instead, at a
// CSS width of 384 (physical 768 @2x — the current poster's exact width, no
// horizontal resampling needed).
//
// The crop window is centered on the figure-canvas-top..cards-canvas-bottom
// span, measured from the live DOM (both canvases are the only
// `aria-hidden="true"` wrappers in the stage, in that DOM order) rather than
// a hardcoded pixel offset, so a future copy/asset change that reflows the
// page doesn't quietly miscrop the poster. Playwright's own `clip` + jpeg
// screenshot does the crop and encode in one step — no image-processing
// dependency needed.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(DIR, '..', '..', 'public', 'labs', 'memory-card', 'poster.jpg')
const URL = 'http://localhost:3010/labs/memory-card'

const CSS_WIDTH = 384
const DPR = 2
const OUT_WIDTH_CSS = CSS_WIDTH // 768 physical — matches the shipped poster.jpg exactly
const OUT_HEIGHT_CSS = 512 // 1024 physical

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: CSS_WIDTH, height: 900 },
  deviceScaleFactor: DPR,
})
const page = await context.newPage()

// Boot: seed sessionStorage so the boot beat never shows.
await page.addInitScript(() => {
  window.sessionStorage.setItem('memory-card-booted', '1')
})
// Reduced motion: deterministic mid-idle figure pose and a static,
// already-well-posed card fan (the fan's non-focused cards are placed at a
// fixed three-quarter turn under reduced motion specifically so a still
// reads well — see three/card-arc.tsx's REDUCED_YAW). Sound stays off by
// construction; it only ever fires from a real user gesture, and this
// session never dispatches one.
await page.emulateMedia({ reducedMotion: 'reduce' })

await page.goto(URL, { waitUntil: 'networkidle' })
await page.getByRole('list', { name: /save files/i }).waitFor({ state: 'visible' })
await page.waitForTimeout(1500) // GLTF + PMREM settle

// Next.js dev-mode indicator — never present in production, must not leak
// into a committed asset.
await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })

// `main` is pinned to 100svh with overflow-hidden; the real scrollable
// content lives in its first child div (overflow-y-auto below `lg`). Resize
// the viewport to that content's natural height so a plain screenshot
// captures everything with `position: fixed` elements (header, footer)
// anchored correctly — fullPage screenshots mis-stitch fixed elements
// against the page's true height.
const contentHeight = await page.evaluate(() => {
  const inner = document.querySelector('main > div')
  return inner ? inner.scrollHeight : document.documentElement.scrollHeight
})
await page.setViewportSize({ width: CSS_WIDTH, height: contentHeight })
await page.waitForTimeout(500) // r3f canvases resize + repaint

// `:has(canvas)` (not just `[aria-hidden="true"]`) — the rail's active-row
// glyphs (arrow, dash) are also aria-hidden and sit between the two canvas
// wrappers in DOM order, so a plain attribute match grabs the wrong element.
const wrappers = page.locator('[aria-hidden="true"]:has(canvas)')
const figureBox = await wrappers.nth(0).boundingBox()
const cardsBox = await wrappers.nth(1).boundingBox()
if (!figureBox || !cardsBox) {
  throw new Error('Could not measure figure/cards canvas wrappers — DOM structure changed?')
}

const clusterTop = figureBox.y
const clusterBottom = cardsBox.y + cardsBox.height
const clusterCenter = (clusterTop + clusterBottom) / 2

let cropTop = Math.round(clusterCenter - OUT_HEIGHT_CSS / 2)
cropTop = Math.max(0, Math.min(cropTop, contentHeight - OUT_HEIGHT_CSS))

await page.screenshot({
  path: OUT,
  type: 'jpeg',
  quality: 80,
  clip: { x: 0, y: cropTop, width: OUT_WIDTH_CSS, height: OUT_HEIGHT_CSS },
})
await browser.close()

console.log('wrote', OUT, `(crop top ${cropTop}px css of ${contentHeight}px)`)
