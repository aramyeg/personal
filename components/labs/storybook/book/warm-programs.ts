'use client'

/**
 * PROGRAM-LINK DRAIN — the fix for the multi-second page-turn stall.
 *
 * ROOT CAUSE (measured, production build on :3164, 4x CPU throttle, CDP
 * sampling profiler over each turn):
 *
 *     cover-open 0->1 : long frames 469 / 1743 / 1043 ms — 2256ms of it in
 *                       `getProgramInfoLog`
 *     title 1->2 (ch1): long frames 154 / 266 / 1601 ms — 1949ms in
 *                       `getProgramInfoLog`
 *     ch1 2->3, 3->4  : no getProgramInfoLog at all (programs already used)
 *
 * `three`'s `WebGLProgram` does NOT check its link result when the program is
 * built. It defers the whole check into `onFirstUse()`, which fires from
 * `getUniforms()` / `getAttributes()` — i.e. on the first frame that actually
 * DRAWS with that program (WebGLProgram.js:860, called at :964 / :981). That
 * check issues `gl.getProgramInfoLog()`, a synchronous round trip to the GPU
 * process that cannot answer until the driver has finished linking. So the
 * renderer's `gl.compile(scene, camera)` warm pass (book.tsx) buys nothing on
 * its own: it queues the links, and the BLOCK still lands on the first frame
 * the piece is drawn — which for a pop-up spread is the first frame of the
 * turn that reveals it. That is the "page turn lags".
 *
 * The cure is to make the first use happen at a time WE choose. Touching
 * `getUniforms()`/`getAttributes()` on a cached program runs `onFirstUse` and
 * absorbs the link wait right there; by the time the reader turns the page,
 * every program answers from `cachedUniforms` and draws in a normal frame.
 * The pass is idempotent (three memoizes both), a few programs per idle slice
 * so the drain itself never becomes one long frame, and it NEVER runs while a
 * turn is in flight — a drain landing mid-turn would be the very stall it
 * exists to prevent.
 *
 * Related, same wave: `book-scene.tsx` turns `gl.debug.checkShaderErrors` off
 * in production (three then skips three info-log round trips per program), and
 * `book.tsx` keeps the open-book subtree — crucially the pop-up group and its
 * lights — mounted from load, because a light-count change re-links EVERY
 * program in the scene (the E4 wild-lane law).
 *
 * A WARNING THIS MODULE LEARNED THE HARD WAY. Draining is worthless unless the
 * warm pass builds the SAME programs the renderer will ask for. The second E5
 * measurement round found `gl.compile()` running with `shadowMap.enabled` true
 * and every real draw running with it false — so all ~66 warmed programs were
 * cache-key orphans and 77 fresh ones were compiled during the turns anyway
 * (see the fix and its evidence in book-scene.tsx's `shadows` prop). If this
 * stall ever comes back, check FIRST that the two states agree; every field of
 * `WebGLPrograms.getParameters` (light counts, shadow enable/type, clipping
 * plane count, tone mapping, render target) is part of that key, and any of
 * them differing between warm and draw silently doubles the compile work
 * instead of removing it.
 */

import type * as THREE from 'three'

/** Programs whose link has already been absorbed. Weak so a program three
 *  releases (its material's cache key changed) can still be collected. */
const drainedPrograms = new WeakSet<object>()

/**
 * Wall-clock budget for one idle slice, in ms.
 *
 * This was a COUNT (8 programs) and that was wrong. Measured on the live E5
 * build at 4x throttle, absorbing one program's link costs ~120ms — the wait is
 * a synchronous round trip to the GPU process, so it barely scales with shader
 * size. Eight of them per slice is a ~1s frame: the drain would have become the
 * stall it exists to prevent. A time budget self-tunes to the device instead,
 * and the `spent === 0` floor guarantees forward progress even when a single
 * program overruns the whole budget on its own.
 */
const SLICE_MS = 12

/** How long to wait before re-testing a turn that was in flight. Short enough
 *  that a drain lands in the dwell after a single turn, long enough that a
 *  reader chaining turns is never interrupted. */
const BUSY_RETRY_MS = 200

/** Idle-slice timeout: the drain must still happen on a busy main thread (the
 *  first pass runs during load, where idle time is scarce). Mirrors
 *  wild/warmup.ts's scheduling. */
const IDLE_TIMEOUT_MS = 700

type Cancel = () => void

function warmSlice(fn: () => void): Cancel {
  if (typeof window === 'undefined') return () => {}
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => fn(), { timeout: IDLE_TIMEOUT_MS })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(fn, 40)
  return () => window.clearTimeout(id)
}

function laterSlice(fn: () => void, ms: number): Cancel {
  if (typeof window === 'undefined') return () => {}
  const id = window.setTimeout(fn, ms)
  return () => window.clearTimeout(id)
}

/**
 * Run `fn` in an idle slice, once no turn is in flight. Used for the scene's
 * `gl.compile` warm passes as well as the drain: `compile` walks the whole
 * graph and re-derives every material's program parameters (~340-410ms of
 * `WebGLPrograms.getParameters` per turn at 4x throttle, profiled), and it
 * used to run synchronously inside the commit effect — landing a cluster of
 * ~150ms frames exactly on the page's landing thump.
 */
export function runWhenRested(fn: () => void, isBusy: () => boolean): Cancel {
  let cancelled = false
  let cancelSlice: Cancel = () => {}
  const step = (): void => {
    if (cancelled) return
    if (isBusy()) {
      cancelSlice = laterSlice(step, BUSY_RETRY_MS)
      return
    }
    fn()
  }
  cancelSlice = warmSlice(step)
  return () => {
    cancelled = true
    cancelSlice()
  }
}

/**
 * Absorb the deferred link check of not-yet-drained programs for up to
 * `budgetMs` of wall clock (at least one, always). Returns how many still
 * remain, so a caller can slice the work.
 */
export function drainProgramLinks(gl: THREE.WebGLRenderer, budgetMs = Number.POSITIVE_INFINITY): number {
  const programs = gl.info.programs
  if (!programs) return 0
  const started = performance.now()
  let spent = 0
  let remaining = 0
  for (const program of programs) {
    if (drainedPrograms.has(program)) continue
    // Always absorb at least one, or a device slower than the budget would
    // never make progress at all.
    if (spent > 0 && performance.now() - started >= budgetMs) {
      remaining++
      continue
    }
    drainedPrograms.add(program)
    spent++
    try {
      // Either call runs three's onFirstUse; both are asked for so a future
      // three that splits the two caches still gets fully warmed here.
      program.getUniforms()
      program.getAttributes()
    } catch {
      // A program that cannot report its uniforms is one three will complain
      // about on its own at draw time — a failed warm is only a lost head start.
    }
  }
  return remaining
}

/**
 * Drain every cached program, a slice at a time, deferring while `isBusy()`
 * reports a turn in flight. Returns a cancel function for effect cleanup.
 */
export function drainProgramLinksWhenIdle(
  gl: THREE.WebGLRenderer,
  isBusy: () => boolean
): Cancel {
  let cancelled = false
  let cancelSlice: Cancel = () => {}

  const step = (): void => {
    if (cancelled) return
    if (isBusy()) {
      cancelSlice = laterSlice(step, BUSY_RETRY_MS)
      return
    }
    const remaining = drainProgramLinks(gl, SLICE_MS)
    if (remaining > 0) cancelSlice = warmSlice(step)
  }

  cancelSlice = warmSlice(step)
  return () => {
    cancelled = true
    cancelSlice()
  }
}
