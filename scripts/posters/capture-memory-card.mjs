// scripts/posters/capture-memory-card.mjs
//
// Regenerates public/labs/memory-card/poster.jpg from the live split-hero
// character-select screen (unlike the other labs' posters, which are static
// canvas mockups — this one is a real screenshot of the app). Requires the dev
// server running at :3010 (`pnpm dev -p 3010`).
//
// The desktop layout splits the figure (left half) from the slot list (right
// half), so a 3:4 portrait can't frame both side by side. Below the `lg`
// breakpoint the screen stacks into one column — figure, giant display title,
// then the slot-select spec sheet (screen.tsx's own responsive design) — which
// is a natural portrait composition, so this captures THAT layout: the
// character standing over its name with the "select save" list beginning below.
//
// The crop is anchored on the live figure-canvas box (measured from the DOM,
// not a hardcoded offset) so a future copy/asset change that reflows the page
// doesn't quietly miscrop the poster. A single tall-enough viewport holds the
// whole 3:4 window, so a plain (non-fullPage) clipped screenshot captures it
// with the fixed header anchored correctly — fullPage screenshots mis-stitch
// fixed elements against the page's true height. Playwright's own `clip` + jpeg
// screenshot does the crop and encode in one step — no image dependency needed.
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
// Tall enough that the whole 3:4 crop fits inside one viewport (so no fullPage
// stitch is needed), while keeping the hero — `h-[48svh]`, so ~0.48 of this —
// a prominent-but-not-overwhelming mass in the portrait.
const VIEW_HEIGHT = 640

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: CSS_WIDTH, height: VIEW_HEIGHT },
  deviceScaleFactor: DPR,
})
const page = await context.newPage()

// Boot: seed sessionStorage so the one-per-session boot beat never shows (its
// SESSION_KEY, see boot.tsx). Without this the capture could catch the ink boot
// overlay instead of the select screen.
await page.addInitScript(() => {
  window.sessionStorage.setItem('memory-card-booted', '1')
})
// Reduced motion: the figure holds a deterministic three-quarter idle pose and
// the turntable/atmosphere are static, so a still frame reads cleanly instead
// of catching a mid-spin or mid-crossfade. Sound stays off by construction — it
// only ever fires from a real user gesture, and this session never dispatches one.
await page.emulateMedia({ reducedMotion: 'reduce' })

await page.goto(URL, { waitUntil: 'networkidle' })
await page.getByRole('list', { name: /save files/i }).waitFor({ state: 'visible' })
await page.waitForTimeout(1500) // GLTF + PMREM settle

// Next.js dev-mode indicator — never present in production, must not leak
// into a committed asset.
await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
await page.waitForTimeout(300) // let the figure's demand-loop repaint settle

// The figure hero is the ONLY live 3D scene now (the card fan and its second
// canvas are gone), so there is a single `aria-hidden="true"` canvas wrapper —
// `:has(canvas)` excludes the accent-atmosphere div, which is also aria-hidden
// but carries no canvas. The slot list is `#save-index`.
const figureBox = await page.locator('[aria-hidden="true"]:has(canvas)').first().boundingBox()
const listBox = await page.locator('#save-index').boundingBox()
if (!figureBox || !listBox) {
  throw new Error('Could not measure the figure canvas or slot list — DOM structure changed?')
}

// Frame the figure with a little headroom at the top; the fixed 3D camera keeps
// the character fully in view, vertically centred in its canvas, so a small
// inset from the canvas top clears the dead space above the head without
// clipping it. The 512-tall window then flows down through the display title
// into the top of the "select save" list.
const HEAD_INSET = Math.round(figureBox.height * 0.14)
let cropTop = figureBox.y + HEAD_INSET
// Keep the whole window inside the viewport (plain screenshot can't clip beyond
// it) and never above the page top.
cropTop = Math.max(0, Math.min(cropTop, VIEW_HEIGHT - OUT_HEIGHT_CSS))

await page.screenshot({
  path: OUT,
  type: 'jpeg',
  quality: 80,
  clip: { x: 0, y: cropTop, width: OUT_WIDTH_CSS, height: OUT_HEIGHT_CSS },
})
await browser.close()

console.log(
  'wrote',
  OUT,
  `(crop top ${cropTop}px css; figure y=${Math.round(figureBox.y)} h=${Math.round(
    figureBox.height
  )}; list y=${Math.round(listBox.y)})`
)
