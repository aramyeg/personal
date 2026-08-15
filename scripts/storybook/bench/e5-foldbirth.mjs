/**
 * e5-foldbirth.mjs — WILD lane, E5 FUSE: the fold-birth bench.
 *
 * The inn no longer rises through a clipping plane; it ERECTS, in seven separated staged events
 * whose pieces each swing about a hinge line. There is no browser this phase, so the whole
 * contract is proved here, on the REAL shipped solver (loaded through jiti, like the GRAND
 * lane's e4s2-reach.mjs) — nothing in this file re-implements the kinematics.
 *
 * WHAT IT GATES
 *   A  WINDOW LAW      every adjacent pair of erection windows overlaps by <= 40% of the shorter
 *                      one. More and the events stop reading as separate; none and the build
 *                      stutters.
 *   B1 FOLD FLAT       at open = 0 every corner of every piece lies in ONE plane (the piece is
 *                      exactly flat), that plane is UNDER the page surface by the full sink, and
 *                      the whole footprint is inside the spread's trim. Nothing pokes through the
 *                      closed leaf and nothing prints on it either.
 *   B2 REST POSE       at open = 1 every chunk's world map is the identity to the last bit, so
 *                      the building sits exactly where it sat before this feature existed, and
 *                      every crease term is exactly 0 (the rest pixels are untouched).
 *   C  SETTLE          the hinge angle passes PAST its landing by ~1.5deg and comes back to
 *                      exactly 90deg, the overshoot decays monotonically, and the lobe leaves
 *                      the base ramp at the ramp's own slope (no kink at the landing).
 *   D  MONOTONE        each piece's own hinge angle rises monotonically up to its landing, and
 *                      its composed world height never falls back outside a settle lobe of its
 *                      own or of any ancestor.
 *   E  ABOVE THE PAGE  no piece's swept volume dips below the page plane mid-flight, beyond the
 *                      depth it already occupies at rest plus its own landing dip.
 *   W  WALL TIME       the block that exists because A-E all passed while the feature was
 *                      invisible. Gates A-E prove the geometry over `open` 0..1; they say nothing
 *                      about how much of the READER'S time each event gets. The first shipped
 *                      version spent 18-33 ms on each of its first six events because `open` was
 *                      a smoothstep of a dihedral that was itself a quint of wall time, and the
 *                      whole seven-event build ran in 261 ms. Every number here is measured
 *                      through the REAL WildFrame on the REAL driver curve.
 *
 * Run:  node scripts/storybook/bench/e5-foldbirth.mjs      (from the worktree root)
 */

import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = process.env.SB_ROOT ?? process.cwd()
const require_ = createRequire(import.meta.url)
const { createJiti } = require_(
  path.join(ROOT, 'node_modules/.pnpm/jiti@2.6.1/node_modules/jiti/lib/jiti.cjs')
)
const jiti = createJiti(path.join(ROOT, 'bench.mjs'), { alias: { '@': ROOT } })
const load = (p) => jiti.import(path.join(ROOT, p))

const fold = await load('components/labs/storybook/wild/fold-birth.ts')

const {
  FOLD_EVENTS,
  FOLD_EVENT_ORDER,
  FOLD_CHUNKS,
  FOLD_FOOTPRINT,
  PAGE_SINK,
  SETTLE_TAIL,
  SETTLE_PEAK_DEG,
  FOLD_SWEEP_DEG,
  stageU,
  stageSettleProgress,
  solveFoldBirth,
  extentCorners,
  applyFoldMatrix,
  signBoardAngle,
} = fold

const DEG = 180 / Math.PI
const fx = (v, n = 4) => (v >= 0 ? ' ' : '') + v.toFixed(n)

let failures = 0
const gate = (ok, label, detail) => {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
}

const chunkByName = new Map(FOLD_CHUNKS.map((c) => [c.name, c]))
const ancestors = (name) => {
  const out = []
  let c = chunkByName.get(name)
  while (c && c.parent) {
    out.push(c.parent)
    c = chunkByName.get(c.parent)
  }
  return out
}

/** A chunk's settle lobe expressed in `open`: the stretch where the overshoot is running. */
const settleLobe = (name) => {
  const w = FOLD_EVENTS[chunkByName.get(name).event]
  return [w.t0 + SETTLE_TAIL * (w.t1 - w.t0), w.t1]
}

// ---------------------------------------------------------------------------------------------
console.log('\n=== THE EVENT TABLE ===')
console.log('  event      window        pieces')
for (const ev of FOLD_EVENT_ORDER) {
  const w = FOLD_EVENTS[ev]
  const pieces = FOLD_CHUNKS.filter((c) => c.event === ev).map((c) => c.name).join(', ')
  console.log(`  ${ev.padEnd(9)}  ${w.t0.toFixed(2)} .. ${w.t1.toFixed(2)}   ${pieces}`)
}

// ---------------------------------------------------------------------------------------------
console.log('\n=== A · WINDOW LAW (adjacent overlap <= 40% of the shorter window) ===')
for (let i = 1; i < FOLD_EVENT_ORDER.length; i += 1) {
  const a = FOLD_EVENTS[FOLD_EVENT_ORDER[i - 1]]
  const b = FOLD_EVENTS[FOLD_EVENT_ORDER[i]]
  const overlap = Math.max(0, Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0))
  const shorter = Math.min(a.t1 - a.t0, b.t1 - b.t0)
  const pct = (overlap / shorter) * 100
  gate(
    pct <= 40 + 1e-9,
    `${FOLD_EVENT_ORDER[i - 1]} -> ${FOLD_EVENT_ORDER[i]}`,
    `overlap ${overlap.toFixed(3)} of ${shorter.toFixed(3)} = ${pct.toFixed(1)}%`
  )
  gate(b.t0 > a.t0, `${FOLD_EVENT_ORDER[i]} starts after ${FOLD_EVENT_ORDER[i - 1]}`, '')
}
// A piece may not begin before what it stands on has begun.
for (const c of FOLD_CHUNKS) {
  if (!c.parent) continue
  const own = FOLD_EVENTS[c.event]
  const par = FOLD_EVENTS[chunkByName.get(c.parent).event]
  gate(own.t0 >= par.t0, `${c.name} does not precede its seat (${c.parent})`, `${own.t0} >= ${par.t0}`)
}

// ---------------------------------------------------------------------------------------------
console.log('\n=== B1 · FOLD FLAT AT open = 0 ===')
{
  const poses = solveFoldBirth(0)
  for (const pose of poses) {
    const c = chunkByName.get(pose.name)
    let loY = Infinity
    let hiY = -Infinity
    let cx = 0
    let cz = 0
    for (const corner of extentCorners(c)) {
      const p = applyFoldMatrix(pose.matrix, corner)
      loY = Math.min(loY, p[1])
      hiY = Math.max(hiY, p[1])
      cx = Math.max(cx, Math.abs(p[0]))
      cz = Math.max(cz, Math.abs(p[2]))
    }
    const planar = hiY - loY <= 1e-9
    const sunk = hiY <= -PAGE_SINK + 1e-9
    const inTrim = cx <= FOLD_FOOTPRINT.halfX && cz <= FOLD_FOOTPRINT.halfZ
    gate(
      planar && sunk && inTrim,
      pose.name.padEnd(8),
      `thickness ${(hiY - loY).toExponential(1)}  y ${hiY.toFixed(4)} (needs <= ${(-PAGE_SINK).toFixed(2)})  |x| ${cx.toFixed(3)}/${FOLD_FOOTPRINT.halfX}  |z| ${cz.toFixed(3)}/${FOLD_FOOTPRINT.halfZ}`
    )
  }
  gate(Math.abs(signBoardAngle(0) - Math.PI / 2) < 1e-12, 'sign board folded up at open = 0', '')

  // And the sink has to be gone by the time a piece is actually standing, or the crease line
  // would render sliced off for the whole event.
  for (const c of FOLD_CHUNKS) {
    const w = FOLD_EVENTS[c.event]
    const quarter = w.t0 + 0.25 * (w.t1 - w.t0)
    const pose = solveFoldBirth(quarter).find((p) => p.name === c.name)
    gate(pose.sink === 0, `${c.name.padEnd(8)} is clear of the page a quarter into its event`, '')
  }
}

// ---------------------------------------------------------------------------------------------
console.log('\n=== B2 · REST POSE AT open = 1 (positions within 1e-4 of the model) ===')
{
  const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  // The last event now lands exactly ON the commit — that is what buys it its 150 ms — so `open`
  // just short of 1 is legitimately still inside the dressing's settle lobe. The contract is
  // therefore stated where it actually lives: EXACT at 1 and past it, and everything before that
  // is the settle and nothing else.
  for (const open of [1, 1.2]) {
    const poses = solveFoldBirth(open)
    let worst = 0
    let worstCrease = 0
    for (const pose of poses) {
      for (let i = 0; i < 16; i += 1) worst = Math.max(worst, Math.abs(pose.matrix[i] - IDENT[i]))
      worstCrease = Math.max(worstCrease, Math.abs(pose.crease))
    }
    gate(
      worst < 1e-12 && worstCrease < 1e-12,
      `open ${open.toFixed(2)}: every chunk map is the identity`,
      `worst |M - I| ${worst.toExponential(1)}  worst crease ${worstCrease.toExponential(1)}`
    )
  }
  // (Continuity into rest — that the LAST frame of the turn is already essentially at rest, so
  // the role flip to 'current' costs no snap — is a wall-time question and is gated in block W.)
  const poses = solveFoldBirth(1)
  let worstDrift = 0
  for (const pose of poses) {
    const c = chunkByName.get(pose.name)
    for (const corner of extentCorners(c)) {
      const p = applyFoldMatrix(pose.matrix, corner)
      for (let i = 0; i < 3; i += 1) worstDrift = Math.max(worstDrift, Math.abs(p[i] - corner[i]))
    }
  }
  gate(worstDrift < 1e-4, 'no vertex moves at rest', `worst drift ${worstDrift.toExponential(1)}`)
  gate(Math.abs(signBoardAngle(1)) < 1e-12, 'sign board hanging at open = 1', '')
}

// ---------------------------------------------------------------------------------------------
console.log('\n=== C · THE LANDING SETTLE ===')
{
  // The hinge angle a piece shows for its own staged progress u.
  const psiDeg = (u) => stageSettleProgress(u) * FOLD_SWEEP_DEG

  let peak = 0
  let peakU = 0
  for (let i = 0; i <= 20000; i += 1) {
    const u = i / 20000
    const a = psiDeg(u)
    if (a > peak) {
      peak = a
      peakU = u
    }
  }
  const overshoot = peak - FOLD_SWEEP_DEG
  gate(
    overshoot > 1.2 && overshoot < 1.8,
    'overshoot is present and about 1.5deg',
    `peak ${overshoot.toFixed(3)}deg at u ${peakU.toFixed(4)} (target ${SETTLE_PEAK_DEG})`
  )
  gate(
    Math.abs(psiDeg(1) - FOLD_SWEEP_DEG) < 1e-12 && Math.abs(psiDeg(0)) < 1e-12,
    'endpoints exact',
    `psi(0) ${psiDeg(0).toExponential(1)}  psi(1) - 90 ${(psiDeg(1) - FOLD_SWEEP_DEG).toExponential(1)}`
  )

  // Decaying: strictly down from the peak back to the landing plane.
  let decays = true
  let prev = peak
  for (let i = 0; i <= 4000; i += 1) {
    const u = peakU + ((1 - peakU) * i) / 4000
    const a = psiDeg(u)
    if (a > prev + 1e-12) decays = false
    prev = a
  }
  gate(decays, 'the overshoot decays monotonically back onto the landing', '')

  // Velocity match across the handoff: the lobe leaves at the base ramp's own slope.
  const h = 1e-6
  const vBefore = (stageSettleProgress(SETTLE_TAIL) - stageSettleProgress(SETTLE_TAIL - h)) / h
  const vAfter = (stageSettleProgress(SETTLE_TAIL + h) - stageSettleProgress(SETTLE_TAIL)) / h
  gate(
    Math.abs(vAfter - vBefore) / vBefore < 5e-3,
    'velocity-matched at the handoff (no kink at the landing)',
    `before ${vBefore.toFixed(5)}  after ${vAfter.toFixed(5)}`
  )

  // And the settle must never run backwards THROUGH the landing (paper into the page).
  let minAfterTail = Infinity
  for (let i = 0; i <= 4000; i += 1) {
    const u = SETTLE_TAIL + ((1 - SETTLE_TAIL) * i) / 4000
    minAfterTail = Math.min(minAfterTail, psiDeg(u))
  }
  gate(
    minAfterTail >= FOLD_SWEEP_DEG - 1e-9,
    'the settle never falls back below the landing',
    `min ${minAfterTail.toFixed(6)}deg`
  )
}

// ---------------------------------------------------------------------------------------------
console.log('\n=== D · MONOTONE ERECTION OUTSIDE THE SETTLE LOBES ===')
{
  const STEPS = 4000
  for (const c of FOLD_CHUNKS) {
    // 1. the piece's own hinge angle, up to its landing
    let ownOk = true
    let prev = -1
    for (let i = 0; i <= STEPS; i += 1) {
      const u = (SETTLE_TAIL * i) / STEPS
      const a = stageSettleProgress(u)
      if (a < prev - 1e-12) ownOk = false
      prev = a
    }

    // 2. the composed world height, excluding this piece's and every ancestor's settle lobe
    const lobes = [c.name, ...ancestors(c.name)].map(settleLobe)
    const inLobe = (open) => lobes.some(([a, b]) => open > a - 1e-9 && open < b + 1e-9)
    const corners = extentCorners(c)
    let worldOk = true
    let worstDrop = 0
    let prevTop = -Infinity
    for (let i = 0; i <= STEPS; i += 1) {
      const open = i / STEPS
      const pose = solveFoldBirth(open).find((p) => p.name === c.name)
      let top = -Infinity
      for (const corner of corners) top = Math.max(top, applyFoldMatrix(pose.matrix, corner)[1])
      if (!inLobe(open) && prevTop > -Infinity) {
        const drop = prevTop - top
        if (drop > 1e-9) {
          worstDrop = Math.max(worstDrop, drop)
          if (drop > 2e-4) worldOk = false
        }
      }
      prevTop = top
    }
    gate(
      ownOk && worldOk,
      c.name.padEnd(8),
      `hinge monotone ${ownOk ? 'yes' : 'NO'}  worst height fallback ${worstDrop.toExponential(1)}`
    )
  }
}

// ---------------------------------------------------------------------------------------------
console.log('\n=== E · NOTHING DIPS BELOW THE PAGE MID-FLIGHT ===')
{
  const STEPS = 2000
  for (const c of FOLD_CHUNKS) {
    const corners = extentCorners(c)
    const restFloor = Math.min(0, c.extent.min[1])
    // A piece may reach as deep as it already sits at rest, plus its own landing dip. Not deeper.
    // The deliberate SINK is excluded: while any of it is applied the piece is being hidden under
    // the clip on purpose, and B1 already gates that.
    const allowed = restFloor - c.thump - 1e-6
    let worst = Infinity
    let worstAt = 0
    for (let i = 0; i <= STEPS; i += 1) {
      const open = i / STEPS
      const pose = solveFoldBirth(open).find((p) => p.name === c.name)
      if (pose.sink > 0) continue
      for (const corner of corners) {
        const y = applyFoldMatrix(pose.matrix, corner)[1]
        if (y < worst) {
          worst = y
          worstAt = open
        }
      }
    }
    gate(
      worst >= allowed,
      c.name.padEnd(8),
      `worst y ${fx(worst)} at open ${worstAt.toFixed(3)} (floor ${fx(allowed)})`
    )
  }
}

// ---------------------------------------------------------------------------------------------
console.log('\n=== THE SHAPE OF THE BUILD (informational: apex height per event) ===')
{
  const names = FOLD_CHUNKS.map((c) => c.name)
  console.log(`  open   ${names.map((n) => n.slice(0, 7).padStart(8)).join('')}`)
  for (let i = 0; i <= 20; i += 1) {
    const open = i / 20
    const poses = solveFoldBirth(open)
    const row = poses.map((pose) => {
      const c = chunkByName.get(pose.name)
      let top = -Infinity
      for (const corner of extentCorners(c)) {
        top = Math.max(top, applyFoldMatrix(pose.matrix, corner)[1])
      }
      return top.toFixed(3).padStart(8)
    })
    console.log(`  ${open.toFixed(2)}  ${row.join('')}`)
  }
}

// ---------------------------------------------------------------------------------------------
// W · WALL TIME. Measured through the REAL WildFrame, driven by the REAL turn driver curve, on
// the real title -> chapter-I turn. No re-implementation: a stub context is handed the published
// progress the driver would publish at each millisecond, and `open` is read back out.
// ---------------------------------------------------------------------------------------------
console.log('\n=== W · WALL-TIME DISTRIBUTION (title -> chapter I, the incoming turn) ===')
{
  const frame = await load('components/labs/storybook/wild/wild-frame.ts')
  const driver = await load('components/labs/storybook/book/use-turn-driver.ts')
  const { readWildFrame } = frame
  const { TURN_MS, SETTLE_MS, turnPublishedT } = driver
  const TOTAL_MS = TURN_MS + SETTLE_MS

  const SPREAD = 2
  const COMMITTED = 1 // the turn INTO chapter I going forward is 1 : t : next
  const stub = (t) => ({
    spreadIndex: SPREAD,
    frame: { current: { t, dir: 'next', isCover: false } },
    committedSpread: { current: COMMITTED },
    wake: { current: 0 },
    clock: { current: 0 },
  })

  // open(ms) and, from it, every piece's staged progress at that millisecond.
  const openAt = new Float64Array(TOTAL_MS + 1)
  for (let ms = 0; ms <= TOTAL_MS; ms += 1) {
    openAt[ms] = readWildFrame(stub(turnPublishedT(ms, TURN_MS))).open
  }

  /** First millisecond at which `open` has reached a value. */
  const msAtOpen = (target) => {
    for (let ms = 0; ms <= TOTAL_MS; ms += 1) if (openAt[ms] >= target) return ms
    return Number.NaN
  }

  const legibleMs = msAtOpen(1e-9)
  gate(
    openAt[0] === 0 && openAt[TOTAL_MS] >= 1 - 1e-9,
    'the curtain starts shut and is fully open by the commit',
    `open(0) ${openAt[0]}  open(${TOTAL_MS}) ${openAt[TOTAL_MS].toFixed(6)}  legible at ${legibleMs}ms`
  )

  let monotone = true
  for (let ms = 1; ms <= TOTAL_MS; ms += 1) if (openAt[ms] < openAt[ms - 1] - 1e-12) monotone = false
  gate(monotone, 'the curtain never runs backwards during the turn', '')

  console.log('\n  event      open window     ms start  ms land   ms end    base travel')
  const MIN_BASE_MS = 150
  let worstBase = Infinity
  const landings = []
  for (const ev of FOLD_EVENT_ORDER) {
    const w = FOLD_EVENTS[ev]
    const land = w.t0 + SETTLE_TAIL * (w.t1 - w.t0)
    const m0 = msAtOpen(w.t0 + 1e-9)
    const ml = msAtOpen(land)
    const m1 = msAtOpen(Math.min(w.t1, 1) - 1e-9)
    const base = ml - m0
    worstBase = Math.min(worstBase, base)
    landings.push({ ev, ml })
    console.log(
      `  ${ev.padEnd(9)}  ${w.t0.toFixed(3)}-${w.t1.toFixed(3)}   ${String(m0).padStart(8)} ${String(ml).padStart(8)} ${String(m1).padStart(8)}   ${String(base).padStart(6)} ms`
    )
  }
  gate(
    worstBase >= MIN_BASE_MS,
    `every event gets at least ${MIN_BASE_MS} ms of base travel`,
    `worst ${worstBase} ms`
  )

  // Landings must arrive separated, or seven events read as one.
  let worstGap = Infinity
  let ordered = true
  for (let i = 1; i < landings.length; i += 1) {
    const gap = landings[i].ml - landings[i - 1].ml
    if (gap <= 0) ordered = false
    worstGap = Math.min(worstGap, gap)
  }
  gate(ordered && worstGap >= 60, 'landings arrive in order and at least 60 ms apart', `worst gap ${worstGap} ms`)

  // FIRST VISIBLE MOTION: the first millisecond at which any piece has cleared the page sink and
  // actually started travelling. Before that the fold is real but under the paper.
  let firstVisibleMs = Number.NaN
  for (let ms = 0; ms <= TOTAL_MS; ms += 1) {
    const poses = solveFoldBirth(openAt[ms])
    if (poses.some((p) => p.sink === 0 && p.u > 0)) {
      firstVisibleMs = ms
      break
    }
  }
  const firstVisibleT = turnPublishedT(firstVisibleMs, TURN_MS)
  gate(
    firstVisibleT < 0.45,
    'the first fold motion is visible before t = 0.45 of the turn',
    `${firstVisibleMs} ms, published t ${firstVisibleT.toFixed(3)}`
  )

  const lastEnd = msAtOpen(1 - 1e-9)
  const spanFrac = (lastEnd - firstVisibleMs) / TOTAL_MS
  gate(
    spanFrac >= 0.55,
    'the build is distributed across the turn, not burst into one corner',
    `${firstVisibleMs}..${lastEnd} ms = ${(spanFrac * 100).toFixed(0)}% of the ${TOTAL_MS} ms turn`
  )

  // NO SNAP AT THE COMMIT. The last event lands exactly on the commit, so the very last frame of
  // the turn had better already be at rest — otherwise the role flip to 'current' (which forces
  // open = 1) would finish the fold in a single frame.
  {
    const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    let worst = 0
    for (const pose of solveFoldBirth(openAt[TOTAL_MS - 1])) {
      for (let i = 0; i < 16; i += 1) worst = Math.max(worst, Math.abs(pose.matrix[i] - IDENT[i]))
    }
    gate(
      worst < 1e-3,
      'the last frame of the turn is already at rest — the commit costs no snap',
      `worst |M - I| at ${TOTAL_MS - 1} ms: ${worst.toExponential(1)}`
    )
  }

  // LEAVING. The same clock has to run the inn back down as the leaf goes the other way, and it
  // has to reach dead flat BEFORE the commit hides the spread — a piece still half erect when the
  // role flips would snap.
  {
    const out = (t) => ({
      spreadIndex: SPREAD,
      frame: { current: { t, dir: 'next', isCover: false } },
      committedSpread: { current: SPREAD }, // leaving chapter I forwards: spread 2 is outgoing
      wake: { current: 0 },
      clock: { current: 0 },
    })
    const series = []
    for (let ms = 0; ms <= TOTAL_MS; ms += 1) series.push(readWildFrame(out(turnPublishedT(ms, TURN_MS))).open)
    let mono = true
    for (let ms = 1; ms <= TOTAL_MS; ms += 1) if (series[ms] > series[ms - 1] + 1e-12) mono = false
    const flatAt = series.findIndex((v) => v <= 1e-9)
    gate(
      series[0] >= 1 - 1e-9 && mono && flatAt > 0 && flatAt <= TOTAL_MS,
      'leaving chapter I folds the inn back down, monotonically, before the commit',
      `open(0) ${series[0].toFixed(3)}  flat at ${flatAt} ms of ${TOTAL_MS}`
    )
  }

  console.log('\n  the other three curtain beats, in the same currency:')
  const model = await load('components/labs/storybook/wild/inn-model.ts')
  for (const [name, [a, b]] of Object.entries(model.REVEAL)) {
    console.log(`    ${name.padEnd(10)} open ${a.toFixed(2)}-${b.toFixed(2)}  ->  ${msAtOpen(a + 1e-9)}..${msAtOpen(b - 1e-9)} ms`)
  }
}

console.log('\n=== EYE-TEST AIM POINTS (peak crease per event) ===')
for (const ev of FOLD_EVENT_ORDER) {
  const w = FOLD_EVENTS[ev]
  // Half travel is where a hinge shows the most: the panel is at 45deg to its own page.
  const mid = w.t0 + 0.5 * SETTLE_TAIL * (w.t1 - w.t0)
  const land = w.t0 + SETTLE_TAIL * (w.t1 - w.t0)
  console.log(`  ${ev.padEnd(9)} half-fold open ${mid.toFixed(3)}   landing open ${land.toFixed(3)}`)
}

console.log(`\n${failures === 0 ? 'ALL GATES PASS' : `${failures} GATE(S) FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
