/**
 * e4-ground-edge.mjs — DOES THE DISSOLVE RACK'S REST BOUNDARY VANISH?
 *
 * The judge's finding was that the courtyard rack "reads as a flat blue
 * swimming-pool rectangle dropped on the page". The fix is registration: the
 * page print and the rack's rest face draw ONE paving from one generator, so at
 * rest there is nothing at the rack's outline for the eye to catch on. That is
 * a measurable claim, and eyeballing a value step on a dark texture is exactly
 * the sort of thing an eye gets wrong.
 *
 * THE RULER, AND WHY IT IS THIS ONE. Two cheaper rulers were tried and both
 * lied. Projecting the shipped `dissolveBaseQuad` through the pinned reading
 * camera lands ~15 px off, because book-scene.tsx's ParallaxRig is holding the
 * whole book at a live pointer-driven tilt that the pinned camera knows nothing
 * about — and 15 px is enough to sample the rack's own interior on BOTH sides
 * of three of its four edges and report a beautiful, meaningless 0.2 luma step.
 * Diffing two tau frames to find the moving pixels catches the arrival rank too,
 * which rides the same channel. So the footprint below is CALIBRATED: a control
 * bake (`SB_RACK_MASK=1 node scripts/storybook/generate-art.mjs`) prints face A
 * as flat magenta, one capture gives an exact footprint, and its four corners
 * are these. The rack's screen position is paint-independent, so this only needs
 * redoing if content.ts moves the piece or the capture rig changes.
 *
 * WHAT IT REPORTS
 *   per edge — median luma and warmth (R-B) in a strip just INSIDE and just
 *   OUTSIDE the boundary, and the step between them. Median, not mean, so a
 *   wing or the inn standing over part of an edge cannot swing the result.
 *   then — the DELIVERED A->B payoff: mean luma and warmth over the whole
 *   footprint at tau 0 vs tau 180. The rest state has to hide while the flip
 *   stays unmistakable; those two numbers are the trade being made.
 *
 * usage: node scripts/storybook/bench/e4-ground-edge.mjs <restPng> [tau0Png tau180Png]
 */
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = process.env.SB_ROOT ?? process.cwd()
const require_ = createRequire(import.meta.url)
const sharp = require_(path.join(ROOT, 'node_modules/sharp'))

/** The calibrated footprint, 1600x900 capture, pointer parked at (1500, 40).
 *  Order: [d0/z0 spine-aft, d0/z1 spine-fore, d1/z1 outer-fore, d1/z0 outer-aft]. */
const QUAD = [
  [881, 621],
  [890, 719],
  [1234, 691],
  [1191, 595],
]
const EDGES = [
  ['spine (d0)', 0, 1],
  ['fore  (z1)', 1, 2],
  ['outer (d1)', 2, 3],
  ['aft   (z0)', 3, 0],
]

/** Bilinear map of the unit square onto QUAD. Over a 350x100 px quad the
 *  difference from the true homography is under a pixel, and every sample here
 *  is taken within ~12 px of an edge. */
const uv = (u, v) => {
  const a = QUAD[0]
  const b = QUAD[3]
  const c = QUAD[1]
  const d = QUAD[2]
  // u runs d0 -> d1 (a->b on the aft edge, c->d on the fore edge), v runs z0 -> z1
  const top = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
  const bot = [c[0] + (d[0] - c[0]) * u, c[1] + (d[1] - c[1]) * u]
  return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v]
}

async function loadPix(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return {
    at(x, y) {
      const ix = Math.round(x)
      const iy = Math.round(y)
      if (ix < 0 || iy < 0 || ix >= info.width || iy >= info.height) return null
      const o = (iy * info.width + ix) * info.channels
      return [data[o], data[o + 1], data[o + 2]]
    },
  }
}
const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
const warmth = (c) => c[0] - c[2]
const med = (xs) => {
  const a = [...xs].sort((p, q) => p - q)
  return a.length ? a[(a.length / 2) | 0] : NaN
}
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1)

const restFile = process.argv[2]
const pix = await loadPix(restFile)
console.log(`\n=== RACK REST BOUNDARY — ${path.basename(restFile)} ===`)
const OFF = 5 // px clear of the edge, so neither strip straddles it
const DEPTH = 8 // px of strip
for (const [name, i, j] of EDGES) {
  const a = QUAD[i]
  const b = QUAD[j]
  let nx = -(b[1] - a[1])
  let ny = b[0] - a[0]
  const l = Math.hypot(nx, ny) || 1
  nx /= l
  ny /= l
  const cx = mean(QUAD.map((q) => q[0]))
  const cy = mean(QUAD.map((q) => q[1]))
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  if ((cx - mx) * nx + (cy - my) * ny < 0) {
    nx = -nx
    ny = -ny
  }
  const inL = []
  const outL = []
  const inW = []
  const outW = []
  for (let k = 5; k <= 95; k++) {
    const t = k / 100
    const px = a[0] + (b[0] - a[0]) * t
    const py = a[1] + (b[1] - a[1]) * t
    for (let dp = 0; dp < DEPTH; dp++) {
      const ci = pix.at(px + nx * (OFF + dp), py + ny * (OFF + dp))
      const co = pix.at(px - nx * (OFF + dp), py - ny * (OFF + dp))
      if (ci) {
        inL.push(luma(ci))
        inW.push(warmth(ci))
      }
      if (co) {
        outL.push(luma(co))
        outW.push(warmth(co))
      }
    }
  }
  console.log(
    `  ${name}   luma in ${med(inL).toFixed(1)} / out ${med(outL).toFixed(1)}  step ${Math.abs(med(inL) - med(outL)).toFixed(1)}` +
      `      warmth in ${med(inW).toFixed(1)} / out ${med(outW).toFixed(1)}  step ${Math.abs(med(inW) - med(outW)).toFixed(1)}`
  )
}

async function areaStats(file) {
  const p = await loadPix(file)
  const L = []
  const W = []
  for (let iu = 2; iu <= 98; iu++) {
    for (let iv = 4; iv <= 96; iv++) {
      const [x, y] = uv(iu / 100, iv / 100)
      const c = p.at(x, y)
      if (!c) continue
      L.push(luma(c))
      W.push(warmth(c))
    }
  }
  return { luma: mean(L), warmth: mean(W), n: L.length }
}
if (process.argv[3] && process.argv[4]) {
  const A = await areaStats(process.argv[3])
  const B = await areaStats(process.argv[4])
  console.log(`\n=== DELIVERED A->B over the rack footprint (${A.n} samples) ===`)
  console.log(`  A (tau 0)    luma ${A.luma.toFixed(1)}   warmth ${A.warmth.toFixed(1)}`)
  console.log(`  B (tau 180)  luma ${B.luma.toFixed(1)}   warmth ${B.warmth.toFixed(1)}`)
  console.log(
    `  delta        luma +${(B.luma - A.luma).toFixed(1)} (x${(B.luma / A.luma).toFixed(2)})   warmth +${(B.warmth - A.warmth).toFixed(1)}`
  )
}
