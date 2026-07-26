/**
 * e3s4r4-board.mjs — an OFFLINE board capture for the raven city.
 *
 * The lane may not start the dev server or drive a browser, and a geometry
 * bench can tell you a piece is legal without telling you whether the picture
 * works. So this rasterizes the real poses with the real baked atlases, through
 * the same pinned composition camera the scene benches project with: every new
 * piece's quads, sampled from its own webp with its own uv sub-rect (the
 * trapezoid mapping), over a blocked-in keep silhouette for scale.
 *
 * It is an approximation of the render, not the render — no lighting, no page
 * board, no other layers — but it is enough to judge the three things the user
 * asked about: is it BIGGER, is the mirror dead, and does it sweep.
 *
 *   node .superpowers/sdd/bench/e3s4r4-board.mjs
 */

import { createRequire } from 'node:module'
import { REST, panelQuads, nodeSpans, project, VW, VH, TOWER } from './e3s4r4-tower.mjs'
import { LINE, CABLE, linePoint } from './e3s4r4-cable.mjs'
import { TERRACE } from './e3s4r4-city.mjs'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const path = require('node:path')

const ART = path.join(process.cwd(), 'public', 'labs', 'storybook', 'art')
const OUT = path.join(process.cwd(), '.superpowers', 'sdd', 'bench', 'out', 'r4-board-s4.png')

const W = VW
const H = VH
const buf = new Uint8ClampedArray(W * H * 4)
const depth = new Float32Array(W * H).fill(Infinity)
for (let i = 0; i < W * H; i++) {
  buf[i * 4] = 11
  buf[i * 4 + 1] = 13
  buf[i * 4 + 2] = 18
  buf[i * 4 + 3] = 255
}

/** Inverse-bilinear rasterizer: for each covered pixel, solve (s, t) inside the
 *  projected quad and sample the atlas at the matching uv. Painter's algorithm
 *  by quad depth — enough for a composition read. */
function drawQuad(pts, uv, tex, tint) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x0 = Math.max(0, Math.floor(Math.min(...xs)))
  const x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)))
  const y0 = Math.max(0, Math.floor(Math.min(...ys)))
  const y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)))
  const z = pts.reduce((a, p) => a + p.z, 0) / 4
  const tri = (a, b, c, px, py) => {
    const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
    if (Math.abs(d) < 1e-9) return null
    const l1 = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / d
    const l2 = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / d
    const l3 = 1 - l1 - l2
    return l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6 ? [l1, l2, l3] : null
  }
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      // two triangles: 0-1-2 and 0-2-3
      let bc = tri(pts[0], pts[1], pts[2], px + 0.5, py + 0.5)
      let idx = [0, 1, 2]
      if (!bc) {
        bc = tri(pts[0], pts[2], pts[3], px + 0.5, py + 0.5)
        idx = [0, 2, 3]
      }
      if (!bc) continue
      const o = py * W + px
      if (z > depth[o]) continue
      let u = 0
      let v = 0
      for (let k = 0; k < 3; k++) {
        u += bc[k] * uv[idx[k]][0]
        v += bc[k] * uv[idx[k]][1]
      }
      let r
      let g
      let b
      let a
      if (tex) {
        const tx = Math.min(tex.w - 1, Math.max(0, Math.round(u * (tex.w - 1))))
        const ty = Math.min(tex.h - 1, Math.max(0, Math.round((1 - v) * (tex.h - 1))))
        const t = (ty * tex.w + tx) * 4
        r = tex.data[t]
        g = tex.data[t + 1]
        b = tex.data[t + 2]
        a = tex.data[t + 3] / 255
      } else {
        r = tint[0]
        g = tint[1]
        b = tint[2]
        a = 1
      }
      if (a < 0.1) continue
      buf[o * 4] = buf[o * 4] * (1 - a) + r * a
      buf[o * 4 + 1] = buf[o * 4 + 1] * (1 - a) + g * a
      buf[o * 4 + 2] = buf[o * 4 + 2] * (1 - a) + b * a
      depth[o] = z
    }
  }
}

const loadTex = async (id) => {
  const img = sharp(path.join(ART, `${id}.webp`)).ensureAlpha()
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  return { data, w: info.width, h: info.height }
}

function chainDraws(geom) {
  const t = geom.side === 'left' ? REST.thetaL : REST.thetaR
  const quads = panelQuads(geom, t, REST.beta)
  const spans = nodeSpans(geom)
  const rNear = Math.min(...spans.map(([r]) => r))
  const ext = Math.max(...spans.map(([r, w]) => r + w)) - rNear
  const total = geom.stages.reduce((a, s) => a + s.h, 0)
  let below = 0
  return quads.map((q, k) => {
    const v0 = below / total
    below += geom.stages[k].h
    const v1 = below / total
    const uOf = (j) => [(spans[j][0] - rNear) / ext, (spans[j][0] + spans[j][1] - rNear) / ext]
    const [ua0, ua1] = uOf(k)
    const [ub0, ub1] = uOf(k + 1)
    return { pts: q.map(project), uv: [[ua0, v0], [ua1, v0], [ub1, v1], [ub0, v1]] }
  })
}

const run = async () => {
  // The keep, blocked in from its shipped dimensions purely so the new pieces
  // have something to be measured against. Flat grey on purpose: this capture
  // is about SCALE and SWEEP, and a painted keep would argue for itself.
  const h2 = REST.beta / 2
  const sh = Math.sin(h2)
  const tiers = [
    { a: 0.4, y0: 0, y1: 0.1799, z: 0.34 },
    { a: 0.34, y0: 0.1799, y1: 0.3648, z: 0.28 },
    { a: 0.27, y0: 0.3648, y1: 0.5648, z: 0.2 },
  ]
  for (const t of tiers) {
    drawQuad(
      [
        [-t.a * sh, t.y0, t.z], [t.a * sh, t.y0, t.z], [t.a * sh, t.y1, t.z], [-t.a * sh, t.y1, t.z],
      ].map(project),
      [[0, 0], [1, 0], [1, 1], [0, 1]],
      null,
      [86, 92, 104]
    )
  }
  drawQuad(
    [[-0.16, 0.5648, 0], [0.16, 0.5648, 0], [0.03, 1.01, 0], [-0.03, 1.01, 0]].map(project),
    [[0, 0], [1, 0], [1, 1], [0, 1]],
    null,
    [96, 102, 116]
  )

  for (const [id, geom] of [['ch3-dispatch-line', LINE], ['ch3-terrace', TERRACE], ['ch3-tower', TOWER]]) {
    const tex = await loadTex(id)
    for (const d of chainDraws(geom)) drawQuad(d.pts, d.uv, tex)
  }

  // the reader's basket, parked where it starts
  const basket = await loadTex('ch3-dispatch-line-basket')
  const s = 0.06
  const i = Math.min(CABLE.length - 2, Math.floor(s * (CABLE.length - 1)))
  const f = s * (CABLE.length - 1) - i
  const u = CABLE[i][0] + (CABLE[i + 1][0] - CABLE[i][0]) * f
  const v = CABLE[i][1] + (CABLE[i + 1][1] - CABLE[i][1]) * f
  const hu = 0.055
  const hv = 0.05
  drawQuad(
    [
      linePoint(LINE, u - hu, v - 2 * hv, REST.thetaL, REST.thetaR),
      linePoint(LINE, u + hu, v - 2 * hv, REST.thetaL, REST.thetaR),
      linePoint(LINE, u + hu, v, REST.thetaL, REST.thetaR),
      linePoint(LINE, u - hu, v, REST.thetaL, REST.thetaR),
    ].map(project),
    [[0, 0], [1, 0], [1, 1], [0, 1]],
    basket
  )

  await sharp(Buffer.from(buf.buffer), { raw: { width: W, height: H, channels: 4 } }).png().toFile(OUT)
  console.log(`wrote ${OUT}`)
}
run()
