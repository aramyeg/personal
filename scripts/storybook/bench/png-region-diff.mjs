/**
 * png-region-diff.mjs — mean absolute pixel difference over a region of two captures.
 *
 * WHY THIS EXISTS. A capture round chasing a "regression" in the moon's shadow on the left page
 * produced two confident, wrong root causes in a row. Both came from eyeballing frames that were
 * not comparable: `?sbidle=1` UNPINS the idle clock (mist and smoke keep drifting), and the desk's
 * parallax rig only re-tilts when a pointer EVENT arrives, so a capture that re-navigates to the
 * same mouse position gets zero tilt on some loads and full tilt on others. A numeric diff ended
 * it in one command: the suspect change measured 2.28 against a 2.37 noise floor between two
 * IDENTICAL runs. It was mist.
 *
 * So: before believing any visual A/B, run the same pose TWICE with no change at all, take that
 * as the noise floor, and only trust a difference that clearly beats it.
 *
 * usage: node scripts/storybook/bench/png-region-diff.mjs a.png b.png [x0 y0 x1 y1]
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const [a, b, ...box] = process.argv.slice(2)
if (!a || !b) {
  console.error('usage: png-region-diff.mjs a.png b.png [x0 y0 x1 y1]')
  process.exit(2)
}
const region = box.length === 4 ? box.map(Number) : null

const browser = await chromium.launch()
const page = await browser.newPage()
const enc = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`
const out = await page.evaluate(
  async ([ua, ub, rgn]) => {
    const load = (u) =>
      new Promise((res) => {
        const i = new Image()
        i.onload = () => res(i)
        i.src = u
      })
    const [ia, ib] = await Promise.all([load(ua), load(ub)])
    if (ia.width !== ib.width || ia.height !== ib.height) return { error: 'size mismatch' }
    const c = document.createElement('canvas')
    c.width = ia.width
    c.height = ia.height
    const x = c.getContext('2d')
    x.drawImage(ia, 0, 0)
    const A = x.getImageData(0, 0, c.width, c.height).data
    x.clearRect(0, 0, c.width, c.height)
    x.drawImage(ib, 0, 0)
    const B = x.getImageData(0, 0, c.width, c.height).data
    const [x0, y0, x1, y1] = rgn ?? [0, 0, c.width, c.height]
    let sum = 0
    let worst = 0
    let n = 0
    for (let yy = y0; yy < y1; yy += 1) {
      for (let xx = x0; xx < x1; xx += 1) {
        const i = (yy * c.width + xx) * 4
        const d =
          Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])
        sum += d
        if (d > worst) worst = d
        n += 1
      }
    }
    return { mean: sum / n, worst, pixels: n }
  },
  [enc(a), enc(b), region]
)
console.log(JSON.stringify(out))
await browser.close()
