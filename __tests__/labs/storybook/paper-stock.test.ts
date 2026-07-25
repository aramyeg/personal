import { describe, expect, it } from 'vitest'
import { kraftTints } from '@/components/labs/storybook/book/paper-stock'

// D3 edge-legibility package: the cut edge exposes the sheet's pale uninked
// core, so every family member's `edge` sibling must be LIGHTER than its
// `lit` sibling. This guards the paper-stock light-edge flip (paler core,
// not a darker hairline) from silently regressing back to a darkened edge.
describe('paper-stock kraft family edge tint', () => {
  const hexLightness = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    return (max + min) / 2
  }

  it('renders a paler core edge than the lit face for every family member', () => {
    // kraftTints is keyed by a hash of the layer id; probe enough distinct
    // ids to sample every member of the curated family (7 members).
    const ids = Array.from({ length: 64 }, (_, i) => `probe-layer-${i}`)
    const seen = new Set<string>()

    for (const id of ids) {
      const tint = kraftTints(id)
      seen.add(tint.lit)
      expect(hexLightness(tint.edge)).toBeGreaterThan(hexLightness(tint.lit))
    }

    // Sanity: the probe actually sampled more than one family member.
    expect(seen.size).toBeGreaterThan(1)
  })
})
