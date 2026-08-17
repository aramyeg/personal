#!/usr/bin/env node
/**
 * shirt-region.mjs — find the overshirt on the raw Meshy mesh, as a per-vertex mask.
 *
 * WHY THIS EXISTS
 *
 * T107 recorded that the shirt is not worn, it *is* the body. This lane measured
 * what that means precisely, and it is stronger than "fused at the seams":
 *
 *   - The whole export is THREE welded shells: the body (50,680 positions) and
 *     two shoelace scraps. The garment is not a shell.
 *   - Horizontal cross-sections through the torso between Z −1.30 and −0.82 are
 *     a SINGLE closed loop at every height. There is no inner face, no free hem
 *     edge and no surface underneath — the "hem lip" and the "open placket" that
 *     read as cloth in a render are creases in one continuous skin.
 *
 * So the garment cannot be selected (nothing to select) and cannot simply be
 * detached (detaching opens the entire torso, not a seam). It has to be *found*,
 * and this file finds it: a feature-sensitive geodesic Voronoi over the triangle
 * adjacency graph, seeded from anatomical points in the rig's own frame.
 *
 * THE METRIC. Walking from triangle to triangle costs a base step plus the
 * albedo difference across the shared edge plus the dihedral angle past a
 * tolerance. Colour and crease are exactly the two things that change at a
 * garment boundary and do not change inside a panel, so the front between the
 * garment seeds and the body seeds comes to rest on the garment's own outline
 * rather than on a plane someone chose.
 *
 * WHY SEEDS AND NOT k-MEANS. The atlas is a 10,812-island mosaic and the shirt
 * is patterned across five colour clusters that the tank, the hair and the
 * pants also occupy; global colour clustering puts every cluster over the whole
 * body (measured). Seeds are 3-D points near named joints, so the identification
 * is anchored to the rig, reproducible, and reviewable line by line.
 *
 * TWO CORRECTIONS THAT ARE NOT JUDGEMENT CALLS
 *   1. The hair shares the shirt's tan albedo and hangs onto the shoulders, so
 *      the front walks up the strands. Hair seeds pin it back, and an anatomical
 *      CEILING (4 cm above the shoulder joints, the top of the collar) returns
 *      anything higher to the body — a hair strand at ear height is not collar.
 *   2. Components below MIN_COMPONENT triangles are absorbed into their
 *      surround, on both sides, so the mask is one garment and the body has no
 *      confetti holes where a strand crossed it.
 *
 * OUTPUT. A Uint8Array over the source's POSITION accessor: 1 = garment. A
 * vertex is garment when it is garment in every incident triangle, so the mask's
 * boundary is a ring of body vertices — the seam the cloth stage pins to.
 *
 * USAGE
 *   node scripts/small-world/shirt-region.mjs            # diagnostics on the raw source
 *   node scripts/small-world/shirt-region.mjs --out m.bin
 *   import { shirtMask } from './shirt-region.mjs'
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSharp } from './load-sharp.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORKTREE = path.resolve(HERE, '..', '..')

/** Anything above this Z is hair, not collar. Shoulder joints sit at −1.286 /
 *  −1.290 and the collar tops out ~4 cm above them; measured, not guessed. */
const Z_CEILING = -1.4
/** Triangles. Below this a component is noise on either side of the boundary. */
const MIN_COMPONENT = 200
/** Metric weights: base step, albedo (per 0–255 L1 unit), dihedral past 0.35 rad. */
const W_BASE = 1
const W_COLOUR = 0.05
const W_CREASE = 12
const CREASE_FREE = 0.35

/**
 * Seed points, in the raw export's frame (X right, Y front, Z up-is-negative;
 * head_end −1.700, feet 0). `dir` rejects candidate triangles whose normal
 * faces the wrong way, so a seed on the chest cannot land on the back surface
 * that happens to be nearer in space.
 */
export const SEEDS = [
  // --- the garment -------------------------------------------------------
  { name: 'shirt-frontL', cls: 1, p: [0.13, 0.15, -1.07], dir: [0.3, 1, 0] },
  { name: 'shirt-frontR', cls: 1, p: [-0.13, 0.15, -1.07], dir: [-0.3, 1, 0] },
  { name: 'shirt-frontL-up', cls: 1, p: [0.11, 0.16, -1.22], dir: [0.3, 1, 0] },
  { name: 'shirt-frontR-up', cls: 1, p: [-0.11, 0.16, -1.22], dir: [-0.3, 1, 0] },
  { name: 'sleeveL', cls: 1, p: [0.24, -0.02, -1.16], dir: [1, 0, 0] },
  { name: 'sleeveR', cls: 1, p: [-0.24, -0.02, -1.16], dir: [-1, 0, 0] },
  { name: 'shirt-sideL', cls: 1, p: [0.18, -0.02, -1.0], dir: [1, 0, 0] },
  { name: 'shirt-sideR', cls: 1, p: [-0.18, -0.02, -1.0], dir: [-1, 0, 0] },
  { name: 'shoulderL-top', cls: 1, p: [0.12, -0.03, -1.32], dir: [0, 0, -1] },
  { name: 'shoulderR-top', cls: 1, p: [-0.12, -0.03, -1.32], dir: [0, 0, -1] },
  { name: 'shirt-backL', cls: 1, p: [0.16, -0.19, -0.99], dir: [0.3, -1, 0] },
  { name: 'shirt-backR', cls: 1, p: [-0.16, -0.19, -0.99], dir: [-0.3, -1, 0] },
  { name: 'shirt-back-lo', cls: 1, p: [0.0, -0.21, -0.93], dir: [0, -1, 0] },
  { name: 'shirt-backL-up', cls: 1, p: [0.2, -0.13, -1.18], dir: [0.6, -1, 0] },
  { name: 'shirt-backR-up', cls: 1, p: [-0.2, -0.13, -1.18], dir: [-0.6, -1, 0] },
  // --- everything else ---------------------------------------------------
  { name: 'tank-chest', cls: 0, p: [0.0, 0.17, -1.2], dir: [0, 1, 0] },
  { name: 'tank-mid', cls: 0, p: [0.0, 0.16, -1.05], dir: [0, 1, 0] },
  { name: 'belly', cls: 0, p: [0.0, 0.16, -0.93], dir: [0, 1, 0] },
  { name: 'neck-front', cls: 0, p: [0.01, 0.05, -1.38], dir: [0, 1, 0] },
  { name: 'head', cls: 0, p: [0.01, 0.1, -1.5], dir: [0, 1, 0] },
  { name: 'armL-lower', cls: 0, p: [0.235, -0.01, -1.02], dir: [1, 0, 0] },
  { name: 'armR-lower', cls: 0, p: [-0.235, -0.01, -1.02], dir: [-1, 0, 0] },
  { name: 'handL', cls: 0, p: [0.29, 0.0, -0.87], dir: [1, 0, 0] },
  { name: 'handR', cls: 0, p: [-0.29, 0.0, -0.87], dir: [-1, 0, 0] },
  { name: 'pants-frontL', cls: 0, p: [0.1, 0.17, -0.78], dir: [0, 1, 0] },
  { name: 'pants-frontR', cls: 0, p: [-0.1, 0.17, -0.78], dir: [0, 1, 0] },
  { name: 'pants-back', cls: 0, p: [0.0, -0.2, -0.78], dir: [0, -1, 0] },
  { name: 'pants-sideL', cls: 0, p: [0.2, 0.0, -0.75], dir: [1, 0, 0] },
  { name: 'pants-sideR', cls: 0, p: [-0.2, 0.0, -0.75], dir: [-1, 0, 0] },
  { name: 'legL', cls: 0, p: [0.15, 0.02, -0.4], dir: [1, 0, 0] },
  { name: 'legR', cls: 0, p: [-0.15, 0.02, -0.4], dir: [-1, 0, 0] },
  { name: 'footL', cls: 0, p: [0.15, 0.1, -0.05], dir: [0, 0, 1] },
  { name: 'footR', cls: 0, p: [-0.15, 0.1, -0.05], dir: [0, 0, 1] },
  // Hair: same tan albedo as the shirt back, and it lies ON the shoulders.
  { name: 'hair-b1', cls: 0, p: [0.0, -0.25, -1.15], dir: [0, -1, 0] },
  { name: 'hair-b2', cls: 0, p: [0.0, -0.26, -1.3], dir: [0, -1, 0] },
  { name: 'hair-b3', cls: 0, p: [0.1, -0.24, -1.06], dir: [0, -1, 0] },
  { name: 'hair-b4', cls: 0, p: [-0.1, -0.24, -1.06], dir: [0, -1, 0] },
  { name: 'hair-b5', cls: 0, p: [0.14, -0.22, -1.25], dir: [0.4, -1, 0] },
  { name: 'hair-b6', cls: 0, p: [-0.14, -0.22, -1.25], dir: [-0.4, -1, 0] },
  { name: 'hair-b7', cls: 0, p: [0.0, -0.25, -1.55], dir: [0, -1, 0] },
  { name: 'hair-sideL', cls: 0, p: [0.19, -0.1, -1.42], dir: [1, -0.3, 0] },
  { name: 'hair-sideR', cls: 0, p: [-0.19, -0.1, -1.42], dir: [-1, -0.3, 0] },
  { name: 'hair-frontL', cls: 0, p: [0.14, 0.06, -1.34], dir: [0.6, 1, 0] },
  { name: 'hair-frontR', cls: 0, p: [-0.14, 0.06, -1.34], dir: [-0.6, 1, 0] },
]

/** Binary min-heap. Insertion order breaks ties, so the walk is reproducible. */
function makeHeap() {
  const a = []
  return {
    get size() {
      return a.length
    },
    push(d, t) {
      a.push([d, t])
      let i = a.length - 1
      while (i > 0) {
        const p = (i - 1) >> 1
        if (a[p][0] <= a[i][0]) break
        ;[a[p], a[i]] = [a[i], a[p]]
        i = p
      }
    },
    pop() {
      const top = a[0]
      const last = a.pop()
      if (a.length) {
        a[0] = last
        for (let i = 0; ; ) {
          const l = 2 * i + 1
          const r = l + 1
          let s = i
          if (l < a.length && a[l][0] < a[s][0]) s = l
          if (r < a.length && a[r][0] < a[s][0]) s = r
          if (s === i) break
          ;[a[s], a[i]] = [a[i], a[s]]
          i = s
        }
      }
      return top
    },
  }
}

/** Triangle-level features: centroid, atlas albedo at the centroid UV, normal. */
function triangleFeatures(pos, uv, idx, atlas) {
  const T = idx.length / 3
  const { data, width: W, height: H, channels: C } = atlas
  const cen = new Float64Array(T * 3)
  const col = new Float64Array(T * 3)
  const nrm = new Float64Array(T * 3)
  for (let t = 0; t < T; t++) {
    const a = idx[t * 3]
    const b = idx[t * 3 + 1]
    const c = idx[t * 3 + 2]
    for (let k = 0; k < 3; k++) cen[t * 3 + k] = (pos[a * 3 + k] + pos[b * 3 + k] + pos[c * 3 + k]) / 3
    // Centroid UV, not vertex UV: a vertex sits ON an island edge, where the
    // atlas is padding bled from a neighbouring chart. Measured — vertex
    // sampling puts every colour cluster over the whole body.
    const cu = (uv[a * 2] + uv[b * 2] + uv[c * 2]) / 3
    const cv = (uv[a * 2 + 1] + uv[b * 2 + 1] + uv[c * 2 + 1]) / 3
    const x = Math.min(W - 1, Math.max(0, Math.round(cu * W - 0.5)))
    const y = Math.min(H - 1, Math.max(0, Math.round(cv * H - 0.5)))
    const o = (y * W + x) * C
    col[t * 3] = data[o]
    col[t * 3 + 1] = data[o + 1]
    col[t * 3 + 2] = data[o + 2]
    const ux = pos[b * 3] - pos[a * 3]
    const uy = pos[b * 3 + 1] - pos[a * 3 + 1]
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2]
    const vx = pos[c * 3] - pos[a * 3]
    const vy = pos[c * 3 + 1] - pos[a * 3 + 1]
    const vz = pos[c * 3 + 2] - pos[a * 3 + 2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const L = Math.hypot(nx, ny, nz) || 1
    nrm[t * 3] = nx / L
    nrm[t * 3 + 1] = ny / L
    nrm[t * 3 + 2] = nz / L
  }
  return { T, cen, col, nrm }
}

/** Triangle adjacency over WELDED edges — the atlas splits a position into up
 *  to 2.06 index-space vertices, so raw index edges would leave the surface in
 *  10,812 disconnected pieces. */
function triangleAdjacency(pos, idx, nVerts) {
  const rep = new Int32Array(nVerts)
  const key = new Map()
  for (let i = 0; i < nVerts; i++) {
    const k = `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`
    let j = key.get(k)
    if (j === undefined) {
      j = key.size
      key.set(k, j)
    }
    rep[i] = j
  }
  const T = idx.length / 3
  const adj = Array.from({ length: T }, () => [])
  const seen = new Map()
  for (let t = 0; t < T; t++) {
    for (let e = 0; e < 3; e++) {
      const a = rep[idx[t * 3 + e]]
      const b = rep[idx[t * 3 + ((e + 1) % 3)]]
      const k = a < b ? `${a}_${b}` : `${b}_${a}`
      const o = seen.get(k)
      if (o === undefined) seen.set(k, t)
      else {
        adj[t].push(o)
        adj[o].push(t)
      }
    }
  }
  return adj
}

/** Connected components of the triangles satisfying `pred`, largest first. */
function components(T, adj, pred) {
  const seen = new Uint8Array(T)
  const out = []
  for (let s = 0; s < T; s++) {
    if (seen[s] || !pred(s)) continue
    const stack = [s]
    seen[s] = 1
    const c = []
    while (stack.length) {
      const t = stack.pop()
      c.push(t)
      for (const u of adj[t])
        if (!seen[u] && pred(u)) {
          seen[u] = 1
          stack.push(u)
        }
    }
    out.push(c)
  }
  return out.sort((a, b) => b.length - a.length)
}

/**
 * @param {import('@gltf-transform/core').Document} doc  the raw Meshy source
 * @returns {{ mask: Uint8Array, triLabel: Uint8Array, report: object }}
 *   `mask` is per POSITION-accessor vertex; `triLabel` is per triangle.
 */
export async function shirtMask(doc) {
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]
  const pos = prim.getAttribute('POSITION').getArray()
  const uv = prim.getAttribute('TEXCOORD_0').getArray()
  const idx = prim.getIndices().getArray()
  const nVerts = prim.getAttribute('POSITION').getCount()

  const sharp = loadSharp()
  const image = doc.getRoot().listTextures()[0].getImage()
  const { data, info } = await sharp(Buffer.from(image)).raw().toBuffer({ resolveWithObject: true })
  const atlas = { data, width: info.width, height: info.height, channels: info.channels }

  const { T, cen, col, nrm } = triangleFeatures(pos, uv, idx, atlas)
  const adj = triangleAdjacency(pos, idx, nVerts)

  const nearestTri = (p, dir) => {
    let best = -1
    let bd = Infinity
    for (let t = 0; t < T; t++) {
      const d = (cen[t * 3] - p[0]) ** 2 + (cen[t * 3 + 1] - p[1]) ** 2 + (cen[t * 3 + 2] - p[2]) ** 2
      if (d >= bd) continue
      if (dir) {
        const L = Math.hypot(dir[0], dir[1], dir[2])
        const dot = (nrm[t * 3] * dir[0] + nrm[t * 3 + 1] * dir[1] + nrm[t * 3 + 2] * dir[2]) / L
        if (dot < 0.35) continue
      }
      bd = d
      best = t
    }
    return best
  }

  const label = new Int32Array(T).fill(-1)
  const dist = new Float64Array(T).fill(Infinity)
  const heap = makeHeap()
  const seedTris = []
  for (const s of SEEDS) {
    const t = nearestTri(s.p, s.dir)
    if (t < 0) throw new Error(`shirt-region: seed ${s.name} found no forward-facing triangle`)
    seedTris.push({ name: s.name, cls: s.cls, tri: t })
    label[t] = s.cls
    dist[t] = 0
    heap.push(0, t)
  }
  while (heap.size) {
    const [d, t] = heap.pop()
    if (d > dist[t]) continue
    for (const u of adj[t]) {
      const dc =
        Math.abs(col[t * 3] - col[u * 3]) +
        Math.abs(col[t * 3 + 1] - col[u * 3 + 1]) +
        Math.abs(col[t * 3 + 2] - col[u * 3 + 2])
      const dot = nrm[t * 3] * nrm[u * 3] + nrm[t * 3 + 1] * nrm[u * 3 + 1] + nrm[t * 3 + 2] * nrm[u * 3 + 2]
      const ang = Math.acos(Math.max(-1, Math.min(1, dot)))
      const w = W_BASE + W_COLOUR * dc + W_CREASE * Math.max(0, ang - CREASE_FREE)
      if (d + w < dist[u]) {
        dist[u] = d + w
        label[u] = label[t]
        heap.push(d + w, u)
      }
    }
  }
  for (let t = 0; t < T; t++) if (label[t] < 0) label[t] = 0

  const grown = label.reduce((s, v) => s + v, 0)
  let ceilinged = 0
  for (let t = 0; t < T; t++)
    if (label[t] === 1 && cen[t * 3 + 2] < Z_CEILING) {
      label[t] = 0
      ceilinged++
    }
  const shirtComps = components(T, adj, (t) => label[t] === 1)
  for (const c of shirtComps) if (c.length < MIN_COMPONENT) for (const t of c) label[t] = 0
  const bodyComps = components(T, adj, (t) => label[t] === 0)
  for (let i = 1; i < bodyComps.length; i++)
    if (bodyComps[i].length < MIN_COMPONENT) for (const t of bodyComps[i]) label[t] = 1

  // A vertex is garment only where every incident triangle is; the mask's
  // boundary is therefore a ring of BODY vertices — the seam the cloth pins to.
  const mask = new Uint8Array(nVerts).fill(1)
  const touched = new Uint8Array(nVerts)
  for (let t = 0; t < T; t++) {
    for (let k = 0; k < 3; k++) {
      const v = idx[t * 3 + k]
      touched[v] = 1
      if (label[t] !== 1) mask[v] = 0
    }
  }
  for (let v = 0; v < nVerts; v++) if (!touched[v]) mask[v] = 0

  let tris = 0
  for (let t = 0; t < T; t++) if (label[t] === 1) tris++
  let verts = 0
  for (let v = 0; v < nVerts; v++) if (mask[v]) verts++
  const report = {
    triangles: tris,
    triangleTotal: T,
    vertices: verts,
    vertexTotal: nVerts,
    grownTriangles: grown,
    ceilingRemoved: ceilinged,
    shirtComponents: shirtComps.map((c) => c.length).slice(0, 6),
    bodyComponents: bodyComps.map((c) => c.length).slice(0, 6),
    seeds: seedTris,
    knobs: { Z_CEILING, MIN_COMPONENT, W_BASE, W_COLOUR, W_CREASE, CREASE_FREE },
  }
  return { mask, triLabel: Uint8Array.from(label), report }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('shirt-region.mjs')) {
  const { NodeIO } = await import('@gltf-transform/core')
  const src = process.env.SRC ?? path.join(WORKTREE, 'public/labs/small-world/girl-v2.glb')
  const doc = await new NodeIO().read(src)
  const { mask, triLabel, report } = await shirtMask(doc)
  const { seeds, ...rest } = report
  console.log(JSON.stringify(rest, null, 1))
  console.log(
    `garment: ${report.triangles} of ${report.triangleTotal} triangles (${((100 * report.triangles) / report.triangleTotal).toFixed(2)}%), ` +
      `${report.vertices} of ${report.vertexTotal} vertices`
  )
  const i = process.argv.indexOf('--out')
  if (i > 0) {
    writeFileSync(process.argv[i + 1], Buffer.from(mask))
    writeFileSync(process.argv[i + 1].replace(/\.bin$/, '.tri.bin'), Buffer.from(triLabel))
    console.log('wrote', process.argv[i + 1])
  }
}
