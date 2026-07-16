'use client'

/**
 * Shared-material pool for the popup layers (E-G4 fix wave, root cause #1):
 * every layer used to allocate its own `THREE.MeshBasicMaterial` even when
 * several pieces render an IDENTICAL configuration (same map, same color,
 * same side/transparent/alphaTest/depthWrite/opacity/vertexColors/visible)
 * — each of those redundant objects still pays its own first-render
 * `WebGLRenderer.setProgram` -> `getProgram`/`getParameters` cost (a fresh
 * `materialProperties` cache entry keyed by object identity, not content),
 * which profiling showed dominating CPU frames.
 *
 * `acquireMaterial` returns a REUSED material for a spec that already has
 * one live, or builds a fresh one otherwise, ref-counted so the last
 * releaser disposes it. This is only safe for materials that are never
 * mutated in place after acquisition — see the file-level warning below.
 *
 * NOT SAFE to pool: any material whose `.opacity`/`.color`/`.map` a caller
 * intends to WRITE after acquiring it (e.g. contact shadows, whose opacity
 * is rewritten every frame from that piece's own live lift — sharing the
 * object would make every piece using that pool entry flash to whichever
 * instance wrote last). Those must stay owned: `new THREE.MeshBasicMaterial(...)`
 * + manual `.dispose()`, unchanged. Safe candidates are materials resolved
 * once per texture-load/tint-change (an infrequent `useEffect`/`useMemo`,
 * not a per-frame `useFrame` write) — re-acquire a new pooled material (and
 * release the old one) on each such change instead of mutating in place.
 */

import * as THREE from 'three'

export type PooledMaterialSpec = {
  /** `null` for no map — included in the key so a mapped and unmapped
   *  material never collide (map presence changes the compiled shader). */
  map: THREE.Texture | null
  color: string
  side?: THREE.Side
  transparent?: boolean
  alphaTest?: number
  depthWrite?: boolean
  opacity?: number
  vertexColors?: boolean
  visible?: boolean
}

type FullSpec = Required<PooledMaterialSpec>

const DEFAULTS: Omit<FullSpec, 'map' | 'color'> = {
  side: THREE.FrontSide,
  transparent: false,
  alphaTest: 0,
  depthWrite: true,
  opacity: 1,
  vertexColors: false,
  visible: true,
}

function keyOf(spec: FullSpec): string {
  return [
    spec.map ? spec.map.uuid : 'none',
    spec.color,
    spec.side,
    spec.transparent,
    spec.alphaTest,
    spec.depthWrite,
    spec.opacity,
    spec.vertexColors,
    spec.visible,
  ].join('|')
}

type Entry = { material: THREE.MeshBasicMaterial; refCount: number; key: string }

const pool = new Map<string, Entry>()
// Reverse index so `releaseMaterial` is O(1) instead of scanning the pool —
// stamped onto the material itself rather than a side WeakMap so a stray
// material this pool didn't create (key never found) is a safe no-op.
const KEY = Symbol('materialPoolKey')

/**
 * Get-or-create a shared `MeshBasicMaterial` for `spec`, bumping its
 * ref-count. Two calls with an equal spec (same map identity + same
 * literal color/side/transparent/alphaTest/depthWrite/opacity/vertexColors/
 * visible) always return the SAME object. Pair every acquire with exactly
 * one `releaseMaterial` call (on unmount, and again whenever the caller is
 * about to acquire a replacement for a changed spec).
 */
export function acquireMaterial(spec: PooledMaterialSpec): THREE.MeshBasicMaterial {
  const full: FullSpec = { ...DEFAULTS, ...spec }
  const key = keyOf(full)
  let entry = pool.get(key)
  if (!entry) {
    const material = new THREE.MeshBasicMaterial({
      map: full.map,
      color: full.color,
      side: full.side,
      transparent: full.transparent,
      alphaTest: full.alphaTest,
      depthWrite: full.depthWrite,
      opacity: full.opacity,
      vertexColors: full.vertexColors,
      visible: full.visible,
    })
    ;(material as unknown as { [KEY]?: string })[KEY] = key
    entry = { material, refCount: 0, key }
    pool.set(key, entry)
  }
  entry.refCount += 1
  return entry.material
}

/** Releases a material acquired via `acquireMaterial`. Decrements its
 *  ref-count and disposes + evicts it once nothing else references it.
 *  Safe to call with `null`/`undefined`, or with a material this pool
 *  never issued (no-op — there is no matching key to release). */
export function releaseMaterial(material: THREE.MeshBasicMaterial | null | undefined): void {
  if (!material) return
  const key = (material as unknown as { [KEY]?: string })[KEY]
  if (key === undefined) return
  const entry = pool.get(key)
  if (!entry) return
  entry.refCount -= 1
  if (entry.refCount <= 0) {
    pool.delete(key)
    entry.material.dispose()
  }
}

/** Test-only: current pool size and per-key ref-counts, so pooling tests
 *  can assert dedup/disposal without reaching into module internals. */
export function _poolDebugSnapshot(): { size: number; refCounts: number[] } {
  return { size: pool.size, refCounts: Array.from(pool.values(), (e) => e.refCount) }
}
