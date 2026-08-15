// E4 GRAND lane — ad-hoc capture rig for the M2 landing settle and the
// lamplit-passage repaint. Unlike e4-grand-shots.mjs (fixed fractions) this one
// takes an arbitrary list of `name=query` pairs, so a shot can be aimed exactly
// at a piece's overshoot peak or at a driven pull state.
//
// usage: node scripts/storybook/bench/e4-settle-shots.mjs <port> <outDir> <tag> name=query [name=query ...]
//   query is everything after `?` on /labs/storybook, e.g.
//   `sbpose=1:0.372:next&sbidle=1`
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [, , PORT = '3163', OUT = '.superpowers/e4-candidate/shots', TAG = 'settle', ...pairs] =
  process.argv

if (!pairs.length) {
  console.error('no shots requested')
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })

// Headed: headless/background tabs suspend rAF, so r3f never settles.
const HEADED = process.env.SB_HEADLESS !== '1'
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

const WAIT = Number(process.env.SB_WAIT ?? 2600)

for (const pair of pairs) {
  const eq = pair.indexOf('=')
  const name = pair.slice(0, eq)
  const query = pair.slice(eq + 1)
  await page.goto(`http://localhost:${PORT}/labs/storybook?${query}`, {
    waitUntil: 'domcontentloaded',
  })
  await settle(WAIT)
  const file = join(OUT, `${TAG}-${name}.png`)
  await page.screenshot({ type: 'png', path: file })
  console.log('shot', name, '->', file)
}

await browser.close()
console.log('done ->', OUT)
