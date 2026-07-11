import { describe, expect, it } from 'vitest'
import { labelVariantFor } from '@/components/labs/memory-card/lib/save-visuals'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

describe('labelVariantFor', () => {
  it('gives each project a distinct loud variant, cycling by index', () => {
    expect(labelVariantFor('project', 0)).toBe('bankform')
    expect(labelVariantFor('project', 1)).toBe('chat')
    expect(labelVariantFor('project', 2)).toBe('appbadge')
    expect(labelVariantFor('project', 3)).toBe('bankform') // cycles
  })

  it('maps each system kind to its own quiet variant', () => {
    expect(labelVariantFor('bio', 3)).toBe('sysdata')
    expect(labelVariantFor('stack', 4)).toBe('syslog')
    expect(labelVariantFor('contact', 5)).toBe('sysprompt')
  })

  it('assigns the six shipped saves six distinct layouts (a collection, not clones)', () => {
    const saves = buildSaves(projects)
    const variants = saves.map((save, i) => labelVariantFor(save.kind, i))
    expect(new Set(variants).size).toBe(6)
  })
})
