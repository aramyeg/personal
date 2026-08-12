/**
 * T121 — the girl is TWO meshes now.
 *
 * detach-girl.mjs cut the shirt into its own glTF primitive, which GLTFLoader
 * hands back as a second SkinnedMesh sharing the same atlas. gradeGirlTexture
 * walks every pixel of a 1024² image into a canvas, so a per-mesh grade would run
 * it twice per mount and upload two identical textures — invisible on screen and
 * therefore exactly the kind of regression that survives an eye-test.
 *
 * These pin the invariants, not the pixel maths (which clay-noise et al. leave
 * alone deliberately): both meshes end up toon, they end up sharing ONE graded
 * texture, and the source atlas is disposed once rather than once per mesh.
 */
import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { toonifyGirl } from '@/components/labs/small-world/scene/girl-clay'

/** A canvas 2D context stub good enough for gradeGirlTexture's pixel walk. */
function stubCanvas() {
  const ctx = {
    drawImage: vi.fn(),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(128),
      width: w,
      height: h,
    }),
    putImageData: vi.fn(),
  }
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') return document.createElementNS('http://www.w3.org/1999/xhtml', tag)
    return { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLElement
  }) as typeof document.createElement)
  return ctx
}

function girlScene() {
  // One atlas, shared — which is what the two primitives of one glTF mesh get.
  const atlas = new THREE.Texture({ width: 8, height: 8 } as unknown as HTMLImageElement)
  const scene = new THREE.Group()
  const meshes = ['body', 'garment'].map((name) => {
    const mat = new THREE.MeshStandardMaterial({ map: atlas })
    mat.name = name
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat)
    mesh.name = name
    scene.add(mesh)
    return mesh
  })
  return { scene, meshes, atlas }
}

describe('toonifyGirl across the detached garment', () => {
  it('converts every mesh and grades the shared atlas exactly once', () => {
    stubCanvas()
    const { scene, meshes, atlas } = girlScene()
    const disposed = vi.spyOn(atlas, 'dispose')
    const ramp = new THREE.Texture()

    toonifyGirl(scene, ramp, true)

    const mats = meshes.map((m) => m.material as unknown as THREE.MeshToonMaterial)
    expect(mats.every((m) => m.isMeshToonMaterial)).toBe(true)
    // One graded texture, shared — not one per mesh.
    expect(mats[0].map).toBe(mats[1].map)
    expect(mats[0].map).not.toBe(atlas)
    expect(disposed).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('is idempotent, so a remount does not re-grade', () => {
    stubCanvas()
    const { scene, meshes } = girlScene()
    const ramp = new THREE.Texture()
    toonifyGirl(scene, ramp, true)
    const first = meshes.map((m) => m.material)
    toonifyGirl(scene, ramp, true)
    expect(meshes.map((m) => m.material)).toEqual(first)
    vi.restoreAllMocks()
  })
})
