import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { makePSXMaterial, patchPSX } from '@/components/labs/ps1/scene/psx-materials'

function compileStrings(mat: THREE.Material) {
  // Feed onBeforeCompile a real Lambert shader source pair
  const shader = {
    vertexShader: THREE.ShaderLib.lambert.vertexShader,
    fragmentShader: THREE.ShaderLib.lambert.fragmentShader,
    uniforms: {},
  }
  // @ts-expect-error test invokes the hook directly
  mat.onBeforeCompile(shader, null)
  return shader
}

describe('patchPSX', () => {
  it('injects the NDC snap after project_vertex', () => {
    const s = compileStrings(makePSXMaterial({}))
    expect(s.vertexShader).toContain('floor(ndc * grid + 0.5)')
  })
  it('injects the affine UV multiply/divide pair', () => {
    const s = compileStrings(makePSXMaterial({}))
    expect(s.vertexShader).toContain('vAffineW = gl_Position.w')
    expect(s.fragmentShader).toContain('vMapUv / vAffineW')
  })
  it('omits patches when disabled and cache keys differ per combo', () => {
    const off = makePSXMaterial({ affine: false, snap: false })
    const s = compileStrings(off)
    expect(s.vertexShader).not.toContain('floor(ndc')
    const combos = [
      makePSXMaterial({}), makePSXMaterial({ affine: false }),
      makePSXMaterial({ snap: false }), off,
    ].map((m) => m.customProgramCacheKey())
    expect(new Set(combos).size).toBe(4)
  })
  it('returns a Lambert (Gouraud) material — never Standard/Physical', () => {
    expect(makePSXMaterial({}).type).toBe('MeshLambertMaterial')
  })
  it('patchPSX preserves the material instance', () => {
    const m = new THREE.MeshLambertMaterial()
    expect(patchPSX(m)).toBe(m)
  })
})
