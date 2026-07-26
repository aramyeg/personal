// e3s7-nave-contrast.mjs — s7 Treasury nave: does the PAINT read at the pinned
// camera, or is it flat teal with faint grid?
//
// The round-3 eye-test called the ranks "flat teal office slabs" and the
// coin-shelf strata "invisible at distance". That is a measurable claim, so
// this bench measures it instead of arguing about it. Two rules:
//
//   1. Every sample box is DERIVED FROM THE PAINTER'S OWN CONSTANTS
//      (NAVE_RANKS / NAVE_APSE, imported from generate-art.mjs). A box typed
//      by hand measures the typist.
//   2. Every number is read at SCREEN resolution — each rank face is baked,
//      then downscaled to the pixel width it actually projects to in a 1600px
//      frame at the pinned camera (same camera as e3s7-nave-sightline.mjs,
//      crop 1.2). Contrast that only survives at 1:1 atlas resolution is
//      contrast the reader never sees.
//
// Metrics per rank (luminance 0..255):
//   friezeVsWall  the coin-shelf band's mean value minus the wall below it.
//                 Near zero = the strata are painted at wall value = invisible.
//   friezePop     p95 - p50 inside the frieze box: how far the gilt stands off
//                 its own background. This is the "do the shelves read" number.
//   wallPop       p90 - p10 across the wall box: the wall's value modulation.
//                 A flat slab scores ~0; cut stone scores.
//   rimVsFace     the arch rim's mean value minus the face just outboard of it.
//
// Gates are floors, not targets — they encode "a reader sees this", not "the
// painter tried". Run: node e3s7-nave-contrast.mjs

import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

// .superpowers/ is gitignored, so this file is shared across every worktree
// while the painter it measures is not: resolve generate-art.mjs from the
// working tree the bench was launched in (override with SB_ROOT).
const ROOT = process.env.SB_ROOT ?? process.cwd()
const { PIECES, bakePieceTexture, NAVE_RANKS, NAVE_APSE, naveArchPath, pageFY } = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'storybook', 'generate-art.mjs')).href
)

// ---------------------------------------------------------------- camera ----
// Pinned reading camera, verbatim from e3s7-nave-sightline.mjs.
const CAM = { x: 0, y: 1.85, z: 3.05 }
const LOOK = { x: 0, y: 0.38, z: 0.05 }
const FOV_V = (34 * Math.PI) / 180
const ASPECT = 16 / 9
const FRAME_W = 1600
const CROP = 1.2

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const norm = (v) => {
  const l = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const F = norm(sub(LOOK, CAM))
const R = norm(cross(F, { x: 0, y: 1, z: 0 }))
const tanH = Math.tan(FOV_V / 2) * ASPECT
const sxOf = (p) => {
  const v = sub(p, CAM)
  return dot(v, R) / dot(v, F) / tanH
}

/** The pixel width a rank's face spans on screen: its two base corners
 *  projected, scaled by the frame and the 1.2 crop. This is the resolution the
 *  paint is actually resolved at, and every measurement below runs there. */
function screenWidthPx(halfW, apexZ) {
  const l = sxOf({ x: -halfW, y: 0, z: apexZ })
  const r = sxOf({ x: halfW, y: 0, z: apexZ })
  return (Math.abs(r - l) / 2) * FRAME_W * CROP
}

// content.ts rank geometry (halfw, apexZ) — the projection inputs.
const RANK_GEOM = {
  'ch6-nave-a': { halfW: 0.95, apexZ: -0.52 },
  'ch6-nave-b': { halfW: 0.76, apexZ: -0.3 },
  'ch6-nave-c': { halfW: 0.58, apexZ: -0.08 },
  'ch6-nave-d': { halfW: 0.39, apexZ: 0.157 },
}

// ---------------------------------------------------------------- sampling --
/** Rasterize a mask SVG at the measurement size; white = sampled. */
async function maskOf(body, W, H) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#000"/>${body}</svg>`
  const { data } = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer({ resolveWithObject: true })
  return data
}

/** Luminance stats over the pixels a mask selects, skipping anything the die
 *  cut away (alpha < 200) so an aperture never counts as "dark wall". */
function stats(rgba, mask, n) {
  const vals = []
  for (let i = 0; i < n; i++) {
    if (mask[i] < 128) continue
    const o = i * 4
    if (rgba[o + 3] < 200) continue
    vals.push(0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2])
  }
  if (!vals.length) return null
  vals.sort((a, b) => a - b)
  const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))]
  return {
    n: vals.length,
    mean: vals.reduce((s, v) => s + v, 0) / vals.length,
    p10: q(0.1),
    p50: q(0.5),
    p90: q(0.9),
    p95: q(0.95),
  }
}

const rect = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>`

// ------------------------------------------------------------------ gates ---
const results = []
const gate = (ok, name, detail) => {
  results.push({ ok, name, detail })
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}\n`)
}

async function measureRank(id, dir) {
  const cfg = NAVE_RANKS[id]
  const geom = RANK_GEOM[id]
  const piece = PIECES.find((p) => p.id === id)
  const W = Math.round(screenWidthPx(geom.halfW, geom.apexZ))
  const H = Math.round((W * piece.h) / piece.w)
  const { data: rgba } = await sharp(path.join(dir, `${id}.webp`))
    .resize(W, H, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const n = W * H

  // The frieze box IS naveShelfFrieze's own box, in screen pixels.
  const yTop = H * (1 - cfg.mold[0]) + H * 0.015
  const yBot = H * cfg.topBand
  const pad = cfg.apHw * W + Math.max(6 * (W / piece.w), W * 0.035)
  const wings = [
    [W * 0.014, W / 2 - pad],
    [W / 2 + pad, W * 0.986],
  ]
  const friezeMask = await maskOf(
    wings.map(([a, b]) => rect(a, yTop, b - a, yBot - yTop)).join(''),
    W,
    H
  )
  // The wall reference: the SAME wing columns, below the frieze — so the
  // comparison is band-vs-wall on one sheet, not sheet-vs-sheet.
  const wy0 = yBot + (yBot - yTop) * 0.25
  const wallMask = await maskOf(
    wings.map(([a, b]) => rect(a, wy0, b - a, H * 0.94 - wy0)).join(''),
    W,
    H
  )
  // Rim vs face: the arch die line stroked at the painter's own rim width,
  // against an annulus just outboard of it.
  const rw = Math.max(6, Math.min(W, H) * 0.05)
  const arch = naveArchPath(W, H, cfg.apHw, cfg.apApex)
  const stroke = (sw) => `<path d="${arch}" fill="none" stroke="#fff" stroke-width="${sw}"/>`
  const rimMask = await maskOf(stroke(rw), W, H)
  const faceMask = await maskOf(
    `${stroke(rw * 6)}<path d="${arch}" fill="none" stroke="#000" stroke-width="${rw * 3.2}"/>`,
    W,
    H
  )

  const frieze = stats(rgba, friezeMask, n)
  const wall = stats(rgba, wallMask, n)
  const rim = stats(rgba, rimMask, n)
  const face = stats(rgba, faceMask, n)
  return { id, W, H, frieze, wall, rim, face }
}

async function measureApse(dir) {
  const id = 'ch6-nave-a'
  const geom = RANK_GEOM[id]
  const piece = PIECES.find((p) => p.id === id)
  const W = Math.round(screenWidthPx(geom.halfW, geom.apexZ))
  const H = Math.round((W * piece.h) / piece.w)
  const { data: rgba } = await sharp(path.join(dir, `${id}.webp`))
    .resize(W, H, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const n = W * H
  const yWing = H * (1 - NAVE_APSE.crownFrac)
  const wy = H * NAVE_APSE.roseCy
  const wr = W * NAVE_APSE.roseRw
  // The fan window's hot core (pixels the dome clip cut away drop out on
  // alpha, so this reads the lit scallops only), the crown band the glow has to
  // spill onto (the 0.187-world band the sightline bench says floats above rank
  // B), and the dark wall well outboard of the dome that the spill must NOT
  // have flattened.
  const rose = stats(
    rgba,
    await maskOf(rect(W / 2 - wr * 0.42, wy - wr * 0.55, wr * 0.84, wr * 0.5), W, H),
    n
  )
  const crown = stats(
    rgba,
    await maskOf(rect(W * 0.24, yWing - H * 0.07, W * 0.52, H * 0.12), W, H),
    n
  )
  const outer = stats(rgba, await maskOf(rect(W * 0.02, H * 0.62, W * 0.2, H * 0.3), W, H), n)
  return { id, W, H, rose, crown, outer }
}

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'e3s7-contrast-'))
  try {
    const ids = ['ch6-nave-a', 'ch6-nave-b', 'ch6-nave-c', 'ch6-nave-d', 'page-7']
    for (const id of ids) await bakePieceTexture(PIECES.find((p) => p.id === id), dir)

    process.stdout.write('== A. rank faces at screen resolution (frame 1600, crop 1.2) ==\n')
    for (const id of ['ch6-nave-d', 'ch6-nave-c', 'ch6-nave-b']) {
      const m = await measureRank(id, dir)
      const friezeVsWall = m.frieze.mean - m.wall.mean
      const friezePop = m.frieze.p95 - m.frieze.p50
      const wallPop = m.wall.p90 - m.wall.p10
      const rimVsFace = m.rim.mean - m.face.mean
      process.stdout.write(
        `      ${id} projects ${m.W}x${m.H}px  frieze mean ${m.frieze.mean.toFixed(1)}  wall mean ${m.wall.mean.toFixed(1)}\n`
      )
      gate(friezePop >= 40, `${id} frieze pop (p95-p50)`, `${friezePop.toFixed(1)} >= 40`)
      gate(Math.abs(friezeVsWall) >= 10, `${id} frieze vs wall`, `${friezeVsWall.toFixed(1)} (|.| >= 10)`)
      gate(wallPop >= 18, `${id} wall value modulation (p90-p10)`, `${wallPop.toFixed(1)} >= 18`)
      gate(rimVsFace >= 30, `${id} gilt rim vs face`, `${rimVsFace.toFixed(1)} >= 30`)
    }

    process.stdout.write('== B. apse: the rose and its spill onto rank A crown ==\n')
    const a = await measureApse(dir)
    process.stdout.write(`      ch6-nave-a projects ${a.W}x${a.H}px\n`)
    gate(a.rose.mean >= 150, 'rose window core value', `${a.rose.mean.toFixed(1)} >= 150`)
    gate(a.crown.mean - a.outer.mean >= 20, 'glow spills onto crown band', `crown ${a.crown.mean.toFixed(1)} - outer wall ${a.outer.mean.toFixed(1)} = ${(a.crown.mean - a.outer.mean).toFixed(1)} >= 20`)
    gate(a.outer.mean <= 70, 'outer apse wall stays dark (spill is local)', `${a.outer.mean.toFixed(1)} <= 70`)

    process.stdout.write('== C. page-7 print: the pooled floor light IS the vista ==\n')
    {
      const piece = PIECES.find((p) => p.id === 'page-7')
      const W = 1024
      const H = Math.round((W * piece.h) / piece.w)
      const { data: rgba } = await sharp(path.join(dir, 'page-7.webp'))
        .resize(W, H, { fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const n = W * H
      // The pool's on-axis station, straight off the painter's own mapping.
      const py = H * pageFY(-0.185)
      const pool = stats(rgba, await maskOf(`<ellipse cx="${W / 2}" cy="${py}" rx="${W * 0.06}" ry="${H * 0.05}" fill="#fff"/>`, W, H), n)
      const floor = stats(rgba, await maskOf(rect(W * 0.06, py - H * 0.15, W * 0.14, H * 0.3), W, H), n)
      gate(pool.mean - floor.mean >= 60, 'pooled light vs unlit floor', `pool ${pool.mean.toFixed(1)} - floor ${floor.mean.toFixed(1)} = ${(pool.mean - floor.mean).toFixed(1)} >= 60`)
    }

    const failed = results.filter((r) => !r.ok)
    process.stdout.write(failed.length ? `\n${failed.length} GATE(S) FAILED\n` : '\nALL GATES PASS\n')
    process.exitCode = failed.length ? 1 : 0
  } finally {
    // sharp can still hold a decode handle on Windows; a stranded temp dir is
    // not a bench failure.
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
