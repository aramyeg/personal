/**
 * Task 47 (worker bake, Phase 2b) — the land bake, run OFF the main thread.
 *
 * Receives the transferred base icosphere positions + the by-value land-dial snapshot, runs the
 * SAME pure `bakeLandArrays` the synchronous path runs, and transfers the baked arrays back. The
 * module graph here is worker-safe: THREE's math/geometry + the biome/renewal/field leaf modules.
 * It does import `./tunables` transitively (for the standalone fallback default), but the bake
 * path NEVER reads it — every dial arrives explicitly in `dials`, so this worker is deterministic
 * by value and byte-identical to the main-thread bake for the same snapshot.
 */
import * as THREE from 'three'
import { bakeLandArrays, type LandBake } from './land-bake'
import type { LandDials } from './tunables'

type BakeRequest = {
  id: number
  src: Float32Array
  count: number
  EDGE: number
  dials: LandDials
}

/** Every buffer of a LandBake, transferred back to the main thread with zero copy. The arrays are
 *  all backed by (non-shared) ArrayBuffers, so each `.buffer` is a valid Transferable. */
function transferables(b: LandBake): Transferable[] {
  return [
    b.positionsA.buffer, b.positionsB.buffer,
    b.colorsA.buffer, b.colorsB.buffer,
    b.normalsA.buffer, b.normalsB.buffer,
    b.floodedPositions.buffer, b.floodedColors.buffer, b.floodedNormals.buffer,
    b.thetaC.buffer,
    b.capIdx.buffer, b.capNx.buffer, b.capNy.buffer, b.capNz.buffer,
  ] as Transferable[]
}

// Minimal worker-scope shape — avoids a `webworker` lib dependency (the project's tsconfig ships
// the DOM lib), while typing the two members this file uses.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<BakeRequest>) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
}

scope.onmessage = (e) => {
  const { id, src, count, EDGE, dials } = e.data
  const attr = new THREE.BufferAttribute(src, 3)
  const bake = bakeLandArrays(attr, count, EDGE, dials)
  scope.postMessage({ id, bake }, transferables(bake))
}
