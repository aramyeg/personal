import { describe, expect, it } from 'vitest'
import { accentFor } from '@/components/labs/memory-card/tokens'
import {
  buildSaves,
  blocksUsed,
  CARD_BLOCKS_TOTAL,
  type SaveKind,
} from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

describe('buildSaves', () => {
  const saves = buildSaves(projects)

  it('maps every project plus the three system slots, in order', () => {
    expect(saves).toHaveLength(6)
    expect(saves.map((s) => s.kind)).toEqual<SaveKind[]>([
      'project',
      'project',
      'project',
      'bio',
      'stack',
      'contact',
    ])
  })

  it('numbers slots 01 through 06 in sequence', () => {
    expect(saves.map((s) => s.slot)).toEqual(['01', '02', '03', '04', '05', '06'])
  })

  it('assigns accentFor(index) to every slot', () => {
    saves.forEach((save, i) => expect(save.accent).toBe(accentFor(i)))
  })

  it('attaches the source project only to project slots', () => {
    saves.forEach((save) => {
      if (save.kind === 'project') {
        expect(save.project).toBeDefined()
      } else {
        expect(save.project).toBeUndefined()
      }
    })
  })

  it('counts blocks as metrics.length for projects, 0 for system slots', () => {
    expect(saves.map((s) => s.blocks)).toEqual([3, 3, 3, 0, 0, 0])
  })

  it('sums blocksUsed to 9 with the current project data', () => {
    expect(blocksUsed(saves)).toBe(9)
  })

  it('leaves CARD_BLOCKS_TOTAL fixed at 15', () => {
    expect(CARD_BLOCKS_TOTAL).toBe(15)
  })

  it('labels project slots with the project title', () => {
    expect(saves[0].label).toBe('AMIO Bank iBank')
    expect(saves[1].label).toBe('360dialog Platform')
    expect(saves[2].label).toBe('SNB Mobile Banking')
  })

  it('labels the system slots with their fixed copy', () => {
    expect(saves[3].label).toBe('system data')
    expect(saves[4].label).toBe('written with')
    expect(saves[5].label).toBe('save?')
  })

  it('lowercases the project sub-line as year · first two technologies', () => {
    expect(saves[0].sub).toBe('2023-present · next.js · typescript')
    expect(saves[1].sub).toBe('2021-2023 · react · typescript')
    expect(saves[2].sub).toBe('2020-2021 · react native · typescript')
  })

  it('gives the system slots their fixed sub-line copy', () => {
    expect(saves[3].sub).toBe('aram yeghiazaryan · senior frontend engineer')
    expect(saves[4].sub).toBe('7 entries · this page only')
    expect(saves[5].sub).toBe('save your progress')
  })

  it('never claims a lead title', () => {
    for (const save of saves) expect(save.sub).not.toMatch(/lead/i)
  })
})
