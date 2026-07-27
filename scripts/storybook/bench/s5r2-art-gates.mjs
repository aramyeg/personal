// s5r2-art-gates.mjs — RASTER gates for the spread-5 ROUND-2 repaints.
//
// The finding these answer, in the blind reader's own words: "Both mechanisms
// resolve to the same visual: a flat gold rectangle lying on the deck. Work both
// and the spread loses both of its upright silhouettes and gains two blank gold
// placemats. There is no reward state that beats the rest state."
//
// So the question this bench asks is not "is the art pretty" but "does the
// REVEAL out-value the REST STATE", and it asks it in numbers.
//
//   R1  ARCADE LEGIBILITY. The revealed face is built architecture, not a gold
//       wash: the piers are materially darker than the lamplit openings between
//       them, sampled at stations derived from S5_ARCADE.
//   R2  THE REVEAL EXCEEDS THE CLOSED STATE. A legibility statistic (mean
//       absolute local luminance gradient at the reading camera's own scale, and
//       again at a quarter of it where only real STRUCTURE survives, plus the
//       count of populated value bands) must beat both an absolute floor and the
//       number the pre-fix painter produced. The gold face must additionally
//       beat the dunes face it is revealed from.
//   R3  FIGURES PRESENT. At every one of dissolveScene's camel x-stations the
//       arcade shows a dark-on-lit figure at least as tall as the dunes face's
//       own camel glyph.
//   R4  REGISTRATION. The lamp on the revealed face and the moon on the closed
//       face occupy the same station — the "this became that" anchor is the
//       whole mechanism.
//   R5  NO LETTERING. No s5 piece may engrave a word anywhere.
//   R6  DETERMINISM. Two bakes of the s5 group are byte-identical.
//
// Measured-QA law: every sample box below is computed from constants the painter
// itself draws with (S5_ARCADE, S5_HOARD, S5_PLATE, S5_DUNE_CAMEL, dissolveScene)
// and never eyeballed off a screenshot. A box typed by hand measures the typist.
//
// Run from the worktree root: node scripts/storybook/bench/s5r2-art-gates.mjs
// (SB_SKIP_BAKE=1 skips R6's second bake while iterating on the paint.)
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import {
  S5_ARCADE,
  S5_HOARD,
  S5_PLATE,
  S5_DUNE_CAMEL,
  dissolveScene,
} from '../generate-art.mjs'

const ART = path.join(process.cwd(), 'public', 'labs', 'storybook', 'art')
// Read every piece through a BUFFER, never a path: sharp keeps an open handle on
// a file it opened by name, and on Windows that handle makes R6's second bake
// fail to overwrite the very webps this bench just measured.
sharp.cache(false)
const bytes = (id) => readFile(path.join(ART, `${id}.webp`))
const GEN = path.join('scripts', 'storybook', 'generate-art.mjs')

/** The two dissolve faces' canvas, from the piece registry. */
const RACK = { w: 1024, h: 788 }
/** What the rack and the mound occupy on screen at the pinned reading camera —
 *  the scale at which "reads as a flat rectangle" is a claim about pixels. */
const SCREEN = { rack: [280, 116], mound: [200, 150] }

let fails = 0
const gate = (name, ok, detail) => {
  if (!ok) fails++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`)
}

const load = async (id) => {
  const { data, info } = await sharp(await bytes(id))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, w: info.width, h: info.height, ch: info.channels }
}
const at = (img, x, y) => {
  const i = (Math.round(y) * img.w + Math.round(x)) * img.ch
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], a: img.data[i + 3] }
}
const lum = (p) => 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b

/** Mean luminance over an axis-aligned box given in FRACTIONS of the canvas. */
const meanBox = (img, u0, v0, u1, v1) => {
  let sum = 0
  let n = 0
  for (let x = Math.round(img.w * u0); x < Math.round(img.w * u1); x++) {
    for (let y = Math.round(img.h * v0); y < Math.round(img.h * v1); y++) {
      sum += lum(at(img, x, y))
      n++
    }
  }
  return n ? sum / n : 0
}

/**
 * THE LEGIBILITY STATISTIC. The image is first resized to the size it actually
 * occupies on screen (and again to a quarter of that), because the bake lays
 * grain over every piece and grain inflates any pixel-level gradient without
 * making the picture one bit more readable — the OLD gold face scored a screen
 * gradient of 6.32 against the dunes face's 6.30 while reading, to a human, as
 * an untextured placemat. What separates them is what survives being squinted
 * at, which is what the quarter-scale pass measures.
 *
 * `uMax` crops the furniture off before measuring: the brass slot plate is
 * identical on both faces and is not part of the picture under test.
 */
async function legibility(id, [sw, sh], uMax) {
  const stat = async (W, H) => {
    const buf = await bytes(id)
    const meta = await sharp(buf).metadata()
    const { data, info } = await sharp(buf)
      .extract({ left: 0, top: 0, width: Math.round(meta.width * uMax), height: meta.height })
      .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const C = info.channels
    const L = new Float64Array(W * H)
    for (let i = 0; i < W * H; i++) {
      L[i] = 0.2126 * data[i * C] + 0.7152 * data[i * C + 1] + 0.0722 * data[i * C + 2]
    }
    let g = 0
    let n = 0
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const i = y * W + x
        g += (Math.abs(L[i + 1] - L[i]) + Math.abs(L[i + W] - L[i])) / 2
        n++
      }
    }
    // Populated value bands: 16-wide luminance bins holding at least 1% of the
    // picture. A flat fill occupies one or two; a picture with planes in it
    // occupies many.
    const BIN = 16
    const hist = new Array(Math.ceil(256 / BIN)).fill(0)
    for (let i = 0; i < W * H; i++) hist[Math.min(hist.length - 1, Math.floor(L[i] / BIN))]++
    return { grad: g / n, bands: hist.filter((c) => c >= 0.01 * W * H).length }
  }
  const near = await stat(Math.round(sw * uMax), sh)
  const far = await stat(Math.round((sw * uMax) / 4), Math.round(sh / 4))
  return { screen: near.grad, macro: far.grad, bands: near.bands }
}

// ---------------------------------------------------------------------------
// R1 — the arcade is built, not washed
// ---------------------------------------------------------------------------
{
  const f = await load('ch4-dissolve-gold')
  const A = S5_ARCADE
  const half = 0.05 / A.BAYS // a narrow column: a tenth of a bay
  const visible = (u) => u + half < S5_PLATE.U0
  const openings = A.CENTRES.filter(visible)
  const piers = A.PIERS.filter(visible)
  const openL = openings.map((u) => meanBox(f, u - half, A.SAMPLE_V0, u + half, A.SAMPLE_V1))
  const pierL = piers.map((u) => meanBox(f, u - half, A.SAMPLE_V0, u + half, A.SAMPLE_V1))
  const dimmestOpening = Math.min(...openL)
  const brightestPier = Math.max(...pierL)
  const sep = dimmestOpening - brightestPier
  // 45 is a separation a reader cannot mistake for grain or for a gradient: the
  // grain amplitude on these pieces is single-digit and the bay gradient's own
  // top-to-bottom swing inside the sampled band is under 20.
  gate(
    'R1 arcade legibility (piers vs lamplit openings)',
    sep >= 45,
    `${openings.length} openings mean L in [${dimmestOpening.toFixed(0)}, ${Math.max(...openL).toFixed(0)}], ` +
      `${piers.length} piers in [${Math.min(...pierL).toFixed(0)}, ${brightestPier.toFixed(0)}] — ` +
      `worst-case separation ${sep.toFixed(0)} (floor 45)`
  )
}

// ---------------------------------------------------------------------------
// R2 — the reveal exceeds the closed state
// ---------------------------------------------------------------------------
{
  // PRE-FIX MEASUREMENTS, recorded on the bake at e88ad36 before a line of this
  // pass was written. They are the "before" the repaints have to beat, and they
  // are hard-coded on purpose: a baseline that re-measures itself is not one.
  const BEFORE = {
    'ch4-dissolve-gold': { screen: 6.315, macro: 9.712, bands: 9 },
    'ch4-goldpile-face': { screen: 4.486, macro: 5.349, bands: 5 },
  }
  // Absolute floors, set below what this pass achieves and above what the old
  // painters managed, so the gate has teeth in both directions.
  const FLOOR = {
    'ch4-dissolve-gold': { screen: 9, macro: 16, bands: 11 },
    'ch4-goldpile-face': { screen: 6, macro: 8, bands: 8 },
  }

  const gold = await legibility('ch4-dissolve-gold', SCREEN.rack, S5_PLATE.U0)
  const dunes = await legibility('ch4-dissolve-dunes', SCREEN.rack, S5_PLATE.U0)
  const pile = await legibility('ch4-goldpile-face', SCREEN.mound, 1)

  for (const [id, now] of [['ch4-dissolve-gold', gold], ['ch4-goldpile-face', pile]]) {
    const b = BEFORE[id]
    const fl = FLOOR[id]
    const ok =
      now.screen > b.screen && now.macro > b.macro && now.bands > b.bands &&
      now.screen >= fl.screen && now.macro >= fl.macro && now.bands >= fl.bands
    gate(
      `R2 ${id} is not a flat rectangle`,
      ok,
      `screen ${b.screen.toFixed(2)} -> ${now.screen.toFixed(2)} (floor ${fl.screen}), ` +
        `macro ${b.macro.toFixed(2)} -> ${now.macro.toFixed(2)} (floor ${fl.macro}), ` +
        `bands ${b.bands} -> ${now.bands} (floor ${fl.bands})`
    )
  }
  // The user's law, stated as arithmetic: the picture the reader UNCOVERS must
  // carry more structure than the picture it was hiding.
  gate(
    'R2 the reveal out-values the rest state',
    gold.macro > dunes.macro && gold.screen > dunes.screen,
    `gold macro ${gold.macro.toFixed(2)} vs dunes ${dunes.macro.toFixed(2)}; ` +
      `gold screen ${gold.screen.toFixed(2)} vs dunes ${dunes.screen.toFixed(2)} ` +
      `(before this pass: 9.71 vs 13.76 and 6.32 vs 6.30 — the reveal LOST)`
  )
}

// ---------------------------------------------------------------------------
// R3 — a figure stands at every camel station
// ---------------------------------------------------------------------------
{
  const f = await load('ch4-dissolve-gold')
  const A = S5_ARCADE
  // The stations are the painter's own, not a list retyped here.
  const { camels } = dissolveScene(RACK.w, RACK.h, 0)
  const need = S5_DUNE_CAMEL.SCALE * S5_DUNE_CAMEL.INK * f.h
  // The paving's own luminance, read where no figure stands (between the last
  // walker and the slot plate), sets the "lit" the figures must be dark against.
  const floorL = meanBox(f, 0.62, A.FIG_V - 0.1, S5_PLATE.U0 - 0.02, A.FIG_V)
  // "At least 40% darker than the paving it stands on." The walkers' ink lands
  // near L 46 against paving near L 173, so this sits far from both — and above
  // the contact pool, which is a shadow ON the paving and not part of the glyph.
  const cut = floorL * 0.6
  // The measure is the glyph's INK EXTENT over its own width, which is what the
  // camel glyph's 4.3s is too. A single centre column is the wrong instrument:
  // the walkers stride, so the gap between their legs runs straight down the
  // middle of them.
  const halfW = A.FIG_HALFW * A.FIG_H * f.h
  const spans = []
  for (const [cx] of camels) {
    const x0 = Math.round((cx / RACK.w) * f.w - halfW)
    const x1 = Math.round((cx / RACK.w) * f.w + halfW)
    let top = f.h
    let bot = 0
    for (let y = Math.round(f.h * A.V_SILL); y < f.h; y++) {
      for (let x = x0; x <= x1; x++) {
        if (lum(at(f, x, y)) < cut) {
          if (y < top) top = y
          if (y > bot) bot = y
          break
        }
      }
    }
    spans.push(bot - top)
  }
  const worst = Math.min(...spans)
  // and it has to be dark ON something lit, not dark on dark
  const lit = floorL > 140
  gate(
    'R3 a walker at every camel station',
    worst >= need && lit,
    `ink spans ${spans.join('/')} px in a ${(halfW * 2).toFixed(0)}px window, against paving L ` +
      `${floorL.toFixed(0)} (cut ${cut.toFixed(0)}); shortest ${worst}px vs the dunes camel glyph's ${need.toFixed(0)}px`
  )
}

// ---------------------------------------------------------------------------
// R4 — the lamp stands where the moon stood
// ---------------------------------------------------------------------------
{
  const gold = await load('ch4-dissolve-gold')
  const dunes = await load('ch4-dissolve-dunes')
  // The landmark's declared station. dissolveScene fixes it independently of the
  // seed, which is exactly why the two faces (which carry DIFFERENT seeds in the
  // piece registry) can still register on it.
  const { sun } = dissolveScene(RACK.w, RACK.h, 0)
  /**
   * The landmark's TOP ARC, and its apex.
   *
   * Not a centroid: on the closed face the dunes stand in front of the moon and
   * eat its lower-left quadrant, so any centre-of-mass measure of the two discs
   * disagrees by a real 20px that has nothing to do with where the painter put
   * them. What both landmarks show whole is their crown, so that is what gets
   * measured — a disc's apex fixes its centre-x and its top, and two discs of
   * one radius with one apex are at one station.
   *
   * The threshold is the window's own midpoint and the run has to be SUSTAINED
   * for a quarter of the landmark radius, which is how a star, a lamp spoke and
   * a grain speck get told apart from a disc.
   */
  const apex = (img) => {
    const R = (sun.r / RACK.h) * img.h
    const cx0 = (sun.x / RACK.w) * img.w
    const cy0 = (sun.y / RACK.h) * img.h
    const x0 = Math.round(cx0 - R * 1.25)
    const x1 = Math.round(cx0 + R * 1.25)
    const y0 = Math.max(0, Math.round(cy0 - R * 1.25))
    const y1 = Math.round(cy0)
    let lo = 255
    let hi = 0
    for (let x = x0; x < x1; x++) {
      for (let y = y0; y < y1; y++) {
        const L = lum(at(img, x, y))
        if (L < lo) lo = L
        if (L > hi) hi = L
      }
    }
    // Well up the window's own range, not its midpoint: the CLOSED face carries
    // the six seams of light down its slat boundaries, and a seam is a bright
    // vertical run the full height of the card. At the window midpoint the scan
    // locks onto a seam instead of the moon; at 72% of the range the seam
    // (which is a 55%-opacity wash over night) drops out and only the two
    // landmarks clear it.
    const mid = lo + 0.72 * (hi - lo)
    const hold = Math.round(R * 0.25)
    const tops = new Map()
    for (let x = Math.round(cx0 - R * 0.6); x <= Math.round(cx0 + R * 0.6); x++) {
      let run = 0
      for (let y = y0; y < y1; y++) {
        run = lum(at(img, x, y)) >= mid ? run + 1 : 0
        if (run >= hold) {
          tops.set(x, y - hold + 1)
          break
        }
      }
    }
    const ys = [...tops.values()]
    if (ys.length === 0) return null
    const top = Math.min(...ys)
    // the flat of the arc: for a circle, y(x) - apex = dx^2 / 2R, so a band of
    // 0.02R picks out |dx| <= 0.2R symmetrically about the true centre
    const flat = [...tops.entries()].filter(([, y]) => y <= top + R * 0.02).map(([x]) => x)
    return { x: (Math.min(...flat) + Math.max(...flat)) / 2 / img.w, y: top / img.h, cols: tops.size }
  }
  const a = apex(dunes)
  const b = apex(gold)
  // A twelfth of the landmark's own radius, as a fraction of each axis.
  const tolX = ((sun.r / RACK.h) * RACK.h) / RACK.w / 12
  const tolY = (sun.r / RACK.h) / 12
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  gate(
    'R4 lamp and moon share a station',
    dx < tolX && dy < tolY,
    `moon apex (${a.x.toFixed(4)}, ${a.y.toFixed(4)}) vs lamp apex (${b.x.toFixed(4)}, ${b.y.toFixed(4)}) — ` +
      `dx ${dx.toFixed(4)} (tol ${tolX.toFixed(4)}), dy ${dy.toFixed(4)} (tol ${tolY.toFixed(4)}); ` +
      `declared station u=${(sun.x / RACK.w).toFixed(4)}, crown v=${((sun.y - sun.r) / RACK.h).toFixed(4)}`
  )
}

// ---------------------------------------------------------------------------
// R5 — the book prints no action labels
// ---------------------------------------------------------------------------
{
  const src = await readFile(path.join(process.cwd(), GEN), 'utf8')
  const calls = src.match(/\bstrokeWord\s*\(/g) ?? []
  const pulls = src.match(/'PULL'|"PULL"|>PULL</g) ?? []
  gate(
    'R5 no engraved word on any s5 piece',
    calls.length === 0 && pulls.length === 0,
    `${calls.length} strokeWord( call(s), ${pulls.length} literal PULL(s) in ${GEN}`
  )
}

// ---------------------------------------------------------------------------
// R6 — determinism
// ---------------------------------------------------------------------------
{
  const ids = [
    'ch4-dissolve-dunes', 'ch4-dissolve-gold', 'ch4-goldpile-face', 'ch4-goldpile-tab',
    'ch4-dissolve-tab', 'ch4-frieze', 'ch4-hero', 'ch4-range', 'page-5',
  ]
  const hash = async () => {
    const out = {}
    for (const id of ids) {
      out[id] = createHash('sha256').update(await bytes(id)).digest('hex')
    }
    return out
  }
  const before = await hash()
  if (process.env.SB_SKIP_BAKE) {
    console.log('SKIP  R6 determinism (SB_SKIP_BAKE set)')
  } else {
    execFileSync(process.execPath, [GEN], { stdio: 'ignore' })
    const after = await hash()
    const diff = ids.filter((id) => before[id] !== after[id])
    gate('R6 determinism (two bakes)', diff.length === 0, diff.length ? `differing: ${diff.join(', ')}` : `${ids.length} s5 ids byte-identical`)
  }
}

// A sanity line, not a gate: the hoard's own band table has to stay monotone in
// v or "keyed to the fold stations" is not a claim about anything.
{
  const vs = S5_HOARD.STOPS.map(([v]) => v)
  const sorted = vs.every((v, i) => i === 0 || v > vs[i - 1])
  gate('R0 hoard value stops run monotonically down v', sorted, `stops at ${vs.join(', ')}`)
}

console.log(fails === 0 ? '\nALL GREEN' : `\n${fails} GATE(S) FAILED`)
process.exitCode = fails === 0 ? 0 : 1
