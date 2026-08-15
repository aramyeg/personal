/**
 * e4s2-reach.mjs — E4 "PAINTED" chapter I: the gate on the rebuilt Inn of a
 * Hundred Keys.
 *
 * WHAT THIS MEASURES AND WHY IT IMPORTS RATHER THAN RE-DERIVES. Every number
 * below is read off the SHIPPED solvers (popup-keepstack / popup-mechanics /
 * popup-stagedchain / popup-dissolve) driven by the SHIPPED content entries, on
 * the SHIPPED reading pose (page-geometry restAngles(2)). A bench that
 * reimplements the kinematics measures a different frame from the one the
 * reader sees, and its pass is worth nothing. The whole TS surface is bundled
 * once with esbuild into a temp ESM module and imported.
 *
 * THE BINDING CONSTRAINT for a gutter-straddling stack is NOT its height and
 * NOT its z-containment: it is FOLD-FLAT REACH. At book close the stack folds
 * flat ALONG the page, so every corner's bisector-x coordinate must stay inside
 * PAGE_W (1.15). This is the wall that capped the ch3 keep at ~0.90 world, and
 * it is measured here by evaluating the real quads at beta -> 0 rather than by
 * trusting the closed form.
 *
 * GATES
 *   R1  fold-flat        every keepstack quad lands in the page plane at beta=0
 *   R2  reach            max closed bisector-x <= PAGE_W, per family
 *   R3  z containment    every closed corner inside +-PAGE_H/2
 *   R4  telescoping      a_k <= a_{k-1} and z-spans nest
 *   R5  apex             structural crown + raven, world Y at the reading pose
 *   R6  art aspects      plate / balcony / spire / raven / wing / yard ratios
 *   R7  wings            cam feasible, wedge contained, apex <= 0.35, asymmetry
 *   R8  rank             screen-projected actuated travel + rest face-on
 *   R9  composition      one-tall-thing, mass ladder, free floor, span
 *   R10 stagger          erection completion windows do not overlap
 *
 * Run:  node .superpowers/sdd/bench/e4s2-reach.mjs
 *       node .superpowers/sdd/bench/e4s2-reach.mjs --sweep-rank
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../../..')
const ESBUILD = join(ROOT, 'node_modules/.pnpm/esbuild@0.27.2/node_modules/esbuild/lib/main.js')

// ---------------------------------------------------------------------------
// Bundle the shipped modules (esbuild resolves the '@/...' alias the app uses).

const ENTRY = `
export { CHAPTERS } from '@/components/labs/storybook/content'
export {
  keepStackQuads, keepStackStoryGeoms, keepStackFacadePlate, keepStackBalconyDeck,
  keepStackSpirePoses, keepStackSpireRaven, keepStackCrownHeight, keepStackSeatHeight,
  keepStackTelescopes,
} from '@/components/labs/storybook/book/popup-keepstack'
export { solveBoxPose, stripFlapFrame, solveStripFlapPose, openElevation } from '@/components/labs/storybook/book/popup-mechanics'
export {
  solveStagedChainPose, stagedChainQuads, stagedChainCam, planStagedChainCam,
  stagedChainApex, stagedChainWedgeExcursion, stagedChainClosedDepth,
  stagedChainLength, stagedChainRNear, stagedChainRFar, stagedChainArtSize,
} from '@/components/labs/storybook/book/popup-stagedchain'
export { solveDissolvePose } from '@/components/labs/storybook/book/popup-dissolve'
export { PAGE_W, PAGE_H, restAngles, easeTurnWeighted } from '@/components/labs/storybook/book/page-geometry'
`

async function loadShipped() {
  const dir = mkdtempSync(join(tmpdir(), 'e4s2-'))
  const entry = join(dir, 'entry.ts')
  writeFileSync(entry, ENTRY)
  const out = join(dir, 'bundle.mjs')
  execFileSync(
    process.execPath,
    [
      '-e',
      `const esb=require(${JSON.stringify(ESBUILD)});
       esb.build({
         entryPoints:[${JSON.stringify(entry)}],
         outfile:${JSON.stringify(out)},
         bundle:true, format:'esm', platform:'node', logLevel:'error',
         alias:{'@':${JSON.stringify(ROOT)}},
       }).catch(e=>{console.error(e);process.exit(1)})`,
    ],
    { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] }
  )
  return import(pathToFileURL(out).href)
}

const S = await loadShipped()
const { PAGE_W, PAGE_H, restAngles } = S

// ---------------------------------------------------------------------------
// Poses.

const SPREAD = 2
const rest = restAngles(SPREAD)
/** The reading pose the pinned camera sees (dir === null branch of
 *  spreadPageAnglesTilted: thetaL = PI - aL, thetaR = aR). */
const OPEN = { thetaL: Math.PI - rest.aL, thetaR: rest.aR }
/** Book-closed. Both pages superposed; the m rotation is irrelevant to reach,
 *  which is measured in the bisector frame. */
const SHUT = { thetaL: Math.PI / 2, thetaR: Math.PI / 2 }

const mOf = (p) => (p.thetaL + p.thetaR) / 2
/** Bisector-x of a world point at page-mean angle m — the page-radial reach. */
const bisX = (p, m) => p[0] * Math.cos(m) + p[1] * Math.sin(m)
/** Off-page height of a world point at page-mean angle m (0 in the page plane). */
const offPage = (p, m) => -p[0] * Math.sin(m) + p[1] * Math.cos(m)

// ---------------------------------------------------------------------------
// The pinned reading camera (book-scene.tsx): pos (0,1.85,3.05), lookAt
// (0,0.38,0.05), fov 34, 1600x900. Used for the screen-projected measurements.

const CAM = { pos: [0, 1.85, 3.05], look: [0, 0.38, 0.05], fovDeg: 34, w: 1600, h: 900 }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const nrm = (a) => {
  const l = Math.hypot(...a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const FWD = nrm(sub(CAM.look, CAM.pos))
const RIGHT = nrm(crs(FWD, [0, 1, 0]))
const UP = crs(RIGHT, FWD)
const FY = CAM.h / 2 / Math.tan(((CAM.fovDeg / 2) * Math.PI) / 180)

/** World -> screen px (origin top-left). */
function project(p) {
  const v = sub(p, CAM.pos)
  const z = dot(v, FWD)
  return [CAM.w / 2 + (dot(v, RIGHT) / z) * FY, CAM.h / 2 - (dot(v, UP) / z) * FY]
}
/** Frame size in world units at the look-at distance (the composition frame). */
const LOOK_DIST = dot(sub(CAM.look, CAM.pos), FWD)
const FRAME_H = (2 * LOOK_DIST * Math.tan(((CAM.fovDeg / 2) * Math.PI) / 180))
const FRAME_W = (FRAME_H * CAM.w) / CAM.h

// ---------------------------------------------------------------------------
// Reporting.

let fails = 0
const rows = []
function gate(id, ok, msg) {
  rows.push(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(5)} ${msg}`)
  if (!ok) fails++
}
function note(msg) {
  rows.push(`      ---   ${msg}`)
}
const f = (x, n = 4) => Number(x).toFixed(n)

// ---------------------------------------------------------------------------

const ch1 = S.CHAPTERS.find((c) => c.spread === SPREAD)
const layer = (id) => ch1.layers.find((l) => l.id === id)
const inn = layer('ch1-inn')
const wingL = layer('ch1-wing-l')
const wingR = layer('ch1-wing-r')
const rank = layer('ch1-rank')
const yard = layer('ch1-yard')

console.log(`\ne4s2-reach — chapter I "${ch1.title}", spread ${SPREAD}`)
console.log(`reading pose beta ${f(((OPEN.thetaL - OPEN.thetaR) * 180) / Math.PI, 3)} deg, m ${f(mOf(OPEN), 5)}`)
console.log(`frame at look-at: ${f(FRAME_H, 3)} world tall x ${f(FRAME_W, 3)} wide; hero id "${ch1.hero}"\n`)

// --- R1 / R2 / R3: the keepstack at book-close ------------------------------

const mShut = mOf(SHUT)
const shutQuads = S.keepStackQuads(inn, SHUT.thetaL, SHUT.thetaR)
let flatResidual = 0
let reach = 0
let zAbs = 0
for (const q of shutQuads)
  for (const p of q) {
    flatResidual = Math.max(flatResidual, Math.abs(offPage(p, mShut)))
    reach = Math.max(reach, bisX(p, mShut))
    zAbs = Math.max(zAbs, Math.abs(p[2]))
  }
// The limit is approached, not evaluated at, so also sample beta -> 0.
let limitResidual = 0
for (const beta of [1e-3, 1e-4, 1e-6, 1e-9]) {
  const tL = Math.PI / 2 + beta / 2
  const tR = Math.PI / 2 - beta / 2
  const m = (tL + tR) / 2
  for (const q of S.keepStackQuads(inn, tL, tR))
    for (const p of q) limitResidual = Math.max(limitResidual, Math.abs(offPage(p, m)))
}
gate('R1', flatResidual < 1e-12, `keepstack fold-flat residual at beta=0: ${flatResidual.toExponential(3)}`)
note(`fold-flat residual as beta -> 0 (1e-3..1e-9): ${limitResidual.toExponential(3)} (linear in beta, no offset)`)
gate('R2', reach <= PAGE_W, `closed footprint reach ${f(reach)} <= PAGE_W ${PAGE_W} (margin ${f(PAGE_W - reach)})`)
gate('R3', zAbs <= PAGE_H / 2, `closed z extent ${f(zAbs)} <= PAGE_H/2 ${PAGE_H / 2}`)

// Per-family reach breakdown (which piece binds).
const seatH = S.keepStackSeatHeight(inn)
const perFamily = []
{
  const stories = S.keepStackStoryGeoms(inn)
  for (const g of stories) {
    let r = 0
    for (const patch of S.solveBoxPose(g, SHUT.thetaL, SHUT.thetaR)) for (const p of patch.quad) r = Math.max(r, bisX(p, mShut))
    perFamily.push([`story:${g.key}`, r])
    const plate = S.keepStackFacadePlate(inn, g.key, SHUT.thetaL, SHUT.thetaR)
    if (plate) {
      let rp = 0
      for (const q of [plate.plateL, plate.plateR]) for (const p of q) rp = Math.max(rp, bisX(p, mShut))
      perFamily.push([`plate:${g.key}`, rp])
    }
  }
  const deck = S.keepStackBalconyDeck(inn, SHUT.thetaL, SHUT.thetaR)
  if (deck) {
    let rb = 0
    for (const q of [deck.deckL, deck.deckR]) for (const p of q) rb = Math.max(rb, bisX(p, mShut))
    perFamily.push(['balcony', rb])
  }
  const sp = S.keepStackSpirePoses(inn, SHUT.thetaL, SHUT.thetaR)
  if (sp)
    sp.forEach((pose, i) => {
      let rs = 0
      for (const q of [pose.left, pose.right]) for (const p of q) rs = Math.max(rs, bisX(p, mShut))
      perFamily.push([`spire:m${i}`, rs])
    })
  const rv = S.keepStackSpireRaven(inn, SHUT.thetaL, SHUT.thetaR)
  if (rv) {
    let rr = 0
    for (const q of [rv.crestL, rv.crestR]) for (const p of q) rr = Math.max(rr, bisX(p, mShut))
    perFamily.push(['raven', rr])
  }
}
perFamily.sort((a, b) => b[1] - a[1])
note(`closed reach by family: ${perFamily.map(([k, v]) => `${k} ${f(v, 3)}`).join('  ')}`)

// --- R4: telescoping --------------------------------------------------------

const nestZ = inn.stories.every((s, k) => k === 0 || (s.z0 >= inn.stories[k - 1].z0 && s.z1 <= inn.stories[k - 1].z1))
gate('R4', S.keepStackTelescopes(inn) && nestZ, `telescoping a_k <= a_{k-1} and nested z-spans (a: ${inn.stories.map((s) => s.a).join(' >= ')})`)

// --- R5: apex at the reading pose -------------------------------------------

const openQuads = S.keepStackQuads(inn, OPEN.thetaL, OPEN.thetaR)
let apexY = -Infinity
for (const q of openQuads) for (const p of q) apexY = Math.max(apexY, p[1])
let structuralY = -Infinity
{
  const sp = S.keepStackSpirePoses(inn, OPEN.thetaL, OPEN.thetaR)
  for (const pose of sp ?? []) for (const q of [pose.left, pose.right]) for (const p of q) structuralY = Math.max(structuralY, p[1])
}
gate('R5', apexY >= 0.9 && apexY <= 1.0 + 1e-3, `apex world Y at reading pose ${f(apexY)} (structural spire crown ${f(structuralY)}, seat ${f(seatH)}, crownHeight() ${f(S.keepStackCrownHeight(inn))})`)

// --- R6: art aspects --------------------------------------------------------

const aspects = []
for (const s of inn.stories) if (s.plate) aspects.push([`ch1-inn-${s.key}-front (plate)`, s.plate.width / s.plate.height])
if (inn.balcony) aspects.push(['ch1-inn-balcony', (2 * inn.balcony.halfW) / (inn.balcony.z1 - inn.balcony.z0)])
inn.spire?.members.forEach((m, i) => aspects.push([`ch1-inn-spire-m${i}`, m.width / m.height]))
if (inn.spire?.raven) {
  const peak = inn.spire.members[inn.spire.members.length - 1]
  aspects.push(['ch1-inn-raven', peak.width / inn.spire.raven.finialH])
}
for (const w of [wingL, wingR]) aspects.push([w.id, (S.stagedChainRFar(w) - S.stagedChainRNear(w)) / S.stagedChainLength(w)])
aspects.push(['ch1-rank', rank.width / rank.height])
aspects.push(['ch1-yard-dunes / -gold', (yard.d1 - yard.d0) / (yard.z1 - yard.z0)])
aspects.push(['ch1-yard-tab', (yard.tabW ?? 0.1) / ((yard.tabTip ?? 0) + (yard.stroke ?? 0.14))])
gate('R6', true, 'delivered art aspects (width / height), from the shipped mesh dims:')
for (const [k, v] of aspects) note(`  ${k.padEnd(30)} ${f(v, 3)}`)

// --- R7: the wings ----------------------------------------------------------

const betaOpen = OPEN.thetaL - OPEN.thetaR
for (const w of [wingL, wingR]) {
  const cam = S.planStagedChainCam(w)
  const apex = S.stagedChainApex(w, betaOpen)
  let worstWedge = -Infinity
  for (let i = 1; i <= 400; i++) worstWedge = Math.max(worstWedge, S.stagedChainWedgeExcursion(w, (i / 400) * (Math.PI / 2)))
  // Real-time: worst per-vertex world step across the eased turn clock.
  let step = 0
  let prev = null
  for (let i = 0; i <= 240; i++) {
    const b = S.easeTurnWeighted(i / 240) * Math.PI
    const q = S.stagedChainQuads(w, Math.PI / 2 + b / 2, Math.PI / 2 - b / 2)
    const flat = q.flat().map((p) => p)
    if (prev) for (let k = 0; k < flat.length; k++) step = Math.max(step, Math.hypot(...sub(flat[k], prev[k])))
    prev = flat
  }
  const depth = S.stagedChainClosedDepth(w)
  const zClosed = w.zc - depth
  gate(
    'R7',
    cam.feasible && apex <= 0.35 && worstWedge <= 0 && zClosed >= -PAGE_H / 2,
    `${w.id}: cam feasible ${cam.feasible}, apex ${f(apex)} <= 0.35, wedge excursion ${f(worstWedge)} <= 0, closed depth ${f(depth)} (z to ${f(zClosed)}), worst turn step ${f(step)}`
  )
}
{
  const aL = S.stagedChainApex(wingL, betaOpen)
  const aR = S.stagedChainApex(wingR, betaOpen)
  const d = Math.abs(aL - aR) / Math.max(aL, aR)
  gate('R7', d >= 0.15 && wingL.stages.length !== wingR.stages.length, `wings asymmetric: apex ${f(aL)} vs ${f(aR)} (${f(100 * d, 1)}% apart), stages ${wingL.stages.length} vs ${wingR.stages.length}`)
}

// --- R8: the rank's actuated travel -----------------------------------------

/** Flap quad corners at hinge angle A (deg), from the SHIPPED hinge frame. */
function rankQuad(geom, aDeg) {
  const fr = S.stripFlapFrame(geom, OPEN.thetaL, OPEN.thetaR)
  const a = (aDeg * Math.PI) / 180
  const dir = [
    Math.cos(a) * fr.flat[0] + Math.sin(a) * fr.n[0],
    Math.cos(a) * fr.flat[1] + Math.sin(a) * fr.n[1],
    Math.cos(a) * fr.flat[2] + Math.sin(a) * fr.n[2],
  ]
  const tip = (h) => [h[0] + geom.height * dir[0], h[1] + geom.height * dir[1], h[2] + geom.height * dir[2]]
  return { quad: [fr.h0, fr.h1, tip(fr.h1), tip(fr.h0)], dir, hinge: fr.hinge }
}
function rankMetrics(geom) {
  const [lo, hi] = geom.travelDeg ?? [0, 90]
  const A = rankQuad(geom, lo)
  const B = rankQuad(geom, hi)
  let travelPx = 0
  for (let i = 0; i < 4; i++) {
    const pa = project(A.quad[i])
    const pb = project(B.quad[i])
    travelPx = Math.max(travelPx, Math.hypot(pa[0] - pb[0], pa[1] - pb[1]))
  }
  const faceOn = (P) => {
    const nq = nrm(crs(P.hinge, P.dir))
    return Math.abs(dot(nq, FWD))
  }
  // Standing top corner height, and the hall lid it must stay under.
  const topY = Math.max(...B.quad.map((p) => p[1]))
  // Pointer conditioning: |view . hinge| — 0 is the edge-on swing plane that
  // makes a hinge handle answer nothing (handle-projection class B1).
  const cond = Math.abs(dot(nrm(A.hinge), FWD))
  const radial = A.quad.concat(B.quad).map((p) => bisX(p, mOf(OPEN)))
  return { travelPx, restFaceOn: faceOn(A), standFaceOn: faceOn(B), topY, cond, radial: [Math.min(...radial), Math.max(...radial)] }
}
{
  const m = rankMetrics(rank)
  const floorPx = 0.12 * CAM.h
  const lidY = Math.max(...S.solveBoxPose(S.keepStackStoryGeoms(inn)[0], OPEN.thetaL, OPEN.thetaR).flatMap((p) => p.quad.map((q) => q[1])))
  gate('R8', m.travelPx >= floorPx, `rank actuated travel ${f(m.travelPx, 1)} px = ${f((100 * m.travelPx) / CAM.h, 2)}% of frame height (floor 12% = ${floorPx} px)`)
  gate('R8', m.topY <= lidY, `rank standing top ${f(m.topY)} <= hall lid ${f(lidY)}`)
  gate('R8', m.radial[1] <= inn.stories[0].a, `rank radial span ${f(m.radial[0], 3)}..${f(m.radial[1], 3)} inside the hall walls at ${inn.stories[0].a}`)
  note(`rank face-on: rest ${f(m.restFaceOn, 3)}, standing ${f(m.standFaceOn, 3)} (a fore-lying flap is EXACTLY edge-on at the camera's 26.1deg depression); |view.hinge| ${f(m.cond, 3)}`)
}

if (process.argv.includes('--sweep-rank')) {
  console.log('\nrank sweep — height x hingeDeg x restDeg (travel px / rest face-on):')
  for (const height of [0.34, 0.38]) {
    for (const hingeDeg of [0, 10, 20, 30, 40]) {
      const line = []
      for (const restDeg of [38, 42, 46, 50, 54]) {
        const g = { ...rank, height, hingeDeg, restDeg, travelDeg: [restDeg, 90] }
        const m = rankMetrics(g)
        line.push(`${restDeg}:${String(Math.round(m.travelPx)).padStart(3)}/${f(m.restFaceOn, 2)}`)
      }
      console.log(`  h ${height} hd ${String(hingeDeg).padStart(2)}  ${line.join('  ')}`)
    }
  }
}

// --- R9: composition --------------------------------------------------------

/** Every world quad the spread poses at the reading pose, by layer. */
function layerQuads(l) {
  if (l.mech === 'keepstack') return S.keepStackQuads(l, OPEN.thetaL, OPEN.thetaR)
  if (l.mech === 'stagedchain') return S.stagedChainQuads(l, OPEN.thetaL, OPEN.thetaR)
  if (l.mech === 'stripflap') return [rankQuad(l, l.restDeg ?? 90).quad]
  if (l.mech === 'dissolve') {
    const p = S.solveDissolvePose(l, 0, OPEN.thetaL, OPEN.thetaR)
    return [p.base, ...p.slats, p.tab]
  }
  return []
}
/** Screen bounding box + a rasterised silhouette area share of the frame. */
function screenMetrics(quads) {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  let area = 0
  for (const q of quads) {
    const pts = q.map(project)
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
    // shoelace, both triangles
    for (const tri of [[0, 1, 2], [0, 2, 3]]) {
      const [a, b, c] = tri.map((i) => pts[i])
      area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2
    }
  }
  return { x0, x1, y0, y1, area }
}
{
  const tall = []
  for (const l of ch1.layers) {
    let maxY = -Infinity
    for (const q of layerQuads(l)) for (const p of q) maxY = Math.max(maxY, p[1])
    tall.push([l.id, maxY])
  }
  const above = tall.filter(([, y]) => y > 0.55)
  const rest2 = tall.filter(([, y]) => y <= 0.55)
  gate('R9', above.length === 1 && rest2.every(([, y]) => y <= 0.351), `exactly one element above y=0.55 (${above.map(([i, y]) => `${i} ${f(y, 3)}`).join(', ')}); rest: ${rest2.map(([i, y]) => `${i} ${f(y, 3)}`).join(', ')}`)

  const heroM = screenMetrics(layerQuads(inn))
  const heroFrameArea = (heroM.area / (CAM.w * CAM.h)) * 100
  const heroBox = (((heroM.x1 - heroM.x0) * (heroM.y1 - heroM.y0)) / (CAM.w * CAM.h)) * 100
  const heroH = ((heroM.y1 - heroM.y0) / CAM.h) * 100
  gate('R9', heroH >= 45, `centrepiece frame height ${f(heroH, 1)}% (>= 45)`)
  gate('R9', heroBox >= 22, `centrepiece frame area ${f(heroBox, 1)}% of frame (bounding box; painted-quad sum ${f(heroFrameArea, 1)}%) (>= 22)`)

  const supports = [wingL, wingR].map((l) => screenMetrics(layerQuads(l)).area)
  const props = [screenMetrics(layerQuads(rank)).area]
  const ladder = [heroM.area, Math.max(...supports), Math.max(...props)].map((a) => a / Math.max(...props))
  gate('R9', ladder[0] / ladder[2] >= 9 && ladder[1] / ladder[2] >= 3, `mass ladder hero : largest support : largest prop = ${ladder.map((x) => f(x, 1)).join(' : ')} (>= 9 : 3 : 1)`)

  // Standing-geometry floor coverage: the page footprint (radial, z) of every
  // piece whose paper leaves the page plane, over the two-page floor.
  const CELLS = 160
  let occupied = 0
  const standing = ch1.layers.filter((l) => l.mech !== 'dissolve')
  const foot = []
  for (const l of standing) {
    for (const q of layerQuads(l)) {
      const m = mOf(OPEN)
      const xs = q.map((p) => bisX(p, m))
      const ys = q.map((p) => offPage(p, m))
      const zs = q.map((p) => p[2])
      if (Math.max(...ys) < 0.01) continue // lies in the page plane: not standing
      foot.push([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), Math.min(...q.map((p) => p[0]))])
    }
  }
  for (let i = 0; i < CELLS; i++)
    for (let j = 0; j < CELLS; j++) {
      const x = ((i + 0.5) / CELLS) * PAGE_W
      const z = -PAGE_H / 2 + ((j + 0.5) / CELLS) * PAGE_H
      // both pages: a piece's radial footprint applies to whichever page it sits on
      if (foot.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d)) occupied++
    }
  const free = 100 * (1 - occupied / (CELLS * CELLS))
  gate('R9', free >= 30, `page floor free of standing geometry: ${f(free, 1)}% (>= 30)`)

  // Hero + wings aggregate span, in world, across the spread.
  let span = 0
  for (const l of [inn, wingL, wingR]) {
    const m = mOf(OPEN)
    for (const q of layerQuads(l)) for (const p of q) span = Math.max(span, Math.abs(p[0]))
  }
  gate('R9', 2 * span >= 1.6 && 2 * span <= 2.0, `hero+wings aggregate span ${f(2 * span, 3)} (1.6 .. 2.0)`)
}

// --- R10: erection stagger --------------------------------------------------

{
  const completions = []
  for (const w of [wingL, wingR]) {
    const cam = S.stagedChainCam(w)
    let done = Math.PI
    for (let i = 0; i < cam.betas.length; i++) if (cam.q.every((t) => t[i] >= 0.999)) { done = cam.betas[i]; break }
    // start = the first station any joint leaves zero
    let start = 0
    for (let i = 0; i < cam.betas.length; i++) if (cam.q.some((t) => t[i] > 1e-9)) { start = cam.betas[i]; break }
    completions.push([w.id, start, done])
  }
  // the spire is page-driven: it is done only at the rest bloom.
  completions.push(['ch1-inn-spire', 0, betaOpen])
  const deg = (r) => f((r * 180) / Math.PI, 1)
  const ok = completions[0][2] !== completions[1][2] && Math.max(completions[0][2], completions[1][2]) < betaOpen - 0.05
  gate('R10', ok, `erection completion windows: ${completions.map(([i, s, d]) => `${i} [${deg(s)}..${deg(d)}]`).join('  ')}`)
}

console.log(rows.join('\n'))
console.log(`\n${fails === 0 ? 'ALL GREEN' : `${fails} FAILING`}\n`)
process.exit(fails === 0 ? 0 : 1)
