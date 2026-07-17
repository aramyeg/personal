import * as THREE from 'three'
import { FLIP_START, FLIP_WIDTH, STANCE_ALPHA, renewalGate } from './renewal'

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
  positionsA?: Float32Array
  positionsB?: Float32Array
  normalsA?: Float32Array
  normalsB?: Float32Array
}

/** A per-target updater that tracks the last applied rotation and, each call,
 *  re-lerps only the buckets swept since then. */
export function makeRenewalMorph(t: MorphTarget): { update: (rotation: number) => void } {
  const colArr = t.geo.attributes.color.array as Float32Array
  const posArr = t.positionsA ? (t.geo.attributes.position.array as Float32Array) : null
  const norArr = t.normalsA ? (t.geo.attributes.normal.array as Float32Array) : null
  const { starts, verts } = t.buckets
  const thetaC = t.thetaC
  let last = Number.NaN

  const writeVertex = (i: number, gate: number): void => {
    const j = i * 3
    colArr[j] = t.colorsA[j] + (t.colorsB[j] - t.colorsA[j]) * gate
    colArr[j + 1] = t.colorsA[j + 1] + (t.colorsB[j + 1] - t.colorsA[j + 1]) * gate
    colArr[j + 2] = t.colorsA[j + 2] + (t.colorsB[j + 2] - t.colorsA[j + 2]) * gate
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
    for (let k = starts[b]; k < starts[b + 1]; k++) {
      const i = verts[k]
      writeVertex(i, renewalGate(thetaC[i], rotation))
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
