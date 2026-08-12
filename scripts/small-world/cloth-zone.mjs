#!/usr/bin/env node
/**
 * cloth-zone.mjs — which part of the shirt is cloth, how much, and which cloth
 * bone owns each skin influence.
 *
 * One definition, imported by the stage that ships it (detach-girl.mjs), by the
 * stage that bakes into it (bake-cloth-girl.mjs) and by the probes, so no two of
 * them can drift apart. Everything here is in the SOURCE frame: Z-up, −Z toward
 * the head, +Y toward the face (canonicalize stands her up afterwards).
 *
 * ---------------------------------------------------------------------------
 * WHY THE RIG HAS THIS SHAPE (T121, measured — scratchpad/t121/probe{1,4,5}.mjs)
 *
 * A cloth bone cannot simply take a skin influence slot. A garment vertex here
 * spends its four influences on four real bones: dropping the smallest costs a
 * MEDIAN of 3.6–6.3 mm over the garment and up to 115 mm, and even restricted to
 * the cloth zone and weighted by how much the cloth owns the vertex it is still
 * 11–20 mm at p99 and 112 mm at worst. A shirt that tears a centimetre away from
 * the body at 1% of its vertices is not a cloth simulation.
 *
 * Nor can one bone own a region outright. Fitting a single rigid+uniform-scale
 * transform per region to the BASE (un-simulated) skinned surface — the best any
 * region bone could do before cloth is added — leaves 2.2–4.1 mm at the median
 * and up to 162 mm at worst. Linear blend skinning over four bones is simply not
 * a rigid motion.
 *
 * So every cloth bone is an IDENTITY-AT-BIND CHILD of exactly one body joint,
 * and a garment influence on joint j inside region r is redirected to the cloth
 * bone C[j][r]. Because a child at identity has the same world matrix and the
 * same inverse bind as its parent, the redirected skin matrix is the SAME MATRIX:
 * the asset deforms byte-for-byte as it did until a baked cloth curve moves
 * something. The blend structure — which is the thing that cannot be
 * approximated — is preserved exactly, and the sim rides on top of it.
 *
 * The cost of that exactness is one bone per (joint, region) PAIR rather than per
 * region. Pairs below PAIR_THRESHOLD of the zone's weight keep their body joint
 * instead of gaining a bone; that influence then does not follow the cloth, which
 * attenuates the deviation there rather than displacing the vertex. At the
 * shipped setting that is 18 bones carrying 94.8% of the cloth weight — the knee
 * of the curve (scratchpad/t121/probe5.mjs sweeps it: 6×1 regions gives 21 bones
 * at 97.1%, 13 at 88.0%).
 * ---------------------------------------------------------------------------
 */
import { readFileSync } from 'node:fs'

/** Triangle count of the ORIGINAL Meshy mesh, before line-girl.mjs appends the
 *  lining. The garment mask is indexed against it. */
export const N_ORIG_TRI = 103994

/** Rim below this height is the hem ring (the shirt's bottom edge). */
export const HEM_Z = -0.95
/** Front rim below this height is the lower placket — the corners that flap. */
export const PLACKET_Z = -1.15
export const PLACKET_Y = 0.05
/** Sleeve-end rim sits below the shoulder line (LeftShoulder is at z −1.286). */
export const SLEEVE_Z = -1.2
/** Geodesic band grown inward from a free edge, metres — the shirt is cloth
 *  within this of an opening and skin above it.
 *
 *  0.05 is measured, not chosen. At 0.14 the free zone is the whole lower half of
 *  the shirt, and a lower half with nothing holding it swings: the sim put 12 cm
 *  at p99 and 30 cm at worst into a "subtle, not flag-in-wind" brief, the render
 *  showed the shirt sagging far enough to expose the lining across the chest, and
 *  no amount of bending stiffness or pin stiffness pulled it back (they moved p99
 *  from 121 mm to 64 mm and stopped). A shirt is held against the body by its own
 *  fit; only the edges are free. At 0.05 the same sim gives 3.2 cm at p99 and
 *  9 cm at worst — a hem that flicks, which is what the brief asks for. */
export const BAND = 0.05
/** Cloth regions. These do not buy accuracy — the base is exact either way —
 *  they buy how LOCAL a deviation can be. Four around the waist resolves a hem
 *  sway; one per sleeve resolves a cuff. Finer costs bones, and bones cost
 *  animation: measured, 6 regions at threshold 0.01 is 20 bones carrying 94.8% of
 *  the cloth weight, and 4 at 0.015 is 14 bones carrying 94.0% — the same motion
 *  for 30% fewer curves. */
export const TORSO_REGIONS = 4
export const SLEEVE_REGIONS = 1
export const KMEANS_SEED = 12345
/** A (joint, region) pair earns a bone at this share of the zone's cloth weight;
 *  below it the influence keeps its body joint, which attenuates the deviation
 *  there rather than displacing the vertex. */
export const PAIR_THRESHOLD = 0.015

const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

/**
 * @typedef {object} ClothMesh
 * @property {number} nv          vertex count
 * @property {Float64Array} pos   3nv bind positions
 * @property {Int32Array} tri     3T indices
 * @property {Int32Array} jnt     4nv joint indices
 * @property {Float64Array} wgt   4nv weights
 * @property {string[]} jointNames
 */

/**
 * @param {ClothMesh} mesh
 * @param {Uint8Array} triLabel per-ORIGINAL-triangle garment mask (1 = garment)
 */
export function clothZone(mesh, triLabel, opts = {}) {
  const { torsoRegions = TORSO_REGIONS, sleeveRegions = SLEEVE_REGIONS, band = BAND } = opts
  const nTri = mesh.tri.length / 3
  if (triLabel.length !== N_ORIG_TRI) throw new Error(`cloth-zone: mask is ${triLabel.length} triangles, expected ${N_ORIG_TRI}`)

  // Weld by position. The rim MUST be found in welded space: the 10,812-chart
  // atlas splits a boundary vertex into a garment-only and a body-only copy, so
  // an index-space "is in both" test finds neither and the rim shatters (probe1
  // got 102 fragments; welded it is 1,199 positions, exactly T120b's count).
  const wmap = new Map()
  const rep = new Int32Array(mesh.nv)
  for (let i = 0; i < mesh.nv; i++) {
    const k = `${mesh.pos[i * 3].toFixed(6)},${mesh.pos[i * 3 + 1].toFixed(6)},${mesh.pos[i * 3 + 2].toFixed(6)}`
    if (!wmap.has(k)) wmap.set(k, wmap.size)
    rep[i] = wmap.get(k)
  }
  const nW = wmap.size
  const wpos = new Float64Array(nW * 3)
  for (let i = 0; i < mesh.nv; i++) for (let k = 0; k < 3; k++) wpos[rep[i] * 3 + k] = mesh.pos[i * 3 + k]

  const wGar = new Uint8Array(nW)
  const wBody = new Uint8Array(nW)
  const isGarmentTri = new Uint8Array(nTri)
  for (let t = 0; t < nTri; t++) {
    const g = t < N_ORIG_TRI && triLabel[t] === 1
    isGarmentTri[t] = g ? 1 : 0
    const dst = g ? wGar : wBody
    for (let k = 0; k < 3; k++) dst[rep[mesh.tri[t * 3 + k]]] = 1
  }
  const gW = []
  for (let w = 0; w < nW; w++) if (wGar[w]) gW.push(w)

  const adj = Array.from({ length: nW }, () => null)
  for (let t = 0; t < nTri; t++) {
    if (!isGarmentTri[t]) continue
    const v = [rep[mesh.tri[t * 3]], rep[mesh.tri[t * 3 + 1]], rep[mesh.tri[t * 3 + 2]]]
    for (let k = 0; k < 3; k++) {
      const a = v[k], b = v[(k + 1) % 3]
      ;(adj[a] ??= new Set()).add(b)
      ;(adj[b] ??= new Set()).add(a)
    }
  }

  // Arm ownership by the arm CHAIN's weight, not by distance to the arm bone —
  // the shoulder joint sits inside the chest, so distance classifies half the
  // torso as sleeve (T120 measured this the hard way).
  const jointIdx = (n) => mesh.jointNames.indexOf(n)
  const armL = new Set(['LeftArm', 'LeftForeArm'].map(jointIdx))
  const armR = new Set(['RightArm', 'RightForeArm'].map(jointIdx))
  const wArm = new Float64Array(nW)
  {
    const acc = new Float64Array(nW), n = new Float64Array(nW)
    for (let i = 0; i < mesh.nv; i++) {
      const w = rep[i]
      if (!wGar[w]) continue
      n[w]++
      for (let k = 0; k < 4; k++) {
        const j = mesh.jnt[i * 4 + k], g = mesh.wgt[i * 4 + k]
        if (armL.has(j)) acc[w] += g
        if (armR.has(j)) acc[w] -= g
      }
    }
    for (const w of gW) wArm[w] = n[w] ? acc[w] / n[w] : 0
  }

  // Free edges: the parts of the rim a shirt is actually open at. The collar is
  // deliberately not one of them — it is pinned to the neck.
  const edgeKind = new Map()
  for (const w of gW) {
    if (!wBody[w]) continue
    const y = wpos[w * 3 + 1], z = wpos[w * 3 + 2]
    if (Math.abs(wArm[w]) > 0.5 && z > SLEEVE_Z) edgeKind.set(w, wArm[w] > 0 ? 'sleeveL' : 'sleeveR')
    else if (z > HEM_Z) edgeKind.set(w, 'hem')
    else if (y > PLACKET_Y && z > PLACKET_Z) edgeKind.set(w, 'placket')
  }
  if (edgeKind.size === 0) throw new Error('cloth-zone: no free edge found — the mask or the frame changed')

  const dist = new Float64Array(nW).fill(Infinity)
  {
    const heap = []
    const push = (d, w) => { heap.push([d, w]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p } }
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m } } return top }
    for (const w of edgeKind.keys()) { dist[w] = 0; push(0, w) }
    while (heap.length) {
      const [d, w] = pop()
      if (d > dist[w] || d > band) continue
      for (const b of adj[w] ?? []) {
        const e = Math.hypot(wpos[b * 3] - wpos[w * 3], wpos[b * 3 + 1] - wpos[w * 3 + 1], wpos[b * 3 + 2] - wpos[w * 3 + 2])
        if (d + e < dist[b]) { dist[b] = d + e; push(d + e, b) }
      }
    }
  }
  const alpha = new Float64Array(nW)
  const zone = []
  for (const w of gW) {
    alpha[w] = 1 - smoothstep(dist[w] / band)
    if (alpha[w] > 0) zone.push(w)
  }

  // Regions. Sleeves are separated before clustering: a centroid that straddles a
  // sleeve and the chest would ask one transform to serve two limbs.
  const groups = { torso: [], sleeveL: [], sleeveR: [] }
  for (const w of zone) groups[wArm[w] > 0.5 ? 'sleeveL' : wArm[w] < -0.5 ? 'sleeveR' : 'torso'].push(w)
  const region = new Map()
  const label = (pfx, assign) => { for (const [w, c] of assign) region.set(w, `${pfx}${c}`) }
  label('t', kmeans(wpos, groups.torso, torsoRegions, KMEANS_SEED))
  label('L', kmeans(wpos, groups.sleeveL, sleeveRegions, KMEANS_SEED + 1))
  label('R', kmeans(wpos, groups.sleeveR, sleeveRegions, KMEANS_SEED + 2))

  return { rep, nW, wpos, wGar, wBody, gW, adj, wArm, edgeKind, dist, alpha, zone, region, isGarmentTri }
}

/**
 * The cloth bone set: one bone per (body joint, region) pair carrying at least
 * `threshold` of the zone's cloth weight, plus the per-influence redirect table.
 *
 * @returns {{bones: {name:string, joint:number, region:string, mass:number}[],
 *            redirect: Map<string, number>, keptMass: number, zoneMass: number}}
 *          `redirect` maps `${vertex}:${slot}` to a cloth bone ordinal.
 */
export function clothBones(mesh, Z, threshold = PAIR_THRESHOLD) {
  const pairMass = new Map()
  let zoneMass = 0
  for (let i = 0; i < mesh.nv; i++) {
    const w = Z.rep[i]
    if (!Z.wGar[w] || Z.alpha[w] <= 0) continue
    const r = Z.region.get(w)
    for (let k = 0; k < 4; k++) {
      const g = mesh.wgt[i * 4 + k] * Z.alpha[w]
      if (g <= 0) continue
      const key = `${mesh.jnt[i * 4 + k]}|${r}`
      pairMass.set(key, (pairMass.get(key) ?? 0) + g)
      zoneMass += g
    }
  }
  // Sorted by mass then by key, so the bone order is a pure function of the mesh.
  const kept = [...pairMass]
    .filter(([, m]) => m / zoneMass >= threshold)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  const bones = kept.map(([key, mass]) => {
    const [j, r] = key.split('|')
    return { name: `Cloth_${mesh.jointNames[Number(j)]}_${r}`, joint: Number(j), region: r, mass: mass / zoneMass }
  })
  const ordinal = new Map(kept.map(([key], i) => [key, i]))
  const redirect = new Map()
  let keptMass = 0
  for (let i = 0; i < mesh.nv; i++) {
    const w = Z.rep[i]
    if (!Z.wGar[w] || Z.alpha[w] <= 0) continue
    const r = Z.region.get(w)
    for (let k = 0; k < 4; k++) {
      const g = mesh.wgt[i * 4 + k] * Z.alpha[w]
      if (g <= 0) continue
      const o = ordinal.get(`${mesh.jnt[i * 4 + k]}|${r}`)
      if (o === undefined) continue
      redirect.set(`${i}:${k}`, o)
      keptMass += g
    }
  }
  return { bones, redirect, keptMass: keptMass / zoneMass, zoneMass }
}

export function readMask(path) {
  const m = new Uint8Array(readFileSync(path))
  if (m.length !== N_ORIG_TRI) throw new Error(`cloth-zone: mask is ${m.length} triangles, expected ${N_ORIG_TRI}`)
  return m
}

/** Deterministic k-means++ over welded positions. */
export function kmeans(wpos, list, k, seed) {
  const out = new Map()
  if (!list.length) return out
  if (k <= 1) { for (const w of list) out.set(w, 0); return out }
  let s = seed >>> 0
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const P = (w) => [wpos[w * 3], wpos[w * 3 + 1], wpos[w * 3 + 2]]
  const cent = [P(list[Math.floor(rnd() * list.length)])]
  while (cent.length < k) {
    const d2 = list.map((w) => {
      const p = P(w)
      let m = Infinity
      for (const c of cent) m = Math.min(m, (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)
      return m
    })
    const tot = d2.reduce((a, b) => a + b, 0)
    let r = rnd() * tot, i = 0
    while (i < d2.length - 1 && (r -= d2[i]) > 0) i++
    cent.push(P(list[i]))
  }
  for (let it = 0; it < 60; it++) {
    for (const w of list) {
      const p = P(w)
      let best = 0, bd = Infinity
      for (let ci = 0; ci < cent.length; ci++) {
        const c = cent[ci]
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2
        if (d < bd) { bd = d; best = ci }
      }
      out.set(w, best)
    }
    const sum = cent.map(() => [0, 0, 0, 0])
    for (const w of list) { const p = P(w), a = sum[out.get(w)]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++ }
    for (let i = 0; i < cent.length; i++) if (sum[i][3]) cent[i] = [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]]
  }
  return out
}

/** The six shipped clips keyed by their raw source names (see CANONICAL). */
export const SOURCE_CLIPS = {
  Skip_Forward: 'Skip_Forward',
  Happy_Sway_Standing: 'Idle',
  Walk_Backward_inplace: 'Walk_Backward',
  '019f93e1-9b5a-770c-8e20-0e3ad4d204da': 'Jump_A',
  '019f93e2-9461-703f-988c-ec193d9b734b': 'Jump_B',
  '019ff2cd-967b-79e7-9ae0-0f0a73ae3227': 'Jump_Off',
}
