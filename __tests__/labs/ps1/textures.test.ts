import '../../helpers/canvas-2d'
import { describe, expect, it } from 'vitest'
import { mulberry32, quantize15, ditherQuantizeCanvas } from '@/components/labs/ps1/scene/textures'

describe('quantize15', () => {
  it('maps 0..255 onto exactly 32 levels', () => {
    const levels = new Set<number>()
    for (let v = 0; v <= 255; v++) levels.add(quantize15(v))
    expect(levels.size).toBe(32)
    expect(quantize15(0)).toBe(0)
    expect(quantize15(255)).toBe(255)
  })
  it('is idempotent', () => {
    for (const v of [0, 37, 128, 200, 255]) expect(quantize15(quantize15(v))).toBe(quantize15(v))
  })
})

describe('mulberry32', () => {
  it('is deterministic per seed and uniform-ish in [0,1)', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    const seq = Array.from({ length: 8 }, () => a())
    expect(Array.from({ length: 8 }, () => b())).toEqual(seq)
    expect(seq.every((x) => x >= 0 && x < 1)).toBe(true)
  })
})

describe('ditherQuantizeCanvas', () => {
  it('leaves every channel on a 5-bit level', () => {
    const c = document.createElement('canvas')
    c.width = c.height = 8
    const g = c.getContext('2d')!
    g.fillStyle = '#8a8578'
    g.fillRect(0, 0, 8, 8)
    const data = ditherQuantizeCanvas(c).getContext('2d')!.getImageData(0, 0, 8, 8).data
    for (let i = 0; i < data.length; i += 4) {
      expect(quantize15(data[i])).toBe(data[i])
      expect(quantize15(data[i + 1])).toBe(data[i + 1])
      expect(quantize15(data[i + 2])).toBe(data[i + 2])
    }
  })
  it('dithers a gradient into more than one level per row', () => {
    const c = document.createElement('canvas')
    c.width = 32; c.height = 4
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 32, 0)
    grad.addColorStop(0, '#404040'); grad.addColorStop(1, '#484848')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 4)
    const data = ditherQuantizeCanvas(c).getContext('2d')!.getImageData(0, 0, 32, 1).data
    const reds = new Set<number>()
    for (let i = 0; i < data.length; i += 4) reds.add(data[i])
    expect(reds.size).toBeGreaterThan(1)
  })
})
