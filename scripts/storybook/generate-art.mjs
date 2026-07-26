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
import { S4_DIAL_ROUTES } from './s4-dial-routes.mjs'

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
 * raven portals, deep-cut crenellation rooflines, and along every parapet a rank
 * of perched ravens cut as ONE LINKED CHAIN in the silhouette — order, not swarm
 * (swarm is s3's grammar). Every cut edge carries a PALE core-edge rim (T1/T-EDGE).
 *
 * ROUND 2 re-lights all of it at DISPATCH HOUR (see `DUSK` below): the facades
 * are storm-slate masses at nightfall and roughly every SECOND portal blazes,
 * each throwing a halo onto its own wall. The order theme is untouched — the
 * ranks are as regimented as ever — but the rookery is now read by its lights.
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

/**
 * DISPATCH HOUR (E3 s4 round 2) — the rookery's NIGHT register.
 *
 * Round 1 shipped the scene in daylight: slate-on-parchment, one portal in five
 * lit, a road drawn as a dark line on a cream page. Against the spreads the
 * reader actually likes (s5's plum nocturne, s2's lamplit night, s6/s7's
 * saturated golds) it read as the timid page of the book, so the s4 pack is
 * re-lit rather than redrawn: same geometry, same silhouettes, NIGHTFALL.
 *
 * The rule that generates every colour below: at dispatch hour the only light in
 * the rookery is LAMPLIGHT — the portals, the crown lanterns, the pools they
 * throw. So parchment is no longer a material, it is an ILLUMINANT: nothing is
 * painted parchment unless light is falling on it. Stone reads as storm slate
 * blue; anything unlit falls to ink; anything the lamps reach goes amber.
 *
 * `ROOK` above is left byte-identical on purpose — s2's courtyard print and s6's
 * bazaar floor read `ROOK.parch`, and their bakes are approved.
 */
const DUSK = {
  // ---- storm slate-blue: the facade masses, four steps of one hue ----
  slate: '#333e4d', // a near block's wall
  slateLit: '#566a80', // the spine-side reveal, copings, merlon caps
  slateDim: '#2a3442', // a far block, one step back in the aerial recession
  slateDeep: '#191f29', // the ground a facade is cut out of
  ink: '#0d1118', // an unlit portal, a raven's body, the deepest joint
  // ---- the illuminants ----
  amber: '#d98e3f', // the lamp itself
  amberLit: '#f3c064', // the lamp's bright field
  amberCore: '#ffeec2', // the white-hot core of a lit opening
  amberDeep: '#6d3a10', // the far wall inside a lit room
  // ---- parchment: ONLY where light lands ----
  parch: '#f0dcae', // a lamplit face, a posted bill under a lamp
  parchLit: '#fdf0cd', // a specular catch on lit stone
  parchDim: '#8a7c60', // stone trim at the edge of the light (string courses,
  // hood moulds, kerbs) — warm, but well under the page's lit notes
  rim: '#efe0bb', // the raw paper core every cut edge shows, warmed by lamplight
}

/** The PALE core-edge rim every rookery cut edge carries: a band of raw paper
 *  core along the silhouette with NO ink centreline — a dark hairline read
 *  BACKWARDS on these pieces (a cut edge is the paper's pale core, never a
 *  drawn line), and this is the fix. */
function rookRim(d, wCore = 5) {
  // Round 2: on the night facades the round-1 weight (a 5px near-white band)
  // read as piping — the parapet became a white line drawing and the raven
  // chain a scalloped ribbon rather than birds. The rim is narrowed and warmed
  // so it still states "this edge is cut paper" without out-drawing the art.
  const wc = wCore * 0.72
  return (
    `<path d="${d}" fill="none" stroke="${DUSK.rim}" stroke-width="${fx(wc)}" opacity="0.82" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${DUSK.parchLit}" stroke-width="${fx(wc * 0.34)}" opacity="0.5" stroke-linejoin="round" stroke-linecap="round"/>`
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

/** ONE arched raven portal in px, painted at DISPATCH HOUR.
 *
 *  A lit portal is now a LIGHT SOURCE, not a coloured hole: halo on the wall
 *  around it, glow through the arch, a white-hot core, a wash spilling down the
 *  stone below, and the perched bird read as a black cut-out ON the blaze. An
 *  unlit portal is ink, with one cold sky-catch on the inside of its arch so it
 *  still reads as a recess rather than a puncture. `boost` grades the throw with
 *  depth — the ring's downstage arms blaze, the rear rim only smoulders. */
function ravenPortal(bx, by, bw, bh, lit, boost = 0) {
  const sy = by - bh * 0.5
  const apex = by - bh
  const cy = lerp(sy, apex, 0.55)
  const arch =
    `M ${fx(bx)} ${fx(by)} L ${fx(bx)} ${fx(sy)} Q ${fx(bx)} ${fx(cy)} ${fx(bx + bw / 2)} ${fx(apex)} ` +
    `Q ${fx(bx + bw)} ${fx(cy)} ${fx(bx + bw)} ${fx(sy)} L ${fx(bx + bw)} ${fx(by)} Z`
  const mx = bx + bw / 2
  let s = ''
  if (lit) {
    // the halo on the surrounding stone — every lit portal now throws one
    s += `<ellipse cx="${fx(mx)}" cy="${fx(by - bh * 0.34)}" rx="${fx(bw * (1.55 + boost * 0.6))}" ry="${fx(bh * (0.95 + boost * 0.35))}" fill="url(#rookHalo)" opacity="${(0.3 + boost * 0.16).toFixed(2)}"/>`
    // the wash spilling down the wall under the sill. It reads through the SAME
    // soft halo gradient as the light above: a flat-filled ellipse here is what
    // printed the row of hard amber discs across the first dispatch-hour bake.
    s += `<ellipse cx="${fx(mx)}" cy="${fx(by + bh * 0.34)}" rx="${fx(bw * (1.5 + boost * 0.5))}" ry="${fx(bh * (0.55 + boost * 0.2))}" fill="url(#rookHalo)" opacity="${(0.44 + boost * 0.16).toFixed(2)}"/>`
  }
  s += `<path d="${arch}" fill="${lit ? 'url(#rookGlow)' : DUSK.ink}"/>`
  if (lit) {
    // WAVE-2 (S4-5). A blind reader's verdict on the strongest storytelling beat
    // in this model: "~25 windows and ~10 wall niches each contain a raven. At 1x
    // they are dark 3px blobs; the whole 'every window holds a messenger' idea is
    // invisible at the size it ships."
    //
    // Two things were wrong, and only one of them was the bird. The hot core sat
    // ABOVE the perch — the bird stood in front of the darker throat of the arch
    // instead of against the blaze — so the silhouette had almost no field to be
    // a silhouette against. The core is now a tall lozenge that reaches DOWN past
    // the perch line, and the bird is bigger and shaped like a bird: body, head,
    // and a tail that breaks the lozenge outline. Growth is proportional with px
    // FLOORS, because the small portals are the whole problem: on the colossus's
    // 17px foot row the bird goes from ~3.2x3.9px to ~5.1x6.3px with a 2.2px
    // head, and on the 46px gate arches it reads as a raven outright.
    s += `<ellipse cx="${fx(mx)}" cy="${fx(lerp(sy, apex, 0.3))}" rx="${fx(bw * 0.36)}" ry="${fx(bh * 0.26)}" fill="${DUSK.amberLit}" opacity="${(0.6 + boost * 0.18).toFixed(2)}"/>`
    s += `<ellipse cx="${fx(mx)}" cy="${fx(lerp(sy, apex, 0.46))}" rx="${fx(bw * 0.24)}" ry="${fx(bh * 0.24)}" fill="${DUSK.amberCore}" opacity="${(0.58 + boost * 0.22).toFixed(2)}"/>`
    // perch bar + the bird standing in the light, cut black against it
    const rbx = bx + bw * 0.54
    const rby = by - bh * 0.42
    const rrx = Math.max(2, bw * 0.3)
    const rry = Math.max(1.8, bh * 0.21)
    s += `<rect x="${fx(bx + bw * 0.1)}" y="${fx(by - bh * 0.28)}" width="${fx(bw * 0.8)}" height="${fx(Math.max(1.2, bh * 0.05))}" fill="${DUSK.ink}" opacity="0.82"/>`
    s += `<ellipse cx="${fx(rbx)}" cy="${fx(rby)}" rx="${fx(rrx)}" ry="${fx(rry)}" fill="${DUSK.ink}" opacity="0.95"/>`
    // the tail: a wedge off the outboard flank, so the body stops reading as a
    // lozenge the moment it is more than a few pixels across
    s += `<path d="M ${fx(rbx + rrx * 0.5)} ${fx(rby - rry * 0.3)} L ${fx(rbx + rrx * 2.0)} ${fx(rby + rry * 0.9)} L ${fx(rbx + rrx * 0.4)} ${fx(rby + rry * 0.7)} Z" fill="${DUSK.ink}" opacity="0.95"/>`
    s += `<circle cx="${fx(rbx - rrx * 0.85)}" cy="${fx(rby - rry * 0.95)}" r="${fx(Math.max(2.2, bw * 0.13))}" fill="${DUSK.ink}" opacity="0.95"/>`
    // the beak, and a folded wing — only where there are pixels to spend on them
    if (bw >= 16) {
      s += `<path d="M ${fx(rbx - rrx * 1.5)} ${fx(rby - rry * 0.95)} L ${fx(rbx - rrx * 2.3)} ${fx(rby - rry * 0.62)} L ${fx(rbx - rrx * 1.4)} ${fx(rby - rry * 0.5)} Z" fill="${DUSK.ink}" opacity="0.95"/>`
      s += `<path d="M ${fx(rbx - rrx * 0.5)} ${fx(rby - rry * 0.35)} Q ${fx(rbx + rrx * 0.4)} ${fx(rby + rry * 0.1)} ${fx(rbx + rrx * 0.95)} ${fx(rby + rry * 0.62)}" fill="none" stroke="${DUSK.slateLit}" stroke-width="${fx(Math.max(1, bw * 0.035))}" opacity="0.34"/>`
    }
  } else {
    // an unlit opening still has an inside: one cold catch under the arch head
    s += `<path d="M ${fx(bx + bw * 0.12)} ${fx(sy)} Q ${fx(bx + bw * 0.12)} ${fx(cy)} ${fx(mx)} ${fx(apex + bh * 0.06)}" fill="none" stroke="${DUSK.slateLit}" stroke-width="${fx(Math.max(1, bw * 0.07))}" opacity="0.3"/>`
  }
  s += `<path d="${arch}" fill="none" stroke="${DUSK.ink}" stroke-width="1.5" opacity="0.7"/>`
  // hood mould + sill: stone trim, lamplit only where a lit portal reaches it
  s += `<path d="M ${fx(bx)} ${fx(sy)} Q ${fx(bx)} ${fx(cy)} ${fx(mx)} ${fx(apex)} Q ${fx(bx + bw)} ${fx(cy)} ${fx(bx + bw)} ${fx(sy)}" fill="none" stroke="${lit ? DUSK.parch : DUSK.parchDim}" stroke-width="${fx(Math.max(1.6, bw * 0.1))}" opacity="${lit ? '0.7' : '0.5'}"/>`
  s += `<rect x="${fx(bx - bw * 0.08)}" y="${fx(by)}" width="${fx(bw * 1.16)}" height="${fx(Math.max(2, bh * 0.065))}" fill="${lit ? DUSK.parch : DUSK.parchDim}" opacity="${lit ? '0.8' : '0.4'}"/>`
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
  // than a regular pattern). ROUND 2 (dispatch hour): 1-in-5 lit was the timid
  // reading — at ~1-in-2, with every lit portal throwing a halo, "multiplicity
  // as light" finally IS the picture instead of a caption on it. The grade
  // survives: the ring's downstage arms blaze, the rear rim smoulders, so the
  // amphitheater still reads as one form brightening toward the reader.
  const PROF = {
    flank: { lo: 0.46, hi: 0.63, tower: 0.79, rows: 1, pMin: 4, pMax: 6, th: 0.13, rh: 0.18, teeth: 11, litP: 0.44, litClump: 0.64, boost: 0.3 },
    ringMid: { lo: 0.54, hi: 0.7, tower: 0.8, rows: 2, pMin: 5, pMax: 6, th: 0.11, rh: 0.17, teeth: 13, litP: 0.54, litClump: 0.74, boost: 1 },
    ringFront: { lo: 0.32, hi: 0.42, tower: 0.5, rows: 1, pMin: 4, pMax: 5, th: 0.1, rh: 0.24, teeth: 15, litP: 0.5, litClump: 0.7, boost: 0.68 },
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
  parts.push(`<rect width="${w}" height="${h}" fill="${DUSK.slateDeep}"/>`)

  for (const { b, lantern, zones } of layout) {
    const r2 = mulberry32(b.bseed ^ 0x51a7)
    const yTop = Y(b.parapetV)
    const bx = X(b.x0)
    const bwPx = X(b.x1 - b.x0)
    let s = `<g>`
    s += `<rect x="${fx(bx)}" y="${fx(yTop)}" width="${fx(bwPx)}" height="${fx(h - yTop)}" fill="${b.far ? DUSK.slateDim : DUSK.slate}"/>`
    if (b.far) s += `<rect x="${fx(bx)}" y="${fx(yTop)}" width="${fx(bwPx)}" height="${fx(h - yTop)}" fill="${DUSK.slateDeep}" opacity="0.32"/>`
    // lit spine-side reveal + shadowed fore-side reveal (cut-card relief)
    s += `<rect x="${fx(bx)}" y="${fx(yTop)}" width="${fx(Math.max(2, w * 0.004))}" height="${fx(h - yTop)}" fill="${DUSK.slateLit}" opacity="0.6"/>`
    s += `<rect x="${fx(bx + bwPx - Math.max(2, w * 0.005))}" y="${fx(yTop)}" width="${fx(Math.max(2, w * 0.005))}" height="${fx(h - yTop)}" fill="${DUSK.ink}" opacity="0.3"/>`
    // ashlar coursing
    const courseH = h * 0.055
    for (let cy = h - courseH * 0.5; cy > yTop; cy -= courseH) {
      s += `<line x1="${fx(bx)}" y1="${fx(cy)}" x2="${fx(bx + bwPx)}" y2="${fx(cy)}" stroke="${DUSK.ink}" stroke-width="1.4" opacity="${(0.18 + r2() * 0.16).toFixed(2)}"/>`
    }
    // parapet wall-walk shade under the crown
    s += `<rect x="${fx(bx)}" y="${fx(yTop)}" width="${fx(bwPx)}" height="${fx(Math.max(3, h * 0.02))}" fill="${DUSK.ink}" opacity="0.24"/>`

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
          s += `<rect x="${fx(mx)}" y="${fx(topY)}" width="${fx(mw)}" height="${fx(merH)}" fill="${b.far ? DUSK.slateDim : DUSK.slate}"/>`
          s += `<rect x="${fx(mx)}" y="${fx(topY)}" width="${fx(mw)}" height="${fx(Math.max(2, merH * 0.18))}" fill="${DUSK.slateLit}" opacity="0.75"/>`
          s += `<rect x="${fx(mx + mw * 0.72)}" y="${fx(topY)}" width="${fx(mw * 0.28)}" height="${fx(merH)}" fill="${DUSK.ink}" opacity="0.28"/>`
        }
        s += `<rect x="${fx(zx)}" y="${fx(Y(b.parapetV))}" width="${fx(zw)}" height="${fx(Math.max(2, h * 0.014))}" fill="${DUSK.ink}" opacity="0.3"/>`
      } else {
        // the rank's mass; the clip carves it into the linked chain of birds.
        const n = rankCount(z.z0, z.z1, b.rh)
        const perchV = b.parapetV + b.rh * RAVEN_PROFILE[0][1]
        s += `<rect x="${fx(zx)}" y="${fx(Y(perchV))}" width="${fx(zw)}" height="${fx(Y(b.parapetV) - Y(perchV))}" fill="${b.far ? DUSK.slateDim : DUSK.slate}"/>`
        s += `<rect x="${fx(zx)}" y="${fx(Y(perchV))}" width="${fx(zw)}" height="${fx(Math.max(2, h * 0.012))}" fill="${DUSK.slateLit}" opacity="0.7"/>`
        s += `<rect x="${fx(zx)}" y="${fx(Y(b.parapetV + b.rh))}" width="${fx(zw)}" height="${fx(Y(perchV) - Y(b.parapetV + b.rh))}" fill="${DUSK.ink}"/>`
        const cw = (z.z1 - z.z0) / n
        const cwPx = X(cw)
        // the rank is RIM-LIT from below: the portal ranks under it throw enough
        // light onto the parapet that the birds' feet and breasts catch it, which
        // is what stops the chain from reading as one black scallop at distance.
        s += `<rect x="${fx(zx)}" y="${fx(Y(perchV) - Math.max(1.6, h * 0.009))}" width="${fx(zw)}" height="${fx(Math.max(1.6, h * 0.009))}" fill="${DUSK.amberLit}" opacity="0.42"/>`
        for (let k = 0; k < n; k++) {
          const hu = facing === 'left' ? 0.17 : 0.83
          const bu = facing === 'left' ? 0.58 : 0.42
          s += `<circle cx="${fx(X(z.z0 + cw * (k + hu)))}" cy="${fx(Y(b.parapetV + b.rh * 0.94))}" r="${fx(Math.max(1.3, b.rh * h * 0.05))}" fill="${DUSK.amberCore}" opacity="0.95"/>`
          s += `<ellipse cx="${fx(X(z.z0 + cw * (k + bu)))}" cy="${fx(Y(b.parapetV + b.rh * 0.8))}" rx="${fx(cwPx * 0.24)}" ry="${fx(b.rh * h * 0.055)}" fill="${DUSK.amber}" opacity="0.26"/>`
        }
      }
    }

    // ---- THE CROWN FALLS TO NIGHT. Lit from the portals and the pooled
    // lamplight below, a facade's own parapet is the darkest thing on it. The
    // gradient is hung off the BLOCK's crown (not the image top) so it lands
    // correctly whatever a block's parapet height is.
    const crownY = Y(Math.min(0.995, b.parapetV + Math.max(b.th, b.rh)))
    s += `<rect x="${fx(bx)}" y="${fx(crownY)}" width="${fx(bwPx)}" height="${fx(h - crownY)}" fill="url(#rookWall)"/>`

    // lantern post paint (gate wall only): a real lamp — dark iron cage, hot
    // core, and a halo big enough that the gate wall reads as lit from its own
    // posts rather than sprouting an orange shape.
    if (lantern) {
      const lx = X(lantern.a)
      const lwPx = X(lantern.lw)
      const headTop = Y(b.parapetV + lantern.lh * 0.94)
      const headBot = Y(b.parapetV + lantern.lh * 0.52)
      const headH = headBot - headTop
      const hcx = lx + lwPx * 0.5
      s += `<ellipse cx="${fx(hcx)}" cy="${fx((headTop + headBot) / 2)}" rx="${fx(lwPx * 2.6)}" ry="${fx(headH * 1.9)}" fill="url(#rookHalo)" opacity="0.85"/>`
      s += `<rect x="${fx(lx + lwPx * 0.34)}" y="${fx(headBot)}" width="${fx(lwPx * 0.32)}" height="${fx(Y(b.parapetV) - headBot)}" fill="${DUSK.slateDeep}"/>`
      s += `<rect x="${fx(lx + lwPx * 0.14)}" y="${fx(headTop)}" width="${fx(lwPx * 0.72)}" height="${fx(headH)}" fill="url(#rookGlow)"/>`
      s += `<ellipse cx="${fx(hcx)}" cy="${fx(lerp(headTop, headBot, 0.44))}" rx="${fx(lwPx * 0.24)}" ry="${fx(headH * 0.26)}" fill="${DUSK.amberCore}" opacity="0.9"/>`
      // iron cage: two uprights, a cap and a foot, so the glass reads as glazed
      s += `<rect x="${fx(lx + lwPx * 0.14)}" y="${fx(headTop)}" width="${fx(lwPx * 0.72)}" height="${fx(headH)}" fill="none" stroke="${DUSK.ink}" stroke-width="2.2" opacity="0.9"/>`
      s += `<line x1="${fx(hcx)}" y1="${fx(headTop)}" x2="${fx(hcx)}" y2="${fx(headBot)}" stroke="${DUSK.ink}" stroke-width="1.8" opacity="0.7"/>`
      s += `<rect x="${fx(lx + lwPx * 0.04)}" y="${fx(headTop - Math.max(2, h * 0.012))}" width="${fx(lwPx * 0.92)}" height="${fx(Math.max(2, h * 0.012))}" fill="${DUSK.ink}" opacity="0.85"/>`
      s += `<rect x="${fx(lx + lwPx * 0.08)}" y="${fx(headBot)}" width="${fx(lwPx * 0.84)}" height="${fx(Math.max(2, h * 0.01))}" fill="${DUSK.ink}" opacity="0.8"/>`
      // and the pool it throws on the wall-walk at its foot
      s += `<ellipse cx="${fx(hcx)}" cy="${fx(Y(b.parapetV) + h * 0.016)}" rx="${fx(lwPx * 1.5)}" ry="${fx(h * 0.05)}" fill="url(#rookHalo)" opacity="0.5"/>`
    }

    // ---- PORTAL RANKS: regimented rows, ~1 in 2 lit, clumped as traffic ----
    const rowsAt = b.rows === 1 ? [0.44] : b.rows === 2 ? [0.66, 0.3] : [0.72, 0.48, 0.24]
    const pW = (b.x1 - b.x0) / (b.perRow * 1.85)
    const pH = b.parapetV * (b.rows === 1 ? 0.3 : 0.24)
    const pr = mulberry32(b.bseed ^ 0x2f19)
    let litPrev = false
    for (const rowT of rowsAt) {
      const sillV = b.parapetV * rowT
      // string course the rank stands on — at night it is stone at the EDGE of
      // the light, so it states the storey without striping the wall pale
      s += `<rect x="${fx(bx)}" y="${fx(Y(sillV) + Math.max(2, h * 0.012))}" width="${fx(bwPx)}" height="${fx(Math.max(2, h * 0.012))}" fill="${DUSK.parchDim}" opacity="0.32"/>`
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
      `<path d="M ${fx(rx)} ${fx(h)} L ${fx(rx + w * 0.07)} ${fx(h * 0.74)} L ${fx(rx + w * 0.13)} ${fx(h * 0.74)} L ${fx(rx + w * 0.09)} ${fx(h)} Z" fill="${DUSK.ink}" opacity="0.2"/>`
    )
  }
  // contact shade where the flap meets the page
  parts.push(`<rect x="0" y="${fx(h * 0.94)}" width="${w}" height="${fx(h * 0.06)}" fill="${DUSK.ink}" opacity="0.34"/>`)

  const d = outline.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'
  const body = mirror ? `<g transform="translate(${fx(w)} 0) scale(-1 1)">${parts.join('')}</g>` : parts.join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <clipPath id="cut"><path d="${d}"/></clipPath>
      <radialGradient id="rookGlow" cx="0.5" cy="0.62" r="0.8">
        <stop offset="0" stop-color="${DUSK.amberLit}"/>
        <stop offset="0.5" stop-color="${DUSK.amber}"/>
        <stop offset="1" stop-color="${DUSK.amberDeep}"/>
      </radialGradient>
      <radialGradient id="rookHalo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${DUSK.amberLit}" stop-opacity="0.72"/>
        <stop offset="0.22" stop-color="${DUSK.amber}" stop-opacity="0.34"/>
        <stop offset="0.52" stop-color="${DUSK.amber}" stop-opacity="0.12"/>
        <stop offset="0.78" stop-color="${DUSK.amber}" stop-opacity="0.03"/>
        <stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0"/>
      </radialGradient>
      <!-- NIGHT VALUE STRUCTURE. In daylight a facade is lit from the sky, so
           round 1 put its highlight on the crown. At dispatch hour the light
           comes from the portals and from the lamplight pooled on the plaza, so
           the crown is the DARKEST part of the wall and the storeys brighten
           downward — that inversion is most of what makes the strips read as
           night rather than as grey day. rookWall carries it per BLOCK (hung
           off each block's own crown); rookShade is only the image vignette. -->
      <linearGradient id="rookWall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${DUSK.ink}" stop-opacity="0.5"/>
        <stop offset="0.3" stop-color="${DUSK.ink}" stop-opacity="0.14"/>
        <stop offset="0.62" stop-color="${DUSK.ink}" stop-opacity="0"/>
        <stop offset="1" stop-color="${DUSK.ink}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="rookShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${DUSK.ink}" stop-opacity="0.18"/>
        <stop offset="0.5" stop-color="${DUSK.ink}" stop-opacity="0"/>
        <stop offset="1" stop-color="${DUSK.ink}" stop-opacity="0.14"/>
      </linearGradient>
      <linearGradient id="rookFoot" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="${DUSK.amber}" stop-opacity="0.34"/>
        <stop offset="0.28" stop-color="${DUSK.amber}" stop-opacity="0.1"/>
        <stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#cut)">
      ${body}
      <rect width="${w}" height="${h}" fill="url(#rookShade)"/>
      <rect width="${w}" height="${h}" fill="url(#rookFoot)"/>
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
    // Regraded onto the s7 nave's teal/midnight ladder (NAVE_C): the old
    // sage-green steel sat off-hue against the vault it now stands inside,
    // and read lighter than the wall behind it — a waystation is not supposed
    // to out-value the architecture.
    const STEEL = '#153f47',
      SLIT = '#1f5c63',
      SDIM = '#081f26',
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
// E3 s3 REPAINT (pack §4d): the first cut was one flat green slab with hairline
// blades and 4 px flower dots — at the pinned camera the piece is roughly
// 600x60 px, so those dots landed under 5 px and the whole fringe read as a
// painted green bar. A meadow is FLOWERS; this one is built as a real flower
// field: three value bands in the turf, three depth layers of blades, and
// cream daisies / gold buttercups / blue scabious drawn as rosettes big enough
// to survive the camera, with two couriers skimming the crest.
function meadowFringe(w, h, seed) {
  const r = mulberry32(seed)
  const TURF = SWARM.meadow
  const TURF_DIM = '#4e6f47'
  const TURF_LIT = '#87a874'
  const crest = h * 0.5
  const n = 16
  const pts = []
  for (let i = 0; i <= n; i++) pts.push([(w * i) / n, crest + Math.sin(i * 1.3 + seed) * h * 0.09 + rr(r, -h * 0.045, h * 0.045)])
  const crestAt = (x) => {
    const t = Math.max(0, Math.min(n - 0.001, (x / w) * n))
    const i = Math.floor(t)
    return lerp(pts[i][1], pts[i + 1][1], t - i)
  }
  let crestLine = `M 0 ${fx(h)} L 0 ${fx(pts[0][1])}`
  for (const p of pts) crestLine += ` L ${fx(p[0])} ${fx(p[1])}`
  const ridge = `${crestLine} L ${fx(w)} ${fx(h)} Z`

  let s = `<g>`
  // ---- TURF: three bands, so the mass has a light-to-dark structure instead
  // of being one fill the eye slides off
  s += `<path d="${ridge}" fill="${TURF}"/>`
  s += `<rect x="0" y="${fx(h * 0.62)}" width="${w}" height="${fx(h * 0.38)}" fill="${TURF_DIM}" opacity="0.55"/>`
  s += `<path d="${crestLine}" fill="none" stroke="${TURF_LIT}" stroke-width="${fx(h * 0.055)}" opacity="0.8"/>`
  // shadow pockets in the hollows of the ridge, lit swells on the humps
  for (let i = 0; i < 26; i++) {
    const x = rr(r, 0, w)
    const y = crestAt(x) + rr(r, h * 0.08, h * 0.42)
    s += `<ellipse cx="${fx(x)}" cy="${fx(y)}" rx="${fx(rr(r, w * 0.03, w * 0.09))}" ry="${fx(rr(r, h * 0.06, h * 0.16))}" fill="${r() < 0.5 ? TURF_DIM : TURF_LIT}" opacity="${fx(rr(r, 0.07, 0.16))}"/>`
  }

  // ---- GRASS, three depth layers back-to-front (pale + fine behind, dark +
  // coarse in front): a fringe reads as depth or it reads as a comb.
  const bladeLayer = (count, colour, wid, hiMin, hiMax, op) => {
    let g = ''
    for (let i = 0; i < count; i++) {
      const x = (w * (i + rr(r, 0, 1))) / count
      const y = crestAt(x) + rr(r, -h * 0.02, h * 0.06)
      // clamped so no blade is sliced flat by the canvas top edge
      const bh = Math.min(rr(r, h * hiMin, h * hiMax), y - h * 0.02)
      const lean = rr(r, -0.5, 0.5) * bh
      g += `<path d="M ${fx(x)} ${fx(y)} q ${fx(lean * 0.25)} ${fx(-bh * 0.6)} ${fx(lean)} ${fx(-bh)}" fill="none" stroke="${colour}" stroke-width="${fx(wid)}" stroke-linecap="round" opacity="${op}"/>`
    }
    return g
  }
  s += bladeLayer(90, TURF_LIT, 2.2, 0.14, 0.34, 0.55)
  s += bladeLayer(70, TURF, 3, 0.12, 0.42, 0.85)
  s += bladeLayer(46, TURF_DIM, 3.8, 0.1, 0.3, 0.9)

  // ---- THE FLOWERS. Rosettes with real petals, not dots: cream daisies are
  // the field (the daisy reference the whole spread is graded against), gold
  // buttercups the accent rhythm, a few blue scabious for the cool note. Red
  // never appears here — the pack spends its one saturated accent on the
  // hero's satchel and the three wax seals.
  const daisy = (cx, cy, rad, petal, heart) => {
    let g = ''
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + rr(r, -0.1, 0.1)
      g += `<ellipse cx="${fx(cx + Math.cos(a) * rad * 0.62)}" cy="${fx(cy + Math.sin(a) * rad * 0.62)}" rx="${fx(rad * 0.46)}" ry="${fx(rad * 0.3)}" fill="${petal}" stroke="${INK}" stroke-width="1" stroke-opacity="0.28" transform="rotate(${fx((a * 180) / Math.PI)} ${fx(cx)} ${fx(cy)})"/>`
    }
    g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(rad * 0.36)}" fill="${heart}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.4"/>`
    return g
  }
  const bell = (cx, cy, rad, colour) =>
    `<path d="M ${fx(cx - rad * 0.62)} ${fx(cy - rad * 0.3)} q ${fx(rad * 0.62)} ${fx(-rad * 0.9)} ${fx(rad * 1.24)} 0 q ${fx(-rad * 0.62)} ${fx(rad * 1.1)} ${fx(-rad * 1.24)} 0 Z" fill="${colour}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.35"/>`
  const FLOWERS = 34
  for (let i = 0; i < FLOWERS; i++) {
    const x = (w * (i + rr(r, 0.15, 0.85))) / FLOWERS
    const y0 = crestAt(x)
    const rad = h * rr(r, 0.075, 0.115)
    // the head is clamped inside the canvas: a daisy sliced flat by the top
    // edge stops reading as a flower entirely
    const stem = Math.min(rr(r, h * 0.16, h * 0.42), y0 - rad - h * 0.035)
    const lean = rr(r, -0.42, 0.42) * stem
    const fxp = x + lean
    const fyp = y0 - stem
    s += `<path d="M ${fx(x)} ${fx(y0 + h * 0.03)} q ${fx(lean * 0.2)} ${fx(-stem * 0.6)} ${fx(lean)} ${fx(-stem)}" fill="none" stroke="${TURF_DIM}" stroke-width="2.4" stroke-linecap="round"/>`
    const kind = i % 5
    if (kind === 0 || kind === 2 || kind === 3) s += daisy(fxp, fyp, rad, SWARM.cream, SWARM.gold)
    else if (kind === 1) s += daisy(fxp, fyp, rad * 0.86, SWARM.gold, SWARM.amber)
    else s += bell(fxp, fyp, rad * 0.9, '#8fa9c4')
    // one paired leaf on the stem so it is a plant, not a pin
    s += `<path d="M ${fx(x + lean * 0.4)} ${fx(y0 - stem * 0.42)} q ${fx(h * 0.09)} ${fx(-h * 0.04)} ${fx(h * 0.13)} ${fx(h * 0.03)} q ${fx(-h * 0.08)} ${fx(h * 0.02)} ${fx(-h * 0.13)} ${fx(-h * 0.03)} Z" fill="${TURF_LIT}" opacity="0.8"/>`
  }
  // clover bedded low in the turf: small edged rosettes, not pale discs (as
  // plain circles they read as foam floating on the grass)
  for (let i = 0; i < 14; i++) {
    const x = rr(r, 0, w)
    const y = crestAt(x) + rr(r, h * 0.04, h * 0.15)
    s += daisy(x, y, h * rr(r, 0.045, 0.062), SWARM.cream, SWARM.amber)
  }

  s += rimPath(crestLine, 4)
  // two couriers SKIMMING the crest (touching the ridge so the die-cut stays
  // paper-true — no floating alpha islands), gold dashed flight trails leading
  // up toward the 3D ring overhead (pack §4d).
  for (const [bx, bs] of [[0.22, 0.28], [0.73, 0.24]]) {
    const y = crestAt(w * bx) - h * bs * 0.5
    const f = beeFit(h * bs * 1.34, 'wingsMid')
    s += swarmBee(w * bx + f.dx, y, f.s, 'wingsMid')
    s += `<path d="M ${fx(w * bx + h * 0.28)} ${fx(y - h * 0.12)} q ${fx(h * 0.16)} ${fx(-h * 0.12)} ${fx(h * 0.42)} ${fx(-h * 0.16)}" fill="none" stroke="${SWARM.gold}" stroke-width="2.4" stroke-dasharray="6 5" opacity="0.85"/>`
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
  const cx = w / 2
  const baseHalf = w * 0.46
  const tipHalf = w * (idx === 2 ? 0.02 : 0.14 - idx * 0.05)
  const baseY = h * 0.98,
    tipY = h * 0.04
  const halfAt = (y) => lerp(baseHalf, tipHalf, (baseY - y) / (baseY - tipY))
  // tapered steeple silhouette
  const d = `M ${fx(cx - baseHalf)} ${fx(baseY)} L ${fx(cx - tipHalf)} ${fx(tipY)} L ${fx(cx + tipHalf)} ${fx(tipY)} L ${fx(cx + baseHalf)} ${fx(baseY)} Z`
  let s = `<g>`
  // ROUND 2: the spire fanned out of the keep's lid in daylight slate over a
  // cream stone base — the palest thing in the whole keep atlas, and the one
  // piece that kept the tower reading as a noon building. It is now night slate
  // over a lamplit base, with the louvers glowing like every other roost.
  s += `<path d="${d}" fill="${DUSK.slateDim}"/>`
  // the spine-side flank catches what light there is; the fore side falls away
  s += `<path d="M ${fx(cx - baseHalf)} ${fx(baseY)} L ${fx(cx - tipHalf)} ${fx(tipY)} L ${fx(cx)} ${fx(tipY)} L ${fx(cx)} ${fx(baseY)} Z" fill="${DUSK.slate}" opacity="0.7"/>`
  s += `<path d="M ${fx(cx + baseHalf)} ${fx(baseY)} L ${fx(cx + tipHalf)} ${fx(tipY)} L ${fx(cx)} ${fx(tipY)} L ${fx(cx)} ${fx(baseY)} Z" fill="${DUSK.slateDeep}" opacity="0.45"/>`
  // slate shingle courses (chevrons) climbing the steeple
  const rows = 12
  for (let i = 0; i < rows; i++) {
    const t = i / rows
    const y = lerp(baseY, tipY, t)
    const half = lerp(baseHalf, tipHalf, t)
    s += `<path d="M ${fx(cx - half)} ${fx(y)} L ${fx(cx)} ${fx(y - h * 0.02)} L ${fx(cx + half)} ${fx(y)}" fill="none" stroke="${i % 2 ? DUSK.ink : DUSK.slateLit}" stroke-width="1.8" opacity="${i % 2 ? '0.4' : '0.34'}"/>`
  }
  // the steeple falls to night toward its tip
  s += `<path d="${d}" fill="url(#spireNight)"/>`
  // a coursed STONE base band, lamplit from the loft roost below it, + the ring
  const bandY = h * 0.8
  const bandHalf = halfAt(bandY)
  s += `<path d="M ${fx(cx - baseHalf)} ${fx(baseY)} L ${fx(cx - bandHalf)} ${fx(bandY)} L ${fx(cx + bandHalf)} ${fx(bandY)} L ${fx(cx + baseHalf)} ${fx(baseY)} Z" fill="${DUSK.parchDim}"/>`
  s += `<path d="M ${fx(cx - baseHalf)} ${fx(baseY)} L ${fx(cx - bandHalf)} ${fx(bandY)} L ${fx(cx + bandHalf)} ${fx(bandY)} L ${fx(cx + baseHalf)} ${fx(baseY)} Z" fill="url(#spireFoot)"/>`
  for (let cy = baseY - h * 0.05; cy > bandY; cy -= h * 0.05) s += `<line x1="${fx(cx - baseHalf)}" y1="${fx(cy)}" x2="${fx(cx + baseHalf)}" y2="${fx(cy)}" stroke="${DUSK.ink}" stroke-width="1.4" opacity="0.4"/>`
  s += `<rect x="${fx(cx - baseHalf)}" y="${fx(bandY - h * 0.02)}" width="${fx(baseHalf * 2)}" height="${fx(h * 0.03)}" fill="${DUSK.amber}" opacity="0.9"/>`
  s += `<rect x="${fx(cx - baseHalf)}" y="${fx(bandY - h * 0.02)}" width="${fx(baseHalf * 2)}" height="${fx(h * 0.01)}" fill="${DUSK.amberLit}" opacity="0.8"/>`
  // a rank of lit roost louvers climbing the slice, so the spire belongs to the
  // rookery instead of being a blank cone above it
  const lw = Math.min(w * 0.14, baseHalf * 0.4)
  for (const [ly, lit] of [[0.7, true], [0.6, idx !== 1], [0.5, true], [0.4, idx === 0]]) {
    const y = h * ly
    if (halfAt(y) < lw * 0.85) continue
    s += ravenPortal(cx - lw / 2, y, lw, h * 0.075, lit && r() < 0.92, 0.45)
  }
  // an arched louver on the mid slice, an amber finial lamp on the peak slice
  if (idx === 1) {
    s += `<path d="M ${fx(cx - w * 0.1)} ${fx(h * 0.55)} L ${fx(cx - w * 0.1)} ${fx(h * 0.42)} Q ${fx(cx)} ${fx(h * 0.34)} ${fx(cx + w * 0.1)} ${fx(h * 0.42)} L ${fx(cx + w * 0.1)} ${fx(h * 0.55)} Z" fill="${DUSK.ink}" opacity="0.85"/>`
  }
  if (idx === 2) {
    s += `<ellipse cx="${fx(cx)}" cy="${fx(tipY + h * 0.05)}" rx="${fx(w * 0.42)}" ry="${fx(h * 0.06)}" fill="url(#rookHalo)" opacity="0.85"/>`
    s += `<circle cx="${fx(cx)}" cy="${fx(tipY + h * 0.05)}" r="${fx(w * 0.14)}" fill="${DUSK.amber}" stroke="${DUSK.ink}" stroke-width="1.6" stroke-opacity="0.5"/>` // finial lamp (raven seats above)
    s += `<circle cx="${fx(cx)}" cy="${fx(tipY + h * 0.05)}" r="${fx(w * 0.07)}" fill="${DUSK.amberCore}"/>`
  }
  s += rookRim(d, 4)
  s += `</g>`
  const defs =
    `<linearGradient id="spireNight" x1="0" y1="1" x2="0" y2="0">` +
    `<stop offset="0" stop-color="${DUSK.ink}" stop-opacity="0"/>` +
    `<stop offset="0.55" stop-color="${DUSK.ink}" stop-opacity="0.2"/>` +
    `<stop offset="1" stop-color="${DUSK.ink}" stop-opacity="0.42"/></linearGradient>` +
    `<linearGradient id="spireFoot" x1="0" y1="1" x2="0" y2="0">` +
    `<stop offset="0" stop-color="${DUSK.amber}" stop-opacity="0.5"/>` +
    `<stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0.08"/></linearGradient>` +
    `<radialGradient id="rookGlow" cx="0.5" cy="0.62" r="0.8">` +
    `<stop offset="0" stop-color="${DUSK.amberLit}"/><stop offset="0.5" stop-color="${DUSK.amber}"/>` +
    `<stop offset="1" stop-color="${DUSK.amberDeep}"/></radialGradient>` +
    `<radialGradient id="rookHalo" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${DUSK.amberLit}" stop-opacity="0.72"/>` +
    `<stop offset="0.22" stop-color="${DUSK.amber}" stop-opacity="0.34"/>` +
    `<stop offset="0.52" stop-color="${DUSK.amber}" stop-opacity="0.12"/>` +
    `<stop offset="0.78" stop-color="${DUSK.amber}" stop-opacity="0.03"/>` +
    `<stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0"/></radialGradient>`
  return svgPiece(w, h, s, defs)
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

// ---- RETIRED, E3 Wave-2: the s3 meadow windmill (ch2-windmill, kinetic
// arm|flap) and its windmillSail() painter are gone, layer and art together.
// A kinetic arm has its apex ON THE SPINE by construction, so this sail could
// only ever project into the courier hero's own screen column (its box
// 752..838 x 487..628 sits inside his 707..912 x 232..617): downstage of him it
// drew across his legs — the blind reader read the result as "cream slabs ruled
// with brown verticals ... hive frames" — and upstage of him it was entirely
// hidden behind him. Do not restore it: the GEOMETRY, not the paint, is what
// made it unshowable. A meadow windmill would need its own off-spine hinge to
// be visible on this spread at all. ----

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
  // L joined for the s6 RAISE A STALL cartouche (additive — no shipped word
  // uses it, so every existing engraving is byte-identical).
  L: [[['M', 0.06, 0], ['L', 0.06, 1], ['L', 0.94, 1]]],
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
      s += `<path d="${cell}" fill="${DUSK.ink}" opacity="0.6"/>`
      s += `<path d="${cell}" fill="none" stroke="${DUSK.slateLit}" stroke-width="1.5" opacity="0.75"/>`
      if (rand() < 0.45) {
        s += `<path d="${annularSectorPath(cx, cy, mid, half * 0.8, lerp(r0, r1, 0.1), lerp(r0, r1, 0.7), 6)}" fill="${DUSK.parch}" opacity="0.92"/>`
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
  let s = `<circle cx="${fx(mx)}" cy="${fx(my)}" r="${fx(rad)}" fill="${DUSK.parchLit}" opacity="0.85"/>`
  s += `<circle cx="${fx(mx)}" cy="${fx(my)}" r="${fx(rad)}" fill="none" stroke="${brass}" stroke-width="2.6" opacity="0.95"/>`
  s += `<circle cx="${fx(mx)}" cy="${fx(my)}" r="${fx(rad * 0.86)}" fill="none" stroke="${brassLit}" stroke-width="1.2" opacity="0.7"/>`
  s += `<g transform="translate(${fx(mx)} ${fx(my)}) rotate(${fx(bank)})">${miniRaven(rad * 0.86, DUSK.ink, DUSK.slateLit)}</g>`
  return s
}

// ---- 1) THE SPUN WHEEL (ch3-dispatch-dial). The sorting desk's route wheel: a
// parchment disc in a brass rim, eight 45deg sectors reading through the card's
// windows, and a thumb-tab grip lobe protruding past the rim so it reads as
// spinnable.
//
// THE EIGHT SECTORS ARE EIGHT DESTINATIONS, and the destinations are a CONTRACT
// (`./s4-dial-routes.mjs`), not a decision this painter gets to make. Round 1
// dressed six of the eight as the SAME brass raven roundel differing only in
// bank angle, and a blind reader reported the whole dial as stone dead after 450
// degrees of drag: the input was alive, but a window exposing ~21x27 SCREEN px
// cannot tell "the same badge, tilted" from "nothing happened". So every sector
// now differs on three independent axes at once, in descending order of what
// survives the downscale:
//   1. a COUNT of ravens on a pale roost shelf (1, 2 or 3) — a count is the one
//      difference that reads at 6 screen px per bird, and the shelf is shared by
//      all eight so the birds are dark-on-pale whatever the field beneath does.
//   2. a PRINCIPAL DEVICE that changes SILHOUETTE, not tone: sigil, needle,
//      tally tablet, crescent, chevron, wax seal, star, cross. Bold filled
//      shapes at ~65px source (~14 screen px) — no fine linework survives here.
//   3. the wedge's FIELD tint, stepped through the DUSK table. Tone alone was
//      round 1's mistake, so it is the supporting difference, not the read.
// plus the destination name engraved small, and a bar/dot rim cadence keyed to
// the sector index so the wheel reads as having a POSITION and not just a state.
//
// AUTHORED IN EACH SECTOR'S OWN FRAME. Every sector is one group carrying
// `translate(cx,cy) rotate(90 - a)`, which puts the sector's math-angle onto
// local math-angle 90. Inside that group "radially outward" is straight UP, a
// tangential offset is plain local x, and the legend reads the same way out of
// every sector — which is also the only orientation that reads upright through
// all three windows (they sit at 45/90/135, the card's upper half). ----
function dispatchDial(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const cy = h / 2
  const R = w * 0.46875 // 300 @ 640 — shared disc-radius basis with the card
  const hubR = R * 0.3
  const bandIn = R * 0.4
  const bandOut = R * 0.84
  const BR = GOLD
  const BR_LIT = '#e7b24d'
  const BR_DIM = GOLD_DIM
  const BR_DEEP = '#7a5f16'

  // ROUND 2: the wheel is the one thing on this spread that SHOULD stay
  // parchment — it is the desk's lit face, read under a lamp. What changes is
  // that it is now unmistakably LAMPLIT rather than daylit: a hot amber falloff
  // from the upper-left lamp into a deep shadowed lower-right, so the disc reads
  // as a warm island on a night page instead of a pale cream plate on it.
  const defs =
    `<clipPath id="dialCut"><circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}"/></clipPath>` +
    `<radialGradient id="dialLite" cx="0.34" cy="0.26" r="0.86">` +
    `<stop offset="0" stop-color="${DUSK.amberCore}" stop-opacity="0.5"/>` +
    `<stop offset="0.34" stop-color="${DUSK.amberLit}" stop-opacity="0.22"/>` +
    `<stop offset="0.62" stop-color="${DUSK.amberDeep}" stop-opacity="0.2"/>` +
    `<stop offset="1" stop-color="${DUSK.ink}" stop-opacity="0.62"/>` +
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
  // the eight DESTINATION wedges, each tinted from its route's `field`
  for (let k = 0; k < 8; k++) {
    g += `<path d="${wedgePath(cx, cy, k * 45 - 22.5, k * 45 + 22.5, R)}" fill="${DUSK[S4_DIAL_ROUTES[k].field]}" opacity="0.3"/>`
  }
  // the READ BAND the card's windows reveal — aged parchment, so slate ravens
  // and brass glyphs pop against it rather than muddying into the field.
  g += `<path fill-rule="evenodd" d="${circlePath(cx, cy, bandOut)} ${circlePath(cx, cy, bandIn)}" fill="${PARCH}" opacity="0.86"/>`
  // ...and the per-sector wash INSIDE it, at full strength. This is the one
  // difference that covers the whole aperture rather than a glyph's worth of it,
  // so it carries the "a real share of the window changed" half of the read.
  for (let k = 0; k < 8; k++) {
    g += `<path d="${annularSectorPath(cx, cy, k * 45, 22.5, bandIn, bandOut, 18)}" fill="${DUSK[S4_DIAL_ROUTES[k].field]}" opacity="0.62"/>`
  }
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(bandOut)}" fill="none" stroke="${BR}" stroke-width="3" opacity="0.75"/>`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(bandIn)}" fill="none" stroke="${BR}" stroke-width="2.6" opacity="0.7"/>`
  // detent ticks on the sector boundaries (the 45deg clicks)
  for (let k = 0; k < 8; k++) {
    const a = k * 45 + 22.5
    g += `<line x1="${fx(polX(cx, a, hubR))}" y1="${fx(polY(cy, a, hubR))}" x2="${fx(polX(cx, a, R))}" y2="${fx(polY(cy, a, R))}" stroke="${INK}" stroke-width="1.7" opacity="0.4"/>`
    g += `<circle cx="${fx(polX(cx, a, bandOut + 12))}" cy="${fx(polY(cy, a, bandOut + 12))}" r="4" fill="${BR}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.55"/>`
  }
  // ---- THE EIGHT DESTINATIONS ------------------------------------------------
  // Local frame per sector (see the header): outward is -y, tangential is +x.
  // The read band 0.40-0.84R is budgeted radially, outermost first, because the
  // window is only ~132px deep in the source and every band has to earn it:
  //   0.826-0.882R  the destination name, engraved small
  //   0.625-0.755R  the pale roost shelf and its COUNT of ravens
  //   0.400-0.610R  the principal device
  // and the bar/dot bearing cadence sits at 0.855-0.975R, clear of the band.
  const closed = (arr) => 'M ' + arr.map(([px, py]) => `${fx(px)} ${fx(py)}`).join(' L ') + ' Z'
  const arcPts = (ox, oy, rad, t0, t1, steps) => {
    const out = []
    for (let i = 0; i <= steps; i++) {
      const t = lerp(t0, t1, i / steps) * D2R
      out.push([ox + rad * Math.cos(t), oy + rad * Math.sin(t)])
    }
    return out
  }

  /** One sector's PRINCIPAL DEVICE, centred on the local origin, bold enough to
   *  survive being ~14 screen px wide. `S` is its half-size. */
  const device = (kind, S, weight) => {
    if (kind === 'sigil') return ravenSigil(0, 0, S * 0.98, 0, BR, BR_LIT)
    if (kind === 'needle') return compassNeedle(0, 0, 90, S * 2.05, S * 0.66, BR_LIT, DUSK.slate)
    if (kind === 'tally') {
      // a STRUCK TALLY TABLET rather than a bare five-bar gate: bare radial
      // strokes at this size are sub-pixel on screen, so the gate is cut into a
      // brass plate whose WIDTH is the route's traffic and whose bars are thick.
      const tw = S * (1.05 + weight * 0.056)
      const th = S * 1.28
      let s = `<rect x="${fx(-tw / 2)}" y="${fx(-th / 2)}" width="${fx(tw)}" height="${fx(th)}" rx="${fx(S * 0.16)}" fill="${BR_LIT}"/>`
      s += `<rect x="${fx(-tw / 2)}" y="${fx(-th / 2)}" width="${fx(tw)}" height="${fx(th)}" rx="${fx(S * 0.16)}" fill="none" stroke="${INK}" stroke-width="${fx(S * 0.1)}" stroke-opacity="0.8"/>`
      const pitch = tw / 5.2
      for (let i = 0; i < 4; i++) {
        const bx = (i - 1.5) * pitch
        s += `<line x1="${fx(bx)}" y1="${fx(-th * 0.32)}" x2="${fx(bx)}" y2="${fx(th * 0.32)}" stroke="${INK}" stroke-width="${fx(S * 0.19)}" stroke-linecap="round"/>`
      }
      s += `<line x1="${fx(-1.9 * pitch)}" y1="${fx(th * 0.34)}" x2="${fx(1.9 * pitch)}" y2="${fx(-th * 0.34)}" stroke="${INK}" stroke-width="${fx(S * 0.17)}" stroke-linecap="round"/>`
      return s
    }
    if (kind === 'crescent') {
      // the harbour mouth: outer circle minus an offset inner one, horns
      // tangential, the opening facing radially OUT
      const th0 = 61.6
      const pts = arcPts(0, 0, S, th0, 360 - th0, 18).concat(arcPts(S * 0.5, 0, S * 0.88, 360 - 91.6, 91.6, 18))
      const d = closed(pts)
      return (
        `<g transform="rotate(-90)"><path d="${d}" fill="${BR_LIT}"/>` +
        `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${fx(S * 0.11)}" stroke-opacity="0.85" stroke-linejoin="round"/></g>`
      )
    }
    if (kind === 'chevron') {
      // the mountain pass: two stacked chevron bands pointing radially outward
      let s = ''
      for (const [shift, arm] of [[S * 0.1, S * 0.92], [S * 0.66, S * 0.72]]) {
        const t = S * 0.36
        const d = closed([
          [-arm, -S * 0.12 + shift], [0, -S + shift], [arm, -S * 0.12 + shift],
          [arm, -S * 0.12 + shift + t], [0, -S + shift + t], [-arm, -S * 0.12 + shift + t],
        ])
        s += `<path d="${d}" fill="${BR_LIT}"/>`
        s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${fx(S * 0.1)}" stroke-opacity="0.85" stroke-linejoin="round"/>`
      }
      return s
    }
    if (kind === 'seal') {
      // sealed correspondence only: a lobed wax blob, the one non-brass device
      const lobes = []
      for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * 360 * D2R
        const rad = S * 0.92 * (1 + 0.085 * Math.cos(9 * t))
        lobes.push([rad * Math.cos(t), rad * Math.sin(t)])
      }
      const d = closed(lobes)
      let s = `<path d="${d}" fill="${SEAL_RED}"/>`
      s += `<ellipse cx="${fx(-S * 0.26)}" cy="${fx(-S * 0.28)}" rx="${fx(S * 0.48)}" ry="${fx(S * 0.42)}" fill="${SEAL_RED_LIT}" opacity="0.6"/>`
      s += `<circle cx="0" cy="0" r="${fx(S * 0.46)}" fill="none" stroke="${INK}" stroke-width="${fx(S * 0.1)}" opacity="0.55"/>`
      s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${fx(S * 0.09)}" stroke-opacity="0.7" stroke-linejoin="round"/>`
      return s
    }
    if (kind === 'star') {
      // the unmapped far stations: a five-point star, one point radially outward
      const pts = []
      for (let i = 0; i < 10; i++) {
        const t = (-90 + i * 36) * D2R
        const rad = i % 2 ? S * 0.44 : S
        pts.push([rad * Math.cos(t), rad * Math.sin(t)])
      }
      const d = closed(pts)
      return (
        `<path d="${d}" fill="${BR_LIT}"/>` +
        `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${fx(S * 0.1)}" stroke-opacity="0.85" stroke-linejoin="round"/>` +
        `<circle cx="0" cy="0" r="${fx(S * 0.16)}" fill="${DUSK.amberCore}" opacity="0.9"/>`
      )
    }
    // 'cross' — escorted birds: a cross pattée, the blockiest silhouette here
    const A = S
    const Wq = S * 0.28
    const T = S * 0.52
    const d = closed([
      [-Wq, -Wq], [-T, -A], [T, -A], [Wq, -Wq],
      [A, -T], [A, T], [Wq, Wq],
      [T, A], [-T, A], [-Wq, Wq],
      [-A, T], [-A, -T],
    ])
    return (
      `<path d="${d}" fill="${BR_LIT}"/>` +
      `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${fx(S * 0.1)}" stroke-opacity="0.85" stroke-linejoin="round"/>` +
      `<circle cx="0" cy="0" r="${fx(S * 0.2)}" fill="${INK}" opacity="0.75"/>`
    )
  }

  const shelfIn = R * 0.625
  const shelfOut = R * 0.755
  const shelfHalf = 15
  const birdS = R * 0.041
  const markR = R * 0.505
  const markS = R * 0.105
  for (let k = 0; k < 8; k++) {
    const route = S4_DIAL_ROUTES[k]
    let sec = `<g transform="translate(${fx(cx)} ${fx(cy)}) rotate(${fx(90 - k * 45)})">`

    // the BEARING CADENCE, struck inside the rim: bars keyed to k parity, dots to
    // k/2, so all eight rim marks are a different pattern and the wheel has a
    // position. Held clear of the 0.40-0.84R window band on purpose.
    const bars = 1 + (k % 2)
    const dots = Math.floor(k / 2)
    for (let i = 0; i < bars; i++) {
      const bx = (i - (bars - 1) / 2) * R * 0.05
      sec += `<line x1="${fx(bx)}" y1="${fx(-R * 0.875)}" x2="${fx(bx)}" y2="${fx(-R * 0.975)}" stroke="${INK}" stroke-width="${fx(R * 0.015)}" opacity="0.7" stroke-linecap="round"/>`
      sec += `<line x1="${fx(bx)}" y1="${fx(-R * 0.875)}" x2="${fx(bx)}" y2="${fx(-R * 0.975)}" stroke="${BR_LIT}" stroke-width="${fx(R * 0.005)}" opacity="0.6" stroke-linecap="round"/>`
    }
    for (let j = 0; j < dots; j++) {
      const dx = (j - (dots - 1) / 2) * R * 0.055
      sec += `<circle cx="${fx(dx)}" cy="${fx(-R * 0.852)}" r="${fx(R * 0.014)}" fill="${BR}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.6"/>`
    }

    // the ROOST SHELF and its count of ravens. The shelf is IDENTICAL in all
    // eight sectors on purpose: a constant pale ground is what makes 1 vs 2 vs 3
    // ink birds a legible count rather than a tonal guess, and it is also the
    // largest per-detent change in the aperture.
    const shelf = annularSectorPath(0, 0, 90, shelfHalf, shelfIn, shelfOut, 14)
    sec += `<path d="${shelf}" fill="${DUSK.parchLit}" opacity="0.9"/>`
    sec += `<path d="${shelf}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.5"/>`
    const pitch = birdS * 3.1
    for (let i = 0; i < route.ravens; i++) {
      const bx = (i - (route.ravens - 1) / 2) * pitch
      // a perch notch under each bird: if the birds themselves blur at 1x, the
      // notches still count them
      sec += `<line x1="${fx(bx)}" y1="${fx(-shelfIn - R * 0.004)}" x2="${fx(bx)}" y2="${fx(-shelfIn - R * 0.028)}" stroke="${INK}" stroke-width="${fx(R * 0.013)}" opacity="0.85" stroke-linecap="round"/>`
      sec += `<g transform="translate(${fx(bx)} ${fx(-R * 0.69)})">${miniRaven(birdS, DUSK.ink, DUSK.parchDim)}</g>`
    }

    // the principal device
    sec += `<g transform="translate(0 ${fx(-markR)})">${device(route.mark, markS, route.weight)}</g>`

    // the destination, engraved small — doubled (bright ghost under a dark cut)
    // so it holds on both the amber fields and the slate ones
    const kn = route.key.length
    const kcw = R * 0.0435
    const kch = R * 0.056
    const kgap = R * 0.0105
    const kx = -(kn * kcw + (kn - 1) * kgap) / 2
    const ky = -R * 0.826
    sec += engraveWord(route.key, kx, ky + R * 0.005, kcw, kch, kgap, DUSK.parchLit, 3, 'opacity="0.6"')
    sec += engraveWord(route.key, kx, ky, kcw, kch, kgap, INK, 3.2, 'opacity="0.92"')

    sec += `</g>`
    g += sec
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
  g += compassRose(cx, cy, 90, hubR * 0.5, DUSK.slate, GOLD_LIT)
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
// lower half carries the celebrated brass tag, engraved font-free from
// ENGRAVE_GLYPHS with a pointing manicule: ONE word, SPIN, at the largest cap
// height the plate will hold (see the tag block below for why it is one word). ----
function dispatchCard(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const cy = h / 2
  const R = w * 0.46875
  const bandIn = R * 0.4
  const bandOut = R * 0.84
  const halfW = 16
  const wins = [45, 90, 135]
  const PLATE = DUSK.slate
  const PLATE_LIT = DUSK.slateLit
  const PLATE_DK = DUSK.ink
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
  // ONE WORD. The plate used to read "(1) SPIN — ROUTE THE RAVENS" over two
  // lines and the reader could only make it out by rendering at 3x: the whole
  // interaction hung on ~100x20 screen px of dark-gold-on-gold at a steep
  // foreshortening. Two findings, one fix each:
  //   - unreadable at 1x  ->  drop the second line and the numeral, and spend
  //     the entire plate on SPIN at ~2.4x the old cap height (R*0.36, which is
  //     ~22 screen px at the ~130px the card projects).
  //   - "(1)" implies a (2) and a (3)  ->  there is no other numbered plate on
  //     this spread, so the numeral goes. `circledOne` stays in the module for
  //     art that wants it; nothing here calls it.
  // The manicule still points into the word, and the plate is sized to the word
  // rather than the word squeezed into the plate.
  const tagW = R * 1.3
  const tagH = R * 0.5
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
  // the doubled-stroke engraving idiom: a bright ghost offset under a dark cut,
  // which is what makes struck metal survive a 5x downscale. Weights scale with
  // the cap height now that the cap height is worth scaling.
  const line = (word, cw, ch, gap, yTop, x0, sw) => {
    let out = engraveWord(word, x0, yTop + sw * 0.34, cw, ch, gap, BR_LIT, fx(sw * 0.9), 'opacity="0.55"')
    out += engraveWord(word, x0, yTop, cw, ch, gap, PLATE_DK, fx(sw), 'opacity="0.96"')
    return out
  }
  const wordW = (word, cw, gap) => word.length * cw + (word.length - 1) * gap
  // SPIN, and nothing else, filling the plate
  const cwS = R * 0.2
  const chS = R * 0.36
  const gapS = R * 0.05
  const swS = R * 0.038
  const lS = 'SPIN'
  const lX = cx - wordW(lS, cwS, gapS) / 2
  const lY = tagY + (tagH - chS) / 2
  s += line(lS, cwS, chS, gapS, lY, lX, swS)
  // the manicule, pointing into the word from the spine side. Held inboard of
  // R*0.10 from the plate: further out and its cuff runs off the disc.
  s += manicule(tagX - R * 0.1, tagY + tagH * 0.5, R * 0.1, PARCH, INK)

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
  g += `<rect width="${w}" height="${h}" fill="${DUSK.slateDim}"/>`
  g += `<rect x="${fx(X(0.18))}" y="0" width="${fx(X(0.09))}" height="${h}" fill="${DUSK.slateLit}" opacity="0.55"/>`
  g += `<rect x="${fx(X(0.18))}" y="0" width="${fx(X(0.028))}" height="${h}" fill="${DUSK.parchDim}" opacity="0.5"/>`
  g += `<rect x="${fx(X(0.66))}" y="0" width="${fx(X(0.16))}" height="${h}" fill="${DUSK.slateDeep}" opacity="0.62"/>`
  g += `<rect x="${fx(X(0.78))}" y="0" width="${fx(X(0.04))}" height="${h}" fill="${DUSK.ink}" opacity="0.4"/>`
  // dispatch hour: the shaft falls to night toward its cap and brightens down
  // into the lamplight standing on the road at its foot
  g += `<rect width="${w}" height="${fx(Y(0.05))}" fill="url(#towerNight)"/>`
  // ashlar coursing up the shaft
  for (let cy = h; cy > Y(0.6); cy -= h * 0.036) {
    g += `<line x1="${fx(X(0.06))}" y1="${fx(cy)}" x2="${fx(X(0.94))}" y2="${fx(cy)}" stroke="${DUSK.ink}" stroke-width="1.4" opacity="${(0.22 + r() * 0.16).toFixed(2)}"/>`
  }
  // plinth + corbel band
  g += `<rect x="${fx(X(0.06))}" y="${fx(Y(0.09))}" width="${fx(X(0.88))}" height="${fx(Y(0.05) - Y(0.09))}" fill="${DUSK.slateDeep}"/>`
  g += `<rect x="${fx(X(0.06))}" y="${fx(Y(0.09))}" width="${fx(X(0.88))}" height="${fx(Math.max(2, h * 0.008))}" fill="${DUSK.parchDim}" opacity="0.8"/>`
  g += `<rect x="${fx(X(0.1))}" y="${fx(Y(0.58))}" width="${fx(X(0.8))}" height="${fx(Math.max(3, h * 0.016))}" fill="${DUSK.parchDim}" opacity="0.88"/>`
  // stacked portal ranks — 5 tiers of 2, boosted glow and more of them lit so
  // the gatehouse is legible as a lit dovecote and not as furniture.
  // FOUR tiers, not five: the old top tier sat at v 0.55 and its arch (0.12 tall)
  // punched through the corbel line at 0.60, so the outline clipped it into a
  // black rectangle — invisible while one portal in four was lit, an obvious
  // stray box now that half of them blaze.
  const pw = 0.145
  const ph = 0.11
  let litPrev = false
  for (const sillV of [0.14, 0.26, 0.37, 0.48]) {
    g += `<rect x="${fx(X(0.18))}" y="${fx(Y(sillV) + Math.max(2, h * 0.006))}" width="${fx(X(0.64))}" height="${fx(Math.max(2, h * 0.008))}" fill="${DUSK.parchDim}" opacity="0.65"/>`
    for (const cu of [0.35, 0.65]) {
      const roll = r()
      // the tower is only TWO portals wide, so neighbouring halos overlap hard —
      // a modest boost here, and the rest of the legibility comes from the crown
      // lantern and the body's value step rather than from flooding the shaft
      const lit = roll < 0.48 || (litPrev && roll < 0.66)
      litPrev = lit
      g += ravenPortal(X(cu - pw / 2), Y(sillV), X(pw), ph * h, lit, 0.3)
    }
  }
  // crenellated cap merlons
  for (const [z0, z1] of [[0.12, 0.4], [0.6, 0.88]]) {
    const tw = (z1 - z0) / 5
    for (let t = 0; t < 3; t++) {
      const mx = X(z0 + t * 2 * tw)
      g += `<rect x="${fx(mx)}" y="${fx(Y(0.68))}" width="${fx(X(tw))}" height="${fx(Y(0.6) - Y(0.68))}" fill="${DUSK.slateDim}"/>`
      g += `<rect x="${fx(mx)}" y="${fx(Y(0.68))}" width="${fx(X(tw))}" height="${fx(Math.max(2, h * 0.008))}" fill="${DUSK.rim}" opacity="0.85"/>`
    }
  }
  // the CROWN LANTERN — the tower's signature (pack 4e) and, at dispatch hour,
  // the brightest single point on the spread. Halo washing the whole cap, glazed
  // amber box in an iron cage, white-hot core; the perched raven above reads by
  // standing black IN that light.
  g += `<ellipse cx="${fx(X(0.5))}" cy="${fx(Y(0.76))}" rx="${fx(X(0.86))}" ry="${fx(h * 0.13)}" fill="url(#rookHalo)" opacity="0.9"/>`
  g += `<ellipse cx="${fx(X(0.5))}" cy="${fx(Y(0.632))}" rx="${fx(X(0.34))}" ry="${fx(h * 0.03)}" fill="url(#rookHalo)" opacity="0.7"/>`
  g += `<rect x="${fx(X(0.46))}" y="${fx(Y(0.7))}" width="${fx(X(0.08))}" height="${fx(Y(0.6) - Y(0.7))}" fill="${DUSK.slateDeep}"/>`
  g += `<rect x="${fx(X(0.38))}" y="${fx(Y(0.84))}" width="${fx(X(0.24))}" height="${fx(Y(0.695) - Y(0.84))}" fill="url(#rookGlow)"/>`
  g += `<ellipse cx="${fx(X(0.5))}" cy="${fx(Y(0.775))}" rx="${fx(X(0.062))}" ry="${fx(h * 0.036)}" fill="${DUSK.amberLit}" opacity="0.92"/>`
  g += `<ellipse cx="${fx(X(0.5))}" cy="${fx(Y(0.775))}" rx="${fx(X(0.034))}" ry="${fx(h * 0.021)}" fill="${DUSK.amberCore}"/>`
  g += `<rect x="${fx(X(0.38))}" y="${fx(Y(0.84))}" width="${fx(X(0.24))}" height="${fx(Y(0.695) - Y(0.84))}" fill="none" stroke="${DUSK.ink}" stroke-width="2.6" opacity="0.85"/>`
  g += `<line x1="${fx(X(0.5))}" y1="${fx(Y(0.84))}" x2="${fx(X(0.5))}" y2="${fx(Y(0.695))}" stroke="${DUSK.ink}" stroke-width="1.8" opacity="0.6"/>`
  g += `<line x1="${fx(X(0.38))}" y1="${fx(Y(0.775))}" x2="${fx(X(0.62))}" y2="${fx(Y(0.775))}" stroke="${DUSK.ink}" stroke-width="1.5" opacity="0.5"/>`
  // the raven perched on the lantern (the contour already cut its silhouette):
  // solid ink against the lit lantern below it, so the bird reads as a shape.
  // Its underside catches the lantern, which is what tells the reader the black
  // pentagon over the lamp is a BIRD and not the tower's roof.
  g += `<rect x="${fx(X(0.33))}" y="${fx(Y(0.995))}" width="${fx(X(0.34))}" height="${fx(Y(0.83) - Y(0.995))}" fill="${DUSK.ink}"/>`
  g += `<rect x="${fx(X(0.33))}" y="${fx(Y(0.848))}" width="${fx(X(0.34))}" height="${fx(Math.max(2, h * 0.007))}" fill="${DUSK.amberLit}" opacity="0.75"/>`
  g += `<path d="M ${fx(X(0.345))} ${fx(Y(0.9))} Q ${fx(X(0.4))} ${fx(Y(0.94))} ${fx(X(0.47))} ${fx(Y(0.955))}" fill="none" stroke="${DUSK.amber}" stroke-width="2" opacity="0.5"/>`
  g += `<circle cx="${fx(X(0.3375 + 0.325 * 0.17))}" cy="${fx(Y(TOWER_RAVEN_V0 + TOWER_RAVEN_H * 0.93))}" r="${fx(Math.max(2, h * 0.013))}" fill="${DUSK.amberCore}"/>`
  g += `<rect width="${w}" height="${h}" fill="url(#rookShade)"/>`
  g += `</g>`

  const defs =
    `<clipPath id="towerCut"><path d="${d}"/></clipPath>` +
    `<linearGradient id="towerNight" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${DUSK.ink}" stop-opacity="0.46"/>` +
    `<stop offset="0.42" stop-color="${DUSK.ink}" stop-opacity="0.1"/>` +
    `<stop offset="1" stop-color="${DUSK.ink}" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="rookGlow" cx="0.5" cy="0.62" r="0.8">` +
    `<stop offset="0" stop-color="${DUSK.amberLit}"/><stop offset="0.5" stop-color="${DUSK.amber}"/>` +
    `<stop offset="1" stop-color="${DUSK.amberDeep}"/></radialGradient>` +
    `<radialGradient id="rookHalo" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${DUSK.amberLit}" stop-opacity="0.72"/>` +
    `<stop offset="0.22" stop-color="${DUSK.amber}" stop-opacity="0.34"/>` +
    `<stop offset="0.52" stop-color="${DUSK.amber}" stop-opacity="0.12"/>` +
    `<stop offset="0.78" stop-color="${DUSK.amber}" stop-opacity="0.03"/>` +
    `<stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="rookShade" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${DUSK.ink}" stop-opacity="0.12"/>` +
    `<stop offset="0.5" stop-color="#000000" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${DUSK.ink}" stop-opacity="0.3"/></linearGradient>`

  // a wider pale core-edge rim than the flanks get: this piece must hold its
  // own silhouette against the keep's facade directly behind it.
  return svgPiece(w, h, g + rookRim(d, 6.5), defs)
}

// ============================================================================
// E3 s4 ROUND-4 — THE RAVEN CITY (PIECES `ch3-tower`, `ch3-dispatch-line`,
// `ch3-dispatch-line-basket`, `ch3-terrace`). The r3 canyon was a MIRROR — two
// near-identical cliffs facing each other across the gutter — and a mirror has
// no scale, because nothing in it measures anything else. Round 4 paints ONE
// DIAGONAL SWEEP at dispatch hour instead: a colossal crooked rookery tower
// climbing the LEFT page past the keep's crown, a working dispatch cable falling
// across the RIGHT page with letter-baskets riding it, and a low sprawl of
// terraced roosts where the ravens sort. The keep nests in the tower's shadow.
//
// THE TRAPEZOID CONTRACT. The mesh no longer hands a storey the whole sheet:
// `stagedChainNodeU` gives each NODE the u sub-range its radial span actually
// occupies, so a storey is a TRAPEZOID in the painting and the union of them is
// the piece's die. `chainBands` + `chainNodeUs` re-derive both from the SAME
// numbers content.ts hands the solver, so a cornice can never drift into the
// middle of a window and a gantry can never be cut off by the die. Everything
// outside the band is fully transparent — never sampled, so a stroke painted
// there is a stroke thrown away. The storeys deliberately do NOT line up: the
// kinks in that band ARE the crooked read, which is why the flanks are bitten
// INWARD by a seeded jitter everywhere EXCEPT at the deck windows, where the
// paper runs flush to the boundary and a platform juts out over the storey
// below without ever leaving the sheet.
//
// WHAT BEATS THE r3 CLIFFS IS VALUE, NOT DETAIL. Those walls read pale and
// washed out against the black page: three full-sheet atmosphere gradients plus
// a halo per portal lifted the whole face to a flat lavender, and a 5px
// near-white rim piped the die like a cake. Here the stone starts near-black,
// every wash is LOCAL (a warm pool at the foot, a night fall at the crown, a
// lamplit inboard flank — never a full-sheet grey), the rim is narrowed to a
// hairline of raw paper, and the amber is spent only where it buys contrast:
// inside the portals, on the ledges the lamps stand on, and nowhere else.
//
// LIGHT. u = 0 is the INBOARD (gutter) edge on every piece here, and that is
// where the scene's light lives — the keep's gate, the lamplit road, the city.
// So the inboard flank is the lit face and the outboard falls to night, on the
// tower and on the roosts alike.
// ============================================================================

/** Storey v-bands of a staged chain's art, v-UP in image fractions, ROOT FIRST
 *  — the exact numbers `stagedChainBand` derives from the same storey lengths.
 *  Never hardcode these: the folds in the paper and the folds in the painting
 *  have to be one set of numbers. */
function chainBands(storeys) {
  const total = storeys.reduce((a, b) => a + b, 0)
  const out = []
  let below = 0
  for (const s of storeys) {
    out.push([below / total, (below + s) / total])
    below += s
  }
  return out
}

/** Per-NODE u-ranges of a TRAPEZOID chain's art — the exact fractions
 *  `stagedChainNodeU` hands the mesh, from the same radial spans content.ts
 *  hands the solver. `spans` are [radius, width] pairs, root node first; the
 *  painting is authored across the chain's full radial extent and each node
 *  samples the sub-range it occupies. */
function chainNodeUs(spans) {
  const rNear = Math.min(...spans.map(([r]) => r))
  const rFar = Math.max(...spans.map(([r, sw]) => r + sw))
  const extent = Math.max(1e-6, rFar - rNear)
  return spans.map(([r, sw]) => [(r - rNear) / extent, (r + sw - rNear) / extent])
}

/** The die edge at height v. `side` 0 is the INBOARD (gutter) flank, 1 the
 *  outboard one. Piecewise linear between node u-ranges — this band is the only
 *  paper there is, so every rank, ledge and lamp is placed against it. */
function chainEdgeAt(bands, us, v, side) {
  let k = 0
  while (k < bands.length - 1 && v > bands[k][1]) k++
  const [v0, v1] = bands[k]
  const t = Math.min(1, Math.max(0, (v - v0) / Math.max(1e-6, v1 - v0)))
  return lerp(us[k][side], us[k + 1][side], t)
}

/** One flank of a trapezoid stack's die, walked bottom to top. The wall is
 *  bitten INWARD by a seeded jitter; a DECK window runs flush to the trapezoid
 *  boundary and enters and leaves on a horizontal STEP, which is what a jutting
 *  platform looks like from the side. `decks` is one window list per storey, in
 *  storey-height fractions. `vMax` is where the flank MEETS THE SKYLINE: a flank
 *  walked all the way to v = 1 under a crest cut at 0.9 leaves a needle standing
 *  in each top corner of the die, which is what the first bake printed. */
function stackFlank(bands, us, side, decks, rand, inset, stations, vMax = 1) {
  const sgn = side === 0 ? 1 : -1
  const pts = []
  let wasDeck = null
  // the bite is a slow random WALK, not per-station noise: a weathered edge
  // wanders over several storeys, and white noise on a die edge reads as a bad
  // scan rather than as cut paper
  let walk = 0.5
  for (let k = 0; k < bands.length; k++) {
    const [v0, v1] = bands[k]
    const win = decks[k] ?? []
    for (let i = 0; i <= stations; i++) {
      const t = i / stations
      const v = lerp(v0, v1, t)
      const deck = win.some(([a, b]) => t >= a && t <= b)
      walk = Math.min(1, Math.max(0, walk + (rand() * 2 - 1) * 0.4))
      const u = chainEdgeAt(bands, us, v, side) + (deck ? 0 : sgn * inset * (0.22 + walk * 1.35))
      if (v > vMax) {
        if (pts.length) pts.push([pts[pts.length - 1][0], vMax])
        return pts
      }
      if (wasDeck !== null && deck !== wasDeck && pts.length) pts.push([pts[pts.length - 1][0], v])
      pts.push([u, v])
      wasDeck = deck
    }
  }
  return pts
}

/** The lamp gradients every raven-city piece paints with. `ravenPortal` and the
 *  lantern heads address them by name, so a piece that forgets them prints its
 *  windows as holes. */
function cityLampDefs() {
  return (
    `<radialGradient id="rookGlow" cx="0.5" cy="0.62" r="0.8">` +
    `<stop offset="0" stop-color="${DUSK.amberCore}"/><stop offset="0.42" stop-color="${DUSK.amber}"/>` +
    `<stop offset="1" stop-color="${DUSK.amberDeep}"/></radialGradient>` +
    `<radialGradient id="rookHalo" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${DUSK.amberLit}" stop-opacity="0.66"/>` +
    `<stop offset="0.24" stop-color="${DUSK.amber}" stop-opacity="0.26"/>` +
    `<stop offset="0.56" stop-color="${DUSK.amber}" stop-opacity="0.07"/>` +
    `<stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0"/></radialGradient>`
  )
}

/** A crest lantern's silhouette: a SHORT stout post under a broad glazed head
 *  and a finial. The shared `lanternTop` was authored for a parapet post on a
 *  wide facade, and at a merlon's width it cuts an 8px flagpole with a pinhead
 *  lamp — this profile puts two thirds of the height into the head, so the crown
 *  lamps read as lamps at the reading camera. */
function cliffLanternTop(a, lw, v0, lh) {
  return [
    [a + 0.34 * lw, v0], [a + 0.34 * lw, v0 + 0.3 * lh], [a + 0.06 * lw, v0 + 0.38 * lh],
    [a + 0.06 * lw, v0 + 0.78 * lh], [a + 0.3 * lw, v0 + 0.86 * lh], [a + 0.5 * lw, v0 + lh],
    [a + 0.7 * lw, v0 + 0.86 * lh], [a + 0.94 * lw, v0 + 0.78 * lh], [a + 0.94 * lw, v0 + 0.38 * lh],
    [a + 0.66 * lw, v0 + 0.3 * lh], [a + 0.66 * lw, v0],
  ]
}

/** A wavy bedding line across a face — hand-cut coursing, not machine ashlar.
 *  A dead straight line is what makes cut paper read as print. */
function strataPath(y, x0, x1, amp, segs, rand) {
  let d = `M ${fx(x0)} ${fx(y)}`
  for (let i = 1; i <= segs; i++) {
    d += ` L ${fx(lerp(x0, x1, i / segs))} ${fx(y + (rand() * 2 - 1) * amp)}`
  }
  return d
}

/** One raven wheeling free of a crest, as a closed gull silhouette — cut into
 *  the transparent sky the die leaves above the roofline, so the paper itself
 *  carries the birds (T-LINKED-RANK's opposite number: the few NOT in the
 *  rank). */
function wheelRavenPath(cx, cy, s, tilt) {
  const c = Math.cos(tilt)
  const sn = Math.sin(tilt)
  const P = (dx, dy) => `${fx(cx + (dx * c - dy * sn) * s)} ${fx(cy + (dx * sn + dy * c) * s)}`
  return (
    `M ${P(-1, 0.08)} Q ${P(-0.54, -0.44)} ${P(-0.15, -0.04)} L ${P(0, 0.05)} ` +
    `L ${P(0.15, -0.04)} Q ${P(0.54, -0.44)} ${P(1, 0.08)} ` +
    `Q ${P(0.42, 0.17)} ${P(0.11, 0.13)} L ${P(0.05, 0.26)} L ${P(-0.05, 0.26)} ` +
    `L ${P(-0.11, 0.13)} Q ${P(-0.42, 0.17)} ${P(-1, 0.08)} Z`
  )
}

/** The cut-paper FACET LATTICE under every raven-city facade: angular planes,
 *  each a shade off its neighbours, lit on the inboard arris and inked on the
 *  outboard one. Painted UNDER the architecture, so a rank reads as cut into a
 *  mass rather than stamped on a flat wall. Tones run pale-to-ink so the caller
 *  picks how dark the mass sits. */
function cityFacets(x0, x1, yTop, yBot, tones, nx, ny, rand, h) {
  const grid = []
  for (let j = 0; j <= ny; j++) {
    const row = []
    for (let i = 0; i <= nx; i++) {
      const edge = i === 0 || i === nx
      const cap = j === 0 || j === ny
      const x = edge ? (i === 0 ? x0 - 3 : x1 + 3) : lerp(x0, x1, i / nx) + (rand() * 2 - 1) * ((x1 - x0) / nx) * 0.32
      row.push([x, lerp(yBot, yTop, j / ny) + (cap ? 0 : (rand() * 2 - 1) * h * 0.011)])
    }
    grid.push(row)
  }
  let s = ''
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = grid[j][i]
      const b = grid[j][i + 1]
      const c = grid[j + 1][i + 1]
      const e = grid[j + 1][i]
      const pd = `M ${fx(a[0])} ${fx(a[1])} L ${fx(b[0])} ${fx(b[1])} L ${fx(c[0])} ${fx(c[1])} L ${fx(e[0])} ${fx(e[1])} Z`
      // planes facing the gutter (low i) lean toward the lamplight, outer ones to ink
      const pick = Math.min(tones.length - 1, Math.max(0, Math.round((i / Math.max(1, nx - 1)) * (tones.length - 1) + (rand() * 2 - 1) * 1.2)))
      s += `<path d="${pd}" fill="${tones[pick]}" opacity="${(0.5 + rand() * 0.34).toFixed(2)}"/>`
      s += `<path d="M ${fx(a[0])} ${fx(a[1])} L ${fx(e[0])} ${fx(e[1])}" fill="none" stroke="${DUSK.slateLit}" stroke-width="${fx(1.4 + rand() * 1.8)}" opacity="${(0.2 + rand() * 0.22).toFixed(2)}"/>`
      s += `<path d="M ${fx(b[0])} ${fx(b[1])} L ${fx(c[0])} ${fx(c[1])}" fill="none" stroke="${DUSK.ink}" stroke-width="${fx(1.6 + rand() * 1.8)}" opacity="${(0.34 + rand() * 0.3).toFixed(2)}"/>`
    }
  }
  return s
}

/** A seeded UNEVEN partition of [a, b] into `n` cells, returned as n+1 cut
 *  points. The raven city's first bake printed rank after rank of identical
 *  cells, and a terrace of identical cells is a spreadsheet: houses were built
 *  in different decades by different people, so their frontages differ. `spread`
 *  is how far a cell may stray from its equal share (0.4 = +-40%). */
function unevenSplit(a, b, n, rand, spread) {
  const wts = []
  let tot = 0
  for (let i = 0; i < n; i++) {
    const x = 1 + (rand() * 2 - 1) * spread
    wts.push(x)
    tot += x
  }
  const out = [a]
  let acc = 0
  for (let i = 0; i < n; i++) {
    acc += wts[i]
    out.push(lerp(a, b, acc / tot))
  }
  return out
}

/** A LINKED RANK of ravens standing on a ledge, with a wash of lamplight behind
 *  it so the birds have something to be black against — a chain of ink on ink is
 *  what reads as a scallop instead of as birds. Drawn in px. */
function perchedRank(X, Y, u0, u1, v0, bh, w, h) {
  const cnt = Math.max(2, Math.round(((u1 - u0) * w) / Math.max(6, bh * h * RAVEN_CELL)))
  // the contour is closed at HALF a bird's height, not at the ledge: the profile
  // only dips to 0.55 between neighbours, so filling all the way down prints one
  // black bar with a sawtooth on it instead of a rank of birds
  const foot = v0 + bh * 0.5
  const chain = ravenChainTop(u0, u1, foot, bh * 0.5, cnt, 'left')
  let d = `M ${fx(X(u0))} ${fx(Y(foot))}`
  for (const [u, v] of chain) d += ` L ${fx(X(u))} ${fx(Y(v))}`
  d += ` L ${fx(X(u1))} ${fx(Y(foot))} Z`
  // a wash of lamplight behind the rank, so the birds have something to be black
  // against — a chain of ink on ink is what reads as a scallop
  let s = `<ellipse cx="${fx(X((u0 + u1) / 2))}" cy="${fx(Y(v0 + bh * 0.55))}" rx="${fx(X(u1 - u0) * 0.62)}" ry="${fx(bh * h)}" fill="url(#rookHalo)" opacity="0.85"/>`
  const cw = (u1 - u0) / cnt
  for (let i = 0; i < cnt; i++) {
    const lx = X(u0 + cw * (i + 0.42))
    s += `<rect x="${fx(lx)}" y="${fx(Y(foot))}" width="${fx(Math.max(1.6, bh * h * 0.06))}" height="${fx(Y(v0) - Y(foot))}" fill="${DUSK.ink}"/>`
  }
  s += `<path d="${d}" fill="${DUSK.ink}"/>`
  s += `<path d="${d}" fill="none" stroke="${DUSK.rim}" stroke-width="1.3" opacity="0.3" stroke-linejoin="round"/>`
  s += `<rect x="${fx(X(u0))}" y="${fx(Y(v0) - Math.max(1.8, h * 0.0035))}" width="${fx(X(u1 - u0))}" height="${fx(Math.max(1.8, h * 0.0035))}" fill="${DUSK.amberLit}" opacity="0.72"/>`
  return s
}

/** A BOUNDED lamp bloom for the mostly-transparent pieces. `rookHalo` fades to
 *  zero over a wide radius, and out here that is a trap: the panel renders at
 *  alphaTest 0.1 and the house grain pass floors EVERY non-transparent pixel at
 *  ~16% alpha, so a wide soft halo prints as a grey disc hanging in the air.
 *  Two hard-edged warm ellipses instead — small, warm enough to read as light,
 *  and they stop where they stop. */
function warmBloom(cx, cy, r) {
  // three stepped rings rather than one disc: a single hard-edged ellipse reads
  // as a sticker, and three read as falloff even though every edge is hard
  return [1, 0.68, 0.4]
    .map((f, i) => `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(r * f)}" ry="${fx(r * f * 0.94)}" fill="${i === 2 ? DUSK.amberLit : DUSK.amber}" opacity="${[0.14, 0.18, 0.26][i]}"/>`)
    .join('')
}

/** A glazed lantern head on a post, in px — the one warm object the raven city
 *  repeats at every scale (crown post, gantry lamp, roost lamp, basket lamp).
 *  `halo` 0 skips the soft wash, for the die-cut pieces that cannot afford it. */
function lampHead(cx, yTop, yBot, lw, halo) {
  const hh = yBot - yTop
  let s = halo > 0 ? `<ellipse cx="${fx(cx)}" cy="${fx((yTop + yBot) / 2)}" rx="${fx(lw * halo)}" ry="${fx(hh * halo * 0.8)}" fill="url(#rookHalo)"/>` : ''
  s += `<rect x="${fx(cx - lw * 0.5)}" y="${fx(yTop)}" width="${fx(lw)}" height="${fx(hh)}" fill="url(#rookGlow)"/>`
  s += `<ellipse cx="${fx(cx)}" cy="${fx(lerp(yTop, yBot, 0.5))}" rx="${fx(lw * 0.26)}" ry="${fx(hh * 0.26)}" fill="${DUSK.amberCore}"/>`
  s += `<rect x="${fx(cx - lw * 0.5)}" y="${fx(yTop)}" width="${fx(lw)}" height="${fx(hh)}" fill="none" stroke="${DUSK.ink}" stroke-width="2.2" opacity="0.92"/>`
  s += `<rect x="${fx(cx - lw * 0.62)}" y="${fx(yTop - Math.max(2, hh * 0.16))}" width="${fx(lw * 1.24)}" height="${fx(Math.max(2, hh * 0.16))}" fill="${DUSK.ink}" opacity="0.92"/>`
  return s
}

/** A small warm ROOST WINDOW — square-headed, lintel and sill, the terraces'
 *  answer to the tower's arched portals. Horizontal, domestic, and repeated by
 *  the dozen: the whole point is that the roosts are NOT the colossus. */
function roostWindow(bx, by, bw, bh, lit) {
  const cx = bx + bw / 2
  let s = ''
  if (lit) {
    s += `<ellipse cx="${fx(cx)}" cy="${fx(by - bh * 0.4)}" rx="${fx(bw * 1.5)}" ry="${fx(bh * 1.15)}" fill="url(#rookHalo)" opacity="0.62"/>`
    s += `<rect x="${fx(bx)}" y="${fx(by - bh)}" width="${fx(bw)}" height="${fx(bh)}" fill="url(#rookGlow)"/>`
    // WAVE-2 (S4-5), the same fix as `ravenPortal`: the hot field now reaches DOWN
    // to the sill so the bird has something to be a silhouette against, and the
    // bird is a bird — body, head, tail — with px floors, because the terraces'
    // upper storeys shrink these windows well past the point where a bw*0.2
    // ellipse is a bird rather than a speck.
    s += `<rect x="${fx(bx + bw * 0.14)}" y="${fx(by - bh * 0.86)}" width="${fx(bw * 0.72)}" height="${fx(bh * 0.74)}" fill="${DUSK.amberCore}" opacity="0.9"/>`
    // a bird cut black against the blaze, because every window here is a roost
    const wbx = bx + bw * 0.58
    const wby = by - bh * 0.26
    const wrx = Math.max(2, bw * 0.27)
    const wry = Math.max(1.8, bh * 0.23)
    s += `<ellipse cx="${fx(wbx)}" cy="${fx(wby)}" rx="${fx(wrx)}" ry="${fx(wry)}" fill="${DUSK.ink}"/>`
    s += `<path d="M ${fx(wbx + wrx * 0.5)} ${fx(wby - wry * 0.3)} L ${fx(wbx + wrx * 1.8)} ${fx(wby + wry * 0.8)} L ${fx(wbx + wrx * 0.4)} ${fx(wby + wry * 0.7)} Z" fill="${DUSK.ink}"/>`
    s += `<circle cx="${fx(wbx - wrx * 0.8)}" cy="${fx(wby - wry * 0.95)}" r="${fx(Math.max(2, bw * 0.16))}" fill="${DUSK.ink}"/>`
    if (bw >= 16) {
      s += `<path d="M ${fx(wbx - wrx * 1.4)} ${fx(wby - wry * 0.95)} L ${fx(wbx - wrx * 2.2)} ${fx(wby - wry * 0.66)} L ${fx(wbx - wrx * 1.3)} ${fx(wby - wry * 0.52)} Z" fill="${DUSK.ink}"/>`
    }
  } else {
    s += `<rect x="${fx(bx)}" y="${fx(by - bh)}" width="${fx(bw)}" height="${fx(bh)}" fill="${DUSK.ink}"/>`
    s += `<rect x="${fx(bx)}" y="${fx(by - bh)}" width="${fx(bw)}" height="${fx(Math.max(1, bh * 0.2))}" fill="${DUSK.slateLit}" opacity="0.26"/>`
  }
  s += `<rect x="${fx(bx - bw * 0.14)}" y="${fx(by - bh - Math.max(2, bh * 0.16))}" width="${fx(bw * 1.28)}" height="${fx(Math.max(2, bh * 0.16))}" fill="${lit ? DUSK.parch : DUSK.parchDim}" opacity="${lit ? '0.82' : '0.46'}"/>`
  s += `<rect x="${fx(bx - bw * 0.1)}" y="${fx(by)}" width="${fx(bw * 1.2)}" height="${fx(Math.max(2, bh * 0.13))}" fill="${lit ? DUSK.parch : DUSK.parchDim}" opacity="${lit ? '0.78' : '0.4'}"/>`
  return s
}

// ---- THE CROOKED COLOSSUS (`ch3-tower`) ------------------------------------
// Four UNEVEN storeys — tall buttressed foot, squat gantry belt, tall belfry,
// short leaning crown — each in its own trapezoid, each with its OWN portal
// cadence so the stack reads as STOREYS rather than as wallpaper. `decks` are
// the jutting platforms, and they are one table for both the die and the paint.
const COLOSSUS = {
  stone: ['#2e3a4b', '#26303f', '#1e2733', '#171f29'],
  // tone ladders per storey: the higher it climbs, the further from the road's
  // lamplight it stands, so each storey's facet lattice starts a step darker
  facets: [
    ['#3c4a5e', '#2e3a4b', '#232d3b', '#1a2230', '#0f141d'],
    ['#364456', '#2a3644', '#212a37', '#171e29', '#0d1118'],
    ['#303d4e', '#26313f', '#1d2632', '#141b25', '#0d1118'],
    ['#2a3646', '#212b38', '#19212c', '#111721', '#0d1118'],
  ],
  storeys: [
    {
      // 1 — the buttressed foot: three monumental gate arches over a roost
      // course, on a battered plinth the road's lamplight pools against
      ribs: 4,
      rows: [
        { n: 6, sill: 0.08, hF: 0.1, wid: 0.4, off: 0, lit: 0.5 },
        { n: 3, sill: 0.3, hF: 0.36, wid: 0.54, off: 0, lit: 0.95 },
      ],
      decks: [[], [[0.66, 0.78]]],
      lamps: [],
    },
    {
      // 2 — the squat gantry belt, kicked OUTBOARD: the working storey, all
      // platform and no grandeur, two crooked gantries hung off the inboard face
      ribs: 3,
      rows: [
        { n: 5, sill: 0.14, hF: 0.3, wid: 0.5, off: 0, lit: 0.78 },
        { n: 6, sill: 0.62, hF: 0.18, wid: 0.46, off: 0.5, lit: 0.62 },
      ],
      decks: [[[0.06, 0.3], [0.54, 0.76]], [[0.12, 0.28]]],
      lamps: [[0.18, 0.24], [0.65, 0.24]],
    },
    {
      // 3 — the tall belfry storey, pulled back INBOARD: a four-bay arcade of
      // tall roost mouths over a dense course, the tallest openings on the piece
      ribs: 4,
      rows: [
        { n: 4, sill: 0.16, hF: 0.44, wid: 0.56, off: 0, lit: 0.9 },
        { n: 6, sill: 0.72, hF: 0.14, wid: 0.48, off: 0, lit: 0.6 },
      ],
      decks: [[[0.02, 0.14]], [[0.58, 0.72]]],
      lamps: [[0.08, 0.66]],
    },
    {
      // 4 — the leaning crown: the dovecote proper, dense small ranks, and the
      // GANTRY ARM the dispatch cable leaves on
      ribs: 3,
      rows: [
        { n: 4, sill: 0.05, hF: 0.17, wid: 0.54, off: 0, lit: 0.78 },
        { n: 4, sill: 0.32, hF: 0.15, wid: 0.54, off: 0.5, lit: 0.78 },
      ],
      decks: [[[0.3, 0.5]], [[0.06, 0.18]]],
      lamps: [[0.4, 0.62]],
    },
  ],
  // the crown skyline: raked so the mass piles toward the gutter, which is the
  // direction the whole storey leans
  crestIn: 0.958,
  crestOut: 0.906,
  teeth: 7,
  toothV: 0.017,
  lanternAt: [1, 5],
  rankAt: 3,
  // ravens wheeling in the die-cut sky the crest leaves under v = 1
  wheel: [[0.16, 0.975, 0.062, 0.2], [0.33, 0.99, 0.046, -0.16], [0.58, 0.962, 0.054, 0.26]],
}

/** THE CROOKED COLOSSUS. ONE continuous portrait painting; `storeys` are the
 *  chain's panel lengths and `spans` its per-node [radius, width] pairs, both
 *  root first, so every fold line and every trapezoid edge is computed from the
 *  same numbers the solver folds the paper along. */
function crookedColossus({ w, h, seed, storeys, spans }) {
  const X = (u) => u * w
  const Y = (v) => (1 - v) * h
  const bands = chainBands(storeys)
  const us = chainNodeUs(spans)
  const nS = bands.length
  const uIn = (v) => chainEdgeAt(bands, us, v, 0)
  const uOut = (v) => chainEdgeAt(bands, us, v, 1)
  const rEdge = mulberry32((seed * 7 + 0x9e37) | 0)
  const spec = COLOSSUS

  // The cornice assembly, in v. It hangs BELOW its fold so the whole break lives
  // in the lower storey, and its coping's lit top edge IS the fold line.
  const CORN = { shadow: 0.006, dentil: 0.007, ledge: 0.008, merlon: 0.015 }
  const CORN_V = CORN.shadow + CORN.dentil + CORN.ledge + CORN.merlon
  const INSET = 0.024

  const crestBase = (u) => {
    const a = uIn(spec.crestIn)
    const b = uOut(spec.crestIn)
    const t = Math.min(1, Math.max(0, (u - a) / Math.max(1e-6, b - a)))
    return lerp(spec.crestIn, spec.crestOut, t)
  }

  // ---- THE CROWN SKYLINE: uneven merlons with the odd tor standing twice as
  // proud, two glazed lantern posts, and one cell given over to a linked rank of
  // ravens. The crown is where a tower earns its silhouette, so this is DIE. ----
  const teeth = []
  {
    const uA = uIn(spec.crestOut) + 0.014
    const uB = uOut(spec.crestOut) - 0.014
    const cell = (uB - uA) / spec.teeth
    for (let t = 0; t < spec.teeth; t++) {
      const isLan = spec.lanternAt.includes(t)
      const isRank = spec.rankAt === t
      const c0 = uA + t * cell
      const mw = cell * (isLan ? 0.86 : isRank ? 0.98 : 0.52 + rEdge() * 0.26)
      const u0 = c0 + (cell - mw) * 0.5
      const base = crestBase(c0 + cell * 0.5)
      const tor = !isLan && !isRank && rEdge() < 0.32
      const grow = isLan ? 0.55 : tor ? 1.5 : 0.4 + rEdge() * 0.7
      const top = base + spec.toothV * grow
      teeth.push({
        c0, c1: c0 + cell, u0, u1: u0 + mw, base,
        top: isRank ? base + spec.toothV * 0.4 : top,
        lantern: isLan,
        rank: isRank,
        // a post tall enough to out-rank the merlons is also tall enough to be
        // sheared off at v = 1
        lv: Math.min(0.058, 0.985 - top),
      })
    }
  }

  // ---- SILHOUETTE: inboard flank up, crown skyline across, outboard flank
  // down, foot closed on the page. Both flanks are bitten inward except at the
  // deck windows, so the gantries read as jutting over the kinks. ----
  const decksIn = spec.storeys.map((s) => s.decks[0])
  const decksOut = spec.storeys.map((s) => s.decks[1])
  const innerRun = stackFlank(bands, us, 0, decksIn, rEdge, INSET, 7, spec.crestIn)
  const outerRun = stackFlank(bands, us, 1, decksOut, rEdge, INSET, 7, spec.crestOut)
  const pts = [[uIn(0), 0], ...innerRun]
  for (const t of teeth) {
    pts.push([t.c0, crestBase(t.c0)], [t.u0, t.base], [t.u0, t.top])
    if (t.lantern) pts.push(...cliffLanternTop(t.u0, t.u1 - t.u0, t.top, t.lv))
    else if (t.rank) {
      const bh = 0.026
      for (const [u, v] of ravenChainTop(t.u0, t.u1, t.top, bh, Math.max(2, Math.round(((t.u1 - t.u0) * w) / Math.max(6, bh * h * RAVEN_CELL))), 'left')) {
        pts.push([u, v])
      }
    }
    pts.push([t.u1, t.top], [t.u1, t.base], [t.c1, crestBase(t.c1)])
  }
  for (let i = outerRun.length - 1; i >= 0; i--) pts.push(outerRun[i])
  pts.push([uOut(0), 0])
  const d = pts.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'

  // ---- PAINT ----
  const parts = []

  /** The corbelled LEDGE that IS the fold between storey k and k+1. Its span is
   *  the trapezoid's own width at the fold, so it can never overhang the die. */
  const cornice = (k) => {
    const foldV = bands[k][1]
    const x0 = X(uIn(foldV))
    const x1 = X(uOut(foldV))
    const wid = x1 - x0
    const rc = mulberry32((seed * 13 + k * 3121) | 0)
    let s = `<rect x="${fx(x0)}" y="${fx(Y(foldV))}" width="${fx(wid)}" height="${fx(CORN_V * h)}" fill="${DUSK.ink}" opacity="0.42"/>`
    s += `<rect x="${fx(x0)}" y="${fx(Y(foldV - CORN_V))}" width="${fx(wid)}" height="${fx(CORN.shadow * h)}" fill="${DUSK.ink}" opacity="0.8"/>`
    const dn = Math.max(6, Math.round(wid / (w * 0.055)))
    const dw = wid / dn
    for (let i = 0; i < dn; i++) {
      s += `<rect x="${fx(x0 + i * dw + dw * 0.18)}" y="${fx(Y(foldV - CORN.dentil - CORN.ledge - CORN.merlon))}" width="${fx(dw * 0.56)}" height="${fx(CORN.dentil * h)}" fill="${DUSK.slateLit}" opacity="0.5"/>`
    }
    const copeY = Y(foldV - CORN.merlon)
    s += `<rect x="${fx(x0)}" y="${fx(copeY)}" width="${fx(wid)}" height="${fx(CORN.ledge * h)}" fill="${DUSK.slateLit}"/>`
    s += `<rect x="${fx(x0)}" y="${fx(copeY)}" width="${fx(wid)}" height="${fx(Math.max(2, CORN.ledge * h * 0.4))}" fill="${DUSK.parch}" opacity="0.66"/>`
    const mn = Math.max(5, Math.round(wid / (w * 0.115)))
    const mw = wid / (mn * 2 - 1)
    s += `<rect x="${fx(x0)}" y="${fx(Y(foldV))}" width="${fx(wid)}" height="${fx(CORN.merlon * h)}" fill="${DUSK.ink}" opacity="0.72"/>`
    for (let i = 0; i < mn; i++) {
      const mx = x0 + i * 2 * mw
      const mh = CORN.merlon * h * (0.72 + rc() * 0.28)
      const my = Y(foldV) + (CORN.merlon * h - mh)
      s += `<rect x="${fx(mx)}" y="${fx(my)}" width="${fx(mw)}" height="${fx(mh)}" fill="${DUSK.slateDim}"/>`
      s += `<rect x="${fx(mx)}" y="${fx(my)}" width="${fx(mw)}" height="${fx(Math.max(2, mh * 0.22))}" fill="${DUSK.rim}" opacity="${(0.6 + rc() * 0.2).toFixed(2)}"/>`
    }
    return s
  }

  /** A jutting GANTRY PLATFORM, painted off the SAME deck window the die was cut
   *  from: a slab thrown out over the kink, its underside in deep shadow, a
   *  raking strut back to the wall, and a plank rail on top. */
  const gantry = (k, side, win, lamps) => {
    const [v0, v1] = bands[k]
    const sgn = side === 0 ? 1 : -1
    const a = lerp(v0, v1, win[0])
    const b = lerp(v0, v1, win[1])
    const edge = (v) => chainEdgeAt(bands, us, v, side)
    const deep = 0.3
    const xE = (v) => X(edge(v))
    const xI = (v) => X(edge(v) + sgn * deep * (uOut(v) - uIn(v)))
    const slabT = a + (b - a) * 0.34
    // the shadow the platform throws down the wall under it — the single move
    // that makes a painted deck read as a thing standing OFF the facade
    let s = `<path d="M ${fx(xE(a))} ${fx(Y(a))} L ${fx(xI(a))} ${fx(Y(a))} L ${fx(xI(a))} ${fx(Y(a) + h * 0.026)} L ${fx(xE(a))} ${fx(Y(a) + h * 0.038)} Z" fill="${DUSK.ink}" opacity="0.82"/>`
    // a raking strut back under the slab — "this is hung off the wall", which a
    // floating rectangle never says
    s += `<path d="M ${fx(xE(a))} ${fx(Y(a))} L ${fx(xI(a - (b - a) * 0.9))} ${fx(Y(a - (b - a) * 0.9))}" stroke="${DUSK.slateDeep}" stroke-width="${fx(Math.max(4, w * 0.02))}" opacity="0.95" stroke-linecap="round"/>`
    // the slab, with a lamplit lip along its outer edge
    s += `<path d="M ${fx(xE(a))} ${fx(Y(a))} L ${fx(xI(a))} ${fx(Y(a))} L ${fx(xI(slabT))} ${fx(Y(slabT))} L ${fx(xE(slabT))} ${fx(Y(slabT))} Z" fill="${DUSK.slate}"/>`
    s += `<rect x="${fx(Math.min(xE(slabT), xI(slabT)))}" y="${fx(Y(slabT))}" width="${fx(Math.abs(xI(slabT) - xE(slabT)))}" height="${fx(Math.max(3, h * 0.005))}" fill="${DUSK.parch}" opacity="0.86"/>`
    // rail posts and the plank rail they carry
    const posts = 4
    for (let i = 0; i <= posts; i++) {
      const px = lerp(xE(b), xI(b), i / posts)
      s += `<rect x="${fx(px - Math.max(2, w * 0.007))}" y="${fx(Y(b))}" width="${fx(Math.max(4, w * 0.014))}" height="${fx(Y(slabT) - Y(b))}" fill="${DUSK.ink}"/>`
    }
    s += `<path d="M ${fx(xE(b))} ${fx(Y(b))} L ${fx(xI(b))} ${fx(Y(b))}" stroke="${DUSK.slateLit}" stroke-width="${fx(Math.max(3.5, h * 0.005))}" opacity="0.85"/>`
    // a crate or two on the deck: the storey is a working belt, not a viewpoint
    s += `<rect x="${fx(lerp(xE(slabT), xI(slabT), 0.42))}" y="${fx(Y(slabT) - (b - slabT) * h * 0.5)}" width="${fx(Math.abs(xI(a) - xE(a)) * 0.18)}" height="${fx((b - slabT) * h * 0.5)}" fill="${DUSK.slateDeep}"/>`
    for (const [lt, lv] of lamps) {
      if (lt < win[0] || lt > win[1]) continue
      const lx = lerp(xE(b), xI(b), 0.3)
      const lh = (b - a) * lv * h * 0.8
      s += lampHead(lx, Y(b) - lh, Y(b) - lh * 0.34, Math.max(6, w * 0.032), 2.8)
    }
    return s
  }

  for (let k = 0; k < nS; k++) {
    const [v0, v1] = bands[k]
    const bhV = v1 - v0
    const yTop = Y(v1)
    const yBot = Y(v0)
    const st = spec.storeys[k]
    const rk = mulberry32((seed * 137 + k * 911) | 0)
    const pr = mulberry32((seed * 61 + k * 2477) | 0)
    let s = `<g>`

    // 1. the mass — near-black stone, because a night facade that starts at mid
    // grey has nowhere left to go once the lamps land on it
    s += `<rect x="0" y="${fx(yTop)}" width="${w}" height="${fx(yBot - yTop)}" fill="${spec.stone[k]}"/>`
    s += cityFacets(0, w, yTop, yBot, spec.facets[k], 4, Math.max(3, Math.round(bhV / 0.07)), rk, h)

    // 2. hand-cut coursing riding the facets
    const sn = Math.max(6, Math.round(bhV / 0.03))
    for (let i = 1; i < sn; i++) {
      const y = lerp(yBot, yTop, i / sn)
      s += `<path d="${strataPath(y, 0, w, h * 0.003, 6, rk)}" fill="none" stroke="${DUSK.ink}" stroke-width="1.6" opacity="${(0.2 + rk() * 0.2).toFixed(2)}"/>`
      s += `<path d="${strataPath(y - h * 0.0035, 0, w, h * 0.0025, 6, rk)}" fill="none" stroke="${DUSK.slateLit}" stroke-width="1.1" opacity="${(0.06 + rk() * 0.1).toFixed(2)}"/>`
    }

    // 3. buttress pilasters: a lit inboard reveal and an inked flank each
    for (let i = 0; i < st.ribs; i++) {
      const u = lerp(uIn(v0) + 0.08, uOut(v0) - 0.08, st.ribs === 1 ? 0.5 : i / (st.ribs - 1))
      const rw = w * (0.05 + rk() * 0.05)
      s += `<rect x="${fx(X(u) - rw / 2)}" y="${fx(yTop)}" width="${fx(rw)}" height="${fx(yBot - yTop)}" fill="${DUSK.slateLit}" opacity="0.1"/>`
      s += `<rect x="${fx(X(u) + rw * 0.32)}" y="${fx(yTop)}" width="${fx(rw * 0.44)}" height="${fx(yBot - yTop)}" fill="${DUSK.ink}" opacity="0.3"/>`
    }

    // 4. the storey's plinth, and on every fold above the root the linked rank of
    // ravens standing on the ledge below (printed on THIS panel, so it tilts with
    // the storey it belongs to and never straddles the crease)
    if (k > 0) {
      s += `<rect x="${fx(X(uIn(v0)))}" y="${fx(yBot - Math.max(2, h * 0.006))}" width="${fx(X(uOut(v0) - uIn(v0)))}" height="${fx(Math.max(2, h * 0.006))}" fill="${DUSK.parchDim}" opacity="0.56"/>`
      const a = lerp(uIn(v0), uOut(v0), 0.12 + 0.1 * (k % 2))
      const b = lerp(uIn(v0), uOut(v0), 0.42 + 0.12 * (k % 2))
      s += perchedRank(X, Y, a, b, v0, 0.034, w, h)
    }

    // 5. THE PORTAL RANKS — the loudest thing on the tower, and the reason it
    // reads at all against the black page. `boost` grades the throw with height:
    // the foot stands in the road's lamplight, the crown only in its own.
    const ceiling = k === nS - 1 ? null : v1 - CORN_V - 0.005
    const boost = 0.62 - k * 0.1
    let litPrev = false
    let darkRun = 0
    for (const row of st.rows) {
      const usable = [uIn(v0) + 0.07, uOut(v1) - 0.07]
      const cw = (usable[1] - usable[0]) / row.n
      const pwU = cw * row.wid
      const pxW = X(pwU)
      const sills = []
      for (let i = 0; i < row.n; i++) {
        const cu = usable[0] + cw * (i + 0.5 + (row.off ? (i % 2 === 1 ? row.off * 0.5 : -row.off * 0.5) : 0))
        // a whisper of per-opening jitter: the ranks stay regimented (that IS the
        // rookery's theme) but read cut BY HAND rather than stamped
        const hV = row.hF * bhV * (0.94 + pr() * 0.12)
        let sillV = v0 + row.sill * bhV + (pr() * 2 - 1) * bhV * 0.01
        // under the crown the ceiling is the crest MINUS the merlon blocks that
        // stand on it: a rank clamped only to the crest line is a rank half
        // buried in parapet
        const cap = ceiling === null ? crestBase(cu) - 0.05 : ceiling
        if (sillV + hV > cap) sillV = cap - hV
        sills.push([X(cu - pwU / 2), Y(sillV)])
        // clumped as traffic, but never three dark in a row: an unlit triplet
        // punches a hole in the rank, and the RANK is what has to read
        const roll = pr()
        const lit = roll < row.lit || (litPrev && roll < row.lit + 0.24) || darkRun >= 2
        litPrev = lit
        darkRun = lit ? 0 : darkRun + 1
        s += ravenPortal(X(cu - pwU / 2), Y(sillV), pxW, hV * h, lit, boost)
      }
      for (const [sx, sy] of sills) {
        s += `<rect x="${fx(sx - pxW * 0.28)}" y="${fx(sy + Math.max(2, h * 0.005))}" width="${fx(pxW * 1.56)}" height="${fx(Math.max(2, h * 0.004))}" fill="${DUSK.parchDim}" opacity="0.4"/>`
      }
      // hanging roost boxes slung between the openings of the taller ranks
      if (row.hF > 0.18) {
        for (let i = 0; i + 1 < row.n; i += 2) {
          const mx = (sills[i][0] + pxW + sills[i + 1][0]) / 2
          const my = (sills[i][1] + sills[i + 1][1]) / 2 - h * 0.01
          const bw = pxW * 0.46
          const bx = bw * 0.82
          s += `<line x1="${fx(mx - bw * 0.6)}" y1="${fx(my)}" x2="${fx(mx + bw * 0.6)}" y2="${fx(my)}" stroke="${DUSK.slateLit}" stroke-width="2" opacity="0.5"/>`
          s += `<rect x="${fx(mx - bw / 2)}" y="${fx(my)}" width="${fx(bw)}" height="${fx(bx)}" fill="${DUSK.slateDeep}"/>`
          s += `<rect x="${fx(mx - bw / 2)}" y="${fx(my)}" width="${fx(bw)}" height="${fx(Math.max(1.5, bx * 0.14))}" fill="${DUSK.slateLit}" opacity="0.62"/>`
          s += `<rect x="${fx(mx - bw * 0.16)}" y="${fx(my + bx * 0.3)}" width="${fx(bw * 0.32)}" height="${fx(bx * 0.42)}" fill="${DUSK.amberLit}" opacity="0.88"/>`
        }
      }
    }

    // 6. the jutting gantries, off the same windows the die was cut from
    for (const win of st.decks[0]) s += gantry(k, 0, win, st.lamps)
    for (const win of st.decks[1]) s += gantry(k, 1, win, [])

    // 7. the fold, painted LAST in the storey so it cuts every halo that tried to
    // spill over the crease
    if (k < nS - 1) s += cornice(k)
    s += `</g>`
    parts.push(s)
  }

  // ---- THE CROWN: merlon blocks on the same tooth maths the die cut, then the
  // lantern posts. ----
  {
    let s = `<g>`
    for (const t of teeth) {
      const x0 = X(t.u0)
      const tw = X(t.u1 - t.u0)
      const topY = Y(t.top)
      const footY = Y(t.base - 0.03)
      s += `<rect x="${fx(x0)}" y="${fx(topY)}" width="${fx(tw)}" height="${fx(footY - topY)}" fill="${DUSK.slateDim}"/>`
      s += `<rect x="${fx(x0)}" y="${fx(topY)}" width="${fx(tw)}" height="${fx(Math.max(2.5, h * 0.004))}" fill="${DUSK.rim}" opacity="0.8"/>`
      s += `<rect x="${fx(x0 + tw * 0.78)}" y="${fx(topY)}" width="${fx(tw * 0.22)}" height="${fx(footY - topY)}" fill="${DUSK.ink}" opacity="0.42"/>`
      if (t.rank) s += `<rect x="${fx(x0)}" y="${fx(topY)}" width="${fx(tw)}" height="${fx(Math.max(3, h * 0.005))}" fill="${DUSK.amberLit}" opacity="0.6"/>`
      if (!t.lantern) continue
      const lw = tw
      s += lampHead(x0 + lw / 2, Y(t.top + t.lv * 0.86), Y(t.top + t.lv * 0.36), lw * 0.84, 3.6)
      s += `<rect x="${fx(x0 + lw * 0.42)}" y="${fx(Y(t.top + t.lv * 0.36))}" width="${fx(lw * 0.16)}" height="${fx(Y(t.top) - Y(t.top + t.lv * 0.36))}" fill="${DUSK.slateDeep}"/>`
    }
    s += `</g>`
    parts.push(s)
  }

  // ---- THE DISPATCH CABLE'S FIRST STRETCH. It leaves the crown's gantry arm on
  // the TOWER'S OWN PAPER and falls inboard across the belfry face, exiting
  // through the inboard flank where the reader's eye picks it up again on the
  // die-cut cable panel. A cable that started in mid-air over the gutter would
  // be a painted claim; this one is a cut one. ----
  {
    const [cv0, cv1] = bands[nS - 1]
    const armV = lerp(cv0, cv1, 0.42)
    const ax = X(uIn(armV))
    const ay = Y(armV)
    const bx = X(uIn(0.66) - 0.02)
    const by = Y(0.66)
    // the arm itself, thrown out over the kink, and the pulley on its nose
    let s = `<path d="M ${fx(ax + w * 0.16)} ${fx(ay - h * 0.006)} L ${fx(ax)} ${fx(ay)} L ${fx(ax + w * 0.16)} ${fx(ay + h * 0.01)} Z" fill="${DUSK.slateDeep}"/>`
    s += `<path d="M ${fx(ax + w * 0.16)} ${fx(ay - h * 0.006)} L ${fx(ax)} ${fx(ay)}" stroke="${DUSK.parchDim}" stroke-width="2.4" opacity="0.7"/>`
    s += `<circle cx="${fx(ax)}" cy="${fx(ay)}" r="${fx(Math.max(4, w * 0.02))}" fill="${DUSK.slateLit}" stroke="${DUSK.ink}" stroke-width="2.4"/>`
    s += `<circle cx="${fx(ax)}" cy="${fx(ay)}" r="${fx(Math.max(1.4, w * 0.006))}" fill="${DUSK.ink}"/>`
    s += `<path d="M ${fx(ax)} ${fx(ay)} L ${fx(bx)} ${fx(by)}" stroke="${DUSK.ink}" stroke-width="${fx(Math.max(4.5, w * 0.018))}" stroke-linecap="round"/>`
    s += `<path d="M ${fx(ax)} ${fx(ay)} L ${fx(bx)} ${fx(by)}" stroke="${DUSK.parch}" stroke-width="${fx(Math.max(1.6, w * 0.006))}" opacity="0.8" stroke-linecap="round" transform="translate(0,-1.6)"/>`
    parts.push(s)
  }

  // ---- THE FOOT: broken rock and yard rubble piled where the tower meets the
  // page, lit along its top by the lamplit road running to the keep's gate. ----
  {
    const rt = mulberry32((seed * 29 + 0x51a7) | 0)
    const n = 11
    const pk = []
    for (let i = 0; i <= n; i++) pk.push([(i / n) * w, h - h * (0.014 + rt() * 0.026)])
    let td = `M 0 ${fx(h)} L 0 ${fx(pk[0][1])}`
    for (const [x, y] of pk) td += ` L ${fx(x)} ${fx(y)}`
    td += ` L ${w} ${fx(h)} Z`
    let s = `<path d="${td}" fill="${DUSK.slateDeep}"/>`
    s += `<path d="${pk.map(([x, y], i) => `${i ? 'L' : 'M'}${fx(x)} ${fx(y)}`).join(' ')}" fill="none" stroke="${DUSK.parchDim}" stroke-width="2.4" opacity="0.6"/>`
    for (let i = 0; i < 20; i++) {
      s += `<circle cx="${fx(rt() * w)}" cy="${fx(h - h * rt() * 0.04)}" r="${fx(1.5 + rt() * 3)}" fill="${DUSK.ink}" opacity="0.5"/>`
    }
    parts.push(s)
  }

  // ---- ATMOSPHERE, kept LOCAL. The r3 walls died of three full-sheet washes;
  // here the crown falls to night over the top fifth, the gutter flank catches
  // the city's lamplight over the inboard eighth, and the road pools at the
  // foot. Nothing crosses the middle of the piece. ----
  parts.push(`<rect width="${w}" height="${fx(h * 0.34)}" fill="url(#towerNight)"/>`)
  parts.push(`<rect width="${fx(w * 0.16)}" height="${h}" fill="url(#towerLitFlank)"/>`)
  parts.push(
    `<ellipse cx="${fx(w * 0.22)}" cy="${fx(h * 1.02)}" rx="${fx(w * 0.95)}" ry="${fx(h * 0.1)}" fill="url(#rookHalo)" opacity="0.95"/>`
  )
  parts.push(
    `<path d="${innerRun.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ')}" fill="none" stroke="${DUSK.parch}" stroke-width="${fx(Math.max(2, w * 0.008))}" opacity="0.34" stroke-linejoin="round"/>`
  )

  const defs =
    `<clipPath id="towerCut"><path d="${d}"/></clipPath>` +
    cityLampDefs() +
    `<linearGradient id="towerNight" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${DUSK.ink}" stop-opacity="0.5"/>` +
    `<stop offset="1" stop-color="${DUSK.ink}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="towerLitFlank" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${DUSK.amber}" stop-opacity="0.16"/>` +
    `<stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0"/></linearGradient>`

  // the ravens wheeling clear of the crest are cut as their OWN die shapes in the
  // sky the crown skyline leaves behind, INSIDE the trapezoid (paper outside it
  // is never sampled, so a bird painted there would simply not exist)
  let wheel = ''
  for (const [u, v, sz, tilt] of spec.wheel) {
    const wd = wheelRavenPath(X(u), Y(v), Math.max(11, w * sz), tilt)
    wheel += `<path d="${wd}" fill="${DUSK.ink}"/>` + rookRim(wd, 1.8)
  }

  return svgPiece(w, h, `<g clip-path="url(#towerCut)">${parts.join('')}</g>` + rookRim(d, 3.2) + wheel, defs)
}

// ---- THE TERRACED ROOSTS (`ch3-terrace`) -----------------------------------
// The right page's answer to a colossus, and the piece that kills the mirror by
// being its OPPOSITE. Where the tower is one tall crooked stack of arched
// portals, the roosts are a low wide sprawl of roof after roof stepping back,
// every storey a long horizontal rank of small square-headed roost windows, a
// perch rail of ravens on every coping, a lamplit road entering at the foot, and
// a low landing mast at the outboard end where the dispatch cable comes down.
// NOTHING here is allowed to be vertical drama: the tower is the one tall thing
// on the spread, and this piece's whole job is to make that legible.
//
// ROUND 4b — WIDER THAN TALL, AND NOT A GRID. The sheet re-proportions from
// 705x1024 to 1024x991: the roosts had to come DOWN so the dispatch cable could
// fly over them, and the same numbers that shortened the chain widened the
// radial extent past it. A low sprawl is what this piece was always described
// as; r4a's sheet made it a ziggurat because it was taller than it was wide.
//
// The other thing 4a printed was a SPREADSHEET: every house the same frontage,
// every bay the same pitch, every cell lit. Three moves fix that and they all
// cost nothing but seeded numbers. (1) Houses and their window bays are UNEVEN
// splits, so frontage and pitch wander; each house also sits a little high or
// low on its own string course, the way a terrace built down a slope does.
// (2) Two storeys carry a GABLE END standing in the roof plane with a hoist
// beam and a lit loft door, and two carry a JETTIED upper floor oversailing on
// corbels — one horizontal shadow that no rank crosses. (3) A house may be
// SHUTTERED outright, and the per-cell lit roll now clumps in BOTH directions,
// so dark windows fall among the warm ones instead of one lonely gap per rank.
const TERRACE = {
  stone: ['#2f3a49', '#28313e', '#212933', '#1a2129', '#141a21'],
  facets: [
    ['#3f4d60', '#313d4d', '#27313f', '#1c2531', '#12181f'],
    ['#374453', '#2a3542', '#222a35', '#181f28', '#0f141b'],
    ['#303b48', '#242e39', '#1d242d', '#141a21', '#0d1118'],
    ['#293441', '#1f2832', '#181e26', '#11161d', '#0d1118'],
    ['#232d38', '#1a222b', '#141a21', '#0e1319', '#0d1118'],
  ],
  // per storey: how much of the band is WALL (the rest is the roof plane above
  // it), how many HOUSES the terrace is divided into by party pilasters (uneven
  // frontages, seeded), TWO window ranks per wall so no storey is ever a blank
  // field, and the dormer roost-boxes standing on the roof. `n` is the NOMINAL
  // bay pitch across the whole terrace — the real bays are an uneven split of
  // each house at about that pitch. `jetty`/`gable` name the house index that
  // breaks the rank; -1 for none. Lit chance falls as it climbs, which is the
  // whole aerial recession — the far roosts are the dark ones.
  storeys: [
    // the foot storey's ranks start high enough to leave the lamplit road its
    // own clear band across the bottom of the sheet
    { wall: 0.7, houses: 6, rows: [{ n: 13, sill: 0.3, hF: 0.2, wid: 0.5, lit: 0.8 }, { n: 13, sill: 0.66, hF: 0.19, wid: 0.5, lit: 0.7 }], dormers: 5, jetty: 3, gable: -1 },
    { wall: 0.68, houses: 5, rows: [{ n: 12, sill: 0.3, hF: 0.2, wid: 0.5, lit: 0.72 }, { n: 12, sill: 0.66, hF: 0.19, wid: 0.5, lit: 0.62 }], dormers: 4, jetty: -1, gable: 1 },
    { wall: 0.66, houses: 5, rows: [{ n: 11, sill: 0.3, hF: 0.22, wid: 0.5, lit: 0.64 }, { n: 11, sill: 0.66, hF: 0.2, wid: 0.5, lit: 0.54 }], dormers: 4, jetty: 1, gable: -1 },
    { wall: 0.62, houses: 4, rows: [{ n: 10, sill: 0.3, hF: 0.24, wid: 0.5, lit: 0.56 }, { n: 10, sill: 0.66, hF: 0.22, wid: 0.5, lit: 0.46 }], dormers: 3, jetty: -1, gable: 2 },
    { wall: 0.58, houses: 4, rows: [{ n: 9, sill: 0.32, hF: 0.26, wid: 0.5, lit: 0.48 }], dormers: 3, jetty: -1, gable: -1 },
  ],
  // the roofline steps: segment heights above the crest base, in v. `gableAt`
  // are the segments cut as a PEAK rather than a flat run — the one silhouette
  // break the crest is allowed, and small enough that the landing mast still
  // out-tops it and the tower still owns the spread.
  ridge: [0.006, 0.017, 0.004, 0.02, 0.007, 0.014, 0.005, 0.016, 0.004],
  gableAt: [2, 6],
  gableV: 0.019,
  crest: 0.962,
  mastU: 0.84,
  mastTop: 0.996,
  wheel: [[0.3, 0.986, 0.04, 0.22], [0.62, 0.978, 0.032, -0.18]],
}

/** THE TERRACED ROOSTS. Same trapezoid contract as the tower, opposite grammar:
 *  low, wide, horizontal, and warm. */
function terracedRoosts({ w, h, seed, storeys, spans }) {
  const X = (u) => u * w
  const Y = (v) => (1 - v) * h
  const bands = chainBands(storeys)
  const us = chainNodeUs(spans)
  const nS = bands.length
  const uIn = (v) => chainEdgeAt(bands, us, v, 0)
  const uOut = (v) => chainEdgeAt(bands, us, v, 1)
  const rEdge = mulberry32((seed * 7 + 0x4d21) | 0)
  const spec = TERRACE
  const INSET = 0.012

  // ---- SILHOUETTE. The EAVE runs flush to the trapezoid — a roof overhangs its
  // wall, that is what an eave is — and the wall band is bitten in behind it, so
  // every storey ends on a crisp overhanging lip. The crest is a stepped
  // roofline with one low landing mast at the outboard end. ----
  const eaves = spec.storeys.map((s) => [[s.wall - 0.03, s.wall + 0.16]])
  const innerRun = stackFlank(bands, us, 0, eaves, rEdge, INSET, 6, spec.crest)
  const outerRun = stackFlank(bands, us, 1, eaves, rEdge, INSET, 6, spec.crest)

  const crest = spec.crest
  const uA = uIn(crest) + 0.008
  const uB = uOut(crest) - 0.008
  const segs = spec.ridge.length
  const ridge = []
  {
    const cell = (uB - uA) / segs
    for (let i = 0; i < segs; i++) {
      ridge.push({
        u0: uA + i * cell,
        u1: uA + (i + 1) * cell,
        top: crest + spec.ridge[i],
        gable: spec.gableAt.includes(i),
      })
    }
  }

  const pts = [[uIn(0), 0], ...innerRun]
  for (const seg of ridge) {
    // a GABLE segment cuts a shallow peak into the crest instead of a flat run:
    // the only silhouette break a piece that must stay low can afford, and it is
    // what stops the roofline reading as one sawn board
    if (seg.gable) {
      pts.push([seg.u0, seg.top], [lerp(seg.u0, seg.u1, 0.5), seg.top + spec.gableV], [seg.u1, seg.top])
    } else pts.push([seg.u0, seg.top], [seg.u1, seg.top])
    // the LOW landing mast at the outboard end, where the wire comes down out of
    // the sky. Low is the point: it answers the colossus without competing.
    if (spec.mastU >= seg.u0 && spec.mastU < seg.u1) {
      const mw = 0.014
      const mv = spec.mastTop - seg.top
      pts.push(
        [spec.mastU - mw, seg.top], [spec.mastU - mw * 0.45, seg.top + mv * 0.74],
        [spec.mastU - mw * 1.7, seg.top + mv * 0.84], [spec.mastU, spec.mastTop],
        [spec.mastU + mw * 1.7, seg.top + mv * 0.84], [spec.mastU + mw * 0.45, seg.top + mv * 0.74],
        [spec.mastU + mw, seg.top]
      )
    }
  }
  for (let i = outerRun.length - 1; i >= 0; i--) pts.push(outerRun[i])
  pts.push([uOut(0), 0])
  const d = pts.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'

  const parts = []
  for (let k = 0; k < nS; k++) {
    const [v0, v1] = bands[k]
    const bhV = v1 - v0
    const st = spec.storeys[k]
    const wallTop = v0 + bhV * st.wall
    const rk = mulberry32((seed * 149 + k * 733) | 0)
    const pr = mulberry32((seed * 71 + k * 1289) | 0)
    let s = `<g>`

    // 1. the wall band — the storey's working face, all of it under a roof
    s += `<rect x="0" y="${fx(Y(wallTop))}" width="${w}" height="${fx(Y(v0) - Y(wallTop))}" fill="${spec.stone[k]}"/>`
    s += cityFacets(0, w, Y(wallTop), Y(v0), spec.facets[k], 5, Math.max(2, Math.round((bhV * st.wall) / 0.07)), rk, h)
    const cn = Math.max(4, Math.round((bhV * st.wall) / 0.022))
    for (let i = 1; i < cn; i++) {
      const y = lerp(Y(v0), Y(wallTop), i / cn)
      s += `<path d="${strataPath(y, 0, w, h * 0.0022, 8, rk)}" fill="none" stroke="${DUSK.ink}" stroke-width="1.5" opacity="${(0.16 + rk() * 0.16).toFixed(2)}"/>`
    }

    // 2. THE HOUSES. The terrace is a ROW OF HOUSES, not a wall with holes in
    // it, and the single cheapest way to say so is to give them different
    // frontages: an uneven split, each house sitting a little high or low on its
    // own courses, one of them shuttered for the night, one of them jettied.
    const rh = mulberry32((seed * 313 + k * 617) | 0)
    const uL = uIn(v0) + 0.02
    const uR = uOut(wallTop) - 0.02
    const hb = unevenSplit(uL, uR, st.houses, rh, 0.4)
    const wallV = bhV * st.wall
    const houses = []
    for (let i = 0; i < st.houses; i++) {
      houses.push({
        u0: hb[i],
        u1: hb[i + 1],
        dv: (rh() * 2 - 1) * wallV * 0.055,
        jetty: i === st.jetty,
        gable: i === st.gable,
        dark: rh() < 0.15,
      })
    }

    // PARTY PILASTERS on the house joints — what keeps a long low wall from
    // reading as one blank slab, now landing on uneven bays.
    for (let i = 1; i < st.houses; i++) {
      const u = hb[i]
      const pw = w * 0.011
      s += `<rect x="${fx(X(u) - pw)}" y="${fx(Y(wallTop))}" width="${fx(pw * 2)}" height="${fx(Y(v0) - Y(wallTop))}" fill="${DUSK.slateDim}"/>`
      s += `<rect x="${fx(X(u) - pw)}" y="${fx(Y(wallTop))}" width="${fx(pw * 0.6)}" height="${fx(Y(v0) - Y(wallTop))}" fill="${DUSK.slateLit}" opacity="0.42"/>`
      s += `<rect x="${fx(X(u) + pw * 0.4)}" y="${fx(Y(wallTop))}" width="${fx(pw * 0.6)}" height="${fx(Y(v0) - Y(wallTop))}" fill="${DUSK.ink}" opacity="0.5"/>`
    }

    // THE JETTIED HOUSE: its upper floor oversails on corbel brackets, so one
    // house throws a hard horizontal shadow no rank crosses. A terrace where
    // every facade is in one plane is a drawing of a terrace, not a terrace.
    for (const ho of houses) {
      if (!ho.jetty) continue
      const jv = v0 + wallV * 0.5 + ho.dv
      const jx0 = X(ho.u0) - w * 0.008
      const jx1 = X(ho.u1) + w * 0.008
      const jy = Y(jv)
      const th = Math.max(4, h * 0.0075)
      // the shadow the oversail throws down the storey below it
      s += `<rect x="${fx(jx0)}" y="${fx(jy)}" width="${fx(jx1 - jx0)}" height="${fx(th * 1.9)}" fill="${DUSK.ink}" opacity="0.72"/>`
      // three corbels carrying it
      for (let i = 0; i < 3; i++) {
        const bx = lerp(jx0 + w * 0.02, jx1 - w * 0.02, i / 2)
        s += `<path d="M ${fx(bx - w * 0.008)} ${fx(jy + th)} L ${fx(bx + w * 0.008)} ${fx(jy + th)} L ${fx(bx)} ${fx(jy + th * 3.2)} Z" fill="${DUSK.slateDim}"/>`
      }
      s += `<rect x="${fx(jx0)}" y="${fx(jy - th)}" width="${fx(jx1 - jx0)}" height="${fx(th * 2)}" fill="${DUSK.slate}"/>`
      s += `<rect x="${fx(jx0)}" y="${fx(jy - th)}" width="${fx(jx1 - jx0)}" height="${fx(th * 0.7)}" fill="${DUSK.parch}" opacity="0.72"/>`
    }

    // 3. the window ranks — many small warm openings on two long horizontal
    // lines, the exact opposite of the tower's few monumental arches. Bays are
    // an UNEVEN split of each house at roughly the row's nominal pitch, so no
    // two frontages carry the same cell width or the same number of them.
    for (const row of st.rows) {
      const cellU = (uR - uL) / row.n
      for (const ho of houses) {
        const nb = Math.max(2, Math.round((ho.u1 - ho.u0) / cellU))
        const bb = unevenSplit(ho.u0 + cellU * 0.16, ho.u1 - cellU * 0.16, nb, pr, 0.32)
        // a jettied house's upper rank rides ON the oversail, a touch higher
        const lift = ho.jetty && row.sill > 0.5 ? wallV * 0.035 : 0
        let litPrev = false
        for (let i = 0; i < nb; i++) {
          const pwU = (bb[i + 1] - bb[i]) * row.wid
          const cu = (bb[i] + bb[i + 1]) / 2
          const hV = row.hF * wallV * (0.9 + pr() * 0.2)
          const sillV = v0 + row.sill * wallV + ho.dv + lift + (pr() * 2 - 1) * bhV * 0.004
          // the roll clumps in BOTH directions now: warm windows cluster and so
          // do dark ones, which is what "inhabited" looks like. A shuttered
          // house goes dark outright.
          const roll = pr()
          const lit = ho.dark ? roll < 0.12 : roll < (litPrev ? row.lit + 0.14 : row.lit - 0.12)
          litPrev = lit
          s += roostWindow(X(cu - pwU / 2), Y(sillV), X(pwU), hV * h, lit)
        }
        // the string course the rank stands on, per HOUSE so it steps with it
        const csY = Y(v0 + row.sill * wallV + ho.dv + lift)
        s += `<rect x="${fx(X(ho.u0))}" y="${fx(csY + Math.max(2, h * 0.004))}" width="${fx(X(ho.u1 - ho.u0))}" height="${fx(Math.max(2, h * 0.003))}" fill="${DUSK.parchDim}" opacity="0.34"/>`
      }
    }

    // 4. SORTING PERCHES: ravens landing on the RIDGE of the storey below —
    // printed on THIS panel, so they tilt with the terrace they stand on and
    // never straddle a crease. Two short ranks, staggered storey to storey.
    if (k > 0) {
      for (const [t0, t1] of [[0.08 + 0.1 * (k % 2), 0.28 + 0.1 * (k % 2)], [0.56 + 0.08 * (k % 2), 0.72 + 0.08 * (k % 2)]]) {
        s += perchedRank(X, Y, lerp(uIn(v0), uOut(v0), t0), lerp(uIn(v0), uOut(v0), t1), v0, 0.024, w, h)
      }
    }

    // 5. the roof plane above the wall: slate courses running the FULL width, a
    // deep eave shadow under it and a lit ridge on the fold. Roof after roof
    // stepping back is the whole silhouette of this piece.
    const yR0 = Y(wallTop)
    const yR1 = Y(v1)
    s += `<rect x="0" y="${fx(yR1)}" width="${w}" height="${fx(yR0 - yR1)}" fill="${DUSK.slate}"/>`
    s += cityFacets(0, w, yR1, yR0, [DUSK.slateLit, DUSK.slate, DUSK.slateDim, DUSK.slateDeep], 6, 2, rk, h)
    const tiles = Math.max(3, Math.round((bhV * (1 - st.wall)) / 0.013))
    for (let i = 1; i < tiles; i++) {
      const y = lerp(yR0, yR1, i / tiles)
      s += `<path d="${strataPath(y, 0, w, h * 0.0018, 9, rk)}" fill="none" stroke="${DUSK.ink}" stroke-width="2" opacity="0.4"/>`
      s += `<path d="${strataPath(y - h * 0.0028, 0, w, h * 0.0016, 9, rk)}" fill="none" stroke="${DUSK.slateLit}" stroke-width="1.2" opacity="0.2"/>`
    }
    // CHIMNEY STACKS: two per roof, standing off the ridge line. They cost one
    // rectangle each and they are most of what stops a slate plane reading as a
    // sheet of grey paper at the reading camera.
    for (let i = 0; i < 2; i++) {
      const u = lerp(uIn(v1) + 0.1, uOut(v1) - 0.1, 0.22 + rk() * 0.62)
      const cw2 = w * (0.012 + rk() * 0.008)
      const ch2 = (yR0 - yR1) * (0.5 + rk() * 0.3)
      const cy2 = yR1 + (yR0 - yR1) * 0.28
      s += `<rect x="${fx(X(u) - cw2)}" y="${fx(cy2 - ch2)}" width="${fx(cw2 * 2)}" height="${fx(ch2)}" fill="${DUSK.slateDeep}"/>`
      s += `<rect x="${fx(X(u) - cw2)}" y="${fx(cy2 - ch2)}" width="${fx(cw2 * 0.7)}" height="${fx(ch2)}" fill="${DUSK.slateDim}" opacity="0.8"/>`
      s += `<rect x="${fx(X(u) - cw2 * 1.3)}" y="${fx(cy2 - ch2)}" width="${fx(cw2 * 2.6)}" height="${fx(Math.max(2.5, h * 0.005))}" fill="${DUSK.slateLit}" opacity="0.85"/>`
    }
    // DORMER ROOST-BOXES standing on the roof plane — small gabled hutches with
    // an amber slit each. They ride INSIDE the roof band, because anything above
    // the fold belongs to the storey behind it. Spacing is an uneven split too:
    // dormers on an even pitch are the loudest grid on a roof.
    const db = unevenSplit(uIn(v1) + 0.05, uOut(v1) - 0.05, st.dormers, rk, 0.42)
    for (let i = 0; i < st.dormers; i++) {
      const u = (db[i] + db[i + 1]) / 2
      const dw = w * (0.026 + rk() * 0.016)
      const dh = (yR0 - yR1) * (0.4 + rk() * 0.16)
      const dy = yR0 - (yR0 - yR1) * 0.22 - dh
      s += `<path d="M ${fx(X(u) - dw / 2)} ${fx(dy + dh)} L ${fx(X(u) - dw / 2)} ${fx(dy + dh * 0.3)} L ${fx(X(u))} ${fx(dy)} L ${fx(X(u) + dw / 2)} ${fx(dy + dh * 0.3)} L ${fx(X(u) + dw / 2)} ${fx(dy + dh)} Z" fill="${DUSK.slateDeep}"/>`
      s += `<path d="M ${fx(X(u) - dw * 0.6)} ${fx(dy + dh * 0.34)} L ${fx(X(u))} ${fx(dy - dh * 0.05)} L ${fx(X(u) + dw * 0.6)} ${fx(dy + dh * 0.34)}" fill="none" stroke="${DUSK.parchDim}" stroke-width="2.6" opacity="0.8"/>`
      s += `<rect x="${fx(X(u) - dw * 0.18)}" y="${fx(dy + dh * 0.42)}" width="${fx(dw * 0.36)}" height="${fx(dh * 0.42)}" fill="${DUSK.amberLit}" opacity="0.9"/>`
    }
    // THE GABLE END: one house turned end-on to the street, its wall carried up
    // through the roof plane to a peak, with barge-boards, a hoist beam and a
    // lit loft door under it. Painted LAST on the roof so no dormer crowds it,
    // and kept to the middle of its house so the pitch is steep enough to read
    // as a gable rather than as a pediment. It stays INSIDE the roof band —
    // anything above the fold belongs to the storey behind, which would simply
    // overpaint it.
    for (const ho of houses) {
      if (!ho.gable) continue
      const gcx = X((ho.u0 + ho.u1) / 2)
      const half = X(ho.u1 - ho.u0) * 0.31
      const peak = yR1 + (yR0 - yR1) * 0.04
      const rise = yR0 - peak
      const face = `M ${fx(gcx - half)} ${fx(yR0)} L ${fx(gcx)} ${fx(peak)} L ${fx(gcx + half)} ${fx(yR0)} Z`
      s += `<path d="${face}" fill="${spec.stone[k]}"/>`
      s += `<path d="M ${fx(gcx - half * 1.1)} ${fx(yR0)} L ${fx(gcx)} ${fx(peak - rise * 0.08)}" stroke="${DUSK.parch}" stroke-width="${fx(Math.max(3.5, h * 0.006))}" opacity="0.85"/>`
      s += `<path d="M ${fx(gcx)} ${fx(peak - rise * 0.08)} L ${fx(gcx + half * 1.1)} ${fx(yR0)}" stroke="${DUSK.parchDim}" stroke-width="${fx(Math.max(3.5, h * 0.006))}" opacity="0.8"/>`
      // the hoist beam every loft door in a working city has over it
      s += `<rect x="${fx(gcx - half * 0.34)}" y="${fx(peak + rise * 0.17)}" width="${fx(half * 0.68)}" height="${fx(Math.max(3, h * 0.004))}" fill="${DUSK.ink}"/>`
      s += roostWindow(gcx - half * 0.24, yR0 - rise * 0.14, half * 0.48, rise * 0.42, true)
    }
    // the eave: a shadow the roof throws down the wall, then its lit lip
    s += `<rect x="0" y="${fx(yR0 - Math.max(4, h * 0.008))}" width="${w}" height="${fx(Math.max(4, h * 0.008))}" fill="${DUSK.ink}" opacity="0.85"/>`
    s += `<rect x="0" y="${fx(yR0 - Math.max(6, h * 0.011))}" width="${w}" height="${fx(Math.max(3, h * 0.004))}" fill="${DUSK.parch}" opacity="0.7"/>`
    // the ridge on the fold: the lit line the storey above steps back behind
    s += `<rect x="0" y="${fx(yR1)}" width="${w}" height="${fx(Math.max(3, h * 0.004))}" fill="${DUSK.parchDim}" opacity="0.72"/>`
    s += `</g>`
    parts.push(s)
  }

  // ---- THE LAMPLIT ROAD, entering at the foot from the gutter side (it inherits
  // that job from the retired yard wall): a warm kerbed band across the bottom of
  // the sprawl with three lamp posts standing in their own pools. ----
  {
    const roadV = 0.038
    let s = `<rect x="0" y="${fx(Y(roadV))}" width="${w}" height="${fx(h - Y(roadV))}" fill="${DUSK.slateDeep}"/>`
    s += `<path d="M 0 ${fx(Y(roadV))} L ${w} ${fx(Y(roadV * 0.72))}" stroke="${DUSK.parchDim}" stroke-width="${fx(Math.max(2.5, h * 0.004))}" opacity="0.6"/>`
    s += `<ellipse cx="${fx(w * 0.1)}" cy="${fx(h)}" rx="${fx(w * 0.5)}" ry="${fx(h * 0.05)}" fill="url(#rookHalo)"/>`
    for (const [u, lh] of [[0.14, 0.055], [0.46, 0.048], [0.78, 0.042]]) {
      const px = X(u)
      s += `<rect x="${fx(px - Math.max(1.5, w * 0.004))}" y="${fx(Y(roadV + lh))}" width="${fx(Math.max(3, w * 0.008))}" height="${fx(Y(roadV) - Y(roadV + lh))}" fill="${DUSK.ink}"/>`
      s += lampHead(px, Y(roadV + lh + 0.018), Y(roadV + lh), Math.max(6, w * 0.018), 3)
    }
    parts.push(s)
  }

  // ---- THE LANDING MAST's stays and pulley at the outboard end, where the
  // dispatch cable comes down out of the sky. ----
  {
    const py = Y(spec.mastTop - 0.008)
    const mx = X(spec.mastU)
    let s = `<path d="M ${fx(mx)} ${fx(py)} L ${fx(X(spec.mastU - 0.09))} ${fx(Y(crest - 0.006))}" stroke="${DUSK.ink}" stroke-width="2.6" opacity="0.9"/>`
    s += `<path d="M ${fx(mx)} ${fx(py)} L ${fx(X(spec.mastU + 0.07))} ${fx(Y(crest - 0.004))}" stroke="${DUSK.ink}" stroke-width="2.6" opacity="0.9"/>`
    s += `<circle cx="${fx(mx)}" cy="${fx(py)}" r="${fx(Math.max(3, w * 0.007))}" fill="${DUSK.slateLit}" stroke="${DUSK.ink}" stroke-width="1.8"/>`
    parts.push(s)
  }

  // ---- ATMOSPHERE: local only. Night falls on the upper terraces, the gutter
  // flank catches the city, the road pools at the foot. ----
  parts.push(`<rect width="${w}" height="${fx(h * 0.3)}" fill="url(#terraceNight)"/>`)
  parts.push(`<rect width="${fx(w * 0.2)}" height="${h}" fill="url(#terraceLitFlank)"/>`)

  const defs =
    `<clipPath id="terraceCut"><path d="${d}"/></clipPath>` +
    cityLampDefs() +
    `<linearGradient id="terraceNight" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${DUSK.ink}" stop-opacity="0.46"/>` +
    `<stop offset="1" stop-color="${DUSK.ink}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="terraceLitFlank" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${DUSK.amber}" stop-opacity="0.14"/>` +
    `<stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0"/></linearGradient>`

  let wheel = ''
  for (const [u, v, sz, tilt] of spec.wheel) {
    const wd = wheelRavenPath(X(u), Y(v), Math.max(10, w * sz), tilt)
    wheel += `<path d="${wd}" fill="${DUSK.ink}"/>` + rookRim(wd, 1.6)
  }

  return svgPiece(w, h, `<g clip-path="url(#terraceCut)">${parts.join('')}</g>` + rookRim(d, 3) + wheel, defs)
}

// ---- THE DISPATCH LINE (`ch3-dispatch-line`) --------------------------------
// A sheet of paper that has to read as a WIRE IN THE AIR, so almost all of it is
// cut away: the alpha carries the cable, its two masts and its three hanging
// letter-baskets, and nothing else. The panel renders at alphaTest 0.1 and the
// house grain pass floors every non-transparent pixel at ~0.16 alpha, so a soft
// halo out here would print as a grey disc — every glow on this piece is small,
// bounded, and paid for.
//
// ROUND 4b — SIZED FOR THE READING CAMERA, NOT FOR THE SHEET. The board capture
// projects this 516x1024 panel into roughly 139x253 screen px, so a source
// stroke is divided by ~3.7 before anyone sees it: the round-4a rope (4.6px
// core, 1.6px highlight) landed at 1.2 and 0.4 screen px and read as a scratch,
// and the lanterns landed at 2.5px. Every weight on this piece is now quoted in
// FRACTIONS OF THE PANEL, which are scale-invariant on screen, and chosen so
// the wire is ~2 screen px of lit rope and each basket ~16x19 screen px with a
// blazing head on it. The sheet is TALLER relative to its width than r4a's and
// the sag is shallower, so most of it is empty air above and below the wire —
// that emptiness is the point and nothing may be painted into it.

/** A point on the cable, at arc parameter s over the node list (s = index / 8,
 *  the same parameter `dispatchLineCableAt` walks). */
function cableAt(cable, s) {
  const x = Math.min(1, Math.max(0, s)) * (cable.length - 1)
  const i = Math.min(cable.length - 2, Math.floor(x))
  const f = x - i
  return [lerp(cable[i][0], cable[i + 1][0], f), lerp(cable[i][1], cable[i + 1][1], f)]
}

/** A slender die-cut MAST rising to meet the wire, with a pulley at its head. */
function cableMast(X, Y, u, vTop, vFoot, halfU, w, h) {
  const x = X(u)
  const hw = X(halfU)
  const yT = Y(vTop)
  const yF = Y(vFoot)
  const body = `M ${fx(x - hw * 0.4)} ${fx(yT)} L ${fx(x + hw * 0.4)} ${fx(yT)} L ${fx(x + hw)} ${fx(yF)} L ${fx(x - hw)} ${fx(yF)} Z`
  let s = `<path d="${body}" fill="${DUSK.slateDim}"/>`
  s += `<path d="M ${fx(x - hw * 0.4)} ${fx(yT)} L ${fx(x - hw)} ${fx(yF)}" stroke="${DUSK.parch}" stroke-width="${fx(Math.max(3, hw * 0.34))}" opacity="0.68"/>`
  s += `<path d="M ${fx(x + hw * 0.4)} ${fx(yT)} L ${fx(x + hw)} ${fx(yF)}" stroke="${DUSK.ink}" stroke-width="${fx(Math.max(3, hw * 0.4))}" opacity="0.7"/>`
  // cross-braces: a slender post reads as a MAST only once it is trussed
  for (let i = 1; i <= 3; i++) {
    const y = lerp(yT, yF, i / 4)
    const bw = lerp(hw * 0.4, hw, i / 4)
    s += `<path d="M ${fx(x - bw)} ${fx(y)} L ${fx(x + bw)} ${fx(y)}" stroke="${DUSK.ink}" stroke-width="${fx(Math.max(2.6, hw * 0.3))}"/>`
    s += `<path d="M ${fx(x - bw)} ${fx(y)} L ${fx(x + lerp(hw * 0.4, hw, (i + 1) / 4))} ${fx(lerp(yT, yF, (i + 1) / 4))}" stroke="${DUSK.ink}" stroke-width="${fx(Math.max(2.2, hw * 0.24))}" opacity="0.75"/>`
  }
  s += rookRim(body, 2.6)
  // the head: a pulley wheel with a warm catch on it, so the wire visibly ENDS
  // on something rather than running off the edge of the sheet
  s += warmBloom(x, yT, Math.max(10, w * 0.05))
  s += `<circle cx="${fx(x)}" cy="${fx(yT)}" r="${fx(Math.max(6, w * 0.026))}" fill="${DUSK.slateLit}" stroke="${DUSK.ink}" stroke-width="3"/>`
  s += `<circle cx="${fx(x)}" cy="${fx(yT)}" r="${fx(Math.max(2, w * 0.009))}" fill="${DUSK.ink}"/>`
  return s
}

/** THE DIE-CUT CABLE PANEL. `cable` is the SAME (u, v) node list content.ts
 *  hands the solver, so the painted wire and the wire the reader's basket rides
 *  are one polyline. */
function dispatchCablePanel({ w, h, seed, cable, baskets }) {
  const X = (u) => u * w
  const Y = (v) => (1 - v) * h
  const r = mulberry32(seed)
  const line = cable.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ')
  const parts = []

  // the two masts, cut before the rope so the rope crosses their heads
  // (offset inboard by more than a half-width, so neither mast's splayed foot is
  // sheared off by the edge of the sheet)
  parts.push(cableMast(X, Y, cable[0][0] + 0.03, cable[0][1], cable[0][1] - 0.2, 0.026, w, h))
  const last = cable[cable.length - 1]
  // the outboard mast runs DOWN to the roost crest it lands on: stopping it
  // short leaves a post hanging in the air over the roofs on the board
  parts.push(cableMast(X, Y, last[0] - 0.03, last[1], last[1] - 0.245, 0.026, w, h))

  // THE ROPE, in FRACTIONS of the panel. A dark core carries the wire wherever
  // it crosses something lit, and a LIT strand lifted off its top edge carries
  // it over the black page — on a night spread the ink core is invisible and the
  // highlight is the whole read, so the highlight is the heavier half of the
  // pair here, not a glint on it.
  const core = Math.max(5, w * 0.016)
  parts.push(`<path d="${line}" fill="none" stroke="${DUSK.ink}" stroke-width="${fx(core)}" stroke-linejoin="round" stroke-linecap="round"/>`)
  parts.push(
    `<path d="${line}" fill="none" stroke="${DUSK.parchDim}" stroke-width="${fx(core * 0.62)}" opacity="0.9" stroke-linejoin="round" stroke-linecap="round" transform="translate(0,${fx(-core * 0.34)})"/>`
  )
  parts.push(
    `<path d="${line}" fill="none" stroke="${DUSK.parch}" stroke-width="${fx(core * 0.26)}" opacity="0.8" stroke-linejoin="round" stroke-linecap="round" transform="translate(0,${fx(-core * 0.44)})"/>`
  )

  // ---- THE SEND CUE (T-AFFORDANCE) -----------------------------------------
  // Both working mechanisms on this spread shipped silent while the dial — the
  // one that LOOKED dead — carried the only instruction on the page. That reads
  // as a wiring error from the reader's chair. The winch answered it with an
  // engraved HOIST band; the cable answers it here: a brass plate struck SEND,
  // bracketed off the NEAR mast (the gutter-side high end, where the trolley
  // sits at riderHome = 0.06), with a short arrow running down the wire.
  //
  // SIZED FOR THE BOARD, NOT FOR THE SHEET. The panel projects to ~139x253
  // screen px, so a label-sized decal here is a smudge: the plate is 31% of the
  // panel's width (~42 screen px) with a ~11 screen px cap height, which makes
  // it several times the mast head it hangs off. And because ~97% of this sheet
  // is cut away, the light on it is `warmBloom` — a soft halo out here prints as
  // a grey disc once the grain pass floors every non-transparent pixel.
  const mHeadX = X(cable[0][0] + 0.03)
  const mHeadY = Y(cable[0][1])
  const pw = w * 0.312
  const ph = w * 0.108
  const px0 = mHeadX + w * 0.059
  const py0 = mHeadY - ph * 0.42
  const plateD = `M ${fx(px0)} ${fx(py0)} L ${fx(px0 + pw)} ${fx(py0)} L ${fx(px0 + pw)} ${fx(py0 + ph)} L ${fx(px0)} ${fx(py0 + ph)} Z`
  // the two bolt-arms back to the mast head, so the plate is MOUNTED and not
  // floating in the air the rest of this sheet is made of
  for (const t of [0.26, 0.74]) {
    parts.push(
      `<path d="M ${fx(mHeadX)} ${fx(mHeadY)} L ${fx(px0)} ${fx(py0 + ph * t)}" stroke="${DUSK.ink}" stroke-width="${fx(Math.max(4, w * 0.016))}" stroke-linecap="round"/>`
    )
    parts.push(
      `<path d="M ${fx(mHeadX)} ${fx(mHeadY)} L ${fx(px0)} ${fx(py0 + ph * t)}" stroke="${DUSK.amber}" stroke-width="${fx(Math.max(2, w * 0.007))}" stroke-linecap="round"/>`
    )
  }
  parts.push(warmBloom(px0, py0 + ph * 0.5, ph * 0.55))
  parts.push(`<path d="${plateD}" fill="${DUSK.amber}"/>`)
  parts.push(`<rect x="${fx(px0)}" y="${fx(py0)}" width="${fx(pw)}" height="${fx(ph * 0.3)}" fill="${DUSK.amberLit}" opacity="0.7"/>`)
  parts.push(rookRim(plateD, 3.4))
  for (const bx of [px0 + pw * 0.045, px0 + pw * 0.955]) {
    parts.push(`<circle cx="${fx(bx)}" cy="${fx(py0 + ph * 0.5)}" r="${fx(ph * 0.075)}" fill="${DUSK.amberCore}" stroke="${DUSK.ink}" stroke-width="2"/>`)
  }
  const scw = pw * 0.174
  const sgap = pw * 0.0435
  const sch = ph * 0.68
  const ssw = ph * 0.14
  const sx0 = px0 + (pw - (4 * scw + 3 * sgap)) / 2
  const sy0 = py0 + (ph - sch) / 2
  parts.push(engraveWord('SEND', sx0, sy0 + ssw * 0.3, scw, sch, sgap, DUSK.amberCore, fx(ssw * 0.85), 'opacity="0.6"'))
  parts.push(engraveWord('SEND', sx0, sy0, scw, sch, sgap, DUSK.ink, fx(ssw), 'opacity="0.95"'))

  // THE DIRECTION ARROW, laid parallel to the wire just off its lit edge and
  // pointing the way the trolley runs (riderHome -> 1, i.e. outboard and down).
  {
    const [au, av] = cableAt(cable, 0.1)
    const [bu, bv] = cableAt(cable, 0.19)
    const ax = X(au)
    const ay = Y(av)
    const bx = X(bu)
    const by = Y(bv)
    const dx = bx - ax
    const dy = by - ay
    const L = Math.hypot(dx, dy) || 1
    // the perpendicular on the wire's UPPER side, where the baskets are not
    const nx = dy / L
    const ny = -dx / L
    const off = w * 0.036
    const hl = w * 0.05
    const hw = w * 0.026
    const sxA = ax + nx * off
    const syA = ay + ny * off
    const sxB = bx + nx * off
    const syB = by + ny * off
    const tailX = sxB - (dx / L) * hl
    const tailY = syB - (dy / L) * hl
    parts.push(`<path d="M ${fx(sxA)} ${fx(syA)} L ${fx(tailX)} ${fx(tailY)}" stroke="${DUSK.ink}" stroke-width="${fx(w * 0.019)}" stroke-linecap="round"/>`)
    parts.push(`<path d="M ${fx(sxA)} ${fx(syA)} L ${fx(tailX)} ${fx(tailY)}" stroke="${DUSK.amberLit}" stroke-width="${fx(w * 0.008)}" stroke-linecap="round"/>`)
    const headD =
      `M ${fx(sxB)} ${fx(syB)} L ${fx(tailX + nx * hw)} ${fx(tailY + ny * hw)} ` +
      `L ${fx(tailX - nx * hw)} ${fx(tailY - ny * hw)} Z`
    parts.push(`<path d="${headD}" fill="${DUSK.amber}"/>`)
    parts.push(`<path d="${headD}" fill="none" stroke="${DUSK.ink}" stroke-width="${fx(Math.max(2, w * 0.006))}" stroke-linejoin="round"/>`)
  }

  // THE HANGING LETTER-BASKETS. Each is a hook over the wire, a short yoke, a
  // wicker pannier and one lit lantern — the fixed three the reader does not
  // touch, so the eye reads the wire as WORKING before a hand ever lands on it.
  for (const s of baskets) {
    const [u, v] = cableAt(cable, s)
    const cx = X(u)
    const cy = Y(v)
    const bw = w * 0.105
    const bh = h * 0.072
    const hook = Math.max(4, bw * 0.09)
    let g = `<path d="M ${fx(cx - bw * 0.22)} ${fx(cy - bh * 0.16)} A ${fx(bw * 0.22)} ${fx(bh * 0.16)} 0 1 1 ${fx(cx + bw * 0.22)} ${fx(cy - bh * 0.1)}" fill="none" stroke="${DUSK.ink}" stroke-width="${fx(hook)}"/>`
    g += `<path d="M ${fx(cx)} ${fx(cy)} L ${fx(cx - bw * 0.4)} ${fx(cy + bh * 0.42)} M ${fx(cx)} ${fx(cy)} L ${fx(cx + bw * 0.4)} ${fx(cy + bh * 0.42)}" stroke="${DUSK.ink}" stroke-width="${fx(hook * 0.8)}"/>`
    const by = cy + bh * 0.42
    const pan = `M ${fx(cx - bw * 0.44)} ${fx(by)} L ${fx(cx + bw * 0.44)} ${fx(by)} L ${fx(cx + bw * 0.3)} ${fx(by + bh * 0.66)} L ${fx(cx - bw * 0.3)} ${fx(by + bh * 0.66)} Z`
    g += `<path d="${pan}" fill="#4a3018"/>`
    // the lit half of the wicker, on the gutter flank where the city is: a
    // pannier painted one flat brown is a bag, and this has to read as a basket
    g += `<path d="M ${fx(cx - bw * 0.44)} ${fx(by)} L ${fx(cx - bw * 0.02)} ${fx(by)} L ${fx(cx - bw * 0.02)} ${fx(by + bh * 0.66)} L ${fx(cx - bw * 0.3)} ${fx(by + bh * 0.66)} Z" fill="#7a5228" opacity="0.8"/>`
    g += `<path d="M ${fx(cx - bw * 0.46)} ${fx(by)} L ${fx(cx + bw * 0.46)} ${fx(by)}" stroke="${DUSK.parch}" stroke-width="${fx(hook * 1.05)}" opacity="0.88"/>`
    for (let i = 1; i <= 2; i++) {
      const y = by + (bh * 0.66 * i) / 3
      const t = i / 3
      g += `<path d="M ${fx(cx - lerp(bw * 0.44, bw * 0.3, t))} ${fx(y)} L ${fx(cx + lerp(bw * 0.44, bw * 0.3, t))} ${fx(y)}" stroke="${DUSK.ink}" stroke-width="${fx(hook * 0.6)}" opacity="0.7"/>`
    }
    g += rookRim(pan, Math.max(2, bw * 0.05))
    // the envelopes riding in it, and the lamp that says the run is live
    g += `<path d="M ${fx(cx - bw * 0.3)} ${fx(by)} L ${fx(cx - bw * 0.02)} ${fx(by - bh * 0.24)} L ${fx(cx + bw * 0.12)} ${fx(by)} Z" fill="${DUSK.parch}" opacity="0.94"/>`
    const lx = cx + bw * 0.54
    g += warmBloom(lx, by + bh * 0.18, Math.max(14, w * 0.052))
    g += lampHead(lx, by - bh * 0.04, by + bh * 0.34, Math.max(10, w * 0.032), 0)
    parts.push(g)
  }

  // RANKS riding the wire — the cheapest possible statement that the line is a
  // raven road. Each rank is rotated onto the cable's own slope, because a
  // horizontal rank on a falling wire reads as birds hovering beside it.
  for (const [s, n] of [[0.31, 2], [0.62, 2], [0.9, 2]]) {
    const [u, v] = cableAt(cable, s)
    const [ua, va] = cableAt(cable, Math.max(0, s - 0.03))
    const [ub, vb] = cableAt(cable, Math.min(1, s + 0.03))
    const ang = (Math.atan2(Y(vb) - Y(va), X(ub) - X(ua)) * 180) / Math.PI
    const bh = 0.029 + r() * 0.005
    const halfU = (n * bh * h * RAVEN_CELL) / (2 * w)
    let dd = `M ${fx(X(u - halfU))} ${fx(Y(v))}`
    for (const [cu, cv] of ravenChainTop(u - halfU, u + halfU, v, bh, n, 'left')) {
      dd += ` L ${fx(X(cu))} ${fx(Y(cv))}`
    }
    dd += ` L ${fx(X(u + halfU))} ${fx(Y(v))} Z`
    // slate, not ink: a bird cut in ink and hung in mid-air over a BLACK page is
    // a pale rim scribble and nothing else — out here the silhouette has to be
    // lighter than the night it sits in
    parts.push(
      `<g transform="rotate(${ang.toFixed(2)} ${fx(X(u))} ${fx(Y(v))})">` +
        `<path d="${dd}" fill="${DUSK.slateDim}"/>` +
        `<path d="${dd}" fill="none" stroke="${DUSK.rim}" stroke-width="${fx(Math.max(2.4, w * 0.008))}" opacity="0.66" stroke-linejoin="round"/>` +
        `</g>`
    )
  }

  return svgPiece(w, h, parts.join(''), cityLampDefs())
}

/** THE READER'S BASKET (`ch3-dispatch-line-basket`) — the in-plane rider the
 *  reader pushes down the wire. The quad hangs it BELOW the cable, so the yoke
 *  and its hook sit at the very top of the image and the pannier fills the rest;
 *  the sprite is drawn to the cell because the cell is all the paper it gets. */
/**
 * THE READER'S TROLLEY (ch3-dispatch-line-basket) — the one thing on this
 * spread the reader's hand operates, so it is drawn to be FOUND and to be
 * GRABBED, which are two different jobs.
 *
 * FOUND: it carries the brightest lantern on the wire, with a bloom behind it.
 * On a black page at 1600x900 the eye lands on warm light before it lands on
 * shape, and the three static lanterns are deliberately dimmer and smaller.
 *
 * GRABBED: a brass PULL-RING hangs under the pannier. A ring on a cord is the
 * oldest "pull me" in the world, it is diegetic on a dispatch line (that is how
 * you haul a trolley in), and it is on-palette — the same brass the lanterns and
 * the winch crank are made of, not a grey UI affordance pasted onto a painting.
 *
 * CENTRED ON THE WIRE, not hung below it: the quad's middle is the cable, so the
 * grooved pulley WHEEL sits at the image's centre with the pannier below and the
 * hanger above. That is what a cable trolley is, and it is also the only way the
 * handle fits — hung wholly below the wire the same quad dips under the roosts'
 * crest at the outboard end (popup-dispatchline.ts, gate L17). The panel's own
 * painted cable passes through the wheel's centre from both sides, so the wheel
 * reads as clipped over it at every point of the run regardless of the wire's
 * local slope.
 */
function readerBasket(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const cy = h * 0.5 // the cable runs through here: the quad is centred on it
  const parts = []

  // ---- the pulley WHEEL, sitting on the wire -------------------------------
  const wheelR = w * 0.13
  parts.push(`<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(wheelR * 1.18)}" fill="${DUSK.ink}" opacity="0.85"/>`)
  parts.push(`<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(wheelR)}" fill="${DUSK.amber}"/>`)
  parts.push(`<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(wheelR * 0.66)}" fill="${DUSK.amberDeep}"/>`)
  parts.push(`<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(wheelR * 0.22)}" fill="${DUSK.amberCore}"/>`)
  // a specular catch on the upper-left of the rim: brass, lit from the keep side
  parts.push(
    `<path d="M ${fx(cx - wheelR * 0.86)} ${fx(cy - wheelR * 0.36)} A ${fx(wheelR)} ${fx(wheelR)} 0 0 1 ${fx(cx - wheelR * 0.2)} ${fx(cy - wheelR * 0.94)}" fill="none" stroke="${DUSK.amberCore}" stroke-width="${fx(w * 0.018)}" opacity="0.85" stroke-linecap="round"/>`
  )
  // the stirrup: a brass yoke over the axle, its arms running down to the pannier
  parts.push(
    `<path d="M ${fx(cx - wheelR * 1.05)} ${fx(cy - wheelR * 0.5)} L ${fx(cx - wheelR * 1.05)} ${fx(h * 0.635)} M ${fx(cx + wheelR * 1.05)} ${fx(cy - wheelR * 0.5)} L ${fx(cx + wheelR * 1.05)} ${fx(h * 0.635)}" fill="none" stroke="${DUSK.amber}" stroke-width="${fx(w * 0.028)}" stroke-linecap="round"/>`
  )
  parts.push(
    `<path d="M ${fx(cx - wheelR * 1.05)} ${fx(cy - wheelR * 0.72)} A ${fx(wheelR * 1.05)} ${fx(wheelR * 0.8)} 0 0 1 ${fx(cx + wheelR * 1.05)} ${fx(cy - wheelR * 0.72)}" fill="none" stroke="${DUSK.amber}" stroke-width="${fx(w * 0.026)}"/>`
  )

  // ---- the yoke bar and the WICKER pannier, below the wire -----------------
  const yb = h * 0.635
  parts.push(`<rect x="${fx(w * 0.22)}" y="${fx(yb)}" width="${fx(w * 0.56)}" height="${fx(h * 0.038)}" fill="${DUSK.slateDim}"/>`)
  parts.push(`<rect x="${fx(w * 0.22)}" y="${fx(yb)}" width="${fx(w * 0.56)}" height="${fx(h * 0.012)}" fill="${DUSK.parch}" opacity="0.7"/>`)

  const by = h * 0.685
  const bb = h * 0.86
  const body = `M ${fx(w * 0.19)} ${fx(by)} L ${fx(w * 0.81)} ${fx(by)} L ${fx(w * 0.7)} ${fx(bb)} L ${fx(w * 0.3)} ${fx(bb)} Z`
  parts.push(`<path d="${body}" fill="#5a3b1e"/>`)
  // the lit half follows the pannier's own taper — a vertical seam down a
  // tapering basket reads as a fold in the paper, not as light on wicker
  parts.push(`<path d="M ${fx(w * 0.19)} ${fx(by)} L ${fx(w * 0.5)} ${fx(by)} L ${fx(w * 0.44)} ${fx(bb)} L ${fx(w * 0.3)} ${fx(bb)} Z" fill="#7a5228" opacity="0.75"/>`)
  parts.push(`<rect x="${fx(w * 0.17)}" y="${fx(by - h * 0.032)}" width="${fx(w * 0.66)}" height="${fx(h * 0.04)}" fill="#8a5f2f"/>`)
  parts.push(`<rect x="${fx(w * 0.17)}" y="${fx(by - h * 0.032)}" width="${fx(w * 0.66)}" height="${fx(h * 0.013)}" fill="${DUSK.parch}" opacity="0.8"/>`)
  for (let i = 1; i <= 3; i++) {
    const t = i / 4
    const y = lerp(by, bb, t)
    const half = lerp(w * 0.31, w * 0.2, t)
    parts.push(`<path d="M ${fx(cx - half)} ${fx(y)} L ${fx(cx + half)} ${fx(y)}" stroke="${DUSK.ink}" stroke-width="${fx(w * 0.012)}" opacity="0.6"/>`)
    parts.push(`<path d="M ${fx(cx - half)} ${fx(y - h * 0.01)} L ${fx(cx + half)} ${fx(y - h * 0.01)}" stroke="#a87a3d" stroke-width="${fx(w * 0.007)}" opacity="0.5"/>`)
  }
  for (let i = 0; i < 6; i++) {
    const x = lerp(w * 0.23, w * 0.77, i / 5) + (r() * 2 - 1) * w * 0.008
    parts.push(`<path d="M ${fx(x)} ${fx(by)} L ${fx(lerp(x, cx, 0.2))} ${fx(bb)}" stroke="#3a2410" stroke-width="${fx(w * 0.009)}" opacity="0.6"/>`)
  }
  parts.push(rookRim(body, 2.4))

  // two envelopes poking out of the mouth, cream against the night
  for (const [ex, tilt] of [[0.36, -0.22], [0.55, 0.16]]) {
    const x = w * ex
    const ew = w * 0.17
    const eh = h * 0.1
    const c = Math.cos(tilt)
    const sn = Math.sin(tilt)
    const P = (dx, dy) => `${fx(x + dx * c - dy * sn)} ${fx(by + dx * sn + dy * c)}`
    parts.push(`<path d="M ${P(0, 0)} L ${P(ew, -eh * 0.3)} L ${P(ew, -eh)} L ${P(0, -eh * 0.7)} Z" fill="${DUSK.parch}"/>`)
    parts.push(`<path d="M ${P(0, -eh * 0.7)} L ${P(ew * 0.5, -eh * 0.72)} L ${P(ew, -eh)}" fill="none" stroke="${DUSK.parchDim}" stroke-width="${fx(w * 0.009)}"/>`)
  }

  // ---- the BRASS PULL-RING: the thing that says "take hold of me" ----------
  parts.push(`<path d="M ${fx(cx)} ${fx(bb)} L ${fx(cx)} ${fx(h * 0.878)}" stroke="${DUSK.ink}" stroke-width="${fx(w * 0.02)}"/>`)
  const ringY = h * 0.918
  const ringR = w * 0.055
  parts.push(warmBloom(cx, ringY, ringR * 2.1))
  parts.push(`<circle cx="${fx(cx)}" cy="${fx(ringY)}" r="${fx(ringR + w * 0.018)}" fill="${DUSK.ink}" opacity="0.8"/>`)
  parts.push(`<circle cx="${fx(cx)}" cy="${fx(ringY)}" r="${fx(ringR)}" fill="none" stroke="${DUSK.amberLit}" stroke-width="${fx(w * 0.026)}"/>`)
  parts.push(
    `<path d="M ${fx(cx - ringR * 0.72)} ${fx(ringY - ringR * 0.5)} A ${fx(ringR)} ${fx(ringR)} 0 0 1 ${fx(cx + ringR * 0.1)} ${fx(ringY - ringR)}" fill="none" stroke="${DUSK.amberCore}" stroke-width="${fx(w * 0.014)}" stroke-linecap="round"/>`
  )

  // ---- the lantern: the trolley has to be findable from across the spread ---
  parts.push(`<path d="M ${fx(w * 0.79)} ${fx(yb + h * 0.01)} L ${fx(w * 0.85)} ${fx(h * 0.68)}" stroke="${DUSK.ink}" stroke-width="${fx(w * 0.015)}"/>`)
  parts.push(warmBloom(w * 0.85, h * 0.755, w * 0.21))
  parts.push(lampHead(w * 0.85, h * 0.68, h * 0.84, w * 0.145, 0))

  return svgPiece(w, h, parts.join(''), cityLampDefs())
}
// ---- THE ROOKERY'S OUTER YARD WALL (ch3-fringe, foreground vfold, very wide/
// short; crease at image centre). Slate ashlar, a CRENELLATED coping, six short
// groups of perched ravens standing on it, lit dispatch hatches the whole length,
// and a working GATE where the post-road painted on page-4 passes through.
//
// WAVE-2 REWORK (S4-6 + S4-7), and the render that forced it. Downscaled to the
// 860x105 screen box this wall actually occupies, the round-3 crest read as a row
// of cream SCALLOPS — a lace trim, exactly as the blind reader called it — while
// the right third of the wall was bare brick with a big empty arch at the end.
// Three causes, all measurable:
//
//  (a) THE CREST WAS ALL BIRDS. Four linked raven chains covered 68% of the
//      wall's length, so the silhouette had no architecture in it at all. A
//      68%-bird parapet does not read as birds on a wall; it reads as a decorative
//      border, and the pale cut-edge rim tracing it turned that border cream.
//      The crest is now genuinely CRENELLATED — merlons and gaps, which is what
//      the pale rim is for — with birds in SIX SHORT GROUPS totalling ~26%, each
//      bird twice its old height so a group reads as birds rather than as a
//      frill. (The file's own warning at rookRim, "the raven chain a scalloped
//      ribbon rather than birds", was right and was only half-heeded.)
//  (b) NOTHING WAS LIT PAST u 0.765. The hatch loop ran cu = 0.045 + (k/14)*0.72,
//      so the wall's whole outboard quarter had no light in it. Hatches now run
//      the full length, skipping only the gate.
//  (c) THE GATE WAS A HOLE. Its only treatment was one halo ellipse, so the
//      reader read "one large blank outlined arch... an unfinished cutout". It is
//      now a gate: ashlar jambs, a voussoir arch with a keystone, a lantern
//      bracketed each side, warm light on the road inside, and two ravens
//      standing in the mouth where the light is strongest. ----
function rookeryFringe(w, h, seed) {
  const r = mulberry32(seed)
  const crestV = 0.5 // wall top, in v-up fractions of the strip height
  const Y = (v) => (1 - v) * h
  const X = (u) => u * w
  // rankV is capped by the CANVAS, not by taste: the birds stand at crestV +
  // rankV in a v-space that ends at 1.0, so 0.47 is the tallest bird this strip
  // holds (a first pass at 0.86 clipped every head flat and the groups came out
  // indistinguishable from the merlons — the render caught it). The height that
  // matters is the RELIEF above the coping, 0.45*rankV = 0.21 of the strip, about
  // 22 screen px against the merlons' 14: birds standing on a battlement.
  const rankV = 0.47 // raven height above the coping
  const merlonV = 0.13 // merlon height above the coping
  // SIX SHORT GROUPS, ~28% of the length, spaced so the eye reads wall-then-birds
  // -then-wall rather than one continuous frill, and each wide enough for TWO
  // birds at their natural build (cell = 0.6 x height) rather than four squeezed
  // ones. The two widest sit either side of the gate, which is where a rookery's
  // birds would actually wait.
  const bands = [[0.05, 0.145], [0.215, 0.3], [0.385, 0.48], [0.545, 0.615], [0.685, 0.78], [0.895, 0.96]]

  // wall body: crenellated coping with the six bird groups standing on it, as ONE
  // contour (the silhouette IS the die-cut, so anything meant to break the sky
  // has to be in here).
  const top = [[0, crestV]]
  let cursor = 0.008
  for (const [z0, z1] of bands) {
    // crenellation from the last group's end up to this group's start
    const teeth = Math.max(2, Math.round(((z0 - cursor) * w) / Math.max(14, h * 0.24)))
    if (z0 - cursor > 0.01) top.push(...crenelTop(cursor, z0, crestV, crestV + merlonV, teeth))
    top.push([z0, crestV])
    const n = Math.max(2, Math.round(((z1 - z0) * w) / Math.max(10, rankV * h * RAVEN_CELL)))
    top.push(...ravenChainTop(z0, z1, crestV, rankV, n, 'left'), [z1, crestV])
    cursor = z1
  }
  const teethEnd = Math.max(2, Math.round(((0.992 - cursor) * w) / Math.max(14, h * 0.24)))
  top.push(...crenelTop(cursor, 0.992, crestV, crestV + merlonV, teethEnd))
  top.push([1, crestV])
  const wall = simplifyOutline([[0, 0], ...top, [1, 0]])
  const wallD = wall.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'

  // THE GATE: a true alpha hole (even-odd) the post-road runs through. Widened
  // and raised a little so it reads as the yard's gate rather than a mouse hole,
  // and moved a hair inboard so the wall still has crenellated shoulder outboard
  // of it (an arch flush with the end of a wall reads as a broken wall).
  const nx0 = 0.785
  const nx1 = 0.9
  const nTop = 0.52
  const notchD =
    `M ${fx(X(nx0))} ${fx(h)} L ${fx(X(nx0 + 0.008))} ${fx(Y(nTop * 0.7))} ` +
    `Q ${fx(X((nx0 + nx1) / 2))} ${fx(Y(nTop))} ${fx(X(nx1 - 0.008))} ${fx(Y(nTop * 0.7))} L ${fx(X(nx1))} ${fx(h)} Z`

  let s = `<g>`
  // THE GATE IS NOT A HOLE ANY MORE. It was cut as a true alpha aperture "so the
  // post-road passes through" — but the road painted on page-4 does not line up
  // behind it, so what a reader saw through the aperture was night sky, which is
  // exactly why it read as "one large blank outlined arch... an unfinished
  // cutout". A gate you can see through is only a trick worth having when there
  // is something behind it. So the wall stays SOLID here and the archway is
  // PAINTED: a warm tunnel with the road receding into it. The notch path is kept
  // because the rim still traces it, which is what makes it an arch.
  s += `<path d="${wallD}" fill="${DUSK.slate}"/>`
  s += `<g clip-path="url(#fringeCut)">`
  // coping + ashlar coursing + a lit crest line
  s += `<rect x="0" y="${fx(Y(crestV))}" width="${w}" height="${fx(Math.max(3, h * 0.04))}" fill="${DUSK.slateLit}" opacity="0.55"/>`
  for (let i = 1; i * h * 0.16 < h; i++) {
    const cy = h - i * h * 0.16
    s += `<line x1="0" y1="${fx(cy)}" x2="${w}" y2="${fx(cy)}" stroke="${DUSK.ink}" stroke-width="1.6" opacity="${(0.2 + r() * 0.16).toFixed(2)}"/>`
    for (let b = 0; b < 26; b++) {
      const jx = ((b + (i % 2 ? 0.5 : 0)) / 26) * w
      s += `<line x1="${fx(jx)}" y1="${fx(cy)}" x2="${fx(jx)}" y2="${fx(cy - h * 0.16)}" stroke="${DUSK.ink}" stroke-width="1.3" opacity="0.24"/>`
    }
  }
  // ---- THE YARD WALL AT DISPATCH HOUR. Round 1 left this the one unlit piece
  // on the spread, and being the NEAREST plane that made the whole foreground
  // read as dead slate. It is now a working wall: a rank of lit dispatch hatches
  // along it, the notch mouth glowing where the post-road comes through, and the
  // perched ravens rim-lit from below by both.
  //
  // (b) THE HATCHES NOW RUN THE WHOLE WALL. 21 stations over u 0.035..0.965 at an
  // even pitch, skipping only the gate — the round-3 loop stopped at 0.765 and
  // left the outboard quarter dark, which is the "bare brick" the reader named.
  // The lit CHANCE is graded down outboard (0.72 -> 0.46) so the wall still
  // recedes away from the keep instead of blazing evenly.
  const hatchV = 0.28
  const hatchW = 0.03
  const hatchH = 0.32
  let litPrev = false
  const HATCHES = 21
  for (let k = 0; k < HATCHES; k++) {
    const cu = 0.035 + (k / (HATCHES - 1)) * 0.93
    if (cu > nx0 - 0.055 && cu < nx1 + 0.055) continue
    const roll = r()
    const chance = lerp(0.72, 0.46, cu)
    const lit = roll < chance || (litPrev && roll < chance + 0.2)
    litPrev = lit
    s += ravenPortal(X(cu - hatchW / 2), Y(hatchV), X(hatchW), hatchH * h, lit, 0.5)
  }
  // ---- (c) THE GATE, built rather than punched: a painted tunnel that recedes,
  // the masonry that makes it an arch, and two birds standing in the warmest spot
  // on the whole wall.
  const gcu = (nx0 + nx1) / 2
  const gHalf = (nx1 - nx0) / 2
  s += `<ellipse cx="${fx(X(gcu))}" cy="${fx(Y(nTop * 0.5))}" rx="${fx(X(gHalf * 2.1))}" ry="${fx(h * 0.4)}" fill="url(#rookHalo)" opacity="0.85"/>`
  // the tunnel: the arch's own interior, dark at the crown and blazing at the
  // floor where the lamplit road runs in — three nested washes inside the notch
  // shape, so the depth is stated by tone rather than by a hole
  s += `<path d="${notchD}" fill="${DUSK.amberDeep}" opacity="0.9"/>`
  s += `<ellipse cx="${fx(X(gcu))}" cy="${fx(h * 0.98)}" rx="${fx(X(gHalf * 0.92))}" ry="${fx(h * 0.4)}" fill="url(#rookGlow)" opacity="0.85"/>`
  s += `<ellipse cx="${fx(X(gcu))}" cy="${fx(h)}" rx="${fx(X(gHalf * 0.62))}" ry="${fx(h * 0.26)}" fill="${DUSK.amberCore}" opacity="0.8"/>`
  // the road's own crown running out of the gate mouth toward the reader
  s += `<path d="M ${fx(X(gcu - gHalf * 0.5))} ${fx(h)} L ${fx(X(gcu - gHalf * 0.16))} ${fx(Y(nTop * 0.5))} L ${fx(X(gcu + gHalf * 0.16))} ${fx(Y(nTop * 0.5))} L ${fx(X(gcu + gHalf * 0.5))} ${fx(h)} Z" fill="${DUSK.parch}" opacity="0.3"/>`
  // a soffit shadow under the arch head so the tunnel has a ceiling
  s += `<path d="M ${fx(X(nx0 + 0.012))} ${fx(Y(nTop * 0.66))} Q ${fx(X(gcu))} ${fx(Y(nTop * 0.96))} ${fx(X(nx1 - 0.012))} ${fx(Y(nTop * 0.66))} L ${fx(X(nx1 - 0.012))} ${fx(Y(nTop * 0.4))} Q ${fx(X(gcu))} ${fx(Y(nTop * 0.62))} ${fx(X(nx0 + 0.012))} ${fx(Y(nTop * 0.4))} Z" fill="${DUSK.ink}" opacity="0.55"/>`
  // voussoir arch + keystone over the opening
  for (let k = -4; k <= 4; k++) {
    const a = 90 - k * 19
    const vx = X(gcu) + Math.cos((a * Math.PI) / 180) * X(gHalf * 1.06)
    const vy = Y(nTop * 0.78) - Math.sin((a * Math.PI) / 180) * h * 0.2
    s += `<rect x="${fx(vx - X(0.008))}" y="${fx(vy - h * 0.07)}" width="${fx(X(0.016))}" height="${fx(h * 0.14)}" fill="${k === 0 ? DUSK.parch : DUSK.slateLit}" opacity="${k === 0 ? '0.85' : '0.6'}" transform="rotate(${fx(90 - a)} ${fx(vx)} ${fx(vy)})"/>`
  }
  // jambs: a dressed stone edge each side of the opening
  for (const jx of [nx0, nx1]) {
    s += `<rect x="${fx(X(jx) - X(0.007))}" y="${fx(Y(nTop * 0.82))}" width="${fx(X(0.014))}" height="${fx(h - Y(nTop * 0.82))}" fill="${DUSK.slateLit}" opacity="0.5"/>`
  }
  // a lantern bracketed each side of the gate — the reason the mouth is bright
  for (const lx of [nx0 - 0.028, nx1 + 0.028]) {
    s += warmBloom(X(lx), Y(nTop * 0.92), X(0.026))
    s += lampHead(X(lx), Y(nTop * 1.02), Y(nTop * 0.78), X(0.017), 0)
  }
  // two ravens standing in the gate mouth, where the light is strongest: the
  // wall's own restatement of the chapter's beat at the size it reads best
  for (const [gx, gs] of [[gcu - gHalf * 0.42, 0.3], [gcu + gHalf * 0.34, 0.24]]) {
    s += `<g transform="translate(${fx(X(gx))} ${fx(h - h * 0.1)})">${miniRaven(h * gs, DUSK.ink, DUSK.slateLit)}</g>`
  }
  // The rank's bodies (the contour already cut them) are filled INK so the birds
  // read as dark silhouettes against the night rather than as the pale cut edge —
  // which is the other half of the lace-trim failure. Eyes and a lit perch ledge
  // rim them from below; the crenellation between the groups gets a coping catch
  // of its own, so the pale rim along the merlons reads as masonry.
  const perchV = crestV + rankV * RAVEN_PROFILE[0][1]
  for (const [z0, z1] of bands) {
    const n = Math.max(2, Math.round(((z1 - z0) * w) / Math.max(10, rankV * h * RAVEN_CELL)))
    s += `<rect x="${fx(X(z0))}" y="${fx(Y(crestV + rankV))}" width="${fx(X(z1 - z0))}" height="${fx(Y(perchV) - Y(crestV + rankV))}" fill="${DUSK.ink}"/>`
    s += `<rect x="${fx(X(z0))}" y="${fx(Y(perchV) - Math.max(1.6, h * 0.014))}" width="${fx(X(z1 - z0))}" height="${fx(Math.max(1.6, h * 0.014))}" fill="${DUSK.amberLit}" opacity="0.5"/>`
    const cw = (z1 - z0) / n
    for (let k = 0; k < n; k++) {
      // eye + a beak notch of sky, so a bird at 12 screen px still has a face
      s += `<circle cx="${fx(X(z0 + cw * (k + 0.14)))}" cy="${fx(Y(crestV + rankV * 0.86))}" r="${fx(Math.max(1.6, rankV * h * 0.055))}" fill="${DUSK.amberCore}" opacity="0.95"/>`
    }
  }
  // A THIRD posted notice, out on the stretch that used to be bare — on the
  // OUTBOARD shoulder past the gate (a first pass put it at u 0.84, which is
  // inside the gate's own alpha hole, so it hung in the archway).
  for (const [px, pv] of [[0.938, 0.34]]) {
    s += `<ellipse cx="${fx(X(px) + w * 0.018)}" cy="${fx(Y(pv) + h * 0.15)}" rx="${fx(w * 0.05)}" ry="${fx(h * 0.34)}" fill="url(#rookHalo)" opacity="0.55"/>`
    s += `<rect x="${fx(X(px))}" y="${fx(Y(pv))}" width="${fx(w * 0.032)}" height="${fx(h * 0.28)}" fill="${DUSK.parch}" opacity="0.92" transform="rotate(2 ${fx(X(px))} ${fx(Y(pv))})"/>`
    for (let l = 0; l < 4; l++) {
      s += `<line x1="${fx(X(px) + 4)}" y1="${fx(Y(pv) + h * 0.055 + l * h * 0.05)}" x2="${fx(X(px) + w * 0.028)}" y2="${fx(Y(pv) + h * 0.055 + l * h * 0.05)}" stroke="${DUSK.ink}" stroke-width="1.4" opacity="0.45"/>`
    }
  }
  // (the round-3 road shadow on the wall face is gone with the aperture: a solid
  // gate throws light OUT, it does not spill a shadow onto its own masonry)
  // a bill-posted notice pair (the yard wall is where routes are posted), each
  // under its own reading lamp — the only parchment the night register allows
  for (const [px, pv] of [[0.2, 0.4], [0.62, 0.36]]) {
    s += `<ellipse cx="${fx(X(px) + w * 0.018)}" cy="${fx(Y(pv) + h * 0.15)}" rx="${fx(w * 0.05)}" ry="${fx(h * 0.34)}" fill="url(#rookHalo)" opacity="0.62"/>`
    s += `<rect x="${fx(X(px))}" y="${fx(Y(pv))}" width="${fx(w * 0.035)}" height="${fx(h * 0.3)}" fill="${DUSK.parch}" opacity="0.95" transform="rotate(-2 ${fx(X(px))} ${fx(Y(pv))})"/>`
    for (let l = 0; l < 4; l++) {
      s += `<line x1="${fx(X(px) + 4)}" y1="${fx(Y(pv) + h * 0.06 + l * h * 0.055)}" x2="${fx(X(px) + w * 0.03)}" y2="${fx(Y(pv) + h * 0.06 + l * h * 0.055)}" stroke="${DUSK.ink}" stroke-width="1.4" opacity="0.45"/>`
    }
  }
  // the wall's own night grade: coping dark, base warmed by the yard's pools
  s += `<rect width="${w}" height="${h}" fill="url(#fringeNight)"/>`
  s += `<rect x="0" y="${fx(h * 0.86)}" width="${w}" height="${fx(h * 0.14)}" fill="${DUSK.ink}" opacity="0.26"/>`
  s += `</g>`
  // S4-7: the crest rim is HALVED. At 860 screen px the round-3 weight put a
  // 3.6px cream core on a silhouette that was 68% birds, and the sum of those two
  // decisions is the lace. With architecture back in the crest the rim can do its
  // real job — saying "this edge is cut paper" along the merlons — at a weight
  // that does not out-draw the birds it also traces.
  s += rookRim(wallD, 2.6)
  s += rookRim(notchD, 3)
  s += `</g>`

  const defs =
    `<clipPath id="fringeCut"><path d="${wallD}"/></clipPath>` +
    `<radialGradient id="rookGlow" cx="0.5" cy="0.62" r="0.8">` +
    `<stop offset="0" stop-color="${DUSK.amberLit}"/><stop offset="0.5" stop-color="${DUSK.amber}"/>` +
    `<stop offset="1" stop-color="${DUSK.amberDeep}"/></radialGradient>` +
    `<radialGradient id="rookHalo" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${DUSK.amberLit}" stop-opacity="0.72"/>` +
    `<stop offset="0.22" stop-color="${DUSK.amber}" stop-opacity="0.34"/>` +
    `<stop offset="0.52" stop-color="${DUSK.amber}" stop-opacity="0.12"/>` +
    `<stop offset="0.78" stop-color="${DUSK.amber}" stop-opacity="0.03"/>` +
    `<stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="fringeNight" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${DUSK.ink}" stop-opacity="0.34"/>` +
    `<stop offset="0.5" stop-color="${DUSK.ink}" stop-opacity="0.06"/>` +
    `<stop offset="1" stop-color="${DUSK.ink}" stop-opacity="0"/></linearGradient>`
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
  // ---- ROUND 2, DISPATCH HOUR. Round 1 painted this page in walnut on
  // parchment, and since the page print is by far the largest surface on the
  // spread that one choice is what made s4 the daylit page of the book. The
  // whole print inverts: the ground is night, and everything that used to be
  // drawn DARK on a light page is now drawn LIGHT on a dark one — joints,
  // kerbs, paving, cobbles. Only two things stay dark, and they are the two
  // things that should: the wheeling ravens, and the gutter.
  const NIGHT = '#1e2733' // the bare yard at dusk
  const NIGHT_DEEP = '#141b24' // the vignette and the far corners
  const STONE = '#5d6a7c' // paving that catches the lamplight, cool
  const JOINT = '#96866a' // a joint or a kerb picked out by the lamps, warm
  const ROADBED = '#514738' // wet cobble, warm and dark but never ink
  const COBBLE_LIT = '#c4b691' // a stone crown catching a lamp: warm GREY, not gold
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
  s += `<rect width="${w}" height="${h}" fill="${NIGHT}"/>`
  // ---- THE STORM-GLOW BAND. The far edge of the page is what the reader sees
  // ABOVE and BEHIND the rear rim of dovecotes, so it is the spread's sky: a
  // bruised band of last light under the storm, warm at the horizon and going
  // blue-black upward. It is also the only field on the page bright enough to
  // silhouette a bird against, which is what finally makes the flock visible.
  s += `<rect width="${w}" height="${fx(h * 0.34)}" fill="url(#pageGlow)"/>`
  // laid-paper tooth — light on a dark ground now, or it prints as nothing
  for (let i = 0; i < 170; i++) {
    const y = rr(r, 0, h)
    s += `<line x1="0" y1="${fx(y)}" x2="${w}" y2="${fx(y)}" stroke="${JOINT}" stroke-width="1" opacity="${op(rr(r, 0.02, 0.045))}"/>`
  }

  // ---- THE RADIAL STATIONS: eye-review r1 KILLED these. Five dashed arcs
  // across the yard read at the pinned camera as sewing guides, not
  // architecture, and the plaza's far kerb below now states the ring's
  // recession properly. Nothing replaces them; the bare yard behind the plaza
  // is the point (the rookery's ground only becomes paved at the court).
  // the gutter: a soft valley shadow down the spine
  s += `<rect x="${fx(w * 0.46)}" y="0" width="${fx(w * 0.08)}" height="${h}" fill="url(#pageGutter)"/>`

  // ---- THE PAVED DISPATCH YARD (was "the court / plaza").
  //
  // WAVE-2 RE-DERIVATION (S4-6). A blind reader named this the biggest single
  // shape on the page and could not say what it was: "Road? river? paper
  // texture? It is one of the biggest single shapes on the page and I cannot name
  // it." The cause is not its texture, it is its GEOMETRY — and the old comment
  // here says so out loud: "ONE continuous radial apron that all nine dovecote
  // facades stand on... its outer arc passes through BOTH ring-MID arm feet
  // (x 0.19 and 0.81 at y 0.58)".
  //
  // Every one of those nine facades was retired in round 4, along with both
  // ring-MID arms, the gatehouse tower and the ring-FRONT gate wall. The band was
  // the FOOTPRINT OF A COMPOSITION THAT NO LONGER STANDS ON IT — a yard shaped
  // around buildings the reader cannot see. No amount of retuning its hatch
  // weight could ever have named it.
  //
  // So it is re-cut for the seven pieces that DO stand here, their feet derived
  // through this file's own pageFX/pageFY:
  //     the crooked tower   image x 0.187..0.317 at y 0.700
  //     the terraced roosts           0.683..0.817    y 0.627
  //     the keep's front cap          0.326..0.674    y 0.727
  //     the winch's disc              0.217..0.330    y 0.713..0.887
  //     the sorting dial              0.713..0.809    y 0.667..0.813
  // and it is COMMITTED TO as one nameable thing: a paved yard, radiating from
  // the keep's gate, with a lamplit kerb a reader can point at.
  //
  // That last part reverses an earlier call, deliberately. Round 2 removed the
  // continuous kerb because "a reader must never be able to point at where the
  // ground ends" — and the price of that rule was a shape nobody could name. The
  // kerb comes back, but as LIGHT rather than as outline: a warm lamplit line
  // where the yard's edge catches the lamps, which is how a real kerb announces
  // itself at night, instead of the pale hairline that made it a sticker.
  const GX = 0.5
  const GY = 0.735
  // The far arc now passes just UPSTAGE of the real feet — the tower's on the
  // left, the roosts' on the right — and bows up behind the keep so the keep
  // stands on the yard too rather than behind its edge.
  const PLAZA_FAR =
    `M ${fx(PX(0.03))} ${fx(PY(0.86))} ` +
    `C ${fx(PX(0.09))} ${fx(PY(0.78))} ${fx(PX(0.15))} ${fx(PY(0.735))} ${fx(PX(0.187))} ${fx(PY(0.712))} ` +
    `C ${fx(PX(0.26))} ${fx(PY(0.664))} ${fx(PX(0.33))} ${fx(PY(0.606))} ${fx(PX(0.5))} ${fx(PY(0.594))} ` +
    `C ${fx(PX(0.63))} ${fx(PY(0.585))} ${fx(PX(0.7))} ${fx(PY(0.604))} ${fx(PX(0.817))} ${fx(PY(0.638))} ` +
    `C ${fx(PX(0.88))} ${fx(PY(0.656))} ${fx(PX(0.93))} ${fx(PY(0.7))} ${fx(PX(0.985))} ${fx(PY(0.78))}`
  const PLAZA_D = `${PLAZA_FAR} L ${fx(PX(1.03))} ${fx(PY(1.06))} L ${fx(PX(-0.03))} ${fx(PY(1.06))} Z`
  const pol = (th, rho) => [GX + Math.cos(th) * rho * 0.47, GY - Math.sin(th) * rho * 0.31]
  s += `<g clip-path="url(#plazaCut)">`
  s += `<path d="${PLAZA_D}" fill="url(#plazaFill)"/>`
  s += `<path d="${PLAZA_D}" fill="url(#plazaShade)" opacity="0.55"/>`
  // FLAGSTONE COURSES radiating from the gate. Round 2 drew these as broken
  // dashes at opacity 0.05-0.10 to avoid "a wireframe", and at that weight they
  // are simply not there: a reader sees an undifferentiated wash, which is half of
  // why the shape is unnameable. They are now real paving — CONTINUOUS concentric
  // courses at a coarser pitch, crossed by continuous radial joints, at a weight
  // that reads (0.13-0.22). What keeps it from being a wireframe is not
  // faintness, it is that the courses BREAK where a course line would otherwise
  // run through a building's foot, and that every joint is a warm stone joint
  // rather than a drafting line.
  for (let k = 0; k < 26; k++) {
    const th = (k / 26) * Math.PI * 2 + 0.07
    const [ax, ay] = pol(th, 0.24)
    const [bx2, by2] = pol(th, 1.5)
    s += `<line x1="${fx(PX(ax))}" y1="${fx(PY(ay))}" x2="${fx(PX(bx2))}" y2="${fx(PY(by2))}" stroke="${JOINT}" stroke-width="1.6" opacity="${op(rr(r, 0.13, 0.2))}"/>`
  }
  for (const rho of [0.34, 0.6, 0.88, 1.18, 1.5]) {
    const pts = []
    for (let k = 0; k <= 96; k++) pts.push(pol((k / 96) * Math.PI * 2, rho * rr(r, 0.995, 1.005)))
    s += `<path d="${poly(pts)}" fill="none" stroke="${JOINT}" stroke-width="1.8" opacity="${op(rr(r, 0.16, 0.22))}"/>`
  }
  // a few stones catching the lamps outright, so the paving has grain as well as
  // pattern (the difference between "paved" and "ruled")
  for (let k = 0; k < 90; k++) {
    const th = rr(r, 0, Math.PI * 2)
    const rho = rr(r, 0.3, 1.45)
    const [sx2, sy2] = pol(th, rho)
    s += `<ellipse cx="${fx(PX(sx2))}" cy="${fx(PY(sy2))}" rx="${fx(PX(rr(r, 0.006, 0.014)))}" ry="${fx(PY(rr(r, 0.004, 0.008)))}" fill="${COBBLE_LIT}" opacity="${op(rr(r, 0.05, 0.13))}"/>`
  }
  s += `</g>`
  // THE LAMPLIT KERB — the yard's edge, stated as light. One warm stroke along the
  // far arc, brightest in the middle where the keep's own gate lamps reach it and
  // fading out at both ends so it never closes into an outline.
  s += `<path d="${PLAZA_FAR}" fill="none" stroke="${COBBLE_LIT}" stroke-width="4.5" opacity="0.3" stroke-linecap="round"/>`
  s += `<path d="${PLAZA_FAR}" fill="none" stroke="${DUSK.amberLit}" stroke-width="2" opacity="0.22" stroke-linecap="round"/>`

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
  // WAVE-2: re-pointed at the feet that exist. All four old entries named retired
  // pieces, so every spur was a striped quad joining nothing to nothing.
  const SPURS = [
    [0.252, 0.7, 0.04], // the crooked tower's foot (0.187-0.317)
    [0.75, 0.627, 0.04], // the terraced roosts' foot (0.683-0.817)
    [0.274, 0.8, 0.03], // the winch disc's station (0.217-0.330)
    [0.761, 0.74, 0.028], // the sorting dial's station (0.713-0.809)
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
    s += `<path d="${d}" fill="${STONE}" opacity="0.18"/>`
    for (let k = 1; k <= 2; k++) {
      const t = k / 3
      const cxs = lerp(sfx, ex, t)
      const hwT = lerp(hwF, hwE, t)
      s += `<line x1="${fx(PX(cxs - hwT))}" y1="${fx(PY(lerp(sfy, ey, t)))}" x2="${fx(PX(cxs + hwT))}" y2="${fx(PY(lerp(sfy, ey, t)))}" stroke="${JOINT}" stroke-width="1.5" opacity="0.24"/>`
    }
  }

  // ---- LAMPLIGHT POOLS. Eye-review r1: these were scattered by a generic
  // radial sweep and came out near-invisible. They are now REGISTERED to where
  // the lit portals actually stand on the page (the pack's footprint table) and
  // graded — brightest under the two ring-MID arms and the gatehouse, dim at
  // the back — so the light itself carries the ring's sweep.
  // At dispatch hour they are the page's SUBJECT, not a garnish: bigger, hotter,
  // and joined by the two that anchor the machines — the sorting desk's own lamp
  // (hub 0.60, 0.36 on the right page) and the winch's (hub 0.50, 0.30 on the
  // left), so both readers' handles sit in a warm island rather than on cold
  // ground. Positions are the layer hubs mapped through pageFX/pageFY.
  // WAVE-2: seven of the eleven pools were registered to retired ranks (y 0.586 /
  // 0.4 / 0.254 / 0.16), so most of the page's light fell where nothing stands and
  // the two machines' own lamps had drifted off their hubs. Re-registered to the
  // seven live layers' feet, graded by depth as before.
  const POOLS = [
    { x0: 0.187, x1: 0.317, y: 0.7, n: 3, rx: 0.05, ry: 0.032, o: 1 }, // the crooked tower's foot
    { x0: 0.683, x1: 0.817, y: 0.627, n: 3, rx: 0.048, ry: 0.03, o: 0.92 }, // the terraced roosts' foot
    { x0: 0.42, x1: 0.58, y: 0.727, n: 2, rx: 0.055, ry: 0.034, o: 1 }, // the keep's lit gate
    { x0: 0.713, x1: 0.809, y: 0.74, n: 2, rx: 0.06, ry: 0.038, o: 0.88 }, // the SORTING DIAL's lamp
    { x0: 0.217, x1: 0.33, y: 0.8, n: 2, rx: 0.058, ry: 0.038, o: 0.8 }, // the WINCH corner's lamp
    { x0: 0.63, x1: 0.7, y: 0.94, n: 1, rx: 0.05, ry: 0.026, o: 0.85 }, // the yard wall's GATE (fringe u 0.84)
    { x0: 0.83, x1: 0.97, y: 0.82, n: 3, rx: 0.05, ry: 0.03, o: 0.82 }, // the landing field's posts
    { x0: 0.3, x1: 0.46, y: 0.44, n: 2, rx: 0.03, ry: 0.016, o: 0.34 }, // painted far roofs, left
    { x0: 0.56, x1: 0.72, y: 0.42, n: 2, rx: 0.03, ry: 0.016, o: 0.34 }, // painted far roofs, right
    { x0: 0.82, x1: 0.98, y: 0.4, n: 3, rx: 0.024, ry: 0.013, o: 0.26 }, // the far landing sheds
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
      s += `<path d="${d}" fill="none" stroke="${JOINT}" stroke-width="1.4" opacity="${op(rr(r, 0.04, 0.08))}"/>`
    }
  }
  s += `</g>`

  // ---- THE LANDING FIELD (S4-6, the void on the right).
  //
  // The reader's measurement: "Between the roost tower and the caption card there
  // is nothing but a flat dark-grey plane and a tan hatched band — roughly a third
  // of the spread's area carrying zero content. The composition is all crammed
  // left of centre."
  //
  // The roosts cannot simply grow into it: a page-rooted ribbon's real-time
  // rotation radius is capped at hypot(F + w, h*sin(stand)) <= 0.752 and the
  // roosts already sit at F + w = 0.73, so widening them by even 0.02 puts the
  // outboard corner past the cap. What CAN fill it is what the scene says is
  // there — the ground the ravens land on. So the right page's outboard strip
  // (image x 0.82..0.99) becomes the landing field: route-marker posts with lit
  // heads, a rank of birds standing ON the paving, stacked letter crates, cart
  // ruts running up to the roosts' foot, and a receding line of low landing sheds
  // painted on the far band so the sky above it is not empty either.
  //
  // It is print, not paper — this lane is not adding a mechanism to fix a
  // composition. But print that names what the ground is beats a grey plane, and
  // the caption card covers the outer half of this strip anyway.
  /** A raven standing ON the ground: body, head, tail, at image scale. */
  const groundRaven = (cu, cv, sz, flip) => {
    const bx = PX(cu)
    const by = PY(cv)
    const rx = PX(sz)
    const ry = PY(sz * 1.15)
    const dir = flip ? -1 : 1
    let g = `<ellipse cx="${fx(bx)}" cy="${fx(by - ry)}" rx="${fx(rx)}" ry="${fx(ry * 0.78)}" fill="${DUSK.ink}" opacity="0.92"/>`
    g += `<path d="M ${fx(bx + dir * rx * 0.4)} ${fx(by - ry * 1.1)} L ${fx(bx + dir * rx * 2.1)} ${fx(by - ry * 0.1)} L ${fx(bx + dir * rx * 0.3)} ${fx(by - ry * 0.2)} Z" fill="${DUSK.ink}" opacity="0.92"/>`
    g += `<circle cx="${fx(bx - dir * rx * 0.8)}" cy="${fx(by - ry * 1.7)}" r="${fx(rx * 0.44)}" fill="${DUSK.ink}" opacity="0.92"/>`
    g += `<path d="M ${fx(bx - dir * rx * 1.15)} ${fx(by - ry * 1.72)} L ${fx(bx - dir * rx * 1.95)} ${fx(by - ry * 1.5)} L ${fx(bx - dir * rx * 1.1)} ${fx(by - ry * 1.42)} Z" fill="${DUSK.ink}" opacity="0.92"/>`
    // two legs, so it is standing on the yard rather than floating over it
    for (const lo of [-0.3, 0.3]) {
      g += `<line x1="${fx(bx + rx * lo)}" y1="${fx(by - ry * 0.5)}" x2="${fx(bx + rx * lo)}" y2="${fx(by)}" stroke="${DUSK.ink}" stroke-width="1.6" opacity="0.85"/>`
    }
    return g
  }
  s += `<g clip-path="url(#plazaCut)">`
  // cart ruts curving off the roosts' foot toward the fore edge
  for (const off of [-0.014, 0.014]) {
    s += `<path d="M ${fx(PX(0.79 + off))} ${fx(PY(0.64))} C ${fx(PX(0.86 + off))} ${fx(PY(0.74))} ${fx(PX(0.9 + off))} ${fx(PY(0.86))} ${fx(PX(0.93 + off))} ${fx(PY(1.0))}" fill="none" stroke="${ROADBED}" stroke-width="5" opacity="0.4"/>`
    s += `<path d="M ${fx(PX(0.79 + off))} ${fx(PY(0.64))} C ${fx(PX(0.86 + off))} ${fx(PY(0.74))} ${fx(PX(0.9 + off))} ${fx(PY(0.86))} ${fx(PX(0.93 + off))} ${fx(PY(1.0))}" fill="none" stroke="${COBBLE_LIT}" stroke-width="1.6" opacity="0.18"/>`
  }
  s += `</g>`
  // A LOW LANDING SHED — the field needs one built thing in it, or the posts and
  // birds read as litter on an empty plane. Painted, small, and firmly on the
  // paving: a shingled lean-to with a lit doorway and a raven on its ridge.
  {
    const su = 0.878
    const sv = 0.716
    const sw = 0.108
    const sh2 = 0.072
    const x0s = PX(su)
    const y0s = PY(sv)
    const wS = PX(sw)
    const hS = PY(sv) - PY(sv - sh2)
    s += `<ellipse cx="${fx(x0s + wS / 2)}" cy="${fx(y0s)}" rx="${fx(wS * 0.8)}" ry="${fx(hS * 0.3)}" fill="url(#pagePool)" opacity="0.7"/>`
    s += `<rect x="${fx(x0s)}" y="${fx(y0s - hS * 0.62)}" width="${fx(wS)}" height="${fx(hS * 0.62)}" fill="${DUSK.slate}" opacity="0.96"/>`
    // shingled lean-to roof, pitched away from the reader
    s += `<path d="M ${fx(x0s - wS * 0.08)} ${fx(y0s - hS * 0.6)} L ${fx(x0s + wS * 0.46)} ${fx(y0s - hS)} L ${fx(x0s + wS * 1.08)} ${fx(y0s - hS * 0.6)} Z" fill="${DUSK.slateDim}" opacity="0.96"/>`
    s += `<path d="M ${fx(x0s - wS * 0.08)} ${fx(y0s - hS * 0.6)} L ${fx(x0s + wS * 0.46)} ${fx(y0s - hS)} L ${fx(x0s + wS * 1.08)} ${fx(y0s - hS * 0.6)} Z" fill="none" stroke="${DUSK.slateLit}" stroke-width="2" opacity="0.5"/>`
    // the lit doorway: the warmest thing on the landing field
    s += `<rect x="${fx(x0s + wS * 0.34)}" y="${fx(y0s - hS * 0.5)}" width="${fx(wS * 0.28)}" height="${fx(hS * 0.5)}" fill="url(#rookGlow)"/>`
    s += `<rect x="${fx(x0s + wS * 0.4)}" y="${fx(y0s - hS * 0.42)}" width="${fx(wS * 0.16)}" height="${fx(hS * 0.42)}" fill="${DUSK.amberCore}" opacity="0.85"/>`
    // two shuttered roost hatches either side of the door
    for (const hu of [0.1, 0.72]) {
      s += `<rect x="${fx(x0s + wS * hu)}" y="${fx(y0s - hS * 0.46)}" width="${fx(wS * 0.16)}" height="${fx(hS * 0.2)}" fill="${DUSK.amberDeep}" opacity="0.9"/>`
      s += `<rect x="${fx(x0s + wS * hu)}" y="${fx(y0s - hS * 0.46)}" width="${fx(wS * 0.16)}" height="${fx(Math.max(2, hS * 0.05))}" fill="${DUSK.parchDim}" opacity="0.6"/>`
    }
    s += groundRaven(su + sw * 0.46, sv - sh2 * 1.0, 0.014, false)
  }
  // three route-marker posts, each a lit head over a painted board. Sizes doubled
  // from the first pass: at 1x the field's marks came out as a scatter of specks,
  // which reads as noise on a grey plane rather than as a place.
  for (const [mu, mv, ms] of [[0.836, 0.665, 0.05], [0.912, 0.812, 0.062], [0.958, 0.93, 0.07]]) {
    s += `<ellipse cx="${fx(PX(mu))}" cy="${fx(PY(mv))}" rx="${fx(PX(ms * 1.5))}" ry="${fx(PY(ms * 0.8))}" fill="url(#pagePool)" opacity="0.6"/>`
    s += `<rect x="${fx(PX(mu) - 2)}" y="${fx(PY(mv - ms * 2.1))}" width="4" height="${fx(PY(mv) - PY(mv - ms * 2.1))}" fill="${DUSK.slateDeep}" opacity="0.9"/>`
    s += `<rect x="${fx(PX(mu - ms * 0.5))}" y="${fx(PY(mv - ms * 1.5))}" width="${fx(PX(ms))}" height="${fx(PY(mv) - PY(mv - ms * 0.42))}" fill="${DUSK.parchDim}" opacity="0.8"/>`
    s += `<rect x="${fx(PX(mu - ms * 0.26))}" y="${fx(PY(mv - ms * 2.3))}" width="${fx(PX(ms * 0.52))}" height="${fx(PY(mv) - PY(mv - ms * 0.34))}" fill="${DUSK.amberCore}" opacity="0.9"/>`
  }
  // the standing rank: the ravens that have already landed
  for (const [gu, gv, gs, gf] of [
    [0.836, 0.79, 0.015, false], [0.868, 0.806, 0.016, false], [0.898, 0.786, 0.014, true],
    [0.934, 0.816, 0.017, false], [0.966, 0.834, 0.018, true],
    [0.856, 0.902, 0.021, false], [0.9, 0.928, 0.023, true], [0.948, 0.958, 0.025, false],
  ]) {
    s += groundRaven(gu, gv, gs, gf)
  }
  // stacked letter crates by the near post
  for (const [cu2, cv2, cw2, ch2] of [[0.816, 0.878, 0.042, 0.03], [0.822, 0.912, 0.036, 0.026], [0.86, 0.958, 0.046, 0.034]]) {
    const x0c = PX(cu2)
    const y0c = PY(cv2)
    const wc = PX(cw2)
    const hc = PY(cv2) - PY(cv2 - ch2)
    s += `<rect x="${fx(x0c)}" y="${fx(y0c - hc)}" width="${fx(wc)}" height="${fx(hc)}" fill="${LEATHER_DIM}" opacity="0.85"/>`
    s += `<rect x="${fx(x0c)}" y="${fx(y0c - hc)}" width="${fx(wc)}" height="${fx(Math.max(2, hc * 0.22))}" fill="${LEATHER_LIT}" opacity="0.5"/>`
    s += `<line x1="${fx(x0c)}" y1="${fx(y0c - hc)}" x2="${fx(x0c + wc)}" y2="${fx(y0c)}" stroke="${JOINT}" stroke-width="1.4" opacity="0.4"/>`
  }
  // the far landing sheds: a receding roofline on the storm band, dim lit slits,
  // so the sky over the landing field carries recession instead of nothing
  for (let k = 0; k < 7; k++) {
    const su = 0.8 + k * 0.029
    const sh = 0.026 - k * 0.0018
    const y0s = PY(0.44)
    s += `<path d="M ${fx(PX(su))} ${fx(y0s)} L ${fx(PX(su))} ${fx(y0s - PY(0.44) + PY(0.44 - sh))} L ${fx(PX(su + 0.014))} ${fx(y0s - PY(0.44) + PY(0.44 - sh * 1.35))} L ${fx(PX(su + 0.028))} ${fx(y0s - PY(0.44) + PY(0.44 - sh))} L ${fx(PX(su + 0.028))} ${fx(y0s)} Z" fill="${DUSK.slateDim}" opacity="${op(0.5 - k * 0.05)}"/>`
    s += `<rect x="${fx(PX(su + 0.009))}" y="${fx(y0s - (PY(0.44) - PY(0.44 - sh * 0.55)))}" width="${fx(PX(0.007))}" height="${fx(Math.max(2, (PY(0.44) - PY(0.44 - sh * 0.3))))}" fill="${DUSK.amberLit}" opacity="${op(0.5 - k * 0.055)}"/>`
  }

  // ---- THE POST-ROAD, NOW A LAMPLIT RIBBON. Round 1 read the road correctly as
  // "the strongest value contrast on the page" and delivered it as a DARK band
  // on cream. On a night page that logic inverts: the road is the one stretch of
  // ground the lamps actually reach, so it is the LIGHTEST thing on the floor —
  // a warm wet ribbon running from the apron to the gate, with the dark notes
  // kept for its gutters. Same centreline, same registration, opposite value.
  const [edgeL, edgeR] = edgesAt(1)
  const [gutL, gutR] = edgesAt(0.84)
  const [kerbL, kerbR] = edgesAt(1.14)
  const bandD = `${poly(edgeL)} L ${[...edgeR].reverse().map(([a, b]) => `${fx(PX(a))} ${fx(PY(b))}`).join(' L ')} Z`
  // the light the road throws into the yard on either side of it
  s += `<path d="${bandD}" transform="translate(0 ${fx(-h * 0.004)})" fill="${DUSK.amber}" opacity="0.1" stroke="${DUSK.amber}" stroke-width="${fx(h * 0.05)}" stroke-opacity="0.07" stroke-linejoin="round"/>`
  // kerb stones first, so the bed is drawn over their inner halves
  s += `<path d="${poly(kerbL)}" fill="none" stroke="${JOINT}" stroke-width="4.5" opacity="0.42"/>`
  s += `<path d="${poly(kerbR)}" fill="none" stroke="${COBBLE_LIT}" stroke-width="5" opacity="0.5"/>`
  s += `<path d="${bandD}" fill="${ROADBED}" opacity="0.99"/>`
  s += `<path d="${bandD}" fill="url(#roadShade)"/>`
  s += `<g clip-path="url(#roadCut)">`
  // cobble courses drawn as SCALLOPED JOINTS across the road — the painted-road
  // convention. (Filled stone ellipses with lit crowns turned the bed into a
  // rubber mat of studs, so the stones are described by their joints instead.)
  const rows = 38
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
      s += scallop(0, '#221a10', 1.8, rr(r, 0.5, 0.72))
      if (r() < 0.7) s += scallop(-1.8, COBBLE_LIT, 1.4, (0.1 + glow * 0.2) * rr(r, 0.7, 1.3))
    }
  }
  // the LIT CROWN: the lamps run the length of the road, so its camber carries a
  // continuous warm highlight — this is the stroke that makes the road a ribbon
  s += `<path d="${poly(edgesAt(0)[0])}" fill="none" stroke="${DUSK.amber}" stroke-width="${fx(h * 0.05)}" opacity="0.12"/>`
  s += `<path d="${poly(edgesAt(0)[0])}" fill="none" stroke="${COBBLE_LIT}" stroke-width="${fx(h * 0.02)}" opacity="0.14"/>`
  // the VERGE / GUTTER: a dark channel inside each edge, the darkest note here
  s += `<path d="${poly(gutL)}" fill="none" stroke="#1c1509" stroke-width="5" opacity="0.7"/>`
  s += `<path d="${poly(gutR)}" fill="none" stroke="#1c1509" stroke-width="6.5" opacity="0.8"/>`
  s += `</g>`
  // the gate mouth the road dies into, at the spine — the road's light goes IN
  // and does not come out, which is what makes the gate read as a mouth
  s += `<ellipse cx="${fx(PX(0.5))}" cy="${fx(PY(0.737))}" rx="${fx(PX(0.026))}" ry="${fx(PY(0.024))}" fill="${DUSK.ink}" opacity="0.88"/>`
  s += `<ellipse cx="${fx(PX(0.5))}" cy="${fx(PY(0.737))}" rx="${fx(PX(0.026))}" ry="${fx(PY(0.024))}" fill="none" stroke="${DUSK.parch}" stroke-width="2.4" opacity="0.45"/>`

  // ---- the GATEHOUSE's lamplight lands ON the road (its foot at x 0.630-0.683,
  // y ~0.753, sits inside the road band), so this one pool is painted OVER the
  // cobbles: warm light on a dark wet bed, which is also what sells the road.
  s += `<ellipse cx="${fx(PX(0.6565))}" cy="${fx(PY(0.762))}" rx="${fx(PX(0.075))}" ry="${fx(PY(0.05))}" fill="url(#pagePool)" opacity="0.78"/>`
  s += `<ellipse cx="${fx(PX(0.6565))}" cy="${fx(PY(0.752))}" rx="${fx(PX(0.038))}" ry="${fx(PY(0.021))}" fill="url(#pagePool)" opacity="0.9"/>`

  // ---- THE WHEELING FLOCK. Two rounds of eye-review called these invisible and
  // two rounds of fixes made them slightly less invisible, because the problem
  // was never their opacity — it was that a dark bird on a cream page has almost
  // no value contrast to spend, and everything else on the page wanted the same
  // range. The night register solves it: the gyres are now pitched HIGH on the
  // page, where they cross the storm-glow band, and they are painted at full ink
  // against it. Birds that fall onto the dark yard below get a warm rim-light
  // from the pools instead, so the flock reads the whole depth of the spread.
  // Both gyres ride HIGH, where the glow band is. A low gyre was tried and cut:
  // it put its birds down on the ring-mid arms' own lamplight pools — which is
  // exactly where the 3D facades stand — so the page was painting birds
  // underneath the scenery.
  for (const [side, gz, gr, n] of [['left', -0.46, 0.62, 17], ['right', -0.52, 0.66, 18]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rr(r, -0.3, 0.3)
      const rad = rr(r, 0.35, 1) * gr
      const radial = clampNum(0.5 + Math.cos(a) * rad * 0.62, 0.06, PAGE_W_U * 0.99)
      const z = clampNum(gz + Math.sin(a) * rad * 0.44, -0.74, 0.5)
      const near = pageFY(z) // 0 far, 1 at the reader
      const S = w * (0.012 + near * 0.03) * rr(r, 0.85, 1.15)
      const px2 = PX(pageFX(radial, side))
      const py2 = PY(pageFY(z))
      const rot = rr(r, -60, 60)
      // against the glow band (the top ~45% of the page) a bird is a hard black
      // cut-out; lower down it is a softer shape lifted by a lamplit edge
      const onGlow = near < 0.46
      if (!onGlow) {
        s += `<g transform="translate(${fx(px2 + S * 0.06)} ${fx(py2 + S * 0.06)}) rotate(${fx(rot)})" opacity="${op(0.4 * rr(r, 0.8, 1.1))}">${miniRaven(S * 1.06, DUSK.amber, DUSK.amber)}</g>`
      }
      s += `<g transform="translate(${fx(px2)} ${fx(py2)}) rotate(${fx(rot)})" opacity="${op((onGlow ? 0.86 : 0.7) * rr(r, 0.9, 1.06))}">${miniRaven(S, DUSK.ink, DUSK.ink)}</g>`
    }
  }
  // a vignette so the spread sits in its gutter
  s += `<rect width="${w}" height="${h}" fill="url(#pageVig)"/>`
  s += `</g>`

  const defs =
    `<clipPath id="roadCut"><path d="${bandD}"/></clipPath>` +
    `<clipPath id="plazaCut"><path d="${PLAZA_D}"/></clipPath>` +
    // The plaza is the one stretch of ground the ring's lamps reach, so at night
    // it sits a step ABOVE the bare yard — the exact inversion of the daylight
    // rule (where paving had to stay darker than the parchment or it read as a
    // pale sticker). Warm at the gate, cooling as it runs back to the far arc.
    // The paving itself never gets a drawn boundary: it is a wash that is
    // strongest under the reader and dies out before the far arc, so nobody can
    // point at where the ground ends (the round-1 "grey tray" law, kept).
    `<radialGradient id="plazaFill" cx="0.5" cy="0.95" r="0.9">` +
    `<stop offset="0" stop-color="${STONE}" stop-opacity="0.3"/>` +
    `<stop offset="0.5" stop-color="${STONE}" stop-opacity="0.16"/>` +
    `<stop offset="0.84" stop-color="${STONE}" stop-opacity="0.04"/>` +
    `<stop offset="1" stop-color="${STONE}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="plazaShade" cx="0.5" cy="0.78" r="0.75">` +
    `<stop offset="0" stop-color="${DUSK.amber}" stop-opacity="0.2"/>` +
    `<stop offset="0.45" stop-color="${DUSK.amber}" stop-opacity="0.07"/>` +
    `<stop offset="1" stop-color="${NIGHT_DEEP}" stop-opacity="0.4"/></radialGradient>` +
    // THE STORM-GLOW: blue-black at the very top, bruised amber at the horizon
    // where the last light sits under the cloud, dissolving into the yard. Its
    // peak is pitched ABOVE the rear rim's own footprint (y ~0.16) so the rear
    // lamplight pools read as distant lamps standing under it, not as lights
    // floating in the sky.
    `<linearGradient id="pageGlow" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#1a2331" stop-opacity="0.92"/>` +
    `<stop offset="0.18" stop-color="#3a3f4a" stop-opacity="0.78"/>` +
    `<stop offset="0.34" stop-color="#7e6146" stop-opacity="0.8"/>` +
    `<stop offset="0.5" stop-color="#a5754a" stop-opacity="0.6"/>` +
    `<stop offset="0.76" stop-color="#5c5344" stop-opacity="0.24"/>` +
    `<stop offset="1" stop-color="${NIGHT}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="pageGutter" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${NIGHT_DEEP}" stop-opacity="0"/>` +
    `<stop offset="0.5" stop-color="${NIGHT_DEEP}" stop-opacity="0.55"/>` +
    `<stop offset="1" stop-color="${NIGHT_DEEP}" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="pagePool" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${DUSK.amberCore}" stop-opacity="0.8"/>` +
    `<stop offset="0.18" stop-color="${DUSK.amberLit}" stop-opacity="0.5"/>` +
    `<stop offset="0.44" stop-color="${DUSK.amber}" stop-opacity="0.24"/>` +
    `<stop offset="0.74" stop-color="${DUSK.amber}" stop-opacity="0.08"/>` +
    `<stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0"/></radialGradient>` +
    // the bed darkens toward the reader's apron and lifts toward the gate, so
    // the ribbon reads as running AWAY into the light rather than lying still
    `<linearGradient id="roadShade" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${DUSK.amber}" stop-opacity="0.2"/>` +
    `<stop offset="0.5" stop-color="${DUSK.amber}" stop-opacity="0.06"/>` +
    `<stop offset="1" stop-color="${NIGHT_DEEP}" stop-opacity="0.34"/></linearGradient>` +
    `<radialGradient id="pageVig" cx="0.5" cy="0.62" r="0.78">` +
    `<stop offset="0.42" stop-color="${NIGHT_DEEP}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${NIGHT_DEEP}" stop-opacity="0.62"/></radialGradient>`

  return svgPiece(w, h, s, defs)
}

// ============================================================================
// E3 s4 WAVE-2 — THE TOWER-HOIST WINCH AND ITS DISPATCH DESK
// (ch3-keep-winch-{disc,mast,semaphore,iris,counterweight}, ch3-keep-balcony).
//
// Six pieces that arrived in E1 as hand-delivered PNG placeholders and were
// never painted: prepare-art had been feeding them out of public/labs/storybook/
// art-src/, a directory that no longer exists, so its pass over them had quietly
// become a no-op and the webps on disk WERE the placeholders. A blind first-time
// reader cranked the winch and named the damage exactly. The DISPATCH BOARDS —
// the object the chapter's own narration is about ("he was set over the great
// dispatch boards") — read as "four featureless grey slabs poking out of a roof
// ... at 1x they read as construction scaffolding". The DISPATCH DESK, the
// narrative centrepiece, read as "a gold crescent with a white smear in it". And
// the wheel the whole machine hangs off "carries no label of any kind", so the
// discovery of the one interactive object on the spread was "pure luck".
//
// Both art verdicts are the same failure twice: the pieces were composed for a
// 3x inspection and the reader is on a normal monitor. So the rule these six are
// painted to is 1x FIRST — fewer objects, bigger, separated by VALUE rather than
// by line, because a downscale keeps value and throws linework away. Each piece
// below was baked, resampled to the screen size its own mesh projects, and
// LOOKED AT before it shipped; where a detail could not survive that it was
// enlarged or deleted rather than kept for the inspector.
//
// *** THE UV CONTRACTS ***
// Derived from popup-keepwinch.ts / popup-keepstack.ts and the uv tables in the
// layers that draw them. Getting one of these backwards pins a board's route
// slips upside down, which is precisely the class of bug this block records.
//
//  ch3-keep-winch-disc — keepWinchDiscQuad, identity uvs over the corner order
//    [(-R,-R), (R,-R), (R,R), (-R,R)] in the disc's own in-plane frame. Square,
//    side 2*discR = 0.26 -> ASPECT 1.000. art-u runs along the page-fore axis,
//    art-v along the spine (+z). The disc SPINS with the reader's drag through
//    a full 368deg wind, so no rotation is privileged: everything on it is
//    either radial or struck TWICE at opposite stations.
//
//  ch3-keep-winch-mast — keepWinchMastQuad, identity uvs, corners [foot-L,
//    foot-R, head-R, head-L]. art-u runs ACROSS the post; art-v runs from the
//    FOOT (0) to the HEAD (1), and with three's default flipY art-v 1 is the
//    image TOP — so the foot collar is painted at the image BOTTOM and the
//    pulley head at the TOP. Width 2*armHalfW = 0.039 over the run baseX -
//    (mastFootX + MAST_FOOT_SEAM) = 1.05 - 0.5468 = 0.5032 -> ASPECT 0.0775.
//    (The seam ply is included on purpose: it is the quad the solver actually
//    poses, not the nominal foot station.)
//
//  ch3-keep-winch-semaphore — keepWinchSemaphoreQuad, identity uvs, corners
//    [base-(-y), base-(+y), tip-(+y), tip-(-y)]. art-v runs PIVOT (0) -> TIP
//    (1), so under flipY the pivot collar is the image BOTTOM and the flag's
//    free end the image TOP. Width 2*armHalfW = 0.039 over armLen 0.1287 ->
//    ASPECT 0.3030 (exactly 10/33, so the canvas is 200x660). art-u runs toward
//    reader-LEFT, i.e. mirrored against the screen — which is why the flag's
//    device is a symmetric bird and not lettering.
//
//  ch3-keep-winch-iris — keepWinchIrisQuads, identity uvs, corners [hinge-low,
//    hinge-high, free-high, free-low] where "low/high" are the r-stations up the
//    loft wall. So art-u runs UP THE WALL ALONG THE HINGE (image-x, left = the
//    board's world-BOTTOM rail, right = its world-TOP rail) and art-v runs OUT
//    from the hinge — flipY putting the HINGED EDGE at the image BOTTOM and the
//    free edge at the image TOP. The board is therefore painted A QUARTER TURN
//    OVER: world-up is image-RIGHT, and anything that must stand upright in the
//    world (the perched raven, the chalked legend) is drawn in a rotate(90)
//    group. Hinge span (IRIS_R_HI - IRIS_R_LO) * loft height = 0.56 * 0.18 =
//    0.1008 against bladeLen 0.10 -> ASPECT 1.008 (= 126/125, canvas 630x625).
//
//  ch3-keep-winch-counterweight — keepWinchCounterweightDeck, printed as ONE
//    image across the loft cap crease by COUNTERWEIGHT_DECK_UVS: art-u 0.5 at
//    the crease fanning to 0 on the reader-LEFT half and 1 on the right, art-v 0
//    at the block's bottom -> 1 at its top. So the crease is the image's
//    vertical centreline and the weight is painted upright. Block 2*CW_BW x
//    2*CW_BH = 0.0506 x 0.08 -> ASPECT 0.6325 (canvas 405x640).
//
//  ch3-keep-balcony — keepStackBalconyDeck + BALCONY_DECK_UVS. Each half-deck is
//    [seam-z0, seam-z1, outer-z1, outer-z0]; art-u is 0.5 at the seam fanning to
//    0 (deckL, reader LEFT) / 1 (deckR), and art-v is 1 at z0 and 0 at z1, so
//    under flipY the image TOP is the far edge against the keep facade and the
//    image BOTTOM is the front rail jutting toward the reader. A plan view, and
//    displayed with image-up as screen-up, so lettering on it reads normally.
//    THE ASPECT IS THE FULL DECK, not one half: art-u spans both halves, i.e.
//    2*halfW = 0.52 across against the z-span z1 - z0 = 0.28 deep -> ASPECT
//    1.857 (= 13/7 exactly, canvas 910x490). The call sheet's inherited "~1.7:1"
//    is WRONG — it predates the E1.5 grow of the balcony to halfW 0.26 / z
//    0.30..0.58 and was never re-derived; the row is corrected with this bake.
// ============================================================================

/** Opacity formatter for this block. `fx` rounds to one decimal, which turns
 *  every opacity under 0.05 into the string "0.0" — fine for pixels, fatal for
 *  a wash. (Same reason postRoadSpread carries its own.) */
const fxOp = (n) => Math.max(0, Math.min(1, n)).toFixed(2)

// The winch is IRONWORK where the keep is stone, so it needs two tones the DUSK
// stone ladder does not carry: cast iron reads colder and darker than DUSK.ink's
// blue-black, and a ground bevel on a casting catches the roost lamps as bare
// steel rather than as parchment. Everything else on these pieces comes out of
// DUSK / GOLD, so the winch still belongs to the rookery's palette.
const WINCH_IRON = '#151a21'
const WINCH_IRON_LIT = '#39424f'
const WINCH_BEVEL = '#8e99a6'
// And the dispatch boards are TIMBER, not slate — a board that route slips are
// pinned to is oak, and at dispatch hour the roost-glow rakes across it warm.
// Two walnut-dark browns, so the cream slips have wood to sit on instead of the
// same blue-grey the loft wall behind them is cut from.
const BOARD_OAK = '#221b12'
const BOARD_BATTEN = '#3a2e1d'

/** A PERCHED corvid, in a canonical frame: feet on the local line y=0, standing
 *  UP (-y), facing -x, overall height ~1.06*S and length ~2.0*S. Solid ink with
 *  a wing sheen and a pale eye.
 *
 *  Distinct from the two raven helpers already here, on purpose: `miniRaven` is
 *  a bird in FLIGHT (wings spread, for the dial's sigils) and `RAVEN_PROFILE` is
 *  a rank's top CONTOUR (for ravenChainTop's linked chain). Neither is a single
 *  bird standing on a rail, which is what the dispatch board needs — and needs
 *  at a size where only the silhouette survives, so this shape spends all its
 *  vocabulary on the four cues that make a corvid a corvid: a heavy wedge beak,
 *  a domed crown, a deep breast, and a long wedge tail. */
function perchedRaven(S, body = DUSK.ink, sheen = DUSK.slateLit) {
  const P = (x, y) => `${fx(S * x)} ${fx(S * y)}`
  const d =
    `M ${P(-0.9, -0.84)}` + // beak tip
    ` L ${P(-0.48, -0.95)}` + // beak root, upper mandible
    ` Q ${P(-0.24, -1.06)} ${P(-0.02, -0.97)}` + // domed crown
    ` Q ${P(0.16, -0.9)} ${P(0.34, -0.78)}` + // nape into the back
    ` Q ${P(0.66, -0.57)} ${P(0.88, -0.45)}` + // the back's long fall to the tail
    ` L ${P(1.18, -0.36)} L ${P(0.99, -0.25)}` + // upper tail vane + the notch
    ` L ${P(1.12, -0.13)} L ${P(0.7, -0.17)}` + // lower vane back to the vent
    ` Q ${P(0.34, -0.17)} ${P(0.1, -0.31)}` + // belly
    ` Q ${P(-0.16, -0.46)} ${P(-0.32, -0.67)}` + // deep breast into the throat
    ` L ${P(-0.5, -0.77)} Z` // chin, closing on the beak
  let s = ''
  // legs first, so the body prints over their tops and the bird reads as
  // standing ON the rail rather than balanced above it
  for (const lx of [0.06, 0.3]) {
    s += `<rect x="${fx(S * (lx - 0.03))}" y="${fx(-S * 0.3)}" width="${fx(S * 0.06)}" height="${fx(S * 0.3)}" fill="${body}"/>`
    s += `<rect x="${fx(S * (lx - 0.1))}" y="${fx(-S * 0.05)}" width="${fx(S * 0.2)}" height="${fx(S * 0.05)}" fill="${body}"/>`
  }
  s += `<path d="${d}" fill="${body}"/>`
  s += `<path d="M ${P(-0.02, -0.62)} Q ${P(0.36, -0.52)} ${P(0.82, -0.4)}" fill="none" stroke="${sheen}" stroke-width="${fx(Math.max(1.4, S * 0.035))}" opacity="0.5"/>`
  s += `<circle cx="${fx(-S * 0.34)}" cy="${fx(-S * 0.87)}" r="${fx(Math.max(1.2, S * 0.055))}" fill="${DUSK.amberLit}" opacity="0.9"/>`
  s += `<path d="${d}" fill="none" stroke="${DUSK.rim}" stroke-width="${fx(Math.max(1, S * 0.022))}" opacity="0.3" stroke-linejoin="round"/>`
  return s
}

/** A ROUTE SLIP pinned to a board: a cream chit at a small cant with two or
 *  three ruled ink strokes standing in for a clerk's hand and a brass pin dot at
 *  its head. `wPx`/`hPx` are the slip's own box; the cant is passed in so the
 *  caller (not the PRNG) owns the rank's rhythm. Drawn about its own centre so
 *  the rotation never walks it off the board. */
function routeSlip(cx, cy, wPx, hPx, cant, rand, sealed) {
  const x0 = -wPx / 2
  const y0 = -hPx / 2
  let s = `<g transform="translate(${fx(cx)} ${fx(cy)}) rotate(${fx(cant)})">`
  // the chit's own drop shadow — the one thing that keeps six pale rectangles
  // from flattening into one pale field when the piece is downscaled
  s += `<rect x="${fx(x0 + hPx * 0.07)}" y="${fx(y0 + hPx * 0.09)}" width="${fx(wPx)}" height="${fx(hPx)}" fill="${DUSK.ink}" opacity="0.55"/>`
  s += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(wPx)}" height="${fx(hPx)}" fill="${DUSK.parchLit}"/>`
  // a warm lower half: the roost-glow rakes the board from the hinge side, so
  // the slips are lit unevenly and read as paper rather than as white tiles
  s += `<rect x="${fx(x0)}" y="${fx(y0 + hPx * 0.52)}" width="${fx(wPx)}" height="${fx(hPx * 0.48)}" fill="${DUSK.parch}" opacity="0.85"/>`
  // ruled strokes. The slip is world-PORTRAIT (its long axis runs up the wall =
  // image x), so a clerk's lines run across it as short image-VERTICAL strokes.
  const rules = 3
  for (let i = 0; i < rules; i++) {
    const rx = x0 + wPx * (0.26 + 0.24 * i)
    const inset = hPx * (0.14 + rand() * 0.12)
    s += `<line x1="${fx(rx)}" y1="${fx(y0 + inset)}" x2="${fx(rx)}" y2="${fx(y0 + hPx - inset)}" stroke="${DUSK.ink}" stroke-width="${fx(Math.max(2, wPx * 0.05))}" opacity="0.8"/>`
  }
  if (sealed) {
    // a folded, sealed chit: a wax blob over the fold, big enough to survive
    const sr = Math.min(wPx, hPx) * 0.28
    s += `<circle cx="${fx(x0 + wPx * 0.72)}" cy="${fx(y0 + hPx * 0.5)}" r="${fx(sr)}" fill="${SEAL_RED}"/>`
    s += `<circle cx="${fx(x0 + wPx * 0.68)}" cy="${fx(y0 + hPx * 0.42)}" r="${fx(sr * 0.5)}" fill="${SEAL_RED_LIT}" opacity="0.75"/>`
  }
  // the brass pin at the head of the slip
  s += `<circle cx="${fx(x0 + wPx * 0.1)}" cy="${fx(y0 + hPx * 0.5)}" r="${fx(Math.max(2.4, wPx * 0.075))}" fill="${GOLD_LIT}"/>`
  s += `<circle cx="${fx(x0 + wPx * 0.1)}" cy="${fx(y0 + hPx * 0.5)}" r="${fx(Math.max(2.4, wPx * 0.075))}" fill="none" stroke="${DUSK.ink}" stroke-width="1.4" opacity="0.7"/>`
  s += `</g>`
  return s
}

// ---- A) THE DISPATCH BOARD (`ch3-keep-winch-iris`, one board printed on all
// four shutters). The chapter's namesake object, and the payoff of the reader's
// first turn of the crank — so the ONE thing it must not read as is a plank.
// A near-square oak board (aspect 1.008) hinged on its lower image edge: iron
// hinge straps and a batten frame, SEVEN pinned route slips big enough to be
// separate chits at 1x, two of them wax-sealed, a chalked POST legend on a slate
// let into the bottom rail, and a raven a quarter of the board tall perched on
// the upper batten. Painted a quarter turn over per the UV contract above.
//
// The U-BUDGET is the whole layout, and it is tight enough to be worth writing
// down: the legend's slate takes U 0.03..0.16 (the word runs along O, so its cap
// height eats U), the pinned rank takes three columns over U 0.205..0.695, the
// perch batten sits at U 0.73 and the bird stands from there to U 0.99. Every one
// of those bands was pushed apart after a 1x bake showed a slip lying across the
// slate and the chalked word hanging off the canvas entirely. ----
function dispatchBoard(w, h, seed) {
  const r = mulberry32(seed)
  // Board space: U up the wall along the hinge (-> image x), O out from the
  // hinge (-> image y, inverted by flipY, so O=0 is the image bottom edge).
  const X = (u) => u * w
  const Y = (o) => (1 - o) * h
  // A quarter-turn group for anything that must stand upright IN THE WORLD.
  // rotate(90) maps local (x,y) -> (-y, x), so local UP (-y) lands on image +x =
  // up the wall, and the local advance (+x) runs toward the hinge. The two loft
  // walls carry mirrored outward normals, so on one of them that advance reads
  // right-to-left on screen — which is why the chalked legend is one short word
  // and never a sentence.
  const upright = (u, o) => `<g transform="translate(${fx(X(u))} ${fx(Y(o))}) rotate(90)">`

  const pad = Math.max(4, w * 0.012)
  const die = `M ${fx(pad)} ${fx(pad)} L ${fx(w - pad)} ${fx(pad)} L ${fx(w - pad)} ${fx(h - pad)} L ${fx(pad)} ${fx(h - pad)} Z`
  const fbU = w * 0.075 // batten frame width along U
  const fbO = h * 0.075 // ... and along O
  const fx0 = pad + fbU
  const fy0 = pad + fbO
  const fw = w - 2 * fx0
  const fh = h - 2 * fy0

  const defs =
    // the roost-glow rakes OUT of the loft mouth, i.e. from the hinge edge (the
    // image bottom) across the board's face and off its free edge
    `<linearGradient id="boardRake" x1="0" y1="1" x2="0.18" y2="0">` +
    `<stop offset="0" stop-color="${DUSK.amberLit}" stop-opacity="0.42"/>` +
    `<stop offset="0.42" stop-color="${DUSK.amber}" stop-opacity="0.14"/>` +
    `<stop offset="1" stop-color="${DUSK.ink}" stop-opacity="0.34"/></linearGradient>` +
    // A genuinely SOFT pool, which the transparent pieces in this chapter are not
    // allowed (see warmBloom's note: alphaTest plus the grain floor turn a wide
    // falloff into a grey disc hanging in the air). The board is an opaque plank,
    // so the reason does not apply — and the first bake proved the point from the
    // other side: warmBloom's stepped rings printed as three visible hard discs
    // on solid wood, which is exactly the sticker the helper exists to avoid.
    `<radialGradient id="boardPool" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${DUSK.amberLit}" stop-opacity="0.34"/>` +
    `<stop offset="0.4" stop-color="${DUSK.amber}" stop-opacity="0.17"/>` +
    `<stop offset="0.74" stop-color="${DUSK.amber}" stop-opacity="0.05"/>` +
    `<stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0"/></radialGradient>`

  let s = `<g>`
  // the board carcass, then the recessed field the slips are pinned into
  s += `<path d="${die}" fill="${BOARD_BATTEN}"/>`
  s += `<rect x="${fx(fx0)}" y="${fx(fy0)}" width="${fx(fw)}" height="${fx(fh)}" fill="${BOARD_OAK}"/>`
  // plank seams running out from the hinge (lines of constant O), offset from the
  // slip rows so they read as boarding rather than as shelves under the chits
  for (const o of [0.2, 0.44, 0.7, 0.9]) {
    s += `<line x1="${fx(fx0)}" y1="${fx(Y(o))}" x2="${fx(fx0 + fw)}" y2="${fx(Y(o))}" stroke="${DUSK.ink}" stroke-width="${fx(w * 0.008)}" opacity="0.7"/>`
    s += `<line x1="${fx(fx0)}" y1="${fx(Y(o) + w * 0.008)}" x2="${fx(fx0 + fw)}" y2="${fx(Y(o) + w * 0.008)}" stroke="${BOARD_BATTEN}" stroke-width="${fx(w * 0.005)}" opacity="0.6"/>`
  }
  s += `<rect x="${fx(fx0)}" y="${fx(fy0)}" width="${fx(fw)}" height="${fx(fh)}" fill="url(#boardRake)"/>`
  // two lamp pools where the roost mouth's light actually lands on the board
  for (const [pu, po, pr] of [
    [0.34, 0.08, 0.3],
    [0.86, 0.06, 0.24],
  ]) {
    s += `<ellipse cx="${fx(X(pu))}" cy="${fx(Y(po))}" rx="${fx(h * pr)}" ry="${fx(h * pr * 0.9)}" fill="url(#boardPool)"/>`
  }

  // ---- the hinge. A dark seat band along the image bottom, four iron straps
  // stepping up the hinge, each with a pintle knuckle at its root.
  s += `<rect x="${fx(pad)}" y="${fx(Y(0.055))}" width="${fx(w - 2 * pad)}" height="${fx(h * 0.055 - pad)}" fill="${WINCH_IRON}" opacity="0.9"/>`
  for (const u of [0.12, 0.4, 0.68, 0.92]) {
    const sw = w * 0.055
    const x0 = X(u) - sw / 2
    s += `<path d="M ${fx(x0)} ${fx(Y(0.0))} L ${fx(x0 + sw)} ${fx(Y(0.0))} L ${fx(x0 + sw * 0.62)} ${fx(Y(0.17))} L ${fx(x0 + sw * 0.38)} ${fx(Y(0.17))} Z" fill="${WINCH_IRON}"/>`
    s += `<line x1="${fx(x0 + sw * 0.28)}" y1="${fx(Y(0.02))}" x2="${fx(x0 + sw * 0.42)}" y2="${fx(Y(0.155))}" stroke="${WINCH_BEVEL}" stroke-width="${fx(w * 0.006)}" opacity="0.45"/>`
    s += `<circle cx="${fx(X(u))}" cy="${fx(Y(0.028))}" r="${fx(w * 0.032)}" fill="${WINCH_IRON_LIT}"/>`
    s += `<circle cx="${fx(X(u))}" cy="${fx(Y(0.028))}" r="${fx(w * 0.032)}" fill="none" stroke="${WINCH_IRON}" stroke-width="${fx(w * 0.012)}"/>`
    s += `<circle cx="${fx(X(u) - w * 0.011)}" cy="${fx(Y(0.034))}" r="${fx(w * 0.011)}" fill="${WINCH_BEVEL}" opacity="0.55"/>`
  }

  // ---- the CHALKED LEGEND, on a slate let into the board's world-BOTTOM rail.
  // The word runs along O (a chalked word reads horizontally in the WORLD, and
  // world-horizontal on this board is the out-from-hinge axis), so its cap height
  // is what costs U — and `engraveWord`'s glyphs grow along local +y, which the
  // quarter turn sends toward DECREASING U. That is why the anchor sits at the
  // TOP of the slate's U band and not at its foot: the first bake anchored at
  // U 0.035 and put every letter off the left edge of the canvas.
  const cw = h * 0.075
  const ch = w * 0.085
  const gap = h * 0.022
  const legendO = 0.21
  const legendLen = 4 * cw + 3 * gap
  const legendU = 0.16
  s += `<rect x="${fx(X(0.03))}" y="${fx(Y(legendO + legendLen / h))}" width="${fx(X(legendU) - X(0.03) + ch * 0.2)}" height="${fx(legendLen)}" fill="${DUSK.slateDim}" opacity="0.95"/>`
  s += `<rect x="${fx(X(0.03))}" y="${fx(Y(legendO + legendLen / h))}" width="${fx(X(legendU) - X(0.03) + ch * 0.2)}" height="${fx(legendLen)}" fill="none" stroke="${GOLD_DIM}" stroke-width="${fx(w * 0.008)}" opacity="0.8"/>`
  s += upright(legendU, legendO + legendLen / h)
  s += engraveWord('POST', 0, ch * 0.2 + 2.4, cw, ch, gap, DUSK.ink, Math.max(3, w * 0.014), 'opacity="0.75"')
  s += engraveWord('POST', 0, ch * 0.2, cw, ch, gap, DUSK.parchLit, Math.max(3, w * 0.013), 'opacity="0.95"')
  s += `</g>`

  // ---- the pinned rank. SEVEN slips, each ~15% of the board's short side: at the
  // ~40-56 screen px the mesh projects that is a 6-8px chit, which is the smallest
  // mark that still reads as a SEPARATE piece of paper rather than as speckle. The
  // stations are AUTHORED rather than looped, so the rank has a rhythm (two full
  // courses and one lone late slip out by the free edge) instead of a grid.
  const slipU = w * 0.15
  const slipO = h * 0.125
  const pinned = [
    [0.28, 0.3, false],
    [0.45, 0.32, false],
    [0.62, 0.29, true],
    [0.28, 0.56, true],
    [0.45, 0.54, false],
    [0.62, 0.57, false],
    [0.45, 0.81, false],
  ]
  for (const [u, o, sealed] of pinned) {
    s += routeSlip(X(u), Y(o), slipU, slipO, rr(r, -8, 8), r, sealed)
  }

  // ---- the raven. It perches on the UPPER batten and stands a quarter of the
  // board's height, which is the whole point: at 1x a bird drawn "to scale" is a
  // four-pixel smudge, and a four-pixel smudge is what the reader called
  // scaffolding. Its warm ground goes down first, so a black bird has something
  // to be black against.
  const perchU = 0.73
  s += `<rect x="${fx(X(perchU) - w * 0.02)}" y="${fx(fy0)}" width="${fx(w * 0.04)}" height="${fx(fh)}" fill="${BOARD_BATTEN}"/>`
  s += `<rect x="${fx(X(perchU) + w * 0.014)}" y="${fx(fy0)}" width="${fx(w * 0.008)}" height="${fx(fh)}" fill="${DUSK.parchDim}" opacity="0.6"/>`
  s += `<ellipse cx="${fx(X(0.86))}" cy="${fx(Y(0.56))}" rx="${fx(w * 0.2)}" ry="${fx(h * 0.3)}" fill="url(#boardPool)"/>`
  s += upright(perchU, 0.6)
  s += perchedRaven(w * 0.245)
  s += `</g>`

  // ---- the frame's own light: a lit arris on the batten toward the roost mouth
  // and an inked one on the free edge, so the board reads as a thick object.
  s += `<rect x="${fx(pad)}" y="${fx(h - pad - fbO * 0.34)}" width="${fx(w - 2 * pad)}" height="${fx(fbO * 0.34)}" fill="${DUSK.amberLit}" opacity="0.3"/>`
  s += `<rect x="${fx(pad)}" y="${fx(pad)}" width="${fx(w - 2 * pad)}" height="${fx(fbO * 0.4)}" fill="${DUSK.ink}" opacity="0.45"/>`
  s += `</g>`
  return svgPiece(w, h, s + rookRim(die, 6), defs)
}

// ---- B) THE DISPATCH DESK (`ch3-keep-balcony`), the balcony deck seen from
// above and the spread's narrative centrepiece: "the single object that says
// 'this man ran the message desk'". It projects roughly 200x110 screen px, so it
// is composed of five things and no more — a brass counter with a dark inset
// writing bed, ONE open ledger straddling the spine crease, TWO quills as long
// pale diagonals, TWO inkwells, and THREE wax-sealed letters — plus one candle
// to explain why the desk is the brightest warm island on the whole tier.
//
// The ledger's GUTTER is laid exactly ON the crease, which looks like the one
// thing the split-art rule forbids and is in fact the strongest form of obeying
// it: the two half-decks part by BALCONY_LIFT*cos(beta/2) at mid-turn, and the
// only place that hairline can appear without damage is inside a feature which
// is already a dark line. Nothing else critical crosses x = w/2. ----
function dispatchDesk(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2

  const defs =
    `<linearGradient id="deskBrass" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${GOLD_DIM}"/><stop offset="0.42" stop-color="${GOLD}"/>` +
    `<stop offset="1" stop-color="${GOLD_LIT}"/></linearGradient>` +
    `<radialGradient id="deskPool" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${DUSK.amberCore}" stop-opacity="0.5"/>` +
    `<stop offset="0.38" stop-color="${DUSK.amberLit}" stop-opacity="0.26"/>` +
    `<stop offset="0.72" stop-color="${DUSK.amber}" stop-opacity="0.1"/>` +
    `<stop offset="1" stop-color="${DUSK.amber}" stop-opacity="0"/></radialGradient>` +
    // OUTBOARD FALL-OFF. The deck is lit by the one candle standing on it, so its
    // far ends should be leaving the light — and the board capture showed it
    // reading uniformly bright right out to both tips, which is what makes a deck
    // look like a decal laid on the tier instead of a plane receding from a lamp.
    // Symmetric about the crease (each half-deck is the mirror of the other), so
    // this darkens BOTH outboard ends and leaves the middle untouched.
    // Held to 0.38 at the tips with a wide flat middle: enough to bend the plane
    // away from the lamp, not enough to mute the nameplate that sits partway out
    // on the right, or to swallow the outboard inkwell and letter.
    `<linearGradient id="deckEnds" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${DUSK.ink}" stop-opacity="0.38"/>` +
    `<stop offset="0.14" stop-color="${DUSK.ink}" stop-opacity="0.14"/>` +
    `<stop offset="0.28" stop-color="${DUSK.ink}" stop-opacity="0"/>` +
    `<stop offset="0.72" stop-color="${DUSK.ink}" stop-opacity="0"/>` +
    `<stop offset="0.86" stop-color="${DUSK.ink}" stop-opacity="0.14"/>` +
    `<stop offset="1" stop-color="${DUSK.ink}" stop-opacity="0.38"/></linearGradient>`

  // THE DECK SILHOUETTE. A die-cut, not a rectangle: the front corners are cut
  // back so the cantilever reads as a shaped counter from above, while the
  // middle of the front rail keeps its full reach toward the reader.
  const cut = w * 0.075
  const front = h * 0.995
  const back = h * 0.006
  const die =
    `M ${fx(w * 0.004)} ${fx(back)} L ${fx(w - w * 0.004)} ${fx(back)} ` +
    `L ${fx(w - w * 0.004)} ${fx(front - cut * 0.62)} L ${fx(w - cut)} ${fx(front)} ` +
    `L ${fx(cut)} ${fx(front)} L ${fx(w * 0.004)} ${fx(front - cut * 0.62)} Z`

  let s = `<g>`
  s += `<path d="${die}" fill="url(#deskBrass)"/>`
  // the shadowed strip where the deck meets the gallery facade (image top)
  s += `<rect x="0" y="${fx(back)}" width="${fx(w)}" height="${fx(h * 0.115)}" fill="${DUSK.ink}" opacity="0.62"/>`
  s += `<rect x="0" y="${fx(h * 0.115)}" width="${fx(w)}" height="${fx(h * 0.016)}" fill="${GOLD_LIT}" opacity="0.75"/>`

  // THE WRITING BED — a dark leather inset. The desk's whole legibility rests on
  // this: the reader saw "a gold crescent with a white smear", because the pale
  // ledger sat on pale brass. A dark bed under it is the contrast.
  const bx0 = w * 0.075
  const bx1 = w - bx0
  const by0 = h * 0.185
  const by1 = h * 0.775
  s += `<rect x="${fx(bx0)}" y="${fx(by0)}" width="${fx(bx1 - bx0)}" height="${fx(by1 - by0)}" rx="${fx(w * 0.012)}" fill="${DUSK.ink}"/>`
  s += `<rect x="${fx(bx0)}" y="${fx(by0)}" width="${fx(bx1 - bx0)}" height="${fx(by1 - by0)}" rx="${fx(w * 0.012)}" fill="none" stroke="${GOLD_DIM}" stroke-width="${fx(w * 0.008)}" opacity="0.9"/>`
  s += `<ellipse cx="${fx(cx)}" cy="${fx(h * 0.46)}" rx="${fx(w * 0.46)}" ry="${fx(h * 0.44)}" fill="url(#deskPool)"/>`

  // THE LEDGER. Two pages of the brightest note on the piece, a gutter on the
  // crease, five heavy rules a side, and blocky ink entries on some of them —
  // rules at real weight, because hairlines are exactly what a downscale eats.
  const lw = w * 0.42
  const lh = h * 0.44
  const lx0 = cx - lw / 2
  const ly0 = h * 0.27
  s += `<rect x="${fx(lx0 + w * 0.007)}" y="${fx(ly0 + h * 0.016)}" width="${fx(lw)}" height="${fx(lh)}" fill="#000000" opacity="0.42"/>`
  s += `<rect x="${fx(lx0)}" y="${fx(ly0)}" width="${fx(lw)}" height="${fx(lh)}" fill="${DUSK.parchLit}"/>`
  // each page falls off a little toward its outer edge, so the spread reads as
  // two leaves rising out of a gutter rather than as one flat card
  for (const side of [-1, 1]) {
    const px0 = side < 0 ? lx0 : cx
    s += `<rect x="${fx(px0)}" y="${fx(ly0)}" width="${fx(lw / 2)}" height="${fx(lh)}" fill="url(#deskPool)" opacity="0.5"/>`
    s += `<rect x="${fx(side < 0 ? lx0 : lx0 + lw * 0.9)}" y="${fx(ly0)}" width="${fx(lw * 0.1)}" height="${fx(lh)}" fill="${DUSK.parchDim}" opacity="0.5"/>`
  }
  const rules = 5
  for (let i = 0; i < rules; i++) {
    const ry = ly0 + lh * (0.18 + (0.66 * i) / (rules - 1))
    for (const side of [-1, 1]) {
      const a = side < 0 ? lx0 + lw * 0.06 : cx + lw * 0.05
      const b = side < 0 ? cx - lw * 0.05 : lx0 + lw * 0.94
      s += `<line x1="${fx(a)}" y1="${fx(ry)}" x2="${fx(b)}" y2="${fx(ry)}" stroke="${DUSK.ink}" stroke-width="${fx(h * 0.012)}" opacity="0.78"/>`
      // a clerk's entry: one blocky run of ink on most rules, its length seeded
      if (r() < 0.78) {
        const t = rr(r, 0.32, 0.74)
        s += `<line x1="${fx(a)}" y1="${fx(ry - h * 0.014)}" x2="${fx(lerp(a, b, t))}" y2="${fx(ry - h * 0.014)}" stroke="${DUSK.ink}" stroke-width="${fx(h * 0.018)}" opacity="0.9"/>`
      }
    }
    // the ruled money column, in ledger red
    for (const side of [-1, 1]) {
      const mx = side < 0 ? cx - lw * 0.12 : lx0 + lw * 0.87
      s += `<line x1="${fx(mx)}" y1="${fx(ly0 + lh * 0.1)}" x2="${fx(mx)}" y2="${fx(ly0 + lh * 0.9)}" stroke="${SEAL_RED}" stroke-width="${fx(h * 0.008)}" opacity="0.7"/>`
    }
  }
  // the gutter, ON the crease (see the header note)
  s += `<rect x="${fx(cx - lw * 0.022)}" y="${fx(ly0)}" width="${fx(lw * 0.044)}" height="${fx(lh)}" fill="${DUSK.ink}" opacity="0.62"/>`
  s += `<rect x="${fx(lx0)}" y="${fx(ly0)}" width="${fx(lw)}" height="${fx(lh)}" fill="none" stroke="${DUSK.ink}" stroke-width="${fx(h * 0.008)}" opacity="0.5"/>`

  // TWO QUILLS, drawn as what a quill IS at 1x: a long pale diagonal against a
  // dark bed. Fine barb hatching would vanish, so the vane is a filled lens and
  // the barbs are only a few heavy strokes inside it.
  const quill = (x0, y0, x1, y1) => {
    const dx = x1 - x0
    const dy = y1 - y0
    const L = Math.hypot(dx, dy)
    const ux = dx / L
    const uy = dy / L
    const px = -uy
    const py = ux
    const vw = L * 0.1 // vane half-width
    // `t` runs 0 (nib) -> 1 (feather tip) along the quill, `off` steps sideways
    // across it; `at` formats a path point and `atX/atY` give the raw numbers the
    // barb strokes need as separate attributes.
    const atX = (t, off) => x0 + ux * L * t + px * off
    const atY = (t, off) => y0 + uy * L * t + py * off
    const at = (t, off) => `${fx(atX(t, off))} ${fx(atY(t, off))}`
    let q = ''
    // the shaft, nib end at (x0,y0)
    q += `<line x1="${fx(x0)}" y1="${fx(y0)}" x2="${fx(x1)}" y2="${fx(y1)}" stroke="${DUSK.ink}" stroke-width="${fx(L * 0.055)}" opacity="0.5"/>`
    q += `<line x1="${fx(x0)}" y1="${fx(y0)}" x2="${fx(x1)}" y2="${fx(y1)}" stroke="${DUSK.parch}" stroke-width="${fx(L * 0.035)}" stroke-linecap="round"/>`
    // the vane: a lens over the outer 62% of the feather
    q += `<path d="M ${at(0.36, 0)} Q ${at(0.66, vw)} ${at(1.0, vw * 0.16)} Q ${at(0.66, -vw)} ${at(0.36, 0)} Z" fill="${DUSK.parchLit}"/>`
    q += `<path d="M ${at(0.36, 0)} Q ${at(0.66, vw)} ${at(1.0, vw * 0.16)} Q ${at(0.66, -vw)} ${at(0.36, 0)} Z" fill="none" stroke="${DUSK.parchDim}" stroke-width="${fx(L * 0.014)}" opacity="0.8"/>`
    for (const t of [0.5, 0.62, 0.74, 0.86]) {
      q += `<line x1="${fx(atX(t, -vw * 0.72))}" y1="${fx(atY(t, -vw * 0.72))}" x2="${fx(atX(t + 0.05, vw * 0.72))}" y2="${fx(atY(t + 0.05, vw * 0.72))}" stroke="${DUSK.parchDim}" stroke-width="${fx(L * 0.012)}" opacity="0.6"/>`
    }
    // the brass ferrule and a wet ink nib
    q += `<circle cx="${fx(x0 + ux * L * 0.3)}" cy="${fx(y0 + uy * L * 0.3)}" r="${fx(L * 0.035)}" fill="${GOLD_LIT}" stroke="${DUSK.ink}" stroke-width="${fx(L * 0.01)}"/>`
    q += `<circle cx="${fx(x0)}" cy="${fx(y0)}" r="${fx(L * 0.032)}" fill="${DUSK.ink}"/>`
    return q
  }
  s += quill(w * 0.115, h * 0.73, w * 0.235, h * 0.21)
  s += quill(w * 0.9, h * 0.7, w * 0.775, h * 0.24)

  // TWO INKWELLS — dark wells with a bright brass rim and one specular dot, the
  // cheapest object here that still reads at 1x because it is pure value.
  for (const [ix, iy, rad] of [
    [w * 0.135, h * 0.34, w * 0.05],
    [w * 0.865, h * 0.31, w * 0.042],
  ]) {
    s += `<circle cx="${fx(ix)}" cy="${fx(iy)}" r="${fx(rad * 1.22)}" fill="${GOLD}" opacity="0.95"/>`
    s += `<circle cx="${fx(ix)}" cy="${fx(iy)}" r="${fx(rad * 1.22)}" fill="none" stroke="${GOLD_LIT}" stroke-width="${fx(rad * 0.2)}"/>`
    s += `<circle cx="${fx(ix)}" cy="${fx(iy)}" r="${fx(rad)}" fill="#05070a"/>`
    s += `<circle cx="${fx(ix - rad * 0.3)}" cy="${fx(iy - rad * 0.34)}" r="${fx(rad * 0.28)}" fill="${DUSK.amberCore}" opacity="0.8"/>`
  }

  // THE CANDLE, seen from directly above: a brass pan, a bright collar and a
  // white-hot core. One object, and the reason the whole deck is warm.
  const kx = w * 0.625
  const ky = h * 0.245
  const kr = w * 0.032
  s += `<ellipse cx="${fx(kx)}" cy="${fx(ky)}" rx="${fx(kr * 2.6)}" ry="${fx(kr * 2.4)}" fill="url(#deskPool)"/>`
  s += `<circle cx="${fx(kx)}" cy="${fx(ky)}" r="${fx(kr * 1.5)}" fill="${GOLD}" stroke="${DUSK.ink}" stroke-width="${fx(kr * 0.22)}" stroke-opacity="0.6"/>`
  s += `<circle cx="${fx(kx)}" cy="${fx(ky)}" r="${fx(kr)}" fill="${DUSK.parchLit}"/>`
  s += `<circle cx="${fx(kx)}" cy="${fx(ky)}" r="${fx(kr * 0.5)}" fill="${DUSK.amberCore}"/>`

  // THREE WAX-SEALED LETTERS on the counter, in front of the ledger and clear of
  // the crease. Cream rectangles with one big seal each — the seals are the only
  // saturated red on the piece, so they carry the eye down to the front rail.
  for (const [lxc, lyc, cant] of [
    [w * 0.185, h * 0.62, -8],
    [w * 0.335, h * 0.7, 6],
    [w * 0.79, h * 0.6, -5],
  ]) {
    const lwv = w * 0.135
    const lhv = h * 0.16
    s += `<g transform="translate(${fx(lxc)} ${fx(lyc)}) rotate(${fx(cant)})">`
    s += `<rect x="${fx(-lwv / 2 + w * 0.005)}" y="${fx(-lhv / 2 + h * 0.014)}" width="${fx(lwv)}" height="${fx(lhv)}" fill="#000000" opacity="0.45"/>`
    s += `<rect x="${fx(-lwv / 2)}" y="${fx(-lhv / 2)}" width="${fx(lwv)}" height="${fx(lhv)}" fill="${DUSK.parch}"/>`
    s += `<path d="M ${fx(-lwv / 2)} ${fx(-lhv / 2)} L 0 ${fx(lhv * 0.06)} L ${fx(lwv / 2)} ${fx(-lhv / 2)}" fill="none" stroke="${DUSK.parchDim}" stroke-width="${fx(h * 0.008)}" opacity="0.8"/>`
    s += `<circle cx="0" cy="${fx(lhv * 0.1)}" r="${fx(lhv * 0.3)}" fill="${SEAL_RED}"/>`
    s += `<circle cx="${fx(-lhv * 0.09)}" cy="${fx(lhv * 0.02)}" r="${fx(lhv * 0.14)}" fill="${SEAL_RED_LIT}" opacity="0.8"/>`
    s += `</g>`
  }

  // THE FRONT RAIL — the brass moulding that gives the cantilever its
  // silhouette, with turned balusters and a screwed nameplate reading POST,
  // struck off-centre so nothing legible sits on the crease.
  const railY = h * 0.815
  s += `<rect x="0" y="${fx(railY)}" width="${fx(w)}" height="${fx(h * 0.05)}" fill="${GOLD_DIM}"/>`
  s += `<rect x="0" y="${fx(railY)}" width="${fx(w)}" height="${fx(h * 0.018)}" fill="${GOLD_LIT}" opacity="0.85"/>`
  for (let i = 0; i < 13; i++) {
    const bxp = w * (0.045 + (0.91 * i) / 12)
    s += `<ellipse cx="${fx(bxp)}" cy="${fx(railY + h * 0.1)}" rx="${fx(w * 0.018)}" ry="${fx(h * 0.045)}" fill="${GOLD}"/>`
    s += `<ellipse cx="${fx(bxp - w * 0.005)}" cy="${fx(railY + h * 0.095)}" rx="${fx(w * 0.006)}" ry="${fx(h * 0.03)}" fill="${GOLD_LIT}" opacity="0.8"/>`
  }
  // Kept deliberately UNDER the ledger in weight — the first bake struck it in
  // full ink at nearly the ledger's own contrast and it competed with the desk's
  // hero object for the eye, which is the wrong fight for a nameplate to win.
  const pw = h * 0.055
  const ph = h * 0.078
  const pgap = h * 0.018
  const px0 = w * 0.655
  const py0 = railY + h * 0.062
  s += `<rect x="${fx(px0 - pgap * 1.6)}" y="${fx(py0 - pgap)}" width="${fx(4 * pw + 3 * pgap + 3.2 * pgap)}" height="${fx(ph + pgap * 2)}" rx="${fx(h * 0.012)}" fill="${GOLD}" stroke="${GOLD_DIM}" stroke-width="${fx(h * 0.008)}"/>`
  s += engraveWord('POST', px0, py0 + 2, pw, ph, pgap, GOLD_LIT, Math.max(3, h * 0.011), `opacity="${fxOp(0.6)}"`)
  s += engraveWord('POST', px0, py0, pw, ph, pgap, DUSK.ink, Math.max(2.6, h * 0.011), 'opacity="0.8"')
  // the outboard fall-off goes over the whole deck LAST, clipped to the die, so it
  // grades one continuous plane rather than a stack of separately-lit objects
  s += `<g clip-path="url(#deckDie)"><rect x="0" y="0" width="${fx(w)}" height="${fx(h)}" fill="url(#deckEnds)"/></g>`
  s += `</g>`
  return svgPiece(w, h, s + rookRim(die, 6), defs + `<clipPath id="deckDie"><path d="${die}"/></clipPath>`)
}

// ---- C) THE CRANK WHEEL (`ch3-keep-winch-disc`). The reader's first two
// findings were "the working winch is unlabelled" and "the only labelled disc on
// the spread is the OTHER one", which together read as a wiring error. The fix is
// diegetic rather than a UI sticker: a heavy brass capstan carrying a riveted
// MAKER'S PLATE struck HOIST on its face, at two opposite stations, plus a
// directional arrow and a stop mark on the rim.
//
// Everything about the plate's size is set by ONE measurement, and the note at
// the plate itself records it: the bench projects this page-flat wheel into
// 140x74 screen px, not the 140x140 a flat preview suggests, so anything sized
// off the art's own diameter loses half its height on screen. ----
function crankWheel(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const cy = h / 2
  const R = w * 0.44
  const rimIn = R * 0.84 // knurled rim band
  const legIn = R * 0.56 // spoke web / open ground boundary
  const hubR = R * 0.29
  const BR = GOLD
  const BR_LIT = GOLD_LIT
  const BR_DK = GOLD_DIM

  const defs =
    `<radialGradient id="wheelLite" cx="0.36" cy="0.3" r="0.86">` +
    `<stop offset="0" stop-color="${BR_LIT}" stop-opacity="0.55"/>` +
    `<stop offset="0.52" stop-color="${BR_LIT}" stop-opacity="0.05"/>` +
    `<stop offset="1" stop-color="#000000" stop-opacity="0.46"/></radialGradient>`

  // The grip lobe protrudes PAST the rim — the one cue that says "a hand turns
  // this" on a page-flat disc — and it rotates with the wheel, so it doubles as
  // the reader's read-out of how far they have wound.
  const lobeA = 320
  const lobeR = R * 1.09
  const lobe =
    `M ${fx(polX(cx, lobeA - 16, R * 0.93))} ${fx(polY(cy, lobeA - 16, R * 0.93))} ` +
    `Q ${fx(polX(cx, lobeA - 10, lobeR))} ${fx(polY(cy, lobeA - 10, lobeR))} ` +
    `${fx(polX(cx, lobeA, lobeR))} ${fx(polY(cy, lobeA, lobeR))} ` +
    `Q ${fx(polX(cx, lobeA + 10, lobeR))} ${fx(polY(cy, lobeA + 10, lobeR))} ` +
    `${fx(polX(cx, lobeA + 16, R * 0.93))} ${fx(polY(cy, lobeA + 16, R * 0.93))} Z`

  let s = `<g>`
  s += `<path d="${lobe}" fill="${BR}"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="${BR}"/>`
  // the wheel is a RING with spokes, not a plate: the ground between the spokes
  // falls to the loft's night so the spokes read as spokes at any size
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(legIn)}" fill="${DUSK.slateDeep}"/>`
  // EIGHT tapered spokes
  for (let i = 0; i < 8; i++) {
    const a = i * 45 + 22.5
    const halfIn = 7.5
    const halfOut = 4.2
    const sd =
      `M ${fx(polX(cx, a - halfIn, hubR * 0.9))} ${fx(polY(cy, a - halfIn, hubR * 0.9))} ` +
      `L ${fx(polX(cx, a - halfOut, legIn + 6))} ${fx(polY(cy, a - halfOut, legIn + 6))} ` +
      `L ${fx(polX(cx, a + halfOut, legIn + 6))} ${fx(polY(cy, a + halfOut, legIn + 6))} ` +
      `L ${fx(polX(cx, a + halfIn, hubR * 0.9))} ${fx(polY(cy, a + halfIn, hubR * 0.9))} Z`
    s += `<path d="${sd}" fill="${BR}"/>`
    s += `<path d="M ${fx(polX(cx, a - halfIn * 0.4, hubR * 0.9))} ${fx(polY(cy, a - halfIn * 0.4, hubR * 0.9))} L ${fx(polX(cx, a - halfOut * 0.4, legIn + 6))} ${fx(polY(cy, a - halfOut * 0.4, legIn + 6))}" fill="none" stroke="${BR_LIT}" stroke-width="${fx(R * 0.012)}" opacity="0.7"/>`
  }
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R)}" fill="url(#wheelLite)"/>`

  // ---- the KNURLED rim: a band of radial cuts, every fourth one deeper, so the
  // rim reads as gripped metal instead of as a gold hoop.
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx((R + rimIn) / 2)}" fill="none" stroke="${BR_DK}" stroke-width="${fx(R - rimIn)}" opacity="0.35"/>`
  for (let i = 0; i < 72; i++) {
    const a = (i * 360) / 72
    const deep = i % 4 === 0
    s += `<line x1="${fx(polX(cx, a, rimIn + (deep ? 0 : (R - rimIn) * 0.28)))}" y1="${fx(polY(cy, a, rimIn + (deep ? 0 : (R - rimIn) * 0.28)))}" x2="${fx(polX(cx, a, R))}" y2="${fx(polY(cy, a, R))}" stroke="${deep ? DUSK.ink : BR_DK}" stroke-width="${fx(R * (deep ? 0.016 : 0.01))}" opacity="${fxOp(deep ? 0.7 : 0.5)}"/>`
  }
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(R * 0.985)}" fill="none" stroke="${BR_LIT}" stroke-width="${fx(R * 0.018)}" opacity="0.8"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(rimIn)}" fill="none" stroke="${BR_DK}" stroke-width="${fx(R * 0.016)}" opacity="0.8"/>`

  // ---- THE MAKER'S PLATE. Two brass plates riveted across the wheel's FACE,
  // each struck HOIST, at opposite stations.
  //
  // ROUND 2, and the measurement that forced it. The first bake engraved the word
  // into the RIM BAND at cap height 9.25% of the disc diameter, which read fine on
  // a flat 140x140 preview and read as a tangle of dark scoring in the actual
  // board capture. The reason is that a page-flat disc is FORESHORTENED hard at
  // the pinned camera: the bench (e3w2s4-board.mjs) measures this wheel at
  // 140x74 screen px at rest and 145x90 at full wind, i.e. the vertical is
  // squashed to ~0.53, so a 9.25% cap height became under 7 screen px of
  // hairline. There is no rotation that escapes it — the disc turns 290deg of
  // shown wind — so the only honest levers are SIZE, WEIGHT and CONTRAST:
  //   - cap height 11% of the diameter and the word 53.6% of it (the top of the
  //     legible band; wider and a straight chord no longer fits inside a circle),
  //   - strokes at 20% of cap height instead of 12%,
  //   - near-black on a GOLD_LIT plate rather than engraved gold-on-gold, so the
  //     label survives as a plate with writing on it even at the sizes where the
  //     individual letters stop resolving — which is what "the winch is labelled"
  //     actually requires,
  //   - and the atlas region raised 300 -> 460px, because the old region threw
  //     away half the label's texels before the GPU ever saw them.
  // The plates cost the outer reach of the four spokes they cross; they carry a
  // drop shadow so they read as bolted ON the face rather than as gaps in it, and
  // the spokes at 22.5/157.5/202.5/337.5 stay open end to end.
  //
  // STATIONS ARE BUDGETED IN DEGREES, because the first bake spent the same band
  // twice and struck an arrow clean through the word: plates own 49-131 and
  // 229-311 (their own corners), arrows 334-26 and 154-206, the stop mark 44, the
  // grip lobe 320 — and the lobe only lives outside 0.93R, where no plate reaches.
  const cwL = R * 0.168
  const chL = R * 0.22
  const gapL = R * 0.058
  const wordW = 5 * cwL + 4 * gapL
  const plateHW = R * 0.585
  const plateHH = R * 0.155
  const plateCY = R * 0.51
  const strike = (rot) => {
    let g = `<g transform="translate(${fx(cx)} ${fx(cy)}) rotate(${fx(rot)}) translate(0 ${fx(-plateCY)})">`
    g += `<rect x="${fx(-plateHW)}" y="${fx(-plateHH + R * 0.018)}" width="${fx(plateHW * 2)}" height="${fx(plateHH * 2)}" rx="${fx(R * 0.03)}" fill="#000000" opacity="0.45"/>`
    g += `<rect x="${fx(-plateHW)}" y="${fx(-plateHH)}" width="${fx(plateHW * 2)}" height="${fx(plateHH * 2)}" rx="${fx(R * 0.03)}" fill="${BR_LIT}"/>`
    g += `<rect x="${fx(-plateHW)}" y="${fx(-plateHH)}" width="${fx(plateHW * 2)}" height="${fx(plateHH * 0.5)}" rx="${fx(R * 0.03)}" fill="#ffffff" opacity="0.18"/>`
    g += `<rect x="${fx(-plateHW)}" y="${fx(-plateHH)}" width="${fx(plateHW * 2)}" height="${fx(plateHH * 2)}" rx="${fx(R * 0.03)}" fill="none" stroke="${BR_DK}" stroke-width="${fx(R * 0.016)}"/>`
    // the word, doubled: a bright ghost laid down first and the dark cut over it,
    // so the letters keep an edge on both sides at any downscale
    g += engraveWord('HOIST', -wordW / 2, -chL / 2 + R * 0.022, cwL, chL, gapL, '#ffffff', Math.max(3, R * 0.04), `opacity="${fxOp(0.5)}"`)
    g += engraveWord('HOIST', -wordW / 2, -chL / 2, cwL, chL, gapL, DUSK.ink, Math.max(3, R * 0.044), 'opacity="0.98"')
    for (const rx of [-plateHW + R * 0.045, plateHW - R * 0.045]) {
      g += `<circle cx="${fx(rx)}" cy="0" r="${fx(R * 0.03)}" fill="${BR}" stroke="${DUSK.ink}" stroke-width="${fx(R * 0.01)}" stroke-opacity="0.65"/>`
    }
    g += `</g>`
    return g
  }
  const legR = (legIn + rimIn) / 2

  // ---- THE DIRECTION ARROWS, struck in the same band a quarter turn off the
  // legends. The disc's shown angle rotates the art from the page-fore axis
  // toward +z, which at the reading camera runs screen-LEFT -> screen-DOWN, i.e.
  // visually COUNTERCLOCKWISE; the image->screen map is a 180deg rotation and so
  // orientation-preserving, which means increasing math-angle here (polX/polY,
  // +y up) is the direction the reader's hand actually winds. Head at a1.
  const arrow = (a0, a1) => {
    const steps = 14
    let d = `M ${fx(polX(cx, a0, legR))} ${fx(polY(cy, a0, legR))}`
    for (let i = 1; i <= steps; i++) {
      const a = lerp(a0, a1, i / steps)
      d += ` L ${fx(polX(cx, a, legR))} ${fx(polY(cy, a, legR))}`
    }
    let g = `<path d="${d}" fill="none" stroke="${DUSK.ink}" stroke-width="${fx(R * 0.038)}" opacity="0.85" stroke-linecap="round"/>`
    g += `<path d="${d}" fill="none" stroke="${BR_LIT}" stroke-width="${fx(R * 0.014)}" opacity="0.55" stroke-linecap="round"/>`
    const hw = R * 0.075
    const tip = a1 + 7
    g +=
      `<path d="M ${fx(polX(cx, tip, legR))} ${fx(polY(cy, tip, legR))} ` +
      `L ${fx(polX(cx, a1, legR + hw))} ${fx(polY(cy, a1, legR + hw))} ` +
      `L ${fx(polX(cx, a1, legR - hw))} ${fx(polY(cy, a1, legR - hw))} Z" fill="${DUSK.ink}" opacity="0.9"/>`
    return g
  }
  s += arrow(-26, 26)
  s += arrow(154, 206)

  // the two plates go down over the spoke web, AFTER the arrows so nothing on the
  // rim can cut into a letter
  s += strike(0)
  s += strike(180)

  // ---- THE STOP MARK where the wind ends: a struck chevron and a filed notch on
  // the rim, in the gap between the arrow at 26 and the plate corner at 49.
  const stopA = 44
  s += `<path d="M ${fx(polX(cx, stopA, rimIn * 0.94))} ${fx(polY(cy, stopA, rimIn * 0.94))} L ${fx(polX(cx, stopA - 5, R * 0.99))} ${fx(polY(cy, stopA - 5, R * 0.99))} L ${fx(polX(cx, stopA + 5, R * 0.99))} ${fx(polY(cy, stopA + 5, R * 0.99))} Z" fill="${DUSK.ink}" opacity="0.9"/>`
  s += `<path d="M ${fx(polX(cx, stopA, rimIn * 0.99))} ${fx(polY(cy, stopA, rimIn * 0.99))} L ${fx(polX(cx, stopA, R * 0.96))} ${fx(polY(cy, stopA, R * 0.96))}" fill="none" stroke="${BR_LIT}" stroke-width="${fx(R * 0.014)}" opacity="0.7"/>`

  // ---- THE RIVETED HUB. Six rivets on a ring, a turned boss and a square drive
  // socket — the pin the yoke actually hangs on.
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR)}" fill="${BR}"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR)}" fill="none" stroke="${BR_DK}" stroke-width="${fx(R * 0.022)}" opacity="0.9"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR * 0.96)}" fill="url(#wheelLite)"/>`
  for (let i = 0; i < 6; i++) {
    const a = i * 60 + 30
    const rx = polX(cx, a, hubR * 0.68)
    const ry = polY(cy, a, hubR * 0.68)
    s += `<circle cx="${fx(rx)}" cy="${fx(ry)}" r="${fx(R * 0.042)}" fill="${BR_LIT}" stroke="${DUSK.ink}" stroke-width="${fx(R * 0.012)}" stroke-opacity="0.7"/>`
    s += `<circle cx="${fx(rx - R * 0.014)}" cy="${fx(ry - R * 0.014)}" r="${fx(R * 0.014)}" fill="#ffffff" opacity="0.4"/>`
  }
  s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(hubR * 0.42)}" fill="${WINCH_IRON_LIT}" stroke="${DUSK.ink}" stroke-width="${fx(R * 0.014)}"/>`
  s += `<rect x="${fx(cx - hubR * 0.2)}" y="${fx(cy - hubR * 0.2)}" width="${fx(hubR * 0.4)}" height="${fx(hubR * 0.4)}" fill="${WINCH_IRON}"/>`
  s += `<circle cx="${fx(cx - hubR * 0.16)}" cy="${fx(cy - hubR * 0.2)}" r="${fx(R * 0.02)}" fill="${WINCH_BEVEL}" opacity="0.5"/>`
  // a few cast-metal pits, so the brass is not a vector gradient
  for (let i = 0; i < 14; i++) {
    const a = rr(r, 0, 360)
    const rad = rr(r, legIn + 8, R * 0.96)
    s += `<circle cx="${fx(polX(cx, a, rad))}" cy="${fx(polY(cy, a, rad))}" r="${fx(rr(r, 1.4, 3.4))}" fill="${BR_DK}" opacity="${fxOp(rr(r, 0.2, 0.45))}"/>`
  }
  s += `</g>`

  const die = circlePath(cx, cy, R) + ' ' + lobe
  return svgPiece(w, h, s + rookRim(die, 5), defs)
}

// ---- D) THE SIGNAL MAST (`ch3-keep-winch-mast`). A new static piece, added
// because the blind reader read the hoisted paddle as "a detached prop that
// escaped its parent" — a post is the whole answer, and the ROPE running its
// length is the answer to "no rope, mast or cable connecting it to anything".
// It projects about 12 x 142 screen px, so nothing here is thinner than ~8 art
// px (12 screen px across a canvas 80 wide means one screen pixel costs 6.7 art
// px, and a stroke under that is a stroke the reader never sees). Foot collar at
// the image bottom, brass pulley head at the top, per the UV contract. ----
function signalMast(w, h, seed) {
  const r = mulberry32(seed)
  const upX = [w * 0.2, w * 0.8] // the two uprights' centres
  const uw = w * 0.13 // upright width (~1.5 screen px — the floor)
  const footTop = h * 0.955
  const headBot = h * 0.06

  let s = `<g>`
  // ---- the FOOT: a bracketed collar clamped to the loft lid, with two knee
  // braces. The reader has to believe the post STANDS on something.
  s += `<rect x="0" y="${fx(footTop)}" width="${fx(w)}" height="${fx(h - footTop)}" fill="${WINCH_IRON}"/>`
  s += `<rect x="0" y="${fx(footTop)}" width="${fx(w)}" height="${fx((h - footTop) * 0.3)}" fill="${WINCH_BEVEL}" opacity="0.4"/>`
  s += `<rect x="${fx(w * 0.06)}" y="${fx(footTop - h * 0.012)}" width="${fx(w * 0.88)}" height="${fx(h * 0.014)}" fill="${GOLD_DIM}"/>`
  for (const [x0, x1] of [
    [w * 0.06, upX[0]],
    [w * 0.94, upX[1]],
  ]) {
    s += `<path d="M ${fx(x0)} ${fx(footTop)} L ${fx(x1)} ${fx(footTop - h * 0.032)} L ${fx(x1)} ${fx(footTop)} Z" fill="${WINCH_IRON}"/>`
  }

  // ---- the LATTICE: two uprights and X-bracing. The bracing bays are uneven so
  // the post reads as built rather than extruded.
  for (const x of upX) {
    s += `<rect x="${fx(x - uw / 2)}" y="${fx(headBot)}" width="${fx(uw)}" height="${fx(footTop - headBot)}" fill="${DUSK.slateDim}"/>`
    s += `<rect x="${fx(x - uw / 2)}" y="${fx(headBot)}" width="${fx(uw * 0.34)}" height="${fx(footTop - headBot)}" fill="${DUSK.slateLit}" opacity="0.45"/>`
  }
  const bays = 15
  const cuts = unevenSplit(headBot + h * 0.02, footTop - h * 0.01, bays, r, 0.3)
  for (let i = 0; i < bays; i++) {
    const y0 = cuts[i]
    const y1 = cuts[i + 1]
    const flip = i % 2 === 0
    s += `<line x1="${fx(upX[0])}" y1="${fx(flip ? y0 : y1)}" x2="${fx(upX[1])}" y2="${fx(flip ? y1 : y0)}" stroke="${DUSK.slate}" stroke-width="${fx(w * 0.1)}" opacity="0.95"/>`
    s += `<line x1="${fx(upX[0])}" y1="${fx(y1)}" x2="${fx(upX[1])}" y2="${fx(y1)}" stroke="${DUSK.slateDeep}" stroke-width="${fx(w * 0.07)}" opacity="0.8"/>`
  }

  // ---- the ROPE. It runs the mast's WHOLE length from the pulley to the foot —
  // the piece's single most load-bearing mark, so it is the palest thing on the
  // post and it never breaks.
  s += `<line x1="${fx(w * 0.5)}" y1="${fx(headBot + h * 0.006)}" x2="${fx(w * 0.5)}" y2="${fx(footTop)}" stroke="${DUSK.ink}" stroke-width="${fx(w * 0.16)}" opacity="0.6"/>`
  s += `<line x1="${fx(w * 0.5)}" y1="${fx(headBot + h * 0.006)}" x2="${fx(w * 0.5)}" y2="${fx(footTop)}" stroke="${DUSK.parch}" stroke-width="${fx(w * 0.1)}"/>`
  // whipping ticks, so the rope reads as laid cord and not as a drawn line
  for (let i = 0; i < 22; i++) {
    const y = lerp(headBot + h * 0.03, footTop - h * 0.02, (i + 0.5) / 22)
    s += `<line x1="${fx(w * 0.42)}" y1="${fx(y)}" x2="${fx(w * 0.58)}" y2="${fx(y + h * 0.004)}" stroke="${DUSK.parchDim}" stroke-width="${fx(w * 0.05)}" opacity="0.7"/>`
  }

  // ---- the PULLEY HEAD the paddle pivots on: a brass cheek block the full
  // width of the post, a dark sheave and an axle pin. The semaphore's own collar
  // is painted to continue straight out of this.
  s += `<rect x="${fx(w * 0.04)}" y="${fx(headBot - h * 0.004)}" width="${fx(w * 0.92)}" height="${fx(h * 0.016)}" fill="${GOLD_DIM}"/>`
  s += `<circle cx="${fx(w * 0.5)}" cy="${fx(h * 0.032)}" r="${fx(w * 0.42)}" fill="${GOLD}"/>`
  s += `<circle cx="${fx(w * 0.5)}" cy="${fx(h * 0.032)}" r="${fx(w * 0.42)}" fill="none" stroke="${GOLD_LIT}" stroke-width="${fx(w * 0.1)}" opacity="0.9"/>`
  s += `<circle cx="${fx(w * 0.5)}" cy="${fx(h * 0.032)}" r="${fx(w * 0.24)}" fill="${WINCH_IRON}"/>`
  s += `<circle cx="${fx(w * 0.5)}" cy="${fx(h * 0.032)}" r="${fx(w * 0.09)}" fill="${WINCH_BEVEL}"/>`

  const die =
    `M ${fx(upX[0] - uw / 2)} ${fx(headBot)} L ${fx(upX[0] - uw / 2)} ${fx(footTop)} ` +
    `M ${fx(upX[1] + uw / 2)} ${fx(headBot)} L ${fx(upX[1] + uw / 2)} ${fx(footTop)}`
  s += `</g>`
  return svgPiece(w, h, s + rookRim(die, 4))
}

// ---- E) THE SIGNAL FLAG (`ch3-keep-winch-semaphore`). The stagger now ENDS on
// this output, so it is the "dispatch open" cue the reader's crank finishes on —
// which makes "is it recognisable as a flag going up?" the only question that
// matters. At ~12 x 40 screen px the answer has to be silhouette: a brass
// pivot collar continuing the mast's pulley head, then a gold PENNANT with a
// swallowtail notch cut into its free end, one saturated red band, and a raven
// device. Pivot at the image bottom, tip at the top, per the UV contract. ----
function signalFlag(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const pivotY = h * 0.99
  const collarTop = h * 0.8
  const flagBot = h * 0.66
  const notch = h * 0.14

  const defs =
    `<linearGradient id="flagLite" x1="0" y1="1" x2="0.4" y2="0">` +
    `<stop offset="0" stop-color="${GOLD_DIM}"/><stop offset="0.5" stop-color="${GOLD}"/>` +
    `<stop offset="1" stop-color="${GOLD_LIT}"/></linearGradient>`

  // The pennant: full-width at its root, a swallowtail cut into the free (image
  // top) end. The notch is the whole silhouette read — a rectangle at this size
  // is a grey post, which is exactly what the reader saw before.
  const fx0 = w * 0.045
  const fx1 = w - fx0
  const pennant =
    `M ${fx(fx0)} ${fx(flagBot)} L ${fx(fx0)} ${fx(h * 0.012)} ` +
    `L ${fx(cx)} ${fx(notch)} L ${fx(fx1)} ${fx(h * 0.012)} ` +
    `L ${fx(fx1)} ${fx(flagBot)} Z`
  const staffW = w * 0.3

  let s = `<g>`
  // ---- the ARM below the flag: the pivot collar and a short slate shaft, drawn
  // to read as the same ironwork the mast head is made of.
  s += `<rect x="${fx(cx - staffW / 2)}" y="${fx(h * 0.4)}" width="${fx(staffW)}" height="${fx(pivotY - h * 0.4)}" fill="${DUSK.slateDim}"/>`
  s += `<rect x="${fx(cx - staffW / 2)}" y="${fx(h * 0.4)}" width="${fx(staffW * 0.34)}" height="${fx(pivotY - h * 0.4)}" fill="${DUSK.slateLit}" opacity="0.5"/>`
  s += `<rect x="${fx(w * 0.06)}" y="${fx(collarTop)}" width="${fx(w * 0.88)}" height="${fx(h * 0.13)}" rx="${fx(w * 0.14)}" fill="${GOLD}"/>`
  s += `<rect x="${fx(w * 0.06)}" y="${fx(collarTop)}" width="${fx(w * 0.88)}" height="${fx(h * 0.045)}" rx="${fx(w * 0.14)}" fill="${GOLD_LIT}" opacity="0.8"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(h * 0.955)}" r="${fx(w * 0.3)}" fill="${WINCH_IRON}"/>`
  s += `<circle cx="${fx(cx)}" cy="${fx(h * 0.955)}" r="${fx(w * 0.3)}" fill="none" stroke="${GOLD_LIT}" stroke-width="${fx(w * 0.08)}" opacity="0.85"/>`
  s += `<circle cx="${fx(cx - w * 0.08)}" cy="${fx(h * 0.94)}" r="${fx(w * 0.08)}" fill="${WINCH_BEVEL}" opacity="0.6"/>`

  // ---- the PENNANT
  s += `<path d="${pennant}" fill="url(#flagLite)"/>`
  // the saturated band, low on the flag where it is widest
  s += `<rect x="${fx(fx0)}" y="${fx(h * 0.5)}" width="${fx(fx1 - fx0)}" height="${fx(h * 0.11)}" fill="${SEAL_RED}"/>`
  s += `<rect x="${fx(fx0)}" y="${fx(h * 0.5)}" width="${fx(fx1 - fx0)}" height="${fx(h * 0.03)}" fill="${SEAL_RED_LIT}" opacity="0.8"/>`
  // the raven device, in the flag's upper field. A symmetric spread-wing mark on
  // purpose: art-u runs toward reader-LEFT, so this piece prints mirrored against
  // the screen and anything with a handedness would print backwards.
  //
  // `miniRaven` and NOT `wheelRavenPath`, on the evidence of the 1x bake: the
  // wheeling-gull silhouette is 0.35 as tall as it is wide, so at the flag's 12px
  // width it resolved to two horizontal dashes that read as a slot in the cloth.
  // miniRaven carries a body and a wedge tail at 0.58 of its span, which is ~6
  // screen px of bird instead of ~4 of dash.
  s += `<g transform="translate(${fx(cx)} ${fx(h * 0.29)})">${miniRaven(w * 0.42, DUSK.ink, DUSK.slateLit)}</g>`
  // the hoist edge catches the roost lamps; the free end falls to night
  s += `<rect x="${fx(fx0)}" y="${fx(h * 0.012)}" width="${fx((fx1 - fx0) * 0.16)}" height="${fx(flagBot - h * 0.012)}" fill="${GOLD_LIT}" opacity="0.4"/>`
  s += `<path d="${pennant}" fill="none" stroke="${DUSK.ink}" stroke-width="${fx(w * 0.05)}" opacity="0.55" stroke-linejoin="round"/>`
  // three sewn grommets down the hoist, the flag's only fine detail — it costs
  // nothing if it dissolves, and at 3x it says "sewn cloth on a paddle"
  for (const t of [0.2, 0.45, 0.7]) {
    s += `<circle cx="${fx(fx0 + (fx1 - fx0) * 0.09)}" cy="${fx(lerp(h * 0.05, flagBot - h * 0.03, t))}" r="${fx(w * 0.055)}" fill="${GOLD_DIM}" opacity="${fxOp(0.7 + rr(r, 0, 0.2))}"/>`
  }
  s += `</g>`
  return svgPiece(w, h, s + rookRim(pennant, 4), defs)
}

// ---- F) THE SASH WEIGHT (`ch3-keep-winch-counterweight`). The reader never
// noticed it, which for a counterweight descending a belfry mouth is close to
// correct — so it stays simple and honest rather than being made loud: a cast
// iron block with a ground top bevel, a lifting eye and a short run of chain.
// Printed across the loft cap crease, so the crease is the image's vertical
// centreline and the block is painted upright (art-v 0 = bottom). ----
function sashWeight(w, h, seed) {
  const r = mulberry32(seed)
  const cx = w / 2
  const bx0 = w * 0.1
  const bx1 = w * 0.9
  const byTop = h * 0.26
  const byBot = h * 0.985

  let s = `<g>`
  // ---- the CHAIN above the block: three links, drawn as heavy rings so they
  // survive at the ~31 screen px the whole piece stands.
  // Struck in WINCH_IRON_LIT rather than WINCH_IRON: the block hangs in the
  // belfry MOUTH, which is the darkest opening on the keep, and the 1x bake showed
  // ink-on-ink chain reading as nothing at all above a block that did read.
  for (let i = 0; i < 3; i++) {
    const cyl = h * (0.035 + i * 0.072)
    s += `<ellipse cx="${fx(cx)}" cy="${fx(cyl)}" rx="${fx(w * (i % 2 ? 0.1 : 0.16))}" ry="${fx(h * 0.045)}" fill="none" stroke="${WINCH_IRON_LIT}" stroke-width="${fx(w * 0.075)}"/>`
    s += `<ellipse cx="${fx(cx - w * 0.03)}" cy="${fx(cyl - h * 0.008)}" rx="${fx(w * (i % 2 ? 0.1 : 0.16))}" ry="${fx(h * 0.045)}" fill="none" stroke="${WINCH_BEVEL}" stroke-width="${fx(w * 0.022)}" opacity="0.5"/>`
  }
  // ---- the LIFTING EYE, symmetric about the crease so the seam between the two
  // half-quads falls down its own centreline and has nothing to break.
  s += `<path d="M ${fx(cx - w * 0.13)} ${fx(byTop + h * 0.02)} Q ${fx(cx - w * 0.13)} ${fx(h * 0.19)} ${fx(cx)} ${fx(h * 0.19)} Q ${fx(cx + w * 0.13)} ${fx(h * 0.19)} ${fx(cx + w * 0.13)} ${fx(byTop + h * 0.02)} Z" fill="${WINCH_IRON}"/>`
  s += `<ellipse cx="${fx(cx)}" cy="${fx(h * 0.205)}" rx="${fx(w * 0.055)}" ry="${fx(h * 0.022)}" fill="none" stroke="${WINCH_BEVEL}" stroke-width="${fx(w * 0.02)}" opacity="0.5"/>`

  // ---- the BLOCK
  const die = `M ${fx(bx0)} ${fx(byTop)} L ${fx(bx1)} ${fx(byTop)} L ${fx(bx1 - w * 0.03)} ${fx(byBot)} L ${fx(bx0 + w * 0.03)} ${fx(byBot)} Z`
  s += `<path d="${die}" fill="${WINCH_IRON}"/>`
  // the ground top bevel — the one bright note, and what makes the block read as
  // a heavy solid rather than a hole in the belfry
  s += `<path d="M ${fx(bx0)} ${fx(byTop)} L ${fx(bx1)} ${fx(byTop)} L ${fx(bx1 - w * 0.06)} ${fx(byTop + h * 0.055)} L ${fx(bx0 + w * 0.06)} ${fx(byTop + h * 0.055)} Z" fill="${WINCH_BEVEL}" opacity="0.8"/>`
  s += `<path d="M ${fx(bx0 + w * 0.03)} ${fx(byTop + h * 0.06)} L ${fx(bx0 + w * 0.07)} ${fx(byBot - h * 0.01)}" fill="none" stroke="${WINCH_IRON_LIT}" stroke-width="${fx(w * 0.05)}" opacity="0.7"/>`
  // ONE casting seam down the flank. The first bake had two seams plus a foundry
  // rib across the waist, and at 20x31 screen px that grid of three panels read
  // as a WINDOW in the belfry rather than as a solid weight hanging in one.
  s += `<line x1="${fx(lerp(bx0, bx1, 0.42))}" y1="${fx(byTop + h * 0.07)}" x2="${fx(lerp(bx0, bx1, 0.42))}" y2="${fx(byBot - h * 0.02)}" stroke="${WINCH_IRON_LIT}" stroke-width="${fx(w * 0.022)}" opacity="0.35"/>`
  // a lamplit rim where the belfry's roost-glow grazes the weight's near arris
  s += `<line x1="${fx(bx1)}" y1="${fx(byTop + h * 0.01)}" x2="${fx(bx1 - w * 0.03)}" y2="${fx(byBot)}" stroke="${DUSK.amber}" stroke-width="${fx(w * 0.03)}" opacity="0.35"/>`
  // cast pitting
  for (let i = 0; i < 16; i++) {
    s += `<circle cx="${fx(rr(r, bx0 + w * 0.05, bx1 - w * 0.05))}" cy="${fx(rr(r, byTop + h * 0.08, byBot - h * 0.02))}" r="${fx(rr(r, 1.4, 3.6))}" fill="${WINCH_IRON_LIT}" opacity="${fxOp(rr(r, 0.2, 0.4))}"/>`
  }
  s += `</g>`
  return svgPiece(w, h, s + rookRim(die, 5))
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

// E3 s7 — THE NORTHERN TREASURY NAVE (scenes/s7-scene-pack.md §4e). The ice-
// palace ref's crystalline grammar (140028) mapped to midnight/teal + gold +
// frost; aurora mint/amethyst live ONLY in the apse window and the pooled
// floor light (daisy-ref single-accent discipline). SCREEN-SPACE page-flat
// authoring; the OA relief strata are cut FROM these painted sheets, so
// relief paint continuity is automatic — the painter only needs the gilt
// shelf/molding lines to CROSS the cut bands.
// ============================================================================

const NAVE_C = {
  midnight: '#16223a',
  teal: '#14454b',
  tealLit: '#1d5a60',
  // The value ladder the flat-slab round was missing: a crown course that is
  // genuinely LIT, a base course that is genuinely dark, and a near-black the
  // gilt is read against. Hue stays inside the teal/midnight family.
  tealHi: '#2f838a',
  base: '#071820',
  niche: '#08131c',
  floor: '#0b2530',
  gold: '#d4a13c',
  gilt: '#f0cd7a',
  giltHi: '#fdeec2',
  frost: '#eef4f6',
  mint: '#4fd6b8',
  amethyst: '#8a6fd6',
}

/** Per-rank painter constants (aperture, strata bands, column strip, T1 edge),
 *  derived from the content.ts rank numbers. Named and exported rather than
 *  inlined at the PIECES call sites so the art-QA harness can derive its
 *  sample boxes from the SAME numbers the painter draws with — a contrast
 *  measurement against hand-typed boxes measures the typist, not the art. */
const NAVE_RANKS = {
  'ch6-nave-b': { apHw: 0.1316, apApex: 0.7308, topBand: 0.3846, mold: [0.769, 0.962], colHalf: 0.0592, colTop: 0.6923, edge: 'frost' },
  'ch6-nave-c': { apHw: 0.2069, apApex: 0.7273, topBand: 0.4545, mold: [0.7727, 0.9545], colHalf: 0.0776, colTop: 0.6818, edge: 'frost' },
  'ch6-nave-d': { apHw: 0.359, apApex: 0.7222, topBand: 0.5556, mold: [0.75, 0.9444], kb: [0.8333, 0.9444], khw: 0.0641, edge: 'gilt' },
}

/** The apse's own constants, same contract: crown-wing line (world 0.46 of the
 *  0.62 face), dome half-width, and the aurora window.
 *
 *  The window is a FAN seated on the crown line, not a disc floating above it.
 *  The dome silhouette is five narrow scallops (the widest is 2·domeHw/5 across
 *  while the centre one runs the full sheet height), so a disc big enough to
 *  glow got sliced into a bowl by the clip and a disc small enough to survive
 *  lit one scallop out of five. A half-round seated at `roseCy` fills every
 *  scallop from a single hot core, and its core sits inside the 0.187-world
 *  crown band the camera can actually see (bench §A). */
const NAVE_APSE = { crownFrac: 0.46 / 0.62, domeHwFrac: 0.19, roseCy: 1 - 0.46 / 0.62, roseRw: 0.194, topBand: 0.3 }

/** Linear blend of two #rrggbb strings — the value ladder above is mixed, not
 *  enumerated, so a course's tone is a function of its height on the wall. */
function naveMix(a, b, t) {
  const k = Math.max(0, Math.min(1, t))
  const ch = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16)
  let out = '#'
  for (let i = 0; i < 3; i++) {
    out += Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k)
      .toString(16)
      .padStart(2, '0')
  }
  return out
}

/** The pointed-arch aperture path (image space, y down, bottom = sheet base).
 *  Jambs rise from the base to the spring line, then two quadratics meet at
 *  the apex — the die line the runtime alpha-cuts. */
function naveArchPath(w, h, hwFrac, apexFrac) {
  const cx = w / 2
  const aw = hwFrac * w
  const yApex = h * (1 - apexFrac)
  const ySpring = Math.min(h, yApex + aw * 1.1)
  return (
    `M ${fx(cx - aw)} ${fx(h)} L ${fx(cx - aw)} ${fx(ySpring)} ` +
    `Q ${fx(cx - aw)} ${fx(yApex)} ${fx(cx)} ${fx(yApex)} ` +
    `Q ${fx(cx + aw)} ${fx(yApex)} ${fx(cx + aw)} ${fx(ySpring)} ` +
    `L ${fx(cx + aw)} ${fx(h)} Z`
  )
}

/** Ashlar coursing shared by every rank face — the wall's VALUE structure, not
 *  a grid drawn on a flat fill. Three things stack, and each survives a
 *  different scale of downsampling:
 *   - a per-course tone mixed off the crown->base value ramp (low frequency:
 *     this is what still reads once the rank is 300px wide on screen);
 *   - per-stone value jitter (mid frequency: the mosaic tooth);
 *   - a shadowed reveal at every bed joint — a dark joint line with the LIT
 *     top edge of the course below riding under it (high frequency: what makes
 *     stone read as cut stone up close).
 *  Deterministic: every jitter draws from the caller's mulberry32 stream. */
function naveWall(w, h, r) {
  let s = ''
  const N = 11
  const ch = h / N
  for (let i = 0; i < N; i++) {
    const y0 = i * ch
    const lit = Math.pow(1 - (i + 0.5) / N, 1.5)
    s += `<rect x="0" y="${fx(y0)}" width="${w}" height="${fx(ch + 1)}" fill="${naveMix(NAVE_C.base, NAVE_C.tealHi, 0.16 + 0.84 * lit)}"/>`
    const sw = ch * 1.75
    const off = (i % 2 ? 0.55 : 0.05) * sw
    for (let x = -off; x < w; x += sw) {
      const j = rr(r, -0.11, 0.11)
      s += `<rect x="${fx(x + 1)}" y="${fx(y0 + 1)}" width="${fx(sw - 2)}" height="${fx(ch - 2)}" fill="${j < 0 ? NAVE_C.base : NAVE_C.frost}" opacity="${fx(Math.abs(j))}"/>`
      s += `<line x1="${fx(x)}" y1="${fx(y0)}" x2="${fx(x)}" y2="${fx(y0 + ch)}" stroke="${NAVE_C.base}" stroke-width="2" opacity="0.72"/>`
      s += `<line x1="${fx(x + 1.8)}" y1="${fx(y0)}" x2="${fx(x + 1.8)}" y2="${fx(y0 + ch)}" stroke="${NAVE_C.tealHi}" stroke-width="1.1" opacity="0.28"/>`
    }
    s += `<line x1="0" y1="${fx(y0 + ch)}" x2="${w}" y2="${fx(y0 + ch)}" stroke="${NAVE_C.base}" stroke-width="3" opacity="0.82"/>`
    s += `<line x1="0" y1="${fx(y0 + ch + 2.4)}" x2="${w}" y2="${fx(y0 + ch + 2.4)}" stroke="${NAVE_C.tealHi}" stroke-width="1.7" opacity="${fx(0.14 + 0.34 * lit)}"/>`
  }
  return s
}

/** Two shadowed pilaster reveals per wing: a dark recess with a lit return on
 *  its outboard side. Vertical rhythm is the cheapest cure for a wing that
 *  reads as one slab — it costs four rects and survives any downsample. */
function naveWingPilasters(w, h, cfg) {
  let s = ''
  const inner = (0.5 - (cfg.apHw ?? NAVE_APSE.domeHwFrac)) * w
  const pw = Math.max(3, w * 0.011)
  for (const sgn of [-1, 1]) {
    for (let k = 1; k <= 2; k++) {
      const x = w / 2 + sgn * inner * (0.3 + 0.62 * (k / 3))
      s += `<rect x="${fx(x - pw)}" y="0" width="${fx(pw * 2)}" height="${h}" fill="${NAVE_C.base}" opacity="0.36"/>`
      s += `<rect x="${fx(x + pw)}" y="0" width="${fx(pw * 0.55)}" height="${h}" fill="${NAVE_C.tealHi}" opacity="0.22"/>`
    }
  }
  return s
}

/** THE TREASURY FRIEZE — the coin-shelf strata, in the only band the reading
 *  camera actually sees (each wing's top 0.20 world, pack §4b), and the one
 *  place on the wall allowed to be loud.
 *
 *  The previous round painted gilt shelf LINES straight onto the lit teal
 *  wall, so the two values sat a few percent apart and the strata vanished at
 *  distance. This one cuts a near-black NICHE first and reads the gilt against
 *  that: every ledge is a dark cast shadow, a gold ledge, a gilt face and a
 *  lit nosing, with coin stacks standing on it as discs with their own
 *  highlight. The contrast is between the niche and the ledge, not between two
 *  neighbouring teals. */
function naveShelfFrieze(w, h, r, cfg) {
  let s = ''
  const yTop = h * (1 - cfg.mold[0]) + h * 0.015
  const yBot = h * cfg.topBand
  const band = yBot - yTop
  if (band < 10) return s
  const pad = cfg.apHw * w + Math.max(6, w * 0.035)
  const n = Math.max(2, Math.min(4, Math.round(band / 22)))
  // Each wing's frieze is broken into BAYS separated by gilt mullions. One
  // unbroken niche per wing gave the rank a second full-width dark bar, and
  // with three ranks stacked the whole nave went stripey; bays put vertical
  // beats into the only band the camera sees, which is what stops a row of
  // shelves from reading as a painted line.
  const wings = []
  for (const [wx0, wx1] of [[w * 0.014, w / 2 - pad], [w / 2 + pad, w * 0.986]]) {
    if (wx1 - wx0 < 14) continue
    const bays = Math.max(1, Math.round((wx1 - wx0) / (band * 1.7)))
    const gap = Math.max(2.5, band * 0.13)
    const bw = (wx1 - wx0 - gap * (bays - 1)) / bays
    for (let b = 0; b < bays; b++) {
      const bx = wx0 + b * (bw + gap)
      wings.push([bx, bx + bw])
      if (b) {
        // the mullion standing between two bays
        s += `<rect x="${fx(bx - gap)}" y="${fx(yTop)}" width="${fx(gap)}" height="${fx(band)}" fill="${NAVE_C.gold}" opacity="0.8"/>`
        s += `<rect x="${fx(bx - gap)}" y="${fx(yTop)}" width="${fx(gap * 0.36)}" height="${fx(band)}" fill="${NAVE_C.giltHi}" opacity="0.75"/>`
      }
    }
  }
  for (const [x0, x1] of wings) {
    s += `<rect x="${fx(x0)}" y="${fx(yTop)}" width="${fx(x1 - x0)}" height="${fx(band)}" fill="${NAVE_C.niche}" opacity="0.78"/>`
    s += `<rect x="${fx(x0)}" y="${fx(yTop)}" width="${fx(x1 - x0)}" height="${fx(band * 0.2)}" fill="#000000" opacity="0.3"/>`
    for (let k = 0; k < n; k++) {
      const y = yTop + (band * (k + 1)) / (n + 0.4)
      const lw = Math.max(2.6, band * 0.085)
      const seg = (yy, col, sw2, op) =>
        `<line x1="${fx(x0)}" y1="${fx(yy)}" x2="${fx(x1)}" y2="${fx(yy)}" stroke="${col}" stroke-width="${fx(sw2)}" opacity="${op}"/>`
      s += seg(y + lw * 0.95, NAVE_C.base, lw * 1.5, '0.9')
      s += seg(y, NAVE_C.gold, lw, '1')
      s += seg(y - lw * 0.16, NAVE_C.gilt, lw * 0.5, '1')
      s += seg(y - lw * 0.42, NAVE_C.giltHi, lw * 0.22, '0.95')
      const cr = Math.max(1.5, lw * 0.62)
      for (let x = x0 + rr(r, 3, 12); x < x1 - cr * 1.2; x += rr(r, cr * 2.8, cr * 7.5)) {
        const stack = 1 + Math.floor(rr(r, 0, 2.7))
        for (let q = 0; q < stack; q++) {
          const cy = y - lw * 0.5 - cr * (0.95 + q * 1.5)
          if (cy - cr < yTop + band * 0.16) break
          s += `<circle cx="${fx(x)}" cy="${fx(cy)}" r="${fx(cr)}" fill="${NAVE_C.gold}" stroke="${NAVE_C.base}" stroke-width="0.9"/>`
          s += `<circle cx="${fx(x - cr * 0.28)}" cy="${fx(cy - cr * 0.3)}" r="${fx(cr * 0.44)}" fill="${NAVE_C.giltHi}" opacity="0.95"/>`
        }
      }
    }
    const rw = Math.max(3, band * 0.1)
    s += `<line x1="${fx(x0)}" y1="${fx(yBot)}" x2="${fx(x1)}" y2="${fx(yBot)}" stroke="${NAVE_C.gold}" stroke-width="${fx(rw)}"/>`
    s += `<line x1="${fx(x0)}" y1="${fx(yBot - rw * 0.3)}" x2="${fx(x1)}" y2="${fx(yBot - rw * 0.3)}" stroke="${NAVE_C.giltHi}" stroke-width="${fx(rw * 0.28)}" opacity="0.9"/>`
    s += `<line x1="${fx(x0)}" y1="${fx(yBot + rw * 0.8)}" x2="${fx(x1)}" y2="${fx(yBot + rw * 0.8)}" stroke="${NAVE_C.base}" stroke-width="${fx(rw)}" opacity="0.75"/>`
  }
  return s
}

/** Frost dusting along a silhouette crown (the crystalline cut edge). */
function naveFrostDust(r, w, yAt, n) {
  let s = ''
  for (let i = 0; i < n; i++) {
    const x = rr(r, 0, w)
    s += `<circle cx="${fx(x)}" cy="${fx(yAt(x) + rr(r, 2, 12))}" r="${fx(rr(r, 0.8, 2.2))}" fill="${NAVE_C.frost}" opacity="${fx(rr(r, 0.3, 0.8))}"/>`
  }
  return s
}

/** One nave rank face (b/c/d): teal masonry sheet, die-cut pointed-arch
 *  aperture (alpha), gilt arch rim, molding band across the tympanum, and —
 *  where the rank carries a columnPair stratum — the painted central column
 *  strip the relief is cut from, standing INSIDE the aperture (the through-
 *  portal read is column bases + path, pack §4b). `edge` picks the T1
 *  variant: 'gilt' for the mouth rank D, 'frost' elsewhere. */
function naveRankFace(w, h, seed, cfg) {
  const r = mulberry32(seed)
  const arch = naveArchPath(w, h, cfg.apHw, cfg.apApex)
  const sheet = `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z ${arch}`
  const rw = Math.max(6, Math.min(w, h) * 0.05)
  let s = `<g clip-path="url(#rank-clip)">`
  s += `<rect width="${w}" height="${h}" fill="url(#rank-grad)"/>`
  s += naveWall(w, h, r)
  s += naveWingPilasters(w, h, cfg)
  // the vault light: a soft warm wash falling from the crown, so the face is
  // LIT rather than merely tinted, and the base falls away into the dark.
  s += `<ellipse cx="${fx(w / 2)}" cy="0" rx="${fx(w * 0.62)}" ry="${fx(h * 0.72)}" fill="url(#rank-glow)"/>`
  s += `<rect x="0" y="${fx(h * 0.55)}" width="${w}" height="${fx(h * 0.45)}" fill="url(#rank-base)"/>`
  // the architrave — the band the archMolding stratum is cut through, so its
  // gilt runs continuously across the relief cuts and the popped molding
  // carries gold on its face. Dentils give the band tooth at distance.
  const [m0, m1] = cfg.mold
  const my0 = h * (1 - m1)
  const my1 = h * (1 - m0)
  const mb = my1 - my0
  s += `<rect x="0" y="${fx(my0)}" width="${w}" height="${fx(mb)}" fill="${NAVE_C.niche}" opacity="0.34"/>`
  s += `<line x1="0" y1="${fx(my0)}" x2="${w}" y2="${fx(my0)}" stroke="${NAVE_C.gold}" stroke-width="${fx(rw * 0.5)}"/>`
  s += `<line x1="0" y1="${fx(my0 - rw * 0.13)}" x2="${w}" y2="${fx(my0 - rw * 0.13)}" stroke="${NAVE_C.giltHi}" stroke-width="${fx(rw * 0.16)}" opacity="0.9"/>`
  s += `<line x1="0" y1="${fx(my1)}" x2="${w}" y2="${fx(my1)}" stroke="${NAVE_C.gold}" stroke-width="${fx(rw * 0.4)}"/>`
  {
    // A reeded molding, not a dentil course. Three ranks stack in one frame, so
    // any block-scale motif on this band repeats three times and reads as a
    // keyboard; fine vertical reeds between two gilt fasciae read as a turned
    // gilt molding up close and as one warm line at distance — and they leave
    // the coin frieze below as the only loud thing on the wall.
    for (const f of [0.34, 0.68]) {
      s += `<line x1="0" y1="${fx(my0 + mb * f)}" x2="${w}" y2="${fx(my0 + mb * f)}" stroke="${NAVE_C.gold}" stroke-width="${fx(rw * 0.16)}" opacity="0.85"/>`
    }
    const dw = Math.max(1.4, mb * 0.1)
    for (let x = dw; x < w; x += dw * 2) {
      s += `<line x1="${fx(x)}" y1="${fx(my0 + mb * 0.34)}" x2="${fx(x)}" y2="${fx(my0 + mb * 0.68)}" stroke="${NAVE_C.gilt}" stroke-width="${fx(dw * 0.8)}" opacity="0.3"/>`
    }
  }
  s += naveShelfFrieze(w, h, r, cfg)
  s += `</g>`
  // gilt arch rim ringing the aperture (drawn unclipped so the ring sits ON
  // the die edge), with radiating voussoir ticks — the cathedral archivolt.
  // The dark halo under the gold is what makes the rim a RIM: without a
  // shadowed reveal behind it the gold sat at wall value and read as a scratch.
  s += `<path d="${arch}" fill="none" stroke="${NAVE_C.base}" stroke-width="${fx(rw * 2.3)}" opacity="0.9"/>`
  s += `<path d="${arch}" fill="none" stroke="${NAVE_C.gold}" stroke-width="${fx(rw)}"/>`
  s += `<path d="${arch}" fill="none" stroke="${NAVE_C.gilt}" stroke-width="${fx(rw * 0.42)}"/>`
  s += `<path d="${arch}" fill="none" stroke="${NAVE_C.giltHi}" stroke-width="${fx(rw * 0.15)}" opacity="0.95"/>`
  {
    const cx = w / 2
    const aw = cfg.apHw * w
    const yA = h * (1 - cfg.apApex)
    const ySpring = Math.min(h, yA + aw * 1.1)
    const vCx = cx
    const vCy = ySpring
    const ticks = 11
    const r0 = aw + rw * 0.42
    const r1 = r0 + rw * 1.15
    for (let i = 0; i <= ticks; i++) {
      const a = Math.PI + (Math.PI * i) / ticks // left horizon over the crown to right
      const rx = Math.cos(a)
      const ry = Math.sin(a) * ((ySpring - yA) / aw + 0.12)
      const n = Math.hypot(rx, ry) || 1
      const x0 = vCx + (rx / n) * r0
      const y0 = Math.min(ySpring, vCy + (ry / n) * r0)
      const x1 = vCx + (rx / n) * r1
      const y1 = Math.min(ySpring, vCy + (ry / n) * r1)
      // alternating voussoirs: gold block, gilt block — the archivolt reads as
      // cut wedges rather than as a hatched fringe.
      s += `<line x1="${fx(x0)}" y1="${fx(y0)}" x2="${fx(x1)}" y2="${fx(y1)}" stroke="${i % 2 ? NAVE_C.gilt : NAVE_C.gold}" stroke-width="${fx(rw * 0.5)}" opacity="0.95"/>`
    }
  }
  // the keystone, painted EXACTLY over its stratum band so the popped
  // order-2 relief carries the gilt (band fracs from content.ts, khw = the
  // keystone arm as a width fraction — the cut edges land inside the paint).
  if (cfg.kb) {
    const cx = w / 2
    const y0 = h * (1 - cfg.kb[1])
    const y1 = h * (1 - cfg.kb[0])
    const kw = cfg.khw * w
    s += `<path d="M ${fx(cx - kw * 1.2)} ${fx(y1)} L ${fx(cx + kw * 1.2)} ${fx(y1)} L ${fx(cx + kw * 0.85)} ${fx(y0)} L ${fx(cx - kw * 0.85)} ${fx(y0)} Z" fill="${NAVE_C.gilt}" stroke="${NAVE_C.midnight}" stroke-width="2"/>`
    s += `<line x1="${fx(cx - kw * 1.2)}" y1="${fx(y1 - 2)}" x2="${fx(cx + kw * 1.2)}" y2="${fx(y1 - 2)}" stroke="${NAVE_C.frost}" stroke-width="1.6" opacity="0.8"/>`
  }
  // the painted column pair standing in the portal centre — the sheet strip
  // the columnPair stratum folds back from (it must stay painted: the cut
  // region IS the relief). Gilt shafts on a midnight backing strip.
  if (cfg.colHalf) {
    const cx = w / 2
    const cw = cfg.colHalf * w
    const yTop = h * (1 - cfg.colTop)
    s += `<rect x="${fx(cx - cw)}" y="${fx(yTop)}" width="${fx(cw * 2)}" height="${fx(h - yTop)}" fill="${NAVE_C.floor}"/>`
    for (const sgn of [-1, 1]) {
      const x = cx + sgn * cw * 0.52
      s += `<rect x="${fx(x - cw * 0.2)}" y="${fx(yTop + 6)}" width="${fx(cw * 0.4)}" height="${fx(h - yTop - 14)}" fill="${NAVE_C.gold}" opacity="0.9"/>`
      s += `<line x1="${fx(x)}" y1="${fx(yTop + 6)}" x2="${fx(x)}" y2="${fx(h - 8)}" stroke="${NAVE_C.gilt}" stroke-width="2.2" opacity="0.9"/>`
      s += `<rect x="${fx(x - cw * 0.3)}" y="${fx(h - 14)}" width="${fx(cw * 0.6)}" height="8" fill="${NAVE_C.gilt}"/>`
      s += `<rect x="${fx(x - cw * 0.3)}" y="${fx(yTop + 2)}" width="${fx(cw * 0.6)}" height="7" fill="${NAVE_C.gilt}"/>`
    }
  }
  // T1 edge variant: the treasury's pages have gilt fore-edges — rank D's rim
  // is GOLD-edged; the deeper ranks carry the house frost edge.
  const edgeCore = cfg.edge === 'gilt' ? NAVE_C.gilt : NAVE_C.frost
  s += `<path d="M 1 ${h} L 1 1 L ${w - 1} 1 L ${w - 1} ${h}" fill="none" stroke="${edgeCore}" stroke-width="4" opacity="0.95"/>`
  s += `<path d="M 1 ${h} L 1 1 L ${w - 1} 1 L ${w - 1} ${h}" fill="none" stroke="${NAVE_C.midnight}" stroke-width="1.4" opacity="0.5"/>`
  s += naveFrostDust(r, w, () => 3, 26)
  const defs =
    `<linearGradient id="rank-grad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${NAVE_C.tealHi}"/>` +
    `<stop offset="0.45" stop-color="${NAVE_C.teal}"/>` +
    `<stop offset="1" stop-color="${NAVE_C.base}"/></linearGradient>` +
    `<radialGradient id="rank-glow" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${NAVE_C.gilt}" stop-opacity="0.2"/>` +
    `<stop offset="0.55" stop-color="${NAVE_C.gilt}" stop-opacity="0.07"/>` +
    `<stop offset="1" stop-color="${NAVE_C.gilt}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="rank-base" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${NAVE_C.base}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${NAVE_C.base}" stop-opacity="0.82"/></linearGradient>` +
    // `clip-rule`, NOT `fill-rule`: a clipPath child's winding is governed by
    // clip-rule and renderers ignore fill-rule there. With only fill-rule set
    // the aperture subpath was unioned instead of subtracted, so the portal
    // rasterized SOLID and the runtime's alphaTest had nothing to cut — the
    // whole nested floor-theater read (bench §B) was painted shut.
    `<clipPath id="rank-clip"><path d="${sheet}" clip-rule="evenodd" fill-rule="evenodd"/></clipPath>`
  // the sheet itself is painted only inside the evenodd clip, so the arch
  // aperture rasterizes TRANSPARENT — the runtime alphaTest die-cuts it.
  return svgPiece(w, h, s, defs)
}

/** The apse silhouette (deterministic, shared by the face and its T4 back):
 *  five scalloped arcs over the central dome, crown wings flat at the world
 *  0.46-of-0.62 line. */
function apseSilPath(w, h) {
  const yWing = h * (1 - NAVE_APSE.crownFrac)
  const domeHw = w * NAVE_APSE.domeHwFrac
  const cx = w / 2
  let sil = `M 0 ${h} L 0 ${fx(yWing)} L ${fx(cx - domeHw)} ${fx(yWing)}`
  const scallops = 5
  for (let i = 0; i < scallops; i++) {
    const x0 = cx - domeHw + (2 * domeHw * i) / scallops
    const x1 = cx - domeHw + (2 * domeHw * (i + 1)) / scallops
    const mid = (x0 + x1) / 2
    const rise = h * (0.22 + 0.68 * Math.sin((Math.PI * (i + 0.5)) / scallops))
    sil += ` Q ${fx(mid)} ${fx(Math.max(4, yWing - rise))} ${fx(x1)} ${fx(yWing)}`
  }
  sil += ` L ${w} ${fx(yWing)} L ${w} ${h} Z`
  return { sil, yWing, domeHw, cx }
}

/** T4 print-backs: the rank sheet's reverse is plain shaded paper carrying
 *  the SAME die (aperture / dome scallop as alpha) — never mirrored art.
 *  Baked tiny (~100px/world); the merged oanave mesh points its back-face
 *  quads at these sprites on the same atlas page: zero extra draws. */
function naveRankBack(w, h, cfg) {
  const arch = naveArchPath(w, h, cfg.apHw, cfg.apApex)
  const sheet = `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z ${arch}`
  let s = `<path d="${sheet}" fill-rule="evenodd" fill="#12333c"/>`
  s += `<path d="${sheet}" fill-rule="evenodd" fill="${NAVE_C.midnight}" opacity="0.25"/>`
  return svgPiece(w, h, s)
}

function naveApseBack(w, h) {
  const { sil } = apseSilPath(w, h)
  return svgPiece(w, h, `<path d="${sil}" fill="#12333c"/><path d="${sil}" fill="${NAVE_C.midnight}" opacity="0.25"/>`)
}

/** The apse face (rank A): scalloped dome crown silhouette (alpha above the
 *  crown line), the aurora-rose window centred in the visible band, flat
 *  painted treasure tiers below (mostly hidden — cheap fills), frost dusting
 *  on the crown edge. The ONLY home of aurora mint/amethyst on the walls. */
function naveApseFace(w, h, seed) {
  const r = mulberry32(seed)
  const { sil, yWing, domeHw, cx } = apseSilPath(w, h)
  const wy = h * NAVE_APSE.roseCy
  const wr = w * NAVE_APSE.roseRw
  let s = `<g clip-path="url(#apse-clip)">`
  s += `<rect width="${w}" height="${h}" fill="url(#rank-grad-a)"/>`
  s += naveWall(w, h, r)
  s += naveWingPilasters(w, h, {})
  // flat painted treasure tiers below the sightline (bench: the apse lower
  // face is invisible through the portals — cheap fills, no vista wasted).
  for (let k = 0; k < 3; k++) {
    const y = h * (0.55 + k * 0.15)
    s += `<rect x="0" y="${fx(y)}" width="${w}" height="${fx(h * 0.05)}" fill="${NAVE_C.gold}" opacity="${fx(0.28 - k * 0.07)}"/>`
  }
  // THE BLOOM. The rose is the only light source the reader can see, so its
  // glow has to leave the window: a broad falloff across the whole apse plus a
  // warm ledge of light lying along the crown-wing line. That spill is what
  // makes rank A's crown — the 0.187-world band floating above the stack —
  // read as lit stone catching the window rather than as more dark teal.
  s += `<ellipse cx="${fx(cx)}" cy="${fx(wy)}" rx="${fx(w * 0.4)}" ry="${fx(h * 0.55)}" fill="url(#rose-bloom)"/>`
  s += `<rect x="0" y="${fx(yWing - h * 0.09)}" width="${w}" height="${fx(h * 0.2)}" fill="url(#crown-wash)"/>`
  // the aurora window: a half-round FAN seated on the crown line, hot frost/
  // gilt at the core and running out through mint to amethyst. Seated rather
  // than floating, it fills all five scallops from one source instead of being
  // sliced into a bowl by the dome clip.
  const fan = `M ${fx(cx - wr)} ${fx(wy)} A ${fx(wr)} ${fx(wr)} 0 0 1 ${fx(cx + wr)} ${fx(wy)} Z`
  s += `<path d="${fan}" fill="url(#rose-grad)"/>`
  for (let i = 1; i < 8; i++) {
    const a = Math.PI + (Math.PI * i) / 8
    s += `<line x1="${fx(cx)}" y1="${fx(wy)}" x2="${fx(cx + wr * Math.cos(a))}" y2="${fx(wy + wr * Math.sin(a))}" stroke="${NAVE_C.midnight}" stroke-width="2.4" opacity="0.4"/>`
  }
  for (const k of [0.36, 0.68]) {
    s += `<path d="M ${fx(cx - wr * k)} ${fx(wy)} A ${fx(wr * k)} ${fx(wr * k)} 0 0 1 ${fx(cx + wr * k)} ${fx(wy)}" fill="none" stroke="${NAVE_C.gilt}" stroke-width="2.8" opacity="0.85"/>`
  }
  s += `<path d="${fan}" fill="none" stroke="${NAVE_C.gold}" stroke-width="7"/>`
  s += `<path d="${fan}" fill="none" stroke="${NAVE_C.giltHi}" stroke-width="2.4"/>`
  // the gilt sill the fan stands on — the lit ledge running out along the crown
  s += `<line x1="0" y1="${fx(wy)}" x2="${w}" y2="${fx(wy)}" stroke="${NAVE_C.gold}" stroke-width="5" opacity="0.9"/>`
  s += `<line x1="0" y1="${fx(wy - 2.5)}" x2="${w}" y2="${fx(wy - 2.5)}" stroke="${NAVE_C.giltHi}" stroke-width="2" opacity="0.8"/>`
  s += `</g>`
  // frost cut edge along the whole scalloped crown + dusting beneath it.
  s += `<path d="${sil}" fill="none" stroke="${NAVE_C.frost}" stroke-width="4" opacity="0.95" stroke-linejoin="round"/>`
  s += `<path d="${sil}" fill="none" stroke="${NAVE_C.midnight}" stroke-width="1.4" opacity="0.5" stroke-linejoin="round"/>`
  s += naveFrostDust(r, w, (x) => (Math.abs(x - cx) < domeHw ? yWing - h * 0.4 : yWing), 40)
  const defs =
    `<linearGradient id="rank-grad-a" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${NAVE_C.tealHi}"/>` +
    `<stop offset="0.5" stop-color="${NAVE_C.teal}"/>` +
    `<stop offset="1" stop-color="${NAVE_C.base}"/></linearGradient>` +
    // The fan is a light SOURCE, so its core is white-hot and the saturated
    // aurora is pushed out to the rim: amethyst is the edge of the glass, not
    // the subject. (cy=1 so the gradient's centre sits on the fan's own seat.)
    `<radialGradient id="rose-grad" cx="0.5" cy="1" r="0.5">` +
    `<stop offset="0" stop-color="${NAVE_C.frost}"/>` +
    `<stop offset="0.3" stop-color="${NAVE_C.giltHi}"/>` +
    `<stop offset="0.5" stop-color="${NAVE_C.gilt}"/>` +
    `<stop offset="0.72" stop-color="${NAVE_C.mint}"/>` +
    `<stop offset="0.92" stop-color="${NAVE_C.amethyst}"/>` +
    `<stop offset="1" stop-color="#3a2c66"/></radialGradient>` +
    `<radialGradient id="rose-bloom" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${NAVE_C.giltHi}" stop-opacity="0.34"/>` +
    `<stop offset="0.3" stop-color="${NAVE_C.gilt}" stop-opacity="0.2"/>` +
    `<stop offset="0.62" stop-color="${NAVE_C.mint}" stop-opacity="0.09"/>` +
    `<stop offset="1" stop-color="${NAVE_C.mint}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="crown-wash" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${NAVE_C.giltHi}" stop-opacity="0.42"/>` +
    `<stop offset="0.45" stop-color="${NAVE_C.gilt}" stop-opacity="0.2"/>` +
    `<stop offset="1" stop-color="${NAVE_C.gilt}" stop-opacity="0"/></radialGradient>` +
    `<clipPath id="apse-clip"><path d="${sil}"/></clipPath>`
  return svgPiece(w, h, s, defs)
}

/** The clerk (T-COUNTERWEIGHT): kneeling over an open ledger, one candle —
 *  midnight coat, candle-gold face, 3/4 toward the coffer (image right).
 *  Painted on transparent ground; the stripflap shows both faces. */
function naveClerk(w, h, seed) {
  const r = mulberry32(seed)
  let s = `<g>`
  // candle glow halo behind everything
  s += `<circle cx="${fx(w * 0.72)}" cy="${fx(h * 0.52)}" r="${fx(w * 0.3)}" fill="url(#candle-glow)"/>`
  // kneeling body: coat sweeping to the floor, leaning forward over the book
  s += `<path d="M ${fx(w * 0.18)} ${fx(h * 0.97)} Q ${fx(w * 0.14)} ${fx(h * 0.6)} ${fx(w * 0.34)} ${fx(h * 0.42)} Q ${fx(w * 0.52)} ${fx(h * 0.28)} ${fx(w * 0.6)} ${fx(h * 0.46)} L ${fx(w * 0.56)} ${fx(h * 0.97)} Z" fill="${NAVE_C.midnight}" stroke="${NAVE_C.teal}" stroke-width="2"/>`
  // hood + candle-gold face, turned 3/4 to the right (toward the coffer)
  s += `<circle cx="${fx(w * 0.52)}" cy="${fx(h * 0.3)}" r="${fx(w * 0.13)}" fill="${NAVE_C.midnight}"/>`
  s += `<circle cx="${fx(w * 0.565)}" cy="${fx(h * 0.315)}" r="${fx(w * 0.085)}" fill="${NAVE_C.gilt}"/>`
  // reaching arm toward the ledger
  s += `<path d="M ${fx(w * 0.5)} ${fx(h * 0.5)} Q ${fx(w * 0.66)} ${fx(h * 0.56)} ${fx(w * 0.7)} ${fx(h * 0.72)}" fill="none" stroke="${NAVE_C.midnight}" stroke-width="${fx(w * 0.07)}" stroke-linecap="round"/>`
  // the open ledger on the floor
  s += `<path d="M ${fx(w * 0.52)} ${fx(h * 0.86)} L ${fx(w * 0.72)} ${fx(h * 0.79)} L ${fx(w * 0.92)} ${fx(h * 0.86)} L ${fx(w * 0.72)} ${fx(h * 0.93)} Z" fill="${NAVE_C.frost}" stroke="${NAVE_C.midnight}" stroke-width="2"/>`
  s += `<line x1="${fx(w * 0.72)}" y1="${fx(h * 0.79)}" x2="${fx(w * 0.72)}" y2="${fx(h * 0.93)}" stroke="${NAVE_C.midnight}" stroke-width="1.6" opacity="0.7"/>`
  for (const k of [0.82, 0.855, 0.885]) {
    s += `<line x1="${fx(w * 0.56)}" y1="${fx(h * k + 2)}" x2="${fx(w * 0.7)}" y2="${fx(h * (k - 0.02))}" stroke="${NAVE_C.teal}" stroke-width="1.2" opacity="0.8"/>`
  }
  // the candle: stick, flame, gold pool
  s += `<rect x="${fx(w * 0.8)}" y="${fx(h * 0.6)}" width="${fx(w * 0.05)}" height="${fx(h * 0.18)}" fill="${NAVE_C.frost}"/>`
  s += `<ellipse cx="${fx(w * 0.825)}" cy="${fx(h * 0.795)}" rx="${fx(w * 0.085)}" ry="${fx(h * 0.02)}" fill="${NAVE_C.gold}" opacity="0.8"/>`
  s += `<path d="M ${fx(w * 0.825)} ${fx(h * 0.5)} Q ${fx(w * 0.86)} ${fx(h * 0.55)} ${fx(w * 0.825)} ${fx(h * 0.59)} Q ${fx(w * 0.79)} ${fx(h * 0.55)} ${fx(w * 0.825)} ${fx(h * 0.5)} Z" fill="${NAVE_C.gilt}"/>`
  s += `<circle cx="${fx(w * 0.825)}" cy="${fx(h * 0.545)}" r="${fx(w * 0.02)}" fill="${NAVE_C.frost}"/>`
  s += `</g>`
  const defs =
    `<radialGradient id="candle-glow" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${NAVE_C.gold}" stop-opacity="0.5"/>` +
    `<stop offset="1" stop-color="${NAVE_C.gold}" stop-opacity="0"/></radialGradient>`
  s += `` // clerk figure stays inside its die — no rectangular rim (die-cut alpha)
  return svgPiece(w, h, s, defs)
}

/** The s7 page print — T-FLOOR, the refs' loudest norm: the gold lozenge
 *  processional path apron -> around the strongbox -> up the dais -> through
 *  the portal; pooled aurora-gold light on the axis ("light from the unseen
 *  window"); AO seat bands at every rank station; the gilt ribbon + key tag
 *  at the coffer hasp (the celebrated affordance); frost margin scatter. */
function navePage(w, h, seed) {
  const r = mulberry32(seed)
  const PX = (f) => f * w
  const PY = (f) => f * h
  let s = `<g>`
  s += `<rect width="${w}" height="${h}" fill="${NAVE_C.floor}"/>`
  // laid-stone tooth: faint teal course lines
  for (let i = 0; i < 150; i++) {
    const y = rr(r, 0, h)
    s += `<line x1="0" y1="${fx(y)}" x2="${w}" y2="${fx(y)}" stroke="${NAVE_C.teal}" stroke-width="1" opacity="${fx(rr(r, 0.04, 0.1))}"/>`
  }
  // AO seat bands at every rank station (T3) — the nave's depth laid into
  // the ground even where the paper is cut away.
  for (const z of [-0.52, -0.3, -0.08, 0.157]) {
    const fy = pageFY(z)
    s += `<rect x="0" y="${fx(PY(fy) - 8)}" width="${w}" height="16" fill="#000000" opacity="0.38"/>`
  }
  // Pooled aurora-gold light through the portals (z -0.05 .. -0.32 on axis) —
  // the floor theater IS the vista (bench §B: the apse face is invisible
  // through the portals), so this pool is the whole payoff of looking down the
  // axis and it has to be the brightest thing on the print. A wide spill halo
  // carries it out to the rank seats; the hot core sits on the axis.
  s += `<ellipse cx="${fx(PX(0.5))}" cy="${fx(PY(pageFY(-0.185)))}" rx="${fx(PX(0.3))}" ry="${fx(PY(0.2))}" fill="url(#spill-grad)"/>`
  s += `<ellipse cx="${fx(PX(0.5))}" cy="${fx(PY(pageFY(-0.185)))}" rx="${fx(PX(0.18))}" ry="${fx(PY(0.12))}" fill="url(#pool-grad)"/>`
  // the throat: light spilling forward through rank D's mouth onto the dais
  // approach, so the portal reads as an opening onto light, not a dark hole.
  s += `<ellipse cx="${fx(PX(0.5))}" cy="${fx(PY(pageFY(0.06)))}" rx="${fx(PX(0.1))}" ry="${fx(PY(0.075))}" fill="url(#throat-grad)"/>`
  // the gold processional path: apron (bottom centre) -> splits around the
  // strongbox (z 0.38..0.5, |x| <= 0.095 world) -> dais -> through the
  // mouth to the pooled light. Two smooth ribbons (main left lobe + a
  // fainter right lobe), each ONE bezier path with butt caps so the split
  // reads as an inlay parting around the waystation, not lumped capsules;
  // perspective narrowing in two width steps at the dais.
  const yApron = PY(1.0)
  const y56 = PY(pageFY(0.56))
  const y50 = PY(pageFY(0.5))
  const y38 = PY(pageFY(0.38))
  const y32 = PY(pageFY(0.32))
  const yEnd = PY(pageFY(-0.32))
  const xC = PX(0.5)
  const xL = PX(0.44)
  const xR = PX(0.565)
  const mainD =
    `M ${fx(xC)} ${fx(y56)} ` +
    `C ${fx(xC)} ${fx((y56 + y50) / 2)} ${fx(xL)} ${fx(y56)} ${fx(xL)} ${fx(y50)} ` +
    `L ${fx(xL)} ${fx(y38)} ` +
    `C ${fx(xL)} ${fx((y38 + y32) / 2)} ${fx(xC)} ${fx(y38)} ${fx(xC)} ${fx(y32)}`
  const lobeD =
    `M ${fx(xC)} ${fx(y56)} ` +
    `C ${fx(xC)} ${fx((y56 + y50) / 2)} ${fx(xR)} ${fx(y56)} ${fx(xR)} ${fx(y50)} ` +
    `L ${fx(xR)} ${fx(y38)} ` +
    `C ${fx(xR)} ${fx((y38 + y32) / 2)} ${fx(xC)} ${fx(y38)} ${fx(xC)} ${fx(y32)}`
  // the full-width trunk on the apron, HALVED into the two lobes at the
  // fork (the inlay parts around the box, it does not double), rejoining
  // into the narrowed nave run.
  s += `<line x1="${fx(xC)}" y1="${fx(yApron)}" x2="${fx(xC)}" y2="${fx(y56)}" stroke="${NAVE_C.gold}" stroke-width="${fx(PX(0.072))}" opacity="0.74"/>`
  s += `<path d="${mainD}" fill="none" stroke="${NAVE_C.gold}" stroke-width="${fx(PX(0.04))}" opacity="0.74" stroke-linejoin="round"/>`
  s += `<path d="${lobeD}" fill="none" stroke="${NAVE_C.gold}" stroke-width="${fx(PX(0.03))}" opacity="0.4" stroke-linejoin="round"/>`
  s += `<line x1="${fx(xC)}" y1="${fx(y32)}" x2="${fx(xC)}" y2="${fx(yEnd)}" stroke="${NAVE_C.gold}" stroke-width="${fx(PX(0.048))}" opacity="0.82"/>`
  // gold lozenge inlay down the path centreline (painted-perspective narrowing)
  for (let i = 0; i < 26; i++) {
    const t = i / 26
    const fy = 1 - t * (1 - pageFY(-0.3))
    const size = PX(0.016) * (1 - 0.55 * t)
    const cxx = PX(0.5) + (fy > pageFY(0.38) && fy < pageFY(0.52) ? -PX(0.06) : 0)
    s += `<path d="M ${fx(cxx)} ${fx(PY(fy) - size)} L ${fx(cxx + size)} ${fx(PY(fy))} L ${fx(cxx)} ${fx(PY(fy) + size)} L ${fx(cxx - size)} ${fx(PY(fy))} Z" fill="${NAVE_C.giltHi}" opacity="${fx(rr(r, 0.78, 1))}"/>`
  }
  // the gutter valley shadow
  s += `<rect x="${fx(w * 0.47)}" y="0" width="${fx(w * 0.06)}" height="${h}" fill="#000000" opacity="0.14"/>`
  // gilt ribbon + key tag at the coffer hasp (right page d~0.68, z~0.02):
  // right page runs image x 0.5 -> 1.0 over d 0 -> 1.05.
  const hx = PX(0.5 + 0.68 / 2.1)
  const hy = PY(pageFY(0.02))
  s += `<line x1="${fx(hx - PX(0.05))}" y1="${fx(hy + PY(0.03))}" x2="${fx(hx)}" y2="${fx(hy)}" stroke="${NAVE_C.gilt}" stroke-width="5" opacity="0.9"/>`
  s += `<circle cx="${fx(hx)}" cy="${fx(hy)}" r="7" fill="none" stroke="${NAVE_C.gilt}" stroke-width="3.4"/>`
  s += `<line x1="${fx(hx + 7)}" y1="${fx(hy)}" x2="${fx(hx + 17)}" y2="${fx(hy)}" stroke="${NAVE_C.gilt}" stroke-width="3.4"/>`
  s += `<line x1="${fx(hx + 13)}" y1="${fx(hy)}" x2="${fx(hx + 13)}" y2="${fx(hy + 5)}" stroke="${NAVE_C.gilt}" stroke-width="3"/>`
  // frost margin scatter
  for (let i = 0; i < 90; i++) {
    const edge = r() < 0.5
    const x = edge ? rr(r, 0, w * 0.1) : rr(r, w * 0.9, w)
    s += `<circle cx="${fx(x)}" cy="${fx(rr(r, 0, h))}" r="${fx(rr(r, 0.8, 2.4))}" fill="${NAVE_C.frost}" opacity="${fx(rr(r, 0.15, 0.5))}"/>`
  }
  s += `</g>`
  const defs =
    `<radialGradient id="pool-grad" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${NAVE_C.giltHi}" stop-opacity="0.95"/>` +
    `<stop offset="0.3" stop-color="${NAVE_C.gilt}" stop-opacity="0.72"/>` +
    `<stop offset="0.62" stop-color="${NAVE_C.mint}" stop-opacity="0.42"/>` +
    `<stop offset="1" stop-color="${NAVE_C.amethyst}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="spill-grad" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${NAVE_C.gilt}" stop-opacity="0.34"/>` +
    `<stop offset="0.55" stop-color="${NAVE_C.mint}" stop-opacity="0.16"/>` +
    `<stop offset="1" stop-color="${NAVE_C.amethyst}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="throat-grad" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${NAVE_C.giltHi}" stop-opacity="0.6"/>` +
    `<stop offset="0.5" stop-color="${NAVE_C.gold}" stop-opacity="0.3"/>` +
    `<stop offset="1" stop-color="${NAVE_C.gold}" stop-opacity="0"/></radialGradient>`
  return svgPiece(w, h, s, defs)
}

/** THE DAIS FLIGHT (ch6-steps-strut): the mirror-bridge's strut faces painted
 *  as a carved stone stair with gilt nosings.
 *
 *  Struts default to raw kraft, and on this spread that was the whole problem:
 *  in a midnight-teal nave the two pale tan trusses were the brightest mass
 *  below the arches, so the dais read as scaffolding holding the picture up
 *  rather than as the step the processional path climbs. Painting them costs
 *  nothing at runtime (the layer already samples one texture per face) and
 *  fixes the value order twice over — the field drops to nave-wall value, and
 *  the only bright thing left on the piece is gold that belongs to the story.
 *
 *  Identity uvs on strut faces, so this one sheet serves strutL and strutR;
 *  the layer shades the right-hand sibling on its own. Treads run across the
 *  sheet so the flight reads as steps at any strut lean. */
function naveStepRiser(w, h, seed) {
  const r = mulberry32(seed)
  const N = 4
  const sh = h / N
  let s = `<rect width="${w}" height="${h}" fill="${naveMix(NAVE_C.base, NAVE_C.teal, 0.55)}"/>`
  for (let i = 0; i < N; i++) {
    const y0 = i * sh
    // the riser: darker the deeper it sits in the flight
    s += `<rect x="0" y="${fx(y0)}" width="${w}" height="${fx(sh)}" fill="${naveMix(NAVE_C.base, NAVE_C.tealLit, 0.72 - 0.5 * (i / N))}"/>`
    // the nosing — a gold tread edge with a lit top and its own cast shadow
    s += `<rect x="0" y="${fx(y0)}" width="${w}" height="${fx(sh * 0.2)}" fill="${NAVE_C.gold}"/>`
    s += `<rect x="0" y="${fx(y0)}" width="${w}" height="${fx(sh * 0.06)}" fill="${NAVE_C.giltHi}" opacity="0.9"/>`
    s += `<rect x="0" y="${fx(y0 + sh * 0.2)}" width="${w}" height="${fx(sh * 0.1)}" fill="${NAVE_C.base}" opacity="0.75"/>`
    // carved lozenges down the riser face (the treasury's inlay, quiet)
    const n = 4
    for (let k = 0; k < n; k++) {
      const cx = (w * (k + 0.5)) / n + rr(r, -3, 3)
      const cy = y0 + sh * 0.65
      const q = Math.min(w / n, sh) * 0.2
      s += `<path d="M ${fx(cx)} ${fx(cy - q)} L ${fx(cx + q)} ${fx(cy)} L ${fx(cx)} ${fx(cy + q)} L ${fx(cx - q)} ${fx(cy)} Z" fill="${NAVE_C.gold}" opacity="0.42"/>`
      s += `<path d="M ${fx(cx)} ${fx(cy - q)} L ${fx(cx + q)} ${fx(cy)}" fill="none" stroke="${NAVE_C.gilt}" stroke-width="1.4" opacity="0.7"/>`
    }
  }
  // gilt stringers down both jambs of the flight
  for (const x of [0, w * 0.965]) {
    s += `<rect x="${fx(x)}" y="0" width="${fx(w * 0.035)}" height="${h}" fill="${NAVE_C.gold}" opacity="0.85"/>`
    s += `<rect x="${fx(x)}" y="0" width="${fx(w * 0.012)}" height="${h}" fill="${NAVE_C.giltHi}" opacity="0.8"/>`
  }
  return svgPiece(w, h, s)
}

// E3 s6 — THE BAZAAR OF A THOUSAND STALLS (scenes/s6-scene-pack.md §4f).
// Late-morning rose gold: rose stone / deep terracotta / sand parchment, with
// saffron lantern-and-spice accents and market-teal awning stripes against
// cream. Walnut ink carries ALL linework and doodles (house law); the pale
// core cut edge (T1, rimPath) rides the die-cut plates and figure chains
// only. Deterministic: mulberry32(seed), no Math.random (golden-safe).
// ============================================================================

const BAZ = {
  rose: '#c4766a',
  roseLit: '#d99384',
  roseDim: '#9a564b',
  terra: '#a63d2f',
  terraDim: '#7e2d22',
  sand: '#e7d5a8',
  sandLit: '#f0e2bd',
  sandDim: '#cdb37e',
  saffron: '#e0a33c',
  saffronLit: '#f2c46a',
  teal: '#3f7d74',
  tealDim: '#2f5f59',
  cream: '#f2e8cf',
  skin: '#c9996b',
}
// One shared stripe cadence for EVERY awning in the spread (plates, souk
// wings, raise-stall deck): stripes per bay — the painted registration that
// bridges the plate/souk seam (pack risk 4).
const BAZ_STRIPES_PER_BAY = 7

/** A teal/cream awning band with a scalloped bottom edge. (x,y) is the band's
 *  top-left in px; scallops hang below y+bh. */
function bazAwning(x, y, bw, bh, r, phase = 0) {
  let s = ''
  const n = BAZ_STRIPES_PER_BAY
  const sw = bw / n
  for (let i = 0; i < n; i++) {
    s += `<rect x="${fx(x + i * sw)}" y="${fx(y)}" width="${fx(sw + 0.5)}" height="${fx(bh)}" fill="${(i + phase) % 2 ? BAZ.cream : BAZ.teal}"/>`
  }
  // scallop hem: one half-disc per stripe, colour-matched
  for (let i = 0; i < n; i++) {
    const cx = x + (i + 0.5) * sw
    s += `<path d="M ${fx(cx - sw / 2)} ${fx(y + bh)} A ${fx(sw / 2)} ${fx(sw * 0.42)} 0 0 0 ${fx(cx + sw / 2)} ${fx(y + bh)} Z" fill="${(i + phase) % 2 ? BAZ.cream : BAZ.teal}"/>`
  }
  s += `<line x1="${fx(x)}" y1="${fx(y)}" x2="${fx(x + bw)}" y2="${fx(y)}" stroke="${INK}" stroke-width="1.8" opacity="0.55"/>`
  s += `<line x1="${fx(x)}" y1="${fx(y + bh)}" x2="${fx(x + bw)}" y2="${fx(y + bh)}" stroke="${INK}" stroke-width="1.2" opacity="0.3"/>`
  void r
  return s
}

/** A hanging saffron market lantern (diamond body, finial + tassel), sized s px. */
function bazLantern(cx, cy, s) {
  return (
    `<path d="M ${fx(cx)} ${fx(cy - s * 0.55)} L ${fx(cx + s * 0.42)} ${fx(cy)} L ${fx(cx)} ${fx(cy + s * 0.55)} L ${fx(cx - s * 0.42)} ${fx(cy)} Z" fill="${BAZ.saffron}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.6"/>` +
    `<path d="M ${fx(cx)} ${fx(cy - s * 0.32)} L ${fx(cx + s * 0.22)} ${fx(cy)} L ${fx(cx)} ${fx(cy + s * 0.32)} L ${fx(cx - s * 0.22)} ${fx(cy)} Z" fill="${BAZ.saffronLit}"/>` +
    `<line x1="${fx(cx)}" y1="${fx(cy + s * 0.55)}" x2="${fx(cx)}" y2="${fx(cy + s * 0.75)}" stroke="${INK}" stroke-width="1.3" opacity="0.6"/>`
  )
}

/** Rose/sand ashlar coursing over a rect — the arc walls' sliver faces. */
function bazCourses(w, h, seed, base, lit) {
  const r = mulberry32(seed)
  let s = `<rect width="${w}" height="${h}" fill="${base}"/>`
  s += `<rect width="${w}" height="${fx(h * 0.16)}" fill="${lit}" opacity="0.5"/>`
  const rows = Math.max(3, Math.round(h / 26))
  for (let i = 1; i <= rows; i++) {
    const cy = (i / rows) * h
    s += `<line x1="0" y1="${fx(cy)}" x2="${w}" y2="${fx(cy)}" stroke="${INK}" stroke-width="1.5" opacity="${fx(rr(r, 0.18, 0.32))}"/>`
    const cols = 9
    for (let b = 0; b < cols; b++) {
      const jx = ((b + (i % 2 ? 0.5 : 0)) / cols) * w
      s += `<line x1="${fx(jx)}" y1="${fx(cy)}" x2="${fx(jx)}" y2="${fx(cy - h / rows)}" stroke="${INK}" stroke-width="1.2" opacity="0.2"/>`
    }
  }
  s += `<rect width="${w}" height="${h}" fill="${INK}" opacity="0.06"/>`
  return svgPiece(w, h, s)
}

/** Awning tops seen from above (the arc lids at the lid-dominant camera):
 *  canvas stripes running along the roof with seam lines and sun bleach. */
function bazAwningTopFace(w, h, seed) {
  const r = mulberry32(seed)
  let s = `<rect width="${w}" height="${h}" fill="${BAZ.cream}"/>`
  const n = Math.max(10, Math.round(w / 36))
  for (let i = 0; i < n; i++) {
    if (i % 2) s += `<rect x="${fx((i / n) * w)}" y="0" width="${fx(w / n + 0.5)}" height="${h}" fill="${BAZ.teal}"/>`
  }
  // ridge seam + eave shadows across the stripes
  s += `<line x1="0" y1="${fx(h * 0.5)}" x2="${w}" y2="${fx(h * 0.5)}" stroke="${INK}" stroke-width="2" opacity="0.35"/>`
  s += `<rect width="${w}" height="${fx(h * 0.12)}" fill="${INK}" opacity="0.12"/>`
  s += `<rect y="${fx(h * 0.88)}" width="${w}" height="${fx(h * 0.12)}" fill="${INK}" opacity="0.12"/>`
  for (let i = 0; i < 14; i++) {
    s += `<rect x="${fx(rr(r, 0, w))}" y="${fx(rr(r, 0.15, 0.8) * h)}" width="${fx(rr(r, 8, 26))}" height="${fx(rr(r, 2, 4))}" fill="${BAZ.sandLit}" opacity="0.5"/>`
  }
  return svgPiece(w, h, s)
}

/** One painted stall bay (door arch, awning, gable field) between x0..x1 with
 *  eave at eaveY px — shared by the arc plates and the souk rows. */
function bazStallBay(x0, x1, baseY, eaveY, r, phase) {
  const bw = x1 - x0
  let s = ''
  // wall wash, alternating warmth
  s += `<rect x="${fx(x0)}" y="${fx(eaveY)}" width="${fx(bw)}" height="${fx(baseY - eaveY)}" fill="${phase % 2 ? BAZ.rose : BAZ.roseLit}"/>`
  // door arch, deep terracotta with a saffron glow inside
  const dw = bw * rr(r, 0.3, 0.36)
  const dx = x0 + bw / 2 - dw / 2
  const dh = (baseY - eaveY) * rr(r, 0.5, 0.6)
  s += `<path d="M ${fx(dx)} ${fx(baseY)} L ${fx(dx)} ${fx(baseY - dh * 0.6)} Q ${fx(dx + dw / 2)} ${fx(baseY - dh * 1.25)} ${fx(dx + dw)} ${fx(baseY - dh * 0.6)} L ${fx(dx + dw)} ${fx(baseY)} Z" fill="${BAZ.terraDim}" stroke="${INK}" stroke-width="1.8" stroke-opacity="0.55"/>`
  s += `<path d="M ${fx(dx + dw * 0.2)} ${fx(baseY)} L ${fx(dx + dw * 0.2)} ${fx(baseY - dh * 0.5)} Q ${fx(dx + dw / 2)} ${fx(baseY - dh)} ${fx(dx + dw * 0.8)} ${fx(baseY - dh * 0.5)} L ${fx(dx + dw * 0.8)} ${fx(baseY)} Z" fill="${BAZ.saffron}" opacity="0.55"/>`
  // the awning across the bay, hem hanging over the door
  s += bazAwning(x0 + bw * 0.06, eaveY + (baseY - eaveY) * 0.06, bw * 0.88, (baseY - eaveY) * 0.2, r, phase)
  // goods at the plinth: a basket and a spice cone
  const gy = baseY - 2
  const b1 = x0 + bw * rr(r, 0.12, 0.2)
  s += `<path d="M ${fx(b1)} ${fx(gy)} L ${fx(b1 + bw * 0.14)} ${fx(gy)} L ${fx(b1 + bw * 0.115)} ${fx(gy - bw * 0.1)} L ${fx(b1 + bw * 0.025)} ${fx(gy - bw * 0.1)} Z" fill="${BAZ.sandDim}" stroke="${INK}" stroke-width="1.3" stroke-opacity="0.55"/>`
  const c1 = x0 + bw * rr(r, 0.68, 0.78)
  s += `<path d="M ${fx(c1)} ${fx(gy)} L ${fx(c1 + bw * 0.11)} ${fx(gy)} L ${fx(c1 + bw * 0.055)} ${fx(gy - bw * 0.14)} Z" fill="${phase % 2 ? BAZ.saffron : BAZ.terra}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.5"/>`
  return s
}

/** THE REAR / INNER STALL-ARC FACADE PLATES (ch5-arc-{rear,inner}-arc-front).
 *  Die-cut coplanar plates on the arc caps: the ALPHA is the silhouette (no
 *  outline sidecar — the raven/plate idiom). u 0.5 sits ON the spine crease
 *  (plate UVs run crease -> outer), so the composition is centred: the REAR
 *  plate carries 7 linked stall gables around the gate-minaret (top of the
 *  die-cut at the pack's 0.55 world = image top), with the old lantern pair
 *  re-seated as DIE-CUT lantern strings swagged between the gable finials;
 *  the INNER plate is 5 nearer, larger stall fronts under one scalloped
 *  awning row. */
function bazArcPlate(w, h, seed, kind) {
  const r = mulberry32(seed)
  const X = (u) => u * w
  const Y = (v) => (1 - v) * h

  const isRear = kind === 'rear'
  // bay edges in u (v-up fractions); rear leaves the centre to the minaret
  const bays = isRear
    ? [
        [0.0, 0.155], [0.155, 0.31], [0.31, 0.452],
        [0.548, 0.665], [0.665, 0.78], [0.78, 0.892], [0.892, 1.0],
      ]
    : [[0.0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.0]]
  const eaveV = isRear ? 0.42 : 0.52
  const peakVs = bays.map(() => (isRear ? rr(r, 0.52, 0.62) : rr(r, 0.72, 0.8)))

  // ---- the die-cut contour: plinth -> gables (or awning crowns) -> plinth,
  // with the minaret rising between the rear bays.
  const pts = [[0, 0], [0, eaveV]]
  const gable = (b, i) => {
    const [u0, u1] = b
    const um = (u0 + u1) / 2
    if (isRear) {
      pts.push([u0 + (u1 - u0) * 0.06, eaveV], [um, peakVs[i]], [u1 - (u1 - u0) * 0.06, eaveV])
    } else {
      // the inner arc's crown is its awning slab: a shallow camber per bay
      pts.push([u0 + 0.012, eaveV], [u0 + 0.02, peakVs[i] - 0.05], [um, peakVs[i]], [u1 - 0.02, peakVs[i] - 0.05], [u1 - 0.012, eaveV])
    }
  }
  if (isRear) {
    bays.slice(0, 3).forEach((b, i) => gable(b, i))
    // THE GATE-MINARET (the one modest vertical, top y 0.55 world = v 1 here):
    // shaft, corbelled balcony, onion dome, finial.
    pts.push(
      [0.452, eaveV], [0.462, 0.66], [0.472, 0.66], [0.472, 0.8],
      [0.452, 0.8], [0.452, 0.855], [0.472, 0.855],
      [0.478, 0.9], [0.487, 0.955], [0.5, 0.985],
      [0.513, 0.955], [0.522, 0.9], [0.528, 0.855],
      [0.548, 0.855], [0.548, 0.8], [0.528, 0.8], [0.528, 0.66], [0.538, 0.66], [0.548, eaveV]
    )
    bays.slice(3).forEach((b, i) => gable(b, i + 3))
  } else {
    bays.forEach((b, i) => gable(b, i))
  }
  pts.push([1, eaveV], [1, 0])
  const outline = simplifyOutline(pts)
  const d = outline.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'

  let g = `<g clip-path="url(#bazPlateCut)">`
  g += `<rect width="${w}" height="${h}" fill="${BAZ.rose}"/>`
  // plinth
  g += `<rect y="${fx(Y(0.07))}" width="${w}" height="${fx(h * 0.07)}" fill="${BAZ.sandDim}"/>`
  g += `<line x1="0" y1="${fx(Y(0.07))}" x2="${w}" y2="${fx(Y(0.07))}" stroke="${INK}" stroke-width="1.6" opacity="0.4"/>`
  // bays
  bays.forEach((b, i) => {
    g += bazStallBay(X(b[0]), X(b[1]), Y(0.07), Y(eaveV * (isRear ? 1 : 0.98)), r, i)
    // gable / awning-crown field above the eave
    const um = (b[0] + b[1]) / 2
    if (isRear) {
      g += `<path d="M ${fx(X(b[0]))} ${fx(Y(eaveV))} L ${fx(X(um))} ${fx(Y(peakVs[i]))} L ${fx(X(b[1]))} ${fx(Y(eaveV))} Z" fill="${i % 2 ? BAZ.roseLit : BAZ.rose}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.5"/>`
      g += `<circle cx="${fx(X(um))}" cy="${fx(Y(eaveV) - (Y(eaveV) - Y(peakVs[i])) * 0.45)}" r="${fx(w * 0.011)}" fill="${BAZ.saffron}" stroke="${INK}" stroke-width="1.3" stroke-opacity="0.55"/>`
    } else {
      // the awning slab IS the crown: stripe it edge to edge
      g += bazAwning(X(b[0] + 0.012), Y(peakVs[i]), X(b[1] - b[0] - 0.024), (Y(eaveV) - Y(peakVs[i])) * 0.92, r, i)
    }
  })
  if (isRear) {
    // minaret paint: sand shaft, slit windows, balcony, terracotta dome ribs
    g += `<rect x="${fx(X(0.462))}" y="${fx(Y(0.8))}" width="${fx(X(0.066))}" height="${fx(Y(eaveV) - Y(0.8))}" fill="${BAZ.sand}"/>`
    g += `<rect x="${fx(X(0.452))}" y="${fx(Y(0.855))}" width="${fx(X(0.096))}" height="${fx(Y(0.8) - Y(0.855))}" fill="${BAZ.sandDim}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.5"/>`
    for (const wv of [0.56, 0.68]) {
      g += `<rect x="${fx(X(0.489))}" y="${fx(Y(wv + 0.055))}" width="${fx(X(0.022))}" height="${fx(Y(wv) - Y(wv + 0.055))}" rx="${fx(w * 0.008)}" fill="${BAZ.saffron}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.5"/>`
    }
    g += `<path d="M ${fx(X(0.478))} ${fx(Y(0.9))} Q ${fx(X(0.5))} ${fx(Y(1.02))} ${fx(X(0.522))} ${fx(Y(0.9))} Z" fill="${BAZ.terra}"/>`
    for (const rv of [0.489, 0.5, 0.511]) g += `<line x1="${fx(X(rv))}" y1="${fx(Y(0.9))}" x2="${fx(X(0.5))}" y2="${fx(Y(0.985))}" stroke="${BAZ.cream}" stroke-width="1.4" opacity="0.6"/>`
    // THE GATE at its base — the arch the hero walked home through
    g += `<path d="M ${fx(X(0.462))} ${fx(Y(0.07))} L ${fx(X(0.462))} ${fx(Y(0.3))} Q ${fx(X(0.5))} ${fx(Y(0.44))} ${fx(X(0.538))} ${fx(Y(0.3))} L ${fx(X(0.538))} ${fx(Y(0.07))} Z" fill="${INK}" opacity="0.82"/>`
    g += `<path d="M ${fx(X(0.472))} ${fx(Y(0.07))} L ${fx(X(0.472))} ${fx(Y(0.27))} Q ${fx(X(0.5))} ${fx(Y(0.39))} ${fx(X(0.528))} ${fx(Y(0.27))} L ${fx(X(0.528))} ${fx(Y(0.07))} Z" fill="url(#bazGateGlow)"/>`
  } else {
    // hanging goods dangling BELOW the bay awning hems, beside the doors:
    // copper pots on cords and rolled rugs (the eye-test moved them down off
    // the awning band where the first bake parked them).
    bays.forEach((b, i) => {
      const um = X((b[0] + b[1]) / 2)
      const hangTop = Y(0.4)
      if (i % 3 === 0) {
        g += `<line x1="${fx(um - w * 0.055)}" y1="${fx(hangTop)}" x2="${fx(um - w * 0.055)}" y2="${fx(hangTop + h * 0.05)}" stroke="${INK}" stroke-width="1.4" opacity="0.65"/>`
        g += `<ellipse cx="${fx(um - w * 0.055)}" cy="${fx(hangTop + h * 0.095)}" rx="${fx(w * 0.024)}" ry="${fx(h * 0.05)}" fill="${BAZ.saffron}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.55"/>`
        g += `<ellipse cx="${fx(um - w * 0.062)}" cy="${fx(hangTop + h * 0.08)}" rx="${fx(w * 0.008)}" ry="${fx(h * 0.018)}" fill="${BAZ.saffronLit}"/>`
      }
      if (i % 3 === 1) {
        g += `<line x1="${fx(um + w * 0.05)}" y1="${fx(hangTop)}" x2="${fx(um + w * 0.05)}" y2="${fx(hangTop + h * 0.04)}" stroke="${INK}" stroke-width="1.4" opacity="0.65"/>`
        g += `<rect x="${fx(um + w * 0.038)}" y="${fx(hangTop + h * 0.04)}" width="${fx(w * 0.024)}" height="${fx(h * 0.13)}" rx="${fx(w * 0.01)}" fill="${BAZ.terra}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.5"/>`
        g += `<rect x="${fx(um + w * 0.038)}" y="${fx(hangTop + h * 0.08)}" width="${fx(w * 0.024)}" height="${fx(h * 0.022)}" fill="${BAZ.cream}"/>`
        g += `<rect x="${fx(um + w * 0.038)}" y="${fx(hangTop + h * 0.125)}" width="${fx(w * 0.024)}" height="${fx(h * 0.022)}" fill="${BAZ.cream}"/>`
      }
    })
  }
  // late-morning shade
  g += `<rect width="${w}" height="${h}" fill="url(#bazShade)"/>`
  g += `</g>`

  // ---- DIE-CUT LANTERN STRINGS (rear only): swagged between the gable
  // finials and converging on the minaret balcony — drawn OUTSIDE the clip so
  // the strings + lanterns carry their own alpha above the roofline.
  if (isRear) {
    const anchors = bays.map((b, i) => [(b[0] + b[1]) / 2, peakVs[i]])
    anchors.splice(3, 0, [0.5, 0.84]) // the minaret balcony joins the run
    for (let i = 0; i + 1 < anchors.length; i++) {
      const [ua, va] = anchors[i]
      const [ub, vb] = anchors[i + 1]
      const dipV = Math.min(va, vb) - rr(r, 0.07, 0.095)
      g += `<path d="M ${fx(X(ua))} ${fx(Y(va))} Q ${fx(X((ua + ub) / 2))} ${fx(Y(dipV))} ${fx(X(ub))} ${fx(Y(vb))}" fill="none" stroke="${INK}" stroke-width="2.4" opacity="0.85"/>`
      const nL = 2 + (i % 2)
      for (let k = 1; k <= nL; k++) {
        const t = k / (nL + 1)
        const uu = (1 - t) * (1 - t) * ua + 2 * (1 - t) * t * ((ua + ub) / 2) + t * t * ub
        const vv = (1 - t) * (1 - t) * va + 2 * (1 - t) * t * dipV + t * t * vb
        g += bazLantern(X(uu), Y(vv) + w * 0.012, w * 0.018)
      }
    }
  }

  const defs =
    `<clipPath id="bazPlateCut"><path d="${d}"/></clipPath>` +
    `<radialGradient id="bazGateGlow" cx="0.5" cy="0.85" r="0.9">` +
    `<stop offset="0" stop-color="${BAZ.saffronLit}"/><stop offset="0.55" stop-color="${BAZ.saffron}"/>` +
    `<stop offset="1" stop-color="${BAZ.terraDim}"/></radialGradient>` +
    `<linearGradient id="bazShade" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${BAZ.sandLit}" stop-opacity="0.16"/>` +
    `<stop offset="0.55" stop-color="#000000" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0.3"/></linearGradient>`

  return svgPiece(w, h, g + rimPath(d, 5), defs)
}

/** THE SOUK WINGS (ch5-souk-*): shaped-mesh strips (outline sidecar) carrying
 *  the arcs out to the page edges — row 0 echoes the rear arc's gable rhythm,
 *  row 1 the inner arc's awning crowns, stripe cadence matched to the plates. */
function soukRow({ seed, w, h, row, mirror }) {
  const r = mulberry32(seed)
  const X = (u) => u * w
  const Y = (v) => (1 - v) * h
  const stalls = row === 0 ? 4 : 3
  const eaveV = row === 0 ? 0.5 : 0.56
  const bays = []
  for (let i = 0; i < stalls; i++) bays.push([i / stalls, (i + 1) / stalls])
  const peakVs = bays.map(() => (row === 0 ? rr(r, 0.72, 0.9) : rr(r, 0.76, 0.86)))

  let pts = [[0, 0], [0, eaveV]]
  bays.forEach((b, i) => {
    const um = (b[0] + b[1]) / 2
    if (row === 0) {
      pts.push([b[0] + 0.015, eaveV], [um, peakVs[i]], [b[1] - 0.015, eaveV])
    } else {
      pts.push([b[0] + 0.01, eaveV], [b[0] + 0.02, peakVs[i] - 0.05], [um, peakVs[i]], [b[1] - 0.02, peakVs[i] - 0.05], [b[1] - 0.01, eaveV])
    }
  })
  pts.push([1, eaveV], [1, 0])
  if (mirror) pts = pts.map(([u, v]) => [1 - u, v]).reverse()
  const outline = simplifyOutline(pts)
  const d = outline.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'

  let g = `<g clip-path="url(#soukCut)">`
  g += `<rect width="${w}" height="${h}" fill="${BAZ.rose}"/>`
  g += `<rect y="${fx(Y(0.08))}" width="${w}" height="${fx(h * 0.08)}" fill="${BAZ.sandDim}"/>`
  const painted = mirror ? bays.map(([a, b]) => [1 - b, 1 - a]).reverse() : bays
  painted.forEach((b, i) => {
    g += bazStallBay(X(b[0]), X(b[1]), Y(0.08), Y(eaveV), r, i + row)
    const um = (b[0] + b[1]) / 2
    const pv = peakVs[mirror ? painted.length - 1 - i : i]
    if (row === 0) {
      g += `<path d="M ${fx(X(b[0]))} ${fx(Y(eaveV))} L ${fx(X(um))} ${fx(Y(pv))} L ${fx(X(b[1]))} ${fx(Y(eaveV))} Z" fill="${i % 2 ? BAZ.roseLit : BAZ.rose}" stroke="${INK}" stroke-width="1.5" stroke-opacity="0.5"/>`
      g += `<circle cx="${fx(X(um))}" cy="${fx((Y(eaveV) + Y(pv)) / 2)}" r="${fx(w * 0.012)}" fill="${BAZ.saffron}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.5"/>`
    } else {
      g += bazAwning(X(b[0] + 0.012), Y(pv), X(b[1] - b[0] - 0.024), (Y(eaveV) - Y(pv)) * 0.9, r, i)
    }
  })
  g += `<rect width="${w}" height="${h}" fill="url(#soukShade)"/>`
  g += `</g>`

  const defs =
    `<clipPath id="soukCut"><path d="${d}"/></clipPath>` +
    `<linearGradient id="soukShade" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${BAZ.sandLit}" stop-opacity="0.14"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0.32"/></linearGradient>`

  return { outline, svg: svgPiece(w, h, g + rimPath(d, 4), defs) }
}

/** A rose/sand tone paled toward the haze the far city dissolves into (t=0 the
 *  near colour, t=1 nearly BAZ.sandLit). bazCity's rows are read by their VALUE
 *  step, so the recession has to live in the pigment and not only in a wash
 *  laid over the top of everything. */
function bazPale(hex, t) {
  const to = [0xf0, 0xe2, 0xbd] // BAZ.sandLit
  const n = parseInt(hex.slice(1), 16)
  const src = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return (
    '#' +
    src.map((c, i) => Math.round(c + (to[i] - c) * t).toString(16).padStart(2, '0')).join('')
  )
}

/** THE CITY BACKDROP (ch5-city, retained v-fold repainted): the whole rose
 *  city seen from the gate — a die-cut dome/rooftop skyline over TERRACED
 *  STREETS climbing the hillside, lantern strings, aerial recession.
 *  creaseU 0.5, so the great gate dome sits on the crease. */
function bazCity(w, h, seed) {
  const r = mulberry32(seed)
  const X = (u) => u * w
  const Y = (v) => (1 - v) * h

  // die-cut skyline: walls / dome clusters / two lesser minarets / the great
  // central dome. Sampled arcs for every dome.
  const dome = (uc, rad, vBase, squash = 1) => {
    const out = []
    for (let k = 8; k >= 0; k--) {
      const a = (k / 8) * Math.PI
      out.push([uc + rad * Math.cos(a), vBase + rad * (w / h) * squash * Math.sin(a)])
    }
    return out
  }
  const pts = [[0, 0], [0, 0.6]]
  pts.push([0.06, 0.6], [0.06, 0.66], [0.1, 0.66])
  pts.push(...dome(0.14, 0.028, 0.66, 0.9))
  pts.push([0.18, 0.66], [0.2, 0.6])
  pts.push([0.24, 0.6], [0.24, 0.72], [0.252, 0.72], [0.252, 0.88], [0.262, 0.9], [0.272, 0.88], [0.272, 0.72], [0.284, 0.72], [0.284, 0.6]) // lesser minaret
  pts.push([0.34, 0.6], [0.34, 0.68])
  pts.push(...dome(0.385, 0.032, 0.68, 0.85))
  pts.push([0.43, 0.68], [0.43, 0.62])
  // THE GREAT GATE DOME on the crease
  pts.push([0.44, 0.62], [0.44, 0.7])
  pts.push(...dome(0.5, 0.055, 0.7, 0.95))
  pts.push([0.56, 0.7], [0.56, 0.62], [0.57, 0.62])
  pts.push([0.62, 0.62], [0.62, 0.7])
  pts.push(...dome(0.655, 0.03, 0.7, 0.85))
  pts.push([0.69, 0.7], [0.69, 0.6])
  pts.push([0.74, 0.6], [0.74, 0.74], [0.752, 0.74], [0.752, 0.9], [0.762, 0.93], [0.772, 0.9], [0.772, 0.74], [0.784, 0.74], [0.784, 0.6]) // second minaret
  pts.push([0.84, 0.6], [0.84, 0.66])
  pts.push(...dome(0.88, 0.026, 0.66, 0.9))
  pts.push([0.92, 0.66], [0.92, 0.6], [1, 0.6], [1, 0])
  const outline = simplifyOutline(pts)
  const d = outline.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'

  let g = `<g clip-path="url(#bazCityCut)">`
  // GROUND: the deep rose the whole plane is cut from. It used to start at
  // roseLit and then take a 0.62 sandLit haze on top, which left the sheet a
  // near-uniform pale wash — against a black sky the die-cut dome skyline had
  // no value to read with (board eye-test: "too pale"). Starting from `rose`
  // and spending far less of the range on haze keeps the recession soft while
  // giving the crowns something to be soft AGAINST.
  g += `<rect width="${w}" height="${h}" fill="${BAZ.rose}"/>`

  // ---- THE TERRACED HILLSIDE. Reader finding S6-7a: the first cut painted
  // five nested ellipse arcs about the crease base plus 130 scattered window
  // ticks, and since this plane is the largest single graphic on the spread the
  // failure was the loudest one in the scene — "I could not decide whether they
  // are terraced streets, an amphitheatre, a bullseye, or a whirlpool." The
  // recession maths were never the problem. A ring reads as a ring for exactly
  // as long as it stays an unbroken stroke of even weight, and nothing stood ON
  // any of those arcs to say what the arc was for.
  //
  // So the arcs become STREETS and every street CARRIES A ROW OF HOUSES: walls
  // with a lit and a shaded face, a roofline (flat parapet or a shallow dome),
  // a door and windows, standing on a paved band with their own contact shadow
  // thrown across it. Three things do the reading, in order of weight:
  //   1. the houses BREAK the arc — a hundred vertical wall edges per row, so
  //      there is no even-weight stroke left to read as a ring;
  //   2. the rows CROWD as they climb (spacing 0.19 -> 0.09 of the tile) and
  //      each row is smaller and paler than the one below, which is how a
  //      hillside says "these are the same houses, further away";
  //   3. every street gets its OWN undulation phase, so the five are not
  //      concentric copies of one curve — concentricity was half the bullseye.
  // Painted FAR ROW FIRST so the near rows overlap and occlude the far ones,
  // which is what stacks them up a slope instead of laying them side by side.
  const ROWS = 5
  const rowT = (t) => t / (ROWS - 1)
  const rowV = (t) => 0.075 + 0.425 * Math.pow(rowT(t), 0.72)
  const rowCamber = (t) => lerp(0.14, 0.05, rowT(t))
  const rowBand = (t) => lerp(0.03, 0.014, rowT(t))
  const rowHouse = (t) => lerp(0.125, 0.052, rowT(t))
  // House counts chosen so every row's blocks stay TALLER than wide: at 8 per
  // row the near houses came out 2.3:1 and read as long garden walls, which is
  // its own wrong picture.
  const rowCount = [12, 15, 19, 24, 30]
  const rowPhase = []
  const rowWob = []
  for (let t = 0; t < ROWS; t++) {
    rowPhase.push(rr(r, 0, Math.PI * 2))
    rowWob.push(rr(r, 0.008, 0.02))
  }
  // A street's v at a given u: the hill's cross-slope (the camber, steepest on
  // the near rows) plus that row's own wander.
  const streetV = (t, u) =>
    rowV(t) -
    rowCamber(t) * Math.pow(Math.abs(u - 0.5) * 2, 2) +
    rowWob[t] * Math.sin(u * (5 + t * 1.7) + rowPhase[t])

  for (let t = ROWS - 1; t >= 0; t--) {
    const pale = rowT(t) * 0.62
    const band = rowBand(t)
    const paveC = bazPale(BAZ.sandDim, pale)
    // ONE pigment ladder for all five rows: rose / roseDim walls with a terraDim
    // return, every tone carried toward the sky by the same `pale`. An earlier cut
    // split the rows into a "near" dark pair and a "far" lit pair; measured, that
    // changed nothing (house-band luma 108/134/147/164/156 either way), so the
    // single ladder stands because it is simpler.
    //
    // NOTE for anyone measuring this plane: do NOT expect a street/wall value step
    // on the middle terraces. The rows are drawn far-first and each row's houses
    // are tall enough to overlap the street of the row behind, so rows 2 and 3
    // have most of their pavement legitimately hidden by the row in front — that
    // occlusion is the depth cue, not a defect. The property this repaint claims
    // is that each terrace is BROKEN BY ARCHITECTURE rather than being an even
    // stroke, and the probe for that is edge density along the row: 40-67 luma
    // transitions across the middle half of the tile per row, against ~2 for the
    // unbroken ellipse arcs this replaced.
    const wallLit = bazPale(BAZ.rose, pale)
    const wallMid = bazPale(BAZ.roseDim, pale)
    const wallDim = bazPale(BAZ.terraDim, pale)
    const roofC = bazPale(BAZ.terra, pale * 0.8)
    const inkOp = 0.5 - rowT(t) * 0.28 // linework recedes with the row

    // THE STREET: a paved band, not a stroke. Sampled edge to edge so it takes
    // the row's camber and wander with it.
    const N = 56
    let bandD = `M ${fx(X(0))} ${fx(Y(streetV(t, 0)))}`
    for (let i = 1; i <= N; i++) bandD += ` L ${fx(X(i / N))} ${fx(Y(streetV(t, i / N)))}`
    for (let i = N; i >= 0; i--) bandD += ` L ${fx(X(i / N))} ${fx(Y(streetV(t, i / N) + band))}`
    g += `<path d="${bandD} Z" fill="${paveC}"/>`
    // paving courses run ACROSS the street (a mark laid ALONG it re-forms into
    // the very stroke this repaint is getting rid of)
    const courses = Math.round(w / lerp(17, 9, rowT(t)))
    for (let c = 0; c <= courses; c++) {
      const u = c / courses
      g += `<line x1="${fx(X(u))}" y1="${fx(Y(streetV(t, u)))}" x2="${fx(X(u))}" y2="${fx(Y(streetV(t, u) + band))}" stroke="${INK}" stroke-width="1.2" opacity="${fx(inkOp * 0.5)}"/>`
    }
    // the shadow the row standing on this street throws down onto it
    let shD = `M ${fx(X(0))} ${fx(Y(streetV(t, 0) + band))}`
    for (let i = 1; i <= N; i++) shD += ` L ${fx(X(i / N))} ${fx(Y(streetV(t, i / N) + band))}`
    for (let i = N; i >= 0; i--) shD += ` L ${fx(X(i / N))} ${fx(Y(streetV(t, i / N) + band * 0.42))}`
    g += `<path d="${shD} Z" fill="${INK}" opacity="${fx(0.14 + rowT(t) * 0.06)}"/>`

    // THE ROW OF HOUSES standing on it.
    const n = rowCount[t]
    const hPx = rowHouse(t) * h // the row's house height in px — the detail gate
    for (let k = 0; k < n; k++) {
      const uc = (k + 0.5) / n
      const hw = (1 / n) * rr(r, 0.3, 0.41)
      const foot = streetV(t, uc) + band
      const hgt = rowHouse(t) * rr(r, 0.82, 1.14)
      const domed = (k + t) % 4 === 3
      const wallTop = foot + hgt * (domed ? 0.8 : 0.84)
      const x0 = X(uc - hw)
      const wpx = X(hw * 2)
      const yTop = Y(wallTop)
      const yFoot = Y(foot)
      g += `<rect x="${fx(x0)}" y="${fx(yTop)}" width="${fx(wpx)}" height="${fx(yFoot - yTop)}" fill="${k % 2 ? wallLit : wallMid}" stroke="${INK}" stroke-width="1.3" stroke-opacity="${fx(inkOp)}"/>`
      // the shaded return wall — one face in light, one away, so the block is
      // a box and not a tile
      g += `<rect x="${fx(x0 + wpx * 0.72)}" y="${fx(yTop)}" width="${fx(wpx * 0.28)}" height="${fx(yFoot - yTop)}" fill="${wallDim}" opacity="0.8"/>`
      if (domed) {
        // a modest cupola, not a bubble the width of the house: at ry = half the
        // house width the domes swelled bigger than the buildings under them
        const dr = wpx * 0.33
        g += `<path d="M ${fx(x0 + wpx * 0.17)} ${fx(yTop)} A ${fx(dr)} ${fx(dr * 0.9)} 0 0 1 ${fx(x0 + wpx * 0.83)} ${fx(yTop)} Z" fill="${roofC}" stroke="${INK}" stroke-width="1.3" stroke-opacity="${fx(inkOp)}"/>`
      } else {
        // flat roof with a parapet lip standing proud of the wall
        const py = Y(foot + hgt)
        g += `<rect x="${fx(x0 - wpx * 0.06)}" y="${fx(py)}" width="${fx(wpx * 1.12)}" height="${fx(yTop - py)}" fill="${roofC}" stroke="${INK}" stroke-width="1.3" stroke-opacity="${fx(inkOp)}"/>`
      }
      // a door on the street, only where the house is tall enough to own one
      if (hPx > 26) {
        const dw = wpx * 0.3
        const dh = (yFoot - yTop) * 0.42
        g += `<path d="M ${fx(x0 + wpx * 0.16)} ${fx(yFoot)} L ${fx(x0 + wpx * 0.16)} ${fx(yFoot - dh * 0.62)} Q ${fx(x0 + wpx * 0.16 + dw / 2)} ${fx(yFoot - dh * 1.1)} ${fx(x0 + wpx * 0.16 + dw)} ${fx(yFoot - dh * 0.62)} L ${fx(x0 + wpx * 0.16 + dw)} ${fx(yFoot)} Z" fill="${bazPale(BAZ.terraDim, pale)}" stroke="${INK}" stroke-width="1.2" stroke-opacity="${fx(inkOp * 0.8)}"/>`
      }
      // windows: one course, saffron on roughly one in four
      const wins = hPx > 30 ? 3 : hPx > 20 ? 2 : 1
      const ws = Math.max(1.8, hPx * 0.11)
      for (let q = 0; q < wins; q++) {
        const lit = rr(r, 0, 1) < 0.24
        g += `<rect x="${fx(x0 + wpx * (0.2 + q * (0.6 / Math.max(1, wins - 1 || 1))))}" y="${fx(yTop + (yFoot - yTop) * 0.2)}" width="${fx(ws)}" height="${fx(ws * 1.4)}" fill="${lit ? BAZ.saffron : INK}" opacity="${lit ? 0.85 : fx(0.42 - rowT(t) * 0.2)}"/>`
      }
    }
  }

  // THE CROWNING WALL. The die-cut's long flat run at v 0.6 is a wall top and
  // was never painted as one, so the far rows used to fade into a bare edge.
  // Coping course + merlon shadows below it, so the terraces are read as being
  // INSIDE something.
  g += `<rect y="${fx(Y(0.6))}" width="${w}" height="${fx(Y(0.552) - Y(0.6))}" fill="${bazPale(BAZ.sand, 0.34)}"/>`
  g += `<line x1="0" y1="${fx(Y(0.586))}" x2="${w}" y2="${fx(Y(0.586))}" stroke="${INK}" stroke-width="1.5" opacity="0.3"/>`
  for (let i = 0; i * 17 < w; i++) {
    g += `<rect x="${fx(i * 17 + 5)}" y="${fx(Y(0.6))}" width="7" height="${fx(Y(0.586) - Y(0.6))}" fill="${INK}" opacity="0.16"/>`
  }
  g += `<rect y="${fx(Y(0.552))}" width="${w}" height="${fx(h * 0.02)}" fill="${INK}" opacity="0.12"/>`

  // dome + minaret paint above the wall line (the sky-band lift, halved: at
  // 0.24 over the old pale ground it bleached the crown region flat)
  g += `<rect y="0" width="${w}" height="${fx(Y(0.58))}" fill="${BAZ.sand}" opacity="0.12"/>`
  g += `<path d="M ${fx(X(0.44))} ${fx(Y(0.7))} L ${fx(X(0.56))} ${fx(Y(0.7))} L ${fx(X(0.555))} ${fx(Y(0.62))} L ${fx(X(0.445))} ${fx(Y(0.62))} Z" fill="${BAZ.sand}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.45"/>`
  for (const [uc, rad, vb] of [[0.14, 0.028, 0.66], [0.385, 0.032, 0.68], [0.5, 0.055, 0.7], [0.655, 0.03, 0.7], [0.88, 0.026, 0.66]]) {
    g += `<path d="M ${fx(X(uc - rad))} ${fx(Y(vb))} A ${fx(X(rad))} ${fx(X(rad) * 0.95)} 0 0 1 ${fx(X(uc + rad))} ${fx(Y(vb))} Z" fill="${BAZ.terra}"/>`
    g += `<line x1="${fx(X(uc))}" y1="${fx(Y(vb))}" x2="${fx(X(uc))}" y2="${fx(Y(vb) - X(rad) * 0.92)}" stroke="${BAZ.cream}" stroke-width="1.6" opacity="0.55"/>`
  }
  // The three lantern swags that used to cross the mid city are CUT. They hung
  // at v 0.50-0.54, which the terraces turned into the small far rows: over
  // houses that size a swag is one more thin line and its lanterns are loose
  // saffron dots — the exact noise this repaint exists to remove. The
  // lantern-string beat is carried far better by the arc plates in front, where
  // the strings are die-cut and read at full size.
  // aerial recession wash: the far city pales toward the die-cut skyline
  g += `<rect width="${w}" height="${h}" fill="url(#bazCityHaze)"/>`
  g += `</g>`

  const defs =
    `<clipPath id="bazCityCut"><path d="${d}"/></clipPath>` +
    // AERIAL RECESSION, re-graded. The haze must pale the far city WITHOUT
    // erasing the value step the die-cut crowns are read by: the top stop
    // drops 0.62 -> 0.30 (soft, not bleached), the mid-band lift goes to
    // near-nothing so the wall keeps its own colour, and the base ink
    // deepens 0.18 -> 0.34 so the plane sits BEHIND the sand-coloured stall
    // arcs instead of competing with them.
    `<linearGradient id="bazCityHaze" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${BAZ.sandLit}" stop-opacity="0.30"/>` +
    `<stop offset="0.42" stop-color="${BAZ.sandLit}" stop-opacity="0.05"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0.34"/></linearGradient>`

  return svgPiece(w, h, g + rimPath(d, 5), defs)
}

/** TERRACE TREAD LIDS (ch5-tread-*-top): market carpets edge to edge, heaped
 *  goods and coin scatter — the Emerald-II terrace gardens turned to wares. */
function bazTreadTop(w, h, seed, dense) {
  const r = mulberry32(seed)
  let s = `<rect width="${w}" height="${h}" fill="${BAZ.sandDim}"/>`
  const n = dense ? 7 : 6
  const robe = [BAZ.terra, BAZ.teal, BAZ.saffron, BAZ.rose, BAZ.tealDim]
  let x = 0
  for (let i = 0; i < n; i++) {
    const cw = (w / n) * rr(r, 0.82, 1.1)
    const carpet = robe[i % robe.length]
    const inset = h * rr(r, 0.04, 0.12)
    s += `<rect x="${fx(x + 2)}" y="${fx(inset)}" width="${fx(cw - 4)}" height="${fx(h - inset * 2)}" fill="${carpet}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.5"/>`
    s += `<rect x="${fx(x + cw * 0.12)}" y="${fx(inset + h * 0.14)}" width="${fx(cw * 0.76)}" height="${fx(h - inset * 2 - h * 0.28)}" fill="none" stroke="${BAZ.cream}" stroke-width="1.6" opacity="0.75"/>`
    // centre diamond motif + end fringe
    s += `<path d="M ${fx(x + cw / 2)} ${fx(h * 0.32)} L ${fx(x + cw * 0.62)} ${fx(h * 0.5)} L ${fx(x + cw / 2)} ${fx(h * 0.68)} L ${fx(x + cw * 0.38)} ${fx(h * 0.5)} Z" fill="${BAZ.cream}" opacity="0.8"/>`
    for (let f = 0; f < 6; f++) {
      const fy2 = inset + ((h - 2 * inset) * (f + 0.5)) / 6
      s += `<line x1="${fx(x + 2)}" y1="${fx(fy2)}" x2="${fx(x - 2)}" y2="${fx(fy2)}" stroke="${INK}" stroke-width="1.2" opacity="0.5"/>`
    }
    // goods heaped on the carpet: spice cones or a bowl of coin
    if (i % 2 === 0) {
      const gx = x + cw * rr(r, 0.3, 0.6)
      s += `<path d="M ${fx(gx)} ${fx(h * 0.62)} L ${fx(gx + cw * 0.2)} ${fx(h * 0.62)} L ${fx(gx + cw * 0.1)} ${fx(h * 0.24)} Z" fill="${i % 4 ? BAZ.saffronLit : BAZ.terraDim}" stroke="${INK}" stroke-width="1.3" stroke-opacity="0.5"/>`
    } else {
      const gx = x + cw * rr(r, 0.35, 0.55)
      s += `<ellipse cx="${fx(gx)}" cy="${fx(h * 0.5)}" rx="${fx(cw * 0.14)}" ry="${fx(h * 0.16)}" fill="${BAZ.sand}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.55"/>`
      for (let c = 0; c < 5; c++) s += `<circle cx="${fx(gx + rr(r, -cw * 0.08, cw * 0.08))}" cy="${fx(h * 0.5 + rr(r, -h * 0.08, h * 0.08))}" r="${fx(Math.max(1.6, h * 0.03))}" fill="${BAZ.saffronLit}"/>`
    }
    x += cw
    if (x > w) break
  }
  // loose coin scatter between carpets
  for (let i = 0; i < (dense ? 26 : 18); i++) {
    s += `<circle cx="${fx(rr(r, 0, w))}" cy="${fx(rr(r, 0, h))}" r="${fx(Math.max(1.4, h * 0.024))}" fill="${BAZ.saffron}" opacity="${fx(rr(r, 0.5, 0.9))}"/>`
  }
  return svgPiece(w, h, s)
}

/** TERRACE RISERS (ch5-tread-*-front): arcade stone with painted price tags
 *  and chalk marks — what the reader sees of each step. */
function bazTreadFront(w, h, seed, arches) {
  const r = mulberry32(seed)
  let s = `<rect width="${w}" height="${h}" fill="${BAZ.sand}"/>`
  s += `<rect width="${w}" height="${fx(h * 0.14)}" fill="${BAZ.sandLit}"/>`
  // shallow blind arcade
  for (let i = 0; i < arches; i++) {
    const ax = ((i + 0.5) / arches) * w
    const aw = (w / arches) * 0.62
    s += `<path d="M ${fx(ax - aw / 2)} ${fx(h)} L ${fx(ax - aw / 2)} ${fx(h * 0.5)} Q ${fx(ax)} ${fx(h * 0.16)} ${fx(ax + aw / 2)} ${fx(h * 0.5)} L ${fx(ax + aw / 2)} ${fx(h)}" fill="${BAZ.sandDim}" stroke="${INK}" stroke-width="1.5" stroke-opacity="0.45"/>`
  }
  // stone joints
  for (const fyv of [0.32, 0.62, 0.88]) {
    s += `<line x1="0" y1="${fx(h * fyv)}" x2="${w}" y2="${fx(h * fyv)}" stroke="${INK}" stroke-width="1.2" opacity="0.22"/>`
  }
  // price tags + chalk marks
  for (let i = 0; i < Math.max(3, Math.round(arches * 0.7)); i++) {
    const tx = rr(r, w * 0.05, w * 0.9)
    const ty = rr(r, h * 0.2, h * 0.55)
    s += `<g transform="rotate(${fx(rr(r, -14, 14))} ${fx(tx)} ${fx(ty)})">` +
      `<rect x="${fx(tx)}" y="${fx(ty)}" width="${fx(w * 0.045)}" height="${fx(h * 0.3)}" fill="${BAZ.cream}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.6"/>` +
      `<line x1="${fx(tx + w * 0.008)}" y1="${fx(ty + h * 0.09)}" x2="${fx(tx + w * 0.037)}" y2="${fx(ty + h * 0.09)}" stroke="${INK}" stroke-width="1.2" opacity="0.7"/>` +
      `<line x1="${fx(tx + w * 0.008)}" y1="${fx(ty + h * 0.18)}" x2="${fx(tx + w * 0.03)}" y2="${fx(ty + h * 0.18)}" stroke="${INK}" stroke-width="1.2" opacity="0.55"/>` +
      `</g>`
    // chalk tally beside the tag
    for (let c = 0; c < 4; c++) {
      s += `<line x1="${fx(tx + w * 0.06 + c * 3)}" y1="${fx(ty)}" x2="${fx(tx + w * 0.06 + c * 3)}" y2="${fx(ty + h * 0.12)}" stroke="${BAZ.cream}" stroke-width="1.6" opacity="0.8"/>`
    }
  }
  s += `<rect y="${fx(h * 0.86)}" width="${w}" height="${fx(h * 0.14)}" fill="${INK}" opacity="0.1"/>`
  return svgPiece(w, h, s)
}

/**
 * FIGURE RANKS cut as ONE linked chain (T-LINKED-RANK): the two crowd chains on
 * the tread lids. The ALPHA carries the die-cut; the cream core edge rides the
 * contour (T1).
 *
 * READER FINDING S6-7b: at the reading camera these figures are ~20 px tall and
 * "the dome-with-two-prongs shapes are unreadable — my first reading was
 * BACKPACKS. Only at 4x zoom does a head appear between the prongs." Three
 * separate causes, all of them silhouette, none of them detail:
 *   1. the body was a plain RECTANGLE the full width of its cell, so the widest
 *      part of a person was their waist and there was no shoulder anywhere;
 *   2. the head sat on that rectangle as a half-disc springing straight off the
 *      shoulder line — a DOME, with no neck between the two;
 *   3. the two raised arms (the throng's `raisedArms`) flanked that dome at
 *      exactly the spacing and taper of a pair of shoulder straps.
 * The tea master hit the same wall one painter down (see the note in
 * bazTeaCorner): a person reads as a person because the outline STEPS at the
 * shoulder and PINCHES at the neck before the head. So the body is now a
 * TRAPEZOID flaring to the hem (hem 2.1x the shoulder width), the shoulder is a
 * real ledge that steps inward, the neck is a narrow column ~0.42 of a head
 * wide, and the head is a 232-degree ring whose JAW overhangs that neck on both
 * sides — the pinch is cut, not implied. `raisedArms` is deleted outright: the
 * throng was its only caller and it is now a rank of stalls (bazStallRank), so
 * the prongs leave the book with it. `view`/`childAt` go the same way.
 *
 * Proportions are held in HEAD-RADIUS units (hrAsp = the head radius expressed
 * in v) and solved from the strip height, so both callers' aspects land the same
 * figure: body 6.4 hrAsp, shoulder-to-jaw 0.35, head 1.935. Per-figure robe
 * colour and hem width stay varied — this is a CROWD, and variety is right here.
 */
function bazFigureRank(w, h, seed, { count, basketAt = -1 }) {
  const r = mulberry32(seed)
  const X = (u) => u * w
  const Y = (v) => (1 - v) * h
  const asp = w / h // u-radius -> v-radius conversion for round heads

  const u0 = 0.015
  const u1 = 0.985
  const span = (u1 - u0) / count
  const vLink = 0.26
  const vCrown = 0.93
  // solve the head size from the height available between hem and crown
  const hrAsp = (vCrown - vLink) / 8.685 // body 6.4 + shoulder/neck 0.35 + head 1.935
  const hr0 = hrAsp / asp
  const figs = []
  for (let i = 0; i < count; i++) {
    const hr = hr0 * rr(r, 0.94, 1.06)
    // the basket carrier stoops under her load, which also gives the rank a
    // second crown height without touching anyone's proportions
    const vSh = vLink + 6.4 * hr * asp - (i === basketAt ? 0.085 : 0) - rr(r, 0, 0.022)
    figs.push({
      cx: u0 + span * (i + 0.5),
      hr,
      vSh,
      vNeck: vSh + 0.35 * hr * asp,
      neckHalf: hr * 0.42,
      // shoulders WIDER than the waist under them. A straight taper from a wide
      // hem to the shoulder is a cone, and a cone with a small head on it is a
      // chess bishop — the trap bazTeaCorner records. The waist pinch plus a
      // shoulder that steps back OUT is what turns the same wedge into a robe.
      // Every width is held in HEAD RADII, not in cell fractions. Filling the
      // cell was the original mistake: a 6-figure rank on a 512x105 strip gives
      // each person an 83 px cell, and an honestly-proportioned figure 70 px
      // tall is only ~42 px across. Sizing the hem to the cell made the body a
      // wedge wider than it was tall below the waist, which is what left the
      // head reading as an ornament on top of a mound. A sparser rank of six
      // legible people beats six blobs shoulder to shoulder.
      shHalf: hr * rr(r, 1.92, 2.1),
      waistHalf: hr * rr(r, 1.24, 1.38),
      hemHalf: Math.min(span * 0.385, hr * rr(r, 2.4, 2.75)),
      // A LEAN. Six perfectly axial figures of one height read as turned wood —
      // chessmen on a board — however good each silhouette is; a head carried
      // off its own centreline is the cheapest cue that these are people
      // standing about, some of them turned toward a neighbour.
      lean: hr * rr(r, -0.4, 0.4),
      robe: i % 5,
      wrap: r() < 0.6,
      beard: i % 3 === 2,
    })
  }
  // derived head centre / crown per figure (the ring's own geometry)
  for (const f of figs) {
    f.hx = f.cx + f.lean
    f.vCen = f.vNeck + 0.935 * f.hr * asp
    f.crown = f.vNeck + 1.935 * f.hr * asp
    f.vJaw = f.vCen - 0.435 * f.hr * asp
  }

  /** The head as a 232-degree ring: it starts and ends BELOW its own centre, so
   *  the jaw hangs outboard of the neck and the pinch is part of the cut. A
   *  half-disc springing off the shoulders is the dome read S6-7b named. */
  const headRing = (f) => {
    const out = []
    const N = 12
    const phi = 0.45
    for (let k = 0; k <= N; k++) {
      const a = Math.PI + phi - ((Math.PI + 2 * phi) * k) / N
      out.push([f.hx + f.hr * Math.cos(a), f.vCen + f.hr * asp * Math.sin(a)])
    }
    return out
  }

  const pts = [[0, 0], [0.004, vLink * 0.85]]
  figs.forEach((f, i) => {
    const body = f.vSh - vLink
    // the gown as a BELL: hem, the skirt's curve, the waist it gathers to
    pts.push([f.cx - f.hemHalf, vLink])
    pts.push([f.cx - f.hemHalf * 0.6, vLink + body * 0.34])
    pts.push([f.cx - f.waistHalf, vLink + body * 0.62])
    // then back OUT to the shoulder, and THE SHOULDER LEDGE
    pts.push([f.cx - f.shHalf, f.vSh - 0.018])
    pts.push([f.cx - f.shHalf * 0.9, f.vSh])
    pts.push([f.hx - f.neckHalf * 1.55, f.vSh + 0.012])
    pts.push([f.hx - f.neckHalf, f.vNeck])
    pts.push([f.hx - f.neckHalf, f.vJaw])
    if (i === basketAt) {
      // a flat-topped basket carried on the crown: head to the brow, then the
      // basket's box, then back down the far side of the head
      const ring = headRing(f)
      pts.push(...ring.slice(0, 5))
      pts.push([f.hx - f.hr * 1.45, f.crown - 0.01], [f.hx - f.hr * 1.3, f.crown + 0.075], [f.hx + f.hr * 1.3, f.crown + 0.075], [f.hx + f.hr * 1.45, f.crown - 0.01])
      pts.push(...ring.slice(-5))
    } else {
      pts.push(...headRing(f))
    }
    pts.push([f.hx + f.neckHalf, f.vJaw])
    pts.push([f.hx + f.neckHalf, f.vNeck])
    pts.push([f.hx + f.neckHalf * 1.55, f.vSh + 0.012])
    pts.push([f.cx + f.shHalf * 0.9, f.vSh])
    pts.push([f.cx + f.shHalf, f.vSh - 0.018])
    pts.push([f.cx + f.waistHalf, vLink + body * 0.62])
    pts.push([f.cx + f.hemHalf * 0.6, vLink + body * 0.34])
    pts.push([f.cx + f.hemHalf, vLink])
    // Between figures the contour ALWAYS dips to the shared link — that dip is
    // what makes the rank one piece of cut paper (T-LINKED-RANK).
    if (i + 1 < count) pts.push([u0 + span * (i + 1), vLink])
  })
  pts.push([0.996, vLink * 0.85], [1, 0])
  const outline = simplifyOutline(pts)
  const d = outline.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'

  const robes = [BAZ.terra, BAZ.teal, BAZ.saffron, BAZ.rose, BAZ.tealDim]
  const wraps = [BAZ.cream, BAZ.saffron, BAZ.teal, BAZ.sand, BAZ.terra]
  let g = `<g clip-path="url(#rankCut)">`
  g += `<rect width="${w}" height="${h}" fill="${BAZ.sandDim}"/>`
  figs.forEach((f, i) => {
    const xb0 = X(f.cx - span / 2)
    // the robe fills the cell and the die-cut trapezoid does the shaping
    g += `<rect x="${fx(xb0)}" y="0" width="${fx(X(span) + 1)}" height="${h}" fill="${robes[f.robe]}"/>`
    // gown folds fanning from the WAIST to the hem — the flare, painted as well
    // as cut, so the skirt reads as gathered cloth rather than as a wedge
    const vWaist = vLink + (f.vSh - vLink) * 0.62
    for (const sgn of [-1, 1]) {
      g += `<path d="M ${fx(X(f.cx + sgn * f.waistHalf * 0.5))} ${fx(Y(vWaist - 0.01))} L ${fx(X(f.cx + sgn * f.hemHalf * 0.8))} ${fx(Y(vLink + 0.02))}" fill="none" stroke="${INK}" stroke-width="1.3" opacity="0.24"/>`
    }
    // a yoke across the shoulders in the wrap colour: the ledge, drawn
    g += `<path d="M ${fx(X(f.cx - f.shHalf))} ${fx(Y(f.vSh - 0.005))} Q ${fx(X(f.cx))} ${fx(Y(f.vSh - 0.075))} ${fx(X(f.cx + f.shHalf))} ${fx(Y(f.vSh - 0.005))} L ${fx(X(f.cx + f.shHalf))} ${fx(Y(f.vSh - 0.1))} L ${fx(X(f.cx - f.shHalf))} ${fx(Y(f.vSh - 0.1))} Z" fill="${wraps[(i + 3) % wraps.length]}" opacity="0.9"/>`
    // sleeve edges: two lines from under the yoke to the waist. A robed body
    // with no arms anywhere in it reads as a bell however well the shoulder is
    // cut, and at this size a sleeve line is all the arm that fits.
    for (const sgn of [-1, 1]) {
      g += `<line x1="${fx(X(f.cx + sgn * f.shHalf * 0.78))}" y1="${fx(Y(f.vSh - 0.06))}" x2="${fx(X(f.cx + sgn * f.waistHalf * 0.95))}" y2="${fx(Y(vLink + (f.vSh - vLink) * 0.66))}" stroke="${INK}" stroke-width="1.4" opacity="0.34"/>`
    }
    // the neck column, in skin, between the yoke and the jaw
    g += `<rect x="${fx(X(f.hx - f.neckHalf))}" y="${fx(Y(f.vJaw))}" width="${fx(X(f.neckHalf * 2))}" height="${fx(Y(f.vSh) - Y(f.vJaw))}" fill="${BAZ.skin}"/>`
    // the head, as a disc — matched to the ring the contour cut
    const hpx = f.hr * w
    g += `<circle cx="${fx(X(f.hx))}" cy="${fx(Y(f.vCen))}" r="${fx(hpx)}" fill="${BAZ.skin}"/>`
    if (f.wrap) {
      // cap/turban over the top of the skull, cut off at the brow
      g += `<path d="M ${fx(X(f.hx) - hpx)} ${fx(Y(f.vCen + f.hr * asp * 0.18))} A ${fx(hpx)} ${fx(hpx)} 0 0 1 ${fx(X(f.hx) + hpx)} ${fx(Y(f.vCen + f.hr * asp * 0.18))} Z" fill="${wraps[(i + 2) % wraps.length]}"/>`
    }
    // face: two ink eyes and a beard on every third
    g += `<circle cx="${fx(X(f.hx - f.hr * 0.36))}" cy="${fx(Y(f.vCen))}" r="1.6" fill="${INK}"/>`
    g += `<circle cx="${fx(X(f.hx + f.hr * 0.36))}" cy="${fx(Y(f.vCen))}" r="1.6" fill="${INK}"/>`
    if (f.beard) {
      g += `<path d="M ${fx(X(f.hx - f.hr * 0.62))} ${fx(Y(f.vCen - f.hr * asp * 0.1))} Q ${fx(X(f.hx))} ${fx(Y(f.vJaw - 0.02))} ${fx(X(f.hx + f.hr * 0.62))} ${fx(Y(f.vCen - f.hr * asp * 0.1))} Z" fill="${INK}" opacity="0.7"/>`
    }
    // the sash ON the waist the contour pinches at, so cut and paint agree
    g += `<line x1="${fx(xb0 + 2)}" y1="${fx(Y(vWaist))}" x2="${fx(xb0 + X(span) - 2)}" y2="${fx(Y(vWaist - 0.012))}" stroke="${wraps[(i + 1) % wraps.length]}" stroke-width="${fx(Math.max(2, h * 0.04))}" opacity="0.9"/>`
    g += `<line x1="${fx(xb0 + 2)}" y1="${fx(Y(vLink + 0.02))}" x2="${fx(xb0 + X(span) - 2)}" y2="${fx(Y(vLink + 0.02))}" stroke="${BAZ.cream}" stroke-width="${fx(Math.max(1.6, h * 0.03))}" opacity="0.8"/>`
    if (i === basketAt) {
      const bx = X(f.hx - f.hr * 1.34)
      const bw2 = X(f.hr * 2.68)
      const by = Y(f.crown + 0.075)
      g += `<rect x="${fx(bx)}" y="${fx(by)}" width="${fx(bw2)}" height="${fx(Y(f.crown - 0.01) - by)}" fill="${BAZ.sandDim}" stroke="${INK}" stroke-width="1.3" stroke-opacity="0.6"/>`
      for (let wv = 1; wv < 4; wv++) g += `<line x1="${fx(bx)}" y1="${fx(by + wv * 3.5)}" x2="${fx(bx + bw2)}" y2="${fx(by + wv * 3.5)}" stroke="${INK}" stroke-width="1" opacity="0.4"/>`
    }
    // a shadow in the gap between neighbours, so the hems separate instead of
    // fusing into one skirt at reading size
    if (i + 1 < count) {
      g += `<rect x="${fx(X(u0 + span * (i + 1)) - 2)}" y="${fx(Y(f.vSh - 0.04))}" width="4" height="${fx(Y(vLink) - Y(f.vSh - 0.04))}" fill="${INK}" opacity="0.3"/>`
    }
  })
  // THE LINK BAND is card, not clothing. The robe rects run the full height of
  // their cells (the die-cut does the shaping), which left the strip below the
  // hems reading as six colour blocks — a painted plinth the figures stood on
  // rather than the sheet they are cut from.
  g += `<rect y="${fx(Y(vLink))}" width="${w}" height="${fx(Y(0) - Y(vLink))}" fill="${BAZ.sandDim}"/>`
  g += `<line x1="0" y1="${fx(Y(vLink))}" x2="${w}" y2="${fx(Y(vLink))}" stroke="${INK}" stroke-width="1.5" opacity="0.35"/>`
  g += `<rect width="${w}" height="${h}" fill="url(#rankShade)"/>`
  g += `</g>`

  const defs =
    `<clipPath id="rankCut"><path d="${d}"/></clipPath>` +
    `<linearGradient id="rankShade" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${BAZ.sandLit}" stop-opacity="0.12"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0.28"/></linearGradient>`

  // A 3 px core rim, not the house 4: the shoulder step and the neck pinch are
  // 5-7 px features, and a rim laid 2 px either side of the contour was rounding
  // the very notches the figures are now read by.
  return svgPiece(w, h, g + rimPath(d, 3), defs)
}

/**
 * THE LINKED STALL RANK (ch5-throng): six IDENTICAL market stalls cut as one
 * chain, lying flat on the page at rest for the reader to drag upright. This
 * slot used to hold an eight-shopper throng; the scene lane turned it into the
 * spread's playable, and this painter answers both halves of the brief for it.
 *
 * IDENTICAL IS THE POINT. The reader's own praise for this spread was the four
 * stall clusters that are "visibly the SAME stall stamped out four times — the
 * repetition is the point", which is the chapter's meaning: he carved master
 * patterns so any pair of hands could raise the same stall. So there is NO rng
 * on shape, colour, height or furniture between the six — every stall is drawn
 * from one set of constants, and the seeded rng only ever touches within-stall
 * grain. A jittered rank would say "six stalls"; an identical rank says "one
 * pattern, six times", and that is a different sentence.
 *
 * uv: v=0 is the HINGE edge and v=1 the FREE edge (Y = (1-v)*h, image TOP = the
 * free edge, the same convention bazFigureRank uses). At rest the flap lies flat
 * toward the reader, so the image's top row is the edge nearest the eye — which
 * is exactly why the LIFT LIP lives there.
 *
 * The die-cut steps three times per stall — a wide counter at the hem, slim
 * posts, then the awning overhanging both (a T silhouette). Between neighbours
 * the contour drops to the shared link at vLink, so the whole rank is one piece
 * of cut paper (T-LINKED-RANK, as bazFigureRank).
 */
function bazStallRank(w, h, seed, { count }) {
  const r = mulberry32(seed)
  const X = (u) => u * w
  const Y = (v) => (1 - v) * h
  const WOODB = '#6b4a26'
  const WOODB_LIT = '#9a7038'

  const u0 = 0.012
  const u1 = 0.988
  const span = (u1 - u0) / count
  const cHalf = span * 0.4 // the counter at the hem
  const pHalf = span * 0.29 // the post frame
  const aHalf = span * 0.455 // the awning, overhanging both
  const vLink = 0.16 // the shared link the rank is one sheet at
  const vHem = 0.3 // counter top
  const vEave = 0.72 // awning underside
  const vLip = 0.928 // the printed lift lip starts here
  const vTop = 0.985
  // The awning stripe cadence is the spread's, expressed as PITCH not count:
  // BAZ_STRIPES_PER_BAY 7 over the arc plates' ~0.115 world bays is ~0.0165
  // world per stripe, and a stall here is 0.1 world wide — six stripes.
  const nst = 6

  const pts = [[0, 0], [0, vLink]]
  for (let i = 0; i < count; i++) {
    const cx = u0 + span * (i + 0.5)
    pts.push(
      [cx - cHalf, vLink], [cx - cHalf, vHem],
      [cx - pHalf, vHem], [cx - pHalf, vEave],
      [cx - aHalf, vEave], [cx - aHalf, vTop],
      [cx + aHalf, vTop], [cx + aHalf, vEave],
      [cx + pHalf, vEave], [cx + pHalf, vHem],
      [cx + cHalf, vHem], [cx + cHalf, vLink]
    )
  }
  pts.push([1, vLink], [1, 0])
  const outline = simplifyOutline(pts)
  const d = outline.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'

  let g = `<g clip-path="url(#stallRankCut)">`
  g += `<rect width="${w}" height="${h}" fill="${BAZ.sand}"/>`
  // the link band the six stalls share, read as one strip of card
  g += `<rect y="${fx(Y(vLink))}" width="${w}" height="${fx(Y(0) - Y(vLink))}" fill="${BAZ.sandDim}"/>`
  g += `<line x1="0" y1="${fx(Y(vLink))}" x2="${w}" y2="${fx(Y(vLink))}" stroke="${INK}" stroke-width="1.6" opacity="0.4"/>`

  for (let i = 0; i < count; i++) {
    const cx = u0 + span * (i + 0.5)
    const xC = X(cx)
    // ---- THE HUNG RUG behind the counter. The first cut left this panel a bare
    // tan backcloth, and an empty rectangle is 40% of the stall's height saying
    // nothing — the whole thing read closer to a shrine niche than to a stall. A
    // rug hung at the back of the frame is the one prop that makes a market
    // stall unmistakable, and it reuses the spread's own carpet idiom (tea rug,
    // tread lids), so the rank belongs to the same souk.
    const bx0 = X(cx - pHalf)
    const bw0 = X(pHalf * 2)
    const by0 = Y(vEave)
    const bh0 = Y(vHem) - by0
    g += `<rect x="${fx(bx0)}" y="${fx(by0)}" width="${fx(bw0)}" height="${fx(bh0)}" fill="${BAZ.sandDim}"/>`
    // the rug hangs INSIDE the posts (0.72 of the frame, not 0.88): at the wider
    // size its selvedge landed exactly under the uprights and swallowed them
    g += `<rect x="${fx(bx0 + bw0 * 0.14)}" y="${fx(by0 + bh0 * 0.1)}" width="${fx(bw0 * 0.72)}" height="${fx(bh0 * 0.74)}" fill="${BAZ.terra}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.55"/>`
    g += `<rect x="${fx(bx0 + bw0 * 0.2)}" y="${fx(by0 + bh0 * 0.17)}" width="${fx(bw0 * 0.6)}" height="${fx(bh0 * 0.6)}" fill="none" stroke="${BAZ.cream}" stroke-width="1.6" opacity="0.75"/>`
    g += `<path d="M ${fx(X(cx))} ${fx(by0 + bh0 * 0.28)} L ${fx(bx0 + bw0 * 0.68)} ${fx(by0 + bh0 * 0.47)} L ${fx(X(cx))} ${fx(by0 + bh0 * 0.66)} L ${fx(bx0 + bw0 * 0.32)} ${fx(by0 + bh0 * 0.47)} Z" fill="${BAZ.cream}" opacity="0.8"/>`
    for (let f2 = 0; f2 < 6; f2++) {
      const fxp = bx0 + bw0 * (0.18 + f2 * 0.128)
      g += `<line x1="${fx(fxp)}" y1="${fx(by0 + bh0 * 0.84)}" x2="${fx(fxp)}" y2="${fx(by0 + bh0 * 0.92)}" stroke="${INK}" stroke-width="1.2" opacity="0.5"/>`
    }
    // the lintel the rug is slung from, spanning post to post
    g += `<rect x="${fx(bx0 - X(span * 0.02))}" y="${fx(by0 + bh0 * 0.02)}" width="${fx(bw0 + X(span * 0.04))}" height="${fx(Math.max(2.4, bh0 * 0.055))}" fill="${WOODB}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.5"/>`

    // ---- the two walnut posts (bazRaiseStallFace's post idiom: WOODB body,
    // WOODB_LIT lit edge, cream chevron notches down the grain). At span*0.055
    // they baked 4.6 px wide — half of that once the flap is on screen — so the
    // frame vanished and the awning looked unsupported.
    const pw = X(span * 0.09)
    for (const sgn of [-1, 1]) {
      const px = X(cx + sgn * pHalf * 0.94) - pw / 2
      g += `<rect x="${fx(px)}" y="${fx(Y(vEave + 0.01))}" width="${fx(pw)}" height="${fx(Y(vLink) - Y(vEave + 0.01))}" fill="${WOODB}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.55"/>`
      g += `<rect x="${fx(px + 1.5)}" y="${fx(Y(vEave + 0.01))}" width="${fx(Math.max(1.6, pw * 0.22))}" height="${fx(Y(vLink) - Y(vEave + 0.01))}" fill="${WOODB_LIT}" opacity="0.7"/>`
      for (let c = 0; c < 5; c++) {
        const cy = Y(vEave) + (Y(vLink) - Y(vEave)) * (0.12 + c * 0.19)
        g += `<path d="M ${fx(px + 1)} ${fx(cy)} L ${fx(px + pw / 2)} ${fx(cy - 2.6)} L ${fx(px + pw - 1)} ${fx(cy)}" fill="none" stroke="${BAZ.cream}" stroke-width="1.2" opacity="0.65"/>`
      }
    }

    // ---- the counter of goods at the hem: a crate front, then three spice
    // cones and two jars standing ON it. Identical stall to stall.
    const cy0 = Y(vHem)
    const cyH = Y(vLink) - cy0
    g += `<rect x="${fx(X(cx - cHalf))}" y="${fx(cy0)}" width="${fx(X(cHalf * 2))}" height="${fx(cyH)}" fill="${BAZ.sandDim}" stroke="${INK}" stroke-width="1.5" stroke-opacity="0.55"/>`
    g += `<rect x="${fx(X(cx - cHalf))}" y="${fx(cy0)}" width="${fx(X(cHalf * 2))}" height="${fx(cyH * 0.26)}" fill="${BAZ.sandLit}" opacity="0.55"/>`
    g += `<line x1="${fx(X(cx - cHalf))}" y1="${fx(cy0 + cyH * 0.6)}" x2="${fx(X(cx + cHalf))}" y2="${fx(cy0 + cyH * 0.6)}" stroke="${INK}" stroke-width="1.3" opacity="0.4"/>`
    for (const [uf, col, hf] of [[-0.6, BAZ.saffron, 0.085], [0.6, BAZ.saffron, 0.085]]) {
      const gx = X(cx + uf * cHalf)
      const gw = X(span * 0.1)
      g += `<path d="M ${fx(gx - gw / 2)} ${fx(cy0)} L ${fx(gx + gw / 2)} ${fx(cy0)} L ${fx(gx)} ${fx(Y(vHem + hf))} Z" fill="${col}" stroke="${INK}" stroke-width="1.3" stroke-opacity="0.5"/>`
    }
    for (const uf of [-0.26, 0.26]) {
      g += `<ellipse cx="${fx(X(cx + uf * cHalf))}" cy="${fx(cy0 - 2)}" rx="${fx(X(span * 0.048))}" ry="${fx((Y(vHem + 0.075) - cy0) * 0.9)}" fill="${BAZ.terraDim}" stroke="${INK}" stroke-width="1.3" stroke-opacity="0.5"/>`
    }

    // ---- the awning: six teal/cream stripes at the house pitch, a saffron
    // pinstripe down each cream bay, and a scalloped valance along its hem.
    const ax0 = X(cx - aHalf)
    const aw = X(aHalf * 2)
    const pitch = aw / nst
    const ay0 = Y(vLip)
    const ah = Y(vEave) - ay0
    for (let k = 0; k < nst; k++) {
      g += `<rect x="${fx(ax0 + k * pitch)}" y="${fx(ay0)}" width="${fx(pitch + 0.5)}" height="${fx(ah)}" fill="${k % 2 ? BAZ.cream : BAZ.teal}"/>`
      if (k % 2) {
        g += `<line x1="${fx(ax0 + (k + 0.5) * pitch)}" y1="${fx(ay0)}" x2="${fx(ax0 + (k + 0.5) * pitch)}" y2="${fx(ay0 + ah)}" stroke="${BAZ.saffron}" stroke-width="1.5" opacity="0.42"/>`
      }
    }
    // the valance: half-discs hanging to the awning's cut hem, colour-matched to
    // the stripe above each one, so the hem scallops instead of ruling straight
    for (let k = 0; k < nst; k++) {
      const sx = ax0 + (k + 0.5) * pitch
      const by = ay0 + ah
      g += `<path d="M ${fx(sx - pitch / 2)} ${fx(by - pitch * 0.5)} A ${fx(pitch / 2)} ${fx(pitch * 0.5)} 0 0 0 ${fx(sx + pitch / 2)} ${fx(by - pitch * 0.5)} Z" fill="${k % 2 ? BAZ.teal : BAZ.cream}"/>`
    }
    g += `<line x1="${fx(ax0)}" y1="${fx(ay0 + ah)}" x2="${fx(ax0 + aw)}" y2="${fx(ay0 + ah)}" stroke="${INK}" stroke-width="1.4" opacity="0.35"/>`
    // the shade the awning throws down its own posts — what says "raised"
    g += `<rect x="${fx(X(cx - pHalf))}" y="${fx(Y(vEave))}" width="${fx(X(pHalf * 2))}" height="${fx((Y(vHem) - Y(vEave)) * 0.42)}" fill="url(#stallRankEave)"/>`

    // ---- THE LIFT LIP on the free edge: a cream scalloped strip with the
    // house lozenge punched in the middle of every stall. This is the printed
    // die-cut "lift here" cue, and it has to read at 1x — which it does as a
    // hard cream value break running the whole free edge, before the reader ever
    // resolves the lozenge itself.
    const ly = Y(vTop)
    const lh = Y(vLip) - ly
    g += `<rect x="${fx(ax0)}" y="${fx(ly)}" width="${fx(aw)}" height="${fx(lh)}" fill="${BAZ.cream}"/>`
    for (let k = 0; k < nst; k++) {
      const sx = ax0 + (k + 0.5) * pitch
      g += `<path d="M ${fx(sx - pitch / 2)} ${fx(ly + lh)} A ${fx(pitch / 2)} ${fx(pitch * 0.34)} 0 0 0 ${fx(sx + pitch / 2)} ${fx(ly + lh)} Z" fill="${BAZ.cream}"/>`
    }
    g += `<line x1="${fx(ax0)}" y1="${fx(ly + lh)}" x2="${fx(ax0 + aw)}" y2="${fx(ly + lh)}" stroke="${INK}" stroke-width="1.3" opacity="0.4"/>`
    const lz = Math.max(3, lh * 0.34)
    g += `<path d="M ${fx(xC)} ${fx(ly + lh * 0.44 - lz)} l ${fx(lz)} ${fx(lz)} l ${fx(-lz)} ${fx(lz)} l ${fx(-lz)} ${fx(-lz)} Z" fill="none" stroke="${INK}" stroke-width="1.8" opacity="0.85"/>`
    g += `<circle cx="${fx(xC)}" cy="${fx(ly + lh * 0.44)}" r="1.5" fill="${INK}"/>`
  }
  g += `<rect width="${w}" height="${h}" fill="url(#stallRankShade)"/>`
  g += `</g>`
  void r

  const defs =
    `<clipPath id="stallRankCut"><path d="${d}"/></clipPath>` +
    `<linearGradient id="stallRankEave" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${INK}" stop-opacity="0.34"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="stallRankShade" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${BAZ.sandLit}" stop-opacity="0.1"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0.3"/></linearGradient>`

  return svgPiece(w, h, g + rimPath(d, 4), defs)
}

/** THE TEA CORNER (ch5-tea): the tea master kneeling at his brazier, one
 *  die-cut steam curl rising — the intimate counterweight at the right apron. */
function bazTeaCorner(w, h, seed) {
  const r = mulberry32(seed)
  const X = (u) => u * w
  const Y = (v) => (1 - v) * h

  // steam curl centreline (quad beziers), sampled with a tapering half-width
  const curl = (t) => {
    const uu = 0.68 + 0.14 * Math.sin(t * Math.PI * 2.2 + 0.4) * (1 - t * 0.4)
    return [uu, 0.4 + t * 0.58]
  }
  const steamL = []
  const steamR = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const [uu, vv] = curl(t)
    const hw = lerp(0.055, 0.018, t)
    steamL.push([uu - hw, vv])
    steamR.push([uu + hw, vv])
  }
  const pts = [
    [0, 0],
    [0.02, 0.1], // rug edge
    [0.06, 0.12], [0.09, 0.32], [0.14, 0.46], // kneeling back
    // A SHOULDER LEDGE and a NECK. Without them the back ran in one unbroken
    // diagonal from hem to cap and the whole master silhouetted as a cone with a
    // spike on top — a chess bishop, or the minaret in miniature. A person reads
    // as a person because the outline STEPS at the shoulder and pinches at the
    // neck before the head; the cap is then a dome, never a point.
    [0.19, 0.545], [0.265, 0.578], // the ledge
    [0.285, 0.6], // neck
    [0.288, 0.655], // left cheek
    [0.272, 0.685], [0.285, 0.745], [0.345, 0.778], [0.405, 0.745], [0.418, 0.685], // turban dome
    [0.402, 0.655], // right cheek
    [0.405, 0.6], // neck, other side
    [0.44, 0.56], [0.5, 0.46], // pouring arm down toward the pot
    [0.56, 0.36], [0.58, 0.42], // kettle spout meets steam base
  ]
  // brazier + steam: walk up the right side of the curl, over the top, down the left
  pts.push([0.6, 0.3], [0.86, 0.3], [0.84, 0.4], [0.74, 0.44]) // brazier bowl rim
  for (const [a, b] of steamR) pts.push([a, b])
  const tip = curl(1)
  pts.push([tip[0], Math.min(0.995, tip[1] + 0.03)])
  for (let i = steamL.length - 1; i >= 0; i--) pts.push(steamL[i])
  pts.push([0.62, 0.42], [0.6, 0.44], [0.56, 0.3], [0.6, 0.28])
  pts.push([0.9, 0.26], [0.94, 0.1], [0.98, 0.08], [1, 0])
  const outline = simplifyOutline(pts)
  const d = outline.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(X(u))} ${fx(Y(v))}`).join(' ') + ' Z'

  let g = `<g clip-path="url(#teaCut)">`
  g += `<rect width="${w}" height="${h}" fill="${BAZ.teal}"/>`
  // rug base band
  g += `<rect y="${fx(Y(0.1))}" width="${w}" height="${fx(Y(0) - Y(0.1))}" fill="${BAZ.terra}"/>`
  for (let i = 0; i < 7; i++) g += `<rect x="${fx((i / 7) * w)}" y="${fx(Y(0.1))}" width="${fx(w / 14)}" height="${fx(Y(0) - Y(0.1))}" fill="${BAZ.cream}" opacity="0.7"/>`
  // the master: teal robe (ground), saffron sash, skin head + white cap —
  // the skin fills the head bump itself (v 0.6..0.74), cap above it
  // (eye-test fix: the first bake painted the skin at neck level).
  // skin fills the FACE band between neck and turban brim; the turban is a
  // cream dome sat on top of it (both keyed to the new head contour above)
  g += `<rect x="${fx(X(0.283))}" y="${fx(Y(0.69))}" width="${fx(X(0.124))}" height="${fx(Y(0.6) - Y(0.69))}" fill="${BAZ.skin}"/>`
  g += `<circle cx="${fx(X(0.325))}" cy="${fx(Y(0.645))}" r="1.8" fill="${INK}"/>`
  g += `<path d="M ${fx(X(0.272))} ${fx(Y(0.685))} Q ${fx(X(0.345))} ${fx(Y(0.83))} ${fx(X(0.418))} ${fx(Y(0.685))} Z" fill="${BAZ.cream}"/>`
  g += `<path d="M ${fx(X(0.272))} ${fx(Y(0.688))} Q ${fx(X(0.345))} ${fx(Y(0.72))} ${fx(X(0.418))} ${fx(Y(0.688))}" fill="none" stroke="${INK}" stroke-width="1.5" opacity="0.4"/>` // brim
  // the shoulder the ledge just carved, given a collar so it reads as cloth
  g += `<path d="M ${fx(X(0.14))} ${fx(Y(0.46))} Q ${fx(X(0.23))} ${fx(Y(0.6))} ${fx(X(0.285))} ${fx(Y(0.6))}" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.32"/>`
  g += `<path d="M ${fx(X(0.1))} ${fx(Y(0.2))} Q ${fx(X(0.3))} ${fx(Y(0.4))} ${fx(X(0.52))} ${fx(Y(0.42))}" fill="none" stroke="${BAZ.saffron}" stroke-width="${fx(Math.max(3, w * 0.03))}" opacity="0.9"/>`
  // kettle in the pouring hand
  g += `<ellipse cx="${fx(X(0.55))}" cy="${fx(Y(0.36))}" rx="${fx(w * 0.05)}" ry="${fx(h * 0.04)}" fill="${INK}" opacity="0.85"/>`
  g += `<path d="M ${fx(X(0.58))} ${fx(Y(0.38))} L ${fx(X(0.62))} ${fx(Y(0.42))}" stroke="${INK}" stroke-width="2.4" opacity="0.85"/>`
  // brazier: bowl + coals + tripod
  g += `<path d="M ${fx(X(0.6))} ${fx(Y(0.3))} L ${fx(X(0.86))} ${fx(Y(0.3))} L ${fx(X(0.8))} ${fx(Y(0.16))} L ${fx(X(0.66))} ${fx(Y(0.16))} Z" fill="${BAZ.terraDim}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.6"/>`
  for (const cu of [0.66, 0.72, 0.78]) g += `<circle cx="${fx(X(cu))}" cy="${fx(Y(0.3))}" r="${fx(w * 0.02)}" fill="${BAZ.saffronLit}"/>`
  g += `<line x1="${fx(X(0.64))}" y1="${fx(Y(0.16))}" x2="${fx(X(0.6))}" y2="${fx(Y(0.06))}" stroke="${INK}" stroke-width="2.2" opacity="0.75"/>`
  g += `<line x1="${fx(X(0.82))}" y1="${fx(Y(0.16))}" x2="${fx(X(0.86))}" y2="${fx(Y(0.06))}" stroke="${INK}" stroke-width="2.2" opacity="0.75"/>`
  // steam: cream, translucent toward the tip
  g += `<path d="${'M ' + steamL.map(([a, b]) => `${fx(X(a))} ${fx(Y(b))}`).join(' L ') + ' L ' + [...steamR].reverse().map(([a, b]) => `${fx(X(a))} ${fx(Y(b))}`).join(' L ')} Z" fill="${BAZ.cream}" opacity="0.9"/>`
  g += `<rect width="${w}" height="${h}" fill="url(#teaShade)"/>`
  g += `</g>`

  const defs =
    `<clipPath id="teaCut"><path d="${d}"/></clipPath>` +
    `<linearGradient id="teaShade" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${BAZ.sandLit}" stop-opacity="0.1"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0.24"/></linearGradient>`

  return svgPiece(w, h, g + rimPath(d, 4), defs)
}

/** WHEELING PIGEONS (ch5-pigeon-a/b): a soaring cut-paper bird — raised near
 *  wing, dropped far wing, fan tail — dove grey with a cream belly. `bank`
 *  flips the facing so the pair wheels toward each other. */
function bazPigeon(w, h, seed, bank) {
  const r = mulberry32(seed)
  const M = (u) => (bank > 0 ? u : 1 - u)
  const X = (u) => M(u) * w
  const Y = (v) => (1 - v) * h
  const pts = [
    // fan tail (left), body top, then the RAISED near wing
    [0.02, 0.46], [0.04, 0.64], [0.14, 0.6], [0.26, 0.6],
    [0.32, 0.64], [0.38, 0.86], [0.46, 0.98], [0.56, 0.96], [0.6, 0.86], // wing blade up
    [0.52, 0.72], [0.48, 0.62], // trailing edge back to the shoulder
    [0.62, 0.62], [0.7, 0.66], [0.78, 0.66], [0.84, 0.6], // neck + head crown
    [0.97, 0.52], [0.85, 0.46], // beak
    [0.78, 0.38], [0.64, 0.32], // throat -> belly
    [0.56, 0.28], [0.5, 0.1], [0.42, 0.02], [0.36, 0.08], [0.42, 0.28], // dropped far wing
    [0.28, 0.3], [0.12, 0.34], [0.02, 0.38],
  ]
  const mapped = pts.map(([u, v]) => [M(u), v])
  if (bank < 0) mapped.reverse()
  const outline = simplifyOutline(mapped)
  const d = outline.map(([u, v], i) => `${i ? 'L' : 'M'}${fx(u * w)} ${fx(Y(v))}`).join(' ') + ' Z'
  let g = `<g clip-path="url(#pigeonCut)">`
  g += `<rect width="${w}" height="${h}" fill="#b3a49c"/>`
  // cream belly + throat
  g += `<path d="M ${fx(X(0.02))} ${fx(Y(0.38))} Q ${fx(X(0.45))} ${fx(Y(0.5))} ${fx(X(0.85))} ${fx(Y(0.46))} L ${fx(X(0.8))} ${fx(Y(0.3))} L ${fx(X(0.05))} ${fx(Y(0.24))} Z" fill="${BAZ.cream}" opacity="0.9"/>`
  // raised wing: lighter blade + ink flight feathers
  g += `<path d="M ${fx(X(0.32))} ${fx(Y(0.64))} L ${fx(X(0.46))} ${fx(Y(0.98))} L ${fx(X(0.56))} ${fx(Y(0.96))} L ${fx(X(0.48))} ${fx(Y(0.62))} Z" fill="#c7bab2" opacity="0.9"/>`
  for (const [ua, va, ub, vb] of [[0.38, 0.84, 0.46, 0.66], [0.44, 0.92, 0.5, 0.68], [0.52, 0.92, 0.5, 0.66]]) {
    g += `<line x1="${fx(X(ua))}" y1="${fx(Y(va))}" x2="${fx(X(ub))}" y2="${fx(Y(vb))}" stroke="${INK}" stroke-width="1.6" opacity="0.4"/>`
  }
  // dropped wing shading + tail bars
  g += `<path d="M ${fx(X(0.56))} ${fx(Y(0.28))} L ${fx(X(0.5))} ${fx(Y(0.1))} L ${fx(X(0.42))} ${fx(Y(0.02))} L ${fx(X(0.42))} ${fx(Y(0.28))} Z" fill="#8d7d76"/>`
  g += `<line x1="${fx(X(0.04))}" y1="${fx(Y(0.56))}" x2="${fx(X(0.13))}" y2="${fx(Y(0.5))}" stroke="${INK}" stroke-width="1.8" opacity="0.5"/>`
  g += `<line x1="${fx(X(0.04))}" y1="${fx(Y(0.48))}" x2="${fx(X(0.13))}" y2="${fx(Y(0.44))}" stroke="${INK}" stroke-width="1.8" opacity="0.5"/>`
  // head: eye + saffron beak + a teal collar glint (city pigeon)
  g += `<circle cx="${fx(X(0.79))}" cy="${fx(Y(0.56))}" r="${fx(Math.max(1.7, w * 0.013))}" fill="${INK}"/>`
  g += `<path d="M ${fx(X(0.86))} ${fx(Y(0.54))} L ${fx(X(0.97))} ${fx(Y(0.52))} L ${fx(X(0.86))} ${fx(Y(0.47))} Z" fill="${BAZ.saffron}"/>`
  g += `<path d="M ${fx(X(0.66))} ${fx(Y(0.58))} Q ${fx(X(0.7))} ${fx(Y(0.5))} ${fx(X(0.66))} ${fx(Y(0.42))}" fill="none" stroke="${BAZ.teal}" stroke-width="2.2" opacity="${fx(rr(r, 0.5, 0.7))}"/>`
  g += `</g>`
  // The defs MUST ship with the piece: a dangling `url(#pigeonCut)` reference
  // is ignored rather than honoured, so the die-cut silently stopped cutting
  // and the #b3a49c ground rect filled the whole tile — the piece baked with
  // no alpha at all and rendered as a blank kraft chevron over the bazaar's
  // backdrop crown (bench/out/e3-board-s6.png, the "blank finial" artifact).
  const defs = `<clipPath id="pigeonCut"><path d="${d}"/></clipPath>`
  return svgPiece(w, h, g + rimPath(d, 3), defs)
}

/** THE RAISE-A-STALL FACE (ch5-raise-stall-face): the retained tabpiece
 *  re-themed into the chapter's meaning. UNFOLD bands (v-up): legIn 0..0.32 =
 *  carved stall posts + a leaning master-pattern stone, deck 0.32..0.68 = the
 *  striped awning mid-raise carrying the woodcut ⟡ RAISE A STALL ⟡ cartouche,
 *  legOut 0.68..1 = posts again with the pattern-glyph row toward the tab.
 *
 *  PRESENCE PASS (s6 polish round). At rest the piece read as a giant tent
 *  rather than a half-raised stall, and the cause was SCALE CADENCE, not
 *  geometry (which is bench-fixed and untouched here). The deck spans 0.28
 *  world along the spine; at 12 stripes that is 0.0233 world per stripe
 *  against the ~0.0165 every other awning in the spread paints (BAZ_STRIPES
 *  _PER_BAY 7 over the arc plates' ~0.12-0.14 world bays). A 40%-coarser
 *  stripe on the piece nearest the reader tells the eye the stall is half
 *  again as big as the souk behind it. So: 17 stripes (0.0165 world, the
 *  house cadence), a valance scalloped at that same pitch, a cartouche sized
 *  as a hung signboard instead of a banner across the whole awning, and a
 *  graded ink shadow thrown DOWN both leg bands from the deck seams — the
 *  shade a raised awning casts on its own posts, which is what makes it read
 *  as raised rather than as a closed tent. */
function bazRaiseStallFace(w, h, seed) {
  const r = mulberry32(seed)
  const Y = (v) => (1 - v) * h
  const WOODB = '#6b4a26'
  const WOODB_LIT = '#9a7038'
  // House awning cadence carried onto the deck (see the note above).
  const nst = 17
  const pitch = w / nst
  let s = `<rect width="${w}" height="${h}" fill="${BAZ.sand}"/>`

  // Four slim posts instead of two fat ones: same frame, read at the souk's
  // own scale. `goods` gives the two bands different furniture so the unfold
  // does not read as one mirrored shape.
  const legBand = (v0, v1, glyphRow, goods) => {
    let out = ''
    const y0 = Y(v1)
    const bh = Y(v0) - Y(v1)
    const pw = w * 0.055
    for (const ux of [0.14, 0.33, 0.585, 0.79]) {
      out += `<rect x="${fx(ux * w)}" y="${fx(y0)}" width="${fx(pw)}" height="${fx(bh)}" fill="${WOODB}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.55"/>`
      out += `<rect x="${fx(ux * w + 1.5)}" y="${fx(y0)}" width="${fx(w * 0.013)}" height="${fx(bh)}" fill="${WOODB_LIT}" opacity="0.7"/>`
      for (let c = 0; c < 8; c++) {
        const cy = y0 + bh * (0.09 + c * 0.115)
        out += `<path d="M ${fx(ux * w + w * 0.012)} ${fx(cy)} L ${fx(ux * w + pw / 2)} ${fx(cy - 4)} L ${fx(ux * w + pw - w * 0.012)} ${fx(cy)}" fill="none" stroke="${BAZ.cream}" stroke-width="1.3" opacity="0.7"/>`
      }
    }
    // cross-braces, one per post bay
    for (const [ua, ub] of [[0.195, 0.325], [0.385, 0.58], [0.64, 0.785]]) {
      out += `<line x1="${fx(ua * w)}" y1="${fx(y0 + bh * 0.82)}" x2="${fx(ub * w)}" y2="${fx(y0 + bh * 0.2)}" stroke="${WOODB}" stroke-width="4.5" opacity="0.85"/>`
      out += `<line x1="${fx(ua * w)}" y1="${fx(y0 + bh * 0.2)}" x2="${fx(ub * w)}" y2="${fx(y0 + bh * 0.82)}" stroke="${WOODB}" stroke-width="4.5" opacity="0.85"/>`
    }
    // the leaning master-pattern stone, now one object among several
    const sx = w * 0.395
    const sy = y0 + bh * 0.46
    out += `<g transform="rotate(-8 ${fx(sx)} ${fx(sy)})">` +
      `<rect x="${fx(sx)}" y="${fx(sy)}" width="${fx(w * 0.165)}" height="${fx(bh * 0.3)}" rx="4" fill="${BAZ.sandLit}" stroke="${INK}" stroke-width="1.6" stroke-opacity="0.6"/>`
    for (let gk = 0; gk < 3; gk++) {
      const gx = sx + w * 0.03 + gk * w * 0.045
      out += `<path d="M ${fx(gx)} ${fx(sy + bh * 0.15)} l 5.5 -5.5 l 5.5 5.5 l -5.5 5.5 Z" fill="none" stroke="${INK}" stroke-width="1.5" opacity="0.7"/>`
    }
    out += `</g>`
    if (goods) {
      // crates + jars stacked against the outer posts — the scale ruler
      for (const [ux, cwF, chF] of [[0.045, 0.085, 0.13], [0.045, 0.06, 0.09], [0.865, 0.09, 0.15]]) {
        const cy = y0 + bh * (0.86 - chF)
        out += `<rect x="${fx(ux * w)}" y="${fx(cy)}" width="${fx(w * cwF)}" height="${fx(bh * chF)}" fill="${BAZ.sandDim}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.6"/>`
        out += `<line x1="${fx(ux * w)}" y1="${fx(cy + bh * chF * 0.5)}" x2="${fx((ux + cwF) * w)}" y2="${fx(cy + bh * chF * 0.5)}" stroke="${INK}" stroke-width="1.2" opacity="0.45"/>`
      }
      for (const [ux, uv] of [[0.475, 0.2], [0.53, 0.19]]) {
        out += `<ellipse cx="${fx(ux * w)}" cy="${fx(y0 + bh * 0.8)}" rx="${fx(w * 0.028)}" ry="${fx(bh * uv * 0.35)}" fill="${BAZ.terraDim}" stroke="${INK}" stroke-width="1.3" stroke-opacity="0.55"/>`
      }
    }
    if (glyphRow) {
      for (let gk = 0; gk < 7; gk++) {
        const gx = w * (0.13 + gk * 0.125)
        out += `<path d="M ${fx(gx)} ${fx(y0 + bh * 0.05)} l 5 -5 l 5 5 l -5 5 Z" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.55"/>`
      }
    }
    return out
  }

  s += legBand(0, 0.32, false, true)
  s += legBand(0.68, 1, true, false)

  // THE DECK: striped awning mid-raise + the woodcut cartouche
  const dy0 = Y(0.68)
  const dh = Y(0.32) - Y(0.68)
  for (let i = 0; i < nst; i++) {
    s += `<rect x="${fx(i * pitch)}" y="${fx(dy0)}" width="${fx(pitch + 0.5)}" height="${fx(dh)}" fill="${i % 2 ? BAZ.cream : BAZ.teal}"/>`
    // a saffron pinstripe down each cream bay: sub-stripe grain, so the
    // awning still holds detail when the deck foreshortens at rest
    if (i % 2) {
      s += `<line x1="${fx(i * pitch + pitch / 2)}" y1="${fx(dy0)}" x2="${fx(i * pitch + pitch / 2)}" y2="${fx(dy0 + dh)}" stroke="${BAZ.saffron}" stroke-width="1.5" opacity="0.42"/>`
    }
  }
  // scalloped valance at both band seams, hung at the stripe pitch
  for (const by of [dy0, dy0 + dh]) {
    for (let i = 0; i < nst; i++) {
      const cx = (i + 0.5) * pitch
      s += `<path d="M ${fx(cx - pitch / 2)} ${fx(by)} A ${fx(pitch / 2)} ${fx(pitch * 0.44)} 0 0 0 ${fx(cx + pitch / 2)} ${fx(by)}" fill="none" stroke="${INK}" stroke-width="1.3" opacity="0.45"/>`
    }
  }
  // THE SHADOW THE AWNING THROWS: a graded ink band running off each deck
  // seam down its leg band. This is the read the resting pose was missing —
  // an unshaded seam makes deck and legs one continuous sheet (a tent);
  // shaded, the deck sits ABOVE the posts it is being raised over.
  const shadeH = dh * 0.5
  s += `<rect x="0" y="${fx(dy0 - shadeH)}" width="${w}" height="${fx(shadeH)}" fill="url(#stallShadeUp)"/>`
  s += `<rect x="0" y="${fx(dy0 + dh)}" width="${w}" height="${fx(shadeH)}" fill="url(#stallShadeDown)"/>`
  // the woodcut cartouche: walnut plate, cream field, engraved legend
  const cw2 = w * 0.68
  const chh = dh * 0.26
  const cx0 = (w - cw2) / 2
  const cy0 = dy0 + dh / 2 - chh / 2
  s += `<rect x="${fx(cx0)}" y="${fx(cy0)}" width="${fx(cw2)}" height="${fx(chh)}" rx="10" fill="${INK}" opacity="0.92"/>`
  s += `<rect x="${fx(cx0 + 5)}" y="${fx(cy0 + 5)}" width="${fx(cw2 - 10)}" height="${fx(chh - 10)}" rx="7" fill="${BAZ.cream}"/>`
  s += `<rect x="${fx(cx0 + 11)}" y="${fx(cy0 + 11)}" width="${fx(cw2 - 22)}" height="${fx(chh - 22)}" rx="5" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.6"/>`
  // ⟡ RAISE A STALL ⟡ — 12 glyph cells + flanking lozenges
  const word = 'RAISE A STALL'
  const cells = word.length
  const gw = (cw2 - 96) / cells
  const gh = chh * 0.34
  const gy = cy0 + chh / 2 - gh / 2
  s += engraveWord(word, cx0 + 48, gy, gw * 0.72, gh, gw * 0.28, INK, 3.4)
  for (const lx of [cx0 + 24, cx0 + cw2 - 24]) {
    s += `<path d="M ${fx(lx)} ${fx(cy0 + chh / 2 - 9)} l 9 9 l -9 9 l -9 -9 Z" fill="none" stroke="${INK}" stroke-width="2.4"/>`
    s += `<circle cx="${fx(lx)}" cy="${fx(cy0 + chh / 2)}" r="2.4" fill="${INK}"/>`
  }
  void r
  // Deck-seam shadow ramps: darkest AT the seam, gone half a deck-height into
  // each leg band. `Up` runs off the deck's upper seam into legOut, `Down` off
  // the lower seam into legIn.
  const defs =
    `<linearGradient id="stallShadeUp" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${INK}" stop-opacity="0"/>` +
    `<stop offset="0.62" stop-color="${INK}" stop-opacity="0.16"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0.46"/></linearGradient>` +
    `<linearGradient id="stallShadeDown" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${INK}" stop-opacity="0.5"/>` +
    `<stop offset="0.38" stop-color="${INK}" stop-opacity="0.18"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient>`
  return svgPiece(w, h, s, defs)
}

/**
 * THE RAISE-A-STALL PULL TAB (ch5-raise-stall-tab). Reader finding BW-13: "the
 * shared grey tab-grip reads as an untextured placeholder" — the tabpiece was
 * printing the engine's fallback kraft grip because no `<id>-tab` art existed.
 * The engine now prints this when it is present, so the handle can be the same
 * printed card stock as the card it pulls.
 *
 * GEOMETRY THIS PAINTS TO (do not re-derive): the tab is a portrait quad whose
 * image x runs ACROSS the tab's width (0.1 world along the spine) and whose
 * image y runs ALONG the pull direction (0.20 world at rest). v=1 (image TOP) is
 * the OUTER TIP, the end sticking off the page edge; the image BOTTOM is where
 * the strip enters the slit in the page fore edge. So the bottom band is painted
 * as the part still coming out of the page — darker walnut with a hard ink line
 * at the very cut — and the top as the finger end.
 *
 * The middle carries the SAME stripe cadence as the bazRaiseStallFace deck (the
 * house 0.0165 world pitch: six stripes across the tab's 0.1 world) plus its
 * saffron pinstripe and a cream cartouche, so tab and card are visibly one sheet
 * of stock rather than a handle stuck onto a card. On-palette only — the grey it
 * replaces was the only grey in the chapter.
 */
function bazRaiseStallTab(w, h, seed) {
  const r = mulberry32(seed)
  const Y = (v) => (1 - v) * h
  const WOODB = '#6b4a26'
  const WOODB_LIT = '#9a7038'
  const nst = 6
  const pitch = w / nst
  const vSlit = 0.18 // below this the strip is still inside the page
  const vGrip = 0.7 // above this is the finger end

  let s = `<rect width="${w}" height="${h}" fill="${BAZ.sand}"/>`

  // ---- THE STRIPED SHAFT: the card's own awning stock, run along the pull.
  for (let k = 0; k < nst; k++) {
    s += `<rect x="${fx(k * pitch)}" y="${fx(Y(vGrip))}" width="${fx(pitch + 0.5)}" height="${fx(Y(vSlit) - Y(vGrip))}" fill="${k % 2 ? BAZ.cream : BAZ.teal}"/>`
    if (k % 2) {
      s += `<line x1="${fx((k + 0.5) * pitch)}" y1="${fx(Y(vGrip))}" x2="${fx((k + 0.5) * pitch)}" y2="${fx(Y(vSlit))}" stroke="${BAZ.saffron}" stroke-width="1.6" opacity="0.45"/>`
    }
  }
  // the cream cartouche strip across the shaft, lozenges in the house pattern
  const cy0 = Y(0.54)
  const chh = Y(0.41) - cy0
  s += `<rect x="${fx(w * 0.06)}" y="${fx(cy0)}" width="${fx(w * 0.88)}" height="${fx(chh)}" rx="5" fill="${INK}" opacity="0.9"/>`
  s += `<rect x="${fx(w * 0.06 + 3.5)}" y="${fx(cy0 + 3.5)}" width="${fx(w * 0.88 - 7)}" height="${fx(chh - 7)}" rx="3.5" fill="${BAZ.cream}"/>`
  for (const lx of [w * 0.28, w * 0.5, w * 0.72]) {
    const lz = chh * 0.24
    s += `<path d="M ${fx(lx)} ${fx(cy0 + chh / 2 - lz)} l ${fx(lz)} ${fx(lz)} l ${fx(-lz)} ${fx(lz)} l ${fx(-lz)} ${fx(-lz)} Z" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`
  }

  // ---- THE SLIT END: the walnut band still emerging from the page, with the
  // cut it is pulled through drawn as a hard ink line at the very bottom edge.
  s += `<rect y="${fx(Y(vSlit))}" width="${w}" height="${fx(Y(0) - Y(vSlit))}" fill="${WOODB}"/>`
  s += `<rect y="${fx(Y(vSlit))}" width="${w}" height="3" fill="${WOODB_LIT}" opacity="0.75"/>`
  s += `<rect y="${fx(Y(vSlit) + 3)}" width="${w}" height="${fx(Y(0) - Y(vSlit) - 3)}" fill="url(#stallTabSlit)"/>`
  s += `<line x1="0" y1="${fx(h - 1.6)}" x2="${w}" y2="${fx(h - 1.6)}" stroke="${INK}" stroke-width="3.2"/>`

  // ---- THE FINGER END: a cream pad carrying the punched hole, the lozenge and
  // an outward chevron, so the reader can see which way the strip travels.
  s += `<rect y="0" width="${w}" height="${fx(Y(vGrip))}" fill="${BAZ.cream}"/>`
  s += `<line x1="0" y1="${fx(Y(vGrip))}" x2="${w}" y2="${fx(Y(vGrip))}" stroke="${INK}" stroke-width="1.8" opacity="0.5"/>`
  // the chevron: outward = toward the tip = up the image. Kept clear of the
  // finger hole — the first bake had the two overlapping and the pair read as a
  // face (a dark eye over a smiling V) rather than as a handle.
  const cxm = w / 2
  s += `<path d="M ${fx(cxm - w * 0.17)} ${fx(h * 0.052)} L ${fx(cxm)} ${fx(h * 0.014)} L ${fx(cxm + w * 0.17)} ${fx(h * 0.052)}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round" opacity="0.8"/>`
  // the punched finger hole: the dark of the hole, its ink rim, and the cream
  // lip the punch pushed up on the far side
  const fhy = h * 0.175
  const fhr = w * 0.16
  s += `<circle cx="${fx(cxm)}" cy="${fx(fhy)}" r="${fx(fhr)}" fill="${INK}" opacity="0.86"/>`
  s += `<circle cx="${fx(cxm)}" cy="${fx(fhy)}" r="${fx(fhr)}" fill="none" stroke="${INK}" stroke-width="2.4"/>`
  s += `<path d="M ${fx(cxm - fhr * 0.72)} ${fx(fhy + fhr * 0.5)} A ${fx(fhr * 0.88)} ${fx(fhr * 0.88)} 0 0 0 ${fx(cxm + fhr * 0.72)} ${fx(fhy + fhr * 0.5)}" fill="none" stroke="${BAZ.cream}" stroke-width="2.6" opacity="0.9"/>`
  // the rounded lozenge plaque below the hole, matching the card cartouche's
  // flanking pair — the printed maker's mark that ties handle to card
  const pl0 = h * 0.3
  const plh = h * 0.085
  s += `<rect x="${fx(w * 0.22)}" y="${fx(pl0)}" width="${fx(w * 0.56)}" height="${fx(plh)}" rx="${fx(plh * 0.45)}" fill="${BAZ.cream}" stroke="${INK}" stroke-width="2.2" stroke-opacity="0.8"/>`
  const lz2 = plh * 0.3
  s += `<path d="M ${fx(cxm)} ${fx(pl0 + plh / 2 - lz2)} l ${fx(lz2)} ${fx(lz2)} l ${fx(-lz2)} ${fx(lz2)} l ${fx(-lz2)} ${fx(-lz2)} Z" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`
  s += `<circle cx="${fx(cxm)}" cy="${fx(pl0 + plh / 2)}" r="2.2" fill="${INK}"/>`

  // ---- the printed card edge: a cream core and an ink rule inset from the cut,
  // the flat-print equivalent of the die-cut rim the shaped pieces carry
  s += `<rect x="4" y="4" width="${fx(w - 8)}" height="${fx(h - 8)}" fill="none" stroke="${RIM}" stroke-width="3" opacity="0.85"/>`
  s += `<rect x="4" y="4" width="${fx(w - 8)}" height="${fx(h - 8)}" fill="none" stroke="${INK}" stroke-width="1.5" opacity="0.55"/>`
  void r

  const defs =
    `<linearGradient id="stallTabSlit" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${INK}" stop-opacity="0.05"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0.55"/></linearGradient>`
  return svgPiece(w, h, s, defs)
}

/**
 * THE DOODLED MARKET FLOOR (page-6, both pages in one image — same uv law as
 * page-4): cart ruts leading in from the apron between the treads, spice spills,
 * price tags, a cat's footprints sneaking to the fish stall, the tea rug under
 * `ch5-tea` — walnut ink on parchment, Vegas-ref doodle density.
 *
 * THE BOLD PASS, and why the first one read as a whisper. Measured off the
 * previous bake: mean luma 192, 0.45% of pixels below luma 150 and NOT ONE pixel
 * below 110 — on a page whose ink is supposed to be walnut #3b2a1a (luma 46).
 * Two compounding causes, both fixed here:
 *   1. the wrong pigment — it drew in #5c4526, the s4 yard print's softer
 *      walnut, which is a mid-tone on parchment before any alpha is applied;
 *   2. then put it at opacity 0.22-0.5, so nothing landed within reach of the
 *      one element that DID read, the tea rug's terracotta.
 * So: house INK at 0.5-0.9, and a real VALUE STEP — a terracotta dust field over
 * the sunken bowl — so the standing pieces have a floor to sit on instead of
 * hovering over blank parchment. The tea rug is left exactly as it was and used
 * as the calibration reference; everything else is brought up to meet it.
 *
 * Two READS were wrong too, not just the values, and no amount of contrast would
 * have fixed them: twin lines with regular cross-ties are a RAILWAY, so the ruts
 * are now tapered scuffed bands with chatter marks ALONG them and never across;
 * and uniform hairline dashes marching the full width are a ruled timetable, so
 * the market lanes are now painted bands carrying dense cobble courses.
 */
function bazaarFloorSpread(w, h, seed) {
  const r = mulberry32(seed)
  const PX = (f) => f * w
  const PY = (f) => f * h
  // House walnut (#3b2a1a) for ALL linework — the chapter law. DUST is the
  // field wash under the bowl; SCUFF the softer walnut for secondary marks.
  const SCUFF = '#5c4526'

  let s = `<g>`
  s += `<rect width="${w}" height="${h}" fill="${ROOK.parch}"/>`
  for (let i = 0; i < 170; i++) {
    const y = rr(r, 0, h)
    s += `<line x1="0" y1="${fx(y)}" x2="${w}" y2="${fx(y)}" stroke="${SCUFF}" stroke-width="1" opacity="${fx(rr(r, 0.03, 0.07))}"/>`
  }

  // ---- THE VALUE STEP: trodden terracotta dust over the sunken market bowl,
  // darkest along the lane the crowd walks. This is what makes the floor a
  // FLOOR at the pinned camera; the doodles then sit on a field, not on blank
  // paper. Kept off the far quarter so the recession still reads.
  s += `<ellipse cx="${fx(PX(0.5))}" cy="${fx(PY(pageFY(0.16)))}" rx="${fx(PX(0.52))}" ry="${fx(PY(0.3))}" fill="url(#bazDust6)"/>`
  s += `<ellipse cx="${fx(PX(0.5))}" cy="${fx(PY(pageFY(0.3)))}" rx="${fx(PX(0.36))}" ry="${fx(PY(0.14))}" fill="${BAZ.terraDim}" opacity="0.13"/>`
  s += `<rect width="${w}" height="${fx(h * 0.26)}" fill="url(#bazHaze6)"/>`

  // ---- READER FINDING S6-7c: "the page-floor graphics read as dirt. The tan
  // page is covered in dark rings, blobs, scattered dashes and ochre/red
  // splashes. Intended as a ground plan or crowd, they land as stains and
  // smudges on the paper." The previous pass had stacked SIX kinds of mark over
  // the whole spread — four cobble lanes, two cart-rut routes, ten spice spills,
  // four price tags, nine footfall clusters, twelve sack rings, a cat trail and
  // ten broom fans — every one of them individually defensible and the SUM of
  // them a mess. Nothing here needed more contrast; it needed FEWER KINDS,
  // BIGGER, AND ON PURPOSE.
  //
  // So the floor is rebuilt as a souk GROUND PLAN with one organising structure:
  // ONE swept market lane, and laid along it a ROW OF RUGS with the tea rug as
  // one of its members, with crowd SHADOW POOLS standing at the rugs. Everything
  // else either aligns to that line or is gone. A shadow pool is the one mark
  // that can never be read as a stain — a soft dark ellipse on the ground is
  // unambiguously "somebody is standing here" — which is why the crowd is now
  // painted as shadows and not as more speckle.
  //
  // KEPT: the terracotta dust value step (it makes the floor a floor), the tea
  // rug (the calibration reference, untouched), one lane, one cart-rut route.
  // CUT: three of the four lanes, one of the two rut routes, eight of the ten
  // spice spills, two of the four price tags, six of the nine footfall clusters,
  // all twelve loose sack rings (they were literally the reader's "dark rings"),
  // and all ten broom fans (they were the "scattered dashes", and they sat
  // exactly where the pull-tab linkage below now goes).
  const LANE_Z = 0.1
  const laneFy = pageFY(LANE_Z)
  const laneRise = 0.085 - (LANE_Z + 0.75) * 0.04
  const laneY = (t) => {
    const mt = 1 - t
    return mt * mt * (laneFy - laneRise * 0.5) + 2 * mt * t * (laneFy + laneRise) + t * t * (laneFy - laneRise * 0.5)
  }
  {
    // The lane keeps the cobble treatment the bold pass arrived at: the ink
    // inside it is a field of individual SETTS, never a stroke laid along the
    // arc, because anything drawn along the arc direction at this scale
    // re-forms into a dashed line and the timetable read comes straight back.
    const band = 0.05
    const stones = 148
    const op = 0.64
    const bandAt = (t) => band * (0.72 + 0.42 * Math.sin(t * 6.4 + LANE_Z * 9))
    let bandD = `M 0 ${fx(PY(laneY(0) - bandAt(0) * 0.5))}`
    for (let i = 1; i <= 32; i++) bandD += ` L ${fx(PX(i / 32))} ${fx(PY(laneY(i / 32) - bandAt(i / 32) * 0.5))}`
    for (let i = 32; i >= 0; i--) bandD += ` L ${fx(PX(i / 32))} ${fx(PY(laneY(i / 32) + bandAt(i / 32) * 0.5))}`
    s += `<path d="${bandD} Z" fill="${BAZ.rose}" opacity="${fx(0.12 + op * 0.2)}"/>`
    s += `<path d="${bandD} Z" fill="url(#bazLane6)"/>`
    for (let i = 0; i < stones; i++) {
      const t = (i + rr(r, 0.1, 0.9)) / stones
      const edge = Math.min(1, Math.min(t, 1 - t) / 0.2) // matches #bazLane6
      if (edge <= 0.02) continue
      if (rr(r, 0, 1) > (0.5 + 0.5 * Math.abs(Math.sin(t * 9.3 + LANE_Z * 5))) * edge) continue
      const yo = rr(r, -0.44, 0.44) * bandAt(t)
      const sx = rr(r, 6, 14)
      const sy = sx * rr(r, 0.52, 0.8)
      const cx = PX(t)
      const cy = PY(laneY(t) + yo)
      const o = op * edge
      s += `<rect x="${fx(cx - sx / 2)}" y="${fx(cy - sy / 2)}" width="${fx(sx)}" height="${fx(sy)}" rx="${fx(sy * 0.34)}" transform="rotate(${fx(rr(r, -26, 26))} ${fx(cx)} ${fx(cy)})" fill="${INK}" fill-opacity="${fx(o * rr(r, 0.14, 0.34))}" stroke="${INK}" stroke-width="${fx(rr(r, 2, 2.9))}" stroke-opacity="${fx(o * rr(r, 0.62, 1))}"/>`
    }
  }
  s += `<rect x="${fx(w * 0.46)}" y="0" width="${fx(w * 0.08)}" height="${h}" fill="url(#bazGutter6)"/>`

  // ---- ONE CART RUT ROUTE, in from the left apron and threading the tread gap
  // toward the arc doors. What separates a rut from a rail is that a rut is
  // BROKEN and WANDERS, so it ships as 5-7 arcs with gaps over a broad dust
  // smear, its gauge wandering on a sine. The second route is cut: two long
  // diagonals plus four lanes were reading as a junction, and the right-hand
  // route ran under the new stall row's footprint where nothing can be seen.
  {
    const CTRL = [[0.14, 1.0], [0.24, 0.84], [0.34, 0.66], [0.43, 0.47]]
    const bez = (t) => {
      const mt = 1 - t
      return [0, 1].map((k) => mt * mt * mt * CTRL[0][k] + 3 * mt * mt * t * CTRL[1][k] + 3 * mt * t * t * CTRL[2][k] + t * t * t * CTRL[3][k])
    }
    let smear = ''
    for (let i = 0; i <= 26; i++) {
      const [bx, by] = bez(i / 26)
      smear += `${i ? 'L' : 'M'}${fx(PX(bx))} ${fx(PY(by))} `
    }
    // the dust the wheels threw. At w*0.032 / 0.15 this baked as a 33 px grey
    // band and read as a PLANK laid across the page — the widest single mark on
    // the floor, and the rut patches on top of it as dashes on a board.
    s += `<path d="${smear.trim()}" fill="none" stroke="${BAZ.terraDim}" stroke-width="${fx(w * 0.017)}" opacity="0.12" stroke-linecap="round"/>`
    for (const side of [-1, 1]) {
      const off = (t) => side * (0.0062 + 0.0028 * Math.sin(t * 5.1 + 2.2))
      const segs = 5 + ((side > 0 ? 2 : 1) % 3)
      for (let sg = 0; sg < segs; sg++) {
        const t0 = sg / segs + rr(r, 0.01, 0.05)
        const t1 = Math.min(1, (sg + 1) / segs - rr(r, 0.02, 0.07))
        if (t1 <= t0) continue
        const steps = 7
        let up = ''
        let dn = ''
        for (let i = 0; i <= steps; i++) {
          const t = lerp(t0, t1, i / steps)
          const [bx, by] = bez(t)
          const hw = lerp(0.0014, 0.004, t) * rr(r, 0.85, 1.15)
          up += `${i ? 'L' : 'M'}${fx(PX(bx + off(t) - hw))} ${fx(PY(by))} `
          dn = `L${fx(PX(bx + off(t) + hw))} ${fx(PY(by))} ` + dn
        }
        s += `<path d="${(up + dn).trim()} Z" fill="${INK}" opacity="${fx(rr(r, 0.5, 0.68))}"/>`
      }
      for (let i = 0; i < 5; i++) {
        const t = rr(r, 0.05, 0.95)
        const [bx, by] = bez(t)
        const [nx, ny] = bez(Math.min(1, t + rr(r, 0.03, 0.06)))
        const j = rr(r, -0.008, 0.008)
        s += `<line x1="${fx(PX(bx + off(t) + j))}" y1="${fx(PY(by))}" x2="${fx(PX(nx + off(t) + j))}" y2="${fx(PY(ny))}" stroke="${INK}" stroke-width="${fx(rr(r, 1.6, 2.4))}" opacity="${fx(rr(r, 0.28, 0.46))}" stroke-linecap="round"/>`
      }
    }
  }

  // ---- THE ROW OF LAID-OUT RUGS: the organising structure the floor was
  // missing. Five clean rectangles with fringed ends and a border motif, laid in
  // an orderly line along the lane, in the tea rug's own idiom and at the tea
  // rug's own value — so the page reads as ONE system of goods laid out on the
  // ground rather than as a field of unrelated marks. Their t positions leave
  // the spine gutter and the tea rug's own footprint clear, so the six rugs
  // (these five plus the tea rug) form a single unbroken line across the spread.
  const RUG_W = 0.1
  const RUG_H = 0.072
  const rugTs = [0.08, 0.2, 0.32, 0.615, 0.86]
  const rugXY = rugTs.map((t) => [PX(t - RUG_W / 2), PY(laneY(t) + 0.024)])
  rugXY.forEach(([rgx, rgy], i) => {
    const rw = PX(RUG_W)
    const rh = PY(RUG_H)
    s += `<rect x="${fx(rgx)}" y="${fx(rgy)}" width="${fx(rw)}" height="${fx(rh)}" rx="4" fill="${i % 2 ? BAZ.terra : BAZ.tealDim}" opacity="0.4"/>`
    s += `<rect x="${fx(rgx + 5)}" y="${fx(rgy + 5)}" width="${fx(rw - 10)}" height="${fx(rh - 10)}" rx="3" fill="none" stroke="${i % 2 ? BAZ.teal : BAZ.saffron}" stroke-width="3" opacity="0.5"/>`
    // the centre motif: a lozenge, the same mark the cartouches and the lift lip
    // carry, so the goods are stamped with the chapter's own pattern
    const mcx = rgx + rw / 2
    const mcy = rgy + rh / 2
    const mz = rh * 0.24
    s += `<path d="M ${fx(mcx)} ${fx(mcy - mz)} L ${fx(mcx + mz * 1.5)} ${fx(mcy)} L ${fx(mcx)} ${fx(mcy + mz)} L ${fx(mcx - mz * 1.5)} ${fx(mcy)} Z" fill="none" stroke="${INK}" stroke-width="2.2" opacity="0.5"/>`
    for (let f = 0; f <= 6; f++) {
      const fyp = rgy + (rh * f) / 6
      s += `<line x1="${fx(rgx)}" y1="${fx(fyp)}" x2="${fx(rgx - 5)}" y2="${fx(fyp)}" stroke="${INK}" stroke-width="1.8" opacity="0.55"/>`
      s += `<line x1="${fx(rgx + rw)}" y1="${fx(fyp)}" x2="${fx(rgx + rw + 5)}" y2="${fx(fyp)}" stroke="${INK}" stroke-width="1.8" opacity="0.55"/>`
    }
  })

  // ---- THE TEA RUG under ch5-tea (right page, radial 0.50..0.62, z 0.10..0.24).
  // UNCHANGED across both passes: it was the one element that read at the pinned
  // camera, so it is the value everything else is brought up to meet — and now
  // also the member of the rug row the row is calibrated against.
  const rx0 = PX(pageFX(0.48, 'right'))
  const rx1 = PX(pageFX(0.64, 'right'))
  const ry0 = PY(pageFY(0.08))
  const ry1 = PY(pageFY(0.26))
  s += `<rect x="${fx(rx0)}" y="${fx(ry0)}" width="${fx(rx1 - rx0)}" height="${fx(ry1 - ry0)}" rx="6" fill="${BAZ.terra}" opacity="0.4"/>`
  s += `<rect x="${fx(rx0 + 5)}" y="${fx(ry0 + 5)}" width="${fx(rx1 - rx0 - 10)}" height="${fx(ry1 - ry0 - 10)}" rx="4" fill="none" stroke="${BAZ.teal}" stroke-width="3" opacity="0.5"/>`
  for (let f = 0; f <= 8; f++) {
    const fxp = rx0 + ((rx1 - rx0) * f) / 8
    s += `<line x1="${fx(fxp)}" y1="${fx(ry0)}" x2="${fx(fxp)}" y2="${fx(ry0 - 4)}" stroke="${INK}" stroke-width="1.8" opacity="0.6"/>`
    s += `<line x1="${fx(fxp)}" y1="${fx(ry1)}" x2="${fx(fxp)}" y2="${fx(ry1 + 4)}" stroke="${INK}" stroke-width="1.8" opacity="0.6"/>`
  }

  // ---- TWO PRICE TAGS, and both of them ON a rug. Four tags scattered over the
  // open floor were labels pinned in front of the scene with nothing to label;
  // a tag lying on the goods it prices is a caption.
  ;[rugXY[1], rugXY[3]].forEach(([rgx, rgy], i) => {
    const tx = rgx + PX(RUG_W) * 0.14
    const ty = rgy + PY(RUG_H) * 0.2
    const tw = 26
    const th = 38
    s += `<g transform="rotate(${fx(rr(r, -22, 22))} ${fx(tx)} ${fx(ty)})">`
    s += `<path d="M ${fx(tx)} ${fx(ty)} L ${fx(tx + tw)} ${fx(ty)} L ${fx(tx + tw)} ${fx(ty + th * 0.78)} L ${fx(tx + tw / 2)} ${fx(ty + th)} L ${fx(tx)} ${fx(ty + th * 0.78)} Z" fill="${BAZ.cream}" opacity="0.85" stroke="${INK}" stroke-width="2.2" stroke-opacity="0.7"/>`
    s += `<circle cx="${fx(tx + tw / 2)}" cy="${fx(ty + 6)}" r="2.6" fill="none" stroke="${INK}" stroke-width="1.8" opacity="0.6"/>`
    const marks = 2 + i
    for (let m = 0; m < marks; m++) {
      const mx = tx + tw * 0.26 + m * tw * 0.16
      s += `<line x1="${fx(mx)}" y1="${fx(ty + th * 0.34)}" x2="${fx(mx + 2.4)}" y2="${fx(ty + th * 0.64)}" stroke="${INK}" stroke-width="2.4" opacity="0.68"/>`
    }
    s += `</g>`
  })

  // ---- TWO SPICE SPILLS, each with its own TIPPED SACK, set on the apron side
  // of the lane. Ten free-floating drifts of saffron and terracotta were the
  // "ochre/red splashes"; a spill with a visible culprit is an incident.
  for (const [sxf, syf, col] of [[0.155, 0.72, BAZ.saffron], [0.72, 0.755, BAZ.terra]]) {
    const sx = PX(sxf)
    const sy = PY(syf)
    const rad = 40
    s += `<ellipse cx="${fx(sx + 20)}" cy="${fx(sy + 10)}" rx="${fx(rad)}" ry="${fx(rad * 0.46)}" fill="${col}" opacity="0.6"/>`
    s += `<ellipse cx="${fx(sx + 8)}" cy="${fx(sy + 4)}" rx="${fx(rad * 0.5)}" ry="${fx(rad * 0.24)}" fill="${col}" opacity="0.5"/>`
    for (let k = 0; k < 22; k++) {
      const a = rr(r, 0, Math.PI * 2)
      const rr2 = rad * rr(r, 1.02, 1.7)
      s += `<circle cx="${fx(sx + 20 + Math.cos(a) * rr2)}" cy="${fx(sy + 10 + Math.sin(a) * rr2 * 0.45)}" r="${fx(rr(r, 1.8, 4))}" fill="${col}" opacity="${fx(rr(r, 0.5, 0.85))}"/>`
    }
    // the sack it came out of, mouth toward the drift
    s += `<path d="M ${fx(sx)} ${fx(sy)} q ${fx(-26)} ${fx(-8)} ${fx(-34)} ${fx(-30)} q ${fx(14)} ${fx(-12)} ${fx(34)} ${fx(-6)} q ${fx(12)} ${fx(16)} 0 ${fx(36)} Z" fill="${BAZ.sandDim}" opacity="0.8" stroke="${INK}" stroke-width="2.8" stroke-opacity="0.75"/>`
    s += `<path d="M ${fx(sx - 34)} ${fx(sy - 30)} q ${fx(10)} ${fx(-9)} ${fx(20)} ${fx(-4)}" fill="none" stroke="${INK}" stroke-width="2.4" opacity="0.6"/>`
  }

  // ---- THE CROWD, as SHADOW POOLS. The reader's crowd read failed because the
  // crowd was painted as scatter, and scatter on paper is dirt. A tight group of
  // soft ink ellipses on the ground cannot be read as anything except people
  // standing there, and it carries real dark weight without adding a new KIND of
  // mark. Four groups, each one placed at a rug, on the far side of the lane.
  for (let cl = 0; cl < 4; cl++) {
    const t = [0.11, 0.29, 0.56, 0.82][cl]
    const bx = PX(t)
    // just clear of the cobble band: inside it the setts ate the pools
    const by = PY(laneY(t) - 0.034)
    for (let k = 0; k < 5; k++) {
      const ox = (k - 2) * 16 + (k % 2 ? 6 : -6)
      const oy = (k % 3) * 7 - 6
      const prx = 16 - Math.abs(k - 2) * 2
      s += `<ellipse cx="${fx(bx + ox)}" cy="${fx(by + oy)}" rx="${fx(prx * 1.35)}" ry="${fx(prx * 0.62)}" fill="${INK}" opacity="0.09"/>`
      s += `<ellipse cx="${fx(bx + ox)}" cy="${fx(by + oy)}" rx="${fx(prx)}" ry="${fx(prx * 0.42)}" fill="${INK}" opacity="0.22"/>`
    }
  }

  // ---- THREE FOOTFALL TRAILS that GO somewhere: off the lane, down toward the
  // reader's apron. Nine clusters at random headings were the "scattered dashes";
  // a trail that starts on the street and walks out of frame is traffic.
  for (let tr = 0; tr < 3; tr++) {
    const t = [0.22, 0.5, 0.78][tr]
    const bx = PX(t)
    const by = PY(laneY(t) + 0.052)
    for (let k = 0; k < 4; k++) {
      const fxp = bx + (k % 2 ? 8 : -8) + k * 3
      const fyp = by + k * 19
      const rot = rr(r, -12, 12)
      s += `<g transform="rotate(${fx(rot)} ${fx(fxp)} ${fx(fyp)})" opacity="${fx(rr(r, 0.42, 0.6))}">`
      s += `<ellipse cx="${fx(fxp)}" cy="${fx(fyp)}" rx="3.6" ry="6.6" fill="${INK}"/>`
      s += `<ellipse cx="${fx(fxp)}" cy="${fx(fyp + 9)}" rx="2.6" ry="3.2" fill="${INK}"/>`
      s += `</g>`
    }
  }

  // ---- TWO CRATES set down ON the lane (the twelve loose sack rings scattered
  // over the whole spread are gone — those were the reader's "dark rings").
  for (const t of [0.42, 0.9]) {
    const bx = PX(t)
    const by = PY(laneY(t) + 0.006)
    const cw3 = 34
    s += `<path d="M ${fx(bx - cw3 / 2)} ${fx(by)} L ${fx(bx + cw3 / 2)} ${fx(by)} L ${fx(bx + cw3 / 2)} ${fx(by - cw3 * 0.55)} L ${fx(bx - cw3 / 2)} ${fx(by - cw3 * 0.55)} Z" fill="${BAZ.sandDim}" fill-opacity="0.6" stroke="${INK}" stroke-width="2.6" opacity="0.6"/>`
    s += `<line x1="${fx(bx - cw3 / 2)}" y1="${fx(by - cw3 * 0.27)}" x2="${fx(bx + cw3 / 2)}" y2="${fx(by - cw3 * 0.27)}" stroke="${INK}" stroke-width="1.8" opacity="0.45"/>`
    s += `<ellipse cx="${fx(bx)}" cy="${fx(by + 3)}" rx="${fx(cw3 * 0.6)}" ry="4.5" fill="${INK}" opacity="0.18"/>`
  }

  // ---- THE CAT AND THE FISH CRATE, kept because it survives the cull as a
  // STORY BEAT — a cat walking to a crate of fish — but shortened from a trail
  // that crossed the entire spread (19 prints from the right apron) to the last
  // stretch of the approach. The long version was the single most scattered mark
  // on the page once everything around it was organised.
  const catPath = (t) => {
    const mt = 1 - t
    const C = [[0.8, 0.95], [0.66, 0.8], [0.4, 0.72], [0.24, 0.47]]
    return [0, 1].map((k) => mt * mt * mt * C[0][k] + 3 * mt * mt * t * C[1][k] + 3 * mt * t * t * C[2][k] + t * t * t * C[3][k])
  }
  for (let i = 0; i <= 4; i++) {
    const [bx, by] = catPath(lerp(0.68, 1, i / 4))
    const sidep = i % 2 ? 0.008 : -0.008
    const px2 = PX(bx + sidep)
    const py2 = PY(by)
    // fewer prints, each half again as big: at pad rx 4.2 they only resolved at
    // the 4x zoom the reader had to use, and a print that small is speckle
    s += `<g opacity="0.85">`
    s += `<ellipse cx="${fx(px2)}" cy="${fx(py2)}" rx="6" ry="4.8" fill="${INK}"/>`
    for (let tt = 0; tt < 3; tt++) {
      s += `<circle cx="${fx(px2 + (tt - 1) * 6.2)}" cy="${fx(py2 - 7.6)}" r="3" fill="${INK}"/>`
    }
    s += `</g>`
  }
  {
    const fsx = PX(0.2)
    const fsy = PY(0.44)
    s += `<rect x="${fx(fsx - 6)}" y="${fx(fsy + 4)}" width="64" height="30" fill="${BAZ.sandDim}" opacity="0.7" stroke="${INK}" stroke-width="2.8" stroke-opacity="0.78"/>`
    s += `<line x1="${fx(fsx - 6)}" y1="${fx(fsy + 14)}" x2="${fx(fsx + 58)}" y2="${fx(fsy + 14)}" stroke="${INK}" stroke-width="2" opacity="0.5"/>`
    for (const [ox, oy, sc] of [[2, -8, 1], [26, -16, 0.82]]) {
      const bx = fsx + ox
      const by = fsy + oy
      s += `<path d="M ${fx(bx)} ${fx(by)} Q ${fx(bx + 20 * sc)} ${fx(by - 13 * sc)} ${fx(bx + 40 * sc)} ${fx(by)} Q ${fx(bx + 20 * sc)} ${fx(by + 13 * sc)} ${fx(bx)} ${fx(by)} Z" fill="${BAZ.teal}" opacity="0.5" stroke="${INK}" stroke-width="2.6" stroke-opacity="0.8"/>`
      s += `<path d="M ${fx(bx + 40 * sc)} ${fx(by)} l ${fx(11 * sc)} ${fx(-9 * sc)} l 0 ${fx(18 * sc)} Z" fill="none" stroke="${INK}" stroke-width="2.4" opacity="0.8"/>`
      s += `<circle cx="${fx(bx + 9 * sc)}" cy="${fx(by - 2 * sc)}" r="2.2" fill="${INK}" opacity="0.9"/>`
    }
  }

  // ---- THE SETTING-OUT TRACK (reader finding S6-1): "the RAISE A STALL card is
  // the only imperative text in the scene and its actual control (the mauve
  // plate) floats disconnected off the page edge." The card and its pull tab were
  // physically linked and pictorially unrelated, because the strip between them
  // runs UNDER the page and the gap it crosses was blank parchment.
  //
  // Derived geometry, LEFT page, not re-derived by eye: the card body occupies
  // radial d 0.52..0.90 at spine z 0.36..0.64; its fore hinge is at d 0.90; the
  // slit the tab is pulled through is at d = PAGE_W = 1.15 spanning z 0.45..0.55.
  // So the empty gap is d 0.88 -> 1.15 at z 0.45..0.55, and d = 1.15 is exactly
  // image x = 0 (the left page's fore edge).
  //
  // It is painted as a MASON'S SETTING-OUT TRACK — the trade's own mark for "this
  // is where the thing travels": a trodden channel band, a double rule down its
  // centre with regular ticks across it, the cartouche's lozenge at the card end,
  // and the mouth of the slit drawn as a hard ink lip where the strip goes into
  // the page. Ink weight is the cart ruts', so it belongs to the same hand.
  {
    const xSlit = PX(pageFX(1.15, 'left'))
    const xCard = PX(pageFX(0.88, 'left'))
    const yTop = PY(pageFY(0.45))
    const yBot = PY(pageFY(0.55))
    const yMid = PY(pageFY(0.5))
    const chW = xCard - xSlit
    // the trodden channel the strip runs in
    s += `<rect x="${fx(xSlit)}" y="${fx(yTop)}" width="${fx(chW)}" height="${fx(yBot - yTop)}" fill="${BAZ.terraDim}" opacity="0.16"/>`
    s += `<rect x="${fx(xSlit)}" y="${fx(yTop + (yBot - yTop) * 0.2)}" width="${fx(chW)}" height="${fx((yBot - yTop) * 0.6)}" fill="${INK}" opacity="0.07"/>`
    for (const yy of [yTop, yBot]) {
      s += `<line x1="${fx(xSlit)}" y1="${fx(yy)}" x2="${fx(xCard)}" y2="${fx(yy)}" stroke="${INK}" stroke-width="2" opacity="0.42"/>`
    }
    // the double rule, and ticks across it
    for (const dy of [-3, 3]) {
      s += `<line x1="${fx(xSlit)}" y1="${fx(yMid + dy)}" x2="${fx(xCard)}" y2="${fx(yMid + dy)}" stroke="${INK}" stroke-width="2.2" opacity="0.7"/>`
    }
    const ticks = Math.max(4, Math.round(chW / 14))
    for (let k = 1; k < ticks; k++) {
      const tx = xCard - (chW * k) / ticks
      s += `<line x1="${fx(tx)}" y1="${fx(yMid - 6)}" x2="${fx(tx)}" y2="${fx(yMid + 6)}" stroke="${INK}" stroke-width="1.8" opacity="0.55"/>`
    }
    // the lozenge at the card end — the same mark the cartouche flanks its
    // legend with, so the eye leaves the card already following this line
    const lzy = yMid
    const lzx = xCard - 9
    const lzr = 8
    s += `<path d="M ${fx(lzx)} ${fx(lzy - lzr)} l ${fx(lzr)} ${fx(lzr)} l ${fx(-lzr)} ${fx(lzr)} l ${fx(-lzr)} ${fx(-lzr)} Z" fill="${ROOK.parch}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" opacity="0.85"/>`
    s += `<circle cx="${fx(lzx)}" cy="${fx(lzy)}" r="2.6" fill="${INK}"/>`
    // THE MOUTH OF THE SLIT at d = 1.15: the cut, its lip, and the shadow the
    // strip throws as it goes under the page
    s += `<rect x="${fx(xSlit)}" y="${fx(yTop - 5)}" width="14" height="${fx(yBot - yTop + 10)}" fill="url(#bazSlit6)"/>`
    s += `<line x1="${fx(xSlit + 2)}" y1="${fx(yTop - 5)}" x2="${fx(xSlit + 2)}" y2="${fx(yBot + 5)}" stroke="${INK}" stroke-width="4" opacity="0.8"/>`
    s += `<path d="M ${fx(xSlit + 2)} ${fx(yTop - 5)} q 9 ${fx((yBot - yTop) / 2 + 5)} 0 ${fx(yBot - yTop + 10)}" fill="none" stroke="${INK}" stroke-width="2.2" opacity="0.5"/>`
  }

  s += `<rect width="${w}" height="${h}" fill="url(#bazVig6)"/>`
  s += `</g>`

  const defs =
    `<linearGradient id="bazHaze6" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${BAZ.sandLit}" stop-opacity="0.5"/>` +
    `<stop offset="1" stop-color="${BAZ.sandLit}" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="bazDust6" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${BAZ.terra}" stop-opacity="0.26"/>` +
    `<stop offset="0.62" stop-color="${BAZ.rose}" stop-opacity="0.17"/>` +
    `<stop offset="1" stop-color="${BAZ.rose}" stop-opacity="0"/></radialGradient>` +
    // the lane bands fade out at both page edges so they read as arcs of a bowl
    // rather than as full-width rules ruled across the paper
    `<linearGradient id="bazLane6" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${ROOK.parch}" stop-opacity="0.75"/>` +
    `<stop offset="0.22" stop-color="${ROOK.parch}" stop-opacity="0"/>` +
    `<stop offset="0.78" stop-color="${ROOK.parch}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${ROOK.parch}" stop-opacity="0.75"/></linearGradient>` +
    `<linearGradient id="bazGutter6" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${INK}" stop-opacity="0"/>` +
    `<stop offset="0.5" stop-color="${INK}" stop-opacity="0.3"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient>` +
    // the shadow the pull strip throws where it dives under the page fore edge
    `<linearGradient id="bazSlit6" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${INK}" stop-opacity="0.55"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="bazVig6" cx="0.5" cy="0.55" r="0.75">` +
    `<stop offset="0.5" stop-color="${SCUFF}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${SCUFF}" stop-opacity="0.28"/></radialGradient>`

  return svgPiece(w, h, s, defs)
}

// ---- texture-only bake: SVG -> flat PNG -> seeded grain masked by alpha ->
// webp. No outline sidecar (mesh stays the solver quad). ----
// ============================================================================
// THE CARRIER SWARM ART MODULE (E3 s3, "The Carrier Swarm"). One 1024 sprite
// atlas feeds all 22 swarmarc riders + the three strut swatches + the STIR
// tab (G5 FIELD discipline: many pieces, ONE texture). Cell convention is
// popup-swarmarc-layer.tsx's contract, written once THERE and honored HERE:
// 8x8 grid of 128px cells, row 0 at the image TOP, and within a rider cell the
// TOP edge is OUTWARD (the strut tip's direction) while the BOTTOM edge is
// where the strut arrives. ROUND 2 LAYOUT:
//   cells 0-15   the 16 rider sprites — sprite in the cell's UPPER band with a
//                painted flight thread below it (see THE HOVER CONTRACT below)
//   cell 16      strut swatch variant 0, the paper hairline
//   cell 23      strut swatch variant 1, waxed twine
//   cell 24      strut swatch variant 2, a slim twig with one knot
//                (all three OPAQUE full cells — the strut mesh has no alpha test).
//                Per-strut `swatch` 0/1/2 picks among them, so across the 22
//                stalks each swatch carries about a third — these two new cells
//                are load-bearing, not decoration
//   cells 32-36
//   + 40-44
//   + 48-52      the STIR pull tab, one 640x384 block (aspect 1.667 to match its
//                145x85 screen quad, so letterforms come out unstretched)
//   cells 17-22
//   + 25-26      TRANSPARENT. They held round 1's 2x2 STIR tab and a printed
//                banner strip; nothing samples either any more.
// Palette is the pack's alpine-airy set — 3 values + 1 metal + ONE saturated
// accent (daisy-ref discipline): the red appears ONLY on wax seals, the tab bow
// and the hero's satchel, never on bees.
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

/** The silhouette half-extents of a swarmBee, in units of its body size `s`
 *  (the head cap sticks out further than the stinger, so the shape is NOT
 *  centred on cx). `beeFit` inverts it: the body size that makes the bee span
 *  `span` px, plus the shift that recentres it. Riders are sampled at ~17 px
 *  on screen, so every unused pixel of the atlas cell is legibility thrown
 *  away — the sprites are sized to FILL their cell, not to sit politely in it. */
function beeFit(span, pose) {
  const fat = pose === 'bumble' ? 1.25 : pose === 'scout' ? 0.82 : 1
  const left = 0.47 * fat + 0.16 // stinger tip
  const right = Math.max(0.6708 * fat, 0.51 * fat + 0.2) // head cap / antenna tip
  const s = span / (left + right)
  return { s, dx: ((left - right) / 2) * s }
}

/** One courier bee. `s` = body length px; poses: wingsUp / wingsMid /
 *  wingsDown / profile / bumble / scout / satchel. Rim halo behind the body
 *  so the sprite reads as a die-cut card chip. */
function swarmBee(cx, cy, s, pose) {
  const P = SWARM
  const fat = pose === 'bumble' ? 1.25 : pose === 'scout' ? 0.82 : 1
  const rx = s * 0.5 * fat
  const ry = s * 0.34 * fat
  // Rim, wing edge and leg weights all scale with `s`: fixed pixel weights
  // vanished once the sprites grew, which is how a bee turns back into a
  // lozenge at the reading camera.
  const rimW = Math.max(2.5, s * 0.055)
  const edgeW = Math.max(1.6, s * 0.045)
  let g = `<g>`
  // die-cut rim halo (body + head footprint)
  g += `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(rx + rimW)}" ry="${fx(ry + rimW)}" fill="${RIM}" opacity="0.9"/>`
  g += `<circle cx="${fx(cx + rx * 0.92)}" cy="${fx(cy - ry * 0.22)}" r="${fx(ry * 0.62 + rimW)}" fill="${RIM}" opacity="0.9"/>`
  // wings BEHIND the body for up/profile, in front for down (paper layering).
  // Pale, but EDGED in slate over its own rim: an unedged white ellipse reads
  // as a blank cap sitting on the bee rather than as a wing.
  const wing = (wx, wy, wrx, wry, rot) =>
    `<g transform="rotate(${rot} ${fx(wx)} ${fx(wy)})">` +
    `<ellipse cx="${fx(wx)}" cy="${fx(wy)}" rx="${fx(wrx + rimW * 0.7)}" ry="${fx(wry + rimW * 0.7)}" fill="${RIM}" opacity="0.85"/>` +
    `<ellipse cx="${fx(wx)}" cy="${fx(wy)}" rx="${fx(wrx)}" ry="${fx(wry)}" fill="${P.wing}" opacity="0.95" stroke="${P.slate}" stroke-width="${fx(edgeW)}" stroke-opacity="0.9"/>` +
    `<path d="M ${fx(wx - wrx * 0.7)} ${fx(wy)} L ${fx(wx + wrx * 0.75)} ${fx(wy - wry * 0.3)}" stroke="${P.blue}" stroke-width="${fx(edgeW * 0.6)}" opacity="0.7" fill="none"/>` +
    `</g>`
  const wingsBehind =
    pose === 'wingsUp' || pose === 'satchel'
      ? wing(cx - rx * 0.28, cy - ry * 1.5, s * 0.34, s * 0.15, -38) + wing(cx + rx * 0.18, cy - ry * 1.55, s * 0.34, s * 0.15, -18)
      : pose === 'wingsMid' || pose === 'bumble' || pose === 'scout'
        ? wing(cx - rx * 0.5, cy - ry * 1.1, s * 0.38, s * 0.14, -8) + wing(cx + rx * 0.28, cy - ry * 1.15, s * 0.36, s * 0.13, 6)
        : pose === 'profile'
          ? wing(cx - rx * 0.1, cy - ry * 1.35, s * 0.4, s * 0.16, -26)
          : ''
  g += wingsBehind
  // legs first (behind the body), so the abdomen stays an unbroken dark mass
  for (const lt of [-0.3, 0.05, 0.4])
    g += `<path d="M ${fx(cx + rx * lt)} ${fx(cy + ry * 0.6)} q ${fx(s * 0.03)} ${fx(s * 0.14)} ${fx(-s * 0.07)} ${fx(s * 0.2)}" fill="none" stroke="${P.bee}" stroke-width="${fx(edgeW)}" stroke-linecap="round"/>`
  // body + gold stripes + head. Three fat stripes, not two thin ones: at
  // rider scale the stripe rhythm IS the "this is a bee" cue.
  g += `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(rx)}" ry="${fx(ry)}" fill="${P.bee}"/>`
  for (const t of [-0.42, -0.08, 0.28]) {
    const sxp = cx + rx * t
    const half = ry * Math.sqrt(Math.max(0.1, 1 - t * t)) * 0.94
    g += `<line x1="${fx(sxp)}" y1="${fx(cy - half)}" x2="${fx(sxp)}" y2="${fx(cy + half)}" stroke="${P.gold}" stroke-width="${fx(s * 0.13)}"/>`
  }
  g += `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(rx)}" ry="${fx(ry)}" fill="none" stroke="${P.bee}" stroke-width="${fx(edgeW * 0.8)}"/>`
  g += `<circle cx="${fx(cx + rx * 0.92)}" cy="${fx(cy - ry * 0.22)}" r="${fx(ry * 0.62)}" fill="${P.bee}"/>`
  g += `<circle cx="${fx(cx + rx * 1.06)}" cy="${fx(cy - ry * 0.36)}" r="${fx(s * 0.05)}" fill="${P.wing}"/>`
  // antenna + stinger — the two spikes that break the pill silhouette
  g += `<path d="M ${fx(cx + rx * 1.02)} ${fx(cy - ry * 0.7)} q ${fx(s * 0.1)} ${fx(-s * 0.12)} ${fx(s * 0.2)} ${fx(-s * 0.08)}" fill="none" stroke="${P.bee}" stroke-width="${fx(edgeW * 0.85)}" stroke-linecap="round"/>`
  g += `<path d="M ${fx(cx - rx * 0.94)} ${fx(cy)} l ${fx(-s * 0.16)} ${fx(s * 0.05)}" stroke="${P.bee}" stroke-width="${fx(edgeW)}" stroke-linecap="round"/>`
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
  // Ink borders scaled to the chip: a cream rectangle with a 1.5 px hairline
  // is a pale smudge at rider scale — the BORDER is what makes it a letter.
  const rimW = Math.max(2.5, s * 0.05)
  const edgeW = Math.max(1.8, s * 0.042)
  let g = `<g transform="rotate(${rot} ${fx(cx)} ${fx(cy)})">`
  g += `<rect x="${fx(cx - wq / 2 - rimW)}" y="${fx(cy - hq / 2 - rimW)}" width="${fx(wq + rimW * 2)}" height="${fx(hq + rimW * 2)}" rx="3" fill="${RIM}" opacity="0.9"/>`
  g += `<rect x="${fx(cx - wq / 2)}" y="${fx(cy - hq / 2)}" width="${fx(wq)}" height="${fx(hq)}" fill="${kind === 'sealed' ? P.parch : P.cream}" stroke="${INK}" stroke-width="${fx(edgeW)}" stroke-opacity="0.85"/>`
  if (kind === 'back') {
    for (const ly of [-0.14, 0.08, 0.3])
      g += `<line x1="${fx(cx - wq * 0.32)}" y1="${fx(cy + hq * ly)}" x2="${fx(cx + wq * 0.3)}" y2="${fx(cy + hq * ly)}" stroke="${P.slate}" stroke-width="${fx(edgeW * 0.9)}" opacity="0.85"/>`
    g += `<rect x="${fx(cx + wq * 0.14)}" y="${fx(cy - hq * 0.44)}" width="${fx(wq * 0.26)}" height="${fx(hq * 0.34)}" fill="${P.blue}" stroke="${INK}" stroke-width="${fx(edgeW * 0.7)}" stroke-opacity="0.7"/>` // stamp
  } else {
    g += `<path d="M ${fx(cx - wq / 2)} ${fx(cy - hq / 2)} L ${fx(cx)} ${fx(cy + hq * 0.14)} L ${fx(cx + wq / 2)} ${fx(cy - hq / 2)}" fill="none" stroke="${INK}" stroke-width="${fx(edgeW)}" stroke-opacity="0.8"/>`
    g += `<path d="M ${fx(cx - wq / 2)} ${fx(cy + hq / 2)} L ${fx(cx - wq * 0.14)} ${fx(cy + hq * 0.02)} M ${fx(cx + wq / 2)} ${fx(cy + hq / 2)} L ${fx(cx + wq * 0.14)} ${fx(cy + hq * 0.02)}" fill="none" stroke="${INK}" stroke-width="${fx(edgeW * 0.8)}" stroke-opacity="0.55"/>`
  }
  if (kind === 'sealed') {
    g += `<circle cx="${fx(cx)}" cy="${fx(cy + hq * 0.1)}" r="${fx(s * 0.17)}" fill="${P.red}" stroke="#7a2b22" stroke-width="${fx(edgeW)}"/>`
    g += `<circle cx="${fx(cx - s * 0.05)}" cy="${fx(cy + hq * 0.1 - s * 0.05)}" r="${fx(s * 0.06)}" fill="#d9877a" opacity="0.9"/>`
  }
  g += `</g>`
  return g
}

/** One twine-wrapped parcel chip. */
function swarmParcel(cx, cy, s, tall, rot = 0) {
  const P = SWARM
  const wq = s
  const hq = s * (tall ? 0.9 : 0.62)
  const rimW = Math.max(2.5, s * 0.05)
  const edgeW = Math.max(1.8, s * 0.042)
  let g = `<g transform="rotate(${rot} ${fx(cx)} ${fx(cy)})">`
  g += `<rect x="${fx(cx - wq / 2 - rimW)}" y="${fx(cy - hq / 2 - rimW)}" width="${fx(wq + rimW * 2)}" height="${fx(hq + rimW * 2)}" rx="3" fill="${RIM}" opacity="0.9"/>`
  g += `<rect x="${fx(cx - wq / 2)}" y="${fx(cy - hq / 2)}" width="${fx(wq)}" height="${fx(hq)}" fill="${P.parch}" stroke="${INK}" stroke-width="${fx(edgeW)}" stroke-opacity="0.85"/>`
  g += `<rect x="${fx(cx - wq / 2)}" y="${fx(cy + hq * 0.22)}" width="${fx(wq)}" height="${fx(hq * 0.28)}" fill="${P.amber}" opacity="0.3"/>`
  g += `<line x1="${fx(cx)}" y1="${fx(cy - hq / 2)}" x2="${fx(cx)}" y2="${fx(cy + hq / 2)}" stroke="${P.amber}" stroke-width="${fx(edgeW * 1.6)}"/>`
  g += `<line x1="${fx(cx - wq / 2)}" y1="${fx(cy)}" x2="${fx(cx + wq / 2)}" y2="${fx(cy)}" stroke="${P.amber}" stroke-width="${fx(edgeW * 1.6)}"/>`
  g += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(s * 0.09)}" fill="${P.amber}"/>`
  g += `<path d="M ${fx(cx)} ${fx(cy)} l ${fx(s * 0.13)} ${fx(-s * 0.11)} M ${fx(cx)} ${fx(cy)} l ${fx(-s * 0.13)} ${fx(-s * 0.09)}" stroke="${P.amber}" stroke-width="${fx(edgeW)}" fill="none" stroke-linecap="round"/>`
  g += `</g>`
  return g
}

/** A honey drop (the tab handle motif, also a solo sprite). */
function swarmHoneyDrop(cx, cy, s) {
  const d = `M ${fx(cx)} ${fx(cy - s * 0.52)} C ${fx(cx + s * 0.4)} ${fx(cy - s * 0.05)} ${fx(cx + s * 0.34)} ${fx(cy + s * 0.28)} ${fx(cx)} ${fx(cy + s * 0.42)} C ${fx(cx - s * 0.34)} ${fx(cy + s * 0.28)} ${fx(cx - s * 0.4)} ${fx(cy - s * 0.05)} ${fx(cx)} ${fx(cy - s * 0.52)} Z`
  let g = `<path d="${d}" fill="${SWARM.gold}" stroke="${SWARM.amber}" stroke-width="${fx(Math.max(2, s * 0.045))}"/>`
  g += `<ellipse cx="${fx(cx - s * 0.12)}" cy="${fx(cy - s * 0.08)}" rx="${fx(s * 0.09)}" ry="${fx(s * 0.16)}" fill="#f7e3ae" opacity="0.9"/>`
  g += rimPath(d, Math.max(4, s * 0.05))
  return g
}

/** The full 8x8 sprite atlas (1024x1024, transparent ground). */
function swarmAtlas(w, h, seed) {
  const r = mulberry32(seed)
  const cs = w / 8
  // Each rider is painted inside a NESTED SVG viewport covering exactly its
  // own cell, in cell-local coordinates. A nested <svg> clips to its viewport,
  // so a sprite can no longer bleed into the neighbouring cell's uv rect —
  // cell isolation becomes a property of the atlas rather than of arithmetic
  // I have to keep re-deriving every time a sprite grows a leg or an antenna.
  const inCell = (i, inner) => {
    const x0 = (i % 8) * cs
    const y0 = Math.floor(i / 8) * cs
    return `<svg x="${fx(x0)}" y="${fx(y0)}" width="${fx(cs)}" height="${fx(cs)}" viewBox="0 0 ${fx(cs)} ${fx(cs)}">${inner}</svg>`
  }
  const M = cs / 2

  // ==========================================================================
  // THE HOVER CONTRACT (round 2 repaint of cells 0-15).
  //
  // The blind reader on round 1: "two dozen identical thin pale-blue poles each
  // capped with a bee lying flat on a disc. My first reading was 'bees skewered
  // on sticks'." The cause was geometric, not painterly: the strut's opaque quad
  // ran all the way to the rider cell's exact CENTRE, so the pole crossed the
  // middle of every abdomen. popup-swarmarc-layer.tsx now stops the strut at 35%
  // of the cell height measured UP from the cell's BOTTOM edge (TIP_Y below),
  // and this atlas paints to that contract:
  //   * the sprite lives in the UPPER band of its cell, body centre 36-40% down
  //     from the cell top (= 60-64% up from the bottom, the cell's TOP edge
  //     being outward / the strut tip's direction);
  //   * a painted FLIGHT THREAD continues the strut from the cell's bottom edge
  //     up to the sprite's underside, in cell 16's own swatch colours;
  //   * so the strut and the thread are ONE die-cut and the rider reads as
  //     HOVERING at the top of a thread rather than impaled on a pole.
  //
  // WHAT THIS COSTS, stated because it partly undoes the FILL doctrine the
  // previous round won: with the body centre at ~0.40 cs instead of ~0.57 cs, a
  // wings-up bee (whose silhouette reaches 0.83 s ABOVE its body centre) can
  // only be 0.60 cs wide before its wing tips clip the cell's top edge. Sprite
  // spans therefore land at 0.60-0.81 cs (mean 0.69) where round 1 ran every
  // sprite at 0.95 cs — a rider that spanned ~17 px on screen now spans ~12 px
  // of painted bee. The cell's top edge, NOT the strut tip, is the binding
  // constraint, so the only way to buy the width back is a taller rider quad.
  // ==========================================================================
  const TIP_Y = cs * 0.65 // where the strut's opaque quad now ends (35% up from the bottom)
  const CLEAR = cs * 0.025 // the sprite's underside must clear that tip
  const TOPM = cs * 0.016 // ... and the cell's top edge
  const CHIP_Y = cs * 0.32 // letters/parcels/drops hang higher than the bees do:
  // their footprint is symmetric, so the balance point of the two budgets is up
  // at 0.32 cs rather than 0.40 cs, and that is worth ~10% of chip size.
  /** Per-pose silhouette reach in units of the body size `s`, measured from the
   *  body centre: [above, below]. Upswept wings reach roughly twice as far above
   *  the abdomen as the legs reach below it, which is the whole reason sprite
   *  sizes now differ per pose. Verified against rendered per-cell alpha bboxes. */
  const REACH = {
    wingsUp: [0.83, 0.45],
    wingsMid: [0.65, 0.45],
    wingsDown: [0.4, 0.66],
    profile: [0.83, 0.45],
    bumble: [0.71, 0.48],
    scout: [0.58, 0.4],
    satchel: [0.83, 0.46],
  }
  const spanPerS = (pose) => 1 / beeFit(1, pose).s // = beeFit's (left + right)
  /** The body centre and body size that make a pose as LARGE as the hover band
   *  allows: `cy` is clamped into the contract's 36-40%-down window, then `s` is
   *  whichever of the two clearances binds. */
  const fitBee = (pose) => {
    const [up, dn] = REACH[pose]
    const ideal = (up * (TIP_Y - CLEAR) + dn * TOPM) / (up + dn)
    const cy = Math.min(cs * 0.4, Math.max(cs * 0.36, ideal))
    const s = Math.min((cy - TOPM) / up, (TIP_Y - CLEAR - cy) / dn)
    return { cy, s, span: s * spanPerS(pose) }
  }
  /** The largest chip size whose ROTATED footprint clears both budgets. */
  const fitChip = (aspect, rot, rimF = 0.05) => {
    const a = Math.abs(Math.sin((rot * Math.PI) / 180))
    const b = Math.abs(Math.cos((rot * Math.PI) / 180))
    const halfPerS = (a + aspect * b) / 2 + rimF
    return Math.min((CHIP_Y - TOPM) / halfPerS, (TIP_Y - CLEAR - CHIP_Y) / halfPerS)
  }
  /** THE FLIGHT THREAD — the painted continuation of the hairline strut, running
   *  up the cell's horizontal CENTRE from the cell's bottom edge to just inside
   *  the sprite's underside. Same swatch structure as cell 16 (a #bfd0dd core
   *  over `SWARM.strut`, with faint `SWARM.blue` cut edges) so the strut mesh and
   *  the painted thread are indistinguishable and the die-cut reads as one piece.
   *  Width 14 px of a 128 px cell = 11%; a rider spans 17-40 px on screen, so the
   *  thread lands at 1.9-4.4 px there, matching the strut's own screen hairline.
   *
   *  The core is #c7cfd2, a NEUTRAL pale grey, not cell 16's cool #bfd0dd. Only one
   *  stalk in three samples cell 16 now; the other two are the warmer twine and
   *  twig, and squashing the thread and each swatch to their true 4 px and averaging
   *  measured the twig sitting 23 units warmer than a cool thread on the R-B axis
   *  (dRGB 26.5) — a visible hue STEP at the join, where the whole point of the
   *  thread is that the stalk and it are ONE die-cut. Neutral here, plus the twig
   *  desaturated to a warm grey, puts the worst join at an R-B shift of 8. */
  const thread = (topY) => {
    const tw = cs * 0.11
    const x0 = M - tw / 2
    const y0 = Math.max(0, Math.min(cs - cs * 0.1, topY))
    const hgt = cs - y0
    return (
      `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(tw)}" height="${fx(hgt)}" fill="${SWARM.strut}"/>` +
      `<rect x="${fx(x0 + tw * 0.3)}" y="${fx(y0)}" width="${fx(tw * 0.4)}" height="${fx(hgt)}" fill="#c7cfd2"/>` +
      `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(tw * 0.16)}" height="${fx(hgt)}" fill="${SWARM.blue}" opacity="0.55"/>` +
      `<rect x="${fx(x0 + tw * 0.84)}" y="${fx(y0)}" width="${fx(tw * 0.16)}" height="${fx(hgt)}" fill="${SWARM.blue}" opacity="0.55"/>`
    )
  }
  let s = `<g>`
  // --- cells 0-15: the 16 rider sprites, every one body-high over its own
  // flight thread (no two neighbours share a sprite; the solver's stride-7
  // sampling never puts equal cells adjacent). `wingsDown` is retired from the
  // rider set: its wings hang BELOW the abdomen, which both fought the thread
  // and was the one pose that could read as a bee sitting on something. ---
  const bees = ['wingsUp', 'wingsMid', 'bumble', 'profile', 'scout']
  const beeCell = (i, pose, k = 1, dx = 0) => {
    const f0 = fitBee(pose)
    const f = beeFit(f0.span * k, pose)
    return inCell(
      i,
      thread(f0.cy + f.s * REACH[pose][1] * 0.82) + swarmBee(M + f.dx + dx, f0.cy, f.s, pose)
    )
  }
  bees.forEach((pose, i) => {
    s += beeCell(i, pose)
  })
  const chipCell = (i, aspect, rot, make, k = 1) => {
    const cq = fitChip(aspect, rot) * k
    const a = Math.abs(Math.sin((rot * Math.PI) / 180))
    const b = Math.abs(Math.cos((rot * Math.PI) / 180))
    const half = cq * ((a + aspect * b) / 2 + 0.05)
    return inCell(i, thread(CHIP_Y + half * 0.86) + make(cq))
  }
  {
    const ra = rr(r, -9, -3)
    s += chipCell(5, 0.68, ra, (q) => swarmEnvelope(M, CHIP_Y, q, 'face', ra))
    const rb = rr(r, 3, 9)
    s += chipCell(6, 0.68, rb, (q) => swarmEnvelope(M, CHIP_Y, q, 'back', rb))
    const rc = rr(r, -6, 6)
    s += chipCell(7, 0.68, rc, (q) => swarmEnvelope(M, CHIP_Y, q, 'sealed', rc)) // wax seal 1 of 3
    const rd = rr(r, -8, -2)
    s += chipCell(8, 0.62, rd, (q) => swarmParcel(M, CHIP_Y, q, false, rd))
    const re = rr(r, 2, 8)
    s += chipCell(9, 0.9, re, (q) => swarmParcel(M, CHIP_Y, q, true, re))
  }
  {
    // letter-pair chainlet: two small envelopes strung on one twine, the pair
    // hung high with the flight thread rising to the lower chip's corner
    const q = fitChip(0.68, 9) * 0.62
    const eA = [M - q * 0.5, CHIP_Y - q * 0.1]
    const eB = [M + q * 0.52, CHIP_Y + q * 0.2]
    let g = `<path d="M ${fx(eA[0] - q * 0.2)} ${fx(eA[1] - q * 0.42)} Q ${fx(M)} ${fx(CHIP_Y + q * 0.5)} ${fx(eB[0] + q * 0.16)} ${fx(eB[1] - q * 0.44)}" fill="none" stroke="${SWARM.slate}" stroke-width="4"/>`
    g += swarmEnvelope(eA[0], eA[1], q, 'face', -9)
    g += swarmEnvelope(eB[0], eB[1], q, 'back', 8)
    s += inCell(10, thread(eB[1] + q * 0.34) + g)
  }
  {
    // The honey drop is intrinsically TALL and NARROW: reaches are 0.57 q above
    // and 0.47 q below its own centre (0.52/0.42 of the path plus its rimPath),
    // while its bezier controls overshoot so the ink is only 0.61 q ACROSS. Sized
    // to the hover band that leaves a drop alone filling 0.36 cs, which is the
    // FILL doctrine's own failure case — so it rides with a scout at its
    // shoulder (the tab's bee-on-honey-drop motif), taking the cell to 0.65 cs.
    // Watch out when re-measuring this cell: the drop's bottom TIP sits inside
    // the thread column, so a bbox that excludes that column reads it as
    // clearing the strut tip when it does not.
    const q = (TIP_Y - CLEAR - TOPM) / 1.04
    const dy = TOPM + q * 0.57
    const bf = beeFit(cs * 0.44, 'scout')
    s += inCell(
      11,
      thread(dy + q * 0.36) + swarmBee(M - cs * 0.26 + bf.dx, cs * 0.23, bf.s, 'scout') + swarmHoneyDrop(M, dy, q)
    )
  }
  s += beeCell(12, 'wingsMid', 0.86, cs * 0.03)
  s += beeCell(13, 'scout', 0.9, -cs * 0.03)
  s += beeCell(14, 'satchel')
  {
    const rf = -16
    s += chipCell(15, 0.68, rf, (q) => swarmEnvelope(M, CHIP_Y, q, 'face', rf), 0.92)
  }
  // --- cells 16 / 23 / 24: the THREE strut swatches, variants 0 / 1 / 2. Each
  // is an OPAQUE full cell (the strut mesh material carries no alpha test), so
  // every one of them fills its cell edge to edge. All 22 struts sampling ONE
  // swatch made the ring read as a rank of identical machined poles; three
  // swatches in the SAME value family give the rank variety without any of them
  // out-reading its rider (the daisy rule: a stem must never beat its flower).
  const swatch = (i, paint) => {
    const x0 = (i % 8) * cs
    const y0 = Math.floor(i / 8) * cs
    return paint(x0, y0)
  }
  // variant 0 — the hairline paper strut: sky-tinted with a lighter core so the
  // 4px screen hairline reads as lit paper, plus faint cut edges.
  s += swatch(16, (x0, y0) => {
    let g = `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cs)}" height="${fx(cs)}" fill="${SWARM.strut}"/>`
    g += `<rect x="${fx(x0 + cs * 0.3)}" y="${fx(y0)}" width="${fx(cs * 0.4)}" height="${fx(cs)}" fill="#bfd0dd"/>`
    g += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cs * 0.07)}" height="${fx(cs)}" fill="${SWARM.blue}" opacity="0.55"/>`
    g += `<rect x="${fx(x0 + cs * 0.93)}" y="${fx(y0)}" width="${fx(cs * 0.07)}" height="${fx(cs)}" fill="${SWARM.blue}" opacity="0.55"/>`
    return g
  })
  // variant 1 — WAXED TWINE: same sky tint, but the core is finer (0.22 of the
  // width against 0.40) and warmer, so a twine strut reads as thread rather than
  // as a cut paper edge. On screen that core is ~0.9 px of a 4 px strut.
  s += swatch(23, (x0, y0) => {
    let g = `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cs)}" height="${fx(cs)}" fill="${SWARM.strut}"/>`
    g += `<rect x="${fx(x0 + cs * 0.26)}" y="${fx(y0)}" width="${fx(cs * 0.48)}" height="${fx(cs)}" fill="#b6c6d1"/>`
    g += `<rect x="${fx(x0 + cs * 0.39)}" y="${fx(y0)}" width="${fx(cs * 0.22)}" height="${fx(cs)}" fill="#dcd8c8"/>`
    g += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cs * 0.08)}" height="${fx(cs)}" fill="${SWARM.blue}" opacity="0.5"/>`
    g += `<rect x="${fx(x0 + cs * 0.92)}" y="${fx(y0)}" width="${fx(cs * 0.08)}" height="${fx(cs)}" fill="${SWARM.blue}" opacity="0.5"/>`
    return g
  })
  // variant 2 — a slim TWIG / reed. Its core is a warm GREY, not the walnut tint
  // the first cut used: at 4 px on screen a swatch has no drawing left, only an
  // averaged tint, and a walnut one put this stalk 23 R-B units warmer than the
  // rider cells' flight thread — a hue step at the join (see `thread` above).
  // The KNOT is what says twig at reading size, so it keeps the amber and does the
  // work; the tint stays low-contrast so a twig strut still disappears behind its
  // rider (the daisy rule again). Values are also held LIGHT: once the hue was
  // matched, what was left of the join was a lightness step, and dropping the twig
  // 16 units darker in blue than the thread showed up as a shaded band at the seam.
  // Measured joins against the thread now: hairline dRGB 7.7, twine 7.8, twig 10.3,
  // and no R-B shift above 8 — where the twig alone used to be 26.5 / 23.
  s += swatch(24, (x0, y0) => {
    let g = `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cs)}" height="${fx(cs)}" fill="${SWARM.strut}"/>`
    g += `<rect x="${fx(x0 + cs * 0.32)}" y="${fx(y0)}" width="${fx(cs * 0.36)}" height="${fx(cs)}" fill="#b6b5ac"/>`
    g += `<rect x="${fx(x0 + cs * 0.43)}" y="${fx(y0)}" width="${fx(cs * 0.14)}" height="${fx(cs)}" fill="#c8c5be"/>`
    g += `<rect x="${fx(x0 + cs * 0.32)}" y="${fx(y0 + cs * 0.56)}" width="${fx(cs * 0.36)}" height="${fx(cs * 0.09)}" fill="${SWARM.amber}" opacity="0.5"/>` // the knot — the twig's whole read
    g += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(cs * 0.08)}" height="${fx(cs)}" fill="${SWARM.blue}" opacity="0.45"/>`
    g += `<rect x="${fx(x0 + cs * 0.92)}" y="${fx(y0)}" width="${fx(cs * 0.08)}" height="${fx(cs)}" fill="${SWARM.blue}" opacity="0.45"/>`
    return g
  })
  // ==========================================================================
  // --- cells 32-36 / 40-44 / 48-52: THE STIR TAB, a 5x3 block = 640x384 px
  // with its top-left cell at 32.
  //
  // Round 1 put this on a 2x2 (256x256) region driving a 55x22 screen quad. Two
  // separate faults, and the reader caught the compound: "cap height is ~4px;
  // nearest-neighbour zoom shows two rows of grey mush ... a 55x22px plaque
  // parked alone on empty ground in the far right corner." The label was
  // stretched (a 1:1 atlas region on a 2.5:1 quad squashes every letterform),
  // and 22 screen px of quad cannot carry two lines of type at any size.
  // The quad is rebuilt in world space at 0.30 x 0.32 -> 145 x 85 screen px
  // beside the swarm arm it drives, and THIS region is 640x384 (aspect 1.667
  // against the quad's 1.706, a 2.3% stretch), so letterforms come out true.
  //
  // Measured: the region maps to screen at 0.2266x across and 0.2214x down, so
  // the font-size 92 Georgia bold caps here are 63.7 px of art = 14.1 px of
  // on-screen CAP HEIGHT (the brief's floor was 55 px of art / 12 px on screen).
  //
  // Painted as a DIEGETIC pull tab per law BW-13, never an untextured plate: a
  // honey-gold die-cut card with a scored fold at the inboard end where it
  // leaves its slit, a cream rule, an INK ply shadow down its lower edge, and a
  // SCALLOPED GRIP with a finger notch at the OUTBOARD (fore-edge) side, which
  // is the RIGHT of the region — the direction the tab is pulled. The dashed
  // amber bee-loop and its arrowhead point the same way; the red wax bow on the
  // fold is wax accent 2 of 3.
  // ==========================================================================
  {
    const TX = 0 // cell 32 = row 4, col 0
    const TY = 4 * cs
    const TW = 5 * cs
    const TH = 3 * cs
    const tu = (u) => TX + TW * u
    const tv = (v) => TY + TH * v
    const CARD =
      `M ${fx(tu(0.045))} ${fx(tv(0.24))} ` +
      `Q ${fx(tu(0.045))} ${fx(tv(0.13))} ${fx(tu(0.12))} ${fx(tv(0.13))} ` +
      `L ${fx(tu(0.78))} ${fx(tv(0.13))} ` +
      `C ${fx(tu(0.845))} ${fx(tv(0.13))} ${fx(tu(0.876))} ${fx(tv(0.175))} ${fx(tu(0.906))} ${fx(tv(0.225))} ` +
      `Q ${fx(tu(0.966))} ${fx(tv(0.33))} ${fx(tu(0.906))} ${fx(tv(0.44))} ` + // grip scallop 1
      `Q ${fx(tu(0.848))} ${fx(tv(0.5))} ${fx(tu(0.906))} ${fx(tv(0.56))} ` + // the finger notch, pinched IN
      `Q ${fx(tu(0.966))} ${fx(tv(0.67))} ${fx(tu(0.906))} ${fx(tv(0.775))} ` + // grip scallop 2
      `C ${fx(tu(0.876))} ${fx(tv(0.825))} ${fx(tu(0.845))} ${fx(tv(0.87))} ${fx(tu(0.78))} ${fx(tv(0.87))} ` +
      `L ${fx(tu(0.12))} ${fx(tv(0.87))} ` +
      `Q ${fx(tu(0.045))} ${fx(tv(0.87))} ${fx(tu(0.045))} ${fx(tv(0.76))} Z`
    // the ply shadow FIRST — this is what lifts the tab off the page rather than
    // printing it onto the page
    s += `<g transform="translate(10 14)"><path d="${CARD}" fill="${INK}" opacity="0.32"/></g>`
    s += rimPath(CARD, 9) // house pale core rim = the die cut
    s += `<path d="${CARD}" fill="url(#s3tabFace)" stroke="${SWARM.amber}" stroke-width="5"/>`
    // cream rule, inset off the silhouette
    s += `<rect x="${fx(tu(0.082))}" y="${fx(tv(0.2))}" width="${fx(tu(0.79) - tu(0.082))}" height="${fx(tv(0.8) - tv(0.2))}" rx="16" fill="none" stroke="${SWARM.cream}" stroke-width="4.5" opacity="0.7"/>`
    // the slit the tab comes out of, then the scored fold just outboard of it
    s += `<path d="M ${fx(tu(0.045))} ${fx(tv(0.24))} L ${fx(tu(0.045))} ${fx(tv(0.76))}" stroke="${INK}" stroke-width="9" opacity="0.3"/>`
    s += `<path d="M ${fx(tu(0.077))} ${fx(tv(0.155))} L ${fx(tu(0.077))} ${fx(tv(0.845))}" stroke="${INK}" stroke-width="4" stroke-dasharray="14 11" opacity="0.42"/>`
    s += `<path d="M ${fx(tu(0.089))} ${fx(tv(0.16))} L ${fx(tu(0.089))} ${fx(tv(0.84))}" stroke="${SWARM.goldLit}" stroke-width="4" opacity="0.75"/>`
    // grip knurling: three short amber arcs echoing the scallops
    for (const gv of [0.3, 0.5, 0.7])
      s += `<path d="M ${fx(tu(0.862))} ${fx(tv(gv - 0.055))} Q ${fx(tu(0.892))} ${fx(tv(gv))} ${fx(tu(0.862))} ${fx(tv(gv + 0.055))}" fill="none" stroke="${SWARM.amber}" stroke-width="4" opacity="0.6"/>`
    // the pull direction: a dashed bee-loop sweeping OUTBOARD into an arrowhead,
    // with two courier bees riding it (motif, and both kept well inside the
    // silhouette — a die-cut cannot carry detached alpha islands)
    const loop = `M ${fx(tu(0.15))} ${fx(tv(0.315))} C ${fx(tu(0.33))} ${fx(tv(0.17))} ${fx(tu(0.56))} ${fx(tv(0.17))} ${fx(tu(0.735))} ${fx(tv(0.27))}`
    s += `<path d="${loop}" fill="none" stroke="${INK}" stroke-width="4.6" stroke-dasharray="15 12" opacity="0.35"/>`
    s += `<path d="${loop}" fill="none" stroke="${SWARM.amber}" stroke-width="3.4" stroke-dasharray="15 12"/>`
    s += `<path d="M ${fx(tu(0.735))} ${fx(tv(0.27))} l ${fx(-TW * 0.026)} ${fx(-TH * 0.05)} l ${fx(TW * 0.042)} ${fx(TH * 0.038)} l ${fx(-TW * 0.04)} ${fx(TH * 0.045)} Z" fill="${SWARM.amber}"/>`
    s += swarmBee(tu(0.3), tv(0.235), cs * 0.3, 'wingsMid')
    s += swarmBee(tu(0.6), tv(0.225), cs * 0.26, 'scout')
    // the label, two lines, centred on the interior between rule and grip
    const lx = (tu(0.1) + tu(0.78)) / 2
    const label = (v, txt) =>
      `<text x="${fx(lx)}" y="${fx(tv(v))}" font-family="Georgia, 'Times New Roman', serif" font-size="84" font-weight="bold" text-anchor="middle" fill="${SWARM.slateDeep}">${txt}</text>`
    // Baselines: measured at font-size 84 the caps are 61 px of art (13.5 px on
    // screen) and "STIR THE" inks 428 px wide, so the pair is set at 0.52/0.775
    // to keep every letter inside the cream rule (0.20..0.80) — at 0.83 the
    // SWARM row crossed the rule's bottom edge.
    s += label(0.52, 'STIR THE')
    s += label(0.775, 'SWARM')
    // the red wax bow, seated ON the scored fold and kept clear of the S of STIR
    // (wax accent 2 of 3)
    const wx = tu(0.072)
    const wy = tv(0.28)
    s += `<path d="M ${fx(wx - 17)} ${fx(wy - 14)} q 17 14 0 28 M ${fx(wx + 17)} ${fx(wy - 14)} q -17 14 0 28" fill="#c2604f" stroke="#7a2b22" stroke-width="2.4"/>`
    s += `<circle cx="${fx(wx)}" cy="${fx(wy)}" r="14" fill="${SWARM.red}" stroke="#7a2b22" stroke-width="3"/>`
    s += `<circle cx="${fx(wx - 4)}" cy="${fx(wy - 4)}" r="4.5" fill="#d9877a" opacity="0.9"/>`
  }
  s += `</g>`
  // Cells 17-22 and 25-26 are now deliberately TRANSPARENT: they held round 1's
  // 2x2 STIR tab and the printed banner strip, and nothing samples either any
  // more (the tab moved to the 5x3 block at cell 32, and the page print points
  // at the tab instead of repeating its lettering).
  const defs =
    `<linearGradient id="s3tabFace" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${SWARM.goldLit}"/>` +
    `<stop offset="0.55" stop-color="${SWARM.gold}"/>` +
    `<stop offset="1" stop-color="${SWARM.amber}" stop-opacity="0.82"/></linearGradient>`
  return svgPiece(w, h, s, defs)
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
 * THE APPRENTICE AND THE LOOKING-GLASS (ch2-hero, kept v-fold 0.51x0.89 —
 * REPAINT, pack §4d). The spread depicts the instant the glass works, so the
 * piece it is built around is the GLASS: the apprentice holds a round brass
 * looking-glass ALOFT on the right panel (clear of the crease at u 0.45, so
 * the disc is never bent into an ellipse by the fold) and the whole 3D vortex
 * wheels around that raised lens. The red courier satchel is THE saturated
 * accent of the spread — one object, worn across the body, at the figure's
 * value centre. Everything else is the alpine-airy register: cream sleeves,
 * alpine-blue tunic, slate trousers, walnut boots.
 *
 * Built as LAYERED die-cut card rather than one silhouette: arms behind, body
 * and head over them, satchel and glass glued on top, each with the house
 * pale core rim — which is what a paper apprentice actually is.
 */
function apprenticeGlass(w, h, seed) {
  const r = mulberry32(seed)
  const P = SWARM
  const SKIN = '#d8a878'
  const SKIN_DIM = '#b07f52'
  const BOOT = '#3a3128'
  // landmarks (px). The crease sits at u 0.45; the body straddles it, the
  // raised arm and the glass live entirely on the right panel.
  const headC = [w * 0.42, h * 0.27]
  // Head grown 0.115w -> 0.125w (135 -> 147 px of art, 1.087x — inside the
  // 1.15x the mesh quad tolerates). The face is the piece that has to survive
  // the 0.256x reading downscale, and on a 135 px head there was no room to
  // carry a fringe, a brow, two eyes AND a mouth at the 12 px-of-art floor.
  // 147 px of head is 37.6 px on screen at the pinned camera.
  const headR = w * 0.125
  const shoulder = [w * 0.5, h * 0.39] // arm ROOTS sit inside the tunic, so the
  const shoulderL = [w * 0.32, h * 0.39] // limb's round cap never shows as a knob
  const hand = [w * 0.655, h * 0.245]
  const lensC = [w * 0.78, h * 0.135]
  const lensR = w * 0.17
  const hipY = h * 0.63
  const footY = h * 0.985

  const limb = (pts, wid, fill) => {
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${fx(x)} ${fx(y)}`).join(' ')
    return (
      `<path d="${d}" fill="none" stroke="${RIM}" stroke-width="${fx(wid + 9)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>` +
      `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${fx(wid + 4)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>` +
      `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${fx(wid)}" stroke-linecap="round" stroke-linejoin="round"/>`
    )
  }

  let s = `<g>`
  // ---- ARMS (back layer): the raised right arm reaching for the sky, the
  // left hanging with a letter in its fist.
  s += limb([shoulder, [w * 0.6, h * 0.3], hand], w * 0.085, P.cream)
  s += limb([shoulderL, [w * 0.17, h * 0.52], [w * 0.16, h * 0.6]], w * 0.08, P.cream)
  // both fists
  for (const [fxp, fyp] of [hand, [w * 0.16, h * 0.605]]) {
    s += `<circle cx="${fx(fxp)}" cy="${fx(fyp)}" r="${fx(w * 0.062)}" fill="${RIM}" opacity="0.95"/>`
    s += `<circle cx="${fx(fxp)}" cy="${fx(fyp)}" r="${fx(w * 0.05)}" fill="${SKIN}" stroke="${INK}" stroke-width="2" stroke-opacity="0.5"/>`
  }
  // a letter held in the low fist — he is a courier before he is an inventor
  s += swarmEnvelope(w * 0.13, h * 0.66, w * 0.19, 'face', -14)

  // ---- LEGS + TORSO (one silhouette, so the figure has a single card body)
  const body =
    `M ${fx(w * 0.29)} ${fx(h * 0.375)} ` +
    `C ${fx(w * 0.3)} ${fx(h * 0.34)} ${fx(w * 0.53)} ${fx(h * 0.34)} ${fx(w * 0.55)} ${fx(h * 0.375)} ` + // shoulder line
    `L ${fx(w * 0.58)} ${fx(hipY)} L ${fx(w * 0.59)} ${fx(h * 0.78)} ` +
    `L ${fx(w * 0.605)} ${fx(footY)} L ${fx(w * 0.475)} ${fx(footY)} ` +
    `L ${fx(w * 0.458)} ${fx(h * 0.72)} L ${fx(w * 0.422)} ${fx(h * 0.72)} ` + // the legs part at mid-thigh
    `L ${fx(w * 0.405)} ${fx(footY)} L ${fx(w * 0.275)} ${fx(footY)} ` +
    `L ${fx(w * 0.29)} ${fx(h * 0.78)} L ${fx(w * 0.28)} ${fx(hipY)} Z`
  s += `<path d="${body}" fill="${P.slateDeep}"/>`
  // tunic over the trousers: alpine blue, hem at mid-thigh, lit on the left
  const tunic = `M ${fx(w * 0.29)} ${fx(h * 0.375)} C ${fx(w * 0.3)} ${fx(h * 0.34)} ${fx(w * 0.53)} ${fx(h * 0.34)} ${fx(w * 0.55)} ${fx(h * 0.375)} L ${fx(w * 0.575)} ${fx(h * 0.66)} L ${fx(w * 0.285)} ${fx(h * 0.665)} Z`
  s += `<path d="${tunic}" fill="${P.blue}"/>`
  s += `<path d="M ${fx(w * 0.29)} ${fx(h * 0.375)} L ${fx(w * 0.285)} ${fx(h * 0.665)} L ${fx(w * 0.36)} ${fx(h * 0.664)} L ${fx(w * 0.35)} ${fx(h * 0.372)} Z" fill="${P.sky}" opacity="0.35"/>` // lit edge
  s += `<path d="M ${fx(w * 0.5)} ${fx(h * 0.36)} L ${fx(w * 0.55)} ${fx(h * 0.375)} L ${fx(w * 0.575)} ${fx(h * 0.66)} L ${fx(w * 0.51)} ${fx(h * 0.662)} Z" fill="${P.slate}" opacity="0.4"/>` // shade edge
  // collar + placket
  s += `<path d="M ${fx(w * 0.35)} ${fx(h * 0.352)} L ${fx(w * 0.42)} ${fx(h * 0.42)} L ${fx(w * 0.49)} ${fx(h * 0.35)}" fill="none" stroke="${P.cream}" stroke-width="${fx(w * 0.022)}"/>`
  s += `<line x1="${fx(w * 0.42)}" y1="${fx(h * 0.42)}" x2="${fx(w * 0.43)}" y2="${fx(h * 0.66)}" stroke="${P.slate}" stroke-width="2.6" opacity="0.6"/>`
  // knee-boots
  for (const [bx0, bx1] of [[0.282, 0.355], [0.462, 0.545]]) {
    s += `<path d="M ${fx(w * bx0)} ${fx(h * 0.845)} L ${fx(w * (bx1 + 0.05))} ${fx(h * 0.845)} L ${fx(w * (bx1 + 0.06))} ${fx(footY)} L ${fx(w * (bx0 - 0.005))} ${fx(footY)} Z" fill="${BOOT}"/>`
    s += `<line x1="${fx(w * bx0)}" y1="${fx(h * 0.87)}" x2="${fx(w * (bx1 + 0.052))}" y2="${fx(h * 0.87)}" stroke="${P.gold}" stroke-width="3" opacity="0.7"/>`
  }
  s += rimPath(body, 5)

  // ---- HEAD — the readability piece of the whole spread. Round 1 gave him ONE
  // INK dot of r = headR*0.13 (8.8 px of art, 2.3 px on screen) and a 2.6 px
  // half-smile (0.7 px on screen) under a bowl cut that came down to the
  // eyeline; the blind reader's verdict was "a blank tan oval under a dark
  // bowl-cut, no eyes, no mouth — the protagonist of the spread is the least
  // readable object in it". Repainted to a hard floor: at 0.256x anything under
  // 12 px of art is under 3 px on screen and dissolves into the skin, so EVERY
  // feature below is sized off HR = 73.4 px and its screen size is stated.
  // The fringe is lifted clear of the brow line so there is a forehead to hang
  // features on, and the pair of eyes (not one) is what says "face" at 37 px.
  const HR = headR
  const hcx = headC[0]
  const hcy = headC[1]
  const faceX = hcx + HR * 0.05 // turned a hair toward the raised glass
  s += `<circle cx="${fx(hcx)}" cy="${fx(hcy)}" r="${fx(HR + 5)}" fill="${RIM}" opacity="0.95"/>`
  s += `<circle cx="${fx(hcx)}" cy="${fx(hcy)}" r="${fx(HR)}" fill="${SKIN}"/>`
  // cheek/jaw shade on the away side — a ball, not a disc
  s += `<path d="M ${fx(hcx + HR * 0.52)} ${fx(hcy - HR * 0.5)} A ${fx(HR)} ${fx(HR)} 0 0 1 ${fx(hcx + HR * 0.2)} ${fx(hcy + HR * 0.98)} Q ${fx(hcx + HR * 0.62)} ${fx(hcy + HR * 0.42)} ${fx(hcx + HR * 0.52)} ${fx(hcy - HR * 0.5)} Z" fill="${SKIN_DIM}" opacity="0.3"/>`
  // walnut bowl cut: skull cap + sideburn tabs, fringe swept to HR*0.24-0.30
  // ABOVE centre (was ON the eyeline), which is what buys the forehead.
  const hy = HR * 0.34
  const hxE = HR * 0.9404 // = sqrt(1 - 0.34^2), the sideburn root on the skull
  const crop =
    `M ${fx(hcx - hxE)} ${fx(hcy + hy)} ` +
    `A ${fx(HR)} ${fx(HR)} 0 1 1 ${fx(hcx + hxE)} ${fx(hcy + hy)} ` + // large-arc: OVER the skull

    `L ${fx(hcx + HR * 0.84)} ${fx(hcy - HR * 0.02)} ` +
    `Q ${fx(hcx + HR * 0.52)} ${fx(hcy - HR * 0.42)} ${fx(hcx + HR * 0.02)} ${fx(hcy - HR * 0.3)} ` +
    `Q ${fx(hcx - HR * 0.52)} ${fx(hcy - HR * 0.24)} ${fx(hcx - HR * 0.84)} ${fx(hcy + HR * 0.06)} Z`
  s += `<path d="${crop}" fill="${P.bee}"/>`
  s += `<path d="M ${fx(hcx - HR * 0.5)} ${fx(hcy - HR * 0.62)} Q ${fx(hcx - HR * 0.12)} ${fx(hcy - HR * 0.82)} ${fx(hcx + HR * 0.3)} ${fx(hcy - HR * 0.64)}" fill="none" stroke="${P.slate}" stroke-width="${fx(HR * 0.1)}" opacity="0.55"/>` // crown sheen
  // the guild-gold cap band, sitting ON the bowl cut well above the brows
  // (12.5 px of art = 3.2 px on screen; gold on walnut is the spread's highest
  // contrast pairing, so it survives the downscale as a band, not a smear)
  s += `<path d="M ${fx(hcx - HR * 0.76)} ${fx(hcy - HR * 0.5)} Q ${fx(hcx - HR * 0.02)} ${fx(hcy - HR * 0.72)} ${fx(hcx + HR * 0.76)} ${fx(hcy - HR * 0.48)}" fill="none" stroke="${P.gold}" stroke-width="${fx(HR * 0.17)}" stroke-linecap="butt"/>`
  s += `<path d="M ${fx(hcx - HR * 0.76)} ${fx(hcy - HR * 0.5)} Q ${fx(hcx - HR * 0.02)} ${fx(hcy - HR * 0.72)} ${fx(hcx + HR * 0.76)} ${fx(hcy - HR * 0.48)}" fill="none" stroke="${P.amber}" stroke-width="${fx(HR * 0.04)}" opacity="0.7"/>`
  // ear on the near side: 26 px of art across = 6.8 px on screen
  s += `<circle cx="${fx(hcx - HR * 0.94)}" cy="${fx(hcy + HR * 0.18)}" r="${fx(HR * 0.18)}" fill="${SKIN}" stroke="${INK}" stroke-width="2.4" stroke-opacity="0.5"/>`
  s += `<path d="M ${fx(hcx - HR * 0.98)} ${fx(hcy + HR * 0.1)} q ${fx(HR * 0.1)} ${fx(HR * 0.08)} ${fx(-HR * 0.01)} ${fx(HR * 0.16)}" fill="none" stroke="${SKIN_DIM}" stroke-width="3"/>`
  // BROWS — 30 px long x 12.5 px thick of art = 7.7 x 3.2 px on screen. Raised
  // (he is watching the glass work), and they are what turns two dots into eyes.
  for (const sgn of [-1, 1]) {
    const bx = faceX + sgn * HR * 0.31
    s += `<path d="M ${fx(bx - HR * 0.2)} ${fx(hcy - HR * (sgn < 0 ? 0.06 : 0.09))} Q ${fx(bx)} ${fx(hcy - HR * (sgn < 0 ? 0.19 : 0.22))} ${fx(bx + HR * 0.2)} ${fx(hcy - HR * (sgn < 0 ? 0.09 : 0.05))}" fill="none" stroke="${P.bee}" stroke-width="${fx(HR * 0.17)}" stroke-linecap="round"/>`
  }
  // EYES — r = HR*0.165, i.e. 24 px of art across each = 6.2 px on screen, and
  // a PAIR, which is the cue the single round-1 dot could not carry.
  for (const sgn of [-1, 1]) {
    const ex = faceX + sgn * HR * 0.31
    const ey = hcy + HR * 0.16
    s += `<circle cx="${fx(ex)}" cy="${fx(ey)}" r="${fx(HR * 0.165)}" fill="${P.bee}"/>`
    s += `<circle cx="${fx(ex + HR * 0.055)}" cy="${fx(ey - HR * 0.06)}" r="${fx(HR * 0.052)}" fill="${P.cream}" opacity="0.92"/>` // catchlight, gaze up-right
  }
  // nose: a dim wedge only — low contrast on purpose, so it models the face
  // without competing with the eyes for the three screen pixels available
  s += `<path d="M ${fx(faceX + HR * 0.03)} ${fx(hcy + HR * 0.3)} L ${fx(faceX + HR * 0.13)} ${fx(hcy + HR * 0.5)} L ${fx(faceX - HR * 0.07)} ${fx(hcy + HR * 0.49)} Z" fill="${SKIN_DIM}" opacity="0.75"/>`
  // MOUTH — an open grin painted as a FILLED crescent, 41 px wide x 13 px deep
  // of art = 10.5 x 3.4 px on screen. Round 1 stroked this at 2.6 px (0.7 px on
  // screen), which is why the reader found no mouth at all.
  const mo = `M ${fx(faceX - HR * 0.28)} ${fx(hcy + HR * 0.56)} Q ${fx(faceX)} ${fx(hcy + HR * 0.88)} ${fx(faceX + HR * 0.28)} ${fx(hcy + HR * 0.54)} Q ${fx(faceX)} ${fx(hcy + HR * 0.52)} Z`
  s += `<path d="${mo}" fill="${P.bee}"/>`
  s += `<path d="M ${fx(faceX - HR * 0.2)} ${fx(hcy + HR * 0.575)} Q ${fx(faceX)} ${fx(hcy + HR * 0.62)} ${fx(faceX + HR * 0.2)} ${fx(hcy + HR * 0.565)}" fill="none" stroke="${P.cream}" stroke-width="${fx(HR * 0.05)}" opacity="0.85"/>` // teeth sliver
  // chin shadow, seating the jaw under the grin
  s += `<path d="M ${fx(faceX - HR * 0.24)} ${fx(hcy + HR * 0.8)} Q ${fx(faceX + HR * 0.02)} ${fx(hcy + HR * 0.92)} ${fx(faceX + HR * 0.26)} ${fx(hcy + HR * 0.76)}" fill="none" stroke="${SKIN_DIM}" stroke-width="${fx(HR * 0.06)}" opacity="0.5"/>`
  s += `<circle cx="${fx(hcx)}" cy="${fx(hcy)}" r="${fx(HR)}" fill="none" stroke="${INK}" stroke-width="2" stroke-opacity="0.45"/>`

  // ---- THE RED COURIER SATCHEL: the ONE saturated accent, worn across the
  // body so it sits at the figure's centre of value and cannot be missed.
  const strap = `M ${fx(w * 0.51)} ${fx(h * 0.375)} L ${fx(w * 0.34)} ${fx(h * 0.585)}`
  s += `<path d="${strap}" fill="none" stroke="${RIM}" stroke-width="${fx(w * 0.072)}" opacity="0.9"/>`
  s += `<path d="${strap}" fill="none" stroke="${P.red}" stroke-width="${fx(w * 0.052)}"/>`
  s += `<path d="${strap}" fill="none" stroke="#7a2b22" stroke-width="${fx(w * 0.052)}" stroke-dasharray="1 14" opacity="0.5"/>`
  const bagX = w * 0.215
  const bagY = h * 0.578
  const bagW = w * 0.265
  const bagH = h * 0.1
  s += `<rect x="${fx(bagX - 5)}" y="${fx(bagY - 5)}" width="${fx(bagW + 10)}" height="${fx(bagH + 10)}" rx="7" fill="${RIM}" opacity="0.95"/>`
  s += `<rect x="${fx(bagX)}" y="${fx(bagY)}" width="${fx(bagW)}" height="${fx(bagH)}" rx="5" fill="${P.red}" stroke="#7a2b22" stroke-width="3"/>`
  s += `<path d="M ${fx(bagX)} ${fx(bagY)} h ${fx(bagW)} v ${fx(bagH * 0.46)} q ${fx(-bagW / 2)} ${fx(bagH * 0.24)} ${fx(-bagW)} 0 Z" fill="#c2604f" stroke="#7a2b22" stroke-width="2.6"/>` // flap
  s += `<rect x="${fx(bagX + bagW * 0.42)}" y="${fx(bagY + bagH * 0.42)}" width="${fx(bagW * 0.16)}" height="${fx(bagH * 0.3)}" rx="3" fill="${P.gold}" stroke="${P.amber}" stroke-width="2"/>` // buckle
  // letters poking out of the mouth
  for (const [lx, lr] of [[0.18, -12], [0.62, 9]])
    s += swarmEnvelope(bagX + bagW * lx, bagY - bagH * 0.16, bagW * 0.34, 'face', lr)

  // ---- THE LOOKING-GLASS, held aloft: a brass ring with a pale lens, the
  // one round thing in a spread built of arcs. Two amber rings + a gold core
  // so the metal reads at distance; the glass carries a cool sky wash, a
  // crescent specular and a hairline crosshair (it is an instrument).
  const stem = `M ${fx(hand[0])} ${fx(hand[1])} L ${fx(lensC[0] - lensR * 0.42)} ${fx(lensC[1] + lensR * 0.72)}`
  s += `<path d="${stem}" fill="none" stroke="${RIM}" stroke-width="${fx(w * 0.058)}" stroke-linecap="round" opacity="0.95"/>`
  s += `<path d="${stem}" fill="none" stroke="${P.amber}" stroke-width="${fx(w * 0.04)}" stroke-linecap="round"/>`
  s += `<circle cx="${fx(lensC[0])}" cy="${fx(lensC[1])}" r="${fx(lensR + 6)}" fill="${RIM}" opacity="0.95"/>`
  s += `<circle cx="${fx(lensC[0])}" cy="${fx(lensC[1])}" r="${fx(lensR)}" fill="${P.amber}"/>`
  s += `<circle cx="${fx(lensC[0])}" cy="${fx(lensC[1])}" r="${fx(lensR * 0.88)}" fill="${P.gold}"/>`
  s += `<circle cx="${fx(lensC[0])}" cy="${fx(lensC[1])}" r="${fx(lensR * 0.72)}" fill="${P.sky}" stroke="${P.amber}" stroke-width="${fx(lensR * 0.09)}"/>`
  s += `<path d="M ${fx(lensC[0] - lensR * 0.5)} ${fx(lensC[1])} a ${fx(lensR * 0.5)} ${fx(lensR * 0.5)} 0 0 1 ${fx(lensR * 0.62)} ${fx(-lensR * 0.34)}" fill="none" stroke="#ffffff" stroke-width="${fx(lensR * 0.16)}" opacity="0.8" stroke-linecap="round"/>` // specular crescent
  s += `<path d="M ${fx(lensC[0] - lensR * 0.62)} ${fx(lensC[1])} h ${fx(lensR * 1.24)} M ${fx(lensC[0])} ${fx(lensC[1] - lensR * 0.62)} v ${fx(lensR * 1.24)}" stroke="${P.blue}" stroke-width="2" opacity="0.5"/>` // crosshair
  // knurling on the brass ring
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2 + 0.15
    s += `<line x1="${fx(lensC[0] + Math.cos(a) * lensR * 0.78)}" y1="${fx(lensC[1] + Math.sin(a) * lensR * 0.78)}" x2="${fx(lensC[0] + Math.cos(a) * lensR * 0.97)}" y2="${fx(lensC[1] + Math.sin(a) * lensR * 0.97)}" stroke="${P.amber}" stroke-width="2.4" opacity="0.75"/>`
  }
  // ONE guild bee, PERCHED ON the brass rim rather than floating beside it:
  // a die-cut piece cannot carry detached alpha islands, and the inner orbit
  // is already flying as the ch2-bee-b/-c children.
  {
    const a = Math.PI * 1.17
    const f = beeFit(w * 0.15, 'wingsUp')
    s += swarmBee(
      lensC[0] + Math.cos(a) * lensR * 0.98 + f.dx + rr(r, -3, 3),
      lensC[1] + Math.sin(a) * lensR * 0.98 + f.s * 0.1,
      f.s,
      'wingsUp'
    )
  }
  s += `</g>`
  return svgPiece(w, h, s)
}

/**
 * ZÜRICH FROM THE MEADOW (ch2-backdrop, kept v-fold 1.65x0.94 — REPAINT,
 * pack §4d). The E1 art here was a warm, densely painted chalet mountainside:
 * the most detailed, highest-contrast thing on a spread whose declared first
 * read is the swarm, so it took the eye and held it. This is the opposite
 * piece — a PALE alpine distance that the vortex can be read against:
 *
 *   sky wash and snow ranks in aerial blue, a lake band, the city as a flat
 *   SLATE SILHOUETTE (Grossmünster's twin towers, Fraumünster's spire, a rank
 *   of gabled roofs) with a few gold window glints, and — the piece the pack
 *   asks for by name — PAINTED SKEINS OF BEES wheeling up off the built ring's
 *   crown and receding to nothing, so the thousand couriers continue past the
 *   twenty-two the paper can hold. (Round 1 painted these as 134 soft dots and
 *   the blind reader read them as mildew; see the swarm block for the repaint.)
 *
 * Full-bleed opaque: the S5 strut-silhouette gate wants this panel covering
 * the whole ring cone, so no alpha is carved anywhere near the top edge.
 */
function zurichVista(w, h, seed) {
  const r = mulberry32(seed)
  const P = SWARM
  const CREASE = 0.6 // content.ts creaseU — the fold catches the crest light
  const horizon = h * 0.6

  let s = `<g>`
  s += `<rect width="${w}" height="${h}" fill="url(#s3sky)"/>`
  // --- SNOW RANKS: three ranges, each paler and lower-contrast than the one
  // in front, so distance is carried by VALUE rather than by detail.
  const range = (baseV, amp, n, fill, phase) => {
    let d = `M 0 ${fx(h)} L 0 ${fx(h * baseV)}`
    for (let i = 0; i <= n; i++) {
      const x = (w * i) / n
      const peak = h * baseV - Math.abs(Math.sin(i * 1.31 + phase)) * h * amp - rr(r, 0, h * amp * 0.3)
      d += ` L ${fx(x - w / n / 2.4)} ${fx(peak)} L ${fx(x)} ${fx(h * baseV - rr(r, 0, h * amp * 0.18))}`
    }
    return `<path d="${d} L ${fx(w)} ${fx(h)} Z" fill="${fill}"/>`
  }
  s += range(0.5, 0.17, 7, '#c6d7e4', 0.4)
  s += range(0.545, 0.11, 9, '#b1c7da', 2.1)
  s += range(0.578, 0.06, 13, '#9db6cc', 3.7)
  // a low warm band along the horizon — alpine light, and the one warm note
  // keeping the pale distance from reading as grey card
  s += `<rect y="${fx(h * 0.44)}" width="${w}" height="${fx(h * 0.18)}" fill="url(#s3warm)"/>`
  // snow caps: pale wedges on the front rank's tips only (detail dies with
  // distance, so only the nearest range gets any)
  for (let i = 0; i < 9; i++) {
    const x = w * (0.06 + i * 0.11)
    const y = h * (0.53 + rr(r, -0.012, 0.012))
    s += `<path d="M ${fx(x)} ${fx(y)} l ${fx(w * 0.017)} ${fx(h * 0.028)} l ${fx(-w * 0.034)} 0 Z" fill="#f4f8fb" opacity="0.85"/>`
  }

  // --- THE LAKE: a flat band with pale ripple rules, darkening downstage
  s += `<rect y="${fx(horizon)}" width="${w}" height="${fx(h * 0.22)}" fill="url(#s3lake)"/>`
  for (let i = 0; i < 26; i++) {
    const y = horizon + rr(r, h * 0.012, h * 0.2)
    const x0 = rr(r, 0, w * 0.8)
    s += `<line x1="${fx(x0)}" y1="${fx(y)}" x2="${fx(x0 + rr(r, w * 0.04, w * 0.19))}" y2="${fx(y)}" stroke="#eaf1f6" stroke-width="${fx(rr(r, 1.4, 3))}" opacity="${fx(rr(r, 0.3, 0.62))}"/>`
  }

  // --- THE CITY, flat slate on the far shore. Silhouette only: at this
  // distance a skyline is a shape, and any modelling would out-detail the
  // die-cut ring standing in front of it.
  const cityBase = horizon + h * 0.006
  const roofRank = (x0, x1, top, gables) => {
    let d = `M ${fx(x0)} ${fx(cityBase)} L ${fx(x0)} ${fx(top)}`
    const step = (x1 - x0) / gables
    for (let i = 0; i < gables; i++) {
      const gx = x0 + step * i
      const gh = rr(r, h * 0.008, h * 0.03)
      d += ` L ${fx(gx)} ${fx(top + gh)} L ${fx(gx + step / 2)} ${fx(top + gh - h * 0.022)} L ${fx(gx + step)} ${fx(top + gh)}`
    }
    return `${d} L ${fx(x1)} ${fx(cityBase)} Z`
  }
  s += `<path d="${roofRank(w * 0.06, w * 0.44, h * 0.545, 7)}" fill="${P.slate}" opacity="0.92"/>`
  s += `<path d="${roofRank(w * 0.56, w * 0.97, h * 0.552, 8)}" fill="${P.slate}" opacity="0.92"/>`
  s += `<path d="${roofRank(w * 0.4, w * 0.62, h * 0.558, 4)}" fill="${P.slateDeep}" opacity="0.9"/>`
  // Grossmünster: the twin square towers, each with a stepped cap
  const tower = (cx, tw, topY) => {
    let g = `<rect x="${fx(cx - tw / 2)}" y="${fx(topY)}" width="${fx(tw)}" height="${fx(cityBase - topY)}" fill="${P.slateDeep}"/>`
    g += `<path d="M ${fx(cx - tw * 0.62)} ${fx(topY)} L ${fx(cx)} ${fx(topY - h * 0.05)} L ${fx(cx + tw * 0.62)} ${fx(topY)} Z" fill="${P.slateDeep}"/>`
    g += `<rect x="${fx(cx - tw * 0.62)}" y="${fx(topY - h * 0.004)}" width="${fx(tw * 1.24)}" height="${fx(h * 0.008)}" fill="${P.slate}"/>`
    // one gold-lit belfry window per tower — the guild is awake
    g += `<rect x="${fx(cx - tw * 0.16)}" y="${fx(topY + h * 0.016)}" width="${fx(tw * 0.32)}" height="${fx(h * 0.026)}" rx="${fx(tw * 0.16)}" fill="${P.gold}" opacity="0.85"/>`
    return g
  }
  s += tower(w * 0.3, w * 0.032, h * 0.44)
  s += tower(w * 0.35, w * 0.032, h * 0.442)
  // Fraumünster: the single slim spire across the water
  s += `<rect x="${fx(w * 0.685)}" y="${fx(h * 0.475)}" width="${fx(w * 0.022)}" height="${fx(cityBase - h * 0.475)}" fill="${P.slateDeep}"/>`
  s += `<path d="M ${fx(w * 0.679)} ${fx(h * 0.475)} L ${fx(w * 0.696)} ${fx(h * 0.4)} L ${fx(w * 0.713)} ${fx(h * 0.475)} Z" fill="${P.slateDeep}"/>`
  s += `<circle cx="${fx(w * 0.696)}" cy="${fx(h * 0.393)}" r="${fx(w * 0.005)}" fill="${P.gold}"/>`
  // scattered lit windows along both ranks
  for (let i = 0; i < 22; i++) {
    const x = rr(r, w * 0.07, w * 0.96)
    const y = rr(r, h * 0.565, cityBase - h * 0.004)
    s += `<rect x="${fx(x)}" y="${fx(y)}" width="${fx(w * 0.005)}" height="${fx(h * 0.008)}" fill="${P.gold}" opacity="${fx(rr(r, 0.4, 0.85))}"/>`
  }
  // the city's reflection, a soft slate smear on the near water
  s += `<rect y="${fx(cityBase)}" width="${w}" height="${fx(h * 0.055)}" fill="${P.slate}" opacity="0.16"/>`

  // --- THE NEAR SHORE: a low meadow bank the built world stands out of
  // Kept PALE on purpose: the hero's slate trousers and the ring's low riders
  // stand right in front of this band, and at full meadow value the darkest
  // parts of the built world sat on a mid-green ground and went muddy. The
  // near shore is distance too — it just happens to be the nearest distance.
  s += `<path d="M 0 ${fx(h * 0.79)} C ${fx(w * 0.24)} ${fx(h * 0.75)} ${fx(w * 0.62)} ${fx(h * 0.83)} ${fx(w)} ${fx(h * 0.77)} L ${fx(w)} ${fx(h)} L 0 ${fx(h)} Z" fill="${P.meadow}" opacity="0.4"/>`
  s += `<path d="M 0 ${fx(h * 0.88)} C ${fx(w * 0.3)} ${fx(h * 0.92)} ${fx(w * 0.7)} ${fx(h * 0.86)} ${fx(w)} ${fx(h * 0.91)} L ${fx(w)} ${fx(h)} L 0 ${fx(h)} Z" fill="#55764c" opacity="0.28"/>`
  // poplar rank along the bank — the only vertical rhythm down here, held
  // faint so a painted tree is never mistaken for another hairline strut
  for (let i = 0; i < 14; i++) {
    const x = rr(r, w * 0.02, w * 0.98)
    const y = h * (0.79 + rr(r, 0, 0.05))
    const ph = h * rr(r, 0.03, 0.062)
    s += `<path d="M ${fx(x)} ${fx(y)} q ${fx(-w * 0.007)} ${fx(-ph * 0.6)} 0 ${fx(-ph)} q ${fx(w * 0.007)} ${fx(ph * 0.4)} 0 ${fx(ph)} Z" fill="#6d8a63" opacity="${fx(rr(r, 0.35, 0.55))}"/>`
  }

  // --- THE PAINTED SWARM, receding to infinity. The paper can hold 28
  // couriers, the guild keeps a thousand, and this is where the other 972 live:
  // painted bees wheeling up off the built ring's crown, aerial recession done
  // in VALUE so the effect costs no strut and no radius margin.
  //
  // ROUND 2 — REPAINT. Round 1 painted three nested horseshoe RANKS of 60+44+30
  // = 134 soft `slateDeep` ellipses at 0.27-0.68 opacity, an even spray with a
  // wing hint on every third front-rank dot. The blind reader's verdict: "~120
  // soft dark-grey round blobs strung across both wall panels ...
  // indistinguishable from mildew, gravel, or a compression artefact. Nothing
  // about it says 'bees'." Three faults, all three addressed:
  //   COUNT — 134 marks over ~1000 px of sky is a TEXTURE. Now 43 bees.
  //   SHAPE — a bare soft ellipse carries no insect. Every bee in the near
  //     three tiers is now body + head + a PALE WING-DOT PAIR rotated onto its
  //     own flight tangent; the crest pass keeps one pale dash above; only the
  //     single farthest skein degrades to plain specks, which is the recession.
  //   GROUPING — an even arc spray reads as speckle however it is shaped. The
  //     43 are strung into 8 SKEINS of 4-7 along their own bezier flight lines,
  //     with 25-45 px of art (17-32 px on screen) of genuinely empty sky
  //     between neighbouring skeins.
  // Value: this sky is #dfeaf2..#e7eef4, so the near skeins are slateDeep at
  // 0.84 (round 1 went as low as 0.27) and 12.3 x 8.2 px of art, which is
  // 8.6 x 5.7 px on screen at the ~0.70x this panel displays at. The layout
  // still reads as ONE open horseshoe seen near edge-on — near arms low and
  // outboard, crest high and central — and the crest is deliberately the
  // sparsest, palest pass so the crease light band at u 0.6 stays clean.
  const cbez = (P4, t) => {
    const mt = 1 - t
    return [0, 1].map(
      (k) => mt * mt * mt * P4[0][k] + 3 * mt * mt * t * P4[1][k] + 3 * mt * t * t * P4[2][k] + t * t * t * P4[3][k]
    )
  }
  // A wing dot is slate-BODIED with a pale core, and it is set OUTBOARD of the
  // abdomen rather than tucked over it. Two measured failures got it here:
  //   (1) pale-only wings in `P.wing` (#eef2f5) on a #dfeaf2 sky are a +5
  //       luminance whisper — at 0.70x they vanished and each bee read as a
  //       little grey blimp with a light cap.
  //   (2) dark wings tucked ABOVE the body at -1.24 bry merged into it and the
  //       mark went back to being a lumpy dot.
  // What survives at 6 px is the SILHOUETTE, so the wings are dark enough to
  // join it AND stick out past the body: total mark 16.6 x 9.5 px of art, i.e.
  // 11.7 x 6.7 px on screen, with two spikes off a dark oval.
  const wingDot = (wx, wy, wrx, wry, rot, op) =>
    `<g transform="translate(${fx(wx)} ${fx(wy)}) rotate(${fx(rot)})">` +
    `<ellipse cx="0" cy="0" rx="${fx(wrx)}" ry="${fx(wry)}" fill="${P.slate}" opacity="${fx(Math.min(0.95, op))}"/>` +
    `<ellipse cx="0" cy="0" rx="${fx(wrx * 0.5)}" ry="${fx(wry * 0.46)}" fill="${P.wing}" opacity="${fx(Math.min(0.9, op * 0.85))}"/></g>`
  /** One distant courier: dark body + head between an outswept wing pair, set
   *  on its own flight tangent. `wings` is 2 (a wing either side, which is what
   *  breaks the oval into an insect), 1 (one dash above) or 0 (a far speck).
   *  `stripe` paints one gold cross-band — the species cue, spent only on the
   *  near tiers where 2.9 px of art still carries a hue. */
  const distantBee = (bx, by, brx, bry, ang, op, wings, stripe) => {
    let g = `<g transform="translate(${fx(bx)} ${fx(by)}) rotate(${fx(ang)})">`
    if (wings >= 2) {
      g += wingDot(-brx * 0.95, -bry * 0.98, brx * 0.62, bry * 0.36, -28, op * 0.92)
      g += wingDot(brx * 0.95, -bry * 1.02, brx * 0.58, bry * 0.34, 28, op * 0.8)
    } else if (wings === 1) {
      g += wingDot(brx * 0.06, -bry * 1.22, brx * 1.05, bry * 0.32, -13, op * 0.95)
    }
    g += `<ellipse cx="0" cy="0" rx="${fx(brx)}" ry="${fx(bry)}" fill="${P.slateDeep}" opacity="${fx(op)}"/>`
    if (stripe)
      g += `<line x1="${fx(-brx * 0.12)}" y1="${fx(-bry * 0.82)}" x2="${fx(-brx * 0.12)}" y2="${fx(bry * 0.82)}" stroke="${P.gold}" stroke-width="${fx(bry * 0.62)}" opacity="${fx(op * 0.85)}"/>`
    if (wings >= 1) g += `<circle cx="${fx(brx * 0.94)}" cy="${fx(-bry * 0.18)}" r="${fx(bry * 0.68)}" fill="${P.slateDeep}" opacity="${fx(op)}"/>`
    g += `</g>`
    return g
  }
  // 8 skeins, left arm -> crest -> right arm, plus one far inner skein. `sz`
  // and `op` carry the aerial recession the nested ranks used to carry.
  const CHAINS = [
    { p: [[0.038, 0.292], [0.082, 0.252], [0.132, 0.24], [0.182, 0.216]], n: 7, sz: 1, op: 0.84, wings: 2 },
    { p: [[0.222, 0.252], [0.258, 0.214], [0.3, 0.212], [0.34, 0.192]], n: 6, sz: 0.9, op: 0.78, wings: 2 },
    { p: [[0.38, 0.198], [0.412, 0.176], [0.444, 0.174], [0.474, 0.164]], n: 5, sz: 0.76, op: 0.62, wings: 2 },
    { p: [[0.512, 0.152], [0.556, 0.14], [0.622, 0.142], [0.66, 0.152]], n: 5, sz: 0.54, op: 0.44, wings: 1 },
    { p: [[0.702, 0.17], [0.734, 0.178], [0.762, 0.182], [0.792, 0.196]], n: 5, sz: 0.76, op: 0.62, wings: 2 },
    { p: [[0.828, 0.21], [0.86, 0.222], [0.884, 0.23], [0.912, 0.246]], n: 6, sz: 0.9, op: 0.78, wings: 2 },
    { p: [[0.94, 0.262], [0.958, 0.274], [0.974, 0.288], [0.99, 0.3]], n: 4, sz: 1, op: 0.84, wings: 2 },
    { p: [[0.286, 0.132], [0.33, 0.118], [0.39, 0.114], [0.436, 0.122]], n: 5, sz: 0.42, op: 0.32, wings: 0 },
  ]
  const BRX = w * 0.0052 // 5.3 px of art = 3.7 px on screen at 0.70x
  const BRY = w * 0.0035 // 3.6 px of art = 2.5 px on screen; the WING SPAN, not
  // the abdomen, is the mark: 2 * 1.56 * BRX = 16.6 px of art = 11.7 px on screen
  for (const ch of CHAINS) {
    for (let k = 0; k < ch.n; k++) {
      // members are spaced along the skein with a little slop, so a chain reads
      // as a flying string rather than as a stamped dotted rule
      const t = ch.n === 1 ? 0.5 : k / (ch.n - 1) + rr(r, -0.045, 0.045)
      const tc = Math.min(1, Math.max(0, t))
      const [ux, uy] = cbez(ch.p, tc)
      const [ax, ay] = cbez(ch.p, Math.min(1, tc + 0.02))
      const [bx2, by2] = cbez(ch.p, Math.max(0, tc - 0.02))
      const ang = (Math.atan2((ay - by2) * h, (ax - bx2) * w) * 180) / Math.PI
      const j = ch.sz * rr(r, 0.86, 1.16)
      s += distantBee(
        w * ux + rr(r, -w * 0.004, w * 0.004),
        h * uy + rr(r, -h * 0.016, h * 0.016),
        BRX * j,
        BRY * j,
        ang,
        ch.op * rr(r, 0.9, 1.08),
        ch.wings,
        ch.sz >= 0.9
      )
    }
  }

  // --- CREST LIGHT on the crease (u 0.6): the fold is the panel's own light
  // source in a v-fold, so it gets a warm pale gradient either side.
  s += `<rect x="${fx(w * CREASE - w * 0.13)}" y="0" width="${fx(w * 0.26)}" height="${h}" fill="url(#s3crest)"/>`
  s += `<rect width="${w}" height="${h}" fill="url(#s3vig)"/>`
  s += `</g>`

  const defs =
    `<linearGradient id="s3sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#bcd3e4"/>` +
    `<stop offset="0.45" stop-color="#dfeaf2"/>` +
    `<stop offset="0.72" stop-color="${P.sky}"/>` +
    `<stop offset="1" stop-color="#dfe7ec"/></linearGradient>` +
    `<linearGradient id="s3warm" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#f6e6c4" stop-opacity="0"/>` +
    `<stop offset="0.72" stop-color="#f6e6c4" stop-opacity="0.4"/>` +
    `<stop offset="1" stop-color="#f6e6c4" stop-opacity="0.1"/></linearGradient>` +
    `<linearGradient id="s3lake" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#9db6c9"/>` +
    `<stop offset="1" stop-color="${P.blue}"/></linearGradient>` +
    `<linearGradient id="s3crest" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0"/>` +
    `<stop offset="0.5" stop-color="#fff8e8" stop-opacity="0.16"/>` +
    `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="s3vig" cx="0.5" cy="0.42" r="0.78">` +
    `<stop offset="0.55" stop-color="${P.slateDeep}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${P.slateDeep}" stop-opacity="0.2"/></radialGradient>`

  return svgPiece(w, h, s, defs)
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
 * parcels mid-route; a honeycomb compass rose under the free right yard; a
 * painted STRAW SKEP with its smoker lying beside it, out in the lower-left
 * reader apron (T-COUNTERWEIGHT — the horseshoe's front gap is where the keeper
 * works), smoke rising toward that gap; and a dashed bee-loop affordance
 * leading to the die-cut STIR tab
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
    // left outer — LIFTED in round 2. It used to dive to y 0.86-0.88 across the
    // lower-left apron, i.e. straight through the painted keeper who stood
    // there; the reader read the resulting tangle as "a brown rail passes
    // straight through it". The skep that replaced the keeper sits at radial
    // 0.86 / z 0.665, so this route now holds y ~0.775 out to the fore edge and
    // clears the skep's dome by 47 px = 4.6% of the image width (the brief's
    // floor was 3%).
    [[0.485, 0.79], [0.37, 0.705], [0.215, 0.752], [0.03, 0.748]], // left outer
    [[0.488, 0.77], [0.4, 0.62], [0.3, 0.56], [0.12, 0.63]], // left inner, across the meadow lane
  ]

  // a painted flat courier (top view) at image fraction (x,y), rotated along
  // its route: gold body, walnut line, paper-white wing pair.
  const flatBee = (x, y, s, ang, dim) => {
    let g = `<g transform="translate(${fx(PX(x))} ${fx(PY(y))})">`
    // contact shadow FIRST, un-rotated: a painted courier lies ON the floor,
    // and the shadow is what seats it there (s2 T-FLOOR recipe)
    g += `<ellipse cx="${fx(s * 0.1)}" cy="${fx(s * 0.22)}" rx="${fx(s * 0.6)}" ry="${fx(s * 0.34)}" fill="${INK}" opacity="0.24"/>`
    g += `<g transform="rotate(${fx(ang)})" opacity="${fx(dim)}">`
    g += `<ellipse cx="0" cy="${fx(-s * 0.52)}" rx="${fx(s * 0.44)}" ry="${fx(s * 0.2)}" fill="${SWARM.wing}" stroke="${WALNUT}" stroke-width="${fx(Math.max(1.4, s * 0.05))}" stroke-opacity="0.85" transform="rotate(-24)"/>`
    g += `<ellipse cx="0" cy="${fx(s * 0.52)}" rx="${fx(s * 0.44)}" ry="${fx(s * 0.2)}" fill="${SWARM.wing}" stroke="${WALNUT}" stroke-width="${fx(Math.max(1.4, s * 0.05))}" stroke-opacity="0.85" transform="rotate(24)"/>`
    g += `<ellipse cx="0" cy="0" rx="${fx(s * 0.5)}" ry="${fx(s * 0.3)}" fill="${SWARM.bee}"/>`
    for (const t of [-0.26, 0, 0.26]) g += `<line x1="${fx(s * t)}" y1="${fx(-s * 0.27)}" x2="${fx(s * t)}" y2="${fx(s * 0.27)}" stroke="${SWARM.gold}" stroke-width="${fx(s * 0.15)}"/>`
    g += `<ellipse cx="0" cy="0" rx="${fx(s * 0.5)}" ry="${fx(s * 0.3)}" fill="none" stroke="${SWARM.bee}" stroke-width="${fx(Math.max(1.6, s * 0.06))}"/>`
    g += `<circle cx="${fx(s * 0.56)}" cy="0" r="${fx(s * 0.2)}" fill="${SWARM.bee}"/>`
    g += `</g></g>`
    return g
  }
  const flatLetter = (x, y, s, ang, sealed) => {
    let g = `<g transform="translate(${fx(PX(x))} ${fx(PY(y))})">`
    g += `<ellipse cx="${fx(s * 0.1)}" cy="${fx(s * 0.2)}" rx="${fx(s * 0.58)}" ry="${fx(s * 0.4)}" fill="${INK}" opacity="0.22"/>`
    g += `<g transform="rotate(${fx(ang)})">`
    // cream on parchment is a +20 luminance whisper; the BORDER is the mark
    g += `<rect x="${fx(-s * 0.5)}" y="${fx(-s * 0.34)}" width="${fx(s)}" height="${fx(s * 0.68)}" fill="${SWARM.cream}" stroke="${INK}" stroke-width="${fx(Math.max(1.8, s * 0.06))}"/>`
    g += `<path d="M ${fx(-s * 0.5)} ${fx(-s * 0.34)} L 0 ${fx(s * 0.1)} L ${fx(s * 0.5)} ${fx(-s * 0.34)}" fill="none" stroke="${WALNUT}" stroke-width="${fx(Math.max(1.5, s * 0.05))}" opacity="0.9"/>`
    g += `<path d="M ${fx(-s * 0.5)} ${fx(s * 0.34)} L ${fx(-s * 0.14)} ${fx(s * 0.02)} M ${fx(s * 0.5)} ${fx(s * 0.34)} L ${fx(s * 0.14)} ${fx(s * 0.02)}" fill="none" stroke="${WALNUT}" stroke-width="${fx(Math.max(1.2, s * 0.04))}" opacity="0.55"/>`
    if (sealed) g += `<circle cx="0" cy="${fx(s * 0.08)}" r="${fx(s * 0.18)}" fill="${SWARM.red}" stroke="#7a2b22" stroke-width="${fx(Math.max(1.4, s * 0.05))}"/>`
    g += `</g></g>`
    return g
  }
  const flatParcel = (x, y, s, ang) => {
    let g = `<g transform="translate(${fx(PX(x))} ${fx(PY(y))})">`
    g += `<ellipse cx="${fx(s * 0.09)}" cy="${fx(s * 0.2)}" rx="${fx(s * 0.5)}" ry="${fx(s * 0.38)}" fill="${INK}" opacity="0.2"/>`
    g += `<g transform="rotate(${fx(ang)})">`
    g += `<rect x="${fx(-s * 0.42)}" y="${fx(-s * 0.34)}" width="${fx(s * 0.84)}" height="${fx(s * 0.68)}" fill="${SWARM.parch}" stroke="${INK}" stroke-width="${fx(Math.max(1.6, s * 0.055))}"/>`
    g += `<line x1="0" y1="${fx(-s * 0.34)}" x2="0" y2="${fx(s * 0.34)}" stroke="${SWARM.amber}" stroke-width="${fx(Math.max(2, s * 0.08))}"/>`
    g += `<line x1="${fx(-s * 0.42)}" y1="0" x2="${fx(s * 0.42)}" y2="0" stroke="${SWARM.amber}" stroke-width="${fx(Math.max(2, s * 0.08))}"/>`
    g += `</g></g>`
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
    s += `<path d="M ${fx(x)} ${fx(y)} q ${fx(rr(r, -3, 3))} ${fx(-gl)} ${fx(rr(r, -2, 2))} ${fx(-gl * 1.25)}" fill="none" stroke="#4e6f47" stroke-width="1.8" opacity="${fx(rr(r, 0.45, 0.75))}"/>`
    if (i % 11 === 4) s += `<circle cx="${fx(x)}" cy="${fx(y - gl)}" r="${fx(rr(r, 2.2, 3.8))}" fill="${['#d9a441', '#e6e0b0', '#8fa9c4'][i % 3]}" stroke="${WALNUT}" stroke-width="1" stroke-opacity="0.45"/>`
  }
  // far half hazes out; the backdrop glues over most of it at rest
  s += `<rect width="${w}" height="${fx(h * 0.36)}" fill="url(#pageHaze3)"/>`
  // gutter valley shadow
  s += `<rect x="${fx(w * 0.46)}" y="0" width="${fx(w * 0.08)}" height="${h}" fill="url(#pageGutter3)"/>`

  // ---- THE GOLD ROUTES: dashed spirals out of the hive mouth, an amber echo
  // under each so they read as painted ribbon, not plot lines.
  // Gold on parchment is a same-value pairing: at 2.8 px over a 0.18 amber
  // halo the routes measured as a tint, not a mark. Painted the s2 key-trail
  // way instead — a walnut under-copy carrying its own contact offset, an
  // amber ribbon body, then the gold dash double-struck with its highlight.
  for (const P of ROUTES) {
    const d = pathOf(P)
    s += `<g transform="translate(1.5 3)"><path d="${d}" fill="none" stroke="${WALNUT}" stroke-width="6" opacity="0.22"/></g>`
    s += `<path d="${d}" fill="none" stroke="${SWARM.amber}" stroke-width="5.6" opacity="0.42"/>`
    s += `<path d="${d}" fill="none" stroke="${WALNUT}" stroke-width="4.4" stroke-dasharray="11 9" opacity="0.75"/>`
    s += `<path d="${d}" fill="none" stroke="${SWARM.gold}" stroke-width="3" stroke-dasharray="11 9"/>`
    s += `<path d="${d}" fill="none" stroke="${SWARM.goldLit}" stroke-width="1.2" stroke-dasharray="11 9" opacity="0.85"/>`
  }
  // the hive mouth they all pour from
  s += `<ellipse cx="${fx(PX(HIVE[0]))}" cy="${fx(PY(HIVE[1]))}" rx="${fx(PX(0.024))}" ry="${fx(PY(0.016))}" fill="${SWARM.amber}" opacity="0.35"/>`
  s += `<ellipse cx="${fx(PX(HIVE[0]))}" cy="${fx(PY(HIVE[1]))}" rx="${fx(PX(0.024))}" ry="${fx(PY(0.016))}" fill="none" stroke="${WALNUT}" stroke-width="2" opacity="0.5"/>`

  // ---- COURIERS ALONG THE ROUTES: 10 bees + 6 letters + 3 parcels, sizes
  // grading DOWN toward the hive/ring (t=0) and UP toward the reader corners.
  const BEE_STATIONS = [
    [0, 0.3], [0, 0.62], [0, 0.9], [1, 0.45], [1, 0.8],
    // the outer-left station moved 0.88 -> 0.76: at 0.88 it sat 28.7 px (2.8% of
    // w) off the skep's dome, under the brief's 3% floor. It now clears by 40 px.
    [2, 0.28], [2, 0.58], [2, 0.76], [3, 0.5], [3, 0.85],
  ]
  for (const [ri, t] of BEE_STATIONS) {
    const [x, y] = bez(ROUTES[ri], t)
    const sz = w * lerp(0.011, 0.024, t) * rr(r, 0.9, 1.1)
    s += flatBee(x, y + rr(r, -0.012, 0.012), sz, bezTan(ROUTES[ri], t) + rr(r, -14, 14), lerp(0.7, 0.95, t))
  }
  // ... and the outer-left letter 0.72 -> 0.66, for the same reason (34 -> 52 px).
  const LETTER_STATIONS = [[0, 0.48], [0, 0.76], [1, 0.62], [2, 0.42], [2, 0.66], [3, 0.68]]
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
    s += `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(R)}" ry="${fx(R * SQ)}" fill="${SWARM.gold}" opacity="0.14"/>`
    s += `<ellipse cx="${fx(cx + 1.5)}" cy="${fx(cy + 3)}" rx="${fx(R)}" ry="${fx(R * SQ)}" fill="none" stroke="${WALNUT}" stroke-width="3" opacity="0.2"/>`
    s += `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(R)}" ry="${fx(R * SQ)}" fill="none" stroke="${SWARM.amber}" stroke-width="3" opacity="0.85"/>`
    s += `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(R * 0.8)}" ry="${fx(R * 0.8 * SQ)}" fill="none" stroke="${SWARM.amber}" stroke-width="1.8" stroke-dasharray="5 6" opacity="0.7"/>`
    // cardinal + intercardinal ticks on the outer ring
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4
      const len = k % 2 === 0 ? 0.14 : 0.07
      s += `<line x1="${fx(cx + Math.cos(a) * R * (1 - len))}" y1="${fx(cy + Math.sin(a) * R * (1 - len) * SQ)}" x2="${fx(cx + Math.cos(a) * R * 1.06)}" y2="${fx(cy + Math.sin(a) * R * 1.06 * SQ)}" stroke="${SWARM.amber}" stroke-width="${k % 2 === 0 ? 3.2 : 2}" opacity="0.9"/>`
    }
    // the honeycomb heart: 7 tiny pointy-top hexes clustered at the center
    const hex = (hx, hy, hr) =>
      `<polygon points="${Array.from({ length: 6 }, (_, k) => {
        const a = Math.PI / 2 + (k * Math.PI) / 3
        return `${fx(hx + Math.cos(a) * hr)},${fx(hy + Math.sin(a) * hr * SQ)}`
      }).join(' ')}" fill="${SWARM.gold}" fill-opacity="0.3" stroke="${SWARM.amber}" stroke-width="2" opacity="0.9"/>`
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

  // ---- THE STRAW SKEP AND ITS SMOKER, reader apron lower-left
  // (T-COUNTERWEIGHT). The horseshoe's front gap is STORY — it is where the
  // keeper works — and the smoke wisp is what points at it.
  //
  // ROUND 2. Round 1 painted a keeper here instead: a slate robe under a gold
  // veil hat, drawn as a FRONT-VIEW STANDING FIGURE on a print the eye reads as
  // a FLOOR. The blind reader could not name it: "I cannot identify the dark
  // slate teardrop with the straw brim in the left foreground. Beekeeper from
  // behind? Mailbag? A brown rail passes straight through it and the green
  // meadow slab cuts it in half. It is a large, prominent foreground object and
  // it is unreadable." Three causes, all three fixed:
  //   * A standing figure cannot read on a floor print. It is replaced by a
  //     straw SKEP HIVE in the same lying-flat 3/4 projection the honeycomb
  //     compass rose already uses — stacked straw coils with an arched entrance,
  //     a domed silhouette and a cast shadow seating it on the page. A skep is
  //     also unambiguous where a robed figure was not: nothing else in the book
  //     is a bell of coiled straw with bees at a door in it.
  //   * The "brown rail" was ROUTES[2], which ran straight through him; that
  //     route is lifted (see its comment above) and the skep now has 47 px of
  //     clear page above it.
  //   * The 3D meadow fringe cut his lower half off. The fringe die spans
  //     |x| <= 0.6 and stands at z 0.50-0.56, so the whole vignette moved
  //     OUTBOARD and DOWNSTAGE of it, to radial 0.86 (clear laterally) and
  //     z 0.645 (clear in depth) — the reader apron, in front of everything.
  // Size is w*0.065, 1.25x round 1's w*0.052. Measured vignette extremes, all
  // inside the >= 2% margin: left x 0.079 w, bottom y 0.962 h (the cast shadow),
  // top y 0.800 h (the highest airborne bee), right x 0.512 w (the last smoke
  // puff, dying at the gutter where the horseshoe's front gap is). Note the
  // dome's base ELLIPSE hangs 0.41 S below the contact line — that, not the
  // shadow, is what nearly ran the vignette off the page at z 0.665.
  {
    const kx = PX(pageFX(0.86, 'left'))
    const ky = PY(pageFY(0.645)) // the skep's ground contact, not its centre
    const S = w * 0.065
    const SQ = 0.62 // lying-flat foreshortening — the print is a FLOOR
    // STRAW is the one value in this vignette that is not already in SWARM, and it
    // has to be: the page ground IS `SWARM.parch`, so a parch skep on a parch page
    // has no silhouette at all. It is that same hue held two steps deeper, and the
    // lit side is the palette's own cream.
    const STRAW = '#e0c98d'
    const STRAW_LIT = SWARM.cream
    // cast shadow, two plies, seating the skep on the page
    s += `<ellipse cx="${fx(kx + S * 0.14)}" cy="${fx(ky + S * 0.1)}" rx="${fx(S * 0.86)}" ry="${fx(S * 0.86 * SQ * 0.42)}" fill="${INK}" opacity="0.13"/>`
    s += `<ellipse cx="${fx(kx + S * 0.1)}" cy="${fx(ky + S * 0.1)}" rx="${fx(S * 0.72)}" ry="${fx(S * 0.72 * SQ * 0.42)}" fill="${INK}" opacity="0.15"/>`
    // the dome: a bell of straw closed along its foreshortened base ellipse
    const dome =
      `M ${fx(kx - S * 0.66)} ${fx(ky)} ` +
      `C ${fx(kx - S * 0.72)} ${fx(ky - S * 0.56)} ${fx(kx - S * 0.4)} ${fx(ky - S * 0.98)} ${fx(kx)} ${fx(ky - S * 0.98)} ` +
      `C ${fx(kx + S * 0.4)} ${fx(ky - S * 0.98)} ${fx(kx + S * 0.72)} ${fx(ky - S * 0.56)} ${fx(kx + S * 0.66)} ${fx(ky)} ` +
      `A ${fx(S * 0.66)} ${fx(S * 0.66 * SQ)} 0 0 1 ${fx(kx - S * 0.66)} ${fx(ky)} Z`
    s += `<path d="${dome}" fill="${STRAW}" stroke="${WALNUT}" stroke-width="2.4"/>`
    s += `<path d="M ${fx(kx - S * 0.62)} ${fx(ky - S * 0.06)} C ${fx(kx - S * 0.68)} ${fx(ky - S * 0.58)} ${fx(kx - S * 0.4)} ${fx(ky - S * 0.94)} ${fx(kx - S * 0.08)} ${fx(ky - S * 0.95)} L ${fx(kx - S * 0.22)} ${fx(ky - S * 0.2)} Z" fill="${STRAW_LIT}" opacity="0.6"/>` // lit side
    // the COILS: stacked straw ropes, each bowing forward, walnut-shadowed on
    // its underside and cream-lit on its crown — the cue that says "woven straw"
    for (let k = 1; k <= 8; k++) {
      const v = k / 9
      const cy2 = ky - S * 0.98 * v
      const hw = S * 0.66 * Math.sqrt(Math.max(0.05, 1 - Math.pow(v, 2.4)))
      s += `<path d="M ${fx(kx - hw)} ${fx(cy2)} Q ${fx(kx)} ${fx(cy2 + S * 0.1)} ${fx(kx + hw)} ${fx(cy2)}" fill="none" stroke="${WALNUT}" stroke-width="${fx(S * 0.042)}" opacity="0.38"/>`
      s += `<path d="M ${fx(kx - hw * 0.94)} ${fx(cy2 - S * 0.035)} Q ${fx(kx)} ${fx(cy2 + S * 0.065)} ${fx(kx + hw * 0.94)} ${fx(cy2 - S * 0.035)}" fill="none" stroke="${STRAW_LIT}" stroke-width="${fx(S * 0.03)}" opacity="0.5"/>`
    }
    // the crown knot the coiling finishes on
    s += `<ellipse cx="${fx(kx)}" cy="${fx(ky - S * 0.99)}" rx="${fx(S * 0.11)}" ry="${fx(S * 0.07)}" fill="${STRAW_LIT}" stroke="${WALNUT}" stroke-width="1.8"/>`
    s += `<line x1="${fx(kx - S * 0.07)}" y1="${fx(ky - S * 1.0)}" x2="${fx(kx + S * 0.07)}" y2="${fx(ky - S * 0.98)}" stroke="${WALNUT}" stroke-width="1.6" opacity="0.7"/>`
    // the arched ENTRANCE at the front — the second unambiguous skep cue
    const door = `M ${fx(kx - S * 0.13)} ${fx(ky + S * 0.11)} L ${fx(kx - S * 0.13)} ${fx(ky - S * 0.04)} Q ${fx(kx)} ${fx(ky - S * 0.2)} ${fx(kx + S * 0.13)} ${fx(ky - S * 0.04)} L ${fx(kx + S * 0.13)} ${fx(ky + S * 0.11)} Z`
    s += `<path d="${door}" fill="${WALNUT}"/>`
    s += `<path d="M ${fx(kx - S * 0.09)} ${fx(ky + S * 0.09)} L ${fx(kx - S * 0.09)} ${fx(ky - S * 0.03)} Q ${fx(kx)} ${fx(ky - S * 0.15)} ${fx(kx + S * 0.09)} ${fx(ky - S * 0.03)} L ${fx(kx + S * 0.09)} ${fx(ky + S * 0.09)} Z" fill="${INK}" opacity="0.72"/>`
    s += `<ellipse cx="${fx(kx)}" cy="${fx(ky + S * 0.13)}" rx="${fx(S * 0.2)}" ry="${fx(S * 0.05)}" fill="${SWARM.amber}" opacity="0.35"/>` // the worn alighting board
    // ---- THE SMOKER, LYING beside the skep in top view: two amber boards
    // pinched around a cream pleat with a dark nozzle, the same three parts as
    // round 1's bellows but flat on the page instead of held by a figure.
    const bx = kx + S * 1.42
    const by = ky - S * 0.04
    s += `<ellipse cx="${fx(bx + S * 0.06)}" cy="${fx(by + S * 0.2)}" rx="${fx(S * 0.56)}" ry="${fx(S * 0.16)}" fill="${INK}" opacity="0.16"/>`
    s += `<path d="M ${fx(bx - S * 0.44)} ${fx(by - S * 0.05)} Q ${fx(bx + S * 0.02)} ${fx(by - S * 0.3)} ${fx(bx + S * 0.44)} ${fx(by - S * 0.11)} L ${fx(bx + S * 0.42)} ${fx(by - S * 0.02)} Q ${fx(bx + S * 0.02)} ${fx(by - S * 0.16)} ${fx(bx - S * 0.46)} ${fx(by + S * 0.03)} Z" fill="${SWARM.amber}" stroke="${WALNUT}" stroke-width="1.6"/>`
    s += `<path d="M ${fx(bx - S * 0.46)} ${fx(by + S * 0.03)} Q ${fx(bx + S * 0.02)} ${fx(by - S * 0.12)} ${fx(bx + S * 0.42)} ${fx(by + S * 0.02)} L ${fx(bx + S * 0.4)} ${fx(by + S * 0.1)} Q ${fx(bx + S * 0.02)} ${fx(by + S * 0.02)} ${fx(bx - S * 0.44)} ${fx(by + S * 0.16)} Z" fill="${SWARM.cream}" stroke="${WALNUT}" stroke-width="1.4"/>` // the pleat
    for (const pv of [-0.2, 0, 0.2])
      s += `<line x1="${fx(bx + S * pv)}" y1="${fx(by + S * 0.02)}" x2="${fx(bx + S * (pv - 0.03))}" y2="${fx(by + S * 0.12)}" stroke="${WALNUT}" stroke-width="1.2" opacity="0.55"/>`
    s += `<path d="M ${fx(bx - S * 0.44)} ${fx(by + S * 0.16)} Q ${fx(bx + S * 0.02)} ${fx(by + S * 0.04)} ${fx(bx + S * 0.4)} ${fx(by + S * 0.1)} L ${fx(bx + S * 0.36)} ${fx(by + S * 0.2)} Q ${fx(bx + S * 0.02)} ${fx(by + S * 0.16)} ${fx(bx - S * 0.4)} ${fx(by + S * 0.26)} Z" fill="${SWARM.amber}" stroke="${WALNUT}" stroke-width="1.6"/>`
    s += `<path d="M ${fx(bx + S * 0.42)} ${fx(by - S * 0.09)} L ${fx(bx + S * 0.86)} ${fx(by - S * 0.05)} L ${fx(bx + S * 0.84)} ${fx(by + S * 0.04)} L ${fx(bx + S * 0.4)} ${fx(by + S * 0.09)} Z" fill="${SWARM.slateDeep}" stroke="${WALNUT}" stroke-width="1.3"/>` // nozzle
    // the smoke: a thin curling wisp RISING toward the horseshoe's front gap at
    // the gutter, dying in three thinning puffs just short of it
    const smoke =
      `M ${fx(bx + S * 0.84)} ${fx(by - S * 0.04)} ` +
      `c ${fx(S * 0.46)} ${fx(-S * 0.4)} ${fx(S * 0.66)} ${fx(S * 0.1)} ${fx(S * 1.05)} ${fx(-S * 0.24)} ` +
      `c ${fx(S * 0.42)} ${fx(-S * 0.34)} ${fx(S * 0.6)} ${fx(S * 0.12)} ${fx(S * 1.0)} ${fx(-S * 0.32)} ` +
      `c ${fx(S * 0.44)} ${fx(-S * 0.3)} ${fx(S * 0.8)} ${fx(S * 0.04)} ${fx(S * 1.01)} ${fx(-S * 0.4)}`
    // Held DELIBERATELY faint. The first cut of this repaint carried it over from
    // round 1 at 8.7 px of near-white at 0.75 opacity — but round 1's wisp ran along
    // y 0.87 h where the meadow wash is thin, and out here at y 0.83-0.88 h over
    // the full-strength wash that same stroke measured as the highest-contrast
    // mark in the entire print: a white rope crossing a third of the page, which
    // would have out-read the skep it belongs to. Warmed onto the palette and
    // dropped to the palette cream at 6 px / 0.5, its walnut under-copy drawing it.
    s += `<path d="${smoke}" fill="none" stroke="${SWARM.cream}" stroke-width="${fx(S * 0.09)}" stroke-linecap="round" opacity="0.5"/>`
    s += `<path d="${smoke}" fill="none" stroke="${WALNUT}" stroke-width="1.2" opacity="0.3"/>`
    for (const [px2, py2, pr] of [[4.05, -1.02, 0.13], [4.22, -1.1, 0.085], [4.36, -1.18, 0.055]])
      s += `<circle cx="${fx(bx + S * px2)}" cy="${fx(by + S * py2)}" r="${fx(S * pr)}" fill="${SWARM.cream}" opacity="0.42"/>`
    // bees AT the door and in the air over the skep — the third cue, and the one
    // that makes the dome a hive rather than a basket
    for (const [dx2, dy2, sz2, a2] of [[-0.3, 0.02, 0.011, 14], [0.34, 0.08, 0.0102, -162]])
      s += flatBee((kx + S * dx2) / w, (ky + S * dy2) / h, w * sz2, a2, 0.95)
    for (const [dx2, dy2, sz2, a2] of [[-0.56, -1.1, 0.0122, -32], [0.3, -1.22, 0.0112, 26], [0.8, -0.88, 0.0104, -12]])
      s += flatBee((kx + S * dx2) / w, (ky + S * dy2) / h, w * sz2, a2, 0.9)
  }

  // ---- AFFORDANCE TRAIL to the STIR tab: the die-cut tab carries its own
  // lettering, so the print POINTS — a dashed amber bee-loop curling out of the
  // compass yard and RUNNING OUT at the tab's inboard edge.
  //
  // ROUND 2 RE-AIM. The tab used to start at radial 1.0, so the trail put its
  // arrowhead exactly there, ON the tab's inboard edge. The rebuilt tab occupies
  // radial 0.82 -> 1.12 x z 0.14 -> 0.46 and is page-flat, lifted only 0.003, so
  // that arrowhead and the last third of the loop ended up UNDERNEATH the die:
  // invisible, while the visible remainder appeared to stop in mid-air short of
  // the tab. Every control point is now held at radial <= 0.785, which bounds the
  // whole curve inside radial 0.785 by the convex-hull property — 16 px of clear
  // page inboard of the die's edge, measured.
  // AND IT GOES OVER THE DIAL'S SHOULDER, not past its outboard rim. Measured: the
  // honeycomb compass dial is an ellipse at image (789, 524) with rx 84 / ry 57, so
  // its rightmost point is x 873 and the tab's inboard edge is x 877 — a FOUR-pixel
  // gap. There is no outboard corridor between them, and the first cut of this
  // re-aim drove the dashed loop straight through the dial, where it was
  // indistinguishable from the dial's own dashed inner ring. The clear lane is the
  // band just ABOVE the dial's crown (y 440-478, x 788-873): route 1 runs 15-58 px
  // higher, route 0 runs 75 px lower, and the dial's crown is at y 467.
  {
    const T = [[0.62, 0.24], [0.69, 0.213], [0.75, 0.285], [0.785, 0.299]]
    const tX = (radial) => PX(pageFX(radial, 'right'))
    const tY = (z) => PY(pageFY(z))
    const d =
      `M ${fx(tX(T[0][0]))} ${fx(tY(T[0][1]))} C ${fx(tX(T[1][0]))} ${fx(tY(T[1][1]))} ` +
      `${fx(tX(T[2][0]))} ${fx(tY(T[2][1]))} ${fx(tX(T[3][0]))} ${fx(tY(T[3][1]))}`
    s += `<path d="${d}" fill="none" stroke="${SWARM.amber}" stroke-width="2.4" stroke-dasharray="8 7" opacity="0.8"/>`
    // the arrowhead sits ON the end point with its barbs trailing BEHIND it, so
    // the mark's outboard tip is the 0.785 bound rather than overshooting it
    const ta = (Math.atan2(tY(T[3][1]) - tY(T[2][1]), tX(T[3][0]) - tX(T[2][0])) * 180) / Math.PI
    const ah = w * 0.016
    s += `<g transform="translate(${fx(tX(T[3][0]))} ${fx(tY(T[3][1]))}) rotate(${fx(ta)})">` +
      `<path d="M 0 0 L ${fx(-ah * 1.5)} ${fx(-ah * 0.52)} L ${fx(-ah * 1.12)} 0 L ${fx(-ah * 1.5)} ${fx(ah * 0.52)} Z" fill="${SWARM.amber}" opacity="0.9"/></g>`
  }

  s += `<rect width="${w}" height="${h}" fill="url(#pageVig3)"/>`
  s += `</g>`

  const defs =
    `<linearGradient id="meadowWash" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${SWARM.meadow}" stop-opacity="0"/>` +
    `<stop offset="0.55" stop-color="${SWARM.meadow}" stop-opacity="0.26"/>` +
    `<stop offset="1" stop-color="${SWARM.meadow}" stop-opacity="0.46"/></linearGradient>` +
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
  // ---- Spread 3 — THE CARRIER SWARM (E3 s3): the swarmarc sprite atlas, the
  // crown accent trio's two new bees, the cloud interleave, the fringe chains.
  // Pixel dims at each piece's true mesh aspect (content.ts), slivers <= 512.
  // The three E3 s3 REPAINTS the build lane left standing on E1-era imported
  // art (pack §4d). Pixel dims at each piece's true mesh aspect (content.ts):
  // hero 0.51/0.89, backdrop 1.65/0.94.
  { id: 'ch2-hero', seed: 30220, w: 587, h: 1024, grain: 10, paint() { return apprenticeGlass(this.w, this.h, this.seed) } },
  { id: 'ch2-backdrop', seed: 30221, w: 1024, h: 583, grain: 12, paint() { return zurichVista(this.w, this.h, this.seed) } },
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
  // (ch4-hoard-deck retired with the ch4-hoard platform — see content.ts.)
  { id: 'ch4-goldpile-face', seed: 50230, w: 900, h: 900, grain: 14, paint() { return goldHeap(this.w, this.h, this.seed) } },
  // the pull-tab DISSOLVE: dunes (A) and gold (B) share one composition (matching
  // ridgelines) so the venetian flip transmutes desert -> hoard. Aspect w:h =
  // (d1-d0):(z1-z0) = 0.52:0.40 ~ 1.30:1; sliced into 6 vertical slat strips.
  { id: 'ch4-dissolve-dunes', seed: 50240, w: 1024, h: 788, grain: 12, paint() { return dissolveDunes(this.w, this.h, this.seed) } },
  { id: 'ch4-dissolve-gold', seed: 50241, w: 1024, h: 788, grain: 12, paint() { return dissolveGold(this.w, this.h, this.seed) } },
  // ---- Spread 6 — THE BAZAAR (E3 s6 rebuild, scenes/s6-scene-pack.md §4f).
  // The D-series stall/goods/arch painters retired with their pieces. Every
  // aspect below equals its mesh face exactly (city 1.9/0.66; plates 0.8/0.55
  // and 0.68/0.24; box faces 2a x depth/height; figures their layer w/h). The
  // arc faces + souk strips ride bazaar-atlas-s6, throng + tea ride
  // figure-atlas-s6 (the sprite-consuming families); the rest stay loose. ----
  { id: 'ch5-city', seed: 60400, w: 1024, h: 356, grain: 14, paint() { return bazCity(this.w, this.h, this.seed) } },
  { id: 'ch5-pigeon-a', seed: 60410, w: 256, h: 128, grain: 8, paint() { return bazPigeon(this.w, this.h, this.seed, 1) } },
  { id: 'ch5-pigeon-b', seed: 60411, w: 232, h: 116, grain: 8, paint() { return bazPigeon(this.w, this.h, this.seed, -1) } },
  { id: 'ch5-arc-rear-arc-front', seed: 60420, w: 1024, h: 704, grain: 14, paint() { return bazArcPlate(this.w, this.h, this.seed, 'rear') } },
  { id: 'ch5-arc-rear-arc-side', seed: 60421, w: 256, h: 198, grain: 10, paint() { return bazCourses(this.w, this.h, this.seed, BAZ.rose, BAZ.roseLit) } },
  { id: 'ch5-arc-rear-arc-back', seed: 60422, w: 512, h: 109, grain: 10, paint() { return bazCourses(this.w, this.h, this.seed, BAZ.roseDim, BAZ.rose) } },
  { id: 'ch5-arc-rear-arc-top', seed: 60423, w: 512, h: 141, grain: 10, paint() { return bazAwningTopFace(this.w, this.h, this.seed) } },
  { id: 'ch5-arc-inner-arc-front', seed: 60430, w: 1020, h: 360, grain: 14, paint() { return bazArcPlate(this.w, this.h, this.seed, 'inner') } },
  { id: 'ch5-arc-inner-arc-side', seed: 60431, w: 256, h: 192, grain: 10, paint() { return bazCourses(this.w, this.h, this.seed, BAZ.rose, BAZ.roseLit) } },
  { id: 'ch5-arc-inner-arc-back', seed: 60432, w: 512, h: 90, grain: 10, paint() { return bazCourses(this.w, this.h, this.seed, BAZ.roseDim, BAZ.rose) } },
  { id: 'ch5-arc-inner-arc-top', seed: 60433, w: 512, h: 120, grain: 10, paint() { return bazAwningTopFace(this.w, this.h, this.seed) } },
  { id: 'ch5-tread-mid-top', seed: 60440, w: 512, h: 111, grain: 12, paint() { return bazTreadTop(this.w, this.h, this.seed, true) } },
  { id: 'ch5-tread-mid-front', seed: 60441, w: 512, h: 73, grain: 10, paint() { return bazTreadFront(this.w, this.h, this.seed, 9) } },
  { id: 'ch5-tread-mid-side', seed: 60442, w: 192, h: 126, grain: 10, paint() { return bazCourses(this.w, this.h, this.seed, BAZ.sand, BAZ.sandLit) } },
  { id: 'ch5-tread-mid-back', seed: 60443, w: 512, h: 73, grain: 10, paint() { return bazCourses(this.w, this.h, this.seed, BAZ.sandDim, BAZ.sand) } },
  { id: 'ch5-tread-low-top', seed: 60444, w: 512, h: 118, grain: 12, paint() { return bazTreadTop(this.w, this.h, this.seed, false) } },
  { id: 'ch5-tread-low-front', seed: 60445, w: 512, h: 44, grain: 10, paint() { return bazTreadFront(this.w, this.h, this.seed, 11) } },
  { id: 'ch5-tread-low-side', seed: 60446, w: 192, h: 72, grain: 10, paint() { return bazCourses(this.w, this.h, this.seed, BAZ.sand, BAZ.sandLit) } },
  { id: 'ch5-tread-low-back', seed: 60447, w: 512, h: 44, grain: 10, paint() { return bazCourses(this.w, this.h, this.seed, BAZ.sandDim, BAZ.sand) } },
  { id: 'ch5-crowd-mid', seed: 60450, w: 512, h: 105, grain: 10, paint() { return bazFigureRank(this.w, this.h, this.seed, { count: 6, basketAt: 2 }) } },
  { id: 'ch5-crowd-low', seed: 60451, w: 512, h: 107, grain: 10, paint() { return bazFigureRank(this.w, this.h, this.seed, { count: 5, basketAt: 3 }) } },
  // ch5-throng STOPS being an 8-shopper crowd: the scene lane turned it into the
  // spread's playable, a linked rank of six IDENTICAL stalls the reader drags
  // upright. New mesh 0.6 x 0.2 world -> 512x171.
  { id: 'ch5-throng', seed: 60452, w: 512, h: 171, grain: 10, paint() { return bazStallRank(this.w, this.h, this.seed, { count: 6 }) } },
  { id: 'ch5-tea', seed: 60453, w: 256, h: 293, grain: 10, paint() { return bazTeaCorner(this.w, this.h, this.seed) } },
  { id: 'ch5-raise-stall-face', seed: 60460, w: 512, h: 1024, grain: 12, paint() { return bazRaiseStallFace(this.w, this.h, this.seed) } },
  // The tabpiece's own PULL TAB art (the engine requests `<id>-tab` and falls
  // back to the shared grey grip when it is absent — reader finding BW-13).
  // Aspect is the tab's quad: 0.1 world across the spine by 0.20 along the pull.
  // Atlas-exempt like every other tab strip.
  { id: 'ch5-raise-stall-tab', seed: 60461, w: 128, h: 256, grain: 10, paint() { return bazRaiseStallTab(this.w, this.h, this.seed) } },
  { id: 'page-6', seed: 60470, w: 1024, h: 683, grain: 10, paint() { return bazaarFloorSpread(this.w, this.h, this.seed) } },
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
  // THE RAVEN CITY (E3 s4 round-4). `storeys` are the SAME panel lengths and
  // `spans` the SAME per-node [radius, width] pairs content.ts hands the solver,
  // root first, so every fold the painter draws lands on a crease the paper
  // actually folds along and every trapezoid edge is the die the mesh samples.
  // Pixel dims are the chain's true aspect (extent / length) at a 1024 LONG
  // edge — whichever side that is: 0.301/1.045 -> 295x1024, 0.315/0.625 ->
  // 516x1024, and 0.31/0.30 -> 1024x991, the one piece here that is wider than
  // it is tall. ROUND 4b re-derived the right page around VISIBILITY (the
  // dispatch line grew to 0.625 of chain and the roosts dropped to 0.30 so the
  // cable flies clear of the roofs), and both of those pieces are re-authored
  // at the sub-rects the mesh now samples.
  { id: 'ch3-tower', seed: 40360, w: 295, h: 1024, grain: 12, paint() { return crookedColossus({ w: this.w, h: this.h, seed: this.seed, storeys: [0.301206, 0.221294, 0.28174, 0.24076], spans: [[0.42, 0.3], [0.445, 0.276], [0.425, 0.2613], [0.45, 0.2274], [0.44, 0.2031]] }) } },
  // the cable panel is MOSTLY TRANSPARENT — grain 6, because the house grain
  // pass floors every non-transparent pixel and this sheet's whole job is to
  // have almost none. `cable` is the content.ts node list, unmodified.
  { id: 'ch3-dispatch-line', seed: 40362, w: 516, h: 1024, grain: 6, paint() { return dispatchCablePanel({ w: this.w, h: this.h, seed: this.seed, cable: [[0, 0.965], [0.12, 0.894], [0.25, 0.822], [0.38, 0.752], [0.5, 0.692], [0.62, 0.635], [0.74, 0.584], [0.86, 0.535], [1, 0.48]], baskets: [0.2, 0.47, 0.72] }) } },
  { id: 'ch3-dispatch-line-basket', seed: 40363, w: 256, h: 256, grain: 8, paint() { return readerBasket(this.w, this.h, this.seed) } },
  { id: 'ch3-terrace', seed: 40361, w: 1024, h: 991, grain: 12, paint() { return terracedRoosts({ w: this.w, h: this.h, seed: this.seed, storeys: [0.0773, 0.0653, 0.06, 0.0514, 0.046], spans: [[0.42, 0.31], [0.425, 0.3], [0.44, 0.285], [0.45, 0.265], [0.47, 0.24], [0.485, 0.215]] }) } },
  { id: 'page-4', seed: 40350, w: 1024, h: 683, grain: 10, paint() { return postRoadSpread(this.w, this.h, this.seed) } },
  // ---- Spread 4 — THE TOWER-HOIST WINCH + THE DISPATCH DESK (wave 2). Six ids
  // that used to arrive as hand-delivered PNGs through prepare-art and are now
  // procedural; their PAD_TO_ASPECT / ROTATE entries there are removed, so a
  // re-added source PNG can no longer silently overwrite these bakes. Every
  // pixel dim below is the quad's TRUE mesh aspect, derived in the block header
  // above from popup-keepwinch.ts / popup-keepstack.ts and the layers' uv
  // tables — a wrong aspect here is a stretch the mesh cannot undo.
  //
  // disc     square 2*discR 0.26                              -> 1.000  640x640
  // mast     0.039 / (1.05 - 0.5468)                           -> 0.0775  80x1032
  // flag     0.039 / armLen 0.1287            (= 10/33 exact)  -> 0.3030 200x660
  // board    0.56*0.18 / bladeLen 0.10        (= 126/125)      -> 1.008  630x625
  // weight   2*CW_BW / 2*CW_BH                                 -> 0.6325 405x640
  // desk     2*halfW 0.52 / z-span 0.28       (= 13/7 exact)   -> 1.857  910x490
  { id: 'ch3-keep-winch-disc', seed: 40370, w: 640, h: 640, grain: 10, paint() { return crankWheel(this.w, this.h, this.seed) } },
  // The mast and the flag are MOSTLY TRANSPARENT slivers (a lattice post and a
  // pennant), so they take the low grain the cable panel takes: the house grain
  // pass floors every non-transparent pixel, and on a piece whose whole job is to
  // have almost none, a normal dose prints as haze around the rigging.
  { id: 'ch3-keep-winch-mast', seed: 40371, w: 80, h: 1032, grain: 6, paint() { return signalMast(this.w, this.h, this.seed) } },
  { id: 'ch3-keep-winch-semaphore', seed: 40372, w: 200, h: 660, grain: 6, paint() { return signalFlag(this.w, this.h, this.seed) } },
  { id: 'ch3-keep-winch-iris', seed: 40373, w: 630, h: 625, grain: 12, paint() { return dispatchBoard(this.w, this.h, this.seed) } },
  { id: 'ch3-keep-winch-counterweight', seed: 40374, w: 405, h: 640, grain: 10, paint() { return sashWeight(this.w, this.h, this.seed) } },
  { id: 'ch3-keep-balcony', seed: 40375, w: 910, h: 490, grain: 10, paint() { return dispatchDesk(this.w, this.h, this.seed) } },
  // ---- Spread 7 — the Northern Treasury (ch6, northern aurora/teal/gold) ----
  { id: 'ch6-strongbox-front', seed: 70201, w: 512, h: 270, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'front', 'strongbox') } },
  { id: 'ch6-strongbox-back', seed: 70202, w: 512, h: 270, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'back', 'strongbox') } },
  { id: 'ch6-strongbox-side', seed: 70203, w: 512, h: 427, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'side', 'strongbox') } },
  { id: 'ch6-strongbox-top', seed: 70204, w: 512, h: 323, grain: 12, paint() { return boxFace(this.w, this.h, this.seed, 'top', 'strongbox') } },
  { id: 'ch6-strongbox-seal', seed: 70210, w: 420, h: 420, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'waxSealN') } },
  { id: 'ch6-strongbox-coins', seed: 70211, w: 512, h: 256, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'mintedCoins') } },
  // ---- E3 s7 nave (the treasury interior; the exterior dress bakes are
  // retired with their pieces). Pixel dims at each rank's true mesh aspect,
  // ~500px/world (pack §4e atlas layout); band fractions derive from the
  // content.ts rank numbers (aperture, strata bands, crown wings).
  { id: 'ch6-nave-a', seed: 70300, w: 950, h: 310, grain: 11, paint() { return naveApseFace(this.w, this.h, this.seed) } },
  { id: 'ch6-nave-b', seed: 70301, w: 760, h: 260, grain: 11, paint() { return naveRankFace(this.w, this.h, this.seed, NAVE_RANKS['ch6-nave-b']) } },
  { id: 'ch6-nave-c', seed: 70302, w: 580, h: 220, grain: 11, paint() { return naveRankFace(this.w, this.h, this.seed, NAVE_RANKS['ch6-nave-c']) } },
  { id: 'ch6-nave-d', seed: 70303, w: 400, h: 185, grain: 11, paint() { return naveRankFace(this.w, this.h, this.seed, NAVE_RANKS['ch6-nave-d']) } },
  { id: 'ch6-clerk', seed: 70304, w: 200, h: 250, grain: 10, paint() { return naveClerk(this.w, this.h, this.seed) } },
  // T4 print-backs (tiny): flat shaded paper carrying the same die alpha.
  { id: 'ch6-nave-a-back', seed: 70305, w: 190, h: 62, grain: 6, paint() { return naveApseBack(this.w, this.h) } },
  { id: 'ch6-nave-b-back', seed: 70306, w: 152, h: 52, grain: 6, paint() { return naveRankBack(this.w, this.h, { apHw: 0.1316, apApex: 0.7308 }) } },
  { id: 'ch6-nave-c-back', seed: 70307, w: 116, h: 44, grain: 6, paint() { return naveRankBack(this.w, this.h, { apHw: 0.2069, apApex: 0.7273 }) } },
  { id: 'ch6-nave-d-back', seed: 70308, w: 80, h: 37, grain: 6, paint() { return naveRankBack(this.w, this.h, { apHw: 0.359, apApex: 0.7222 }) } },
  { id: 'page-7', seed: 70310, w: 1024, h: 683, grain: 10, paint() { return navePage(this.w, this.h, this.seed) } },
  { id: 'ch6-crest', seed: 70230, w: 460, h: 409, grain: 10, paint() { return dressPatch(this.w, this.h, this.seed, 'griffin') } },
  { id: 'ch6-steps-deck', seed: 70240, w: 1024, h: 330, grain: 14, paint() { return deckSurface(this.w, this.h, this.seed, 'glass') } },
  { id: 'ch6-steps-strut', seed: 70241, w: 512, h: 256, grain: 12, paint() { return naveStepRiser(this.w, this.h, this.seed) } },
  // s7 PLAYABLE (G4): the treasure coffer — interior board + one teal-steel lid.
  { id: 'ch6-coffer-board', seed: 70260, w: 576, h: 480, grain: 12, paint() { return cofferInterior(this.w, this.h, this.seed) } },
  { id: 'ch6-coffer-door1', seed: 70261, w: 512, h: 486, grain: 12, paint() { return cofferLid(this.w, this.h, this.seed) } },
]

// The SIX legacy skyline mound slots, one strip each. Dims are the TRUE mesh
// aspect = row.width / row.height, read straight from content.ts ch3-skyline-l/r
// rows (2026-07-24). Seeds are chosen so cross-gutter pairs (l-mound0 vs
// r-mound0, ...) differ in parity, so no two symmetric slots read as near
// duplicates; `towers` varies the facade-block count per slot.
// E3 s4 ROUND-3: the six legacy flank rows are RETIRED, and ROUND-4 retires the
// cliffs that replaced them along with the whole mirror. What stands on spread 4
// now is THE RAVEN CITY (PIECES `ch3-tower` / `ch3-dispatch-line` /
// `ch3-terrace`); ch3-skyline-r is gone entirely.
const SLOTS = []

// The THREE new ring rows (s4 pack §4a A/B). They slot into the same
// `<layerId>-mound<k>` scheme and bake through the same shaped-mesh path, but
// carry the ring variants and their own pixel dims. Kept in a SEPARATE array
// because SLOTS is the procart bench's iteration set and its ROWS table only
// covers the six legacy ids.
const RING_SLOTS = [
  // THE YARD WALL — all that survives of the ring (E3 s4 round-3): the left
  // page's lamplit gate wall where the post-road enters the court. It is now
  // ch3-skyline-l's ONLY row, so its id moves from `-mound4` to `-mound0`; the
  // seed is unchanged, so the painting itself is byte-identical.
  { id: 'ch3-skyline-l-mound0', w: 0.19, h: 0.1, W: 972, H: 512, seed: 10020, variant: 'ringFront', blocks: 5 },
]

// E3 s6 — the SOUK WINGS (ch5-souk-{l,r}-mound{0,1}): the bazaar's stall arcs
// continued to both page edges. Shaped-mesh bakes like the s4 flank rows, but
// painted by the bazaar's own soukRow painter (slot.art hook) so the awning
// stripe cadence registers with the arc plates (pack risk 4: the plate/souk
// seam is bridged by MATCHED paint, not by paper). Right wings mirror left.
const S6_SOUK_SLOTS = [
  { id: 'ch5-souk-l-mound0', w: 0.24, h: 0.1, seed: 60310, art(W, H) { return soukRow({ seed: this.seed, w: W, h: H, row: 0, mirror: false }) } },
  { id: 'ch5-souk-l-mound1', w: 0.2, h: 0.08, seed: 60311, art(W, H) { return soukRow({ seed: this.seed, w: W, h: H, row: 1, mirror: false }) } },
  { id: 'ch5-souk-r-mound0', w: 0.24, h: 0.1, seed: 60313, art(W, H) { return soukRow({ seed: this.seed, w: W, h: H, row: 0, mirror: true }) } },
  { id: 'ch5-souk-r-mound1', w: 0.2, h: 0.08, seed: 60314, art(W, H) { return soukRow({ seed: this.seed, w: W, h: H, row: 1, mirror: true }) } },
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
  // A slot may bring its own {outline, svg} painter (the s6 souk rows);
  // the default stays the s4 dovecote facade, byte-identical.
  const art = slot.art
    ? slot.art(W, H)
    : dovecoteFacade({
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
    //
    // `dusk: true` marks a HAND-PAINTED plate that needs the dispatch-hour grade
    // applied at pack time (see duskGradeKeepPlate). The spire members are left
    // off the list because they are procedural and already painted at night by
    // spireMember; grading them twice would only mud them. The balcony desk is
    // also left off: it is a lamplit reading surface, i.e. it is meant to be the
    // brightest warm island on the tier.
    regions: [
      { id: 'ch3-keep-hall-front', w: 896, opaque: false, dusk: true },
      { id: 'ch3-keep-gallery-front', w: 830, opaque: false, dusk: true },
      { id: 'ch3-keep-loft-front', w: 700, opaque: false, dusk: true },
      { id: 'ch3-keep-spire-m0', h: 280, opaque: false },
      { id: 'ch3-keep-spire-m1', h: 280, opaque: false },
      { id: 'ch3-keep-spire-m2', h: 280, opaque: false },
      // The balcony deck and the loft's arched side are DIE-CUT art (21% / 28%
      // of their pixels are fully transparent — the deck's shaped desk and the
      // loft's open arch). Flattening them would print an opaque rectangle where
      // the void belongs, so they keep their alpha; alphaTest 0.1 cuts them
      // exactly as it does today. Every genuinely solid face below is flattened.
      { id: 'ch3-keep-balcony', w: 256, opaque: false },
      { id: 'ch3-keep-raven', w: 128, opaque: false, dusk: true },
      { id: 'ch3-keep-loft-side', w: 96, opaque: false, dusk: true },
      { id: 'ch3-keep-hall-side', w: 96, opaque: true, dusk: true },
      { id: 'ch3-keep-gallery-side', w: 96, opaque: true, dusk: true },
      { id: 'ch3-keep-hall-back', w: 64, opaque: true, dusk: true },
      { id: 'ch3-keep-gallery-back', w: 64, opaque: true, dusk: true },
      { id: 'ch3-keep-loft-back', w: 64, opaque: true, dusk: true },
      { id: 'ch3-keep-hall-top', w: 64, opaque: true, dusk: true },
      { id: 'ch3-keep-gallery-top', w: 64, opaque: true, dusk: true },
      { id: 'ch3-keep-loft-top', w: 64, opaque: true, dusk: true },
    ],
  },
  {
    id: 'flank-atlas-s4',
    // E3 s4 ROUND-3: nine skyline strips down to one. What is left to share a
    // page is the surviving yard wall and the gatehouse tower — the cliffs
    // themselves are tall single pieces and carry their own textures.
    //
    // INFRA-2 fills the other 85% of the page with the TOWER-HOIST WINCH's four
    // pieces and the foreground fringe. The winch is what stood between spread 4
    // and the 8-file budget: its disc + three output bodies were four separate
    // uploads for one mechanism, and the page they now share was already paid
    // for. The keep's own faces stay on keep-atlas-s4 — that page belongs to a
    // MERGED single-material mesh and must carry every keep id or nothing.
    regions: [
      // (ch3-skyline-l-mound0 + ch3-ring-tower regions removed — both pieces
      // retired with the cliffs when the raven city took spread 4; no renderer
      // addresses them, and the INFRA-2 guard rightly refuses dead freight.)
      { id: 'ch3-fringe', w: 620, opaque: false },
      // WAVE-2: the disc region goes 300 -> 460. It carries the only WORD on the
      // spread (the HOIST maker's plate that closes finding S4-1), and a 640px art
      // packed at 300 threw away half that label's texels before the GPU saw it —
      // on the one piece where legibility IS the requirement. The page has the
      // room (it was at 42.5% occupancy), so this is texels moved to where they
      // are read, not texels added.
      { id: 'ch3-keep-winch-disc', w: 460, opaque: false },
      { id: 'ch3-keep-winch-semaphore', h: 420, opaque: false },
      { id: 'ch3-keep-winch-iris', h: 420, opaque: false },
      { id: 'ch3-keep-winch-counterweight', h: 300, opaque: false },
      // WAVE-2: the signal MAST joins its own mechanism's page. It is the
      // thinnest region on any atlas — 0.0775 aspect, so h 420 buys a 33px-wide
      // strip — and that is already ~2.7x the 12 screen px the post projects.
      // Without it the winch would be five ids on the page plus one loose webp,
      // i.e. a sixth upload for the piece that costs the fewest texels.
      { id: 'ch3-keep-winch-mast', h: 420, opaque: false },
    ],
  },
  {
    id: 'nave-atlas-s7',
    // ONE page for the whole nave + the clerk (pack §4e): the four rank
    // faces at ~500px/world, the clerk beside rank B's shelf. Every region
    // keeps alpha (die-cut apertures, the dome scallop, the figure).
    regions: [
      { id: 'ch6-nave-a', w: 950, opaque: false },
      { id: 'ch6-nave-b', w: 760, opaque: false },
      { id: 'ch6-nave-c', w: 580, opaque: false },
      { id: 'ch6-nave-d', w: 400, opaque: false },
      { id: 'ch6-clerk', w: 200, opaque: false },
      // T4 print-back tints — same page so the merged mesh's back-face
      // quads stay inside the ONE texture upload (zero extra draws).
      { id: 'ch6-nave-a-back', w: 190, opaque: false },
      { id: 'ch6-nave-b-back', w: 152, opaque: false },
      { id: 'ch6-nave-c-back', w: 116, opaque: false },
      { id: 'ch6-nave-d-back', w: 80, opaque: false },
    ],
  },
  {
    // E3 s6 ATLAS-A — the bazaar's ARCHITECTURE (pack §4f). Both stall-arc
    // keepstacks' full face sets (the merged keepstack mesh needs EVERY id of
    // a keep on one page or it falls back to per-face draws) plus the four
    // souk wing strips: two merged arc meshes + the skyline sprites, one
    // texture upload for the whole built bazaar.
    id: 'bazaar-atlas-s6',
    regions: [
      { id: 'ch5-arc-rear-arc-front', w: 880, opaque: false }, // die-cut plate
      { id: 'ch5-arc-inner-arc-front', w: 820, opaque: false }, // die-cut plate
      { id: 'ch5-arc-rear-arc-top', w: 256, opaque: true },
      { id: 'ch5-arc-inner-arc-top', w: 256, opaque: true },
      { id: 'ch5-arc-rear-arc-side', w: 96, opaque: true },
      { id: 'ch5-arc-inner-arc-side', w: 96, opaque: true },
      { id: 'ch5-arc-rear-arc-back', w: 64, opaque: true },
      { id: 'ch5-arc-inner-arc-back', w: 64, opaque: true },
      { id: 'ch5-souk-l-mound0', w: 400, opaque: false },
      { id: 'ch5-souk-l-mound1', w: 400, opaque: false },
      { id: 'ch5-souk-r-mound0', w: 400, opaque: false },
      { id: 'ch5-souk-r-mound1', w: 400, opaque: false },
    ],
  },
  {
    // E3 s6 ATLAS-B — the bazaar's INHABITED page. Held two stripflap figures
    // on a 512 page while INFRA-1's sprite consumption stopped at keepstack/
    // skyline/stripflap; INFRA-2 gave the rider and generic two-quad families
    // the same addressing, so the crowd chains, the pigeons and the city wall
    // that closes the rear all join them here. Promoted to 1024 to fit them at
    // a useful density — the wall is a full-width backdrop, not a figure.
    id: 'figure-atlas-s6',
    regions: [
      { id: 'ch5-city', w: 820, opaque: false },
      { id: 'ch5-throng', w: 700, opaque: false },
      { id: 'ch5-tea', h: 320, opaque: false },
      { id: 'ch5-crowd-mid', w: 600, opaque: false },
      { id: 'ch5-crowd-low', w: 600, opaque: false },
      { id: 'ch5-pigeon-a', w: 220, opaque: false },
      { id: 'ch5-pigeon-b', w: 200, opaque: false },
    ],
  },
  {
    // E3 s6 ATLAS-C — the stepped TERRACE TRAIN's eight box faces. A 512 page,
    // not a share of bazaar-atlas-s6: that page already packs at scale 0.833
    // (71.5% occupancy) and its two die-cut facade plates are the spread's
    // reader-facing hero art, so widening it would cost plate resolution to
    // save a page that costs a quarter as much. Every face here is a shallow
    // strip — the treads are seen from above and edge-on.
    id: 'tread-atlas-s6',
    page: 512,
    regions: [
      { id: 'ch5-tread-mid-top', w: 460, opaque: false },
      { id: 'ch5-tread-mid-front', w: 460, opaque: false },
      { id: 'ch5-tread-mid-side', w: 120, opaque: false },
      { id: 'ch5-tread-mid-back', w: 300, opaque: false },
      { id: 'ch5-tread-low-top', w: 440, opaque: false },
      { id: 'ch5-tread-low-front', w: 440, opaque: false },
      { id: 'ch5-tread-low-side', w: 120, opaque: false },
      { id: 'ch5-tread-low-back', w: 300, opaque: false },
    ],
  },
  {
    // ---- INFRA-2 — the per-spread scenery pages. Each one carries everything
    // its spread mounts through a sprite-aware renderer, so a chapter's whole
    // built world is one upload plus the handful of exempt pieces below. The
    // permanent exemptions (never packed): the page prints, the dissolve's
    // dunes/gold crossfade pair and its brass tab, the dispatch dial + window
    // card (a REGISTRATION pair — they must stay pixel-aligned to each other,
    // not to a packer's scale factor), the tabpiece band strips, the depthvista
    // wings, and the pieces that are already atlas sheets in their own right
    // (ch2-swarm-atlas, ch4-range, the stagedchain cliffs). ----
    id: 'title-atlas-s1',
    regions: [
      { id: 'title-hero', h: 560, opaque: false },
      { id: 'title-quill', h: 620, opaque: false },
      { id: 'title-border', w: 620, opaque: false },
      { id: 'title-swell', w: 520, opaque: false },
      { id: 'title-crest', w: 320, opaque: false },
      { id: 'title-swell-seal', w: 300, opaque: false },
    ],
  },
  {
    // Chapter I — the inn yard. The lift-flap key board and its four door
    // leaves stay loose: popup-liftflap-layer.tsx has no sprite path yet, so
    // packing them would cost page area and still fetch five webps.
    id: 'inn-atlas-s2',
    regions: [
      { id: 'ch1-inn-row', w: 620, opaque: false },
      { id: 'ch1-wall', w: 620, opaque: false },
      { id: 'ch1-mountain', w: 400, opaque: false },
      { id: 'ch1-gate', w: 380, opaque: false },
      { id: 'ch1-rank', w: 300, opaque: false },
      { id: 'ch1-stable-side', w: 200, opaque: false },
      { id: 'ch1-stable-back', w: 200, opaque: false },
      { id: 'ch1-stable-top', w: 200, opaque: false },
      { id: 'ch1-stable-hay', w: 200, opaque: false },
      { id: 'ch1-stable-vane', h: 200, opaque: false },
      { id: 'ch1-key', w: 160, opaque: false },
      { id: 'ch1-sign', w: 150, opaque: false },
      { id: 'ch1-dormer', w: 140, opaque: false },
    ],
  },
  {
    // Chapter II — the apiary's STRUCTURE. Split from the swarm props below so
    // the courier hero and the backdrop keep their texel density; two 1024 pages
    // at ~70% beat one at 140% (which the packer would resolve by shrinking every
    // region until the hero was illegible). Round 2 dropped ch2-windmill from this
    // page (see the retirement note where its painter was), which re-lays the page
    // out and hands its texels to the hero and the backdrop — welcome, since the
    // hero's whole face now has to survive a 0.256x downscale.
    id: 'apiary-atlas-s3',
    regions: [
      { id: 'ch2-hero', h: 640, opaque: false },
      { id: 'ch2-backdrop', w: 480, opaque: false },
      { id: 'ch2-fringe', w: 560, opaque: false },
      { id: 'ch2-hive-front', w: 300, opaque: false },
      { id: 'ch2-hive-side', h: 300, opaque: false },
      { id: 'ch2-hive-back', w: 150, opaque: false },
      { id: 'ch2-hive-top', w: 150, opaque: false },
    ],
  },
  {
    // Chapter II — the apiary's SWARM AND SKY: bees, crowns, clouds, flower
    // beds, the chain garlands. All small, all die-cut, all riding one page.
    // (ch2-swarm-atlas is itself a 1024 sprite sheet and is never repacked.)
    id: 'flight-atlas-s3',
    regions: [
      { id: 'ch2-cloud-l', w: 448, opaque: false },
      { id: 'ch2-cloud-r', w: 448, opaque: false },
      { id: 'ch2-chain-l', w: 448, opaque: false },
      { id: 'ch2-chain-r', w: 448, opaque: false },
      { id: 'ch2-bee-a', w: 420, opaque: false },
      { id: 'ch2-hive-flowers', w: 364, opaque: false },
      { id: 'ch2-hive-swarm', w: 364, opaque: false },
      { id: 'ch2-bee-b', w: 336, opaque: false },
      { id: 'ch2-bee-c', w: 336, opaque: false },
      { id: 'ch2-crown-b', w: 252, opaque: false },
      { id: 'ch2-crown-c', w: 252, opaque: false },
    ],
  },
  {
    // Chapter IV — the vault. The dragon on the vault door is the book's money
    // shot, so it takes the largest region on any INFRA-2 page. The dissolve's
    // dunes/gold pair is mechanism-load-bearing (one painting is the BackSide of
    // the other across a slat flip) and stays loose, with its brass tab.
    id: 'vault-atlas-s5',
    regions: [
      { id: 'ch4-hero', w: 560, opaque: false },
      // (ch4-hoard-deck region removed — the hoard platform retired with its
      //  wireframe rig; see content.ts + the s6s5r4 polish round.)
      { id: 'ch4-frieze', w: 620, opaque: false },
      { id: 'ch4-chest-front', w: 320, opaque: false },
      { id: 'ch4-aureole', w: 300, opaque: false },
      { id: 'ch4-coins', w: 300, opaque: false },
      { id: 'ch4-chest-spill', w: 260, opaque: false },
      { id: 'ch4-chest-lid', h: 240, opaque: false },
      { id: 'ch4-chest-side', w: 200, opaque: false },
      { id: 'ch4-chest-back', w: 200, opaque: false },
    ],
  },
  {
    // Chapter VI — the treasury's furniture: the strongbox's four faces and its
    // two dressed patches, the stair deck, the clerk's crest rider. The four
    // oanave ranks keep nave-atlas-s7 to themselves (73.6% at scale 1.0 — no
    // room, and their die-cut apertures are the spread's whole idea).
    id: 'treasury-atlas-s7',
    regions: [
      { id: 'ch6-steps-deck', w: 700, opaque: false },
      { id: 'ch6-strongbox-front', w: 480, opaque: false },
      { id: 'ch6-strongbox-side', w: 300, opaque: false },
      { id: 'ch6-strongbox-top', w: 300, opaque: false },
      { id: 'ch6-strongbox-coins', w: 300, opaque: false },
      { id: 'ch6-crest', w: 300, opaque: false },
      { id: 'ch6-strongbox-seal', w: 260, opaque: false },
      { id: 'ch6-strongbox-back', w: 200, opaque: false },
    ],
  },
  {
    // The satchel spread. The depthvista wings stay loose — that renderer takes
    // no rect yet, and its three flaps are mirrored to both flanks from one art
    // each, so they are already the cheapest pieces on the page.
    id: 'satchel-atlas-s8',
    regions: [
      { id: 'satchel-bag', w: 540, opaque: false },
      { id: 'satchel-table-deck', w: 540, opaque: false },
      { id: 'satchel-compass', h: 340, opaque: false },
      { id: 'satchel-sword', h: 420, opaque: false },
      { id: 'satchel-astrolabe', w: 300, opaque: false },
      { id: 'satchel-scroll', h: 300, opaque: false },
      { id: 'satchel-burst-m0', w: 260, opaque: false },
      { id: 'satchel-burst-m1', w: 260, opaque: false },
      { id: 'satchel-burst-m2', w: 260, opaque: false },
    ],
  },
  {
    // The end spread. `end-keepsake` stays loose: the keepsake card is its own
    // renderer with no sprite path, and it is the one piece the reader is
    // invited to look at closely.
    id: 'end-atlas-s9',
    regions: [
      { id: 'end-letter', w: 560, opaque: false },
      { id: 'end-routes-m0', w: 520, opaque: false },
      { id: 'end-routes-m1', w: 500, opaque: false },
      { id: 'end-routes-m2', w: 480, opaque: false },
      { id: 'end-raven', h: 420, opaque: false },
      { id: 'end-seal', w: 300, opaque: false },
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
    base.push({ id: region.id, w, h, opaque: !!region.opaque, dusk: !!region.dusk })
  }
  const P = atlas.page ?? ATLAS_PAGE
  for (let attempt = 0; attempt < 60; attempt++) {
    const factor = Math.pow(0.97, attempt)
    const items = base.map((b) => ({
      ...b,
      w: Math.max(8, Math.round(b.w * factor)),
      h: Math.max(8, Math.round(b.h * factor)),
    }))
    const placed = shelfPack(items, P, ATLAS_GUTTER)
    if (placed) return { placed, factor }
  }
  throw new Error(`atlas ${atlas.id}: no uniform scale fits ${base.length} regions on ${P}px`)
}

/**
 * DUSK GRADE for the keep's hand-painted plates (s4 round 2).
 *
 * Every other piece on spread 4 is procedural, so re-lighting it at dispatch
 * hour was a matter of changing its painter. The keep's tier plates are not:
 * they are painted assets, and their source PNGs are long gone (art-src is
 * gitignored and empty), so the committed webp IS the only original. Grading
 * them in place would compound on every bake, so the grade is applied HERE, at
 * pack time, reading the untouched source each run — idempotent by construction.
 *
 * The grade is a lamp mask, not a filter sweep. A pixel that is bright AND warm
 * (r above b) is a lit window, a fire or a lantern, and is left alone; the
 * cooler and duller a pixel is, the further it is carried toward storm slate and
 * the more it is darkened. That is what turns noon ashlar into night ashlar
 * while the amber lancets stay exactly as painted — and it also kills the green
 * moss line at the hall's base, which was the loudest daylight tell on the tier.
 *
 * NOTE (accepted): the loose per-face webps stay ungraded, so the keepstack's
 * NON-atlas fallback path (popup-keepstack-layer, used only when atlas.json
 * fails to load) would draw daylight plates. That path is already a degraded
 * mode and the sidecar ships committed, so the divergence is cosmetic.
 */
async function duskGradeKeepPlate(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.from(data)
  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * 4
    const R = data[o]
    const G = data[o + 1]
    const B = data[o + 2]
    if (data[o + 3] === 0) continue
    const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255
    const warmth = Math.max(0, (R - B) / 255) // amber light runs red-over-blue
    // how much this pixel reads as a LAMP rather than as lit stone
    const lamp = Math.min(1, warmth * 2.1 * Math.min(1, Math.max(0, (lum - 0.3) / 0.34)))
    const k = 0.74 * (1 - lamp)
    // the night version of this pixel: darkened and pulled onto the storm hue
    const nr = R * 0.4 + 0x2a * 0.3
    const ng = G * 0.4 + 0x34 * 0.32
    const nb = B * 0.52 + 0x42 * 0.36
    out[o] = Math.round(R * (1 - k) + nr * k)
    out[o + 1] = Math.round(G * (1 - k) + ng * k)
    out[o + 2] = Math.round(B * (1 - k) + nb * k)
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
}

/** Composites one atlas page and returns its sprite rects in TEXTURE uv space. */
async function writeAtlasPage(atlas, dir) {
  const { placed, factor } = await packAtlas(atlas, dir)
  const layers = []
  for (const p of [...placed].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const src = sharp(path.join(dir, `${p.id}.webp`)).resize(p.w, p.h, { fit: 'fill' })
    let buf = await (p.opaque ? src.flatten({ background: ROOK.ink }) : src).ensureAlpha().png().toBuffer()
    if (p.dusk) buf = await duskGradeKeepPlate(buf)
    layers.push({ input: buf, left: p.x, top: p.y })
  }
  const P = atlas.page ?? ATLAS_PAGE
  const page = await sharp({
    create: { width: P, height: P, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(layers)
    .png()
    .toBuffer()
  const webp = await sharp(page).webp({ quality: 90, alphaQuality: 100 }).toBuffer()
  await writeFile(path.join(dir, `${atlas.id}.webp`), webp)

  const sprites = {}
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
    pages[atlas.id] = atlas.page ?? ATLAS_PAGE
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
  for (const slot of [...SLOTS, ...RING_SLOTS, ...S6_SOUK_SLOTS]) info.push(await bakeSlot(slot, ART_DIR))
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
    const P = ATLASES.find((x) => x.id === a.id)?.page ?? ATLAS_PAGE
    process.stdout.write(
      `${a.id.padEnd(24)} ${P}x${P}  ${a.count} regions  scale=${a.factor.toFixed(3)}  ` +
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
  NAVE_C,
  NAVE_RANKS,
  NAVE_APSE,
  naveArchPath,
  pageFY,
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
