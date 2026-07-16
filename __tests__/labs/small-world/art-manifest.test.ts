import { describe, expect, it } from 'vitest'
import { DELIVERED_ART, hasArt } from '@/components/labs/small-world/art-manifest'

describe('small-world art manifest', () => {
  it('has delivered the girl and nothing else yet', () => {
    expect(DELIVERED_ART.size).toBe(1)
    expect(DELIVERED_ART.has('girl')).toBe(true)
  })

  it('gates on membership, not truthiness of the id', () => {
    expect(hasArt('girl')).toBe(true)
    expect(hasArt('')).toBe(false)
    expect(hasArt('panel-bluenet-1')).toBe(false)
  })
})
