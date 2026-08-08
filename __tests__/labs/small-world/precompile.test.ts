import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { Camera, Object3D } from 'three'
import {
  precompileScene,
  requestPrecompile,
  warmDrawScene,
  type WarmDrawRenderer,
} from '@/components/labs/small-world/scene/precompile'

const scene = { isObject3D: true } as unknown as Object3D
const camera = { isCamera: true } as unknown as Camera

describe('precompileScene', () => {
  it('compiles the whole graph once through compileAsync', async () => {
    const compileAsync = vi.fn().mockResolvedValue(undefined)
    await expect(precompileScene({ compileAsync }, scene, camera)).resolves.toBe(true)
    expect(compileAsync).toHaveBeenCalledTimes(1)
    expect(compileAsync).toHaveBeenCalledWith(scene, camera)
  })

  it('is a silent no-op when the renderer lacks compileAsync', async () => {
    await expect(precompileScene({}, scene, camera)).resolves.toBe(false)
  })

  it('swallows a rejected compile — precompile may never surface an error', async () => {
    const compileAsync = vi.fn().mockRejectedValue(new Error('context lost'))
    await expect(precompileScene({ compileAsync }, scene, camera)).resolves.toBe(false)
  })

  it('requestPrecompile is a safe no-op with no mounted precompiler (fallback paths)', () => {
    expect(() => requestPrecompile()).not.toThrow()
  })
})

describe('warmDrawScene', () => {
  const build = () => {
    const graph = new THREE.Scene()
    const hidden = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())
    hidden.visible = false
    const parked = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())
    parked.frustumCulled = true
    const shown = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())
    graph.add(hidden, parked, shown)
    return { graph, hidden, parked, shown }
  }
  const cam = new THREE.PerspectiveCamera()

  it('draws once with every mesh visible and un-culled, into an off-screen target', () => {
    const { graph, hidden, parked } = build()
    let visibleDuringDraw: boolean | null = null
    let culledDuringDraw: boolean | null = null
    let drewOffscreen = false
    let current: unknown = null
    const gl: WarmDrawRenderer = {
      getRenderTarget: () => current,
      setRenderTarget: (t: unknown) => {
        current = t
      },
      render: () => {
        visibleDuringDraw = hidden.visible
        culledDuringDraw = parked.frustumCulled
        drewOffscreen = current !== null
      },
    } as unknown as WarmDrawRenderer
    expect(warmDrawScene(gl, graph, cam)).toBe(true)
    expect(visibleDuringDraw).toBe(true)
    expect(culledDuringDraw).toBe(false)
    expect(drewOffscreen).toBe(true)
    // The reader-facing target is restored after the warm frame.
    expect(current).toBe(null)
  })

  it('restores every visibility and culling flag exactly, even when the draw throws', () => {
    const { graph, hidden, parked, shown } = build()
    const gl = {
      getRenderTarget: () => null,
      setRenderTarget: () => {},
      render: () => {
        throw new Error('context lost')
      },
    } as unknown as WarmDrawRenderer
    expect(warmDrawScene(gl, graph, cam)).toBe(false)
    expect(hidden.visible).toBe(false)
    expect(parked.frustumCulled).toBe(true)
    expect(shown.visible).toBe(true)
  })
})
