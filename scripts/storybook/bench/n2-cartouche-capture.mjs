/**
 * N-2 — WHICH WAY DOES "RAISE A STALL" READ?
 *
 * A blind reader's re-re-review of spread 6: "The 'RAISE A STALL' plaque is
 * rendered rotated 180 degrees. At every stage of travel — flat, mid-raise,
 * fully raised — the label reads upside-down to the reader. The single
 * discovery cue on the page requires tilting your head to read."
 *
 * This bench does not argue with that; it takes a picture of it. The crop is
 * DERIVED, never eyeballed: the deck band's world quad comes out of the same
 * arithmetic popup-tabpiece.ts solves (pagePoint / solveTabPiecePoseAt,
 * replicated here because a .mjs cannot import the lab's TypeScript), and the
 * screen box comes out of reading-stage.ts's own camera basis. The printed
 * u/v screen vectors are the actual finding: they say which way image-x and
 * image-y point at the reader's eye, which is the thing a screenshot can only
 * confirm.
 *
 * Usage: node scripts/storybook/bench/n2-cartouche-capture.mjs <label>
 * (lane-local dev server on 3164; writes scripts/storybook/bench/out/n2-*.png)
 */

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out')
const TAG = process.argv[2] ?? 'before'
const PORT = 3164

// ---- page-geometry.ts constants (verbatim)
const PAGE_W = 1.15
const SHEET_STACK_T = 0.014
const STACK_PEDESTAL = 0.02
const HINGE_KAPPA = 0
const INTERIOR_SHEETS = 9

// ---- content.ts, the ch5-raise-stall layer (verbatim)
const GEOM = { side: 'left', form: 'table', hingeX: 0.9, z0: 0.36, z1: 0.64, legW: 0.18, deckD: 0.2, liftDeg: 7, restAtDeg: 176 }
const SPREAD = 6

// ---- reading-stage.ts (verbatim)
const EYE = [0, 1.85, 3.05]
const LOOKAT = [0, 0.38, 0.05]
const FOV = 34
const VIEW = { w: 1600, h: 900 }

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2])
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]
}
const FWD = norm(sub(LOOKAT, EYE))
const RIGHT = norm(cross(FWD, [0, 1, 0]))
const UP = norm(cross(RIGHT, FWD))
const TAN_H = Math.tan((FOV * Math.PI) / 360)

function toScreenPx(p) {
  const rel = sub(p, EYE)
  const depth = Math.max(1e-3, dot(rel, FWD))
  const sx = dot(rel, RIGHT) / (depth * TAN_H * (VIEW.w / VIEW.h))
  const sy = dot(rel, UP) / (depth * TAN_H)
  return { x: (sx * 0.5 + 0.5) * VIEW.w, y: (1 - (sy * 0.5 + 0.5)) * VIEW.h }
}

const rad = (d) => (d * Math.PI) / 180
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

function restThetas(spread) {
  const left = Math.max(0, spread - 1)
  const right = INTERIOR_SHEETS + 1 - Math.max(1, spread)
  const hL = STACK_PEDESTAL + left * SHEET_STACK_T
  const hR = STACK_PEDESTAL + right * SHEET_STACK_T
  const hinge = STACK_PEDESTAL + HINGE_KAPPA * Math.min(left, right) * SHEET_STACK_T
  return { thetaL: Math.PI - Math.asin((hL - hinge) / PAGE_W), thetaR: Math.asin((hR - hinge) / PAGE_W) }
}

function pagePoint(t) {
  const u = [Math.cos(t), Math.sin(t), 0]
  const n = [Math.sin(t), -Math.cos(t), 0]
  return (d, lift, z) => [d * u[0] + lift * n[0], d * u[1] + lift * n[1], z]
}

/** The deck band's world quad at lift `a`, corners in the layer's own order
 *  [P(dA,za) P(dA,zb) P(dB,zb) P(dB,za)] — the order tabFaceUvs pins uvs to. */
function deckQuad(a) {
  const { thetaL } = restThetas(SPREAD)
  const P = pagePoint(thetaL)
  const w = GEOM.legW
  const h = w * Math.sin(a)
  const reach = w * Math.cos(a)
  const [za, zb] = [GEOM.z1, GEOM.z0] // side: 'left'
  const dA = GEOM.hingeX - reach - GEOM.deckD
  const dB = GEOM.hingeX - reach
  return [P(dA, h, za), P(dA, h, zb), P(dB, h, zb), P(dB, h, za)]
}

const camLift = () => {
  const { thetaL, thetaR } = restThetas(SPREAD)
  const beta = thetaL - thetaR
  const u = clamp(Math.sin(beta / 2) / Math.sin(rad(176) / 2), 0, 1)
  return rad(GEOM.liftDeg) * Math.sin((u * Math.PI) / 2)
}
const STOP_LIFT = rad(88)
const slideFromLift = (a) => 2 * GEOM.legW * (1 - Math.cos(a))

/** The deck band's uv axes as SCREEN vectors (y-down px): where image-x and
 *  image-up actually point at the reader's eye. `tabFaceUvs` pins corner 0 to
 *  (0,vA), corner 1 to (1,vA), corner 3 to (0,vB) — so c0->c1 is +u (image
 *  right) and c0->c3 is +v (image UP, three.js flipY default). */
function uvScreenAxes(quad) {
  const p = quad.map(toScreenPx)
  return {
    box: {
      x0: Math.min(...p.map((q) => q.x)),
      x1: Math.max(...p.map((q) => q.x)),
      y0: Math.min(...p.map((q) => q.y)),
      y1: Math.max(...p.map((q) => q.y)),
    },
    uAxis: { x: p[1].x - p[0].x, y: p[1].y - p[0].y },
    vAxis: { x: p[3].x - p[0].x, y: p[3].y - p[0].y },
  }
}

/** Degrees the printed image is turned on screen, counter-clockwise as the
 *  reader sees it: the angle of image-x away from screen-right. 0 = upright. */
const imageTurnDeg = (uAxis) => (-Math.atan2(uAxis.y, uAxis.x) * 180) / Math.PI

const POSES = [
  { name: 'rest', lift: camLift(), drive: null },
  { name: 'mid', lift: STOP_LIFT / 2, drive: slideFromLift(STOP_LIFT / 2) },
  { name: 'raised', lift: STOP_LIFT, drive: slideFromLift(STOP_LIFT) },
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: VIEW.w, height: VIEW.h }, deviceScaleFactor: 3 })

for (const pose of POSES) {
  const quad = deckQuad(pose.lift)
  const { box, uAxis, vAxis } = uvScreenAxes(quad)
  const pad = 18
  const clip = {
    x: Math.max(0, box.x0 - pad),
    y: Math.max(0, box.y0 - pad),
    width: Math.min(VIEW.w, box.x1 + pad) - Math.max(0, box.x0 - pad),
    height: Math.min(VIEW.h, box.y1 + pad) - Math.max(0, box.y0 - pad),
  }
  const url =
    `http://localhost:${PORT}/labs/storybook?sbpose=${SPREAD}&sbidle=1` +
    (pose.drive === null ? '' : `&sbdrive=ch5-raise-stall:${pose.drive.toFixed(6)}`)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas', { timeout: 30000 })
  await page.mouse.move(1400, 120)
  await page.waitForTimeout(4500)
  await page.screenshot({ path: path.join(OUT, `n2-deck-${pose.name}-${TAG}.png`), clip })
  await page.screenshot({ path: path.join(OUT, `n2-frame-${pose.name}-${TAG}.png`) })
  console.log(
    `${pose.name.padEnd(7)} lift=${((pose.lift * 180) / Math.PI).toFixed(2)}deg ` +
      `box=[${box.x0.toFixed(1)},${box.y0.toFixed(1)} .. ${box.x1.toFixed(1)},${box.y1.toFixed(1)}] ` +
      `u->(${uAxis.x.toFixed(1)},${uAxis.y.toFixed(1)}) v->(${vAxis.x.toFixed(1)},${vAxis.y.toFixed(1)}) ` +
      `turn=${imageTurnDeg(uAxis).toFixed(1)}deg CCW`
  )
}

await browser.close()
