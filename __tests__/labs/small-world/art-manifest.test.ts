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

  it('does not shadow the manga pages, which have a typed manifest of their own', () => {
    // This registry answers "might this art be missing?". The seven pages are
    // committed files whose typed manifest carries their paths AND their pixel
    // sizes, so an entry here would be a second source of the same fact — the
    // kind that drifts. Guard the absence so nobody helpfully re-adds them.
    for (const id of ['page-0', 'page-5', 'epilogue', 'manga-page-0']) {
      expect(hasArt(id)).toBe(false)
    }
  })
})
