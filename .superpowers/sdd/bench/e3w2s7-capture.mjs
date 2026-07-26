// WAVE-2 s7 eye-test capture. Shoots spread 7 (chapter VI, the Northern
// Treasury) at the blind reviewer's exact viewport (1600x900) plus DPR2 crops of
// every region the blind report called illegible, and drains the console so the
// StrictMode GL_INVALID_VALUE claim can be checked.
//
// usage: node .superpowers/sdd/bench/e3w2s7-capture.mjs [label] [port]
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LABEL = process.argv[2] ?? 'base'
const PORT = process.argv[3] ?? '3167'
const OUT = `.superpowers/sdd/bench/out/e3w2s7/${LABEL}`
mkdirSync(OUT, { recursive: true })

const VIEW = { width: 1600, height: 900 }
const HIDE_CSS = `.sb-vignette,.sb-quill-cursor{display:none!important;}`

// CSS-space regions the blind report named (x,y,w,h at 1600x900).
const CROPS = {
  spine: [640, 430, 400, 320], // #18 seal plaque + #19 starburst + #20 tabs
  vault: [900, 430, 420, 300], // #16 coffer, closed + open
  wings: [180, 300, 420, 340], // #15 backdrop wings (left)
  gold: [600, 220, 400, 260], // #13 balcony gold + #14 nameplate
  clerk: [400, 480, 340, 280],
  wheel: [800, 570, 400, 300], // #17 scribe
}

const SHOTS = [
  ['rest', `sbpose=7`],
  ['coffer-open', `sbpose=7&sbdrive=ch6-coffer~0:95`],
  // the counting wheel at three detents: 0 (rest), one 45deg click, and a
  // half-turn. `?sbdrive=<id>:<deg>` freezes the volvelle twist in DEGREES.
  ['wheel-d1', `sbpose=7&sbdrive=ch6-assay:45`],
  ['wheel-d4', `sbpose=7&sbdrive=ch6-assay:180`],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 2 })
const msgs = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') msgs.push(`${m.type()}: ${m.text()}`)
})
page.on('pageerror', (e) => msgs.push(`pageerror: ${e.message}`))

for (const [label, query] of SHOTS) {
  const before = msgs.length
  await page.goto(`http://localhost:${PORT}/labs/storybook?${query}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas', { timeout: 60000 })
  await page.waitForFunction(() => window.__sbStore?.getState?.().booted === true, { timeout: 60000 }).catch(() => {})
  await page.addStyleTag({ content: HIDE_CSS })
  await page.mouse.move(800, 60)
  await page.waitForTimeout(3500)
  const boot = msgs.length - before
  const full = await page.screenshot({ type: 'png' })
  await sharp(full).resize(1600, 900, { fit: 'fill' }).png().toFile(join(OUT, `${label}-1x.png`))
  for (const [name, [x, y, w, h]] of Object.entries(CROPS)) {
    await sharp(full)
      .extract({ left: x * 2, top: y * 2, width: w * 2, height: h * 2 })
      .resize({ width: Math.min(1200, w * 3) })
      .png()
      .toFile(join(OUT, `${label}-${name}.png`))
  }
  // idle drain: does the GL spam continue after boot?
  const mid = msgs.length
  await page.waitForTimeout(4000)
  console.log(`${label}: boot msgs=${boot} idle msgs=${msgs.length - mid}`)
}

writeFileSync(join(OUT, 'console.txt'), msgs.slice(0, 200).join('\n'))
console.log(`total console msgs: ${msgs.length}`)
await browser.close()
console.log('DONE ->', OUT)
