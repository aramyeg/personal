import { describe, expect, it } from 'vitest'
import { BANDS, darken, mix } from '@/components/labs/snowpark/render/terrain'

const HEX = /^#[0-9a-f]{6}$/

describe('mix', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    expect(mix('#112233', '#aabbcc', 0)).toBe('#112233')
    expect(mix('#112233', '#aabbcc', 1)).toBe('#aabbcc')
  })

  it('lands on the arithmetic midpoint at t=0.5', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('emits valid #rrggbb across the range', () => {
    for (let t = 0; t <= 1.0001; t += 0.1) {
      expect(mix('#2e5468', '#e6b95c', t)).toMatch(HEX)
    }
  })
})

describe('darken', () => {
  it('is identity at 0 and black at 1', () => {
    expect(darken('#8899aa', 0)).toBe('#8899aa')
    expect(darken('#8899aa', 1)).toBe('#000000')
  })

  it('scales channels toward black', () => {
    // 0x80 * (1 - 0.25) = 96 = 0x60
    expect(darken('#808080', 0.25)).toBe('#606060')
  })
})

describe('BANDS', () => {
  it('orders factor and height farthest-first (both strictly increasing)', () => {
    for (let i = 1; i < BANDS.length; i++) {
      expect(BANDS[i].factor).toBeGreaterThan(BANDS[i - 1].factor)
      expect(BANDS[i].height).toBeGreaterThan(BANDS[i - 1].height)
    }
  })

  it('shrinks ridge amplitude with proximity', () => {
    for (let i = 1; i < BANDS.length; i++) {
      expect(BANDS[i].ampScale).toBeLessThan(BANDS[i - 1].ampScale)
    }
  })
})
