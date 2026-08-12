#!/usr/bin/env node
/**
 * line-girl.mjs — build the body surface that Meshy never modelled.
 *
 * WHY THIS EXISTS
 *
 * T118 measured the wall this stage exists to remove: the overshirt has NO free
 * boundary. Hem, placket, collar and sleeve ends are creases in ONE continuous
 * skin, and under the garment there is no torso and no upper arm — the shirt's
 * outer face is the only surface there is. So the garment cannot be detached
 * (detaching opens the whole torso), and it cannot even be reweighted in
 * isolation, because 100% of its outline is a seam against skin.
 *
 * This stage duplicates the garment patch, pushes the copy inward along a
 * smoothed normal field, and welds it back to the body along the garment's own
 * outline. The result is a closed body surface again — one that happens to run
 * just under the shirt — with the shirt left on top as a flap attached along the
 * same outline ring. T121 cuts that ring and the garment comes free over a body
 * that exists.
 *
 * ---------------------------------------------------------------------------
 * FOUR CONSTRUCTION DECISIONS, AND WHY THEY ARE NOT THE SKETCH'S
 *
 * 1. WINDING IS KEPT, NOT FLIPPED. T118 §4's sketch says "flip the winding".
 *    That would make the copy face the body's interior — the inside face of a
 *    cloth slab, invisible from outside under FrontSide culling. But the copy's
 *    job is to BE THE BODY once the garment lifts, and the UV plan in the same
 *    sketch (torso reads as tank, sleeve reads as arm skin) is a body reading,
 *    not a cloth reading. An inward-offset patch keeps its orientation, so
 *    keeping the winding is what leaves the normals pointing out of the figure.
 *    Asserted at run time by the source's signed volume, which is +130 L.
 *
 * 2. THE OFFSET TAPERS TO ZERO AT THE OUTLINE, so the weld needs no new
 *    geometry: the lining's rim sits exactly on the body's rim. Body plus lining
 *    is then a closed surface, which is what "watertight where it was
 *    watertight" means here. The taper is 1 − exp(−d/TAU) rather than a
 *    smoothstep because the band next to the rim is the dangerous one: the
 *    simplifier's error budget is ~1.5 mm, so the lining has to get clear of the
 *    garment within a couple of millimetres of the rim or simplification can
 *    push it back out. TAU = 6 mm puts it 2.6 mm inside at 1.5 mm from the rim.
 *
 * 3. THE WELD IS POSITIONAL, NOT INDEX-SHARED. Rim vertices are duplicated at
 *    the same coordinates instead of being reused. They have to be: the lining
 *    carries its own UVs, and a triangle with one body UV and two lining UVs
 *    interpolates a line straight across a 10,812-island atlas — every rim
 *    triangle would smear through unrelated charts. Duplicating costs ~1.5k
 *    vertices and makes the lining one welded patch whose boundary is coincident
 *    with the body's, which is a UV seam of exactly the kind this mesh already
 *    has 10,812 of.
 *
 * 4. THE LINING IS WELDED (one vertex per POSITION), not a copy of the garment's
 *    index-space vertices. The garment's 16,607 index-space vertices are 7,412
 *    positions split by the atlas; the lining needs no atlas splits because its
 *    UVs are constant per region, so it ships less than half the vertices.
 *
 * WEIGHTS come from the vertex the lining vertex was made from — which is the
 * nearest point of the outer body surface, by construction. That is T118's
 * continuity law satisfied exactly rather than approximately: at the rim the
 * lining's weights ARE the body's, and the step in envelope that made T118's
 * anchor-split the worst build of the campaign cannot form.
 *
 * UVS are a constant per region, sampled from the atlas at a measured point on
 * real tank fabric (torso) or real arm skin (sleeves). The alternative — remap
 * the lining onto the tank's charts — is not available: the atlas is a mosaic of
 * 10,812 islands with a median shipped triangle of 3.5 texels, so there is no
 * "tank band" to map onto, only thousands of unrelated scraps. A constant UV
 * costs no atlas bytes and gives a flat fabric colour that the 4-band toon ramp
 * then shades; see the report for what it looks like.
 *
 * USAGE
 *   node scripts/small-world/line-girl.mjs                    # → girl-v2-lined.glb
 *   node scripts/small-world/line-girl.mjs --offset 0.010
 *   node scripts/small-world/line-girl.mjs --mask m.bin       # reuse a cached mask
 *   node scripts/small-world/line-girl.mjs --dry              # measure, write nothing
 *
 * Deterministic: same input + same knobs → same output bytes.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { shirtMask } from './shirt-region.mjs'
import { loadSharp } from './load-sharp.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORKTREE = path.resolve(HERE, '..', '..')

/** Metres. The gap between the shirt and the body it now has. Chosen by
 *  measurement, not taste: see the report's offset sweep. */
export const OFFSET = 0.012
/** Metres. Taper length constant — see decision 2 above. */
export const TAU = 0.006
/** The offset never exceeds this fraction of the local through-thickness, so a
 *  thin limb cannot be turned inside out. */
export const THICKNESS_FRACTION = 0.4
/** Laplacian passes over the offset direction field. */
export const NORMAL_SMOOTHING = 6
/**
 * Laplacian passes over the lining's POSITIONS, rim pinned.
 *
 * This is the difference between a lining that works and one that does not, and
 * the reason is a modelling fact rather than a numerical one: a body under a
 * shirt does not have the shirt's wrinkles. Following them cost twice over —
 * the through-thickness across a fold is a millimetre, so the offset collapsed
 * to nothing exactly there, and then any pose that deepened the fold pushed the
 * lining out through it. The measured leak was a magenta stripe down her back on
 * Jump_Off. Cutting across the folds removes the cause instead of the symptom.
 */
export const POSITION_SMOOTHING = 10
/** The smoothing displacement is never allowed past this fraction of the local
 *  offset, so the lining cannot be smoothed OUT through a fold's valley: the
 *  clearance is at least (1 − SMOOTH_CLAMP) x offset by construction. */
export const SMOOTH_CLAMP = 0.5
/**
 * The floor on how far inside its own source vertex's tangent plane a lining
 * vertex must finish, as a fraction of that vertex's offset.
 *
 * This is the stage's actual guarantee, and until T120b it was only ever an
 * assumption: both smoothers work on smoothed quantities that are free to
 * disagree with the local surface, and where they did, the lining came out on
 * the wrong side of the shirt. A fraction rather than a fixed distance because
 * the offset itself tapers to zero at the rim, where the two surfaces are
 * coincident by design and a fixed floor would tear the weld open.
 */
export const CLEARANCE_FRACTION = 0.4
/** Median-filter passes over the through-thickness field. Thickness is a
 *  property of the body and varies smoothly; a single wrinkle that reports
 *  1 mm is the shirt, and the median of its neighbours is the body. */
export const THICKNESS_MEDIAN = 3
/** Below this, a position's area-weighted normal is a fold artefact, not a
 *  direction — see offsetDirections(). */
export const COHERENCE_FLOOR = 0.5
/** A ray only counts a wall it is leaving the volume through — see firstHit(). */
export const EXIT_FACING = 0.2

/** Probe points on surfaces the lining should look like, in the export's frame
 *  (X right, Y front, Z up-is-negative). `dir` rejects a candidate whose normal
 *  faces away, so a chest probe cannot land on the back. */
const UV_PROBES = {
  tank: { p: [0.0, 0.17, -1.2], dir: [0, 1, 0] },
  skin: { p: [0.235, -0.01, -1.02], dir: [1, 0, 0] },
}

// ---------------------------------------------------------------------------
// small geometry helpers
// ---------------------------------------------------------------------------

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const vertexAt = (pos, i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]

/** Weld POSITION to 1e-5 — the same key shirt-region.mjs uses, so the mask and
 *  this stage agree on what "a vertex" is. */
function weldPositions(pos, nVerts) {
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
  return { rep, count: key.size }
}

/** Binary min-heap keyed by distance; insertion order breaks ties. */
function makeHeap() {
  const a = []
  const swap = (i, j) => {
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return {
    get size() {
      return a.length
    },
    push(d, v) {
      a.push([d, v])
      let i = a.length - 1
      while (i > 0) {
        const p = (i - 1) >> 1
        if (a[p][0] <= a[i][0]) break
        swap(p, i)
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
          let s = i
          if (l < a.length && a[l][0] < a[s][0]) s = l
          if (l + 1 < a.length && a[l + 1][0] < a[s][0]) s = l + 1
          if (s === i) break
          swap(s, i)
          i = s
        }
      }
      return top
    },
  }
}

// ---------------------------------------------------------------------------
// the patch: which welded positions the garment owns, and where its rim is
// ---------------------------------------------------------------------------

/**
 * A welded position belongs to the patch when any garment triangle touches it;
 * it is RIM when a body triangle touches it too. The rim is exactly the garment
 * outline T118 could not find a free edge at, and it is where the weld happens.
 */
function patchOf(idx, triLabel, rep, nWelded) {
  const inPatch = new Uint8Array(nWelded)
  const onRim = new Uint8Array(nWelded)
  const T = idx.length / 3
  for (let t = 0; t < T; t++) {
    const garment = triLabel[t] === 1
    for (let k = 0; k < 3; k++) {
      const w = rep[idx[t * 3 + k]]
      if (garment) inPatch[w] = 1
      else onRim[w] = 1
    }
  }
  for (let w = 0; w < nWelded; w++) if (!inPatch[w]) onRim[w] = 0
  return { inPatch, onRim }
}

/**
 * Area-weighted face normals over the garment's triangles only, smoothed by
 * uniform Laplacian passes across the patch and renormalised each pass.
 *
 * The one subtlety is FOLDS. The placket lip and the hem lip are places where
 * the surface turns back on itself, so a single position carries faces pointing
 * in opposite directions and its area-weighted sum is near zero — normalising
 * that would amplify noise into an offset direction. Coherence (|sum of area
 * normals| over sum of areas) names those positions: 59 of 8,611 fall below
 * COHERENCE_FLOOR. They are zeroed before smoothing so the Laplacian fills them
 * in from the panel around them, which is where a lip's inside actually is.
 */
function offsetDirections(pos, idx, triLabel, rep, nWelded, inPatch, passes) {
  const n = new Float64Array(nWelded * 3)
  const area = new Float64Array(nWelded)
  const T = idx.length / 3
  for (let t = 0; t < T; t++) {
    if (triLabel[t] !== 1) continue
    const a = vertexAt(pos, idx[t * 3])
    const b = vertexAt(pos, idx[t * 3 + 1])
    const c = vertexAt(pos, idx[t * 3 + 2])
    const f = cross(sub(b, a), sub(c, a)) // length = 2 x area, so weighting is free
    const L = Math.hypot(...f)
    for (let k = 0; k < 3; k++) {
      const w = rep[idx[t * 3 + k]]
      n[w * 3] += f[0]
      n[w * 3 + 1] += f[1]
      n[w * 3 + 2] += f[2]
      area[w] += L
    }
  }
  const coherence = new Float64Array(nWelded)
  const folds = []
  for (let w = 0; w < nWelded; w++) {
    if (!inPatch[w]) continue
    coherence[w] = area[w] ? Math.hypot(n[w * 3], n[w * 3 + 1], n[w * 3 + 2]) / area[w] : 0
    if (coherence[w] < COHERENCE_FLOOR) {
      folds.push(w)
      n[w * 3] = n[w * 3 + 1] = n[w * 3 + 2] = 0
    }
  }
  const normalise = (arr) => {
    for (let w = 0; w < nWelded; w++) {
      const L = Math.hypot(arr[w * 3], arr[w * 3 + 1], arr[w * 3 + 2])
      if (!L) continue
      arr[w * 3] /= L
      arr[w * 3 + 1] /= L
      arr[w * 3 + 2] /= L
    }
  }
  const raw = new Float64Array(n)
  normalise(raw)
  normalise(n)
  const adj = patchAdjacency(idx, triLabel, rep, nWelded)
  for (let pass = 0; pass < passes; pass++) {
    const next = new Float64Array(n)
    for (let w = 0; w < nWelded; w++) {
      if (!inPatch[w] || !adj[w]) continue
      let x = n[w * 3]
      let y = n[w * 3 + 1]
      let z = n[w * 3 + 2]
      for (const u of adj[w]) {
        x += n[u * 3]
        y += n[u * 3 + 1]
        z += n[u * 3 + 2]
      }
      next[w * 3] = x
      next[w * 3 + 1] = y
      next[w * 3 + 2] = z
    }
    normalise(next)
    n.set(next)
  }
  return { dir: n, raw, coherence, folds }
}

/** Neighbour lists over the patch's welded edges. */
function patchAdjacency(idx, triLabel, rep, nWelded) {
  const adj = new Array(nWelded)
  const add = (a, b) => {
    if (!adj[a]) adj[a] = new Set()
    adj[a].add(b)
  }
  const T = idx.length / 3
  for (let t = 0; t < T; t++) {
    if (triLabel[t] !== 1) continue
    const v = [rep[idx[t * 3]], rep[idx[t * 3 + 1]], rep[idx[t * 3 + 2]]]
    for (let k = 0; k < 3; k++) {
      add(v[k], v[(k + 1) % 3])
      add(v[(k + 1) % 3], v[k])
    }
  }
  return adj
}

/** Shortest path along patch edges from the rim, in metres. */
function distanceFromRim(welded, adj, inPatch, onRim, nWelded) {
  const d = new Float64Array(nWelded).fill(Infinity)
  const heap = makeHeap()
  for (let w = 0; w < nWelded; w++)
    if (onRim[w]) {
      d[w] = 0
      heap.push(0, w)
    }
  while (heap.size) {
    const [dv, v] = heap.pop()
    if (dv > d[v]) continue
    if (!adj[v]) continue
    for (const u of adj[v]) {
      if (!inPatch[u]) continue
      const step = Math.hypot(
        welded[u * 3] - welded[v * 3],
        welded[u * 3 + 1] - welded[v * 3 + 1],
        welded[u * 3 + 2] - welded[v * 3 + 2]
      )
      if (dv + step < d[u]) {
        d[u] = dv + step
        heap.push(dv + step, u)
      }
    }
  }
  return d
}

/** Neighbourhood median of a scalar field over the patch, `passes` times.
 *  Infinities survive as infinities, which is what "the ray left the body"
 *  should mean rather than a large finite number pulling a median around. */
function medianFilter(field, adj, inPatch, nWelded, passes) {
  let cur = Float64Array.from(field)
  for (let p = 0; p < passes; p++) {
    const next = Float64Array.from(cur)
    for (let w = 0; w < nWelded; w++) {
      if (!inPatch[w] || !adj[w]) continue
      const vals = [cur[w]]
      for (const u of adj[w]) if (inPatch[u]) vals.push(cur[u])
      vals.sort((a, b) => a - b)
      next[w] = vals[vals.length >> 1]
    }
    cur = next
  }
  return cur
}

/** Uniform Laplacian on the patch's positions with the rim held fixed — the
 *  smoothed surface the lining is built from. Half-weight (lambda 0.5) keeps a
 *  pass from overshooting on the long thin triangles the atlas leaves behind. */
function smoothPatchPositions(welded, adj, inPatch, onRim, nWelded, passes) {
  const cur = Float64Array.from(welded)
  for (let p = 0; p < passes; p++) {
    const next = Float64Array.from(cur)
    for (let w = 0; w < nWelded; w++) {
      if (!inPatch[w] || onRim[w] || !adj[w] || !adj[w].size) continue
      const acc = [0, 0, 0]
      for (const u of adj[w]) for (let k = 0; k < 3; k++) acc[k] += cur[u * 3 + k]
      for (let k = 0; k < 3; k++) next[w * 3 + k] = cur[w * 3 + k] + 0.5 * (acc[k] / adj[w].size - cur[w * 3 + k])
    }
    cur.set(next)
  }
  return cur
}

// ---------------------------------------------------------------------------
// through-thickness: how far it is to the far side of the body
// ---------------------------------------------------------------------------

/** Uniform grid over triangles, for short rays only. */
function makeTriangleGrid(pos, idx, cell) {
  const T = idx.length / 3
  const lo = [Infinity, Infinity, Infinity]
  for (let i = 0; i < pos.length / 3; i++) for (let k = 0; k < 3; k++) lo[k] = Math.min(lo[k], pos[i * 3 + k])
  const bins = new Map()
  const keyOf = (x, y, z) => `${x},${y},${z}`
  for (let t = 0; t < T; t++) {
    const b = [Infinity, Infinity, Infinity]
    const e = [-Infinity, -Infinity, -Infinity]
    for (let k = 0; k < 3; k++)
      for (let j = 0; j < 3; j++) {
        const v = pos[idx[t * 3 + k] * 3 + j]
        b[j] = Math.min(b[j], v)
        e[j] = Math.max(e[j], v)
      }
    const c0 = b.map((v, k) => Math.floor((v - lo[k]) / cell))
    const c1 = e.map((v, k) => Math.floor((v - lo[k]) / cell))
    for (let x = c0[0]; x <= c1[0]; x++)
      for (let y = c0[1]; y <= c1[1]; y++)
        for (let z = c0[2]; z <= c1[2]; z++) {
          const k = keyOf(x, y, z)
          const list = bins.get(k)
          if (list) list.push(t)
          else bins.set(k, [t])
        }
  }
  return { lo, cell, bins, keyOf }
}

/** Möller–Trumbore, front and back faces both counted. */
function rayTriangle(o, dir, a, b, c) {
  const e1 = sub(b, a)
  const e2 = sub(c, a)
  const p = cross(dir, e2)
  const det = dot(e1, p)
  if (Math.abs(det) < 1e-12) return Infinity
  const inv = 1 / det
  const tv = sub(o, a)
  const u = dot(tv, p) * inv
  if (u < -1e-9 || u > 1 + 1e-9) return Infinity
  const q = cross(tv, e1)
  const v = dot(dir, q) * inv
  if (v < -1e-9 || u + v > 1 + 1e-9) return Infinity
  const t = dot(e2, q) * inv
  return t > 1e-6 ? t : Infinity
}

/**
 * Distance from `o` along `dir` to the first surface the ray EXITS THROUGH —
 * the far wall of the body, which is what "how much room is there" means.
 *
 * The exit filter is the whole point. A ray fired inward from a concave crease
 * grazes the triangles that share its own vertex within a fraction of a
 * millimetre, and a naive first-hit reported a through-thickness of 0.3 mm over
 * the placket and every wrinkle — 28% of the patch capped to nothing. A wall the
 * ray leaves the volume through has an outward normal with a positive component
 * along the ray; a neighbour of the origin has a negative one. Filtering on that
 * is exact rather than a distance fudge.
 */
function firstHit(grid, pos, idx, faceNormal, o, dir, maxT) {
  const { lo, cell, bins, keyOf } = grid
  const steps = Math.ceil(maxT / (cell * 0.5)) + 1
  const seen = new Set()
  let best = Infinity
  for (let s = 0; s <= steps; s++) {
    const t = Math.min(maxT, s * cell * 0.5)
    const c = [0, 1, 2].map((k) => Math.floor((o[k] + dir[k] * t - lo[k]) / cell))
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const list = bins.get(keyOf(c[0] + dx, c[1] + dy, c[2] + dz))
          if (!list) continue
          for (const tri of list) {
            if (seen.has(tri)) continue
            seen.add(tri)
            const facing =
              faceNormal[tri * 3] * dir[0] + faceNormal[tri * 3 + 1] * dir[1] + faceNormal[tri * 3 + 2] * dir[2]
            if (facing < EXIT_FACING) continue
            const hit = rayTriangle(
              o,
              dir,
              vertexAt(pos, idx[tri * 3]),
              vertexAt(pos, idx[tri * 3 + 1]),
              vertexAt(pos, idx[tri * 3 + 2])
            )
            if (hit < best) best = hit
          }
        }
    if (best <= t) return best
  }
  return best
}

/** Signed volume of an indexed triangle soup: positive when the winding is
 *  CCW-outward. Needs no closed surface to be informative at this magnitude. */
function meshSignedVolume(pos, idx) {
  let v = 0
  for (let t = 0; t < idx.length / 3; t++) {
    const a = vertexAt(pos, idx[t * 3])
    v += dot(a, cross(vertexAt(pos, idx[t * 3 + 1]), vertexAt(pos, idx[t * 3 + 2])))
  }
  return v / 6
}

/** Unit face normals, one per triangle. */
function faceNormals(pos, idx) {
  const T = idx.length / 3
  const out = new Float64Array(T * 3)
  for (let t = 0; t < T; t++) {
    const a = vertexAt(pos, idx[t * 3])
    const f = cross(sub(vertexAt(pos, idx[t * 3 + 1]), a), sub(vertexAt(pos, idx[t * 3 + 2]), a))
    const L = Math.hypot(...f) || 1
    for (let k = 0; k < 3; k++) out[t * 3 + k] = f[k] / L
  }
  return out
}

// ---------------------------------------------------------------------------
// UVs
// ---------------------------------------------------------------------------

/**
 * A UV that lands on real fabric or real skin: of the K non-garment triangles
 * nearest the probe and facing the right way, take the one whose atlas colour is
 * closest to their median. One outlier texel cannot decide the lining's colour,
 * and the choice is reproducible.
 */
function sampleRegionUV(probe, { cen, nrm, colour, T }, triLabel, uv, idx, K = 25) {
  const L = Math.hypot(...probe.dir)
  const cand = []
  for (let t = 0; t < T; t++) {
    if (triLabel[t] === 1) continue
    if ((nrm[t * 3] * probe.dir[0] + nrm[t * 3 + 1] * probe.dir[1] + nrm[t * 3 + 2] * probe.dir[2]) / L < 0.35) continue
    const d =
      (cen[t * 3] - probe.p[0]) ** 2 + (cen[t * 3 + 1] - probe.p[1]) ** 2 + (cen[t * 3 + 2] - probe.p[2]) ** 2
    cand.push([d, t])
  }
  cand.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const near = cand.slice(0, K).map(([, t]) => t)
  if (!near.length) throw new Error('line-girl: UV probe found no forward-facing body triangle')
  const median = [0, 1, 2].map((k) => {
    const v = near.map((t) => colour[t * 3 + k]).sort((a, b) => a - b)
    return v[v.length >> 1]
  })
  let best = near[0]
  let bd = Infinity
  for (const t of near) {
    const d = [0, 1, 2].reduce((s, k) => s + Math.abs(colour[t * 3 + k] - median[k]), 0)
    if (d < bd) {
      bd = d
      best = t
    }
  }
  const centroidUV = [0, 1].map(
    (k) => (uv[idx[best * 3] * 2 + k] + uv[idx[best * 3 + 1] * 2 + k] + uv[idx[best * 3 + 2] * 2 + k]) / 3
  )
  return { uv: centroidUV, colour: [0, 1, 2].map((k) => colour[best * 3 + k]), triangle: best, distance: Math.sqrt(cand[0][0]) }
}

/** Per-triangle centroid, geometric normal and atlas colour AT THE CENTROID —
 *  never at a vertex, which sits on an island edge where the texel is padding
 *  bled from a neighbouring chart (T118 trap 2). */
function triangleFeatures(pos, uv, idx, atlas) {
  const T = idx.length / 3
  const { data, width: W, height: H, channels: C } = atlas
  const cen = new Float64Array(T * 3)
  const nrm = new Float64Array(T * 3)
  const colour = new Float64Array(T * 3)
  for (let t = 0; t < T; t++) {
    const a = vertexAt(pos, idx[t * 3])
    const b = vertexAt(pos, idx[t * 3 + 1])
    const c = vertexAt(pos, idx[t * 3 + 2])
    for (let k = 0; k < 3; k++) cen[t * 3 + k] = (a[k] + b[k] + c[k]) / 3
    const f = cross(sub(b, a), sub(c, a))
    const L = Math.hypot(...f) || 1
    for (let k = 0; k < 3; k++) nrm[t * 3 + k] = f[k] / L
    const cu = (uv[idx[t * 3] * 2] + uv[idx[t * 3 + 1] * 2] + uv[idx[t * 3 + 2] * 2]) / 3
    const cv = (uv[idx[t * 3] * 2 + 1] + uv[idx[t * 3 + 1] * 2 + 1] + uv[idx[t * 3 + 2] * 2 + 1]) / 3
    const x = Math.min(W - 1, Math.max(0, Math.round(cu * W - 0.5)))
    const y = Math.min(H - 1, Math.max(0, Math.round(cv * H - 0.5)))
    const o = (y * W + x) * C
    for (let k = 0; k < 3; k++) colour[t * 3 + k] = data[o + k]
  }
  return { T, cen, nrm, colour }
}

// ---------------------------------------------------------------------------
// the rig, only as far as "is this vertex on an arm"
// ---------------------------------------------------------------------------

/**
 * Sleeve or torso, answered by the rig rather than by geometry: a vertex is
 * under a sleeve when the arm chain owns most of its skin weight.
 *
 * Distance to the arm bone was tried first and is wrong — the shoulder joint
 * sits inside the chest, so the whole upper chest is nearer an arm bone than the
 * spine and half the torso came back classified as sleeve. Weights are the
 * answer to "which body part is this" that the asset already contains.
 */
function regionClassifier(doc, joints, weights) {
  const skin = doc.getRoot().listSkins()[0]
  const names = skin.listJoints().map((j) => j.getName())
  const ARM = new Set(['LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand'])
  const isArm = names.map((n) => ARM.has(n))
  if (!isArm.some(Boolean)) throw new Error('line-girl: rig has no arm joints to classify sleeves by')
  const scale = weights instanceof Float32Array || weights instanceof Float64Array ? 1 : 255
  return (vertex) => {
    let arm = 0
    let total = 0
    for (let k = 0; k < 4; k++) {
      const w = weights[vertex * 4 + k] / scale
      total += w
      if (isArm[joints[vertex * 4 + k]]) arm += w
    }
    return total > 0 && arm / total > 0.5 ? 'skin' : 'tank'
  }
}

// ---------------------------------------------------------------------------
// the stage
// ---------------------------------------------------------------------------

/**
 * @returns {{ doc, report }} the document with the lining appended.
 */
export async function lineGirl(doc, { offset = OFFSET, tau = TAU, maskPath = null, probe = false } = {}) {
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]
  const posAttr = prim.getAttribute('POSITION')
  const pos = posAttr.getArray()
  const nrmAttr = prim.getAttribute('NORMAL')
  const uvAttr = prim.getAttribute('TEXCOORD_0')
  const jointsAttr = prim.getAttribute('JOINTS_0')
  const weightsAttr = prim.getAttribute('WEIGHTS_0')
  const idxAccessor = prim.getIndices()
  const idx = idxAccessor.getArray()
  const nVerts = posAttr.getCount()
  const uv = uvAttr.getArray()

  const cached = maskPath && existsSync(maskPath) && existsSync(maskPath.replace(/\.bin$/, '.tri.bin'))
  const triLabel = cached
    ? new Uint8Array(readFileSync(maskPath.replace(/\.bin$/, '.tri.bin')))
    : (await shirtMask(doc)).triLabel
  if (maskPath && !cached) writeFileSync(maskPath.replace(/\.bin$/, '.tri.bin'), Buffer.from(triLabel))
  if (triLabel.length !== idx.length / 3) throw new Error('line-girl: mask does not match this mesh')

  const { rep, count: nWelded } = weldPositions(pos, nVerts)
  const welded = new Float64Array(nWelded * 3)
  for (let i = 0; i < nVerts; i++) for (let k = 0; k < 3; k++) welded[rep[i] * 3 + k] = pos[i * 3 + k]

  const { inPatch, onRim } = patchOf(idx, triLabel, rep, nWelded)
  const { dir, raw, coherence, folds } = offsetDirections(
    pos,
    idx,
    triLabel,
    rep,
    nWelded,
    inPatch,
    NORMAL_SMOOTHING
  )
  const adj = patchAdjacency(idx, triLabel, rep, nWelded)
  const rimDist = distanceFromRim(welded, adj, inPatch, onRim, nWelded)

  // Orientation, in two steps, because a spine-radial probe is the wrong
  // instrument: on the underside of a sleeve "away from the spine" and "out of
  // the body" are different directions, and that probe called 36% of the patch
  // inverted on a mesh that is wound correctly.
  //
  // (a) Is the source wound CCW-outward at all? Signed volume answers globally
  //     and cannot be fooled by local shape. T115 measured +130 L on this shell.
  // (b) Did smoothing fold the field? Compared against the RAW per-position
  //     surface normal, not against the shipped NORMAL attribute: Meshy splits
  //     that attribute at 60% of the garment's positions to shade fine
  //     wrinkles, so it disagrees with any smoothed field by construction and
  //     says nothing about geometry. Fold positions are excluded — they have no
  //     raw direction to agree with, which is why they were filled in.
  const signedVolume = meshSignedVolume(pos, idx)
  if (signedVolume <= 0)
    throw new Error(`line-girl: source signed volume ${signedVolume.toFixed(4)} — the winding is inward, not outward`)
  let agree = 0
  let tested = 0
  let worstDot = 1
  for (let w = 0; w < nWelded; w++) {
    if (!inPatch[w] || coherence[w] < COHERENCE_FLOOR) continue
    const d = dot([dir[w * 3], dir[w * 3 + 1], dir[w * 3 + 2]], [raw[w * 3], raw[w * 3 + 1], raw[w * 3 + 2]])
    tested++
    if (d > 0) agree++
    worstDot = Math.min(worstDot, d)
  }
  const outwardFraction = tested ? agree / tested : 0
  if (outwardFraction < 0.995)
    throw new Error(
      `line-girl: smoothing folded the offset field on ${((1 - outwardFraction) * 100).toFixed(2)}% of the patch`
    )

  // Through-thickness cap, so the lining cannot cross the far wall of a thin limb.
  const grid = makeTriangleGrid(pos, idx, 0.03)
  const fnorm = faceNormals(pos, idx)
  const rawThickness = new Float64Array(nWelded).fill(Infinity)
  for (let w = 0; w < nWelded; w++) {
    if (!inPatch[w]) continue
    rawThickness[w] = firstHit(
      grid,
      pos,
      idx,
      fnorm,
      [welded[w * 3], welded[w * 3 + 1], welded[w * 3 + 2]],
      [-dir[w * 3], -dir[w * 3 + 1], -dir[w * 3 + 2]],
      0.4
    )
  }
  const thickness = medianFilter(rawThickness, adj, inPatch, nWelded, THICKNESS_MEDIAN)
  const smoothed = smoothPatchPositions(welded, adj, inPatch, onRim, nWelded, POSITION_SMOOTHING)

  const delta = new Float64Array(nWelded)
  let capped = 0
  for (let w = 0; w < nWelded; w++) {
    if (!inPatch[w]) continue
    const wanted = offset * (1 - Math.exp(-rimDist[w] / tau))
    const hit = thickness[w]
    const cap = Number.isFinite(hit) ? hit * THICKNESS_FRACTION : offset
    delta[w] = Math.min(wanted, cap)
    if (cap < wanted) capped++
    // Clamp the smoothing displacement against the offset this vertex actually
    // got, so the guarantee survives wherever the cap bit.
    const limit = SMOOTH_CLAMP * delta[w]
    const s = [0, 1, 2].map((k) => smoothed[w * 3 + k] - welded[w * 3 + k])
    const L = Math.hypot(...s)
    const scale = L > limit && L > 0 ? limit / L : 1
    for (let k = 0; k < 3; k++) smoothed[w * 3 + k] = welded[w * 3 + k] + s[k] * scale

    // THE CLEARANCE FLOOR — the guarantee this stage rests on, enforced instead
    // of assumed.
    //
    // Everything above works on SMOOTHED quantities: the offset runs along a
    // Laplacian-smoothed direction field, and the position is a Laplacian
    // smoothing of the patch. Neither is anchored to the local surface. Where the
    // patch folds hard, the smoothed direction can end up pointing outward
    // (measured: dir·raw down to −0.83), and the smoothing displacement is
    // clamped in magnitude but not in direction, so at a concave crease it pulls
    // the lining back out through the shirt. Together they put 44 vertices — 193
    // triangles, all across the back — OUTSIDE the garment before a single frame
    // is posed, which is where the leak's shoulder-blade slivers come from.
    //
    // The invariant that makes the lining safe under skinning is d·n > 0 at bind,
    // where n is the vertex's OWN unsmoothed normal: linear blend skinning maps
    // the offset by M and the normal by M⁻ᵀ, and (Md)·(M⁻ᵀn) = d·n, so a vertex
    // that starts inside stays inside. So project the result back onto that
    // constraint with a margin, rather than hoping the smoothers respected it.
    const r = [raw[w * 3], raw[w * 3 + 1], raw[w * 3 + 2]]
    const ref = Math.hypot(...r) ? r : [dir[w * 3], dir[w * 3 + 1], dir[w * 3 + 2]]
    const need = CLEARANCE_FRACTION * delta[w]
    const have = [0, 1, 2].reduce(
      (acc, k) => acc + (welded[w * 3 + k] - (smoothed[w * 3 + k] - dir[w * 3 + k] * delta[w])) * ref[k],
      0
    )
    if (have < need) for (let k = 0; k < 3; k++) smoothed[w * 3 + k] -= ref[k] * (need - have)
  }

  // ---- build the lining ----------------------------------------------------
  const atlasImage = doc.getRoot().listTextures()[0].getImage()
  const sharp = loadSharp()
  const { data, info } = await sharp(Buffer.from(atlasImage)).raw().toBuffer({ resolveWithObject: true })
  const features = triangleFeatures(pos, uv, idx, {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  })
  const regionUV = Object.fromEntries(
    Object.entries(UV_PROBES).map(([name, probe]) => [name, sampleRegionUV(probe, features, triLabel, uv, idx)])
  )
  const classify = regionClassifier(doc, jointsAttr.getArray(), weightsAttr.getArray())

  // One lining vertex per welded position the garment touches. A source
  // index-space vertex is needed for the skin data; every copy of a position
  // carries the same one (asserted), because the atlas splits are UV-only.
  const sourceOf = new Int32Array(nWelded).fill(-1)
  for (let i = 0; i < nVerts; i++) if (inPatch[rep[i]] && sourceOf[rep[i]] < 0) sourceOf[rep[i]] = i
  const lin = new Int32Array(nWelded).fill(-1)
  const order = []
  for (let w = 0; w < nWelded; w++)
    if (inPatch[w]) {
      lin[w] = nVerts + order.length
      order.push(w)
    }

  const nNew = order.length
  const joints = jointsAttr.getArray()
  const weights = weightsAttr.getArray()
  const newPos = new pos.constructor(nNew * 3)
  const newNrm = new (nrmAttr.getArray().constructor)(nNew * 3)
  const newUV = new uv.constructor(nNew * 2)
  const newJoints = new joints.constructor(nNew * 4)
  const newWeights = new weights.constructor(nNew * 4)
  const regionCount = { tank: 0, skin: 0 }
  for (let n = 0; n < nNew; n++) {
    const w = order[n]
    const src = sourceOf[w]
    for (let k = 0; k < 3; k++) {
      newPos[n * 3 + k] = smoothed[w * 3 + k] - dir[w * 3 + k] * delta[w]
      newNrm[n * 3 + k] = dir[w * 3 + k]
    }
    const region = classify(src)
    regionCount[region]++
    newUV[n * 2] = regionUV[region].uv[0]
    newUV[n * 2 + 1] = regionUV[region].uv[1]
    for (let k = 0; k < 4; k++) {
      newJoints[n * 4 + k] = joints[src * 4 + k]
      newWeights[n * 4 + k] = weights[src * 4 + k]
    }
  }

  // Skin data really is per POSITION on this export — assert rather than assume.
  let skinSplits = 0
  for (let i = 0; i < nVerts; i++) {
    const w = rep[i]
    if (!inPatch[w] || sourceOf[w] === i) continue
    const s = sourceOf[w]
    for (let k = 0; k < 4; k++)
      if (joints[i * 4 + k] !== joints[s * 4 + k] || weights[i * 4 + k] !== weights[s * 4 + k]) skinSplits++
  }
  if (skinSplits) throw new Error(`line-girl: ${skinSplits} atlas splits disagree on skin data — cannot weld the lining`)

  const T = idx.length / 3
  let nLiningTris = 0
  for (let t = 0; t < T; t++) if (triLabel[t] === 1) nLiningTris++
  const newIdx = new idx.constructor(nLiningTris * 3)
  let o = 0
  for (let t = 0; t < T; t++) {
    if (triLabel[t] !== 1) continue
    // Winding kept: an inward offset preserves orientation, so the lining faces
    // out of the figure, which is what a body surface does. See decision 1.
    for (let k = 0; k < 3; k++) newIdx[o++] = lin[rep[idx[t * 3 + k]]]
  }

  const append = (attr, extra, stride) => {
    const old = attr.getArray()
    const merged = new old.constructor(old.length + extra.length)
    merged.set(old)
    merged.set(extra, old.length)
    attr.setArray(merged)
    return merged.length / stride
  }
  append(posAttr, newPos, 3)
  append(nrmAttr, newNrm, 3)
  append(uvAttr, newUV, 2)
  append(jointsAttr, newJoints, 4)
  append(weightsAttr, newWeights, 4)
  {
    const old = idxAccessor.getArray()
    const merged = new old.constructor(old.length + newIdx.length)
    merged.set(old)
    merged.set(newIdx, old.length)
    idxAccessor.setArray(merged)
  }

  // CLEARANCE — the quantity the whole stage exists to make positive.
  //
  // A lining vertex must sit on the INSIDE of its own source vertex's tangent
  // plane, measured against that vertex's own unsmoothed surface normal. Neither
  // of the two things that move it guarantees that on its own: the offset is
  // along a SMOOTHED direction field, which can disagree with the local normal by
  // more than 90° where the patch folds, and the rim-pinned Laplacian's
  // displacement is clamped in MAGNITUDE but not in DIRECTION, so at a concave
  // crease it pulls the lining back out. The product of the two is what ships,
  // so the product is what gets measured.
  const clearance = new Float64Array(nWelded)
  const noRaw = []
  let negative = 0
  for (const w of order) {
    const r = [raw[w * 3], raw[w * 3 + 1], raw[w * 3 + 2]]
    if (!Math.hypot(...r)) {
      clearance[w] = NaN
      noRaw.push(w)
      continue
    }
    // (source − lining) · outward normal: positive means the lining is inside.
    const c = [0, 1, 2].reduce(
      (s, k) => s + (welded[w * 3 + k] - (smoothed[w * 3 + k] - dir[w * 3 + k] * delta[w])) * r[k],
      0
    )
    clearance[w] = c
    if (c <= 0) negative++
  }
  // The rim is coincident by construction, so a clearance of exactly zero there
  // is the design, not a defect. Everything else with a non-positive clearance is
  // a lining vertex sitting on the wrong side of the shirt.
  const outside = order.filter((w) => !onRim[w] && Number.isFinite(clearance[w]) && clearance[w] < -1e-9)
  const outsideTris = (() => {
    const bad = new Set(outside)
    let n = 0
    for (let t = 0; t < idx.length / 3; t++) {
      if (triLabel[t] !== 1) continue
      if ([0, 1, 2].some((k) => bad.has(rep[idx[t * 3 + k]]))) n++
    }
    return n
  })()
  const outsideBox = outside.length
    ? [0, 1, 2].map((k) => [
        Math.min(...outside.map((w) => welded[w * 3 + k])),
        Math.max(...outside.map((w) => welded[w * 3 + k])),
      ])
    : null
  if (outside.length)
    throw new Error(
      `line-girl: ${outside.length} lining vertices (${outsideTris} triangles) finished OUTSIDE the garment, ` +
        `worst ${(Math.min(...outside.map((w) => clearance[w])) * 1000).toFixed(2)} mm — the clearance floor did not hold`
    )
  const clearVals = order.map((w) => clearance[w]).filter(Number.isFinite).sort((a, b) => a - b)
  const interiorVals = order
    .filter((w) => !onRim[w] && Number.isFinite(clearance[w]))
    .map((w) => clearance[w])
    .sort((a, b) => a - b)

  const smoothShift = order.map((w) => Math.hypot(smoothed[w * 3] - welded[w * 3], smoothed[w * 3 + 1] - welded[w * 3 + 1], smoothed[w * 3 + 2] - welded[w * 3 + 2])).sort((a, b) => a - b)
  const finite = order.map((w) => thickness[w]).filter(Number.isFinite).sort((a, b) => a - b)
  const deltas = order.map((w) => delta[w]).sort((a, b) => a - b)
  const q = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : null)
  const report = {
    knobs: { offset, tau, thicknessFraction: THICKNESS_FRACTION, normalSmoothing: NORMAL_SMOOTHING, positionSmoothing: POSITION_SMOOTHING, smoothClamp: SMOOTH_CLAMP, thicknessMedian: THICKNESS_MEDIAN, clearanceFraction: CLEARANCE_FRACTION },
    garmentTriangles: nLiningTris,
    triangleTotal: T,
    liningVertices: nNew,
    vertexTotal: nVerts,
    rimVertices: order.filter((w) => onRim[w]).length,
    signedVolume,
    outwardFraction,
    worstFieldDot: worstDot,
    foldPositions: folds.length,
    thickness: { min: finite[0] ?? null, p01: q(finite, 0.01), median: q(finite, 0.5), unreachable: nNew - finite.length },
    delta: { max: deltas[deltas.length - 1], median: q(deltas, 0.5), p10: q(deltas, 0.1), cappedByThickness: capped },
    smoothShiftMm: { median: q(smoothShift, 0.5) * 1000, p99: q(smoothShift, 0.99) * 1000, max: smoothShift[smoothShift.length - 1] * 1000 },
    clearanceMm: {
      min: clearVals.length ? clearVals[0] * 1000 : null,
      p01: q(clearVals, 0.01) * 1000,
      p10: q(clearVals, 0.1) * 1000,
      median: q(clearVals, 0.5) * 1000,
      nonPositive: negative,
      under1mm: clearVals.filter((c) => c < 0.001).length,
      noRawNormal: noRaw.length,
      interior: {
        min: interiorVals.length ? interiorVals[0] * 1000 : null,
        p01: q(interiorVals, 0.01) * 1000,
        p10: q(interiorVals, 0.1) * 1000,
        median: q(interiorVals, 0.5) * 1000,
        outsidePositions: outside.length,
        outsideTriangles: outsideTris,
        outsideBox,
      },
    },
    region: regionCount,
    regionUV,
    after: { vertices: nVerts + nNew, triangles: T + nLiningTris },
    probe: probe
      ? order.map((w) => ({ p: [welded[w * 3], welded[w * 3 + 1], welded[w * 3 + 2]], delta: delta[w], thickness: thickness[w], rimDist: rimDist[w] }))
      : undefined,
  }
  return { doc, report }
}

const RAW_SRC = path.join(WORKTREE, 'public/labs/small-world/girl-v2.glb')
const REBOUND_SRC = path.join(WORKTREE, 'public/labs/small-world/girl-v2-rebound.glb')
const DEFAULT_OUT = path.join(WORKTREE, 'public/labs/small-world/girl-v2-lined.glb')

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { NodeIO } = await import('@gltf-transform/core')
  const arg = (name, def) => {
    const i = process.argv.indexOf(`--${name}`)
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def
  }
  const src = arg('src', existsSync(REBOUND_SRC) ? REBOUND_SRC : RAW_SRC)
  const out = arg('out', DEFAULT_OUT)
  const io = new NodeIO()
  const doc = await io.read(src)
  const { report } = await lineGirl(doc, {
    offset: Number(arg('offset', OFFSET)),
    tau: Number(arg('tau', TAU)),
    maskPath: arg('mask', path.join(WORKTREE, 'scratchpad/t120/out/mask.bin')),
  })
  console.log(JSON.stringify(report, null, 1))
  const reportPath = arg('report', null)
  if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 1))
  if (process.argv.includes('--dry')) {
    console.log('dry run — nothing written')
  } else {
    await io.write(out, doc)
    console.log(`wrote ${out}`)
  }
}
