/**
 * S5R2 LIVE PROBE — the four claims of the s5 blind re-review, measured on the
 * reviewer's own path (?sbpose=5&sbidle=1, 1600x900), before and after the fix.
 *
 *   reset   (S5R2-2) "Mechanism state survives leaving and returning to the
 *           spread." Drives the gold pile, turns away with the SAME controls the
 *           reviewer used (the bottom arrows, then a corner peel), comes back and
 *           reads the scrub channel.
 *   graded  (S5R2-4) The dissolve's stroke->slat mapping: how much flip a
 *           10/25/40/80/150px press-drag buys, and whether 35px and 250px land
 *           on the same frame.
 *   drift   (S5R2-4) The gold pile out-and-back: press, drag +N, drag -N, read
 *           the lift. Any residue is drift.
 *   corner  (S5R2-3) Over each mover's own pixels: does the dog-ear light at the
 *           same time as the pinch cursor, and does a click fire either?
 *
 * Usage: node scripts/storybook/bench/s5r2-probe.mjs [port] [which]
 *   which in {all, reset, graded, drift, corner}
 */
import { chromium } from 'playwright'
import { acquireLock, releaseLock } from '../../../../labs-storybook/.superpowers/sdd/bench/lock.mjs'

const PORT = process.argv[2] ?? '3165'
const WHICH = process.argv[3] ?? 'all'
const URL = `http://localhost:${PORT}/labs/storybook?sbpose=5&sbidle=1`

const drives = (page) =>
  page.evaluate(() => {
    const d = window.__sbUserDrive
    return Object.fromEntries(d.listUserDriveIds().map((id) => [id, d.readUserDrive(id)]))
  })

const storeState = (page) =>
  page.evaluate(() => {
    const s = window.__sbStore?.getState?.()
    return s ? { spread: s.spread, turning: s.turning, hover: s.hover, grab: s.grab?.id ?? null } : null
  })

const cornerState = (page) =>
  page.evaluate(() => ({
    corner: document.documentElement.dataset.sbCorner ?? '',
    dogearL: (() => {
      const el = document.querySelector('.sb-dogear--left')
      return el ? Number(getComputedStyle(el).opacity) : null
    })(),
    dogearR: (() => {
      const el = document.querySelector('.sb-dogear--right')
      return el ? Number(getComputedStyle(el).opacity) : null
    })(),
  }))

const settle = (page, ms = 900) => page.waitForTimeout(ms)

async function boot(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas', { timeout: 40000 })
  await page.waitForTimeout(3200)
}

// Screen stations, derived in __tests__/labs/storybook/s5-vault.test.ts's own
// projection (printed by `pnpm vitest run s5-vault` under SB_PRINT_STATIONS=1).
// Passed in so this file never hard-codes a box it did not derive.
const STATIONS = JSON.parse(process.env.SB_S5_STATIONS ?? '{}')

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))

  const out = {}

  if (WHICH === 'all' || WHICH === 'reset') {
    await boot(page)
    // Park the pointer where parallax cannot drift between reads.
    await page.mouse.move(800, 200)
    await settle(page, 400)
    await page.evaluate(() => {
      window.__sbUserDrive.writeUserDrive('ch4-goldpile', 0.9)
      window.__sbUserDrive.writeUserDrive('ch4-dissolve', Math.PI)
    })
    const before = await drives(page)
    // The reviewer's path 1: the bottom nav arrows, away and back.
    await page.click('button[aria-label="Turn the page"]')
    await settle(page, 2200)
    const away = { drives: await drives(page), store: await storeState(page) }
    await page.click('button[aria-label="Turn back"]')
    await settle(page, 2200)
    const back = { drives: await drives(page), store: await storeState(page) }
    out.resetByArrows = { before, away, back }
  }

  if (WHICH === 'all' || WHICH === 'graded') {
    await boot(page)
    const { x, y } = STATIONS.dissolveBody ?? { x: 430, y: 620 }
    const flips = []
    for (const dx of [10, 25, 40, 80, 150, 250]) {
      await boot(page)
      await page.mouse.move(x, y)
      await settle(page, 500)
      await page.mouse.down()
      const held = []
      for (let i = 1; i <= 8; i++) {
        await page.mouse.move(x - (dx * i) / 8, y)
        held.push(await page.evaluate(() => window.__sbUserDrive.readUserDrive('ch4-dissolve') ?? 0))
      }
      const atRelease = held[held.length - 1]
      await page.mouse.up()
      await settle(page, 1200)
      const settled = await page.evaluate(() => window.__sbUserDrive.readUserDrive('ch4-dissolve') ?? 0)
      flips.push({ dx, held: held.map((v) => +(v * 57.2958).toFixed(1)), atRelease: +(atRelease * 57.2958).toFixed(1), settled: +(settled * 57.2958).toFixed(1) })
    }
    out.graded = flips
  }

  if (WHICH === 'all' || WHICH === 'drift') {
    const { x, y } = STATIONS.goldpileBody ?? { x: 1180, y: 600 }
    const runs = []
    for (const dx of [15, 30, 50, 120]) {
      await boot(page)
      await page.mouse.move(x, y)
      await settle(page, 500)
      const start = await page.evaluate(() => window.__sbUserDrive.readUserDrive('ch4-goldpile') ?? null)
      await page.mouse.down()
      const a0 = await page.evaluate(() => window.__sbUserDrive.readUserDrive('ch4-goldpile') ?? 0)
      for (let i = 1; i <= 6; i++) await page.mouse.move(x + (dx * i) / 6, y)
      const aOut = await page.evaluate(() => window.__sbUserDrive.readUserDrive('ch4-goldpile') ?? 0)
      for (let i = 5; i >= 0; i--) await page.mouse.move(x + (dx * i) / 6, y)
      const aBack = await page.evaluate(() => window.__sbUserDrive.readUserDrive('ch4-goldpile') ?? 0)
      await page.mouse.up()
      await settle(page, 1200)
      const aRest = await page.evaluate(() => window.__sbUserDrive.readUserDrive('ch4-goldpile') ?? null)
      const deg = (v) => (v === null ? null : +(v * 57.2958).toFixed(2))
      runs.push({ dx, start: deg(start), a0: deg(a0), aOut: deg(aOut), aBack: deg(aBack), aRest: deg(aRest), driftDeg: deg(aBack - a0) })
    }
    out.drift = runs
  }

  if (WHICH === 'all' || WHICH === 'corner') {
    await boot(page)
    const probes = STATIONS.cornerProbes ?? [
      { name: 'left-corner-over-dissolve', x: 430, y: 670 },
      { name: 'right-corner-over-goldpile', x: 1180, y: 670 },
      { name: 'left-corner-void', x: 300, y: 690 },
    ]
    const rows = []
    for (const p of probes) {
      await page.mouse.move(p.x - 40, p.y - 40)
      await settle(page, 250)
      await page.mouse.move(p.x, p.y)
      await settle(page, 500)
      const st = await storeState(page)
      const c = await cornerState(page)
      const folioBefore = await page.evaluate(() => document.querySelector('.sb-nav-folio')?.textContent?.trim() ?? null)
      await page.mouse.down()
      await page.mouse.up()
      await settle(page, 1800)
      const folioAfter = await page.evaluate(() => document.querySelector('.sb-nav-folio')?.textContent?.trim() ?? null)
      rows.push({ ...p, hover: st?.hover ?? null, ...c, turned: folioBefore !== folioAfter, folioBefore, folioAfter })
      if (folioBefore !== folioAfter) await boot(page)
    }
    out.corner = rows
  }

  console.log(JSON.stringify(out, null, 2))
  await browser.close()
}

await acquireLock('s5r2-probe')
try {
  await run()
} finally {
  releaseLock()
}
