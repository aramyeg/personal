import { describe, expect, it } from 'vitest'
import {
  CHARACTER_IDLE_CLIP,
  FIT_COUNT,
  fitSrc,
} from '@/components/labs/memory-card/three/character'

describe('character fits', () => {
  it('resolves each fit number to its GLB under the fits directory', () => {
    expect(fitSrc(1)).toBe('/labs/memory-card/models/fits/char-fit1.glb')
    expect(fitSrc(6)).toBe('/labs/memory-card/models/fits/char-fit6.glb')
  })

  it('ships one fit per save slot', () => {
    expect(FIT_COUNT).toBe(6)
  })

  it('names the shared idle clip for its role, not an identity (character-agnostic law)', () => {
    expect(CHARACTER_IDLE_CLIP).toBe('fit-idle')
    expect(CHARACTER_IDLE_CLIP).not.toMatch(
      /\b(she|her|hers|woman|female|girl|he|him|his|man|male|boy)\b/i
    )
  })
})
