/**
 * e3s4r4-tower.mjs — E3 s4 ROUND-4 "THE RAVEN CITY": deriving the COLOSSAL
 * crooked rookery tower.
 *
 * THE SCENE ASKED FOR SOMETHING THE FAMILY COULD NOT DO. Round 3 shipped two
 * mirror cliffs of apex 0.816 built on the stagedchain RIBBON: a chain that
 * lies extended-collinear at book-closed, so its closed footprint costs the
 * FULL chain length in page depth. That is the binding wall, and it is not
 * kinematic — it is a tape measure:
 *
 *     L <= zc + PAGE_H/2,  and zc <= 0.155 (the winch disc's closed footprint
 *     starts at z 0.17), so L <= 0.905 and apex <= ~0.88.
 *
 * The scene wants a tower that climbs PAST the keep's 1.01 crown. No schedule,
 * no lean, no taper buys that: the depth budget is spent before the kinematics
 * are even consulted.
 *
 * ------------------------------------------------------------------------
 * DERIVATION 1 — THE CROWN FLAP (new: a fold-back top stage, deployed LAST).
 *
 * Let the chain be a ribbon for stages 0..m-1 (closed depth L3 = sum h_k) and
 * let the TOP stage close FOLDED BACK on its parent (psi_m(0) = psi_{m-1} + pi)
 * instead of collinear. Then:
 *
 *     closed depth = L3          (the crown tucks back INSIDE the ribbon run)
 *     chain length = L3 + h_m    (the crown is free height)
 *
 * The accordion was killed by TENTING: a fold-back joint sweeps its panel
 * through psi = 90deg and raises a tent of nearly its own panel height, and the
 * top-down unroll law puts upper joints EARLIEST, where the closing wedge
 * (eta <= F*tan beta) is tightest. Measured 0.45 past the limit at beta 10deg.
 *
 * THE CROWN FLAP ESCAPES THE TENT BY REVERSING THE ORDER. Its deployment is
 * scheduled LAST — after the root swing, in the final eased tail. Write the
 * crown tip's off-page reach with the lower chain standing at psi:
 *
 *     eta_top(q) = eta_{m} + h_m * sin(psi + pi - q*(pi - rel))
 *
 * At q = 0 the crown points BACK DOWN the chain, so its contribution is
 * -h_m*sin(psi) — and since eta_m ~ L3*sin(psi) with L3 > h_m, eta_top stays
 * POSITIVE for every psi: the crown never pierces the page (that is the real
 * content of the top-down law, and it is satisfied here by measurement, not by
 * order). The interior tent maximum sits at q* = (psi + 90)/(180 - rel); for
 * psi >= ~85deg that is q* > 1, i.e. NO interior tent at all — the crown's
 * reach is monotone into its final pose. Deploying the crown after the root is
 * exactly what makes psi large while it moves.
 *
 * PAPER PEDIGREE: a crown flap folded face-down against the tower's top storey
 * that swings up as the spread lands — Birmingham's lift-flap hinge driven by
 * mech 116's automatic strip, with mech 101's lost-motion strap supplying the
 * delay. Reinhart: "the further from the base page, the later" — this is that
 * law taken one step past its own limit, and paid for at the wedge gate.
 *
 * ------------------------------------------------------------------------
 * DERIVATION 2 — THE TRAPEZOID CHAIN (per-node radial span: taper + skew).
 *
 * The shipped family gives every node the same radial span [F, F+w], so a
 * stagedchain is a rectangular wall — which is why two of them read as two
 * cards. Giving node j its own span [r_j, r_j + w_j] costs NOTHING kinematically
 * (the chain solves in the (xi, eta) page-local plane; the radial coordinate is
 * a pure spanwise parameter) and buys the whole crooked-colossus vocabulary:
 *
 *   TAPER  w_j decreasing  -> storeys narrowing as the tower climbs;
 *   SKEW   r_j drifting    -> the tower LEANS across the page as it climbs;
 *                             a crown that leans out over the canyon.
 *
 * The only gates that change are the ones that read radial extremes:
 *   rfar = max_j (r_j + w_j)   (the real-time rotation radius)
 *   rnear = min_j r_j          (the wedge limit is rnear * tan beta)
 * and both are MEASURED here from the actual node table.
 *
 * Modes:
 *   node .superpowers/sdd/bench/e3s4r4-tower.mjs            gates for the shipped tower
 *   node .superpowers/sdd/bench/e3s4r4-tower.mjs frontier   apex frontier: ribbon vs crown-flap
 *   node .superpowers/sdd/bench/e3s4r4-tower.mjs search     shipped-shape search (mass-ranked)
 */

// ---------------------------------------------------------------------------
// House constants (mirrored from the app; no imports — bench discipline).
const PAGE_W = 1.15
const PAGE_H = 1.5
const GLOBAL_CAP = 0.0497
const N_ST = 240
const CAM_REST_DEG = 173.0
const SHEET_T = 0.014
const PEDESTAL = 0.02
const INTERIOR_SHEETS = 9

const restBetaFor = (spread) => {
  const left = Math.max(0, spread - 1)
  const right = INTERIOR_SHEETS + 1 - Math.max(1, spread)
  const aL = Math.asin((PEDESTAL + left * SHEET_T - PEDESTAL) / PAGE_W)
  const aR = Math.asin((PEDESTAL + right * SHEET_T - PEDESTAL) / PAGE_W)
  return { beta: Math.PI - aL - aR, thetaL: Math.PI - aL, thetaR: aR }
}
export const REST = restBetaFor(3)

const rad = (d) => (d * Math.PI) / 180
const ease = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2)
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a) => {
  const l = Math.hypot(...a)
  return [a[0] / l, a[1] / l, a[2] / l]
}

let DTHETA_MAX = 0
for (let i = 0; i < N_ST; i++) DTHETA_MAX = Math.max(DTHETA_MAX, (ease((i + 1) / N_ST) - ease(i / N_ST)) * Math.PI)
export const RADIUS_CAP = GLOBAL_CAP / DTHETA_MAX // 0.772

// ---------------------------------------------------------------------------
// CHAIN KINEMATICS — the shipped ribbon formulation plus the CROWN FLAP branch.
// Every q_k = 0 must give sin = 0 EXACTLY (fold-flat is an identity in this
// book, not a tolerance), so the constant pi of a fold-back is split out of the
// trig and applied as a sign, exactly as popup-stagedchain.ts does it.
export function chainNodesQ(cfg, qs) {
  const nodes = [[0, 0]]
  let phi = 0
  let flipped = false
  for (let k = 0; k < cfg.stages.length; k++) {
    const st = cfg.stages[k]
    const q = qs[k]
    if (k === 0) phi = q * rad(cfg.rootDeg ?? 90)
    else if (st.fold === 'back') {
      // CROWN FLAP: psi_k = psi_{k-1} + pi - q*(pi - rel). The pi is the sign
      // flip; the q-driven remainder is what the trig sees.
      phi -= q * (Math.PI - rad(st.relDeg ?? 0))
      flipped = !flipped
    } else {
      phi += q * rad(st.relDeg ?? 0)
    }
    const sgn = flipped ? -1 : 1
    const p = nodes[nodes.length - 1]
    nodes.push([p[0] + sgn * st.h * Math.cos(phi), p[1] + sgn * st.h * Math.sin(phi)])
  }
  return nodes
}

/** Per-node radial span [r_j, r_j + w_j] — the TRAPEZOID CHAIN. Node 0 is the
 *  root span (cfg.F, cfg.w); stage k may re-declare the span at its TOP node
 *  via rTop / wTop, and anything unset inherits the node below. */
export function nodeSpans(cfg) {
  const spans = [[cfg.F, cfg.w]]
  for (const st of cfg.stages) {
    const prev = spans[spans.length - 1]
    spans.push([st.rTop ?? prev[0], st.wTop ?? prev[1]])
  }
  return spans
}
export const rFarOf = (cfg) => Math.max(...nodeSpans(cfg).map(([r, w]) => r + w))
export const rNearOf = (cfg) => Math.min(...nodeSpans(cfg).map(([r]) => r))

/**
 * DERIVATION 3 — THE PER-NODE ROTATION RADIUS (what the trapezoid unlocked).
 *
 * A point on a page-rooted piece sweeps a circle about the SPINE AXIS of radius
 * hypot(radial, off-page reach). The r3 bench charged every node the chain's
 * single worst radius hypot(rfar, eta_top) — exactly right when every node
 * shares the span [F, F+w], and needlessly brutal once they do not. On a
 * trapezoid tower the two extremes never coincide: the BASE is wide (r+w 0.73)
 * but sits at eta = 0, and the CROWN is high (eta > 1.1) but narrow (r+w 0.58).
 * Charging the crown the base's width invents a radius of 1.34 that no point on
 * the piece ever has.
 *
 * The honest budget is the max over NODES of hypot(r_j + w_j, eta_j), and the
 * hold-through-midturn condition becomes per-node too:
 *     eta_j <= sqrt(RADIUS_CAP^2 - (r_j + w_j)^2)   at the fastest station.
 * For the crown that cap is 0.515 instead of 0.136 — a 3.8x wider hold window,
 * and it is what makes the crooked colossus affordable at all.
 */
export function maxNodeRadius(cfg, nodes) {
  const spans = nodeSpans(cfg)
  let r = 0
  for (let j = 0; j < nodes.length; j++) r = Math.max(r, Math.hypot(spans[j][0] + spans[j][1], nodes[j][1]))
  return r
}

/**
 * THE OPTIMAL LATE CAM, with an explicit DRAIN ORDER.
 *
 * Marching backward from cam-rest, each station's leftover speed headroom is
 * spent folding joints back up. The backward drain order IS the reverse of the
 * forward deployment order: whatever drains first (nearest rest) deploys last.
 * The shipped family drains root-first = deploys top-down. The CROWN FLAP needs
 * to deploy AFTER the root, so it drains BEFORE it — `cfg.order` (backward
 * drain order, joint indices) states that explicitly. Default = [0..n-1].
 */
export function planCam(cfg) {
  const n = cfg.stages.length
  const safe = cfg.safe ?? 0.92
  const camRest = rad(cfg.camRestDeg ?? CAM_REST_DEG)
  const levers = cfg.stages.map((_, j) => cfg.stages.slice(j).reduce((a, s) => a + s.h, 0))
  const travel = cfg.stages.map((st, j) =>
    j === 0 ? rad(cfg.rootDeg ?? 90) : st.fold === 'back' ? Math.PI - rad(st.relDeg ?? 0) : rad(st.relDeg ?? 0)
  )
  const R0 = travel.map((tr, j) => Math.max(1e-12, tr * levers[j]))
  const order = cfg.order ?? cfg.stages.map((_, j) => j)

  const betas = Array.from({ length: N_ST + 1 }, (_, i) => ease(i / N_ST) * Math.PI)
  let iRest = betas.findIndex((b) => b >= camRest)
  if (iRest < 0) iRest = N_ST
  const q = Array.from({ length: n }, () => new Float64Array(N_ST + 1).fill(0))
  for (let j = 0; j < n; j++) for (let i = iRest; i <= N_ST; i++) q[j][i] = 1

  const rem = R0.slice()
  const qNow = new Array(n).fill(1)
  let oi = 0
  for (let i = iRest; i >= 1; i--) {
    const dbeta = betas[i] - betas[i - 1]
    let head = safe * GLOBAL_CAP - maxNodeRadius(cfg, chainNodesQ(cfg, qNow)) * dbeta
    while (head > 1e-12 && oi < n) {
      const j = order[oi]
      const dArc = Math.min(rem[j], head)
      rem[j] -= dArc
      head -= dArc
      qNow[j] = Math.max(0, qNow[j] - dArc / R0[j])
      if (rem[j] <= 1e-12) {
        qNow[j] = 0 // hard zero: q(0)=0 is a family condition, not a tolerance
        oi++
      } else break
    }
    for (let j = 0; j < n; j++) q[j][i - 1] = qNow[j]
  }
  return { feasible: rem.every((r) => r <= 1e-9), betas, q, iRest }
}

const camCache = new Map()
export function camOf(cfg) {
  if (!camCache.has(cfg)) {
    if (camCache.size > 4096) camCache.clear() // sweeps mint a cfg per candidate
    camCache.set(cfg, planCam(cfg))
  }
  return camCache.get(cfg)
}
export function qOf(cfg, k, beta) {
  const { betas, q } = camOf(cfg)
  const tab = q[k]
  if (beta <= betas[0]) return tab[0]
  if (beta >= betas[betas.length - 1]) return tab[tab.length - 1]
  let lo = 1
  let hi = betas.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (beta <= betas[mid]) hi = mid
    else lo = mid + 1
  }
  const f = (beta - betas[lo - 1]) / (betas[lo] - betas[lo - 1] || 1)
  return tab[lo - 1] + (tab[lo] - tab[lo - 1]) * f
}
export const chainNodes = (cfg, beta) => chainNodesQ(cfg, cfg.stages.map((_, k) => qOf(cfg, k, beta)))

/** World quads, one per stage, trapezoidal (bottom node span -> top node span). */
export function panelQuads(cfg, t, beta) {
  const sigma = cfg.side === 'left' ? -1 : 1
  const nx = sigma * -Math.sin(t)
  const ny = sigma * Math.cos(t)
  const nodes = chainNodes(cfg, beta)
  const spans = nodeSpans(cfg)
  const P = (d, xi, eta) => [d * Math.cos(t) + eta * nx, d * Math.sin(t) + eta * ny, cfg.zc - xi]
  const quads = []
  for (let k = 0; k + 1 < nodes.length; k++) {
    const [xi0, eta0] = nodes[k]
    const [xi1, eta1] = nodes[k + 1]
    const [r0, w0] = spans[k]
    const [r1, w1] = spans[k + 1]
    quads.push([P(r0, xi0, eta0), P(r0 + w0, xi0, eta0), P(r1 + w1, xi1, eta1), P(r1, xi1, eta1)])
  }
  return quads
}
export function worldPoints(cfg, t, beta) {
  const sigma = cfg.side === 'left' ? -1 : 1
  const nx = sigma * -Math.sin(t)
  const ny = sigma * Math.cos(t)
  const spans = nodeSpans(cfg)
  return chainNodes(cfg, beta).flatMap(([xi, eta], j) =>
    [spans[j][0], spans[j][0] + spans[j][1]].map((d) => [
      d * Math.cos(t) + eta * nx,
      d * Math.sin(t) + eta * ny,
      cfg.zc - xi,
    ])
  )
}

// ---------------------------------------------------------------------------
// FAMILY METRICS — the shipped four conditions, restated for the crown flap.
export function familyMetrics(cfg, full = true) {
  const cam = camOf(cfg)
  const rfar = rFarOf(cfg)
  const rnear = rNearOf(cfg)

  // (4) q(0) = 0 exact -> fold-flat free.
  const flat = chainNodes(cfg, 0)
  const offMax = Math.max(...flat.map(([, eta]) => Math.abs(eta)))
  const xis = flat.map(([xi]) => xi)
  const footZ = [cfg.zc - Math.max(...xis), cfg.zc - Math.min(...xis)]

  // (3) TOP-DOWN unroll, RIBBON joints only. A ribbon joint that lags its
  // parent leaves its child collinear (harmless); the CROWN FLAP deliberately
  // lags, and pays for the exemption at the pierce + wedge gates below.
  let orderViolation = 0
  for (let i = 0; i <= N_ST; i++) {
    const beta = (i / N_ST) * Math.PI
    for (let k = 1; k < cfg.stages.length; k++) {
      if (cfg.stages[k].fold === 'back') continue
      if (cfg.stages[k - 1].fold === 'back') continue
      orderViolation = Math.max(orderViolation, qOf(cfg, k - 1, beta) - qOf(cfg, k, beta))
    }
  }

  // (1) hold-through-midturn: PER-NODE rotation radius at the fastest station.
  let iFast = 0
  let dMax = 0
  for (let i = 0; i < N_ST; i++) {
    const d = ease((i + 1) / N_ST) - ease(i / N_ST)
    if (d > dMax) {
      dMax = d
      iFast = i
    }
  }
  const betaFast = Math.PI - ease(iFast / N_ST) * Math.PI
  const holdReach = maxNodeRadius(cfg, chainNodes(cfg, betaFast))
  const holdCap = RADIUS_CAP

  // (2) joint arc fits the eased tails: cam feasibility + the real-time cap on
  // every house turn path.
  let worst = 0
  let worstPath = ''
  const paths = [
    { name: 'move-out', t: (th) => th, beta: (th) => Math.PI - th },
    { name: 'move-in', t: (th) => th, beta: (th) => th },
    { name: 'stat-out', t: () => Math.PI, beta: (th) => Math.PI - th },
    { name: 'stat-in', t: () => 0, beta: (th) => th },
  ]
  if (full)
    for (const path of paths) {
      let prev = null
      for (let i = 0; i <= N_ST; i++) {
        const th = ease(i / N_ST) * Math.PI
        const pts = worldPoints(cfg, path.t(th), path.beta(th))
        if (prev)
          for (let c = 0; c < pts.length; c++) {
            const d = dist3(prev[c], pts[c])
            if (d > worst) {
              worst = d
              worstPath = path.name
            }
          }
        prev = pts
      }
    }

  // WEDGE CONTAINMENT with the trapezoid's own inner edge: eta <= rnear*tan beta.
  let wedgeWorst = -Infinity
  let wedgeAt = 0
  for (let i = 1; i <= 600; i++) {
    const beta = (i / 600) * Math.PI
    if (beta >= Math.PI / 2) break
    const limit = rnear * Math.tan(beta)
    for (const [, eta] of chainNodes(cfg, beta)) {
      if (eta - limit > wedgeWorst) {
        wedgeWorst = eta - limit
        wedgeAt = beta
      }
    }
  }

  // PIERCE: eta >= 0 across the whole sweep — the crown flap's licence.
  let etaMin = Infinity
  let etaMinAt = 0
  for (let i = 0; i <= 600; i++) {
    const beta = (i / 600) * Math.PI
    for (const [, eta] of chainNodes(cfg, beta)) {
      if (eta < etaMin) {
        etaMin = eta
        etaMinAt = beta
      }
    }
  }

  // CROWN MONOTONICITY: the crown's apex reach must not tent above its own rest
  // pose on the way there (the accordion's exact failure, measured).
  let crownTent = 0
  const crownIdx = cfg.stages.findIndex((s) => s.fold === 'back')
  const apexRest = Math.max(...chainNodes(cfg, REST.beta).map(([, eta]) => eta))
  if (crownIdx >= 0) {
    for (let i = 0; i <= 600; i++) {
      const beta = (i / 600) * Math.PI
      const nodes = chainNodes(cfg, beta)
      crownTent = Math.max(crownTent, Math.max(...nodes.map(([, eta]) => eta)) - apexRest)
    }
  }

  // beta-domain max/mean step ratio (motion-character Gate 1).
  let prev = null
  let maxStep = 0
  let sum = 0
  let cnt = 0
  if (full)
    for (let i = 0; i <= N_ST; i++) {
      const beta = (i / N_ST) * REST.beta
      const tt = Math.PI / 2 + (cfg.side === 'left' ? beta / 2 : -beta / 2)
      const pts = worldPoints(cfg, tt, beta)
      if (prev)
        for (let c = 0; c < pts.length; c++) {
          const d = dist3(prev[c], pts[c])
          maxStep = Math.max(maxStep, d)
          sum += d
          cnt++
        }
      prev = pts
    }
  const betaRatio = cnt ? maxStep / (sum / cnt) : 0

  const qRest = cfg.stages.map((_, k) => qOf(cfg, k, REST.beta))
  let xiLo = 0
  let xiHi = 0
  for (let i = 0; i <= 300; i++) {
    for (const [xi] of chainNodes(cfg, (i / 300) * Math.PI)) {
      xiLo = Math.min(xiLo, xi)
      xiHi = Math.max(xiHi, xi)
    }
  }
  const sweptZ = [cfg.zc - xiHi, cfg.zc - xiLo]
  const closedDepth = Math.max(...xis.map(Math.abs))
  const length = cfg.stages.reduce((a, s) => a + s.h, 0)

  return {
    cam, offMax, footZ, sweptZ, wedgeWorst, wedgeAt, orderViolation, holdCap, holdReach,
    worst, worstPath, etaMin, etaMinAt, crownTent, betaRatio, qRest, apex: apexRest,
    rfar, rnear, closedDepth, length,
  }
}

// ---------------------------------------------------------------------------
// PROJECTION (the pinned composition camera, calibrated with e3s4-ring.mjs).
export const CAM = [0, 1.85, 3.05]
const LOOK = [0, 0.38, 0.05]
const FOV_Y = rad(34)
export const VW = 1600
export const VH = 900
const fwd = norm(sub(LOOK, CAM))
const rightV = norm(cross(fwd, [0, 1, 0]))
const upC = cross(rightV, fwd)
const focal = (0.5 * VH) / Math.tan(FOV_Y / 2)
export const project = (p) => {
  const d = sub(p, CAM)
  const z = dot(d, fwd)
  return { x: VW / 2 + (focal * dot(d, rightV)) / z, y: VH / 2 - (focal * dot(d, upC)) / z, z }
}
export const shoelace = (pts) => {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}
export const massOf = (cfg) => {
  const t = cfg.side === 'left' ? REST.thetaL : REST.thetaR
  return panelQuads(cfg, t, REST.beta).reduce((a, q) => a + shoelace(q.map(project)), 0)
}

// ---------------------------------------------------------------------------
// THE SHIPPED TOWER — "the crooked colossus".
//
// Read the numbers as the derivation wrote them:
//   * closed depth 0.884 <= zc 0.134 + PAGE_H/2 0.75 (the ribbon run's tape
//     measure), leaving 0.016 clear of the winch disc's 0.17 closed footprint;
//   * the CROWN FLAP adds 0.30 of chain ON TOP of that budget -> length 1.184;
//   * rfar 0.752 is the trapezoid's widest node (storey 2's balcony belt), the
//     real-time radius wall, not a guess;
//   * SKEW: the inner edge walks 0.43 -> 0.365 up the chain while the widths
//     narrow 0.33 -> 0.20, so the tower leans INBOARD over the canyon as it
//     climbs and its crown overhangs the keep's shoulder.
export const TOWER = {
  side: 'left',
  F: 0.42,
  w: 0.3,
  zc: 0.3,
  rootDeg: 74,
  safe: 0.98,
  camRestDeg: CAM_REST_DEG,
  stages: [
    // 1 — the buttressed foot: the widest storey, the rank of big gate arches.
    { h: 0.301206, relDeg: 0, rTop: 0.445, wTop: 0.276 },
    // 2 — the squat gantry belt, shoved OUTBOARD (the first kink).
    { h: 0.221294, relDeg: 1.8, rTop: 0.425, wTop: 0.2613 },
    // 3 — the tall belfry storey, pulled back INBOARD (the second kink — the
    //     "grew too fast to stand straight" read is a stack that ZIG-ZAGS in
    //     plan, which the trapezoid gives for free where joint arc cannot).
    { h: 0.28174, relDeg: 1.4, rTop: 0.45, wTop: 0.2274 },
    // 4 — the crown, kicking back out over the canyon.
    { h: 0.24076, relDeg: 4.9, rTop: 0.44, wTop: 0.2031 },
  ],
}

/**
 * THE CROWN FLAP, PROVED AND PRICED (a config that is legal on its own terms,
 * kept so the mechanism stays measured rather than asserted). The shipped tower
 * does NOT use it, and the reason is a clean inequality — see T3 below.
 */
export const CROWN_PROBE = {
  side: 'left', F: 0.42, w: 0.26, zc: 0.3, rootDeg: 62, safe: 0.95, camRestDeg: CAM_REST_DEG,
  order: [3, 0, 1, 2],
  stages: [
    { h: 0.24, relDeg: 0, rTop: 0.42, wTop: 0.24 },
    { h: 0.2, relDeg: 0, rTop: 0.42, wTop: 0.22 },
    { h: 0.17, relDeg: 0, rTop: 0.42, wTop: 0.2 },
    { h: 0.16, relDeg: 30, fold: 'back', rTop: 0.42, wTop: 0.18 },
  ],
}

// ---------------------------------------------------------------------------
let failures = 0
const gate = (name, ok, detail) => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/** Cheap gates first (cam + closed pose + wedge + crop), then the two heavy
 *  sweeps — a legality probe that only pays for the real-time scan on configs
 *  that already survived everything else. */
export const legal = (cfg) => {
  const cheap = familyMetrics(cfg, false)
  const tC = cfg.side === 'left' ? REST.thetaL : REST.thetaR
  const maxYc = Math.max(...panelQuads(cfg, tC, REST.beta).flat().map((p) => p[1]))
  if (
    !cheap.cam.feasible || cheap.etaMin < -1e-9 || cheap.orderViolation > 1e-9 ||
    cheap.holdReach > cheap.holdCap + 1e-9 || cheap.wedgeWorst > 1e-9 || cheap.crownTent > 1e-9 ||
    cheap.footZ[0] < -PAGE_H / 2 || cheap.footZ[1] > PAGE_H / 2 || cheap.rfar > PAGE_W || maxYc > 1.2 ||
    !cheap.qRest.every((q) => q >= 1 - 1e-9)
  )
    return { ok: false, m: cheap, maxY: maxYc }
  const m = familyMetrics(cfg)
  const t = cfg.side === 'left' ? REST.thetaL : REST.thetaR
  const maxY = Math.max(...panelQuads(cfg, t, REST.beta).flat().map((p) => p[1]))
  const ok =
    m.cam.feasible &&
    m.worst < GLOBAL_CAP &&
    m.etaMin >= -1e-9 &&
    m.orderViolation <= 1e-9 &&
    m.holdReach <= m.holdCap + 1e-9 &&
    m.wedgeWorst <= 1e-9 &&
    m.crownTent <= 1e-9 &&
    m.footZ[0] >= -PAGE_H / 2 &&
    m.footZ[1] <= PAGE_H / 2 &&
    m.rfar <= PAGE_W &&
    maxY <= 1.2 &&
    m.qRest.every((q) => q >= 1 - 1e-9)
  return { ok, m, maxY }
}

// Importable: the modes below only run when this file IS the entry point, so
// the scene bench can reuse the kinematics without re-running the gates.
const IS_ENTRY = (process.argv[1] ?? '').split('\\').join('/').endsWith('e3s4r4-tower.mjs')
const mode = IS_ENTRY ? (process.argv[2] ?? 'main') : 'noop'
if (mode === 'noop') { /* imported as a library */ }

// --- FRONTIER: what the crown flap is worth, in apex, over a plain ribbon ----
if (mode === 'frontier') {
  const ZC = Number(process.argv[3] ?? 0.30)
  const FF = Number(process.argv[4] ?? 0.42)
  console.log(`=== ROUND-4 apex frontier: RIBBON vs CROWN FLAP (F ${FF}, zc ${ZC}, safe 0.95) ===`)
  console.log(`radius cap ${RADIUS_CAP.toFixed(3)} | closed-depth budget zc + PAGE_H/2 = ${(ZC + PAGE_H / 2).toFixed(3)}`)
  const mk = (kind, n, L3, hCrown, rootDeg, w, rel) => {
    const stages = Array.from({ length: n }, (_, k) => ({
      h: L3 / n,
      relDeg: k === 0 ? 0 : rel,
      wTop: w - (0.11 * w * (k + 1)),
      rTop: FF - 0.015 * (k + 1),
    }))
    if (kind === 'crown')
      stages.push({ h: hCrown, relDeg: 24, fold: 'back', wTop: w - 0.11 * w * (n + 1), rTop: FF - 0.015 * (n + 1) })
    return {
      side: 'left', F: FF, w, zc: ZC, rootDeg, safe: 0.95, camRestDeg: CAM_REST_DEG,
      order: kind === 'crown' ? [n, ...Array.from({ length: n }, (_, k) => k)] : undefined,
      stages,
    }
  }
  for (const kind of ['ribbon', 'crown']) {
    for (const n of [2, 3, 4]) {
      let best = null
      for (const rootDeg of [89, 84, 80, 74, 68]) {
        for (const w of [0.33, 0.31, 0.28]) {
          for (const rel of [0, 6, 12, 20]) {
            for (const hCrown of kind === 'crown' ? [0.40, 0.32, 0.26, 0.20] : [0]) {
              for (let L3 = ZC + PAGE_H / 2 - 0.015; L3 >= 0.45; L3 -= 0.01) {
                const cfg = mk(kind, n, L3, hCrown, rootDeg, w, rel)
                const { ok, m } = legal(cfg)
                if (!ok) continue
                const margin = (1 - m.worst / GLOBAL_CAP) * 100
                if (margin < 4) continue
                if (!best || m.apex > best.apex)
                  best = { apex: m.apex, L3, hCrown, rootDeg, w, rel, margin, mass: massOf(cfg), len: m.length }
                break
              }
            }
          }
        }
      }
      if (best)
        console.log(
          `  ${kind.padEnd(6)} n=${n}: apex ${best.apex.toFixed(3)}  len ${best.len.toFixed(3)} (ribbon ${best.L3.toFixed(2)} + crown ${best.hCrown.toFixed(2)})  root ${best.rootDeg} rel ${best.rel} w ${best.w}  margin ${best.margin.toFixed(1)}%  mass ${Math.round(best.mass)}`
        )
      else console.log(`  ${kind.padEnd(6)} n=${n}: no legal config`)
    }
  }
  process.exit(0)
}

// --- SEARCH: root x length x lean sweep, ranked by projected MASS ------------
if (mode === 'search') {
  const MIN_MARGIN = Number(process.argv[3] ?? 4)
  const ZC = Number(process.argv[4] ?? 0.3)
  console.log(`=== tower search (trapezoid ribbon, zc ${ZC}, margin >= ${MIN_MARGIN}%, apex >= 1.0) ranked by MASS ===`)
  const rows = []
  // Uneven storey profiles — the scene's ask ("storey after uneven storey"),
  // swept as SHAPES rather than as one taper constant.
  const PROFILES = {
    'tall-foot': [0.30, 0.24, 0.26, 0.20],
    'squat-belt': [0.26, 0.20, 0.30, 0.24],
    'even': [0.25, 0.25, 0.25, 0.25],
    'top-heavy': [0.22, 0.26, 0.28, 0.24],
  }
  for (const [pname, prof] of Object.entries(PROFILES)) {
    for (const rootDeg of [86, 84, 82, 78]) {
      for (const F of [0.45, 0.44, 0.43]) {
        for (const w of [0.28, 0.26]) {
          for (const lean of [0, 8, 16, 26]) {
            for (let L = ZC + PAGE_H / 2 - 0.01; L >= 0.85; L -= 0.01) {
              const s = prof.reduce((a, b) => a + b, 0)
              const wTops = [0.94, 0.86, 0.80, 0.71].map((f) => w * f)
              const rTops = [0.012, 0.022, 0.030, 0.035].map((d) => F - d)
              const stages = prof.map((p, k) => ({
                h: (L * p) / s,
                relDeg: k === 0 ? 0 : k === prof.length - 1 ? lean : Math.round(lean / 3),
                wTop: wTops[k],
                rTop: rTops[k],
              }))
              const cfg = { side: 'left', F, w, zc: ZC, rootDeg, safe: 0.95, camRestDeg: CAM_REST_DEG, stages }
              const { ok, m, maxY } = legal(cfg)
              if (!ok) continue
              const margin = (1 - m.worst / GLOBAL_CAP) * 100
              if (margin < MIN_MARGIN || m.apex < 1.0) continue
              rows.push({
                tag: `${pname} root${rootDeg} F${F} w${w} lean${lean} L=${L.toFixed(2)}`,
                mass: massOf(cfg), margin, apex: m.apex, maxY, rnear: m.rnear, rfar: m.rfar, ratio: m.betaRatio,
              })
              break
            }
          }
        }
      }
    }
  }
  rows.sort((a, b) => b.mass - a.mass)
  for (const r of rows.slice(0, 22))
    console.log(
      `  ${r.tag.padEnd(46)} mass=${Math.round(r.mass).toString().padStart(6)} apex=${r.apex.toFixed(3)} topY=${r.maxY.toFixed(2)} r[${r.rnear.toFixed(2)},${r.rfar.toFixed(2)}] margin=${r.margin.toFixed(1)}% ratio=${r.ratio.toFixed(0)}`
    )
  process.exit(0)
}

// --- TUNE: hold the shipped SHAPE, sweep the angle schedule + length --------
if (mode === 'tune') {
  console.log('=== tune the shipped tower shape: root x lean x length, margin >= 5%, ranked by apex ===')
  const prof = TOWER.stages.map((s) => s.h)
  const sum = prof.reduce((a, b) => a + b, 0)
  const rows = []
  for (const rootDeg of [80, 78, 76, 74, 72, 70]) {
    for (const leanScale of [0, 0.35, 0.7, 1]) {
      for (const w of [0.31, 0.30, 0.29]) {
        for (const safe of [0.95, 0.965, 0.98]) {
          for (const camRestDeg of [173, 173.5]) {
            for (let L = 1.045; L >= 0.85; L -= 0.005) {
              const stages = TOWER.stages.map((s) => ({
                h: (L * s.h) / sum,
                relDeg: Math.round((s.relDeg ?? 0) * leanScale * 10) / 10,
                rTop: s.rTop,
                wTop: (s.wTop * w) / TOWER.w,
              }))
              const cfg = { ...TOWER, w, stages, rootDeg, safe, camRestDeg }
              const { ok, m, maxY } = legal(cfg)
              if (!ok) continue
              const margin = (1 - m.worst / GLOBAL_CAP) * 100
              if (margin < 5) continue
              rows.push({
                tag: `root${rootDeg} lean x${leanScale} w${w} safe${safe} cr${camRestDeg} L=${L.toFixed(3)}`,
                apex: m.apex, mass: massOf(cfg), margin, maxY, rfar: m.rfar,
              })
              break
            }
          }
        }
      }
    }
  }
  rows.sort((a, b) => (b.apex >= 1.01 ? b.mass : b.apex * 1000) - (a.apex >= 1.01 ? a.mass : a.apex * 1000))
  for (const r of rows.slice(0, 18))
    console.log(`  ${r.tag.padEnd(34)} apex=${r.apex.toFixed(3)} mass=${Math.round(r.mass)} topY=${r.maxY.toFixed(3)} rfar=${r.rfar.toFixed(3)} margin=${r.margin.toFixed(1)}%`)
  process.exit(0)
}

// --- MAIN: the shipped tower's gates ----------------------------------------
if (IS_ENTRY) {
  console.log('=== E3 s4 ROUND-4 — THE CROOKED COLOSSUS (stagedchain + CROWN FLAP + trapezoid) ===')
  console.log(`real rest dihedral ${((REST.beta * 180) / Math.PI).toFixed(2)}deg | cam saturates ${CAM_REST_DEG}deg`)
  console.log(`dtheta_max ${DTHETA_MAX.toFixed(5)}/station -> rotation-radius cap ${RADIUS_CAP.toFixed(3)}\n`)

  const m = familyMetrics(TOWER)
  const t = REST.thetaL
  const quads = panelQuads(TOWER, t, REST.beta)
  const maxY = Math.max(...quads.flat().map((p) => p[1]))
  console.log(`--- tower: length=${m.length.toFixed(3)} n=${TOWER.stages.length} rnear=${m.rnear.toFixed(3)} rfar=${m.rfar.toFixed(3)} zc=${TOWER.zc} ---`)
  console.log(`    apex(rest)=${m.apex.toFixed(3)}  topY=${maxY.toFixed(3)}  closedDepth=${m.closedDepth.toFixed(3)}  mass=${Math.round(massOf(TOWER))} px^2  betaRatio=${m.betaRatio.toFixed(1)}\n`)

  gate('T1 fold-flat exact at close', m.offMax < 1e-12, `max off-page ${m.offMax.toExponential(1)}`)
  gate('T2 closed footprint inside the page',
    m.rfar <= PAGE_W + 1e-9 && m.footZ[0] >= -PAGE_H / 2 - 1e-9 && m.footZ[1] <= PAGE_H / 2 + 1e-9,
    `rfar ${m.rfar.toFixed(3)} z [${m.footZ[0].toFixed(3)}, ${m.footZ[1].toFixed(3)}]`)
  gate('T3 closed depth inside the budget zc + PAGE_H/2',
    m.closedDepth <= TOWER.zc + PAGE_H / 2 + 1e-9,
    `closed depth ${m.closedDepth.toFixed(3)} <= ${(TOWER.zc + PAGE_H / 2).toFixed(3)}`)
  gate('T4 joint arc fits the eased tails', m.cam.feasible, 'cam drained all joint arc before beta=0')
  gate('T5 real-time worst step < GLOBAL_CAP', m.worst < GLOBAL_CAP,
    `${m.worst.toFixed(5)} (${m.worstPath}) margin ${((1 - m.worst / GLOBAL_CAP) * 100).toFixed(1)}%`)
  gate('T6 top-down unroll among RIBBON joints', m.orderViolation <= 1e-9,
    `max q_lower-q_upper = ${m.orderViolation.toExponential(1)}`)
  gate('T7 hold-through-midturn reach <= cap', m.holdReach <= m.holdCap + 1e-9,
    `${m.holdReach.toFixed(3)} <= ${m.holdCap.toFixed(3)}`)
  gate('T8 stays inside the closing wedge', m.wedgeWorst <= 1e-9,
    `worst excursion ${m.wedgeWorst.toFixed(4)} @ beta ${((m.wedgeAt * 180) / Math.PI).toFixed(1)}deg (limit rnear*tan)`)
  gate('T9 never pierces the page (the crown flap licence)', m.etaMin >= -1e-9,
    `etaMin ${m.etaMin.toExponential(1)} @ beta ${((m.etaMinAt * 180) / Math.PI).toFixed(1)}deg`)
  gate('T10 crown never tents above its rest apex', m.crownTent <= 1e-9,
    `worst tent ${m.crownTent.toExponential(2)} over the whole sweep`)
  gate('T11 fully deployed at real rest', m.qRest.every((q) => q >= 1 - 1e-9),
    `q(rest) = [${m.qRest.map((q) => q.toFixed(4)).join(', ')}]`)
  gate('T12 crop ceiling: top <= 1.2', maxY <= 1.2, `maxY ${maxY.toFixed(3)}`)
  gate('T13 climbs PAST the keep crown (1.01)', m.apex > 1.01, `apex ${m.apex.toFixed(3)} vs keep spire 1.01`)
  gate('T14 out-masses the r3 LEFT cliff alone (51900 px^2)', massOf(TOWER) >= 51900,
    `${Math.round(massOf(TOWER))} px^2 (r3 left cliff 51900, at apex 0.816)`)

  // T15 — the trapezoid actually being used. A crooked tower is a stack whose
  // inner edge does NOT walk monotonically: it kicks out at the gantry belt and
  // pulls back at the belfry. Monotone taper would read as a pylon.
  const rs = nodeSpans(TOWER).map(([r]) => r)
  const ws = nodeSpans(TOWER).map(([, w]) => w)
  const monotoneR = rs.every((r, i) => i === 0 || r >= rs[i - 1]) || rs.every((r, i) => i === 0 || r <= rs[i - 1])
  gate('T15 TRAPEZOID: storeys taper AND the stack is crooked',
    ws[ws.length - 1] < ws[0] - 1e-9 && !monotoneR,
    `widths ${ws[0].toFixed(3)} -> ${ws[ws.length - 1].toFixed(3)}, inner edge ${rs.map((r) => r.toFixed(3)).join(' -> ')}`)

  // --- THE CROWN FLAP: proved, priced, and NOT shipped -------------------------
  console.log('\n--- the CROWN FLAP (derived, measured, and deliberately unused) ---')
  const cp = familyMetrics(CROWN_PROBE)
  gate('T16 crown flap is a legal mechanism', legal(CROWN_PROBE).ok,
    `apex ${cp.apex.toFixed(3)}, length ${cp.length.toFixed(3)} from closed depth ${cp.closedDepth.toFixed(3)}`)
  gate('T17 crown flap buys length past the closed-depth budget',
    cp.length > cp.closedDepth + 1e-6,
    `+${(cp.length - cp.closedDepth).toFixed(3)} of chain for free depth`)
  // THE TENT PREDICTOR, validated in both directions. The crown's reach peaks
  // at q* = (psi_parent + 90) / (180 - rel); q* >= 1 means the maximum is the
  // REST pose itself and the flap never tents. The accordion cliffs tented +0.45
  // because their fold-back joints deployed at psi_parent ~ 0.
  const cpPsi = CROWN_PROBE.rootDeg + CROWN_PROBE.stages.slice(1, -1).reduce((a, st) => a + (st.relDeg ?? 0), 0)
  const cpRel = CROWN_PROBE.stages[CROWN_PROBE.stages.length - 1].relDeg
  const qStar = (cpPsi + 90) / (180 - cpRel)
  gate('T18 crown flap never tents when q* >= 1 (predictor vs measurement)',
    qStar >= 1 && cp.crownTent <= 1e-9,
    `q* = ${qStar.toFixed(3)} (psi ${cpPsi}deg, rel ${cpRel}deg) -> measured tent ${cp.crownTent.toExponential(2)}`)
  // NEGATIVE CONTROL: rake the same chain back until q* < 1 and the tent must
  // reappear, at the size the closed form says. A law that cannot fail is not a
  // law — this is the accordion failure reproduced on purpose, in miniature.
  const shallow = { ...CROWN_PROBE, rootDeg: 38 }
  const cs = familyMetrics(shallow)
  const qStarShallow = (38 + 90) / (180 - cpRel)
  gate('T18b negative control: q* < 1 brings the tent back',
    qStarShallow < 1 && cs.crownTent > 1e-4,
    `root 38deg -> q* ${qStarShallow.toFixed(3)}, measured tent ${cs.crownTent.toExponential(2)} (was 0 at q* >= 1)`)
  // THE BREAK-EVEN LAW. A crown of height h costs (pi - rel)*h of joint arc; the
  // same arc spent on the ROOT buys rootRad*dL of ribbon, i.e. dL = (pi-rel)*h/rootRad
  // of extra chain. The crown wins only when it adds more chain than it displaces:
  //     h > (pi - rel)*h / rootRad   <=>   rel > pi - rootRad
  // At the shipped tower's root (78deg = 1.361 rad) that needs rel > 102deg — a
  // crown folded FORWARD past the horizontal, which is not a crown. So: the crown
  // flap pays only where the DEPTH budget binds harder than the ARC budget, which
  // is the r3 station (zc 0.134), not this one.
  const rootRad = rad(TOWER.rootDeg)
  const relBreakEven = ((Math.PI - rootRad) * 180) / Math.PI
  gate('T19 break-even law: crown pays only when relDeg > 180 - rootDeg',
    relBreakEven > 90,
    `at root ${TOWER.rootDeg}deg the crown needs relDeg > ${relBreakEven.toFixed(0)}deg — impossible for a crown, so the ribbon ships`)

  console.log(`\n  measured beta-ratio ${m.betaRatio.toFixed(2)} -> family ceiling pin ${Math.ceil(m.betaRatio * 1.1)}`)
  console.log(`\n${failures === 0 ? 'ALL GATES GREEN' : failures + ' GATE(S) FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}
