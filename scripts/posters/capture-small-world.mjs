import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dir = path.dirname(fileURLToPath(import.meta.url))
const html = path.join(dir, 'small-world-poster.html')
const out = path.join(dir, '..', '..', 'public', 'labs', 'small-world', 'poster.jpg')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 768, height: 1024 } })
await page.goto('file://' + html.replace(/\\/g, '/'))
await page.waitForTimeout(600) // webfonts
await page.screenshot({ path: out, type: 'jpeg', quality: 80 })
await browser.close()
