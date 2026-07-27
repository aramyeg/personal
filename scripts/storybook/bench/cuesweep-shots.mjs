// Live rest captures of the three converted spreads, for the cue sweep.
// usage: node cuesweep-shots.mjs [port]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  acquireLock,
  releaseLock,
} from './capture-lock.mjs'

const PORT = process.argv[2] ?? '3161'
const OUT =
  'C:/Users/GBM/AppData/Local/Temp/claude/C--Users-GBM-Documents-Projects-personal/7f7a6c31-9c6e-4cbf-a647-bf6a155966a2/scratchpad/shots'
mkdirSync(OUT, { recursive: true })

await acquireLock('e3-cuesweep shots')
try {
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  })
  for (const pose of [2, 3, 5, 6]) {
    await page.goto(`http://localhost:${PORT}/labs/storybook?sbpose=${pose}&sbidle=1`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('canvas', { timeout: 120000 })
    await page
      .waitForFunction(() => window.__sbStore?.getState?.().booted === true, { timeout: 120000 })
      .catch(() => {})
    await page.addStyleTag({ content: `.sb-vignette,.sb-quill-cursor{display:none!important;}` })
    await page.mouse.move(800, 60)
    await page.waitForTimeout(3600)
    await page.screenshot({ type: 'png', path: join(OUT, `spread-${pose}.png`) })
    console.log('shot spread', pose)
  }
  await browser.close()
} finally {
  releaseLock()
}
