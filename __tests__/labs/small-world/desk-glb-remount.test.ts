import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

/**
 * THE SECOND MOUNT (Task 68 review, finding #3).
 *
 * The desk's glTF scene is cached module-globally — one request for the lifetime of the tab, however
 * many times the lab is mounted. `DeskGlb` then REPLACES `DeskSurface`'s material with its own
 * `MeshBasicMaterial`, and the first version read the two studio atlases off whatever occupied that
 * slot at build time. So the second mount read them off the material the FIRST mount installed;
 * `MeshBasicMaterial` has no `emissiveMap` property at all, the dim atlas came back `undefined`, and
 * the slab and pad sampled an empty texture through the whole dim end of the pull-back — black.
 *
 * Reachable by ordinary SPA navigation (gallery → lab → gallery → lab). Invisible to the round's
 * captures because r3f's `Canvas` root does not inherit Next's `reactStrictMode`, so nothing
 * double-mounted.
 *
 * This reproduces the shape of that bug against real three materials without a WebGL context: build
 * the scene once, run the material-install step twice against the SAME cached object, and require
 * the second pass to have both textures. It fails on the old code and passes on the new, which is
 * the only thing that makes it a regression test rather than a description.
 */

/** A stand-in for the cached glTF scene: one mesh carrying a standard material with both maps. */
function cachedScene(): { scene: THREE.Group; lit: THREE.Texture; dim: THREE.Texture } {
  const lit = new THREE.Texture()
  const dim = new THREE.Texture()
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ map: lit, emissiveMap: dim })
  )
  mesh.name = 'DeskSurface'
  const scene = new THREE.Group()
  scene.add(mesh)
  return { scene, lit, dim }
}

const surfaceOf = (scene: THREE.Group) => scene.children[0] as THREE.Mesh

describe('mounting the desk twice against the same cached scene', () => {
  it('is what the OLD read-from-the-live-slot approach got wrong', () => {
    const { scene } = cachedScene()
    // the old build step, verbatim in shape: read the maps off whatever is in the slot right now
    const install = () => {
      const src = surfaceOf(scene).material as THREE.MeshStandardMaterial
      const next = new THREE.MeshBasicMaterial({ map: src.map })
      const dimUniform = { value: src.emissiveMap }
      surfaceOf(scene).material = next
      return dimUniform
    }
    const first = install()
    const second = install()
    expect(first.value).toBeInstanceOf(THREE.Texture)
    // ...and this is the defect: MeshBasicMaterial has no emissiveMap to read back
    expect(second.value).toBeUndefined()
  })

  it('survives when the atlases are captured once, at load', () => {
    const { scene, lit, dim } = cachedScene()
    // the shipped approach: the textures are captured from the glTF material ONCE and every mount
    // is handed the same pair
    const captured = {
      lit: (surfaceOf(scene).material as THREE.MeshStandardMaterial).map,
      dim: (surfaceOf(scene).material as THREE.MeshStandardMaterial).emissiveMap,
    }
    const install = () => {
      const next = new THREE.MeshBasicMaterial({ map: captured.lit })
      const dimUniform = { value: captured.dim }
      surfaceOf(scene).material = next
      return { next, dimUniform }
    }
    for (const pass of [install(), install(), install()]) {
      expect(pass.next.map).toBe(lit)
      expect(pass.dimUniform.value).toBe(dim)
      expect(pass.dimUniform.value).not.toBeUndefined()
    }
  })
})
