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

import * as THREE from 'three'

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

// ---------------------------------------------------------------------------
// WARM BY RENDERING (E5, round 3). `gl.compile()` is gone from the book's warm
// path, because it cannot get the cache key right for this scene.
//
// A material's program is keyed by `WebGLPrograms.getParameters` — and four of
// those fields are properties of the RENDER, not of the material:
//
//   outputColorSpace   (WebGLPrograms.js:212) SRGB when drawing to the canvas,
//                      working space when drawing into ANY render target
//   numClippingPlanes  (:354) set by clipping.setState() DURING a render, so
//                      compile() bakes whatever the previous frame left behind
//   shadowMapType      (:360) and shadowMapEnabled
//   toneMapping        (:362) forced to None inside a render target
//
// `compile()` sets none of them. It walks the graph and asks for programs with
// stale state, so every program it built was an orphan and the real draw
// compiled a second one — measured: 84 program births during four turns, 77 of
// them shaders never emitted at load.
//
// The outputColorSpace field also explains why arriving at chapter 1 was the
// worst turn in the book by a wide margin. The grade's EffectComposer mounts
// with that spread, and from then on the WHOLE scene draws into a render
// target instead of the canvas — so every material the reader can see flips
// its key at once and recompiles mid-turn.
//
// A real render sets all four correctly, because it is the thing that defines
// them. So the warm pass renders the scene FOR REAL, twice: once to the canvas
// (the SRGB variant every non-chapter-1 spread uses) and once into a tiny
// render target (the working-space variant the composer path uses). Hidden
// pieces are unhidden for the duration, which is what gets a spread's pop-ups —
// and, through the shadow pass, their customDepthMaterials — compiled before
// the turn that reveals them.
//
// It MUST be driven from inside the frame loop (book.tsx subscribes at a very
// negative priority): the canvas-variant pass genuinely paints the canvas, and
// only a later render in the SAME rAF — r3f's own, or the composer's at
// priority 1 — guarantees the reader never sees it.
// ---------------------------------------------------------------------------

/** The off-screen variant only has to EXIST; nothing samples it. 8px keeps the
 *  fragment cost of a whole extra scene pass at nothing. */
const WARM_TARGET_PX = 8

/** Hidden roots per slice. A warm pass is two full scene renders, and every one
 *  of those re-derives each material's cache key in JS (`getParameters` +
 *  `getProgramCacheKey`) — measured at 370-460ms per window change when the
 *  warm ran one root per frame for a hundred frames. Batching amortises the
 *  fixed per-render cost; the variable cost is the new programs in the batch.
 *
 *  There is a second, sharper reason to batch hard. The canvas-variant pass
 *  flips `outputColorSpace` away from whatever the live path is using, and
 *  three's `setProgram` then re-derives EVERY material's cache key on the next
 *  real render (`materialProperties.outputColorSpace !== colorSpace`). While
 *  the warm is running it therefore taxes each frame; the fix is to be running
 *  for as few frames as possible, not to nibble. */
const ROOTS_PER_SLICE = 40

/**
 * Roots already warmed, and whether the visible set has been warmed, FOR THE
 * SESSION — not per spread window.
 *
 * Without this the warm restarted on every window change, i.e. on every turn
 * commit, re-rendering the whole scene twice per frame for a hundred frames to
 * re-warm pieces that were already warm. That churn was the entire remaining
 * landing-cluster cost once the real compiles were gone. A piece's program does
 * not go cold, so warming it twice buys nothing.
 */
const warmedRoots = new WeakSet<THREE.Object3D>()
let visibleSetWarmed = false

/** Topmost hidden objects, minus any branch containing a light. Unhiding a
 *  light would change the scene's light count, which is itself part of every
 *  program's key — the warm would then compile a set of programs no real frame
 *  ever asks for, which is the exact failure this whole module exists to undo. */
function hiddenWarmRoots(scene: THREE.Object3D): THREE.Object3D[] {
  const lightBranch = new Set<THREE.Object3D>()
  scene.traverse((object) => {
    if ((object as THREE.Light).isLight !== true) return
    for (let node: THREE.Object3D | null = object; node; node = node.parent) lightBranch.add(node)
  })
  const roots: THREE.Object3D[] = []
  // Descend THROUGH hidden nodes, not just to them. A hidden spread group has
  // hidden cutout groups inside it, each flipped independently by its own
  // frame callback — unhiding only the outermost one leaves every piece still
  // invisible and therefore still uncompiled, which is the shape of bug this
  // pass exists to kill. `unhideChain` below re-shows a node's hidden
  // ancestors with it so a nested pick actually renders.
  const walk = (object: THREE.Object3D): void => {
    if (object.visible === false) {
      // `lightBranch` holds every light AND every ancestor of one, so it is
      // only ever a veto on UNHIDING — never on traversal. (Testing it before
      // the visible check aborted at the scene root, which is an ancestor of
      // every light: the load warm then collected nothing at all.)
      if (lightBranch.has(object)) return
      if (!warmedRoots.has(object)) roots.push(object)
    }
    for (const child of object.children) walk(child)
  }
  walk(scene)
  return roots
}

/** Every hidden node that must be shown for `roots` to actually draw: the roots
 *  themselves plus their hidden ancestors, de-duplicated. */
function unhideChain(roots: readonly THREE.Object3D[]): THREE.Object3D[] {
  const chain = new Set<THREE.Object3D>()
  for (const root of roots) {
    for (let node: THREE.Object3D | null = root; node; node = node.parent) {
      if (node.visible === false) chain.add(node)
    }
  }
  return [...chain]
}

export type SceneWarm = {
  /** Run one slice. Returns true while there is more to do. */
  step: (isBusy: () => boolean) => boolean
  dispose: () => void
}

/**
 * A sliced scene warm. Slice 0 covers everything already on screen (its
 * off-screen variant is the expensive one — that is the composer flip, paid
 * once, at load, behind the veil). Every later slice unhides ONE hidden root,
 * so its cost is bounded by that one piece's materials.
 */
export function createSceneWarm(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): SceneWarm {
  const target = new THREE.WebGLRenderTarget(WARM_TARGET_PX, WARM_TARGET_PX)
  let queue: THREE.Object3D[] | null = null
  let done = false

  const pass = (picks: readonly THREE.Object3D[]): void => {
    const roots = unhideChain(picks)
    for (const root of roots) root.visible = true
    const previous = gl.getRenderTarget()
    try {
      // Canvas variant (outputColorSpace = SRGB). Overwritten later this frame.
      gl.setRenderTarget(null)
      gl.render(scene, camera)
      // Render-target variant (working space) — the composer path's key.
      gl.setRenderTarget(target)
      gl.render(scene, camera)
    } catch {
      // A failed warm is only a lost head start; never take the frame loop down.
    } finally {
      gl.setRenderTarget(previous)
      for (const root of roots) root.visible = false
    }
  }

  return {
    step: (isBusy) => {
      if (done) return false
      // Never warm into a live turn: each new program costs a blocking
      // round trip, and that is precisely the frame we are protecting.
      if (isBusy()) return true
      if (queue === null) {
        // The visible set's off-screen variant — the composer flip, paid once.
        if (!visibleSetWarmed) {
          visibleSetWarmed = true
          pass([])
        }
        queue = hiddenWarmRoots(scene)
        return true
      }
      const batch: THREE.Object3D[] = []
      while (batch.length < ROOTS_PER_SLICE) {
        const root = queue.shift()
        if (root === undefined) break
        warmedRoots.add(root)
        // A root can be detached or re-shown between planning and its slice.
        if (root.parent !== null && root.visible === false) batch.push(root)
      }
      if (batch.length === 0) {
        done = true
        target.dispose()
        return false
      }
      pass(batch)
      return true
    },
    dispose: () => {
      done = true
      target.dispose()
    },
  }
}
