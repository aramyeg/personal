/**
 * e3s4r4-city.mjs — E3 s4 ROUND-4 "THE RAVEN CITY": the SCENE bench.
 *
 * The two derivation benches answer "can this piece exist?" (e3s4r4-tower.mjs)
 * and "can a cable exist here at all?" (e3s4r4-cable.mjs). This one answers the
 * question the user actually asked, which is a composition question:
 *
 *     is it BIGGER, is it ASYMMETRIC, and does it read as ONE DIAGONAL SWEEP?
 *
 * The r3 board is the bar: two mirror cliffs, apex 0.816 each, 94,782 px^2 of
 * aggregate, and a composition whose axis of symmetry ran straight down the
 * gutter. The verdict was "still needs to be bigger... maybe adding some
 * asymmetry will help". So the gates here are measured against that board, not
 * against a feeling:
 *
 *   D1  aggregate mass  >= the r3 pair
 *   D2  the tallest thing on the page is the TOWER, and it out-tops the keep
 *   D3  MIRROR IS DEAD: left and right masses differ by a stated ratio
 *   D4  ONE DIAGONAL: the mass centroids of the three new pieces fall on a line
 *       running upper-left -> lower-right, and the line's slope is real
 *   D5  the pieces are stacked in DEPTH, not in a row (recession)
 *
 * plus the housekeeping every ch3 piece owes: plan clearance against every
 * occupant on its page, the keep sightline cone, the crop lid, and the
 * measured family beta-ratio ceiling.
 *
 * THE RETIREMENTS this scene makes (and why the room exists at all):
 *   ch3-cliff-l / ch3-cliff-r  the mirror. Dead by user verdict.
 *   ch3-skyline-l              the ring's last survivor; its lamplit yard wall
 *                              job passes to the terraces' own foot.
 *   ch3-ring-tower             the gatehouse stripflap; the terraces stand
 *                              exactly where it did, and do its job bigger.
 *   the winch DISC moves       hubD 0.50 -> 0.52, hubZ 0.30 -> 0.45. Not
 *                              cosmetic: the disc's closed footprint is what
 *                              capped the tower's ribbon at 0.905 of chain
 *                              (see the tower bench header). Moving it
 *                              downstage buys 0.14 of tower.
 *
 * Modes:
 *   node .superpowers/sdd/bench/e3s4r4-city.mjs
 */

import {
  REST, legal, familyMetrics, panelQuads, nodeSpans, project, shoelace, massOf, TOWER,
} from './e3s4r4-tower.mjs'
import { LINE, CABLE, linePoint } from './e3s4r4-cable.mjs'

const PAGE_H = 1.5
const GLOBAL_CAP = 0.0497
const rad = (d) => (d * Math.PI) / 180
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a) => {
  const l = Math.hypot(...a)
  return [a[0] / l, a[1] / l, a[2] / l]
}
const CAM = [0, 1.85, 3.05]

// ---------------------------------------------------------------------------
// THE TERRACED ROOSTS — the right page's answer to a colossus, and the piece
// that kills the mirror. Where the tower is ONE tall crooked stack, the roosts
// are a LOW, WIDE, many-stepped sprawl: five short storeys, each kicked back
// 17-26deg from the one below, so the sheet reads as roof after roof stepping
// away from the reader instead of as a wall. Same family, opposite grammar.
//
// zc 0.19 is a three-way tape measure: the closed run must clear the dispatch
// line's ribbon behind it (front edge -0.17, so the roosts may start at -0.15)
// AND stay 0.02 clear of the dispatch dial's riveted card at z 0.21.
export const TERRACE = {
  side: 'right',
  F: 0.42,
  w: 0.31,
  zc: 0.19,
  rootDeg: 62,
  safe: 0.95,
  camRestDeg: 173,
  stages: [
    { h: 0.116, relDeg: 0, rTop: 0.425, wTop: 0.3 },
    { h: 0.098, relDeg: 12, rTop: 0.44, wTop: 0.285 },
    { h: 0.09, relDeg: 10, rTop: 0.45, wTop: 0.265 },
    { h: 0.077, relDeg: 9, rTop: 0.47, wTop: 0.24 },
    { h: 0.069, relDeg: 7, rTop: 0.485, wTop: 0.215 },
  ],
}

// Plan occupants on ch3 AFTER the round-4 retirements + the winch move.
const OCCUPANTS = [
  { id: 'keep (gutter class)', side: 0, r0: 0, r1: 0.4, z0: -0.36, z1: 0.36 },
  { id: 'winch-disc (moved to hubD 0.52 / hubZ 0.45)', side: -1, r0: 0.39, r1: 0.65, z0: 0.32, z1: 0.58, flat: true },
  { id: 'dial+card', side: 1, r0: 0.49, r1: 0.71, z0: 0.21, z1: 0.51, flat: true },
  { id: 'fringe', side: 0, r0: 0, r1: 0.75, z0: 0.6, z1: 0.72 },
  { id: 'balcony-jut', side: 0, r0: 0, r1: 0.26, z0: 0.3, z1: 0.58 },
]

const PIECES = { tower: TOWER, line: LINE, terrace: TERRACE }

// Keep sightline targets (same set the r3 cliffs bench gated against).
const h2 = REST.beta / 2
const sh = Math.sin(h2)
const ch = Math.cos(h2)
const tilt = Math.PI / 2 - h2
const ct = Math.cos(tilt)
const st = Math.sin(tilt)
const pagePt = (s, r, y, z) => [s * (r * ct - y * st), r * st + y * ct, z]
const zGate = 0.34 + 0.4 * ch
const TARGETS = {
  'keep-hall-facade': [[-0.4 * sh, 0, zGate], [0.4 * sh, 0, zGate], [0.4 * sh, 0.1799, zGate], [-0.4 * sh, 0.1799, zGate]],
  'keep-gallery+loft': [
    [-0.34 * sh, 0.1799, 0.28 + 0.34 * ch], [0.34 * sh, 0.1799, 0.28 + 0.34 * ch],
    [0.34 * sh, 0.5648, 0.28 + 0.34 * ch], [-0.34 * sh, 0.5648, 0.28 + 0.34 * ch],
  ],
  'keep-spire': [[-0.2, 0.5648, 0], [0.2, 0.5648, 0], [0.2, 1.01, 0], [-0.2, 1.01, 0]],
  balcony: [[-0.26 * sh, 0.1799, 0.3], [0.26 * sh, 0.1799, 0.3], [0.26 * sh, 0.1799, 0.58], [-0.26 * sh, 0.1799, 0.58]],
  'winch-disc': [pagePt(-1, 0.39, 0, 0.32), pagePt(-1, 0.65, 0, 0.32), pagePt(-1, 0.65, 0, 0.58), pagePt(-1, 0.39, 0, 0.58)],
  dial: [pagePt(1, 0.49, 0, 0.21), pagePt(1, 0.71, 0, 0.21), pagePt(1, 0.71, 0, 0.51), pagePt(1, 0.49, 0, 0.51)],
}
function rayHitsQuad(target, quad) {
  const [q0, q1, q2, q3] = quad
  const nrm = cross(sub(q1, q0), sub(q3, q0))
  const dir = sub(target, CAM)
  const denom = dot(dir, nrm)
  if (Math.abs(denom) < 1e-12) return false
  const t = dot(sub(q0, CAM), nrm) / denom
  if (t <= 1e-6 || t >= 1 - 1e-4) return false
  const p = [CAM[0] + dir[0] * t, CAM[1] + dir[1] * t, CAM[2] + dir[2] * t]
  let sign = 0
  for (const [a, b] of [[q0, q1], [q1, q2], [q2, q3], [q3, q0]]) {
    const c = dot(cross(sub(b, a), sub(p, a)), nrm)
    if (Math.abs(c) < 1e-12) continue
    if (sign === 0) sign = Math.sign(c)
    else if (Math.sign(c) !== sign) return false
  }
  return true
}
function sampleQuad(q, n = 13) {
  const pts = []
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      const u = i / n
      const v = j / n
      const a = q[0].map((c, k) => c + (q[1][k] - c) * u)
      const b = q[3].map((c, k) => c + (q[2][k] - c) * u)
      pts.push(a.map((c, k) => c + (b[k] - c) * v))
    }
  return pts
}

let failures = 0
const gate = (name, ok, detail) => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log('=== E3 s4 ROUND-4 — THE RAVEN CITY (scene gates) ===')
console.log(`bar to beat: the r3 board — two mirror cliffs, apex 0.816, 94782 px^2 aggregate\n`)

const M = {}
const Q = {}
for (const [id, cfg] of Object.entries(PIECES)) {
  M[id] = familyMetrics(cfg)
  Q[id] = panelQuads(cfg, cfg.side === 'left' ? REST.thetaL : REST.thetaR, REST.beta)
  const px = Q[id].reduce((a, q) => a + shoelace(q.map(project)), 0)
  console.log(
    `  ${id.padEnd(8)} apex ${M[id].apex.toFixed(3)}  length ${M[id].length.toFixed(3)}  r[${M[id].rnear.toFixed(3)}, ${M[id].rfar.toFixed(3)}]  zc ${cfg.zc}  mass ${Math.round(px)} px^2  margin ${((1 - M[id].worst / GLOBAL_CAP) * 100).toFixed(1)}%  ratio ${M[id].betaRatio.toFixed(1)}`
  )
}
console.log('')

// --- P: every piece is legal on its own family's terms ----------------------
for (const [id, cfg] of Object.entries(PIECES)) {
  const { ok } = legal(cfg)
  gate(`P1 ${id} passes every stagedchain family condition`, ok, `fold-flat, cam, wedge, hold, top-down, crop`)
  gate(`P2 ${id} real-time margin >= 5%`, (1 - M[id].worst / GLOBAL_CAP) * 100 >= 5,
    `${((1 - M[id].worst / GLOBAL_CAP) * 100).toFixed(1)}% (worst ${M[id].worst.toFixed(5)} on ${M[id].worstPath})`)
}
console.log('')

// --- S2: plan clearance, piece vs occupant AND piece vs piece ---------------
const MARGIN = 0.015
for (const [id, cfg] of Object.entries(PIECES)) {
  const m = M[id]
  const swept = { r0: m.rnear, r1: m.rfar, z0: m.sweptZ[0], z1: m.sweptZ[1] }
  const closed = { r0: m.rnear, r1: m.rfar, z0: m.footZ[0], z1: m.footZ[1] }
  const side = cfg.side === 'left' ? -1 : 1
  for (const o of OCCUPANTS) {
    if (o.side !== 0 && o.side !== side) continue
    const rect = o.flat ? closed : swept
    const clear = Math.max(o.r0 - rect.r1, rect.r0 - o.r1, o.z0 - rect.z1, rect.z0 - o.z1)
    gate(`S2 ${id} vs ${o.id}${o.flat ? ' (closed footprint)' : ''}`, clear >= MARGIN - 1e-9, `plan clearance ${clear.toFixed(3)}`)
  }
}
// line vs terrace share the right page and the same radial band — the closed
// ribbons must not lie on each other, and the standing sweeps must not cross.
{
  const a = M.line
  const b = M.terrace
  const closedClear = Math.max(b.footZ[0] - a.footZ[1], a.footZ[0] - b.footZ[1])
  const sweptClear = Math.max(b.sweptZ[0] - a.sweptZ[1], a.sweptZ[0] - b.sweptZ[1])
  gate('S2x line vs terrace, closed ribbons do not overlap', closedClear >= MARGIN - 1e-9,
    `closed z line [${a.footZ[0].toFixed(3)}, ${a.footZ[1].toFixed(3)}] vs terrace [${b.footZ[0].toFixed(3)}, ${b.footZ[1].toFixed(3)}] -> ${closedClear.toFixed(3)}`)
  gate('S2y line vs terrace, standing sweeps do not cross', sweptClear >= MARGIN - 1e-9,
    `swept z clearance ${sweptClear.toFixed(3)} (the roosts stand downstage of the line)`)
}
console.log('')

// --- S1/S3: crop lid and the keep's read ------------------------------------
for (const [id, quads] of Object.entries(Q)) {
  const maxY = Math.max(...quads.flat().map((p) => p[1]))
  gate(`S1 ${id} crop: top <= 1.2`, maxY <= 1.2, `maxY ${maxY.toFixed(3)}`)
}
for (const [tname, quad] of Object.entries(TARGETS)) {
  const samples = sampleQuad(quad)
  for (const [id, quads] of Object.entries(Q)) {
    const blocked = samples.filter((s) => quads.some((q) => rayHitsQuad(s, q))).length
    const frac = blocked / samples.length
    const cap = tname.startsWith('keep') ? 0.02 : 0.1
    gate(`S3 ${id} clears ${tname}`, frac <= cap, `${(frac * 100).toFixed(1)}% rays blocked (cap ${(cap * 100).toFixed(0)}%)`)
  }
}
console.log('')

// --- S4: no piece turns its unpainted back to the reader --------------------
for (const [id, quads] of Object.entries(Q)) {
  let worstFacing = -1
  for (const q of quads) {
    const nrm = norm(cross(sub(q[1], q[0]), sub(q[3], q[0])))
    const view = norm(sub(CAM, q[0]))
    worstFacing = Math.max(worstFacing, -dot(nrm, view) * (PIECES[id].side === 'left' ? -1 : 1))
  }
  gate(`S4 ${id} no back-facing storey at rest`, worstFacing < 0, `worst facing dot ${worstFacing.toFixed(3)}`)
}
console.log('')

// ===========================================================================
// THE COMPOSITION GATES — the user's verdict, made measurable.
const massL = Q.tower.reduce((a, q) => a + shoelace(q.map(project)), 0)
const massR = [...Q.line, ...Q.terrace].reduce((a, q) => a + shoelace(q.map(project)), 0)
const total = massL + massR
const R3_AGGREGATE = 94782

gate('D1 aggregate mass beats the r3 board', total >= R3_AGGREGATE,
  `${Math.round(total)} px^2 vs r3 ${R3_AGGREGATE} (${((total / R3_AGGREGATE - 1) * 100).toFixed(0)}%)`)

const apexes = Object.fromEntries(Object.entries(M).map(([k, v]) => [k, v.apex]))
gate('D2 the TOWER is the tallest thing on the spread, and tops the keep',
  apexes.tower > apexes.line && apexes.tower > apexes.terrace && apexes.tower > 1.01,
  `tower ${apexes.tower.toFixed(3)} > keep spire 1.01 > line ${apexes.line.toFixed(3)} > terrace ${apexes.terrace.toFixed(3)}`)

// D3 — THE MIRROR IS DEAD. r3's two cliffs were 51.9k / 46.9k, a 1.11 ratio and
// the same silhouette twice. A real asymmetry needs both a mass imbalance and
// different CONSTRUCTION (stage counts).
const ratio = Math.max(massL, massR) / Math.min(massL, massR)
const stageCounts = Object.values(PIECES).map((p) => p.stages.length)
gate('D3 MIRROR IS DEAD: pages differ in mass AND in construction',
  ratio >= 1.25 && new Set(stageCounts).size === stageCounts.length,
  `left ${Math.round(massL)} vs right ${Math.round(massR)} px^2 (ratio ${ratio.toFixed(2)}), stage counts ${stageCounts.join('/')} all different`)

// D4 — ONE DIAGONAL SWEEP. Take each piece's screen-space mass centroid; the
// three must descend left-to-right along a single line with a real slope.
const centroid = (quads) => {
  let sx = 0
  let sy = 0
  let sa = 0
  for (const q of quads) {
    const p = q.map(project)
    const a = shoelace(p)
    sx += a * (p[0].x + p[1].x + p[2].x + p[3].x) / 4
    sy += a * (p[0].y + p[1].y + p[2].y + p[3].y) / 4
    sa += a
  }
  return { x: sx / sa, y: sy / sa }
}
const cT = centroid(Q.tower)
const cL = centroid(Q.line)
const cR = centroid(Q.terrace)
const ordered = cT.x < cL.x && cL.x < cR.x
const slope = (cR.y - cT.y) / (cR.x - cT.x)
// The connective tissue of the sweep is the CABLE itself: its screen path must
// fall monotonically across the right page, so the eye is handed from the
// tower's crown down to the roosts instead of stopping at the gutter.
let cableFalls = true
let prevPx = null
for (let u = 0; u <= 1.0001; u += 0.05) {
  const i = Math.min(CABLE.length - 2, Math.floor(u * (CABLE.length - 1)))
  const f = u * (CABLE.length - 1) - i
  const uu = CABLE[i][0] + (CABLE[i + 1][0] - CABLE[i][0]) * f
  const vv = CABLE[i][1] + (CABLE[i + 1][1] - CABLE[i][1]) * f
  const px = project(linePoint(LINE, uu, vv, REST.thetaL, REST.thetaR))
  if (prevPx && !(px.y > prevPx.y - 1e-6 && px.x > prevPx.x - 1e-6)) cableFalls = false
  prevPx = px
}
gate('D4 ONE DIAGONAL: tower -> line -> terraces, and the cable falls across it',
  ordered && slope > 0.15 && cableFalls,
  `centroids px (${cT.x.toFixed(0)},${cT.y.toFixed(0)}) -> (${cL.x.toFixed(0)},${cL.y.toFixed(0)}) -> (${cR.x.toFixed(0)},${cR.y.toFixed(0)}), axis slope ${slope.toFixed(2)}, cable monotone down-right`)

// D5 — RECESSION. The three pieces must live at three different depths, so the
// diagonal is a sweep INTO the picture and not a row of flats.
const zs = Object.entries(PIECES).map(([id, p]) => [id, p.zc])
const zSpread = Math.max(...zs.map((z) => z[1])) - Math.min(...zs.map((z) => z[1]))
gate('D5 the sweep recedes in depth, not a row of flats', zSpread >= 0.35,
  `hinge depths ${zs.map(([id, z]) => `${id} ${z}`).join(', ')} -> spread ${zSpread.toFixed(2)}`)

// D6 — the cable's own diagonal, in world height, tying the two pages together.
const cableHi = linePoint(LINE, CABLE[0][0], CABLE[0][1], REST.thetaL, REST.thetaR)
const cableLo = linePoint(LINE, 1, CABLE[CABLE.length - 1][1], REST.thetaL, REST.thetaR)
// The line has to LAND: it leaves under the tower's crown, falls across the
// page, and finishes down among the roosts' own roofline rather than floating
// above it — otherwise the diagonal stops in mid-air.
gate('D6 the dispatch line falls from under the tower and LANDS in the roosts',
  apexes.tower > cableHi[1] &&
    cableHi[1] > cableLo[1] &&
    cableLo[1] <= apexes.terrace * 1.05 &&
    cableLo[1] >= apexes.terrace * 0.35,
  `tower ${apexes.tower.toFixed(2)} -> cable ${cableHi[1].toFixed(2)} -> ${cableLo[1].toFixed(2)}, landing among roosts whose crest is ${apexes.terrace.toFixed(2)}`)

const maxRatio = Math.max(...Object.values(M).map((m) => m.betaRatio))
console.log(`\n  aggregate ${Math.round(total)} px^2 (r3 board ${R3_AGGREGATE})`)
console.log(`  measured beta-ratio max ${maxRatio.toFixed(2)} -> family ceiling pin ${Math.ceil(maxRatio * 1.1)}`)
console.log(`\n${failures === 0 ? 'ALL GATES GREEN' : failures + ' GATE(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
