// e3w2s7-legibility.mjs — s7 Wave-2 scene fixes: do the repainted pieces
// actually READ at 1x, or did we only make them better at 1:1 atlas resolution?
//
// A blind first-time reader played spread 7 and filed four findings this bench
// answers with numbers instead of opinions:
//
//   S7-7  "the coin shelves are 4-5px specks... the walls-of-glass-so-the-
//          people-can-see-their-gold payoff only appears if you zoom in,
//          which a reader cannot do."                       -> §A gold at 1x
//   S7-5  "the cream V-shaped plate at the focal point of the fold is
//          completely blank... the prose names the bank AMIO. This reads as
//          an unfinished asset."                            -> §B the nameplate
//   S7-6  "the backdrop wings have no detail whatsoever on
//          their visible face."                             -> §C the wings
//   S7-1  "I dragged the wheel and nothing happened."       -> §D detent deltas
//
// Two house laws are absolute here, and both exist because this project has
// already shipped FALSE findings that broke them:
//
//   LAW 1 — every sample box is DERIVED FROM THE PAINTER'S OWN EXPORTED
//           CONSTANTS (NAVE_RANKS / NAVE_APSE / ASSAY_*, imported from
//           generate-art.mjs). A box typed by hand measures the typist.
//   LAW 2 — every number is read at SCREEN resolution. Each piece is baked,
//           then downscaled to the pixel width it actually projects to in a
//           1600px frame at the pinned reading camera. Contrast that survives
//           only at atlas resolution is contrast the reader never sees.
//
// Gates are FLOORS ("a reader sees this"), not targets ("the painter tried").
// A failure here is a finding for the art lane, not a number to tune.
//
// Run: SB_ROOT="$PWD" node .superpowers/sdd/bench/e3w2s7-legibility.mjs

import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

// .superpowers/ is gitignored, so this file is shared across every worktree
// while the painter it measures is not: resolve generate-art.mjs from the
// working tree the bench was launched in (override with SB_ROOT).
const ROOT = process.env.SB_ROOT ?? process.cwd()
const {
  PIECES,
  bakePieceTexture,
  NAVE_RANKS,
  NAVE_APSE,
  ASSAY_R,
  ASSAY_BAND,
  ASSAY_WINS,
  ASSAY_HALFW,
  ASSAY_VAULTS,
  polX,
  polY,
} = await import(pathToFileURL(path.join(ROOT, 'scripts', 'storybook', 'generate-art.mjs')).href)

// ---------------------------------------------------------------- camera ----
// Pinned reading camera, verbatim from e3s7-nave-sightline.mjs / e3s7-nave-contrast.mjs.
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
const R_AX = norm(cross(F, { x: 0, y: 1, z: 0 }))
// The VERTICAL view axis. §A-§C never needed it — a nave rank stands up off the
// page, so its width is the resolution that matters and its height follows the
// piece's own aspect. §D does need it: a PAGE-FLAT disc is squashed along the
// view-up axis and not at all along the view-right one, and a bench with no
// vertical term literally cannot express that. (See §D's header.)
const U_AX = norm(cross(R_AX, F))
const tanH = Math.tan(FOV_V / 2) * ASPECT
const tanV = Math.tan(FOV_V / 2)
const FRAME_H = FRAME_W / ASPECT
const sxOf = (p) => {
  const v = sub(p, CAM)
  return dot(v, R_AX) / dot(v, F) / tanH
}
/** Full projection to SCREEN PIXELS, origin at frame centre, y down. Pixels are
 *  square: tanV = tanH/ASPECT and FRAME_H = FRAME_W/ASPECT, so both axes carry
 *  the same px-per-radian and a length is comparable between them. */
const projPx = (p) => {
  const v = sub(p, CAM)
  const d = dot(v, F)
  return {
    px: (dot(v, R_AX) / d / tanH) * ((FRAME_W * CROP) / 2),
    py: -(dot(v, U_AX) / d / tanV) * ((FRAME_H * CROP) / 2),
    d,
  }
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

// -------------------------------------------- the counting wheel's screen ----
// THE DISC IS AN ELLIPSE, AND IT IS DERIVED, NOT TYPED.
//
// The dial/card pair does NOT live on a nave rank, so it does not get its size
// from RANK_GEOM. It lies FLAT ON THE RIGHT PAGE, and the reading camera looks
// down that page at a steep angle — so the reader receives an ELLIPSE whose
// short axis is a little over half its long one, not a circle.
//
// What used to be here was `APRON_PX_PER_WORLD = 555` and `WHEEL_WORLD_R = 0.13`,
// two hand-typed numbers producing one SQUARE raster. All three were wrong (see
// §D's header for what that cost). Everything below is now computed from the
// scene's own source-of-truth constants. They are mirrored here rather than
// imported because they live in TypeScript that this .mjs cannot load; each one
// carries its file:line so a drift is a diff, not a mystery. The house law is
// DERIVED BOXES — a box typed by hand measures the typist.

// components/labs/storybook/book/page-geometry.ts:15-16, :174-186
const PAGE_W = 1.15
const SHEET_STACK_T = 0.014
const STACK_PEDESTAL = 0.02
const HINGE_KAPPA = 0
const INTERIOR_SHEETS = 9
/** The spread ch6-assay lives on (content.ts:1878). */
const ASSAY_SPREAD = 7

/** page-geometry.ts:207-220, verbatim. The book never opens dead flat: the
 *  unread sheets stacked under each page hold it up, so the page a piece rides
 *  is TILTED, by an angle that depends on which spread you are on. */
function restAngles(spread) {
  const left = Math.max(0, spread - 1)
  const right = INTERIOR_SHEETS + 1 - Math.max(1, spread)
  const hL = STACK_PEDESTAL + left * SHEET_STACK_T
  const hR = STACK_PEDESTAL + right * SHEET_STACK_T
  const hinge = STACK_PEDESTAL + HINGE_KAPPA * Math.min(left, right) * SHEET_STACK_T
  return { aL: Math.asin((hL - hinge) / PAGE_W), aR: Math.asin((hR - hinge) / PAGE_W) }
}
/** popup-mechanics.ts:1790 — at rest the right page sits at thetaR = aR.
 *  Spread 7 => 2.09deg. Small, but it is real and it is free to carry. */
const THETA_R = restAngles(ASSAY_SPREAD).aR

// content.ts:1656-1663 — the ch6-assay volvelle item.
const HUB_D = 0.47
const HUB_Z = 0.505
const WHEEL_WORLD_R = 0.165
// popup-volvelle.ts:43 VOLVELLE_LIFT = ROTOR_LIFT = rivetLift(1) = 1*PLY + Z_GUARD
// = 1*0.002 + 0.001 (lift-ladder.ts:26,33,36); book.tsx:123 POPUP_Y.
const VOLVELLE_LIFT = 0.003
const POPUP_Y = 0.062

/** popup-volvelle.ts:180-192 volvelleHubFrame, side 'right'. The disc spins in
 *  the orthonormal (e1, e2) plane, so it is a true circle in WORLD space — all
 *  the squashing happens in the projection, which is the point. e1 is the page's
 *  across-the-spine axis and maps to the baked sheet's U; e2 is the page's z and
 *  maps to the sheet's V. */
const E1 = { x: Math.cos(THETA_R), y: Math.sin(THETA_R), z: 0 }
const E2 = { x: 0, y: 0, z: 1 }
const PAGE_N = { x: -Math.sin(THETA_R), y: Math.cos(THETA_R), z: 0 }
const HUB_WORLD = {
  x: HUB_D * E1.x + VOLVELLE_LIFT * PAGE_N.x,
  y: HUB_D * E1.y + VOLVELLE_LIFT * PAGE_N.y + POPUP_Y,
  z: HUB_Z,
}

/** The two SEMI-AXES of the projected disc, as screen-pixel vectors: the images
 *  of R*e1 and R*e2 under the camera. Their LENGTHS are the resolution the art
 *  is delivered at along each of the sheet's own axes, which is exactly what a
 *  legibility bench needs — a rotation or a shear in screen space moves detail
 *  around but does not destroy it, whereas a shortened axis does. */
const _hub = projPx(HUB_WORLD)
const _axis = (e) => {
  const q = projPx({ x: HUB_WORLD.x + e.x * WHEEL_WORLD_R, y: HUB_WORLD.y + e.y * WHEEL_WORLD_R, z: HUB_WORLD.z + e.z * WHEEL_WORLD_R })
  return Math.hypot(q.px - _hub.px, q.py - _hub.py)
}
const DISC_SCREEN_W = 2 * _axis(E1)
const DISC_SCREEN_H = 2 * _axis(E2)
/** ~0.62 at spread 7. THIS is the number the old §D silently assumed was 1.0. */
const FORESHORTEN = DISC_SCREEN_H / DISC_SCREEN_W

/** The dial/card SHEETS are baked 640x640 with the disc spanning 2*ASSAY_R of
 *  the sheet, so each sheet axis is scaled back out from the corresponding disc
 *  axis by the same basis. Resizing the sheet to these keeps R = W*ASSAY_R true
 *  along U and R = H*ASSAY_R along V — the registration contract the pair is an
 *  atlas exemption to preserve — while delivering the ANISOTROPY the reader
 *  actually gets. */
const ASSAY_SHEET_W = Math.round(DISC_SCREEN_W / (2 * ASSAY_R))
const ASSAY_SHEET_H = Math.round(DISC_SCREEN_H / (2 * ASSAY_R))

/** The exact projected outline, for reporting: the true ellipse's screen bbox
 *  and area. The (W x H) resolution model above is separately right for
 *  measuring detail, but it is an axis-aligned box around a SHEARED ellipse, so
 *  it overstates area by a few percent. Both numbers are printed in §D rather
 *  than one being quietly preferred. */
function discOutline() {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  const pts = []
  for (let i = 0; i < 720; i++) {
    const a = (i / 720) * 2 * Math.PI
    const c = Math.cos(a) * WHEEL_WORLD_R
    const s = Math.sin(a) * WHEEL_WORLD_R
    const q = projPx({ x: HUB_WORLD.x + E1.x * c + E2.x * s, y: HUB_WORLD.y + E1.y * c + E2.y * s, z: HUB_WORLD.z + E1.z * c + E2.z * s })
    pts.push(q)
    x0 = Math.min(x0, q.px); x1 = Math.max(x1, q.px); y0 = Math.min(y0, q.py); y1 = Math.max(y1, q.py)
  }
  let a2 = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const n = pts[(i + 1) % pts.length]
    a2 += p.px * n.py - n.px * p.py
  }
  return { w: x1 - x0, h: y1 - y0, area: Math.abs(a2) / 2 }
}

// ---------------------------------------------------------------- sampling --
/** Rasterize a mask SVG at the measurement size; white = sampled. */
async function maskOf(body, W, H) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#000"/>${body}</svg>`
  const { data } = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer({ resolveWithObject: true })
  return data
}

/** Rasterize a mask in the PAINTER'S OWN square basis, then squash it to the
 *  measurement raster by exactly the resize the ART gets. §D needs this: its
 *  raster is anisotropic, so a circle in the painter's basis is an ellipse on
 *  screen, and a mask drawn with circular maths directly at the screen size
 *  would no longer sit over the apertures it is supposed to be sampling.
 *  Deriving both from one square basis makes mis-registration impossible. */
async function maskOfSquashed(body, srcS, W, H) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${srcS}" height="${srcS}" viewBox="0 0 ${srcS} ${srcS}"><rect width="${srcS}" height="${srcS}" fill="#000"/>${body}</svg>`
  const { data } = await sharp(Buffer.from(svg))
    .resize(W, H, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
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

/** Percentile of an already-unsorted numeric array (sorts a copy). */
function pct(arr, p) {
  if (!arr.length) return 0
  const v = [...arr].sort((a, b) => a - b)
  return v[Math.min(v.length - 1, Math.floor(p * v.length))]
}

// ------------------------------------------------------------------ gates ---
const results = []
const gate = (ok, name, detail) => {
  results.push({ ok, name, detail })
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}\n`)
}

/** Load a baked piece already resized to the width it projects to on screen. */
async function screenRaster(dir, id, W, H) {
  const { data } = await sharp(path.join(dir, `${id}.webp`))
    .resize(W, H, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return data
}

function rankScreenSize(id) {
  const geom = RANK_GEOM[id]
  const piece = PIECES.find((p) => p.id === id)
  const W = Math.round(screenWidthPx(geom.halfW, geom.apexZ))
  return { W, H: Math.round((W * piece.h) / piece.w), piece }
}

// ============================================================================
// §A — GOLD AT 1x (S7-7)
// ============================================================================
// The frieze box IS naveShelfFrieze's own box: same yTop/yBot off cfg.mold and
// cfg.topBand, same wing columns off cfg.apHw. Nothing here is eyeballed.
//
// goldFrac answers "is there any gold in the band at all". goldRun answers the
// finding: the reader did not say the gold was absent, he said it was SPECKS.
// A speck is a run of 1-2 screen pixels. Bar gold that reads as an object needs
// a horizontal run you can see the ENDS of — 3px is the floor at which a shape
// stops being a stipple dot. The old coin discs scored ~1.

/** Gold-ish in the treasury palette: NAVE_C.gold #d4a13c (r-b=152),
 *  gilt #f0cd7a (118), giltHi #fdeec2 (59). Teal wall and midnight both fail
 *  r>140; frost (#eef4f6) fails r-b>50. */
const isGold = (r, g, b) => r > 140 && r - b > 50

/** Median/p90 horizontal run length of gold-ish pixels, measured only inside
 *  the mask (a run is cut both by a non-gold pixel and by leaving the mask, so
 *  a bay edge can never inflate a run). Returned in SCREEN px. */
function goldRuns(rgba, mask, W, H) {
  const runs = []
  let goldN = 0
  let maskN = 0
  for (let y = 0; y < H; y++) {
    let run = 0
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const o = i * 4
      const inMask = mask[i] >= 128 && rgba[o + 3] >= 200
      if (inMask) maskN++
      const g = inMask && isGold(rgba[o], rgba[o + 1], rgba[o + 2])
      if (g) {
        goldN++
        run++
      } else if (run) {
        runs.push(run)
        run = 0
      }
    }
    if (run) runs.push(run)
  }
  return { runs, goldFrac: maskN ? goldN / maskN : 0, maskN }
}

async function sectionA(dir) {
  process.stdout.write('== A. S7-7 coin-shelf gold at screen resolution (frame 1600, crop 1.2) ==\n')
  for (const id of ['ch6-nave-b', 'ch6-nave-c', 'ch6-nave-d']) {
    const cfg = NAVE_RANKS[id]
    const { W, H, piece } = rankScreenSize(id)
    const rgba = await screenRaster(dir, id, W, H)

    // naveShelfFrieze's own box, in screen pixels. `pad`'s 6px floor is a
    // SOURCE-pixel floor in the painter, so it is scaled by W/piece.w here.
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
    const { runs, goldFrac, maskN } = goldRuns(rgba, friezeMask, W, H)
    const p50 = pct(runs, 0.5)
    const p90 = pct(runs, 0.9)
    process.stdout.write(
      `      ${id} projects ${W}x${H}px  frieze band ${(yBot - yTop).toFixed(1)}px tall  ` +
        `${maskN}px sampled  ${runs.length} gold runs (p50 ${p50} / p90 ${p90})\n`
    )
    // Ungated, but read it: the frieze holds TWO populations of gold — the
    // vertical gilt MULLIONS between bays (a run one mullion wide on every row
    // they cross, so they are numerous and short) and the INGOTS + shelf
    // keylines (few rows, long runs). A p50 that sits near the mullion width is
    // a median carried by structure, not by the hoard the finding is about, and
    // it will flip the moment the bay count changes. The quartile spread is
    // where you see which population owns the median.
    process.stdout.write(
      `        run-length quartiles  p25 ${pct(runs, 0.25)}  p50 ${p50}  p75 ${pct(runs, 0.75)}  ` +
        `p90 ${p90}  max ${runs.length ? Math.max(...runs) : 0}\n`
    )
    gate(goldFrac >= 0.06, `${id} goldFrac in frieze`, `${goldFrac.toFixed(4)} >= 0.0600`)
    gate(p50 >= 3.0, `${id} goldRun p50 (screen px)`, `${p50.toFixed(1)} >= 3.0  [p90 ${p90.toFixed(1)}]`)
  }
}

// ============================================================================
// §B — THE NAMEPLATE (S7-5)
// ============================================================================
// The keystone plate box is NAVE_RANKS['ch6-nave-d'].kb / .khw, read exactly as
// the painter's trapezoid: half-width khw*w*0.85 at the top edge, *1.2 at the
// bottom, centred on w/2.
//
// Two things have to be true for a name to exist here. First the plate has to
// be big enough to hold letters at all — under ~8 screen px of height there is
// no cap height any stroke can survive, so the finding could not be fixed by
// painting, only by re-sizing the plate. Second, and this is the actual "is it
// blank" gate: a plain gilt plate has almost no internal value spread, while
// dark engraved letters on gilt have a huge one. p90-p10 of luminance inside
// the plate is that spread, and 60 is well above anything a gradient or a
// bevel can fake.

async function sectionB(dir) {
  process.stdout.write('== B. S7-5 the AMIO keystone nameplate ==\n')
  const id = 'ch6-nave-d'
  const cfg = NAVE_RANKS[id]
  const { W, H } = rankScreenSize(id)
  const rgba = await screenRaster(dir, id, W, H)

  const cx = W / 2
  const y0 = H * (1 - cfg.kb[1]) // top edge (kb[1] is the HIGHER world fraction)
  const y1 = H * (1 - cfg.kb[0]) // bottom edge
  const kw = cfg.khw * W
  const plateH = y1 - y0
  const trap = (top, bot) =>
    `<path d="M ${cx - kw * bot} ${y1} L ${cx + kw * bot} ${y1} L ${cx + kw * top} ${y0} L ${cx - kw * top} ${y0} Z" fill="#fff"/>`

  const plateMask = await maskOf(trap(0.85, 1.2), W, H)
  const plate = stats(rgba, plateMask, W * H)

  // Diagnostic only, never gated: the painter outlines the plate with a 2px
  // midnight stroke, and on a ~50x20 screen box that border is >10% of the
  // pixels — i.e. it could carry p10 down on its own and hand us a PASS for a
  // blank plate. The inset trapezoid (pulled in by the stroke width, derived,
  // not eyeballed) reads the plate's INTERIOR. If the two numbers diverge
  // hard, the outer one is the border talking.
  const insetPx = 2 * (W / PIECES.find((p) => p.id === id).w) + 1
  const iy0 = y0 + insetPx
  const iy1 = y1 - insetPx
  // half-widths at the inset edges: the trapezoid's own linear taper (0.85 at
  // y0 -> 1.2 at y1), then pulled in by the stroke width on each side.
  const hwAt = (y) => kw * (0.85 + ((1.2 - 0.85) * (y - y0)) / plateH)
  const ihTop = Math.max(1, hwAt(iy0) - insetPx)
  const ihBot = Math.max(1, hwAt(iy1) - insetPx)
  const innerMask = await maskOf(
    `<path d="M ${cx - ihBot} ${iy1} L ${cx + ihBot} ${iy1} L ${cx + ihTop} ${iy0} L ${cx - ihTop} ${iy0} Z" fill="#fff"/>`,
    W,
    H
  )
  const inner = stats(rgba, innerMask, W * H)

  const inkPop = plate.p90 - plate.p10
  process.stdout.write(
    `      ${id} projects ${W}x${H}px  plate ${(kw * 2.4).toFixed(1)}x${plateH.toFixed(1)}px  ` +
      `${plate.n}px sampled  mean ${plate.mean.toFixed(1)}  p10 ${plate.p10.toFixed(1)} p90 ${plate.p90.toFixed(1)}\n`
  )
  process.stdout.write(
    `      (diagnostic, ungated) interior-only inkPop ${(inner ? inner.p90 - inner.p10 : 0).toFixed(1)} over ${inner ? inner.n : 0}px — ` +
      `if this collapses while the gated number holds, the plate's own outline is the "ink"\n`
  )
  gate(plateH >= 8, `${id} nameplate height (screen px)`, `${plateH.toFixed(1)} >= 8.0`)
  gate(inkPop >= 60, `${id} nameplate inkPop (p90-p10)`, `${inkPop.toFixed(1)} >= 60`)
}

// ============================================================================
// §C — THE BACKDROP WINGS (S7-6)
// ============================================================================
// The crown-wing box comes straight off NAVE_APSE: the wings are the flat
// shoulders left and right of the scalloped dome, below the world 0.46-of-0.62
// crown line, and they are the only part of rank A the reader sees past the
// nearer ranks. The blind finding was "no detail whatsoever on their visible
// face".
//
// wingPop is the honest test of that: a flat slab scores ~0 no matter how it is
// tinted. But detail must not be BOUGHT WITH BRIGHTNESS — the existing apse
// bench (e3s7-nave-contrast.mjs §B) gates "outer apse wall stays dark (spill is
// local) <= 70", and a wing that earns its p90-p10 by going pale would silently
// break that gate's intent. So wingMean carries the same ceiling: the wing has
// to get its detail from value STRUCTURE inside a dark range.

async function sectionC(dir) {
  process.stdout.write('== C. S7-6 apse crown wings: detail without brightness ==\n')
  const id = 'ch6-nave-a'
  const { W, H } = rankScreenSize(id)
  const rgba = await screenRaster(dir, id, W, H)

  const yWing = H * (1 - NAVE_APSE.crownFrac)
  const domeHw = W * NAVE_APSE.domeHwFrac
  const wings = [
    [W * 0.02, W / 2 - domeHw - W * 0.02],
    [W / 2 + domeHw + W * 0.02, W * 0.98],
  ]
  const y0 = yWing + H * 0.055
  const y1 = yWing + H * 0.46
  const wingMask = await maskOf(wings.map(([a, b]) => rect(a, y0, b - a, y1 - y0)).join(''), W, H)
  const wing = stats(rgba, wingMask, W * H)

  const wingPop = wing.p90 - wing.p10
  process.stdout.write(
    `      ${id} projects ${W}x${H}px  wing box y ${y0.toFixed(1)}..${y1.toFixed(1)}  ` +
      `${wing.n}px sampled  p10 ${wing.p10.toFixed(1)} p50 ${wing.p50.toFixed(1)} p90 ${wing.p90.toFixed(1)}\n`
  )
  gate(wingPop >= 22, 'apse wing detail (p90-p10)', `${wingPop.toFixed(1)} >= 22`)
  gate(wing.mean <= 70, 'apse wing stays dark (recession, not brightness)', `${wing.mean.toFixed(1)} <= 70`)
}

// ============================================================================
// §D — THE COUNTING WHEEL DETENT (S7-1)
// ============================================================================
// This is the s4 lane's hard-won regression, re-run on s7's wheel. A dial whose
// sector art is rotationally symmetric at its own detent step renders PIXEL-
// IDENTICALLY after a drag: the mechanism is alive, the code is correct, the
// state changes — and a blind reader reports "I dragged the wheel and nothing
// happened", because nothing did happen on screen. The only defence is a
// measured per-step delta through the apertures the reader is actually looking
// through.
//
// Method: composite the card OVER the dial rotated by d*45deg about its centre
// (transparent background, re-cropped to the sheet), downscale the COMPOSITE to
// the wheel's true 1x projection, and sample ONLY the three window apertures —
// masked with annular sectors built from ASSAY_WINS / ASSAY_HALFW / ASSAY_BAND
// / ASSAY_R exactly as assayCard punches its holes.
//
// Gate 1 (adjacent-pair channel delta >= 12) is the anti-symmetry gate: it must
// hold for EVERY one of the 8 wraparound pairs, because a reader who lands on
// the one dead step learns the wheel is dead.
// Gate 2 (the 8 window luminances must not all sit within 6) is an independent
// check that ASSAY_VAULTS' third axis — the field tint — is doing work, so the
// deltas are not carried by the gold devices alone.
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS SECTION ONCE HAD, NAMED SO IT CANNOT COME BACK:
// A BENCH THAT MEASURES A BIGGER PICTURE THAN THE READER GETS.
//
// §D used to rasterise the wheel as a SQUARE disc off a typed
// `APRON_PX_PER_WORLD = 555`. But the wheel lies PAGE-FLAT and the reading
// camera looks down the page at a steep angle, so the reader's disc is an
// ELLIPSE about 0.62 as tall as it is wide. The bench was reading roughly 1.6x
// the area the reader receives, and it passed while a blind re-reader turned
// the wheel two full revolutions and reported "I could not find one thing in
// the scene it changes" — the change was arriving at ~12x10 px per vitrine
// (S7R2-1b; content.ts:1620-1624 records it). BOTH NUMBERS WERE TRUE. One was
// misleading. That is the THIRD time this project has shipped a false finding
// of exactly this shape, which is why LAW 2 at the top of this file exists and
// why every extent below is derived from the scene's own constants.
//
// The rule that kills it: a legibility bench may never assume a piece faces the
// camera square-on. If the piece rides the page, project it — the page is
// tilted (restAngles) and the camera is pitched, and both belong in the number.
// Two independent checks that this section is still honest: the printed
// foreshortening ratio must be well under 1.0, and the sheet raster must be
// visibly NON-SQUARE. If either drifts back toward 1.0, someone has re-flattened
// the disc.
// ---------------------------------------------------------------------------

/** annularSectorPath's geometry, rebuilt from the exported polar helpers so the
 *  mask traces the painter's aperture rather than an approximation of it. */
function sectorPath(cx, cy, psi, halfW, rIn, rOut, steps = 16) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const a = psi - halfW + (2 * halfW * i) / steps
    pts.push([polX(cx, a, rOut), polY(cy, a, rOut)])
  }
  for (let i = 0; i <= steps; i++) {
    const a = psi + halfW - (2 * halfW * i) / steps
    pts.push([polX(cx, a, rIn), polY(cy, a, rIn)])
  }
  return 'M ' + pts.map((p) => `${p[0]} ${p[1]}`).join(' L ') + ' Z'
}

/** Mean absolute per-channel difference over the masked, opaque-in-both pixels.
 *  Per-channel (not luminance) on purpose: a gold device swapping for a mint
 *  one can be luminance-neutral and still be an obvious change to an eye. */
function chanDiff(a, b, mask, n) {
  let sum = 0
  let cnt = 0
  for (let i = 0; i < n; i++) {
    if (mask[i] < 128) continue
    const o = i * 4
    if (a[o + 3] < 200 || b[o + 3] < 200) continue
    sum += (Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2])) / 3
    cnt++
  }
  return { mad: cnt ? sum / cnt : 0, n: cnt }
}

/** The dial, rotated d*45deg about the sheet centre and re-cropped to 640x640,
 *  optionally with the faceplate composited over it — i.e. exactly what the
 *  reader's eye receives at detent d — then resized to the wheel's 1x screen
 *  projection. `cardPng` may be null to read the BARE dial: that is the
 *  decomposition that separates "the wheel's sector art is symmetric" (a dial
 *  problem) from "the faceplate is not letting the change through" (a card
 *  problem). Identifying a broken piece by prominence rather than by layer is
 *  how this project has produced false findings before. */
async function detentRaster(dialPng, cardPng, srcW, srcH, deg) {
  const rot = await sharp(dialPng)
    .ensureAlpha()
    .rotate(deg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer({ resolveWithObject: true })
  const left = Math.max(0, Math.round((rot.info.width - srcW) / 2))
  const top = Math.max(0, Math.round((rot.info.height - srcH) / 2))
  const centred = await sharp(rot.data).extract({ left, top, width: srcW, height: srcH }).png().toBuffer()
  // Two passes on purpose: sharp's pipeline runs resize BEFORE composite, so a
  // single chain would shrink the dial first and then refuse the full-size
  // faceplate. Composite at bake resolution, THEN drop to the screen size —
  // which is also the physically honest order (the GPU composites in world
  // space and the frame is rasterized once).
  const stacked = cardPng
    ? await sharp(centred).composite([{ input: cardPng, left: 0, top: 0 }]).png().toBuffer()
    : centred
  // ANISOTROPIC on purpose — this is the foreshortening. The rotation above
  // happens at bake resolution in the SHEET's square basis (which is where the
  // dial physically rotates: it spins in the page plane, not in screen space),
  // and only then is the result squashed to the ellipse the camera delivers.
  // Squashing first and rotating after would be a different, wrong mechanism.
  const { data } = await sharp(stacked)
    .resize(ASSAY_SHEET_W, ASSAY_SHEET_H, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return data
}

async function sectionD(dir) {
  process.stdout.write('== D. S7-1 counting-wheel detent: does a step CHANGE the windows ==\n')
  const dialPiece = PIECES.find((p) => p.id === 'ch6-assay-dial')
  const cardPiece = PIECES.find((p) => p.id === 'ch6-assay-card')
  const srcW = dialPiece.w
  const srcH = dialPiece.h
  const dialPng = await sharp(path.join(dir, 'ch6-assay-dial.webp')).ensureAlpha().png().toBuffer()
  const cardPng = await sharp(path.join(dir, 'ch6-assay-card.webp'))
    .ensureAlpha()
    .resize(srcW, srcH, { fit: 'fill' })
    .png()
    .toBuffer()

  // The aperture mask: drawn in the painter's OWN square basis with the
  // painter's own polar helpers, then squashed by exactly the resize the art
  // gets. Registration is therefore structural, not asserted.
  const cx = srcW / 2
  const cy = srcH / 2
  const Rq = srcW * ASSAY_R
  const bandIn = Rq * ASSAY_BAND[0]
  const bandOut = Rq * ASSAY_BAND[1]
  const winMask = await maskOfSquashed(
    ASSAY_WINS.map(
      (psi) => `<path d="${sectorPath(cx, cy, psi, ASSAY_HALFW, bandIn, bandOut)}" fill="#fff"/>`
    ).join(''),
    srcW,
    ASSAY_SHEET_W,
    ASSAY_SHEET_H
  )
  const n = ASSAY_SHEET_W * ASSAY_SHEET_H

  const outline = discOutline()
  process.stdout.write(
    `      page-flat projection: spread ${ASSAY_SPREAD} right-page tilt ${((THETA_R * 180) / Math.PI).toFixed(2)}deg, ` +
      `hub (${HUB_WORLD.x.toFixed(3)}, ${HUB_WORLD.y.toFixed(3)}, ${HUB_WORLD.z.toFixed(3)}), r=${WHEEL_WORLD_R}\n` +
      `      => disc ${DISC_SCREEN_W.toFixed(1)} x ${DISC_SCREEN_H.toFixed(1)} px ` +
      `(FORESHORTENING ${FORESHORTEN.toFixed(3)}; 1.000 would mean the disc faces the camera, which it does not)\n` +
      `      => sheet raster ${ASSAY_SHEET_W}x${ASSAY_SHEET_H} (baked ${srcW}x${srcH}), ` +
      `derived px/world ${(DISC_SCREEN_W / 2 / WHEEL_WORLD_R).toFixed(1)}\n` +
      `      exact projected outline: bbox ${outline.w.toFixed(1)} x ${outline.h.toFixed(1)} px, area ${outline.area.toFixed(0)}px^2\n`
  )

  const frames = []
  for (let d = 0; d < 8; d++) frames.push(await detentRaster(dialPng, cardPng, srcW, srcH, d * 45))

  // ---- HOW BIG IS THE CHANGE, in the reader's pixels? ----------------------
  // The gates below are all INTENSITY (is the change strong enough). S7R2-1b was
  // not an intensity failure — it was a SIZE failure: the vitrines framed ~12x10
  // px each, so a perfectly strong delta arrived too small to notice. That is
  // the quantity the old square raster could not express, and it is reported
  // here in the reader's own pixels so the next lane can see it directly.
  // Deliberately UNGATED: the figure that failed (~120px^2 per vitrine) is
  // evidence, but no one has established where the floor sits, and inventing a
  // bar to sit just above a known-bad number would be exactly the retuning this
  // file forbids. Read it, and if it collapses, that is a finding.
  let winPx = 0
  for (let i = 0; i < n; i++) if (winMask[i] >= 128) winPx++
  process.stdout.write(
    `      DELIVERED APERTURE: ${winPx}px^2 across ${ASSAY_WINS.length} vitrines = ` +
      `${Math.round(winPx / ASSAY_WINS.length)}px^2 each (S7R2-1b failed the reader at ~120px^2 each)\n`
  )

  const lums = frames.map((f) => stats(f, winMask, n))
  process.stdout.write('      window-mask mean luminance per detent:\n')
  for (let d = 0; d < 8; d++) {
    process.stdout.write(
      `        detent ${d} (${ASSAY_VAULTS[d].numeral.padEnd(4)} ${ASSAY_VAULTS[d].device.padEnd(8)} field ${ASSAY_VAULTS[d].field.padEnd(8)})  ` +
        `mean ${lums[d].mean.toFixed(1)}  over ${lums[d].n}px\n`
    )
  }

  process.stdout.write('      adjacent-pair mean |dRGB| through the three vitrines:\n')
  let minMad = Infinity
  for (let d = 0; d < 8; d++) {
    const e = (d + 1) % 8
    const { mad, n: cnt } = chanDiff(frames[d], frames[e], winMask, n)
    minMad = Math.min(minMad, mad)
    process.stdout.write(`        ${d}->${e}  ${mad.toFixed(2)}  (${cnt}px)\n`)
  }
  gate(minMad >= 12, 'every detent step changes the windows (min adjacent |dRGB|)', `${minMad.toFixed(2)} >= 12`)

  // ---- decomposition (ungated): WHICH layer owns the number above? ----------
  // Same rotation, same mask, faceplate removed. If the bare dial clears the
  // floor comfortably while the composite does not, the sector art is doing its
  // job and the faceplate is eating the signal — and the aperture alpha says
  // how. assayCard's vitrines are documented as "true alpha-0 holes"; if the
  // mean alpha inside them is not ~0, they are not holes, and whatever is
  // painted in them is a constant layer that attenuates every detent delta by
  // roughly (1 - meanAlpha/255).
  const bare = []
  for (let d = 0; d < 8; d++) bare.push(await detentRaster(dialPng, null, srcW, srcH, d * 45))
  let minBare = Infinity
  for (let d = 0; d < 8; d++) minBare = Math.min(minBare, chanDiff(bare[d], bare[(d + 1) % 8], winMask, n).mad)

  const cardRaw = await sharp(cardPng)
    .resize(ASSAY_SHEET_W, ASSAY_SHEET_H, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer()
  let aSum = 0
  let aN = 0
  for (let i = 0; i < n; i++) {
    if (winMask[i] < 128) continue
    aSum += cardRaw[i * 4 + 3]
    aN++
  }
  const meanA = aN ? aSum / aN : 0
  process.stdout.write(
    `      (diagnostic, ungated) bare dial, faceplate removed: min adjacent |dRGB| ${minBare.toFixed(2)}\n` +
      `      (diagnostic, ungated) faceplate mean ALPHA inside its own vitrine mask: ${meanA.toFixed(1)}/255 ` +
      `(${((meanA / 255) * 100).toFixed(0)}% covered; a true aperture reads ~0)\n`
  )

  const means = lums.map((l) => l.mean)
  const spread = Math.max(...means) - Math.min(...means)
  gate(
    spread > 6,
    'field-tint axis does work (spread of the 8 window luminances)',
    `${spread.toFixed(2)} > 6  [${Math.min(...means).toFixed(1)}..${Math.max(...means).toFixed(1)}]`
  )
}

// ------------------------------------------------------------------- main ---
async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'e3w2s7-legibility-'))
  try {
    const ids = ['ch6-nave-a', 'ch6-nave-b', 'ch6-nave-c', 'ch6-nave-d', 'ch6-assay-dial', 'ch6-assay-card']
    for (const id of ids) await bakePieceTexture(PIECES.find((p) => p.id === id), dir)

    await sectionA(dir)
    await sectionB(dir)
    await sectionC(dir)
    await sectionD(dir)

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
