/**
 * E5 — THE BRASS KEY, DRIVEN BADLY ON PURPOSE.
 *
 * The owner's verdict was *"not reliable … the interaction looks very clanky if I am not super
 * careful with the handling"*, and the acceptance is that a CARELESS, fast, sloppy drag feels
 * good. A defect that only appears under bad input cannot be found by careful input, so this
 * bench feeds the key twelve named bad-input traces as synthetic 60 fps pointer streams and
 * measures the answer. No browser, no GPU, no page: `wild/key-physics.ts` is import-free, so node
 * runs the real mechanism at a few thousand frames a second.
 *
 *   node scripts/storybook/bench/e5-keyfeel.mjs            # run all traces
 *   node scripts/storybook/bench/e5-keyfeel.mjs --verbose  # per-trace measurement dump
 *
 * KNOW WHAT THIS IS NOT. A scripted trace is a DIFFERENT TEST from a real drag in the same units
 * (harness-realism rule). This gates the PHYSICS — no backward jumps against monotone intent,
 * every release resolves, hysteresis never re-fires, rate caps hold. It cannot gate the FEEL.
 * The real-pointer blind review does that, after the server swap.
 *
 * UNITS. Page units throughout (escutcheon R = 0.105, bow rim 0.265, refR 0.182). The traces are
 * specified in screen pixels, converted with PX_PER_PAGE, which is derived rather than guessed:
 * the feel-spec calls GRAB_R_PX = 64 and GRAB_R_PAGE = 0.34 the same gate, so one page unit is
 * 64 / 0.34 = 188 px on the leaned reading camera.
 */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

import {
  KEY_FEEL,
  createKeyPhysics,
  keyGrabBegin,
  keyGrabEnd,
  keySample,
  keySeed,
  keyTick,
  nearestDetentIndex,
  tangentialTurn,
} from '../../../components/labs/storybook/wild/key-physics.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')
const VERBOSE = process.argv.includes('--verbose')

const DT = 1 / 60
const PX_PER_PAGE = 64 / KEY_FEEL.grabRPage
const px = (n) => n / PX_PER_PAGE
const REF = KEY_FEEL.refR
const DETENTS = KEY_FEEL.detents

// ---------------------------------------------------------------------------------------------
// RIG — a hand, in the plate's plane, sampled at 60 Hz.
// ---------------------------------------------------------------------------------------------

const hub = (x, y) => ({ angle: Math.atan2(y, x), r: Math.hypot(x, y) })

function makeRig(seedTurn = 0) {
  const s = createKeyPhysics()
  keySeed(s, seedTurn)
  const rig = {
    s,
    t: 0,
    /** Per-frame history: turn, target, vel — everything an assertion needs. */
    turn: [s.turn],
    target: [s.target],
    vel: [s.vel],
    clicks: [],
    /** Total hand path length, page units — the currency of "how much work did the reader do". */
    path: 0,
    last: null,
    grab(x, y) {
      keyGrabBegin(s, x === null ? null : hub(x, y), rig.t)
      rig.last = x === null ? null : [x, y]
    },
    /**
     * One frame. `x` may be a number (a hand position), or null (the shell could not condition
     * an intersection), or undefined (no pointer event this frame).
     */
    frame(x, y) {
      if (x !== undefined) {
        keySample(s, x === null ? null : hub(x, y), rig.t)
        if (x !== null) {
          if (rig.last) rig.path += Math.hypot(x - rig.last[0], y - rig.last[1])
          rig.last = [x, y]
        }
      }
      keyTick(s, DT)
      for (const c of s.events) rig.clicks.push({ ...c, t: rig.t })
      rig.t += DT
      rig.turn.push(s.turn)
      rig.target.push(s.target)
      rig.vel.push(s.vel)
    },
    release() {
      keyGrabEnd(s, rig.t)
    },
    settle(seconds) {
      const n = Math.round(seconds / DT)
      for (let i = 0; i < n; i++) rig.frame()
    },
  }
  return rig
}

/** Deterministic noise — the same "sloppy hand" every run, so a regression is a regression. */
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const spanTurn = (h) => Math.max(...h) - Math.min(...h)
const netTurn = (h) => h[h.length - 1] - h[0]
const worstBackStep = (h) => {
  let worst = 0
  for (let i = 1; i < h.length; i++) worst = Math.min(worst, h[i] - h[i - 1])
  return worst
}
const biggestStep = (h) => {
  let worst = 0
  for (let i = 1; i < h.length; i++) worst = Math.max(worst, Math.abs(h[i] - h[i - 1]))
  return worst
}
const signChanges = (v, eps) => {
  let n = 0
  let last = 0
  for (const x of v) {
    const s = x > eps ? 1 : x < -eps ? -1 : 0
    if (s !== 0 && last !== 0 && s !== last) n++
    if (s !== 0) last = s
  }
  return n
}
const distToNearestDetent = (turn) => Math.abs(turn - DETENTS[nearestDetentIndex(turn)])

// ---------------------------------------------------------------------------------------------
// TRACES
// ---------------------------------------------------------------------------------------------

const traces = []
const trace = (id, title, fn) => traces.push({ id, title, fn })

/** T1 — a fast slash straight through the escutcheon centre. The E4 key ate the whole sweep here:
 *  raw atan2 about the hub sweeps ~180 degrees in a few pixels. */
trace('T1', 'fast slash through the hub, 400 px over 3 frames', () => {
  const rig = makeRig(0.34)
  const len = px(400)
  const y = px(2)
  const x0 = -0.3
  rig.grab(x0, y)
  for (let i = 1; i <= 3; i++) rig.frame(x0 + (len * i) / 3, y)
  rig.release()
  rig.settle(1.2)
  const swept = spanTurn(rig.turn)
  return {
    facts: { swept, endTurn: rig.s.turn, discarded: rig.s.samplesDiscarded },
    checks: [
      ['|turn| excursion < 0.08', swept < 0.08],
      ['never slams to a bound', rig.s.turn > 0.001 && rig.s.turn < 0.999],
    ],
  }
})

/** T2 — a long straight drag aimed at the hub. No rotational intent, so no rotation. */
trace('T2', 'straight-line drag through the face, 300 px, no rotational intent', () => {
  const rig = makeRig(0.34)
  const len = px(300)
  const y = px(3)
  const x0 = -0.3
  const n = 20
  rig.grab(x0, y)
  for (let i = 1; i <= n; i++) rig.frame(x0 + (len * i) / n, y)
  rig.release()
  rig.settle(1.2)
  const swept = spanTurn(rig.turn)
  return { facts: { swept }, checks: [['|turn| excursion < 0.05', swept < 0.05]] }
})

/** T3 — a tight scribble on the keyhole. Zero leverage at the hub is the whole point (Frictional
 *  Games on Penumbra's crank: "interacting at center zero leverage"). */
trace('T3', 'tight scribble inside r < 0.4 refR for 2 s', () => {
  const rig = makeRig(0.34)
  const rnd = mulberry32(0x5eed)
  const rMax = 0.4 * REF
  rig.grab(rMax * 0.6, 0)
  for (let i = 0; i < 120; i++) {
    const a = rnd() * Math.PI * 2
    const r = rMax * Math.sqrt(rnd())
    rig.frame(r * Math.cos(a), r * Math.sin(a))
  }
  rig.release()
  rig.settle(1.2)
  const swept = spanTurn(rig.turn)
  const flips = signChanges(rig.vel, 0.02)
  return {
    facts: { swept, flips },
    checks: [
      ['|turn| excursion < 0.10', swept < 0.1],
      ['<= 2 velocity sign changes', flips <= 2],
    ],
  }
})

/** T4 — the hand circles a centre 0.12 off the hub: a real reader's arc, not a compass's. */
trace('T4', 'off-centre arc (centre 0.12 from the hub)', () => {
  const rig = makeRig(0)
  const cx = 0.12
  const rho = 0.19
  const want = 0.68
  const ideal = want * KEY_FEEL.turnRad * REF
  rig.grab(cx + rho, 0)
  let phi = 0
  let frames = 0
  while (rig.s.turn < want * 0.9 && frames < 900) {
    phi += 0.02
    rig.frame(cx + rho * Math.cos(phi), rho * Math.sin(phi))
    frames++
  }
  const reached = rig.s.turn
  const back = worstBackStep(rig.turn)
  rig.release()
  rig.settle(1.5)
  return {
    facts: { reached, pathRatio: rig.path / ideal, back, frames },
    checks: [
      ['reaches 0.9 of the intended sweep', reached >= want * 0.9],
      ['within 1.3x the ideal arc length', rig.path <= 1.3 * ideal],
      ['monotone (no back step > 0.005)', back > -0.005],
    ],
  }
})

/** T5 — the reader holds the key still in a notch with an ordinary unsteady hand. */
trace('T5', 'jitter hold at a detent, +-2 px for 3 s (32 hands)', () => {
  // WHAT THIS MEASURES, AND WHY IT IS NOT ONE HAND'S SPAN. The feel-spec asks for |dturn| < 0.004
  // over 3 s of +-2 px jitter, on the theory that the 1 euro filter erases it. It does not, and
  // it should not: +-2 px at the BOW is +-3.3 degrees of real hand travel around the hub, and no
  // filter can remove that without also removing slow deliberate turning — which is the winch's
  // "slow deliberate turning is ignored" defect, re-introduced by the cure. Simulated: killing a
  // +-2 px tremble to 0.004 needs a 0.03 Hz cutoff, i.e. seconds of lag.
  //
  // What actually matters is that noise does not RECTIFY — that a shaking hand does not creep the
  // key one way. A path integral of tangential displacement is unbiased by construction and a raw
  // atan2 accumulator is not, and the difference only shows across many hands. So: 32 different
  // jitter streams, gate the MEAN signed drift at the spec's 0.004, require both signs to occur,
  // and cap any single hand's tremble at 0.03 turn (3 degrees of key, less than one click's own
  // wobble, so it is under the noise floor of the thing it is holding).
  const drifts = []
  let worstSpan = 0
  let clicks = 0
  for (let seed = 0; seed < 32; seed++) {
    const rig = makeRig(0.34)
    const rnd = mulberry32(0xc0ffee + seed * 7919)
    const j = px(2)
    const bx = 0
    const by = REF
    rig.grab(bx, by)
    for (let i = 0; i < 180; i++) rig.frame(bx + (rnd() * 2 - 1) * j, by + (rnd() * 2 - 1) * j)
    drifts.push(netTurn(rig.turn))
    worstSpan = Math.max(worstSpan, spanTurn(rig.turn))
    clicks += rig.clicks.length
    rig.release()
    rig.settle(1.2)
    if (distToNearestDetent(rig.s.turn) > 0.01) clicks += 100 // release must still resolve
  }
  const mean = drifts.reduce((a, b) => a + b, 0) / drifts.length
  const up = drifts.filter((d) => d > 0).length
  return {
    facts: { meanDrift: mean, worstSpan, up, clicks },
    checks: [
      ['jitter does not rectify (|mean drift| < 0.004)', Math.abs(mean) < 0.004],
      ['drift takes both signs', up > 6 && up < 26],
      ['no hand trembles more than 0.03 turn', worstSpan < 0.03],
      ['no clicks after the first', clicks === 0],
    ],
  }
})

/** T6 — the hardest hysteresis case: the hand parks the key ASTRIDE a well lip and shakes. The E4
 *  key machine-gunned its wobble here, because the click fired on a nearest-cell flip. */
trace('T6', 'jitter astride a well lip, +-3 px for 3 s', () => {
  const rig = makeRig(0.1)
  const rnd = mulberry32(0xbadf00d)
  const j = px(3)
  // Walk the key up to the lip of detent 1 (0.34 - w = 0.24) on a clean arc, then shake there.
  rig.grab(REF, 0)
  let phi = 0
  while (rig.s.turn < 0.24 && phi < 4) {
    phi += 0.012
    rig.frame(REF * Math.cos(phi), REF * Math.sin(phi))
  }
  const clicksBefore = rig.clicks.length
  for (let i = 0; i < 180; i++) {
    const a = phi + ((rnd() * 2 - 1) * j) / REF
    rig.frame(REF * Math.cos(a), REF * Math.sin(a))
  }
  rig.release()
  rig.settle(1.5)
  return {
    facts: { clicksBefore, clicks: rig.clicks.length, endTurn: rig.s.turn },
    checks: [
      ['exactly one click reaching the lip', clicksBefore === 1],
      ['<= 1 click in total', rig.clicks.length <= 1],
    ],
  }
})

/** T7 — the honest reference stroke, and the SIGN GATE: a hand sweeping the hub angle upward must
 *  drive the turn upward. (This lab has a bench-vs-render winding trap on record; the sign is
 *  asserted here, never trusted to a derivation.) */
trace('T7', 'monotone slow arc, full sweep over 4 s', () => {
  const rig = makeRig(0)
  const frames = 240
  const sweep = 1.06 * KEY_FEEL.turnRad
  rig.grab(REF, 0)
  for (let i = 1; i <= frames; i++) {
    const a = (sweep * i) / frames
    rig.frame(REF * Math.cos(a), REF * Math.sin(a))
  }
  const back = worstBackStep(rig.turn)
  const clicks = rig.clicks.length
  const at = rig.clicks.map((c) => DETENTS[c.index])
  rig.release()
  rig.settle(1.2)
  return {
    facts: { endTurn: rig.s.turn, back, clicks, at: at.join(','), maxStep: biggestStep(rig.turn) },
    checks: [
      ['sign: counter-clockwise hand drives turn up', rig.s.turn > 0.9],
      ['non-decreasing to 0.002', back > -0.002],
      ['no backward step > 0.005', back > -0.005],
      ['exactly 3 clicks', clicks === 3],
      ['clicks at 0.34 / 0.68 / 1', at.join(',') === '0.34,0.68,1'],
    ],
  }
})

/** T8 — the defect that leaves the inn permanently half lit: a release dead between two notches.
 *  The E4 key snapped only within 1.5 detent radii and parked at 0.50 forever. */
trace('T8', 'release at turn = 0.50, dead between notches', () => {
  const rig = makeRig(0.5)
  rig.grab(REF, 0)
  rig.frame(REF, 0)
  rig.release()
  let resolvedAt = null
  for (let i = 0; i < Math.round(1.2 / DT); i++) {
    rig.frame()
    if (resolvedAt === null && distToNearestDetent(rig.s.turn) < 0.01) resolvedAt = rig.t
  }
  return {
    facts: { resolvedAt, endTurn: rig.s.turn, gap: distToNearestDetent(rig.s.turn) },
    checks: [
      ['resolves to a notch within 1.2 s', resolvedAt !== null],
      ['settles inside 0.01 of it', distToNearestDetent(rig.s.turn) < 0.01],
    ],
  }
})

/** T9 — a flick. The E4 key had no rotor at all, so nothing could be thrown. */
trace('T9', 'flick 0.4 of the sweep in 150 ms, then release', () => {
  const rig = makeRig(0)
  const frames = 9
  const sweep = 0.42 * KEY_FEEL.turnRad
  rig.grab(REF, 0)
  for (let i = 1; i <= frames; i++) rig.frame(REF * Math.cos((sweep * i) / frames), REF * Math.sin((sweep * i) / frames))
  const releaseTurn = rig.s.turn
  rig.release()
  const after = []
  for (let i = 0; i < Math.round(2 / DT); i++) {
    rig.frame()
    after.push(rig.s.turn)
  }
  const lowest = Math.min(...after)
  return {
    facts: { releaseTurn, endTurn: rig.s.turn, lowest, coast: rig.s.turn - releaseTurn },
    checks: [
      ['coasts forward past the release point', rig.s.turn > releaseTurn],
      ['seats at a notch', distToNearestDetent(rig.s.turn) < 0.01],
      ['never reverses past the release point', lowest > releaseTurn - 0.005],
    ],
  }
})

/** T10 — THE CLUTCH. The pointer leaves the canvas mid-drag. r3f re-injects the capture-time
 *  intersection when a captured pointer misses the mesh, so the E4 key went dead with the button
 *  still down and then jumped on re-entry. Nothing here may drop the grab. */
trace('T10', 'pointer exits the canvas for 500 ms mid-drag, then returns', () => {
  const rig = makeRig(0)
  rig.grab(REF, 0)
  let phi = 0
  const step = () => {
    phi += 0.02
    rig.frame(REF * Math.cos(phi), REF * Math.sin(phi))
  }
  for (let i = 0; i < 30; i++) step()
  const beforeOut = rig.s.target
  // Off canvas: the shell cannot condition an intersection, so it passes null. 500 ms of it.
  for (let i = 0; i < 30; i++) rig.frame(null, null)
  // The TARGET is what must not move while blind. `turn` still travels, and should: it was
  // trailing the hand by the spring's steady-state lag and now finishes arriving where the hand
  // last asked. Freezing that too would be a key that stops dead mid-stroke.
  const duringOut = rig.s.target
  // ...and back, at a wholly different place on the plate (the hand moved while invisible).
  phi += 1.9
  for (let i = 0; i < 40; i++) step()
  const back = worstBackStep(rig.turn)
  rig.release()
  rig.settle(1.5)
  const cap = KEY_FEEL.rateCap * DT * 1.05
  return {
    facts: {
      dropped: rig.s.droppedGrabs,
      degenerate: rig.s.samplesDegenerate,
      resynced: rig.s.samplesDiscarded,
      maxStep: biggestStep(rig.target),
      frozenDrift: Math.abs(duringOut - beforeOut),
    },
    checks: [
      ['grab never dropped', rig.s.droppedGrabs === 0],
      ['intent frozen while blind', Math.abs(duringOut - beforeOut) < 1e-12],
      ['no target step over the rate cap', biggestStep(rig.target) <= cap],
      ['no backward jump on re-entry', back > -0.005],
    ],
  }
})

/** T11 — drive hard into the end stop and let go. Critically damped, so it thuds and stays. */
trace('T11', 'drive hard past turn = 1 for 1 s, then release', () => {
  const rig = makeRig(0.75)
  rig.grab(REF, 0)
  let phi = 0
  for (let i = 0; i < 60; i++) {
    phi += 0.06
    rig.frame(REF * Math.cos(phi), REF * Math.sin(phi))
  }
  const peak = Math.max(...rig.turn)
  rig.release()
  rig.settle(1.5)
  return {
    facts: { peak, endTurn: rig.s.turn, clicks: rig.clicks.length },
    checks: [
      ['never travels past 1 + endSlop', peak <= 1 + KEY_FEEL.endSlop + 1e-9],
      ['exactly 1 click', rig.clicks.length === 1],
      ['at rest above 0.985', rig.s.turn > 0.985],
    ],
  }
})

/** T12 — the capture harness's two contracts. `?wildwake=` must seed the KEY (the component
 *  re-stamps wake from its own turn every frame, so seeding anything else is overwritten within a
 *  tick), and `?sbpose` must still suppress pointer input so a golden capture is deterministic. */
trace('T12', 'harness: ?wildwake seeding and ?sbpose suppression', () => {
  const seeds = [0, 0.34, 0.5, 0.68, 1]
  let exact = true
  let quiet = true
  let held = true
  let seatedOk = true
  for (const v of seeds) {
    const s = createKeyPhysics()
    keySeed(s, v)
    if (s.turn !== v || s.target !== v) exact = false
    if (s.seatedIndex !== nearestDetentIndex(v)) seatedOk = false
    for (let i = 0; i < 60; i++) keyTick(s, DT)
    if (s.clicks !== 0) quiet = false
    // A pose seeded ON a notch must not move at all. A pose seeded BETWEEN notches is expected to
    // walk home (that is T8), so only the notches are gated for stillness.
    if (distToNearestDetent(v) < 1e-9 && Math.abs(s.turn - v) > 1e-6) held = false
  }
  const shell = readFileSync(
    resolve(REPO, 'components/labs/storybook/wild/the-key.tsx'),
    'utf8',
  )
  const hasPoseGate = /pointerPinned|idleClockPinned/.test(shell)
  const hasDebug = /__wildKey/.test(shell) && /wilddebug/.test(shell)
  const hasWildwake = /wildwake/.test(shell)
  return {
    facts: { exact, quiet, held, seatedOk, hasPoseGate, hasDebug, hasWildwake },
    checks: [
      ['seed sets turn/target exactly', exact],
      ['seed sets seatedIndex', seatedOk],
      ['seed fires no phantom click', quiet],
      ['a pose seeded on a notch stays put', held],
      ['shell gates pointer input on a pinned pose', hasPoseGate],
      ['shell still seeds from ?wildwake', hasWildwake],
      ['shell still exposes __wildKey under ?wilddebug', hasDebug],
    ],
  }
})

// ---------------------------------------------------------------------------------------------
// UNIT GATES that no single trace owns
// ---------------------------------------------------------------------------------------------

trace('TX', 'invariants: antisymmetry, hub deadness, teleport rejection', () => {
  // The mapping must cost the same in reverse, or a reader can never undo a turn.
  const fwd = tangentialTurn(REF, 0, REF * Math.cos(0.3), REF * Math.sin(0.3), REF)
  const rev = tangentialTurn(REF * Math.cos(0.3), REF * Math.sin(0.3), REF, 0, REF)
  const antisym = Math.abs(fwd + rev) < 1e-12
  const unity = Math.abs(fwd - 0.3) < 0.02
  // A stroke straight across the face returns nothing, by construction.
  const across = Math.abs(tangentialTurn(-0.2, 0, 0.2, 0, REF)) < 1e-9
  // A teleport is resynced, not integrated, and not fatal.
  const s = createKeyPhysics()
  keyGrabBegin(s, hub(REF, 0), 0)
  keySample(s, hub(REF * Math.cos(0.05), REF * Math.sin(0.05)), DT)
  keySample(s, hub(-4, 4), 2 * DT)
  const afterJump = s.target
  keySample(s, hub(-4 + 0.01, 4), 3 * DT)
  keySample(s, hub(-4 + 0.02, 4), 4 * DT)
  const alive = Math.abs(s.target - afterJump) > 0 || s.hasPrev
  return {
    facts: { fwd, rev, discarded: s.samplesDiscarded, alive },
    checks: [
      ['reverse costs exactly what forward cost', antisym],
      ['a hand at refR turns 1:1 with its own sweep', unity],
      ['a stroke across the hub returns nothing', across],
      ['teleport is rejected once', s.samplesDiscarded === 1],
      ['and the grab survives it', alive === true],
    ],
  }
})

// ---------------------------------------------------------------------------------------------
// RUN
// ---------------------------------------------------------------------------------------------

let failed = 0
const rows = []
for (const t of traces) {
  const out = t.fn()
  const bad = out.checks.filter(([, ok]) => !ok)
  if (bad.length) failed++
  rows.push({ id: t.id, title: t.title, checks: out.checks, facts: out.facts, ok: bad.length === 0 })
}

for (const r of rows) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.title}`)
  for (const [label, ok] of r.checks) if (!ok || VERBOSE) console.log(`        ${ok ? 'ok  ' : 'BAD '} ${label}`)
  if (!r.ok || VERBOSE) {
    const facts = Object.entries(r.facts)
      .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(4) : v}`)
      .join('  ')
    console.log(`        ${facts}`)
  }
}

const total = rows.length
console.log(`\n${total - failed}/${total} traces pass.`)
process.exit(failed ? 1 : 0)
