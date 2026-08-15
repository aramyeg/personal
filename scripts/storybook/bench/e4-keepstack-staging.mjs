// E4 GRAND — THE KEEPSTACK PER-PART STAGING BENCH.
//
// `ch1-inn` is ONE keepstack layer whose parts erect in four separated events,
// so the lane's whole thesis lives INSIDE one layer's solver. This bench sweeps
// the page turn in fine steps and measures the four things that can go wrong:
//
//   FLAT  fold-flat residual at book-closed, for the shipped windows AND for a
//         randomised sweep of window combinations (the property the lane
//         protects: nothing pokes out of a shut book).
//   REST  bit-parity of the unstaged solve against the pre-E4 `baseH` seat, and
//         of the staged solve at t = 1 against the rest pose.
//   SEAT  does a staged upper part stay GLUED to the part below it while that
//         part is itself still rising — the characteristic failure (a storey
//         floating detached, or sinking through a lid).
//   CROSS proper part-vs-part interpenetration over the whole sweep, not just
//         at the endpoints.
//
// It loads the real TypeScript solvers through a throwaway Vite SSR server, so
// it measures the SHIPPED code, not a re-derivation of it.
//
// usage: node scripts/storybook/bench/e4-keepstack-staging.mjs [steps]

import { createServer } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const STEPS = Number(process.argv[2] ?? 400)

const server = await createServer({
  root: ROOT,
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: { alias: { '@': ROOT } },
})
const load = (p) => server.ssrLoadModule(p)

const mech = await load('/components/labs/storybook/book/popup-mechanics.ts')
const keepstack = await load('/components/labs/storybook/book/popup-keepstack.ts')
const pageGeom = await load('/components/labs/storybook/book/page-geometry.ts')
const content = await load('/components/labs/storybook/content.ts')

const { spreadPageAnglesTilted } = mech
const { easeTurnWeighted } = pageGeom
const {
  keepStackStoryPoses,
  keepStackBalconyDeck,
  keepStackSpirePoses,
  keepStackSpireRaven,
  keepStackFacadePlate,
  keepStackStoryGeoms,
  keepStackTelescopes,
} = keepstack

// ---------------------------------------------------------------------------
// the subject

const CH1 = content.CHAPTERS.find((c) => c.spread === 2)
const KEEP = CH1.layers.find((l) => l.mech === 'keepstack')
if (!KEEP) throw new Error('bench: no keepstack layer on spread 2')
const SPREAD = CH1.spread
const COMMITTED = SPREAD - 1 // a 'next' turn lands this spread as the incoming one

/** The real driver's clock, read through a part's own window. */
const resolverAt = (t, override) => (stage) =>
  spreadPageAnglesTilted(SPREAD, COMMITTED, 'next', easeTurnWeighted(t), override ?? stage ?? KEEP.stage)

// ---------------------------------------------------------------------------
// vector / geometry helpers

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a) => Math.hypot(a[0], a[1], a[2])

/** Distance from a point to a quad (as two triangles), clamped to the surface. */
function pointQuadDistance(p, q) {
  return Math.min(pointTriDistance(p, q[0], q[1], q[2]), pointTriDistance(p, q[0], q[2], q[3]))
}
function pointTriDistance(p, a, b, c) {
  // clamped barycentric projection (Ericson, Real-Time Collision Detection §5.1.5)
  const ab = sub(b, a)
  const ac = sub(c, a)
  const ap = sub(p, a)
  const d1 = dot(ab, ap)
  const d2 = dot(ac, ap)
  if (d1 <= 0 && d2 <= 0) return len(ap)
  const bp = sub(p, b)
  const d3 = dot(ab, bp)
  const d4 = dot(ac, bp)
  if (d3 >= 0 && d4 <= d3) return len(bp)
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3)
    return len(sub(p, [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]))
  }
  const cp = sub(p, c)
  const d5 = dot(ab, cp)
  const d6 = dot(ac, cp)
  if (d6 >= 0 && d5 <= d6) return len(cp)
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6)
    return len(sub(p, [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]))
  }
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6))
    return len(sub(p, [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]))
  }
  const denom = 1 / (va + vb + vc)
  const v = vb * denom
  const w = vc * denom
  return len(sub(p, [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]))
}

/** Moller-Trumbore, returning the ray parameter or null. */
function segTri(p0, p1, a, b, c) {
  const dir = sub(p1, p0)
  const e1 = sub(b, a)
  const e2 = sub(c, a)
  const h = cross(dir, e2)
  const det = dot(e1, h)
  if (Math.abs(det) < 1e-12) return null
  const f = 1 / det
  const s = sub(p0, a)
  const u = f * dot(s, h)
  if (u < 0 || u > 1) return null
  const q = cross(s, e1)
  const v = f * dot(dir, q)
  if (v < 0 || u + v > 1) return null
  const tt = f * dot(e2, q)
  return tt >= 0 && tt <= 1 ? tt : null
}

/** How deep quad A's edges pierce quad B — 0 for a touching contact (a glue
 *  line resting on a lid), positive only for a real crossing. */
function crossingDepth(qa, qb) {
  const tris = [
    [qb[0], qb[1], qb[2]],
    [qb[0], qb[2], qb[3]],
  ]
  let worst = 0
  for (let i = 0; i < 4; i++) {
    const p0 = qa[i]
    const p1 = qa[(i + 1) % 4]
    for (const tri of tris) {
      const t = segTri(p0, p1, ...tri)
      if (t === null) continue
      // depth = how far the SHALLOWER endpoint sits past the pierced plane;
      // a segment that merely touches the plane scores ~0.
      const n = cross(sub(tri[1], tri[0]), sub(tri[2], tri[0]))
      const nl = len(n) || 1
      const d0 = Math.abs(dot(sub(p0, tri[0]), n)) / nl
      const d1 = Math.abs(dot(sub(p1, tri[0]), n)) / nl
      worst = Math.max(worst, Math.min(d0, d1))
    }
  }
  return worst
}

// ---------------------------------------------------------------------------
// the keep, decomposed into named parts at one turn fraction

function partsAt(resolve, thetaL, thetaR) {
  const stories = keepStackStoryPoses(KEEP, thetaL, thetaR, resolve)
  const parts = []
  for (const s of stories) {
    const quads = s.patches.map((p) => p.quad)
    const plate = keepStackFacadePlate(KEEP, s.key, thetaL, thetaR, resolve)
    if (plate) quads.push(plate.plateL, plate.plateR)
    parts.push({ name: s.key, quads, story: s })
  }
  const deck = keepStackBalconyDeck(KEEP, thetaL, thetaR, resolve)
  if (deck) parts.push({ name: 'balcony', quads: [deck.deckL, deck.deckR] })
  const spire = keepStackSpirePoses(KEEP, thetaL, thetaR, resolve)
  if (spire) spire.forEach((p, i) => parts.push({ name: `spire-m${i}`, quads: [p.left, p.right] }))
  const raven = keepStackSpireRaven(KEEP, thetaL, thetaR, resolve)
  if (raven) parts.push({ name: 'raven', quads: [raven.crestL, raven.crestR] })
  return { stories, parts }
}

const everyVertex = (parts) => parts.flatMap((p) => p.quads.flat())

// ---------------------------------------------------------------------------
// FLAT — fold-flat at book-closed

/** A genuinely shut book: every clock, whatever its window, reads the closed
 *  plane. The page plane is then y = 0, so the residual is max |y|. */
function foldFlatResidual(windows) {
  const geom = withWindows(windows)
  const resolve = () => ({ thetaL: 0, thetaR: 0 })
  const { parts } = partsOf(geom, 0, 0, resolve)
  return Math.max(...everyVertex(parts).map((v) => Math.abs(v[1])))
}

/** The same, but through the REAL driver at t = 0 (the frame the reader
 *  actually sees at the start of a turn), measured off the page plane the two
 *  sheets rest in. */
function foldFlatAtTurnStart(windows) {
  const geom = withWindows(windows)
  const resolve = (stage) => spreadPageAnglesTilted(SPREAD, COMMITTED, 'next', 0, stage)
  const base = resolve(undefined)
  const { parts } = partsOf(geom, base.thetaL, base.thetaR, resolve)
  // residual = the largest dihedral any part opens to at t = 0
  let maxBeta = 0
  for (const w of [...(geom.stories.map((s) => s.stage) ?? []), geom.balcony?.stage, geom.spire?.stage]) {
    const a = resolve(w)
    maxBeta = Math.max(maxBeta, a.thetaL - a.thetaR)
  }
  return { maxBeta, verts: everyVertex(parts).length }
}

function withWindows(windows) {
  if (!windows) return KEEP
  return {
    ...KEEP,
    stories: KEEP.stories.map((s, i) => ({ ...s, stage: windows.stories[i] })),
    balcony: KEEP.balcony ? { ...KEEP.balcony, stage: windows.balcony } : undefined,
    spire: KEEP.spire ? { ...KEEP.spire, stage: windows.spire } : undefined,
  }
}

function partsOf(geom, thetaL, thetaR, resolve) {
  const stories = keepStackStoryPoses(geom, thetaL, thetaR, resolve)
  const parts = []
  for (const s of stories) {
    const quads = s.patches.map((p) => p.quad)
    const plate = keepStackFacadePlate(geom, s.key, thetaL, thetaR, resolve)
    if (plate) quads.push(plate.plateL, plate.plateR)
    parts.push({ name: s.key, quads, story: s })
  }
  const deck = keepStackBalconyDeck(geom, thetaL, thetaR, resolve)
  if (deck) parts.push({ name: 'balcony', quads: [deck.deckL, deck.deckR] })
  const spire = keepStackSpirePoses(geom, thetaL, thetaR, resolve)
  if (spire) spire.forEach((p, i) => parts.push({ name: `spire-m${i}`, quads: [p.left, p.right] }))
  const raven = keepStackSpireRaven(geom, thetaL, thetaR, resolve)
  if (raven) parts.push({ name: 'raven', quads: [raven.crestL, raven.crestR] })
  return { stories, parts }
}

// ---------------------------------------------------------------------------
// run

const out = []
const say = (s) => {
  out.push(s)
  console.log(s)
}

say('E4 KEEPSTACK PER-PART STAGING BENCH')
say(`keep: ${KEEP.id}   stories: ${KEEP.stories.map((s) => s.key).join(' -> ')}   steps: ${STEPS}`)
say(
  `windows: ${KEEP.stories
    .map((s) => `${s.key} ${s.stage ? `[${s.stage.t0},${s.stage.t1}]` : '-'}`)
    .join('  ')}  balcony ${KEEP.balcony?.stage ? `[${KEEP.balcony.stage.t0},${KEEP.balcony.stage.t1}]` : '-'}  spire ${
    KEEP.spire?.stage ? `[${KEEP.spire.stage.t0},${KEEP.spire.stage.t1}]` : '-'
  }`
)
say('')

// --- G0 telescoping + nested z ---------------------------------------------
let nested = true
for (let k = 1; k < KEEP.stories.length; k++) {
  const lo = KEEP.stories[k - 1]
  const s = KEEP.stories[k]
  if (!(s.z0 >= lo.z0 - 1e-12 && s.z1 <= lo.z1 + 1e-12)) nested = false
}
say(`G0 telescoping a non-increasing : ${keepStackTelescopes(KEEP) ? 'PASS' : 'FAIL'}`)
say(`G0 nested z-spans               : ${nested ? 'PASS' : 'FAIL'}`)

// --- G1 unstaged parity vs the pre-E4 baseH seat ---------------------------
{
  let worst = 0
  for (let i = 0; i <= 120; i++) {
    const beta = (Math.PI * i) / 120
    const tL = Math.PI / 2 + beta / 2
    const tR = Math.PI / 2 - beta / 2
    const legacy = keepStackStoryGeoms(KEEP).map((g) => mech.solveBoxPose(g, tL, tR))
    const staged = keepStackStoryPoses(KEEP, tL, tR).map((s) => s.patches)
    legacy.forEach((patches, si) =>
      patches.forEach((p, pi) =>
        p.quad.forEach((c, ci) => {
          worst = Math.max(worst, len(sub(c, staged[si][pi].quad[ci])))
        })
      )
    )
  }
  say(`G1 unstaged parity vs baseH seat: max vertex delta ${worst.toExponential(2)} world`)
}

// --- G2 fold-flat -----------------------------------------------------------
{
  const shipped = foldFlatResidual(null)
  const combos = []
  const rnd = (seed) => {
    let x = seed
    return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  }
  const r = rnd(7)
  let worstCombo = 0
  for (let n = 0; n < 200; n++) {
    const win = () => {
      const t0 = r()
      const t1 = t0 + r() * (1 - t0)
      return { t0, t1 }
    }
    const w = {
      stories: KEEP.stories.map(() => (r() < 0.15 ? undefined : win())),
      balcony: r() < 0.15 ? undefined : win(),
      spire: r() < 0.15 ? undefined : win(),
    }
    const res = foldFlatResidual(w)
    worstCombo = Math.max(worstCombo, res)
    combos.push(res)
  }
  say(`G2 fold-flat, shipped windows   : ${shipped.toExponential(2)} world off the page plane`)
  say(`G2 fold-flat, 200 random window combos: worst ${worstCombo.toExponential(2)} world`)
  const start = foldFlatAtTurnStart(null)
  say(`G2 at the real driver's t=0     : max part dihedral ${(start.maxBeta * 57.29578).toFixed(4)} deg`)
}

// --- the sweep --------------------------------------------------------------
let apexMax = 0
let apexAtRest = 0
let seatGapMax = 0
let seatGapWhere = ''
let belowSeatMax = 0
let belowSeatWhere = ''
let crossMax = 0
let crossWhere = ''
let crossCount = 0
const CROSS_TOL = 5e-3 // 2.5 plies: below this a "crossing" is glue-line contact
const apexTrace = []

for (let i = 0; i <= STEPS; i++) {
  const t = i / STEPS
  const resolve = resolverAt(t)
  const base = resolve(undefined)
  const { stories, parts } = partsAt(resolve, base.thetaL, base.thetaR)

  const apex = Math.max(...everyVertex(parts).map((v) => v[1]))
  apexMax = Math.max(apexMax, apex)
  if (i === STEPS) apexAtRest = apex
  if (i % Math.round(STEPS / 20) === 0) apexTrace.push([t, apex])

  // SEAT — every story above the ground one must keep its wall-bottom glue
  // corners ON the lid quads of the story below, and no vertex of an upper part
  // may sit BELOW its seat plane (that is what "sinking through the lid" is).
  for (let k = 1; k < stories.length; k++) {
    const parent = stories[k - 1]
    const lidQuads = parent.patches.filter((p) => p.face === 'lidL' || p.face === 'lidR').map((p) => p.quad)
    if (lidQuads.length === 0) continue
    const glue = stories[k].patches
      .filter((p) => p.face === 'wallL' || p.face === 'wallR')
      .flatMap((p) => [p.quad[0], p.quad[1]])
    for (const g of glue) {
      const d = Math.min(...lidQuads.map((q) => pointQuadDistance(g, q)))
      if (d > seatGapMax) {
        seatGapMax = d
        seatGapWhere = `${stories[k].key} on ${parent.key} @ t=${t.toFixed(3)}`
      }
    }
  }
  for (const part of parts) {
    const seat = part.story ? part.story.seat : stories[stories.length - 1].lid
    if (part.story && part.story === stories[0]) continue
    const bis = seat.frame.bis
    const h0 = seat.origin[0] * bis[0] + seat.origin[1] * bis[1]
    for (const v of part.quads.flat()) {
      const below = h0 - (v[0] * bis[0] + v[1] * bis[1])
      if (below > belowSeatMax) {
        belowSeatMax = below
        belowSeatWhere = `${part.name} @ t=${t.toFixed(3)}`
      }
    }
  }

  // CROSS — proper interpenetration between DIFFERENT parts.
  for (let a = 0; a < parts.length; a++) {
    for (let b = a + 1; b < parts.length; b++) {
      for (const qa of parts[a].quads) {
        for (const qb of parts[b].quads) {
          const d = Math.max(crossingDepth(qa, qb), crossingDepth(qb, qa))
          if (d > CROSS_TOL) crossCount++
          if (d > crossMax) {
            crossMax = d
            crossWhere = `${parts[a].name} x ${parts[b].name} @ t=${t.toFixed(3)}`
          }
        }
      }
    }
  }
}

say('')
say(`APEX  max over the sweep        : ${apexMax.toFixed(4)} world`)
say(`APEX  at rest (t=1)             : ${apexAtRest.toFixed(4)} world`)
say(`SEAT  worst glue-to-lid gap     : ${seatGapMax.toExponential(3)} world  (${seatGapWhere || 'n/a'})`)
say(`SEAT  worst dip below own seat  : ${belowSeatMax.toExponential(3)} world  (${belowSeatWhere || 'n/a'})`)
say(`CROSS worst part-vs-part depth  : ${crossMax.toExponential(3)} world  (${crossWhere || 'none'})`)
say(`CROSS quad-pairs over ${CROSS_TOL}      : ${crossCount}`)
say('')
say('apex trace (t, world y):')
say(apexTrace.map(([t, y]) => `  ${t.toFixed(2)}  ${y.toFixed(4)}`).join('\n'))

// --- event separation (contract 1d) ----------------------------------------
say('')
say('EVENT SEPARATION — each part\'s own dihedral (deg) across the turn:')
const names = [...KEEP.stories.map((s) => s.key), 'balcony', 'spire']
const windows = [...KEEP.stories.map((s) => s.stage), KEEP.balcony?.stage, KEEP.spire?.stage]
say(`   t     ${names.map((n) => n.padStart(8)).join('')}`)
for (const t of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]) {
  const resolve = resolverAt(t)
  const row = windows.map((w) => {
    const a = resolve(w)
    return (((a.thetaL - a.thetaR) * 180) / Math.PI).toFixed(1).padStart(8)
  })
  say(`  ${t.toFixed(2)}  ${row.join('')}`)
}

await server.close()
