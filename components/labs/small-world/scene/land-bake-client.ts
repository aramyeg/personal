'use client'
/**
 * Task 47 (worker bake, Phase 2b) — the main-thread client that runs the land bake OFF the
 * main thread. The synchronous land bake was the load freeze (T39: 545 ms @1× / 3.1 s @4×,
 * repeated on every ?tune rebake). This dispatches it to a module Web Worker with transferable
 * arrays, and coalesces stale results at the call site (the hook).
 *
 * Determinism is BY-VALUE: the caller snapshots the twelve land dials (`readLandDials()`) and
 * passes the plain object in; the worker's own tunables instance is never read by the bake.
 *
 * Fallback: if the Worker cannot be constructed (SSR — this only runs client-side in an effect,
 * but also very old engines / a strict CSP) OR it faults at runtime, requests bake SYNCHRONOUSLY
 * on the main thread (the pre-Task-47 behaviour), so the scene always renders.
 */
import * as THREE from 'three'
import {
  bakeLandArrays,
  equirectPlanetUV,
  PLANET_RADIUS,
  ICO_DETAIL,
  ICO_EDGE,
  type LandBake,
  type LandBakeUV,
} from './land-bake'
import type { LandDials } from './tunables'

/** The base (pre-displacement) icosphere positions, built on the main thread and transferred to
 *  the worker. Deterministic subdivision, so the worker bakes over byte-identical source. */
function baseIcospherePositions(): Float32Array {
  const geo = new THREE.IcosahedronGeometry(PLANET_RADIUS, ICO_DETAIL)
  const src = geo.attributes.position.array as Float32Array
  geo.dispose()
  return src
}

/**
 * The lighting-atlas UV, built once for the module's lifetime.
 *
 * It is a pure function of PLANET_RADIUS and ICO_DETAIL — no dial reaches it — so a rebake can
 * never change it. Memoising it here is what keeps it off both hot paths: the worker never has to
 * derive or transfer it, and a `?tune` rebake pays for it exactly zero times after the first.
 */
let uvMemo: Float32Array | null = null
function atlasUV(): Float32Array {
  if (!uvMemo) {
    const src = baseIcospherePositions()
    uvMemo = equirectPlanetUV(src, src.length / 3)
  }
  return uvMemo
}

/** The synchronous main-thread bake (the freeze) — used only when no worker is available. */
export function bakeLandSync(dials: LandDials): LandBakeUV {
  const geo = new THREE.IcosahedronGeometry(PLANET_RADIUS, ICO_DETAIL)
  const src = geo.attributes.position as THREE.BufferAttribute
  const bake = bakeLandArrays(src, src.count, ICO_EDGE, dials)
  geo.dispose()
  return { ...bake, uv: atlasUV() }
}

export type LandBakeClient = {
  /** Request a bake tagged `id` with the by-value dial snapshot. Resolves with the LandBake
   *  (from the worker, or synchronously if the worker is unavailable). */
  request: (id: number, dials: LandDials) => Promise<LandBakeUV>
  /** Terminate the worker and drop pending requests (component unmount). */
  dispose: () => void
}

type Pending = { resolve: (b: LandBakeUV) => void; dials: LandDials }

export function createLandBakeClient(): LandBakeClient {
  let worker: Worker | null = null
  try {
    worker = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    worker = null
  }

  const pending = new Map<number, Pending>()

  if (worker) {
    worker.onmessage = (e: MessageEvent<{ id: number; bake: LandBake }>) => {
      const { id, bake } = e.data
      const entry = pending.get(id)
      if (entry) {
        pending.delete(id)
        entry.resolve({ ...bake, uv: atlasUV() })
      }
    }
    // A runtime worker fault must never hang the loader: finish every in-flight request on the
    // main thread (with its own snapshot, so tuned dials are preserved), then disable the worker
    // so subsequent requests bake synchronously.
    worker.onerror = () => {
      const entries = [...pending.values()]
      pending.clear()
      worker?.terminate()
      worker = null
      for (const { resolve, dials } of entries) resolve(bakeLandSync(dials))
    }
  }

  return {
    request(id, dials) {
      if (worker) {
        const src = baseIcospherePositions()
        const count = src.length / 3
        return new Promise<LandBakeUV>((resolve) => {
          pending.set(id, { resolve, dials })
          worker!.postMessage({ id, src, count, EDGE: ICO_EDGE, dials }, [src.buffer as ArrayBuffer])
        })
      }
      return Promise.resolve(bakeLandSync(dials))
    },
    dispose() {
      pending.clear()
      worker?.terminate()
      worker = null
    },
  }
}
