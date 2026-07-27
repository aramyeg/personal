/** N-5 eye-test: the row before and after a press-drag at a given x. */
import { chromium } from 'playwright'
import sharp from 'sharp'

const PORT = process.argv[2] ?? '3164'
const X = Number(process.argv[3] ?? 983)
const TAG = process.argv[4] ?? 'x'
const URL = `http://localhost:${PORT}/labs/storybook?sbpose=6`
const CLIP = { x: 880, y: 580, width: 680, height: 260 }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('canvas', { timeout: 30000 })
await page.waitForTimeout(2800)
await page.mouse.move(X, 690)
await page.waitForTimeout(900)

const grab = async (name) =>
  sharp(await page.screenshot({ clip: CLIP }))
    .resize({ width: CLIP.width * 2, kernel: 'nearest' })
    .toFile(`scripts/storybook/bench/out-row-${TAG}-${name}.png`)

await grab('before')
await page.mouse.down()
for (let i = 1; i <= 10; i++) await page.mouse.move(X, 690 - i * 24)
await page.mouse.up()
await page.waitForTimeout(900)
await page.mouse.move(X, 690)
await page.waitForTimeout(600)
await grab('after')
console.log(`captured out-row-${TAG}-{before,after}.png at x=${X}`)
await browser.close()
