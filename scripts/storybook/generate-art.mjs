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
 * THE ART MODULE. Pure: (seed, dims, palette, motif) -> { outline, svg }.
 * `outline` is the closed silhouette in normalized [0,1]^2 with v UP from the
 * hinge (v=0 = base glued to page) to the crest (v=1) — exactly the ROW_UVS
 * convention popup-skyline.ts already maps. That same array triangulates to
 * the shaped mesh at runtime; here it also drives the SVG cut path.
 */
function citadelStrip({ seed, w, h, palette = CITADEL, towers = 7, smoke = false }) {
  const rand = mulberry32(seed)
  const P = palette
  const X = (u) => u * w // normalized u -> px
  const Y = (v) => (1 - v) * h // normalized v (up) -> px (down)
  const FIN = 0.05 // finial spike height (v)
  const FINW = 0.006

  // ---- LAYOUT: a composed row of DISTINCT building types (round tower, big
  // hall w/ dormers, gabled houses, gatehouse) across three depth PLANES.
  // Hard rule: never > 2 adjacent similar gables. ----
  const n = Math.max(7, towers)
  const kind = new Array(n).fill('house')
  const plane = new Array(n).fill('main')
  const towerIdx = Math.min(n - 2, Math.max(1, Math.round(n / 2) + ((seed % 3) - 1)))
  kind[towerIdx] = 'tower'
  const roomLeft = towerIdx
  let hallIdx = roomLeft >= n - 1 - towerIdx ? towerIdx - 2 : towerIdx + 2
  if (hallIdx < 0 || hallIdx >= n || kind[hallIdx] !== 'house') hallIdx = kind[1] === 'house' ? 1 : n - 2
  kind[hallIdx] = 'hall'
  const gateIdx = seed % 2 ? 0 : n - 1
  if (kind[gateIdx] === 'house') kind[gateIdx] = 'gatehouse'
  // recede the tower's flanking houses (far plane) so the centerpiece pops
  for (const j of [towerIdx - 1, towerIdx + 1]) if (kind[j] === 'house') plane[j] = 'far'
  // one more far house on the longer side for a third-plane read
  for (let i = 0; i < n; i++) if (kind[i] === 'house' && plane[i] === 'main' && Math.abs(i - towerIdx) >= 3) { plane[i] = 'far'; break }

  const relW = { tower: 1.5, hall: 1.55, gatehouse: 1.2, house: 0.95 }
  const rel = []
  for (let i = 0; i < n; i++) rel.push((relW[kind[i]] ?? 1) * (plane[i] === 'far' ? 0.8 : 1) * (0.9 + mulberry32((seed * 17 + i) | 0)() * 0.3))
  const total = rel.reduce((a, b) => a + b, 0)

  const units = []
  let xacc = 0
  for (let i = 0; i < n; i++) {
    const wv = rel[i] / total
    const x0 = xacc
    const x1 = xacc + wv
    xacc = x1
    const uSeed = (seed * 131 + i * 977) | 0
    const r2 = mulberry32(uSeed)
    const far = plane[i] === 'far'
    const base = { x0, x1, uSeed, kind: kind[i], far }
    if (kind[i] === 'tower') {
      const corbelV = 0.58 + r2() * 0.04
      // peakV capped so the finial tip (peakV + FIN) stays <= 1 — the outline
      // MUST live inside the unit square for the shaped-mesh contract (the
      // bilerp stays within the solver quad iff u,v in [0,1]).
      units.push({ ...base, corbelV, eaveV: corbelV, peakV: 0.9 + r2() * 0.04, drumInset: (x1 - x0) * 0.14 })
    } else if (kind[i] === 'hall') {
      const eaveV = 0.42 + r2() * 0.05
      units.push({ ...base, eaveV, peakV: eaveV + 0.16 + r2() * 0.05, ridgeHalf: 0.3 + r2() * 0.08, hip: true })
    } else if (kind[i] === 'gatehouse') {
      const topV = 0.5 + r2() * 0.05
      units.push({ ...base, eaveV: topV, topV, crenelV: topV - 0.03, teeth: 4 })
    } else {
      // house — varied height/pitch; far ones shorter. Alternate hip/gable so
      // neighbours never read as the same roof.
      const eaveV = (far ? 0.34 : 0.46) + r2() * 0.08
      const pitch = (far ? 0.1 : 0.16) + r2() * 0.14
      const hip = i % 2 === 0
      units.push({ ...base, eaveV, peakV: Math.min(far ? 0.62 : 0.8, eaveV + pitch), hip, ridgeHalf: hip ? 0.16 + r2() * 0.1 : 0 })
    }
  }

  // chimneys in the valleys between main houses/halls
  const chimneys = []
  for (let i = 1; i < n; i++) {
    const r2 = mulberry32((seed * 53 + i * 613) | 0)
    if (units[i].kind === 'tower' || units[i - 1].kind === 'tower' || r2() > 0.55) continue
    const eave = Math.min(units[i - 1].eaveV, units[i].eaveV)
    chimneys.push({ x: units[i].x0 - 0.024, wv: 0.048, baseV: eave - 0.04, topV: eave + 0.18 + r2() * 0.08, uSeed: (seed * 91 + i) | 0, accent: r2() < 0.5 ? P.accent : P.accent2 })
  }

  // ---- OUTLINE: one closed contour per unit type, spent on interesting mass. ----
  const merlonTop = (x0, x1, baseV, topV, teeth) => {
    const out = []
    const tw = (x1 - x0) / (teeth * 2 - 1)
    for (let t = 0; t < teeth; t++) {
      const xa = x0 + t * 2 * tw
      out.push([xa, topV], [xa + tw, topV], [xa + tw, baseV])
      if (t < teeth - 1) out.push([xa + 2 * tw, baseV], [xa + 2 * tw, topV])
    }
    return out
  }
  const unitTop = (u) => {
    const mid = (u.x0 + u.x1) / 2
    if (u.kind === 'tower') return [[u.x0, u.corbelV], [mid - FINW, u.peakV], [mid, u.peakV + FIN], [mid + FINW, u.peakV], [u.x1, u.corbelV]]
    if (u.kind === 'gatehouse') return [[u.x0, u.crenelV], ...merlonTop(u.x0, u.x1, u.crenelV, u.topV, u.teeth), [u.x1, u.crenelV]]
    if (u.hip) {
      const rw = (u.x1 - u.x0) * u.ridgeHalf
      return [[u.x0, u.eaveV], [mid - rw, u.peakV], [mid + rw, u.peakV], [u.x1, u.eaveV]]
    }
    return [[u.x0, u.eaveV], [mid - FINW, u.peakV], [mid, u.peakV + FIN], [mid + FINW, u.peakV], [u.x1, u.eaveV]]
  }
  const top = []
  units.forEach((u) => {
    for (const c of chimneys)
      if (Math.abs(c.x + 0.012 - u.x0) < 1e-6) top.push([c.x, u.eaveV], [c.x, c.topV], [c.x + c.wv, c.topV], [c.x + c.wv, u.eaveV])
    top.push(...unitTop(u))
  })
  // Simplify so the outline is a clean corner ring (drives BOTH the SVG cut and
  // the shaped mesh — same array, the G3 identity).
  const outline = simplifyOutline([[0, 0], ...top, [1, 0]])

  // ---- PAINT ----
  const dOf = (pts) => pts.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'
  const silhouette = dOf(outline)
  const defs = []
  const parts = []
  const sky = [] // UNCLIPPED overlay (smoke, high pennants) that drifts past the cut edge
  let clipId = 0

  // masonry: warm fill + HEAVY walnut coursing, block-varied joints, weathered
  // dark/light blocks. Line alpha varies per course (weathering), 2-3x the
  // former weight so coursing reads at contact-sheet scale.
  const stoneWall = (x0, x1, yTop, yBot, fill, r2, dim, courseV = 0.05) => {
    let s = `<rect x="${fx(X(x0))}" y="${fx(yTop)}" width="${fx(X(x1 - x0))}" height="${fx(yBot - yTop)}" fill="${fill}"/>`
    s += `<rect x="${fx(X(x0))}" y="${fx(yTop)}" width="${fx(w * 0.005)}" height="${fx(yBot - yTop)}" fill="${P.paperLit}" opacity="0.55"/>` // lit left edge
    s += `<rect x="${fx(X(x1) - w * 0.006)}" y="${fx(yTop)}" width="${fx(w * 0.006)}" height="${fx(yBot - yTop)}" fill="${P.ink}" opacity="0.1"/>` // shadowed right edge
    const courseH = h * courseV
    let cy = yBot
    let row = 0
    while (cy > yTop + 2) {
      s += `<line x1="${fx(X(x0))}" y1="${fx(cy)}" x2="${fx(X(x1))}" y2="${fx(cy)}" stroke="${P.ink}" stroke-width="1.5" opacity="${(0.42 + r2() * 0.24).toFixed(2)}"/>`
      const blocks = 3 + Math.floor(r2() * 3)
      for (let b = 0; b <= blocks; b++) {
        const jx = lerp(x0, x1, (b + (row % 2 ? 0.5 : 0)) / blocks)
        if (jx <= x0 || jx >= x1) continue
        s += `<line x1="${fx(X(jx))}" y1="${fx(cy)}" x2="${fx(X(jx))}" y2="${fx(cy - courseH)}" stroke="${P.ink}" stroke-width="1.3" opacity="0.36"/>`
      }
      const roll = r2()
      if (roll < 0.2) s += `<rect x="${fx(X(lerp(x0, x1, r2() * 0.7)))}" y="${fx(cy - courseH)}" width="${fx(X((x1 - x0) * 0.18))}" height="${fx(courseH)}" fill="${dim}" opacity="0.55"/>`
      else if (roll < 0.32) s += `<rect x="${fx(X(lerp(x0, x1, r2() * 0.7)))}" y="${fx(cy - courseH)}" width="${fx(X((x1 - x0) * 0.16))}" height="${fx(courseH)}" fill="${P.paperLit}" opacity="0.4"/>`
      cy -= courseH
      row++
    }
    return s
  }

  const shingles = (clip, x0, x1, eaveY, ridgeY, tint) => {
    let s = `<g clip-path="url(#${clip})">`
    const rows = 9
    const sc = w * 0.019
    for (let i = 0; i < rows; i++) {
      const y = lerp(eaveY, ridgeY, i / rows)
      const amp = ((eaveY - ridgeY) / rows) * 0.6
      s += `<rect x="${fx(X(x0) - 6)}" y="${fx(y - amp)}" width="${fx(X(x1 - x0) + 12)}" height="${fx(amp + 2)}" fill="${i % 2 ? tint : P.ink}" opacity="${i % 2 ? 0.32 : 0.2}"/>`
      let d = `M ${fx(X(x0) - 6)} ${fx(y)}`
      for (let x = X(x0) - 6; x < X(x1) + sc; x += sc) d += ` q ${fx(sc / 2)} ${fx(amp)} ${fx(sc)} 0`
      s += `<path d="${d}" fill="none" stroke="${P.ink}" stroke-width="1.9" opacity="0.62"/>`
    }
    s += `</g>`
    return s
  }

  const lancet = (cx, sillV, ww, hh, lit, r2) => {
    const bx = X(cx - ww / 2)
    const bw = X(ww)
    const by = Y(sillV)
    const hpx = hh * h
    const sy = by - hpx * 0.5
    const apex = sy - hpx * 0.55
    const cyc = lerp(sy, apex, 0.5)
    const frame = `M ${fx(bx)} ${fx(by)} L ${fx(bx)} ${fx(sy)} Q ${fx(bx)} ${fx(cyc)} ${fx(bx + bw / 2)} ${fx(apex)} Q ${fx(bx + bw)} ${fx(cyc)} ${fx(bx + bw)} ${fx(sy)} L ${fx(bx + bw)} ${fx(by)} Z`
    let s = ''
    if (lit) s += `<ellipse cx="${fx(bx + bw / 2)}" cy="${fx((apex + by) / 2)}" rx="${fx(bw * 0.9)}" ry="${fx((by - apex) * 0.6)}" fill="${P.ember}" opacity="0.16"/>`
    s += `<path d="${frame}" fill="${lit ? 'url(#glow)' : P.ink}" opacity="${lit ? 1 : 0.82}"/>`
    if (lit) {
      s += `<line x1="${fx(bx + bw / 2)}" y1="${fx(apex + 3)}" x2="${fx(bx + bw / 2)}" y2="${fx(by)}" stroke="${P.ink}" stroke-width="1.4" opacity="0.72"/>`
      for (const t of [0.4, 0.72]) s += `<line x1="${fx(bx)}" y1="${fx(lerp(sy, by, t))}" x2="${fx(bx + bw)}" y2="${fx(lerp(sy, by, t))}" stroke="${P.ink}" stroke-width="1.2" opacity="0.6"/>`
    }
    s += `<path d="${frame}" fill="none" stroke="${P.ink}" stroke-width="2.2" opacity="0.88"/>`
    s += `<path d="${frame}" fill="none" stroke="${P.paperLit}" stroke-width="0.8" opacity="0.4"/>`
    return s
  }

  const finialAt = (midXpx, peakV) => {
    const baseY = Y(peakV)
    const tipY = Y(peakV + FIN)
    return `<rect x="${fx(midXpx - 1.6)}" y="${fx(tipY)}" width="3.2" height="${fx(baseY - tipY)}" fill="${P.gold}"/><circle cx="${fx(midXpx)}" cy="${fx(tipY)}" r="5" fill="${P.goldLit}"/><circle cx="${fx(midXpx)}" cy="${fx(tipY)}" r="5" fill="none" stroke="${P.ink}" stroke-width="1" opacity="0.5"/><circle cx="${fx(midXpx)}" cy="${fx(baseY - 4)}" r="3" fill="${P.gold}"/>`
  }
  // pennant: 2-3x larger, saturated accent, on a pole above the finial tip
  const pennant = (midXpx, peakV, color) => {
    const y = Y(peakV + FIN) - 4
    const L = w * 0.075
    const drop = 9
    return `<path d="M ${fx(midXpx)} ${fx(y)} l 0 ${fx(-18)}" stroke="${P.ink}" stroke-width="1.6" opacity="0.65"/><path d="M ${fx(midXpx)} ${fx(y - 17)} q ${fx(L * 0.55)} ${fx(-2)} ${fx(L)} ${fx(drop)} q ${fx(-L * 0.5)} ${fx(-1)} ${fx(-L * 0.5)} ${fx(drop + 2)} q ${fx(-L * 0.5)} ${fx(1)} ${fx(-L * 0.5)} ${fx(-drop - 1)} z" fill="${color}"/><path d="M ${fx(midXpx)} ${fx(y - 17)} q ${fx(L * 0.55)} ${fx(-2)} ${fx(L)} ${fx(drop)}" fill="none" stroke="${P.ink}" stroke-width="1" opacity="0.4"/>`
  }
  // cut-paper smoke: ONE small tapered S-ribbon, paper-white, ATTACHED at the
  // mouth, height capped to the chimney's own height, tapering to a point.
  const smokeRibbon = (cx, mouthY, mouthW, chimneyHpx, r2) => {
    const dir = r2() < 0.5 ? 1 : -1
    const sh = Math.min(chimneyHpx * 0.85, h * 0.17) // <= the chimney's own height
    const mx = X(cx)
    const N = 12
    const L = []
    const R = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const cxi = mx + Math.sin(t * Math.PI * 0.95) * mouthW * 0.7 * dir // gentle S
      const cyi = mouthY - t * sh
      const half = mouthW * 0.42 * (1 - t) ** 0.9 // taper to a point
      L.push([cxi - half, cyi])
      R.push([cxi + half, cyi])
    }
    const pts = [...L, ...R.reverse()]
    const d = 'M ' + pts.map((p) => `${fx(p[0])} ${fx(p[1])}`).join(' L ') + ' Z'
    return `<path d="${d}" fill="${P.smoke}" opacity="0.78"/>`
  }
  // ground-level DOOR: framed arched opening with a timber/iron leaf + step stones.
  const door = (cx, wallTopV, r2) => {
    const dw = 0.05
    const dhpx = h * (0.1 + r2() * 0.03)
    const bx = X(cx - dw / 2)
    const bw = X(dw)
    const by = h
    const sy = by - dhpx * 0.55
    const apex = sy - bw * 0.5
    const arch = `M ${fx(bx)} ${fx(by)} L ${fx(bx)} ${fx(sy)} Q ${fx(bx)} ${fx(lerp(sy, apex, 0.5))} ${fx(bx + bw / 2)} ${fx(apex)} Q ${fx(bx + bw)} ${fx(lerp(sy, apex, 0.5))} ${fx(bx + bw)} ${fx(sy)} L ${fx(bx + bw)} ${fx(by)} Z`
    let s = `<path d="${arch}" fill="#2a1d13"/>` // recessed doorway
    const iron = r2() < 0.5
    if (iron) {
      for (const t of [0.4, 0.7]) s += `<line x1="${fx(bx + 2)}" y1="${fx(lerp(sy, by, t))}" x2="${fx(bx + bw - 2)}" y2="${fx(lerp(sy, by, t))}" stroke="${P.ink}" stroke-width="2" opacity="0.8"/>` // iron bands
    } else {
      for (let p = 1; p < 4; p++) s += `<line x1="${fx(bx + (bw * p) / 4)}" y1="${fx(apex + 2)}" x2="${fx(bx + (bw * p) / 4)}" y2="${fx(by)}" stroke="${P.ink}" stroke-width="1.6" opacity="0.6"/>` // timber planks
    }
    s += `<path d="${arch}" fill="none" stroke="${P.ink}" stroke-width="2.6" opacity="0.85"/>` // heavy frame
    s += `<path d="${arch}" fill="none" stroke="${P.paperLit}" stroke-width="1" opacity="0.4"/>`
    // one or two step stones
    s += `<rect x="${fx(bx - 4)}" y="${fx(by - 6)}" width="${fx(bw + 8)}" height="6" fill="${P.paperMid}" stroke="${P.ink}" stroke-width="1" stroke-opacity="0.4"/>`
    return s
  }

  const leftShadow = (u, yTop) => `<rect x="${fx(X(u.x0) - 7)}" y="${fx(yTop)}" width="8" height="${fx(h - yTop)}" fill="${P.ink}" opacity="0.16"/>`

  // ---- per-type painters ----
  const drawHouse = (u) => {
    const r2 = mulberry32(u.uSeed ^ 0x9e37)
    const wallFill = u.far ? P.paperDim : P.paper
    const wallDim = u.far ? P.paperDeep : P.paperMid
    const roofTint = u.far ? P.slateDim : P.slate
    const eaveY = Y(u.eaveV)
    const ridgeY = Y(u.peakV)
    const mid = (u.x0 + u.x1) / 2
    const rlX = X(mid - (u.hip ? u.ridgeHalf * (u.x1 - u.x0) : 0))
    const rrX = X(mid + (u.hip ? u.ridgeHalf * (u.x1 - u.x0) : 0))
    const cid = `r${clipId++}`
    const roof = `M ${fx(X(u.x0))} ${fx(eaveY)} L ${fx(rlX)} ${fx(ridgeY)} L ${fx(rrX)} ${fx(ridgeY)} L ${fx(X(u.x1))} ${fx(eaveY)} Z`
    defs.push(`<clipPath id="${cid}"><path d="${roof}"/></clipPath>`)
    let s = `<g>${leftShadow(u, eaveY)}`
    s += stoneWall(u.x0, u.x1, eaveY, h, wallFill, r2, wallDim)
    if (u.far) s += `<rect x="${fx(X(u.x0))}" y="${fx(eaveY)}" width="${fx(X(u.x1 - u.x0))}" height="${fx(h - eaveY)}" fill="${P.slateDeep}" opacity="0.26"/>`
    s += `<path d="${roof}" fill="${roofTint}"/>`
    s += `<path d="M ${fx(X(u.x0))} ${fx(eaveY)} L ${fx(rlX)} ${fx(ridgeY)} L ${fx(rlX)} ${fx(eaveY)} Z" fill="${P.slateLit}" opacity="0.35"/>`
    s += shingles(cid, u.x0, u.x1, eaveY, ridgeY, roofTint)
    s += `<path d="${roof}" fill="none" stroke="${P.ink}" stroke-width="2.4" opacity="0.72"/>`
    s += `<rect x="${fx(X(u.x0) - 3)}" y="${fx(eaveY)}" width="${fx(X(u.x1 - u.x0) + 6)}" height="4.5" fill="${P.paperLit}" opacity="0.75"/>` // eave board
    s += `<rect x="${fx(X(u.x0))}" y="${fx(eaveY + 4.5)}" width="${fx(X(u.x1 - u.x0))}" height="6" fill="${P.ink}" opacity="0.18"/>` // overhang shadow
    if (u.hip) s += `<line x1="${fx(rlX)}" y1="${fx(ridgeY)}" x2="${fx(rrX)}" y2="${fx(ridgeY)}" stroke="${P.paperLit}" stroke-width="1.8" opacity="0.55"/>`
    else s += finialAt(X(mid), u.peakV)
    // ground DOOR (main houses only — far ones are distant), framed
    if (!u.far) s += door((u.x0 + u.x1) / 2, u.eaveV, mulberry32((u.uSeed ^ 0xd001) | 0))
    // UPPER window row: height capped to <=17% of building height, sill sits in
    // the upper wall (never touches the ground line — that zone is the door).
    const wins = u.far ? 1 : r2() < 0.5 ? 2 : 1
    const winH = Math.min(0.15 * ((u.far ? 0.6 : 0.8) + r2() * 0.3), 0.17 * u.peakV)
    const sill = u.eaveV - 0.03 - winH * 1.05
    for (let k = 0; k < wins; k++) {
      const wx = lerp(u.x0, u.x1, wins === 1 ? 0.5 : 0.32 + k * 0.36)
      s += lancet(wx, sill, 0.045, winH, r2() < (u.far ? 0.5 : 0.72), mulberry32((u.uSeed ^ (k * 7)) | 0))
    }
    return s + `</g>`
  }

  // big hall: low hipped roof with TWO dormers breaking the eave line
  const drawHall = (u) => {
    const r2 = mulberry32(u.uSeed ^ 0x40a3)
    const eaveY = Y(u.eaveV)
    const ridgeY = Y(u.peakV)
    const mid = (u.x0 + u.x1) / 2
    const rw = u.ridgeHalf * (u.x1 - u.x0)
    const rlX = X(mid - rw)
    const rrX = X(mid + rw)
    const cid = `r${clipId++}`
    const roof = `M ${fx(X(u.x0))} ${fx(eaveY)} L ${fx(rlX)} ${fx(ridgeY)} L ${fx(rrX)} ${fx(ridgeY)} L ${fx(X(u.x1))} ${fx(eaveY)} Z`
    defs.push(`<clipPath id="${cid}"><path d="${roof}"/></clipPath>`)
    let s = `<g>${leftShadow(u, eaveY)}`
    s += stoneWall(u.x0, u.x1, eaveY, h, P.paper, r2, P.paperMid)
    s += `<path d="${roof}" fill="${P.slate}"/>`
    s += `<path d="M ${fx(X(u.x0))} ${fx(eaveY)} L ${fx(rlX)} ${fx(ridgeY)} L ${fx(rlX)} ${fx(eaveY)} Z" fill="${P.slateLit}" opacity="0.32"/>`
    s += shingles(cid, u.x0, u.x1, eaveY, ridgeY, P.slate)
    s += `<path d="${roof}" fill="none" stroke="${P.ink}" stroke-width="2.4" opacity="0.72"/>`
    s += `<line x1="${fx(rlX)}" y1="${fx(ridgeY)}" x2="${fx(rrX)}" y2="${fx(ridgeY)}" stroke="${P.paperLit}" stroke-width="2" opacity="0.6"/>`
    s += `<rect x="${fx(X(u.x0) - 3)}" y="${fx(eaveY)}" width="${fx(X(u.x1 - u.x0) + 6)}" height="5" fill="${P.paperLit}" opacity="0.75"/>`
    // two dormers breaking through the eave, each a mini gable + lit window
    for (const dx of [0.32, 0.68]) {
      const cxN = lerp(u.x0, u.x1, dx)
      const dw = (u.x1 - u.x0) * 0.16
      const dEave = u.eaveV + 0.06
      const dPeak = dEave + 0.09
      const dcid = `r${clipId++}`
      const dtri = `M ${fx(X(cxN - dw / 2))} ${fx(Y(dEave))} L ${fx(X(cxN))} ${fx(Y(dPeak))} L ${fx(X(cxN + dw / 2))} ${fx(Y(dEave))} Z`
      defs.push(`<clipPath id="${dcid}"><path d="${dtri}"/></clipPath>`)
      s += `<rect x="${fx(X(cxN - dw / 2))}" y="${fx(Y(dEave))}" width="${fx(X(dw))}" height="${fx(Y(u.eaveV - 0.02) - Y(dEave))}" fill="${P.paperLit}"/>`
      s += `<path d="${dtri}" fill="${P.slate}"/>`
      s += shingles(dcid, cxN - dw / 2, cxN + dw / 2, Y(dEave), Y(dPeak), P.slate)
      s += `<path d="${dtri}" fill="none" stroke="${P.ink}" stroke-width="1.8" opacity="0.7"/>`
      s += `<rect x="${fx(X(cxN - dw / 2))}" y="${fx(Y(dEave))}" width="${fx(X(dw))}" height="${fx(Y(u.eaveV - 0.02) - Y(dEave))}" fill="none" stroke="${P.ink}" stroke-width="1.4" opacity="0.5"/>`
      s += lancet(cxN, dEave - 0.075, 0.03, 0.075, true, r2)
    }
    // grand central DOOR + flanking upper windows (capped, off the ground)
    s += door((u.x0 + u.x1) / 2, u.eaveV, mulberry32((u.uSeed ^ 0xd002) | 0))
    const hwinH = Math.min(0.13, 0.16 * u.peakV)
    const hsill = u.eaveV - 0.03 - hwinH * 1.05
    for (const wx of [0.22, 0.78]) s += lancet(lerp(u.x0, u.x1, wx), hsill, 0.042, hwinH, r2() < 0.75, mulberry32((u.uSeed ^ Math.round(wx * 100)) | 0))
    return s + `</g>`
  }

  // round tower: coursed drum, corbel BALCONY ring, arched drum windows, steep
  // cone WIDER than the drum, gold finial + accent pennant.
  const drawTower = (u) => {
    const r2 = mulberry32(u.uSeed ^ 0x51ed)
    const cx = (u.x0 + u.x1) / 2
    const dx0 = u.x0 + u.drumInset
    const dx1 = u.x1 - u.drumInset
    const drumTopY = Y(u.corbelV)
    const apexY = Y(u.peakV)
    let s = `<g>`
    s += `<ellipse cx="${fx(X(cx))}" cy="${fx(Y(u.corbelV - 0.02))}" rx="${fx(X((u.x1 - u.x0) * 0.72))}" ry="12" fill="${P.ink}" opacity="0.16"/>` // cast shadow on flanks
    // drum body: coursed stone + barrel shade
    s += stoneWall(dx0, dx1, drumTopY, h, P.paperLit, r2, P.paperMid, 0.045)
    s += `<rect x="${fx(X(dx0))}" y="${fx(drumTopY)}" width="${fx(X(dx1 - dx0))}" height="${fx(h - drumTopY)}" fill="url(#barrel)"/>`
    // arched drum windows (a couple, lit) mid-drum
    for (const wy of [0.34, 0.5]) s += lancet(cx, wy, 0.05, 0.13, r2() < 0.85, mulberry32((u.uSeed ^ Math.round(wy * 90)) | 0))
    // corbel BALCONY ring: a wider band with little bracket ticks + a lit lip
    const ringY = Y(u.corbelV - 0.02)
    const ringW = (u.x1 - u.x0) * 0.5
    s += `<rect x="${fx(X(cx) - X(ringW))}" y="${fx(ringY)}" width="${fx(X(ringW) * 2)}" height="14" fill="${P.paper}"/>`
    s += `<rect x="${fx(X(cx) - X(ringW))}" y="${fx(ringY)}" width="${fx(X(ringW) * 2)}" height="14" fill="none" stroke="${P.ink}" stroke-width="1.8" opacity="0.6"/>`
    for (let b = -4; b <= 4; b++) s += `<line x1="${fx(X(cx) + b * X(ringW) / 4.5)}" y1="${fx(ringY + 14)}" x2="${fx(X(cx) + b * X(ringW) / 4.5)}" y2="${fx(ringY + 22)}" stroke="${P.ink}" stroke-width="1.6" opacity="0.5"/>` // corbel brackets
    s += `<rect x="${fx(X(cx) - X(ringW))}" y="${fx(ringY)}" width="${fx(X(ringW) * 2)}" height="3" fill="${P.paperLit}"/>` // lit lip
    // belfry arcade just under the cone
    const bandV = u.corbelV + 0.04
    for (let a = 0; a < 5; a++) s += lancet(lerp(u.x0 + 0.02, u.x1 - 0.02, (a + 0.5) / 5), bandV, 0.024, 0.055, r2() < 0.85, mulberry32((u.uSeed ^ (a * 13)) | 0))
    // steep cone, WIDER than the drum, shingled
    const ox = (u.x1 - u.x0) * 0.06
    const coneBaseY = Y(u.corbelV + 0.1)
    const cid = `c${clipId++}`
    const cone = `M ${fx(X(u.x0 - ox))} ${fx(coneBaseY)} L ${fx(X(cx))} ${fx(apexY)} L ${fx(X(u.x1 + ox))} ${fx(coneBaseY)} Z`
    defs.push(`<clipPath id="${cid}"><path d="${cone}"/></clipPath>`)
    s += `<path d="${cone}" fill="${P.slate}"/>`
    s += `<path d="M ${fx(X(u.x0 - ox))} ${fx(coneBaseY)} L ${fx(X(cx))} ${fx(apexY)} L ${fx(X(cx))} ${fx(coneBaseY)} Z" fill="${P.slateLit}" opacity="0.4"/>`
    s += shingles(cid, u.x0 - ox, u.x1 + ox, coneBaseY, apexY, P.slate)
    s += `<path d="${cone}" fill="none" stroke="${P.ink}" stroke-width="2.4" opacity="0.72"/>`
    s += finialAt(X(cx), u.peakV)
    s += pennant(X(cx), u.peakV, P.accent)
    return s + `</g>`
  }

  const drawGatehouse = (u) => {
    const r2 = mulberry32(u.uSeed ^ 0x2b1c)
    const topY = Y(u.topV)
    const crenelY = Y(u.crenelV)
    const mid = (u.x0 + u.x1) / 2
    let s = `<g>${leftShadow(u, crenelY)}`
    s += stoneWall(u.x0, u.x1, crenelY, h, P.paper, r2, P.paperMid)
    // merlons on top
    const tw = (u.x1 - u.x0) / (u.teeth * 2 - 1)
    for (let t = 0; t < u.teeth; t++) {
      const xa = u.x0 + t * 2 * tw
      s += `<rect x="${fx(X(xa))}" y="${fx(topY)}" width="${fx(X(tw))}" height="${fx(crenelY - topY)}" fill="${P.paper}"/>`
      s += `<rect x="${fx(X(xa))}" y="${fx(topY)}" width="${fx(X(tw))}" height="${fx(crenelY - topY)}" fill="none" stroke="${P.ink}" stroke-width="1.6" opacity="0.55"/>`
    }
    s += `<line x1="${fx(X(u.x0))}" y1="${fx(crenelY)}" x2="${fx(X(u.x1))}" y2="${fx(crenelY)}" stroke="${P.ink}" stroke-width="2" opacity="0.5"/>` // wall-walk line
    // big arched GATE with a portcullis grid
    const gw = (u.x1 - u.x0) * 0.5
    const gx0 = X(mid - gw / 2)
    const gbw = X(gw)
    const gby = h
    const gsy = h - (h - crenelY) * 0.42
    const gapex = gsy - gbw * 0.55
    const gate = `M ${fx(gx0)} ${fx(gby)} L ${fx(gx0)} ${fx(gsy)} Q ${fx(gx0)} ${fx(lerp(gsy, gapex, 0.5))} ${fx(gx0 + gbw / 2)} ${fx(gapex)} Q ${fx(gx0 + gbw)} ${fx(lerp(gsy, gapex, 0.5))} ${fx(gx0 + gbw)} ${fx(gsy)} L ${fx(gx0 + gbw)} ${fx(gby)} Z`
    s += `<path d="${gate}" fill="#241a12"/>`
    s += `<g clip-path="url(#gt${clipId})">`
    defs.push(`<clipPath id="gt${clipId}"><path d="${gate}"/></clipPath>`)
    clipId++
    for (let g = 1; g < 6; g++) s += `<line x1="${fx(gx0 + (gbw * g) / 6)}" y1="${fx(gapex)}" x2="${fx(gx0 + (gbw * g) / 6)}" y2="${fx(gby)}" stroke="${P.ink}" stroke-width="2" opacity="0.85"/>`
    for (let g = 1; g < 5; g++) s += `<line x1="${fx(gx0)}" y1="${fx(lerp(gsy, gby, g / 5))}" x2="${fx(gx0 + gbw)}" y2="${fx(lerp(gsy, gby, g / 5))}" stroke="${P.ink}" stroke-width="2" opacity="0.85"/>`
    s += `</g>`
    s += `<path d="${gate}" fill="none" stroke="${P.ink}" stroke-width="3" opacity="0.8"/>` // heavy arch voussoir
    s += `<path d="${gate}" fill="none" stroke="${P.paperLit}" stroke-width="1" opacity="0.4"/>`
    // a lit window over the gate
    s += lancet(mid, u.crenelV - 0.12, 0.05, 0.12, true, r2)
    return s + `</g>`
  }

  // ---- assemble planes: far distant fill, far units, main units (tower last),
  // chimneys+smoke, then the near foreground parapet in FRONT. ----
  parts.push(`<rect x="0" y="${fx(Y(0.5))}" width="${w}" height="${fx(Y(0) - Y(0.5))}" fill="${P.slateDeep}" opacity="0.5"/>`) // distant cool wash behind gaps
  const painter = (u) => (u.kind === 'tower' ? drawTower(u) : u.kind === 'hall' ? drawHall(u) : u.kind === 'gatehouse' ? drawGatehouse(u) : drawHouse(u))
  units.forEach((u) => u.far && parts.push(painter(u)))
  units.forEach((u) => !u.far && u.kind !== 'tower' && parts.push(painter(u)))
  units.forEach((u) => u.kind === 'tower' && parts.push(painter(u)))
  for (const c of chimneys) {
    const r2 = mulberry32(c.uSeed)
    const y0 = Y(c.topV)
    parts.push(stoneWall(c.x, c.x + c.wv, y0 + 7, Y(c.baseV), P.brick, r2, P.brickDim, 0.035))
    parts.push(`<rect x="${fx(X(c.x) - 4)}" y="${fx(y0)}" width="${fx(X(c.wv) + 8)}" height="9" fill="${P.brickLit}"/>`) // cap
    parts.push(`<rect x="${fx(X(c.x) - 4)}" y="${fx(y0)}" width="${fx(X(c.wv) + 8)}" height="9" fill="none" stroke="${P.ink}" stroke-width="1.6" opacity="0.65"/>`)
    if (smoke) sky.push(smokeRibbon(c.x + c.wv / 2, y0, X(c.wv) * 0.8, (c.topV - c.baseV) * h, r2)) // tapered paper ribbon, attached at the mouth
  }
  // a second pennant on the tallest non-tower gable (accent2), in the sky layer
  const tallGable = units
    .filter((u) => (u.kind === 'house' || u.kind === 'hall') && !u.hip)
    .sort((a, b) => b.peakV - a.peakV)[0]
  if (tallGable) sky.push(pennant(X((tallGable.x0 + tallGable.x1) / 2), tallGable.peakV, P.accent2))
  // NEAR plane: a low foreground BASTION spanning ONE side (a section, not a
  // full band — so the town's doors stay visible), warmest/lightest, merlon
  // crown, coursing, casting a shade line onto itself from the town behind.
  const nearV = 0.16
  const nearY = Y(nearV)
  const nr = mulberry32(seed ^ 0x7a11)
  const onLeft = seed % 2 === 0
  const bx0 = onLeft ? 0 : w * 0.62
  const bx1 = onLeft ? w * 0.38 : w
  const bw = bx1 - bx0
  let near = `<rect x="${fx(bx0)}" y="${fx(nearY)}" width="${fx(bw)}" height="${fx(h - nearY)}" fill="${P.paperLit}"/>`
  near += `<rect x="${fx(bx0)}" y="${fx(nearY)}" width="${fx(bw)}" height="11" fill="${P.ink}" opacity="0.2"/>` // shade cast by the town behind
  near += `<rect x="${fx(bx0)}" y="${fx(nearY + 3)}" width="${fx(bw)}" height="3" fill="${P.paperLit}"/>` // lit wall-walk
  const nteeth = 8
  const ntw = bw / (nteeth * 2 - 1)
  for (let t = 0; t < nteeth; t++) near += `<rect x="${fx(bx0 + t * 2 * ntw)}" y="${fx(nearY - 13)}" width="${fx(ntw)}" height="13" fill="${P.paperLit}" stroke="${P.ink}" stroke-width="1.3" stroke-opacity="0.45"/>`
  for (let cy = h - h * 0.05; cy > nearY; cy -= h * 0.05) near += `<line x1="${fx(bx0)}" y1="${fx(cy)}" x2="${fx(bx1)}" y2="${fx(cy)}" stroke="${P.ink}" stroke-width="1.5" opacity="${(0.34 + nr() * 0.2).toFixed(2)}"/>`
  // vertical drop shadow on the town where the bastion's inner end occludes it
  const edge = onLeft ? bx1 : bx0
  near += `<rect x="${fx(edge - (onLeft ? 7 : 0))}" y="${fx(nearY)}" width="7" height="${fx(h - nearY)}" fill="${P.ink}" opacity="0.14"/>`
  parts.push(near)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <clipPath id="cut"><path d="${silhouette}"/></clipPath>
      <radialGradient id="glow" cx="0.5" cy="0.42" r="0.75">
        <stop offset="0" stop-color="${P.goldLit}"/>
        <stop offset="0.55" stop-color="${P.gold}"/>
        <stop offset="1" stop-color="#7a5514"/>
      </radialGradient>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${P.paperLit}" stop-opacity="0.12"/>
        <stop offset="0.5" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="#241606" stop-opacity="0.4"/>
      </linearGradient>
      <linearGradient id="barrel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${P.paperDeep}" stop-opacity="0.5"/>
        <stop offset="0.22" stop-color="${P.paperLit}" stop-opacity="0.55"/>
        <stop offset="0.5" stop-color="${P.paperLit}" stop-opacity="0"/>
        <stop offset="1" stop-color="${P.paperDeep}" stop-opacity="0.6"/>
      </linearGradient>
      ${defs.join('')}
    </defs>
    <g clip-path="url(#cut)">
      <rect width="${w}" height="${h}" fill="${P.paperMid}"/>
      ${parts.join('')}
      <rect width="${w}" height="${h}" fill="url(#shade)"/>
    </g>
    <!-- smoke + high pennants drift past the die-cut edge into the sky -->
    ${sky.join('')}
    <!-- die-cut raw-paper rim on the FRONT plane's edge: thick + rim-lit -->
    <path d="${silhouette}" fill="none" stroke="${P.rim}" stroke-width="5" opacity="0.95" stroke-linejoin="round"/>
    <path d="${silhouette}" fill="none" stroke="${P.ink}" stroke-width="1.4" opacity="0.55" stroke-linejoin="round"/>
  </svg>`

  return { outline, svg }
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

async function bake(seed, w, h, smoke, towers = 7 + (seed % 2)) {
  const { outline, svg } = citadelStrip({ seed, w, h, towers, smoke })
  const flat = await sharp(Buffer.from(svg)).png().toBuffer()
  const flatRaw = await sharp(flat).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const grainCut = await grainOverArt(flatRaw, w, h, seed, 22)
  const out = await sharp(flat).composite([{ input: grainCut, blend: 'over' }]).png().toBuffer()
  return { outline, out }
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
  // AGED parchment ground (#E7D5A8 family — was near-white) + weathering
  s += `<path d="${d}" fill="${PARCH_MID}"/>`
  s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cx - x0)}" height="${fx(y1 - y0)}" fill="#efe0b6" opacity="0.28"/>`
  s += `<rect x="${fx(cx)}" y="${fx(y0)}" width="${fx(x1 - cx)}" height="${fx(y1 - y0)}" fill="${PARCH_DIM}" opacity="0.2"/>`
  for (let i = 0; i < 16; i++) s += `<circle cx="${fx(rr(r, x0, x1))}" cy="${fx(rr(r, y0, y1))}" r="${fx(rr(r, 3, 7))}" fill="#c3a86f" opacity="0.14"/>`
  // strong walnut scroll-frame + gold rule inside it
  const ix0 = x0 + w * 0.03,
    ix1 = x1 - w * 0.03,
    iy0 = y0 + h * 0.1,
    iy1 = y1 - h * 0.18
  s += `<rect x="${fx(ix0)}" y="${fx(iy0)}" width="${fx(ix1 - ix0)}" height="${fx(iy1 - iy0)}" fill="none" stroke="${INK}" stroke-width="4" opacity="0.72"/>` // walnut frame
  s += `<rect x="${fx(ix0 + 6)}" y="${fx(iy0 + 6)}" width="${fx(ix1 - ix0 - 12)}" height="${fx(iy1 - iy0 - 12)}" fill="none" stroke="${GOLD}" stroke-width="3" opacity="0.9"/>` // gold rule
  s += `<rect x="${fx(ix0 + 10)}" y="${fx(iy0 + 10)}" width="${fx(ix1 - ix0 - 20)}" height="${fx(iy1 - iy0 - 20)}" fill="none" stroke="${INK}" stroke-width="1.2" opacity="0.4"/>`
  // corner flourishes
  for (const [ox, oy, sx, sy] of [
    [ix0, iy0, 1, 1],
    [ix1, iy0, -1, 1],
    [ix0, iy1, 1, -1],
    [ix1, iy1, -1, -1],
  ]) {
    s += `<path d="M ${fx(ox)} ${fx(oy + sy * h * 0.1)} q 0 ${fx(-sy * h * 0.08)} ${fx(sx * w * 0.05)} ${fx(-sy * h * 0.08)} q ${fx(sx * w * 0.05)} 0 ${fx(sx * w * 0.05)} ${fx(sy * h * 0.05)}" fill="none" stroke="${GOLD}" stroke-width="2.6" opacity="0.8"/>`
  }
  // a central rule with stars where the HTML title card overlays
  for (let k = -3; k <= 3; k++) {
    const x = cx + k * w * 0.09
    const y = h * 0.5
    const rl = w * 0.012
    const star = []
    for (let j = 0; j < 10; j++) {
      const a = (j * Math.PI) / 5 - Math.PI / 2
      const r2 = j % 2 ? rl * 0.45 : rl
      star.push(`${fx(x + Math.cos(a) * r2)} ${fx(y + Math.sin(a) * r2)}`)
    }
    s += `<path d="M ${star.join(' L ')} Z" fill="${GOLD}" opacity="0.7"/>`
  }
  // faint vine scroll along the top rail
  s += `<path d="M ${fx(ix0)} ${fx(iy0 - h * 0.02)} q ${fx(w * 0.1)} ${fx(-h * 0.06)} ${fx(w * 0.2)} 0 q ${fx(w * 0.1)} ${fx(h * 0.06)} ${fx(w * 0.2)} 0 q ${fx(w * 0.1)} ${fx(-h * 0.06)} ${fx(w * 0.2)} 0" fill="none" stroke="#6f8a4f" stroke-width="2" opacity="0.4"/>`
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
    const WOOD = '#6a4326',
      WLIT = '#8a5a34',
      WDIM = '#3f2614',
      IRON = '#454550',
      ILIT = '#6f6f7c'
    let s = `<rect width="${w}" height="${h}" fill="${WOOD}"/>`
    s += `<rect width="${fx(w * 0.5)}" height="${h}" fill="${WLIT}" opacity="0.18"/>`
    // warm gold glow at the top edge (the chest is open)
    s += `<rect x="0" y="0" width="${w}" height="${fx(h * 0.14)}" fill="${GOLD_LIT}" opacity="0.32"/>`
    if (face === 'front' || face === 'back') {
      s += plank(false, 4, WDIM)
      const straps = face === 'front' ? [0.22, 0.5, 0.78] : [0.3, 0.7]
      for (const sx of straps) {
        s += `<rect x="${fx(w * sx - w * 0.02)}" y="0" width="${fx(w * 0.04)}" height="${h}" fill="${IRON}"/>`
        s += `<rect x="${fx(w * sx - w * 0.02)}" y="0" width="${fx(w * 0.012)}" height="${h}" fill="${ILIT}" opacity="0.6"/>`
        for (const ry of [0.2, 0.5, 0.8]) s += `<circle cx="${fx(w * sx)}" cy="${fx(h * ry)}" r="3.5" fill="${ILIT}" stroke="${INK}" stroke-width="1"/>`
      }
      if (face === 'front') s += `<rect x="${fx(w * 0.44)}" y="${fx(h * 0.36)}" width="${fx(w * 0.12)}" height="${fx(h * 0.28)}" rx="3" fill="${GOLD}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.5"/>` // lock plate
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
      // side wall: X-braced timber frame
      s += plank(true, 6, WDIM)
      s += `<rect x="${fx(w * 0.06)}" y="${fx(h * 0.1)}" width="${fx(w * 0.88)}" height="${fx(h * 0.82)}" fill="none" stroke="${WDIM}" stroke-width="6"/>`
      s += `<line x1="${fx(w * 0.06)}" y1="${fx(h * 0.1)}" x2="${fx(w * 0.94)}" y2="${fx(h * 0.92)}" stroke="${WDIM}" stroke-width="5"/>`
      s += `<line x1="${fx(w * 0.94)}" y1="${fx(h * 0.1)}" x2="${fx(w * 0.06)}" y2="${fx(h * 0.92)}" stroke="${WDIM}" stroke-width="5"/>`
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
    let s = `<rect width="${w}" height="${h}" fill="#7a5a1e"/>` // shadowed base under coins
    // heaped coins, brighter along the crest (top edge = far)
    for (let i = 0; i < 240; i++) {
      const x = rr(r, 0, w),
        y = rr(r, 0, h)
      const cr = rr(r, 5, 11)
      const shade = y < h * 0.5 ? 1 : 0.7
      s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.72)}" fill="${r() < 0.5 ? GOLD : GOLD_LIT}" opacity="${shade}" stroke="${GOLD_DIM}" stroke-width="1"/>`
    }
    s += `<rect width="${w}" height="${fx(h * 0.28)}" fill="${GOLD_LIT}" opacity="0.22"/>`
    // a few gems
    for (let i = 0; i < 6; i++) {
      const x = rr(r, w * 0.1, w * 0.9),
        y = rr(r, h * 0.2, h * 0.8)
      s += `<path d="M ${fx(x)} ${fx(y - 6)} l 6 6 l -6 6 l -6 -6 Z" fill="${['#6aa0c0', '#c46a6a', '#7fb08a'][i % 3]}" stroke="${INK}" stroke-width="1" stroke-opacity="0.4"/>`
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
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE GOLD HOARD MOUND (s5 ch4-goldpile-face, tabpiece face). Fills the
// unfolded die-cut with a heap of coins, brightest along the centre ridge (the
// mound's crest at v-mid) so the folded prism reads as a gleaming pile. ----
function goldHeap(w, h, seed) {
  const r = mulberry32(seed)
  // BRIGHT gold ground so the mound gleams even at small scale / on the shaded
  // fold half (was reading muddy-olive). High-key values + white specular glints.
  let s = `<rect width="${w}" height="${h}" fill="#d7a92c"/>`
  s += `<rect x="0" y="${fx(h * 0.32)}" width="${w}" height="${fx(h * 0.36)}" fill="${GOLD_LIT}" opacity="0.5"/>` // crest sheen
  // a crown + goblet as centrepiece treasure
  s += `<path d="M ${fx(w * 0.4)} ${fx(h * 0.5)} L ${fx(w * 0.4)} ${fx(h * 0.4)} L ${fx(w * 0.45)} ${fx(h * 0.46)} L ${fx(w * 0.5)} ${fx(h * 0.38)} L ${fx(w * 0.55)} ${fx(h * 0.46)} L ${fx(w * 0.6)} ${fx(h * 0.4)} L ${fx(w * 0.6)} ${fx(h * 0.5)} Z" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="2" stroke-opacity="0.5"/>`
  for (const jx of [0.45, 0.5, 0.55]) s += `<circle cx="${fx(w * jx)}" cy="${fx(h * 0.41)}" r="4" fill="#c04a54" stroke="${INK}" stroke-width="1" stroke-opacity="0.4"/>`
  for (let i = 0; i < 520; i++) {
    const x = rr(r, 0, w),
      y = rr(r, 0, h)
    const cr = rr(r, 7, 15)
    const bright = r() < 0.55
    s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.72)}" fill="${bright ? GOLD_LIT : GOLD}" stroke="#b8901e" stroke-width="1"/>`
    if (r() < 0.4) s += `<ellipse cx="${fx(x - cr * 0.22)}" cy="${fx(y - cr * 0.2)}" rx="${fx(cr * 0.32)}" ry="${fx(cr * 0.22)}" fill="#fff4cf" opacity="0.85"/>` // specular glint
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
  // "The Golden Dunes": warm GOLDEN sand (not red), high-contrast layer ramp so
  // the ridgelines read as bold stripes at scene scale; a SLIM sunset sky band.
  const SKY_TOP = '#d9612f', SKY_MID = '#e8934a', SKY_LOW = '#f2c069'
  const SAND = ['#eaca74', '#dcab4c', '#c88e30', '#b0761f'] // golden back -> deep front, strong steps
  const SAND_LIT = '#ffe9a0'
  const defs =
    `<linearGradient id="dvSky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${SKY_TOP}"/><stop offset="0.55" stop-color="${SKY_MID}"/><stop offset="1" stop-color="${SKY_LOW}"/></linearGradient>`
  let s = `<rect width="${w}" height="${h}" fill="url(#dvSky)"/>`
  // the low sun — a bold glowing disc (the shared landmark)
  s += `<circle cx="${fx(sun.x)}" cy="${fx(sun.y)}" r="${fx(sun.r)}" fill="#ffe6a8"/>`
  s += `<circle cx="${fx(sun.x)}" cy="${fx(sun.y)}" r="${fx(sun.r * 0.66)}" fill="#fff2cf"/>`
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
  // the camel train on the ridge — bold dark silhouettes
  for (const [x, y] of camels) s += camelGlyph(x, y, h * 0.03, '#3a2410')
  // foreground ripples + a few pebbles
  const r = mulberry32(seed ^ 0x1d)
  for (let i = 0; i < 12; i++) {
    const y = h * (0.78 + r() * 0.2)
    s += `<path d="M 0 ${fx(y)} Q ${fx(w * 0.5)} ${fx(y - h * 0.02)} ${w} ${fx(y)}" fill="none" stroke="#a06a28" stroke-width="1.6" opacity="0.4"/>`
  }
  for (let i = 0; i < 9; i++) {
    const x = rr(r, w * 0.04, w * 0.96), y = rr(r, h * 0.82, h * 0.97)
    s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(rr(r, 5, 9))}" ry="3.4" fill="#7e5220" opacity="0.6"/>`
  }
  return svgPiece(w, h, s, defs)
}

function dissolveGold(w, h, seed) {
  const { crests, camels, sun } = dissolveScene(w, h, seed) // SAME shapes as the dunes
  const defs =
    `<linearGradient id="dvGold" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#d99a1e"/><stop offset="0.5" stop-color="#f0c236"/><stop offset="1" stop-color="#ffe878"/></linearGradient>`
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
  const GOLD_HEAP = ['#e8c945', '#d9a828', '#c8901a', '#b47c12'] // back -> front, bright metallic ramp
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
  // a few big gems catching light across the heap
  for (let i = 0; i < 9; i++) {
    const x = rr(r, w * 0.08, w * 0.92), y = rr(r, h * 0.4, h * 0.94)
    const col = ['#57a6cf', '#c8434e', '#5fb488', '#8a6fd6'][i % 4]
    s += `<path d="M ${fx(x)} ${fx(y - 9)} l 9 9 l -9 9 l -9 -9 Z" fill="${col}" stroke="${INK}" stroke-width="1.1" stroke-opacity="0.4"/>`
    s += `<path d="M ${fx(x)} ${fx(y - 9)} l 9 9 l -9 0 Z" fill="#ffffff" opacity="0.35"/>`
  }
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
    // propped-open chest lid: a domed wooden panel with iron straps, seen inside
    const d = `M ${fx(w * 0.08)} ${fx(h)} L ${fx(w * 0.08)} ${fx(h * 0.4)} Q ${fx(w * 0.5)} ${fx(h * 0.02)} ${fx(w * 0.92)} ${fx(h * 0.4)} L ${fx(w * 0.92)} ${fx(h)} Z`
    let s = `<path d="${d}" fill="#6a4326"/>`
    s += `<path d="M ${fx(w * 0.08)} ${fx(h)} L ${fx(w * 0.08)} ${fx(h * 0.4)} Q ${fx(w * 0.3)} ${fx(h * 0.14)} ${fx(w * 0.5)} ${fx(h * 0.1)} L ${fx(w * 0.5)} ${fx(h)} Z" fill="#8a5a34" opacity="0.5"/>`
    for (const sx of [0.3, 0.7]) s += `<path d="M ${fx(w * sx)} ${fx(h)} L ${fx(w * sx)} ${fx(h * 0.2)}" stroke="#454550" stroke-width="${fx(w * 0.045)}" opacity="0.9"/>`
    s += `<path d="M ${fx(w * 0.5)} ${fx(h * 0.1)} m ${fx(-w * 0.08)} 0 a ${fx(w * 0.08)} ${fx(w * 0.08)} 0 1 0 ${fx(w * 0.16)} 0" fill="${GOLD}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.4"/>` // gold clasp
    s += rimPath(d, 4)
    return svgPiece(w, h, s)
  }
  if (kind === 'goldSpill') {
    // coins heaped/spilling across the front cap
    let s = `<g>`
    const base = `M 0 ${fx(h)} Q ${fx(w * 0.3)} ${fx(h * 0.4)} ${fx(w * 0.55)} ${fx(h * 0.55)} Q ${fx(w * 0.8)} ${fx(h * 0.66)} ${fx(w)} ${fx(h * 0.5)} L ${fx(w)} ${fx(h)} Z`
    s += `<path d="${base}" fill="#8a6a24"/>`
    for (let i = 0; i < 90; i++) {
      const x = rr(r, 0, w),
        y = rr(r, h * 0.5, h)
      const cr = rr(r, 5, 10)
      s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.72)}" fill="${r() < 0.5 ? GOLD : GOLD_LIT}" stroke="${GOLD_DIM}" stroke-width="1"/>`
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
// for the card's engraved "DISPATCH" — path-based so the label is font-free and
// byte-identical across bakes (no librsvg font dependency). Only D I S P A T C H.
const DISPATCH_GLYPHS = {
  D: [[['M', 0, 0], ['L', 0, 1]], [['M', 0, 0], ['C', 0.95, 0.02, 0.95, 0.98, 0, 1]]],
  I: [[['M', 0.5, 0], ['L', 0.5, 1]], [['M', 0.2, 0], ['L', 0.8, 0]], [['M', 0.2, 1], ['L', 0.8, 1]]],
  S: [[['M', 0.92, 0.14], ['C', 0.55, -0.04, 0.06, 0.06, 0.09, 0.34], ['C', 0.11, 0.54, 0.9, 0.5, 0.88, 0.72], ['C', 0.86, 1.0, 0.34, 1.0, 0.06, 0.84]]],
  P: [[['M', 0.06, 0], ['L', 0.06, 1]], [['M', 0.06, 0], ['L', 0.6, 0], ['C', 1.0, 0.04, 1.0, 0.5, 0.6, 0.54], ['L', 0.06, 0.54]]],
  A: [[['M', 0, 1], ['L', 0.5, 0], ['L', 1, 1]], [['M', 0.22, 0.62], ['L', 0.78, 0.62]]],
  T: [[['M', 0, 0], ['L', 1, 0]], [['M', 0.5, 0], ['L', 0.5, 1]]],
  C: [[['M', 0.94, 0.16], ['C', 0.58, -0.05, 0.06, 0.1, 0.06, 0.5], ['C', 0.06, 0.9, 0.58, 1.05, 0.94, 0.84]]],
  H: [[['M', 0, 0], ['L', 0, 1]], [['M', 1, 0], ['L', 1, 1]], [['M', 0, 0.5], ['L', 1, 0.5]]],
}

/** Engrave a word from DISPATCH_GLYPHS as stroke paths, left cell at (x0,y0),
 *  each cell cw x ch with `gap` between cells. Deterministic, font-free. */
function engraveWord(word, x0, y0, cw, ch, gap, stroke, sw, extra = '') {
  let out = ''
  let x = x0
  for (const c of word) {
    const g = DISPATCH_GLYPHS[c]
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

// ---- 1) THE SPUN DIAL (ch3-dispatch-dial). A brass/amber die-cut disc: eight
// 45deg wedge sectors around an engraved hub, each sector's distinguishing motif
// kept in the read annulus 0.40-0.84R. Motifs: four ravens banking at DIFFERENT
// headings (k=0,2,4,6), a compass route-needle (k=1), a cardinal rose (k=5) and
// two tally bands of different counts (k=3:10, k=7:7). A thumb-tab grip lobe
// protrudes past the rim so it reads as spinnable. ----
function dispatchDial(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2, cy = h / 2
  const R = w * 0.46875 // 300 @ 640 — shared disc-radius basis with the card
  const hubR = R * 0.3
  const bandIn = R * 0.4, bandOut = R * 0.84, bandMid = R * 0.62
  const BR = GOLD, BR_LIT = '#e7b24d', BR_DIM = GOLD_DIM, BR_DEEP = '#7a5f16'
  const SLATE = '#3f4a57', SHEEN = '#6b7580'

  const defs =
    `<clipPath id="dialCut"><circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}"/></clipPath>` +
    `<radialGradient id="dialLite" cx="0.38" cy="0.30" r="0.78">` +
    `<stop offset="0" stop-color="${BR_LIT}" stop-opacity="0.5"/>` +
    `<stop offset="0.55" stop-color="${BR_LIT}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${BR_DEEP}" stop-opacity="0.5"/>` +
    `</radialGradient>`

  // thumb-tab grip lobe protruding past the rim (down-right, stays in-canvas)
  const tabA = 300, tabHalf = 12, tabR = R * 1.12
  const bx0 = polX(cx, tabA - tabHalf, R * 0.99), by0 = polY(cy, tabA - tabHalf, R * 0.99)
  const bx1 = polX(cx, tabA + tabHalf, R * 0.99), by1 = polY(cy, tabA + tabHalf, R * 0.99)
  const tabD = `M ${fx(bx0)} ${fx(by0)} Q ${fx(polX(cx, tabA, tabR * 1.06))} ${fx(polY(cy, tabA, tabR * 1.06))} ${fx(bx1)} ${fx(by1)} Z`
  let tab = `<path d="${tabD}" fill="${BR_DIM}"/>`
  tab += `<path d="${tabD}" fill="none" stroke="${RIM}" stroke-width="4.5" opacity="0.9" stroke-linejoin="round"/>`
  tab += `<path d="${tabD}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.5" stroke-linejoin="round"/>`
  for (let i = 0; i < 3; i++) {
    const rad = R + (tabR - R) * (0.3 + i * 0.22)
    tab += `<line x1="${fx(polX(cx, tabA - tabHalf * 0.55, rad))}" y1="${fx(polY(cy, tabA - tabHalf * 0.55, rad))}" x2="${fx(polX(cx, tabA + tabHalf * 0.55, rad))}" y2="${fx(polY(cy, tabA + tabHalf * 0.55, rad))}" stroke="${INK}" stroke-width="2" opacity="0.5"/>`
  }

  let g = `<g clip-path="url(#dialCut)">`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="${BR}"/>`
  for (let k = 0; k < 8; k++) {
    g += `<path d="${wedgePath(cx, cy, k * 45 - 22.5, k * 45 + 22.5, R)}" fill="${k % 2 ? BR_DIM : BR_LIT}" opacity="${k % 2 ? '0.30' : '0.22'}"/>`
  }
  // parchment READ-BAND (the annulus the card windows reveal) so the windowed
  // sectors read as aged parchment — dark ravens/glyphs pop against it — rather
  // than muddy amber; the aged-brass field stays for the rim + hub.
  g += `<path fill-rule="evenodd" d="${circlePath(cx, cy, bandOut)} ${circlePath(cx, cy, bandIn)}" fill="${PARCH_MID}" opacity="0.66"/>`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(bandOut)}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.4"/>`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(bandIn)}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.35"/>`
  for (let k = 0; k < 8; k++) {
    const a = k * 45 + 22.5
    g += `<line x1="${fx(polX(cx, a, hubR))}" y1="${fx(polY(cy, a, hubR))}" x2="${fx(polX(cx, a, R))}" y2="${fx(polY(cy, a, R))}" stroke="${INK}" stroke-width="1.6" opacity="0.42"/>`
  }
  const ravenRot = { 0: -35, 2: 20, 4: 135, 6: -110 }
  for (let k = 0; k < 8; k++) {
    const a = k * 45
    const mx = polX(cx, a, bandMid), my = polY(cy, a, bandMid)
    if (k === 1) g += compassNeedle(mx, my, a, R * 0.4, R * 0.095, BR_LIT, SLATE)
    else if (k === 5) g += compassRose(mx, my, a, R * 0.17, SLATE, GOLD_LIT)
    else if (k === 3) g += tallyMarks(cx, cy, a, 10, R * 0.5, R * 0.72, 30, INK)
    else if (k === 7) g += tallyMarks(cx, cy, a, 7, R * 0.5, R * 0.72, 26, INK)
    else g += `<g transform="translate(${fx(mx)} ${fx(my)}) rotate(${ravenRot[k]})">${miniRaven(R * 0.153, SLATE, SHEEN)}</g>`
  }
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="url(#dialLite)"/>`
  for (let i = 0; i < 14; i++) {
    const a = rr(r, 0, 360), rad = rr(r, hubR * 1.15, R * 0.95)
    g += `<circle cx="${fx(polX(cx, a, rad))}" cy="${fx(polY(cy, a, rad))}" r="${fx(rr(r, 0.8, 1.8))}" fill="${INK}" opacity="${fx(rr(r, 0.1, 0.22))}"/>`
  }
  // engraved central hub — brass boss, knurled rim, a compass emblem, a rivet
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR)}" fill="${BR_DIM}"/>`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR)}" fill="none" stroke="${INK}" stroke-width="2.4" opacity="0.65"/>`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR * 0.78)}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.45"/>`
  for (let i = 0; i < 48; i++) {
    const a = i * 7.5
    g += `<line x1="${fx(polX(cx, a, hubR * 0.87))}" y1="${fx(polY(cy, a, hubR * 0.87))}" x2="${fx(polX(cx, a, hubR))}" y2="${fx(polY(cy, a, hubR))}" stroke="${INK}" stroke-width="1.1" opacity="0.4"/>`
  }
  g += compassRose(cx, cy, 90, hubR * 0.5, SLATE, GOLD_LIT)
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR * 0.26)}" fill="${BR_LIT}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.6"/>`
  g += `<circle cx="${fx(cx - hubR * 0.08)}" cy="${fx(cy - hubR * 0.08)}" r="${fx(hubR * 0.1)}" fill="#ffffff" opacity="0.4"/>`
  g += `</g>`

  const rim =
    `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="none" stroke="${RIM}" stroke-width="5" opacity="0.92"/>` +
    `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.55"/>`

  return svgPiece(w, h, tab + g + rim, defs)
}

// ---- 2) THE WINDOW CARD (ch3-dispatch-card). A dark-brass die-cut faceplate
// over the dial: opaque plate, transparent OUTSIDE the inscribed circle, with
// THREE die-cut apertures (true alpha-0 holes) punched at math-angles 45/90/135,
// each an annular sector of half-width 16deg over the read band 0.40-0.84R. Built
// as a single even-odd compound path (outer disc + three window sub-paths + a
// thumb-notch) so the holes are genuine cut-outs the dial shows through. Carries
// engraved window bezels, a central rivet, rim rivets and a "DISPATCH" label. ----
function dispatchCard(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2, cy = h / 2
  const R = w * 0.46875
  const bandIn = R * 0.4, bandOut = R * 0.84
  const halfW = 16
  const wins = [45, 90, 135]
  // Aged-brass ground (warmer + a step brighter than the old muddy olive) with
  // walnut engraving — reads as a distinct instrument beside the winch's bright
  // yellow-gold (this is browner/bronze, not gold).
  const PLATE = '#9c7b3c', PLATE_LIT = '#c2a05a', PLATE_DK = '#4a3316'

  const defs =
    `<radialGradient id="cardLite" cx="0.36" cy="0.30" r="0.82">` +
    `<stop offset="0" stop-color="${PLATE_LIT}" stop-opacity="0.55"/>` +
    `<stop offset="0.5" stop-color="${PLATE_LIT}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000000" stop-opacity="0.42"/>` +
    `</radialGradient>`

  // even-odd compound plate: outer disc + 3 window holes + thumb-notch hole.
  // A point inside a window is enclosed by 2 sub-paths (disc + window) => even
  // => UNFILLED => true alpha-0 aperture the dial reads through.
  const notchX = polX(cx, 270, R), notchY = polY(cy, 270, R)
  let plateD = circlePath(cx, cy, R)
  for (const psi of wins) plateD += ' ' + annularSectorPath(cx, cy, psi, halfW, bandIn, bandOut)
  plateD += ' ' + circlePath(notchX, notchY, R * 0.09)

  let s = `<g>`
  s += `<path fill-rule="evenodd" d="${plateD}" fill="${PLATE}"/>`
  s += `<path fill-rule="evenodd" d="${plateD}" fill="url(#cardLite)"/>`
  // concentric engraved rings — kept OUT of the 0.40-0.84 window band
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * 0.93)}" fill="none" stroke="${PLATE_DK}" stroke-width="2" opacity="0.7"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * 0.955)}" fill="none" stroke="${PLATE_LIT}" stroke-width="1.2" opacity="0.6"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * 0.34)}" fill="none" stroke="${PLATE_DK}" stroke-width="1.6" opacity="0.6"/>`
  // engraved bezel frames on the plate around each aperture (never enter the hole)
  for (const psi of wins) {
    s += `<path d="${annularSectorPath(cx, cy, psi, halfW + 2.4, bandIn - 9, bandOut + 9)}" fill="none" stroke="${PLATE_DK}" stroke-width="3" opacity="0.85"/>`
    s += `<path d="${annularSectorPath(cx, cy, psi, halfW + 1.6, bandIn - 4, bandOut + 4)}" fill="none" stroke="${PLATE_LIT}" stroke-width="1.4" opacity="0.7"/>`
  }
  // patina flecks on the outer ring (radius > 0.84R, never inside a window)
  for (let i = 0; i < 12; i++) {
    const a = rr(r, 0, 360), rad = rr(r, R * 0.86, R * 0.96)
    s += `<circle cx="${fx(polX(cx, a, rad))}" cy="${fx(polY(cy, a, rad))}" r="${fx(rr(r, 0.8, 1.6))}" fill="#000000" opacity="${fx(rr(r, 0.08, 0.16))}"/>`
  }
  // rim rivets (avoid the windows in the upper half and the thumb-notch at 270)
  for (const a of [0, 180, 225, 315]) {
    const rx = polX(cx, a, R * 0.9), ry = polY(cy, a, R * 0.9)
    s += `<circle cx="${fx(rx)}" cy="${fx(ry)}" r="6" fill="${PLATE_LIT}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.6"/>`
    s += `<circle cx="${fx(rx - 1.6)}" cy="${fx(ry - 1.6)}" r="2" fill="#ffffff" opacity="0.35"/>`
  }
  // engraved DISPATCH label across the free bottom half
  const word = 'DISPATCH', cw = R * 0.058, ch = R * 0.12, gap = R * 0.03
  const totalW = word.length * cw + (word.length - 1) * gap
  const lx = cx - totalW / 2, ly = cy + R * 0.5
  s += engraveWord(word, lx, ly + 1.4, cw, ch, gap, PLATE_LIT, 2.4, 'opacity="0.55"')
  s += engraveWord(word, lx, ly, cw, ch, gap, PLATE_DK, 2.6, 'opacity="0.95"')
  s += `<line x1="${fx(lx)}" y1="${fx(ly + ch + 6)}" x2="${fx(lx + totalW)}" y2="${fx(ly + ch + 6)}" stroke="${PLATE_DK}" stroke-width="1.6" opacity="0.6"/>`
  // central rivet at the hub — pins the plate flat over the dial
  const rivR = R * 0.14
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(rivR)}" fill="${PLATE_LIT}" stroke="${INK}" stroke-width="1.8" stroke-opacity="0.65"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(rivR * 0.62)}" fill="${PLATE}" stroke="${PLATE_DK}" stroke-width="1.4"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(rivR * 0.3)}" fill="${PLATE_DK}"/>`
  s += `<circle cx="${fx(cx - rivR * 0.34)}" cy="${fx(cy - rivR * 0.34)}" r="${fx(rivR * 0.16)}" fill="#ffffff" opacity="0.4"/>`
  // thumb-notch bezel on the plate side of the rim cut
  s += `<circle cx="${fx(notchX)}" cy="${fx(notchY)}" r="${fx(R * 0.11)}" fill="none" stroke="${PLATE_DK}" stroke-width="2" opacity="0.7"/>`
  s += `</g>`

  const rim =
    `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="none" stroke="${RIM}" stroke-width="5" opacity="0.92"/>` +
    `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.55"/>`

  return svgPiece(w, h, s + rim, defs)
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
  // brass number plate, centred + upright
  const px = w * 0.52, py = h * 0.5, prx = w * 0.15, pry = h * 0.3
  s += `<rect x="${fx(px - prx)}" y="${fx(py - pry)}" width="${fx(prx * 2)}" height="${fx(pry * 2)}" rx="${fx(prx * 0.35)}" fill="${GOLD}" stroke="${WOOD_EDGE}" stroke-width="1.6" stroke-opacity="0.7"/>`
  s += `<rect x="${fx(px - prx)}" y="${fx(py - pry)}" width="${fx(prx * 0.5)}" height="${fx(pry * 2)}" rx="${fx(prx * 0.3)}" fill="${GOLD_LIT}" opacity="0.6"/>`
  for (const [dx, dy] of [[-prx * 0.66, -pry * 0.82], [prx * 0.66, -pry * 0.82], [-prx * 0.66, pry * 0.82], [prx * 0.66, pry * 0.82]])
    s += `<circle cx="${fx(px + dx)}" cy="${fx(py + dy)}" r="2.4" fill="${GOLD_DIM}" stroke="${INK}" stroke-width="0.8" stroke-opacity="0.5"/>` // plate screws
  s += `<text x="${fx(px)}" y="${fx(py + pry * 0.42)}" font-family="Georgia, 'Times New Roman', serif" font-size="${fx(pry * 1.15)}" font-weight="bold" text-anchor="middle" fill="${WOOD_EDGE}">${plate}</text>`
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

// ---- texture-only bake: SVG -> flat PNG -> seeded grain masked by alpha ->
// webp. No outline sidecar (mesh stays the solver quad). ----
async function bakePieceTexture(piece, outDir) {
  const svg = piece.paint()
  const flat = await sharp(Buffer.from(svg)).png().toBuffer()
  const meta = await sharp(flat).metadata()
  const W = meta.width,
    H = meta.height
  const flatRaw = await sharp(flat).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const grainCut = await grainOverArt(flatRaw, W, H, piece.seed, piece.grain ?? 16)
  const composed = await sharp(flat).composite([{ input: grainCut, blend: 'over' }]).png().toBuffer()
  const webp = await sharp(composed).webp({ quality: 84 }).toBuffer()
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
  // ---- Spread 9 — the End Letter ----
  { id: 'end-letter', seed: 90101, w: 1024, h: 683, grain: 14, paint() { return foldedLetter(this.w, this.h, this.seed) } },
  { id: 'end-hills-m0', seed: 90110, w: 1024, h: 256, grain: 12, paint() { return distantHills(this.w, this.h, this.seed, 0) } },
  { id: 'end-hills-m1', seed: 90111, w: 1024, h: 224, grain: 12, paint() { return distantHills(this.w, this.h, this.seed, 1) } },
  { id: 'end-hills-m2', seed: 90112, w: 1024, h: 205, grain: 12, paint() { return distantHills(this.w, this.h, this.seed, 2) } },
  { id: 'end-raven', seed: 90120, w: 683, h: 512, grain: 10, paint() { return ravenFigure(this.w, this.h, this.seed) } },
  { id: 'end-mound', seed: 90130, w: 768, h: 256, grain: 16, paint() { return earthBerm(this.w, this.h, this.seed, 'grass') } },
  { id: 'end-mound-tuft', seed: 90140, w: 512, h: 448, grain: 12, paint() { return grassTuft(this.w, this.h, this.seed) } },
  // ---- Spread 1 — the Title ----
  { id: 'title-border', seed: 10101, w: 1024, h: 394, grain: 14, paint() { return titleBanner(this.w, this.h, this.seed) } },
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
  { id: 'ch2-meadow-deck', seed: 30220, w: 683, h: 512, grain: 16, paint() { return deckSurface(this.w, this.h, this.seed, 'meadow') } },
  { id: 'ch2-fringe', seed: 30230, w: 1024, h: 188, grain: 14, paint() { return meadowFringe(this.w, this.h, this.seed) } },
  { id: 'ch2-windmill', seed: 30240, w: 512, h: 620, grain: 12, paint() { return windmillSail(this.w, this.h, this.seed) } },
  // ---- Spread 5 — the Vault-Dragon (ch4 chest box, hoard, goldpile) ----
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
  // ---- Spread 2 — the Inn (ch1 dress quads, stable box, coaching yard) ----
  { id: 'ch1-inn-eaves', seed: 20201, w: 640, h: 256, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'eaves') } },
  { id: 'ch1-inn-lamp', seed: 20202, w: 292, h: 512, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'lamp') } },
  { id: 'ch1-stable-side', seed: 20210, w: 512, h: 512, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'side', 'barn') } },
  { id: 'ch1-stable-back', seed: 20211, w: 512, h: 295, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'back', 'barn') } },
  { id: 'ch1-stable-top', seed: 20212, w: 512, h: 295, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'top', 'barn') } },
  { id: 'ch1-stable-vane', seed: 20220, w: 299, h: 512, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'vane') } },
  { id: 'ch1-stable-hay', seed: 20221, w: 512, h: 293, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'hay') } },
  { id: 'ch1-yard-deck', seed: 20230, w: 1024, h: 219, grain: 16, paint() { return deckSurface(this.w, this.h, this.seed, 'yard') } },
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
  // the dispatch volvelle — a spun raven dial beneath a punched window card
  { id: 'ch3-dispatch-dial', seed: 40310, w: 640, h: 640, grain: 10, paint() { return dispatchDial(this.w, this.h, this.seed) } },
  { id: 'ch3-dispatch-card', seed: 40320, w: 640, h: 640, grain: 10, paint() { return dispatchCard(this.w, this.h, this.seed) } },
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
]

// The SIX skyline mound slots, one strip each (procedural kills the FAN_OUT
// 3-painting reuse). Dims are the TRUE mesh aspect = row.width / row.height,
// read straight from content.ts ch3-skyline-l/r rows (2026-07-24). Seeds are
// chosen so cross-gutter pairs (l-mound0 vs r-mound0, ...) differ in parity —
// which flips the gatehouse/bastion side — so no two symmetric slots read as
// near-duplicates. `towers` varies the building count per slot.
const SLOTS = [
  { id: 'ch3-skyline-l-mound0', w: 0.3219, h: 0.1089, seed: 10008, towers: 7 },
  { id: 'ch3-skyline-l-mound1', w: 0.292, h: 0.0838, seed: 10011, towers: 8 },
  { id: 'ch3-skyline-l-mound2', w: 0.2319, h: 0.0728, seed: 10014, towers: 6 },
  { id: 'ch3-skyline-r-mound0', w: 0.322, h: 0.1011, seed: 40031, towers: 8 },
  { id: 'ch3-skyline-r-mound1', w: 0.2921, h: 0.0988, seed: 40034, towers: 6 },
  { id: 'ch3-skyline-r-mound2', w: 0.232, h: 0.0666, seed: 40037, towers: 7 },
]
const SLOT_LONG_EDGE = 1024 // gate-matrix G5 budget: art max dim <= 1024

function slotDims(slot) {
  return { W: SLOT_LONG_EDGE, H: Math.round((SLOT_LONG_EDGE * slot.h) / slot.w) }
}

/** Bakes one slot straight into the art dir as <id>.webp + <id>.outline.json.
 *  Ship default: smoke off. The webp is the painted texture; the outline JSON is
 *  the shaped-mesh contour (normalized [0,1]^2, v-up hinge->crest). */
async function bakeSlot(slot, outDir) {
  const { W, H } = slotDims(slot)
  const { outline, out } = await bake(slot.seed, W, H, false, slot.towers)
  const webp = await sharp(out).webp({ quality: 82 }).toBuffer()
  await writeFile(path.join(outDir, `${slot.id}.webp`), webp)
  await writeFile(path.join(outDir, `${slot.id}.outline.json`), JSON.stringify(outline))
  return { id: slot.id, W, H, aspect: (slot.w / slot.h).toFixed(3), points: outline.length, bytes: webp.length }
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
  for (const slot of SLOTS) info.push(await bakeSlot(slot, ART_DIR))
  for (const wing of VISTA_WINGS) info.push(await bakeVistaWing(wing, ART_DIR))
  const pieceInfo = []
  for (const piece of PIECES) pieceInfo.push(await bakePieceTexture(piece, ART_DIR))
  const { artIds, outlineIds } = await writeManifests(ART_DIR)
  for (const r of info) {
    process.stdout.write(`${r.id.padEnd(24)} ${r.W}x${r.H}  a=${r.aspect}  ${r.points}pts  ${(r.bytes / 1024).toFixed(1)}kb\n`)
  }
  for (const r of pieceInfo) {
    process.stdout.write(`${r.id.padEnd(24)} ${r.W}x${r.H}  ${(r.bytes / 1024).toFixed(1)}kb\n`)
  }
  process.stdout.write(`manifest: ${artIds.length} art ids, ${outlineIds.length} outline sidecars -> ${path.relative(REPO_ROOT, ART_DIR)}\n`)
}

export { citadelStrip, CITADEL, SLOTS, slotDims, bake, bakeSlot, PIECES, bakePieceTexture }

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}
