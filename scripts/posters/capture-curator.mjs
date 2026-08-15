import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dir = path.dirname(fileURLToPath(import.meta.url))
const html = path.join(dir, 'curator-poster.html')
const out = path.join(dir, '..', '..', 'public', 'labs', 'curator', 'poster.jpg')
const MAX_BYTES = 200 * 1024

fs.mkdirSync(path.dirname(out), { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } })
await page.goto('file://' + html.replace(/\\/g, '/'))

let quality = 80
await page.screenshot({ path: out, type: 'jpeg', quality })
let size = fs.statSync(out).size

while (size > MAX_BYTES && quality > 50) {
  quality -= 5
  await page.screenshot({ path: out, type: 'jpeg', quality })
  size = fs.statSync(out).size
}

await browser.close()

console.log(`poster.jpg: ${size} bytes at quality ${quality} (limit ${MAX_BYTES} bytes)`)
if (size > MAX_BYTES) {
  console.log('WARNING: poster.jpg still exceeds the 200 KB budget at floor quality 50.')
}
