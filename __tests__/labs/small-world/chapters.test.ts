import { describe, it, expect } from 'vitest'
import { chapters, CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { PALETTE } from '@/components/labs/small-world/palette'

describe('small-world chapters', () => {
  it('exposes exactly six chapters, oldest first', () => {
    expect(chapters).toHaveLength(CHAPTER_COUNT)
    expect(chapters[0].id).toBe('bluenet')
    expect(chapters[CHAPTER_COUNT - 1].id).toBe('xdatagroup')
  })

  it('carries real experience content through', () => {
    const xdg = chapters[CHAPTER_COUNT - 1]
    expect(xdg.company).toBe('xDataGroup')
    expect(xdg.role).toBe('Senior Frontend Engineer') // no-lead-title-claims
    expect(xdg.technologies).toContain('Next.js')
  })

  it('gives every chapter a theme and a hex accent', () => {
    for (const c of chapters) {
      expect(c.theme.length).toBeGreaterThan(0)
      expect(c.accent).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('palette anchors match the spec', () => {
    expect(PALETTE.meadow).toBe('#7BC47F')
    expect(PALETTE.blossom).toBe('#F7A8C4')
    expect(PALETTE.river).toBe('#6FB7D9')
    expect(PALETTE.sky).toBe('#FFF3D6')
  })
})
