/**
 * e5-foldbirth-shots.mjs — posed captures of the title -> chapter I turn, for the fold-birth.
 *
 * Same poses and framing as the supervisor's first sweep, so the frames diff directly against
 * .superpowers/e5-candidate/scratch/sweep/. `?sbpose=1:<t>:next` freezes the turn leaving spread
 * 1 at exactly raw progress t — pixel-reproducible, zero timing noise. DEV SERVER ONLY: the pose
 * override is compiled out of production builds.
 *
 * usage: node scripts/storybook/bench/e5-foldbirth-shots.mjs [port] [outDir]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { acquireLock, releaseLock } from './capture-lock.mjs'

const PORT = process.argv[2] ?? '3164'
const OUT = process.argv[3] ?? '.superpowers/e5-candidate/scratch/sweep2'
mkdirSync(OUT, { recursive: true })

// The supervisor's sweep, plus the two frames the leak lived in and the new first beat.
const POSES = (process.argv[4] ?? '0.2,0.35,0.45,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1').split(',')

await acquireLock('e5 fold-birth sweep')
try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  for (const t of POSES) {
    await page.goto(
      `http://localhost:${PORT}/labs/storybook?sbpose=1:${t}:next&view=book`,
      { waitUntil: 'domcontentloaded' }
    )
    await page.waitForSelector('canvas', { timeout: 120000 })
    await page
      .waitForFunction(() => window.__sbStore?.getState?.().booted === true, { timeout: 120000 })
      .catch(() => {})
    await page.addStyleTag({ content: `.sb-vignette,.sb-quill-cursor{display:none!important;}` })
    // TWO moves, and they matter. The desk's parallax rig eases toward r3f's `state.pointer`,
    // which only updates when a pointer EVENT arrives over the canvas — and after a navigation a
    // move to the SAME coordinates fires nothing, so the rig stays at zero tilt on some loads and
    // at full tilt on others. Two different points guarantee an event, and the wait lets the ease
    // settle; without this the book is framed differently run to run and every A/B is a lie.
    // NO ?sbidle=1. It UNPINS the idle clock (idle-life.ts idleClockPinned), so mist, smoke and
    // glints keep moving and no two captures are comparable — a measurement instrument that
    // removes the property being measured. Left in by accident it invalidated a whole A/B round.
    await page.mouse.move(400, 300)
    await page.mouse.move(800, 450)
    await page.waitForTimeout(3600)
    await page.screenshot({ type: 'png', path: join(OUT, `t${t.replace('.', '_')}.png`) })
    console.log('shot t', t)
  }
  await browser.close()
} finally {
  await releaseLock()
}
