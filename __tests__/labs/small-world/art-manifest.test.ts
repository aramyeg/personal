import { describe, expect, it } from 'vitest'
import { DELIVERED_ART, hasArt } from '@/components/labs/small-world/art-manifest'

describe('small-world art manifest', () => {
  it('ships empty until real art lands', () => {
    expect(DELIVERED_ART.size).toBe(0)
  })

  it('gates on membership, not truthiness of the id', () => {
    expect(hasArt('girl')).toBe(false)
    expect(hasArt('')).toBe(false)
  })
})
