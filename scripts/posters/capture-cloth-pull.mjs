/**
 * Cloth Pull poster: live capture of the scene at a portrait viewport,
 * taken mid-haul so the chibi is straining and the cloth answers.
 * Requires the app running (BASE env, default http://localhost:3000).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dir = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(dir, '..', '..', 'public', 'labs', 'cloth-pull', 'poster.jpg')
const BASE = process.env.BASE ?? 'http://localhost:3000'
const MAX_BYTES = 200 * 1024

fs.mkdirSync(path.dirname(out), { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } })
await page.goto(`${BASE}/labs/cloth-pull`, { waitUntil: 'networkidle' })
// the poster is the scene, not the chrome
await page.addStyleTag({ content: 'a[href="/"]{display:none!important}' })
// let the intro haul land, then pull mid-frame for the strain pose
await page.waitForTimeout(5000)
await page.mouse.move(650, 620)
await page.mouse.down()
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(650 - i * 18, 620)
  await page.waitForTimeout(12)
}

let quality = 82
await page.screenshot({ path: out, type: 'jpeg', quality })
let size = fs.statSync(out).size
while (size > MAX_BYTES && quality > 50) {
  quality -= 5
  await page.screenshot({ path: out, type: 'jpeg', quality })
  size = fs.statSync(out).size
}
await page.mouse.up()
await browser.close()

console.log(`poster.jpg: ${size} bytes at quality ${quality} (limit ${MAX_BYTES})`)
