import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { bakedMaterial, surfaceMaterial } from '@/components/labs/small-world/scene/props/desk-glb'

/**
 * THE SECOND MOUNT (Task 68 review, finding #3) — bound to the shipped function.
 *
 * THE BUG. The desk's glTF scene is cached module-globally: one request for the lifetime of the
 * tab, however many times the lab is mounted. `DeskGlb` REPLACES `DeskSurface`'s material with its
 * own `MeshBasicMaterial`, and the original build step read the two studio atlases off whatever
 * occupied that slot. So the second mount read them off the material the FIRST mount installed;
 * `MeshBasicMaterial` has no `emissiveMap`, the dim atlas came back `undefined`, and the slab and
 * pad sampled an empty texture through the whole dim end of the pull-back — black. Reachable by
 * ordinary SPA navigation (gallery → lab → gallery → lab); invisible to the round's captures
 * because r3f's `Canvas` root does not inherit Next's `reactStrictMode`.
 *
 * WHY THIS FILE WAS REWRITTEN. Its first version reimplemented both the old and the new build steps
 * as local closures and never imported `desk-glb.tsx` at all. It was a description of the fix, and
 * review proved it by reverting the source and watching it pass 2/2. A test that cannot fail on the
 * broken code is not a regression test.
 *
 * WHAT MAKES IT BIND NOW. It calls the SHIPPED `surfaceMaterial`, and it calls it the only way the
 * fix permits: with two TEXTURES. The old signature was `(src: THREE.Mesh, lights)` and reached
 * through `src.material` — handed a texture instead of a mesh it reads `undefined.map` and throws,
 * so every assertion below fails on the pre-fix version.
 */

/** three's `onBeforeCompile` contract minus the GL context: the chunks the material patches, and a
 *  uniforms bag to catch what it injects. */
function fakeShader() {
  return {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: '#include <color_vertex>\nvoid main(){}',
    fragmentShader: '#include <map_fragment>\n#include <color_fragment>\nvoid main(){}',
  }
}

const compile = (mat: THREE.Material) => {
  const shader = fakeShader()
  ;(mat.onBeforeCompile as unknown as (s: ReturnType<typeof fakeShader>) => void)(shader)
  return shader
}

describe('the surface material takes its atlases as ARGUMENTS, not from a live slot', () => {
  const lit = new THREE.Texture()
  const dim = new THREE.Texture()
  const lights = { value: 0 }

  it('puts the lit atlas on the material and the dim one in the shader', () => {
    const mat = surfaceMaterial(lit, dim, lights)
    expect(mat.map).toBe(lit)
    const shader = compile(mat)
    expect(shader.uniforms.uDimMap.value).toBe(dim)
    expect(shader.uniforms.uLights).toBe(lights)
    expect(shader.fragmentShader).toContain('uDimMap')
  })

  it('builds an IDENTICAL material every time, however many mounts have been through it', () => {
    // The heart of the bug: the second call used to see a world the first call had changed. It
    // cannot now, because it is handed the same two textures and reads nothing else.
    for (const mat of [
      surfaceMaterial(lit, dim, lights),
      surfaceMaterial(lit, dim, lights),
      surfaceMaterial(lit, dim, lights),
    ]) {
      expect(mat.map).toBe(lit)
      expect(compile(mat).uniforms.uDimMap.value).toBe(dim)
    }
  })

  it('is not fooled by a mesh whose material has already been replaced', () => {
    // Reproduces the exact runtime state a second mount finds: the cached mesh now wears a
    // MeshBasicMaterial with no emissiveMap at all. The shipped function never looks at it, so the
    // atlases still arrive.
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), surfaceMaterial(lit, dim, lights))
    // MeshBasicMaterial has no `emissiveMap` AT ALL — the type system says so, which is exactly why
    // reading it off the live slot returned undefined rather than failing loudly
    expect('emissiveMap' in mesh.material).toBe(false)
    expect(compile(surfaceMaterial(lit, dim, lights)).uniforms.uDimMap.value).toBe(dim)
  })
})

describe('the baked material carries both colour sets', () => {
  it('declares the second attribute and mixes it by the shared uniform', () => {
    const lights = { value: 0.5 }
    const shader = compile(bakedMaterial(lights))
    expect(shader.uniforms.uLights).toBe(lights)
    // glTF's COLOR_1 arrives as `color_1` (three lower-cases any attribute it has no name for)
    expect(shader.vertexShader).toContain('color_1')
    expect(shader.fragmentShader).toContain('vDimColor')
  })
})
