// E4 GRAND lane — the candidate capture rig.
//
// The lane's thesis is that the page turn builds the inn in SEPARATED events,
// so a rest-pose shot proves nothing. This rig shoots the turn fraction sweep
// (?sbpose=<spread>:<t>:<dir>, use-turn-driver.ts readPoseOverride) plus the
// rest pose, which is what the erection choreography is judged on.
//
// usage: node scripts/storybook/bench/e4-grand-shots.mjs [port] [outDir] [tag]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const PORT = process.argv[2] ?? '3163'
const OUT = process.argv[3] ?? '.superpowers/e4-candidate/shots'
const TAG = process.argv[4] ?? ''
const SPREAD = 2

// Headed: headless and background tabs suspend rAF, so r3f never settles and
// the capture lies about a scene whose whole subject is motion.
const HEADED = process.env.SB_HEADLESS !== '1'

// The turn sweep. t is the driver's published fraction; dir 'fwd' turns INTO
// spread 2, so these frames are the inn being built.
const FRACTIONS = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]

mkdirSync(OUT, { recursive: true })

const settle = async (page, ms) => {
  await page.waitForSelector('canvas', { timeout: 120000 })
  await page
    .waitForFunction(() => window.__sbStore?.getState?.().booted === true, { timeout: 120000 })
    .catch(() => {})
  await page.addStyleTag({ content: `.sb-vignette,.sb-quill-cursor{display:none!important;}` })
  await page.mouse.move(1500, 40)
  await page.waitForTimeout(ms)
}

const browser = await chromium.launch({ headless: !HEADED })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

const name = (s) => join(OUT, TAG ? `${TAG}-${s}.png` : `${s}.png`)

// 1. Rest pose — the composition gate (hero share, mass ladder, negative space).
await page.goto(`http://localhost:${PORT}/labs/storybook?sbpose=${SPREAD}&sbidle=1`, {
  waitUntil: 'domcontentloaded',
})
await settle(page, 3600)
await page.screenshot({ type: 'png', path: name('rest') })
console.log('shot rest')

// 2. The turn sweep — the event-separation gate. Each frame must show a
//    DIFFERENT stage of the build; two adjacent frames that differ only in
//    overall scale mean the events collapsed back into one.
for (const t of FRACTIONS) {
  const tag = String(Math.round(t * 100)).padStart(2, '0')
  // readPoseOverride takes the COMMITTED spread and dir 'next'|'prev' (anything
  // else falls back to 'next'). The turn INTO spread N going forward is
  // therefore N-1 : t : next — passing N here silently shoots the N -> N+1
  // turn, which is a sweep of the WRONG spread being torn down, not this one
  // being built.
  await page.goto(
    `http://localhost:${PORT}/labs/storybook?sbpose=${SPREAD - 1}:${t}:next&sbidle=1`,
    { waitUntil: 'domcontentloaded' },
  )
  await settle(page, 2200)
  await page.screenshot({ type: 'png', path: name(`turn-${tag}`) })
  console.log('shot turn', t)
}

await browser.close()
console.log('done ->', OUT)
