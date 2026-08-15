// E4 GRAND — the COURTYARD GROUND deck (judge finding 1 + 2).
//
// Five frames, and only five, because these are the ones the two findings are
// judged on:
//   rest        — does the rack boundary vanish into the page paving?
//   drive 045   — the first centimetre of pull: does the rising lantern read?
//   drive 090   — mid-flip, the rack edge-on over the page ground
//   drive 180   — the delivered A->B payoff
//   turn-60     — mid-build, the page ground visible with the rack still flat
//
// usage: node scripts/storybook/bench/e4-ground-shots.mjs [port] [outDir] [tag]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const PORT = process.argv[2] ?? '3163'
const OUT = process.argv[3] ?? '.superpowers/e4-candidate/shots'
const TAG = process.argv[4] ?? 'ground'
const SPREAD = 2
const CHANNEL = 'ch1-arrival-floor'

const HEADED = process.env.SB_HEADLESS !== '1'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: !HEADED })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

const settle = async (ms) => {
  await page.waitForSelector('canvas', { timeout: 120000 })
  await page
    .waitForFunction(() => window.__sbStore?.getState?.().booted === true, { timeout: 120000 })
    .catch(() => {})
  await page.addStyleTag({ content: `.sb-vignette,.sb-quill-cursor{display:none!important;}` })
  await page.mouse.move(1500, 40)
  await page.waitForTimeout(ms)
}

const shoot = async (url, file, ms = 2600) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await settle(ms)
  await page.screenshot({ type: 'png', path: join(OUT, `${TAG}-${file}.png`) })
  console.log('shot', file)
}

const base = `http://localhost:${PORT}/labs/storybook?sbpose=${SPREAD}&sbidle=1`
await shoot(base, 'rest', 3600)
for (const deg of [45, 90, 180]) {
  await shoot(`${base}&sbdrive=${CHANNEL}:${deg}`, `drive-${String(deg).padStart(3, '0')}`)
}
// the turn INTO spread 2 is (SPREAD-1):t:next — see e4-grand-shots.mjs
await shoot(`http://localhost:${PORT}/labs/storybook?sbpose=${SPREAD - 1}:0.6:next&sbidle=1`, 'turn-60', 2400)

await browser.close()
console.log('done ->', OUT)
