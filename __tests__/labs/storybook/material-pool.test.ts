import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { acquireMaterial, releaseMaterial, _poolDebugSnapshot } from '@/components/labs/storybook/book/material-pool'

describe('material-pool', () => {
  it('two acquires with an identical spec return the SAME object', () => {
    const a = acquireMaterial({ map: null, color: '#ffffff', side: THREE.BackSide })
    const b = acquireMaterial({ map: null, color: '#ffffff', side: THREE.BackSide })
    expect(a).toBe(b)
    releaseMaterial(a)
    releaseMaterial(b)
  })

  it('a differing color never collides with another spec', () => {
    const a = acquireMaterial({ map: null, color: '#ffffff' })
    const b = acquireMaterial({ map: null, color: '#000000' })
    expect(a).not.toBe(b)
    releaseMaterial(a)
    releaseMaterial(b)
  })

  it('a differing side never collides with another spec', () => {
    const a = acquireMaterial({ map: null, color: '#ffffff', side: THREE.FrontSide })
    const b = acquireMaterial({ map: null, color: '#ffffff', side: THREE.BackSide })
    expect(a).not.toBe(b)
    releaseMaterial(a)
    releaseMaterial(b)
  })

  it('a differing map identity never collides, even with equal color/side', () => {
    const mapA = new THREE.Texture()
    const mapB = new THREE.Texture()
    const a = acquireMaterial({ map: mapA, color: '#ffffff' })
    const b = acquireMaterial({ map: mapB, color: '#ffffff' })
    expect(a).not.toBe(b)
    releaseMaterial(a)
    releaseMaterial(b)
  })

  it('null map and a real map never collide (map presence changes the compiled shader)', () => {
    const withMap = acquireMaterial({ map: new THREE.Texture(), color: '#ffffff' })
    const withoutMap = acquireMaterial({ map: null, color: '#ffffff' })
    expect(withMap).not.toBe(withoutMap)
    releaseMaterial(withMap)
    releaseMaterial(withoutMap)
  })

  it('transparent/alphaTest/depthWrite/opacity/vertexColors/visible are all part of the key', () => {
    const base = { map: null, color: '#ffffff' } as const
    const variants = [
      acquireMaterial(base),
      acquireMaterial({ ...base, transparent: true }),
      acquireMaterial({ ...base, alphaTest: 0.1 }),
      acquireMaterial({ ...base, depthWrite: false }),
      acquireMaterial({ ...base, opacity: 0.5 }),
      acquireMaterial({ ...base, vertexColors: true }),
      acquireMaterial({ ...base, visible: false }),
    ]
    const distinct = new Set(variants)
    expect(distinct.size).toBe(variants.length)
    variants.forEach(releaseMaterial)
  })

  it('releasing does not dispose a material while another caller still holds it', () => {
    const spec = { map: null, color: '#123456' } as const
    const a = acquireMaterial(spec)
    const b = acquireMaterial(spec)
    expect(a.isMeshBasicMaterial).toBe(true) // still a live, undisposed material
    releaseMaterial(a)
    // b still holds a reference — re-acquiring the same spec must still
    // return the SAME (not-yet-disposed) object, not a freshly built one.
    const c = acquireMaterial(spec)
    expect(c).toBe(b)
    releaseMaterial(b)
    releaseMaterial(c)
  })

  it('the pool evicts an entry once its ref-count reaches zero — a later acquire with the same spec builds a fresh object', () => {
    const spec = { map: null, color: '#654321' } as const
    const a = acquireMaterial(spec)
    releaseMaterial(a)
    const before = _poolDebugSnapshot().size
    const b = acquireMaterial(spec)
    expect(b).not.toBe(a) // the old entry was evicted+disposed, not reused
    expect(_poolDebugSnapshot().size).toBe(before + 1)
    releaseMaterial(b)
  })

  it('releaseMaterial is a safe no-op for null/undefined/an unpooled material', () => {
    expect(() => releaseMaterial(null)).not.toThrow()
    expect(() => releaseMaterial(undefined)).not.toThrow()
    expect(() => releaseMaterial(new THREE.MeshBasicMaterial())).not.toThrow()
  })

  it('over-releasing a spec below zero does not throw or corrupt the pool for the next acquire', () => {
    const spec = { map: null, color: '#abcdef' } as const
    const a = acquireMaterial(spec)
    releaseMaterial(a)
    releaseMaterial(a) // extra release past zero
    expect(() => acquireMaterial(spec)).not.toThrow()
    const b = acquireMaterial(spec)
    releaseMaterial(b)
  })
})
