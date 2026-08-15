// E4 GRAND — the hero-pull payoff deck: ?sbdrive=ch1-arrival-floor:<deg>
// freezes the dissolve tau (degrees 0..180); the arrival rank follows the same
// channel through its [0, 0.55] phase window, so one sweep shoots both payoffs.
// usage: node scripts/storybook/bench/e4-grand-pull.mjs [port] [outDir] [tag]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const PORT = process.argv[2] ?? '3163'
const OUT = process.argv[3] ?? '.superpowers/e4-candidate/shots'
const TAG = process.argv[4] ?? 'pull'
const SPREAD = 2
const CHANNEL = 'ch1-arrival-floor'
const DEGS = [0, 45, 90, 135, 180]

const HEADED = process.env.SB_HEADLESS !== '1'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: !HEADED })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

for (const deg of DEGS) {
  await page.goto(
    `http://localhost:${PORT}/labs/storybook?sbpose=${SPREAD}&sbidle=1&sbdrive=${CHANNEL}:${deg}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.waitForSelector('canvas', { timeout: 120000 })
  await page.addStyleTag({ content: `.sb-vignette,.sb-quill-cursor{display:none!important;}` })
  await page.mouse.move(1500, 40)
  await page.waitForTimeout(2600)
  await page.screenshot({ type: 'png', path: join(OUT, `${TAG}-${String(deg).padStart(3, '0')}.png`) })
  console.log('shot pull', deg)
}

await browser.close()
console.log('done ->', OUT)
