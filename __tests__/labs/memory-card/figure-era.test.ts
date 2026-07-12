import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import {
  REDUCED_YAW,
  TURNTABLE_SECONDS,
  applyEraRenderer,
  spinAngle,
  toEraMaterial,
  turntableRunning,
} from '@/components/labs/memory-card/lib/figure-era'

const TAU = Math.PI * 2

describe('spinAngle', () => {
  it('starts the turntable facing front (angle 0 at t=0)', () => {
    expect(spinAngle(0)).toBe(0)
  })

  it('completes exactly one revolution over the configured period', () => {
    // A full period lands back at 0 (mod 2π), and half a period is a half-turn.
    expect(spinAngle(TURNTABLE_SECONDS)).toBeCloseTo(0)
    expect(spinAngle(TURNTABLE_SECONDS / 2)).toBeCloseTo(Math.PI)
  })

  it('advances at a constant rate and wraps into [0, 2π)', () => {
    // A quarter period is a quarter-turn; two full periods still read as one.
    expect(spinAngle(TURNTABLE_SECONDS / 4)).toBeCloseTo(Math.PI / 2)
    expect(spinAngle(TURNTABLE_SECONDS * 2)).toBeCloseTo(0)
    const a = spinAngle(TURNTABLE_SECONDS * 1.75)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(TAU)
  })

  it('keeps the period inside the 24–32s spec window', () => {
    expect(TURNTABLE_SECONDS).toBeGreaterThanOrEqual(24)
    expect(TURNTABLE_SECONDS).toBeLessThanOrEqual(32)
  })
})

describe('REDUCED_YAW', () => {
  it('is a static three-quarter pose — turned off dead-front but not full profile', () => {
    expect(REDUCED_YAW).toBeGreaterThan(0)
    expect(REDUCED_YAW).toBeLessThan(Math.PI / 2)
  })
})

describe('turntableRunning', () => {
  it('spins only when motion is allowed, nothing is covering it, and the tab is visible', () => {
    expect(turntableRunning({ reduced: false, paused: false, hidden: false })).toBe(true)
  })

  it('never spins under reduced motion', () => {
    expect(turntableRunning({ reduced: true, paused: false, hidden: false })).toBe(false)
  })

  it('pauses while an overlay (dialog/route) covers the hero', () => {
    expect(turntableRunning({ reduced: false, paused: true, hidden: false })).toBe(false)
  })

  it('pauses while the tab is hidden', () => {
    expect(turntableRunning({ reduced: false, paused: false, hidden: true })).toBe(false)
  })
})

describe('toEraMaterial', () => {
  it('rebuilds a PBR material as an unlit, tone-mapping-free basic material that keeps its map', () => {
    const map = new THREE.Texture()
    map.magFilter = THREE.LinearFilter
    map.minFilter = THREE.LinearMipmapLinearFilter
    map.generateMipmaps = true

    const src = new THREE.MeshStandardMaterial({ map, metalness: 1, roughness: 0.2 })
    src.color.setRGB(0.4, 0.6, 0.8)

    const era = toEraMaterial(src)

    expect(era).toBeInstanceOf(THREE.MeshBasicMaterial)
    // The albedo map survives (same GPU texture — never re-uploaded/cloned)...
    expect(era.map).toBe(map)
    // ...but is switched to point sampling with no mip chain (era renderer law).
    expect(map.magFilter).toBe(THREE.NearestFilter)
    expect(map.minFilter).toBe(THREE.NearestFilter)
    expect(map.generateMipmaps).toBe(false)
    // Baked lighting lives in the texture, so scene tone-mapping must not regrade it.
    expect(era.toneMapped).toBe(false)
    // Base colour carries across (unlit tint), PBR channels are simply gone.
    expect(era.color.getHex()).toBe(src.color.getHex())
  })

  it('preserves alpha-cutout and double-sided flags for silhouette geometry', () => {
    const src = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.5,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    })
    const era = toEraMaterial(src)
    expect(era.transparent).toBe(true)
    expect(era.opacity).toBe(0.5)
    expect(era.alphaTest).toBe(0.5)
    expect(era.side).toBe(THREE.DoubleSide)
  })
})

describe('applyEraRenderer', () => {
  it('converts every mesh material in a scene and restores the originals on cleanup', () => {
    const scene = new THREE.Group()
    const original = new THREE.MeshStandardMaterial({ map: new THREE.Texture() })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), original)
    scene.add(mesh)
    // A non-mesh child must be ignored by the pass.
    scene.add(new THREE.Group())

    const restore = applyEraRenderer(scene)

    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial)
    expect(mesh.material).not.toBe(original)

    // The created material is the one disposed; the loader-cache-owned original
    // is put back untouched (StrictMode / dispose law).
    const created = mesh.material as unknown as THREE.MeshBasicMaterial
    const disposed = vi.spyOn(created, 'dispose')
    const origDispose = vi.spyOn(original, 'dispose')

    restore()

    expect(mesh.material).toBe(original)
    expect(disposed).toHaveBeenCalledTimes(1)
    expect(origDispose).not.toHaveBeenCalled()
  })

  it('handles a multi-material mesh (array) end to end', () => {
    const scene = new THREE.Group()
    const a = new THREE.MeshStandardMaterial()
    const b = new THREE.MeshStandardMaterial()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [a, b])
    scene.add(mesh)

    const restore = applyEraRenderer(scene)

    const mats = mesh.material as THREE.Material[]
    expect(Array.isArray(mats)).toBe(true)
    expect(mats[0]).toBeInstanceOf(THREE.MeshBasicMaterial)
    expect(mats[1]).toBeInstanceOf(THREE.MeshBasicMaterial)

    restore()
    expect(mesh.material).toEqual([a, b])
  })
})
