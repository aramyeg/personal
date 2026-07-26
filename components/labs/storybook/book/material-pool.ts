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
 *
 * `useGuardedDispose` below is a second, unrelated lifecycle fix that lives
 * in this file because it is the book's one dedicated "GPU-object lifetime"
 * module — see its own doc comment for what it fixes and why.
 */

import { useEffect } from 'react'
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

// ---------------------------------------------------------------------------
// useGuardedDispose — StrictMode-safe replacement for
// `useEffect(() => () => target.dispose(), [target])`.
// ---------------------------------------------------------------------------

/**
 * ROOT CAUSE of the E3 blind sweep's continuous
 * `GL_INVALID_VALUE: glGetProgramiv: Program object expected` spam (verified
 * with a harness probe, not guessed — see the `useGuardedDispose` describe
 * block in material-pool.test.ts for the reproduction):
 *
 * book.tsx (and every popup layer) builds its materials/geometries/textures
 * in `useMemo` and disposes them in a plain
 * `useEffect(() => () => target.dispose(), [target])`. In dev, React's
 * StrictMode intentionally rehearses every component's mount once: it runs
 * the effect's cleanup and then its setup again, SYNCHRONOUSLY, right after
 * the real mount, specifically to flush out non-idempotent effects. `target`
 * itself does NOT get rebuilt by that rehearsal — `useMemo`'s factory isn't
 * re-invoked on the replayed setup, only the effect is — so the rehearsal's
 * cleanup calls `.dispose()` on the EXACT SAME object the mesh keeps using
 * afterward, for the rest of the component's real lifetime.
 *
 * Disposing a material doesn't just free ITS OWN GPU state: `dispose()`
 * fires three's `onMaterialDispose`, which calls `releaseProgram` on every
 * WebGLProgram that material's cache entry pointed at. Programs are shared
 * by shader-relevant config (side/transparent/map-presence/etc, not by
 * object identity or `color`), so many visually-different but
 * shader-identical materials across the book — every popup layer's cutout
 * material, for instance — commonly share ONE compiled program. If the
 * rehearsal-disposed material happened to be the program's only reference
 * holder so far, `releaseProgram` drops its use-count to zero and calls
 * `gl.deleteProgram` on a program every OTHER still-live, still-rendering
 * material is about to keep using. Every later frame that touches one of
 * those survivors calls into three's `setProgram` path against a genuinely
 * deleted GL program — `glGetProgramiv: Program object expected`, forever,
 * on whichever spread happens to hold a survivor (never recovering, because
 * nothing ever rebuilds the deleted program without a real remount).
 *
 * The fix: track disposal with a WeakMap claim-count and always DEFER the
 * actual `.dispose()` by one microtask. StrictMode's rehearsal is entirely
 * synchronous (no yield between its cleanup and its replayed setup), so the
 * replayed setup always re-claims the SAME target before the deferred
 * dispose ever runs, cancelling it. A REAL unmount never re-claims, so the
 * deferred dispose goes through — one microtask later than before, which is
 * imperceptible and changes nothing observable outside dev/StrictMode.
 */
const disposalClaims = new WeakMap<object, number>()

type Disposable = { dispose(): void }

function claim(target: Disposable): void {
  disposalClaims.set(target, (disposalClaims.get(target) ?? 0) + 1)
}

function unclaim(target: Disposable): void {
  const remaining = (disposalClaims.get(target) ?? 1) - 1
  if (remaining > 0) {
    disposalClaims.set(target, remaining)
    return
  }
  disposalClaims.delete(target)
  queueMicrotask(() => {
    // A claim landed between the decrement above and this microtask (the
    // StrictMode replay, or a fresh real re-mount racing the same tick) —
    // someone else now owns disposing this target.
    if (!disposalClaims.has(target)) target.dispose()
  })
}

/**
 * Disposes `target` exactly once, on this component's REAL final unmount
 * (or whenever `target`'s identity changes) — immune to the StrictMode
 * mount rehearsal described above. Drop-in replacement for
 * `useEffect(() => () => target.dispose(), [target])`; accepts an array for
 * call sites that dispose several objects together (book.tsx's stack-edge
 * texture set), still exactly one `useEffect` call, so it's safe to use
 * with a fixed-length array whose length never changes across renders.
 */
export function useGuardedDispose(target: Disposable | readonly Disposable[] | null | undefined): void {
  useEffect(() => {
    const targets = target === null || target === undefined ? [] : Array.isArray(target) ? target : [target]
    targets.forEach(claim)
    return () => {
      targets.forEach(unclaim)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
}
