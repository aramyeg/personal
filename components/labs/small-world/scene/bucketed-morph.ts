import * as THREE from 'three'
import {
  EPILOGUE_START,
  FLIP_START,
  FLIP_WIDTH,
  STANCE_ALPHA,
  epilogueGate,
  renewalGate,
} from './renewal'

/**
 * The traveling-front renderer. Replaces the old whole-buffer applyWorldBlend: a
 * vertex only changes its A→B blend while `rotation − thetaC` sweeps the flip
 * window [FLIP_START, FLIP_START+FLIP_WIDTH], so per frame we touch ONLY the
 * vertices whose gate could have changed between the previous and current
 * rotation — bucketed by thetaC. The rest of the 34k-vertex buffer is untouched.
 */

const BUCKET_COUNT = 96
const TWO_PI = Math.PI * 2
/** The canonical thetaC period starts at the girl's stance meridian (the wrap
 *  seam), so buckets partition [SEAM, SEAM + 2π). */
const SEAM = STANCE_ALPHA

/** CSR buckets: vertices of bucket b are `verts[starts[b] .. starts[b+1])`. */
export type Buckets = { starts: Int32Array; verts: Int32Array }

function bucketOf(thetaC: number): number {
  return Math.floor(((thetaC - SEAM) / TWO_PI) * BUCKET_COUNT)
}

/** Bucket a per-vertex canonical-thetaC array into CSR form (no per-frame alloc). */
export function buildBuckets(thetaC: Float32Array): Buckets {
  const n = thetaC.length
  const counts = new Int32Array(BUCKET_COUNT)
  for (let i = 0; i < n; i++) {
    let b = bucketOf(thetaC[i])
    if (b < 0) b = 0
    else if (b >= BUCKET_COUNT) b = BUCKET_COUNT - 1
    counts[b]++
  }
  const starts = new Int32Array(BUCKET_COUNT + 1)
  for (let b = 0; b < BUCKET_COUNT; b++) starts[b + 1] = starts[b] + counts[b]
  const verts = new Int32Array(n)
  const cursor = starts.slice(0, BUCKET_COUNT)
  for (let i = 0; i < n; i++) {
    let b = bucketOf(thetaC[i])
    if (b < 0) b = 0
    else if (b >= BUCKET_COUNT) b = BUCKET_COUNT - 1
    verts[cursor[b]++] = i
  }
  return { starts, verts }
}

/** What a morph target lerps. `positions`/`normals` are optional (the water
 *  sphere morphs colour only — its geography is variant-independent). */
export type MorphTarget = {
  geo: THREE.BufferGeometry
  thetaC: Float32Array
  buckets: Buckets
  colorsA: Float32Array
  colorsB: Float32Array
  /** Task 60 — the epilogue colours (colour only; the epilogue moves no vertex). Equal to
   *  `colorsB` outside the snow field, so supplying it is a no-op there. Omit it entirely and
   *  the target behaves exactly as it did before the epilogue existed. */
  colorsC?: Float32Array
  positionsA?: Float32Array
  positionsB?: Float32Array
  normalsA?: Float32Array
  normalsB?: Float32Array
}

/** A per-target updater that tracks the last applied rotation and, each call,
 *  re-lerps only the buckets swept since then. */
export function makeRenewalMorph(t: MorphTarget): { update: (rotation: number) => void } {
  const colArr = t.geo.attributes.color.array as Float32Array
  const cC = t.colorsC ?? null
  const posArr = t.positionsA ? (t.geo.attributes.position.array as Float32Array) : null
  const norArr = t.normalsA ? (t.geo.attributes.normal.array as Float32Array) : null
  const { starts, verts } = t.buckets
  const thetaC = t.thetaC
  let last = Number.NaN

  const writeVertex = (i: number, gate: number, epi: number): void => {
    const j = i * 3
    let r = t.colorsA[j] + (t.colorsB[j] - t.colorsA[j]) * gate
    let g = t.colorsA[j + 1] + (t.colorsB[j + 1] - t.colorsA[j + 1]) * gate
    let b = t.colorsA[j + 2] + (t.colorsB[j + 2] - t.colorsA[j + 2]) * gate
    // Task 60 — the epilogue lerp, layered on top of the A→B blend. The two windows are 2π
    // apart, so `epi > 0` implies `gate === 1` and the base below is exactly colorsB: the
    // states hand over cleanly and a vertex is never blending two of them at once.
    if (cC !== null && epi > 0) {
      r += (cC[j] - r) * epi
      g += (cC[j + 1] - g) * epi
      b += (cC[j + 2] - b) * epi
    }
    colArr[j] = r
    colArr[j + 1] = g
    colArr[j + 2] = b
    if (posArr && t.positionsA && t.positionsB) {
      posArr[j] = t.positionsA[j] + (t.positionsB[j] - t.positionsA[j]) * gate
      posArr[j + 1] = t.positionsA[j + 1] + (t.positionsB[j + 1] - t.positionsA[j + 1]) * gate
      posArr[j + 2] = t.positionsA[j + 2] + (t.positionsB[j + 2] - t.positionsA[j + 2]) * gate
    }
    if (norArr && t.normalsA && t.normalsB) {
      const nx = t.normalsA[j] + (t.normalsB[j] - t.normalsA[j]) * gate
      const ny = t.normalsA[j + 1] + (t.normalsB[j + 1] - t.normalsA[j + 1]) * gate
      const nz = t.normalsA[j + 2] + (t.normalsB[j + 2] - t.normalsA[j + 2]) * gate
      const l = Math.hypot(nx, ny, nz) || 1
      norArr[j] = nx / l
      norArr[j + 1] = ny / l
      norArr[j + 2] = nz / l
    }
  }

  const applyBucket = (b: number, rotation: number): void => {
    // No vertex can be in the epilogue before this rotation (the earliest possible longitude is
    // the seam), so for the whole of chapters 1-4 the second gate costs one scalar compare per
    // BUCKET instead of a smoothstep per vertex.
    const epiPossible = cC !== null && rotation >= SEAM + EPILOGUE_START
    for (let k = starts[b]; k < starts[b + 1]; k++) {
      const i = verts[k]
      const tc = thetaC[i]
      writeVertex(i, renewalGate(tc, rotation), epiPossible ? epilogueGate(tc, rotation) : 0)
    }
  }

  const flag = (): void => {
    t.geo.attributes.color.needsUpdate = true
    if (posArr) t.geo.attributes.position.needsUpdate = true
    if (norArr) t.geo.attributes.normal.needsUpdate = true
  }

  const full = (rotation: number): void => {
    for (let b = 0; b < BUCKET_COUNT; b++) applyBucket(b, rotation)
    flag()
    last = rotation
  }

  const update = (rotation: number): void => {
    if (Number.isNaN(last)) return full(rotation)
    const d = Math.abs(rotation - last)
    if (d === 0) return
    // A jump wider than the whole circle can no longer be localized — reapply all.
    if (d + FLIP_WIDTH >= TWO_PI) return full(rotation)
    // Vertices flip when rotation − thetaC ∈ [FLIP_START, FLIP_START+FLIP_WIDTH],
    // so the thetaC swept between last and now is [minRot−FS−FW, maxRot−FS]. Reduce
    // to buckets over the thetaC period (bucketOf handles the offset; the ±1 pad
    // and wrap-modulo cover rounding and the seam).
    //
    // Task 60 — this sweep ALREADY covers the epilogue window, and it is worth saying why
    // rather than leaving it to be rediscovered: the epilogue window sits at FLIP_START + 2π,
    // so its swept thetaC range is this one shifted by exactly −2π. Buckets partition a 2π
    // period and `bucketOf` is linear with BUCKET_COUNT samples per turn, so that shift moves
    // every index by exactly −BUCKET_COUNT — which the wrap-modulo below undoes. The two
    // windows therefore dirty the SAME buckets, and a second sweep would be redundant work.
    const lo = Math.min(rotation, last) - FLIP_START - FLIP_WIDTH
    const hi = Math.max(rotation, last) - FLIP_START
    const b0 = bucketOf(lo)
    const b1 = bucketOf(hi)
    for (let bb = b0 - 1; bb <= b1 + 1; bb++) {
      const b = ((bb % BUCKET_COUNT) + BUCKET_COUNT) % BUCKET_COUNT
      applyBucket(b, rotation)
    }
    flag()
    last = rotation
  }

  return { update }
}
