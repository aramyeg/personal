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
  const { artIds, outlineIds } = await writeManifests(ART_DIR)
  for (const r of info) {
    process.stdout.write(`${r.id.padEnd(24)} ${r.W}x${r.H}  a=${r.aspect}  ${r.points}pts  ${(r.bytes / 1024).toFixed(1)}kb\n`)
  }
  process.stdout.write(`manifest: ${artIds.length} art ids, ${outlineIds.length} outline sidecars -> ${path.relative(REPO_ROOT, ART_DIR)}\n`)
}

export { citadelStrip, CITADEL, SLOTS, slotDims, bake, bakeSlot }

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}
