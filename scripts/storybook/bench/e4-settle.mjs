/**
 * e4-settle.mjs — E4 GRAND M2, THE LANDING SETTLE BENCH.
 *
 * The prescription: each of spread 2's six staged pieces must overshoot its
 * landing by a hair and settle back, so an erection event THUMPS instead of
 * gliding to a halt. This bench proves the shape on the REAL shipped solver
 * (loaded through a throwaway Vite SSR server, like e4-keepstack-staging.mjs),
 * and prints the capture aim-points the eye-test needs.
 *
 * WHAT IT PROVES
 *   TAIL     staged progress and the resulting sheet angle across u 0.70..1.00
 *            in 0.02 steps: the angle passes PAST the landing plane and comes
 *            back to it.
 *   LAND     stageTurnT(0) === 0 and stageTurnT(1) === 1 bit-exactly, and the
 *            settled angle at u = 1 is bit-identical to the unsettled one, so
 *            the rest pose and fold-flat contracts are untouched.
 *   MONO     an OUTGOING turn never overshoots (overshooting toward flat pushes
 *            paper through the page — the one protected physical property).
 *   OFF      an UNSTAGED piece is bit-identical to the pre-M2 solve everywhere.
 *   AIM      the raw `?sbpose=1:<t>:next` value that lands each piece's own
 *            overshoot PEAK, since the URL takes the pre-ease published t.
 *
 * usage: node scripts/storybook/bench/e4-settle.mjs [t0] [t1]     (default spire)
 */
import { createServer } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

const server = await createServer({
  root: ROOT,
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: { alias: { '@': ROOT } },
})
const mech = await server.ssrLoadModule('/components/labs/storybook/book/popup-mechanics.ts')
const geo = await server.ssrLoadModule('/components/labs/storybook/book/page-geometry.ts')

const {
  spreadPageAnglesTilted,
  sheetAngleTilted,
  sheetSweepTilted,
  stageTurnT,
  stageSettleProgress,
  SETTLE_PEAK_DEG,
} = mech
const { easeTurnWeightedInv } = geo

const DEG = 180 / Math.PI
const SPREAD = 2 // the inn
const COMMITTED = 1 // the turn INTO spread 2 going forward is 1 : t : next
const DIR = 'next'

// Every shipped window on spread 2 (content.ts CH1_LAYERS), in completion order.
const WINDOWS = [
  ['hall', 0.1, 0.32],
  ['wing-l', 0.26, 0.48],
  ['wing-r', 0.4, 0.6],
  ['guest', 0.54, 0.74],
  ['balcony', 0.66, 0.86],
  ['spire', 0.78, 0.98],
]

const T0 = Number(process.argv[2] ?? 0.78)
const T1 = Number(process.argv[3] ?? 0.98)
const stage = { t0: T0, t1: T1 }

/** The incoming spread's moving page angle (dir 'next' lands it as thetaL). */
const thetaOf = (easedT, st) =>
  spreadPageAnglesTilted(SPREAD, COMMITTED, DIR, easedT, st).thetaL
const betaOf = (easedT, st) => {
  const a = spreadPageAnglesTilted(SPREAD, COMMITTED, DIR, easedT, st)
  return a.thetaL - a.thetaR
}

const sweep = sheetSweepTilted(DIR, COMMITTED)
const span = sweep.to - sweep.from
const landing = thetaOf(1, stage)

console.log('E4 M2 LANDING SETTLE — spread %d, turn %d -> %d', SPREAD, COMMITTED, SPREAD)
console.log(
  'sheet sweep  from %s deg  to %s deg  span %s deg',
  (sweep.from * DEG).toFixed(3),
  (sweep.to * DEG).toFixed(3),
  (span * DEG).toFixed(3)
)
console.log('settle peak  %s deg of sheet angle', SETTLE_PEAK_DEG)
console.log('window       t0 %s  t1 %s\n', T0, T1)

const gainOf = (deg) => ((deg * Math.PI) / 180) / Math.abs(span)
const GAIN = gainOf(SETTLE_PEAK_DEG)

// ---- TAIL ------------------------------------------------------------------
console.log('TAIL  u -> easedT, staged sheet angle, overshoot PAST the landing')
console.log('   u      easedT      progress    theta(deg)   past-landing(deg)   beta(deg)')
let peak = { u: 0, deg: 0 }
for (let i = 0; i <= 15; i++) {
  const u = 0.7 + i * 0.02
  const easedT = T0 + u * (T1 - T0)
  const th = thetaOf(easedT, stage)
  const past = (th - landing) * DEG
  if (past > peak.deg) peak = { u, deg: past }
  console.log(
    '  %s   %s   %s   %s      %s      %s',
    u.toFixed(2),
    easedT.toFixed(4),
    stageSettleProgress(u, GAIN).toFixed(6),
    (th * DEG).toFixed(4).padStart(9),
    past.toFixed(4).padStart(8),
    (betaOf(easedT, stage) * DEG).toFixed(3).padStart(8)
  )
}
// The peak lives just past the tail's start, so sample it finely too.
let fine = { u: 0, deg: 0 }
for (let i = 0; i <= 40000; i++) {
  const u = i / 40000
  const past = (thetaOf(T0 + u * (T1 - T0), stage) - landing) * DEG
  if (past > fine.deg) fine = { u, deg: past }
}
console.log(
  '\n  peak overshoot %s deg at u %s   (coarse grid saw %s deg at u %s)',
  fine.deg.toFixed(4),
  fine.u.toFixed(4),
  peak.deg.toFixed(4),
  peak.u.toFixed(2)
)
for (const deg of [0.5, 1.2, 2.0]) {
  const g = gainOf(deg)
  let m = 0
  for (let i = 0; i <= 40000; i++) m = Math.max(m, stageSettleProgress(i / 40000, g))
  console.log(
    '  amplitude %s deg -> peak progress %s  (overshoot %s deg of sheet angle)',
    deg.toFixed(1),
    m.toFixed(6),
    ((m - 1) * Math.abs(span) * DEG).toFixed(4)
  )
}

// ---- WHY THE BASE HAD TO BE COMPRESSED --------------------------------------
// The prescription's additive bump on an UNCHANGED ramp: u + gain*shape(u) with
// shape <= 1 and shape(1) = 0. It can only pass 1 where gain > 1 - u.
{
  const need = 1 - 0.72
  console.log(
    '\nWHY  an additive bump on the plain ramp needs gain > %s at the tail start;',
    need.toFixed(3)
  )
  console.log(
    '     a %s deg peak is gain %s — %sx too small, so the ramp is compressed instead.',
    SETTLE_PEAK_DEG,
    GAIN.toFixed(5),
    (need / GAIN).toFixed(0)
  )
}

// ---- LAND ------------------------------------------------------------------
const checks = []
const eq = (name, a, b) => checks.push([name, Object.is(a, b), `${a} vs ${b}`])
eq('stageTurnT(0) === 0', stageTurnT(0, stage), 0)
eq('stageTurnT(1) === 1', stageTurnT(1, stage), 1)
eq('progress(0) === 0', stageSettleProgress(0, GAIN), 0)
eq('progress(1) === 1', stageSettleProgress(1, GAIN), 1)
eq('progress(0.72) === 1', stageSettleProgress(0.72, GAIN), 1)
checks.push([
  'progress passes past 1',
  stageSettleProgress(0.75, GAIN) > 1,
  `${stageSettleProgress(0.75, GAIN)}`,
])
eq('theta(easedT 1) === unsettled', thetaOf(1, stage), sheetAngleTilted(DIR, 1, COMMITTED))
eq('theta(easedT 0) === unsettled', thetaOf(0, stage), sheetAngleTilted(DIR, 0, COMMITTED))
eq('theta at window end === landing', thetaOf(T1, stage), sheetAngleTilted(DIR, 1, COMMITTED))
eq('theta before window === sweep start', thetaOf(T0, stage), sheetAngleTilted(DIR, 0, COMMITTED))

// ---- OFF: an unstaged piece is untouched by M2 ------------------------------
let offMax = 0
for (let i = 0; i <= 1000; i++) {
  const e = i / 1000
  offMax = Math.max(offMax, Math.abs(thetaOf(e, undefined) - sheetAngleTilted(DIR, e, COMMITTED)))
}
checks.push(['unstaged solve unchanged', offMax === 0, `max |delta| ${offMax}`])

// ---- MONO: the exit turn stays monotone -------------------------------------
// The OUTGOING role is the same spread being torn down: spreadIndex ===
// committedSpread. Its angle must march one way with no bump anywhere.
let monoBad = 0
let prev = null
for (let i = 0; i <= 2000; i++) {
  const e = i / 2000
  const th = spreadPageAnglesTilted(COMMITTED, COMMITTED, DIR, e, stage).thetaR
  if (prev !== null && (th - prev) * span < -1e-15) monoBad++
  prev = th
}
checks.push(['outgoing turn monotone', monoBad === 0, `${monoBad} reversals`])
// and it carries no settle at all
let outMax = 0
for (let i = 0; i <= 1000; i++) {
  const e = i / 1000
  const th = spreadPageAnglesTilted(COMMITTED, COMMITTED, DIR, e, stage).thetaR
  outMax = Math.max(outMax, Math.abs(th - sheetAngleTilted(DIR, stageTurnT(e, stage), COMMITTED)))
}
checks.push(['outgoing carries no settle', outMax === 0, `max |delta| ${outMax}`])

// ---- ORDER: the settle must not reorder completions -------------------------
// Each piece is fully landed for every easedT >= its own t1, settle included.
let orderBad = 0
for (const [, a, b] of WINDOWS) {
  for (let i = 0; i <= 200; i++) {
    const e = b + (i / 200) * (1 - b)
    if (thetaOf(e, { t0: a, t1: b }) !== landing) orderBad++
  }
}
checks.push(['completions not reordered', orderBad === 0, `${orderBad} late frames`])

// ---- PX: what the reader actually sees the settle move ----------------------
// Captures could not carry this measurement: two IDENTICAL page loads of the
// same frozen pose differ by a ~1px global camera jitter across the whole
// scene (413k changed pixels at threshold 10 — see the shots tagged
// `settle-rep`), which swamps a one-degree overshoot. So the worst-vertex
// screen travel is projected here instead, through the pinned reading camera
// verbatim from book-scene.tsx, exactly as e4s2-reach.mjs's R gate does.
const keep = await server.ssrLoadModule('/components/labs/storybook/book/popup-keepstack.ts')
const chain = await server.ssrLoadModule('/components/labs/storybook/book/popup-stagedchain.ts')
const { CHAPTERS } = await server.ssrLoadModule('/components/labs/storybook/content.ts')
const INN = CHAPTERS.find((c) => c.spread === 2).layers.find((l) => l.id === 'ch1-inn')

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (v) => {
  const l = Math.hypot(...v)
  return [v[0] / l, v[1] / l, v[2] / l]
}
const CAM = [0, 1.85, 3.05]
const LOOK = [0, 0.38, 0.05]
const FRAME_W = 1600
const FRAME_H = 900
const FWD = norm(sub(LOOK, CAM))
const RIGHT = norm(cross(FWD, [0, 1, 0]))
const UP = cross(RIGHT, FWD)
const tanV = Math.tan((34 * Math.PI) / 180 / 2)
const tanH = tanV * (FRAME_W / FRAME_H)
const project = (p) => {
  const v = sub(p, CAM)
  const z = dot(v, FWD)
  return [((dot(v, RIGHT) / z / tanH) * FRAME_W) / 2, ((dot(v, UP) / z / tanV) * FRAME_H) / 2]
}

// The incoming spread's angle pair, re-derived from the SHIPPED sheet solver so
// the amplitude can be swept (spreadPageAnglesTilted reads the module constant).
// Gated against the shipped function below before any number here is believed.
const restR = geo.restAngles(SPREAD).aR
const anglesAt = (easedT, st, peakDeg) => ({
  thetaL: mech.sheetAngleSettled(DIR, stageTurnT(easedT, st), COMMITTED, peakDeg),
  thetaR: restR,
})
{
  let mirror = 0
  for (const [, a, b] of WINDOWS) {
    for (let i = 0; i <= 500; i++) {
      const e = i / 500
      const got = anglesAt(e, { t0: a, t1: b }, SETTLE_PEAK_DEG)
      const want = spreadPageAnglesTilted(SPREAD, COMMITTED, DIR, e, { t0: a, t1: b })
      if (got.thetaL !== want.thetaL || got.thetaR !== want.thetaR) mirror++
    }
  }
  checks.push(['px mirror === shipped solve', mirror === 0, `${mirror} mismatches`])
}

/** Every world vertex of one keep part, with the rest of the keep held at the
 *  pose it settles to, so only this part's own overshoot moves anything. */
const partVerts = (part, easedT, peakDeg) => {
  const own = WINDOWS.find(([n]) => n === part)
  const resolve = (st) =>
    st && st.t0 === own[1] && st.t1 === own[2]
      ? anglesAt(easedT, st, peakDeg)
      : anglesAt(1, st, peakDeg)
  const { thetaL, thetaR } = resolve(undefined)
  const out = []
  if (part === 'wing-l' || part === 'wing-r') {
    // A whole layer, not a keep part: its window IS layer.stage.
    const wing = CHAPTERS.find((c) => c.spread === 2).layers.find((l) => l.id === `ch1-${part}`)
    const a = anglesAt(easedT, wing.stage, peakDeg)
    for (const q of chain.stagedChainQuads(wing, a.thetaL, a.thetaR)) out.push(...q)
    return out
  }
  if (part === 'hall' || part === 'guest') {
    const plate = keep.keepStackFacadePlate(INN, part, thetaL, thetaR, resolve)
    if (plate) out.push(...plate.plateL, ...plate.plateR)
    return out
  }
  if (part === 'spire') {
    // The raven finial is the longest lever on the whole spread — it rides the
    // ridge beyond the tip — so the spire's worst vertex is one of its corners.
    for (const m of keep.keepStackSpirePoses(INN, thetaL, thetaR, resolve) ?? [])
      out.push(...m.left, ...m.right, m.tip)
    const raven = keep.keepStackSpireRaven(INN, thetaL, thetaR, resolve)
    if (raven) out.push(...raven.crestL, ...raven.crestR)
  } else {
    const d = keep.keepStackBalconyDeck(INN, thetaL, thetaR, resolve)
    if (d) out.push(...d.deckL, ...d.deckR)
  }
  return out
}

/** Worst-vertex screen px between two poses of one part. */
const travel = (part, eA, degA, eB, degB) => {
  const A = partVerts(part, eA, degA).map(project)
  const B = partVerts(part, eB, degB).map(project)
  let worst = 0
  for (let i = 0; i < A.length; i++)
    worst = Math.max(worst, Math.hypot(A[i][0] - B[i][0], A[i][1] - B[i][1]))
  return worst
}

console.log('\nPX  worst-vertex screen travel, overshoot peak vs the landed pose')
console.log('  part      amplitude   worst px   mean px')
for (const part of ['hall', 'wing-l', 'wing-r', 'guest', 'balcony', 'spire']) {
  const own = WINDOWS.find(([n]) => n === part)
  for (const deg of [0.5, 1.2, 1.5, 2.0]) {
    const g = gainOf(deg)
    let uPeak = 0
    let best = -Infinity
    for (let i = 0; i <= 40000; i++) {
      const p = stageSettleProgress(i / 40000, g)
      if (p > best) {
        best = p
        uPeak = i / 40000
      }
    }
    const e = own[1] + uPeak * (own[2] - own[1])
    const A = partVerts(part, e, deg).map(project)
    const B = partVerts(part, 1, deg).map(project)
    let worst = 0
    let sum = 0
    for (let i = 0; i < A.length; i++) {
      const d = Math.hypot(A[i][0] - B[i][0], A[i][1] - B[i][1])
      worst = Math.max(worst, d)
      sum += d
    }
    console.log(
      '  %s %s deg    %s     %s',
      part.padEnd(9),
      deg.toFixed(1),
      worst.toFixed(2).padStart(6),
      (sum / A.length).toFixed(2).padStart(6)
    )
  }
  // SENSITIVITY: how many px this part moves for a whole DEGREE of shortfall
  // just before the landing. A part whose gearing flattens out at the landing
  // cannot show a settle at any amplitude, which is a property of the part, not
  // of the settle — the balcony deck is exactly that case (see the report).
  const eShort = own[1] + (own[2] - own[1]) * 0.72 * (1 - 5 / (Math.abs(span) * DEG))
  console.log(
    '  %s sensitivity: %s px for the last 5 deg of its own travel',
    part.padEnd(9),
    travel(part, eShort, SETTLE_PEAK_DEG, 1, SETTLE_PEAK_DEG).toFixed(2)
  )
}

console.log('\nGATES')
let fail = 0
for (const [name, ok, detail] of checks) {
  if (!ok) fail++
  console.log('  %s  %s   %s', ok ? 'PASS' : 'FAIL', name.padEnd(30), detail)
}

// ---- AIM: capture aim-points ------------------------------------------------
// The URL takes the driver's RAW published t; every consumer runs it back
// through easeTurnWeighted, so aiming at eased E means publishing its inverse.
let U_PEAK = 0
{
  let best = -Infinity
  for (let i = 0; i <= 40000; i++) {
    const u = i / 40000
    const p = stageSettleProgress(u, GAIN)
    if (p > best) {
      best = p
      U_PEAK = u
    }
  }
}
console.log('\nAIM  ?sbpose=%d:<t>:next  — each piece at its own overshoot peak', COMMITTED)
console.log('  piece      window        easedT(peak)   raw t')
for (const [name, a, b] of WINDOWS) {
  const e = a + U_PEAK * (b - a)
  console.log(
    '  %s %s  %s      %s',
    name.padEnd(9),
    `${a.toFixed(2)}-${b.toFixed(2)}`,
    e.toFixed(4),
    easeTurnWeightedInv(e).toFixed(4)
  )
}

await server.close()
process.exit(fail ? 1 : 0)
