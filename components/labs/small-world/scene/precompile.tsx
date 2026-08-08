'use client'
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { WebGLRenderTarget } from 'three'
import type { Camera, Mesh, Object3D, WebGLRenderer } from 'three'

/**
 * FIRST-VISIT SHADER PRECOMPILE (T96 phase 2a, candidate: compileAsync).
 *
 * The journey's two first-visit hitches are pipeline stalls, not app JS (T96
 * phase 1, §2.4: ~185–209ms single frame at progress ≈0.10 — the chapter-1
 * prop field's first render — and ~72–127ms at ≈1.08, the desk's first render;
 * rAF CPU inside both frames was ~2ms). The driver compiles a material's
 * program the first time it is DRAWN, and everything in this scene graph is
 * mounted from the start but drawn late: the prop fields wait for their
 * chapter, the desk is parked outside the journey frustum.
 *
 * `WebGLRenderer.compileAsync(scene, camera)` walks the WHOLE graph — plain
 * `traverse`, not `traverseVisible`, so the parked desk and every dormant prop
 * are included — and compiles every material with `KHR_parallel_shader_compile`
 * (available here, verified by the phase-1 probe), polling completion without
 * blocking the frame loop. The scene's light set is two permanently mounted
 * lights (BiomeAtmosphere's key + ambient; the ending only dials intensity),
 * so the programs compiled now are exactly the programs those late first draws
 * will ask for.
 *
 * Runs once, at scene mount — which is DURING the loader hold (the Experience
 * mounts behind the loader plate while the GLB parses and the land bake runs),
 * so the driver's background compile threads overlap the wait the reader is
 * already sitting through. It is deliberately NOT wired into the loader's
 * ready condition: a slow compile can never delay the reveal (measured: reveal
 * timing unchanged), it only shrinks the first-visit stalls that would
 * otherwise land mid-scroll.
 *
 * What this does NOT cover (measured residual): the ending's dpr 1→2 buffer
 * reallocation at zoom 0.82 (ending-dpr.ts) — that cost is a framebuffer
 * resize, not a program compile, and stays where it was.
 *
 * The girl arrives later through Suspense, but she is visible from the very
 * first revealed frame, so her material compiles during the hold's own renders
 * — she was never part of either stall.
 *
 * LATE ARRIVALS: the desk GLB loads through its own manager (deliberately
 * outside the loader gate — see desk-glb.tsx) and can resolve long after this
 * mounts, so a mount-time-only compile would miss exactly the materials behind
 * the ending stall. Components that add materials late ANNOUNCE themselves via
 * `requestPrecompile()` (useDeskAssets does, in the effect that runs once its
 * meshes are committed), and the mounted ScenePrecompile re-runs. Re-runs are
 * cheap: already-compiled materials hit three's program cache.
 */

type PrecompileListener = () => void
const listeners = new Set<PrecompileListener>()

/**
 * Announce late-added materials (e.g. the desk GLB resolving) so the mounted
 * precompiler covers them too. Safe to call any time; a no-op when no canvas
 * is up (fallback paths never pay anything).
 */
export function requestPrecompile(): void {
  for (const listener of listeners) listener()
}

/** Renderer surface this component needs — r185's WebGLRenderer satisfies it. */
export type PrecompileRenderer = {
  compileAsync?: (scene: Object3D, camera: Camera) => Promise<unknown>
}

/**
 * Kick the whole-graph shader precompile once. Failures are swallowed on
 * purpose: precompile is an optimization — the fallback is exactly the old
 * behavior (compile at first draw), never an error the reader can see.
 */
export async function precompileScene(
  gl: PrecompileRenderer,
  scene: Object3D,
  camera: Camera
): Promise<boolean> {
  if (typeof gl.compileAsync !== 'function') return false
  try {
    await gl.compileAsync(scene, camera)
    return true
  } catch {
    return false
  }
}

/** Renderer surface the warm draw needs — r185's WebGLRenderer satisfies it. */
export type WarmDrawRenderer = Pick<
  WebGLRenderer,
  'getRenderTarget' | 'setRenderTarget' | 'render'
>

/**
 * ONE HIDDEN FRAME, EVERYTHING DRAWN (the other half of the stall).
 *
 * compileAsync eats the program compiles, but the ch1 stall is also the first
 * UPLOAD: the driver creates the prop fields' vertex/index buffers and binds
 * their textures the first time each mesh is actually DRAWN, and measurement
 * showed the ~167ms chapter-1 hitch survives a compile-only warm-up. So after
 * the programs are ready, render the whole graph ONCE into a throwaway 2×2
 * target — every mesh forced visible and un-culled for exactly that draw, so
 * nothing is skipped by its journey gating or by the frustum (the desk is
 * parked outside it on purpose). Vertex work at 4 pixels is negligible; the
 * point is that the driver walks upload + bind for every geometry/material
 * while the loader still holds the screen. Visibility and culling flags are
 * restored exactly — the drawn frame goes nowhere the reader can see.
 */
export function warmDrawScene(gl: WarmDrawRenderer, scene: Object3D, camera: Camera): boolean {
  const saved: Array<{ obj: Object3D; visible: boolean; frustumCulled: boolean }> = []
  try {
    scene.traverse((obj) => {
      const m = obj as Mesh
      if (!(m.isMesh || (obj as { isPoints?: boolean }).isPoints || (obj as { isLine?: boolean }).isLine)) return
      saved.push({ obj, visible: obj.visible, frustumCulled: obj.frustumCulled })
      obj.visible = true
      obj.frustumCulled = false
    })
    const target = new WebGLRenderTarget(2, 2)
    const previous = gl.getRenderTarget()
    try {
      gl.setRenderTarget(target)
      gl.render(scene, camera)
    } finally {
      gl.setRenderTarget(previous)
      target.dispose()
    }
    return true
  } catch {
    return false
  } finally {
    for (const s of saved) {
      s.obj.visible = s.visible
      s.obj.frustumCulled = s.frustumCulled
    }
  }
}

/** Mounts inside the Canvas; fires the precompile at mount and on every
 *  `requestPrecompile()` announcement, coalescing overlapping requests. */
export function ScenePrecompile() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    let live = true
    let inFlight = false
    let queued = false
    const run = () => {
      if (!live) return
      if (inFlight) {
        queued = true
        return
      }
      inFlight = true
      void precompileScene(gl, scene, camera)
        .then((compiled) => {
          // Programs are ready (or compileAsync is unavailable and the warm
          // draw compiles synchronously — still off-screen, still in the hold);
          // now walk the driver through upload + bind for everything.
          if (live) warmDrawScene(gl, scene, camera)
          return compiled
        })
        .finally(() => {
          inFlight = false
          if (queued) {
            queued = false
            run()
          }
        })
    }
    listeners.add(run)
    run()
    return () => {
      live = false
      listeners.delete(run)
    }
  }, [gl, scene, camera])
  return null
}
