import { describe, expect, it, vi } from 'vitest'
import type { Camera, Object3D } from 'three'
import { precompileScene, requestPrecompile } from '@/components/labs/small-world/scene/precompile'

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
