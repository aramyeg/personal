import { describe, expect, it } from 'vitest'
import {
  CHARACTER_SRC,
  CHARACTER_IDLE_CLIP,
} from '@/components/labs/memory-card/three/character'

describe('character asset', () => {
  it('points at the drop-in character GLB', () => {
    expect(CHARACTER_SRC).toBe('/labs/memory-card/models/character.glb')
  })

  it('keeps the idle clip identity-agnostic (character-agnostic law)', () => {
    expect(CHARACTER_IDLE_CLIP).not.toMatch(/\b(she|her|hers|woman|female|girl)\b/i)
  })
})
