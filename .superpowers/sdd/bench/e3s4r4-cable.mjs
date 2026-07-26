/**
 * e3s4r4-cable.mjs — E3 s4 ROUND-4: deriving THE DISPATCH LINE, the working
 * cable with letter-baskets riding it, and the reader's hand on it.
 *
 * ========================================================================
 * PART 1 — THREE DEAD ANSWERS, EACH KILLED BY A MEASUREMENT
 *
 * 1. A THREAD BETWEEN TWO PAGE ANCHORS. A left anchor at radial d1 and a right
 *    anchor at radial d2 are |d1 - d2| apart at book-closed and d1 + d2 apart
 *    at rest. For a cable that reads across the spread that is ~1.2 of SLACK at
 *    close. Real books do hang threads across the gutter — never with a slack of
 *    a whole page. The loop has nowhere to go.
 *
 * 2. A DRESS OVERHANG OFF THE TOWER'S CROWN, reaching over the gutter. This is
 *    the backdrop-wings law: paper reaching toward the spine has a wedge limit
 *    of rnear*tan(beta), and rnear -> 0 at the gutter. Dead by the same
 *    measurement that killed the E1.5 bailey wings and the s4 ring plates.
 *
 * 3. A GUTTER-ANCHORED DIE-CUT V-FOLD — the one that should have worked, and
 *    the interesting failure. A v-fold IS spine-anchored, geared to beta, and
 *    the class was never near the height wall. Die-cut down to a cable line, one
 *    wide v-fold would span the whole spread. MEASURED HERE (mode `vfold`) and
 *    REJECTED: a v-fold's crest does not hold still. Its crease elevation
 *    lambda(beta) runs from 174.5deg at close to 104.7deg at rest, so the crest
 *    RAKES through
 *        z = apexZ + height * vDir * cos(lambda(beta))
 *    — a depth excursion of ~1.25 x height over the turn. The shipped donor
 *    (ch2-backdrop, the book's tallest v-fold) measures a 1.04-deep rake, and it
 *    gets away with it because ch2's spine is EMPTY. ch3's is not: the crease
 *    line lives at x = 0 and climbs to y ~0.9, which is precisely the volume the
 *    dispatch keep occupies (radial 0..0.40, z +-0.34, up to 1.01). Any v-fold
 *    tall enough to carry a cable over the keep's crown spends most of the turn
 *    raking THROUGH the keep. No (apexZ, phi, rho, vDir) escapes it: the rake is
 *    proportional to height, and the height is the whole point.
 *
 *    HOUSE LAW EARNED HERE: **the keep owns the gutter.** On a spread with a
 *    tall spine-anchored stack, the gutter class is spent — a second gutter-class
 *    piece must be SHORT (rake ~ height) or seated ON the stack, never a tall
 *    free-standing span.
 *
 * ========================================================================
 * PART 2 — WHAT SHIPS: THE PAGE-ROOTED DIE-CUT LINE
 *
 * If paper cannot cross the gutter at height, the cable crosses it the way a
 * cut-paper book crosses anything: the reader's eye does. The line is built
 * OUTBOARD of the keep on the pages that have room for it —
 *
 *   LEFT  the line leaves the crooked tower's own crown storey (die-cut into
 *         the tower's sheet: a gantry arm and the first stretch of cable — free,
 *         it is the tower's paper);
 *   GUTTER the keep's spire crown carries the painted pulley + lantern the line
 *         runs over (art on a piece that already stands there);
 *   RIGHT a NEW page-rooted DIE-CUT PANEL — the dispatch line proper — carrying
 *         the long swooping run, the basket lanterns, and the reader's basket,
 *         down to the terraced roosts.
 *
 * The right panel is a stagedchain (the tower's own family), so its physics is
 * already proven; what is new is the DIE-CUT CABLE POLYLINE in panel (u, v) and
 * the RIDER that travels it.
 *
 * THE RIDER is an IN-PLANE translation inside the panel — the keepwinch
 * counterweight idiom exactly (a sash-weight descending WITHIN the hall
 * flank-wall plane: zero off-plane reach, winding-insensitive, wedge-contained
 * for free). The reader's drag drives s along the polyline; the basket's world
 * position is the panel's own bilinear map of that point, so it inherits
 * fold-flat from the sheet and may be HELD anywhere through a page turn
 * (the liftflap persistence law: shown = user state x E(beta) — here the
 * envelope is the panel's own cam, so no separate gating is needed at all).
 *
 * PAPER PEDIGREE: Birmingham mech 116's automatic strip drives the panel;
 * the rider is a slot-and-slider (mech 45-48) cut along the cable.
 *
 * Modes:
 *   node .superpowers/sdd/bench/e3s4r4-cable.mjs         gates for the shipped line
 *   node .superpowers/sdd/bench/e3s4r4-cable.mjs vfold   the rejected gutter v-fold, measured
 */

import { REST, legal, familyMetrics, panelQuads, nodeSpans, project, shoelace, massOf } from './e3s4r4-tower.mjs'

const PAGE_W = 1.15
const PAGE_H = 1.5
const GLOBAL_CAP = 0.0497
const DTHETA = 0.06437
const rad = (d) => (d * Math.PI) / 180
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

// ---------------------------------------------------------------------------
// THE SHIPPED LINE PANEL. A near-upright stagedchain on the RIGHT page,
// UPSTAGE of everything (zc -0.07), spanning the page outboard of the keep.
//   * rnear 0.415 clears the keep's radial 0.40 by 0.015 — the closest a
//     page-rooted sheet may legally come to the gutter here;
//   * the closed ribbon runs back to z -0.75 exactly on the page edge, and its
//     front edge at -0.07 leaves 0.02 clear of the terraces' closed footprint;
//   * two stages, the upper one kicked forward 9deg, so the sheet's top edge
//     leans downstage and the die-cut cable reads as hanging in front of the
//     sky rather than pasted on a wall.
export const LINE = {
  side: 'right',
  F: 0.415,
  w: 0.315,
  zc: -0.125,
  rootDeg: 82,
  safe: 0.95,
  camRestDeg: 173,
  stages: [
    { h: 0.36, relDeg: 0, rTop: 0.415, wTop: 0.315 },
    { h: 0.265, relDeg: 9, rTop: 0.415, wTop: 0.315 },
  ],
}

/**
 * THE DIE-CUT CABLE in panel (u, v): u runs radially INBOARD->OUTBOARD across
 * the sheet (u=0 at rnear, the gutter side), v climbs the chain from the foot.
 * The line enters high at the gutter side — where the eye has just followed it
 * off the keep's crown — and sags away outboard to the terraces. Everything off
 * this polyline (plus the masts and basket lanterns) is cut away.
 */
export const CABLE = [
  [0.0, 0.965], [0.12, 0.894], [0.25, 0.822], [0.38, 0.752], [0.5, 0.692],
  [0.62, 0.635], [0.74, 0.584], [0.86, 0.535], [1.0, 0.48],
]
/** Fixed basket lanterns (die-cut, painted) and the reader's own basket start. */
export const BASKETS = [0.2, 0.47, 0.72]
export const RIDER_HOME = 0.06

/** Panel-(u, v) -> world on the shipped line, using the chain's own trapezoid
 *  map. v is measured over the WHOLE chain length, so a rider crosses the
 *  storey joint without a seam. */
export function linePoint(geom, u, v, thetaL, thetaR) {
  const quads = panelQuads(geom, geom.side === 'left' ? thetaL : thetaR, clamp(thetaL - thetaR, 0, Math.PI))
  const total = geom.stages.reduce((a, s) => a + s.h, 0)
  let below = 0
  let k = 0
  for (; k < geom.stages.length - 1; k++) {
    if (below + geom.stages[k].h >= v * total) break
    below += geom.stages[k].h
  }
  const local = (v * total - below) / geom.stages[k].h
  const q = quads[k] // [inner-base, outer-base, outer-top, inner-top]
  const a = q[0].map((c, i) => c + (q[1][i] - c) * u)
  const b = q[3].map((c, i) => c + (q[2][i] - c) * u)
  return a.map((c, i) => c + (b[i] - c) * local)
}

// ---------------------------------------------------------------------------
// THE REJECTED GUTTER V-FOLD, kept measurable (part 1, item 3).
const creaseElevation = (phi, rho, beta) => {
  const cb2 = Math.cos(beta / 2)
  const r = Math.sqrt(Math.cos(phi) ** 2 + Math.sin(phi) ** 2 * cb2 * cb2)
  const bigPhi = Math.atan2(Math.sin(phi) * cb2, Math.cos(phi))
  return bigPhi + Math.acos(clamp(Math.cos(rho) / r, -1, 1))
}
/** The crest's depth rake over the turn — the number that kills the idea. */
export function crestRake(g) {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i <= 400; i++) {
    const beta = (i / 400) * REST.beta
    const lam = creaseElevation(rad(g.phiDeg), rad(g.rhoDeg), beta)
    const z = g.apexZ + g.height * g.vDir * Math.cos(lam)
    lo = Math.min(lo, z)
    hi = Math.max(hi, z)
  }
  return { lo, hi, rake: hi - lo }
}
export const V_DONOR = { id: 'ch2-backdrop', apexZ: -0.45, phiDeg: 84, rhoDeg: 88.5, width: 1.65, height: 0.94, vDir: -1 }

// ---------------------------------------------------------------------------
let failures = 0
const gate = (name, ok, detail) => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const IS_ENTRY = (process.argv[1] ?? '').split('\\').join('/').endsWith('e3s4r4-cable.mjs')
const mode = IS_ENTRY ? (process.argv[2] ?? 'main') : 'noop'

if (mode === 'vfold') {
  console.log('=== the REJECTED gutter v-fold: crest rake vs the keep volume ===')
  console.log('keep occupies radial 0..0.40, z -0.34..0.34, up to y 1.01 — the crease line lives at x=0 and climbs through it.')
  console.log(`donor ${V_DONOR.id} (the book's tallest shipped v-fold): rake ${crestRake(V_DONOR).rake.toFixed(3)} in z`)
  for (const height of [1.0, 0.9, 0.8, 0.6, 0.4, 0.25]) {
    for (const phiDeg of [86, 84, 80]) {
      const r = crestRake({ apexZ: 0, phiDeg, rhoDeg: 88.5, height, vDir: -1 })
      // A crest that must clear the keep (y >= 0.4 needs height >= ~0.41) and
      // whose rake exceeds the free lane depth (0.75 - 0.355 = 0.395) can never
      // be placed: shift apexZ and one end or the other leaves the lane.
      const fits = r.rake <= 0.395
      console.log(`  h ${height.toFixed(2)} phi ${phiDeg}: crest y ~${(height * Math.sin(creaseElevation(rad(phiDeg), rad(88.5), REST.beta))).toFixed(2)}  rake ${r.rake.toFixed(3)}  ${fits ? 'FITS the free lane' : 'cannot be placed (rake > lane 0.395)'}`)
    }
  }
  console.log('\nCONCLUSION: rake ~ 1.25 x height, so only spans under ~0.32 tall fit the free lane —')
  console.log('too short to carry a cable over anything. THE KEEP OWNS THE GUTTER.')
  process.exit(0)
}

if (IS_ENTRY) {
  console.log('=== E3 s4 ROUND-4 — THE DISPATCH LINE (page-rooted die-cut cable + rider) ===')
  const { ok, m, maxY } = legal(LINE)
  const spans = nodeSpans(LINE)
  console.log(`--- line: length ${m.length.toFixed(3)} rnear ${m.rnear.toFixed(3)} rfar ${m.rfar.toFixed(3)} zc ${LINE.zc} ---`)
  console.log(`    apex(rest) ${m.apex.toFixed(3)}  topY ${maxY.toFixed(3)}  swept z [${m.sweptZ[0].toFixed(3)}, ${m.sweptZ[1].toFixed(3)}]  mass ${Math.round(massOf(LINE))} px^2\n`)

  gate('L1 the line panel is a legal stagedchain', ok, `all family conditions hold`)
  gate('L2 folds DEAD FLAT at close', m.offMax < 1e-12, `max off-page ${m.offMax.toExponential(1)}`)
  gate('L3 real-time worst step < GLOBAL_CAP', m.worst < GLOBAL_CAP,
    `${m.worst.toFixed(5)} (${m.worstPath}) margin ${((1 - m.worst / GLOBAL_CAP) * 100).toFixed(1)}%`)
  gate('L4 clears the keep radially (gutter belongs to the keep)', m.rnear >= 0.415 - 1e-9,
    `rnear ${m.rnear.toFixed(3)} vs keep radial 0.40 (+0.015 margin)`)
  gate('L5 closed footprint on the page, clear of the terraces at z -0.11',
    m.footZ[0] >= -PAGE_H / 2 - 1e-9 && m.footZ[1] <= -0.11 - 0.015 + 1e-9,
    `closed z [${m.footZ[0].toFixed(3)}, ${m.footZ[1].toFixed(3)}]`)
  gate('L6 stays inside the closing wedge', m.wedgeWorst <= 1e-9, `worst excursion ${m.wedgeWorst.toFixed(4)}`)
  gate('L7 crop ceiling: top <= 1.2', maxY <= 1.2, `topY ${maxY.toFixed(3)}`)

  // --- the die-cut ---------------------------------------------------------
  const inside = CABLE.every(([u, v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1)
  gate('L8 die-cut cable lies inside the sheet', inside,
    `${CABLE.length} nodes, v in [${Math.min(...CABLE.map((c) => c[1])).toFixed(2)}, ${Math.max(...CABLE.map((c) => c[1])).toFixed(2)}]`)
  const drop = CABLE[0][1] - CABLE[CABLE.length - 1][1]
  const monotone = CABLE.every((c, i) => i === 0 || c[1] <= CABLE[i - 1][1] + 1e-9)
  gate('L9 ONE diagonal sweep: high at the gutter, low at the terraces', drop > 0.4 && monotone,
    `drops ${(drop * 100).toFixed(0)}% of the sheet, monotone outboard`)

  // The cable's world height at its two ends — the composition claim.
  const hi = linePoint(LINE, CABLE[0][0], CABLE[0][1], REST.thetaL, REST.thetaR)
  const lo = linePoint(LINE, 1, CABLE[CABLE.length - 1][1], REST.thetaL, REST.thetaR)
  gate('L10 the line descends across the page in WORLD height too', hi[1] > lo[1] + 0.15,
    `gutter end y ${hi[1].toFixed(3)} -> terrace end y ${lo[1].toFixed(3)} (drop ${(hi[1] - lo[1]).toFixed(3)})`)

  // --- the rider -----------------------------------------------------------
  const at = (s) => {
    const i = Math.min(CABLE.length - 2, Math.floor(s * (CABLE.length - 1)))
    const f = s * (CABLE.length - 1) - i
    return [CABLE[i][0] + (CABLE[i + 1][0] - CABLE[i][0]) * f, CABLE[i][1] + (CABLE[i + 1][1] - CABLE[i][1]) * f]
  }
  let riderOutside = 0
  for (const s of [...BASKETS, RIDER_HOME]) {
    const [u, v] = at(s)
    if (u < 0 || u > 1 || v < 0 || v > 1) riderOutside++
  }
  gate('L11 every basket sits ON the die-cut, inside the sheet', riderOutside === 0,
    `${BASKETS.length} lanterns + the reader's basket`)

  // THE PERSISTENCE PROOF: a rider held at ANY station still folds dead flat,
  // because it is in-plane and the sheet's own cam is its envelope.
  let heldOff = 0
  for (let s = 0; s <= 1.0001; s += 0.025) {
    const [u, v] = at(s)
    heldOff = Math.max(heldOff, Math.abs(linePoint(LINE, u, v, Math.PI / 2, Math.PI / 2)[0]))
  }
  gate('L12 ANY held rider position folds DEAD FLAT (persistence law)', heldOff < 1e-12,
    `worst over 41 held stations: ${heldOff.toExponential(1)}`)

  // L13 — a rider is a CONSTANT-WEIGHT bilinear combination of the sheet's four
  // corners, so its per-station displacement is a convex combination of theirs
  // and can never exceed the largest. Measured on the sheet's OWN clock (the
  // eased 240-station turn, the binding move-out path) so the two compare.
  const easeT = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2)
  const stepsOf = (u, v) => {
    let w = 0
    let prev = null
    for (let i = 0; i <= 240; i++) {
      const th = easeT(i / 240) * Math.PI
      const q = linePoint(LINE, u, v, th, th - (Math.PI - th))
      if (prev) w = Math.max(w, Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]))
      prev = q
    }
    return w
  }
  let riderWorst = 0
  for (let s = 0; s <= 1.0001; s += 0.05) riderWorst = Math.max(riderWorst, stepsOf(...at(Math.min(1, s))))
  const cornerWorst = Math.max(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => stepsOf(u, v)))
  gate('L13 a held rider never outruns the sheet it rides', riderWorst <= cornerWorst + 1e-9,
    `rider ${riderWorst.toFixed(5)} <= sheet corners ${cornerWorst.toFixed(5)} on the same clock`)

  // L14 — the reader's stroke has to be worth doing: the basket must travel a
  // visible ARC across the spread, not twitch.
  let travelPx = 0
  let prevPx = null
  for (let s = RIDER_HOME; s <= 1.0001; s += 0.02) {
    const px = project(linePoint(LINE, ...at(Math.min(1, s)), REST.thetaL, REST.thetaR))
    if (prevPx) travelPx += Math.hypot(px.x - prevPx.x, px.y - prevPx.y)
    prevPx = px
  }
  gate('L14 the reader stroke sends the basket a real distance', travelPx >= 150,
    `${travelPx.toFixed(0)} px of screen arc at the pinned camera (frame is 1600 wide)`)

  console.log(`\n  the rejected gutter v-fold, for the record: donor rake ${crestRake(V_DONOR).rake.toFixed(3)} in z (run \`vfold\` mode)`)
  console.log(`\n${failures === 0 ? 'ALL GATES GREEN' : failures + ' GATE(S) FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}
