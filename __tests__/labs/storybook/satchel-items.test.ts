import { describe, expect, it } from 'vitest'
import { skills } from '@/data'
import { SATCHEL_ITEMS, satchelSkill } from '@/components/labs/storybook/satchel-items'

describe('satchel items', () => {
  it('features six items, each resolving to a real skill', () => {
    expect(SATCHEL_ITEMS).toHaveLength(6)
    for (const item of SATCHEL_ITEMS) {
      const skill = satchelSkill(item)
      expect(skills).toContainEqual(skill)
      expect(item.blurb.length).toBeGreaterThan(10)
    }
  })
  it('features the flagship skills', () => {
    const names = SATCHEL_ITEMS.map((i) => i.skillName)
    expect(names).toContain('React')
    expect(names).toContain('TypeScript')
    expect(names).toContain('React Native')
  })
})
