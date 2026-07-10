import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { statSync } from 'node:fs'
import { chromium } from 'playwright'

const dir = path.dirname(fileURLToPath(import.meta.url))
const html = path.join(dir, 'storybook-poster.html')
const out = path.join(dir, '..', '..', 'public', 'labs', 'storybook', 'poster.jpg')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 768, height: 1024 } })
await page.goto('file://' + html.replace(/\\/g, '/'))
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(150) // settle web-font swap + gradient paint
await page.screenshot({ path: out, type: 'jpeg', quality: 96 })
await browser.close()

const { size } = statSync(out)
console.log(`poster.jpg: ${(size / 1024).toFixed(1)} KB`)
if (size > 200 * 1024) {
  console.error('poster.jpg exceeds the 200 KB budget')
  process.exitCode = 1
}
