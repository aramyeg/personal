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

// ---- THE HERO'S SATCHEL (s8 satchel-bag, vfold w1.0/h0.6). A leather
// courier's bag: rounded body, a tongued flap over the top third, two brass
// buckle straps, saddle-stitched seams. Crease down the centre = the bag's own
// fold. Symmetric about cx so the two folded panels read as one bag. ----
function leatherSatchel(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const x0 = w * 0.09,
    x1 = w * 0.91
  const bodyTop = h * 0.36,
    bot = h * 0.965,
    rad = w * 0.055
  const body = `M ${fx(x0)} ${fx(bodyTop)} L ${fx(x0)} ${fx(bot - rad)} Q ${fx(x0)} ${fx(bot)} ${fx(x0 + rad)} ${fx(bot)} L ${fx(x1 - rad)} ${fx(bot)} Q ${fx(x1)} ${fx(bot)} ${fx(x1)} ${fx(bot - rad)} L ${fx(x1)} ${fx(bodyTop)} Z`
  // flap: rounded top hood dipping to a tongue in the centre
  const fx0 = w * 0.12,
    fx1 = w * 0.88,
    flapTop = h * 0.1
  const flap = `M ${fx(fx0)} ${fx(bodyTop)} Q ${fx(fx0)} ${fx(flapTop)} ${fx(cx)} ${fx(flapTop)} Q ${fx(fx1)} ${fx(flapTop)} ${fx(fx1)} ${fx(bodyTop)} Q ${fx(fx1)} ${fx(h * 0.62)} ${fx(cx)} ${fx(h * 0.66)} Q ${fx(fx0)} ${fx(h * 0.62)} ${fx(fx0)} ${fx(bodyTop)} Z`
  const sil = `${body} ${flap}` // union drawn as two fills; rim traces the body
  let s = `<g>`
  // shoulder strap arc behind the bag
  s += `<path d="M ${fx(x0 + w * 0.02)} ${fx(bodyTop)} C ${fx(w * 0.18)} ${fx(-h * 0.06)} ${fx(w * 0.82)} ${fx(-h * 0.06)} ${fx(x1 - w * 0.02)} ${fx(bodyTop)}" fill="none" stroke="${LEATHER_DIM}" stroke-width="${fx(w * 0.03)}" opacity="0.9"/>`
  // body
  s += `<path d="${body}" fill="${LEATHER}"/>`
  s += `<path d="M ${fx(x0)} ${fx(bodyTop)} L ${fx(x0)} ${fx(bot - rad)} Q ${fx(x0)} ${fx(bot)} ${fx(x0 + rad)} ${fx(bot)} L ${fx(cx)} ${fx(bot)} L ${fx(cx)} ${fx(bodyTop)} Z" fill="${LEATHER_LIT}" opacity="0.22"/>`
  // dark bag-mouth shadow just under the flap line — reads as a deep opening
  s += `<rect x="${fx(x0)}" y="${fx(bodyTop)}" width="${fx(x1 - x0)}" height="${fx(h * 0.12)}" fill="${LEATHER_DIM}" opacity="0.85"/>`
  s += `<rect x="${fx(x0)}" y="${fx(h * 0.72)}" width="${fx(x1 - x0)}" height="${fx(h * 0.24)}" fill="${LEATHER_DIM}" opacity="0.4"/>` // weight sag shade
  // flap — mid-tone leather (not the pale highlight) so the mass reads solid
  s += `<path d="${flap}" fill="${LEATHER}"/>`
  s += `<path d="M ${fx(fx0)} ${fx(bodyTop)} Q ${fx(fx0)} ${fx(flapTop)} ${fx(cx)} ${fx(flapTop)} L ${fx(cx)} ${fx(h * 0.66)} Q ${fx(fx0)} ${fx(h * 0.62)} ${fx(fx0)} ${fx(bodyTop)} Z" fill="${LEATHER_LIT}" opacity="0.35"/>` // lit left flap half
  s += `<path d="M ${fx(fx0)} ${fx(h * 0.5)} Q ${fx(cx)} ${fx(h * 0.62)} ${fx(fx1)} ${fx(h * 0.5)} L ${fx(fx1)} ${fx(bodyTop)} Q ${fx(cx)} ${fx(h * 0.66)} ${fx(fx0)} ${fx(bodyTop)} Z" fill="${LEATHER_DIM}" opacity="0.4"/>` // shade under the tongue
  // saddle stitching along the flap edge
  s += `<path d="M ${fx(fx0 + 8)} ${fx(bodyTop)} Q ${fx(fx0 + 8)} ${fx(flapTop + 10)} ${fx(cx)} ${fx(flapTop + 10)} Q ${fx(fx1 - 8)} ${fx(flapTop + 10)} ${fx(fx1 - 8)} ${fx(bodyTop)}" fill="none" stroke="#e6c98a" stroke-width="2.2" stroke-dasharray="7 6" opacity="0.8"/>`
  // two buckle straps hanging off the flap tongue
  for (const bxN of [0.34, 0.66]) {
    const sx = w * bxN
    s += `<rect x="${fx(sx - w * 0.022)}" y="${fx(h * 0.5)}" width="${fx(w * 0.044)}" height="${fx(h * 0.34)}" fill="${LEATHER_DIM}"/>`
    s += `<rect x="${fx(sx - w * 0.022)}" y="${fx(h * 0.5)}" width="${fx(w * 0.044)}" height="${fx(h * 0.34)}" fill="none" stroke="${INK}" stroke-width="1.5" opacity="0.5"/>`
    // brass buckle
    s += `<rect x="${fx(sx - w * 0.03)}" y="${fx(h * 0.6)}" width="${fx(w * 0.06)}" height="${fx(h * 0.07)}" rx="3" fill="${GOLD}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.55"/>`
    s += `<rect x="${fx(sx - w * 0.03)}" y="${fx(h * 0.6)}" width="${fx(w * 0.06)}" height="${fx(h * 0.018)}" fill="${GOLD_LIT}"/>`
  }
  // seam down the belly + a couple of body creases
  s += `<line x1="${fx(cx)}" y1="${fx(bodyTop)}" x2="${fx(cx)}" y2="${fx(bot)}" stroke="${INK}" stroke-width="1.6" opacity="0.28"/>`
  for (const cyN of [0.78, 0.88]) s += `<path d="M ${fx(x0 + 10)} ${fx(h * cyN)} Q ${fx(cx)} ${fx(h * (cyN + 0.02))} ${fx(x1 - 10)} ${fx(h * cyN)}" fill="none" stroke="${LEATHER_DIM}" stroke-width="1.8" opacity="0.4"/>`
  s += rimPath(body)
  s += rimPath(flap, 4)
  s += `</g>`
  void sil
  return svgPiece(w, h, s)
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
  s += `<path d="${d}" fill="${PARCH}"/>`
  // lit left leaf
  s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cx - x0)}" height="${fx(y1 - y0)}" fill="#fff6e2" opacity="0.35"/>`
  // shaded right leaf edge near fold + horizontal fold crease implied by centre
  s += `<line x1="${fx(cx)}" y1="${fx(y0)}" x2="${fx(cx)}" y2="${fx(y1)}" stroke="${INK}" stroke-width="1.6" opacity="0.22"/>`
  // dog-ear fold
  s += `<path d="M ${fx(x1 - dogEar)} ${fx(y0)} L ${fx(x1)} ${fx(y0 + dogEar)} L ${fx(x1 - dogEar)} ${fx(y0 + dogEar)} Z" fill="${PARCH_DIM}" opacity="0.7" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.4"/>`
  // a salutation + ruled hand (skip the fold gutter)
  s += `<line x1="${fx(x0 + w * 0.08)}" y1="${fx(y0 + h * 0.14)}" x2="${fx(cx - w * 0.04)}" y2="${fx(y0 + h * 0.14)}" stroke="${SEAL_RED}" stroke-width="3" opacity="0.6"/>`
  for (let i = 0; i < 7; i++) {
    const y = lerp(y0 + h * 0.28, y1 - h * 0.14, i / 6)
    // left column
    s += `<line x1="${fx(x0 + w * 0.06)}" y1="${fx(y)}" x2="${fx(cx - w * 0.05)}" y2="${fx(y)}" stroke="${INK}" stroke-width="2" opacity="${(0.28 + rr(r, 0, 0.18)).toFixed(2)}"/>`
    if (i < 5) s += `<line x1="${fx(cx + w * 0.05)}" y1="${fx(y)}" x2="${fx(x1 - w * 0.06 - (i === 4 ? w * 0.2 : 0))}" y2="${fx(y)}" stroke="${INK}" stroke-width="2" opacity="${(0.28 + rr(r, 0, 0.18)).toFixed(2)}"/>`
  }
  // a signature flourish bottom-right
  s += `<path d="M ${fx(cx + w * 0.06)} ${fx(y1 - h * 0.08)} q ${fx(w * 0.1)} ${fx(-h * 0.06)} ${fx(w * 0.18)} 0 q ${fx(w * 0.06)} ${fx(h * 0.04)} ${fx(w * 0.1)} ${fx(-h * 0.03)}" fill="none" stroke="${INK}" stroke-width="2.2" opacity="0.55"/>`
  // wax seal + ribbon tails at the fold centre-bottom
  const sy = y1 - h * 0.02
  s += `<path d="M ${fx(cx - w * 0.14)} ${fx(sy - h * 0.16)} l ${fx(-w * 0.05)} ${fx(h * 0.16)} l ${fx(w * 0.08)} ${fx(-h * 0.06)} Z" fill="${SEAL_RED}" opacity="0.9"/>`
  s += `<path d="M ${fx(cx + w * 0.14)} ${fx(sy - h * 0.16)} l ${fx(w * 0.05)} ${fx(h * 0.16)} l ${fx(-w * 0.08)} ${fx(-h * 0.06)} Z" fill="${SEAL_RED}" opacity="0.9"/>`
  const seR = w * 0.06
  s += `<circle cx="${fx(cx)}" cy="${fx(y1 - h * 0.12)}" r="${fx(seR)}" fill="${SEAL_RED_LIT}" stroke="${INK}" stroke-width="1.8" stroke-opacity="0.5"/>`
  s += `<path d="M ${fx(cx)} ${fx(y1 - h * 0.12 - seR * 0.55)} l ${fx(seR * 0.32)} ${fx(seR * 0.9)} l ${fx(-seR * 0.8)} ${fx(-seR * 0.55)} l ${fx(seR * 0.96)} 0 l ${fx(-seR * 0.8)} ${fx(seR * 0.55)} Z" fill="${SEAL_RED}" opacity="0.8"/>` // embossed star
  s += rimPath(d)
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE DISTANT HILLS (s9 end-hills-mK, fan, very wide/short). A soft
// rolling ridge receding behind the letter, cool green-blue, a few tiny
// pines on the crest. Silhouette = the humped ridge; transparent sky above. ----
function distantHills(w, h, seed, idx) {
  const r = mulberry32(seed)
  // receding value: further members (higher idx) sit lighter/cooler, but stay
  // muted forest-green EARTH (not pale mint) so the fan reads as land, not cloth.
  const fills = ['#41573f', '#4c6248', '#5c7157']
  const lits = ['#5f7a58', '#6d8664', '#7e9673']
  const fill = fills[idx % fills.length]
  const lit = lits[idx % lits.length]
  const crest = h * (0.42 - idx * 0.05)
  const humps = 3 + (seed % 3)
  let top = `M 0 ${fx(h)} L 0 ${fx(crest + h * 0.16)}`
  const pts = []
  for (let i = 0; i <= humps; i++) {
    const x = (w * i) / humps
    const y = crest + Math.sin(i * 1.7 + seed) * h * 0.1 + rr(r, -h * 0.04, h * 0.04)
    pts.push([x, Math.max(h * 0.06, y)])
  }
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]
    if (i === 0) top += ` L ${fx(x)} ${fx(y)}`
    else {
      const [px, py] = pts[i - 1]
      const mx = (px + x) / 2
      top += ` Q ${fx(mx)} ${fx(Math.min(py, y) - h * 0.06)} ${fx(x)} ${fx(y)}`
    }
  }
  top += ` L ${fx(w)} ${fx(crest + h * 0.16)} L ${fx(w)} ${fx(h)} Z`
  let s = `<g>`
  s += `<path d="${top}" fill="${fill}"/>`
  // lit crest band
  s += `<path d="${top}" fill="${lit}" opacity="0.0"/>`
  s += `<path d="M 0 ${fx(crest + h * 0.16)}${pts.map(([x, y]) => ` L ${fx(x)} ${fx(y)}`).join('')} L ${fx(w)} ${fx(crest + h * 0.16)}" fill="none" stroke="${lit}" stroke-width="4" opacity="0.6"/>`
  s += `<rect x="0" y="${fx(h * 0.6)}" width="${w}" height="${fx(h * 0.4)}" fill="${INK}" opacity="0.18"/>` // valley shade
  s += `<rect x="0" y="${fx(h * 0.86)}" width="${w}" height="${fx(h * 0.14)}" fill="#3a4a34" opacity="0.5"/>` // warm earth foot grounds the ridge
  // pines dense enough to read as a forested down (not cloth)
  const pines = 9 + idx * 3
  for (let i = 0; i < pines; i++) {
    const x = rr(r, w * 0.03, w * 0.97)
    const baseY = crest + h * 0.03 + rr(r, 0, h * 0.08)
    const ph = rr(r, h * 0.13, h * 0.22)
    s += `<path d="M ${fx(x)} ${fx(baseY)} L ${fx(x - ph * 0.28)} ${fx(baseY)} L ${fx(x)} ${fx(baseY - ph)} L ${fx(x + ph * 0.28)} ${fx(baseY)} Z" fill="${fill}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.35"/>`
  }
  s += rimPath(`M 0 ${fx(crest + h * 0.16)}${pts.map(([x, y]) => ` L ${fx(x)} ${fx(y)}`).join('')} L ${fx(w)} ${fx(crest + h * 0.16)}`, 4)
  s += `</g>`
  return svgPiece(w, h, s)
}

// ---- THE RETURNING RAVEN (s9 end-raven, child w0.2/h0.15). A small cut-paper
// raven in profile riding the letter's fold, wing lifted. ----
function ravenFigure(w, h, seed) {
  const r = mulberry32(seed)
  const BLACK = '#241d24',
    SHEEN = '#4a4152'
  // body + head + tail + beak, facing right
  const d = `M ${fx(w * 0.2)} ${fx(h * 0.7)} Q ${fx(w * 0.1)} ${fx(h * 0.62)} ${fx(w * 0.16)} ${fx(h * 0.5)} Q ${fx(w * 0.24)} ${fx(h * 0.36)} ${fx(w * 0.5)} ${fx(h * 0.4)} Q ${fx(w * 0.62)} ${fx(h * 0.42)} ${fx(w * 0.66)} ${fx(h * 0.3)} Q ${fx(w * 0.7)} ${fx(h * 0.18)} ${fx(w * 0.78)} ${fx(h * 0.22)} Q ${fx(w * 0.82)} ${fx(h * 0.24)} ${fx(w * 0.8)} ${fx(h * 0.32)} L ${fx(w * 0.92)} ${fx(h * 0.34)} L ${fx(w * 0.8)} ${fx(h * 0.4)} Q ${fx(w * 0.82)} ${fx(h * 0.5)} ${fx(w * 0.72)} ${fx(h * 0.56)} Q ${fx(w * 0.95)} ${fx(h * 0.7)} ${fx(w * 0.86)} ${fx(h * 0.82)} L ${fx(w * 0.5)} ${fx(h * 0.72)} Q ${fx(w * 0.3)} ${fx(h * 0.8)} ${fx(w * 0.2)} ${fx(h * 0.7)} Z`
  let s = `<g>`
  s += `<path d="${d}" fill="${BLACK}"/>`
  // raised wing
  s += `<path d="M ${fx(w * 0.32)} ${fx(h * 0.48)} Q ${fx(w * 0.5)} ${fx(h * 0.2)} ${fx(w * 0.66)} ${fx(h * 0.26)} Q ${fx(w * 0.52)} ${fx(h * 0.44)} ${fx(w * 0.5)} ${fx(h * 0.62)} Q ${fx(w * 0.4)} ${fx(h * 0.56)} ${fx(w * 0.32)} ${fx(h * 0.48)} Z" fill="${SHEEN}" opacity="0.55" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.4"/>`
  // feather ticks + eye + beak split
  for (const t of [0.4, 0.55, 0.68]) s += `<path d="M ${fx(w * 0.3)} ${fx(h * t)} q ${fx(w * 0.1)} ${fx(-h * 0.04)} ${fx(w * 0.2)} 0" fill="none" stroke="${SHEEN}" stroke-width="1.6" opacity="0.5"/>`
  s += `<circle cx="${fx(w * 0.74)}" cy="${fx(h * 0.32)}" r="${fx(w * 0.02)}" fill="${GOLD_LIT}"/>`
  s += `<line x1="${fx(w * 0.8)}" y1="${fx(h * 0.36)}" x2="${fx(w * 0.9)}" y2="${fx(h * 0.35)}" stroke="${INK}" stroke-width="1.4" opacity="0.6"/>`
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
  s += `<path d="${d}" fill="${PARCH}"/>`
  s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cx - x0)}" height="${fx(y1 - y0)}" fill="#fff6e2" opacity="0.3"/>`
  // gold scrollwork inner frame
  const ix0 = x0 + w * 0.03,
    ix1 = x1 - w * 0.03,
    iy0 = y0 + h * 0.1,
    iy1 = y1 - h * 0.18
  s += `<rect x="${fx(ix0)}" y="${fx(iy0)}" width="${fx(ix1 - ix0)}" height="${fx(iy1 - iy0)}" fill="none" stroke="${GOLD}" stroke-width="3.5" opacity="0.85"/>`
  s += `<rect x="${fx(ix0 + 5)}" y="${fx(iy0 + 5)}" width="${fx(ix1 - ix0 - 10)}" height="${fx(iy1 - iy0 - 10)}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.4"/>`
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
  let s = `<g>`
  s += `<path d="${d}" fill="${PARCH}"/>`
  s += `<path d="M ${fx(x0)} ${fx(top)} L ${fx(cx)} ${fx(top)} L ${fx(cx)} ${fx(tip)} Q ${fx(x0)} ${fx(tip - h * 0.05)} ${fx(x0)} ${fx(shoulder)} Z" fill="#fff6e2" opacity="0.3"/>`
  s += `<path d="${d}" fill="none" stroke="${GOLD}" stroke-width="4" opacity="0.85"/>`
  // open book at the base
  s += `<path d="M ${fx(cx)} ${fx(h * 0.6)} Q ${fx(w * 0.3)} ${fx(h * 0.5)} ${fx(w * 0.22)} ${fx(h * 0.56)} L ${fx(w * 0.22)} ${fx(h * 0.72)} Q ${fx(w * 0.34)} ${fx(h * 0.66)} ${fx(cx)} ${fx(h * 0.74)} Q ${fx(w * 0.66)} ${fx(h * 0.66)} ${fx(w * 0.78)} ${fx(h * 0.72)} L ${fx(w * 0.78)} ${fx(h * 0.56)} Q ${fx(w * 0.7)} ${fx(h * 0.5)} ${fx(cx)} ${fx(h * 0.6)} Z" fill="#f6efd8" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.5"/>`
  s += `<line x1="${fx(cx)}" y1="${fx(h * 0.6)}" x2="${fx(cx)}" y2="${fx(h * 0.74)}" stroke="${INK}" stroke-width="1.6" opacity="0.4"/>`
  // gold quill crossing above the book
  s += `<path d="M ${fx(w * 0.34)} ${fx(h * 0.5)} Q ${fx(cx)} ${fx(h * 0.2)} ${fx(w * 0.66)} ${fx(h * 0.36)}" fill="none" stroke="${GOLD}" stroke-width="4" opacity="0.9"/>`
  s += `<path d="M ${fx(w * 0.6)} ${fx(h * 0.34)} l ${fx(w * 0.09)} ${fx(-h * 0.02)} l ${fx(-w * 0.04)} ${fx(h * 0.06)} Z" fill="${GOLD_LIT}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.4"/>`
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
    // side wall: timber posts + a gable of striped canvas up top
    s += `<rect width="${w}" height="${h}" fill="#e6d8b6"/>`
    s += `<rect x="0" y="0" width="${w}" height="${fx(h * 0.34)}" fill="${STRIPE}" opacity="0.9"/>` // canvas eave band
    for (let i = 1; i < 4; i++) if (i % 2) s += `<rect x="0" y="0" width="${w}" height="${fx(h * 0.34)}" fill="${STRIPE}"/>`
    s += `<rect x="${fx(w * 0.08)}" y="${fx(h * 0.34)}" width="${fx(w * 0.08)}" height="${fx(h * 0.66)}" fill="${TIMBER}"/>`
    s += `<rect x="${fx(w * 0.84)}" y="${fx(h * 0.34)}" width="${fx(w * 0.08)}" height="${fx(h * 0.66)}" fill="${TIMBER}"/>`
    s += `<rect x="${fx(w * 0.08)}" y="${fx(h * 0.34)}" width="${fx(w * 0.84)}" height="6" fill="${TDIM}"/>` // beam
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
  // warm gold base (not olive) so any gaps between coins still read as gold
  let s = `<rect width="${w}" height="${h}" fill="#b58824"/>`
  // ridge glow band down the middle (the fold crest)
  s += `<rect x="0" y="${fx(h * 0.36)}" width="${w}" height="${fx(h * 0.28)}" fill="${GOLD_LIT}" opacity="0.4"/>`
  for (let i = 0; i < 620; i++) {
    const x = rr(r, 0, w),
      y = rr(r, 0, h)
    const cr = rr(r, 6, 13)
    const near = Math.abs(y - h * 0.5) < h * 0.2
    s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr)}" ry="${fx(cr * 0.72)}" fill="${near || r() < 0.4 ? GOLD_LIT : GOLD}" stroke="${GOLD_DIM}" stroke-width="1" opacity="${near ? 1 : 0.9}"/>`
    if (r() < 0.3) s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(cr * 0.5)}" ry="${fx(cr * 0.36)}" fill="none" stroke="${GOLD_DIM}" stroke-width="0.9" opacity="0.5"/>` // coin rim
  }
  // scattered gems
  for (let i = 0; i < 10; i++) {
    const x = rr(r, w * 0.08, w * 0.92),
      y = rr(r, h * 0.1, h * 0.9)
    const g = ['#6aa0c0', '#c04a54', '#7fb08a', '#8a6fd6'][i % 4]
    s += `<path d="M ${fx(x)} ${fx(y - 8)} l 8 8 l -8 8 l -8 -8 Z" fill="${g}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.45"/>`
    s += `<path d="M ${fx(x)} ${fx(y - 8)} l 8 8 l -8 0 Z" fill="#ffffff" opacity="0.25"/>`
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
  // ---- Spread 4 — the Keep's fan spire ----
  { id: 'ch3-keep-spire-m0', seed: 40301, w: 595, h: 640, grain: 12, paint() { return spireMember(this.w, this.h, this.seed, 0) } },
  { id: 'ch3-keep-spire-m1', seed: 40302, w: 376, h: 640, grain: 12, paint() { return spireMember(this.w, this.h, this.seed, 1) } },
  { id: 'ch3-keep-spire-m2', seed: 40303, w: 253, h: 640, grain: 12, paint() { return spireMember(this.w, this.h, this.seed, 2) } },
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
