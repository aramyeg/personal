#!/usr/bin/env node
/**
 * CODE-GENERATED PAPER ART (E2 procedural-art lane). A SINGLE pure art module
 * per piece emits BOTH
 *   (i) an OUTLINE path normalized to the unit square [0,1]^2  ->  the shaped
 *       cut mesh (popup-skyline-layer.tsx triangulates it, bilerps the solver
 *       corners across its verts), and
 *   (ii) a PAINT (an SVG string) drawn in the SAME coordinate space  ->  the
 *        webp texture.
 * so "geometry IS the silhouette" (charter G3) is an identity: the same
 * roofline points are the mesh outline and the paint's cut edge.
 *
 * Deterministic: a seeded mulberry32 PRNG, no Math.random, so re-running is
 * byte-stable (golden-safe). Rasterized by the already-installed sharp
 * (librsvg/resvg) — no new dependency. Grain is a separate seeded raster pass
 * because librsvg's feTurbulence support is unreliable.
 *
 * This module SUPERSEDES the prepare-art FAN_OUT mapping for the six citadel
 * skyline slots (ch3-skyline-{l,r}-mound{0,1,2}): it bakes six UNIQUE strips at
 * each slot's true mesh aspect straight into public/labs/storybook/art/ as
 * <id>.webp + <id>.outline.json, and (re)writes manifest.json (art ids) and
 * outlines.json (ids that carry a shaped-outline sidecar). Run AFTER prepare-art
 * (order-independent for these ids now that their FAN_OUT entries are gone).
 *
 * Run: node scripts/storybook/generate-art.mjs
 * Also imported by the bench (.superpowers/sdd/bench/procart-*) as the single
 * source of truth for the art module — main() is guarded so importing is safe.
 */

import { writeFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(SCRIPT_DIR, '..', '..')
const ART_DIR = path.join(REPO_ROOT, 'public', 'labs', 'storybook', 'art')

// mulberry32 — the exact PRNG the runtime placeholder path already uses
// (procedural/placeholder-art.ts), so an art module authored here drops into
// the browser unchanged.
function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Fairy-tale citadel palette, keyed to the reference (art-src/ch3-citadel-a.png)
// and the charter PALETTE LAW: warm parchment #E7D5A8 family for lit stone,
// deep walnut #3B2A1A for ALL linework + shadow planes, gold #C9A227 for window
// glow + finials, cool slate blue-gray for ROOFS ONLY (never on stone).
const CITADEL = {
  paperLit: '#efe0b6', // sunlit parchment stone
  paper: '#e3cd98', // #E7D5A8 mid
  paperMid: '#cbb078',
  paperDim: '#a98a5c', // back-plane / recessed stone
  paperDeep: '#7f6544',
  slateLit: '#818c99',
  slate: '#626e7d',
  slateDim: '#4a5563',
  slateDeep: '#39424e',
  brick: '#8a4a34', // rust brick chimney
  brickLit: '#a05c40',
  brickDim: '#5e2f20',
  ink: '#3b2a1a', // walnut — coursing, frames, shadow planes
  gold: '#c9a227',
  goldLit: '#f3d980',
  ember: '#e7b24d',
  smoke: '#f3ecda', // cut-paper smoke curl (near-opaque paper white)
  accent: '#c26a33', // chapter-3 pennant (warm banner)
  accent2: '#6f5a7d', // chapter-3 secondary pennant
  rim: '#f6eed7', // die-cut raw-paper rim
}

const lerp = (a, b, t) => a + (b - a) * t
const fx = (n) => n.toFixed(1)

/** Drops coincident and collinear vertices from a closed outline ring — a
 *  cleaner mesh contour (fewer verts) and no zero-area slivers when earcut
 *  triangulates it. Keeps every real corner. */
function simplifyOutline(pts, eps = 1e-5) {
  const dedup = []
  for (const p of pts) {
    const q = dedup[dedup.length - 1]
    if (q && Math.abs(q[0] - p[0]) < eps && Math.abs(q[1] - p[1]) < eps) continue
    dedup.push(p)
  }
  const N = dedup.length
  const res = []
  for (let i = 0; i < N; i++) {
    const a = dedup[(i - 1 + N) % N]
    const b = dedup[i]
    const c = dedup[(i + 1) % N]
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
    if (Math.abs(cross) > eps) res.push(b) // keep only genuine corners
  }
  return res
}

/**
 * THE ROOKERY ART MODULE (E3 s4, "The Rookery of Four Billion Ravens"). Pure:
 * (seed, dims, variant) -> { outline, svg }. `outline` is the closed silhouette
 * in normalized [0,1]^2 with v UP from the hinge (v=0 = base glued to page) to
 * the crest (v=1) — exactly the ROW_UVS convention popup-skyline.ts maps. That
 * same array triangulates to the shaped mesh AND drives the SVG cut path, so
 * "geometry IS the silhouette" (charter G3) stays an identity.
 *
 * The s4 scene pack retires the fairy-tale citadel these six strips used to
 * carry and replaces it with Berlin's central ROOKERY: a radial amphitheater of
 * slate DOVECOTE FACADES, every front pierced by regimented ranks of arched
 * raven portals with a scattered fifth glowing amber from within (the only warm
 * light in a slate + parchment world), deep-cut crenellation rooflines, and
 * along every parapet a rank of perched ravens cut as ONE LINKED CHAIN in the
 * silhouette — order, not swarm (swarm is s3's grammar). Every cut edge carries
 * a PALE core-edge rim (T1/T-EDGE).
 *
 * Three variants share the generator: `flank` (the six re-dressed skyline
 * rows), `ringMid` (the ring's downstage arms — two storeys, biggest portals,
 * most lit) and `ringFront` (the low gate wall, lantern posts, road shadow).
 */

// Scene-pack palette: slate #5a6470, ink #2b2d33, parchment #e7d5a8, amber
// #d98e3f, plus the raw-paper core #f6eedb every cut edge is rimmed with.
const ROOK = {
  slate: '#5a6470',
  slateLit: '#79828f',
  slateDim: '#48515c',
  slateDeep: '#363e48',
  ink: '#2b2d33',
  parch: '#e7d5a8',
  parchLit: '#f3e7c6',
  parchDim: '#c2ab7c',
  amber: '#d98e3f',
  amberLit: '#f2bd71',
  amberDeep: '#7d4a1a',
  rim: '#f6eedb',
}

/** The PALE core-edge rim every rookery cut edge carries: a band of raw paper
 *  core along the silhouette with NO ink centreline — a dark hairline read
 *  BACKWARDS on these pieces (a cut edge is the paper's pale core, never a
 *  drawn line), and this is the fix. */
function rookRim(d, wCore = 5) {
  return (
    `<path d="${d}" fill="none" stroke="${ROOK.rim}" stroke-width="${fx(wCore)}" opacity="0.97" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${ROOK.parchLit}" stroke-width="${fx(wCore * 0.42)}" opacity="0.6" stroke-linejoin="round" stroke-linecap="round"/>`
  )
}

/** One perched raven's TOP PROFILE over its own cell — beak spike, crown, nape
 *  dip, back hump, tail slope — in cell fractions (u) and bird-height fractions
 *  (v), nominally facing u-DECREASING (spine-ward). */
const RAVEN_PROFILE = [
  [0.0, 0.55], [0.05, 0.66], [0.1, 0.8], [0.14, 0.92],
  [0.07, 0.88], [0.13, 0.96], [0.2, 1.0], [0.28, 0.95], [0.34, 0.86],
  [0.48, 0.92], [0.68, 0.88], [0.84, 0.76], [0.94, 0.63], [1.0, 0.55],
]

/** How wide one bird's cell is, as a multiple of its height — the rank is sized
 *  in PIXELS (not in u) so every strip aspect gets birds of the same build.
 *  The chain links at v = 0.30 of the bird height: a SHALLOW notch between
 *  neighbours, which is what reads as one rank rather than a row of peaks. */
const RAVEN_CELL = 0.6

/** A RANK of perched ravens cut as ONE LINKED CHAIN: consecutive birds share
 *  their low tail/foot point, so the contour never returns to the parapet
 *  between them (T-LINKED-RANK — order, not swarm, at zero piece cost). */
function ravenChainTop(x0, x1, v0, bh, count, facing) {
  const cw = (x1 - x0) / count
  const prof = facing === 'left' ? RAVEN_PROFILE : RAVEN_PROFILE.map(([du, dv]) => [1 - du, dv]).reverse()
  const pts = []
  for (let k = 0; k < count; k++) {
    const a = x0 + k * cw
    for (const [du, dv] of prof) {
      const u = a + du * cw
      const v = v0 + dv * bh
      const last = pts[pts.length - 1]
      if (last && Math.abs(last[0] - u) < 1e-9 && Math.abs(last[1] - v) < 1e-9) continue
      pts.push([u, v])
    }
  }
  return pts
}

/** Deep-cut crenellation across [x0,x1] as outline points (u ascending), the
 *  merlon tops at topV over gaps cut back to baseV. */
function crenelTop(x0, x1, baseV, topV, teeth) {
  const out = []
  const tw = (x1 - x0) / (teeth * 2 - 1)
  for (let t = 0; t < teeth; t++) {
    const xa = x0 + t * 2 * tw
    out.push([xa, topV], [xa + tw, topV], [xa + tw, baseV])
    if (t < teeth - 1) out.push([xa + 2 * tw, baseV], [xa + 2 * tw, topV])
  }
  return out
}

/** A lantern post standing proud of a parapet: a T silhouette (thin post, wider
 *  lantern head, finial cap). u is NOT monotonic across the head's overhang —
 *  still a simple polygon, so earcut is happy and the bilerp stays in-quad. */
function lanternTop(a, lw, v0, lh) {
  return [
    [a + 0.36 * lw, v0], [a + 0.36 * lw, v0 + 0.5 * lh], [a + 0.12 * lw, v0 + 0.56 * lh],
    [a + 0.2 * lw, v0 + 0.82 * lh], [a + 0.5 * lw, v0 + lh], [a + 0.8 * lw, v0 + 0.82 * lh],
    [a + 0.88 * lw, v0 + 0.56 * lh], [a + 0.64 * lw, v0 + 0.5 * lh], [a + 0.64 * lw, v0],
  ]
}

/** ONE arched raven portal in px. `lit` fills it with the warm interior glow
 *  (the amber traffic light) plus a perch bar, a bird in the opening and a
 *  lamplight pool spilling down the wall; unlit it is an ink recess. Both carry
 *  a parchment hood mould and sill so the rank reads as cut stone. */
function ravenPortal(bx, by, bw, bh, lit, boost = 0) {
  const sy = by - bh * 0.5
  const apex = by - bh
  const cy = lerp(sy, apex, 0.55)
  const arch =
    `M ${fx(bx)} ${fx(by)} L ${fx(bx)} ${fx(sy)} Q ${fx(bx)} ${fx(cy)} ${fx(bx + bw / 2)} ${fx(apex)} ` +
    `Q ${fx(bx + bw)} ${fx(cy)} ${fx(bx + bw)} ${fx(sy)} L ${fx(bx + bw)} ${fx(by)} Z`
  let s = ''
  // `boost` is the ring-MID / gatehouse strength (eye-review r1): a soft HALO
  // bleeding onto the surrounding slate plus a brighter core, so "multiplicity
  // as light" survives at the pinned camera. Rear rows pass boost 0 and stay dim.
  if (lit && boost > 0) {
    s += `<ellipse cx="${fx(bx + bw / 2)}" cy="${fx(by - bh * 0.3)}" rx="${fx(bw * (1.3 + boost * 0.55))}" ry="${fx(bh * (0.78 + boost * 0.3))}" fill="url(#rookHalo)" opacity="${(0.26 + boost * 0.14).toFixed(2)}"/>`
  }
  if (lit) s += `<ellipse cx="${fx(bx + bw / 2)}" cy="${fx(by + bh * 0.3)}" rx="${fx(bw * (1.3 + boost * 0.4))}" ry="${fx(bh * (0.4 + boost * 0.14))}" fill="${ROOK.amber}" opacity="${(0.22 + boost * 0.1).toFixed(2)}"/>`
  s += `<path d="${arch}" fill="${lit ? 'url(#rookGlow)' : ROOK.ink}"/>`
  if (lit && boost > 0) {
    s += `<ellipse cx="${fx(bx + bw / 2)}" cy="${fx(lerp(sy, apex, 0.35))}" rx="${fx(bw * 0.3)}" ry="${fx(bh * 0.18)}" fill="${ROOK.amberLit}" opacity="${(0.42 + boost * 0.16).toFixed(2)}"/>`
  }
  if (lit) {
    const rw = bw * 0.34
    s += `<rect x="${fx(bx + bw * 0.1)}" y="${fx(by - bh * 0.28)}" width="${fx(bw * 0.8)}" height="${fx(Math.max(1.2, bh * 0.045))}" fill="${ROOK.ink}" opacity="0.7"/>`
    s += `<ellipse cx="${fx(bx + bw * 0.52)}" cy="${fx(by - bh * 0.4)}" rx="${fx(rw * 0.55)}" ry="${fx(bh * 0.13)}" fill="${ROOK.ink}" opacity="0.88"/>`
    s += `<circle cx="${fx(bx + bw * 0.52 - rw * 0.5)}" cy="${fx(by - bh * 0.53)}" r="${fx(Math.max(1.4, bw * 0.085))}" fill="${ROOK.ink}" opacity="0.88"/>`
  }
  s += `<path d="${arch}" fill="none" stroke="${ROOK.ink}" stroke-width="1.5" opacity="0.6"/>`
  s += `<path d="M ${fx(bx)} ${fx(sy)} Q ${fx(bx)} ${fx(cy)} ${fx(bx + bw / 2)} ${fx(apex)} Q ${fx(bx + bw)} ${fx(cy)} ${fx(bx + bw)} ${fx(sy)}" fill="none" stroke="${ROOK.parchDim}" stroke-width="${fx(Math.max(1.6, bw * 0.1))}" opacity="0.62"/>`
  s += `<rect x="${fx(bx - bw * 0.14)}" y="${fx(by)}" width="${fx(bw * 1.28)}" height="${fx(Math.max(2, bh * 0.075))}" fill="${ROOK.parch}" opacity="0.9"/>`
  return s
}

/** The shared dovecote-facade generator. Returns the silhouette contour (v-up,
 *  hinge->crest) and the SVG paint drawn in the SAME space. `mirror` reflects
 *  the whole composition about u=0.5; the raven ranks are authored with the
 *  opposite facing when mirrored so EVERY rank still faces the spine (u=0 is
 *  the spine end on BOTH pages — popup-skyline solves d0 = F outward). */
function dovecoteFacade({ seed, w, h, variant = 'flank', blocks = 5, mirror = false }) {
  const X = (u) => u * w
  const Y = (v) => (1 - v) * h
  const CAP_V = 0.975 // the outline MUST stay inside the unit square (shaped-mesh contract)
  // `litP` / `litClump` = the chance a portal is lit, and the chance it is lit
  // GIVEN its neighbour was (which is what keeps the traffic clumped rather
  // than a regular pattern). Eye-review r1 graded these: the rear flank rows
  // stay at the pack's 1-in-5, the ring-MID arms rise to ~1-in-3 and carry a
  // glow `boost`, so the ring reads as one sweeping form brightening forward.
  const PROF = {
    flank: { lo: 0.46, hi: 0.63, tower: 0.79, rows: 1, pMin: 4, pMax: 6, th: 0.13, rh: 0.18, teeth: 11, litP: 0.2, litClump: 0.44, boost: 0 },
    ringMid: { lo: 0.54, hi: 0.7, tower: 0.8, rows: 2, pMin: 5, pMax: 6, th: 0.11, rh: 0.17, teeth: 13, litP: 0.3, litClump: 0.56, boost: 0.85 },
    ringFront: { lo: 0.32, hi: 0.42, tower: 0.5, rows: 1, pMin: 4, pMax: 5, th: 0.1, rh: 0.24, teeth: 15, litP: 0.2, litClump: 0.44, boost: 0.4 },
  }[variant]
  const facing = mirror ? 'right' : 'left'
  /** Birds per zone, sized in pixels so every strip aspect gets the same build. */
  const rankCount = (z0, z1, rh) => Math.max(2, Math.round(((z1 - z0) * w) / Math.max(6, rh * h * RAVEN_CELL)))
  /** Merlons per zone, likewise pitched in pixels (a narrow block would
   *  otherwise grow a rank of hair-thin spikes at the same tooth COUNT). */
  const teethCount = (z0, z1) => Math.max(2, Math.min(9, Math.round(((z1 - z0) * w) / (PROF.teeth * 2.6))))

  // ---- LAYOUT: a rank of facade blocks, one narrow COTE TOWER among them. ----
  const nb = Math.max(3, Math.round(blocks))
  const rel = []
  for (let i = 0; i < nb; i++) rel.push(0.82 + mulberry32((seed * 31 + i * 719) | 0)() * 0.5)
  const towerIdx = 1 + Math.floor(mulberry32((seed * 97 + 13) | 0)() * (nb - 2))
  rel[towerIdx] *= 0.6
  const tot = rel.reduce((a, b) => a + b, 0)

  const blocksArr = []
  let acc = 0
  for (let i = 0; i < nb; i++) {
    const bw = rel[i] / tot
    const x0 = acc
    const x1 = acc + bw
    acc = x1
    const bseed = (seed * 137 + i * 911) | 0
    const r2 = mulberry32(bseed)
    const isTower = i === towerIdx
    const parapetV = Math.min(CAP_V - 0.02, isTower ? PROF.tower : lerp(PROF.lo, PROF.hi, r2()))
    const head = CAP_V - parapetV
    blocksArr.push({
      i,
      x0,
      x1,
      bseed,
      isTower,
      parapetV,
      th: Math.min(PROF.th, head),
      rh: Math.min(PROF.rh, head),
      ravenFirst: r2() < 0.5,
      rows: isTower ? PROF.rows + 1 : PROF.rows,
      perRow: PROF.pMin + Math.floor(r2() * (PROF.pMax - PROF.pMin + 1)),
      far: !isTower && r2() < 0.34,
    })
  }

  // The gate wall carries two lantern posts (scene pack 4e); nothing else does.
  const lanternIdx = variant === 'ringFront' ? [...new Set([1, nb - 2])].filter((k) => k > 0 && k < nb) : []

  // Per block: an optional lantern post, then a RAVEN-RANK zone and a
  // CRENELLATION zone (order alternates per block) — so every parapet shows
  // both the deep cut and one unbroken chain of birds.
  const layout = blocksArr.map((b) => {
    const lantern = lanternIdx.includes(b.i)
      ? { a: b.x0 + (b.x1 - b.x0) * 0.06, lw: Math.min((b.x1 - b.x0) * 0.42, 0.1), lh: Math.min(0.3, CAP_V - b.parapetV) }
      : null
    const a = lantern ? lantern.a + lantern.lw : b.x0
    const split = a + (b.x1 - a) * 0.55
    const zones = b.ravenFirst
      ? [{ kind: 'raven', z0: a, z1: split }, { kind: 'crenel', z0: split, z1: b.x1 }]
      : [{ kind: 'crenel', z0: a, z1: split }, { kind: 'raven', z0: split, z1: b.x1 }]
    return { b, lantern, zones: zones.filter((z) => z.z1 - z.z0 > 1e-4) }
  })

  // ---- OUTLINE ----
  const top = []
  for (const { b, lantern, zones } of layout) {
    top.push([b.x0, b.parapetV])
    if (lantern) top.push([lantern.a, b.parapetV], ...lanternTop(lantern.a, lantern.lw, b.parapetV, lantern.lh))
    for (const z of zones) {
      if (z.kind === 'crenel') {
        top.push([z.z0, b.parapetV], ...crenelTop(z.z0, z.z1, b.parapetV, b.parapetV + b.th, teethCount(z.z0, z.z1)), [z.z1, b.parapetV])
      } else {
        const n = rankCount(z.z0, z.z1, b.rh)
        top.push([z.z0, b.parapetV], ...ravenChainTop(z.z0, z.z1, b.parapetV, b.rh, n, facing), [z.z1, b.parapetV])
      }
    }
  }
  const raw = [[0, 0], ...top, [1, 0]]
  const outline = simplifyOutline(mirror ? raw.map(([u, v]) => [1 - u, v]).reverse() : raw)

  // ---- PAINT (authored un-mirrored; the mirror is one transform group) ----
  const parts = []
  parts.push(`<rect width="${w}" height="${h}" fill="${ROOK.slateDeep}"/>`)

  for (const { b, lantern, zones } of layout) {
    const r2 = mulberry32(b.bseed ^ 0x51a7)
    const yTop = Y(b.parapetV)
    const bx = X(b.x0)
    const bwPx = X(b.x1 - b.x0)
    let s = `<g>`
    s += `<rect x="${fx(bx)}" y="${fx(yTop)}" width="${fx(bwPx)}" height="${fx(h - yTop)}" fill="${b.far ? ROOK.slateDim : ROOK.slate}"/>`
    if (b.far) s += `<rect x="${fx(bx)}" y="${fx(yTop)}" width="${fx(bwPx)}" height="${fx(h - yTop)}" fill="${ROOK.slateDeep}" opacity="0.32"/>`
    // lit spine-side reveal + shadowed fore-side reveal (cut-card relief)
    s += `<rect x="${fx(bx)}" y="${fx(yTop)}" width="${fx(Math.max(2, w * 0.004))}" height="${fx(h - yTop)}" fill="${ROOK.slateLit}" opacity="0.6"/>`
    s += `<rect x="${fx(bx + bwPx - Math.max(2, w * 0.005))}" y="${fx(yTop)}" width="${fx(Math.max(2, w * 0.005))}" height="${fx(h - yTop)}" fill="${ROOK.ink}" opacity="0.3"/>`
    // ashlar coursing
    const courseH = h * 0.055
    for (let cy = h - courseH * 0.5; cy > yTop; cy -= courseH) {
      s += `<line x1="${fx(bx)}" y1="${fx(cy)}" x2="${fx(bx + bwPx)}" y2="${fx(cy)}" stroke="${ROOK.ink}" stroke-width="1.4" opacity="${(0.18 + r2() * 0.16).toFixed(2)}"/>`
    }
    // parapet wall-walk shade under the crown
    s += `<rect x="${fx(bx)}" y="${fx(yTop)}" width="${fx(bwPx)}" height="${fx(Math.max(3, h * 0.02))}" fill="${ROOK.ink}" opacity="0.24"/>`

    // crown bands: merlon mass above the parapet (the clip carves the teeth) and
    // the raven rank mass (the clip carves the birds).
    for (const z of zones) {
      const zx = X(z.z0)
      const zw = X(z.z1 - z.z0)
      if (z.kind === 'crenel') {
        // merlons drawn one by one on the SAME tooth maths the outline cuts, so
        // each gets a lit cap and a shadowed fore-side reveal (deep-cut relief).
        const teeth = teethCount(z.z0, z.z1)
        const tw = (z.z1 - z.z0) / (teeth * 2 - 1)
        const topY = Y(b.parapetV + b.th)
        const merH = Y(b.parapetV) - topY
        for (let t = 0; t < teeth; t++) {
          const mx = X(z.z0 + t * 2 * tw)
          const mw = X(tw)
          s += `<rect x="${fx(mx)}" y="${fx(topY)}" width="${fx(mw)}" height="${fx(merH)}" fill="${b.far ? ROOK.slateDim : ROOK.slate}"/>`
          s += `<rect x="${fx(mx)}" y="${fx(topY)}" width="${fx(mw)}" height="${fx(Math.max(2, merH * 0.18))}" fill="${ROOK.slateLit}" opacity="0.75"/>`
          s += `<rect x="${fx(mx + mw * 0.72)}" y="${fx(topY)}" width="${fx(mw * 0.28)}" height="${fx(merH)}" fill="${ROOK.ink}" opacity="0.28"/>`
        }
        s += `<rect x="${fx(zx)}" y="${fx(Y(b.parapetV))}" width="${fx(zw)}" height="${fx(Math.max(2, h * 0.014))}" fill="${ROOK.ink}" opacity="0.3"/>`
      } else {
        // the rank's mass; the clip carves it into the linked chain of birds.
        const n = rankCount(z.z0, z.z1, b.rh)
        const perchV = b.parapetV + b.rh * RAVEN_PROFILE[0][1]
        s += `<rect x="${fx(zx)}" y="${fx(Y(perchV))}" width="${fx(zw)}" height="${fx(Y(b.parapetV) - Y(perchV))}" fill="${b.far ? ROOK.slateDim : ROOK.slate}"/>`
        s += `<rect x="${fx(zx)}" y="${fx(Y(perchV))}" width="${fx(zw)}" height="${fx(Math.max(2, h * 0.012))}" fill="${ROOK.slateLit}" opacity="0.7"/>`
        s += `<rect x="${fx(zx)}" y="${fx(Y(b.parapetV + b.rh))}" width="${fx(zw)}" height="${fx(Y(perchV) - Y(b.parapetV + b.rh))}" fill="${ROOK.ink}"/>`
        const cw = (z.z1 - z.z0) / n
        const cwPx = X(cw)
        for (let k = 0; k < n; k++) {
          const hu = facing === 'left' ? 0.17 : 0.83
          const bu = facing === 'left' ? 0.58 : 0.42
          s += `<circle cx="${fx(X(z.z0 + cw * (k + hu)))}" cy="${fx(Y(b.parapetV + b.rh * 0.94))}" r="${fx(Math.max(1.3, b.rh * h * 0.05))}" fill="${ROOK.amberLit}" opacity="0.95"/>`
          s += `<ellipse cx="${fx(X(z.z0 + cw * (k + bu)))}" cy="${fx(Y(b.parapetV + b.rh * 0.82))}" rx="${fx(cwPx * 0.22)}" ry="${fx(b.rh * h * 0.05)}" fill="${ROOK.slateLit}" opacity="0.3"/>`
        }
      }
    }

    // lantern post paint (gate wall only)
    if (lantern) {
      const lx = X(lantern.a)
      const lwPx = X(lantern.lw)
      s += `<rect x="${fx(lx + lwPx * 0.34)}" y="${fx(Y(b.parapetV + lantern.lh * 0.52))}" width="${fx(lwPx * 0.32)}" height="${fx(Y(b.parapetV) - Y(b.parapetV + lantern.lh * 0.52))}" fill="${ROOK.slateDim}"/>`
      s += `<rect x="${fx(lx + lwPx * 0.1)}" y="${fx(Y(b.parapetV + lantern.lh))}" width="${fx(lwPx * 0.8)}" height="${fx(Y(b.parapetV + lantern.lh * 0.5) - Y(b.parapetV + lantern.lh))}" fill="url(#rookGlow)"/>`
      s += `<rect x="${fx(lx + lwPx * 0.1)}" y="${fx(Y(b.parapetV + lantern.lh))}" width="${fx(lwPx * 0.8)}" height="${fx(Y(b.parapetV + lantern.lh * 0.5) - Y(b.parapetV + lantern.lh))}" fill="none" stroke="${ROOK.ink}" stroke-width="1.8" opacity="0.65"/>`
      s += `<line x1="${fx(lx + lwPx * 0.5)}" y1="${fx(Y(b.parapetV + lantern.lh))}" x2="${fx(lx + lwPx * 0.5)}" y2="${fx(Y(b.parapetV + lantern.lh * 0.5))}" stroke="${ROOK.ink}" stroke-width="1.5" opacity="0.5"/>`
      s += `<ellipse cx="${fx(lx + lwPx * 0.5)}" cy="${fx(Y(b.parapetV) + h * 0.02)}" rx="${fx(lwPx * 1.1)}" ry="${fx(h * 0.05)}" fill="${ROOK.amber}" opacity="0.2"/>`
    }

    // ---- PORTAL RANKS: regimented rows, ~1 in 5 lit, scattered as traffic ----
    const rowsAt = b.rows === 1 ? [0.44] : b.rows === 2 ? [0.66, 0.3] : [0.72, 0.48, 0.24]
    const pW = (b.x1 - b.x0) / (b.perRow * 1.85)
    const pH = b.parapetV * (b.rows === 1 ? 0.3 : 0.24)
    const pr = mulberry32(b.bseed ^ 0x2f19)
    let litPrev = false
    for (const rowT of rowsAt) {
      const sillV = b.parapetV * rowT
      // string course the rank stands on
      s += `<rect x="${fx(bx)}" y="${fx(Y(sillV) + Math.max(2, h * 0.012))}" width="${fx(bwPx)}" height="${fx(Math.max(2, h * 0.012))}" fill="${ROOK.parchDim}" opacity="0.55"/>`
      for (let k = 0; k < b.perRow; k++) {
        const t = b.perRow === 1 ? 0.5 : k / (b.perRow - 1)
        const cu = lerp(b.x0 + pW * 0.95, b.x1 - pW * 0.95, t)
        const roll = pr()
        const lit = roll < PROF.litP || (litPrev && roll < PROF.litClump)
        litPrev = lit
        s += ravenPortal(X(cu - pW / 2), Y(sillV), X(pW), pH * h, lit, b.far ? PROF.boost * 0.4 : PROF.boost)
      }
    }
    s += `</g>`
    parts.push(s)
  }

  // the gate wall's ROAD SHADOW: the post-road passing the wall throws a dark
  // slant across its base (the page print carries the road itself).
  if (variant === 'ringFront') {
    const rx = w * 0.6
    parts.push(
      `<path d="M ${fx(rx)} ${fx(h)} L ${fx(rx + w * 0.07)} ${fx(h * 0.74)} L ${fx(rx + w * 0.13)} ${fx(h * 0.74)} L ${fx(rx + w * 0.09)} ${fx(h)} Z" fill="${ROOK.ink}" opacity="0.2"/>`
    )
  }
  // contact shade where the flap meets the page
  parts.push(`<rect x="0" y="${fx(h * 0.94)}" width="${w}" height="${fx(h * 0.06)}" fill="${ROOK.ink}" opacity="0.34"/>`)

  const d = outline.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'
  const body = mirror ? `<g transform="translate(${fx(w)} 0) scale(-1 1)">${parts.join('')}</g>` : parts.join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <clipPath id="cut"><path d="${d}"/></clipPath>
      <radialGradient id="rookGlow" cx="0.5" cy="0.62" r="0.8">
        <stop offset="0" stop-color="${ROOK.amberLit}"/>
        <stop offset="0.5" stop-color="${ROOK.amber}"/>
        <stop offset="1" stop-color="${ROOK.amberDeep}"/>
      </radialGradient>
      <radialGradient id="rookHalo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${ROOK.amberLit}" stop-opacity="0.85"/>
        <stop offset="0.4" stop-color="${ROOK.amber}" stop-opacity="0.44"/>
        <stop offset="1" stop-color="${ROOK.amber}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="rookShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${ROOK.parchLit}" stop-opacity="0.14"/>
        <stop offset="0.45" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="${ROOK.ink}" stop-opacity="0.42"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#cut)">
      ${body}
      <rect width="${w}" height="${h}" fill="url(#rookShade)"/>
    </g>
    ${rookRim(d, 5)}
  </svg>`

  return { outline, svg }
}

/**
 * The skyline-slot art module under its historical name — the procart outline
 * bench imports `citadelStrip` as "the module the six ch3-skyline slots ship",
 * so the name stays a stable seam while the s4 pack changes WHAT it paints
 * (dovecote fronts, not a fairy-tale citadel). `smoke` is accepted and ignored:
 * the rookery has no chimneys.
 */
function citadelStrip({ seed, w, h, towers = 7 }) {
  return dovecoteFacade({ seed, w, h, variant: 'flank', blocks: Math.max(3, Math.round(towers / 1.6)) })
}

// ---- seeded grain pass: a whisper of monochrome tooth, its alpha MASKED by
// the art's own silhouette (per-pixel) so grain never bleeds outside the cut.
// Deterministic (seeded), so it stays golden-safe. ----
function grainOverArt(flatRaw, w, h, seed, amount) {
  const { data } = flatRaw // RGBA raw of the flats
  const rand = mulberry32(seed ^ 0x5bd1e995)
  const g = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3]
    const n = ((rand() * 2 - 1) * amount) | 0
    const v = Math.max(0, Math.min(255, 128 + n))
    g[i * 4] = g[i * 4 + 1] = g[i * 4 + 2] = v
    g[i * 4 + 3] = a > 0 ? 40 : 0 // tooth only inside the silhouette
  }
  return sharp(g, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
}

/** SVG -> flat PNG -> seeded grain masked by the art's own alpha, for a module
 *  that also emits an outline (the shaped-mesh bakes). */
async function bakeShaped({ outline, svg }, seed, w, h, grain = 22) {
  const flat = await sharp(Buffer.from(svg)).png().toBuffer()
  const flatRaw = await sharp(flat).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const grainCut = await grainOverArt(flatRaw, w, h, seed, grain)
  const out = await sharp(flat).composite([{ input: grainCut, blend: 'over' }]).png().toBuffer()
  return { outline, out }
}

async function bake(seed, w, h, smoke, towers = 7 + (seed % 2)) {
  return bakeShaped(citadelStrip({ seed, w, h, towers }), seed, w, h, 22)
}

// ============================================================================
// E2.2 BATCH A — KRAFT-DEBT BURN-DOWN (texture-only piece bakes).
// Paints the placeholder pieces on spreads 1/3/4/5/6/8/9 in the citadel house
// style. Each painter returns a standalone SVG on a TRANSPARENT ground: the
// pop-up materials are alphaTest + DoubleSide, so the paint's OWN ALPHA carves
// the silhouette INSIDE each piece's existing solver quad — no outline sidecar,
// the mesh shape is unchanged (charter: texture-only). House vocabulary:
// parchment stone (#E7D5A8 family), walnut ink linework (#3B2A1A), gold finials
// (#C9A227), slate roofs, a lit left edge, and a raw-paper die-cut rim on every
// cut edge. Deterministic: mulberry32(seed), no Math.random (golden-safe).
// ============================================================================

const INK = CITADEL.ink
const RIM = CITADEL.rim
const GOLD = CITADEL.gold
const GOLD_LIT = CITADEL.goldLit
const GOLD_DIM = '#9a7a1e'
const PARCH = '#efe4c6'
const PARCH_MID = '#dcc596'
const PARCH_DIM = '#c3a86f'
const LEATHER = '#96602f'
const LEATHER_LIT = '#c08544'
const LEATHER_DIM = '#4a2c14'
const SEAL_RED = '#7a2530'
const SEAL_RED_LIT = '#9c3b45'

const rr = (r, a, b) => a + (b - a) * r()

function svgPiece(w, h, inner, defs = '') {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    (defs ? `<defs>${defs}</defs>` : '') +
    inner +
    `</svg>`
  )
}

/** Raw-paper die-cut rim on a silhouette path — the house cut-card edge (thick
 *  pale core + thin ink). Every piece closes with this so it reads as card. */
function rimPath(d, wCore = 5) {
  return (
    `<path d="${d}" fill="none" stroke="${RIM}" stroke-width="${wCore}" opacity="0.95" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.5" stroke-linejoin="round"/>`
  )
}

/** A running dashed stitch line between two points (leather idiom). */
function stitch(x0, y0, x1, y1, color = '#e6c98a') {
  return `<line x1="${fx(x0)}" y1="${fx(y0)}" x2="${fx(x1)}" y2="${fx(y1)}" stroke="${color}" stroke-width="2.2" stroke-dasharray="6 5" opacity="0.85"/>`
}

// ---- THE HERO'S SATCHEL (s8 satchel-bag, vfold w1.0/h0.6). The wide V opens
// TOWARD the reading camera, so we paint the INTERIOR VIEW: a dark leather-lined
// bag whose stitched rim carries buckle straps draped over the edge, with the
// hero's treasures glinting inside the mouth. Fully opaque, high-contrast values
// so the mass reads solid (not a milky sheet). Symmetric about the crease. ----
function leatherSatchel(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const x0 = w * 0.08,
    x1 = w * 0.92
  const rimTop = h * 0.12,
    rimBot = h * 0.3,
    bot = h * 0.965,
    rad = w * 0.07
  const body = `M ${fx(x0)} ${fx(rimTop)} L ${fx(x1)} ${fx(rimTop)} L ${fx(x1)} ${fx(bot - rad)} Q ${fx(x1)} ${fx(bot)} ${fx(x1 - rad)} ${fx(bot)} L ${fx(x0 + rad)} ${fx(bot)} Q ${fx(x0)} ${fx(bot)} ${fx(x0)} ${fx(bot - rad)} Z`
  let s = `<g>`
  // shoulder strap arc behind the bag
  s += `<path d="M ${fx(x0 + w * 0.03)} ${fx(rimTop + 6)} C ${fx(w * 0.16)} ${fx(-h * 0.08)} ${fx(w * 0.84)} ${fx(-h * 0.08)} ${fx(x1 - w * 0.03)} ${fx(rimTop + 6)}" fill="none" stroke="${LEATHER_DIM}" stroke-width="${fx(w * 0.035)}" opacity="0.95"/>`
  // INTERIOR — deep leather, dark at the bottom of the mouth (opaque gradient)
  s += `<path d="${body}" fill="url(#bagInt)"/>`
  // a lit inner-wall sheen on the left half so the cavity reads dimensional
  s += `<path d="M ${fx(x0)} ${fx(rimBot)} L ${fx(cx)} ${fx(rimBot)} L ${fx(cx)} ${fx(bot)} L ${fx(x0 + rad)} ${fx(bot)} Q ${fx(x0)} ${fx(bot)} ${fx(x0)} ${fx(bot - rad)} Z" fill="${LEATHER_LIT}" opacity="0.14"/>`
  // TREASURE glinting inside the mouth — a heap of coins + a goblet + gems
  const heapY = h * 0.78
  s += `<path d="M ${fx(w * 0.18)} ${fx(bot - 6)} Q ${fx(cx)} ${fx(heapY - h * 0.06)} ${fx(w * 0.82)} ${fx(bot - 6)} Z" fill="#8a6a24"/>`
  for (let i = 0; i < 60; i++) {
    const x = rr(r, w * 0.2, w * 0.8),
      y = rr(r, heapY, bot - 8)
    const cr = rr(r, 6, 11)
    s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.7)}" fill="${r() < 0.5 ? GOLD : GOLD_LIT}" stroke="${GOLD_DIM}" stroke-width="1"/>`
  }
  // a goblet standing in the hoard
  s += `<path d="M ${fx(cx - w * 0.05)} ${fx(heapY)} Q ${fx(cx)} ${fx(heapY + h * 0.08)} ${fx(cx + w * 0.05)} ${fx(heapY)} L ${fx(cx + w * 0.03)} ${fx(heapY - h * 0.1)} L ${fx(cx - w * 0.03)} ${fx(heapY - h * 0.1)} Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.5"/>`
  s += `<rect x="${fx(cx - w * 0.05)}" y="${fx(heapY + h * 0.06)}" width="${fx(w * 0.1)}" height="6" rx="3" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.5"/>`
  for (const gx of [0.32, 0.66]) s += `<path d="M ${fx(w * gx)} ${fx(heapY - 4)} l 7 7 l -7 7 l -7 -7 Z" fill="#c04a54" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.4"/>` // ruby gems
  // the folded-over leather RIM across the top, catching the key light
  s += `<rect x="${fx(x0)}" y="${fx(rimTop)}" width="${fx(x1 - x0)}" height="${fx(rimBot - rimTop)}" fill="${LEATHER}"/>`
  s += `<rect x="${fx(x0)}" y="${fx(rimTop)}" width="${fx((x1 - x0) * 0.5)}" height="${fx(rimBot - rimTop)}" fill="${LEATHER_LIT}" opacity="0.3"/>`
  s += `<rect x="${fx(x0)}" y="${fx(rimTop)}" width="${fx(x1 - x0)}" height="5" fill="${LEATHER_LIT}"/>` // lit lip
  s += `<rect x="${fx(x0)}" y="${fx(rimBot - 4)}" width="${fx(x1 - x0)}" height="4" fill="${LEATHER_DIM}"/>` // inner shadow under rim
  // saddle stitching along the rim
  s += `<line x1="${fx(x0 + 10)}" y1="${fx(rimTop + 12)}" x2="${fx(x1 - 10)}" y2="${fx(rimTop + 12)}" stroke="#e6c98a" stroke-width="2.4" stroke-dasharray="8 6" opacity="0.85"/>`
  // three buckle straps draped over the rim
  for (const bxN of [0.24, 0.5, 0.76]) {
    const sx = w * bxN
    s += `<rect x="${fx(sx - w * 0.022)}" y="${fx(rimTop - 4)}" width="${fx(w * 0.044)}" height="${fx(h * 0.28)}" fill="${LEATHER_DIM}"/>`
    s += `<rect x="${fx(sx - w * 0.022)}" y="${fx(rimTop - 4)}" width="${fx(w * 0.014)}" height="${fx(h * 0.28)}" fill="${LEATHER_LIT}" opacity="0.5"/>`
    s += `<rect x="${fx(sx - w * 0.03)}" y="${fx(rimBot - h * 0.02)}" width="${fx(w * 0.06)}" height="${fx(h * 0.075)}" rx="3" fill="${GOLD}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.55"/>` // brass buckle
    s += `<rect x="${fx(sx - w * 0.03)}" y="${fx(rimBot - h * 0.02)}" width="${fx(w * 0.06)}" height="4" fill="${GOLD_LIT}"/>`
  }
  // side seams + crease
  s += `<line x1="${fx(cx)}" y1="${fx(rimBot)}" x2="${fx(cx)}" y2="${fx(bot)}" stroke="${INK}" stroke-width="1.6" opacity="0.22"/>`
  s += rimPath(body)
  s += `</g>`
  void r
  return svgPiece(
    w,
    h,
    s,
    `<linearGradient id="bagInt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5c3a1e"/><stop offset="0.45" stop-color="#3a2414"/><stop offset="1" stop-color="#20110a"/></linearGradient>`
  )
}

// ---- THE FAN BURST (s8 satchel-burst-mK, fan members). Golden treasure rays
// fanning out of the opened bag. Each member folds on its centre crease, so the
// ray is a symmetric tapered pennant about cx: a bright gold spine, ink veins, a
// gem/coin ornament near the tip. Inner rays short, outer long (idx grows). ----
function treasureRay(w, h, seed, idx) {
  const r = mulberry32(seed)
  const cx = w / 2
  const halfBase = w * (0.13 + idx * 0.015)
  const halfTip = w * (0.28 + idx * 0.03)
  const tipY = h * 0.08
  const baseY = h * 0.96
  const notch = h * 0.12 // swallowtail notch depth at the tip
  // symmetric ray: narrow base -> wide swallowtail tip
  const d = `M ${fx(cx - halfBase)} ${fx(baseY)} L ${fx(cx - halfTip)} ${fx(tipY + notch)} L ${fx(cx - halfTip * 0.45)} ${fx(tipY + notch * 0.4)} L ${fx(cx)} ${fx(tipY)} L ${fx(cx + halfTip * 0.45)} ${fx(tipY + notch * 0.4)} L ${fx(cx + halfTip)} ${fx(tipY + notch)} L ${fx(cx + halfBase)} ${fx(baseY)} Z`
  let s = `<g>`
  s += `<path d="${d}" fill="${GOLD}"/>`
  // lit left half + bright central spine
  s += `<path d="M ${fx(cx - halfBase)} ${fx(baseY)} L ${fx(cx - halfTip)} ${fx(tipY + notch)} L ${fx(cx)} ${fx(tipY)} L ${fx(cx)} ${fx(baseY)} Z" fill="${GOLD_LIT}" opacity="0.4"/>`
  s += `<line x1="${fx(cx)}" y1="${fx(tipY + 6)}" x2="${fx(cx)}" y2="${fx(baseY - 6)}" stroke="${GOLD_LIT}" stroke-width="3" opacity="0.7"/>`
  s += `<line x1="${fx(cx)}" y1="${fx(tipY + 6)}" x2="${fx(cx)}" y2="${fx(baseY - 6)}" stroke="${INK}" stroke-width="1.4" opacity="0.3"/>`
  // veins
  for (let k = 1; k <= 3; k++) {
    const t = k / 4
    const y = lerp(tipY + notch, baseY, t)
    const half = lerp(halfTip, halfBase, t)
    s += `<line x1="${fx(cx - half + 4)}" y1="${fx(y)}" x2="${fx(cx)}" y2="${fx(y - h * 0.05)}" stroke="${GOLD_DIM}" stroke-width="1.6" opacity="0.5"/>`
    s += `<line x1="${fx(cx + half - 4)}" y1="${fx(y)}" x2="${fx(cx)}" y2="${fx(y - h * 0.05)}" stroke="${GOLD_DIM}" stroke-width="1.6" opacity="0.5"/>`
  }
  // gem/coin ornament near the tip
  const gy = tipY + notch + h * 0.14
  const gr = w * 0.07
  if (idx % 2 === 0) {
    s += `<circle cx="${fx(cx)}" cy="${fx(gy)}" r="${fx(gr)}" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1.8" stroke-opacity="0.55"/>`
    s += `<circle cx="${fx(cx)}" cy="${fx(gy)}" r="${fx(gr * 0.5)}" fill="none" stroke="${GOLD_DIM}" stroke-width="1.6" opacity="0.6"/>`
  } else {
    // a small ruby lozenge
    s += `<path d="M ${fx(cx)} ${fx(gy - gr)} L ${fx(cx + gr * 0.8)} ${fx(gy)} L ${fx(cx)} ${fx(gy + gr)} L ${fx(cx - gr * 0.8)} ${fx(gy)} Z" fill="${SEAL_RED_LIT}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.55"/>`
    s += `<path d="M ${fx(cx)} ${fx(gy - gr)} L ${fx(cx)} ${fx(gy + gr)}" stroke="#d98a92" stroke-width="1.4" opacity="0.6"/>`
  }
  s += rimPath(d)
  s += `</g>`
  void r
  return svgPiece(w, h, s)
}

// ---- THE MAP TABLE TOP (s8 satchel-table-deck, platform deck). A plank table
// surface with a rolled-out chart pinned across it. u across the width, v along
// the depth (far edge v=1). The scroll dress rides on top separately. ----
function mapTableDeck(w, h, seed) {
  const r = mulberry32(seed)
  let s = `<g>`
  s += `<rect width="${w}" height="${h}" fill="#7a5433"/>` // walnut table
  // planks running in the depth direction (vertical here)
  const planks = 6
  for (let i = 0; i <= planks; i++) {
    const x = (w * i) / planks
    s += `<line x1="${fx(x)}" y1="0" x2="${fx(x)}" y2="${h}" stroke="${INK}" stroke-width="2" opacity="0.35"/>`
    s += `<line x1="${fx(x + 3)}" y1="0" x2="${fx(x + 3)}" y2="${h}" stroke="#a07a4e" stroke-width="1.4" opacity="0.4"/>`
  }
  for (let i = 0; i < 40; i++) s += `<circle cx="${fx(rr(r, 0, w))}" cy="${fx(rr(r, 0, h))}" r="1.6" fill="${INK}" opacity="0.14"/>` // grain flecks
  // the chart: a parchment sheet across the middle
  const mx = w * 0.12,
    my = h * 0.18,
    mw = w * 0.76,
    mh = h * 0.64
  s += `<rect x="${fx(mx)}" y="${fx(my)}" width="${fx(mw)}" height="${fx(mh)}" fill="${PARCH}" stroke="${INK}" stroke-width="2" stroke-opacity="0.4"/>`
  s += `<rect x="${fx(mx)}" y="${fx(my)}" width="${fx(mw)}" height="${fx(mh * 0.14)}" fill="${PARCH_DIM}" opacity="0.4"/>`
  // routes + a compass rose
  s += `<path d="M ${fx(mx + mw * 0.1)} ${fx(my + mh * 0.7)} Q ${fx(mx + mw * 0.4)} ${fx(my + mh * 0.3)} ${fx(mx + mw * 0.85)} ${fx(my + mh * 0.5)}" fill="none" stroke="${SEAL_RED}" stroke-width="2.4" stroke-dasharray="8 6" opacity="0.7"/>`
  const rose = { x: mx + mw * 0.72, y: my + mh * 0.72, r: Math.min(mw, mh) * 0.16 }
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    const rl = k % 2 ? rose.r * 0.5 : rose.r
    s += `<line x1="${fx(rose.x)}" y1="${fx(rose.y)}" x2="${fx(rose.x + Math.cos(a) * rl)}" y2="${fx(rose.y + Math.sin(a) * rl)}" stroke="${INK}" stroke-width="1.6" opacity="0.6"/>`
  }
  s += `<circle cx="${fx(rose.x)}" cy="${fx(rose.y)}" r="3" fill="${SEAL_RED}"/>`
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE ROUTER'S SCROLL (s8 satchel-scroll, dress w0.09/h0.16). A rolled
// parchment standing on the table, dark wooden dowel ends. Tall silhouette. ----
function rolledScroll(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const rollR = w * 0.42
  const bodyX0 = w * 0.16,
    bodyX1 = w * 0.84
  const topY = h * 0.16,
    botY = h * 0.84
  const body = `M ${fx(bodyX0)} ${fx(topY)} L ${fx(bodyX1)} ${fx(topY)} L ${fx(bodyX1)} ${fx(botY)} L ${fx(bodyX0)} ${fx(botY)} Z`
  let s = `<g>`
  s += `<path d="${body}" fill="${PARCH}"/>`
  s += `<rect x="${fx(bodyX0)}" y="${fx(topY)}" width="${fx((bodyX1 - bodyX0) * 0.4)}" height="${fx(botY - topY)}" fill="#ffffff" opacity="0.18"/>`
  // written lines
  for (let i = 0; i < 6; i++) {
    const y = lerp(topY + 12, botY - 12, i / 5)
    s += `<line x1="${fx(bodyX0 + 6)}" y1="${fx(y)}" x2="${fx(bodyX1 - 6)}" y2="${fx(y)}" stroke="${INK}" stroke-width="2" opacity="${(0.3 + rr(r, 0, 0.2)).toFixed(2)}"/>`
  }
  // rolled dowel caps top & bottom
  for (const cyN of [topY, botY]) {
    s += `<ellipse cx="${fx(cx)}" cy="${fx(cyN)}" rx="${fx(rollR)}" ry="${fx(h * 0.08)}" fill="#6a4a2c" stroke="${INK}" stroke-width="1.8" stroke-opacity="0.5"/>`
    s += `<ellipse cx="${fx(cx)}" cy="${fx(cyN - 2)}" rx="${fx(rollR * 0.5)}" ry="${fx(h * 0.03)}" fill="#8a6440"/>`
  }
  s += rimPath(body, 4)
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE DEPTH VISTA WINGS (s8 satchel-vista-{near,mid,rear}). A SHAPED-MESH art
// module (like the ch3 skyline): each grade emits BOTH an OUTLINE (normalized
// [0,1]^2, v hinge=0 -> crest=1) that cuts the mesh silhouette AND a PAINT drawn
// in the same space. The crest is a VAULT arc rising toward the INNER (u=1) end,
// so after the renderer's per-side u-mirror the six arcs together imply one
// receding vaulted aperture wrapping the satchel. Warmth/scale GRADED: near =
// warmest, largest, keepsake TENTS + a waypost; mid = cooler, rolling with a
// winding ROAD; rear = coolest dusk-violet, six KINGDOM spikes as one horizon.
// Alpha die-cut (sky shows above the crest). Byte-deterministic. No text. ----
// Atmospheric-perspective GRADE: FOREGROUND (near) = dark, saturated, high
// contrast; DISTANT (rear) = pale, cool, low contrast, hazy. The near->rear
// value+warmth+contrast recession is what makes the flat layers read as depth.
const VISTA_PAL = {
  near: { body: '#6b3d1c', lit: '#cf9e4c', dim: '#201106', accent: GOLD, accentLit: GOLD_LIT, archLo: 0.42, archHi: 0.9, detail: 'tents', haze: 0 },
  mid: { body: '#9a6e33', lit: '#cc9d51', dim: '#4a3016', accent: '#e6c052', accentLit: '#f2d98a', archLo: 0.36, archHi: 0.8, detail: 'roads', haze: 0.14 },
  rear: { body: '#9990ad', lit: '#b9b1c9', dim: '#7c7396', accent: '#d8c096', accentLit: '#ecdcb4', archLo: 0.32, archHi: 0.72, detail: 'kingdoms', haze: 0.34 },
}

/** The crest top profile (u ascending 0..1, normalized v) = a vault baseline
 *  arcing UP toward the INNER end (u=0, spine-ward) so the mirrored pair's arcs
 *  imply the receding aperture — plus per-grade silhouette peaks. */
function vistaCrest(rand, cfg) {
  const baseline = (u) => cfg.archHi - (cfg.archHi - cfg.archLo) * Math.pow(u, 0.9)
  const peaks = []
  if (cfg.detail === 'tents') {
    for (const c of [0.28, 0.54, 0.8]) peaks.push({ c: c + rr(rand, -0.02, 0.02), hw: rr(rand, 0.11, 0.15), hg: rr(rand, 0.12, 0.18), shape: 'tent' })
    peaks.push({ c: 0.14, hw: 0.06, hg: 0.14, shape: 'post' }) // the waypost, near the inner crest
  } else if (cfg.detail === 'roads') {
    for (const c of [0.26, 0.52, 0.78]) peaks.push({ c, hw: rr(rand, 0.13, 0.18), hg: rr(rand, 0.08, 0.12), shape: 'roll' })
  } else {
    for (let k = 0; k < 6; k++) peaks.push({ c: (k + 0.5) / 6, hw: 0.05, hg: rr(rand, 0.1, 0.18), shape: 'spike' }) // six kingdoms
  }
  const vAt = (u) => {
    let v = baseline(u)
    for (const p of peaks) {
      const d = Math.abs(u - p.c)
      if (d > p.hw) continue
      const t = 1 - d / p.hw
      let add = 0
      if (p.shape === 'tent' || p.shape === 'spike') add = p.hg * t
      else if (p.shape === 'post') add = d < p.hw * 0.42 ? p.hg : 0
      else add = p.hg * (0.5 - 0.5 * Math.cos(Math.PI * t))
      v = Math.max(v, baseline(u) + add)
    }
    return Math.min(0.97, v)
  }
  const S = 96
  const pts = []
  for (let i = 0; i <= S; i++) { const u = i / S; pts.push([u, vAt(u)]) }
  return pts
}

function vistaWingArt({ seed, w, h, grade }) {
  const rand = mulberry32(seed)
  const cfg = VISTA_PAL[grade]
  const crest = vistaCrest(rand, cfg)
  // Closed silhouette ring: base-inner -> base-outer -> up the crest (u=1 -> 0).
  const ring = simplifyOutline([[0, 0], [1, 0], ...crest.slice().reverse()])
  const gid = `vistaBody_${grade}`
  const px = ([u, v]) => `${fx(u * w)} ${fx((1 - v) * h)}`
  const d = 'M ' + ring.map(px).join(' L ') + ' Z'
  const YV = (v) => (1 - v) * h
  let s = `<g>`
  s += `<path d="${d}" fill="url(#${gid})"/>` // body: lit crest -> dark base (mass)
  // a darker inner-base wedge grounds the mass; a bright crest rim catches light.
  s += `<path d="M ${fx(0)} ${fx(h)} L ${fx(w * 0.34)} ${fx(h)} L 0 ${fx(YV(cfg.archHi * 0.55))} Z" fill="${cfg.dim}" opacity="0.4"/>`
  // detail marks by grade (inside the silhouette)
  if (cfg.detail === 'tents') {
    s += stitch(w * 0.04, h * 0.92, w * 0.96, h * 0.92)
    // a waypost + pennant near the inner crest (u ~ 0.14)
    const pxp = w * 0.14
    s += `<rect x="${fx(pxp - w * 0.01)}" y="${fx(YV(cfg.archHi - 0.02))}" width="${fx(w * 0.02)}" height="${fx(h * 0.42)}" fill="${cfg.dim}"/>`
    s += `<path d="M ${fx(pxp + w * 0.01)} ${fx(YV(cfg.archHi + 0.06))} L ${fx(pxp + w * 0.11)} ${fx(YV(cfg.archHi))} L ${fx(pxp + w * 0.01)} ${fx(YV(cfg.archHi - 0.06))} Z" fill="${cfg.accent}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.55"/>`
    // keepsake tent doorways + a lit gable edge each
    for (const c of [0.28, 0.54, 0.8]) {
      s += `<path d="M ${fx(c * w - w * 0.05)} ${fx(h * 0.78)} L ${fx(c * w)} ${fx(h * 0.44)} L ${fx(c * w + w * 0.05)} ${fx(h * 0.78)} Z" fill="${cfg.dim}" opacity="0.3"/>`
      s += `<line x1="${fx(c * w)}" y1="${fx(h * 0.46)}" x2="${fx(c * w)}" y2="${fx(h * 0.92)}" stroke="${cfg.accentLit}" stroke-width="2.2" opacity="0.5"/>`
    }
  } else if (cfg.detail === 'roads') {
    // a winding road climbing from the outer foot toward the inner crest
    s += `<path d="M ${fx(w * 0.9)} ${fx(h * 0.9)} C ${fx(w * 0.55)} ${fx(h * 0.72)} ${fx(w * 0.4)} ${fx(h * 0.6)} ${fx(w * 0.1)} ${fx(h * 0.4)}" fill="none" stroke="${cfg.accentLit}" stroke-width="4" stroke-dasharray="12 9" opacity="0.6"/>`
    s += `<path d="M ${fx(w * 0.9)} ${fx(h * 0.9)} C ${fx(w * 0.55)} ${fx(h * 0.72)} ${fx(w * 0.4)} ${fx(h * 0.6)} ${fx(w * 0.1)} ${fx(h * 0.4)}" fill="none" stroke="${cfg.dim}" stroke-width="1.6" opacity="0.5"/>`
    for (const [cx, cy] of [[0.62, 0.68], [0.34, 0.54], [0.16, 0.44]]) {
      s += `<circle cx="${fx(cx * w)}" cy="${fx(cy * h)}" r="${fx(w * 0.022)}" fill="${cfg.accent}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.5"/>`
    }
  } else {
    // amber window glints climbing the six kingdom spires (deep dusk, but readable)
    for (let k = 0; k < 6; k++) {
      const cx = ((k + 0.5) / 6) * w
      for (const vy of [0.5, 0.62, 0.74]) s += `<rect x="${fx(cx - w * 0.01)}" y="${fx(vy * h)}" width="${fx(w * 0.02)}" height="${fx(h * 0.045)}" fill="${cfg.accent}" opacity="0.65"/>`
      s += `<line x1="${fx(cx)}" y1="${fx(h * 0.44)}" x2="${fx(cx)}" y2="${fx(h * 0.9)}" stroke="${cfg.lit}" stroke-width="1.6" opacity="0.4"/>`
    }
  }
  // ATMOSPHERIC HAZE: distant layers get a pale cool wash that lowers contrast
  // (the further back, the hazier) — the depth cue that makes flat paper recede.
  if (cfg.haze > 0) s += `<path d="${d}" fill="#cdd0e0" opacity="${cfg.haze.toFixed(2)}"/>`
  s += rimPath(d, 4)
  s += `</g>`
  const defs = `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cfg.lit}"/><stop offset="0.5" stop-color="${cfg.body}"/><stop offset="1" stop-color="${cfg.dim}"/></linearGradient>`
  return { outline: ring, svg: svgPiece(w, h, s, defs) }
}

/** Bakes one vista wing straight into the art dir as <id>.webp + <id>.outline.json
 *  (the shaped-mesh contour), like the skyline slot bake. */
async function bakeVistaWing(wing, outDir) {
  const { outline, svg } = vistaWingArt({ seed: wing.seed, w: wing.w, h: wing.h, grade: wing.grade })
  const flat = await sharp(Buffer.from(svg)).png().toBuffer()
  const flatRaw = await sharp(flat).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const grainCut = await grainOverArt(flatRaw, wing.w, wing.h, wing.seed, 12)
  const out = await sharp(flat).composite([{ input: grainCut, blend: 'over' }]).png().toBuffer()
  const webp = await sharp(out).webp({ quality: 84 }).toBuffer()
  await writeFile(path.join(outDir, `${wing.id}.webp`), webp)
  await writeFile(path.join(outDir, `${wing.id}.outline.json`), JSON.stringify(outline))
  return { id: wing.id, W: wing.w, H: wing.h, aspect: (wing.w / wing.h).toFixed(3), points: outline.length, bytes: webp.length }
}

// The three graded wing flaps. Pixel dims at the true flap aspect width : height.
const VISTA_WINGS = [
  { id: 'satchel-vista-near', grade: 'near', w: 896, h: 555, seed: 80140 }, // width 0.42 : height 0.26 (broad foreground)
  { id: 'satchel-vista-mid', grade: 'mid', w: 640, h: 683, seed: 80141 }, //  width 0.30 : height 0.32
  { id: 'satchel-vista-rear', grade: 'rear', w: 384, h: 768, seed: 80142 }, // width 0.20 : height 0.40 (tall narrow spires)
]

// ---- THE END LETTER (s9 end-letter, vfold w0.75/h0.5). The unfolded letter
// the closing line asks the reader to answer: cream paper folded down the
// centre, ruled hand, a red wax blob and ribbon at the fold. Crease centre. ----
function foldedLetter(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const x0 = w * 0.06,
    x1 = w * 0.94,
    y0 = h * 0.08,
    y1 = h * 0.95
  const dogEar = w * 0.08
  // silhouette with a turned-down top-right dog-ear
  const d = `M ${fx(x0)} ${fx(y0)} L ${fx(x1 - dogEar)} ${fx(y0)} L ${fx(x1)} ${fx(y0 + dogEar)} L ${fx(x1)} ${fx(y1)} L ${fx(x0)} ${fx(y1)} Z`
  let s = `<g>`
  // AGED parchment ground (not stark white) + foxing mottle
  s += `<path d="${d}" fill="${PARCH_MID}"/>`
  s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cx - x0)}" height="${fx(y1 - y0)}" fill="#f0e2bc" opacity="0.28"/>` // lit left leaf
  s += `<rect x="${fx(cx)}" y="${fx(y0)}" width="${fx(x1 - cx)}" height="${fx(y1 - y0)}" fill="${PARCH_DIM}" opacity="0.22"/>` // shaded right leaf
  for (let i = 0; i < 18; i++) s += `<circle cx="${fx(rr(r, x0, x1))}" cy="${fx(rr(r, y0, y1))}" r="${fx(rr(r, 3, 8))}" fill="#b89a63" opacity="0.12"/>` // foxing
  s += `<line x1="${fx(cx)}" y1="${fx(y0)}" x2="${fx(cx)}" y2="${fx(y1)}" stroke="${INK}" stroke-width="1.6" opacity="0.2"/>` // centre fold
  // dog-ear fold
  s += `<path d="M ${fx(x1 - dogEar)} ${fx(y0)} L ${fx(x1)} ${fx(y0 + dogEar)} L ${fx(x1 - dogEar)} ${fx(y0 + dogEar)} Z" fill="${PARCH_DIM}" opacity="0.8" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.4"/>`
  // handwritten hand: connected cursive loops per line (skip the fold gutter)
  const script = (lx0, lx1, y, seed2) => {
    const r2 = mulberry32(seed2)
    let d2 = `M ${fx(lx0)} ${fx(y)}`
    let x = lx0
    const step = (lx1 - lx0) / 22
    let pen = true
    while (x < lx1) {
      if (r2() < 0.12) {
        pen = false
        x += step * 1.6
        d2 += ` M ${fx(x)} ${fx(y)}`
      } else {
        const up = r2() < 0.5 ? -1 : 1
        d2 += ` q ${fx(step * 0.5)} ${fx(up * h * 0.018 * (0.5 + r2()))} ${fx(step)} 0`
        x += step
      }
    }
    void pen
    return `<path d="${d2}" fill="none" stroke="#4a3320" stroke-width="1.7" opacity="0.7"/>`
  }
  s += `<path d="M ${fx(x0 + w * 0.07)} ${fx(y0 + h * 0.15)} q ${fx(w * 0.05)} ${fx(-h * 0.03)} ${fx(w * 0.12)} 0" fill="none" stroke="${SEAL_RED}" stroke-width="3" opacity="0.65"/>` // salutation flourish
  for (let i = 0; i < 8; i++) {
    const y = lerp(y0 + h * 0.28, y1 - h * 0.16, i / 7)
    s += script(x0 + w * 0.06, cx - w * 0.05, y, (seed * 31 + i * 17) | 0)
    if (i < 6) s += script(cx + w * 0.05, x1 - w * 0.06 - (i === 5 ? w * 0.22 : 0), y, (seed * 47 + i * 23) | 0)
  }
  // a signature flourish bottom-right
  s += `<path d="M ${fx(cx + w * 0.06)} ${fx(y1 - h * 0.09)} q ${fx(w * 0.1)} ${fx(-h * 0.07)} ${fx(w * 0.18)} 0 q ${fx(w * 0.06)} ${fx(h * 0.05)} ${fx(w * 0.1)} ${fx(-h * 0.03)}" fill="none" stroke="#4a3320" stroke-width="2.4" opacity="0.7"/>`
  // ribbon tails + a rich crimson wax seal (raven emboss) at the fold centre-bottom
  const scy = y1 - h * 0.13
  const seR = w * 0.075
  s += `<path d="M ${fx(cx - w * 0.16)} ${fx(scy - h * 0.14)} l ${fx(-w * 0.06)} ${fx(h * 0.2)} l ${fx(w * 0.1)} ${fx(-h * 0.08)} Z" fill="${SEAL_RED}"/>`
  s += `<path d="M ${fx(cx + w * 0.16)} ${fx(scy - h * 0.14)} l ${fx(w * 0.06)} ${fx(h * 0.2)} l ${fx(-w * 0.1)} ${fx(-h * 0.08)} Z" fill="${SEAL_RED}"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(scy)}" r="${fx(seR)}" fill="${SEAL_RED}" stroke="#4a141c" stroke-width="2.4"/>`
  s += `<circle cx="${fx(cx - seR * 0.3)}" cy="${fx(scy - seR * 0.3)}" r="${fx(seR * 0.72)}" fill="${SEAL_RED_LIT}" opacity="0.45"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(scy)}" r="${fx(seR * 0.74)}" fill="none" stroke="#4a141c" stroke-width="1.6" opacity="0.7"/>`
  // embossed raven silhouette in the wax
  s += `<path d="M ${fx(cx - seR * 0.4)} ${fx(scy + seR * 0.25)} Q ${fx(cx - seR * 0.5)} ${fx(scy - seR * 0.1)} ${fx(cx - seR * 0.1)} ${fx(scy - seR * 0.2)} Q ${fx(cx + seR * 0.1)} ${fx(scy - seR * 0.5)} ${fx(cx + seR * 0.3)} ${fx(scy - seR * 0.35)} L ${fx(cx + seR * 0.55)} ${fx(scy - seR * 0.3)} L ${fx(cx + seR * 0.32)} ${fx(scy - seR * 0.15)} Q ${fx(cx + seR * 0.5)} ${fx(scy + seR * 0.35)} ${fx(cx)} ${fx(scy + seR * 0.4)} Q ${fx(cx - seR * 0.25)} ${fx(scy + seR * 0.45)} ${fx(cx - seR * 0.4)} ${fx(scy + seR * 0.25)} Z" fill="#4a141c" opacity="0.6"/>`
  s += rimPath(d)
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE DISTANT HILLS (s9 end-hills-mK, fan, very wide/short). Citadel
// treatment: a forested down whose TOP EDGE is a serrated pine tree-line (the
// silhouette itself), with a darker recession band behind it and walnut-ink
// tips — real value depth per plane. Muted forest green, receding per idx. ----
function distantHills(w, h, seed, idx) {
  const r = mulberry32(seed)
  const fills = ['#3a4d37', '#455840', '#54694c']
  const backs = ['#2e3f2c', '#374a33', '#455840']
  const lits = ['#54684a', '#617657', '#728666']
  const fill = fills[idx % 3],
    back = backs[idx % 3],
    lit = lits[idx % 3]
  const crest = h * (0.5 - idx * 0.05)
  // serrated pine tree-line as the cut silhouette (sawtooth of valleys/tips)
  const teeth = Math.round(14 + idx * 4 + (seed % 3))
  const tips = []
  for (let i = 0; i <= teeth; i++) {
    const bx = (w * i) / teeth
    const valley = crest + Math.sin(i * 0.6 + seed) * h * 0.05
    const th = rr(r, h * 0.16, h * 0.34)
    tips.push({ bx, valley, tip: Math.max(h * 0.05, valley - th) })
  }
  let top = `M 0 ${fx(h)} L 0 ${fx(crest + h * 0.1)}`
  for (let i = 0; i <= teeth; i++) {
    const t = tips[i]
    top += ` L ${fx(t.bx - w / teeth / 2)} ${fx(t.valley)} L ${fx(t.bx)} ${fx(t.tip)}`
  }
  top += ` L ${fx(w)} ${fx(crest + h * 0.1)} L ${fx(w)} ${fx(h)} Z`
  let s = `<g>`
  // recession band BEHIND the tree-line (a lower, darker line for depth)
  let backLine = `M 0 ${fx(h)} L 0 ${fx(crest + h * 0.06)}`
  for (let i = 0; i <= teeth; i++) backLine += ` L ${fx(tips[i].bx - w / teeth / 2)} ${fx(tips[i].valley - h * 0.02)} L ${fx(tips[i].bx)} ${fx((tips[i].tip + tips[i].valley) / 2 - h * 0.04)}`
  backLine += ` L ${fx(w)} ${fx(crest + h * 0.06)} L ${fx(w)} ${fx(h)} Z`
  s += `<path d="${backLine}" fill="${back}"/>`
  // main tree-line
  s += `<path d="${top}" fill="${fill}"/>`
  s += `<rect x="0" y="${fx(h * 0.62)}" width="${w}" height="${fx(h * 0.38)}" fill="${INK}" opacity="0.22"/>` // valley shade
  // lit dusting on the sunward (left) flank of each tip
  for (let i = 0; i <= teeth; i++) {
    const t = tips[i]
    s += `<path d="M ${fx(t.bx)} ${fx(t.tip)} L ${fx(t.bx - w / teeth * 0.34)} ${fx(t.valley)} L ${fx(t.bx)} ${fx(t.valley)} Z" fill="${lit}" opacity="0.4"/>`
  }
  s += `<rect x="0" y="${fx(h * 0.88)}" width="${w}" height="${fx(h * 0.12)}" fill="#2c3a28" opacity="0.6"/>` // earth foot
  // walnut ink on the tree-line edge
  let inkEdge = `M 0 ${fx(crest + h * 0.1)}`
  for (let i = 0; i <= teeth; i++) inkEdge += ` L ${fx(tips[i].bx - w / teeth / 2)} ${fx(tips[i].valley)} L ${fx(tips[i].bx)} ${fx(tips[i].tip)}`
  inkEdge += ` L ${fx(w)} ${fx(crest + h * 0.1)}`
  s += `<path d="${inkEdge}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.5" stroke-linejoin="round"/>`
  s += rimPath(inkEdge, 4)
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE RETURNING RAVEN (s9 end-raven, child w0.2/h0.15). A small cut-paper
// raven in profile riding the letter's fold, wing lifted. ----
function ravenFigure(w, h, seed) {
  const r = mulberry32(seed)
  const BLACK = '#221b26',
    BLACK_LIT = '#3a3040',
    SHEEN = '#5a5165'
  // a raven perched in profile, facing right: rounded breast, arched neck, a
  // wedge tail, a stout beak. Cleaner cut-paper silhouette than the v1 blob.
  const d =
    `M ${fx(w * 0.22)} ${fx(h * 0.86)}` + // tail base
    ` Q ${fx(w * 0.08)} ${fx(h * 0.8)} ${fx(w * 0.14)} ${fx(h * 0.66)}` + // rump
    ` Q ${fx(w * 0.18)} ${fx(h * 0.46)} ${fx(w * 0.42)} ${fx(h * 0.44)}` + // back
    ` Q ${fx(w * 0.52)} ${fx(h * 0.42)} ${fx(w * 0.56)} ${fx(h * 0.28)}` + // nape
    ` Q ${fx(w * 0.6)} ${fx(h * 0.14)} ${fx(w * 0.74)} ${fx(h * 0.16)}` + // crown
    ` Q ${fx(w * 0.84)} ${fx(h * 0.17)} ${fx(w * 0.82)} ${fx(h * 0.27)}` + // face
    ` L ${fx(w * 0.98)} ${fx(h * 0.29)} L ${fx(w * 0.82)} ${fx(h * 0.36)}` + // beak
    ` Q ${fx(w * 0.8)} ${fx(h * 0.5)} ${fx(w * 0.66)} ${fx(h * 0.56)}` + // throat
    ` Q ${fx(w * 0.6)} ${fx(h * 0.74)} ${fx(w * 0.5)} ${fx(h * 0.8)}` + // breast
    ` L ${fx(w * 0.62)} ${fx(h * 0.9)} L ${fx(w * 0.3)} ${fx(h * 0.9)}` + // tail wedge
    ` Z`
  let s = `<g>`
  s += `<path d="${d}" fill="${BLACK}"/>`
  // folded wing — layered flight feathers over the back/flank
  s += `<path d="M ${fx(w * 0.3)} ${fx(h * 0.5)} Q ${fx(w * 0.5)} ${fx(h * 0.44)} ${fx(w * 0.6)} ${fx(h * 0.52)} Q ${fx(w * 0.5)} ${fx(h * 0.72)} ${fx(w * 0.34)} ${fx(h * 0.78)} Q ${fx(w * 0.26)} ${fx(h * 0.64)} ${fx(w * 0.3)} ${fx(h * 0.5)} Z" fill="${BLACK_LIT}"/>`
  for (let i = 0; i < 4; i++) {
    const t = i / 4
    s += `<path d="M ${fx(w * (0.34 + t * 0.06))} ${fx(h * (0.52 + t * 0.05))} Q ${fx(w * (0.46 + t * 0.04))} ${fx(h * (0.56 + t * 0.06))} ${fx(w * (0.4 + t * 0.03))} ${fx(h * (0.76 - t * 0.02))}" fill="none" stroke="${SHEEN}" stroke-width="1.8" opacity="0.55"/>` // feather quills
  }
  // breast plumage ticks
  for (const t of [0.58, 0.68]) s += `<path d="M ${fx(w * 0.56)} ${fx(h * t)} q ${fx(-w * 0.05)} ${fx(h * 0.03)} ${fx(-w * 0.1)} 0" fill="none" stroke="${SHEEN}" stroke-width="1.4" opacity="0.45"/>`
  // gold eye + beak line
  s += `<circle cx="${fx(w * 0.72)}" cy="${fx(h * 0.26)}" r="${fx(w * 0.028)}" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1" stroke-opacity="0.5"/>`
  s += `<circle cx="${fx(w * 0.725)}" cy="${fx(h * 0.265)}" r="${fx(w * 0.011)}" fill="${INK}"/>`
  s += `<line x1="${fx(w * 0.82)}" y1="${fx(h * 0.31)}" x2="${fx(w * 0.96)}" y2="${fx(h * 0.3)}" stroke="${INK}" stroke-width="1.4" opacity="0.6"/>` // beak gape
  s += rimPath(d, 4)
  s += `</g>`
  void r
  return svgPiece(w, h, s)
}

// ---- GROUND SWELL / EARTH BERM (parallel: title-swell, end-mound). A low
// terrain mound. The parallel quad reads mostly as ground, so fill the lower
// body with earth bands + a grassy lit crest fringe; transparent above. ----
function earthBerm(w, h, seed, tone = 'grass') {
  const r = mulberry32(seed)
  const soil = tone === 'sand' ? '#c2a366' : '#6f5a3c'
  const soilDim = tone === 'sand' ? '#a8894f' : '#54432c'
  const grass = tone === 'sand' ? '#c9b070' : '#6f8a4f'
  const grassLit = tone === 'sand' ? '#ddc78c' : '#8aa766'
  const crest = h * 0.34
  let ridge = `M 0 ${fx(crest + h * 0.2)}`
  const n = 5
  const pts = []
  for (let i = 0; i <= n; i++) pts.push([(w * i) / n, crest + Math.sin(i * 2 + seed) * h * 0.08 + rr(r, -h * 0.03, h * 0.03)])
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]
    ridge += i === 0 ? ` L ${fx(x)} ${fx(y)}` : ` Q ${fx((pts[i - 1][0] + x) / 2)} ${fx(Math.min(pts[i - 1][1], y) - h * 0.05)} ${fx(x)} ${fx(y)}`
  }
  const crestLine = ridge
  ridge += ` L ${fx(w)} ${fx(crest + h * 0.2)} L ${fx(w)} ${fx(h)} L 0 ${fx(h)} Z`
  let s = `<g>`
  s += `<path d="${ridge}" fill="${soil}"/>`
  s += `<rect x="0" y="${fx(h * 0.7)}" width="${w}" height="${fx(h * 0.3)}" fill="${soilDim}" opacity="0.5"/>`
  // earth striations
  for (let i = 0; i < 3; i++) s += `<path d="M 0 ${fx(h * (0.55 + i * 0.12))} Q ${fx(w / 2)} ${fx(h * (0.58 + i * 0.12))} ${fx(w)} ${fx(h * (0.55 + i * 0.12))}" fill="none" stroke="${soilDim}" stroke-width="2" opacity="0.4"/>`
  // grassy crest fringe (little blades along the ridge)
  s += `<path d="${crestLine} L ${fx(w)} ${fx(crest + h * 0.2)}" fill="none" stroke="${grass}" stroke-width="6" opacity="0.8"/>`
  s += `<path d="${crestLine} L ${fx(w)} ${fx(crest + h * 0.2)}" fill="none" stroke="${grassLit}" stroke-width="2.4" opacity="0.7"/>`
  const blades = 26
  for (let i = 0; i < blades; i++) {
    const x = (w * i) / blades + rr(r, -6, 6)
    // sample crest y roughly
    const seg = Math.min(n - 1, Math.floor((x / w) * n))
    const y = pts[seg] ? pts[seg][1] : crest
    const bh = rr(r, h * 0.06, h * 0.14)
    s += `<path d="M ${fx(x)} ${fx(y)} q ${fx(rr(r, -4, 4))} ${fx(-bh)} ${fx(rr(r, -3, 3))} ${fx(-bh)}" fill="none" stroke="${i % 2 ? grass : grassLit}" stroke-width="2" opacity="0.75"/>`
  }
  s += rimPath(`${crestLine} L ${fx(w)} ${fx(crest + h * 0.2)}`, 4)
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- A WAX-SEAL TUFT (s1 title-swell-seal, rider). A red wax seal resting on
// a small grass clump — the "wax-seal tuft" riding the berm ridge. ----
function sealTuft(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  let s = `<g>`
  // grass clump base (silhouette lower half)
  const gb = `M ${fx(w * 0.14)} ${fx(h)} Q ${fx(w * 0.1)} ${fx(h * 0.6)} ${fx(w * 0.3)} ${fx(h * 0.55)} Q ${fx(cx)} ${fx(h * 0.4)} ${fx(w * 0.7)} ${fx(h * 0.55)} Q ${fx(w * 0.9)} ${fx(h * 0.6)} ${fx(w * 0.86)} ${fx(h)} Z`
  s += `<path d="${gb}" fill="#6f8a4f"/>`
  for (let i = 0; i < 9; i++) {
    const x = rr(r, w * 0.2, w * 0.8)
    s += `<path d="M ${fx(x)} ${fx(h * 0.9)} q ${fx(rr(r, -6, 6))} ${fx(-h * 0.3)} ${fx(rr(r, -4, 4))} ${fx(-h * 0.34)}" fill="none" stroke="#8aa766" stroke-width="2.4" opacity="0.8"/>`
  }
  // wax seal medallion sitting in the clump
  const seR = w * 0.24
  const sy = h * 0.4
  s += `<circle cx="${fx(cx)}" cy="${fx(sy)}" r="${fx(seR)}" fill="${SEAL_RED}" stroke="${INK}" stroke-width="2" stroke-opacity="0.5"/>`
  s += `<circle cx="${fx(cx - seR * 0.25)}" cy="${fx(sy - seR * 0.25)}" r="${fx(seR * 0.7)}" fill="${SEAL_RED_LIT}" opacity="0.4"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(sy)}" r="${fx(seR * 0.66)}" fill="none" stroke="#4a141c" stroke-width="2" opacity="0.6"/>`
  // embossed star
  const star = []
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI) / 5 - Math.PI / 2
    const rl = k % 2 ? seR * 0.24 : seR * 0.52
    star.push(`${fx(cx + Math.cos(a) * rl)} ${fx(sy + Math.sin(a) * rl)}`)
  }
  s += `<path d="M ${star.join(' L ')} Z" fill="#4a141c" opacity="0.55"/>`
  s += rimPath(gb, 4)
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- A GRASS / REED TUFT (s9 end-mound-tuft, rider). A simple reed clump the
// letter rests against. ----
function grassTuft(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const gb = `M ${fx(w * 0.2)} ${fx(h)} Q ${fx(w * 0.16)} ${fx(h * 0.62)} ${fx(w * 0.34)} ${fx(h * 0.58)} Q ${fx(cx)} ${fx(h * 0.46)} ${fx(w * 0.66)} ${fx(h * 0.58)} Q ${fx(w * 0.84)} ${fx(h * 0.62)} ${fx(w * 0.8)} ${fx(h)} Z`
  let s = `<g>`
  s += `<path d="${gb}" fill="#5f7a44"/>`
  for (let i = 0; i < 16; i++) {
    const x = rr(r, w * 0.22, w * 0.78)
    const bh = rr(r, h * 0.4, h * 0.66)
    const lean = rr(r, -w * 0.14, w * 0.14)
    s += `<path d="M ${fx(x)} ${fx(h * 0.92)} Q ${fx(x + lean * 0.5)} ${fx(h * 0.92 - bh * 0.6)} ${fx(x + lean)} ${fx(h * 0.92 - bh)}" fill="none" stroke="${i % 2 ? '#6f8a4f' : '#8aa766'}" stroke-width="2.6" opacity="0.85"/>`
  }
  // a couple of cattail heads
  for (const t of [0.36, 0.62]) s += `<rect x="${fx(w * t)}" y="${fx(h * 0.28)}" width="${fx(w * 0.05)}" height="${fx(h * 0.18)}" rx="${fx(w * 0.025)}" fill="#7a5433"/>`
  s += rimPath(gb, 4)
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE TITLE BANNER (s1 title-border, backdrop vfold w1.3/h0.5). A wide
// ornamental parchment banner standing behind the hero — gold scrollwork frame,
// a rule of stars, the two folded panels reading as one unfurled title cloth.
function titleBanner(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const x0 = w * 0.03,
    x1 = w * 0.97,
    y0 = h * 0.14,
    y1 = h * 0.9
  const notch = h * 0.14
  // banner with swallowtail bottom
  const d = `M ${fx(x0)} ${fx(y0)} L ${fx(x1)} ${fx(y0)} L ${fx(x1)} ${fx(y1)} L ${fx(x1 - w * 0.06)} ${fx(y1 - notch)} L ${fx(cx)} ${fx(y1)} L ${fx(x0 + w * 0.06)} ${fx(y1 - notch)} L ${fx(x0)} ${fx(y1)} Z`
  let s = `<g>`
  // AGED parchment ground with a DEEPER value range (was milky at small size):
  // a mid-parchment body, a bright sunlit left leaf, a dim shaded right leaf,
  // and a walnut inner vignette so the cloth reads as illuminated card, not sheet
  s += `<path d="${d}" fill="${PARCH_MID}"/>`
  s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cx - x0)}" height="${fx(y1 - y0)}" fill="#f2e6bd" opacity="0.45"/>` // sunlit left leaf
  s += `<rect x="${fx(cx)}" y="${fx(y0)}" width="${fx(x1 - cx)}" height="${fx(y1 - y0)}" fill="${PARCH_DIM}" opacity="0.4"/>` // shaded right leaf
  s += `<rect x="${fx(x0)}" y="${fx(y1 - h * 0.16)}" width="${fx(x1 - x0)}" height="${fx(h * 0.16)}" fill="#8a6a3c" opacity="0.28"/>` // grounded lower vignette
  for (let i = 0; i < 22; i++) s += `<circle cx="${fx(rr(r, x0, x1))}" cy="${fx(rr(r, y0, y1))}" r="${fx(rr(r, 3, 8))}" fill="#b0925c" opacity="0.16"/>` // foxing
  // strong DOUBLE walnut scroll-frame + gold rule inside it
  const ix0 = x0 + w * 0.03,
    ix1 = x1 - w * 0.03,
    iy0 = y0 + h * 0.1,
    iy1 = y1 - h * 0.18
  s += `<rect x="${fx(ix0)}" y="${fx(iy0)}" width="${fx(ix1 - ix0)}" height="${fx(iy1 - iy0)}" fill="none" stroke="${INK}" stroke-width="6" opacity="0.85"/>` // walnut frame (heavier)
  s += `<rect x="${fx(ix0 + 8)}" y="${fx(iy0 + 8)}" width="${fx(ix1 - ix0 - 16)}" height="${fx(iy1 - iy0 - 16)}" fill="none" stroke="${GOLD}" stroke-width="3.5" opacity="0.95"/>` // gold rule
  s += `<rect x="${fx(ix0 + 13)}" y="${fx(iy0 + 13)}" width="${fx(ix1 - ix0 - 26)}" height="${fx(iy1 - iy0 - 26)}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.45"/>`
  // a burgundy CARTOUCHE band across the centre, behind the HTML title card, so
  // the pale title text pops off a rich illuminated ground (was milky parchment)
  s += `<rect x="${fx(ix0 + 16)}" y="${fx(h * 0.32)}" width="${fx(ix1 - ix0 - 32)}" height="${fx(h * 0.3)}" fill="${SEAL_RED}" opacity="0.34"/>`
  s += `<rect x="${fx(ix0 + 16)}" y="${fx(h * 0.32)}" width="${fx(ix1 - ix0 - 32)}" height="${fx(h * 0.09)}" fill="#ffffff" opacity="0.06"/>` // lit top of the band
  s += `<rect x="${fx(ix0 + 22)}" y="${fx(h * 0.35)}" width="${fx(ix1 - ix0 - 44)}" height="${fx(h * 0.24)}" fill="none" stroke="${GOLD}" stroke-width="2" opacity="0.7"/>` // gold inner rule
  s += `<line x1="${fx(ix0 + 16)}" y1="${fx(h * 0.32)}" x2="${fx(ix1 - 16)}" y2="${fx(h * 0.32)}" stroke="${GOLD}" stroke-width="1.8" opacity="0.7"/>`
  s += `<line x1="${fx(ix0 + 16)}" y1="${fx(h * 0.62)}" x2="${fx(ix1 - 16)}" y2="${fx(h * 0.62)}" stroke="${GOLD}" stroke-width="1.8" opacity="0.7"/>`
  // gold corner bosses + swag rings on the top rail
  for (const [bx, by] of [[ix0, iy0], [ix1, iy0], [ix0, iy1], [ix1, iy1]])
    s += `<circle cx="${fx(bx)}" cy="${fx(by)}" r="${fx(w * 0.012)}" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.5"/>`
  // corner flourishes
  for (const [ox, oy, sx, sy] of [
    [ix0, iy0, 1, 1],
    [ix1, iy0, -1, 1],
    [ix0, iy1, 1, -1],
    [ix1, iy1, -1, -1],
  ]) {
    s += `<path d="M ${fx(ox)} ${fx(oy + sy * h * 0.1)} q 0 ${fx(-sy * h * 0.08)} ${fx(sx * w * 0.05)} ${fx(-sy * h * 0.08)} q ${fx(sx * w * 0.05)} 0 ${fx(sx * w * 0.05)} ${fx(sy * h * 0.05)}" fill="none" stroke="${GOLD}" stroke-width="2.6" opacity="0.8"/>`
  }
  // a row of the SIX-KINGDOM heraldic SHIELDS along the lower cloth — the promise
  // of the realms carried IN the banner (the backdrop-fan crown was occluded at
  // the reading camera, so the six kingdoms ride the banner where they show)
  const shieldFields = ['#2f3f66', '#6e2531', '#2f5a44', '#7a5a2a', '#3a3550', '#4a2c14']
  const shy = h * 0.74
  const ssz = w * 0.026
  for (let k = 0; k < 6; k++) {
    const scx = cx + (k - 2.5) * w * 0.092
    const sd = `M ${fx(scx - ssz)} ${fx(shy - ssz)} L ${fx(scx + ssz)} ${fx(shy - ssz)} L ${fx(scx + ssz)} ${fx(shy + ssz * 0.5)} Q ${fx(scx + ssz)} ${fx(shy + ssz * 1.5)} ${fx(scx)} ${fx(shy + ssz * 1.9)} Q ${fx(scx - ssz)} ${fx(shy + ssz * 1.5)} ${fx(scx - ssz)} ${fx(shy + ssz * 0.5)} Z`
    s += `<path d="${sd}" fill="${shieldFields[k]}" stroke="${GOLD}" stroke-width="2.2" stroke-opacity="0.9"/>`
    s += `<path d="M ${fx(scx - ssz)} ${fx(shy - ssz)} L ${fx(scx)} ${fx(shy - ssz)} L ${fx(scx)} ${fx(shy + ssz * 1.9)} Q ${fx(scx - ssz)} ${fx(shy + ssz * 1.5)} ${fx(scx - ssz)} ${fx(shy + ssz * 0.5)} Z" fill="#ffffff" opacity="0.1"/>` // lit dexter half
    const star = []
    for (let j = 0; j < 10; j++) {
      const a = (j * Math.PI) / 5 - Math.PI / 2
      const rl = j % 2 ? ssz * 0.26 : ssz * 0.58
      star.push(`${fx(scx + Math.cos(a) * rl)} ${fx(shy + ssz * 0.25 + Math.sin(a) * rl)}`)
    }
    s += `<path d="M ${star.join(' L ')} Z" fill="${GOLD_LIT}"/>` // a mullet charge
  }
  // heraldic pennant BUNTING draped along the top rail (painted in, not a rigid
  // dress patch — see content.ts title-border): a catenary cord with a row of
  // small heraldic gonfalons hanging from it in the realm's colours
  const buntCols = ['#6e2531', '#2f3f66', '#2f5a44', GOLD]
  const railY = y0 + h * 0.05
  const sag = h * 0.05
  s += `<path d="M ${fx(x0 + w * 0.02)} ${fx(railY)} Q ${fx(cx)} ${fx(railY + sag)} ${fx(x1 - w * 0.02)} ${fx(railY)}" fill="none" stroke="${GOLD_DIM}" stroke-width="2.4" opacity="0.8"/>`
  const bn = 9
  for (let i = 0; i <= bn; i++) {
    const u = 0.04 + (i / bn) * 0.92
    const px = x0 + (x1 - x0) * u
    const yTop = railY + sag * (1 - Math.pow(2 * (u - 0.5), 2))
    const pw = w * 0.018
    const pl = h * (0.055 + (i % 2) * 0.02)
    const col = buntCols[i % buntCols.length]
    s += `<path d="M ${fx(px - pw)} ${fx(yTop)} L ${fx(px + pw)} ${fx(yTop)} L ${fx(px)} ${fx(yTop + pl)} Z" fill="${col}" stroke="${INK}" stroke-width="1" stroke-opacity="0.4"/>`
    s += `<path d="M ${fx(px - pw)} ${fx(yTop)} L ${fx(px)} ${fx(yTop)} L ${fx(px)} ${fx(yTop + pl)} Z" fill="#ffffff" opacity="0.12"/>`
  }
  s += `<line x1="${fx(cx)}" y1="${fx(y0)}" x2="${fx(cx)}" y2="${fx(y1)}" stroke="${INK}" stroke-width="1.5" opacity="0.16"/>`
  s += rimPath(d)
  s += `</g>`
  void r
  return svgPiece(w, h, s)
}

// ---- THE TITLE CREST (s1 title-crest, child w0.18/h0.13). A small heraldic
// shield: quill + book on a parchment escutcheon with a gold border. ----
function heraldCrest(w, h, seed) {
  const cx = w / 2
  const x0 = w * 0.14,
    x1 = w * 0.86,
    top = h * 0.1
  const shoulder = h * 0.55
  const tip = h * 0.94
  const d = `M ${fx(x0)} ${fx(top)} L ${fx(x1)} ${fx(top)} L ${fx(x1)} ${fx(shoulder)} Q ${fx(x1)} ${fx(tip - h * 0.05)} ${fx(cx)} ${fx(tip)} Q ${fx(x0)} ${fx(tip - h * 0.05)} ${fx(x0)} ${fx(shoulder)} Z`
  const FIELD = '#2f3f66', // heraldic azure
    FIELD_LIT = '#3f5486'
  let s = `<g>`
  // coloured field so the shield reads even small (was a pale blob)
  s += `<path d="${d}" fill="${FIELD}"/>`
  s += `<path d="M ${fx(x0)} ${fx(top)} L ${fx(cx)} ${fx(top)} L ${fx(cx)} ${fx(tip)} Q ${fx(x0)} ${fx(tip - h * 0.05)} ${fx(x0)} ${fx(shoulder)} Z" fill="${FIELD_LIT}" opacity="0.5"/>`
  // gold CHIEF band across the top third
  s += `<path d="M ${fx(x0)} ${fx(top)} L ${fx(x1)} ${fx(top)} L ${fx(x1)} ${fx(h * 0.34)} L ${fx(x0)} ${fx(h * 0.34)} Z" fill="${GOLD}"/>`
  s += `<line x1="${fx(x0)}" y1="${fx(h * 0.34)}" x2="${fx(x1)}" y2="${fx(h * 0.34)}" stroke="${INK}" stroke-width="2" opacity="0.5"/>`
  // three stars on the chief
  for (const sx of [0.3, 0.5, 0.7]) {
    const star = []
    for (let j = 0; j < 10; j++) {
      const a = (j * Math.PI) / 5 - Math.PI / 2
      const rl = j % 2 ? w * 0.02 : w * 0.045
      star.push(`${fx(w * sx + Math.cos(a) * rl)} ${fx(h * 0.22 + Math.sin(a) * rl)}`)
    }
    s += `<path d="M ${star.join(' L ')} Z" fill="${INK}" opacity="0.72"/>`
  }
  // open book on the field
  s += `<path d="M ${fx(cx)} ${fx(h * 0.56)} Q ${fx(w * 0.3)} ${fx(h * 0.46)} ${fx(w * 0.22)} ${fx(h * 0.52)} L ${fx(w * 0.22)} ${fx(h * 0.7)} Q ${fx(w * 0.34)} ${fx(h * 0.64)} ${fx(cx)} ${fx(h * 0.72)} Q ${fx(w * 0.66)} ${fx(h * 0.64)} ${fx(w * 0.78)} ${fx(h * 0.7)} L ${fx(w * 0.78)} ${fx(h * 0.52)} Q ${fx(w * 0.7)} ${fx(h * 0.46)} ${fx(cx)} ${fx(h * 0.56)} Z" fill="#f2ead0" stroke="${INK}" stroke-width="1.8" stroke-opacity="0.55"/>`
  s += `<line x1="${fx(cx)}" y1="${fx(h * 0.56)}" x2="${fx(cx)}" y2="${fx(h * 0.72)}" stroke="${INK}" stroke-width="1.6" opacity="0.4"/>`
  // gold quill crossing above the book
  s += `<path d="M ${fx(w * 0.32)} ${fx(h * 0.5)} Q ${fx(cx)} ${fx(h * 0.32)} ${fx(w * 0.7)} ${fx(h * 0.44)}" fill="none" stroke="${GOLD_LIT}" stroke-width="4.5" opacity="0.95"/>`
  s += `<path d="M ${fx(w * 0.64)} ${fx(h * 0.42)} l ${fx(w * 0.1)} ${fx(-h * 0.03)} l ${fx(-w * 0.045)} ${fx(h * 0.07)} Z" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.4"/>`
  // heavy gold border
  s += `<path d="${d}" fill="none" stroke="${GOLD}" stroke-width="6" opacity="0.9"/>`
  s += rimPath(d, 4)
  s += `</g>`
  return svgPiece(w, h, s)
}

// ============================================================================
// E2.2 ENDPAPER-COMPOSITION painters (2026-07-25): the title-page CROWN + swags
// and the end-page ROUTE-CARDS + launching raven + desk-edge band that clear
// the two honest composition FAILs (s1 pale/thin, s9 thin). Warm heraldic +
// writing-desk vocabulary; deterministic mulberry32; screen-space device art.
// ============================================================================

// ---- THE ROUTE-CARDS (s9 end-routes-mK, fan member — was the cold-green
// distantHills). A warm fan of postmarked correspondence: overlapping cream
// cards with ruled address hands, a franked postmark ring, a burgundy wax dot,
// and a dashed route line — the hero's letters home, conversing with the desk's
// printed inkwell + seals. Receding warmth per idx. ----
function routeCards(w, h, seed, idx) {
  const r = mulberry32(seed)
  const grounds = ['#efe1bd', '#e4d2a6', '#d3bd8b'] // near warm -> far dim
  const ground = grounds[idx % 3]
  // the member silhouette: a shallow arc of card tops (gentle scallop), not a
  // sawtooth — reads as a spread hand of letters, base glued along the bottom.
  const teeth = 4 + idx
  const topY = h * (0.2 + idx * 0.05)
  let top = `M 0 ${fx(h)} L 0 ${fx(topY + h * 0.12)}`
  const tips = []
  for (let i = 0; i <= teeth; i++) {
    const bx = (w * i) / teeth
    const ty = topY + Math.sin(i * 1.3 + seed) * h * 0.05
    tips.push({ bx, ty })
    top += ` L ${fx(bx)} ${fx(ty)}`
  }
  top += ` L ${fx(w)} ${fx(topY + h * 0.12)} L ${fx(w)} ${fx(h)} Z`
  let s = `<g>`
  s += `<path d="${top}" fill="${ground}"/>`
  s += `<rect x="0" y="${fx(h * 0.66)}" width="${w}" height="${fx(h * 0.34)}" fill="${LEATHER_DIM}" opacity="0.14"/>` // base shade
  // per-card face: ruled address hand + postmark ring + wax dot on each scallop
  for (let i = 0; i < teeth; i++) {
    const x0 = (w * i) / teeth + w * 0.01
    const x1 = (w * (i + 1)) / teeth - w * 0.01
    const cardTop = (tips[i].ty + tips[i + 1].ty) / 2 + h * 0.03
    s += `<rect x="${fx(x0)}" y="${fx(cardTop)}" width="${fx(x1 - x0)}" height="${fx(h - cardTop - h * 0.04)}" fill="#f4e8c6" opacity="0.5" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.28"/>`
    // ruled address lines
    for (let k = 0; k < 3; k++)
      s += `<line x1="${fx(x0 + (x1 - x0) * 0.12)}" y1="${fx(cardTop + h * (0.14 + k * 0.12))}" x2="${fx(x0 + (x1 - x0) * (0.62 - k * 0.06))}" y2="${fx(cardTop + h * (0.14 + k * 0.12))}" stroke="#5a4326" stroke-width="1.6" opacity="0.45"/>`
    // franked postmark ring (upper right of the card)
    const pmx = x0 + (x1 - x0) * 0.76,
      pmy = cardTop + h * 0.2
    s += `<circle cx="${fx(pmx)}" cy="${fx(pmy)}" r="${fx((x1 - x0) * 0.14)}" fill="none" stroke="${SEAL_RED}" stroke-width="2" opacity="0.5"/>`
    s += `<circle cx="${fx(pmx)}" cy="${fx(pmy)}" r="${fx((x1 - x0) * 0.08)}" fill="none" stroke="${SEAL_RED}" stroke-width="1.3" opacity="0.4"/>`
    for (let k = -1; k <= 1; k++)
      s += `<line x1="${fx(pmx - (x1 - x0) * 0.14)}" y1="${fx(pmy + k * 3)}" x2="${fx(pmx + (x1 - x0) * 0.14)}" y2="${fx(pmy + k * 3)}" stroke="${SEAL_RED}" stroke-width="1" opacity="0.3"/>`
    // a wax seal dot at the card foot
    s += `<circle cx="${fx((x0 + x1) / 2)}" cy="${fx(h - h * 0.12)}" r="${fx((x1 - x0) * 0.1)}" fill="${SEAL_RED}" stroke="#4a141c" stroke-width="1.4"/>`
    s += `<circle cx="${fx((x0 + x1) / 2 - (x1 - x0) * 0.03)}" cy="${fx(h - h * 0.135)}" r="${fx((x1 - x0) * 0.05)}" fill="${SEAL_RED_LIT}" opacity="0.5"/>`
  }
  // gold rule + dashed route line meandering along the tops (the courier route)
  let route = `M 0 ${fx(topY + h * 0.16)}`
  for (let i = 0; i <= teeth; i++) route += ` L ${fx(tips[i].bx)} ${fx(tips[i].ty + h * 0.05)}`
  s += `<path d="${route}" fill="none" stroke="${GOLD}" stroke-width="2" stroke-dasharray="7 5" opacity="0.6"/>`
  let inkEdge = `M 0 ${fx(topY + h * 0.12)}`
  for (let i = 0; i <= teeth; i++) inkEdge += ` L ${fx(tips[i].bx)} ${fx(tips[i].ty)}`
  inkEdge += ` L ${fx(w)} ${fx(topY + h * 0.12)}`
  s += `<path d="${inkEdge}" fill="none" stroke="${INK}" stroke-width="1.8" opacity="0.4" stroke-linejoin="round"/>`
  s += rimPath(inkEdge, 4)
  void r
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE RAVEN AWAY (s9 end-raven, kinetic arm — was a small perched child).
// A raven LAUNCHING: body pitched up along the arm ridge (image TOP = up the
// crease), wings thrown open, tail streaming down toward the gutter. Reads as
// mid-flight lift as the 45-fold arm sweeps it vertical. Portrait cell. ----
function ravenLaunch(w, h, seed) {
  const r = mulberry32(seed)
  const BLACK = '#221b26',
    BLACK_LIT = '#3a3040',
    SHEEN = '#5a5165'
  const cx = w * 0.5
  // body: a rising wedge from the tail (bottom) up to the head (top)
  const body =
    `M ${fx(cx - w * 0.08)} ${fx(h * 0.94)}` + // tail base (down toward gutter)
    ` Q ${fx(cx - w * 0.18)} ${fx(h * 0.7)} ${fx(cx - w * 0.06)} ${fx(h * 0.5)}` + // back
    ` Q ${fx(cx) } ${fx(h * 0.34)} ${fx(cx + w * 0.04)} ${fx(h * 0.24)}` + // shoulders -> neck
    ` Q ${fx(cx + w * 0.08)} ${fx(h * 0.12)} ${fx(cx + w * 0.18)} ${fx(h * 0.1)}` + // crown
    ` L ${fx(cx + w * 0.34)} ${fx(h * 0.08)} L ${fx(cx + w * 0.16)} ${fx(h * 0.16)}` + // beak
    ` Q ${fx(cx + w * 0.14)} ${fx(h * 0.3)} ${fx(cx + w * 0.1)} ${fx(h * 0.46)}` + // throat
    ` Q ${fx(cx + w * 0.16)} ${fx(h * 0.72)} ${fx(cx + w * 0.1)} ${fx(h * 0.94)}` + // belly -> tail
    ` L ${fx(cx + w * 0.02)} ${fx(h * 0.99)} L ${fx(cx - w * 0.08)} ${fx(h * 0.94)} Z`
  let s = `<g>`
  // thrown-open wings behind the body (two great sweeps)
  const wingUp = `M ${fx(cx - w * 0.02)} ${fx(h * 0.42)} Q ${fx(cx - w * 0.44)} ${fx(h * 0.3)} ${fx(cx - w * 0.42)} ${fx(h * 0.06)} Q ${fx(cx - w * 0.2)} ${fx(h * 0.22)} ${fx(cx + w * 0.02)} ${fx(h * 0.3)} Z`
  const wingLow = `M ${fx(cx + w * 0.02)} ${fx(h * 0.46)} Q ${fx(cx + w * 0.46)} ${fx(h * 0.4)} ${fx(cx + w * 0.46)} ${fx(h * 0.16)} Q ${fx(cx + w * 0.2)} ${fx(h * 0.34)} ${fx(cx + w * 0.06)} ${fx(h * 0.4)} Z`
  s += `<path d="${wingUp}" fill="${BLACK_LIT}"/>`
  s += `<path d="${wingLow}" fill="${BLACK}"/>`
  s += `<path d="${body}" fill="${BLACK}"/>`
  // primary-feather quills on the raised wing
  for (let i = 0; i < 4; i++) {
    const t = i / 4
    s += `<path d="M ${fx(cx - w * (0.06 + t * 0.32))} ${fx(h * (0.28 - t * 0.16))} Q ${fx(cx - w * (0.16 + t * 0.16))} ${fx(h * (0.22 - t * 0.08))} ${fx(cx - w * (0.24 + t * 0.14))} ${fx(h * (0.14 - t * 0.02))}" fill="none" stroke="${SHEEN}" stroke-width="2" opacity="0.5"/>`
  }
  // sheen along the back + gold eye + beak line
  s += `<path d="M ${fx(cx - w * 0.04)} ${fx(h * 0.5)} Q ${fx(cx)} ${fx(h * 0.34)} ${fx(cx + w * 0.06)} ${fx(h * 0.24)}" fill="none" stroke="${SHEEN}" stroke-width="2.4" opacity="0.5"/>`
  s += `<circle cx="${fx(cx + w * 0.15)}" cy="${fx(h * 0.15)}" r="${fx(w * 0.025)}" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1" stroke-opacity="0.5"/>`
  s += `<circle cx="${fx(cx + w * 0.155)}" cy="${fx(h * 0.153)}" r="${fx(w * 0.01)}" fill="${INK}"/>`
  s += `<line x1="${fx(cx + w * 0.16)}" y1="${fx(h * 0.13)}" x2="${fx(cx + w * 0.32)}" y2="${fx(h * 0.09)}" stroke="${INK}" stroke-width="1.4" opacity="0.6"/>`
  s += rimPath(body, 4)
  void r
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE DESK-EDGE BAND (s9 end-mound, parallel ground swell — was the green
// grass berm). A warm fore-edge lip of the writing desk: a leather blotter band
// with a stack of sealed letters and a spilled inkwell shadow along it, grounding
// the vignette in the desk. Lower body opaque, transparent above the ridge. ----
function deskBand(w, h, seed) {
  const r = mulberry32(seed)
  const LEATH = '#6b4a2c',
    LEATH_LIT = '#8a6238',
    LEATH_DIM = '#4a3018'
  const crest = h * 0.32
  let ridge = `M 0 ${fx(crest + h * 0.12)}`
  const n = 5
  const pts = []
  for (let i = 0; i <= n; i++) pts.push([(w * i) / n, crest + Math.sin(i * 1.7 + seed) * h * 0.05 + rr(r, -h * 0.02, h * 0.02)])
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]
    ridge += i === 0 ? ` L ${fx(x)} ${fx(y)}` : ` Q ${fx((pts[i - 1][0] + x) / 2)} ${fx(Math.min(pts[i - 1][1], y) - h * 0.03)} ${fx(x)} ${fx(y)}`
  }
  const crestLine = ridge
  ridge += ` L ${fx(w)} ${fx(crest + h * 0.12)} L ${fx(w)} ${fx(h)} L 0 ${fx(h)} Z`
  let s = `<g>`
  s += `<path d="${ridge}" fill="${LEATH}"/>`
  s += `<rect x="0" y="${fx(h * 0.72)}" width="${w}" height="${fx(h * 0.28)}" fill="${LEATH_DIM}" opacity="0.6"/>` // shadowed base
  s += `<path d="${crestLine} L ${fx(w)} ${fx(crest + h * 0.12)}" fill="none" stroke="${LEATH_LIT}" stroke-width="5" opacity="0.7"/>` // lit lip
  // tooled gold rule along the blotter edge
  s += `<path d="${crestLine} L ${fx(w)} ${fx(crest + h * 0.12)}" fill="none" stroke="${GOLD}" stroke-width="1.6" opacity="0.4" stroke-dasharray="10 6"/>`
  // a few sealed letters lying along the band
  for (let i = 0; i < 4; i++) {
    const lx = w * (0.12 + i * 0.22) + rr(r, -8, 8)
    const ly = crest + h * (0.24 + (i % 2) * 0.12)
    const lw = w * 0.14,
      lh = h * 0.24
    s += `<g transform="rotate(${fx(rr(r, -8, 8))} ${fx(lx)} ${fx(ly)})">`
    s += `<rect x="${fx(lx - lw / 2)}" y="${fx(ly)}" width="${fx(lw)}" height="${fx(lh)}" rx="3" fill="#efe1bd" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.35"/>`
    s += `<circle cx="${fx(lx)}" cy="${fx(ly + lh * 0.5)}" r="${fx(lw * 0.16)}" fill="${SEAL_RED}"/>` // wax seal
    s += `</g>`
  }
  s += rimPath(`${crestLine} L ${fx(w)} ${fx(crest + h * 0.12)}`, 4)
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE DESK TUFT (s9 end-mound-tuft, rider on the band ridge — was a grass
// reed clump). A little upright cluster on the desk lip: a quill standing in an
// inkpot beside a stacked pair of wax-sealed letters. ----
function deskTuft(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  // a small stack of letters as the silhouette base
  const gb = `M ${fx(w * 0.16)} ${fx(h)} L ${fx(w * 0.16)} ${fx(h * 0.52)} L ${fx(w * 0.84)} ${fx(h * 0.52)} L ${fx(w * 0.84)} ${fx(h)} Z`
  let s = `<g>`
  s += `<rect x="${fx(w * 0.16)}" y="${fx(h * 0.52)}" width="${fx(w * 0.68)}" height="${fx(h * 0.46)}" fill="#efe1bd" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.4"/>`
  s += `<rect x="${fx(w * 0.2)}" y="${fx(h * 0.6)}" width="${fx(w * 0.6)}" height="${fx(h * 0.34)}" fill="#e4d2a6" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.3"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(h * 0.72)}" r="${fx(w * 0.1)}" fill="${SEAL_RED}" stroke="#4a141c" stroke-width="1.6"/>` // wax seal
  s += `<circle cx="${fx(cx - w * 0.03)}" cy="${fx(h * 0.7)}" r="${fx(w * 0.045)}" fill="${SEAL_RED_LIT}" opacity="0.5"/>`
  // a quill leaning out of an inkpot on the left
  s += `<rect x="${fx(w * 0.16)}" y="${fx(h * 0.4)}" width="${fx(w * 0.16)}" height="${fx(h * 0.16)}" rx="3" fill="${INK}" opacity="0.75"/>` // inkpot
  s += `<path d="M ${fx(w * 0.24)} ${fx(h * 0.44)} Q ${fx(w * 0.5)} ${fx(h * 0.1)} ${fx(w * 0.7)} ${fx(h * 0.02)}" fill="none" stroke="${GOLD_LIT}" stroke-width="4" opacity="0.9"/>` // quill shaft
  s += `<path d="M ${fx(w * 0.6)} ${fx(h * 0.08)} Q ${fx(w * 0.72)} ${fx(h * 0.02)} ${fx(w * 0.7)} ${fx(h * 0.02)} Q ${fx(w * 0.66)} ${fx(h * 0.12)} ${fx(w * 0.6)} ${fx(h * 0.08)} Z" fill="${GOLD}" opacity="0.8"/>` // feather vane
  s += rimPath(gb, 4)
  void r
  s += `</g>`
  return svgPiece(w, h, s)
}

// ============================================================================
// WAVE 2 — box faces (s3 hive, s5 chest, s6 stall), platform decks, dress
// patches, the meadow fringe, the gold hoard, and the keep's fan spire.
// ============================================================================

// Box faces are OPAQUE and fill the whole quad (the mesh IS the face rect — no
// alpha silhouette). Front caps carry detail; side/back/top are slivers. Split
// faces (front/back/top) are ONE image with the crease at u=0.5, so designs are
// symmetric about centre; the -side image prints on both walls.
function boxFace(w, h, seed, face, kind) {
  const r = mulberry32(seed)
  const border = (fill, ink = INK) =>
    `<rect x="1.5" y="1.5" width="${fx(w - 3)}" height="${fx(h - 3)}" fill="none" stroke="${ink}" stroke-width="2.4" opacity="0.4"/>`
  const plank = (vert, n, col) => {
    let s = ''
    for (let i = 1; i < n; i++) {
      const p = ((vert ? w : h) * i) / n
      s += vert
        ? `<line x1="${fx(p)}" y1="0" x2="${fx(p)}" y2="${h}" stroke="${col}" stroke-width="2" opacity="0.45"/>`
        : `<line x1="0" y1="${fx(p)}" x2="${w}" y2="${fx(p)}" stroke="${col}" stroke-width="2" opacity="0.45"/>`
    }
    return s
  }
  if (kind === 'hive') {
    const WOOD = '#c39a5e',
      WLIT = '#dcb87c',
      WDIM = '#946f3f'
    let s = `<rect width="${w}" height="${h}" fill="${WOOD}"/>`
    s += `<rect width="${fx(w * 0.5)}" height="${h}" fill="${WLIT}" opacity="0.16"/>`
    if (face === 'front' || face === 'back') {
      // stacked hive "supers" — two banded boxes with a landing slot
      s += plank(false, 3, WDIM)
      s += `<rect x="0" y="${fx(h * 0.32)}" width="${w}" height="4" fill="${WDIM}"/>`
      s += `<rect x="0" y="${fx(h * 0.64)}" width="${w}" height="4" fill="${WDIM}"/>`
      if (face === 'front') {
        s += `<rect x="${fx(w * 0.3)}" y="${fx(h * 0.82)}" width="${fx(w * 0.4)}" height="${fx(h * 0.06)}" rx="3" fill="#3a2a18"/>` // entrance
        s += `<rect x="${fx(w * 0.24)}" y="${fx(h * 0.88)}" width="${fx(w * 0.52)}" height="${fx(h * 0.05)}" fill="${WLIT}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.4"/>` // landing board
        // a couple of bees
        for (const [bx, by] of [[0.42, 0.7], [0.6, 0.5]]) {
          s += `<ellipse cx="${fx(w * bx)}" cy="${fx(h * by)}" rx="7" ry="4.5" fill="${GOLD}" stroke="${INK}" stroke-width="1.4"/>`
          s += `<line x1="${fx(w * bx - 3)}" y1="${fx(h * by)}" x2="${fx(w * bx + 3)}" y2="${fx(h * by)}" stroke="${INK}" stroke-width="1.4"/>`
        }
      }
    } else if (face === 'top') {
      s += plank(false, 4, WDIM)
      s += `<rect x="${fx(w * 0.4)}" y="${fx(h * 0.4)}" width="${fx(w * 0.2)}" height="${fx(h * 0.2)}" rx="3" fill="${WLIT}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.4"/>` // lid knob
    } else {
      s += plank(true, 4, WDIM)
    }
    s += border(WOOD)
    return svgPiece(w, h, s)
  }
  if (kind === 'chest') {
    // VAULT_NIGHT regrade (E3 s5): walnut-BLACK strongchest, foil glints —
    // the enclosure goes quiet and dark so the dragon's foil reads as the
    // one glowing thing in the spread.
    const WOOD = '#3a2418',
      WLIT = '#553520',
      WDIM = '#221409',
      IRON = '#33333e',
      ILIT = '#5a5a68'
    let s = `<rect width="${w}" height="${h}" fill="${WOOD}"/>`
    s += `<rect width="${fx(w * 0.5)}" height="${h}" fill="${WLIT}" opacity="0.18"/>`
    // foil glow spilling over the top edge (the chest is open)
    s += `<rect x="0" y="0" width="${w}" height="${fx(h * 0.14)}" fill="${VAULT.foilLit}" opacity="0.38"/>`
    if (face === 'front' || face === 'back') {
      s += plank(false, 4, WDIM)
      const straps = face === 'front' ? [0.22, 0.5, 0.78] : [0.3, 0.7]
      for (const sx of straps) {
        s += `<rect x="${fx(w * sx - w * 0.02)}" y="0" width="${fx(w * 0.04)}" height="${h}" fill="${IRON}"/>`
        s += `<rect x="${fx(w * sx - w * 0.02)}" y="0" width="${fx(w * 0.012)}" height="${h}" fill="${ILIT}" opacity="0.6"/>`
        for (const ry of [0.2, 0.5, 0.8]) s += `<circle cx="${fx(w * sx)}" cy="${fx(h * ry)}" r="3.5" fill="${ILIT}" stroke="${INK}" stroke-width="1"/>`
      }
      if (face === 'front') {
        s += `<rect x="${fx(w * 0.44)}" y="${fx(h * 0.36)}" width="${fx(w * 0.12)}" height="${fx(h * 0.28)}" rx="3" fill="${VAULT.foil}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.5"/>` // lock plate
        s += `<rect x="${fx(w * 0.445)}" y="${fx(h * 0.37)}" width="${fx(w * 0.025)}" height="${fx(h * 0.26)}" fill="${VAULT.foilHi}" opacity="0.5"/>` // foil glint
      }
    } else {
      s += plank(true, 3, WDIM)
      s += `<rect x="${fx(w * 0.44)}" y="0" width="${fx(w * 0.12)}" height="${h}" fill="${IRON}"/>` // corner strap
      s += `<rect x="${fx(w * 0.44)}" y="0" width="${fx(w * 0.03)}" height="${h}" fill="${ILIT}" opacity="0.6"/>`
    }
    s += border(WOOD)
    return svgPiece(w, h, s)
  }
  if (kind === 'strongbox') {
    // banker's strongbox — teal steel with brass/gold reinforced corners,
    // rivets, a big gold lock (northern palette). Aurora sheen highlight.
    const STEEL = '#2e5244',
      SLIT = '#3f6b5a',
      SDIM = '#1c352b',
      AUR = '#4fd6b8'
    let s = `<rect width="${w}" height="${h}" fill="${STEEL}"/>`
    s += `<rect width="${fx(w * 0.5)}" height="${h}" fill="${SLIT}" opacity="0.35"/>`
    s += `<rect x="0" y="0" width="${w}" height="${fx(h * 0.12)}" fill="${AUR}" opacity="0.16"/>` // aurora sheen
    // gold reinforced corner brackets on every face
    const corner = (cx2, cy2, sx, sy) =>
      `<path d="M ${fx(cx2)} ${fx(cy2 + sy * h * 0.22)} L ${fx(cx2)} ${fx(cy2)} L ${fx(cx2 + sx * w * 0.14)} ${fx(cy2)}" fill="none" stroke="${GOLD}" stroke-width="6" opacity="0.9"/>`
    s += corner(w * 0.04, h * 0.06, 1, 1) + corner(w * 0.96, h * 0.06, -1, 1) + corner(w * 0.04, h * 0.94, 1, -1) + corner(w * 0.96, h * 0.94, -1, -1)
    if (face === 'front' || face === 'back') {
      for (const sx of [0.5]) {
        for (const ry of [0.18, 0.5, 0.82]) s += `<circle cx="${fx(w * 0.5)}" cy="${fx(h * ry)}" r="3.5" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1"/>`
        void sx
      }
      if (face === 'front') {
        s += `<rect x="${fx(w * 0.42)}" y="${fx(h * 0.34)}" width="${fx(w * 0.16)}" height="${fx(h * 0.34)}" rx="4" fill="${GOLD}" stroke="${INK}" stroke-width="2" stroke-opacity="0.5"/>` // lock plate
        s += `<circle cx="${fx(w * 0.5)}" cy="${fx(h * 0.46)}" r="${fx(w * 0.02)}" fill="${SDIM}"/>` // keyhole
        s += `<rect x="${fx(w * 0.48)}" y="${fx(h * 0.46)}" width="${fx(w * 0.04)}" height="${fx(h * 0.12)}" fill="${SDIM}"/>`
      }
    } else {
      for (let i = 1; i < 4; i++) for (const ry of [0.3, 0.7]) s += `<circle cx="${fx((w * i) / 4)}" cy="${fx(h * ry)}" r="3" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="0.9"/>` // rivets
    }
    s += border(STEEL)
    return svgPiece(w, h, s)
  }
  if (kind === 'barn') {
    // stable/barn — timber-framed plank wood with a shingled gable
    const WOOD = '#a9773f',
      WLIT = '#c49256',
      WDIM = '#6b4522'
    let s = `<rect width="${w}" height="${h}" fill="${WOOD}"/>`
    s += `<rect width="${fx(w * 0.5)}" height="${h}" fill="${WLIT}" opacity="0.16"/>`
    if (face === 'top') {
      // wood-shingle gable roof, ridge at u=0.5
      s += plank(false, 8, WDIM)
      for (let i = 0; i < 8; i++) {
        const y = (h * i) / 8
        s += `<path d="M 0 ${fx(y)} q ${fx(w * 0.06)} 5 ${fx(w * 0.12)} 0" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.4"/>`
      }
      s += `<rect x="${fx(w * 0.48)}" y="0" width="${fx(w * 0.04)}" height="${h}" fill="${WLIT}" opacity="0.6"/>` // ridge cap
    } else if (face === 'back') {
      s += plank(false, 5, WDIM)
      s += `<rect x="${fx(w * 0.38)}" y="${fx(h * 0.12)}" width="${fx(w * 0.24)}" height="${fx(h * 0.24)}" fill="#3a2a18" stroke="${WDIM}" stroke-width="3"/>` // loft opening
      s += `<line x1="${fx(w * 0.5)}" y1="${fx(h * 0.12)}" x2="${fx(w * 0.5)}" y2="${fx(h * 0.36)}" stroke="${WDIM}" stroke-width="2"/>`
    } else {
      // side wall — E3 s2 COACH-HOUSE re-skin (scene pack, optional item):
      // the timber frame keeps one diagonal brace, and a mail-coach wheel +
      // draw tongue lean against the wall with a small lantern at the open
      // front edge (u=1 side, toward the reader).
      s += plank(true, 6, WDIM)
      s += `<rect x="${fx(w * 0.06)}" y="${fx(h * 0.1)}" width="${fx(w * 0.88)}" height="${fx(h * 0.82)}" fill="none" stroke="${WDIM}" stroke-width="6"/>`
      s += `<line x1="${fx(w * 0.06)}" y1="${fx(h * 0.1)}" x2="${fx(w * 0.94)}" y2="${fx(h * 0.92)}" stroke="${WDIM}" stroke-width="5"/>`
      // THE MAIL-COACH WHEEL: a big spoked wheel resting against the frame
      const wx = w * 0.36
      const wy = h * 0.62
      const WR = w * 0.24
      s += `<circle cx="${fx(wx)}" cy="${fx(wy)}" r="${fx(WR)}" fill="none" stroke="${WDIM}" stroke-width="9"/>`
      s += `<circle cx="${fx(wx)}" cy="${fx(wy)}" r="${fx(WR)}" fill="none" stroke="${IRON}" stroke-width="3"/>` // iron tyre
      for (let sp = 0; sp < 8; sp++) {
        const a = (sp * Math.PI) / 4 + 0.2
        s += `<line x1="${fx(wx)}" y1="${fx(wy)}" x2="${fx(wx + Math.cos(a) * WR * 0.92)}" y2="${fx(wy + Math.sin(a) * WR * 0.92)}" stroke="${WDIM}" stroke-width="4.4"/>`
      }
      s += `<circle cx="${fx(wx)}" cy="${fx(wy)}" r="${fx(WR * 0.2)}" fill="${WDIM}" stroke="${IRON}" stroke-width="2.4"/>` // hub
      s += `<circle cx="${fx(wx)}" cy="${fx(wy)}" r="${fx(WR * 0.07)}" fill="${IRON_LIT}"/>`
      // THE DRAW TONGUE leaning past the wheel
      s += `<line x1="${fx(w * 0.14)}" y1="${fx(h * 0.9)}" x2="${fx(w * 0.68)}" y2="${fx(h * 0.24)}" stroke="${WDIM}" stroke-width="7" stroke-linecap="round"/>`
      s += `<line x1="${fx(w * 0.14)}" y1="${fx(h * 0.9)}" x2="${fx(w * 0.68)}" y2="${fx(h * 0.24)}" stroke="${WLIT}" stroke-width="2.2" opacity="0.5" stroke-linecap="round"/>`
      s += `<circle cx="${fx(w * 0.68)}" cy="${fx(h * 0.24)}" r="4" fill="${IRON}"/>` // hitch ring
      // THE LANTERN by the open front (u=1 edge), a warm dot in the dusk
      s += `<circle cx="${fx(w * 0.87)}" cy="${fx(h * 0.34)}" r="${fx(w * 0.075)}" fill="${GOLD_LIT}" opacity="0.22"/>`
      s += `<rect x="${fx(w * 0.855)}" y="${fx(h * 0.3)}" width="${fx(w * 0.03)}" height="${fx(h * 0.07)}" fill="${GOLD_LIT}" stroke="${IRON}" stroke-width="2.4"/>`
      s += `<path d="M ${fx(w * 0.855)} ${fx(h * 0.3)} L ${fx(w * 0.87)} ${fx(h * 0.28)} L ${fx(w * 0.885)} ${fx(h * 0.3)} Z" fill="${IRON}"/>`
      s += `<line x1="${fx(w * 0.87)}" y1="${fx(h * 0.28)}" x2="${fx(w * 0.87)}" y2="${fx(h * 0.25)}" stroke="${IRON}" stroke-width="2.2"/>`
    }
    s += border(WOOD)
    return svgPiece(w, h, s)
  }
  // stall — timber + striped canvas
  const CANVAS = '#efe3c6',
    STRIPE = '#b5503f',
    TIMBER = '#7a5433',
    TDIM = '#553a22'
  let s = `<rect width="${w}" height="${h}" fill="${CANVAS}"/>`
  if (face === 'top') {
    // striped canopy (the reader-visible canvas roof)
    const stripes = 9
    for (let i = 0; i < stripes; i++) {
      if (i % 2) s += `<rect x="${fx((w * i) / stripes)}" y="0" width="${fx(w / stripes)}" height="${h}" fill="${STRIPE}"/>`
    }
    s += `<rect x="0" y="0" width="${w}" height="${fx(h * 0.5)}" fill="#ffffff" opacity="0.14"/>`
    s += `<line x1="0" y1="${fx(h * 0.5)}" x2="${w}" y2="${fx(h * 0.5)}" stroke="${INK}" stroke-width="1.6" opacity="0.2"/>` // ridge
  } else if (face === 'back') {
    // interior back wall hung with wares
    s += `<rect width="${w}" height="${h}" fill="#d8c39a"/>`
    s += `<rect x="0" y="${fx(h * 0.5)}" width="${w}" height="6" fill="${TIMBER}"/>` // shelf
    for (let i = 0; i < 5; i++) {
      const jx = lerp(w * 0.12, w * 0.88, i / 4)
      s += `<rect x="${fx(jx - w * 0.05)}" y="${fx(h * 0.28)}" width="${fx(w * 0.1)}" height="${fx(h * 0.22)}" rx="4" fill="${i % 2 ? '#a9713f' : '#8a9a54'}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.4"/>` // jars
    }
    s += plank(false, 5, '#b89b6a')
  } else {
    // side wall (camera-facing): a striped canvas awning wall over a timber
    // post frame, with a cast shadow low — no longer a flat tan panel.
    const stripes = 8
    for (let i = 0; i < stripes; i++)
      s += `<rect x="${fx((w * i) / stripes)}" y="0" width="${fx(w / stripes)}" height="${fx(h * 0.6)}" fill="${i % 2 ? STRIPE : CANVAS}"/>`
    // scalloped canvas hem across the middle
    let hem = `M 0 ${fx(h * 0.6)}`
    for (let i = stripes; i >= 0; i--) hem += ` Q ${fx((w * (i - 0.5)) / stripes)} ${fx(h * 0.68)} ${fx((w * (i - 1)) / stripes)} ${fx(h * 0.6)}`
    s += `<path d="${hem} L 0 ${fx(h * 0.6)} Z" fill="${STRIPE}" opacity="0.5"/>`
    s += `<rect x="0" y="0" width="${w}" height="${fx(h * 0.6)}" fill="#ffffff" opacity="0.1"/>` // canvas sheen
    // timber post frame below the awning + interior shadow
    s += `<rect x="0" y="${fx(h * 0.6)}" width="${w}" height="${fx(h * 0.4)}" fill="#cdb488"/>`
    s += `<rect x="0" y="${fx(h * 0.6)}" width="${w}" height="${fx(h * 0.4)}" fill="${INK}" opacity="0.22"/>` // stall interior shade
    s += `<rect x="${fx(w * 0.06)}" y="${fx(h * 0.58)}" width="${fx(w * 0.07)}" height="${fx(h * 0.42)}" fill="${TIMBER}"/>`
    s += `<rect x="${fx(w * 0.87)}" y="${fx(h * 0.58)}" width="${fx(w * 0.07)}" height="${fx(h * 0.42)}" fill="${TIMBER}"/>`
    s += `<rect x="0" y="${fx(h * 0.58)}" width="${w}" height="5" fill="${TDIM}"/>` // beam
  }
  s += border(CANVAS)
  return svgPiece(w, h, s)
}

// ---- PLATFORM DECKS (opaque, full-quad; u across width split at qA/(qA+qB),
// v along depth). One painter, content by kind. ----
function deckSurface(w, h, seed, kind) {
  const r = mulberry32(seed)
  if (kind === 'meadow') {
    let s = `<rect width="${w}" height="${h}" fill="#7d9a55"/>`
    s += `<rect width="${w}" height="${fx(h * 0.4)}" fill="#8fac66" opacity="0.5"/>` // lit far edge
    for (let i = 0; i < 70; i++) {
      const x = rr(r, 0, w),
        y = rr(r, 0, h)
      s += `<path d="M ${fx(x)} ${fx(y)} l ${fx(rr(r, -3, 3))} ${fx(-rr(r, 6, 14))}" stroke="${r() < 0.5 ? '#6f8a48' : '#a2bd76'}" stroke-width="2" opacity="0.7"/>` // grass
    }
    for (let i = 0; i < 14; i++) {
      const x = rr(r, w * 0.05, w * 0.95),
        y = rr(r, h * 0.2, h * 0.9)
      const c = ['#d9a441', '#c46a6a', '#e6e0b0'][i % 3]
      s += `<circle cx="${fx(x)}" cy="${fx(y)}" r="${fx(rr(r, 4, 7))}" fill="${c}" stroke="${INK}" stroke-width="1" stroke-opacity="0.35"/>` // wildflowers
    }
    return svgPiece(w, h, s)
  }
  if (kind === 'hoard') {
    // VAULT_NIGHT regrade (E3 s5): the deep-band gold heap under night —
    // foil-ramp coins over a walnut-shadow base, moon-bright along the crest.
    let s = `<rect width="${w}" height="${h}" fill="#4a3413"/>` // shadowed base under coins
    // heaped coins, brighter along the crest (top edge = far)
    for (let i = 0; i < 240; i++) {
      const x = rr(r, 0, w),
        y = rr(r, 0, h)
      const cr = rr(r, 5, 11)
      const shade = y < h * 0.5 ? 1 : 0.62
      s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.72)}" fill="${r() < 0.5 ? VAULT.foil : VAULT.foilLit}" opacity="${shade}" stroke="${VAULT.foilDeep}" stroke-width="1"/>`
      if (r() < 0.18) s += `<ellipse cx="${fx(x - cr * 0.24)}" cy="${fx(y - cr * 0.2)}" rx="${fx(cr * 0.3)}" ry="${fx(cr * 0.18)}" fill="${VAULT.foilHi}" opacity="0.8"/>`
    }
    s += `<rect width="${w}" height="${fx(h * 0.28)}" fill="${VAULT.foilHi}" opacity="0.2"/>`
    // a few gems — the thin-film accents (teal/magenta, the holographic hint)
    for (let i = 0; i < 6; i++) {
      const x = rr(r, w * 0.1, w * 0.9),
        y = rr(r, h * 0.2, h * 0.8)
      s += `<path d="M ${fx(x)} ${fx(y - 6)} l 6 6 l -6 6 l -6 -6 Z" fill="${[VAULT.film1, '#c8434e', VAULT.film2][i % 3]}" stroke="${INK}" stroke-width="1" stroke-opacity="0.4"/>`
    }
    return svgPiece(w, h, s)
  }
  if (kind === 'yard') {
    // coaching-yard cobbles: grey setts with wheel ruts + scattered straw
    let s = `<rect width="${w}" height="${h}" fill="#8f8778"/>`
    s += `<rect width="${w}" height="${fx(h * 0.34)}" fill="#a39a88" opacity="0.5"/>`
    for (let i = 0; i < 120; i++) {
      const x = rr(r, 0, w),
        y = rr(r, 0, h)
      s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(rr(r, 8, 16))}" ry="${fx(rr(r, 6, 10))}" fill="${r() < 0.5 ? '#847c6e' : '#9a9184'}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.3"/>`
    }
    // wheel ruts
    for (const ry of [0.4, 0.6]) s += `<path d="M 0 ${fx(h * ry)} Q ${fx(w / 2)} ${fx(h * (ry + 0.04))} ${fx(w)} ${fx(h * ry)}" fill="none" stroke="${INK}" stroke-width="4" opacity="0.2"/>`
    for (let i = 0; i < 24; i++) s += `<line x1="${fx(rr(r, 0, w))}" y1="${fx(rr(r, 0, h))}" x2="${fx(rr(r, 0, w) + rr(r, -12, 12))}" y2="${fx(rr(r, 0, h) + rr(r, -4, 4))}" stroke="#c9b070" stroke-width="1.8" opacity="0.6"/>` // straw
    return svgPiece(w, h, s)
  }
  if (kind === 'glass') {
    // treasury's glass gallery deck — teal glass panels in a gold frame
    // (northern palette), a bright aurora reflection streak.
    let s = `<rect width="${w}" height="${h}" fill="#274a3f"/>`
    const cols = 7,
      rows = 3
    for (let ci = 0; ci < cols; ci++)
      for (let ri = 0; ri < rows; ri++) {
        const x = (w * ci) / cols,
          y = (h * ri) / rows
        const tint = (ci + ri) % 2 ? '#356b5b' : '#2e5a4c'
        s += `<rect x="${fx(x + 2)}" y="${fx(y + 2)}" width="${fx(w / cols - 4)}" height="${fx(h / rows - 4)}" fill="${tint}"/>`
        s += `<path d="M ${fx(x + 4)} ${fx(y + h / rows - 6)} L ${fx(x + w / cols * 0.5)} ${fx(y + 6)}" stroke="#7fe6cf" stroke-width="2" opacity="0.45"/>` // glass glint
      }
    // gold mullion grid
    for (let ci = 0; ci <= cols; ci++) s += `<line x1="${fx((w * ci) / cols)}" y1="0" x2="${fx((w * ci) / cols)}" y2="${h}" stroke="${GOLD}" stroke-width="3" opacity="0.85"/>`
    for (let ri = 0; ri <= rows; ri++) s += `<line x1="0" y1="${fx((h * ri) / rows)}" x2="${w}" y2="${fx((h * ri) / rows)}" stroke="${GOLD}" stroke-width="3" opacity="0.85"/>`
    s += `<rect x="0" y="${fx(h * 0.1)}" width="${w}" height="${fx(h * 0.12)}" fill="#7fe6cf" opacity="0.18"/>` // aurora reflection
    return svgPiece(w, h, s)
  }
  // goods — laid-out market wares (rolled carpets, crates, fruit)
  let s = `<rect width="${w}" height="${h}" fill="#b89b6a"/>` // table boards
  s += `<rect width="${w}" height="${fx(h * 0.34)}" fill="#c9ad7c" opacity="0.5"/>`
  // rolled carpets
  for (let i = 0; i < 3; i++) {
    const y = lerp(h * 0.2, h * 0.8, i / 2)
    const col = ['#a63d2f', '#3f6f6a', '#c4766a'][i]
    s += `<rect x="${fx(w * 0.08)}" y="${fx(y - h * 0.06)}" width="${fx(w * 0.5)}" height="${fx(h * 0.12)}" rx="${fx(h * 0.06)}" fill="${col}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.4"/>`
    s += `<ellipse cx="${fx(w * 0.08)}" cy="${fx(y)}" rx="${fx(h * 0.05)}" ry="${fx(h * 0.06)}" fill="${col}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.5"/>`
  }
  // fruit baskets
  for (let i = 0; i < 4; i++) {
    const x = rr(r, w * 0.66, w * 0.92),
      y = rr(r, h * 0.2, h * 0.85)
    s += `<circle cx="${fx(x)}" cy="${fx(y)}" r="${fx(h * 0.07)}" fill="#8a6438" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.4"/>`
    for (let k = 0; k < 5; k++) s += `<circle cx="${fx(x + rr(r, -6, 6))}" cy="${fx(y - rr(r, 0, 6))}" r="3.5" fill="${['#d9a441', '#c46a6a', '#8a9a54'][k % 3]}"/>`
  }
  return svgPiece(w, h, s)
}

// ---- THE MEADOW FRINGE (s3 ch2-fringe, foreground vfold, very wide/short —
// the old flat "blue wave strip"). A low alpine meadow band: grass tufts and
// wildflowers along a lit ridge, transparent above. Crease centre. ----
function meadowFringe(w, h, seed) {
  const r = mulberry32(seed)
  const crest = h * 0.36
  let ridge = `M 0 ${fx(h)} L 0 ${fx(crest + h * 0.12)}`
  const n = 14
  const pts = []
  for (let i = 0; i <= n; i++) pts.push([(w * i) / n, crest + Math.sin(i * 1.3 + seed) * h * 0.08 + rr(r, -h * 0.04, h * 0.04)])
  for (let i = 0; i < pts.length; i++) ridge += ` L ${fx(pts[i][0])} ${fx(pts[i][1])}`
  const crestLine = ridge
  ridge += ` L ${fx(w)} ${fx(h)} Z`
  let s = `<g>`
  s += `<path d="${ridge}" fill="#6f8a4a"/>`
  s += `<rect x="0" y="${fx(h * 0.7)}" width="${w}" height="${fx(h * 0.3)}" fill="#4f6a34" opacity="0.5"/>`
  s += `<path d="${crestLine}" fill="none" stroke="#8fac66" stroke-width="5" opacity="0.7"/>`
  // grass blades + wildflowers along the ridge
  const blades = 60
  for (let i = 0; i < blades; i++) {
    const x = (w * i) / blades + rr(r, -4, 4)
    const seg = Math.min(n, Math.round((x / w) * n))
    const y = pts[seg] ? pts[seg][1] : crest
    const bh = rr(r, h * 0.1, h * 0.26)
    s += `<path d="M ${fx(x)} ${fx(y)} q ${fx(rr(r, -5, 5))} ${fx(-bh)} ${fx(rr(r, -3, 3))} ${fx(-bh)}" fill="none" stroke="${i % 2 ? '#6f8a4a' : '#8fac66'}" stroke-width="2" opacity="0.8"/>`
    if (i % 7 === 3) s += `<circle cx="${fx(x)}" cy="${fx(y - bh)}" r="4" fill="${['#d9a441', '#c46a6a', '#e6e0b0', '#8a6fd6'][i % 4]}" stroke="${INK}" stroke-width="0.9" stroke-opacity="0.35"/>`
  }
  s += rimPath(crestLine, 4)
  // E3 s3 repaint: two couriers perched ON the crest (touching the ridge so
  // the die-cut stays paper-true — no floating alpha islands), gold dashed
  // flight trails leading up toward the 3D ring overhead (pack §4d).
  for (const [bx, bs] of [[0.24, 0.13], [0.71, 0.11]]) {
    const seg = Math.min(n, Math.round(bx * n))
    const ridgeY = pts[seg] ? pts[seg][1] : crest
    const y = ridgeY - h * bs * 0.45
    s += swarmBee(w * bx, y, h * bs, 'wingsMid')
    s += `<path d="M ${fx(w * bx + h * 0.12)} ${fx(y - h * 0.1)} q ${fx(h * 0.12)} ${fx(-h * 0.1)} ${fx(h * 0.3)} ${fx(-h * 0.13)}" fill="none" stroke="${SWARM.gold}" stroke-width="1.6" stroke-dasharray="4 4" opacity="0.7"/>`
  }
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE GOLD HOARD MOUND (s5 ch4-goldpile-face, tabpiece face). Fills the
// unfolded die-cut with a heap of coins, brightest along the centre ridge (the
// mound's crest at v-mid) so the folded prism reads as a gleaming pile. ----
function goldHeap(w, h, seed) {
  const r = mulberry32(seed)
  // VAULT_NIGHT regrade (E3 s5): the mound keeps its high-key gleam (it is
  // the declared spread hero growing out of the fore edge) but speaks the
  // foil ramp — foilDeep shadows, foilHi speculars, thin-film gem accents.
  let s = `<rect width="${w}" height="${h}" fill="#c99a30"/>`
  s += `<rect x="0" y="${fx(h * 0.32)}" width="${w}" height="${fx(h * 0.36)}" fill="#f2cf6e" opacity="0.55"/>` // crest sheen
  // a crown + goblet as centrepiece treasure
  s += `<path d="M ${fx(w * 0.4)} ${fx(h * 0.5)} L ${fx(w * 0.4)} ${fx(h * 0.4)} L ${fx(w * 0.45)} ${fx(h * 0.46)} L ${fx(w * 0.5)} ${fx(h * 0.38)} L ${fx(w * 0.55)} ${fx(h * 0.46)} L ${fx(w * 0.6)} ${fx(h * 0.4)} L ${fx(w * 0.6)} ${fx(h * 0.5)} Z" fill="#fff1bd" stroke="${INK}" stroke-width="2" stroke-opacity="0.5"/>`
  for (const jx of [0.45, 0.5, 0.55]) s += `<circle cx="${fx(w * jx)}" cy="${fx(h * 0.41)}" r="4" fill="#c04a54" stroke="${INK}" stroke-width="1" stroke-opacity="0.4"/>`
  for (let i = 0; i < 520; i++) {
    const x = rr(r, 0, w),
      y = rr(r, 0, h)
    const cr = rr(r, 7, 15)
    const bright = r() < 0.55
    s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.72)}" fill="${bright ? '#f2cf6e' : '#c99a30'}" stroke="#8f6415" stroke-width="1"/>`
    if (r() < 0.4) s += `<ellipse cx="${fx(x - cr * 0.22)}" cy="${fx(y - cr * 0.2)}" rx="${fx(cr * 0.32)}" ry="${fx(cr * 0.22)}" fill="#fff1bd" opacity="0.85"/>` // specular glint
  }
  // scattered gems catching light
  for (let i = 0; i < 12; i++) {
    const x = rr(r, w * 0.08, w * 0.92),
      y = rr(r, h * 0.12, h * 0.92)
    const g = ['#57a6cf', '#c8434e', '#5fb488', '#8a6fd6'][i % 4]
    s += `<path d="M ${fx(x)} ${fx(y - 9)} l 9 9 l -9 9 l -9 -9 Z" fill="${g}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.45"/>`
    s += `<path d="M ${fx(x)} ${fx(y - 9)} l 9 9 l -9 0 Z" fill="#ffffff" opacity="0.35"/>`
  }
  return svgPiece(w, h, s)
}

// ============================================================================
// THE VAULT NIGHT (E3 s5, "The Vault-Dragon of the Golden Dunes") — the dark
// register. Palette per the scene pack §4.4: plum-indigo night, violet dune
// shadow, burnished gold, ember accent, pale bone cut rims. Concentrated
// detail lives ONLY on the dragon + aureole (the precious objects); the rest
// of the spread stays quiet and dark so the foil reads as treasure.
// ============================================================================

const VAULT = {
  night: '#2b2140',
  nightDeep: '#1b1430',
  ink: '#2a1c14', // walnut-black linework
  duneLit: '#e0b04f',
  dune: '#b4832f',
  duneDim: '#5c4160',
  duneDeep: '#38294a',
  foilHi: '#fff1bd',
  foilLit: '#f2cf6e',
  foil: '#c99a30',
  foilDeep: '#8f6415',
  film1: '#3f8f82', // thin-film teal (<=10% of facets)
  film2: '#a85577', // thin-film magenta
  ember: '#d95f2b', // caravan sashes, PULL chevrons
  rim: '#f6eed7', // house core edge
}

/**
 * GOLD-FOIL SHIMMER (pack §4.4 — baked, zero shaders, zero extra draws):
 * facet a region into a seeded jittered triangle mesh; per facet a 4-stop
 * linear gradient (foilDeep -> foil -> foilLit -> foilHi) with angle jitter
 * +-14 deg around ONE global brushed-foil direction; ~10% of facets swap to
 * a thin-film teal/magenta ramp (the holographic hint); narrow white streak
 * bars along the global direction; sparse sparkle crosses at facet corners.
 * Returns { defs, body } — the caller clips `body` to its own silhouette.
 * Gradient ids are prefixed so several foil zones coexist in one SVG.
 */
function goldFoilFacets(r, pfx, x0, y0, x1, y1, cell, opts = {}) {
  const { filmShare = 0.1, sparkles = 12, streaks = 4, dir = -18 } = opts
  const cols = Math.max(1, Math.round((x1 - x0) / cell))
  const rows = Math.max(1, Math.round((y1 - y0) / cell))
  const lattice = []
  for (let j = 0; j <= rows; j++) {
    const row = []
    for (let i = 0; i <= cols; i++) {
      const jx = i === 0 || i === cols ? 0 : rr(r, -0.34, 0.34)
      const jy = j === 0 || j === rows ? 0 : rr(r, -0.34, 0.34)
      row.push([x0 + ((i + jx) * (x1 - x0)) / cols, y0 + ((j + jy) * (y1 - y0)) / rows])
    }
    lattice.push(row)
  }
  let defs = ''
  let body = ''
  let n = 0
  const corners = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const q = [lattice[j][i], lattice[j][i + 1], lattice[j + 1][i + 1], lattice[j + 1][i]]
      const tris =
        r() < 0.5
          ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]
          : [[q[0], q[1], q[3]], [q[1], q[2], q[3]]]
      for (const t of tris) {
        const id = `${pfx}f${n++}`
        const ang = dir + rr(r, -14, 14)
        const stops =
          r() < filmShare
            ? [[0, VAULT.film1], [0.42, VAULT.foilLit], [0.72, VAULT.film2], [1, VAULT.foilDeep]]
            : [
                [0, VAULT.foilDeep],
                [rr(r, 0.28, 0.44), VAULT.foil],
                [rr(r, 0.58, 0.74), VAULT.foilLit],
                [1, VAULT.foilHi],
              ]
        defs +=
          `<linearGradient id="${id}" gradientTransform="rotate(${fx(ang)} 0.5 0.5)">` +
          stops.map(([o, c]) => `<stop offset="${typeof o === 'number' ? o.toFixed(2) : o}" stop-color="${c}"/>`).join('') +
          `</linearGradient>`
        body += `<path d="M ${t.map((p) => `${fx(p[0])} ${fx(p[1])}`).join(' L ')} Z" fill="url(#${id})" stroke="${VAULT.foilDeep}" stroke-width="0.7" stroke-opacity="0.35"/>`
        if (r() < 0.22) corners.push(t[Math.floor(rr(r, 0, 3))])
      }
    }
  }
  // brushed streaks — narrow white bars along the global foil direction
  for (let k = 0; k < streaks; k++) {
    const cx = rr(r, x0, x1)
    const cy = rr(r, y0, y1)
    const len = rr(r, 0.35, 0.75) * (x1 - x0)
    const th = rr(r, 1.4, 3)
    body += `<rect x="${fx(cx - len / 2)}" y="${fx(cy - th / 2)}" width="${fx(len)}" height="${fx(th)}" rx="${fx(th / 2)}" fill="#ffffff" opacity="${rr(r, 0.09, 0.18).toFixed(2)}" transform="rotate(${fx(dir)} ${fx(cx)} ${fx(cy)})"/>`
  }
  // sparkle crosses at facet corners
  for (let k = 0; k < sparkles && corners.length > 0; k++) {
    const [sx, sy] = corners[Math.floor(rr(r, 0, corners.length))]
    const sr = rr(r, 2.4, 4.6)
    body +=
      `<path d="M ${fx(sx - sr)} ${fx(sy)} L ${fx(sx + sr)} ${fx(sy)} M ${fx(sx)} ${fx(sy - sr)} L ${fx(sx)} ${fx(sy + sr)}" stroke="${VAULT.foilHi}" stroke-width="1.2" opacity="0.9"/>` +
      `<circle cx="${fx(sx)}" cy="${fx(sy)}" r="${fx(sr * 0.28)}" fill="#ffffff" opacity="0.9"/>`
  }
  return { defs, body }
}

/** A dune rank's ridge profile: smooth seeded polyline over the row width,
 *  peaked at crestU, shoulders at the edges, optionally CAPPED inside a
 *  center window (the r3 notch — the bench-gated silhouette dip that frames
 *  the dragon). Returns [ [x, vFrac], ... ] with vFrac = 0 at the row base. */
function duneProfile(r, w, cfg) {
  const { crestU, crestV, edgeV, notch = null, wobble = 0.05, cols = 30 } = cfg
  const pts = []
  const phase = rr(r, 0, 6.28)
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
  for (let i = 0; i <= cols; i++) {
    const u = i / cols
    // main crest bump + a soft secondary swell, over a shoulder floor
    const bump = Math.exp(-(((u - crestU) / 0.24) ** 2))
    const swell = 0.3 * Math.exp(-(((u - (1 - crestU)) / 0.3) ** 2))
    let v = edgeV + (crestV - edgeV) * Math.min(1, bump + swell)
    v += wobble * Math.sin(u * 9.7 + phase) * Math.sin(u * 4.1 + phase * 1.7)
    if (notch) {
      // eased saddle down to the cap: the dip blends in over an ease band
      // OUTSIDE the window on each side (a dune bowl, never a cliff) — the
      // cap must already hold AT u0/u1, the bench-gated window edges
      const ease = 0.07
      const wIn = smooth((u - (notch.u0 - 2 * ease)) / (2 * ease)) * (1 - smooth((u - notch.u1) / (2 * ease)))
      const mid = (notch.u0 + notch.u1) / 2
      const sag = notch.capV * (0.9 + 0.1 * Math.cos(((u - mid) / (notch.u1 - notch.u0)) * Math.PI * 2))
      v = lerp(v, Math.min(v, sag), wIn)
    }
    pts.push([(w * i) / cols, Math.max(0.04, Math.min(0.985, v))])
  }
  return pts
}

/** Paints one dune rank row into its atlas band: transparent outside the
 *  silhouette (the alpha IS the die-cut), violet lee / gold windward flanks,
 *  a lit ridge lip, and the house rim on the cut edge. `style` picks the
 *  register: 'night' (r4: upper card = night sky + heat shimmer + wisps),
 *  'shadow' (r3: the dark notch bowl), 'lit' / 'fore' (the moonlit gold
 *  front banks). Optionally prints the micro-caravan on the lit face. */
function duneRankRow(r, pfx, w, y0, y1, cfg) {
  const H = y1 - y0
  const prof = duneProfile(r, w, cfg)
  const topY = (vf) => y1 - vf * H
  // silhouette path (row-bottom closed)
  let d = `M 0 ${fx(y1)} L ${fx(prof[0][0])} ${fx(topY(prof[0][1]))}`
  for (const [x, vf] of prof) d += ` L ${fx(x)} ${fx(topY(vf))}`
  d += ` L ${fx(w)} ${fx(y1)} Z`
  const clip = `${pfx}c`
  let defs =
    `<clipPath id="${clip}"><path d="${d}"/></clipPath>` +
    // hard row clip: NOTHING (rim strokes included) may bleed into the
    // neighboring atlas band — stray alpha there renders as floating specks
    // on the adjacent rank's mesh
    `<clipPath id="${pfx}row"><rect x="0" y="${fx(y0)}" width="${w}" height="${fx(y1 - y0)}"/></clipPath>` +
    `<linearGradient id="${pfx}sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${VAULT.nightDeep}"/><stop offset="1" stop-color="${VAULT.night}"/></linearGradient>` +
    `<linearGradient id="${pfx}lee" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${VAULT.duneDim}"/><stop offset="1" stop-color="${VAULT.duneDeep}"/></linearGradient>` +
    `<linearGradient id="${pfx}win" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${VAULT.duneLit}"/><stop offset="1" stop-color="${VAULT.dune}"/></linearGradient>`
  let s = `<g clip-path="url(#${pfx}row)">`
  s += `<g clip-path="url(#${clip})">`

  if (cfg.style === 'night') {
    // the great dune's upper card IS the night: sky fill, stars, heat-shimmer
    // columns rising off the (painted, lower) gold dune band
    s += `<rect x="0" y="${fx(y0)}" width="${w}" height="${fx(H)}" fill="url(#${pfx}sky)"/>`
    for (let i = 0; i < 46; i++) {
      const sx = rr(r, 0, w)
      const sy = y0 + rr(r, 0.02, 0.5) * H
      s += `<circle cx="${fx(sx)}" cy="${fx(sy)}" r="${fx(rr(r, 0.7, 1.7))}" fill="${VAULT.rim}" opacity="${rr(r, 0.25, 0.8).toFixed(2)}"/>`
    }
    // inner gold duneline (the lower ~55% of the card)
    const ridgeV = 0.52
    const inner = duneProfile(r, w, { crestU: cfg.crestU, crestV: ridgeV, edgeV: ridgeV * 0.62, wobble: 0.03 })
    let di = `M 0 ${fx(y1)}`
    for (const [x, vf] of inner) di += ` L ${fx(x)} ${fx(topY(vf))}`
    di += ` L ${fx(w)} ${fx(y1)} Z`
    // heat-shimmer columns rise from the inner ridge into the night
    for (let i = 0; i < 7; i++) {
      const cx = rr(r, w * 0.08, w * 0.92)
      const hgt = rr(r, 0.16, 0.34) * H
      const baseY = topY(ridgeV * 0.9)
      let path = `M ${fx(cx)} ${fx(baseY)}`
      for (let k = 1; k <= 5; k++) path += ` L ${fx(cx + Math.sin(k * 1.9 + i) * w * 0.008)} ${fx(baseY - (hgt * k) / 5)}`
      s += `<path d="${path}" fill="none" stroke="${VAULT.duneLit}" stroke-width="${fx(rr(r, 7, 15))}" opacity="${rr(r, 0.05, 0.11).toFixed(2)}" stroke-linecap="round"/>`
    }
    s += `<path d="${di}" fill="url(#${pfx}lee)"/>`
    // windward (lit) flank left of the crest
    let dw = `M 0 ${fx(y1)}`
    for (const [x, vf] of inner) {
      if (x / w > cfg.crestU + 0.02) break
      dw += ` L ${fx(x)} ${fx(topY(vf))}`
    }
    dw += ` L ${fx(w * (cfg.crestU + 0.02))} ${fx(y1)} Z`
    s += `<path d="${dw}" fill="url(#${pfx}win)" opacity="0.85"/>`
    // ridge lip
    let lip = ''
    for (const [x, vf] of inner) lip += (lip ? ' L' : 'M') + ` ${fx(x)} ${fx(topY(vf))}`
    s += `<path d="${lip}" fill="none" stroke="${VAULT.duneLit}" stroke-width="2.6" opacity="0.7"/>`
  } else {
    const litFlank = cfg.style === 'lit' || cfg.style === 'fore'
    // body: violet lee everywhere...
    s += `<rect x="0" y="${fx(y0)}" width="${w}" height="${fx(H)}" fill="url(#${pfx}lee)"/>`
    // ...gold windward flank LEFT of the crest (the key light's side), fading
    // OUT toward the ridge seam so the flank change reads as light, not a cut
    const uCut = cfg.crestU + 0.02
    defs += `<linearGradient id="${pfx}fade" x1="0" y1="0" x2="1" y2="0">` +
      `<stop offset="0" stop-color="#ffffff" stop-opacity="1"/>` +
      `<stop offset="0.72" stop-color="#ffffff" stop-opacity="1"/>` +
      `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>` +
      `<mask id="${pfx}fm"><rect x="0" y="${fx(y0)}" width="${fx(w * uCut)}" height="${fx(H)}" fill="url(#${pfx}fade)"/></mask>`
    s += `<rect x="0" y="${fx(y0)}" width="${fx(w * uCut)}" height="${fx(H)}" fill="url(#${pfx}win)" opacity="${litFlank ? 0.95 : 0.38}" mask="url(#${pfx}fm)"/>`
    // wind lines drifting down the flanks (diagonal, sparse — dune texture)
    for (let i = 0; i < 8; i++) {
      const x = rr(r, 0, w * 0.9)
      const vf = prof[Math.min(prof.length - 1, Math.round((x / w) * (prof.length - 1)))][1]
      const yTop = topY(vf * rr(r, 0.5, 0.8))
      const drop = (y1 - yTop) * rr(r, 0.5, 0.9)
      s += `<path d="M ${fx(x)} ${fx(yTop)} q ${fx(drop * 0.9)} ${fx(drop * 0.45)} ${fx(drop * 1.7)} ${fx(drop)}" fill="none" stroke="${x / w < uCut ? VAULT.dune : VAULT.duneDeep}" stroke-width="1.4" opacity="0.22"/>`
    }
    // sand ripples near the row foot
    for (let i = 0; i < 8; i++) {
      const y = y1 - rr(r, 0.04, 0.22) * H
      s += `<path d="M 0 ${fx(y)} Q ${fx(w * 0.5)} ${fx(y - H * 0.03)} ${fx(w)} ${fx(y)}" fill="none" stroke="${litFlank ? VAULT.dune : VAULT.duneDeep}" stroke-width="1.4" opacity="0.35"/>`
    }
    // ridge lip along the whole silhouette
    let lip = ''
    for (const [x, vf] of prof) lip += (lip ? ' L' : 'M') + ` ${fx(x)} ${fx(topY(vf))}`
    s += `<path d="${lip}" fill="none" stroke="${cfg.style === 'shadow' ? VAULT.dune : VAULT.duneLit}" stroke-width="2.2" opacity="${cfg.style === 'shadow' ? 0.5 : 0.75}"/>`
    if (cfg.style === 'fore') {
      // the transmutation hint: half-buried coins glinting in the fore bank
      // (ry pre-stretched ~1.11x for the r1 band's display aspect)
      for (let i = 0; i < 12; i++) {
        const x = rr(r, w * 0.05, w * 0.95)
        const y = y1 - rr(r, 0.08, 0.5) * H
        const cr = rr(r, 3, 6)
        s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.61)}" fill="${r() < 0.5 ? VAULT.foil : VAULT.foilLit}" stroke="${VAULT.foilDeep}" stroke-width="0.8"/>`
      }
    }
  }

  if (cfg.caravan) {
    // the SAME caravan again, tiny, printed on the lit face — farther along
    // its journey, walking toward the PULL tab (image-left = the left page).
    // The r2 atlas band displays 1.434x flatter than world (row px aspect vs
    // the rank's world aspect), so the glyphs pre-stretch vertically about
    // the ground line to display with true camel proportions.
    const cy = topY(prof[Math.round(prof.length * 0.3)][1] * 0.55)
    s += `<g transform="translate(0 ${fx(cy)}) scale(1 1.434) translate(0 ${fx(-cy)})">`
    for (let i = 0; i < 5; i++) {
      const x = w * (0.14 + i * 0.055)
      s += `<g transform="translate(${fx(x)} ${fx(cy)}) scale(-1 1) translate(${fx(-x)} ${fx(-cy)})">${camelGlyph(x, cy, H * 0.03, VAULT.nightDeep)}</g>`
      s += `<rect x="${fx(x - 1.6)}" y="${fx(cy - H * 0.045)}" width="3.2" height="2.6" fill="${VAULT.ember}"/>`
    }
    s += `</g>`
  }

  s += `</g>`
  s += rimPath(d, 3.4)
  s += `</g>` // row clip
  return { defs, body: s }
}

/** THE NOCTURNE MASSIF ATLAS (ch4-range, 1024x1024). Row layout is the
 *  runtime contract — keep byte-identical to MFOLD_ATLAS_ROWS in
 *  components/labs/storybook/book/popup-mfoldrange.ts: rows top->bottom
 *  r4 380 / r3 270 / r2 190 / r1 136 / gusset-left 24 / gusset-right 24.
 *  Rank stations/heights per content.ts ch4-range (the re-derived M-fold
 *  schedule); creaseU 0.44 / 0.60 / 0.35 / 0.65 = the diagonal drama. */
function rangeAtlas(w, h, seed) {
  const r = mulberry32(seed)
  const rows = [380, 270, 190, 136, 24, 24]
  let defs = ''
  let s = ''
  let y = 0
  const bands = rows.map((rh) => {
    const b = [y, y + rh]
    y += rh
    return b
  })
  // r4 greatdune — full-height night card, wispy die-cut sky edge
  {
    const out = duneRankRow(r, 'r4', w, bands[0][0], bands[0][1], {
      crestU: 0.44,
      crestV: 0.96,
      edgeV: 0.72,
      wobble: 0.028,
      style: 'night',
    })
    defs += out.defs
    s += out.body
  }
  // r3 — the dark bowl: tall shoulders, bench-gated NOTCH dip in |x|<0.45
  // (u in [0.35, 0.85] at w 1.80 / creaseU 0.60); cap 0.44 of h 0.50 = 0.22
  // world, well under the 0.36 ceiling (the "deepen to 0.30" fallback is
  // already satisfied — the bowl frames the dragon in shadow)
  {
    const out = duneRankRow(r, 'r3', w, bands[1][0], bands[1][1], {
      crestU: 0.13,
      crestV: 0.92,
      edgeV: 0.6,
      wobble: 0.04,
      style: 'shadow',
      notch: { u0: 0.35, u1: 0.85, capV: 0.44 },
    })
    defs += out.defs
    s += out.body
  }
  // r2 — moonlit mid bank, shallow saddle for air, printed micro-caravan
  {
    const out = duneRankRow(r, 'r2', w, bands[2][0], bands[2][1], {
      crestU: 0.35,
      crestV: 0.88,
      edgeV: 0.55,
      wobble: 0.05,
      style: 'lit',
      notch: { u0: 0.45, u1: 0.75, capV: 0.62 },
      caravan: true,
    })
    defs += out.defs
    s += out.body
  }
  // r1 — the low fore bank, brightest gold, coins surfacing
  {
    const out = duneRankRow(r, 'r1', w, bands[3][0], bands[3][1], {
      crestU: 0.65,
      crestV: 0.9,
      edgeV: 0.5,
      wobble: 0.06,
      style: 'fore',
    })
    defs += out.defs
    s += out.body
  }
  // gusset rows — the painted valley floor (page-flat strips): violet sand
  // with gold ripple fans + camel-track stitches leading INTO the picture
  for (const [gi, [gy0, gy1]] of [bands[4], bands[5]].entries()) {
    const gh = gy1 - gy0
    s += `<rect x="0" y="${fx(gy0)}" width="${w}" height="${fx(gh)}" fill="${gi === 0 ? VAULT.duneDeep : VAULT.duneDim}"/>`
    for (let i = 0; i < 26; i++) {
      const x = (w * i) / 26 + rr(r, -8, 8)
      s += `<path d="M ${fx(x)} ${fx(gy1)} q ${fx(rr(r, 6, 14))} ${fx(-gh * 0.5)} ${fx(rr(r, 18, 30))} ${fx(-gh * 0.9)}" fill="none" stroke="${r() < 0.3 ? VAULT.foil : VAULT.dune}" stroke-width="1.3" opacity="0.5"/>`
    }
    for (let i = 0; i < 12; i++) {
      s += `<ellipse cx="${fx(rr(r, 0, w))}" cy="${fx(gy0 + gh * rr(r, 0.3, 0.7))}" rx="2.2" ry="1.1" fill="${VAULT.nightDeep}" opacity="0.7"/>`
    }
  }
  return svgPiece(w, h, s, defs)
}

/** THE GUILLOCHÉ AUREOLE (ch4-aureole, 512x512): the bank's vault ring as a
 *  gilded engine-turned halo behind the dragon's head. An annulus of foil
 *  facets under two interfering families of fine engraved arcs (the
 *  guilloché), pierced filigree bores, bolt lugs, and the house rim on both
 *  cut edges. Alpha carves the ring — dress quad, zero DOF. */
function guillocheAureole(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const cy = h / 2
  // radii off the SHORT axis: the canvas is cut at the dress mesh's true
  // aspect, so a circle in canvas pixels displays as a circle
  const R1 = h * 0.46
  const R0 = h * 0.285
  const ring = (rad) => `M ${fx(cx - rad)} ${fx(cy)} a ${fx(rad)} ${fx(rad)} 0 1 0 ${fx(rad * 2)} 0 a ${fx(rad)} ${fx(rad)} 0 1 0 ${fx(-rad * 2)} 0`
  // annulus silhouette via fill-rule evenodd
  const annulus = `${ring(R1)} ${ring(R0)}`
  const clip = `auc`
  const foil = goldFoilFacets(r, 'au', cx - R1, cy - R1, cx + R1, cy + R1, w * 0.09, {
    sparkles: 10,
    streaks: 3,
  })
  let defs = `<clipPath id="${clip}"><path d="${annulus}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath>` + foil.defs
  let s = `<g clip-path="url(#${clip})">`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R1)}" fill="${VAULT.foil}"/>`
  s += foil.body
  // guilloché: two interfering families of fine arcs (engine turning)
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2
    const ox = Math.cos(a) * w * 0.052
    const oy = Math.sin(a) * w * 0.052
    s += `<circle cx="${fx(cx + ox)}" cy="${fx(cy + oy)}" r="${fx((R0 + R1) / 2)}" fill="none" stroke="${VAULT.foilDeep}" stroke-width="0.9" opacity="0.5"/>`
    s += `<circle cx="${fx(cx - ox * 0.6)}" cy="${fx(cy - oy * 0.6)}" r="${fx((R0 + R1) / 2 - w * 0.02)}" fill="none" stroke="${VAULT.foilHi}" stroke-width="0.7" opacity="0.35"/>`
  }
  // radial engraved ticks
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2
    const rA = k % 6 === 0 ? R0 + w * 0.01 : (R0 + R1) / 2 + w * 0.03
    s += `<line x1="${fx(cx + Math.cos(a) * rA)}" y1="${fx(cy + Math.sin(a) * rA)}" x2="${fx(cx + Math.cos(a) * (R1 - w * 0.012))}" y2="${fx(cy + Math.sin(a) * (R1 - w * 0.012))}" stroke="${VAULT.ink}" stroke-width="1" opacity="${k % 6 === 0 ? 0.5 : 0.25}"/>`
  }
  s += `</g>`
  // pierced filigree bores + bolt lugs riding the band (outside the clip so
  // the bores read as true holes: painted as page-showing alpha? no — bores
  // are dark ink wells, the LUGS are gold studs; alpha piercing would need a
  // mask and the dress rides close over painted panel anyway)
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + Math.PI / 12
    const rM = (R0 + R1) / 2
    const bx = cx + Math.cos(a) * rM
    const by = cy + Math.sin(a) * rM
    if (k % 2 === 0) {
      s += `<circle cx="${fx(bx)}" cy="${fx(by)}" r="${fx(w * 0.022)}" fill="${VAULT.nightDeep}"/>` // bore
      s += `<circle cx="${fx(bx)}" cy="${fx(by)}" r="${fx(w * 0.022)}" fill="none" stroke="${VAULT.foilHi}" stroke-width="1.2" opacity="0.8"/>`
    } else {
      s += `<circle cx="${fx(bx)}" cy="${fx(by)}" r="${fx(w * 0.018)}" fill="${VAULT.foilLit}" stroke="${VAULT.ink}" stroke-width="1.2" stroke-opacity="0.5"/>` // lug
      s += `<circle cx="${fx(bx - w * 0.005)}" cy="${fx(by - w * 0.005)}" r="${fx(w * 0.006)}" fill="#ffffff" opacity="0.8"/>`
    }
  }
  s += `<path d="${ring(R1)}" fill="none" stroke="${VAULT.rim}" stroke-width="4" opacity="0.95"/>`
  s += `<path d="${ring(R1)}" fill="none" stroke="${VAULT.ink}" stroke-width="1.4" opacity="0.5"/>`
  s += `<path d="${ring(R0)}" fill="none" stroke="${VAULT.rim}" stroke-width="3.4" opacity="0.95"/>`
  s += `<path d="${ring(R0)}" fill="none" stroke="${VAULT.ink}" stroke-width="1.2" opacity="0.5"/>`
  return svgPiece(w, h, s, defs)
}

/** One frieze camel, drawn FACING LEFT (the caravan walks INTO the picture,
 *  toward the brass PULL on the left page): standing silhouette with an
 *  ember sash + gold cargo, legs clear of the ground bar so the placard
 *  keeps its sightline through the gaps. Local coords: feet at y=0. */
function friezeCamel(x, yFoot, s, r) {
  const B = VAULT.duneDeep
  let g = `<g>`
  // legs (thin, the see-through gaps live between them)
  for (const [lx, lean] of [[-1.9, -0.12], [-0.9, 0.08], [0.9, -0.06], [1.8, 0.14]]) {
    g += `<path d="M ${fx(x + lx * s)} ${fx(yFoot - 2.6 * s)} L ${fx(x + (lx + lean) * s)} ${fx(yFoot)}" stroke="${B}" stroke-width="${fx(0.62 * s)}" stroke-linecap="round"/>`
  }
  // body: two humps + chest + rump
  const d =
    `M ${fx(x - 2.4 * s)} ${fx(yFoot - 2.5 * s)} ` +
    `q ${fx(0.2 * s)} ${fx(-1.5 * s)} ${fx(1.2 * s)} ${fx(-1.7 * s)} ` +
    `q ${fx(0.7 * s)} ${fx(-1.3 * s)} ${fx(1.5 * s)} ${fx(-0.1 * s)} ` +
    `q ${fx(0.8 * s)} ${fx(-1.4 * s)} ${fx(1.7 * s)} ${fx(-0.2 * s)} ` +
    `q ${fx(0.8 * s)} ${fx(0.6 * s)} ${fx(0.6 * s)} ${fx(1.9 * s)} ` +
    `l ${fx(-0.6 * s)} ${fx(0.16 * s)} Z`
  g += `<path d="${d}" fill="${B}"/>`
  // neck rising ABOVE the humps, head held high, forward (left)
  g += `<path d="M ${fx(x - 3.1 * s)} ${fx(yFoot - 5.0 * s)} Q ${fx(x - 3.15 * s)} ${fx(yFoot - 3.4 * s)} ${fx(x - 2.3 * s)} ${fx(yFoot - 2.6 * s)} L ${fx(x - 1.7 * s)} ${fx(yFoot - 3.1 * s)} Q ${fx(x - 2.5 * s)} ${fx(yFoot - 3.7 * s)} ${fx(x - 2.55 * s)} ${fx(yFoot - 5.0 * s)} Z" fill="${B}"/>`
  // head: a small forward wedge with a muzzle drop and an ear tick
  g += `<path d="M ${fx(x - 2.5 * s)} ${fx(yFoot - 5.35 * s)} L ${fx(x - 3.75 * s)} ${fx(yFoot - 5.1 * s)} L ${fx(x - 3.7 * s)} ${fx(yFoot - 4.65 * s)} L ${fx(x - 3.05 * s)} ${fx(yFoot - 4.6 * s)} L ${fx(x - 2.95 * s)} ${fx(yFoot - 4.85 * s)} Z" fill="${B}"/>`
  g += `<line x1="${fx(x - 2.6 * s)}" y1="${fx(yFoot - 5.35 * s)}" x2="${fx(x - 2.45 * s)}" y2="${fx(yFoot - 5.7 * s)}" stroke="${B}" stroke-width="${fx(0.3 * s)}"/>`
  // ember sash between the humps + gold cargo bundle
  g += `<path d="M ${fx(x - 0.4 * s)} ${fx(yFoot - 4.05 * s)} l ${fx(0.8 * s)} ${fx(-0.1 * s)} l ${fx(0.25 * s)} ${fx(1.5 * s)} l ${fx(-1.1 * s)} ${fx(0.15 * s)} Z" fill="${VAULT.ember}"/>`
  g += `<circle cx="${fx(x + 0.05 * s)}" cy="${fx(yFoot - 4.35 * s)}" r="${fx(0.5 * s)}" fill="${VAULT.foilLit}" stroke="${VAULT.ink}" stroke-width="1" stroke-opacity="0.5"/>`
  // tassel
  g += `<line x1="${fx(x + 0.5 * s)}" y1="${fx(yFoot - 2.7 * s)}" x2="${fx(x + 0.55 * s)}" y2="${fx(yFoot - 1.9 * s)}" stroke="${VAULT.ember}" stroke-width="${fx(0.2 * s)}"/>`
  void r
  g += `</g>`
  return g
}

/** THE CARAVAN FRIEZE (ch4-frieze, 1024x192): one linked-chain cutout — an
 *  ember-sashed camel train walking INTO the picture toward the PULL tab.
 *  Pack §4.2 sightline law: silhouette dips <= 0.06 world (37% of h 0.16)
 *  in x in [-0.75, -0.44] = u in [0, 0.207] — only the low ground bar and
 *  leg gaps live there, so the dissolve placard reads through. */
function caravanFrieze(w, h, seed) {
  const r = mulberry32(seed)
  const barTop = h * 0.72 // ground bar: the chain's connector (28% tall)
  // ground bar with a rippled top edge, full width (the linked chain)
  let bar = `M 0 ${fx(h)} L 0 ${fx(barTop + h * 0.06)}`
  for (let i = 0; i <= 24; i++) {
    const x = (w * i) / 24
    bar += ` L ${fx(x)} ${fx(barTop + Math.sin(i * 1.3) * h * 0.028 + h * 0.03)}`
  }
  bar += ` L ${fx(w)} ${fx(h)} Z`
  let s = `<path d="${bar}" fill="${VAULT.duneDeep}"/>`
  s += `<path d="M 0 ${fx(h * 0.92)} Q ${fx(w * 0.5)} ${fx(h * 0.86)} ${fx(w)} ${fx(h * 0.92)}" fill="none" stroke="${VAULT.duneDim}" stroke-width="2" opacity="0.7"/>`
  // gold moon-lip along the bar's ripple
  s += `<path d="M 0 ${fx(barTop + h * 0.05)} Q ${fx(w * 0.5)} ${fx(barTop - h * 0.01)} ${fx(w)} ${fx(barTop + h * 0.05)}" fill="none" stroke="${VAULT.dune}" stroke-width="1.8" opacity="0.6"/>`
  // the camels: chain starts PAST the sightline window (u > 0.24), walking left
  const scale = h * 0.135
  const stations = [0.27, 0.38, 0.5, 0.62, 0.75, 0.88]
  for (const [i, u] of stations.entries()) {
    s += friezeCamel(w * u, barTop + h * 0.04, scale * (i % 2 === 0 ? 1 : 0.92), r)
    // lead rope linking to the camel ahead
    if (i > 0) {
      const xa = w * stations[i - 1] + 2.2 * scale
      const xb = w * u - 3.6 * scale
      s += `<path d="M ${fx(xb)} ${fx(barTop - h * 0.28)} Q ${fx((xa + xb) / 2)} ${fx(barTop - h * 0.14)} ${fx(xa)} ${fx(barTop - h * 0.32)}" fill="none" stroke="${VAULT.ember}" stroke-width="1.6" opacity="0.85"/>`
    }
  }
  // the caravan master on foot at the head of the chain, staff forward —
  // clear of the sightline window's edge (u 0.205) with real margin
  const mx = w * 0.235
  s += `<circle cx="${fx(mx)}" cy="${fx(barTop - h * 0.34)}" r="${fx(h * 0.05)}" fill="${VAULT.duneDeep}"/>`
  s += `<path d="M ${fx(mx - h * 0.03)} ${fx(barTop + h * 0.04)} L ${fx(mx - h * 0.012)} ${fx(barTop - h * 0.3)} L ${fx(mx + h * 0.05)} ${fx(barTop - h * 0.26)} L ${fx(mx + h * 0.06)} ${fx(barTop + h * 0.04)} Z" fill="${VAULT.duneDeep}"/>`
  s += `<path d="M ${fx(mx - h * 0.02)} ${fx(barTop - h * 0.18)} l ${fx(-h * 0.06)} ${fx(h * 0.02)}" stroke="${VAULT.ember}" stroke-width="2.4"/>` // sash
  s += `<line x1="${fx(mx - h * 0.09)}" y1="${fx(barTop + h * 0.04)}" x2="${fx(mx - h * 0.1)}" y2="${fx(barTop - h * 0.42)}" stroke="${VAULT.duneDeep}" stroke-width="2.6"/>` // staff
  // rim along the whole chain's cut edge (bar + backs), approximated on the
  // bar ripple + each camel handled by its own dark mass (tiny at scene scale)
  s += `<path d="M 0 ${fx(barTop + h * 0.06)} Q ${fx(w * 0.5)} ${fx(barTop)} ${fx(w)} ${fx(barTop + h * 0.06)}" fill="none" stroke="${VAULT.rim}" stroke-width="3" opacity="0.9"/>`
  return svgPiece(w, h, s)
}

/** THE VAULT-DRAGON (ch4-hero repaint, 1024x800): the bank's dragon lies
 *  coiled ON the great round vault door — the ONE iridescent thing in a
 *  dark spread (Cinderella-carriage grammar: preciousness by material,
 *  concentration, and framing, never size). Gold-foil facet body bands +
 *  door rings, duneDim violet hide, ember eye, bone claws + horns. */
function vaultDragon(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w * 0.52
  const cy = h * 0.52
  const R = w * 0.32 // the vault door radius
  let defs = ''
  let s = ''

  // ---- the round vault door (walnut-black steel, engraved foil rings) ----
  const doorClip = 'vdoor'
  defs += `<clipPath id="${doorClip}"><circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}"/></clipPath>`
  defs += `<radialGradient id="vdsteel" cx="0.42" cy="0.38" r="0.75"><stop offset="0" stop-color="#3b2d44"/><stop offset="0.7" stop-color="#2a1e33"/><stop offset="1" stop-color="#1e1526"/></radialGradient>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="url(#vdsteel)"/>`
  s += `<g clip-path="url(#${doorClip})">`
  for (const rf of [0.9, 0.74, 0.58]) {
    s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * rf)}" fill="none" stroke="${VAULT.foil}" stroke-width="${fx(R * 0.028)}" opacity="0.9"/>`
    s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * rf + R * 0.02)}" fill="none" stroke="${VAULT.foilHi}" stroke-width="1.2" opacity="0.5"/>`
  }
  // bolt lugs around the rim + engraved numerals band
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    s += `<circle cx="${fx(cx + Math.cos(a) * R * 0.82)}" cy="${fx(cy + Math.sin(a) * R * 0.82)}" r="${fx(R * 0.045)}" fill="${VAULT.foilLit}" stroke="${VAULT.ink}" stroke-width="1.6" stroke-opacity="0.6"/>`
    s += `<circle cx="${fx(cx + Math.cos(a) * R * 0.82 - R * 0.012)}" cy="${fx(cy + Math.sin(a) * R * 0.82 - R * 0.012)}" r="${fx(R * 0.014)}" fill="#ffffff" opacity="0.85"/>`
  }
  // the spindle wheel at the door's heart
  const spokes = 5
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2 + 0.3
    s += `<line x1="${fx(cx)}" y1="${fx(cy)}" x2="${fx(cx + Math.cos(a) * R * 0.34)}" y2="${fx(cy + Math.sin(a) * R * 0.34)}" stroke="${VAULT.foil}" stroke-width="${fx(R * 0.045)}" stroke-linecap="round"/>`
  }
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * 0.34)}" fill="none" stroke="${VAULT.foilLit}" stroke-width="${fx(R * 0.04)}"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * 0.09)}" fill="${VAULT.foilLit}" stroke="${VAULT.ink}" stroke-width="2" stroke-opacity="0.5"/>`
  s += `</g>`

  // ---- the dragon coiled on the door ----
  // The coil is an ANNULUS BAND hugging the door's rim (sampled polygon —
  // the paper truth of "lies coiled on the vault door"), broken on the left
  // where the head rises (top-left) and the tail exits (lower-left). SVG
  // angles, y-down: 0 = right, PI/2 = bottom, PI = left, 3PI/2 = top.
  const hide = '#584169'
  const hideDeep = '#3a2a4a'
  const rMid = R * 1.0
  const band = R * 0.32
  const aHead = 1.26 * Math.PI // coil start: top-left, under the head
  const aTail = 2.78 * Math.PI // coil end: lower-left, into the tail
  const coilPt = (a, rad) => [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]
  const annulusPoly = (a0, a1, rIn, rOut, wobbleAmp = 0) => {
    const steps = 64
    const pts = []
    for (let k = 0; k <= steps; k++) {
      const a = lerp(a0, a1, k / steps)
      pts.push(coilPt(a, rOut + wobbleAmp * Math.sin(a * 5.3)))
    }
    for (let k = steps; k >= 0; k--) {
      const a = lerp(a0, a1, k / steps)
      pts.push(coilPt(a, rIn + wobbleAmp * 0.6 * Math.sin(a * 4.1 + 1)))
    }
    return `M ${pts.map((p) => `${fx(p[0])} ${fx(p[1])}`).join(' L ')} Z`
  }
  const coil = annulusPoly(aHead, aTail, rMid - band / 2, rMid + band / 2, R * 0.022)
  s += `<path d="${coil}" fill="${hide}"/>`
  s += `<path d="${coil}" fill="none" stroke="${hideDeep}" stroke-width="2.6" opacity="0.75"/>`
  // the coil's OUTER cut edge only carries the house rim (an inner rim would
  // arc across the door face — pure noise on the dark steel)
  let coilOuter = ''
  for (let k = 0; k <= 64; k++) {
    const a = lerp(aHead, aTail, k / 64)
    const [ox, oy] = coilPt(a, rMid + band / 2 + R * 0.022 * Math.sin(a * 5.3))
    coilOuter += `${k === 0 ? 'M' : ' L'} ${fx(ox)} ${fx(oy)}`
  }

  // belly band: FOIL FACETS on the coil's inner half along the lower + right
  // run — the glowing underside catching the hoard's light (the one
  // iridescent thing in the dark spread)
  const bellyClip = 'vbelly'
  const belly = annulusPoly(1.82 * Math.PI, 2.72 * Math.PI, rMid - band * 0.46, rMid + band * 0.08)
  defs += `<clipPath id="${bellyClip}"><path d="${belly}"/></clipPath>`
  const bellyFoil = goldFoilFacets(r, 'vb', cx - R * 1.2, cy - R * 1.2, cx + R * 1.2, cy + R * 1.25, R * 0.15, {
    sparkles: 16,
    streaks: 5,
  })
  defs += bellyFoil.defs
  s += `<g clip-path="url(#${bellyClip})">${bellyFoil.body}` +
    // belly plate seams: radial ticks across the band
    Array.from({ length: 16 }, (_, i) => {
      const a = lerp(1.84 * Math.PI, 2.7 * Math.PI, i / 15)
      const [x0, y0] = coilPt(a, rMid - band * 0.46)
      const [x1, y1] = coilPt(a, rMid + band * 0.08)
      return `<line x1="${fx(x0)}" y1="${fx(y0)}" x2="${fx(x1)}" y2="${fx(y1)}" stroke="${VAULT.foilDeep}" stroke-width="2" opacity="0.45"/>`
    }).join('') +
    `</g>`
  // cylinder modeling: a dark shade band along the coil's outer half and a
  // soft top-light along the inner — the tube reads ROUND, and the deepened
  // violet mass frames the foil glow instead of flattening beside it
  const bandStroke = (rad, color, width, opacity) => {
    let d = ''
    for (let k = 0; k <= 64; k++) {
      const a = lerp(aHead + 0.02 * Math.PI, aTail - 0.02 * Math.PI, k / 64)
      const [px, py] = coilPt(a, rad)
      d += `${k === 0 ? 'M' : ' L'} ${fx(px)} ${fx(py)}`
    }
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${fx(width)}" opacity="${opacity}" stroke-linecap="round"/>`
  }
  s += bandStroke(rMid + band * 0.34, hideDeep, band * 0.3, 0.5)
  s += bandStroke(rMid - band * 0.16, '#6a5280', band * 0.22, 0.45)
  // FOIL EDGE-LIGHT on the hoard-facing (inner) edge: the treasure's glow
  // catching the underside of the coil — the pack's "one glowing thing"
  s += bandStroke(rMid - band / 2 + R * 0.012, VAULT.foilLit, 3, 0.9)
  s += bandStroke(rMid - band / 2 + R * 0.026, VAULT.foilHi, 1.2, 0.6)
  // scale crescents along the coil's outer half — bold enough to read
  for (let k = 0; k < 30; k++) {
    const a = lerp(aHead + 0.06 * Math.PI, aTail - 0.06 * Math.PI, (k % 15) / 14) + rr(r, -0.02, 0.02)
    const rad = rMid + band * (k < 15 ? rr(r, 0.16, 0.34) : rr(r, -0.08, 0.1))
    const [sx, sy] = coilPt(a, rad)
    const sc = R * rr(r, 0.05, 0.085)
    const rot = ((a + Math.PI / 2) * 180) / Math.PI
    s += `<path d="M ${fx(sx - sc)} ${fx(sy)} a ${fx(sc)} ${fx(sc)} 0 0 0 ${fx(sc * 2)} 0" fill="none" stroke="#8468a0" stroke-width="2.2" opacity="0.8" transform="rotate(${fx(rot)} ${fx(sx)} ${fx(sy)})"/>`
  }

  // spine ridge sails riding the coil's OUTER edge, leaning with the wrap
  // (shorter over the crown so the die stays inside the canvas)
  for (let k = 0; k < 11; k++) {
    const a = lerp(aHead + 0.08 * Math.PI, aTail - 0.1 * Math.PI, k / 10)
    const topShrink = Math.sin(a) < -0.5 ? 0.5 : 1
    const ln = R * (0.13 + 0.06 * Math.sin(k * 1.7)) * topShrink
    const [bx0, by0] = coilPt(a - 0.035 * Math.PI, rMid + band * 0.44)
    const [bx1, by1] = coilPt(a + 0.035 * Math.PI, rMid + band * 0.44)
    const [tx, ty] = coilPt(a + 0.055 * Math.PI, rMid + band * 0.44 + ln)
    s += `<path d="M ${fx(bx0)} ${fx(by0)} Q ${fx(tx)} ${fx(ty)} ${fx(bx1)} ${fx(by1)} Z" fill="${hideDeep}" stroke="${VAULT.duneDim}" stroke-width="1.2"/>`
  }

  // the coil's outer cut edge carries the house rim — laid down HERE so the
  // wing, neck, and head are never crossed by their own body's rim
  s += `<path d="${coilOuter}" fill="none" stroke="${VAULT.rim}" stroke-width="3.6" opacity="0.95" stroke-linejoin="round"/>`
  s += `<path d="${coilOuter}" fill="none" stroke="${VAULT.ink}" stroke-width="1.4" opacity="0.5" stroke-linejoin="round"/>`

  // the tail: exits the coil's end, curling out lower-left to a spade tip
  const [tex, tey] = coilPt(aTail, rMid)
  const tail =
    `M ${fx(tex)} ${fx(tey - band * 0.42)} ` +
    `q ${fx(-R * 0.34)} ${fx(R * 0.3)} ${fx(-R * 0.62)} ${fx(R * 0.26)} ` +
    `q ${fx(-R * 0.26)} ${fx(-R * 0.04)} ${fx(-R * 0.4)} ${fx(-R * 0.18)} ` +
    `l ${fx(R * 0.06)} ${fx(-R * 0.1)} ` +
    `q ${fx(R * 0.18)} ${fx(R * 0.14)} ${fx(R * 0.4)} ${fx(R * 0.06)} ` +
    `q ${fx(R * 0.22)} ${fx(-R * 0.08)} ${fx(R * 0.42)} ${fx(-R * 0.36)} Z`
  s += `<path d="${tail}" fill="${hide}" stroke="${hideDeep}" stroke-width="2.2"/>`
  // small ridge spikes continuing down the tail, then the spade tip
  for (const [tt, tu] of [[0.22, -0.06], [0.45, -0.1], [0.66, -0.12]]) {
    const px = tex - R * tt * 1.0
    const py = tey - band * 0.42 + R * tt * 0.28 + R * tu * 0
    s += `<path d="M ${fx(px - R * 0.04)} ${fx(py)} q ${fx(R * 0.03)} ${fx(-R * 0.09)} ${fx(R * 0.09)} ${fx(-R * 0.02)} Z" fill="${hideDeep}" stroke="${VAULT.duneDim}" stroke-width="1"/>`
  }
  const spx = tex - R * 0.8
  const spy = tey + R * 0.02
  s += `<path d="M ${fx(spx)} ${fx(spy)} l ${fx(-R * 0.18)} ${fx(-R * 0.12)} l ${fx(R * 0.04)} ${fx(R * 0.17)} l ${fx(-R * 0.15)} ${fx(R * 0.08)} l ${fx(R * 0.23)} ${fx(R * 0.05)} Z" fill="${hideDeep}" stroke="${VAULT.duneDim}" stroke-width="1.4"/>`

  // fore-claws GRIPPING the door's rim ("coiled about its treasure" — the
  // grip sells the hoard): forearms reach from the coil's inner edge across
  // the rim, bone talons hooking INWARD over the door face
  for (const aC of [2.4 * Math.PI, 2.56 * Math.PI]) {
    const [fx0, fy0] = coilPt(aC, rMid - band * 0.1)
    const [fx1, fy1] = coilPt(aC, R * 0.76)
    const dxn = (fx1 - fx0) / Math.hypot(fx1 - fx0, fy1 - fy0)
    const dyn = (fy1 - fy0) / Math.hypot(fx1 - fx0, fy1 - fy0)
    // forearm: a tapering wedge from the coil onto the door
    s += `<path d="M ${fx(fx0 - dyn * R * 0.085)} ${fx(fy0 + dxn * R * 0.085)} L ${fx(fx0 + dyn * R * 0.085)} ${fx(fy0 - dxn * R * 0.085)} L ${fx(fx1 + dyn * R * 0.05)} ${fx(fy1 - dxn * R * 0.05)} L ${fx(fx1 - dyn * R * 0.05)} ${fx(fy1 + dxn * R * 0.05)} Z" fill="${hide}" stroke="${hideDeep}" stroke-width="2"/>`
    // three bone talons curving inward past the knuckle
    for (const t of [-1, 0, 1]) {
      const kx = fx1 + dyn * R * 0.04 * t
      const ky = fy1 - dxn * R * 0.04 * t
      s += `<path d="M ${fx(kx)} ${fx(ky)} q ${fx(dxn * R * 0.09 - dyn * R * 0.02)} ${fx(dyn * R * 0.09 + dxn * R * 0.02)} ${fx(dxn * R * 0.13 + dyn * R * 0.045)} ${fx(dyn * R * 0.13 - dxn * R * 0.045)} q ${fx(-dxn * R * 0.06)} ${fx(-dyn * R * 0.02)} ${fx(-dxn * R * 0.1)} ${fx(-dyn * R * 0.055)} Z" fill="${VAULT.rim}" stroke="${VAULT.ink}" stroke-width="1.1" stroke-opacity="0.55"/>`
    }
  }

  // the WING: a folded bat wing over the coil's right shoulder — arm bone to
  // a knuckle, four finger ribs, scalloped membrane between the tips, the
  // membrane itself in gold foil (the pack's glowing wing)
  const S0 = [cx + R * 0.32, cy + R * 0.45]
  const K = [cx + R * 0.72, cy + R * 0.02]
  const tips = [
    [cx + R * 1.38, cy - R * 0.18],
    [cx + R * 1.34, cy + R * 0.14],
    [cx + R * 1.16, cy + R * 0.42],
    [cx + R * 0.94, cy + R * 0.6],
  ]
  const scallop = (a, b) => {
    const mx = (a[0] + b[0]) / 2 + (K[0] - (a[0] + b[0]) / 2) * 0.22
    const my = (a[1] + b[1]) / 2 + (K[1] - (a[1] + b[1]) / 2) * 0.22
    return `Q ${fx(mx)} ${fx(my)} ${fx(b[0])} ${fx(b[1])}`
  }
  const wing =
    `M ${fx(K[0])} ${fx(K[1])} L ${fx(tips[0][0])} ${fx(tips[0][1])} ` +
    scallop(tips[0], tips[1]) + ' ' + scallop(tips[1], tips[2]) + ' ' + scallop(tips[2], tips[3]) +
    ` Q ${fx((tips[3][0] + S0[0]) / 2)} ${fx((tips[3][1] + S0[1]) / 2 + R * 0.04)} ${fx(S0[0])} ${fx(S0[1])} Z`
  const wingClip = 'vwing'
  defs += `<clipPath id="${wingClip}"><path d="${wing}"/></clipPath>`
  const wingFoil = goldFoilFacets(r, 'vw', K[0] - R * 0.1, cy - R * 0.25, cx + R * 1.42, cy + R * 0.66, R * 0.16, {
    sparkles: 10,
    streaks: 3,
    dir: -30,
  })
  defs += wingFoil.defs
  s += `<path d="${wing}" fill="${VAULT.duneDim}"/>`
  s += `<g clip-path="url(#${wingClip})">${wingFoil.body}</g>`
  s += `<path d="${wing}" fill="none" stroke="${hideDeep}" stroke-width="2.6" stroke-linejoin="round"/>`
  // finger ribs over the membrane, knuckle thumb-spur, arm bone
  for (const t of tips) {
    s += `<path d="M ${fx(K[0])} ${fx(K[1])} Q ${fx((K[0] + t[0]) / 2)} ${fx((K[1] + t[1]) / 2 - R * 0.03)} ${fx(t[0])} ${fx(t[1])}" fill="none" stroke="${hideDeep}" stroke-width="${fx(R * 0.038)}" stroke-linecap="round"/>`
  }
  s += `<path d="M ${fx(S0[0])} ${fx(S0[1])} Q ${fx(S0[0] + R * 0.14)} ${fx(S0[1] - R * 0.32)} ${fx(K[0])} ${fx(K[1])}" fill="none" stroke="${hide}" stroke-width="${fx(R * 0.12)}" stroke-linecap="round"/>`
  s += `<path d="M ${fx(S0[0])} ${fx(S0[1])} Q ${fx(S0[0] + R * 0.14)} ${fx(S0[1] - R * 0.32)} ${fx(K[0])} ${fx(K[1])}" fill="none" stroke="${hideDeep}" stroke-width="${fx(R * 0.12)}" stroke-opacity="0.4" stroke-linecap="round"/>`
  s += `<path d="M ${fx(K[0])} ${fx(K[1])} l ${fx(R * 0.02)} ${fx(-R * 0.12)} l ${fx(R * 0.055)} ${fx(R * 0.1)} Z" fill="${VAULT.rim}" stroke="${VAULT.ink}" stroke-width="1.1" stroke-opacity="0.5"/>`
  // pale cut rim along the scalloped trailing edge
  s += `<path d="M ${fx(tips[0][0])} ${fx(tips[0][1])} ${scallop(tips[0], tips[1])} ${scallop(tips[1], tips[2])} ${scallop(tips[2], tips[3])}" fill="none" stroke="${VAULT.rim}" stroke-width="3" opacity="0.9"/>`

  // the head: rising off the coil's start, over the door's upper-left,
  // gazing left into the notch (where the reader first finds it)
  const hx = cx - R * 0.5
  const hy = cy - R * 0.92
  // neck: joins the head base to the coil's start (one continuous beast),
  // with a foil throat-light on its hoard-facing underside
  const [n0x, n0y] = coilPt(aHead + 0.03 * Math.PI, rMid + band * 0.34)
  const [n1x, n1y] = coilPt(aHead + 0.16 * Math.PI, rMid - band * 0.42)
  const neck =
    `M ${fx(n0x)} ${fx(n0y)} ` +
    `Q ${fx(hx - R * 0.05)} ${fx(hy + R * 0.05)} ${fx(hx + R * 0.28)} ${fx(hy + R * 0.16)} ` +
    `L ${fx(hx + R * 0.4)} ${fx(hy + R * 0.42)} ` +
    `Q ${fx(cx - R * 0.32)} ${fx(cy - R * 0.62)} ${fx(n1x)} ${fx(n1y)} Z`
  s += `<path d="${neck}" fill="${hide}" stroke="${hideDeep}" stroke-width="2.2"/>`
  s += `<path d="M ${fx(hx + R * 0.4)} ${fx(hy + R * 0.42)} Q ${fx(cx - R * 0.32)} ${fx(cy - R * 0.62)} ${fx(n1x)} ${fx(n1y)}" fill="none" stroke="${VAULT.foilLit}" stroke-width="2.6" opacity="0.85"/>`

  // SKULL + SNOUT: an angular wedge with a brow dip and a slightly open jaw
  // (the beast sleeps lightly, one tooth glinting) — the dragon read
  const head =
    `M ${fx(hx + 0.3 * R)} ${fx(hy - 0.05 * R)} ` + // skull back-top
    `q ${fx(-0.16 * R)} ${fx(-0.1 * R)} ${fx(-0.34 * R)} ${fx(-0.06 * R)} ` + // crown to brow
    `l ${fx(-0.1 * R)} ${fx(0.06 * R)} ` + // brow dip
    `q ${fx(-0.24 * R)} ${fx(-0.02 * R)} ${fx(-0.4 * R)} ${fx(0.09 * R)} ` + // snout ridge
    `l ${fx(0.03 * R)} ${fx(0.07 * R)} ` + // nostril bump drop
    `l ${fx(0.46 * R)} ${fx(0.06 * R)} ` + // upper jaw line (mouth gap under)
    `l ${fx(-0.04 * R)} ${fx(0.1 * R)} ` + // cheek notch
    `q ${fx(0.22 * R)} ${fx(0.14 * R)} ${fx(0.43 * R)} ${fx(0.08 * R)} ` + // jaw back
    `Z`
  s += `<path d="${head}" fill="${hide}" stroke="${hideDeep}" stroke-width="2.4"/>`
  // lower jaw: a thin open wedge beneath the upper jaw line
  const jaw =
    `M ${fx(hx + 0.08 * R)} ${fx(hy + 0.26 * R)} ` +
    `l ${fx(-0.5 * R)} ${fx(-0.02 * R)} ` +
    `l ${fx(0.04 * R)} ${fx(0.1 * R)} ` +
    `q ${fx(0.26 * R)} ${fx(0.1 * R)} ${fx(0.5 * R)} ${fx(0.02 * R)} Z`
  s += `<path d="${jaw}" fill="${hide}" stroke="${hideDeep}" stroke-width="2"/>`
  // the mouth shadow between the jaws + teeth (one fang glints)
  s += `<path d="M ${fx(hx + 0.06 * R)} ${fx(hy + 0.2 * R)} l ${fx(-0.46 * R)} ${fx(-0.045 * R)} l ${fx(0.02 * R)} ${fx(0.075 * R)} l ${fx(0.46 * R)} ${fx(0.035 * R)} Z" fill="${VAULT.nightDeep}"/>`
  for (const [tx2, tw] of [[-0.34, 0.032], [-0.2, 0.026], [-0.06, 0.03]]) {
    s += `<path d="M ${fx(hx + tx2 * R)} ${fx(hy + 0.165 * R)} l ${fx(tw * R * 0.5)} ${fx(0.06 * R)} l ${fx(tw * R * 0.5)} ${fx(-0.055 * R)} Z" fill="${VAULT.rim}"/>`
  }
  s += `<path d="M ${fx(hx - 0.31 * R)} ${fx(hy + 0.23 * R)} l ${fx(0.014 * R)} ${fx(-0.05 * R)} l ${fx(0.02 * R)} ${fx(0.048 * R)} Z" fill="${VAULT.rim}"/>` // lower fang
  s += `<circle cx="${fx(hx - 0.33 * R)}" cy="${fx(hy + 0.17 * R)}" r="${fx(R * 0.012)}" fill="#ffffff" opacity="0.95"/>` // tooth glint
  // TWO swept-back horns (bone) — the silhouette that says dragon, not ear
  const horn = (bx, by, tx3, ty, wdt) =>
    `M ${fx(bx)} ${fx(by)} Q ${fx((bx + tx3) / 2)} ${fx(Math.min(by, ty) - R * 0.14)} ${fx(tx3)} ${fx(ty)} ` +
    `Q ${fx((bx + tx3) / 2 + R * 0.02)} ${fx(Math.min(by, ty) - R * 0.02)} ${fx(bx + wdt)} ${fx(by + R * 0.04)} Z`
  s += `<path d="${horn(hx + 0.04 * R, hy - 0.06 * R, hx + 0.66 * R, hy - 0.28 * R, R * 0.13)}" fill="${VAULT.rim}" stroke="${VAULT.ink}" stroke-width="1.4" stroke-opacity="0.55"/>`
  s += `<path d="${horn(hx + 0.16 * R, hy + 0.02 * R, hx + 0.56 * R, hy - 0.08 * R, R * 0.1)}" fill="${VAULT.rim}" stroke="${VAULT.ink}" stroke-width="1.2" stroke-opacity="0.55"/>`
  // horn ridge rings
  for (const t of [0.22, 0.38]) {
    s += `<path d="M ${fx(hx + (0.04 + t * 0.62) * R)} ${fx(hy - (0.06 + t * 0.22) * R - R * 0.05)} q ${fx(R * 0.03)} ${fx(R * 0.05)} ${fx(R * 0.005)} ${fx(R * 0.09)}" fill="none" stroke="${VAULT.ink}" stroke-width="1.1" opacity="0.4"/>`
  }
  // brow spike, deep eye socket, EMBER EYE (kept), nostril + night-breath
  s += `<path d="M ${fx(hx - 0.02 * R)} ${fx(hy - 0.02 * R)} l ${fx(-0.05 * R)} ${fx(-0.11 * R)} l ${fx(-0.08 * R)} ${fx(0.09 * R)} Z" fill="${hideDeep}"/>`
  s += `<path d="M ${fx(hx - 0.2 * R)} ${fx(hy + 0.02 * R)} q ${fx(0.12 * R)} ${fx(-0.05 * R)} ${fx(0.2 * R)} ${fx(0.01 * R)} q ${fx(-0.1 * R)} ${fx(0.06 * R)} ${fx(-0.2 * R)} ${fx(0.035 * R)} Z" fill="${hideDeep}"/>`
  s += `<circle cx="${fx(hx - 0.1 * R)}" cy="${fx(hy + 0.045 * R)}" r="${fx(R * 0.05)}" fill="${VAULT.ember}"/>`
  s += `<circle cx="${fx(hx - 0.1 * R)}" cy="${fx(hy + 0.045 * R)}" r="${fx(R * 0.02)}" fill="#ffe9b8"/>`
  s += `<circle cx="${fx(hx - 0.44 * R)}" cy="${fx(hy + 0.1 * R)}" r="${fx(R * 0.016)}" fill="${VAULT.nightDeep}"/>`
  // foil edge-light under the jaw — the hoard's glow reaching the chin
  s += `<path d="M ${fx(hx - 0.42 * R)} ${fx(hy + 0.34 * R)} q ${fx(0.26 * R)} ${fx(0.1 * R)} ${fx(0.5 * R)} ${fx(0.02 * R)}" fill="none" stroke="${VAULT.foilLit}" stroke-width="2.2" opacity="0.85"/>`

  // rims: the door's exposed upper arc + the head carry the house cut edge
  // (the coil's outer rim went down before the head)
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="none" stroke="${VAULT.rim}" stroke-width="4" opacity="0.5"/>`
  s += rimPath(head, 3)
  return svgPiece(w, h, s, defs)
}

/** Tiny stroke lettering for the engraved PULL (no fonts in the rasterizer
 *  path — librsvg text is host-font-dependent, and the bake must be
 *  byte-stable). Each glyph is polyline strokes in a 10x14 box at (x, y). */
function strokeWord(word, x, y, gs, color, sw = 2.2) {
  const G = {
    P: [[0, 14, 0, 0], [0, 0, 8, 0], [8, 0, 8, 7], [8, 7, 0, 7]],
    U: [[0, 0, 0, 12], [0, 12, 2, 14], [2, 14, 8, 14], [8, 14, 10, 12], [10, 12, 10, 0]],
    L: [[0, 0, 0, 14], [0, 14, 9, 14]],
  }
  let s = ''
  let cx = x
  for (const ch of word) {
    for (const [x0, y0, x1, y1] of G[ch] ?? []) {
      s += `<line x1="${fx(cx + x0 * gs)}" y1="${fx(y + y0 * gs)}" x2="${fx(cx + x1 * gs)}" y2="${fx(y + y1 * gs)}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`
    }
    cx += 13 * gs
  }
  return s
}

/** The engraved brass slot plate + giant ember chevrons + PULL, painted
 *  along the tab-exit edge of BOTH dissolve faces (the celebrated
 *  affordance — Frozen-theater ▼PULL▼ grammar; image-x = the page-fore
 *  axis, so the tab side is the image's RIGHT edge on either page side). */
function brassPullPlate(w, h) {
  const px = w * 0.9
  const pw = w * 0.1
  let s = `<rect x="${fx(px)}" y="0" width="${fx(pw)}" height="${h}" fill="${VAULT.foil}"/>`
  s += `<rect x="${fx(px)}" y="0" width="${fx(pw * 0.18)}" height="${h}" fill="${VAULT.foilLit}" opacity="0.6"/>`
  s += `<rect x="${fx(px + 3)}" y="3" width="${fx(pw - 6)}" height="${h - 6}" fill="none" stroke="${VAULT.foilDeep}" stroke-width="2"/>`
  s += `<rect x="${fx(px + 7)}" y="7" width="${fx(pw - 14)}" height="${h - 14}" fill="none" stroke="${VAULT.foilHi}" stroke-width="1" opacity="0.7"/>`
  // giant ember chevrons pointing at the tab (image-right)
  const cxm = px + pw * 0.5
  for (const t of [0.2, 0.42]) {
    const cy = h * t
    s += `<path d="M ${fx(cxm - pw * 0.26)} ${fx(cy - h * 0.045)} L ${fx(cxm + pw * 0.2)} ${fx(cy)} L ${fx(cxm - pw * 0.26)} ${fx(cy + h * 0.045)}" fill="none" stroke="${VAULT.ember}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`
  }
  // engraved PULL reading down the plate
  const gs = pw * 0.022
  s += `<g transform="rotate(90 ${fx(cxm)} ${fx(h * 0.62)})">${strokeWord('PULL', cxm - 24 * gs, h * 0.62 - 7 * gs, gs, VAULT.ink, 2.6)}</g>`
  s += `<g transform="rotate(90 ${fx(cxm)} ${fx(h * 0.62)})">${strokeWord('PULL', cxm - 24 * gs - 1, h * 0.62 - 7 * gs - 1, gs, VAULT.foilHi, 1.2)}</g>`
  // slot shadow where the strip exits
  s += `<rect x="${fx(w - 4)}" y="0" width="4" height="${h}" fill="${VAULT.ink}" opacity="0.5"/>`
  return s
}

/** THE BRASS PULL TAB (ch4-dissolve-tab): the grab handle itself, engraved
 *  brass with ember chevrons — the celebrated affordance in the reader's
 *  hand. Texture axes (popup-dissolve-layer tab quad): image u runs along
 *  the spine (z), image v along the page-fore axis d with v=1 = the OUTER
 *  end — so chevrons point image-UP (the pull direction) and the word
 *  rotates 90 deg to read screen-upright on the left page. */
function dissolveTabPlate(w, h, seed) {
  const r = mulberry32(seed)
  let s = `<rect width="${w}" height="${h}" rx="${fx(w * 0.06)}" fill="${VAULT.foil}"/>`
  s += `<rect width="${fx(w * 0.22)}" height="${h}" fill="${VAULT.foilLit}" opacity="0.5"/>`
  s += `<rect x="4" y="4" width="${fx(w - 8)}" height="${fx(h - 8)}" rx="${fx(w * 0.05)}" fill="none" stroke="${VAULT.foilDeep}" stroke-width="3"/>`
  s += `<rect x="10" y="10" width="${fx(w - 20)}" height="${fx(h - 20)}" rx="${fx(w * 0.04)}" fill="none" stroke="${VAULT.foilHi}" stroke-width="1.4" opacity="0.7"/>`
  // engraved hatching (brushed brass)
  for (let i = 0; i < 12; i++) {
    const y = h * (0.06 + i * 0.08) + rr(r, -3, 3)
    s += `<line x1="14" y1="${fx(y)}" x2="${fx(w - 14)}" y2="${fx(y)}" stroke="${VAULT.foilDeep}" stroke-width="0.8" opacity="0.3"/>`
  }
  // ember chevrons pointing image-UP = outward, the pull direction
  for (const t of [0.3, 0.19]) {
    const cy = h * t
    s += `<path d="M ${fx(w * 0.24)} ${fx(cy + h * 0.045)} L ${fx(w * 0.5)} ${fx(cy - h * 0.02)} L ${fx(w * 0.76)} ${fx(cy + h * 0.045)}" fill="none" stroke="${VAULT.ember}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
  }
  // PULL reading screen-upright (rotate 90: word-up -> image-right); the
  // word is 4 glyphs x 13 grid units long, sized to sit inside the lower half
  const gs = w * 0.014
  const wx = w * 0.5
  const wy = h * 0.62
  s += `<g transform="rotate(90 ${fx(wx)} ${fx(wy)})">${strokeWord('PULL', wx - 24 * gs, wy - 7 * gs, gs, VAULT.ink, 2.6)}</g>`
  s += `<g transform="rotate(90 ${fx(wx)} ${fx(wy)})">${strokeWord('PULL', wx - 24 * gs - 1, wy - 7 * gs - 1, gs, VAULT.foilHi, 1.1)}</g>`
  // the slit shadow at the inner (v=0) edge, where the strip disappears
  s += `<rect x="0" y="${fx(h - 8)}" width="${w}" height="8" fill="${VAULT.ink}" opacity="0.45"/>`
  return svgPiece(w, h, s)
}

/** THE SPREAD-5 FLOOR PRINT (page-5, full-bleed page faces): rippled
 *  sand-to-gold fans leading from the apron (image bottom = near) to the
 *  dissolve placard (lower-left) and up into the ranks (upper field), with
 *  camel tracks stitching the journey (T-FLOOR — the refs' loudest lesson).
 *  Full-bleed opaque; page prints carry no rim and no alpha. */
function vaultFloorPrint(w, h, seed) {
  const r = mulberry32(seed)
  const defs =
    `<linearGradient id="p5g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${VAULT.nightDeep}"/>` +
    `<stop offset="0.42" stop-color="${VAULT.duneDeep}"/>` +
    `<stop offset="1" stop-color="#4c3a56"/></linearGradient>` +
    `<radialGradient id="p5pool" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${VAULT.foilLit}" stop-opacity="0.78"/>` +
    `<stop offset="0.6" stop-color="${VAULT.foil}" stop-opacity="0.3"/>` +
    `<stop offset="1" stop-color="${VAULT.foil}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="p5gutter" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${VAULT.nightDeep}" stop-opacity="0"/>` +
    `<stop offset="0.5" stop-color="${VAULT.nightDeep}" stop-opacity="0.45"/>` +
    `<stop offset="1" stop-color="${VAULT.nightDeep}" stop-opacity="0"/></linearGradient>`
  let s = `<rect width="${w}" height="${h}" fill="url(#p5g)"/>`
  // gold pools: under the rank feet (upper mid), at the placard station
  // (lower-left page), and at the goldpile's fore-edge root (lower-right)
  const pools = [
    [0.5, 0.3, 0.62, 0.2], // the massif's valley feet
    [0.185, 0.76, 0.3, 0.17], // the dissolve placard
    [0.88, 0.78, 0.26, 0.16], // the goldpile root
    [0.52, 0.55, 0.34, 0.14], // the dragon's door pool
  ]
  for (const [ux, vy, uw, vh] of pools) {
    s += `<ellipse cx="${fx(w * ux)}" cy="${fx(h * vy)}" rx="${fx(w * uw * 0.5)}" ry="${fx(h * vh * 0.5)}" fill="url(#p5pool)"/>`
  }
  // rippled sand fans: arc families opening from the apron toward the
  // placard and the notch — sand (violet) graded to gold as they climb
  const fans = [
    { cx: 0.56, cy: 1.06, r0: 0.12, r1: 0.72, n: 11, a0: 195, a1: 330 }, // apron -> up-left (placard + ranks)
    { cx: 0.19, cy: 0.78, r0: 0.05, r1: 0.3, n: 7, a0: -70, a1: 200 }, // rings around the placard
    { cx: 0.9, cy: 0.82, r0: 0.05, r1: 0.26, n: 6, a0: 120, a1: 330 }, // goldpile ripples
  ]
  for (const f of fans) {
    for (let i = 0; i < f.n; i++) {
      const t = i / (f.n - 1)
      const rad = (f.r0 + (f.r1 - f.r0) * t) * w * 0.5
      // BOLD at the pinned camera (the s4 eye-test rejected a faint floor):
      // heavier strokes, hotter grade as the ripples climb toward the gold
      const col = t < 0.35 ? VAULT.duneDim : t < 0.62 ? VAULT.dune : t < 0.85 ? VAULT.duneLit : VAULT.foilLit
      const sw = 4.6 - t * 2.2
      // sampled parametric ellipse arcs — the A command's radii-vs-endpoint
      // solver rescales impossible arcs into scalloped bulges (librsvg), so
      // the fans are drawn as polylines on the exact parametric curve
      const steps = 44
      let d = ''
      for (let k = 0; k <= steps; k++) {
        const a = (lerp(f.a0, f.a1, k / steps) * Math.PI) / 180
        const px = w * f.cx + Math.cos(a) * rad
        const py = h * f.cy + Math.sin(a) * rad * 0.62
        d += `${k === 0 ? 'M' : ' L'} ${fx(px)} ${fx(py)}`
      }
      s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${fx(sw)}" opacity="${(0.72 - t * 0.26).toFixed(2)}"/>`
    }
  }
  // the APRON: bold moonlit sand lips across the near edge — the floor's
  // loudest beat sits where the reader's eye enters the spread
  for (let i = 0; i < 6; i++) {
    const y = h * (0.86 + i * 0.026)
    const amp = h * 0.014
    let d = ''
    for (let k = 0; k <= 24; k++) {
      const x = (w * k) / 24
      d += `${k === 0 ? 'M' : ' L'} ${fx(x)} ${fx(y - Math.sin(k * 0.9 + i * 1.3) * amp)}`
    }
    s += `<path d="${d}" fill="none" stroke="${i % 2 ? VAULT.dune : VAULT.duneLit}" stroke-width="${fx(3.4 - i * 0.3)}" opacity="${(0.62 - i * 0.06).toFixed(2)}"/>`
  }
  // scattered glints where sand is becoming gold (denser toward the pools)
  for (let i = 0; i < 90; i++) {
    const p = pools[Math.floor(rr(r, 0, pools.length))]
    const x = w * p[0] + rr(r, -1, 1) * w * p[2] * 0.55
    const y = h * p[1] + rr(r, -1, 1) * h * p[3] * 0.6
    s += `<circle cx="${fx(x)}" cy="${fx(y)}" r="${fx(rr(r, 1.2, 3.4))}" fill="${r() < 0.4 ? VAULT.foilHi : VAULT.foilLit}" opacity="${rr(r, 0.4, 0.9).toFixed(2)}"/>`
  }
  // camel tracks: paired-dot trails — apron to placard, apron up into the
  // notch (the caravan's two appearances, stitched by the floor)
  const trails = [
    [[0.58, 0.97], [0.42, 0.9], [0.3, 0.84], [0.21, 0.78]],
    [[0.6, 0.95], [0.56, 0.82], [0.52, 0.68], [0.5, 0.52], [0.49, 0.4]],
  ]
  for (const trail of trails) {
    for (let i = 0; i + 1 < trail.length; i++) {
      const [ax, ay] = trail[i]
      const [bx, by] = trail[i + 1]
      for (let k = 0; k < 5; k++) {
        const t = k / 5
        const x = w * lerp(ax, bx, t)
        const y = h * lerp(ay, by, t)
        const side = k % 2 === 0 ? 1 : -1
        s += `<ellipse cx="${fx(x + side * 7)}" cy="${fx(y)}" rx="3.4" ry="2" fill="${VAULT.nightDeep}" opacity="0.75"/>`
        s += `<ellipse cx="${fx(x + side * 7 + 1)}" cy="${fx(y - 1.2)}" rx="1.4" ry="0.8" fill="${VAULT.duneLit}" opacity="0.3"/>`
      }
    }
  }
  // the gutter valley shadow down the spine
  s += `<rect x="${fx(w * 0.42)}" width="${fx(w * 0.16)}" height="${h}" fill="url(#p5gutter)"/>`
  return svgPiece(w, h, s, defs)
}

// ---- THE FAN SPIRE (s4 ch3-keep-spire-mK, fan members). Three slate-and-stone
// steeple slices sharing the loft-lid apex; narrowing base->peak so fanned they
// read as ONE pierced spire in the keep's slate/stone/gold vocabulary. v=0 is
// the seat (base), v=1 the tip. Symmetric about the member crease (u=0.5). ----
function spireMember(w, h, seed, idx) {
  const r = mulberry32(seed)
  const P = CITADEL
  const cx = w / 2
  const baseHalf = w * 0.46
  const tipHalf = w * (idx === 2 ? 0.02 : 0.14 - idx * 0.05)
  const baseY = h * 0.98,
    tipY = h * 0.04
  // tapered steeple silhouette
  const d = `M ${fx(cx - baseHalf)} ${fx(baseY)} L ${fx(cx - tipHalf)} ${fx(tipY)} L ${fx(cx + tipHalf)} ${fx(tipY)} L ${fx(cx + baseHalf)} ${fx(baseY)} Z`
  let s = `<g>`
  s += `<path d="${d}" fill="${P.slate}"/>`
  // lit left flank
  s += `<path d="M ${fx(cx - baseHalf)} ${fx(baseY)} L ${fx(cx - tipHalf)} ${fx(tipY)} L ${fx(cx)} ${fx(tipY)} L ${fx(cx)} ${fx(baseY)} Z" fill="${P.slateLit}" opacity="0.35"/>`
  // slate shingle courses (chevrons) climbing the steeple
  const rows = 12
  for (let i = 0; i < rows; i++) {
    const t = i / rows
    const y = lerp(baseY, tipY, t)
    const half = lerp(baseHalf, tipHalf, t)
    s += `<path d="M ${fx(cx - half)} ${fx(y)} L ${fx(cx)} ${fx(y - h * 0.02)} L ${fx(cx + half)} ${fx(y)}" fill="none" stroke="${i % 2 ? P.slateDim : P.slateLit}" stroke-width="1.8" opacity="0.5"/>`
  }
  // a coursed STONE base band + gold ring near the seat
  const bandY = h * 0.8
  s += `<path d="M ${fx(cx - baseHalf)} ${fx(baseY)} L ${fx(cx - lerp(baseHalf, tipHalf, (baseY - bandY) / (baseY - tipY)))} ${fx(bandY)} L ${fx(cx + lerp(baseHalf, tipHalf, (baseY - bandY) / (baseY - tipY)))} ${fx(bandY)} L ${fx(cx + baseHalf)} ${fx(baseY)} Z" fill="${P.paper}"/>`
  for (let cy = baseY - h * 0.05; cy > bandY; cy -= h * 0.05) s += `<line x1="${fx(cx - baseHalf)}" y1="${fx(cy)}" x2="${fx(cx + baseHalf)}" y2="${fx(cy)}" stroke="${INK}" stroke-width="1.4" opacity="0.4"/>`
  s += `<rect x="${fx(cx - baseHalf)}" y="${fx(bandY - h * 0.02)}" width="${fx(baseHalf * 2)}" height="${fx(h * 0.03)}" fill="${GOLD}" opacity="0.9"/>`
  // an arched louver on the mid slice, a gold finial seat on the peak slice
  if (idx === 1) {
    s += `<path d="M ${fx(cx - w * 0.1)} ${fx(h * 0.55)} L ${fx(cx - w * 0.1)} ${fx(h * 0.42)} Q ${fx(cx)} ${fx(h * 0.34)} ${fx(cx + w * 0.1)} ${fx(h * 0.42)} L ${fx(cx + w * 0.1)} ${fx(h * 0.55)} Z" fill="${INK}" opacity="0.7"/>`
  }
  if (idx === 2) {
    s += `<circle cx="${fx(cx)}" cy="${fx(tipY + h * 0.05)}" r="${fx(w * 0.14)}" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.5"/>` // finial ball (raven seats above)
  }
  s += rimPath(d, 4)
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE DUNES -> GOLD DISSOLVE (s5 ch4-dissolve-dunes / -gold). TWO full-bleed
// paintings that share ONE composition: the SAME layered dune ridgelines and the
// SAME camel-train station, so when the venetian slats flip, rolling desert
// TRANSMUTES into the dragon's gold hoard (matching big shapes are what sell the
// magic). Screen-space (art call sheet §1.6, the liftflap law): image-x = the
// page-fore axis d (the direction the 6 slats stack), image-y = the spine axis z
// (SVG top = z1 = the far sky, SVG bottom = z0 = the near foreground). Fully
// opaque full-bleed, no alpha, like a box face or a deck. ----

/** Interpolated crest height y at x across a crest polyline (both images share
 *  these, so the ridgelines register A<->B). */
function crestYAt(pts, x) {
  for (let i = 0; i + 1 < pts.length; i++) {
    if (x >= pts[i][0] && x <= pts[i + 1][0]) {
      const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0] || 1)
      return lerp(pts[i][1], pts[i + 1][1], t)
    }
  }
  return pts[pts.length - 1][1]
}

/** The shared desert composition: 4 layered dune crests (back high -> front low)
 *  as y-profiles, plus a camel-train station on the 2nd-back crest. Deterministic
 *  from the seed so dunes + gold are painted from the IDENTICAL big shapes. */
function dissolveScene(w, h, seed) {
  const r = mulberry32(seed)
  const layers = 4
  const crests = []
  for (let L = 0; L < layers; L++) {
    // Back crest sits HIGH (slim sky band) so the golden dunes dominate the
    // canvas at scene scale; front crest low. Bolder amplitude = a silhouette
    // that reads at the pinned camera.
    const baseY = h * (0.26 + L * 0.185)
    const amp = h * (0.06 + L * 0.028)
    const phase = r() * 6.28
    const cols = 12
    const pts = []
    for (let i = 0; i <= cols; i++) {
      const x = (w * i) / cols
      const y = baseY - Math.sin(i * 0.8 + L * 1.9 + phase) * amp - amp * 0.4 * Math.sin(i * 1.7 + phase * 2) - amp * 0.3
      pts.push([x, y])
    }
    crests.push({ baseY, pts })
  }
  // The low SUN — the scene's dominant shared LANDMARK: a sun over the dunes in
  // A, a great gold medallion in B (the eye's "this became that" anchor).
  const sun = { x: w * 0.7, y: h * 0.22, r: h * 0.15 }
  // camel train walking the 2nd-from-back crest ridge (humped silhouettes)
  const ridge = crests[1].pts
  const camels = []
  const cn = 4
  for (let i = 0; i < cn; i++) {
    const x = w * (0.18 + i * 0.09)
    camels.push([x, crestYAt(ridge, x) - h * 0.008])
  }
  return { crests, camels, sun }
}

/** One camel silhouette (two humps + neck), scaled by s, in the given ink. */
function camelGlyph(x, y, s, fill) {
  return (
    `<path d="M ${fx(x - 3.4 * s)} ${fx(y)} q ${fx(1.2 * s)} ${fx(-2.2 * s)} ${fx(2.4 * s)} 0 ` +
    `q ${fx(1.1 * s)} ${fx(-2.4 * s)} ${fx(2.3 * s)} 0 l ${fx(1.4 * s)} ${fx(0.2 * s)} ` +
    `q ${fx(0.3 * s)} ${fx(-1.9 * s)} ${fx(0.9 * s)} ${fx(-2.1 * s)} l ${fx(0.4 * s)} ${fx(2.3 * s)} Z" ` +
    `fill="${fill}"/>` +
    `<line x1="${fx(x - 2.6 * s)}" y1="${fx(y + 0.2 * s)}" x2="${fx(x - 2.9 * s)}" y2="${fx(y + 2.4 * s)}" stroke="${fill}" stroke-width="${fx(0.7 * s)}"/>` +
    `<line x1="${fx(x + 2.2 * s)}" y1="${fx(y + 0.2 * s)}" x2="${fx(x + 2.5 * s)}" y2="${fx(y + 2.4 * s)}" stroke="${fill}" stroke-width="${fx(0.7 * s)}"/>`
  )
}

function dissolveDunes(w, h, seed) {
  const { crests, camels, sun } = dissolveScene(w, h, seed)
  // VAULT_NIGHT regrade (E3 s5): night falls on the golden dunes — plum-
  // indigo sky, a low MOON where the sun was (the shared landmark keeps its
  // station for the A<->B registration), violet-shadowed dunes with moonlit
  // gold wind-lips. Same composition code, dark register.
  const SKY_TOP = '#1b1430', SKY_MID = '#2b2140', SKY_LOW = '#4c3a56'
  const SAND = ['#8a6a3a', '#6e5340', '#5c4160', '#38294a'] // moonlit gold back -> violet-shadow front
  const SAND_LIT = '#e0b04f'
  const defs =
    `<linearGradient id="dvSky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${SKY_TOP}"/><stop offset="0.55" stop-color="${SKY_MID}"/><stop offset="1" stop-color="${SKY_LOW}"/></linearGradient>`
  let s = `<rect width="${w}" height="${h}" fill="url(#dvSky)"/>`
  // a scatter of desert stars above the crests
  const rStar = mulberry32(seed ^ 0x77)
  for (let i = 0; i < 30; i++) {
    s += `<circle cx="${fx(rr(rStar, 0, w))}" cy="${fx(rr(rStar, 0, h * 0.3))}" r="${fx(rr(rStar, 0.8, 1.8))}" fill="#f6eed7" opacity="${rr(rStar, 0.3, 0.85).toFixed(2)}"/>`
  }
  // the low MOON — the shared landmark at the sun's exact station
  s += `<circle cx="${fx(sun.x)}" cy="${fx(sun.y)}" r="${fx(sun.r)}" fill="#f6eed7"/>`
  s += `<circle cx="${fx(sun.x)}" cy="${fx(sun.y)}" r="${fx(sun.r * 0.66)}" fill="#fffcf0"/>`
  s += `<circle cx="${fx(sun.x - sun.r * 0.28)}" cy="${fx(sun.y - sun.r * 0.2)}" r="${fx(sun.r * 0.14)}" fill="#ddd2c2" opacity="0.7"/>` // maria
  s += `<circle cx="${fx(sun.x + sun.r * 0.2)}" cy="${fx(sun.y + sun.r * 0.24)}" r="${fx(sun.r * 0.1)}" fill="#ddd2c2" opacity="0.6"/>`
  // dune crests, back -> front (each fills from its ridge down to the canvas foot)
  crests.forEach((c, L) => {
    let d = `M 0 ${fx(c.pts[0][1])}`
    for (const [x, y] of c.pts) d += ` L ${fx(x)} ${fx(y)}`
    d += ` L ${w} ${h} L 0 ${h} Z`
    s += `<path d="${d}" fill="${SAND[L]}"/>`
    // a lit wind-lip along the ridge — bolder so the silhouette reads small
    let lip = `M ${fx(c.pts[0][0])} ${fx(c.pts[0][1])}`
    for (const [x, y] of c.pts) lip += ` L ${fx(x)} ${fx(y)}`
    s += `<path d="${lip}" fill="none" stroke="${SAND_LIT}" stroke-width="${fx(h * 0.009)}" opacity="${0.6 - L * 0.09}"/>`
  })
  // the camel train on the ridge — bold dark silhouettes (kept: the caravan's
  // "destination" appearance, the same chain the frieze + r2 print carry)
  for (const [x, y] of camels) s += camelGlyph(x, y, h * 0.03, '#140e22')
  // foreground ripples + a few pebbles
  const r = mulberry32(seed ^ 0x1d)
  for (let i = 0; i < 12; i++) {
    const y = h * (0.78 + r() * 0.2)
    s += `<path d="M 0 ${fx(y)} Q ${fx(w * 0.5)} ${fx(y - h * 0.02)} ${w} ${fx(y)}" fill="none" stroke="#6e5340" stroke-width="1.6" opacity="0.5"/>`
  }
  for (let i = 0; i < 9; i++) {
    const x = rr(r, w * 0.04, w * 0.96), y = rr(r, h * 0.82, h * 0.97)
    s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(rr(r, 5, 9))}" ry="3.4" fill="#241a2e" opacity="0.7"/>`
  }
  // the celebrated affordance: engraved brass slot plate + ember chevrons +
  // PULL along the tab-exit edge (shared by both faces so the plate never
  // flickers as the slats flip)
  s += brassPullPlate(w, h)
  return svgPiece(w, h, s, defs)
}

function dissolveGold(w, h, seed) {
  const { crests, camels, sun } = dissolveScene(w, h, seed) // SAME shapes as the dunes
  const defs =
    `<linearGradient id="dvGold" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#8f6415"/><stop offset="0.5" stop-color="#c99a30"/><stop offset="1" stop-color="#f2cf6e"/></linearGradient>`
  let s = `<rect width="${w}" height="${h}" fill="url(#dvGold)"/>`
  // the sun TRANSMUTED: a great gold medallion where the sun was (the "this
  // became that" anchor) — radiating glints, a gem at its heart
  s += `<circle cx="${fx(sun.x)}" cy="${fx(sun.y)}" r="${fx(sun.r * 1.15)}" fill="#fff6d0" opacity="0.85"/>` // halo
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * 6.283
    s += `<line x1="${fx(sun.x + Math.cos(ang) * sun.r * 1.1)}" y1="${fx(sun.y + Math.sin(ang) * sun.r * 1.1)}" x2="${fx(sun.x + Math.cos(ang) * sun.r * 1.5)}" y2="${fx(sun.y + Math.sin(ang) * sun.r * 1.5)}" stroke="${GOLD_LIT}" stroke-width="2.4" opacity="0.7"/>`
  }
  s += `<circle cx="${fx(sun.x)}" cy="${fx(sun.y)}" r="${fx(sun.r)}" fill="${GOLD_LIT}" stroke="#b8901e" stroke-width="${fx(h * 0.008)}"/>`
  s += `<circle cx="${fx(sun.x)}" cy="${fx(sun.y)}" r="${fx(sun.r * 0.62)}" fill="none" stroke="#b8901e" stroke-width="1.6" opacity="0.6"/>`
  s += `<circle cx="${fx(sun.x)}" cy="${fx(sun.y)}" r="${fx(sun.r * 0.24)}" fill="#c8434e" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.4"/>` // ruby heart
  // VAULT_NIGHT regrade: the gold face speaks the pack's FOIL RAMP — the
  // same 4 stops the dragon's facets carry, so pulling the tab transmutes
  // the dunes into the dragon's OWN material (the spread's thesis).
  const GOLD_HEAP = ['#fff1bd', '#f2cf6e', '#c99a30', '#8f6415'] // foilHi -> foilDeep, back -> front
  const r = mulberry32(seed ^ 0x60)
  // gold heaps on the SAME crest ridgelines
  crests.forEach((c, L) => {
    let d = `M 0 ${fx(c.pts[0][1])}`
    for (const [x, y] of c.pts) d += ` L ${fx(x)} ${fx(y)}`
    d += ` L ${w} ${h} L 0 ${h} Z`
    s += `<path d="${d}" fill="${GOLD_HEAP[L]}"/>`
    // bright crest sheen
    let lip = `M ${fx(c.pts[0][0])} ${fx(c.pts[0][1])}`
    for (const [x, y] of c.pts) lip += ` L ${fx(x)} ${fx(y)}`
    s += `<path d="${lip}" fill="none" stroke="${GOLD_LIT}" stroke-width="${fx(h * 0.01)}" opacity="${0.7 - L * 0.1}"/>`
    // scattered coins hugging each ridge (dense, so it reads as solid gold)
    const coins = 70 + L * 45
    for (let i = 0; i < coins; i++) {
      const x = rr(r, 0, w)
      const ry = crestYAt(c.pts, x)
      const y = ry + rr(r, 0, (h - ry) * 0.6)
      const cr = rr(r, 6, 13)
      const bright = r() < 0.5
      s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.7)}" fill="${bright ? GOLD_LIT : GOLD}" stroke="#b8901e" stroke-width="0.9"/>`
      if (r() < 0.35) s += `<ellipse cx="${fx(x - cr * 0.24)}" cy="${fx(y - cr * 0.22)}" rx="${fx(cr * 0.3)}" ry="${fx(cr * 0.2)}" fill="#fff6d6" opacity="0.85"/>`
    }
  })
  // the camel train transmuted: a caravan of crowns + goblets on the ridge —
  // rendered BOLD (solid fill + thick dark outline) so it reads at scene scale
  // as clearly as the dunes' dark camel silhouettes (the visible A<->B anchor,
  // since the sun/medallion is occluded by the scene goldpile at the camera).
  const CW = fx(h * 0.006) // outline weight
  camels.forEach(([x, y], i) => {
    const g = h * 0.042
    if (i % 2 === 0) {
      // crown — solid gold, dark rim, jewelled band
      s += `<path d="M ${fx(x - g)} ${fx(y)} L ${fx(x - g)} ${fx(y - g * 0.85)} L ${fx(x - g * 0.4)} ${fx(y - g * 0.25)} L ${fx(x)} ${fx(y - g * 1.05)} L ${fx(x + g * 0.4)} ${fx(y - g * 0.25)} L ${fx(x + g)} ${fx(y - g * 0.85)} L ${fx(x + g)} ${fx(y)} Z" fill="${GOLD_LIT}" stroke="#4a3208" stroke-width="${CW}" stroke-linejoin="round"/>`
      s += `<rect x="${fx(x - g)}" y="${fx(y - g * 0.28)}" width="${fx(g * 2)}" height="${fx(g * 0.28)}" fill="${GOLD}" stroke="#4a3208" stroke-width="${CW}"/>`
      for (const jx of [-0.5, 0, 0.5]) s += `<circle cx="${fx(x + jx * g)}" cy="${fx(y - g * 0.62)}" r="${fx(g * 0.16)}" fill="#c8434e" stroke="#4a3208" stroke-width="1"/>`
    } else {
      // goblet — solid gold cup on a stem, dark rim
      s += `<path d="M ${fx(x - g * 0.72)} ${fx(y - g * 1.05)} L ${fx(x + g * 0.72)} ${fx(y - g * 1.05)} Q ${fx(x)} ${fx(y - g * 0.05)} ${fx(x - g * 0.72)} ${fx(y - g * 1.05)} Z" fill="${GOLD_LIT}" stroke="#4a3208" stroke-width="${CW}" stroke-linejoin="round"/>`
      s += `<rect x="${fx(x - g * 0.12)}" y="${fx(y - g * 0.5)}" width="${fx(g * 0.24)}" height="${fx(g * 0.5)}" fill="${GOLD}" stroke="#4a3208" stroke-width="1"/>`
      s += `<rect x="${fx(x - g * 0.5)}" y="${fx(y)}" width="${fx(g)}" height="${fx(g * 0.16)}" fill="${GOLD}" stroke="#4a3208" stroke-width="1"/>` // foot
    }
  })
  // a few big gems catching light across the heap — thin-film accents
  for (let i = 0; i < 9; i++) {
    const x = rr(r, w * 0.08, w * 0.92), y = rr(r, h * 0.4, h * 0.94)
    const col = ['#3f8f82', '#c8434e', '#a85577', '#8a6fd6'][i % 4]
    s += `<path d="M ${fx(x)} ${fx(y - 9)} l 9 9 l -9 9 l -9 -9 Z" fill="${col}" stroke="${INK}" stroke-width="1.1" stroke-opacity="0.4"/>`
    s += `<path d="M ${fx(x)} ${fx(y - 9)} l 9 9 l -9 0 Z" fill="#ffffff" opacity="0.35"/>`
  }
  // the brass slot plate rides both faces (identical station: no flicker)
  s += brassPullPlate(w, h)
  return svgPiece(w, h, s, defs)
}

// ---- DRESS PATCHES (alpha silhouette). Small storytelling cut-outs. ----
function dressPatch(w, h, seed, kind) {
  const r = mulberry32(seed)
  if (kind === 'hiveSwarm') {
    // a drifting knot of bees hanging off the hive lid
    let s = `<g>`
    for (let i = 0; i < 12; i++) {
      const x = rr(r, w * 0.1, w * 0.9),
        y = rr(r, h * 0.1, h * 0.9)
      s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="8" ry="5" fill="${GOLD}" stroke="${INK}" stroke-width="1.6"/>`
      s += `<line x1="${fx(x - 3)}" y1="${fx(y)}" x2="${fx(x + 3)}" y2="${fx(y)}" stroke="${INK}" stroke-width="1.4"/>`
      s += `<ellipse cx="${fx(x)}" cy="${fx(y - 4)}" rx="6" ry="3" fill="#ffffff" opacity="0.4"/>` // wings
    }
    s += `</g>`
    return svgPiece(w, h, s)
  }
  if (kind === 'flowers') {
    let s = `<g>`
    // clump of alpine flowers on stems rising from the base
    for (let i = 0; i < 9; i++) {
      const x = rr(r, w * 0.08, w * 0.92)
      const fh = rr(r, h * 0.5, h * 0.92)
      s += `<path d="M ${fx(x)} ${fx(h)} Q ${fx(x + rr(r, -8, 8))} ${fx(h - fh * 0.6)} ${fx(x)} ${fx(h - fh)}" fill="none" stroke="#5f7a44" stroke-width="2.4" opacity="0.9"/>`
      const c = ['#d9a441', '#c46a6a', '#e6e0b0', '#8a6fd6'][i % 4]
      for (let k = 0; k < 5; k++) {
        const a = (k * 2 * Math.PI) / 5
        s += `<circle cx="${fx(x + Math.cos(a) * 6)}" cy="${fx(h - fh + Math.sin(a) * 6)}" r="4.5" fill="${c}" stroke="${INK}" stroke-width="0.9" stroke-opacity="0.35"/>`
      }
      s += `<circle cx="${fx(x)}" cy="${fx(h - fh)}" r="3" fill="${GOLD}"/>`
    }
    s += `</g>`
    return svgPiece(w, h, s)
  }
  if (kind === 'chestLid') {
    // propped-open chest lid, VAULT_NIGHT regrade: walnut-black dome, foil clasp
    const d = `M ${fx(w * 0.08)} ${fx(h)} L ${fx(w * 0.08)} ${fx(h * 0.4)} Q ${fx(w * 0.5)} ${fx(h * 0.02)} ${fx(w * 0.92)} ${fx(h * 0.4)} L ${fx(w * 0.92)} ${fx(h)} Z`
    let s = `<path d="${d}" fill="#3a2418"/>`
    s += `<path d="M ${fx(w * 0.08)} ${fx(h)} L ${fx(w * 0.08)} ${fx(h * 0.4)} Q ${fx(w * 0.3)} ${fx(h * 0.14)} ${fx(w * 0.5)} ${fx(h * 0.1)} L ${fx(w * 0.5)} ${fx(h)} Z" fill="#553520" opacity="0.5"/>`
    for (const sx of [0.3, 0.7]) s += `<path d="M ${fx(w * sx)} ${fx(h)} L ${fx(w * sx)} ${fx(h * 0.2)}" stroke="#33333e" stroke-width="${fx(w * 0.045)}" opacity="0.9"/>`
    s += `<path d="M ${fx(w * 0.5)} ${fx(h * 0.1)} m ${fx(-w * 0.08)} 0 a ${fx(w * 0.08)} ${fx(w * 0.08)} 0 1 0 ${fx(w * 0.16)} 0" fill="#c99a30" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.4"/>` // foil clasp
    s += `<path d="M ${fx(w * 0.5)} ${fx(h * 0.1)} m ${fx(-w * 0.05)} ${fx(-w * 0.01)} a ${fx(w * 0.05)} ${fx(w * 0.05)} 0 0 1 ${fx(w * 0.06)} ${fx(-w * 0.015)}" fill="none" stroke="#fff1bd" stroke-width="1.6" opacity="0.7"/>`
    s += rimPath(d, 4)
    return svgPiece(w, h, s)
  }
  if (kind === 'goldSpill') {
    // coins heaped/spilling across the front cap — foil-ramp night grade
    let s = `<g>`
    const base = `M 0 ${fx(h)} Q ${fx(w * 0.3)} ${fx(h * 0.4)} ${fx(w * 0.55)} ${fx(h * 0.55)} Q ${fx(w * 0.8)} ${fx(h * 0.66)} ${fx(w)} ${fx(h * 0.5)} L ${fx(w)} ${fx(h)} Z`
    s += `<path d="${base}" fill="#6b5012"/>`
    for (let i = 0; i < 90; i++) {
      const x = rr(r, 0, w),
        y = rr(r, h * 0.5, h)
      const cr = rr(r, 5, 10)
      s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.72)}" fill="${r() < 0.5 ? '#c99a30' : '#f2cf6e'}" stroke="#8f6415" stroke-width="1"/>`
      if (r() < 0.22) s += `<ellipse cx="${fx(x - cr * 0.22)}" cy="${fx(y - cr * 0.2)}" rx="${fx(cr * 0.28)}" ry="${fx(cr * 0.18)}" fill="#fff1bd" opacity="0.85"/>`
    }
    s += rimPath(base, 4)
    s += `</g>`
    return svgPiece(w, h, s)
  }
  if (kind === 'valance') {
    // scalloped awning valance hanging off the canopy edge, striped
    const scallops = 7
    let d = `M 0 0 L ${w} 0 L ${w} ${fx(h * 0.4)}`
    for (let i = scallops - 1; i >= 0; i--) {
      const x0 = (w * i) / scallops
      const xm = x0 + w / scallops / 2
      d += ` Q ${fx(xm)} ${fx(h)} ${fx(x0)} ${fx(h * 0.4)}`
    }
    d += ` Z`
    let s = `<path d="${d}" fill="#efe3c6"/>`
    for (let i = 0; i < scallops; i++) if (i % 2) s += `<rect x="${fx((w * i) / scallops)}" y="0" width="${fx(w / scallops)}" height="${fx(h * 0.55)}" fill="#b5503f" opacity="0.85"/>`
    s += `<rect x="0" y="0" width="${w}" height="${fx(h * 0.16)}" fill="#7a5433"/>` // rail
    s += rimPath(d, 4)
    return svgPiece(w, h, s)
  }
  if (kind === 'crates') {
    // stacked crates against the stall wall
    let s = `<g>`
    const crate = (x, y, cw, ch, col) => {
      let t = `<rect x="${fx(x)}" y="${fx(y)}" width="${fx(cw)}" height="${fx(ch)}" fill="${col}" stroke="${INK}" stroke-width="1.8" stroke-opacity="0.5"/>`
      t += `<line x1="${fx(x)}" y1="${fx(y + ch * 0.5)}" x2="${fx(x + cw)}" y2="${fx(y + ch * 0.5)}" stroke="${INK}" stroke-width="1.4" opacity="0.4"/>`
      t += `<line x1="${fx(x + cw * 0.5)}" y1="${fx(y)}" x2="${fx(x + cw * 0.5)}" y2="${fx(y + ch)}" stroke="${INK}" stroke-width="1.4" opacity="0.4"/>`
      return t
    }
    s += crate(w * 0.06, h * 0.5, w * 0.5, h * 0.46, '#a9773f')
    s += crate(w * 0.5, h * 0.44, w * 0.44, h * 0.52, '#8a6438')
    s += crate(w * 0.28, h * 0.08, w * 0.42, h * 0.4, '#b98a4c')
    // a few fruits atop
    for (let i = 0; i < 5; i++) s += `<circle cx="${fx(rr(r, w * 0.32, w * 0.66))}" cy="${fx(rr(r, h * 0.04, h * 0.12))}" r="5" fill="${['#d9a441', '#c46a6a'][i % 2]}" stroke="${INK}" stroke-width="1" stroke-opacity="0.35"/>`
    s += `</g>`
    return svgPiece(w, h, s)
  }
  if (kind === 'garland') {
    // festive garland/banner swagged across the arch top (the old blank flag)
    let s = `<g>`
    const sag = h * 0.5
    const swag = `M ${fx(w * 0.04)} ${fx(h * 0.2)} Q ${fx(w * 0.5)} ${fx(h * 0.2 + sag)} ${fx(w * 0.96)} ${fx(h * 0.2)}`
    s += `<path d="${swag}" fill="none" stroke="#5f7a44" stroke-width="6" opacity="0.9"/>`
    // hanging pennants along the swag
    const flags = 9
    for (let i = 0; i <= flags; i++) {
      const t = i / flags
      const x = lerp(w * 0.04, w * 0.96, t)
      const y = h * 0.2 + Math.sin(t * Math.PI) * sag
      const col = ['#a63d2f', '#d9a441', '#3f6f6a', '#e7d5a8'][i % 4]
      s += `<path d="M ${fx(x - w * 0.02)} ${fx(y)} L ${fx(x + w * 0.02)} ${fx(y)} L ${fx(x)} ${fx(y + h * 0.28)} Z" fill="${col}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.4"/>`
    }
    // little leaves/roses on the cord
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6
      const x = lerp(w * 0.04, w * 0.96, t)
      const y = h * 0.2 + Math.sin(t * Math.PI) * sag
      s += `<circle cx="${fx(x)}" cy="${fx(y - 6)}" r="5" fill="#c4766a" stroke="${INK}" stroke-width="1" stroke-opacity="0.35"/>`
    }
    s += `</g>`
    return svgPiece(w, h, s)
  }
  if (kind === 'eaves') {
    // a carved bargeboard eave overhanging the inn roofline: a timber board
    // with pendant scallops
    const scallops = 8
    let d = `M 0 0 L ${w} 0 L ${w} ${fx(h * 0.42)}`
    for (let i = scallops - 1; i >= 0; i--) {
      const x0 = (w * i) / scallops
      d += ` Q ${fx(x0 + w / scallops / 2)} ${fx(h)} ${fx(x0)} ${fx(h * 0.42)}`
    }
    d += ` Z`
    let s = `<path d="${d}" fill="#7a5433"/>`
    s += `<rect x="0" y="0" width="${w}" height="${fx(h * 0.24)}" fill="#8a6440"/>`
    s += `<rect x="0" y="0" width="${w}" height="${fx(h * 0.08)}" fill="#a07a4e" opacity="0.7"/>`
    for (let i = 0; i < scallops; i++) s += `<circle cx="${fx((w * (i + 0.5)) / scallops)}" cy="${fx(h * 0.5)}" r="3.5" fill="#5c3a22"/>` // pegs
    s += rimPath(d, 4)
    return svgPiece(w, h, s)
  }
  if (kind === 'lamp') {
    // a hanging iron lantern with a warm glow (tall silhouette)
    const cx = w / 2
    let s = `<g>`
    s += `<line x1="${fx(cx)}" y1="0" x2="${fx(cx)}" y2="${fx(h * 0.16)}" stroke="#3a3a40" stroke-width="3"/>` // hook chain
    s += `<path d="M ${fx(cx)} ${fx(h * 0.12)} q ${fx(-w * 0.14)} ${fx(h * 0.02)} ${fx(-w * 0.14)} ${fx(h * 0.14)}" fill="none" stroke="#3a3a40" stroke-width="2.4"/>`
    const bx0 = w * 0.2,
      bx1 = w * 0.8,
      by0 = h * 0.24,
      by1 = h * 0.84
    const body = `M ${fx(bx0)} ${fx(by0)} L ${fx(bx1)} ${fx(by0)} L ${fx(bx1 + w * 0.06)} ${fx(by1)} L ${fx(bx0 - w * 0.06)} ${fx(by1)} Z`
    s += `<path d="M ${fx(cx - w * 0.18)} ${fx(by0)} L ${fx(cx + w * 0.18)} ${fx(by0)} L ${fx(cx)} ${fx(h * 0.14)} Z" fill="#454550" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.5"/>` // cap
    s += `<path d="${body}" fill="url(#lampglow)"/>`
    s += `<path d="${body}" fill="none" stroke="#3a3a40" stroke-width="3"/>`
    s += `<line x1="${fx(cx)}" y1="${fx(by0)}" x2="${fx(cx)}" y2="${fx(by1)}" stroke="#3a3a40" stroke-width="2"/>`
    s += `<ellipse cx="${fx(cx)}" cy="${fx(h * 0.54)}" rx="${fx(w * 0.12)}" ry="${fx(h * 0.14)}" fill="${GOLD_LIT}" opacity="0.8"/>` // flame glow
    s += `<circle cx="${fx(cx)}" cy="${fx(h * 0.9)}" r="4" fill="#454550"/>` // finial
    s += rimPath(body, 4)
    s += `</g>`
    return svgPiece(
      w,
      h,
      s,
      `<radialGradient id="lampglow" cx="0.5" cy="0.5" r="0.7"><stop offset="0" stop-color="${GOLD_LIT}"/><stop offset="0.6" stop-color="${GOLD}"/><stop offset="1" stop-color="#8a5a1e"/></radialGradient>`
    )
  }
  if (kind === 'vane') {
    // a weathervane: a rod topped by a cockerel + a N-S arrow (tall)
    const cx = w / 2
    let s = `<g>`
    s += `<rect x="${fx(cx - w * 0.04)} " y="${fx(h * 0.3)}" width="${fx(w * 0.08)}" height="${fx(h * 0.7)}" fill="#454550"/>` // rod
    // direction arrow
    s += `<path d="M ${fx(w * 0.1)} ${fx(h * 0.42)} L ${fx(w * 0.9)} ${fx(h * 0.42)} M ${fx(w * 0.9)} ${fx(h * 0.42)} l ${fx(-w * 0.12)} ${fx(-h * 0.04)} m ${fx(w * 0.12)} ${fx(h * 0.04)} l ${fx(-w * 0.12)} ${fx(h * 0.04)}" fill="none" stroke="#3a3a40" stroke-width="3"/>`
    // cockerel silhouette on top
    const cd = `M ${fx(cx - w * 0.18)} ${fx(h * 0.28)} Q ${fx(cx - w * 0.24)} ${fx(h * 0.14)} ${fx(cx - w * 0.02)} ${fx(h * 0.12)} Q ${fx(cx)} ${fx(h * 0.02)} ${fx(cx + w * 0.08)} ${fx(h * 0.04)} Q ${fx(cx + w * 0.04)} ${fx(h * 0.1)} ${fx(cx + w * 0.12)} ${fx(h * 0.12)} Q ${fx(cx + w * 0.28)} ${fx(h * 0.16)} ${fx(cx + w * 0.18)} ${fx(h * 0.28)} Q ${fx(cx)} ${fx(h * 0.24)} ${fx(cx - w * 0.18)} ${fx(h * 0.28)} Z`
    s += `<path d="${cd}" fill="#454550" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.5"/>`
    s += `<circle cx="${fx(cx - w * 0.02)}" cy="${fx(h * 0.11)}" r="2.6" fill="${GOLD_LIT}"/>` // eye
    s += rimPath(cd, 3)
    s += `</g>`
    return svgPiece(w, h, s)
  }
  if (kind === 'hay') {
    // a round hay bale bound with twine
    const cx = w / 2,
      cy = h * 0.56,
      rx = w * 0.44,
      ry = h * 0.42
    let s = `<g><ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(rx)}" ry="${fx(ry)}" fill="#c9a24a"/>`
    s += `<ellipse cx="${fx(cx - rx * 0.3)}" cy="${fx(cy - ry * 0.3)}" rx="${fx(rx * 0.6)}" ry="${fx(ry * 0.6)}" fill="#dcb862" opacity="0.5"/>`
    // straw strokes
    for (let i = 0; i < 40; i++) {
      const a = rr(r, 0, Math.PI * 2)
      const rr0 = rr(r, 0, 0.9)
      const x = cx + Math.cos(a) * rx * rr0
      const y = cy + Math.sin(a) * ry * rr0
      s += `<line x1="${fx(x)}" y1="${fx(y)}" x2="${fx(x + rr(r, -8, 8))}" y2="${fx(y + rr(r, -8, 8))}" stroke="#a07f2e" stroke-width="1.4" opacity="0.5"/>`
    }
    // twine bindings
    for (const t of [-0.35, 0.35]) s += `<ellipse cx="${fx(cx + rx * t)}" cy="${fx(cy)}" rx="${fx(rx * 0.12)}" ry="${fx(ry)}" fill="none" stroke="#6b4522" stroke-width="2.4" opacity="0.7"/>`
    s += rimPath(`M ${fx(cx - rx)} ${fx(cy)} a ${fx(rx)} ${fx(ry)} 0 1 0 ${fx(rx * 2)} 0 a ${fx(rx)} ${fx(ry)} 0 1 0 ${fx(-rx * 2)} 0 Z`, 4)
    s += `</g>`
    return svgPiece(w, h, s)
  }
  if (kind === 'glassSpire') {
    // treasury glass spire — teal glass panes in gold mullions rising to a point
    const cx = w / 2
    const x0 = w * 0.2,
      x1 = w * 0.8,
      baseY = h * 0.96,
      tipY = h * 0.04
    const d = `M ${fx(x0)} ${fx(baseY)} L ${fx(cx)} ${fx(tipY)} L ${fx(x1)} ${fx(baseY)} Z`
    let s = `<path d="${d}" fill="#2e5a4c"/>`
    s += `<path d="M ${fx(x0)} ${fx(baseY)} L ${fx(cx)} ${fx(tipY)} L ${fx(cx)} ${fx(baseY)} Z" fill="#3f6b5a" opacity="0.6"/>`
    for (let i = 1; i < 5; i++) {
      const y = lerp(baseY, tipY, i / 5)
      const hw = lerp((x1 - x0) / 2, 0, i / 5)
      s += `<line x1="${fx(cx - hw)}" y1="${fx(y)}" x2="${fx(cx + hw)}" y2="${fx(y)}" stroke="${GOLD}" stroke-width="2.4" opacity="0.85"/>` // gold transom
    }
    s += `<line x1="${fx(cx)}" y1="${fx(tipY)}" x2="${fx(cx)}" y2="${fx(baseY)}" stroke="${GOLD}" stroke-width="2.4" opacity="0.85"/>`
    s += `<path d="M ${fx(cx - w * 0.06)} ${fx(baseY - h * 0.4)} L ${fx(cx)} ${fx(tipY + h * 0.08)}" stroke="#7fe6cf" stroke-width="2" opacity="0.5"/>` // glint
    s += `<circle cx="${fx(cx)}" cy="${fx(tipY)}" r="4" fill="${GOLD_LIT}"/>` // finial
    s += rimPath(d, 4)
    return svgPiece(w, h, s)
  }
  if (kind === 'vines') {
    // climbing vines with teal leaves + small aurora flowers
    let s = `<g>`
    for (let v = 0; v < 3; v++) {
      const x0 = rr(r, w * 0.15, w * 0.85)
      let d = `M ${fx(x0)} ${fx(h)}`
      let x = x0,
        y = h
      for (let i = 0; i < 6; i++) {
        const nx = x + rr(r, -w * 0.12, w * 0.12),
          ny = y - h * 0.16
        d += ` Q ${fx(x + rr(r, -w * 0.1, w * 0.1))} ${fx((y + ny) / 2)} ${fx(nx)} ${fx(ny)}`
        x = nx
        y = ny
        s += `<path d="M ${fx(x)} ${fx(y)} q ${fx(w * 0.06)} ${fx(-h * 0.04)} ${fx(w * 0.02)} ${fx(-h * 0.1)} q ${fx(-w * 0.06)} ${fx(h * 0.02)} ${fx(-w * 0.02)} ${fx(h * 0.1)} Z" fill="#3f7d5f" stroke="${INK}" stroke-width="1" stroke-opacity="0.3"/>` // leaf
        if (i % 2) s += `<circle cx="${fx(x)}" cy="${fx(y)}" r="4" fill="#7f6fd6" stroke="${INK}" stroke-width="0.9" stroke-opacity="0.3"/>` // violet flower
      }
      s += `<path d="${d}" fill="none" stroke="#2e5244" stroke-width="3" opacity="0.9"/>`
    }
    s += `</g>`
    return svgPiece(w, h, s)
  }
  if (kind === 'griffin') {
    // the bank's griffin crest — a rampant griffin in gold on a teal shield
    const cx = w / 2
    const sh = `M ${fx(w * 0.16)} ${fx(h * 0.1)} L ${fx(w * 0.84)} ${fx(h * 0.1)} L ${fx(w * 0.84)} ${fx(h * 0.5)} Q ${fx(w * 0.84)} ${fx(h * 0.86)} ${fx(cx)} ${fx(h * 0.96)} Q ${fx(w * 0.16)} ${fx(h * 0.86)} ${fx(w * 0.16)} ${fx(h * 0.5)} Z`
    let s = `<path d="${sh}" fill="#2e5244"/>`
    s += `<path d="M ${fx(w * 0.16)} ${fx(h * 0.1)} L ${fx(cx)} ${fx(h * 0.1)} L ${fx(cx)} ${fx(h * 0.96)} Q ${fx(w * 0.16)} ${fx(h * 0.86)} ${fx(w * 0.16)} ${fx(h * 0.5)} Z" fill="#3f6b5a" opacity="0.5"/>`
    // stylised rampant griffin (wing + beak + raised claw) in gold
    s += `<path d="M ${fx(cx - w * 0.12)} ${fx(h * 0.78)} Q ${fx(cx - w * 0.2)} ${fx(h * 0.5)} ${fx(cx - w * 0.04)} ${fx(h * 0.42)} Q ${fx(cx - w * 0.02)} ${fx(h * 0.28)} ${fx(cx + w * 0.1)} ${fx(h * 0.26)} L ${fx(cx + w * 0.22)} ${fx(h * 0.22)} L ${fx(cx + w * 0.1)} ${fx(h * 0.32)} Q ${fx(cx + w * 0.14)} ${fx(h * 0.5)} ${fx(cx + w * 0.04)} ${fx(h * 0.6)} Q ${fx(cx + w * 0.16)} ${fx(h * 0.74)} ${fx(cx + w * 0.02)} ${fx(h * 0.8)} Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.5"/>`
    s += `<path d="M ${fx(cx - w * 0.06)} ${fx(h * 0.4)} Q ${fx(cx + w * 0.06)} ${fx(h * 0.34)} ${fx(cx + w * 0.12)} ${fx(h * 0.46)}" fill="none" stroke="${GOLD_LIT}" stroke-width="2.4" opacity="0.8"/>` // wing sweep
    s += `<circle cx="${fx(cx + w * 0.12)}" cy="${fx(h * 0.28)}" r="2.6" fill="${INK}"/>` // eye
    s += `<path d="${sh}" fill="none" stroke="${GOLD}" stroke-width="4" opacity="0.85"/>`
    s += rimPath(sh, 4)
    return svgPiece(w, h, s)
  }
  if (kind === 'waxSealN') {
    // a violet/teal wax seal for the strongbox (northern)
    const cx = w / 2,
      cy = h / 2,
      R = Math.min(w, h) * 0.4
    let s = `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="#5a3f8a" stroke="#2a1c45" stroke-width="2.4"/>`
    s += `<circle cx="${fx(cx - R * 0.28)}" cy="${fx(cy - R * 0.28)}" r="${fx(R * 0.7)}" fill="#7256a8" opacity="0.4"/>`
    s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * 0.66)}" fill="none" stroke="#2a1c45" stroke-width="1.6" opacity="0.7"/>`
    const star = []
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6 - Math.PI / 2
      const rl = k % 2 ? R * 0.22 : R * 0.5
      star.push(`${fx(cx + Math.cos(a) * rl)} ${fx(cy + Math.sin(a) * rl)}`)
    }
    s += `<path d="M ${star.join(' L ')} Z" fill="#2a1c45" opacity="0.55"/>`
    s += rimPath(`M ${fx(cx - R)} ${fx(cy)} a ${fx(R)} ${fx(R)} 0 1 0 ${fx(R * 2)} 0 a ${fx(R)} ${fx(R)} 0 1 0 ${fx(-R * 2)} 0 Z`, 4)
    return svgPiece(w, h, s)
  }
  if (kind === 'mintedCoins') {
    // a low heap of freshly minted gold coins at the strongbox base
    const base = `M 0 ${fx(h)} Q ${fx(w * 0.3)} ${fx(h * 0.35)} ${fx(w * 0.55)} ${fx(h * 0.5)} Q ${fx(w * 0.8)} ${fx(h * 0.62)} ${fx(w)} ${fx(h * 0.45)} L ${fx(w)} ${fx(h)} Z`
    let s = `<path d="${base}" fill="#c79a24"/>`
    for (let i = 0; i < 70; i++) {
      const x = rr(r, 0, w),
        y = rr(r, h * 0.45, h)
      const cr = rr(r, 6, 11)
      s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.72)}" fill="${r() < 0.55 ? GOLD_LIT : GOLD}" stroke="#b8901e" stroke-width="1"/>`
      if (r() < 0.4) s += `<ellipse cx="${fx(x - cr * 0.2)}" cy="${fx(y - cr * 0.2)}" rx="${fx(cr * 0.3)}" ry="${fx(cr * 0.2)}" fill="#fff4cf" opacity="0.8"/>`
    }
    s += rimPath(base, 4)
    return svgPiece(w, h, s)
  }
  // keystone — a carved medallion boss for the arch crown
  const cx = w / 2,
    cy = h / 2,
    R = Math.min(w, h) * 0.42
  let s = `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="${PARCH_MID}" stroke="${INK}" stroke-width="2" stroke-opacity="0.5"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * 0.72)}" fill="none" stroke="${GOLD}" stroke-width="3" opacity="0.85"/>`
  // an eight-petal rosette
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    s += `<ellipse cx="${fx(cx + Math.cos(a) * R * 0.38)}" cy="${fx(cy + Math.sin(a) * R * 0.38)}" rx="${fx(R * 0.16)}" ry="${fx(R * 0.28)}" fill="${PARCH}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.4" transform="rotate(${fx((a * 180) / Math.PI)} ${fx(cx + Math.cos(a) * R * 0.38)} ${fx(cy + Math.sin(a) * R * 0.38)})"/>`
  }
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * 0.16)}" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.4"/>`
  s += rimPath(`M ${fx(cx - R)} ${fx(cy)} a ${fx(R)} ${fx(R)} 0 1 0 ${fx(R * 2)} 0 a ${fx(R)} ${fx(R)} 0 1 0 ${fx(-R * 2)} 0 Z`, 4)
  return svgPiece(w, h, s)
}

// ---- THE MEADOW WINDMILL SAIL (s3 ch2-windmill, kinetic arm|flap). A wooden
// lattice sail catching the wind. Painted as a battened frame with canvas
// panels — orientation-tolerant (reads as a sail whichever half is arm vs
// flap) so the split can't produce wrong art. Alpha carves the blade. ----
function windmillSail(w, h, seed) {
  const r = mulberry32(seed)
  const WOOD = '#8a5a34',
    WLIT = '#a6744c',
    CANVAS = '#efe3c6'
  const x0 = w * 0.16,
    x1 = w * 0.84,
    y0 = h * 0.06,
    y1 = h * 0.94
  const d = `M ${fx(x0)} ${fx(y0)} L ${fx(x1)} ${fx(y0)} L ${fx(x1)} ${fx(y1)} L ${fx(x0)} ${fx(y1)} Z`
  let s = `<g>`
  // canvas backing
  s += `<path d="${d}" fill="${CANVAS}"/>`
  s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx((x1 - x0) * 0.5)}" height="${fx(y1 - y0)}" fill="#ffffff" opacity="0.18"/>`
  // lattice battens
  const spar = w * 0.5
  s += `<rect x="${fx(spar - w * 0.03)}" y="${fx(y0)}" width="${fx(w * 0.06)}" height="${fx(y1 - y0)}" fill="${WOOD}"/>` // main spar
  for (let i = 1; i < 8; i++) {
    const y = lerp(y0, y1, i / 8)
    s += `<line x1="${fx(x0)}" y1="${fx(y)}" x2="${fx(x1)}" y2="${fx(y)}" stroke="${WOOD}" stroke-width="4" opacity="0.9"/>` // battens
    s += `<line x1="${fx(x0)}" y1="${fx(y - 1)}" x2="${fx(x1)}" y2="${fx(y - 1)}" stroke="${WLIT}" stroke-width="1.4" opacity="0.6"/>`
  }
  for (const bx of [x0 + (x1 - x0) * 0.25, x0 + (x1 - x0) * 0.75]) s += `<rect x="${fx(bx - w * 0.015)}" y="${fx(y0)}" width="${fx(w * 0.03)}" height="${fx(y1 - y0)}" fill="${WOOD}" opacity="0.85"/>`
  s += rimPath(d, 4)
  s += `</g>`
  void r
  return svgPiece(w, h, s)
}

// ============================================================================
// THE DISPATCH VOLVELLE (Spread 4). A reader-spun raven "dispatch dial" riveted
// flat into the Keep's right page: a spun DIAL disc beneath a static WINDOW
// CARD faceplate. Both are 1:1 CIRCULAR die-cuts — transparent OUTSIDE the
// inscribed circle (the runtime's alphaTest 0.1 rounds them) — and they SHARE
// one geometry basis (centre 320,320, disc radius R = w*0.46875 = 300) so the
// dial's eight sector motifs and the card's three apertures register on the
// SAME math-angle convention (+y UP: pixelX = cx + r*cosθ, pixelY = cy - r*sinθ).
// Theme: "four billion ravens routed by one wheel." Deterministic: all randomness
// flows through mulberry32(seed); everything else is fixed constants.
// ============================================================================

const D2R = Math.PI / 180
// math-angle (deg, +y UP, CCW from +x) -> pixel; SVG y grows DOWN so y = cy - r*sinθ
const polX = (cx, ang, r) => cx + r * Math.cos(ang * D2R)
const polY = (cy, ang, r) => cy - r * Math.sin(ang * D2R)

/** A circle expressed as a closed path (two half-arcs) so it can join an
 *  even-odd compound path as an outer boundary or a punched hole. */
function circlePath(cx, cy, r) {
  return (
    `M ${fx(cx - r)} ${fx(cy)} A ${fx(r)} ${fx(r)} 0 1 0 ${fx(cx + r)} ${fx(cy)} ` +
    `A ${fx(r)} ${fx(r)} 0 1 0 ${fx(cx - r)} ${fx(cy)} Z`
  )
}

/** Sampled annular-sector path (arc drawn as a polyline — deterministic, no
 *  SVG arc-flag ambiguity). Centred on math-angle psi, angular half-width halfW
 *  deg, radial band [rIn,rOut]. Outer arc then inner arc back = one closed ring
 *  slice. Used for the dial wedges' read band and the card's window apertures. */
function annularSectorPath(cx, cy, psi, halfW, rIn, rOut, steps = 16) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const a = psi - halfW + (2 * halfW * i) / steps
    pts.push([polX(cx, a, rOut), polY(cy, a, rOut)])
  }
  for (let i = 0; i <= steps; i++) {
    const a = psi + halfW - (2 * halfW * i) / steps
    pts.push([polX(cx, a, rIn), polY(cy, a, rIn)])
  }
  return 'M ' + pts.map((p) => `${fx(p[0])} ${fx(p[1])}`).join(' L ') + ' Z'
}

/** Sampled pie-wedge from the centre out to radius r, spanning [a0,a1] deg. */
function wedgePath(cx, cy, a0, a1, r, steps = 10) {
  let d = `M ${fx(cx)} ${fx(cy)} L ${fx(polX(cx, a0, r))} ${fx(polY(cy, a0, r))}`
  for (let i = 1; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps
    d += ` L ${fx(polX(cx, a, r))} ${fx(polY(cy, a, r))}`
  }
  return d + ` L ${fx(cx)} ${fx(cy)} Z`
}

/** A compact banking raven silhouette — wings spread, wedge tail, nominal
 *  heading local +y (UP), centred at the local origin, wingspan ~2*S. Slate
 *  cut-paper with a wing sheen + fine ink cut-edge. Placed via a translate+rotate
 *  group so each sector can bank it to a DIFFERENT heading. */
function miniRaven(S, body, sheen) {
  const P = (mx, my) => `${fx(S * mx)} ${fx(S * my)}`
  const d =
    `M ${P(0, -0.58)}` +
    ` Q ${P(0.06, -0.5)} ${P(0.08, -0.36)}` +
    ` Q ${P(0.3, -0.44)} ${P(0.58, -0.3)}` +
    ` Q ${P(0.86, -0.2)} ${P(1.0, 0.04)}` +
    ` Q ${P(0.7, 0.0)} ${P(0.5, 0.06)}` +
    ` Q ${P(0.24, 0.12)} ${P(0.15, 0.22)}` +
    ` L ${P(0.18, 0.58)} L ${P(0, 0.44)} L ${P(-0.18, 0.58)}` +
    ` L ${P(-0.15, 0.22)}` +
    ` Q ${P(-0.24, 0.12)} ${P(-0.5, 0.06)}` +
    ` Q ${P(-0.7, 0.0)} ${P(-1.0, 0.04)}` +
    ` Q ${P(-0.86, -0.2)} ${P(-0.58, -0.3)}` +
    ` Q ${P(-0.3, -0.44)} ${P(-0.08, -0.36)}` +
    ` Q ${P(-0.06, -0.5)} ${P(0, -0.58)} Z`
  let s = `<path d="${d}" fill="${body}"/>`
  s += `<path d="M ${P(0.2, -0.16)} Q ${P(0.55, -0.13)} ${P(0.92, 0.02)}" fill="none" stroke="${sheen}" stroke-width="2" opacity="0.55"/>`
  s += `<path d="M ${P(-0.2, -0.16)} Q ${P(-0.55, -0.13)} ${P(-0.92, 0.02)}" fill="none" stroke="${sheen}" stroke-width="2" opacity="0.55"/>`
  s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.55" stroke-linejoin="round"/>`
  return s
}

/** A compass NEEDLE pointing radially outward along math-angle ang — brass tip
 *  triangle + slate tail triangle about a shared cross-axis, an ink pivot, a
 *  dashed heading ring and a gold tip pip. A "route glyph" sector. */
function compassNeedle(mx, my, ang, len, wdt, tipC, tailC) {
  const ux = Math.cos(ang * D2R), uy = -Math.sin(ang * D2R)
  const vx = -uy, vy = ux
  const tx = mx + ux * len * 0.5, ty = my + uy * len * 0.5
  const bx = mx - ux * len * 0.5, by = my - uy * len * 0.5
  const lx = mx + vx * wdt * 0.5, ly = my + vy * wdt * 0.5
  const rx = mx - vx * wdt * 0.5, ry = my - vy * wdt * 0.5
  let s = `<circle cx="${fx(mx)}" cy="${fx(my)}" r="${fx(len * 0.6)}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.5"/>`
  s += `<path d="M ${fx(tx)} ${fx(ty)} L ${fx(lx)} ${fx(ly)} L ${fx(rx)} ${fx(ry)} Z" fill="${tipC}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.6"/>`
  s += `<path d="M ${fx(bx)} ${fx(by)} L ${fx(lx)} ${fx(ly)} L ${fx(rx)} ${fx(ry)} Z" fill="${tailC}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.6"/>`
  s += `<circle cx="${fx(mx)}" cy="${fx(my)}" r="${fx(wdt * 0.3)}" fill="${INK}"/>`
  s += `<circle cx="${fx(tx)}" cy="${fx(ty)}" r="3.2" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1"/>`
  return s
}

/** A compass ROSE / cardinal mark centred at (mx,my), its north arm along
 *  math-angle ang. Four kite points (north brass, rest slate), intercardinal
 *  ticks, a gold boss and a gold north pip. A "cardinal mark" sector. */
function compassRose(mx, my, ang, arm, body, northC) {
  let s = `<circle cx="${fx(mx)}" cy="${fx(my)}" r="${fx(arm * 0.92)}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.5"/>`
  for (const [off, fill] of [[0, northC], [90, body], [180, body], [270, body]]) {
    const ta = ang + off
    const tx = mx + Math.cos(ta * D2R) * arm, ty = my - Math.sin(ta * D2R) * arm
    const b1x = mx + Math.cos((ta + 34) * D2R) * arm * 0.34, b1y = my - Math.sin((ta + 34) * D2R) * arm * 0.34
    const b2x = mx + Math.cos((ta - 34) * D2R) * arm * 0.34, b2y = my - Math.sin((ta - 34) * D2R) * arm * 0.34
    s += `<path d="M ${fx(tx)} ${fx(ty)} L ${fx(b1x)} ${fx(b1y)} L ${fx(b2x)} ${fx(b2y)} Z" fill="${fill}" stroke="${INK}" stroke-width="1.3" stroke-opacity="0.6"/>`
  }
  for (const off of [45, 135, 225, 315]) {
    const ta = ang + off
    s += `<line x1="${fx(mx)}" y1="${fx(my)}" x2="${fx(mx + Math.cos(ta * D2R) * arm * 0.5)}" y2="${fx(my - Math.sin(ta * D2R) * arm * 0.5)}" stroke="${INK}" stroke-width="1.4" opacity="0.45"/>`
  }
  s += `<circle cx="${fx(mx)}" cy="${fx(my)}" r="4.5" fill="${GOLD}" stroke="${INK}" stroke-width="1.2"/>`
  s += `<circle cx="${fx(mx + Math.cos(ang * D2R) * arm)}" cy="${fx(my - Math.sin(ang * D2R) * arm)}" r="3.4" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1"/>`
  return s
}

/** A TALLY band — `count` radial stroke-count marks fanned across a `span`-deg
 *  arc centred on math-angle a, every fifth mark drawn as a diagonal slash over
 *  the preceding four (the classic five-bar gate). A "tally band" sector. */
function tallyMarks(cx, cy, a, count, rIn, rOut, span, color) {
  let s = ''
  const a0 = a - span / 2, a1 = a + span / 2
  const at = (m) => a0 + (a1 - a0) * (count <= 1 ? 0.5 : m / (count - 1))
  for (let m = 0; m < count; m++) {
    if (m % 5 === 4) {
      const ab = at(m - 4)
      s += `<line x1="${fx(polX(cx, ab, rIn))}" y1="${fx(polY(cy, ab, rIn))}" x2="${fx(polX(cx, at(m), rOut))}" y2="${fx(polY(cy, at(m), rOut))}" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.9"/>`
    } else {
      const am = at(m)
      s += `<line x1="${fx(polX(cx, am, rIn))}" y1="${fx(polY(cy, am, rIn))}" x2="${fx(polX(cx, am, rOut))}" y2="${fx(polY(cy, am, rOut))}" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.85"/>`
    }
  }
  return s
}

// A minimal stroke-vector capital alphabet (unit cell, x right / y down, 0=top)
// for the desk's engraved labels — path-based so they are font-free and
// byte-identical across bakes (no librsvg font dependency). Covers exactly the
// letters s4 engraves: DISPATCH + "SPIN — ROUTE THE RAVENS", plus the em dash.
const ENGRAVE_GLYPHS = {
  D: [[['M', 0, 0], ['L', 0, 1]], [['M', 0, 0], ['C', 0.95, 0.02, 0.95, 0.98, 0, 1]]],
  I: [[['M', 0.5, 0], ['L', 0.5, 1]], [['M', 0.2, 0], ['L', 0.8, 0]], [['M', 0.2, 1], ['L', 0.8, 1]]],
  S: [[['M', 0.92, 0.14], ['C', 0.55, -0.04, 0.06, 0.06, 0.09, 0.34], ['C', 0.11, 0.54, 0.9, 0.5, 0.88, 0.72], ['C', 0.86, 1.0, 0.34, 1.0, 0.06, 0.84]]],
  P: [[['M', 0.06, 0], ['L', 0.06, 1]], [['M', 0.06, 0], ['L', 0.6, 0], ['C', 1.0, 0.04, 1.0, 0.5, 0.6, 0.54], ['L', 0.06, 0.54]]],
  A: [[['M', 0, 1], ['L', 0.5, 0], ['L', 1, 1]], [['M', 0.22, 0.62], ['L', 0.78, 0.62]]],
  T: [[['M', 0, 0], ['L', 1, 0]], [['M', 0.5, 0], ['L', 0.5, 1]]],
  C: [[['M', 0.94, 0.16], ['C', 0.58, -0.05, 0.06, 0.1, 0.06, 0.5], ['C', 0.06, 0.9, 0.58, 1.05, 0.94, 0.84]]],
  H: [[['M', 0, 0], ['L', 0, 1]], [['M', 1, 0], ['L', 1, 1]], [['M', 0, 0.5], ['L', 1, 0.5]]],
  N: [[['M', 0, 1], ['L', 0, 0]], [['M', 0, 0], ['L', 1, 1]], [['M', 1, 1], ['L', 1, 0]]],
  R: [
    [['M', 0.06, 0], ['L', 0.06, 1]],
    [['M', 0.06, 0], ['L', 0.6, 0], ['C', 1.0, 0.04, 1.0, 0.5, 0.6, 0.54], ['L', 0.06, 0.54]],
    [['M', 0.48, 0.54], ['L', 1.0, 1]],
  ],
  O: [[['M', 0.5, 0], ['C', 0.04, 0.02, 0.04, 0.98, 0.5, 1], ['C', 0.96, 0.98, 0.96, 0.02, 0.5, 0]]],
  U: [[['M', 0, 0], ['L', 0, 0.6], ['C', 0.02, 1.06, 0.98, 1.06, 1, 0.6], ['L', 1, 0]]],
  E: [[['M', 1, 0], ['L', 0, 0], ['L', 0, 1], ['L', 1, 1]], [['M', 0, 0.5], ['L', 0.76, 0.5]]],
  V: [[['M', 0, 0], ['L', 0.5, 1], ['L', 1, 0]]],
  '—': [[['M', 0, 0.52], ['L', 1, 0.52]]],
  // E3 s2 additions — the inn's painted words ("WELCOME" on the doormat, "LIFT"
  // on the affordance banner, "100" on the number board). Font-free strokes, so
  // the bake stays byte-stable on any host (no installed-typeface dependency).
  W: [[['M', 0, 0], ['L', 0.22, 1], ['L', 0.5, 0.34], ['L', 0.78, 1], ['L', 1, 0]]],
  L: [[['M', 0, 0], ['L', 0, 1], ['L', 0.9, 1]]],
  F: [[['M', 1, 0], ['L', 0, 0], ['L', 0, 1]], [['M', 0, 0.5], ['L', 0.72, 0.5]]],
  M: [[['M', 0, 1], ['L', 0, 0], ['L', 0.5, 0.62], ['L', 1, 0], ['L', 1, 1]]],
  '0': [[['M', 0.5, 0], ['C', 0.06, 0.03, 0.06, 0.97, 0.5, 1], ['C', 0.94, 0.97, 0.94, 0.03, 0.5, 0]]],
  '1': [[['M', 0.2, 0.22], ['L', 0.52, 0]], [['M', 0.52, 0], ['L', 0.52, 1]], [['M', 0.16, 1], ['L', 0.9, 1]]],
}

/** Engrave a word from ENGRAVE_GLYPHS as stroke paths, left cell at (x0,y0),
 *  each cell cw x ch with `gap` between cells. Deterministic, font-free. */
function engraveWord(word, x0, y0, cw, ch, gap, stroke, sw, extra = '') {
  let out = ''
  let x = x0
  for (const c of word) {
    const g = ENGRAVE_GLYPHS[c]
    if (g) {
      for (const sub of g) {
        let d = ''
        for (const cmd of sub) {
          if (cmd[0] === 'C') {
            d += `C ${fx(x + cmd[1] * cw)} ${fx(y0 + cmd[2] * ch)} ${fx(x + cmd[3] * cw)} ${fx(y0 + cmd[4] * ch)} ${fx(x + cmd[5] * cw)} ${fx(y0 + cmd[6] * ch)} `
          } else {
            d += `${cmd[0]} ${fx(x + cmd[1] * cw)} ${fx(y0 + cmd[2] * ch)} `
          }
        }
        out += `<path d="${d.trim()}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${extra} stroke-linecap="round" stroke-linejoin="round"/>`
      }
    }
    x += cw + gap
  }
  return out
}

// ---- THE SORTING DESK (E3 s4 re-dress of the dispatch volvelle). The dial and
// the window card keep their registration EXACTLY: disc radius w*0.46875, hub
// 0.30R, the read band 0.40-0.84R (rMid 0.62R, rHalf 0.22R), three apertures at
// math-angles 45/90/135 of half-width 16deg, eight 45deg detent sectors. Only
// the dressing changes: the instrument is now the rookery's SORTING OFFICE —
// pigeonhole shelves banked around every window, raven-sigil sectors on the
// wheel, and a celebrated brass tag telling the reader what to do with it.
//
// *** SCREEN-SPACE AUTHORING (the side-aware UV-flip law) ***
// ch3-dispatch is on the RIGHT page, where discUvs('right') = [0,1, 1,1, 1,0,
// 0,0] over the disc corners [(-r,-r), (r,-r), (r,r), (-r,r)] on the page frame
// (pu = page-fore = screen RIGHT, pv = +z = screen DOWN). Corner by corner:
// screen top-left <- uv(0,1), top-right <- uv(1,1), bottom-right <- uv(1,0),
// bottom-left <- uv(0,0); with three's default flipY, uv v=1 IS the image's top
// row. So the composed mapping is the IDENTITY — the v-flip in discUvs exists
// precisely to cancel the +z-is-screen-down inversion. Therefore this art is
// authored in plain SCREEN SPACE: image-top reads as screen-top (away from the
// reader), image-left as spine-ward, and the polX/polY math-angle convention
// (+y UP) already used here maps straight through. Labels read upright.

/** A polar bank of PIGEONHOLES: cols x rows recessed cells over the angular
 *  span [psi±halfW] and the radial band [rIn,rOut], a parchment card slip
 *  filed in a scattered few. The desk wall the windows are set into. */
function pigeonBank(cx, cy, psi, halfW, rIn, rOut, cols, rows, rand) {
  let s = ''
  for (let c = 0; c < cols; c++) {
    const a0 = psi - halfW + (2 * halfW * c) / cols
    const a1 = psi - halfW + (2 * halfW * (c + 1)) / cols
    const pad = (a1 - a0) * 0.08
    for (let q = 0; q < rows; q++) {
      const r0 = lerp(rIn, rOut, q / rows) + 3
      const r1 = lerp(rIn, rOut, (q + 1) / rows) - 3
      if (r1 - r0 < 4) continue
      const mid = (a0 + a1) / 2
      const half = (a1 - a0) / 2 - pad
      const cell = annularSectorPath(cx, cy, mid, half, r0, r1, 6)
      s += `<path d="${cell}" fill="${ROOK.ink}" opacity="0.6"/>`
      s += `<path d="${cell}" fill="none" stroke="${ROOK.slateLit}" stroke-width="1.5" opacity="0.75"/>`
      if (rand() < 0.45) {
        s += `<path d="${annularSectorPath(cx, cy, mid, half * 0.8, lerp(r0, r1, 0.1), lerp(r0, r1, 0.7), 6)}" fill="${ROOK.parch}" opacity="0.92"/>`
      }
    }
  }
  return s
}

/** The circled numeral ① — a stroke-vector glyph so the tag stays font-free. */
function circledOne(cx, cy, rad, stroke, sw) {
  return (
    `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(rad)}" fill="none" stroke="${stroke}" stroke-width="${fx(sw)}"/>` +
    `<path d="M ${fx(cx - rad * 0.34)} ${fx(cy - rad * 0.16)} L ${fx(cx - 0.02 * rad)} ${fx(cy - rad * 0.52)} L ${fx(cx - 0.02 * rad)} ${fx(cy + rad * 0.5)}" fill="none" stroke="${stroke}" stroke-width="${fx(sw)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<line x1="${fx(cx - rad * 0.34)}" y1="${fx(cy + rad * 0.5)}" x2="${fx(cx + rad * 0.32)}" y2="${fx(cy + rad * 0.5)}" stroke="${stroke}" stroke-width="${fx(sw)}" stroke-linecap="round"/>`
  )
}

/** A printer's MANICULE ☞ — cuff, fist, thumb and a pointing index finger,
 *  nominally pointing +x. The affordance's "do this" mark. */
function manicule(x, y, S, body, ink) {
  const ax = (a) => x + S * a
  const ay = (b) => y + S * b
  let s = `<g>`
  s += `<path d="M ${fx(ax(-1.1))} ${fx(ay(-0.5))} L ${fx(ax(-0.6))} ${fx(ay(-0.5))} L ${fx(ax(-0.6))} ${fx(ay(0.54))} L ${fx(ax(-1.1))} ${fx(ay(0.54))} L ${fx(ax(-0.94))} ${fx(ay(0.02))} Z" fill="${body}" stroke="${ink}" stroke-width="${fx(S * 0.07)}" stroke-linejoin="round"/>`
  s += `<rect x="${fx(ax(-0.68))}" y="${fx(ay(-0.46))}" width="${fx(S * 0.76)}" height="${fx(S * 0.98)}" rx="${fx(S * 0.26)}" fill="${body}" stroke="${ink}" stroke-width="${fx(S * 0.07)}"/>`
  s += `<path d="M ${fx(ax(-0.12))} ${fx(ay(-0.22))} L ${fx(ax(0.76))} ${fx(ay(-0.14))} L ${fx(ax(1.08))} ${fx(ay(0.0))} L ${fx(ax(0.76))} ${fx(ay(0.14))} L ${fx(ax(-0.12))} ${fx(ay(0.2))} Z" fill="${body}" stroke="${ink}" stroke-width="${fx(S * 0.07)}" stroke-linejoin="round"/>`
  s += `<path d="M ${fx(ax(-0.5))} ${fx(ay(-0.44))} q ${fx(S * 0.34)} ${fx(-S * 0.26)} ${fx(S * 0.5)} ${fx(S * 0.06)}" fill="none" stroke="${body}" stroke-width="${fx(S * 0.24)}" stroke-linecap="round"/>`
  s += `<path d="M ${fx(ax(-0.5))} ${fx(ay(-0.44))} q ${fx(S * 0.34)} ${fx(-S * 0.26)} ${fx(S * 0.5)} ${fx(S * 0.06)}" fill="none" stroke="${ink}" stroke-width="${fx(S * 0.06)}" stroke-linecap="round"/>`
  s += `</g>`
  return s
}

/** One raven-sigil roundel — a brass-rimmed disc with a slate raven banked to
 *  `bank` degrees. The dial's repeated mark: four billion ravens, one wheel. */
function ravenSigil(mx, my, rad, bank, brass, brassLit) {
  let s = `<circle cx="${fx(mx)}" cy="${fx(my)}" r="${fx(rad)}" fill="${ROOK.parchLit}" opacity="0.85"/>`
  s += `<circle cx="${fx(mx)}" cy="${fx(my)}" r="${fx(rad)}" fill="none" stroke="${brass}" stroke-width="2.6" opacity="0.95"/>`
  s += `<circle cx="${fx(mx)}" cy="${fx(my)}" r="${fx(rad * 0.86)}" fill="none" stroke="${brassLit}" stroke-width="1.2" opacity="0.7"/>`
  s += `<g transform="translate(${fx(mx)} ${fx(my)}) rotate(${fx(bank)})">${miniRaven(rad * 0.86, ROOK.ink, ROOK.slateLit)}</g>`
  return s
}

// ---- 1) THE SPUN WHEEL (ch3-dispatch-dial). The sorting desk's route wheel: a
// parchment disc in a brass rim, eight 45deg sectors reading through the card's
// windows, six of them RAVEN SIGILS banked to distinct headings and two route
// glyphs (a needle and a tally) so the rank never reads as a repeat pattern. A
// thumb-tab grip lobe protrudes past the rim so it reads as spinnable. ----
function dispatchDial(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const cy = h / 2
  const R = w * 0.46875 // 300 @ 640 — shared disc-radius basis with the card
  const hubR = R * 0.3
  const bandIn = R * 0.4
  const bandOut = R * 0.84
  const bandMid = R * 0.62
  const BR = GOLD
  const BR_LIT = '#e7b24d'
  const BR_DIM = GOLD_DIM
  const BR_DEEP = '#7a5f16'

  const defs =
    `<clipPath id="dialCut"><circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}"/></clipPath>` +
    `<radialGradient id="dialLite" cx="0.38" cy="0.30" r="0.78">` +
    `<stop offset="0" stop-color="${BR_LIT}" stop-opacity="0.42"/>` +
    `<stop offset="0.55" stop-color="${BR_LIT}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${BR_DEEP}" stop-opacity="0.5"/>` +
    `</radialGradient>`

  // thumb-tab grip lobe protruding past the rim (down-right, stays in-canvas)
  const tabA = 300
  const tabHalf = 12
  const tabR = R * 1.12
  const bx0 = polX(cx, tabA - tabHalf, R * 0.99)
  const by0 = polY(cy, tabA - tabHalf, R * 0.99)
  const bx1 = polX(cx, tabA + tabHalf, R * 0.99)
  const by1 = polY(cy, tabA + tabHalf, R * 0.99)
  const tabD = `M ${fx(bx0)} ${fx(by0)} Q ${fx(polX(cx, tabA, tabR * 1.06))} ${fx(polY(cy, tabA, tabR * 1.06))} ${fx(bx1)} ${fx(by1)} Z`
  let tab = `<path d="${tabD}" fill="${BR_DIM}"/>`
  tab += rookRim(tabD, 4.5)
  for (let i = 0; i < 3; i++) {
    const rad = R + (tabR - R) * (0.3 + i * 0.22)
    tab += `<line x1="${fx(polX(cx, tabA - tabHalf * 0.55, rad))}" y1="${fx(polY(cy, tabA - tabHalf * 0.55, rad))}" x2="${fx(polX(cx, tabA + tabHalf * 0.55, rad))}" y2="${fx(polY(cy, tabA + tabHalf * 0.55, rad))}" stroke="${INK}" stroke-width="2" opacity="0.5"/>`
  }

  let g = `<g clip-path="url(#dialCut)">`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="${PARCH_MID}"/>`
  for (let k = 0; k < 8; k++) {
    g += `<path d="${wedgePath(cx, cy, k * 45 - 22.5, k * 45 + 22.5, R)}" fill="${k % 2 ? ROOK.slate : BR_LIT}" opacity="${k % 2 ? '0.16' : '0.16'}"/>`
  }
  // the READ BAND the card's windows reveal — aged parchment, so slate ravens
  // and brass glyphs pop against it rather than muddying into the field.
  g += `<path fill-rule="evenodd" d="${circlePath(cx, cy, bandOut)} ${circlePath(cx, cy, bandIn)}" fill="${PARCH}" opacity="0.8"/>`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(bandOut)}" fill="none" stroke="${BR}" stroke-width="3" opacity="0.75"/>`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(bandIn)}" fill="none" stroke="${BR}" stroke-width="2.6" opacity="0.7"/>`
  // detent ticks on the sector boundaries (the 45deg clicks)
  for (let k = 0; k < 8; k++) {
    const a = k * 45 + 22.5
    g += `<line x1="${fx(polX(cx, a, hubR))}" y1="${fx(polY(cy, a, hubR))}" x2="${fx(polX(cx, a, R))}" y2="${fx(polY(cy, a, R))}" stroke="${INK}" stroke-width="1.7" opacity="0.4"/>`
    g += `<circle cx="${fx(polX(cx, a, bandOut + 12))}" cy="${fx(polY(cy, a, bandOut + 12))}" r="4" fill="${BR}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.55"/>`
  }
  // sector marks: six raven sigils on distinct headings + two route glyphs
  const bank = { 0: -28, 1: 62, 2: 145, 4: -104, 5: 18, 7: -152 }
  for (let k = 0; k < 8; k++) {
    const a = k * 45
    const mx = polX(cx, a, bandMid)
    const my = polY(cy, a, bandMid)
    if (k === 3) g += compassNeedle(mx, my, a, R * 0.4, R * 0.095, BR_LIT, ROOK.slate)
    else if (k === 6) g += tallyMarks(cx, cy, a, 9, R * 0.5, R * 0.74, 28, INK)
    else g += ravenSigil(mx, my, R * 0.16, bank[k], BR, BR_LIT)
  }
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="url(#dialLite)"/>`
  for (let i = 0; i < 14; i++) {
    const a = rr(r, 0, 360)
    const rad = rr(r, hubR * 1.15, R * 0.95)
    g += `<circle cx="${fx(polX(cx, a, rad))}" cy="${fx(polY(cy, a, rad))}" r="${fx(rr(r, 0.8, 1.8))}" fill="${INK}" opacity="${fx(rr(r, 0.08, 0.18))}"/>`
  }
  // engraved central hub — brass boss, knurled rim, compass emblem, rivet
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR)}" fill="${BR_DIM}"/>`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR)}" fill="none" stroke="${INK}" stroke-width="2.4" opacity="0.65"/>`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR * 0.78)}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.45"/>`
  for (let i = 0; i < 48; i++) {
    const a = i * 7.5
    g += `<line x1="${fx(polX(cx, a, hubR * 0.87))}" y1="${fx(polY(cy, a, hubR * 0.87))}" x2="${fx(polX(cx, a, hubR))}" y2="${fx(polY(cy, a, hubR))}" stroke="${INK}" stroke-width="1.1" opacity="0.4"/>`
  }
  g += compassRose(cx, cy, 90, hubR * 0.5, ROOK.slate, GOLD_LIT)
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR * 0.26)}" fill="${BR_LIT}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.6"/>`
  g += `<circle cx="${fx(cx - hubR * 0.08)}" cy="${fx(cy - hubR * 0.08)}" r="${fx(hubR * 0.1)}" fill="#ffffff" opacity="0.4"/>`
  g += `</g>`

  const rim = rookRim(circlePath(cx, cy, R), 5)
  return svgPiece(w, h, tab + g + rim, defs)
}

// ---- 2) THE DESK FACEPLATE (ch3-dispatch-card). The sorting desk's slate board
// laid over the wheel: opaque plate, transparent outside the inscribed circle,
// with THREE die-cut apertures (true alpha-0 holes) at math-angles 45/90/135 over
// the read band 0.40-0.84R, each set into a BANK OF PIGEONHOLES above and below.
// Built as one even-odd compound path so the holes are genuine cut-outs. The
// lower half carries the celebrated brass tag "(1) SPIN - ROUTE THE RAVENS" with
// a pointing manicule, engraved font-free from ENGRAVE_GLYPHS. ----
function dispatchCard(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const cy = h / 2
  const R = w * 0.46875
  const bandIn = R * 0.4
  const bandOut = R * 0.84
  const halfW = 16
  const wins = [45, 90, 135]
  const PLATE = ROOK.slate
  const PLATE_LIT = ROOK.slateLit
  const PLATE_DK = ROOK.ink
  const BR = GOLD
  const BR_LIT = '#e7b24d'
  const BR_DK = GOLD_DIM

  const defs =
    `<radialGradient id="cardLite" cx="0.36" cy="0.30" r="0.82">` +
    `<stop offset="0" stop-color="${PLATE_LIT}" stop-opacity="0.5"/>` +
    `<stop offset="0.5" stop-color="${PLATE_LIT}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000000" stop-opacity="0.42"/>` +
    `</radialGradient>`

  // even-odd compound plate: outer disc + 3 window holes + thumb-notch hole. A
  // point inside a window is enclosed by 2 sub-paths => even => UNFILLED => a
  // true alpha-0 aperture the wheel reads through.
  const notchX = polX(cx, 270, R)
  const notchY = polY(cy, 270, R)
  let plateD = circlePath(cx, cy, R)
  for (const psi of wins) plateD += ' ' + annularSectorPath(cx, cy, psi, halfW, bandIn, bandOut)
  plateD += ' ' + circlePath(notchX, notchY, R * 0.09)

  let s = `<g>`
  s += `<path fill-rule="evenodd" d="${plateD}" fill="${PLATE}"/>`
  s += `<path fill-rule="evenodd" d="${plateD}" fill="url(#cardLite)"/>`
  s += `<g clip-path="url(#cardPlate)">`
  // PIGEONHOLE SHELVES: a bank outboard of every window and a bank inboard, so
  // each aperture reads as one slot in a wall of them.
  for (const psi of wins) {
    s += pigeonBank(cx, cy, psi, halfW - 1, bandOut + 12, R * 0.965, 2, 1, r)
    s += pigeonBank(cx, cy, psi, halfW - 1, R * 0.4, bandIn - 12, 2, 1, r)
  }
  // and the shelf runs filling the plate between and below the windows, so the
  // apertures read as three slots in one wall of pigeonholes.
  for (const psi of [21, 67.5, 112.5, 159]) s += pigeonBank(cx, cy, psi, 9.5, R * 0.4, R * 0.95, 1, 4, r)
  for (const psi of [193, 216, 324, 347]) s += pigeonBank(cx, cy, psi, 10, R * 0.44, R * 0.95, 1, 3, r)
  s += `</g>`
  // engraved rings — kept OUT of the 0.40-0.84 window band
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * 0.985)}" fill="none" stroke="${BR}" stroke-width="4" opacity="0.85"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * 0.34)}" fill="none" stroke="${BR_DK}" stroke-width="2" opacity="0.6"/>`
  // brass bezel frames around each aperture (never enter the hole)
  for (const psi of wins) {
    s += `<path d="${annularSectorPath(cx, cy, psi, halfW + 2.4, bandIn - 9, bandOut + 9)}" fill="none" stroke="${BR_DK}" stroke-width="3.4" opacity="0.9"/>`
    s += `<path d="${annularSectorPath(cx, cy, psi, halfW + 1.6, bandIn - 4, bandOut + 4)}" fill="none" stroke="${BR_LIT}" stroke-width="1.6" opacity="0.8"/>`
  }
  // rim rivets (avoid the windows in the upper half and the thumb-notch at 270)
  for (const a of [0, 180, 225, 315]) {
    const rx = polX(cx, a, R * 0.92)
    const ry = polY(cy, a, R * 0.92)
    s += `<circle cx="${fx(rx)}" cy="${fx(ry)}" r="6" fill="${BR_LIT}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.6"/>`
    s += `<circle cx="${fx(rx - 1.6)}" cy="${fx(ry - 1.6)}" r="2" fill="#ffffff" opacity="0.35"/>`
  }

  // ---- THE CELEBRATED BRASS TAG (T-AFFORDANCE) ----
  // Two engraved lines reading, in order, (1) SPIN - ROUTE THE RAVENS, on a
  // brass plate screwed across the free lower half; a manicule points into it.
  const tagW = R * 1.5
  const tagH = R * 0.56
  const tagX = cx - tagW / 2
  const tagY = cy + R * 0.28
  s += `<rect x="${fx(tagX)}" y="${fx(tagY)}" width="${fx(tagW)}" height="${fx(tagH)}" rx="${fx(R * 0.05)}" fill="${BR}"/>`
  s += `<rect x="${fx(tagX)}" y="${fx(tagY)}" width="${fx(tagW)}" height="${fx(tagH * 0.34)}" rx="${fx(R * 0.05)}" fill="${BR_LIT}" opacity="0.45"/>`
  s += `<rect x="${fx(tagX)}" y="${fx(tagY)}" width="${fx(tagW)}" height="${fx(tagH)}" rx="${fx(R * 0.05)}" fill="none" stroke="${INK}" stroke-width="2.4" opacity="0.7"/>`
  s += `<rect x="${fx(tagX + 6)}" y="${fx(tagY + 6)}" width="${fx(tagW - 12)}" height="${fx(tagH - 12)}" rx="${fx(R * 0.04)}" fill="none" stroke="${BR_DK}" stroke-width="1.6" opacity="0.8"/>`
  for (const sx of [tagX + 14, tagX + tagW - 14]) {
    for (const sy of [tagY + 13, tagY + tagH - 13]) {
      s += `<circle cx="${fx(sx)}" cy="${fx(sy)}" r="3.4" fill="${BR_LIT}" stroke="${INK}" stroke-width="1.1" stroke-opacity="0.6"/>`
    }
  }
  const line = (word, cw, ch, gap, yTop, x0) => {
    let out = engraveWord(word, x0, yTop + 1.4, cw, ch, gap, BR_LIT, 2.6, 'opacity="0.5"')
    out += engraveWord(word, x0, yTop, cw, ch, gap, PLATE_DK, 2.8, 'opacity="0.95"')
    return out
  }
  const wordW = (word, cw, gap) => word.length * cw + (word.length - 1) * gap
  // line 1: the circled numeral, SPIN, the em dash
  const cw1 = R * 0.082
  const ch1 = R * 0.15
  const gap1 = R * 0.035
  const oneR = ch1 * 0.56
  const pad1 = gap1 * 3
  const l1W = oneR * 2 + pad1 + wordW('SPIN', cw1, gap1) + pad1 + cw1
  const l1X = cx - l1W / 2
  const l1Y = tagY + tagH * 0.16
  s += circledOne(l1X + oneR, l1Y + ch1 * 0.5, oneR, PLATE_DK, 3.2)
  s += line('SPIN', cw1, ch1, gap1, l1Y, l1X + oneR * 2 + pad1)
  s += line('—', cw1, ch1, gap1, l1Y, l1X + oneR * 2 + pad1 + wordW('SPIN', cw1, gap1) + pad1)
  // line 2: ROUTE THE RAVENS (one engraved run; the space cell has no glyph)
  const cw2 = R * 0.062
  const ch2 = R * 0.13
  const gap2 = R * 0.026
  const l2 = 'ROUTE THE RAVENS'
  const l2X = cx - wordW(l2, cw2, gap2) / 2
  const l2Y = tagY + tagH * 0.56
  s += line(l2, cw2, ch2, gap2, l2Y, l2X)
  s += `<line x1="${fx(l2X)}" y1="${fx(l2Y + ch2 + 6)}" x2="${fx(l2X + wordW(l2, cw2, gap2))}" y2="${fx(l2Y + ch2 + 6)}" stroke="${PLATE_DK}" stroke-width="1.6" opacity="0.5"/>`
  // the manicule, pointing into the tag from the spine side
  s += manicule(tagX - R * 0.16, tagY + tagH * 0.42, R * 0.125, PARCH, INK)

  // central rivet at the hub — pins the plate flat over the wheel
  const rivR = R * 0.14
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(rivR)}" fill="${BR_LIT}" stroke="${INK}" stroke-width="1.8" stroke-opacity="0.65"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(rivR * 0.62)}" fill="${BR}" stroke="${BR_DK}" stroke-width="1.4"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(rivR * 0.3)}" fill="${PLATE_DK}"/>`
  s += `<circle cx="${fx(cx - rivR * 0.34)}" cy="${fx(cy - rivR * 0.34)}" r="${fx(rivR * 0.16)}" fill="#ffffff" opacity="0.4"/>`
  // thumb-notch bezel on the plate side of the rim cut
  s += `<circle cx="${fx(notchX)}" cy="${fx(notchY)}" r="${fx(R * 0.11)}" fill="none" stroke="${BR_DK}" stroke-width="2" opacity="0.75"/>`
  s += `</g>`

  const rim = rookRim(circlePath(cx, cy, R), 5)
  return svgPiece(w, h, s + rim, defs + `<clipPath id="cardPlate"><path fill-rule="evenodd" d="${plateD}"/></clipPath>`)
}
// ============================================================================
// E2.2 BATCH B — THE LIFT-THE-FLAP (s2 ch1-keyboard). The Inn of a Hundred
// Keys' key-board: a timber tavern plaque of numbered door leaves the reader
// lifts to find brass keys (one hides the innkeeper's cat).
//
// Painted in SCREEN SPACE (the layer's flatUvs map image-x -> the page-fore
// axis d = screen-RIGHT, image-y -> the spine axis z = screen-DOWN, no
// rotation). So: DOORS are LANDSCAPE — hinge straps at the LEFT (spine) edge, a
// ring handle at the RIGHT (fore/lift) edge, the number upright and centred.
// The BOARD is PORTRAIT — the door row runs top-to-bottom (image-y = z), one
// recess niche per door stacked down the plaque, each key in the FORE (RIGHT)
// half so a lifted leaf uncovers it first (bench L6). Warm oak/walnut timber,
// iron straps as dark accents, brass plates + keys; recesses dark inn-wood. A
// thin warm timber edge (no cold pale die-cut rim — it read steel-grey in
// scene). Deterministic: mulberry32(seed).
// ============================================================================

const WOOD = '#6b4a26', WOOD_LIT = '#9a7038', WOOD_DK = '#3d2812', WOOD_EDGE = '#2c1c0c'
const IRON = '#33302b', IRON_LIT = '#6b6156'

/** A brass key lying in a niche, bow (ring) at the RIGHT/fore end, shaft + bit
 *  reaching left — the bow sits in the fore half so a lifted leaf reveals it. */
function brassKeyLying(x0, x1, cy, r) {
  const len = x1 - x0
  const bowR = (x1 - x0) * 0.17
  const bowX = x1 - bowR
  const shaftW = len * 0.1
  let s = `<rect x="${fx(x0)}" y="${fx(cy - shaftW / 2)}" width="${fx(bowX - x0)}" height="${fx(shaftW)}" rx="${fx(shaftW * 0.4)}" fill="${GOLD}"/>` // shaft
  s += `<rect x="${fx(x0)}" y="${fx(cy - shaftW / 2)}" width="${fx(bowX - x0)}" height="${fx(shaftW * 0.4)}" fill="${GOLD_LIT}" opacity="0.7"/>` // lit edge
  // toothed bit at the left (spine) end — two prongs down
  s += `<rect x="${fx(x0)}" y="${fx(cy)}" width="${fx(len * 0.11)}" height="${fx(len * 0.13)}" fill="${GOLD}"/>`
  s += `<rect x="${fx(x0 + len * 0.14)}" y="${fx(cy)}" width="${fx(len * 0.07)}" height="${fx(len * 0.09)}" fill="${GOLD}"/>`
  s += `<circle cx="${fx(bowX)}" cy="${fx(cy)}" r="${fx(bowR)}" fill="none" stroke="${GOLD}" stroke-width="${fx(shaftW * 1.25)}"/>` // bow
  s += `<circle cx="${fx(bowX)}" cy="${fx(cy)}" r="${fx(bowR)}" fill="none" stroke="${GOLD_LIT}" stroke-width="1.4" opacity="0.85"/>`
  s += `<circle cx="${fx(bowX - bowR * 0.3)}" cy="${fx(cy - bowR * 0.3)}" r="${fx(bowR * 0.22)}" fill="#fff" opacity="0.4"/>` // glint
  void r
  return s
}

/** A curled sleeping cat silhouette (the surprise behind one door). Faces LEFT,
 *  tucked into the niche; nose toward the fore (right) so it reads on reveal. */
function sleepingCat(cx, cy, size) {
  const bodyR = size * 0.5
  let s = `<ellipse cx="${fx(cx)}" cy="${fx(cy + size * 0.08)}" rx="${fx(bodyR)}" ry="${fx(bodyR * 0.6)}" fill="#2b2620"/>` // curled body
  s += `<circle cx="${fx(cx + bodyR * 0.72)}" cy="${fx(cy - size * 0.04)}" r="${fx(size * 0.24)}" fill="#2b2620"/>` // head (toward fore/right)
  s += `<path d="M ${fx(cx + bodyR * 0.62)} ${fx(cy - size * 0.2)} l ${fx(-size * 0.02)} ${fx(-size * 0.18)} l ${fx(size * 0.15)} ${fx(size * 0.06)} Z" fill="#2b2620"/>` // ear
  s += `<path d="M ${fx(cx + bodyR * 0.95)} ${fx(cy - size * 0.17)} l ${fx(size * 0.1)} ${fx(-size * 0.16)} l ${fx(-size * 0.14)} ${fx(size * 0.04)} Z" fill="#2b2620"/>` // ear
  s += `<path d="M ${fx(cx - bodyR * 0.72)} ${fx(cy + size * 0.16)} q ${fx(-size * 0.28)} ${fx(-size * 0.04)} ${fx(-size * 0.12)} ${fx(-size * 0.3)}" fill="none" stroke="#2b2620" stroke-width="${fx(size * 0.13)}" stroke-linecap="round"/>` // tail
  s += `<path d="M ${fx(cx + bodyR * 0.62)} ${fx(cy - size * 0.02)} a ${fx(size * 0.14)} ${fx(size * 0.14)} 0 0 1 ${fx(size * 0.16)} 0" fill="none" stroke="${GOLD_LIT}" stroke-width="3" opacity="0.85"/>` // sleepy eye
  s += `<circle cx="${fx(cx + bodyR * 0.96)}" cy="${fx(cy - size * 0.01)}" r="${fx(size * 0.05)}" fill="#c98b4a"/>` // nose
  return s
}

/** THE KEY-BOARD PLAQUE (ch1-keyboard-board): PORTRAIT timber board, the door
 *  row running top->bottom (image-y = z). One dark recess niche per door, each
 *  with a brass key lying bow-to-the-fore (right) — save the cat niche. Opaque
 *  (the doors cover it); painted in the OPEN (revealed) state. */
function keyboardBoard(w, h, seed, doorCount, catIndex) {
  const r = mulberry32(seed)
  let s = `<g>`
  s += `<rect x="0" y="0" width="${w}" height="${h}" fill="${WOOD}"/>`
  // vertical plank seams (planks run down the row) + a lit fore (right) edge
  const planks = 3
  for (let i = 1; i < planks; i++) {
    const x = (w * i) / planks
    s += `<line x1="${fx(x)}" y1="0" x2="${fx(x)}" y2="${h}" stroke="${WOOD_DK}" stroke-width="2.4" opacity="0.5"/>`
    s += `<line x1="${fx(x + 2)}" y1="0" x2="${fx(x + 2)}" y2="${h}" stroke="${WOOD_LIT}" stroke-width="1.2" opacity="0.35"/>`
  }
  for (let i = 0; i < 44; i++) {
    const gx = rr(r, 0, w), gy = rr(r, 0, h)
    s += `<line x1="${fx(gx)}" y1="${fx(gy)}" x2="${fx(gx)}" y2="${fx(gy + rr(r, 14, 44))}" stroke="${WOOD_DK}" stroke-width="1" opacity="${fx(rr(r, 0.12, 0.3))}"/>` // grain
  }
  s += `<rect x="${fx(w * 0.9)}" y="0" width="${fx(w * 0.1)}" height="${h}" fill="${WOOD_LIT}" opacity="0.28"/>` // lit fore edge
  // one recess niche per door, stacked down the plaque
  const gap = h * 0.028
  const slotH = (h - gap * (doorCount + 1)) / doorCount
  const nicheL = w * 0.12, nicheR = w * 0.9
  const nicheW = nicheR - nicheL
  for (let d = 0; d < doorCount; d++) {
    const ny0 = gap + d * (slotH + gap)
    const ncy = ny0 + slotH / 2
    const nd = `M ${fx(nicheL)} ${fx(ny0)} L ${fx(nicheR)} ${fx(ny0)} L ${fx(nicheR)} ${fx(ny0 + slotH)} L ${fx(nicheL)} ${fx(ny0 + slotH)} Z`
    s += `<rect x="${fx(nicheL)}" y="${fx(ny0)}" width="${fx(nicheW)}" height="${fx(slotH)}" fill="#22190f"/>` // dark inn-wood cavity
    s += `<rect x="${fx(nicheL)}" y="${fx(ny0)}" width="${fx(nicheW * 0.4)}" height="${fx(slotH)}" fill="#000" opacity="0.32"/>` // depth shade toward spine (left)
    s += `<rect x="${fx(nicheR - nicheW * 0.1)}" y="${fx(ny0)}" width="${fx(nicheW * 0.1)}" height="${fx(slotH)}" fill="${WOOD_LIT}" opacity="0.16"/>` // lit fore lip
    s += `<path d="${nd}" fill="none" stroke="${WOOD_EDGE}" stroke-width="3.5" opacity="0.8"/>` // warm inset edge
    if (d === catIndex) {
      s += sleepingCat(nicheL + nicheW * 0.5, ncy, slotH * 0.62)
    } else {
      s += `<rect x="${fx(nicheL + nicheW * 0.62)}" y="${fx(ny0 + slotH * 0.08)}" width="3" height="${fx(slotH * 0.84)}" fill="${IRON_LIT}" opacity="0.6"/>` // hook rail (fore)
      s += brassKeyLying(nicheL + nicheW * 0.24, nicheL + nicheW * 0.9, ncy, r)
    }
  }
  // warm timber frame (two strokes, no cold pale rim)
  const frame = `M 4 4 L ${fx(w - 4)} 4 L ${fx(w - 4)} ${fx(h - 4)} L 4 ${fx(h - 4)} Z`
  s += `<path d="${frame}" fill="none" stroke="${WOOD_EDGE}" stroke-width="7" opacity="0.9" stroke-linejoin="round"/>`
  s += `<path d="${frame}" fill="none" stroke="${WOOD_LIT}" stroke-width="1.6" opacity="0.5" stroke-linejoin="round"/>`
  // E3 s2 celebration: a festive brick-red ribbon inner frame with brass
  // corner rosettes — the board is the chapter's PLAYABLE and dresses like it
  const rib = `M 13 13 L ${fx(w - 13)} 13 L ${fx(w - 13)} ${fx(h - 13)} L 13 ${fx(h - 13)} Z`
  s += `<path d="${rib}" fill="none" stroke="#b0603f" stroke-width="4" opacity="0.85" stroke-linejoin="round"/>`
  for (const [cx2, cy2] of [[13, 13], [w - 13, 13], [13, h - 13], [w - 13, h - 13]]) {
    s += `<circle cx="${fx(cx2)}" cy="${fx(cy2)}" r="7" fill="${GOLD}" stroke="${WOOD_EDGE}" stroke-width="1.6"/>`
    s += `<circle cx="${fx(cx2)}" cy="${fx(cy2)}" r="2.6" fill="${GOLD_LIT}"/>`
  }
  s += `</g>`
  return svgPiece(w, h, s)
}

/** ONE NUMBERED DOOR LEAF (ch1-keyboard-door<N>): a LANDSCAPE timber plank door,
 *  iron hinge straps at the LEFT (spine) edge, a ring handle at the RIGHT
 *  (fore/lift) edge, a brass number plate centred and UPRIGHT. Opaque. */
function keyboardDoor(w, h, seed, plate) {
  const r = mulberry32(seed)
  let s = `<g>`
  const x0 = w * 0.03, x1 = w * 0.97, y0 = h * 0.05, y1 = h * 0.95
  const doorD = `M ${fx(x0)} ${fx(y0)} L ${fx(x1)} ${fx(y0)} L ${fx(x1)} ${fx(y1)} L ${fx(x0)} ${fx(y1)} Z`
  s += `<path d="${doorD}" fill="${WOOD_LIT}"/>`
  // plank seams run across (top-to-bottom lines at intervals along the width)
  const planks = 3
  for (let i = 1; i < planks; i++) {
    const x = x0 + ((x1 - x0) * i) / planks
    s += `<line x1="${fx(x)}" y1="${fx(y0)}" x2="${fx(x)}" y2="${fx(y1)}" stroke="${WOOD_DK}" stroke-width="2.4" opacity="0.55"/>`
    s += `<line x1="${fx(x + 2)}" y1="${fx(y0)}" x2="${fx(x + 2)}" y2="${fx(y1)}" stroke="${WOOD}" stroke-width="1.2" opacity="0.4"/>`
  }
  for (let i = 0; i < 22; i++) {
    const gx = rr(r, x0, x1)
    s += `<line x1="${fx(gx)}" y1="${fx(rr(r, y0, y1))}" x2="${fx(gx)}" y2="${fx(rr(r, y0, y1) + rr(r, 6, 20))}" stroke="${WOOD_DK}" stroke-width="1" opacity="${fx(rr(r, 0.1, 0.25))}"/>` // grain
  }
  s += `<rect x="${fx(x1 - w * 0.08)}" y="${fx(y0)}" width="${fx(w * 0.08)}" height="${fx(y1 - y0)}" fill="#c6a066" opacity="0.35"/>` // lit fore (right) edge
  // iron hinge straps at the LEFT (spine) edge, reaching in
  for (const hy of [h * 0.28, h * 0.72]) {
    s += `<rect x="${fx(x0)}" y="${fx(hy - h * 0.08)}" width="${fx(w * 0.13)}" height="${fx(h * 0.16)}" rx="2" fill="${IRON}"/>`
    s += `<path d="M ${fx(x0 + w * 0.12)} ${fx(hy)} L ${fx(x0 + w * 0.28)} ${fx(hy)}" stroke="${IRON}" stroke-width="${fx(h * 0.07)}" stroke-linecap="round"/>` // strap across the plank
    s += `<circle cx="${fx(x0 + w * 0.05)}" cy="${fx(hy)}" r="2.6" fill="${IRON_LIT}"/>` // nail
  }
  // brass number plate, centred + upright — ENLARGED to a celebrated tag
  // (E3 s2 affordance pass: the refs' BIG numbered plates, not a modest label)
  const px = w * 0.52, py = h * 0.5, prx = w * 0.19, pry = h * 0.37
  s += `<rect x="${fx(px - prx)}" y="${fx(py - pry)}" width="${fx(prx * 2)}" height="${fx(pry * 2)}" rx="${fx(prx * 0.32)}" fill="${GOLD}" stroke="${WOOD_EDGE}" stroke-width="2" stroke-opacity="0.75"/>`
  s += `<rect x="${fx(px - prx)}" y="${fx(py - pry)}" width="${fx(prx * 0.5)}" height="${fx(pry * 2)}" rx="${fx(prx * 0.3)}" fill="${GOLD_LIT}" opacity="0.6"/>`
  for (const [dx, dy] of [[-prx * 0.72, -pry * 0.78], [prx * 0.72, -pry * 0.78], [-prx * 0.72, pry * 0.78], [prx * 0.72, pry * 0.78]])
    s += `<circle cx="${fx(px + dx)}" cy="${fx(py + dy)}" r="2.6" fill="${GOLD_DIM}" stroke="${INK}" stroke-width="0.8" stroke-opacity="0.5"/>` // plate screws
  s += `<text x="${fx(px)}" y="${fx(py + pry * 0.44)}" font-family="Georgia, 'Times New Roman', serif" font-size="${fx(pry * 1.3)}" font-weight="bold" text-anchor="middle" fill="${WOOD_EDGE}">${plate}</text>`
  // door 3's tag carries the tiny PAW PRINT — the cat, foreshadowed
  if (plate === 3) {
    const pawX = px + prx * 0.62, pawY = py + pry * 0.52, P = pry * 0.16
    s += `<ellipse cx="${fx(pawX)}" cy="${fx(pawY + P * 0.5)}" rx="${fx(P * 0.62)}" ry="${fx(P * 0.5)}" fill="${WOOD_EDGE}" opacity="0.8"/>`
    for (const [tx, ty] of [[-P * 0.62, -P * 0.28], [-P * 0.21, -P * 0.52], [P * 0.21, -P * 0.52], [P * 0.62, -P * 0.28]])
      s += `<circle cx="${fx(pawX + tx)}" cy="${fx(pawY + ty)}" r="${fx(P * 0.21)}" fill="${WOOD_EDGE}" opacity="0.8"/>`
  }
  // iron ring handle at the RIGHT (fore/lift) edge
  const rcx = w * 0.85, rcy = h * 0.5, rrad = h * 0.2
  s += `<circle cx="${fx(rcx)}" cy="${fx(rcy)}" r="${fx(rrad)}" fill="none" stroke="${IRON}" stroke-width="${fx(h * 0.06)}"/>`
  s += `<circle cx="${fx(rcx)}" cy="${fx(rcy)}" r="${fx(rrad)}" fill="none" stroke="${IRON_LIT}" stroke-width="1.4" opacity="0.7"/>`
  s += `<circle cx="${fx(rcx + rrad)}" cy="${fx(rcy)}" r="${fx(h * 0.05)}" fill="${IRON}"/>` // mount boss (toward the fore edge)
  // warm timber edge (no cold pale rim)
  s += `<path d="${doorD}" fill="none" stroke="${WOOD_EDGE}" stroke-width="6" opacity="0.92" stroke-linejoin="round"/>`
  s += `<path d="${doorD}" fill="none" stroke="${WOOD_LIT}" stroke-width="1.4" opacity="0.5" stroke-linejoin="round"/>`
  s += `</g>`
  return svgPiece(w, h, s)
}

// E2.2 s7 PLAYABLE — THE TREASURE COFFER (ch6-coffer). A lift-the-flap on the
// open right-page ground fore of the northern vault: the reader lifts a teal-
// steel strongbox lid and an aurora-lit gold hoard glows inside (charter G4).
// Same screen-space law as the s2 key-board (image-x = page-fore d = screen-
// RIGHT, image-y = spine z = screen-DOWN, no rotation): the LID hinges at the
// LEFT (spine) edge and its gold HASP (the affordance) sits at the RIGHT (fore/
// lift) edge; the interior BOARD keeps the brightest hoard in the FORE (RIGHT)
// half so a lifted lid uncovers it first (bench derive-s7lid.mjs L6). Northern
// strongbox vocabulary (teal STEEL, GOLD reinforced corners, AUR aurora sheen,
// violet wax seal). Deterministic: mulberry32(seed).

/** THE COFFER LID (ch6-coffer-door1): a closed teal-steel strongbox lid seen
 *  top-down — iron hinge straps at the LEFT (spine) edge, a bright gold HASP +
 *  latch plate at the RIGHT (fore/lift) edge, gold reinforced corners, aurora
 *  sheen on the FAR (top) edge. Opaque (covers the hoard when shut). */
function cofferLid(w, h, seed) {
  const r = mulberry32(seed)
  const STEEL = '#2e5244', SLIT = '#3f6b5a', SDIM = '#1c352b', AUR = '#4fd6b8'
  const IRON = '#2b2620', ILIT = '#6b6156'
  const x0 = w * 0.03, x1 = w * 0.97, y0 = h * 0.04, y1 = h * 0.96
  const W = x1 - x0, H = y1 - y0
  const lidD = `M ${fx(x0)} ${fx(y0)} L ${fx(x1)} ${fx(y0)} L ${fx(x1)} ${fx(y1)} L ${fx(x0)} ${fx(y1)} Z`
  let s = `<g>`
  s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(W)}" height="${fx(H)}" fill="${STEEL}"/>`
  s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(W * 0.5)}" height="${fx(H)}" fill="${SLIT}" opacity="0.3"/>` // lit toward the hinge (up-screen-left key light)
  s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(W)}" height="${fx(H * 0.14)}" fill="${AUR}" opacity="0.18"/>` // aurora sheen, far edge
  for (let i = 0; i < 30; i++) {
    const gy = rr(r, y0, y1)
    s += `<line x1="${fx(x0)}" y1="${fx(gy)}" x2="${fx(x0 + rr(r, W * 0.3, W * 0.9))}" y2="${fx(gy)}" stroke="${SDIM}" stroke-width="1" opacity="${fx(rr(r, 0.1, 0.28))}"/>` // brushed-steel grain
  }
  // gold reinforced corner brackets (strongbox vocabulary)
  const corner = (cx, cy, sx, sy) =>
    `<path d="M ${fx(cx)} ${fx(cy + sy * H * 0.2)} L ${fx(cx)} ${fx(cy)} L ${fx(cx + sx * W * 0.16)} ${fx(cy)}" fill="none" stroke="${GOLD}" stroke-width="6" opacity="0.92"/>`
  s += corner(x0 + 6, y0 + 6, 1, 1) + corner(x1 - 6, y0 + 6, -1, 1) + corner(x0 + 6, y1 - 6, 1, -1) + corner(x1 - 6, y1 - 6, -1, -1)
  for (const [rx, ry] of [[0.5, 0.1], [0.5, 0.9], [0.16, 0.5]])
    s += `<circle cx="${fx(x0 + W * rx)}" cy="${fx(y0 + H * ry)}" r="3.4" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1"/>` // rivets
  // iron hinge straps at the LEFT (spine/hinge) edge
  for (const hy of [0.3, 0.7]) {
    s += `<rect x="${fx(x0)}" y="${fx(y0 + H * hy - H * 0.09)}" width="${fx(W * 0.12)}" height="${fx(H * 0.18)}" rx="2" fill="${IRON}"/>`
    s += `<path d="M ${fx(x0 + W * 0.1)} ${fx(y0 + H * hy)} L ${fx(x0 + W * 0.24)} ${fx(y0 + H * hy)}" stroke="${IRON}" stroke-width="${fx(H * 0.06)}" stroke-linecap="round"/>`
    s += `<circle cx="${fx(x0 + W * 0.05)}" cy="${fx(y0 + H * hy)}" r="2.6" fill="${ILIT}"/>` // nail
  }
  // THE GOLD HASP at the RIGHT (fore/lift) edge — the visible grab affordance
  const hcy = (y0 + y1) / 2, hx = x1 - W * 0.11
  s += `<rect x="${fx(x1 - W * 0.22)}" y="${fx(hcy - H * 0.17)}" width="${fx(W * 0.18)}" height="${fx(H * 0.34)}" rx="4" fill="${GOLD}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.55"/>` // latch plate
  s += `<rect x="${fx(x1 - W * 0.22)}" y="${fx(hcy - H * 0.17)}" width="${fx(W * 0.06)}" height="${fx(H * 0.34)}" rx="3" fill="${GOLD_LIT}" opacity="0.6"/>`
  s += `<circle cx="${fx(x1 - W * 0.1)}" cy="${fx(hcy + H * 0.02)}" r="3.2" fill="${INK}" opacity="0.7"/>` // keyhole
  s += `<circle cx="${fx(hx)}" cy="${fx(hcy)}" r="${fx(H * 0.14)}" fill="none" stroke="${GOLD}" stroke-width="${fx(H * 0.06)}"/>` // hasp loop over the fore edge
  s += `<circle cx="${fx(hx)}" cy="${fx(hcy)}" r="${fx(H * 0.14)}" fill="none" stroke="${GOLD_LIT}" stroke-width="1.6" opacity="0.85"/>`
  s += `<circle cx="${fx(hx - H * 0.05)}" cy="${fx(hcy - H * 0.05)}" r="${fx(H * 0.03)}" fill="#fff" opacity="0.45"/>` // glint
  s += `<path d="${lidD}" fill="none" stroke="${SDIM}" stroke-width="6" opacity="0.9" stroke-linejoin="round"/>`
  s += `<path d="${lidD}" fill="none" stroke="${AUR}" stroke-width="1.4" opacity="0.4" stroke-linejoin="round"/>`
  s += `</g>`
  return svgPiece(w, h, s)
}

/** THE COFFER INTERIOR (ch6-coffer-board): the OPEN aurora-lit hoard — a dark
 *  teal-steel cavity (back wall up-screen/top), a heap of minted gold coins
 *  filling the FORE (right/lower) half under a teal-aurora glow wash, a violet
 *  wax seal nestled in the hoard. Opaque; painted in the revealed state (the
 *  lid covers it when shut). */
function cofferInterior(w, h, seed) {
  const r = mulberry32(seed)
  const SDIM = '#1c352b', SDK = '#122420', AUR = '#4fd6b8'
  let s = `<g>`
  s += `<rect width="${w}" height="${h}" fill="${SDK}"/>` // cavity
  s += `<rect x="0" y="0" width="${w}" height="${fx(h * 0.42)}" fill="${SDIM}" opacity="0.85"/>` // upright back (far) wall
  s += `<rect x="0" y="0" width="${fx(w * 0.2)}" height="${h}" fill="#000" opacity="0.3"/>` // hinge-side lip in shadow (spine)
  s += `<ellipse cx="${fx(w * 0.6)}" cy="${fx(h * 0.56)}" rx="${fx(w * 0.5)}" ry="${fx(h * 0.42)}" fill="${AUR}" opacity="0.14"/>` // aurora glow pooling on the hoard
  s += `<rect x="0" y="${fx(h * 0.4)}" width="${w}" height="${fx(h * 0.05)}" fill="${AUR}" opacity="0.12"/>` // aurora reflection line
  // THE HOARD — minted gold heaped in the fore (right/lower) half so a lifted lid uncovers it first
  const heap = `M 0 ${fx(h)} Q ${fx(w * 0.25)} ${fx(h * 0.52)} ${fx(w * 0.5)} ${fx(h * 0.6)} Q ${fx(w * 0.78)} ${fx(h * 0.48)} ${fx(w)} ${fx(h * 0.55)} L ${fx(w)} ${fx(h)} Z`
  s += `<path d="${heap}" fill="#c79a24"/>`
  s += `<path d="${heap}" fill="${AUR}" opacity="0.08"/>`
  for (let i = 0; i < 82; i++) {
    const x = rr(r, 0, w), y = rr(r, h * 0.5, h)
    const cr = rr(r, 6, 12)
    s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.72)}" fill="${r() < 0.55 ? GOLD_LIT : GOLD}" stroke="#b8901e" stroke-width="1"/>`
    if (r() < 0.4) s += `<ellipse cx="${fx(x - cr * 0.2)}" cy="${fx(y - cr * 0.2)}" rx="${fx(cr * 0.3)}" ry="${fx(cr * 0.2)}" fill="#fff4cf" opacity="0.85"/>` // glint
  }
  // violet wax seal nestled in the back hoard (the northern seal motif)
  const sx = w * 0.6, sy = h * 0.32, R = Math.min(w, h) * 0.13
  s += `<circle cx="${fx(sx)}" cy="${fx(sy)}" r="${fx(R)}" fill="#5a3f8a" stroke="#2a1c45" stroke-width="2"/>`
  s += `<circle cx="${fx(sx - R * 0.28)}" cy="${fx(sy - R * 0.28)}" r="${fx(R * 0.7)}" fill="#7256a8" opacity="0.4"/>`
  s += `<circle cx="${fx(sx)}" cy="${fx(sy)}" r="${fx(R * 0.62)}" fill="none" stroke="#2a1c45" stroke-width="1.4" opacity="0.7"/>`
  const star = []
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6 - Math.PI / 2
    const rl = k % 2 ? R * 0.24 : R * 0.5
    star.push(`${fx(sx + Math.cos(a) * rl)} ${fx(sy + Math.sin(a) * rl)}`)
  }
  s += `<path d="M ${star.join(' L ')} Z" fill="#2a1c45" opacity="0.55"/>`
  for (let i = 0; i < 11; i++) {
    const x = rr(r, w * 0.3, w * 0.96), y = rr(r, h * 0.34, h * 0.6)
    s += `<circle cx="${fx(x)}" cy="${fx(y)}" r="${fx(rr(r, 1.2, 2.6))}" fill="${AUR}" opacity="${fx(rr(r, 0.3, 0.7))}"/>` // aurora sparkles off the gold
  }
  const frame = `M 3 3 L ${fx(w - 3)} 3 L ${fx(w - 3)} ${fx(h - 3)} L 3 ${fx(h - 3)} Z`
  s += `<path d="${frame}" fill="none" stroke="${SDIM}" stroke-width="6" opacity="0.9" stroke-linejoin="round"/>` // steel interior lip
  s += `<path d="${frame}" fill="none" stroke="${GOLD}" stroke-width="1.4" opacity="0.45" stroke-linejoin="round"/>`
  s += `</g>`
  return svgPiece(w, h, s)
}

// ============================================================================
// E3 s4 BATCH C — THE RING'S REMAINING PIECES: the gatehouse tower (stripflap,
// alpha die-cut, no outline sidecar), the s4 spread print (the cobbled
// post-road) and the rookery's outer yard wall. Same rookery palette and the
// same PALE core-edge rim as the facades. Deterministic: mulberry32(seed).
// ============================================================================

// ---- THE GATEHOUSE TOWER (ch3-ring-tower, stripflap w0.12/h0.20). A slender
// dovecote tower where the post-road enters the ring: plinth, a shaft of stacked
// portal ranks, a corbelled crenellated cap, an amber crown lantern and one
// raven perched on it. Rectangular mesh — the ALPHA carries the die-cut. ----
// The lone crown raven: `bh` chosen so its LINK level (0.55 of the bird height)
// lands exactly on the lantern head at v 0.834 and its crown at v 0.99 — no
// pedestal band, just the bird.
const TOWER_RAVEN_H = 0.347
const TOWER_RAVEN_V0 = 0.99 - TOWER_RAVEN_H

function ringTower(w, h, seed) {
  const r = mulberry32(seed)
  const X = (u) => u * w
  const Y = (v) => (1 - v) * h

  const ring = [
    [0.08, 0.0], [0.08, 0.05], [0.18, 0.09], [0.18, 0.56], [0.12, 0.6],
    ...crenelTop(0.12, 0.4, 0.6, 0.68, 3),
    [0.4, 0.6], [0.46, 0.6], [0.46, 0.7], [0.4, 0.7], [0.4, 0.834], [0.3375, 0.834],
    ...ravenChainTop(0.3375, 0.6625, TOWER_RAVEN_V0, TOWER_RAVEN_H, 1, 'left'),
    [0.6625, 0.834], [0.6, 0.834], [0.6, 0.7], [0.54, 0.7], [0.54, 0.6], [0.6, 0.6],
    ...crenelTop(0.6, 0.88, 0.6, 0.68, 3),
    [0.88, 0.6], [0.88, 0.56], [0.82, 0.56], [0.82, 0.09], [0.92, 0.05], [0.92, 0.0],
  ]
  const outline = simplifyOutline(ring)
  const d = outline.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'

  let g = `<g clip-path="url(#towerCut)">`
  // Eye-review r1: the tower could not be picked out at full size because it
  // stands in front of the keep's MID-GREY slate lower facade in its own
  // mid-grey slate. The body now sits a full step DARKER (slateDim over a
  // slateDeep fore-side) with a crisp pale reveal down its spine-side, so the
  // silhouette separates from its backdrop by value, not just by outline.
  g += `<rect width="${w}" height="${h}" fill="${ROOK.slateDim}"/>`
  g += `<rect x="${fx(X(0.18))}" y="0" width="${fx(X(0.09))}" height="${h}" fill="${ROOK.slateLit}" opacity="0.55"/>`
  g += `<rect x="${fx(X(0.18))}" y="0" width="${fx(X(0.028))}" height="${h}" fill="${ROOK.parchDim}" opacity="0.75"/>`
  g += `<rect x="${fx(X(0.66))}" y="0" width="${fx(X(0.16))}" height="${h}" fill="${ROOK.slateDeep}" opacity="0.62"/>`
  g += `<rect x="${fx(X(0.78))}" y="0" width="${fx(X(0.04))}" height="${h}" fill="${ROOK.ink}" opacity="0.4"/>`
  // ashlar coursing up the shaft
  for (let cy = h; cy > Y(0.6); cy -= h * 0.036) {
    g += `<line x1="${fx(X(0.06))}" y1="${fx(cy)}" x2="${fx(X(0.94))}" y2="${fx(cy)}" stroke="${ROOK.ink}" stroke-width="1.4" opacity="${(0.22 + r() * 0.16).toFixed(2)}"/>`
  }
  // plinth + corbel band
  g += `<rect x="${fx(X(0.06))}" y="${fx(Y(0.09))}" width="${fx(X(0.88))}" height="${fx(Y(0.05) - Y(0.09))}" fill="${ROOK.slateDeep}"/>`
  g += `<rect x="${fx(X(0.06))}" y="${fx(Y(0.09))}" width="${fx(X(0.88))}" height="${fx(Math.max(2, h * 0.008))}" fill="${ROOK.parchDim}" opacity="0.8"/>`
  g += `<rect x="${fx(X(0.1))}" y="${fx(Y(0.58))}" width="${fx(X(0.8))}" height="${fx(Math.max(3, h * 0.016))}" fill="${ROOK.parchDim}" opacity="0.88"/>`
  // stacked portal ranks — 5 tiers of 2, boosted glow and more of them lit so
  // the gatehouse is legible as a lit dovecote and not as furniture.
  const pw = 0.145
  const ph = 0.12
  let litPrev = false
  for (const sillV of [0.15, 0.26, 0.37, 0.48, 0.55]) {
    g += `<rect x="${fx(X(0.18))}" y="${fx(Y(sillV) + Math.max(2, h * 0.006))}" width="${fx(X(0.64))}" height="${fx(Math.max(2, h * 0.008))}" fill="${ROOK.parchDim}" opacity="0.65"/>`
    for (const cu of [0.35, 0.65]) {
      const roll = r()
      // the tower is only TWO portals wide, so neighbouring halos overlap hard —
      // a small boost here, and the legibility comes from the crown lantern and
      // the body's value step instead of from flooding the shaft with amber
      const lit = roll < 0.26 || (litPrev && roll < 0.42)
      litPrev = lit
      g += ravenPortal(X(cu - pw / 2), Y(sillV), X(pw), ph * h, lit, 0.2)
    }
  }
  // crenellated cap merlons
  for (const [z0, z1] of [[0.12, 0.4], [0.6, 0.88]]) {
    const tw = (z1 - z0) / 5
    for (let t = 0; t < 3; t++) {
      const mx = X(z0 + t * 2 * tw)
      g += `<rect x="${fx(mx)}" y="${fx(Y(0.68))}" width="${fx(X(tw))}" height="${fx(Y(0.6) - Y(0.68))}" fill="${ROOK.slateDim}"/>`
      g += `<rect x="${fx(mx)}" y="${fx(Y(0.68))}" width="${fx(X(tw))}" height="${fx(Math.max(2, h * 0.008))}" fill="${ROOK.rim}" opacity="0.85"/>`
    }
  }
  // the CROWN LANTERN — the tower's signature (pack 4e), so it is genuinely
  // bright: a wide halo washing the whole cap, then the amber box, then a
  // white-hot core. This is what the reader should pick out at full size.
  g += `<ellipse cx="${fx(X(0.5))}" cy="${fx(Y(0.735))}" rx="${fx(X(0.62))}" ry="${fx(h * 0.085)}" fill="url(#rookHalo)" opacity="0.6"/>`
  g += `<ellipse cx="${fx(X(0.5))}" cy="${fx(Y(0.632))}" rx="${fx(X(0.34))}" ry="${fx(h * 0.026)}" fill="${ROOK.amber}" opacity="0.34"/>`
  g += `<rect x="${fx(X(0.46))}" y="${fx(Y(0.7))}" width="${fx(X(0.08))}" height="${fx(Y(0.6) - Y(0.7))}" fill="${ROOK.slateDeep}"/>`
  g += `<rect x="${fx(X(0.38))}" y="${fx(Y(0.84))}" width="${fx(X(0.24))}" height="${fx(Y(0.695) - Y(0.84))}" fill="url(#rookGlow)"/>`
  g += `<ellipse cx="${fx(X(0.5))}" cy="${fx(Y(0.775))}" rx="${fx(X(0.038))}" ry="${fx(h * 0.023)}" fill="${ROOK.rim}" opacity="0.85"/>`
  g += `<rect x="${fx(X(0.38))}" y="${fx(Y(0.84))}" width="${fx(X(0.24))}" height="${fx(Y(0.695) - Y(0.84))}" fill="none" stroke="${ROOK.ink}" stroke-width="2.6" opacity="0.85"/>`
  g += `<line x1="${fx(X(0.5))}" y1="${fx(Y(0.84))}" x2="${fx(X(0.5))}" y2="${fx(Y(0.695))}" stroke="${ROOK.ink}" stroke-width="1.8" opacity="0.6"/>`
  // the raven perched on the lantern (the contour already cut its silhouette):
  // solid ink against the lit lantern below it, so the bird reads as a shape.
  g += `<rect x="${fx(X(0.33))}" y="${fx(Y(0.995))}" width="${fx(X(0.34))}" height="${fx(Y(0.83) - Y(0.995))}" fill="${ROOK.ink}"/>`
  g += `<circle cx="${fx(X(0.3375 + 0.325 * 0.17))}" cy="${fx(Y(TOWER_RAVEN_V0 + TOWER_RAVEN_H * 0.93))}" r="${fx(Math.max(2, h * 0.013))}" fill="${ROOK.amberLit}"/>`
  g += `<rect width="${w}" height="${h}" fill="url(#rookShade)"/>`
  g += `</g>`

  const defs =
    `<clipPath id="towerCut"><path d="${d}"/></clipPath>` +
    `<radialGradient id="rookGlow" cx="0.5" cy="0.62" r="0.8">` +
    `<stop offset="0" stop-color="${ROOK.amberLit}"/><stop offset="0.5" stop-color="${ROOK.amber}"/>` +
    `<stop offset="1" stop-color="${ROOK.amberDeep}"/></radialGradient>` +
    `<radialGradient id="rookHalo" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${ROOK.amberLit}" stop-opacity="0.85"/>` +
    `<stop offset="0.4" stop-color="${ROOK.amber}" stop-opacity="0.44"/>` +
    `<stop offset="1" stop-color="${ROOK.amber}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="rookShade" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${ROOK.parchLit}" stop-opacity="0.14"/>` +
    `<stop offset="0.5" stop-color="#000000" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${ROOK.ink}" stop-opacity="0.4"/></linearGradient>`

  // a wider pale core-edge rim than the flanks get: this piece must hold its
  // own silhouette against the keep's facade directly behind it.
  return svgPiece(w, h, g + rookRim(d, 6.5), defs)
}

// ---- THE ROOKERY'S OUTER YARD WALL (ch3-fringe, foreground vfold, very wide/
// short; crease at image centre). Slate ashlar with a coping, a rank of perched
// ravens along the crest, and a ROAD NOTCH punched through its base on the RIGHT
// (spread-x ~0.86) where the post-road painted on page-4 passes through. ----
function rookeryFringe(w, h, seed) {
  const r = mulberry32(seed)
  const crestV = 0.5 // wall top, in v-up fractions of the strip height
  const Y = (v) => (1 - v) * h
  const X = (u) => u * w
  const rankV = 0.44 // raven-rank height above the coping

  // wall body + linked raven rank along the crest, as one contour
  const top = []
  top.push([0, crestV])
  const bands = [[0.03, 0.31], [0.37, 0.63], [0.69, 0.79], [0.92, 0.98]]
  let cursor = 0.02
  for (const [z0, z1] of bands) {
    top.push([cursor, crestV], [z0, crestV])
    const n = Math.max(3, Math.round(((z1 - z0) * w) / Math.max(6, rankV * h * RAVEN_CELL)))
    top.push(...ravenChainTop(z0, z1, crestV, rankV, n, 'left'), [z1, crestV])
    cursor = z1
  }
  top.push([1, crestV])
  const wall = simplifyOutline([[0, 0], ...top, [1, 0]])
  const wallD = wall.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'

  // the ROAD NOTCH: a true alpha hole (even-odd) the post-road runs through
  const nx0 = 0.8
  const nx1 = 0.9
  const nTop = 0.42
  const notchD =
    `M ${fx(X(nx0))} ${fx(h)} L ${fx(X(nx0 + 0.008))} ${fx(Y(nTop * 0.7))} ` +
    `Q ${fx(X((nx0 + nx1) / 2))} ${fx(Y(nTop))} ${fx(X(nx1 - 0.008))} ${fx(Y(nTop * 0.7))} L ${fx(X(nx1))} ${fx(h)} Z`

  let s = `<g>`
  s += `<path fill-rule="evenodd" d="${wallD} ${notchD}" fill="${ROOK.slate}"/>`
  s += `<g clip-path="url(#fringeCut)">`
  // coping + ashlar coursing + a lit crest line
  s += `<rect x="0" y="${fx(Y(crestV))}" width="${w}" height="${fx(Math.max(3, h * 0.04))}" fill="${ROOK.slateLit}" opacity="0.55"/>`
  for (let i = 1; i * h * 0.16 < h; i++) {
    const cy = h - i * h * 0.16
    s += `<line x1="0" y1="${fx(cy)}" x2="${w}" y2="${fx(cy)}" stroke="${ROOK.ink}" stroke-width="1.6" opacity="${(0.2 + r() * 0.16).toFixed(2)}"/>`
    for (let b = 0; b < 26; b++) {
      const jx = ((b + (i % 2 ? 0.5 : 0)) / 26) * w
      s += `<line x1="${fx(jx)}" y1="${fx(cy)}" x2="${fx(jx)}" y2="${fx(cy - h * 0.16)}" stroke="${ROOK.ink}" stroke-width="1.3" opacity="0.24"/>`
    }
  }
  // the rank's bodies (the contour already cut them) + eyes
  for (const [z0, z1] of bands) {
    const n = Math.max(3, Math.round(((z1 - z0) * w) / Math.max(6, rankV * h * RAVEN_CELL)))
    const perchV = crestV + rankV * RAVEN_PROFILE[0][1]
    s += `<rect x="${fx(X(z0))}" y="${fx(Y(crestV + rankV))}" width="${fx(X(z1 - z0))}" height="${fx(Y(perchV) - Y(crestV + rankV))}" fill="${ROOK.ink}"/>`
    const cw = (z1 - z0) / n
    for (let k = 0; k < n; k++) {
      s += `<circle cx="${fx(X(z0 + cw * (k + 0.17)))}" cy="${fx(Y(crestV + rankV * 0.94))}" r="${fx(Math.max(1.3, rankV * h * 0.05))}" fill="${ROOK.amberLit}" opacity="0.95"/>`
    }
  }
  // road shadow spilling out of the notch onto the yard face
  s += `<path d="M ${fx(X(nx0 - 0.02))} ${fx(h)} L ${fx(X(nx0 + 0.01))} ${fx(Y(nTop * 0.6))} L ${fx(X(nx1 - 0.01))} ${fx(Y(nTop * 0.6))} L ${fx(X(nx1 + 0.02))} ${fx(h)} Z" fill="${ROOK.ink}" opacity="0.3"/>`
  // a bill-posted notice pair (the yard wall is where routes are posted)
  for (const [px, pv] of [[0.2, 0.4], [0.62, 0.36]]) {
    s += `<rect x="${fx(X(px))}" y="${fx(Y(pv))}" width="${fx(w * 0.035)}" height="${fx(h * 0.3)}" fill="${ROOK.parch}" opacity="0.92" transform="rotate(-2 ${fx(X(px))} ${fx(Y(pv))})"/>`
    for (let l = 0; l < 4; l++) {
      s += `<line x1="${fx(X(px) + 4)}" y1="${fx(Y(pv) + h * 0.06 + l * h * 0.055)}" x2="${fx(X(px) + w * 0.03)}" y2="${fx(Y(pv) + h * 0.06 + l * h * 0.055)}" stroke="${ROOK.ink}" stroke-width="1.4" opacity="0.45"/>`
    }
  }
  s += `<rect x="0" y="${fx(h * 0.86)}" width="${w}" height="${fx(h * 0.14)}" fill="${ROOK.ink}" opacity="0.26"/>`
  s += `</g>`
  s += rookRim(wallD, 5)
  s += rookRim(notchD, 4)
  s += `</g>`

  const defs = `<clipPath id="fringeCut"><path fill-rule="evenodd" d="${wallD} ${notchD}"/></clipPath>`
  return svgPiece(w, h, s, defs)
}

// ---- THE s4 SPREAD PRINT (page-4, both pages in ONE image). The renderer
// splits it right = repeat(0.5,1)/offset(0.5,0), left = repeat(-0.5,1)/offset
// (0.5,0) over a mesh with scale.x = -1 — the two transforms compose to a
// CONTINUOUS spread: image x=0 is the LEFT page's fore edge, x=0.5 the spine,
// x=1 the RIGHT page's fore edge. Page uvs are u = x/PAGE_W, v = 1 - row with
// row 0 at z = -PAGE_H/2, so with the default flipY image-TOP is the FAR page
// edge (z = -0.75) and image-BOTTOM is the reader's apron (z = +0.75).
//
// Painted on parchment in walnut/slate: the cobbled POST-ROAD sweeping in at the
// right page's fore edge, curving through the open court, under the balcony and
// dying into the keep's gate at the spine; wheeling raven shadows over both
// pages; a cobble apron under the sorting desk (right foreground); lamplight
// pools under the ranks of lit portals. ----
const PAGE_W_U = 1.15
const PAGE_H_U = 1.5
/** Scene (radial, z) -> page-print image fractions, per the uv maths above. */
const pageFX = (radial, side) => 0.5 + (side === 'left' ? -1 : 1) * (radial / (2 * PAGE_W_U))
const pageFY = (z) => (z + PAGE_H_U / 2) / PAGE_H_U

function postRoadSpread(w, h, seed) {
  const r = mulberry32(seed)
  const PX = (f) => f * w
  const PY = (f) => f * h
  const WALNUT = '#5c4526'
  const WALNUT_LT = '#7d6238'
  const WALNUT_DK = '#38290f'
  const clampNum = (x, a, b) => Math.min(b, Math.max(a, x))
  /** Opacities need 2dp: fx() is a 1dp PIXEL formatter and silently rounds
   *  anything under 0.05 to "0.0" (which is what made the paper tooth and the
   *  raven shadows invisible in the pre-review bake). */
  const op = (n) => clampNum(n, 0, 1).toFixed(2)

  // ---- the post-road's centreline. Eye-review r1 REROUTED it: the old curve
  // dipped to y 0.95-0.99, i.e. behind the fringe yard wall (which occludes
  // y 0.900-0.940) and into the page's most foreshortened band, so almost none
  // of it survived at the pinned camera and it never climbed into the court.
  // It now sweeps in at the right fore edge, runs OUTSIDE the sorting desk,
  // threads between the desk and the gatehouse tower foot, enters the open
  // court and dies into the keep's gate at the spine — every waypoint
  // registered to where a 3D piece actually meets the page.
  const WAY = [
    [1.05, 0.918], // off the fore edge, so the road runs off-page rather than starting
    [0.97, 0.9], // enters at the right apron
    [0.82, 0.86], // past outside the dispatch desk (centre 0.761, 0.740)
    [0.68, 0.8], // between the desk and the gatehouse foot (0.630-0.683, 0.753)
    [0.58, 0.76], // entering the open court (0.435-0.565, 0.740-1.0)
    [0.5, 0.735], // dies into the KEEP GATE at the spine (0.50, 0.73)
  ]
  /** Catmull-Rom through WAY with duplicated endpoints — unlike the old single
   *  cubic it passes through EVERY waypoint exactly, which is what the road
   *  registration proof samples. */
  const road = (t) => {
    const n = WAY.length - 1
    const u = clampNum(t, 0, 1) * n
    const i = Math.min(n - 1, Math.floor(u))
    const f = u - i
    const P = (k) => WAY[clampNum(k, 0, n)]
    const p0 = P(i - 1)
    const p1 = P(i)
    const p2 = P(i + 1)
    const p3 = P(i + 2)
    return [0, 1].map((k) => {
      const a = 2 * p1[k]
      const b = p2[k] - p0[k]
      const c = 2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]
      const dd = -p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]
      return 0.5 * (a + b * f + c * f * f + dd * f * f * f)
    })
  }
  /** Half-width in image-HEIGHT fractions: full width 0.124 at the apron down
   *  to 0.066 at the gate (pack: generous, perspective-tapered). */
  const roadHalf = (t) => lerp(0.062, 0.033, t)
  /** Centre + the half-width offset along the centreline's normal, taken in a
   *  SQUARE metric and converted back to image fractions so the band keeps a
   *  constant width on a 3:2 page instead of pinching on the diagonal. `k`
   *  scales the width (gutter lines inside the bed, kerb stones outside it). */
  const roadFrame = (t, k = 1) => {
    const [cx, cy] = road(t)
    const [nx, ny] = road(Math.min(1, t + 0.008))
    const dxs = (nx - cx) * (w / h)
    const dys = ny - cy
    const L = Math.hypot(dxs, dys) || 1
    const hw = roadHalf(t) * k
    return { cx, cy, px: ((-dys / L) * hw * h) / w, py: (dxs / L) * hw }
  }
  const N = 76
  /** The road's two edge polylines at width scale `k`, in image fractions. */
  const edgesAt = (k) => {
    const eL = []
    const eR = []
    for (let i = 0; i <= N; i++) {
      const { cx, cy, px, py } = roadFrame(i / N, k)
      eL.push([cx + px, cy + py])
      eR.push([cx - px, cy - py])
    }
    return [eL, eR]
  }
  const poly = (pts) => 'M ' + pts.map(([a, b]) => `${fx(PX(a))} ${fx(PY(b))}`).join(' L ')

  let s = `<g>`
  s += `<rect width="${w}" height="${h}" fill="${ROOK.parch}"/>`
  // laid-paper tooth
  for (let i = 0; i < 170; i++) {
    const y = rr(r, 0, h)
    s += `<line x1="0" y1="${fx(y)}" x2="${w}" y2="${fx(y)}" stroke="${WALNUT}" stroke-width="1" opacity="${op(rr(r, 0.03, 0.07))}"/>`
  }
  // the far half hazes out so the deep flank stations recede
  s += `<rect width="${w}" height="${fx(h * 0.36)}" fill="url(#pageHaze)"/>`

  // ---- THE RADIAL STATIONS: eye-review r1 KILLED these. Five dashed arcs
  // across the yard read at the pinned camera as sewing guides, not
  // architecture, and the plaza's far kerb below now states the ring's
  // recession properly. Nothing replaces them; the bare yard behind the plaza
  // is the point (the rookery's ground only becomes paved at the court).
  // the gutter: a soft valley shadow down the spine
  s += `<rect x="${fx(w * 0.46)}" y="0" width="${fx(w * 0.08)}" height="${h}" fill="url(#pageGutter)"/>`

  // ---- THE COURT / PLAZA (pack risk R2's paint-first mitigant). ONE
  // continuous radial apron that all nine dovecote facades stand on, so the
  // flanks stop reading as scattered islands. Its outer arc passes through BOTH
  // ring-MID arm feet (x 0.19 and 0.81 at y 0.58) and its near edge opens
  // toward the reader; flagging radiates from the gate, which is the ring's
  // own centre, so the paving states the amphitheater's geometry.
  const GX = 0.5
  const GY = 0.735
  // The plaza's ONLY drawn boundary is its far arc — its flanks and near edge
  // run off the image, so it reads as GROUND rather than as a grey tray sitting
  // on the page (which is what a full closed kerb looked like on first bake).
  const PLAZA_FAR =
    `M ${fx(PX(0.045))} ${fx(PY(0.665))} ` +
    `C ${fx(PX(0.1))} ${fx(PY(0.602))} ${fx(PX(0.15))} ${fx(PY(0.586))} ${fx(PX(0.19))} ${fx(PY(0.58))} ` +
    `C ${fx(PX(0.36))} ${fx(PY(0.523))} ${fx(PX(0.64))} ${fx(PY(0.523))} ${fx(PX(0.81))} ${fx(PY(0.58))} ` +
    `C ${fx(PX(0.85))} ${fx(PY(0.586))} ${fx(PX(0.9))} ${fx(PY(0.602))} ${fx(PX(0.955))} ${fx(PY(0.665))}`
  const PLAZA_D = `${PLAZA_FAR} L ${fx(PX(1.03))} ${fx(PY(1.06))} L ${fx(PX(-0.03))} ${fx(PY(1.06))} Z`
  const pol = (th, rho) => [GX + Math.cos(th) * rho * 0.47, GY - Math.sin(th) * rho * 0.31]
  s += `<g clip-path="url(#plazaCut)">`
  s += `<path d="${PLAZA_D}" fill="${ROOK.slate}" opacity="0.12"/>`
  s += `<path d="${PLAZA_D}" fill="url(#plazaShade)" opacity="0.4"/>`
  // Flagging radiating from the gate — the ring's own centre — so the paving
  // states the amphitheater's geometry. Drawn as BROKEN joints (short dashes
  // with gaps) because continuous spokes and full circles read as a wireframe.
  for (let k = 0; k < 30; k++) {
    const th = (k / 30) * Math.PI * 2 + 0.07
    for (const [r0, r1] of [[0.2, 0.44], [0.52, 0.74], [0.82, 1.06], [1.14, 1.44]]) {
      const [ax, ay] = pol(th, rr(r, r0, r0 + 0.05))
      const [bx2, by2] = pol(th, rr(r, r1 - 0.05, r1))
      s += `<line x1="${fx(PX(ax))}" y1="${fx(PY(ay))}" x2="${fx(PX(bx2))}" y2="${fx(PY(by2))}" stroke="${WALNUT}" stroke-width="1.4" opacity="${op(rr(r, 0.09, 0.16))}"/>`
    }
  }
  for (const rho of [0.32, 0.54, 0.76, 0.98, 1.2, 1.42]) {
    for (let seg = 0; seg < 22; seg++) {
      const th0 = (seg / 22) * Math.PI * 2 + rr(r, 0.01, 0.05)
      const pts = []
      for (let k = 0; k <= 6; k++) pts.push(pol(th0 + (k / 6) * (Math.PI * 2 / 22) * 0.8, rho))
      s += `<path d="${poly(pts)}" fill="none" stroke="${WALNUT}" stroke-width="1.4" opacity="${op(rr(r, 0.09, 0.16))}"/>`
    }
  }
  s += `</g>`
  // NO CONTINUOUS KERB. Eye-review r1 round 2: a single stroke along PLAZA_FAR ran
  // unbroken across the whole page and, with the pale fill above, made the plaza
  // read as an outlined oval sticker laid on the parchment — the same "grey tray"
  // failure in the other value direction. A reader must never be able to point at
  // where the ground ends. What remains is the graded fill plus BROKEN kerb
  // segments only where a facade foot actually meets the arc, so the edge is
  // implied by the architecture standing on it.
  for (const [kx, khw] of [[0.2525, 0.062], [0.7475, 0.062]]) {
    const seg = []
    for (let k = 0; k <= 8; k++) {
      const t = kx - khw + (k / 8) * khw * 2
      // follow the far arc's own local curve (a parabola through the mid feet)
      seg.push([t, 0.58 - 0.057 * (1 - ((t - 0.5) / 0.31) ** 2)])
    }
    const segD = seg.map(([a, b], i) => `${i ? 'L' : 'M'} ${fx(PX(a))} ${fx(PY(b))}`).join(' ')
    s += `<path d="${segD}" fill="none" stroke="${WALNUT_LT}" stroke-width="2.6" opacity="0.26"/>`
  }

  // ---- COBBLED SPURS: a SHORT paved ramp tying each facade foot to the plaza,
  // so no dovecote reads as an island. Deliberately small and quiet — at full
  // length these became grey planks flying across the page.
  //
  // ONLY THE FEET THAT ACTUALLY STAND ON THE PLAZA get one. Eye-review r1 round 2:
  // spurs were also emitted for the six REAR rows (y 0.153/0.247/0.393), which sit
  // UPSTAGE of the plaza's far arc (y ~0.52-0.58) — so each was a grey striped
  // quad marooned on bare parchment, joining nothing, and they read as debris
  // scattered among the raven shadows. The rear rim's connection to the ground is
  // the aerial-recession wash and its own lamplight pools, not paving: a far rim
  // seen across a court does not show its kerbstones.
  const SPURS = [
    [0.2525, 0.58, 0.036], // ring-MID left arm foot (0.196-0.309)
    [0.7475, 0.58, 0.036], // ring-MID right arm foot (0.691-0.804)
    [0.6565, 0.753, 0.024], // gatehouse tower foot (0.630-0.683)
    [0.2195, 0.883, 0.03], // ring-FRONT gate wall foot (0.178-0.261)
  ]
  for (const [sfx, sfy, hwF] of SPURS) {
    const dx = GX - sfx
    const dy = GY - sfy
    const L = Math.hypot(dx, dy) || 1
    const reach = 0.05 // fixed short reach toward the gate, in image fractions
    const ex = sfx + (dx / L) * reach
    const ey = sfy + (dy / L) * reach
    const hwE = hwF * 0.6
    const d =
      `M ${fx(PX(sfx - hwF))} ${fx(PY(sfy))} L ${fx(PX(sfx + hwF))} ${fx(PY(sfy))} ` +
      `L ${fx(PX(ex + hwE))} ${fx(PY(ey))} L ${fx(PX(ex - hwE))} ${fx(PY(ey))} Z`
    s += `<path d="${d}" fill="${ROOK.slateDim}" opacity="0.16"/>`
    for (let k = 1; k <= 2; k++) {
      const t = k / 3
      const cxs = lerp(sfx, ex, t)
      const hwT = lerp(hwF, hwE, t)
      s += `<line x1="${fx(PX(cxs - hwT))}" y1="${fx(PY(lerp(sfy, ey, t)))}" x2="${fx(PX(cxs + hwT))}" y2="${fx(PY(lerp(sfy, ey, t)))}" stroke="${WALNUT}" stroke-width="1.5" opacity="0.24"/>`
    }
  }

  // ---- LAMPLIGHT POOLS. Eye-review r1: these were scattered by a generic
  // radial sweep and came out near-invisible. They are now REGISTERED to where
  // the lit portals actually stand on the page (the pack's footprint table) and
  // graded — brightest under the two ring-MID arms and the gatehouse, dim at
  // the back — so the light itself carries the ring's sweep.
  const POOLS = [
    { x0: 0.196, x1: 0.309, y: 0.586, n: 3, rx: 0.032, ry: 0.02, o: 0.92 }, // ring-MID left arm feet
    { x0: 0.691, x1: 0.804, y: 0.586, n: 3, rx: 0.032, ry: 0.02, o: 0.92 }, // ring-MID right arm feet
    { x0: 0.178, x1: 0.261, y: 0.884, n: 2, rx: 0.028, ry: 0.014, o: 0.72 }, // ring-FRONT gate wall foot
    { x0: 0.2, x1: 0.44, y: 0.4, n: 2, rx: 0.026, ry: 0.014, o: 0.44 }, // flank-near rows
    { x0: 0.56, x1: 0.8, y: 0.4, n: 2, rx: 0.026, ry: 0.014, o: 0.44 },
    { x0: 0.24, x1: 0.46, y: 0.254, n: 2, rx: 0.022, ry: 0.012, o: 0.3 }, // flank-mid rows
    { x0: 0.54, x1: 0.76, y: 0.254, n: 2, rx: 0.022, ry: 0.012, o: 0.3 },
    { x0: 0.28, x1: 0.46, y: 0.16, n: 1, rx: 0.02, ry: 0.011, o: 0.22 }, // flank-rear rows, dimmest
    { x0: 0.54, x1: 0.72, y: 0.16, n: 1, rx: 0.02, ry: 0.011, o: 0.22 },
  ]
  for (const p of POOLS) {
    for (let k = 0; k < p.n; k++) {
      const cxs = p.n === 1 ? (p.x0 + p.x1) / 2 : lerp(p.x0, p.x1, (k + rr(r, 0.2, 0.8)) / p.n)
      const cys = p.y + rr(r, -0.004, 0.008)
      const j = rr(r, 0.85, 1.2)
      s += `<ellipse cx="${fx(PX(cxs))}" cy="${fx(PY(cys))}" rx="${fx(PX(p.rx * j))}" ry="${fx(PY(p.ry * j))}" fill="url(#pagePool)" opacity="${op(p.o * rr(r, 0.82, 1))}"/>`
    }
  }

  // ---- THE COBBLE APRON under the sorting desk (right page foreground: the
  // desk's own station, radial >= 0.42, z 0.14..0.62). Rows converge slightly
  // toward the spine so the paving lies down instead of standing up as a grid.
  // Drawn BEFORE the road now, so its pale joints cannot wash the road out.
  const APRON_ROWS = 6
  const APRON_COLS = 8
  const aprX = (row, t) => lerp(pageFX(lerp(0.52, 0.46, row / APRON_ROWS), 'right'), pageFX(lerp(1.0, 1.1, row / APRON_ROWS), 'right'), t)
  const aprY = (row, t) => pageFY(lerp(0.18, 0.58, row / APRON_ROWS)) + t * 0.014
  // clipped to the plaza: the desk's paving is a DENSER patch of the same court,
  // not a separate slab hanging off the edge of it
  s += `<g clip-path="url(#plazaCut)">`
  for (let row = 0; row < APRON_ROWS; row++) {
    for (let c = 0; c < APRON_COLS; c++) {
      const t0 = (c + (row % 2 ? 0.5 : 0)) / APRON_COLS
      const t1 = t0 + 0.92 / APRON_COLS
      if (t1 > 1) continue
      const d =
        `M ${fx(PX(aprX(row, t0)))} ${fx(PY(aprY(row, t0)))} L ${fx(PX(aprX(row, t1)))} ${fx(PY(aprY(row, t1)))} ` +
        `L ${fx(PX(aprX(row + 0.88, t1)))} ${fx(PY(aprY(row + 0.88, t1)))} L ${fx(PX(aprX(row + 0.88, t0)))} ${fx(PY(aprY(row + 0.88, t0)))} Z`
      s += `<path d="${d}" fill="none" stroke="${WALNUT}" stroke-width="1.4" opacity="${op(rr(r, 0.09, 0.16))}"/>`
    }
  }
  s += `</g>`

  // ---- THE COBBLED POST-ROAD: painted LAST on the floor and deliberately the
  // strongest value on the parchment (eye-review r1: the old road was a pale
  // slate wash at 0.44 that vanished at the pinned camera). Dark cobble bed +
  // a darker verge/gutter inside each edge + pale kerb stones outside them +
  // lit cobble crowns, so the road carries the eye from the apron to the gate.
  const [edgeL, edgeR] = edgesAt(1)
  const [gutL, gutR] = edgesAt(0.84)
  const [kerbL, kerbR] = edgesAt(1.14)
  const bandD = `${poly(edgeL)} L ${[...edgeR].reverse().map(([a, b]) => `${fx(PX(a))} ${fx(PY(b))}`).join(' L ')} Z`
  // the road's cast shadow, offset a touch fore-and-down so it sits IN the yard
  s += `<path d="${bandD}" transform="translate(${fx(w * 0.005)} ${fx(h * 0.008)})" fill="${ROOK.ink}" opacity="0.14"/>`
  // pale kerb stones first, so the dark bed is drawn over their inner halves
  s += `<path d="${poly(kerbL)}" fill="none" stroke="${WALNUT_LT}" stroke-width="4.5" opacity="0.4"/>`
  s += `<path d="${poly(kerbR)}" fill="none" stroke="${ROOK.parchDim}" stroke-width="5" opacity="0.5"/>`
  // The bed is a WARM dark stone, not slate and not ink-black: slate reads as a
  // blue-grey plastic strip on parchment and near-black reads as a hole cut in
  // the page. This sits ~85 luminance levels under the parchment (the value
  // contrast the road needs) while still reading as painted stone.
  s += `<path d="${bandD}" fill="#574c3e" opacity="0.97"/>`
  s += `<path d="${bandD}" fill="url(#roadShade)" opacity="0.24"/>`
  s += `<g clip-path="url(#roadCut)">`
  // cobble courses drawn as SCALLOPED JOINTS across the road — the painted-road
  // convention. (Filled stone ellipses with lit crowns turned the bed into a
  // rubber mat of studs, so the stones are described by their joints instead.)
  const rows = 46
  for (let i = 0; i <= rows; i++) {
    const t = i / rows
    const { cx, cy, px, py } = roadFrame(t)
    const stones = t > 0.6 ? 5 : 6
    for (let c = 0; c < stones; c++) {
      const o = ((c + 0.5) / stones - 0.5) * 2 + (i % 2 ? 1 / stones : 0) + rr(r, -0.05, 0.05)
      const sx = cx + px * o
      const sy = cy + py * o
      const rx = (Math.hypot(px * w, py * h) / stones) * rr(r, 0.85, 1.1)
      const ry = rx * rr(r, 0.6, 0.8)
      const glow = 1 - Math.abs(o) * 0.8 // the road's crown catches the lamplight
      const scallop = (dy2, col, wd, o2) =>
        `<path d="M ${fx(PX(sx) - rx * 0.9)} ${fx(PY(sy) + ry * 0.4 + dy2)} Q ${fx(PX(sx))} ${fx(PY(sy) - ry * 1.05 + dy2)} ${fx(PX(sx) + rx * 0.9)} ${fx(PY(sy) + ry * 0.4 + dy2)}" fill="none" stroke="${col}" stroke-width="${wd}" stroke-linecap="round" opacity="${op(o2)}"/>`
      s += scallop(0, '#241c12', 1.7, rr(r, 0.42, 0.62))
      if (r() < 0.62) s += scallop(-1.8, ROOK.parchDim, 1.4, (0.1 + glow * 0.14) * rr(r, 0.7, 1.3))
    }
  }
  // a faint lit crown down the middle so the bed cambers instead of lying flat
  s += `<path d="${poly(edgesAt(0)[0])}" fill="none" stroke="${ROOK.parchDim}" stroke-width="${fx(h * 0.022)}" opacity="0.1"/>`
  // the VERGE / GUTTER: a dark channel inside each edge, the darkest note here
  s += `<path d="${poly(gutL)}" fill="none" stroke="#231a0d" stroke-width="5" opacity="0.68"/>`
  s += `<path d="${poly(gutR)}" fill="none" stroke="#231a0d" stroke-width="6.5" opacity="0.78"/>`
  s += `</g>`
  // the gate mouth the road dies into, at the spine
  s += `<ellipse cx="${fx(PX(0.5))}" cy="${fx(PY(0.737))}" rx="${fx(PX(0.026))}" ry="${fx(PY(0.024))}" fill="#2e2618" opacity="0.8"/>`
  s += `<ellipse cx="${fx(PX(0.5))}" cy="${fx(PY(0.737))}" rx="${fx(PX(0.026))}" ry="${fx(PY(0.024))}" fill="none" stroke="${WALNUT_LT}" stroke-width="2.4" opacity="0.5"/>`

  // ---- the GATEHOUSE's lamplight lands ON the road (its foot at x 0.630-0.683,
  // y ~0.753, sits inside the road band), so this one pool is painted OVER the
  // cobbles: warm light on a dark wet bed, which is also what sells the road.
  s += `<ellipse cx="${fx(PX(0.6565))}" cy="${fx(PY(0.762))}" rx="${fx(PX(0.052))}" ry="${fx(PY(0.036))}" fill="url(#pagePool)" opacity="0.62"/>`
  s += `<ellipse cx="${fx(PX(0.6565))}" cy="${fx(PY(0.752))}" rx="${fx(PX(0.03))}" ry="${fx(PY(0.017))}" fill="url(#pagePool)" opacity="0.8"/>`

  // ---- WHEELING RAVEN SHADOWS: the 3D flight continued in 2D, gathered into
  // two loose gyres (one per page). Eye-review r1: they were invisible (the old
  // opacity went through fx(), which rounded 0.1-0.22 to one decimal, and the
  // scale was flat). Now they read as soft dark shapes, and BOTH size and
  // strength grade with depth — largest and darkest near the reader.
  for (const [side, gz, gr, n] of [['left', -0.22, 0.62, 11], ['right', -0.3, 0.66, 12]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rr(r, -0.3, 0.3)
      const rad = rr(r, 0.35, 1) * gr
      const radial = clampNum(0.5 + Math.cos(a) * rad * 0.62, 0.06, PAGE_W_U * 0.99)
      const z = clampNum(gz + Math.sin(a) * rad * 0.4, -0.72, 0.66)
      const near = pageFY(z) // 0 far, 1 at the reader
      const S = w * (0.009 + near * 0.026) * rr(r, 0.85, 1.15)
      s += `<g transform="translate(${fx(PX(pageFX(radial, side)))} ${fx(PY(pageFY(z)))}) rotate(${fx(rr(r, -60, 60))})" opacity="${op((0.16 + near * 0.2) * rr(r, 0.85, 1.1))}">${miniRaven(S, ROOK.ink, ROOK.ink)}</g>`
    }
  }
  // a vignette so the spread sits in its gutter
  s += `<rect width="${w}" height="${h}" fill="url(#pageVig)"/>`
  s += `</g>`

  const defs =
    `<clipPath id="roadCut"><path d="${bandD}"/></clipPath>` +
    `<clipPath id="plazaCut"><path d="${PLAZA_D}"/></clipPath>` +
    // The plaza is paving, so it is never LIGHTER than the bare parchment around
    // it (eye-review r1 round 2: a parchLit core made it read as a pale sticker).
    // A faint walnut wash at the centre deepening toward the far arc keeps it a
    // hair darker than the ground everywhere, and the outward ramp is what
    // dissolves its far edge now that no kerb stroke draws it.
    `<radialGradient id="plazaShade" cx="0.5" cy="0.42" r="0.7">` +
    `<stop offset="0" stop-color="${WALNUT}" stop-opacity="0.05"/>` +
    `<stop offset="1" stop-color="${WALNUT}" stop-opacity="0.2"/></radialGradient>` +
    `<linearGradient id="pageHaze" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${ROOK.parchLit}" stop-opacity="0.8"/>` +
    `<stop offset="1" stop-color="${ROOK.parchLit}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="pageGutter" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${WALNUT}" stop-opacity="0"/>` +
    `<stop offset="0.5" stop-color="${WALNUT}" stop-opacity="0.32"/>` +
    `<stop offset="1" stop-color="${WALNUT}" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="pagePool" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${ROOK.amberLit}" stop-opacity="0.9"/>` +
    `<stop offset="0.32" stop-color="${ROOK.amber}" stop-opacity="0.6"/>` +
    `<stop offset="0.7" stop-color="${ROOK.amber}" stop-opacity="0.22"/>` +
    `<stop offset="1" stop-color="${ROOK.amber}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="roadShade" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${ROOK.ink}" stop-opacity="0.34"/>` +
    `<stop offset="1" stop-color="${ROOK.ink}" stop-opacity="0.05"/></linearGradient>` +
    `<radialGradient id="pageVig" cx="0.5" cy="0.55" r="0.75">` +
    `<stop offset="0.5" stop-color="${WALNUT}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${WALNUT}" stop-opacity="0.3"/></radialGradient>`

  return svgPiece(w, h, s, defs)
}

// ============================================================================
// E3 s2 — THE INN OF A HUNDRED KEYS stage set (scene pack 2026-07-25, register
// R3 THEATER-warm). Nightfall arrival: three width-graded gutter-spanning
// planes (sleeping mountain > lamplit inn row > open gate), the linked welcome
// rank, the key-sign + dormer + brass-key children on the inn row's crease,
// the fore wall re-cut as a key-baluster frieze, and the T-FLOOR page print
// (cobble fan / key trail / WELCOME mat / LIFT banner + manicule / geese).
// House rules as everywhere: standalone SVG on transparent ground (the ALPHA
// is the die-cut), pale raw-paper rim on every cut edge (rimPath), walnut ink
// linework, deterministic mulberry32 — no Math.random.
// ============================================================================

const INN = {
  sky: '#e8a978', // peach twilight
  skyDeep: '#c26a33', // deep horizon band
  slate: '#626e7d', // mountain slate
  slateDim: '#4a5563',
  snow: '#f3ecda',
  stoneLit: '#e3cd98',
  stoneMid: '#cbb078',
  stoneDim: '#a98a5c',
  // the dusk value ladder (E3 relight): gold can only BURN against walnut-
  // shaded stone, so the night facades drop to these instead of the day tones
  stoneDusk: '#8a6e45',
  stoneNight: '#6b5334',
  roofLit: '#d97e54', // terracotta
  roofDim: '#b0603f',
  lamp: '#f3d980',
  paneHot: '#fbe9a8', // the burning pane core
  brass: '#c9a227',
  green: '#6a8f5f', // courtyard green
}

/** A tiny brass key glyph (bow up, bit down) centered on (0,0), height S —
 *  shared by the sign, the frieze balusters and the page-print key trail. */
function keyGlyph(S, fill = GOLD, lit = GOLD_LIT) {
  const bowR = S * 0.21
  const shaftW = S * 0.13
  let s = `<circle cx="0" cy="${fx(-S * 0.29)}" r="${fx(bowR)}" fill="none" stroke="${fill}" stroke-width="${fx(shaftW)}"/>`
  s += `<rect x="${fx(-shaftW / 2)}" y="${fx(-S * 0.12)}" width="${fx(shaftW)}" height="${fx(S * 0.55)}" rx="${fx(shaftW * 0.3)}" fill="${fill}"/>`
  s += `<rect x="${fx(-shaftW / 2)}" y="${fx(S * 0.3)}" width="${fx(S * 0.2)}" height="${fx(S * 0.1)}" fill="${fill}"/>`
  s += `<rect x="${fx(-shaftW / 2)}" y="${fx(S * 0.16)}" width="${fx(S * 0.14)}" height="${fx(S * 0.08)}" fill="${fill}"/>`
  s += `<circle cx="${fx(-bowR * 0.3)}" cy="${fx(-S * 0.29 - bowR * 0.3)}" r="${fx(bowR * 0.24)}" fill="${lit}" opacity="0.8"/>`
  return s
}

/** A jittered "torn paper" horizontal edge from (x0,y0) to (x1,y1) — small
 *  seeded tears, returned as path points (no M/L prefix). */
function tornEdge(r, x0, y0, x1, y1, n, amp) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = lerp(x0, x1, t)
    const y = lerp(y0, y1, t) + (i === 0 || i === n ? 0 : rr(r, -amp, amp))
    pts.push(`${fx(x)} ${fx(y)}`)
  }
  return pts.join(' L ')
}

// ---- PLANE A — THE SLEEPING MOUNTAIN (ch1-mountain, 1.9 x 0.92 backdrop).
// A torn-paper sky sheet: peach twilight bands + star pricks, the slate
// mountain asleep under a snow crown (the asymmetry the solver took from the
// crease lives HERE, peak at u ~0.45), a row of tiny far rooftops at the
// base. Full-bleed sides/bottom; the torn crest is the only cut edge. ----
function mountainTwilight(w, h, seed) {
  const r = mulberry32(seed)
  // torn sky edge: high over the peak, dipping toward the fore edges
  const edge = `M 0 ${fx(h * 0.16)} L ${tornEdge(r, 0, h * 0.16, w * 0.45, h * 0.045, 26, h * 0.02)} L ${tornEdge(
    r, w * 0.45, h * 0.045, w, h * 0.13, 30, h * 0.02
  )} L ${w} ${fx(h * 0.13)}`
  const sheet = `${edge} L ${w} ${h} L 0 ${h} Z`
  let s = `<g><path d="${sheet}" fill="url(#s2sky)"/>`
  s += `<g clip-path="url(#s2skyCut)">`
  // deep horizon band + a second haze band
  s += `<rect x="0" y="${fx(h * 0.62)}" width="${w}" height="${fx(h * 0.16)}" fill="${INN.skyDeep}" opacity="0.5"/>`
  s += `<rect x="0" y="${fx(h * 0.5)}" width="${w}" height="${fx(h * 0.08)}" fill="${INN.skyDeep}" opacity="0.22"/>`
  // star pricks in the high sky
  for (let i = 0; i < 46; i++) {
    const x = rr(r, 0, w)
    const y = rr(r, h * 0.06, h * 0.46)
    s += `<circle cx="${fx(x)}" cy="${fx(y)}" r="${fx(rr(r, 0.8, 2))}" fill="${INN.snow}" opacity="${fx(rr(r, 0.35, 0.9))}"/>`
  }
  // one early bright star over the peak
  s += `<circle cx="${fx(w * 0.52)}" cy="${fx(h * 0.14)}" r="2.6" fill="#fff8e0"/>`
  s += `<path d="M ${fx(w * 0.52)} ${fx(h * 0.08)} L ${fx(w * 0.52)} ${fx(h * 0.2)} M ${fx(w * 0.5)} ${fx(h * 0.14)} L ${fx(w * 0.54)} ${fx(h * 0.14)}" stroke="#fff8e0" stroke-width="1.2" opacity="0.7"/>`
  // THE MOUNTAIN — slate mass, peak at x 0.45, long sleeping shoulders
  const mtn =
    `M 0 ${fx(h * 0.66)} L ${fx(w * 0.12)} ${fx(h * 0.52)} L ${fx(w * 0.24)} ${fx(h * 0.42)} ` +
    `L ${fx(w * 0.36)} ${fx(h * 0.24)} L ${fx(w * 0.45)} ${fx(h * 0.12)} L ${fx(w * 0.53)} ${fx(h * 0.26)} ` +
    `L ${fx(w * 0.62)} ${fx(h * 0.38)} L ${fx(w * 0.75)} ${fx(h * 0.34)} L ${fx(w * 0.86)} ${fx(h * 0.48)} ` +
    `L ${w} ${fx(h * 0.58)} L ${w} ${h} L 0 ${h} Z`
  s += `<path d="${mtn}" fill="${INN.slate}"/>`
  // shadowed east faces
  s += `<path d="M ${fx(w * 0.45)} ${fx(h * 0.12)} L ${fx(w * 0.53)} ${fx(h * 0.26)} L ${fx(w * 0.62)} ${fx(h * 0.38)} L ${fx(w * 0.6)} ${fx(h * 0.62)} L ${fx(w * 0.47)} ${fx(h * 0.5)} Z" fill="${INN.slateDim}" opacity="0.8"/>`
  s += `<path d="M ${fx(w * 0.75)} ${fx(h * 0.34)} L ${fx(w * 0.86)} ${fx(h * 0.48)} L ${fx(w * 0.83)} ${fx(h * 0.66)} L ${fx(w * 0.72)} ${fx(h * 0.52)} Z" fill="${INN.slateDim}" opacity="0.6"/>`
  // SNOW CROWN on the peak + a thin drift on the second shoulder
  s += `<path d="M ${fx(w * 0.38)} ${fx(h * 0.21)} L ${fx(w * 0.45)} ${fx(h * 0.12)} L ${fx(w * 0.52)} ${fx(h * 0.24)} L ${fx(w * 0.485)} ${fx(h * 0.23)} L ${fx(w * 0.465)} ${fx(h * 0.28)} L ${fx(w * 0.44)} ${fx(h * 0.24)} L ${fx(w * 0.415)} ${fx(h * 0.27)} Z" fill="${INN.snow}"/>`
  s += `<path d="M ${fx(w * 0.72)} ${fx(h * 0.37)} L ${fx(w * 0.75)} ${fx(h * 0.34)} L ${fx(w * 0.79)} ${fx(h * 0.38)} L ${fx(w * 0.755)} ${fx(h * 0.4)} Z" fill="${INN.snow}" opacity="0.85"/>`
  // faint ridge inks
  s += `<path d="M ${fx(w * 0.45)} ${fx(h * 0.12)} L ${fx(w * 0.42)} ${fx(h * 0.52)} M ${fx(w * 0.36)} ${fx(h * 0.24)} L ${fx(w * 0.3)} ${fx(h * 0.6)}" stroke="${INK}" stroke-width="1.4" opacity="0.25" fill="none"/>`
  // TINY FAR ROOFTOPS along the base — the stone city asleep under the peak
  const baseY = h * 0.88
  for (let i = 0; i < 15; i++) {
    const bx = (w * (i + rr(r, 0.1, 0.4))) / 15
    const bw = rr(r, w * 0.028, w * 0.05)
    const bh = rr(r, h * 0.05, h * 0.1)
    s += `<path d="M ${fx(bx)} ${fx(baseY)} L ${fx(bx)} ${fx(baseY - bh)} L ${fx(bx + bw / 2)} ${fx(baseY - bh - h * 0.035)} L ${fx(bx + bw)} ${fx(baseY - bh)} L ${fx(bx + bw)} ${fx(baseY)} Z" fill="${INK}" opacity="0.82"/>`
    if (r() < 0.6) s += `<rect x="${fx(bx + bw * 0.35)}" y="${fx(baseY - bh * 0.6)}" width="${fx(bw * 0.2)}" height="${fx(bh * 0.3)}" fill="${INN.lamp}" opacity="0.9"/>`
  }
  s += `<rect x="0" y="${fx(baseY)}" width="${w}" height="${fx(h - baseY)}" fill="${INK}" opacity="0.5"/>`
  s += `</g>`
  s += rimPath(sheet, 5)
  s += `</g>`
  const defs =
    `<clipPath id="s2skyCut"><path d="${sheet}"/></clipPath>` +
    `<linearGradient id="s2sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#b0603f"/>` +
    `<stop offset="0.42" stop-color="${INN.skyDeep}"/>` +
    `<stop offset="0.8" stop-color="${INN.sky}"/>` +
    `<stop offset="1" stop-color="${INN.sky}"/></linearGradient>`
  return svgPiece(w, h, s, defs)
}

// ---- PLANE B — THE LAMPLIT INN ROW (ch1-inn-row, 1.5 x 0.68 HERO). Full-
// span timber-and-stone facades astride the gutter: a central double-gable
// hall on the crease (art x = creaseU 0.58), flanking timber wings, ten gold
// windows, terracotta roofs, a chimney with the cut-paper smoke curl IN the
// outline, the "100" shield over the great door and the painted lock
// escutcheon low on the door (where the ch1-key child pops off the crease).
function innRowStage(w, h, seed) {
  const r = mulberry32(seed)
  const CX = w * 0.58 // the crease — the hall's centreline
  const ROOF_L = h * 0.34 // wing eaves line
  const GROUND = h
  // --- silhouette: left wing roof -> smoke chimney -> hall double gable ->
  // right chimney -> right wing roof. Built left-to-right as the cut edge.
  const smokeCx = w * 0.17
  const gA = CX - w * 0.115 // hall gable A peak x
  const gB = CX + w * 0.105
  const smoke =
    // chimney stack, then the curl: an S of paper smoke leaning right
    `L ${fx(smokeCx - w * 0.022)} ${fx(h * 0.245)} L ${fx(smokeCx - w * 0.022)} ${fx(h * 0.155)} ` +
    `C ${fx(smokeCx - w * 0.05)} ${fx(h * 0.1)} ${fx(smokeCx - w * 0.014)} ${fx(h * 0.03)} ${fx(smokeCx + w * 0.03)} ${fx(h * 0.048)} ` +
    `C ${fx(smokeCx + w * 0.055)} ${fx(h * 0.06)} ${fx(smokeCx + w * 0.052)} ${fx(h * 0.1)} ${fx(smokeCx + w * 0.028)} ${fx(h * 0.1)} ` +
    `C ${fx(smokeCx + w * 0.012)} ${fx(h * 0.098)} ${fx(smokeCx + w * 0.012)} ${fx(h * 0.075)} ${fx(smokeCx + w * 0.026)} ${fx(h * 0.07)} ` +
    `L ${fx(smokeCx + w * 0.022)} ${fx(h * 0.155)} L ${fx(smokeCx + w * 0.022)} ${fx(h * 0.235)}`
  const roofline =
    `M 0 ${fx(GROUND)} L 0 ${fx(h * 0.46)} ` +
    `L ${fx(w * 0.045)} ${fx(h * 0.43)} L ${fx(w * 0.1)} ${fx(ROOF_L)} ` + // left wing rise
    smoke +
    `L ${fx(w * 0.26)} ${fx(h * 0.305)} L ${fx(w * 0.34)} ${fx(h * 0.33)} ` + // wing ridge run
    `L ${fx(gA - w * 0.095)} ${fx(h * 0.30)} L ${fx(gA)} ${fx(h * 0.105)} L ${fx(gA + w * 0.083)} ${fx(h * 0.27)} ` + // gable A
    `L ${fx(gB - w * 0.08)} ${fx(h * 0.24)} L ${fx(gB)} ${fx(h * 0.07)} L ${fx(gB + w * 0.088)} ${fx(h * 0.28)} ` + // gable B (taller)
    `L ${fx(w * 0.78)} ${fx(h * 0.315)} ` +
    `L ${fx(w * 0.805)} ${fx(h * 0.19)} L ${fx(w * 0.845)} ${fx(h * 0.19)} L ${fx(w * 0.845)} ${fx(h * 0.315)} ` + // right chimney
    `L ${fx(w * 0.9)} ${fx(h * 0.36)} L ${fx(w * 0.955)} ${fx(h * 0.43)} L ${fx(w)} ${fx(h * 0.45)} ` + // right wing fall
    `L ${fx(w)} ${fx(GROUND)} Z`
  let s = `<g><path d="${roofline}" fill="${INN.stoneMid}"/>`
  s += `<g clip-path="url(#s2innCut)">`
  // night wash: the walls sit in dusk, warmer near the lamps below
  s += `<rect width="${w}" height="${h}" fill="url(#s2innDusk)"/>`
  // --- ROOFS: everything above each eaves line, terracotta with course lines
  const roofBand = (x0, x1, yEave) => {
    let out = `<path d="M ${fx(x0)} 0 L ${fx(x1)} 0 L ${fx(x1)} ${fx(yEave)} L ${fx(x0)} ${fx(yEave)} Z" fill="${INN.roofDim}"/>`
    for (let i = 1; i < 5; i++) {
      const y = (yEave * i) / 5
      out += `<line x1="${fx(x0)}" y1="${fx(y)}" x2="${fx(x1)}" y2="${fx(y)}" stroke="${INK}" stroke-width="1.6" opacity="0.3"/>`
    }
    return out
  }
  s += roofBand(0, gA - w * 0.095, h * 0.40)
  s += roofBand(gB + w * 0.088, w, h * 0.42)
  // hall gables get LIT terracotta (they catch the last light + the lamps)
  s += `<path d="M ${fx(gA - w * 0.095)} ${fx(h * 0.5)} L ${fx(gA - w * 0.095)} ${fx(h * 0.3)} L ${fx(gA)} ${fx(h * 0.105)} L ${fx(gA + w * 0.083)} ${fx(h * 0.27)} L ${fx(gB - w * 0.08)} ${fx(h * 0.24)} L ${fx(gB)} ${fx(h * 0.07)} L ${fx(gB + w * 0.088)} ${fx(h * 0.28)} L ${fx(gB + w * 0.088)} ${fx(h * 0.5)} Z" fill="${INN.roofLit}"/>`
  s += `<path d="M ${fx(gA)} ${fx(h * 0.105)} L ${fx(gA + w * 0.083)} ${fx(h * 0.27)} L ${fx(gA + w * 0.024)} ${fx(h * 0.44)} L ${fx(gA - w * 0.024)} ${fx(h * 0.3)} Z" fill="${INN.roofDim}" opacity="0.55"/>`
  // eaves shadow under the hall roofs so the gables sit ON the wall face
  s += `<path d="M ${fx(gA - w * 0.095)} ${fx(h * 0.335)} L ${fx(gA)} ${fx(h * 0.14)} L ${fx(gA + w * 0.083)} ${fx(h * 0.305)} L ${fx(gB - w * 0.08)} ${fx(h * 0.275)} L ${fx(gB)} ${fx(h * 0.105)} L ${fx(gB + w * 0.088)} ${fx(h * 0.315)}" fill="none" stroke="${INK}" stroke-width="5" opacity="0.35"/>`
  // gable ridge inks + finials
  s += `<path d="M ${fx(gA - w * 0.095)} ${fx(h * 0.3)} L ${fx(gA)} ${fx(h * 0.105)} L ${fx(gA + w * 0.083)} ${fx(h * 0.27)} M ${fx(gB - w * 0.08)} ${fx(h * 0.24)} L ${fx(gB)} ${fx(h * 0.07)} L ${fx(gB + w * 0.088)} ${fx(h * 0.28)}" fill="none" stroke="${INK}" stroke-width="2.2" opacity="0.55"/>`
  s += `<circle cx="${fx(gA)}" cy="${fx(h * 0.105)}" r="3.2" fill="${GOLD}"/>`
  s += `<circle cx="${fx(gB)}" cy="${fx(h * 0.07)}" r="3.6" fill="${GOLD}"/>`
  // --- WALL BODIES below the eaves: dusk-shaded stone (the relight law —
  // walls drop to the walnut end of the ladder so the windows BURN), the
  // hall face a half-step lighter than the wings for hierarchy
  s += `<rect x="0" y="${fx(h * 0.40)}" width="${fx(gA - w * 0.095)}" height="${fx(h * 0.6)}" fill="${INN.stoneDusk}"/>`
  s += `<rect x="${fx(gB + w * 0.088)}" y="${fx(h * 0.42)}" width="${fx(w - gB - w * 0.088)}" height="${fx(h * 0.58)}" fill="${INN.stoneDusk}"/>`
  s += `<rect x="${fx(gA - w * 0.095)}" y="${fx(h * 0.27)}" width="${fx(gB - gA + w * 0.183)}" height="${fx(h * 0.73)}" fill="${INN.stoneDim}"/>`
  // stone base course across everything
  s += `<rect x="0" y="${fx(h * 0.84)}" width="${w}" height="${fx(h * 0.16)}" fill="${INN.stoneNight}"/>`
  for (let i = 0; i < 30; i++) {
    const jx = (w * (i + 0.5)) / 30
    s += `<line x1="${fx(jx)}" y1="${fx(h * 0.84)}" x2="${fx(jx + rr(r, -4, 4))}" y2="${fx(h)}" stroke="${INK}" stroke-width="1.3" opacity="0.22"/>`
  }
  s += `<line x1="0" y1="${fx(h * 0.84)}" x2="${w}" y2="${fx(h * 0.84)}" stroke="${INK}" stroke-width="2" opacity="0.4"/>`
  // --- TIMBER FRAME on the wings (walnut beams + diagonal braces)
  const timber = (x0, x1, y0) => {
    let out = ''
    out += `<line x1="${fx(x0)}" y1="${fx(y0 + h * 0.18)}" x2="${fx(x1)}" y2="${fx(y0 + h * 0.18)}" stroke="${INK}" stroke-width="4" opacity="0.75"/>`
    const bays = Math.max(2, Math.round((x1 - x0) / (w * 0.075)))
    for (let b = 0; b <= bays; b++) {
      const bx = lerp(x0, x1, b / bays)
      out += `<line x1="${fx(bx)}" y1="${fx(y0)}" x2="${fx(bx)}" y2="${fx(h * 0.84)}" stroke="${INK}" stroke-width="3.4" opacity="0.7"/>`
      if (b < bays && b % 2 === 0)
        out += `<line x1="${fx(bx)}" y1="${fx(y0 + h * 0.18)}" x2="${fx(lerp(x0, x1, (b + 1) / bays))}" y2="${fx(y0 + h * 0.42)}" stroke="${INK}" stroke-width="2.6" opacity="0.55"/>`
    }
    return out
  }
  s += timber(w * 0.012, gA - w * 0.075, h * 0.42)
  s += timber(gB + w * 0.075, w * 0.99, h * 0.44)
  // --- WINDOWS: ten golden lights (glow halo painted, frame walnut)
  const win = (x, y, ww, wh, arched = false) => {
    // the burn: a wide gold wash on the wall, then a hot pane over it
    let out = `<ellipse cx="${fx(x + ww / 2)}" cy="${fx(y + wh / 2)}" rx="${fx(ww * 2.4)}" ry="${fx(wh * 1.9)}" fill="url(#s2winGlow)"/>`
    const shape = arched
      ? `M ${fx(x)} ${fx(y + wh)} L ${fx(x)} ${fx(y + wh * 0.34)} Q ${fx(x + ww / 2)} ${fx(y - wh * 0.16)} ${fx(x + ww)} ${fx(y + wh * 0.34)} L ${fx(x + ww)} ${fx(y + wh)} Z`
      : `M ${fx(x)} ${fx(y)} L ${fx(x + ww)} ${fx(y)} L ${fx(x + ww)} ${fx(y + wh)} L ${fx(x)} ${fx(y + wh)} Z`
    out += `<path d="${shape}" fill="${INN.paneHot}" stroke="${INK}" stroke-width="2.6"/>`
    out += `<line x1="${fx(x + ww / 2)}" y1="${fx(y)}" x2="${fx(x + ww / 2)}" y2="${fx(y + wh)}" stroke="${INK}" stroke-width="1.5" opacity="0.85"/>`
    out += `<line x1="${fx(x)}" y1="${fx(y + wh * 0.5)}" x2="${fx(x + ww)}" y2="${fx(y + wh * 0.5)}" stroke="${INK}" stroke-width="1.5" opacity="0.85"/>`
    return out
  }
  const WW = w * 0.036
  const WH = h * 0.115
  // wings: two pairs each
  s += win(w * 0.06, h * 0.52, WW, WH) + win(w * 0.135, h * 0.52, WW, WH)
  s += win(w * 0.24, h * 0.5, WW, WH) + win(w * 0.315, h * 0.5, WW, WH)
  s += win(w * 0.845, h * 0.52, WW, WH) + win(w * 0.92, h * 0.52, WW, WH)
  // hall: gable lights + a pair flanking the door
  s += win(gA - WW / 2, h * 0.36, WW, WH, true)
  s += win(gB - WW / 2, h * 0.31, WW, WH, true)
  s += win(CX - w * 0.075, h * 0.56, WW, WH) + win(CX + w * 0.075 - WW, h * 0.56, WW, WH)
  // --- THE GREAT DOOR astride the crease: arched double door, warm spill
  const dw = w * 0.062
  const dh = h * 0.30
  const dx = CX - dw / 2
  const dy = h - dh
  s += `<ellipse cx="${fx(CX)}" cy="${fx(h * 0.97)}" rx="${fx(dw * 1.9)}" ry="${fx(h * 0.06)}" fill="${INN.lamp}" opacity="0.6"/>`
  s += `<path d="M ${fx(dx - 5)} ${fx(h)} L ${fx(dx - 5)} ${fx(dy + dh * 0.22)} Q ${fx(CX)} ${fx(dy - dh * 0.18)} ${fx(dx + dw + 5)} ${fx(dy + dh * 0.22)} L ${fx(dx + dw + 5)} ${fx(h)} Z" fill="${INN.stoneDim}"/>`
  s += `<path d="M ${fx(dx)} ${fx(h)} L ${fx(dx)} ${fx(dy + dh * 0.24)} Q ${fx(CX)} ${fx(dy - dh * 0.1)} ${fx(dx + dw)} ${fx(dy + dh * 0.24)} L ${fx(dx + dw)} ${fx(h)} Z" fill="#4a3218"/>`
  s += `<line x1="${fx(CX)}" y1="${fx(dy)}" x2="${fx(CX)}" y2="${fx(h)}" stroke="${INK}" stroke-width="2" opacity="0.8"/>`
  for (const off of [-dw * 0.3, dw * 0.3])
    for (let k = 0; k < 3; k++)
      s += `<circle cx="${fx(CX + off)}" cy="${fx(dy + dh * (0.3 + k * 0.22))}" r="1.8" fill="${GOLD_DIM}"/>`
  // the painted LOCK ESCUTCHEON, low on the crease — the ch1-key child pops here
  s += `<circle cx="${fx(CX)}" cy="${fx(h * 0.86)}" r="${fx(w * 0.017)}" fill="#4a3218" stroke="${GOLD}" stroke-width="3"/>`
  s += `<path d="M ${fx(CX)} ${fx(h * 0.85)} a ${fx(w * 0.004)} ${fx(w * 0.004)} 0 1 1 0.1 0 M ${fx(CX)} ${fx(h * 0.853)} L ${fx(CX)} ${fx(h * 0.872)}" stroke="${GOLD_LIT}" stroke-width="2.4" fill="none"/>`
  // the "100" SHIELD — WHOLLY on the right panel (creaseU 0.58 splits the
  // art across the real dihedral; numerals straddling u 0.58 would kink at
  // the fold, so the shield hangs beside the door, not over it), engraved
  // font-free from ENGRAVE_GLYPHS (no installed-typeface dependency).
  const shX = CX + w * 0.08
  const shY = dy - h * 0.14
  s += `<path d="M ${fx(shX - w * 0.028)} ${fx(shY)} L ${fx(shX + w * 0.028)} ${fx(shY)} L ${fx(shX + w * 0.028)} ${fx(shY + h * 0.085)} Q ${fx(shX)} ${fx(shY + h * 0.122)} ${fx(shX - w * 0.028)} ${fx(shY + h * 0.085)} Z" fill="${PARCH}" stroke="${INK}" stroke-width="2.4"/>`
  s += engraveWord('100', shX - w * 0.0205, shY + h * 0.022, w * 0.0115, h * 0.05, w * 0.0035, INK, 3)
  // lamp brackets flanking the door — real burning lanterns now
  for (const lx of [dx - w * 0.02, dx + dw + w * 0.02]) {
    s += `<circle cx="${fx(lx)}" cy="${fx(h * 0.72)}" r="${fx(w * 0.022)}" fill="url(#s2winGlow)"/>`
    s += `<circle cx="${fx(lx)}" cy="${fx(h * 0.72)}" r="${fx(w * 0.0062)}" fill="${INN.paneHot}" stroke="${INK}" stroke-width="1.8"/>`
    s += `<line x1="${fx(lx)}" y1="${fx(h * 0.685)}" x2="${fx(lx)}" y2="${fx(h * 0.665)}" stroke="${INK}" stroke-width="2" opacity="0.8"/>`
  }
  // chimney pots + smoke shading (the curl is already cut in the outline)
  s += `<rect x="${fx(smokeCx - w * 0.022)}" y="${fx(h * 0.155)}" width="${fx(w * 0.044)}" height="${fx(h * 0.09)}" fill="${INN.roofDim}" stroke="${INK}" stroke-width="1.8"/>`
  s += `<path d="M ${fx(smokeCx - w * 0.02)} ${fx(h * 0.14)} C ${fx(smokeCx - w * 0.045)} ${fx(h * 0.095)} ${fx(smokeCx - w * 0.012)} ${fx(h * 0.038)} ${fx(smokeCx + w * 0.028)} ${fx(h * 0.052)}" fill="none" stroke="${INN.snow}" stroke-width="7" opacity="0.9" stroke-linecap="round"/>`
  s += `<rect x="${fx(w * 0.805)}" y="${fx(h * 0.19)}" width="${fx(w * 0.04)}" height="${fx(h * 0.04)}" fill="${INN.roofDim}" stroke="${INK}" stroke-width="1.6"/>`
  s += `</g>`
  s += rimPath(roofline, 5)
  s += `</g>`
  const defs =
    `<clipPath id="s2innCut"><path d="${roofline}"/></clipPath>` +
    `<linearGradient id="s2innDusk" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${INK}" stop-opacity="0.4"/>` +
    `<stop offset="0.55" stop-color="${INK}" stop-opacity="0.16"/>` +
    `<stop offset="1" stop-color="${INN.skyDeep}" stop-opacity="0.08"/></linearGradient>` +
    `<radialGradient id="s2winGlow" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${INN.lamp}" stop-opacity="0.8"/>` +
    `<stop offset="0.55" stop-color="${INN.lamp}" stop-opacity="0.3"/>` +
    `<stop offset="1" stop-color="${INN.lamp}" stop-opacity="0"/></radialGradient>`
  return svgPiece(w, h, s, defs)
}

// ---- PLANE C — THE OPEN GATE (ch1-gate, 0.76 x 0.42). Two stone gateposts
// with lit lanterns + moth halos, low swung-open timber gate leaves running
// to the outer edges, and the key-bunting swag as the outline's central dip
// (v ~0.45, so plane B's windows burn through above it). Single closed ring.
function gateOpen(w, h, seed) {
  const r = mulberry32(seed)
  const pL = w * 0.315 // post centrelines
  const pR = w * 0.685
  const PW = w * 0.052
  const swagY = h * 0.55 // image-y of the swag's lowest point (v 0.45)
  const postTop = h * 0.045
  const capY = h * 0.16
  const gateTop = h * 0.5
  // silhouette: left leaf -> left post (lantern head) -> swag dip -> right post -> right leaf
  const outline =
    `M 0 ${fx(h)} L 0 ${fx(h * 0.56)} ` +
    `L ${fx(w * 0.06)} ${fx(h * 0.54)} L ${fx(w * 0.13)} ${fx(gateTop)} L ${fx(pL - PW)} ${fx(h * 0.52)} ` + // left leaf top
    `L ${fx(pL - PW)} ${fx(capY)} L ${fx(pL - PW * 1.5)} ${fx(capY)} L ${fx(pL - PW * 0.62)} ${fx(postTop + h * 0.03)} ` + // cap lip
    `L ${fx(pL)} ${fx(postTop)} L ${fx(pL + PW * 0.62)} ${fx(postTop + h * 0.03)} L ${fx(pL + PW * 1.5)} ${fx(capY)} L ${fx(pL + PW)} ${fx(capY)} ` +
    `C ${fx(w * 0.42)} ${fx(swagY)} ${fx(w * 0.58)} ${fx(swagY)} ${fx(pR - PW)} ${fx(capY)} ` + // the swag dip
    `L ${fx(pR - PW * 1.5)} ${fx(capY)} L ${fx(pR - PW * 0.62)} ${fx(postTop + h * 0.03)} L ${fx(pR)} ${fx(postTop)} ` +
    `L ${fx(pR + PW * 0.62)} ${fx(postTop + h * 0.03)} L ${fx(pR + PW * 1.5)} ${fx(capY)} L ${fx(pR + PW)} ${fx(capY)} ` +
    `L ${fx(pR + PW)} ${fx(h * 0.52)} L ${fx(w * 0.87)} ${fx(gateTop)} L ${fx(w * 0.94)} ${fx(h * 0.54)} L ${fx(w)} ${fx(h * 0.56)} ` + // right leaf
    `L ${fx(w)} ${fx(h)} Z`
  let s = `<g><path d="${outline}" fill="${INN.stoneDusk}"/>`
  s += `<g clip-path="url(#s2gateCut)">`
  // dusk falls on the whole gate before anything burns
  s += `<rect width="${w}" height="${h}" fill="${INK}" opacity="0.14"/>`
  // moth-glow halos around the lantern heads FIRST (under everything)
  for (const px of [pL, pR]) {
    s += `<circle cx="${fx(px)}" cy="${fx(h * 0.1)}" r="${fx(w * 0.115)}" fill="url(#s2winGlow2)"/>`
    for (let m = 0; m < 5; m++) {
      const a = rr(r, 0, Math.PI * 2)
      const rad = rr(r, w * 0.03, w * 0.07)
      s += `<path d="M ${fx(px + Math.cos(a) * rad)} ${fx(h * 0.1 + Math.sin(a) * rad * 0.9)} l 3 -2 l -1.6 3 Z" fill="${INK}" opacity="0.55"/>` // moths
    }
  }
  // POSTS: coursed dusk stone, warmer inner faces (the lamplight between them)
  for (const px of [pL, pR]) {
    s += `<rect x="${fx(px - PW)}" y="${fx(capY)}" width="${fx(PW * 2)}" height="${fx(h - capY)}" fill="${INN.stoneDusk}"/>`
    const inner = px === pL ? px : px - PW
    s += `<rect x="${fx(inner)}" y="${fx(capY)}" width="${fx(PW)}" height="${fx(h - capY)}" fill="${INN.stoneDim}"/>`
    for (let c = 1; c < 6; c++) {
      const cy = capY + ((h - capY) * c) / 6
      s += `<line x1="${fx(px - PW)}" y1="${fx(cy)}" x2="${fx(px + PW)}" y2="${fx(cy)}" stroke="${INK}" stroke-width="1.8" opacity="0.4"/>`
      s += `<line x1="${fx(px + (c % 2 ? -PW * 0.3 : PW * 0.3))}" y1="${fx(cy)}" x2="${fx(px + (c % 2 ? -PW * 0.3 : PW * 0.3))}" y2="${fx(cy - (h - capY) / 6)}" stroke="${INK}" stroke-width="1.4" opacity="0.3"/>`
    }
    // cap + LANTERN head: iron cage, gold light
    s += `<rect x="${fx(px - PW * 1.5)}" y="${fx(capY - h * 0.012)}" width="${fx(PW * 3)}" height="${fx(h * 0.03)}" fill="${INN.stoneDim}" stroke="${INK}" stroke-width="1.8"/>`
    s += `<rect x="${fx(px - PW * 0.52)}" y="${fx(postTop + h * 0.035)}" width="${fx(PW * 1.04)}" height="${fx(h * 0.085)}" fill="${INN.paneHot}" stroke="${IRON}" stroke-width="3"/>`
    s += `<line x1="${fx(px)}" y1="${fx(postTop + h * 0.035)}" x2="${fx(px)}" y2="${fx(postTop + h * 0.12)}" stroke="${IRON}" stroke-width="2" opacity="0.85"/>`
    s += `<path d="M ${fx(px - PW * 0.62)} ${fx(postTop + h * 0.033)} L ${fx(px)} ${fx(postTop - h * 0.002)} L ${fx(px + PW * 0.62)} ${fx(postTop + h * 0.033)} Z" fill="${IRON}"/>`
  }
  // THE KEY-BUNTING SWAG: rope + hanging key pennants painted ON the dip band
  const swag = (t) => {
    const mt = 1 - t
    const x = mt * mt * mt * (pL + PW) + 3 * mt * mt * t * (w * 0.42) + 3 * mt * t * t * (w * 0.58) + t * t * t * (pR - PW)
    const y = mt * mt * mt * capY + 3 * mt * mt * t * swagY + 3 * mt * t * t * swagY + t * t * t * capY
    return [x, y]
  }
  s += `<path d="M ${fx(pL + PW)} ${fx(capY)} C ${fx(w * 0.42)} ${fx(swagY)} ${fx(w * 0.58)} ${fx(swagY)} ${fx(pR - PW)} ${fx(capY)}" fill="none" stroke="${LEATHER}" stroke-width="4"/>`
  for (let k = 1; k < 8; k++) {
    const [kx, ky] = swag(k / 8)
    s += `<g transform="translate(${fx(kx)} ${fx(ky + h * 0.052)}) rotate(${fx(rr(r, -10, 10))})">${keyGlyph(h * 0.09)}</g>`
    s += `<line x1="${fx(kx)}" y1="${fx(ky)}" x2="${fx(kx)}" y2="${fx(ky + h * 0.022)}" stroke="${LEATHER}" stroke-width="1.6"/>`
  }
  // stone coursing + a lamplight wash on the central span (the low wall the
  // key-bunting hangs over — B's burning windows read ABOVE its crest)
  s += `<rect x="${fx(pL + PW)}" y="${fx(swagY)}" width="${fx(pR - pL - 2 * PW)}" height="${fx(h - swagY)}" fill="url(#s2winGlow2)" opacity="0.5"/>`
  for (let c = 0; c < 4; c++) {
    const cy = swagY + ((h - swagY) * (c + 1)) / 5
    s += `<line x1="${fx(pL + PW)}" y1="${fx(cy)}" x2="${fx(pR - PW)}" y2="${fx(cy)}" stroke="${INK}" stroke-width="1.6" opacity="0.3"/>`
    for (let b = 0; b < 7; b++) {
      const jx = pL + PW + ((pR - pL - 2 * PW) * (b + (c % 2 ? 0.5 : 0))) / 7
      s += `<line x1="${fx(jx)}" y1="${fx(cy)}" x2="${fx(jx)}" y2="${fx(cy - (h - swagY) / 5)}" stroke="${INK}" stroke-width="1.2" opacity="0.2"/>`
    }
  }
  // GATE LEAVES: low planked timber swung open to the outer edges (top edges
  // track the outline cut so no bare stone shows above the wood)
  const leaf = (x0, x1, topAtEdge, topAtHinge) => {
    let out = `<path d="M ${fx(x0)} ${fx(h)} L ${fx(x0)} ${fx(topAtEdge)} L ${fx(x1)} ${fx(topAtHinge)} L ${fx(x1)} ${fx(h)} Z" fill="${WOOD_LIT}"/>`
    const planks = 5
    for (let p = 1; p < planks; p++) {
      const px2 = lerp(x0, x1, p / planks)
      const py2 = lerp(topAtEdge, topAtHinge, p / planks)
      out += `<line x1="${fx(px2)}" y1="${fx(py2 + 3)}" x2="${fx(px2)}" y2="${fx(h)}" stroke="${WOOD_DK}" stroke-width="3" opacity="0.85"/>`
    }
    out += `<path d="M ${fx(x0)} ${fx(lerp(topAtEdge, h, 0.26))} L ${fx(x1)} ${fx(lerp(topAtHinge, h, 0.26))} M ${fx(x0)} ${fx(lerp(topAtEdge, h, 0.7))} L ${fx(x1)} ${fx(lerp(topAtHinge, h, 0.7))}" stroke="${IRON}" stroke-width="5"/>`
    out += `<path d="M ${fx(x0)} ${fx(lerp(topAtEdge, h, 0.26))} L ${fx(x1)} ${fx(lerp(topAtHinge, h, 0.7))}" stroke="${IRON}" stroke-width="3.4" opacity="0.8"/>` // diagonal brace
    for (const t of [0.26, 0.7])
      out += `<circle cx="${fx(lerp(x0, x1, 0.5))}" cy="${fx(lerp(lerp(topAtEdge, h, t), lerp(topAtHinge, h, t), 0.5))}" r="2.4" fill="${IRON_LIT}"/>`
    return out
  }
  s += leaf(0, pL - PW, h * 0.545, h * 0.505)
  s += leaf(pR + PW, w, h * 0.505, h * 0.545) // mirrored: hinge at the post side
  // ground cobble hints
  for (let i = 0; i < 14; i++) {
    const gx = rr(r, 0, w)
    s += `<ellipse cx="${fx(gx)}" cy="${fx(rr(r, h * 0.93, h * 0.99))}" rx="${fx(rr(r, 6, 12))}" ry="${fx(rr(r, 3, 5))}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.3"/>`
  }
  s += `</g>`
  s += rimPath(outline, 5)
  s += `</g>`
  const defs =
    `<clipPath id="s2gateCut"><path d="${outline}"/></clipPath>` +
    `<radialGradient id="s2winGlow2" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${INN.lamp}" stop-opacity="0.85"/>` +
    `<stop offset="0.55" stop-color="${INN.lamp}" stop-opacity="0.32"/>` +
    `<stop offset="1" stop-color="${INN.lamp}" stop-opacity="0"/></radialGradient>`
  return svgPiece(w, h, s, defs)
}

// ---- THE WELCOME RANK (ch1-rank, stripflap 0.34 x 0.21): innkeeper with a
// raised lantern, spouse with the enchanted ledger, a waving child and the
// dog — ONE die-cut chain. E3 recut per eye-test: the figures join through
// WIDE hand-bridges at arm level (flat segments, never notching back to the
// base — the ravenChainTop rule), the valleys under the bridges are painted
// walnut shadow so the four bodies read while staying one piece, garments
// vary (brick / green / gold smock / brown dog), and the ground strip is
// night cobbles, not grass — the family stands in a paved courtyard. ----
function welcomeRank(w, h, seed) {
  const r = mulberry32(seed)
  const G = h * 0.88 // ground line (the strip below is the die's base)
  // figure stations (centre x, half-width, head top y)
  const F = {
    keeper: { x: w * 0.17, hw: w * 0.075, top: h * 0.17 },
    spouse: { x: w * 0.41, hw: w * 0.07, top: h * 0.25 },
    child: { x: w * 0.62, hw: w * 0.052, top: h * 0.46 },
    dog: { x: w * 0.82, hw: w * 0.055, top: h * 0.6 },
  }
  const lantX = w * 0.05
  const lantY = h * 0.15
  // hand-bridge levels (top edge of the joining material — SHALLOW)
  const B_KS = h * 0.52 // keeper <-> spouse
  const B_SC = h * 0.56 // spouse <-> child
  const B_CD = h * 0.7 // child <-> dog
  // ONE closed silhouette: ground strip + bodies + WIDE linked-arm bridges
  const outline =
    `M 0 ${fx(h)} L 0 ${fx(G - h * 0.02)} ` +
    `L ${fx(F.keeper.x - F.keeper.hw)} ${fx(G - h * 0.4)} ` +
    // the lantern arm up-left, and the lantern head in the cut
    `L ${fx(lantX + w * 0.03)} ${fx(lantY + h * 0.1)} L ${fx(lantX - w * 0.022)} ${fx(lantY + h * 0.06)} ` +
    `L ${fx(lantX - w * 0.022)} ${fx(lantY - h * 0.1)} L ${fx(lantX + w * 0.022)} ${fx(lantY - h * 0.1)} ` +
    `L ${fx(lantX + w * 0.022)} ${fx(lantY - h * 0.02)} L ${fx(lantX + w * 0.05)} ${fx(lantY + h * 0.04)} ` +
    `L ${fx(F.keeper.x - F.keeper.hw * 0.4)} ${fx(F.keeper.top + h * 0.15)} ` +
    `L ${fx(F.keeper.x - F.keeper.hw * 0.45)} ${fx(F.keeper.top + h * 0.1)} ` +
    `A ${fx(F.keeper.hw * 0.62)} ${fx(F.keeper.hw * 0.62)} 0 1 1 ${fx(F.keeper.x + F.keeper.hw * 0.45)} ${fx(F.keeper.top + h * 0.1)} ` +
    `L ${fx(F.keeper.x + F.keeper.hw)} ${fx(F.keeper.top + h * 0.28)} ` +
    // WIDE bridge to the spouse: down to arm level, flat across, back up
    `L ${fx(F.keeper.x + F.keeper.hw * 1.1)} ${fx(B_KS)} L ${fx(F.spouse.x - F.spouse.hw * 1.1)} ${fx(B_KS)} ` +
    `L ${fx(F.spouse.x - F.spouse.hw)} ${fx(F.spouse.top + h * 0.26)} ` +
    `L ${fx(F.spouse.x - F.spouse.hw * 0.45)} ${fx(F.spouse.top + h * 0.1)} ` +
    `A ${fx(F.spouse.hw * 0.6)} ${fx(F.spouse.hw * 0.6)} 0 1 1 ${fx(F.spouse.x + F.spouse.hw * 0.45)} ${fx(F.spouse.top + h * 0.1)} ` +
    `L ${fx(F.spouse.x + F.spouse.hw)} ${fx(F.spouse.top + h * 0.3)} ` +
    // WIDE bridge to the child
    `L ${fx(F.spouse.x + F.spouse.hw * 1.15)} ${fx(B_SC)} L ${fx(F.child.x - F.child.hw * 1.5)} ${fx(B_SC)} ` +
    // the child's waving arm shoots up out of the bridge
    `L ${fx(F.child.x - F.child.hw * 0.3)} ${fx(F.child.top - h * 0.13)} L ${fx(F.child.x + F.child.hw * 0.3)} ${fx(F.child.top - h * 0.17)} ` +
    `L ${fx(F.child.x + F.child.hw * 0.16)} ${fx(F.child.top + h * 0.01)} ` +
    `A ${fx(F.child.hw * 0.6)} ${fx(F.child.hw * 0.6)} 0 1 1 ${fx(F.child.x + F.child.hw * 0.85)} ${fx(F.child.top + h * 0.14)} ` +
    // WIDE bridge to the dog (the child's hand rests on its head)
    `L ${fx(F.child.x + F.child.hw * 1.2)} ${fx(B_CD)} L ${fx(F.dog.x - F.dog.hw * 1.15)} ${fx(B_CD)} ` +
    `L ${fx(F.dog.x - F.dog.hw * 0.2)} ${fx(F.dog.top - h * 0.09)} L ${fx(F.dog.x + F.dog.hw * 0.4)} ${fx(F.dog.top)} ` + // ears up
    `L ${fx(F.dog.x + F.dog.hw)} ${fx(F.dog.top + h * 0.13)} ` +
    `L ${fx(F.dog.x + F.dog.hw * 1.5)} ${fx(G - h * 0.26)} L ${fx(F.dog.x + F.dog.hw * 1.7)} ${fx(G - h * 0.33)} ` + // tail up
    `L ${fx(F.dog.x + F.dog.hw * 2)} ${fx(G - h * 0.27)} L ${fx(F.dog.x + F.dog.hw * 1.8)} ${fx(G - h * 0.1)} ` +
    `L ${fx(w * 0.97)} ${fx(G - h * 0.03)} L ${fx(w)} ${fx(G - h * 0.01)} L ${fx(w)} ${fx(h)} Z`
  let s = `<g><path d="${outline}" fill="${INN.roofDim}"/>`
  s += `<g clip-path="url(#s2rankCut)">`
  // lantern glow FIRST — the family is lit from the keeper's raised lamp
  s += `<circle cx="${fx(lantX)}" cy="${fx(lantY)}" r="${fx(w * 0.17)}" fill="url(#s2winGlow3)"/>`
  // NIGHT COBBLE ground strip (the courtyard, not grass)
  s += `<rect x="0" y="${fx(G - h * 0.04)}" width="${w}" height="${fx(h * 0.18)}" fill="${INN.stoneNight}"/>`
  for (let i = 0; i < 20; i++) {
    const gx2 = rr(r, 0, w)
    s += `<ellipse cx="${fx(gx2)}" cy="${fx(rr(r, G, h * 0.99))}" rx="${fx(rr(r, 8, 15))}" ry="${fx(rr(r, 3.4, 5.6))}" fill="${INN.stoneDusk}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.5" opacity="0.8"/>`
  }
  // painted WALNUT VALLEYS below the hand-bridges: the figures separate to
  // the eye while the paper stays one chain
  const valley = (x0, x1, yTop) =>
    `<path d="M ${fx(x0)} ${fx(yTop + h * 0.055)} Q ${fx((x0 + x1) / 2)} ${fx(yTop + h * 0.02)} ${fx(x1)} ${fx(yTop + h * 0.055)} L ${fx(x1)} ${fx(G)} L ${fx(x0)} ${fx(G)} Z" fill="${INK}" opacity="0.55"/>`
  s += valley(F.keeper.x + F.keeper.hw * 1.02, F.spouse.x - F.spouse.hw * 1.02, B_KS)
  s += valley(F.spouse.x + F.spouse.hw * 1.05, F.child.x - F.child.hw * 1.4, B_SC)
  s += valley(F.child.x + F.child.hw * 1.1, F.dog.x - F.dog.hw * 1.05, B_CD)
  // THE INNKEEPER: brick coat, parchment apron, warm face, the lantern arm
  const K = F.keeper
  s += `<rect x="${fx(K.x - K.hw)}" y="${fx(K.top + h * 0.22)}" width="${fx(K.hw * 2)}" height="${fx(G - K.top - h * 0.22)}" fill="${INN.roofDim}"/>`
  s += `<path d="M ${fx(K.x - K.hw * 0.55)} ${fx(K.top + h * 0.32)} L ${fx(K.x + K.hw * 0.55)} ${fx(K.top + h * 0.32)} L ${fx(K.x + K.hw * 0.4)} ${fx(G - h * 0.02)} L ${fx(K.x - K.hw * 0.4)} ${fx(G - h * 0.02)} Z" fill="${PARCH_MID}"/>` // apron
  s += `<line x1="${fx(K.x - K.hw * 0.4)}" y1="${fx(G - h * 0.1)}" x2="${fx(K.x + K.hw * 0.4)}" y2="${fx(G - h * 0.1)}" stroke="${LEATHER}" stroke-width="1.8" opacity="0.6"/>` // hem
  s += `<circle cx="${fx(K.x)}" cy="${fx(K.top + h * 0.09)}" r="${fx(K.hw * 0.58)}" fill="#e8c49a"/>`
  s += `<path d="M ${fx(K.x - K.hw * 0.58)} ${fx(K.top + h * 0.06)} A ${fx(K.hw * 0.62)} ${fx(K.hw * 0.62)} 0 0 1 ${fx(K.x + K.hw * 0.58)} ${fx(K.top + h * 0.06)} L ${fx(K.x + K.hw * 0.58)} ${fx(K.top + h * 0.02)} L ${fx(K.x - K.hw * 0.58)} ${fx(K.top + h * 0.02)} Z" fill="${LEATHER}"/>` // cap
  s += `<circle cx="${fx(K.x - K.hw * 0.18)}" cy="${fx(K.top + h * 0.08)}" r="1.6" fill="${INK}"/><circle cx="${fx(K.x + K.hw * 0.18)}" cy="${fx(K.top + h * 0.08)}" r="1.6" fill="${INK}"/>`
  s += `<path d="M ${fx(K.x - K.hw * 0.16)} ${fx(K.top + h * 0.15)} Q ${fx(K.x)} ${fx(K.top + h * 0.19)} ${fx(K.x + K.hw * 0.16)} ${fx(K.top + h * 0.15)}" stroke="${INK}" stroke-width="1.6" fill="none"/>` // smile
  // the raised arm + THE LANTERN (burning)
  s += `<path d="M ${fx(K.x - K.hw * 0.7)} ${fx(K.top + h * 0.34)} L ${fx(lantX + w * 0.02)} ${fx(lantY + h * 0.09)}" stroke="${INN.roofDim}" stroke-width="9" stroke-linecap="round"/>`
  s += `<rect x="${fx(lantX - w * 0.017)}" y="${fx(lantY - h * 0.08)}" width="${fx(w * 0.034)}" height="${fx(h * 0.13)}" fill="${INN.paneHot}" stroke="${IRON}" stroke-width="2.6"/>`
  s += `<line x1="${fx(lantX)}" y1="${fx(lantY - h * 0.08)}" x2="${fx(lantX)}" y2="${fx(lantY + h * 0.05)}" stroke="${IRON}" stroke-width="1.4" opacity="0.7"/>`
  s += `<path d="M ${fx(lantX - w * 0.017)} ${fx(lantY - h * 0.08)} L ${fx(lantX)} ${fx(lantY - h * 0.1)} L ${fx(lantX + w * 0.017)} ${fx(lantY - h * 0.08)} Z" fill="${IRON}"/>`
  // THE LINKED ARMS painted over the bridges: keeper's sleeve meets the
  // spouse's, hands joined at the middle of each bridge
  const armBand = (x0, x1, yTop, c0, c1) => {
    const mid = (x0 + x1) / 2
    let out = `<path d="M ${fx(x0)} ${fx(yTop + h * 0.005)} L ${fx(mid)} ${fx(yTop + h * 0.03)}" stroke="${c0}" stroke-width="7.4" stroke-linecap="round" fill="none"/>`
    out += `<path d="M ${fx(x1)} ${fx(yTop + h * 0.005)} L ${fx(mid)} ${fx(yTop + h * 0.03)}" stroke="${c1}" stroke-width="7.4" stroke-linecap="round" fill="none"/>`
    out += `<circle cx="${fx(mid)}" cy="${fx(yTop + h * 0.03)}" r="4.2" fill="#e8c49a" stroke="${INK}" stroke-width="1"/>` // the held hands
    return out
  }
  s += armBand(F.keeper.x + F.keeper.hw * 0.6, F.spouse.x - F.spouse.hw * 0.6, B_KS, INN.roofDim, INN.green)
  s += armBand(F.spouse.x + F.spouse.hw * 0.6, F.child.x - F.child.hw * 0.7, B_SC, INN.green, '#c99b46')
  // THE SPOUSE: green gown, bun, the enchanted ledger held out
  const S2 = F.spouse
  s += `<path d="M ${fx(S2.x - S2.hw)} ${fx(G)} L ${fx(S2.x - S2.hw * 0.55)} ${fx(S2.top + h * 0.22)} L ${fx(S2.x + S2.hw * 0.55)} ${fx(S2.top + h * 0.22)} L ${fx(S2.x + S2.hw)} ${fx(G)} Z" fill="${INN.green}"/>`
  s += `<circle cx="${fx(S2.x)}" cy="${fx(S2.top + h * 0.09)}" r="${fx(S2.hw * 0.56)}" fill="#e8c49a"/>`
  s += `<circle cx="${fx(S2.x)}" cy="${fx(S2.top - h * 0.005)}" r="${fx(S2.hw * 0.3)}" fill="${INK}"/>` // bun
  s += `<path d="M ${fx(S2.x - S2.hw * 0.56)} ${fx(S2.top + h * 0.07)} A ${fx(S2.hw * 0.58)} ${fx(S2.hw * 0.58)} 0 0 1 ${fx(S2.x + S2.hw * 0.56)} ${fx(S2.top + h * 0.07)} Z" fill="${INK}" opacity="0.85"/>` // hair
  s += `<circle cx="${fx(S2.x - S2.hw * 0.17)}" cy="${fx(S2.top + h * 0.09)}" r="1.6" fill="${INK}"/><circle cx="${fx(S2.x + S2.hw * 0.17)}" cy="${fx(S2.top + h * 0.09)}" r="1.6" fill="${INK}"/>`
  s += `<path d="M ${fx(S2.x - S2.hw * 0.14)} ${fx(S2.top + h * 0.16)} Q ${fx(S2.x)} ${fx(S2.top + h * 0.195)} ${fx(S2.x + S2.hw * 0.14)} ${fx(S2.top + h * 0.16)}" stroke="${INK}" stroke-width="1.4" fill="none"/>`
  // the LEDGER: open book at her hip, parchment pages, a gold key inked in
  const LX = S2.x - S2.hw * 1.0
  const LY = S2.top + h * 0.36
  s += `<path d="M ${fx(LX - w * 0.042)} ${fx(LY)} Q ${fx(LX)} ${fx(LY - h * 0.045)} ${fx(LX + w * 0.042)} ${fx(LY)} L ${fx(LX + w * 0.042)} ${fx(LY + h * 0.07)} Q ${fx(LX)} ${fx(LY + h * 0.03)} ${fx(LX - w * 0.042)} ${fx(LY + h * 0.07)} Z" fill="${PARCH}" stroke="${LEATHER}" stroke-width="2.6"/>`
  s += `<line x1="${fx(LX)}" y1="${fx(LY - h * 0.03)}" x2="${fx(LX)}" y2="${fx(LY + h * 0.05)}" stroke="${LEATHER}" stroke-width="1.6"/>`
  s += `<g transform="translate(${fx(LX + w * 0.018)} ${fx(LY + h * 0.028)}) scale(0.5)">${keyGlyph(h * 0.09)}</g>`
  // THE CHILD: gold festival smock (a third garment color), waving
  const C2 = F.child
  s += `<path d="M ${fx(C2.x - C2.hw * 0.9)} ${fx(G)} L ${fx(C2.x - C2.hw * 0.5)} ${fx(C2.top + h * 0.11)} L ${fx(C2.x + C2.hw * 0.5)} ${fx(C2.top + h * 0.11)} L ${fx(C2.x + C2.hw * 0.9)} ${fx(G)} Z" fill="#c99b46"/>`
  s += `<line x1="${fx(C2.x - C2.hw * 0.62)}" y1="${fx(G - h * 0.16)}" x2="${fx(C2.x + C2.hw * 0.62)}" y2="${fx(G - h * 0.16)}" stroke="${LEATHER}" stroke-width="2" opacity="0.6"/>` // belt
  s += `<circle cx="${fx(C2.x + C2.hw * 0.12)}" cy="${fx(C2.top + h * 0.04)}" r="${fx(C2.hw * 0.62)}" fill="#e8c49a"/>`
  s += `<path d="M ${fx(C2.x - C2.hw * 0.5)} ${fx(C2.top)} A ${fx(C2.hw * 0.65)} ${fx(C2.hw * 0.65)} 0 0 1 ${fx(C2.x + C2.hw * 0.7)} ${fx(C2.top - h * 0.01)} L ${fx(C2.x + C2.hw * 0.42)} ${fx(C2.top + h * 0.03)} Z" fill="#8a5a3b"/>` // mop of hair
  s += `<circle cx="${fx(C2.x - C2.hw * 0.06)}" cy="${fx(C2.top + h * 0.045)}" r="1.5" fill="${INK}"/><circle cx="${fx(C2.x + C2.hw * 0.28)}" cy="${fx(C2.top + h * 0.045)}" r="1.5" fill="${INK}"/>`
  s += `<path d="M ${fx(C2.x - C2.hw * 0.03)} ${fx(C2.top + h * 0.1)} Q ${fx(C2.x + C2.hw * 0.12)} ${fx(C2.top + h * 0.14)} ${fx(C2.x + C2.hw * 0.27)} ${fx(C2.top + h * 0.1)}" stroke="${INK}" stroke-width="1.4" fill="none"/>`
  s += `<path d="M ${fx(C2.x - C2.hw * 0.45)} ${fx(C2.top + h * 0.13)} L ${fx(C2.x - C2.hw * 0.05)} ${fx(C2.top - h * 0.11)}" stroke="#c99b46" stroke-width="7" stroke-linecap="round"/>` // waving arm
  s += `<circle cx="${fx(C2.x - C2.hw * 0.02)}" cy="${fx(C2.top - h * 0.13)}" r="3.6" fill="#e8c49a" stroke="${INK}" stroke-width="0.9"/>` // waving hand
  // the child's other hand resting on THE DOG's head (the third link)
  s += `<path d="M ${fx(C2.x + C2.hw * 0.7)} ${fx(B_CD + h * 0.01)} L ${fx(F.dog.x - F.dog.hw * 0.5)} ${fx(B_CD + h * 0.035)}" stroke="#c99b46" stroke-width="6.4" stroke-linecap="round" fill="none"/>`
  // THE DOG: sitting, ears + tail in the cut, muzzle patch, collar tag
  const D = F.dog
  s += `<path d="M ${fx(D.x - D.hw)} ${fx(G)} Q ${fx(D.x - D.hw * 0.6)} ${fx(D.top + h * 0.1)} ${fx(D.x)} ${fx(D.top + h * 0.07)} Q ${fx(D.x + D.hw * 0.9)} ${fx(D.top + h * 0.11)} ${fx(D.x + D.hw * 1.2)} ${fx(G)} Z" fill="#7a4e30"/>`
  s += `<circle cx="${fx(D.x + D.hw * 0.05)}" cy="${fx(D.top + h * 0.05)}" r="${fx(D.hw * 0.58)}" fill="#a06c48"/>`
  s += `<ellipse cx="${fx(D.x - D.hw * 0.3)}" cy="${fx(D.top + h * 0.11)}" rx="${fx(D.hw * 0.34)}" ry="${fx(D.hw * 0.24)}" fill="#c99e78"/>` // muzzle patch
  s += `<circle cx="${fx(D.x - D.hw * 0.05)}" cy="${fx(D.top + h * 0.02)}" r="1.7" fill="${INK}"/>` // eye
  s += `<circle cx="${fx(D.x - D.hw * 0.48)}" cy="${fx(D.top + h * 0.1)}" r="2.6" fill="${INK}"/>` // nose
  s += `<path d="M ${fx(D.x - D.hw * 0.26)} ${fx(D.top + h * 0.16)} Q ${fx(D.x - D.hw * 0.06)} ${fx(D.top + h * 0.2)} ${fx(D.x + D.hw * 0.12)} ${fx(D.top + h * 0.16)}" stroke="${INK}" stroke-width="1.3" fill="none"/>`
  s += `<path d="M ${fx(D.x - D.hw * 0.2)} ${fx(D.top + h * 0.25)} A ${fx(D.hw * 0.5)} ${fx(D.hw * 0.5)} 0 0 0 ${fx(D.x + D.hw * 0.42)} ${fx(D.top + h * 0.27)}" stroke="${LEATHER}" stroke-width="3.4" fill="none"/>` // collar
  s += `<circle cx="${fx(D.x + D.hw * 0.12)}" cy="${fx(D.top + h * 0.31)}" r="3" fill="${GOLD}"/>` // tag
  // white chest patch for value against the dusk
  s += `<path d="M ${fx(D.x - D.hw * 0.28)} ${fx(D.top + h * 0.22)} Q ${fx(D.x - D.hw * 0.1)} ${fx(G - h * 0.06)} ${fx(D.x + D.hw * 0.14)} ${fx(D.top + h * 0.24)} Z" fill="${INN.snow}" opacity="0.5"/>`
  // lamplight rim on every figure's lantern side
  s += `<path d="M ${fx(K.x - K.hw)} ${fx(K.top + h * 0.24)} L ${fx(K.x - K.hw)} ${fx(G)} M ${fx(S2.x - S2.hw * 0.8)} ${fx(S2.top + h * 0.24)} L ${fx(S2.x - S2.hw)} ${fx(G)} M ${fx(C2.x - C2.hw * 0.85)} ${fx(C2.top + h * 0.14)} L ${fx(C2.x - C2.hw * 0.9)} ${fx(G)} M ${fx(D.x - D.hw)} ${fx(G - h * 0.02)} L ${fx(D.x - D.hw * 0.7)} ${fx(D.top + h * 0.12)}" stroke="${INN.lamp}" stroke-width="2.6" opacity="0.7" fill="none"/>`
  s += `</g>`
  s += rimPath(outline, 4)
  s += `</g>`
  const defs =
    `<clipPath id="s2rankCut"><path d="${outline}"/></clipPath>` +
    `<radialGradient id="s2winGlow3" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${INN.lamp}" stop-opacity="0.7"/>` +
    `<stop offset="0.6" stop-color="${INN.lamp}" stop-opacity="0.22"/>` +
    `<stop offset="1" stop-color="${INN.lamp}" stop-opacity="0"/></radialGradient>`
  return svgPiece(w, h, s, defs)
}

// ---- THE HANGING KEY-SIGN (ch1-sign, child on B's crease, 0.14 x 0.16):
// a walnut bracket-shield with THREE brass keys on a ring — reborn as a
// child, glue edge (v=0, image bottom) on the inn row's fold. ----
function signKeys(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const shTop = h * 0.06
  const shBot = h * 0.78
  const outline =
    `M ${fx(cx - w * 0.14)} ${fx(h)} L ${fx(cx - w * 0.14)} ${fx(shBot + h * 0.03)} ` + // mount stem
    `L ${fx(cx - w * 0.42)} ${fx(shBot)} ` +
    `L ${fx(cx - w * 0.46)} ${fx(lerp(shTop, shBot, 0.55))} L ${fx(cx - w * 0.4)} ${fx(shTop + h * 0.07)} ` +
    `L ${fx(cx - w * 0.12)} ${fx(shTop)} L ${fx(cx)} ${fx(shTop - h * 0.035)} L ${fx(cx + w * 0.12)} ${fx(shTop)} ` + // top scroll
    `L ${fx(cx + w * 0.4)} ${fx(shTop + h * 0.07)} L ${fx(cx + w * 0.46)} ${fx(lerp(shTop, shBot, 0.55))} ` +
    `L ${fx(cx + w * 0.42)} ${fx(shBot)} L ${fx(cx + w * 0.14)} ${fx(shBot + h * 0.03)} ` +
    `L ${fx(cx + w * 0.14)} ${fx(h)} Z`
  let s = `<g><path d="${outline}" fill="${WOOD}"/>`
  s += `<g clip-path="url(#s2signCut)">`
  s += `<rect width="${w}" height="${h}" fill="${WOOD}"/>`
  for (let i = 0; i < 14; i++) {
    const gy = rr(r, shTop, shBot)
    s += `<line x1="${fx(cx - w * 0.4)}" y1="${fx(gy)}" x2="${fx(cx + rr(r, -w * 0.1, w * 0.4))}" y2="${fx(gy)}" stroke="${WOOD_DK}" stroke-width="1.2" opacity="${fx(rr(r, 0.15, 0.3))}"/>`
  }
  // gold border + inner ink line
  s += `<path d="M ${fx(cx - w * 0.36)} ${fx(shBot - h * 0.035)} L ${fx(cx - w * 0.395)} ${fx(lerp(shTop, shBot, 0.55))} L ${fx(cx - w * 0.34)} ${fx(shTop + h * 0.1)} L ${fx(cx)} ${fx(shTop + h * 0.015)} L ${fx(cx + w * 0.34)} ${fx(shTop + h * 0.1)} L ${fx(cx + w * 0.395)} ${fx(lerp(shTop, shBot, 0.55))} L ${fx(cx + w * 0.36)} ${fx(shBot - h * 0.035)} Z" fill="none" stroke="${GOLD}" stroke-width="3.4"/>`
  // THE RING + three keys fanned from it
  const ringY = shTop + h * 0.24
  s += `<circle cx="${fx(cx)}" cy="${fx(ringY)}" r="${fx(w * 0.09)}" fill="none" stroke="${GOLD}" stroke-width="5"/>`
  s += `<circle cx="${fx(cx - w * 0.03)}" cy="${fx(ringY - w * 0.03)}" r="${fx(w * 0.02)}" fill="${GOLD_LIT}" opacity="0.85"/>`
  for (const [ang, kx] of [[-24, cx - w * 0.16], [0, cx], [24, cx + w * 0.16]]) {
    s += `<g transform="translate(${fx(kx)} ${fx(ringY + h * 0.27)}) rotate(${ang}) scale(1.9)">${keyGlyph(h * 0.12)}</g>`
  }
  // lamplit sheen from below-left (the door lamps sit under the sign)
  s += `<path d="M ${fx(cx - w * 0.42)} ${fx(shBot)} L ${fx(cx - w * 0.46)} ${fx(lerp(shTop, shBot, 0.55))} L ${fx(cx - w * 0.3)} ${fx(lerp(shTop, shBot, 0.55))} L ${fx(cx - w * 0.26)} ${fx(shBot)} Z" fill="${INN.lamp}" opacity="0.12"/>`
  s += `</g>`
  s += rimPath(outline, 4)
  s += `</g>`
  const defs = `<clipPath id="s2signCut"><path d="${outline}"/></clipPath>`
  return svgPiece(w, h, s, defs)
}

// ---- THE LIT DORMER (ch1-dormer, child on B's crease, 0.16 x 0.14): a
// gabled attic window popping off the stage fold — terracotta cap, one gold
// arched light, stone cheeks. Upright die (phi-74 parent, no flip). ----
function dormerLit(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const outline =
    `M ${fx(w * 0.08)} ${fx(h)} L ${fx(w * 0.08)} ${fx(h * 0.52)} L ${fx(cx)} ${fx(h * 0.05)} L ${fx(w * 0.92)} ${fx(h * 0.52)} L ${fx(w * 0.92)} ${fx(h)} Z`
  let s = `<g><path d="${outline}" fill="${INN.stoneLit}"/>`
  s += `<g clip-path="url(#s2dormCut)">`
  // terracotta gable cap
  s += `<path d="M ${fx(w * 0.02)} ${fx(h * 0.56)} L ${fx(cx)} ${fx(h * 0.02)} L ${fx(w * 0.98)} ${fx(h * 0.56)} L ${fx(w * 0.86)} ${fx(h * 0.56)} L ${fx(cx)} ${fx(h * 0.17)} L ${fx(w * 0.14)} ${fx(h * 0.56)} Z" fill="${INN.roofLit}" stroke="${INK}" stroke-width="2.2"/>`
  for (let i = 0; i < 8; i++) {
    const gy = rr(r, h * 0.6, h * 0.96)
    s += `<line x1="${fx(rr(r, w * 0.12, w * 0.3))}" y1="${fx(gy)}" x2="${fx(rr(r, w * 0.7, w * 0.88))}" y2="${fx(gy)}" stroke="${INK}" stroke-width="1.2" opacity="${fx(rr(r, 0.12, 0.24))}"/>`
  }
  // the gold arched light + glow
  s += `<ellipse cx="${fx(cx)}" cy="${fx(h * 0.66)}" rx="${fx(w * 0.3)}" ry="${fx(h * 0.28)}" fill="url(#s2winGlow4)"/>`
  s += `<path d="M ${fx(cx - w * 0.16)} ${fx(h * 0.92)} L ${fx(cx - w * 0.16)} ${fx(h * 0.52)} Q ${fx(cx)} ${fx(h * 0.34)} ${fx(cx + w * 0.16)} ${fx(h * 0.52)} L ${fx(cx + w * 0.16)} ${fx(h * 0.92)} Z" fill="${INN.lamp}" stroke="${INK}" stroke-width="2.6"/>`
  s += `<line x1="${fx(cx)}" y1="${fx(h * 0.4)}" x2="${fx(cx)}" y2="${fx(h * 0.92)}" stroke="${INK}" stroke-width="1.6" opacity="0.8"/>`
  s += `<line x1="${fx(cx - w * 0.16)}" y1="${fx(h * 0.66)}" x2="${fx(cx + w * 0.16)}" y2="${fx(h * 0.66)}" stroke="${INK}" stroke-width="1.6" opacity="0.8"/>`
  // a cat-shaped shadow in the pane? no — the cat is door 3's secret. curtains:
  s += `<path d="M ${fx(cx - w * 0.16)} ${fx(h * 0.52)} Q ${fx(cx - w * 0.1)} ${fx(h * 0.7)} ${fx(cx - w * 0.14)} ${fx(h * 0.92)}" stroke="${INN.roofDim}" stroke-width="4" fill="none" opacity="0.7"/>`
  s += `<path d="M ${fx(cx + w * 0.16)} ${fx(h * 0.52)} Q ${fx(cx + w * 0.1)} ${fx(h * 0.7)} ${fx(cx + w * 0.14)} ${fx(h * 0.92)}" stroke="${INN.roofDim}" stroke-width="4" fill="none" opacity="0.7"/>`
  // gable finial
  s += `<circle cx="${fx(cx)}" cy="${fx(h * 0.05)}" r="3" fill="${GOLD}"/>`
  s += `</g>`
  s += rimPath(outline, 4)
  s += `</g>`
  const defs =
    `<clipPath id="s2dormCut"><path d="${outline}"/></clipPath>` +
    `<radialGradient id="s2winGlow4" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${INN.lamp}" stop-opacity="0.5"/>` +
    `<stop offset="1" stop-color="${INN.lamp}" stop-opacity="0"/></radialGradient>`
  return svgPiece(w, h, s, defs)
}

// ---- THE FIRST KEY (ch1-key, child on B's door crease, 0.11 x 0.09): the
// first of a hundred brass keys, standing proud of the great door's lock as
// the book opens. Bow up, bit down at the glue edge; ornate but one closed
// silhouette. ----
function brassKeyStandee(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const bowR = w * 0.155
  const bowCy = h * 0.24
  const shaftW = w * 0.075
  // closed outline: outer bow ring + shaft + two bit teeth touching the base
  const outline =
    `M ${fx(cx - shaftW)} ${fx(h)} L ${fx(cx - shaftW)} ${fx(h * 0.52)} ` +
    `L ${fx(cx - bowR * 1.3)} ${fx(bowCy + bowR * 0.62)} ` +
    `A ${fx(bowR * 1.3)} ${fx(bowR * 1.3)} 0 1 1 ${fx(cx + bowR * 1.3)} ${fx(bowCy + bowR * 0.62)} ` +
    `L ${fx(cx + shaftW)} ${fx(h * 0.52)} L ${fx(cx + shaftW)} ${fx(h * 0.62)} ` +
    `L ${fx(cx + w * 0.29)} ${fx(h * 0.62)} L ${fx(cx + w * 0.29)} ${fx(h * 0.74)} L ${fx(cx + shaftW)} ${fx(h * 0.74)} ` + // big tooth
    `L ${fx(cx + shaftW)} ${fx(h * 0.82)} ` +
    `L ${fx(cx + w * 0.2)} ${fx(h * 0.82)} L ${fx(cx + w * 0.2)} ${fx(h * 0.92)} L ${fx(cx + shaftW)} ${fx(h * 0.92)} ` + // small tooth
    `L ${fx(cx + shaftW)} ${fx(h)} Z`
  let s = `<g><path d="${outline}" fill="${GOLD}"/>`
  s += `<g clip-path="url(#s2keyCut)">`
  s += `<rect width="${w}" height="${h}" fill="${GOLD}"/>`
  // bow: open ring look painted (dark center disc, not an alpha hole)
  s += `<circle cx="${fx(cx)}" cy="${fx(bowCy)}" r="${fx(bowR * 0.55)}" fill="#4a3218"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(bowCy)}" r="${fx(bowR * 0.55)}" fill="none" stroke="${GOLD_DIM}" stroke-width="4"/>`
  // trefoil knobs on the bow
  for (const a of [-Math.PI / 2, -Math.PI / 2 - 1.05, -Math.PI / 2 + 1.05])
    s += `<circle cx="${fx(cx + Math.cos(a) * bowR * 1.22)}" cy="${fx(bowCy + Math.sin(a) * bowR * 1.22)}" r="${fx(w * 0.055)}" fill="${GOLD_LIT}" stroke="${GOLD_DIM}" stroke-width="1.8"/>`
  // shaft collars + lit edge
  s += `<rect x="${fx(cx - shaftW)}" y="${fx(h * 0.5)}" width="${fx(shaftW * 0.7)}" height="${fx(h * 0.5)}" fill="${GOLD_LIT}" opacity="0.7"/>`
  for (const cy of [h * 0.5, h * 0.575])
    s += `<rect x="${fx(cx - shaftW * 1.3)}" y="${fx(cy)}" width="${fx(shaftW * 2.6)}" height="${fx(h * 0.026)}" fill="${GOLD_DIM}"/>`
  s += `<rect x="${fx(cx + shaftW)}" y="${fx(h * 0.62)}" width="${fx(w * 0.29 - shaftW)}" height="${fx(h * 0.045)}" fill="${GOLD_LIT}" opacity="0.6"/>` // tooth glint
  s += `<circle cx="${fx(cx - bowR * 0.62)}" cy="${fx(bowCy - bowR * 0.72)}" r="${fx(w * 0.042)}" fill="#fff4cf" opacity="0.8"/>` // sparkle
  s += `</g>`
  s += rimPath(outline, 3.6)
  s += `</g>`
  void r
  const defs = `<clipPath id="s2keyCut"><path d="${outline}"/></clipPath>`
  return svgPiece(w, h, s, defs)
}

// ---- THE KEY-BALUSTER FRIEZE (ch1-wall RE-CUT, 1.25 x 0.2 fore wall): the
// courtyard wall's die-cut top edge becomes a rank of key-shaped balusters
// (bows solid — no alpha holes on the fore edge), with the painted villager-
// and-geese frieze band along the base. ----
function friezeKeys(w, h, seed) {
  const r = mulberry32(seed)
  const wallTop = h * 0.52
  const N = 11
  // build the crest: wall coping with N key balusters standing out of it
  let d = `M 0 ${fx(h)} L 0 ${fx(wallTop)} `
  for (let i = 0; i < N; i++) {
    const cx = (w * (i + 0.5)) / N
    const kw = w * 0.011 // shaft half-width
    const bowR = w * 0.0165
    const bowCy = h * 0.17
    d +=
      `L ${fx(cx - kw)} ${fx(wallTop)} L ${fx(cx - kw)} ${fx(h * 0.42)} ` +
      // a bit tooth on each shaft's left flank (the fence IS keys)
      `L ${fx(cx - kw - w * 0.009)} ${fx(h * 0.42)} L ${fx(cx - kw - w * 0.009)} ${fx(h * 0.365)} L ${fx(cx - kw)} ${fx(h * 0.365)} ` +
      `L ${fx(cx - kw)} ${fx(h * 0.31)} ` +
      `L ${fx(cx - bowR * 1.3)} ${fx(bowCy + bowR)} ` +
      `A ${fx(bowR * 1.3)} ${fx(bowR * 1.3)} 0 1 1 ${fx(cx + bowR * 1.3)} ${fx(bowCy + bowR)} ` +
      `L ${fx(cx + kw)} ${fx(h * 0.31)} L ${fx(cx + kw)} ${fx(wallTop)} `
  }
  d += `L ${fx(w)} ${fx(wallTop)} L ${fx(w)} ${fx(h)} Z`
  let s = `<g><path d="${d}" fill="${INN.stoneMid}"/>`
  s += `<g clip-path="url(#s2friezeCut)">`
  s += `<rect width="${w}" height="${h}" fill="${INN.stoneMid}"/>`
  // baluster paint: brass keys against dusk
  for (let i = 0; i < N; i++) {
    const cx = (w * (i + 0.5)) / N
    s += `<rect x="${fx(cx - w * 0.011)}" y="${fx(h * 0.22)}" width="${fx(w * 0.022)}" height="${fx(h * 0.32)}" fill="${GOLD_DIM}" opacity="0.55"/>`
    s += `<circle cx="${fx(cx)}" cy="${fx(h * 0.17)}" r="${fx(w * 0.0135)}" fill="#5a4520"/>`
    s += `<circle cx="${fx(cx)}" cy="${fx(h * 0.17)}" r="${fx(w * 0.0135)}" fill="none" stroke="${GOLD}" stroke-width="2.4"/>`
  }
  // coping + coursing
  s += `<rect x="0" y="${fx(wallTop)}" width="${w}" height="${fx(h * 0.06)}" fill="${INN.stoneLit}"/>`
  s += `<line x1="0" y1="${fx(wallTop + h * 0.06)}" x2="${w}" y2="${fx(wallTop + h * 0.06)}" stroke="${INK}" stroke-width="1.8" opacity="0.5"/>`
  for (let i = 0; i < 40; i++) {
    const jx = (w * (i + (i % 2 ? 0.25 : 0.75))) / 40
    s += `<line x1="${fx(jx)}" y1="${fx(wallTop + h * 0.06 + (i % 3) * h * 0.1)}" x2="${fx(jx)}" y2="${fx(wallTop + h * 0.06 + (i % 3) * h * 0.1 + h * 0.1)}" stroke="${INK}" stroke-width="1.2" opacity="0.22"/>`
  }
  s += `<line x1="0" y1="${fx(h * 0.72)}" x2="${w}" y2="${fx(h * 0.72)}" stroke="${INK}" stroke-width="1.4" opacity="0.3"/>`
  s += `<line x1="0" y1="${fx(h * 0.86)}" x2="${w}" y2="${fx(h * 0.86)}" stroke="${INK}" stroke-width="1.4" opacity="0.3"/>`
  // THE PAINTED FRIEZE BAND: little villagers walking to the inn + geese
  const bandY = h * 0.79
  for (let i = 0; i < 9; i++) {
    const vx = w * (0.06 + i * 0.11) + rr(r, -w * 0.012, w * 0.012)
    const vh = h * 0.14
    if (i % 3 === 2) {
      // a goose: teardrop body + neck
      s += `<ellipse cx="${fx(vx)}" cy="${fx(bandY + vh * 0.32)}" rx="${fx(vh * 0.42)}" ry="${fx(vh * 0.26)}" fill="${INK}" opacity="0.75"/>`
      s += `<path d="M ${fx(vx + vh * 0.3)} ${fx(bandY + vh * 0.24)} Q ${fx(vx + vh * 0.52)} ${fx(bandY - vh * 0.16)} ${fx(vx + vh * 0.62)} ${fx(bandY - vh * 0.05)}" stroke="${INK}" stroke-width="2.4" fill="none" opacity="0.75"/>`
      s += `<circle cx="${fx(vx + vh * 0.62)}" cy="${fx(bandY - vh * 0.06)}" r="1.8" fill="${INK}" opacity="0.75"/>`
    } else {
      // a walking villager: cloak triangle + head + bundle/lantern
      s += `<path d="M ${fx(vx - vh * 0.24)} ${fx(bandY + vh * 0.5)} L ${fx(vx)} ${fx(bandY - vh * 0.22)} L ${fx(vx + vh * 0.24)} ${fx(bandY + vh * 0.5)} Z" fill="${INK}" opacity="0.75"/>`
      s += `<circle cx="${fx(vx)}" cy="${fx(bandY - vh * 0.32)}" r="${fx(vh * 0.14)}" fill="${INK}" opacity="0.75"/>`
      if (i % 3 === 0) s += `<circle cx="${fx(vx + vh * 0.32)}" cy="${fx(bandY + vh * 0.06)}" r="${fx(vh * 0.09)}" fill="${GOLD}" opacity="0.9"/>` // a lantern
    }
  }
  s += `</g>`
  s += rimPath(d, 4)
  s += `</g>`
  const defs = `<clipPath id="s2friezeCut"><path d="${d}"/></clipPath>`
  return svgPiece(w, h, s, defs)
}

// ---- THE T-FLOOR (page-2 spread print, both pages in ONE image — same uv
// contract as page-4: image x=0 the LEFT fore edge, 0.5 the spine, 1 the
// RIGHT fore edge; image TOP the far page edge z=-0.75, BOTTOM the apron).
// The floor CONTINUES the 3D motion into 2D: a cobble fan radiating from the
// gate through to the great door, a trail of scattered brass keys leading
// from the fore edge past the KEY-BOARD to the door, warm window-light pools
// under plane B, the WELCOME doormat, the goose family, guest footprints,
// and the celebrated affordances (the LIFT ribbon + the woodcut manicule
// aimed at door 1). ----
function innCourtyardSpread(w, h, seed) {
  const r = mulberry32(seed)
  const PX = (f) => f * w
  const PY = (f) => f * h
  const WALNUT = '#5c4526'
  // scene anchors in image fractions (pageFX/pageFY from the page-4 module)
  const doorX = 0.5
  const doorY = pageFY(-0.2) // the great door's station at the spine
  const gateY = pageFY(0.16)
  let s = `<g>`
  s += `<rect width="${w}" height="${h}" fill="${ROOK.parch}"/>`
  // laid-paper tooth
  for (let i = 0; i < 150; i++) {
    const y = rr(r, 0, h)
    s += `<line x1="0" y1="${fx(y)}" x2="${w}" y2="${fx(y)}" stroke="${WALNUT}" stroke-width="1" opacity="${fx(rr(r, 0.02, 0.05))}"/>`
  }
  // dusk falls on the far half (under the mountain + behind the inn row)
  s += `<rect width="${w}" height="${fx(h * 0.34)}" fill="url(#s2pgDusk)"/>`
  // the gutter valley
  s += `<rect x="${fx(w * 0.46)}" y="0" width="${fx(w * 0.08)}" height="${h}" fill="url(#s2pgGutter)"/>`

  // ---- THE COBBLE FAN, painted as MASS (the s4 floor-rejection law: fill
  // the stones, never wireframe them). First the paved FIELD, a full value step
  // below the parchment, then FILLED cobble courses converging on the great door.
  //
  // The courtyard REACHES BOTH PAGE EDGES and dissolves into the far page under
  // a haze. A paved region that stops mid-page reads as a trapezoid island —
  // or, with flared flanks, as a ramp on a hill — with bare parchment
  // shoulders, which fails the pinned-camera read as surely as a wireframed
  // floor did: the courtyard has to BE the page. Two consequences, both load-
  // bearing: the far edge is a gentle WAVE (a ruled horizon prints as a seam),
  // and every course spans the WHOLE width, because a floor recedes by row
  // COMPRESSION (the quadratic fy below), never by narrowing — narrowing is
  // what draws a road.
  const FAN0 = { x: doorX, y: doorY + 0.02 }
  const farY = FAN0.y - 0.055
  const farEdge = []
  for (let i = 0; i <= 30; i++) {
    const ft = i / 30
    const fyy = farY + 0.013 * Math.sin(ft * 6.7 + 0.9) + 0.007 * Math.sin(ft * 15.1)
    farEdge.push(`${fx(PX(lerp(-0.04, 1.04, ft)))} ${fx(PY(fyy))}`)
  }
  const field = `M ${farEdge.join(' L ')} L ${fx(PX(1.04))} ${fx(PY(1.05))} L ${fx(PX(-0.04))} ${fx(PY(1.05))} Z`
  s += `<path d="${field}" fill="#dcc697"/>`
  s += `<path d="${field}" fill="url(#s2pgPave)"/>`
  s += `<g clip-path="url(#s2pgField)">`
  // Six setts spanning a real LIGHT-to-DARK range, not four mid-tones: paving
  // can only carry as much value range as its palette holds, and a mid-only
  // palette caps the whole print's contrast however the lighting is graded.
  const STONE_FILLS = ['#e2c88f', '#cbb078', '#c3a76e', '#b6976a', '#a98a5c', '#8a6f47']
  // Courses are true ARCS about the great door, walked outward in PIXEL space so
  // they stay circular on the plate: this is what makes the painted perspective
  // CONVERGE on plane B's door (T-FLOOR, scene pack 1). Straight full-width rows
  // pave the page but throw the convergence away and read as a rug of pebbles.
  // Stone size grows with radius (perspective) and each course carries as many
  // stones as it takes to TILE its own arc, so the joint stays thin everywhere
  // instead of opening into mortar rivers at the apron.
  const OXp = PX(doorX)
  const OYp = PY(FAN0.y)
  const TH0 = -0.2
  const TH1 = Math.PI + 0.2
  const RMAX = Math.hypot(w, h) * 1.15
  let R = h * 0.062
  let course = 0
  while (R < RMAX) {
    const grow = Math.pow(Math.min(1, R / (h * 1.15)), 0.78)
    const ry = lerp(h * 0.005, h * 0.026, grow)
    const rx = ry * 1.6
    const stride = 2 * rx + 3.4
    const count = Math.max(6, Math.ceil(((TH1 - TH0) * R) / stride))
    const dTh = (TH1 - TH0) / count
    // how much of the door's lamplight reaches this course — the value gradient
    // that makes the paving LEAD INWARD instead of reading as an even texture
    const warm = Math.max(0, 1 - R / (h * 0.78))
    for (let c2 = 0; c2 < count; c2++) {
      const th = TH0 + (c2 + (course % 2 ? 0.5 : 0)) * dTh // running bond
      const sx2 = OXp + Math.cos(th) * R
      const sy2 = OYp + Math.sin(th) * R
      if (sy2 < -ry * 2 || sy2 > h + ry * 2 || sx2 < -rx * 2 || sx2 > w + rx * 2) continue
      const fill = STONE_FILLS[Math.min(STONE_FILLS.length - 1, Math.floor(((r() + r()) / 2) * STONE_FILLS.length))] // triangular: mid-tones dominate
      const spin = fx((th * 180) / Math.PI - 90 + rr(r, -7, 7))
      const erx = fx(rx * rr(r, 0.8, 1))
      const ery = fx(ry * rr(r, 0.86, 1.04))
      s += `<ellipse cx="${fx(sx2 + rr(r, -2.6, 2.6))}" cy="${fx(sy2 + rr(r, -1.8, 1.8))}" rx="${erx}" ry="${ery}" fill="${fill}" stroke="${WALNUT}" stroke-width="2" stroke-opacity="0.62" transform="rotate(${spin} ${fx(sx2)} ${fx(sy2)})"/>`
      if (warm > 0.03) s += `<ellipse cx="${fx(sx2)}" cy="${fx(sy2)}" rx="${erx}" ry="${ery}" fill="${INN.lamp}" opacity="${fx(warm * 0.26)}" transform="rotate(${spin} ${fx(sx2)} ${fx(sy2)})"/>`
      if (r() < 0.12) s += `<ellipse cx="${fx(sx2)}" cy="${fx(sy2)}" rx="${fx(rx * 0.66)}" ry="${fx(ry * 0.7)}" fill="${WALNUT}" opacity="0.28"/>` // a darker set stone
    }
    R += 2 * ry + 3.4
    course++
  }
  // the warm spill from the door running down the fan's throat
  s += `<path d="M ${fx(PX(FAN0.x - 0.05))} ${fx(PY(FAN0.y))} L ${fx(PX(FAN0.x - 0.1))} ${fx(PY(gateY + 0.16))} L ${fx(PX(FAN0.x + 0.1))} ${fx(PY(gateY + 0.16))} L ${fx(PX(FAN0.x + 0.05))} ${fx(PY(FAN0.y))} Z" fill="${INN.lamp}" opacity="0.1"/>`
  s += `</g>`
  // the far courses dissolve rather than ending at a line (haze-carried recession)
  s += `<rect width="${w}" height="${fx(PY(farY + 0.13))}" fill="url(#s2pgHaze)"/>`

  // ---- WINDOW-LIGHT POOLS under plane B's facades (glue band z -0.2..-0.41).
  // Painted AFTER the paving: lamplight falls ON the cobbles, and while the
  // field ended below them it silently covered any pool that reached it.
  for (const side of ['left', 'right']) {
    for (let k = 0; k < 6; k++) {
      const radial = lerp(0.12, PAGE_W_U * 0.92, (k + rr(r, 0.2, 0.8)) / 6)
      const fy = pageFY(lerp(-0.36, -0.2, rr(r, 0, 1)))
      const rad = rr(r, 0.07, 0.12)
      s += `<ellipse cx="${fx(PX(pageFX(radial, side)))}" cy="${fx(PY(fy))}" rx="${fx(PX(rad * 0.62))}" ry="${fx(PY(rad * 0.3))}" fill="url(#s2pgPool)"/>`
    }
  }
  // warm spill out of the great door itself
  s += `<ellipse cx="${fx(PX(doorX))}" cy="${fx(PY(doorY + 0.03))}" rx="${fx(PX(0.055))}" ry="${fx(PY(0.032))}" fill="url(#s2pgPool)" opacity="0.95"/>`

  // ---- THE WELCOME DOORMAT, just downstage of the gate span
  const matY = pageFY(0.3)
  const matW = 0.128
  const matH = 0.052
  // Dark COIR against lit paving, with its own contact shadow and a pale bound
  // edge: at 0.85 over roofDim the mat measured 19 luminance off the cobbles it
  // lies on, i.e. below the threshold where a shape still reads at the pinned
  // camera. A doormat is a dark object on a light floor — paint it that way.
  s += `<g transform="rotate(-1.2 ${fx(PX(0.5))} ${fx(PY(matY))})">`
  s += `<rect x="${fx(PX(0.5 - matW / 2) + 2)}" y="${fx(PY(matY - matH / 2) + 6)}" width="${fx(PX(matW))}" height="${fx(PY(matH))}" rx="4" fill="${INK}" opacity="0.34"/>`
  s += `<rect x="${fx(PX(0.5 - matW / 2))}" y="${fx(PY(matY - matH / 2))}" width="${fx(PX(matW))}" height="${fx(PY(matH))}" rx="4" fill="#6d5334"/>`
  // coir bristle tooth, so the mat reads as woven rather than as a flat plate
  for (let i = 0; i <= 46; i++) {
    const bx = lerp(PX(0.5 - matW / 2) + 4, PX(0.5 + matW / 2) - 4, i / 46)
    s += `<line x1="${fx(bx)}" y1="${fx(PY(matY - matH / 2) + 4)}" x2="${fx(bx)}" y2="${fx(PY(matY + matH / 2) - 4)}" stroke="${INK}" stroke-width="1.5" opacity="0.14"/>`
  }
  s += `<rect x="${fx(PX(0.5 - matW / 2) + 5)}" y="${fx(PY(matY - matH / 2) + 5)}" width="${fx(PX(matW) - 10)}" height="${fx(PY(matH) - 10)}" fill="none" stroke="${INN.stone}" stroke-width="2.6" opacity="0.9"/>`
  // engraved font-free (ENGRAVE_GLYPHS) — no installed-typeface dependency
  {
    const cw2 = PX(0.0102)
    const gap2 = PX(0.0028)
    const ch2 = PY(0.0225)
    const total = 7 * cw2 + 6 * gap2
    s += engraveWord('WELCOME', PX(0.5) - total / 2, PY(matY) - ch2 / 2 + 1.4, cw2, ch2, gap2, INK, 4.2, 'opacity="0.45"')
    s += engraveWord('WELCOME', PX(0.5) - total / 2, PY(matY) - ch2 / 2, cw2, ch2, gap2, ROOK.parchLit, 3.2, 'opacity="0.98"')
  }
  s += `</g>`

  // ---- THE BRASS-KEY TRAIL: fore edge -> past the key-board -> the door.
  // (board: right page, d 0.40..0.62 -> x 0.674..0.770, z -0.03..0.42)
  const trail = (t) => {
    const mt = 1 - t
    const P = [[0.985, pageFY(0.5)], [0.9, pageFY(0.52)], [0.84, pageFY(0.1)], [0.62, pageFY(-0.12)]]
    return [0, 1].map((k) => mt * mt * mt * P[0][k] + 3 * mt * mt * t * P[1][k] + 3 * mt * t * t * P[2][k] + t * t * t * P[3][k])
  }
  // BRASS on a walnut under-copy, each on its own contact shadow. Drawn in
  // WALNUT they were the same colour as the cobble joints and measured x0.99
  // local contrast against the paving — a named story element, invisible. The
  // shared keyGlyph is untouched (ch1-sign/-gate and s4 call it); only this
  // caller's palette changes.
  const strewnKey = (S) =>
    `<ellipse cx="0" cy="${fx(S * 0.34)}" rx="${fx(S * 0.42)}" ry="${fx(S * 0.13)}" fill="${INK}" opacity="0.3"/>` +
    `<g transform="translate(1.6 2.2)" opacity="0.55">${keyGlyph(S, INK, INK)}</g>` +
    keyGlyph(S, GOLD, GOLD_LIT)
  for (let k = 0; k < 9; k++) {
    const [kx, ky] = trail(k / 8 + rr(r, -0.02, 0.02))
    const S = lerp(h * 0.047, h * 0.03, k / 8)
    s += `<g transform="translate(${fx(PX(kx + rr(r, -0.008, 0.008)))} ${fx(PY(ky + rr(r, -0.006, 0.006)))}) rotate(${fx(rr(r, -80, 80))})">${strewnKey(S)}</g>`
  }
  // ... and two strays on the left page for the wanderers
  for (const [kx, ky] of [[0.36, 0.8], [0.2, 0.62]])
    s += `<g transform="translate(${fx(PX(kx))} ${fx(PY(ky))}) rotate(${fx(rr(r, -60, 60))})" opacity="0.8">${strewnKey(h * 0.026)}</g>`

  // ---- THE LIFT RIBBON BANNER arcing over the key-board (celebrated, not
  // apologetic): brick-red ribbon, parchment letters, gold tails.
  const ribY = pageFY(-0.1)
  const ribX0 = 0.655
  const ribX1 = 0.795
  const ribD = `M ${fx(PX(ribX0))} ${fx(PY(ribY + 0.022))} Q ${fx(PX((ribX0 + ribX1) / 2))} ${fx(PY(ribY - 0.03))} ${fx(PX(ribX1))} ${fx(PY(ribY + 0.022))}`
  s += `<path d="${ribD}" fill="none" stroke="${INN.roofDim}" stroke-width="${fx(h * 0.036)}" stroke-linecap="butt"/>`
  s += `<path d="${ribD}" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.5" transform="translate(0 ${fx(-h * 0.017)})"/>`
  s += `<path d="${ribD}" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.5" transform="translate(0 ${fx(h * 0.017)})"/>`
  // ribbon tails
  s += `<path d="M ${fx(PX(ribX0))} ${fx(PY(ribY + 0.012))} l ${fx(-w * 0.017)} ${fx(h * 0.012)} l ${fx(w * 0.011)} ${fx(h * 0.011)} l ${fx(-w * 0.004)} ${fx(h * 0.012)} l ${fx(w * 0.014)} ${fx(-h * 0.012)} Z" fill="${INN.roofDim}"/>`
  s += `<path d="M ${fx(PX(ribX1))} ${fx(PY(ribY + 0.012))} l ${fx(w * 0.017)} ${fx(h * 0.012)} l ${fx(-w * 0.011)} ${fx(h * 0.011)} l ${fx(w * 0.004)} ${fx(h * 0.012)} l ${fx(-w * 0.014)} ${fx(-h * 0.012)} Z" fill="${INN.roofDim}"/>`
  {
    const cw3 = PX(0.011)
    const gap3 = PX(0.0042)
    const ch3 = PY(0.026)
    const total3 = 4 * cw3 + 3 * gap3
    s += engraveWord('LIFT', PX((ribX0 + ribX1) / 2) - total3 / 2, PY(ribY - 0.006) - ch3 / 2, cw3, ch3, gap3, ROOK.parch, 3, 'opacity="0.96"')
  }

  // ---- THE WOODCUT MANICULE on the floor, aimed at door 1 (z ~0.04) — the
  // house helper (nominally +x), MIRRORED to point spine-ward at the board.
  s += `<g transform="translate(${fx(PX(0.858))} ${fx(PY(pageFY(0.055)))}) scale(-1 1)" opacity="0.92">${manicule(0, 0, w * 0.021, ROOK.parch, WALNUT)}</g>`

  // ---- THE GOOSE FAMILY crossing lower-left, heading for the gate
  const geese = [
    [0.155, 0.8, 1],
    [0.21, 0.84, 0.62],
    [0.255, 0.815, 0.56],
    [0.3, 0.85, 0.6],
  ]
  for (const [gx, gy, gs] of geese) {
    const B2 = h * 0.05 * gs
    s += `<g transform="translate(${fx(PX(gx))} ${fx(PY(gy))})">`
    s += `<ellipse cx="0" cy="0" rx="${fx(B2 * 0.85)}" ry="${fx(B2 * 0.55)}" fill="${INN.snow}" stroke="${WALNUT}" stroke-width="2"/>`
    s += `<path d="M ${fx(B2 * 0.6)} ${fx(-B2 * 0.3)} Q ${fx(B2 * 1.05)} ${fx(-B2 * 0.9)} ${fx(B2 * 1.2)} ${fx(-B2 * 0.75)}" fill="none" stroke="${INN.snow}" stroke-width="${fx(Math.max(2.4, B2 * 0.26))}"/>`
    s += `<path d="M ${fx(B2 * 0.6)} ${fx(-B2 * 0.3)} Q ${fx(B2 * 1.05)} ${fx(-B2 * 0.9)} ${fx(B2 * 1.2)} ${fx(-B2 * 0.75)}" fill="none" stroke="${WALNUT}" stroke-width="1.4" opacity="0.6"/>`
    s += `<circle cx="${fx(B2 * 1.22)}" cy="${fx(-B2 * 0.78)}" r="${fx(Math.max(2, B2 * 0.19))}" fill="${INN.snow}" stroke="${WALNUT}" stroke-width="1.4"/>`
    s += `<path d="M ${fx(B2 * 1.38)} ${fx(-B2 * 0.78)} l ${fx(B2 * 0.3)} ${fx(B2 * 0.08)} l ${fx(-B2 * 0.28)} ${fx(B2 * 0.12)} Z" fill="#c98b4a"/>` // beak
    s += `<path d="M ${fx(-B2 * 0.2)} ${fx(B2 * 0.5)} l ${fx(-B2 * 0.1)} ${fx(B2 * 0.34)} m ${fx(B2 * 0.42)} ${fx(-B2 * 0.34)} l ${fx(B2 * 0.1)} ${fx(B2 * 0.34)}" stroke="#c98b4a" stroke-width="2.2" fill="none"/>` // feet
    s += `<path d="M ${fx(-B2 * 0.5)} ${fx(-B2 * 0.1)} Q 0 ${fx(-B2 * 0.4)} ${fx(B2 * 0.45)} ${fx(-B2 * 0.12)}" fill="none" stroke="${WALNUT}" stroke-width="1.3" opacity="0.5"/>` // wing line
    s += `</g>`
  }
  // webbed goose prints trailing behind them
  for (let i = 0; i < 7; i++) {
    const px2 = 0.12 + i * 0.033 + rr(r, -0.006, 0.006)
    const py2 = 0.87 + (i % 2 ? 0.014 : -0.008)
    s += `<path d="M ${fx(PX(px2))} ${fx(PY(py2))} l -3.4 5 m 3.4 -5 l 0 5.4 m 0 -5.4 l 3.4 5" stroke="${WALNUT}" stroke-width="1.3" opacity="0.4" fill="none"/>`
  }

  // ---- GUEST FOOTPRINTS doodled into the cobbles (Vegas floor-doodle
  // license): two boot trails wandering in from the aprons to the door.
  const bootTrail = (x0, y0, x1, y1, steps) => {
    let out = ''
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1)
      const bx = lerp(x0, x1, t) + (i % 2 ? 0.012 : -0.012) + rr(r, -0.003, 0.003)
      const by = lerp(y0, y1, t) + rr(r, -0.004, 0.004)
      const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI + 90 + rr(r, -14, 14)
      out += `<g transform="translate(${fx(PX(bx))} ${fx(PY(by))}) rotate(${fx(ang)})" opacity="${fx(rr(r, 0.3, 0.44))}">` +
        `<ellipse cx="0" cy="-3.4" rx="3.2" ry="5" fill="${WALNUT}"/>` +
        `<ellipse cx="0" cy="5" rx="2.6" ry="2.2" fill="${WALNUT}"/></g>`
    }
    return out
  }
  s += bootTrail(0.08, 0.97, 0.44, pageFY(0.05), 9)
  s += bootTrail(0.9, 0.99, 0.56, pageFY(0.12), 8)

  // dusk shadow of the stable in the gutter lane (kept box, z 0.43..0.58)
  s += `<ellipse cx="${fx(PX(0.5))}" cy="${fx(PY(pageFY(0.5)))}" rx="${fx(PX(0.07))}" ry="${fx(PY(0.03))}" fill="${WALNUT}" opacity="0.07"/>`
  // vignette
  s += `<rect width="${w}" height="${h}" fill="url(#s2pgVig)"/>`
  s += `</g>`
  const defs =
    `<clipPath id="s2pgField"><path d="${field}"/></clipPath>` +
    // RADIAL about the great door, not vertical: the courtyard is lit from the
    // door, so the paving must brighten inward and fall off to the aprons. A
    // vertical ramp darkened the very band the doorlight falls on.
    `<radialGradient id="s2pgPave" cx="0.5" cy="${fx(pageFY(-0.18))}" r="0.78">` +
    `<stop offset="0" stop-color="${INN.lamp}" stop-opacity="0.16"/>` +
    `<stop offset="0.42" stop-color="${WALNUT}" stop-opacity="0.1"/>` +
    `<stop offset="1" stop-color="${WALNUT}" stop-opacity="0.4"/></radialGradient>` +
    `<linearGradient id="s2pgHaze" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${ROOK.parch}" stop-opacity="0.72"/>` +
    `<stop offset="0.66" stop-color="${ROOK.parch}" stop-opacity="0.22"/>` +
    `<stop offset="1" stop-color="${ROOK.parch}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="s2pgDusk" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${INN.skyDeep}" stop-opacity="0.26"/>` +
    `<stop offset="0.6" stop-color="${INN.skyDeep}" stop-opacity="0.1"/>` +
    `<stop offset="1" stop-color="${INN.skyDeep}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="s2pgGutter" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${WALNUT}" stop-opacity="0"/>` +
    `<stop offset="0.5" stop-color="${WALNUT}" stop-opacity="0.3"/>` +
    `<stop offset="1" stop-color="${WALNUT}" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="s2pgPool" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${INN.lamp}" stop-opacity="0.6"/>` +
    `<stop offset="0.6" stop-color="${INN.lamp}" stop-opacity="0.2"/>` +
    `<stop offset="1" stop-color="${INN.lamp}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="s2pgVig" cx="0.5" cy="0.55" r="0.75">` +
    `<stop offset="0.5" stop-color="${WALNUT}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${WALNUT}" stop-opacity="0.28"/></radialGradient>`
  return svgPiece(w, h, s, defs)
}

// ---- texture-only bake: SVG -> flat PNG -> seeded grain masked by alpha ->
// webp. No outline sidecar (mesh stays the solver quad). ----
// ============================================================================
// THE CARRIER SWARM ART MODULE (E3 s3, "The Carrier Swarm"). One 1024 sprite
// atlas feeds all 28 swarmarc riders + the hairline strut swatch + the STIR
// tab (G5 FIELD discipline: many pieces, ONE texture). Cell convention is
// popup-swarmarc-layer.tsx's contract, written once THERE and honored HERE:
// 8x8 grid of 128px cells, row 0 at the image TOP; cells 0-15 the 16 rider
// sprites, cell 16 the strut swatch (OPAQUE — the strut mesh has no alpha
// test), cells 17-18 + 25-26 the 2x2 STIR tab (banner lettering over the
// bee-on-honey-drop handle), cells 19-22 the printed banner strip reserved
// for the page print. Palette is the pack's alpine-airy set — 3 values + 1
// metal + ONE saturated accent (daisy-ref discipline): the red appears ONLY
// on wax seals + the tab bow, never on bees or satchels.
// ============================================================================

const SWARM = {
  sky: '#e7eef4',
  blue: '#7d9bb5',
  slate: '#4a5c6e',
  slateDeep: '#37475a',
  gold: '#d9a441',
  goldLit: '#ecc26b',
  amber: '#a86a24',
  cream: '#f2e8d0',
  parch: '#e7d5a8',
  bee: '#2f2a22',
  wing: '#eef2f5',
  meadow: '#6a8f5f',
  strut: '#a9bccb',
  red: '#b0483a',
}

/** One courier bee. `s` = body length px; poses: wingsUp / wingsMid /
 *  wingsDown / profile / bumble / scout / satchel. Rim halo behind the body
 *  so the sprite reads as a die-cut card chip. */
function swarmBee(cx, cy, s, pose) {
  const P = SWARM
  const fat = pose === 'bumble' ? 1.25 : pose === 'scout' ? 0.82 : 1
  const rx = s * 0.5 * fat
  const ry = s * 0.34 * fat
  let g = `<g>`
  // die-cut rim halo (body + head footprint)
  g += `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(rx + 3)}" ry="${fx(ry + 3)}" fill="${RIM}" opacity="0.9"/>`
  g += `<circle cx="${fx(cx + rx * 0.92)}" cy="${fx(cy - ry * 0.22)}" r="${fx(ry * 0.62 + 3)}" fill="${RIM}" opacity="0.9"/>`
  // wings BEHIND the body for up/profile, in front for down (paper layering)
  const wing = (wx, wy, wrx, wry, rot) =>
    `<ellipse cx="${fx(wx)}" cy="${fx(wy)}" rx="${fx(wrx)}" ry="${fx(wry)}" fill="${P.wing}" opacity="0.92" stroke="${P.slate}" stroke-width="1.3" stroke-opacity="0.55" transform="rotate(${rot} ${fx(wx)} ${fx(wy)})"/>`
  const wingsBehind =
    pose === 'wingsUp' || pose === 'satchel'
      ? wing(cx - rx * 0.28, cy - ry * 1.5, s * 0.34, s * 0.15, -38) + wing(cx + rx * 0.18, cy - ry * 1.55, s * 0.34, s * 0.15, -18)
      : pose === 'wingsMid' || pose === 'bumble' || pose === 'scout'
        ? wing(cx - rx * 0.5, cy - ry * 1.1, s * 0.38, s * 0.14, -8) + wing(cx + rx * 0.28, cy - ry * 1.15, s * 0.36, s * 0.13, 6)
        : pose === 'profile'
          ? wing(cx - rx * 0.1, cy - ry * 1.35, s * 0.4, s * 0.16, -26)
          : ''
  g += wingsBehind
  // body + gold stripes + head
  g += `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(rx)}" ry="${fx(ry)}" fill="${P.bee}"/>`
  for (const t of [-0.15, 0.28]) {
    const sxp = cx + rx * t
    const half = ry * Math.sqrt(Math.max(0.1, 1 - t * t)) * 0.92
    g += `<line x1="${fx(sxp)}" y1="${fx(cy - half)}" x2="${fx(sxp)}" y2="${fx(cy + half)}" stroke="${P.gold}" stroke-width="${fx(s * 0.11)}"/>`
  }
  g += `<circle cx="${fx(cx + rx * 0.92)}" cy="${fx(cy - ry * 0.22)}" r="${fx(ry * 0.62)}" fill="${P.bee}"/>`
  g += `<circle cx="${fx(cx + rx * 1.1)}" cy="${fx(cy - ry * 0.34)}" r="${fx(s * 0.035)}" fill="${P.wing}"/>`
  // stinger + legs
  g += `<path d="M ${fx(cx - rx)} ${fx(cy)} l ${fx(-s * 0.1)} ${fx(s * 0.04)}" stroke="${P.bee}" stroke-width="2"/>`
  for (const lt of [-0.3, 0.05, 0.4])
    g += `<path d="M ${fx(cx + rx * lt)} ${fx(cy + ry * 0.8)} q ${fx(s * 0.02)} ${fx(s * 0.12)} ${fx(-s * 0.05)} ${fx(s * 0.16)}" fill="none" stroke="${P.bee}" stroke-width="1.6"/>`
  // wings IN FRONT for the downstroke
  if (pose === 'wingsDown') {
    g += wing(cx - rx * 0.34, cy + ry * 1.3, s * 0.33, s * 0.14, 34)
    g += wing(cx + rx * 0.14, cy + ry * 1.35, s * 0.33, s * 0.14, 16)
  }
  // slate courier satchel, gold buckle (accent red stays reserved for seals)
  if (pose === 'satchel') {
    g += `<path d="M ${fx(cx - rx * 0.42)} ${fx(cy + ry * 0.55)} h ${fx(s * 0.34)} v ${fx(s * 0.22)} h ${fx(-s * 0.34)} Z" fill="${P.slate}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.5"/>`
    g += `<path d="M ${fx(cx - rx * 0.42)} ${fx(cy + ry * 0.55)} q ${fx(s * 0.17)} ${fx(-s * 0.3)} ${fx(s * 0.34)} 0" fill="none" stroke="${P.slate}" stroke-width="2.2"/>`
    g += `<circle cx="${fx(cx - rx * 0.25 + s * 0.17)}" cy="${fx(cy + ry * 0.55 + s * 0.11)}" r="${fx(s * 0.035)}" fill="${P.gold}"/>`
  }
  g += `</g>`
  return g
}

/** One courier envelope chip. kinds: face / back / sealed (sealed spends one
 *  of the pack's three wax-seal accents). */
function swarmEnvelope(cx, cy, s, kind, rot = 0) {
  const P = SWARM
  const wq = s
  const hq = s * 0.68
  let g = `<g transform="rotate(${rot} ${fx(cx)} ${fx(cy)})">`
  g += `<rect x="${fx(cx - wq / 2 - 3)}" y="${fx(cy - hq / 2 - 3)}" width="${fx(wq + 6)}" height="${fx(hq + 6)}" rx="3" fill="${RIM}" opacity="0.9"/>`
  g += `<rect x="${fx(cx - wq / 2)}" y="${fx(cy - hq / 2)}" width="${fx(wq)}" height="${fx(hq)}" fill="${kind === 'sealed' ? P.parch : P.cream}" stroke="${INK}" stroke-width="1.5" stroke-opacity="0.55"/>`
  if (kind === 'back') {
    for (const ly of [-0.12, 0.08, 0.28])
      g += `<line x1="${fx(cx - wq * 0.32)}" y1="${fx(cy + hq * ly)}" x2="${fx(cx + wq * 0.34)}" y2="${fx(cy + hq * ly)}" stroke="${P.slate}" stroke-width="1.6" opacity="0.65"/>`
    g += `<rect x="${fx(cx + wq * 0.16)}" y="${fx(cy - hq * 0.42)}" width="${fx(wq * 0.2)}" height="${fx(hq * 0.28)}" fill="${P.blue}" opacity="0.5" stroke="${INK}" stroke-width="0.8" stroke-opacity="0.4"/>` // stamp
  } else {
    g += `<path d="M ${fx(cx - wq / 2)} ${fx(cy - hq / 2)} L ${fx(cx)} ${fx(cy + hq * 0.12)} L ${fx(cx + wq / 2)} ${fx(cy - hq / 2)}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.5"/>`
    g += `<path d="M ${fx(cx - wq / 2)} ${fx(cy + hq / 2)} L ${fx(cx - wq * 0.14)} ${fx(cy + hq * 0.02)} M ${fx(cx + wq / 2)} ${fx(cy + hq / 2)} L ${fx(cx + wq * 0.14)} ${fx(cy + hq * 0.02)}" fill="none" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.35"/>`
  }
  if (kind === 'sealed') {
    g += `<circle cx="${fx(cx)}" cy="${fx(cy + hq * 0.1)}" r="${fx(s * 0.13)}" fill="${P.red}" stroke="#8c352a" stroke-width="1.4"/>`
    g += `<circle cx="${fx(cx - s * 0.035)}" cy="${fx(cy + hq * 0.1 - s * 0.035)}" r="${fx(s * 0.045)}" fill="#c96a5c" opacity="0.8"/>`
  }
  g += `</g>`
  return g
}

/** One twine-wrapped parcel chip. */
function swarmParcel(cx, cy, s, tall, rot = 0) {
  const P = SWARM
  const wq = s
  const hq = s * (tall ? 0.9 : 0.62)
  let g = `<g transform="rotate(${rot} ${fx(cx)} ${fx(cy)})">`
  g += `<rect x="${fx(cx - wq / 2 - 3)}" y="${fx(cy - hq / 2 - 3)}" width="${fx(wq + 6)}" height="${fx(hq + 6)}" rx="3" fill="${RIM}" opacity="0.9"/>`
  g += `<rect x="${fx(cx - wq / 2)}" y="${fx(cy - hq / 2)}" width="${fx(wq)}" height="${fx(hq)}" fill="${P.parch}" stroke="${INK}" stroke-width="1.5" stroke-opacity="0.55"/>`
  g += `<rect x="${fx(cx - wq / 2)}" y="${fx(cy + hq * 0.22)}" width="${fx(wq)}" height="${fx(hq * 0.28)}" fill="${P.amber}" opacity="0.25"/>`
  g += `<line x1="${fx(cx)}" y1="${fx(cy - hq / 2)}" x2="${fx(cx)}" y2="${fx(cy + hq / 2)}" stroke="${P.amber}" stroke-width="2.4"/>`
  g += `<line x1="${fx(cx - wq / 2)}" y1="${fx(cy)}" x2="${fx(cx + wq / 2)}" y2="${fx(cy)}" stroke="${P.amber}" stroke-width="2.4"/>`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(s * 0.07)}" fill="${P.amber}"/>`
  g += `<path d="M ${fx(cx)} ${fx(cy)} l ${fx(s * 0.1)} ${fx(-s * 0.08)} M ${fx(cx)} ${fx(cy)} l ${fx(-s * 0.1)} ${fx(-s * 0.07)}" stroke="${P.amber}" stroke-width="1.6" fill="none"/>`
  g += `</g>`
  return g
}

/** A honey drop (the tab handle motif, also a solo sprite). */
function swarmHoneyDrop(cx, cy, s) {
  const P = SWARM
  const d = `M ${fx(cx)} ${fx(cy - s * 0.52)} C ${fx(cx + s * 0.4)} ${fx(cy - s * 0.05)} ${fx(cx + s * 0.34)} ${fx(cy + s * 0.28)} ${fx(cx)} ${fx(cy + s * 0.42)} C ${fx(cx - s * 0.34)} ${fx(cy + s * 0.28)} ${fx(cx - s * 0.4)} ${fx(cy - s * 0.05)} ${fx(cx)} ${fx(cy - s * 0.52)} Z`
  let g = `<path d="${d}" fill="${SWARM.gold}" stroke="${SWARM.amber}" stroke-width="2"/>`
  g += `<ellipse cx="${fx(cx - s * 0.12)}" cy="${fx(cy - s * 0.08)}" rx="${fx(s * 0.09)}" ry="${fx(s * 0.16)}" fill="#f7e3ae" opacity="0.9"/>`
  g += rimPath(d, 4)
  return g
}

/** The full 8x8 sprite atlas (1024x1024, transparent ground). */
function swarmAtlas(w, h, seed) {
  const r = mulberry32(seed)
  const cs = w / 8
  const at = (i) => [(i % 8) * cs + cs / 2, Math.floor(i / 8) * cs + cs / 2]
  const S = cs * 0.62 // sprite major size inside a cell
  let s = `<g>`
  // --- cells 0-15: the 16 rider sprites (no two neighbors share one; the
  // solver's stride-7 sampling never puts equal cells adjacent) ---
  const bees = ['wingsUp', 'wingsMid', 'wingsDown', 'profile', 'bumble']
  bees.forEach((pose, i) => {
    const [cx, cy] = at(i)
    s += swarmBee(cx, cy, S * (pose === 'bumble' ? 0.86 : 0.94), pose)
  })
  {
    const [cx, cy] = at(5)
    s += swarmEnvelope(cx, cy, S * 0.9, 'face', rr(r, -9, -3))
  }
  {
    const [cx, cy] = at(6)
    s += swarmEnvelope(cx, cy, S * 0.88, 'back', rr(r, 3, 9))
  }
  {
    const [cx, cy] = at(7)
    s += swarmEnvelope(cx, cy, S * 0.9, 'sealed', rr(r, -6, 6)) // wax seal 1 of 3
  }
  {
    const [cx, cy] = at(8)
    s += swarmParcel(cx, cy, S * 0.78, false, rr(r, -8, -2))
  }
  {
    const [cx, cy] = at(9)
    s += swarmParcel(cx, cy, S * 0.66, true, rr(r, 2, 8))
  }
  {
    // letter-pair chainlet: two small envelopes strung on one thread
    const [cx, cy] = at(10)
    s += `<path d="M ${fx(cx - S * 0.42)} ${fx(cy - S * 0.3)} Q ${fx(cx)} ${fx(cy + S * 0.05)} ${fx(cx + S * 0.42)} ${fx(cy - S * 0.26)}" fill="none" stroke="${SWARM.slate}" stroke-width="1.8"/>`
    s += swarmEnvelope(cx - S * 0.22, cy + S * 0.08, S * 0.42, 'face', -8)
    s += swarmEnvelope(cx + S * 0.24, cy + S * 0.12, S * 0.38, 'back', 7)
  }
  {
    const [cx, cy] = at(11)
    s += swarmHoneyDrop(cx, cy, S * 0.8)
  }
  for (const [k, i] of [[0, 12], [1, 13]]) {
    const [cx, cy] = at(i)
    s += swarmBee(cx + (k ? -S * 0.05 : S * 0.04), cy, S * 0.62, 'scout')
  }
  {
    const [cx, cy] = at(14)
    s += swarmBee(cx, cy, S * 0.9, 'satchel')
  }
  {
    const [cx, cy] = at(15)
    s += swarmEnvelope(cx, cy, S * 0.84, 'face', -24)
  }
  // --- cell 16: the hairline strut swatch. OPAQUE full cell (the strut mesh
  // material carries no alpha test); sky-tinted with a lighter core so the
  // 4px screen hairline reads as lit paper, plus faint cut edges. ---
  {
    const x0 = (16 % 8) * cs
    const y0 = Math.floor(16 / 8) * cs
    s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cs)}" height="${fx(cs)}" fill="${SWARM.strut}"/>`
    s += `<rect x="${fx(x0 + cs * 0.3)}" y="${fx(y0)}" width="${fx(cs * 0.4)}" height="${fx(cs)}" fill="#bfd0dd"/>`
    s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cs * 0.07)}" height="${fx(cs)}" fill="${SWARM.blue}" opacity="0.55"/>`
    s += `<rect x="${fx(x0 + cs * 0.93)}" y="${fx(y0)}" width="${fx(cs * 0.07)}" height="${fx(cs)}" fill="${SWARM.blue}" opacity="0.55"/>`
  }
  // --- cells 17-18 + 25-26: the STIR tab (2x2 region, 256x256): the printed
  // banner arc over the die-cut bee-on-honey-drop pull. The red bow is wax
  // accent 2 of 3; the lettering is slate + gold (T-AFFORDANCE, celebrated).
  {
    const x0 = (17 % 8) * cs
    const y0 = Math.floor(17 / 8) * cs
    const tw = cs * 2
    const cx = x0 + tw / 2
    // dashed bee-loop swooping down toward the ribbon
    s += `<path d="M ${fx(x0 + tw * 0.2)} ${fx(y0 + cs * 0.42)} C ${fx(x0 + tw * 0.34)} ${fx(y0 + cs * 0.08)} ${fx(x0 + tw * 0.72)} ${fx(y0 + cs * 0.06)} ${fx(x0 + tw * 0.8)} ${fx(y0 + cs * 0.34)}" fill="none" stroke="${SWARM.amber}" stroke-width="2.6" stroke-dasharray="7 6" opacity="0.9"/>`
    s += swarmBee(x0 + tw * 0.18, y0 + cs * 0.38, cs * 0.26, 'scout')
    // ribbon: the full phrase stacked on two lines so nothing leaves the region
    s += `<rect x="${fx(x0 + tw * 0.13)}" y="${fx(y0 + cs * 0.5)}" width="${fx(tw * 0.74)}" height="${fx(cs * 0.62)}" rx="9" fill="${SWARM.slate}" stroke="${SWARM.gold}" stroke-width="2.4"/>`
    s += `<text x="${fx(cx)}" y="${fx(y0 + cs * 0.76)}" font-family="Georgia, 'Times New Roman', serif" font-size="${fx(cs * 0.17)}" font-weight="bold" text-anchor="middle" fill="${SWARM.cream}">STIR THE</text>`
    s += `<text x="${fx(cx)}" y="${fx(y0 + cs * 1.0)}" font-family="Georgia, 'Times New Roman', serif" font-size="${fx(cs * 0.17)}" font-weight="bold" text-anchor="middle" fill="${SWARM.cream}">SWARM</text>`
    s += `<text x="${fx(cx)}" y="${fx(y0 + cs * 1.28)}" font-family="Georgia, 'Times New Roman', serif" font-size="${fx(cs * 0.2)}" text-anchor="middle" fill="${SWARM.gold}">&#9660;</text>`
    // the pull: a fat honey drop with a perched bee; the red wax bow sits ON
    // the drop's neck (wax accent 2 of 3)
    s += swarmHoneyDrop(cx, y0 + cs * 1.66, cs * 0.6)
    s += swarmBee(cx + cs * 0.02, y0 + cs * 1.42, cs * 0.3, 'wingsUp')
    s += `<circle cx="${fx(cx - cs * 0.14)}" cy="${fx(y0 + cs * 1.52)}" r="${fx(cs * 0.07)}" fill="${SWARM.red}" stroke="#8c352a" stroke-width="1.6"/>`
  }
  // --- cells 19-22: the printed banner strip (512x128) reserved for the page
  // print composite ("STIR THE SWARM" affordance printed at the fore edge). ---
  {
    const x0 = (19 % 8) * cs
    const y0 = Math.floor(19 / 8) * cs
    const bw = cs * 4
    s += `<rect x="${fx(x0 + bw * 0.04)}" y="${fx(y0 + cs * 0.24)}" width="${fx(bw * 0.92)}" height="${fx(cs * 0.5)}" rx="10" fill="${SWARM.slate}" stroke="${SWARM.gold}" stroke-width="3"/>`
    s += `<path d="M ${fx(x0 + bw * 0.04)} ${fx(y0 + cs * 0.49)} l ${fx(-bw * 0.03)} 0 M ${fx(x0 + bw * 0.96)} ${fx(y0 + cs * 0.49)} l ${fx(bw * 0.03)} 0" stroke="${SWARM.gold}" stroke-width="3"/>`
    s += `<text x="${fx(x0 + bw / 2)}" y="${fx(y0 + cs * 0.62)}" font-family="Georgia, 'Times New Roman', serif" font-size="${fx(cs * 0.3)}" font-weight="bold" text-anchor="middle" fill="${SWARM.cream}">STIR THE SWARM &#9660;</text>`
  }
  s += `</g>`
  return svgPiece(w, h, s)
}

/** Flung crown bee (backdrop-crease child): wings-spread carrier with a tiny
 *  slate+gold satchel, filling the quad, crease at u 0.5. */
function crownBee(w, h, seed, k) {
  const r = mulberry32(seed)
  const cx = w / 2
  const cy = h * 0.56
  const s = h * 0.72
  let g = `<g>`
  // full-span upswept wings first (behind), spanning most of the card
  const wing = (wx, wy, wrx, wry, rot) =>
    `<ellipse cx="${fx(wx)}" cy="${fx(wy)}" rx="${fx(wrx + 3)}" ry="${fx(wry + 3)}" fill="${RIM}" opacity="0.9" transform="rotate(${rot} ${fx(wx)} ${fx(wy)})"/>` +
    `<ellipse cx="${fx(wx)}" cy="${fx(wy)}" rx="${fx(wrx)}" ry="${fx(wry)}" fill="${SWARM.wing}" opacity="0.94" stroke="${SWARM.slate}" stroke-width="1.6" stroke-opacity="0.6" transform="rotate(${rot} ${fx(wx)} ${fx(wy)})"/>`
  g += wing(cx - w * 0.24, cy - h * 0.22, w * 0.21, h * 0.13, -24 + k * 4)
  g += wing(cx + w * 0.24, cy - h * 0.24, w * 0.21, h * 0.13, 24 - k * 4)
  // wing veins
  for (const sgn of [-1, 1])
    g += `<path d="M ${fx(cx)} ${fx(cy - h * 0.1)} q ${fx(sgn * w * 0.16)} ${fx(-h * 0.16)} ${fx(sgn * w * 0.34)} ${fx(-h * 0.16)}" fill="none" stroke="${SWARM.blue}" stroke-width="1.6" opacity="0.7"/>`
  g += swarmBee(cx, cy, s, 'satchel')
  // a carried letter tucked under the legs (cream chip, slight tilt; NO wax —
  // the pack allots exactly 3 seals: strut letter, floor letter, stir tab)
  g += swarmEnvelope(cx + w * 0.02, cy + h * 0.24, s * 0.5, k === 2 ? 'back' : 'face', rr(r, -10, 10))
  g += `</g>`
  return svgPiece(w, h, g)
}

/**
 * THE s3 SPREAD PRINT (page-3, both pages in ONE image — the pack's third
 * read and "our biggest ref gap", the T-FLOOR). Same split/coordinate maths
 * as postRoadSpread (pageFX/pageFY; image TOP = far page edge z −0.75).
 *
 * The printed valley floor of the Guild of the Bee: warm parchment with a
 * meadow wash on the aprons; GOLD DASHED FLIGHT-ROUTES spiralling out of the
 * hive mouth (gutter, z ≈ 0.40) across BOTH pages; 10 painted flat bees + 6
 * painted letters strung along them, sizes grading DOWN toward the 3D ring
 * (2D paint accelerating into 3D paper — the Alice floor-cards recipe); tiny
 * parcels mid-route; a honeycomb compass rose under the free right yard; the
 * PAINTED APIARIST with smoke bellows lower-left (T-COUNTERWEIGHT — the
 * horseshoe's front gap is where the keeper stands), smoke curling toward
 * that gap; and a dashed bee-loop affordance leading to the die-cut STIR tab
 * (the tab itself carries the lettering, so the print points, never repeats).
 * The floor letter by the compass carries wax seal 3 of 3.
 */
function beeRoutesSpread(w, h, seed) {
  const r = mulberry32(seed)
  const PX = (f) => f * w
  const PY = (f) => f * h
  const WALNUT = '#5c4526'

  // cubic bezier evaluator + tangent in image fractions
  const bez = (P, t) => {
    const mt = 1 - t
    return [0, 1].map(
      (k) => mt * mt * mt * P[0][k] + 3 * mt * mt * t * P[1][k] + 3 * mt * t * t * P[2][k] + t * t * t * P[3][k]
    )
  }
  const bezTan = (P, t) => {
    const [x0, y0] = bez(P, Math.max(0, t - 0.01))
    const [x1, y1] = bez(P, Math.min(1, t + 0.01))
    return Math.atan2((y1 - y0) * h, (x1 - x0) * w) * (180 / Math.PI)
  }
  const pathOf = (P) =>
    `M ${fx(PX(P[0][0]))} ${fx(PY(P[0][1]))} C ${fx(PX(P[1][0]))} ${fx(PY(P[1][1]))} ${fx(PX(P[2][0]))} ${fx(PY(P[2][1]))} ${fx(PX(P[3][0]))} ${fx(PY(P[3][1]))}`

  // the routes, hive mouth -> both aprons (t=0 at the hive, t=1 at the edge)
  const HIVE = [0.5, pageFY(0.42)]
  const ROUTES = [
    [[0.515, 0.79], [0.63, 0.71], [0.78, 0.84], [0.97, 0.87]], // right outer
    [[0.512, 0.77], [0.6, 0.6], [0.73, 0.55], [0.9, 0.64]], // right inner, to the compass yard
    [[0.485, 0.79], [0.37, 0.72], [0.22, 0.86], [0.03, 0.88]], // left outer
    [[0.488, 0.77], [0.4, 0.62], [0.3, 0.56], [0.12, 0.63]], // left inner, past the windmill lane
  ]

  // a painted flat courier (top view) at image fraction (x,y), rotated along
  // its route: gold body, walnut line, paper-white wing pair.
  const flatBee = (x, y, s, ang, dim) => {
    let g = `<g transform="translate(${fx(PX(x))} ${fx(PY(y))}) rotate(${fx(ang)})" opacity="${fx(dim)}">`
    g += `<ellipse cx="0" cy="${fx(-s * 0.52)}" rx="${fx(s * 0.44)}" ry="${fx(s * 0.2)}" fill="${SWARM.wing}" stroke="${WALNUT}" stroke-width="1.1" stroke-opacity="0.5" transform="rotate(-24)"/>`
    g += `<ellipse cx="0" cy="${fx(s * 0.52)}" rx="${fx(s * 0.44)}" ry="${fx(s * 0.2)}" fill="${SWARM.wing}" stroke="${WALNUT}" stroke-width="1.1" stroke-opacity="0.5" transform="rotate(24)"/>`
    g += `<ellipse cx="0" cy="0" rx="${fx(s * 0.5)}" ry="${fx(s * 0.3)}" fill="${SWARM.gold}" stroke="${WALNUT}" stroke-width="1.4"/>`
    for (const t of [-0.12, 0.2]) g += `<line x1="${fx(s * t)}" y1="${fx(-s * 0.26)}" x2="${fx(s * t)}" y2="${fx(s * 0.26)}" stroke="${WALNUT}" stroke-width="${fx(s * 0.13)}"/>`
    g += `<circle cx="${fx(s * 0.56)}" cy="0" r="${fx(s * 0.16)}" fill="${SWARM.bee}"/>`
    g += `</g>`
    return g
  }
  const flatLetter = (x, y, s, ang, sealed) => {
    let g = `<g transform="translate(${fx(PX(x))} ${fx(PY(y))}) rotate(${fx(ang)})" opacity="0.9">`
    g += `<rect x="${fx(-s * 0.5)}" y="${fx(-s * 0.34)}" width="${fx(s)}" height="${fx(s * 0.68)}" fill="${SWARM.cream}" stroke="${WALNUT}" stroke-width="1.3"/>`
    g += `<path d="M ${fx(-s * 0.5)} ${fx(-s * 0.34)} L 0 ${fx(s * 0.08)} L ${fx(s * 0.5)} ${fx(-s * 0.34)}" fill="none" stroke="${WALNUT}" stroke-width="1.1" opacity="0.6"/>`
    if (sealed) g += `<circle cx="0" cy="${fx(s * 0.06)}" r="${fx(s * 0.14)}" fill="${SWARM.red}" stroke="#8c352a" stroke-width="1.2"/>`
    g += `</g>`
    return g
  }
  const flatParcel = (x, y, s, ang) => {
    let g = `<g transform="translate(${fx(PX(x))} ${fx(PY(y))}) rotate(${fx(ang)})" opacity="0.85">`
    g += `<rect x="${fx(-s * 0.42)}" y="${fx(-s * 0.34)}" width="${fx(s * 0.84)}" height="${fx(s * 0.68)}" fill="${SWARM.parch}" stroke="${WALNUT}" stroke-width="1.2"/>`
    g += `<line x1="0" y1="${fx(-s * 0.34)}" x2="0" y2="${fx(s * 0.34)}" stroke="${SWARM.amber}" stroke-width="1.6"/>`
    g += `<line x1="${fx(-s * 0.42)}" y1="0" x2="${fx(s * 0.42)}" y2="0" stroke="${SWARM.amber}" stroke-width="1.6"/>`
    g += `</g>`
    return g
  }

  let s = `<g>`
  s += `<rect width="${w}" height="${h}" fill="${SWARM.parch}"/>`
  // laid-paper tooth
  for (let i = 0; i < 170; i++) {
    const y = rr(r, 0, h)
    s += `<line x1="0" y1="${fx(y)}" x2="${w}" y2="${fx(y)}" stroke="${WALNUT}" stroke-width="1" opacity="${fx(rr(r, 0.02, 0.05))}"/>`
  }
  // the meadow wash: soft green on the reader aprons, thinning toward the ring
  // lane so the die-cut world stays the star
  s += `<rect y="${fx(h * 0.52)}" width="${w}" height="${fx(h * 0.48)}" fill="url(#meadowWash)"/>`
  // grass ticks + tiny meadow flowers, apron band only
  for (let i = 0; i < 130; i++) {
    const x = rr(r, 0, w)
    const y = rr(r, h * 0.6, h * 0.985)
    const gl = rr(r, 5, 13) * (y / h)
    s += `<path d="M ${fx(x)} ${fx(y)} q ${fx(rr(r, -3, 3))} ${fx(-gl)} ${fx(rr(r, -2, 2))} ${fx(-gl * 1.25)}" fill="none" stroke="${SWARM.meadow}" stroke-width="1.3" opacity="${fx(rr(r, 0.25, 0.5))}"/>`
    if (i % 11 === 4) s += `<circle cx="${fx(x)}" cy="${fx(y - gl)}" r="${fx(rr(r, 1.6, 3))}" fill="${['#d9a441', '#c46a6a', '#e6e0b0'][i % 3]}" opacity="0.7"/>`
  }
  // far half hazes out; the backdrop glues over most of it at rest
  s += `<rect width="${w}" height="${fx(h * 0.36)}" fill="url(#pageHaze3)"/>`
  // gutter valley shadow
  s += `<rect x="${fx(w * 0.46)}" y="0" width="${fx(w * 0.08)}" height="${h}" fill="url(#pageGutter3)"/>`

  // ---- THE GOLD ROUTES: dashed spirals out of the hive mouth, an amber echo
  // under each so they read as painted ribbon, not plot lines.
  for (const P of ROUTES) {
    s += `<path d="${pathOf(P)}" fill="none" stroke="${SWARM.amber}" stroke-width="5" opacity="0.18"/>`
    s += `<path d="${pathOf(P)}" fill="none" stroke="${SWARM.gold}" stroke-width="2.8" stroke-dasharray="11 9" opacity="0.85"/>`
  }
  // the hive mouth they all pour from
  s += `<ellipse cx="${fx(PX(HIVE[0]))}" cy="${fx(PY(HIVE[1]))}" rx="${fx(PX(0.024))}" ry="${fx(PY(0.016))}" fill="${SWARM.amber}" opacity="0.35"/>`
  s += `<ellipse cx="${fx(PX(HIVE[0]))}" cy="${fx(PY(HIVE[1]))}" rx="${fx(PX(0.024))}" ry="${fx(PY(0.016))}" fill="none" stroke="${WALNUT}" stroke-width="2" opacity="0.5"/>`

  // ---- COURIERS ALONG THE ROUTES: 10 bees + 6 letters + 3 parcels, sizes
  // grading DOWN toward the hive/ring (t=0) and UP toward the reader corners.
  const BEE_STATIONS = [
    [0, 0.3], [0, 0.62], [0, 0.9], [1, 0.45], [1, 0.8],
    [2, 0.28], [2, 0.58], [2, 0.88], [3, 0.5], [3, 0.85],
  ]
  for (const [ri, t] of BEE_STATIONS) {
    const [x, y] = bez(ROUTES[ri], t)
    const sz = w * lerp(0.011, 0.024, t) * rr(r, 0.9, 1.1)
    s += flatBee(x, y + rr(r, -0.012, 0.012), sz, bezTan(ROUTES[ri], t) + rr(r, -14, 14), lerp(0.7, 0.95, t))
  }
  const LETTER_STATIONS = [[0, 0.48], [0, 0.76], [1, 0.62], [2, 0.42], [2, 0.72], [3, 0.68]]
  LETTER_STATIONS.forEach(([ri, t], i) => {
    const [x, y] = bez(ROUTES[ri], t)
    const sz = w * lerp(0.014, 0.026, t)
    // the ONE sealed floor letter (wax 3 of 3) rides the compass-yard route
    s += flatLetter(x, y + rr(r, -0.01, 0.014), sz, bezTan(ROUTES[ri], t) + rr(r, -30, 30), i === 2)
  })
  for (const [ri, t] of [[1, 0.3], [3, 0.32], [0, 0.86]]) {
    const [x, y] = bez(ROUTES[ri], t)
    s += flatParcel(x, y + rr(r, -0.01, 0.01), w * lerp(0.012, 0.02, t), rr(r, -35, 35))
  }

  // ---- HONEYCOMB COMPASS ROSE under the free right yard (radial ~0.62,
  // z ~0.42): a lying compass DIAL — outer ring circle with cardinal ticks,
  // a honeycomb patch of 7 small hexes at its heart, a gold needle flying at
  // the hive with a bee on its tail. (Concentric hexes + spokes read as an
  // isometric crate at this squash — measured on the first bake.)
  {
    const cx = PX(pageFX(0.62, 'right'))
    const cy = PY(pageFY(0.4))
    const SQ = 0.68 // lying-flat foreshortening
    const R = w * 0.082
    s += `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(R)}" ry="${fx(R * SQ)}" fill="${SWARM.gold}" opacity="0.08"/>`
    s += `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(R)}" ry="${fx(R * SQ)}" fill="none" stroke="${SWARM.amber}" stroke-width="2.2" opacity="0.5"/>`
    s += `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(R * 0.8)}" ry="${fx(R * 0.8 * SQ)}" fill="none" stroke="${SWARM.amber}" stroke-width="1.2" stroke-dasharray="5 6" opacity="0.42"/>`
    // cardinal + intercardinal ticks on the outer ring
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4
      const len = k % 2 === 0 ? 0.14 : 0.07
      s += `<line x1="${fx(cx + Math.cos(a) * R * (1 - len))}" y1="${fx(cy + Math.sin(a) * R * (1 - len) * SQ)}" x2="${fx(cx + Math.cos(a) * R * 1.06)}" y2="${fx(cy + Math.sin(a) * R * 1.06 * SQ)}" stroke="${SWARM.amber}" stroke-width="${k % 2 === 0 ? 2.4 : 1.4}" opacity="0.55"/>`
    }
    // the honeycomb heart: 7 tiny pointy-top hexes clustered at the center
    const hex = (hx, hy, hr) =>
      `<polygon points="${Array.from({ length: 6 }, (_, k) => {
        const a = Math.PI / 2 + (k * Math.PI) / 3
        return `${fx(hx + Math.cos(a) * hr)},${fx(hy + Math.sin(a) * hr * SQ)}`
      }).join(' ')}" fill="${SWARM.gold}" fill-opacity="0.14" stroke="${SWARM.amber}" stroke-width="1.3" opacity="0.6"/>`
    const hr = R * 0.17
    s += hex(cx, cy, hr)
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3
      s += hex(cx + Math.cos(a) * hr * 1.74, cy + Math.sin(a) * hr * 1.74 * SQ, hr)
    }
    // the needle: a clear gold arrow flying at the hive, a bee on its tail
    const na = Math.atan2((PY(HIVE[1]) - cy) / SQ, PX(HIVE[0]) - cx)
    const ne = [cx + Math.cos(na) * R * 0.94, cy + Math.sin(na) * R * 0.94 * SQ]
    s += `<line x1="${fx(cx - Math.cos(na) * R * 0.5)}" y1="${fx(cy - Math.sin(na) * R * 0.5 * SQ)}" x2="${fx(ne[0])}" y2="${fx(ne[1])}" stroke="${SWARM.gold}" stroke-width="3" opacity="0.9"/>`
    s += `<path d="M ${fx(ne[0])} ${fx(ne[1])} l ${fx(-Math.cos(na - 0.42) * w * 0.016)} ${fx(-Math.sin(na - 0.42) * w * 0.016 * SQ)} M ${fx(ne[0])} ${fx(ne[1])} l ${fx(-Math.cos(na + 0.42) * w * 0.016)} ${fx(-Math.sin(na + 0.42) * w * 0.016 * SQ)}" stroke="${SWARM.gold}" stroke-width="3" fill="none" opacity="0.9"/>`
    s += flatBee(pageFX(0.62, 'right') - (Math.cos(na) * R * 0.62) / w, pageFY(0.4) - (Math.sin(na) * R * 0.62 * SQ) / h, w * 0.012, (na * 180) / Math.PI, 0.9)
  }

  // ---- THE PAINTED APIARIST, lower-left apron (T-COUNTERWEIGHT): a robed
  // keeper in slate with a wide veil hat, puffing the smoke bellows toward the
  // horseshoe's front gap — the gap is STORY: it is where the keeper stands.
  {
    const kx = PX(pageFX(0.66, 'left'))
    const ky = PY(pageFY(0.56))
    const S = w * 0.052
    let g = `<g opacity="0.92">`
    g += `<path d="M ${fx(kx - S * 0.34)} ${fx(ky + S * 0.9)} Q ${fx(kx - S * 0.42)} ${fx(ky - S * 0.1)} ${fx(kx - S * 0.06)} ${fx(ky - S * 0.42)} L ${fx(kx + S * 0.18)} ${fx(ky - S * 0.34)} Q ${fx(kx + S * 0.4)} ${fx(ky + S * 0.1)} ${fx(kx + S * 0.3)} ${fx(ky + S * 0.9)} Z" fill="${SWARM.slate}" stroke="${WALNUT}" stroke-width="1.6"/>` // robe
    g += `<circle cx="${fx(kx + S * 0.04)}" cy="${fx(ky - S * 0.58)}" r="${fx(S * 0.2)}" fill="${SWARM.cream}" stroke="${WALNUT}" stroke-width="1.4"/>` // veiled head
    g += `<path d="M ${fx(kx - S * 0.3)} ${fx(ky - S * 0.62)} Q ${fx(kx + S * 0.04)} ${fx(ky - S * 0.95)} ${fx(kx + S * 0.38)} ${fx(ky - S * 0.62)} Z" fill="${SWARM.gold}" stroke="${WALNUT}" stroke-width="1.4"/>` // wide hat
    // the bellows: two amber boards pinched around a cream pleat, a dark nozzle
    g += `<path d="M ${fx(kx + S * 0.24)} ${fx(ky - S * 0.16)} l ${fx(S * 0.42)} ${fx(-S * 0.1)} l ${fx(S * 0.02)} ${fx(S * 0.1)} l ${fx(-S * 0.42)} ${fx(S * 0.06)} Z" fill="${SWARM.amber}" stroke="${WALNUT}" stroke-width="1.3"/>`
    g += `<path d="M ${fx(kx + S * 0.26)} ${fx(ky + S * 0.08)} l ${fx(S * 0.42)} ${fx(-S * 0.02)} l ${fx(-S * 0.02)} ${fx(S * 0.12)} l ${fx(-S * 0.38)} ${fx(-S * 0.02)} Z" fill="${SWARM.amber}" stroke="${WALNUT}" stroke-width="1.3"/>`
    g += `<path d="M ${fx(kx + S * 0.66)} ${fx(ky - S * 0.22)} L ${fx(kx + S * 0.72)} ${fx(ky + S * 0.14)} L ${fx(kx + S * 0.5)} ${fx(ky + S * 0.02)} Z" fill="${SWARM.cream}" stroke="${WALNUT}" stroke-width="1.2"/>`
    g += `<line x1="${fx(kx + S * 0.7)}" y1="${fx(ky - S * 0.04)}" x2="${fx(kx + S * 0.88)}" y2="${fx(ky - S * 0.02)}" stroke="${WALNUT}" stroke-width="2.4"/>`
    g += `</g>`
    s += g
    // the smoke: a thin curling wisp puffed toward the horseshoe's front gap
    // at the gutter (down-right toward the hive mouth), loosening as it goes
    const smoke = `M ${fx(kx + S * 0.92)} ${fx(ky - S * 0.02)} c ${fx(S * 0.5)} ${fx(-S * 0.3)} ${fx(S * 0.62)} ${fx(S * 0.28)} ${fx(S * 1.12)} ${fx(S * 0.06)} c ${fx(S * 0.42)} ${fx(-S * 0.18)} ${fx(S * 0.54)} ${fx(S * 0.32)} ${fx(S * 1.06)} ${fx(S * 0.16)} c ${fx(S * 0.44)} ${fx(-S * 0.14)} ${fx(S * 0.86)} ${fx(S * 0.1)} ${fx(S * 1.5)} ${fx(S * 0.34)}`
    s += `<path d="${smoke}" fill="none" stroke="#f3ecda" stroke-width="${fx(S * 0.13)}" stroke-linecap="round" opacity="0.75"/>`
    s += `<path d="${smoke}" fill="none" stroke="${WALNUT}" stroke-width="1" opacity="0.28"/>`
    // three thinning puffs where the wisp dies at the gap
    for (const [px2, py2, pr] of [[4.35, 0.5, 0.16], [4.75, 0.62, 0.11], [5.05, 0.72, 0.07]])
      s += `<circle cx="${fx(kx + S * px2)}" cy="${fx(ky + S * py2)}" r="${fx(S * pr)}" fill="#f3ecda" opacity="0.55"/>`
  }

  // ---- AFFORDANCE TRAIL to the STIR tab (fore edge right, z 0.30-0.42): the
  // die-cut tab carries its own lettering, so the print POINTS — a dashed
  // amber bee-loop curling from the compass yard into the tab's seat.
  {
    const d = `M ${fx(PX(pageFX(0.74, 'right')))} ${fx(PY(pageFY(0.44)))} C ${fx(PX(pageFX(0.88, 'right')))} ${fx(PY(pageFY(0.52)))} ${fx(PX(pageFX(0.92, 'right')))} ${fx(PY(pageFY(0.28)))} ${fx(PX(pageFX(1.0, 'right')))} ${fx(PY(pageFY(0.36)))}`
    s += `<path d="${d}" fill="none" stroke="${SWARM.amber}" stroke-width="2.4" stroke-dasharray="8 7" opacity="0.8"/>`
    s += `<path d="M ${fx(PX(pageFX(1.0, 'right')))} ${fx(PY(pageFY(0.36)))} l ${fx(-w * 0.011)} ${fx(-h * 0.014)} l ${fx(w * 0.016)} ${fx(h * 0.012)} l ${fx(-w * 0.015)} ${fx(h * 0.013)} Z" fill="${SWARM.amber}" opacity="0.85"/>`
  }

  s += `<rect width="${w}" height="${h}" fill="url(#pageVig3)"/>`
  s += `</g>`

  const defs =
    `<linearGradient id="meadowWash" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${SWARM.meadow}" stop-opacity="0"/>` +
    `<stop offset="0.55" stop-color="${SWARM.meadow}" stop-opacity="0.16"/>` +
    `<stop offset="1" stop-color="${SWARM.meadow}" stop-opacity="0.3"/></linearGradient>` +
    `<linearGradient id="pageHaze3" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#f2ead2" stop-opacity="0.85"/>` +
    `<stop offset="1" stop-color="#f2ead2" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="pageGutter3" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${WALNUT}" stop-opacity="0"/>` +
    `<stop offset="0.5" stop-color="${WALNUT}" stop-opacity="0.28"/>` +
    `<stop offset="1" stop-color="${WALNUT}" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="pageVig3" cx="0.5" cy="0.55" r="0.75">` +
    `<stop offset="0.5" stop-color="${WALNUT}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${WALNUT}" stop-opacity="0.26"/></radialGradient>`

  return svgPiece(w, h, s, defs)
}

/** Flat cut-paper cloud (ref-10 register): white lobes over a sky-wash base,
 *  slate underside hint, transparent elsewhere. */
function cloudPatch(w, h, seed) {
  const r = mulberry32(seed)
  const baseY = h * 0.78
  const lobes = []
  const n = 6
  for (let i = 0; i <= n; i++) {
    const x = lerp(w * 0.08, w * 0.92, i / n) + rr(r, -w * 0.02, w * 0.02)
    const lr = h * rr(r, 0.26, 0.44) * (i === 0 || i === n ? 0.6 : 1)
    lobes.push([x, baseY - lr * 0.55, lr])
  }
  let g = `<g>`
  // rim halo pass, then the lobes, then a flat base line closing the cut
  for (const [x, y, lr] of lobes) g += `<circle cx="${fx(x)}" cy="${fx(y)}" r="${fx(lr + 4)}" fill="${RIM}" opacity="0.9"/>`
  g += `<rect x="${fx(w * 0.05)}" y="${fx(baseY - 4)}" width="${fx(w * 0.9)}" height="${fx(h * 0.16)}" rx="8" fill="${RIM}" opacity="0.9"/>`
  for (const [x, y, lr] of lobes) g += `<circle cx="${fx(x)}" cy="${fx(y)}" r="${fx(lr)}" fill="#fdfefe"/>`
  g += `<rect x="${fx(w * 0.06)}" y="${fx(baseY - h * 0.1)}" width="${fx(w * 0.88)}" height="${fx(h * 0.14)}" rx="7" fill="#fdfefe"/>`
  // sky-wash shading inside the lower half + slate underside
  for (const [x, y, lr] of lobes) g += `<circle cx="${fx(x + lr * 0.12)}" cy="${fx(y + lr * 0.3)}" r="${fx(lr * 0.72)}" fill="${SWARM.sky}" opacity="0.8"/>`
  g += `<rect x="${fx(w * 0.08)}" y="${fx(baseY - h * 0.02)}" width="${fx(w * 0.84)}" height="${fx(h * 0.06)}" fill="${SWARM.blue}" opacity="0.35"/>`
  g += `</g>`
  return svgPiece(w, h, g)
}

/** Linked-rank chain (T-LINKED-RANK): 2 bees + a strung cream envelope on one
 *  painted thread — ONE die-cut silhouette overhanging the fringe top. */
function chainLink(w, h, seed, mirrored) {
  const r = mulberry32(seed)
  const m = (x) => (mirrored ? w - x : x)
  let g = `<g>`
  // the thread: one sagging catenary the whole chain hangs from
  const thread = `M ${fx(m(w * 0.04))} ${fx(h * 0.34)} C ${fx(m(w * 0.3))} ${fx(h * 0.62)} ${fx(m(w * 0.62))} ${fx(h * 0.14)} ${fx(m(w * 0.96))} ${fx(h * 0.4)}`
  g += `<path d="${thread}" fill="none" stroke="${RIM}" stroke-width="6" opacity="0.9"/>`
  g += `<path d="${thread}" fill="none" stroke="${SWARM.slate}" stroke-width="2" opacity="0.9"/>`
  // bee 1 leads, envelope strung mid-thread, bee 2 trails higher
  g += swarmBee(m(w * 0.14), h * 0.3, h * 0.34, 'wingsMid')
  g += `<line x1="${fx(m(w * 0.47))}" y1="${fx(h * 0.38)}" x2="${fx(m(w * 0.47))}" y2="${fx(h * 0.52)}" stroke="${SWARM.slate}" stroke-width="1.8"/>`
  g += swarmEnvelope(m(w * 0.47), h * 0.66, h * 0.42, 'face', rr(r, -7, 7))
  g += swarmBee(m(w * 0.8), h * 0.26, h * 0.3, 'wingsUp')
  // two tiny honey drops falling off the thread
  for (const [tx, ty] of [[0.32, 0.62], [0.64, 0.4]])
    g += `<circle cx="${fx(m(w * tx))}" cy="${fx(h * ty)}" r="${fx(h * 0.035)}" fill="${SWARM.gold}" stroke="${SWARM.amber}" stroke-width="1.2"/>`
  g += `</g>`
  return svgPiece(w, h, g)
}

async function bakePieceTexture(piece, outDir) {
  const svg = piece.paint()
  const flat = await sharp(Buffer.from(svg)).png().toBuffer()
  const meta = await sharp(flat).metadata()
  const W = meta.width,
    H = meta.height
  const flatRaw = await sharp(flat).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const grainCut = await grainOverArt(flatRaw, W, H, piece.seed, piece.grain ?? 16)
  const composed = await sharp(flat).composite([{ input: grainCut, blend: 'over' }]).png().toBuffer()
  // per-piece quality override: big smooth-gradient fields (page prints)
  // band into scalloped blocks at q84 once grain nudges the quantizer
  const webp = await sharp(composed).webp({ quality: piece.quality ?? 84 }).toBuffer()
  await writeFile(path.join(outDir, `${piece.id}.webp`), webp)
  return { id: piece.id, W, H, bytes: webp.length }
}

// The texture-only piece bakes. `w`/`h` are pixel dims chosen at each piece's
// true mesh aspect (content.ts width/height), long edge <= 1024 (<= 512 for
// slivers, G5). Seeds are distinct per piece for grain determinism.
const PIECES = [
  // ---- Spread 8 — the Hero's Satchel ----
  { id: 'satchel-bag', seed: 80101, w: 1024, h: 614, grain: 14, paint() { return leatherSatchel(this.w, this.h, this.seed) } },
  { id: 'satchel-burst-m0', seed: 80110, w: 640, h: 640, grain: 12, paint() { return treasureRay(this.w, this.h, this.seed, 0) } },
  { id: 'satchel-burst-m1', seed: 80111, w: 700, h: 595, grain: 12, paint() { return treasureRay(this.w, this.h, this.seed, 1) } },
  { id: 'satchel-burst-m2', seed: 80112, w: 760, h: 547, grain: 12, paint() { return treasureRay(this.w, this.h, this.seed, 2) } },
  { id: 'satchel-table-deck', seed: 80120, w: 1024, h: 445, grain: 16, paint() { return mapTableDeck(this.w, this.h, this.seed) } },
  { id: 'satchel-scroll', seed: 80130, w: 288, h: 512, grain: 12, paint() { return rolledScroll(this.w, this.h, this.seed) } },
  // (the depth vista's 3 graded wing flaps are SHAPED-MESH bakes — they carry
  //  outline sidecars, so they run through bakeVistaWing / VISTA_WINGS, not here.)
  // ---- Spread 9 — the End (writing-desk vignette; E2.2 endpapers rebuild) ----
  { id: 'end-letter', seed: 90101, w: 1024, h: 699, grain: 14, paint() { return foldedLetter(this.w, this.h, this.seed) } },
  // the postmarked ROUTE-CARDS fan (warm; was the cold-green distant hills)
  { id: 'end-routes-m0', seed: 90110, w: 1024, h: 512, grain: 12, paint() { return routeCards(this.w, this.h, this.seed, 0) } },
  { id: 'end-routes-m1', seed: 90111, w: 1024, h: 446, grain: 12, paint() { return routeCards(this.w, this.h, this.seed, 1) } },
  { id: 'end-routes-m2', seed: 90112, w: 1024, h: 405, grain: 12, paint() { return routeCards(this.w, this.h, this.seed, 2) } },
  // the raven LAUNCHING on the kinetic arm (portrait; image top = up the ridge)
  { id: 'end-raven', seed: 90120, w: 560, h: 904, grain: 10, paint() { return ravenLaunch(this.w, this.h, this.seed) } },
  { id: 'end-mound', seed: 90130, w: 768, h: 256, grain: 16, paint() { return deskBand(this.w, this.h, this.seed) } },
  { id: 'end-mound-tuft', seed: 90140, w: 512, h: 448, grain: 12, paint() { return deskTuft(this.w, this.h, this.seed) } },
  // ---- Spread 1 — the Title (overture proscenium; E2.2 endpapers rebuild) ----
  { id: 'title-border', seed: 10101, w: 1024, h: 397, grain: 14, paint() { return titleBanner(this.w, this.h, this.seed) } },
  { id: 'title-crest', seed: 10110, w: 640, h: 462, grain: 10, paint() { return heraldCrest(this.w, this.h, this.seed) } },
  { id: 'title-swell', seed: 10120, w: 768, h: 256, grain: 16, paint() { return earthBerm(this.w, this.h, this.seed, 'grass') } },
  { id: 'title-swell-seal', seed: 10130, w: 512, h: 398, grain: 12, paint() { return sealTuft(this.w, this.h, this.seed) } },
  // ---- Spread 3 — the Carrier Swarm (ch2 hive box, meadow, fringe) ----
  { id: 'ch2-hive-front', seed: 30201, w: 512, h: 398, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'front', 'hive') } },
  { id: 'ch2-hive-back', seed: 30202, w: 512, h: 398, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'back', 'hive') } },
  { id: 'ch2-hive-side', seed: 30203, w: 439, h: 512, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'side', 'hive') } },
  { id: 'ch2-hive-top', seed: 30204, w: 512, h: 341, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'top', 'hive') } },
  { id: 'ch2-hive-swarm', seed: 30210, w: 512, h: 320, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'hiveSwarm') } },
  { id: 'ch2-hive-flowers', seed: 30211, w: 512, h: 256, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'flowers') } },
  // (ch2-meadow-deck retired with the meadow platform — the swarm owns its
  //  lane and its texture budget now; E3 s3 pack §2.)
  { id: 'ch2-fringe', seed: 30230, w: 1024, h: 188, grain: 14, paint() { return meadowFringe(this.w, this.h, this.seed) } },
  { id: 'ch2-windmill', seed: 30240, w: 512, h: 620, grain: 12, paint() { return windmillSail(this.w, this.h, this.seed) } },
  // ---- Spread 3 — THE CARRIER SWARM (E3 s3): the swarmarc sprite atlas, the
  // crown accent trio's two new bees, the cloud interleave, the fringe chains.
  // Pixel dims at each piece's true mesh aspect (content.ts), slivers <= 512.
  { id: 'ch2-swarm-atlas', seed: 30250, w: 1024, h: 1024, grain: 8, paint() { return swarmAtlas(this.w, this.h, this.seed) } },
  { id: 'ch2-crown-b', seed: 30260, w: 256, h: 146, grain: 8, paint() { return crownBee(this.w, this.h, this.seed, 1) } },
  { id: 'ch2-crown-c', seed: 30261, w: 256, h: 138, grain: 8, paint() { return crownBee(this.w, this.h, this.seed, 2) } },
  { id: 'ch2-cloud-l', seed: 30270, w: 512, h: 188, grain: 8, paint() { return cloudPatch(this.w, this.h, this.seed) } },
  { id: 'ch2-cloud-r', seed: 30271, w: 512, h: 197, grain: 8, paint() { return cloudPatch(this.w, this.h, this.seed) } },
  { id: 'ch2-chain-l', seed: 30280, w: 512, h: 181, grain: 8, paint() { return chainLink(this.w, this.h, this.seed, false) } },
  { id: 'ch2-chain-r', seed: 30281, w: 512, h: 192, grain: 8, paint() { return chainLink(this.w, this.h, this.seed, true) } },
  // the s3 spread print — the T-FLOOR (gold routes / painted couriers /
  // compass rose / apiarist counterweight / tab affordance trail)
  { id: 'page-3', seed: 30350, w: 1024, h: 683, grain: 10, paint() { return beeRoutesSpread(this.w, this.h, this.seed) } },
  // ---- Spread 5 — the Vault-Dragon of the Golden Dunes (E3 VAULT_NIGHT) ----
  // The nocturne massif atlas: 4 dune rank rows + 2 valley gusset rows on ONE
  // 1024 page (layout contract: popup-mfoldrange.ts MFOLD_ATLAS_ROWS).
  { id: 'ch4-range', seed: 50250, w: 1024, h: 1024, grain: 12, paint() { return rangeAtlas(this.w, this.h, this.seed) } },
  // The precious object: gold-foil vault-dragon coiled on the round door.
  { id: 'ch4-hero', seed: 50252, w: 1024, h: 800, grain: 10, paint() { return vaultDragon(this.w, this.h, this.seed) } },
  // Dress mesh 0.34 x 0.30 world -> canvas at the true aspect (1.133) so the
  // guilloché ring displays ROUND, not squashed to an ellipse.
  { id: 'ch4-aureole', seed: 50254, w: 512, h: 452, grain: 8, paint() { return guillocheAureole(this.w, this.h, this.seed) } },
  // Frieze mesh 1.5 x 0.16 world = 9.375 -> 1024x109 (the fringe convention:
  // ch2 1024x188 = 5.45, ch3 1024x144 = 7.11; 192px displayed 1.76x squashed).
  { id: 'ch4-frieze', seed: 50256, w: 1024, h: 109, grain: 10, paint() { return caravanFrieze(this.w, this.h, this.seed) } },
  // The celebrated brass PULL tab itself (popup-dissolve-layer.tsx requests
  // `<id>-tab`, falling back to the shared kraft grip when absent).
  { id: 'ch4-dissolve-tab', seed: 50259, w: 284, h: 512, grain: 8, paint() { return dissolveTabPlate(this.w, this.h, this.seed) } },
  // The T-FLOOR page print: rippled sand->gold fans, apron -> placard -> notch.
  // 1024 long edge like page-4 (use-layer-texture downscales to 1024 anyway —
  // larger only re-opens the G5 oversize violation this pack closes).
  { id: 'page-5', seed: 50258, w: 1024, h: 683, grain: 6, quality: 92, paint() { return vaultFloorPrint(this.w, this.h, this.seed) } },
  // (legacy ch4 group: chest box, hoard, goldpile — regraded by the E3 pass)
  { id: 'ch4-chest-front', seed: 50201, w: 512, h: 256, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'front', 'chest') } },
  { id: 'ch4-chest-back', seed: 50202, w: 512, h: 256, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'back', 'chest') } },
  { id: 'ch4-chest-side', seed: 50203, w: 512, h: 512, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'side', 'chest') } },
  { id: 'ch4-chest-lid', seed: 50210, w: 476, h: 512, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'chestLid') } },
  { id: 'ch4-chest-spill', seed: 50211, w: 512, h: 384, grain: 12, paint() { return dressPatch(this.w, this.h, this.seed, 'goldSpill') } },
  { id: 'ch4-hoard-deck', seed: 50220, w: 1024, h: 244, grain: 14, paint() { return deckSurface(this.w, this.h, this.seed, 'hoard') } },
  { id: 'ch4-goldpile-face', seed: 50230, w: 900, h: 900, grain: 14, paint() { return goldHeap(this.w, this.h, this.seed) } },
  // the pull-tab DISSOLVE: dunes (A) and gold (B) share one composition (matching
  // ridgelines) so the venetian flip transmutes desert -> hoard. Aspect w:h =
  // (d1-d0):(z1-z0) = 0.52:0.40 ~ 1.30:1; sliced into 6 vertical slat strips.
  { id: 'ch4-dissolve-dunes', seed: 50240, w: 1024, h: 788, grain: 12, paint() { return dissolveDunes(this.w, this.h, this.seed) } },
  { id: 'ch4-dissolve-gold', seed: 50241, w: 1024, h: 788, grain: 12, paint() { return dissolveGold(this.w, this.h, this.seed) } },
  // ---- Spread 6 — the Bazaar (ch5 stall box, goods, arch dress) ----
  { id: 'ch5-stall-back', seed: 60201, w: 512, h: 320, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'back', 'stall') } },
  { id: 'ch5-stall-side', seed: 60202, w: 512, h: 349, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'side', 'stall') } },
  { id: 'ch5-stall-top', seed: 60203, w: 512, h: 470, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'top', 'stall') } },
  { id: 'ch5-stall-valance', seed: 60210, w: 640, h: 224, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'valance') } },
  { id: 'ch5-stall-crates', seed: 60211, w: 512, h: 384, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'crates') } },
  { id: 'ch5-goods-deck', seed: 60220, w: 584, h: 512, grain: 16, paint() { return deckSurface(this.w, this.h, this.seed, 'goods') } },
  { id: 'ch5-arch-garland', seed: 60230, w: 768, h: 256, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'garland') } },
  { id: 'ch5-arch-keystone', seed: 60231, w: 420, h: 420, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'keystone') } },
  // ---- Spread 2 — the Inn (E3 stage set: three graded gutter-spanning
  // planes + crease children + the linked rank; kept stable box + keyboard).
  // Pixel dims at each piece's true mesh aspect: mountain 1.9x0.92, inn row
  // 1.5x0.68, gate 0.76x0.42, sign 0.14x0.16, dormer 0.16x0.14, key
  // 0.11x0.09, rank 0.34x0.21, wall 1.25x0.2. The mountain deliberately sits
  // at the 512 backdrop budget (it is the DIM plane; haze covers it). ----
  { id: 'ch1-mountain', seed: 20260, w: 512, h: 248, grain: 14, paint() { return mountainTwilight(this.w, this.h, this.seed) } },
  { id: 'ch1-inn-row', seed: 20261, w: 1024, h: 464, grain: 14, paint() { return innRowStage(this.w, this.h, this.seed) } },
  { id: 'ch1-gate', seed: 20262, w: 1024, h: 566, grain: 12, paint() { return gateOpen(this.w, this.h, this.seed) } },
  { id: 'ch1-rank', seed: 20264, w: 512, h: 316, grain: 10, paint() { return welcomeRank(this.w, this.h, this.seed) } },
  { id: 'ch1-sign', seed: 20265, w: 252, h: 288, grain: 10, paint() { return signKeys(this.w, this.h, this.seed) } },
  { id: 'ch1-dormer', seed: 20266, w: 256, h: 224, grain: 10, paint() { return dormerLit(this.w, this.h, this.seed) } },
  { id: 'ch1-key', seed: 20263, w: 264, h: 216, grain: 8, paint() { return brassKeyStandee(this.w, this.h, this.seed) } },
  { id: 'ch1-wall', seed: 20267, w: 1024, h: 164, grain: 12, paint() { return friezeKeys(this.w, this.h, this.seed) } },
  // the T-FLOOR flagship: the s2 spread print (same uv contract as page-4)
  { id: 'page-2', seed: 20270, w: 1024, h: 683, grain: 10, paint() { return innCourtyardSpread(this.w, this.h, this.seed) } },
  { id: 'ch1-stable-side', seed: 20210, w: 512, h: 512, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'side', 'barn') } },
  { id: 'ch1-stable-back', seed: 20211, w: 512, h: 295, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'back', 'barn') } },
  { id: 'ch1-stable-top', seed: 20212, w: 512, h: 295, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'top', 'barn') } },
  { id: 'ch1-stable-vane', seed: 20220, w: 299, h: 512, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'vane') } },
  { id: 'ch1-stable-hay', seed: 20221, w: 512, h: 293, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'hay') } },
  // Lift-the-flap, painted in SCREEN SPACE (image-x = page-fore d, image-y =
  // spine z): the BOARD is PORTRAIT (d-span 0.22 : z-span 0.45, row runs down)
  // and the DOORS LANDSCAPE (d-span 0.16 : z-span 0.085, number upright). Cat
  // behind door 3 (index 2). Odd seeds so grain differs per leaf.
  { id: 'ch1-keyboard-board', seed: 20250, w: 500, h: 1024, grain: 12, paint() { return keyboardBoard(this.w, this.h, this.seed, 4, 2) } },
  { id: 'ch1-keyboard-door1', seed: 20251, w: 512, h: 272, grain: 10, paint() { return keyboardDoor(this.w, this.h, this.seed, 1) } },
  { id: 'ch1-keyboard-door2', seed: 20253, w: 512, h: 272, grain: 10, paint() { return keyboardDoor(this.w, this.h, this.seed, 2) } },
  { id: 'ch1-keyboard-door3', seed: 20255, w: 512, h: 272, grain: 10, paint() { return keyboardDoor(this.w, this.h, this.seed, 3) } },
  { id: 'ch1-keyboard-door4', seed: 20257, w: 512, h: 272, grain: 10, paint() { return keyboardDoor(this.w, this.h, this.seed, 4) } },
  // ---- Spread 4 — the Keep's fan spire ----
  { id: 'ch3-keep-spire-m0', seed: 40301, w: 595, h: 640, grain: 12, paint() { return spireMember(this.w, this.h, this.seed, 0) } },
  { id: 'ch3-keep-spire-m1', seed: 40302, w: 376, h: 640, grain: 12, paint() { return spireMember(this.w, this.h, this.seed, 1) } },
  { id: 'ch3-keep-spire-m2', seed: 40303, w: 253, h: 640, grain: 12, paint() { return spireMember(this.w, this.h, this.seed, 2) } },
  // the sorting desk — a spun raven wheel beneath a punched pigeonhole faceplate
  { id: 'ch3-dispatch-dial', seed: 40310, w: 640, h: 640, grain: 10, paint() { return dispatchDial(this.w, this.h, this.seed) } },
  { id: 'ch3-dispatch-card', seed: 40320, w: 640, h: 640, grain: 10, paint() { return dispatchCard(this.w, this.h, this.seed) } },
  // the gatehouse tower (stripflap: rectangular mesh, the ALPHA is the die-cut,
  // so this is a PIECE bake with no outline sidecar). Mesh 0.12 x 0.20 = 0.6.
  { id: 'ch3-ring-tower', seed: 40330, w: 384, h: 640, grain: 12, paint() { return ringTower(this.w, this.h, this.seed) } },
  // the rookery's outer yard wall (foreground vfold) and the s4 spread print.
  // Both keep the pixel dims their committed predecessors shipped with — they
  // are full-bleed page/apron art, not sliver cutouts (see the report note on
  // the 1024 long-edge cap, which these two predate).
  // Both sit at the G5 1024 long-edge cap, at the SAME aspect the legacy bakes
  // shipped (1441x203 -> 1024x144, 1536x1024 -> 1024x683). Nothing is lost: the
  // runtime already downscales every art texture to a 1024 long edge at load
  // (ART_TIER, book/use-layer-texture.ts), so the extra pixels never reached the
  // GPU — they only carried the oversize-art violation forward.
  { id: 'ch3-fringe', seed: 40340, w: 1024, h: 144, grain: 14, paint() { return rookeryFringe(this.w, this.h, this.seed) } },
  { id: 'page-4', seed: 40350, w: 1024, h: 683, grain: 10, paint() { return postRoadSpread(this.w, this.h, this.seed) } },
  // ---- Spread 7 — the Northern Treasury (ch6, northern aurora/teal/gold) ----
  { id: 'ch6-strongbox-front', seed: 70201, w: 512, h: 270, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'front', 'strongbox') } },
  { id: 'ch6-strongbox-back', seed: 70202, w: 512, h: 270, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'back', 'strongbox') } },
  { id: 'ch6-strongbox-side', seed: 70203, w: 512, h: 427, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'side', 'strongbox') } },
  { id: 'ch6-strongbox-top', seed: 70204, w: 512, h: 323, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'top', 'strongbox') } },
  { id: 'ch6-strongbox-seal', seed: 70210, w: 420, h: 420, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'waxSealN') } },
  { id: 'ch6-strongbox-coins', seed: 70211, w: 512, h: 256, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'mintedCoins') } },
  { id: 'ch6-treasury-spire', seed: 70220, w: 358, h: 512, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'glassSpire') } },
  { id: 'ch6-treasury-vines', seed: 70221, w: 512, h: 307, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'vines') } },
  { id: 'ch6-crest', seed: 70230, w: 460, h: 409, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'griffin') } },
  { id: 'ch6-steps-deck', seed: 70240, w: 1024, h: 330, grain: 14, paint() { return deckSurface(this.w, this.h, this.seed, 'glass') } },
  // s7 PLAYABLE (G4): the treasure coffer — interior board + one teal-steel lid.
  { id: 'ch6-coffer-board', seed: 70260, w: 576, h: 480, grain: 12, paint() { return cofferInterior(this.w, this.h, this.seed) } },
  { id: 'ch6-coffer-door1', seed: 70261, w: 512, h: 486, grain: 12, paint() { return cofferLid(this.w, this.h, this.seed) } },
]

// The SIX legacy skyline mound slots, one strip each. Dims are the TRUE mesh
// aspect = row.width / row.height, read straight from content.ts ch3-skyline-l/r
// rows (2026-07-24). Seeds are chosen so cross-gutter pairs (l-mound0 vs
// r-mound0, ...) differ in parity, so no two symmetric slots read as near
// duplicates; `towers` varies the facade-block count per slot.
const SLOTS = [
  { id: 'ch3-skyline-l-mound0', w: 0.3219, h: 0.1089, seed: 10008, towers: 7 },
  { id: 'ch3-skyline-l-mound1', w: 0.292, h: 0.0838, seed: 10011, towers: 8 },
  { id: 'ch3-skyline-l-mound2', w: 0.2319, h: 0.0728, seed: 10014, towers: 6 },
  { id: 'ch3-skyline-r-mound0', w: 0.322, h: 0.1011, seed: 40031, towers: 8 },
  { id: 'ch3-skyline-r-mound1', w: 0.2921, h: 0.0988, seed: 40034, towers: 6 },
  { id: 'ch3-skyline-r-mound2', w: 0.232, h: 0.0666, seed: 40037, towers: 7 },
]

// The THREE new ring rows (s4 pack §4a A/B). They slot into the same
// `<layerId>-mound<k>` scheme and bake through the same shaped-mesh path, but
// carry the ring variants and their own pixel dims. Kept in a SEPARATE array
// because SLOTS is the procart bench's iteration set and its ROWS table only
// covers the six legacy ids.
const RING_SLOTS = [
  // ring-mid arms: mesh 0.26 x 0.16 = 1.625. The RIGHT arm is the mirror of the
  // left (see dovecoteFacade: the raven ranks are authored with the opposite
  // facing under `mirror`, so both arms' birds still face the spine).
  { id: 'ch3-skyline-l-mound3', w: 0.26, h: 0.16, W: 832, H: 512, seed: 10017, variant: 'ringMid', blocks: 4 },
  { id: 'ch3-skyline-r-mound3', w: 0.26, h: 0.16, W: 832, H: 512, seed: 40040, variant: 'ringMid', blocks: 4, mirror: true },
  // ring-front gate wall: mesh 0.19 x 0.10 = 1.9.
  { id: 'ch3-skyline-l-mound4', w: 0.19, h: 0.1, W: 972, H: 512, seed: 10020, variant: 'ringFront', blocks: 5 },
]
const SLOT_LONG_EDGE = 1024 // gate-matrix G5 budget: art max dim <= 1024

function slotDims(slot) {
  if (slot.W && slot.H) return { W: slot.W, H: slot.H }
  return { W: SLOT_LONG_EDGE, H: Math.round((SLOT_LONG_EDGE * slot.h) / slot.w) }
}

/** Bakes one slot straight into the art dir as <id>.webp + <id>.outline.json.
 *  The webp is the painted texture; the outline JSON is the shaped-mesh contour
 *  (normalized [0,1]^2, v-up hinge->crest). */
async function bakeSlot(slot, outDir) {
  const { W, H } = slotDims(slot)
  const art = dovecoteFacade({
    seed: slot.seed,
    w: W,
    h: H,
    variant: slot.variant ?? 'flank',
    blocks: slot.blocks ?? Math.max(3, Math.round((slot.towers ?? 7) / 1.6)),
    mirror: slot.mirror ?? false,
  })
  const { outline, out } = await bakeShaped(art, slot.seed, W, H, 22)
  const webp = await sharp(out).webp({ quality: 82 }).toBuffer()
  await writeFile(path.join(outDir, `${slot.id}.webp`), webp)
  await writeFile(path.join(outDir, `${slot.id}.outline.json`), JSON.stringify(outline))
  return { id: slot.id, W, H, aspect: (slot.w / slot.h).toFixed(3), points: outline.length, bytes: webp.length }
}

// ============================================================================
// INFRA-1 — SHARED ATLAS PAGES. Composites already-baked webps into 1024²
// pages and emits the sidecar the runtime reads (components/labs/storybook/
// art-atlas.ts): many pieces, ONE texture upload. The merged keep mesh has a
// single material, so its page must carry EVERY keep art id or the renderer
// silently falls back to ~50 per-face draws.
//
// *** rect is in TEXTURE UV SPACE, v measured from the image BOTTOM *** — three
// uploads with the default flipY. For a region at image-space (x, yTop, w, h) on
// a page of size P: u0 = x/P, u1 = (x+w)/P, v0 = 1-(yTop+h)/P, v1 = 1-yTop/P.
// The EXACT region rect is written; the runtime applies the half-texel inset.
// ============================================================================

const ATLAS_PAGE = 1024
const ATLAS_GUTTER = 2

// `w` or `h` is the requested region size; the other is derived from the
// SOURCE's own aspect so nothing is stretched. `opaque` flattens a face whose
// alpha is incidental — the merged keep's material is alphaTest 0.1, so a solid
// face must be fully opaque for the test to be a no-op on it.
const ATLASES = [
  {
    id: 'keep-atlas-s4',
    // Sizes from s4 pack §4f: the three reader-facing plates get the pixels, the
    // spire members and balcony a fair share, the wall/top/back faces are
    // slivers at the pinned camera and get 64-96px.
    regions: [
      { id: 'ch3-keep-hall-front', w: 896, opaque: false },
      { id: 'ch3-keep-gallery-front', w: 830, opaque: false },
      { id: 'ch3-keep-loft-front', w: 700, opaque: false },
      { id: 'ch3-keep-spire-m0', h: 280, opaque: false },
      { id: 'ch3-keep-spire-m1', h: 280, opaque: false },
      { id: 'ch3-keep-spire-m2', h: 280, opaque: false },
      // The balcony deck and the loft's arched side are DIE-CUT art (21% / 28%
      // of their pixels are fully transparent — the deck's shaped desk and the
      // loft's open arch). Flattening them would print an opaque rectangle where
      // the void belongs, so they keep their alpha; alphaTest 0.1 cuts them
      // exactly as it does today. Every genuinely solid face below is flattened.
      { id: 'ch3-keep-balcony', w: 256, opaque: false },
      { id: 'ch3-keep-raven', w: 128, opaque: false },
      { id: 'ch3-keep-loft-side', w: 96, opaque: false },
      { id: 'ch3-keep-hall-side', w: 96, opaque: true },
      { id: 'ch3-keep-gallery-side', w: 96, opaque: true },
      { id: 'ch3-keep-hall-back', w: 64, opaque: true },
      { id: 'ch3-keep-gallery-back', w: 64, opaque: true },
      { id: 'ch3-keep-loft-back', w: 64, opaque: true },
      { id: 'ch3-keep-hall-top', w: 64, opaque: true },
      { id: 'ch3-keep-gallery-top', w: 64, opaque: true },
      { id: 'ch3-keep-loft-top', w: 64, opaque: true },
    ],
  },
  {
    id: 'flank-atlas-s4',
    // The nine skyline strips are slivers at the reading camera (pack 4f caps
    // their regions at 512 wide; 400 packs two per shelf with room to spare),
    // plus the gatehouse tower.
    regions: [
      { id: 'ch3-skyline-l-mound0', w: 400, opaque: false },
      { id: 'ch3-skyline-l-mound1', w: 400, opaque: false },
      { id: 'ch3-skyline-l-mound2', w: 400, opaque: false },
      { id: 'ch3-skyline-l-mound3', w: 400, opaque: false },
      { id: 'ch3-skyline-l-mound4', w: 400, opaque: false },
      { id: 'ch3-skyline-r-mound0', w: 400, opaque: false },
      { id: 'ch3-skyline-r-mound1', w: 400, opaque: false },
      { id: 'ch3-skyline-r-mound2', w: 400, opaque: false },
      { id: 'ch3-skyline-r-mound3', w: 400, opaque: false },
      { id: 'ch3-ring-tower', h: 360, opaque: false },
    ],
  },
]

/** Shelf-pack (next-fit decreasing height), deterministic: sort by descending
 *  height, ties broken by id. Returns null when the set does not fit. */
function shelfPack(items, page, gutter) {
  const sorted = [...items].sort((a, b) => b.h - a.h || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const placed = []
  let shelfY = 0
  let shelfX = 0
  let shelfH = 0
  for (const it of sorted) {
    if (it.w > page) return null
    if (shelfX > 0 && shelfX + gutter + it.w > page) {
      shelfY += shelfH + gutter
      shelfX = 0
      shelfH = 0
    }
    const x = shelfX === 0 ? 0 : shelfX + gutter
    if (shelfY + it.h > page) return null
    placed.push({ ...it, x, y: shelfY })
    shelfX = x + it.w
    shelfH = Math.max(shelfH, it.h)
  }
  return shelfY + shelfH <= page ? placed : null
}

/** Reads each region's source aspect, derives its missing dimension, then packs
 *  — retrying with ONE uniform scale factor across every region until it fits. */
async function packAtlas(atlas, dir) {
  const base = []
  for (const region of atlas.regions) {
    const meta = await sharp(path.join(dir, `${region.id}.webp`)).metadata()
    const ar = meta.width / meta.height
    const w = region.w ?? Math.round(region.h * ar)
    const h = region.h ?? Math.round(region.w / ar)
    base.push({ id: region.id, w, h, opaque: !!region.opaque })
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const factor = Math.pow(0.97, attempt)
    const items = base.map((b) => ({
      ...b,
      w: Math.max(8, Math.round(b.w * factor)),
      h: Math.max(8, Math.round(b.h * factor)),
    }))
    const placed = shelfPack(items, ATLAS_PAGE, ATLAS_GUTTER)
    if (placed) return { placed, factor }
  }
  throw new Error(`atlas ${atlas.id}: no uniform scale fits ${base.length} regions on ${ATLAS_PAGE}px`)
}

/** Composites one atlas page and returns its sprite rects in TEXTURE uv space. */
async function writeAtlasPage(atlas, dir) {
  const { placed, factor } = await packAtlas(atlas, dir)
  const layers = []
  for (const p of [...placed].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const src = sharp(path.join(dir, `${p.id}.webp`)).resize(p.w, p.h, { fit: 'fill' })
    const buf = await (p.opaque ? src.flatten({ background: ROOK.ink }) : src).ensureAlpha().png().toBuffer()
    layers.push({ input: buf, left: p.x, top: p.y })
  }
  const page = await sharp({
    create: { width: ATLAS_PAGE, height: ATLAS_PAGE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(layers)
    .png()
    .toBuffer()
  const webp = await sharp(page).webp({ quality: 90, alphaQuality: 100 }).toBuffer()
  await writeFile(path.join(dir, `${atlas.id}.webp`), webp)

  const sprites = {}
  const P = ATLAS_PAGE
  for (const p of [...placed].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    sprites[p.id] = {
      atlas: atlas.id,
      // v from the image BOTTOM (flipY): a mistake here renders every keep face
      // upside-down, so it is written once, here, and nowhere else.
      rect: [p.x / P, 1 - (p.y + p.h) / P, (p.x + p.w) / P, 1 - p.y / P],
    }
  }
  const used = placed.reduce((s, p) => s + p.w * p.h, 0)
  return { sprites, factor, occupancy: used / (P * P), count: placed.length, bytes: webp.length }
}

/** Writes every atlas page plus the atlas.json sidecar the runtime reads. */
async function writeAtlases(dir) {
  const pages = {}
  const sprites = {}
  const report = []
  for (const atlas of ATLASES) {
    const res = await writeAtlasPage(atlas, dir)
    pages[atlas.id] = ATLAS_PAGE
    Object.assign(sprites, res.sprites)
    report.push({ id: atlas.id, ...res })
  }
  const ordered = {}
  for (const id of Object.keys(sprites).sort()) ordered[id] = sprites[id]
  await writeFile(path.join(dir, 'atlas.json'), JSON.stringify({ pages, sprites: ordered }, null, 2) + '\n')
  return report
}

/** Rebuilds manifest.json (every art id from the webp listing — same contract as
 *  prepare-art's writeManifest) and outlines.json (ids that carry a shaped
 *  outline sidecar). Rebuilt from the directory so it also picks up prepare-art's
 *  own bakes; the two scripts never fight over these files. */
async function writeManifests(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const names = entries.filter((e) => e.isFile()).map((e) => e.name)
  const artIds = names.filter((n) => n.toLowerCase().endsWith('.webp')).map((n) => n.replace(/\.webp$/i, '')).sort()
  const outlineIds = names.filter((n) => n.toLowerCase().endsWith('.outline.json')).map((n) => n.replace(/\.outline\.json$/i, '')).sort()
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(artIds, null, 2) + '\n')
  await writeFile(path.join(dir, 'outlines.json'), JSON.stringify(outlineIds, null, 2) + '\n')
  return { artIds, outlineIds }
}

async function main() {
  await mkdir(ART_DIR, { recursive: true })
  const info = []
  for (const slot of [...SLOTS, ...RING_SLOTS]) info.push(await bakeSlot(slot, ART_DIR))
  for (const wing of VISTA_WINGS) info.push(await bakeVistaWing(wing, ART_DIR))
  const pieceInfo = []
  for (const piece of PIECES) pieceInfo.push(await bakePieceTexture(piece, ART_DIR))
  // Atlases pack the loose webps just baked, so they run LAST — and the
  // manifests after them, so the two pages appear as art ids of their own.
  const atlasInfo = await writeAtlases(ART_DIR)
  const { artIds, outlineIds } = await writeManifests(ART_DIR)
  for (const r of info) {
    process.stdout.write(`${r.id.padEnd(24)} ${r.W}x${r.H}  a=${r.aspect}  ${r.points}pts  ${(r.bytes / 1024).toFixed(1)}kb\n`)
  }
  for (const r of pieceInfo) {
    process.stdout.write(`${r.id.padEnd(24)} ${r.W}x${r.H}  ${(r.bytes / 1024).toFixed(1)}kb\n`)
  }
  for (const a of atlasInfo) {
    process.stdout.write(
      `${a.id.padEnd(24)} ${ATLAS_PAGE}x${ATLAS_PAGE}  ${a.count} regions  scale=${a.factor.toFixed(3)}  ` +
        `occupancy=${(a.occupancy * 100).toFixed(1)}%  ${(a.bytes / 1024).toFixed(1)}kb\n`
    )
  }
  process.stdout.write(`manifest: ${artIds.length} art ids, ${outlineIds.length} outline sidecars -> ${path.relative(REPO_ROOT, ART_DIR)}\n`)
}

export {
  citadelStrip,
  dovecoteFacade,
  CITADEL,
  ROOK,
  SLOTS,
  RING_SLOTS,
  slotDims,
  bake,
  bakeSlot,
  PIECES,
  bakePieceTexture,
  ATLASES,
  ATLAS_PAGE,
  writeAtlases,
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}
