// One s7 spine shot, for the decomposition loop. usage: node e3w2s7-shot.mjs <relpath> [port]
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const REL = process.argv[2] ?? 'shot'
const PORT = process.argv[3] ?? '3167'
const OUT = join('.superpowers/sdd/bench/out/e3w2s7', dirname(REL))
mkdirSync(OUT, { recursive: true })
const NAME = REL.split('/').pop()

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${PORT}/labs/storybook?sbpose=7`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('canvas', { timeout: 60000 })
await page.waitForFunction(() => window.__sbStore?.getState?.().booted === true, { timeout: 60000 }).catch(() => {})
await page.addStyleTag({ content: `.sb-vignette,.sb-quill-cursor{display:none!important;}` })
await page.mouse.move(800, 60)
await page.waitForTimeout(3200)
const full = await page.screenshot({ type: 'png' })
await sharp(full).extract({ left: 1280, top: 860, width: 800, height: 640 }).resize({ width: 1000 }).png().toFile(join(OUT, `${NAME}.png`))
await browser.close()
console.log('shot', NAME)
