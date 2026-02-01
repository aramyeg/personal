import { describe, it, expect } from 'vitest'
import {
  SKILL_NODES,
  CATEGORY_COLORS,
  SKILL_TREE_COLORS,
  SKILL_TREE_DIMENSIONS,
  getNodeById,
  getNodesByCategory,
  getConnectedNodes,
  getNodesAtYear,
  getMinYear,
  getMaxYear,
  getAllCompanies,
  getTotalYears,
  getExpertSkillsCount,
} from '@/lib/game/skillTree/skillTreeData'
import type { SkillTreeCategory } from '@/lib/game/skillTree/types'

// ============================================
// SKILL NODES DATA TESTS
// ============================================

describe('skillTreeData - SKILL_NODES', () => {
  it('contains skill nodes', () => {
    expect(SKILL_NODES.length).toBeGreaterThan(0)
  })

  it('each node has required properties', () => {
    for (const node of SKILL_NODES) {
      expect(node.id).toBeDefined()
      expect(typeof node.id).toBe('string')
      expect(node.name).toBeDefined()
      expect(typeof node.name).toBe('string')
      expect(node.category).toBeDefined()
      expect(node.proficiency).toBeGreaterThanOrEqual(1)
      expect(node.proficiency).toBeLessThanOrEqual(5)
      expect(node.companies).toBeDefined()
      expect(Array.isArray(node.companies)).toBe(true)
      expect(node.connections).toBeDefined()
      expect(Array.isArray(node.connections)).toBe(true)
      expect(node.yearsUsed).toBeGreaterThanOrEqual(0)
      expect(node.position).toBeDefined()
      expect(typeof node.position.x).toBe('number')
      expect(typeof node.position.y).toBe('number')
      expect(node.unlockedYear).toBeDefined()
      expect(typeof node.unlockedYear).toBe('number')
    }
  })

  it('each node has unique ID', () => {
    const ids = SKILL_NODES.map((n) => n.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('all connections reference valid node IDs', () => {
    const validIds = new Set(SKILL_NODES.map((n) => n.id))

    for (const node of SKILL_NODES) {
      for (const connectionId of node.connections) {
        expect(validIds.has(connectionId)).toBe(true)
      }
    }
  })

  it('contains expected core skills', () => {
    const nodeIds = SKILL_NODES.map((n) => n.id)
    expect(nodeIds).toContain('react')
    expect(nodeIds).toContain('typescript')
    expect(nodeIds).toContain('nextjs')
    expect(nodeIds).toContain('nodejs')
  })
})

// ============================================
// VISUAL CONFIGURATION TESTS
// ============================================

describe('skillTreeData - Visual Configuration', () => {
  describe('CATEGORY_COLORS', () => {
    it('has colors for all categories', () => {
      const categories: SkillTreeCategory[] = [
        'frontend',
        'backend',
        'mobile',
        'state',
        'styling',
        'tools',
      ]

      for (const category of categories) {
        expect(CATEGORY_COLORS[category]).toBeDefined()
        expect(typeof CATEGORY_COLORS[category]).toBe('string')
      }
    })

    it('colors are valid hex values', () => {
      const hexPattern = /^#[0-9A-Fa-f]{6}$/

      for (const color of Object.values(CATEGORY_COLORS)) {
        expect(color).toMatch(hexPattern)
      }
    })
  })

  describe('SKILL_TREE_COLORS', () => {
    it('has all required color keys', () => {
      expect(SKILL_TREE_COLORS.background).toBeDefined()
      expect(SKILL_TREE_COLORS.nodeInactive).toBeDefined()
      expect(SKILL_TREE_COLORS.nodeActive).toBeDefined()
      expect(SKILL_TREE_COLORS.nodeBorder).toBeDefined()
      expect(SKILL_TREE_COLORS.connections).toBeDefined()
      expect(SKILL_TREE_COLORS.connectionsHighlight).toBeDefined()
      expect(SKILL_TREE_COLORS.text).toBeDefined()
      expect(SKILL_TREE_COLORS.textMuted).toBeDefined()
    })

    it('colors are valid hex values', () => {
      const hexPattern = /^#[0-9A-Fa-f]{6}$/

      for (const color of Object.values(SKILL_TREE_COLORS)) {
        expect(color).toMatch(hexPattern)
      }
    })
  })

  describe('SKILL_TREE_DIMENSIONS', () => {
    it('has required dimension values', () => {
      expect(SKILL_TREE_DIMENSIONS.width).toBeDefined()
      expect(SKILL_TREE_DIMENSIONS.height).toBeDefined()
      expect(SKILL_TREE_DIMENSIONS.nodeRadius).toBeDefined()
      expect(SKILL_TREE_DIMENSIONS.nodeRadiusHovered).toBeDefined()
    })

    it('dimensions are positive numbers', () => {
      expect(SKILL_TREE_DIMENSIONS.width).toBeGreaterThan(0)
      expect(SKILL_TREE_DIMENSIONS.height).toBeGreaterThan(0)
      expect(SKILL_TREE_DIMENSIONS.nodeRadius).toBeGreaterThan(0)
      expect(SKILL_TREE_DIMENSIONS.nodeRadiusHovered).toBeGreaterThan(0)
    })

    it('hovered radius is larger than normal radius', () => {
      expect(SKILL_TREE_DIMENSIONS.nodeRadiusHovered).toBeGreaterThan(
        SKILL_TREE_DIMENSIONS.nodeRadius
      )
    })
  })
})

// ============================================
// HELPER FUNCTIONS TESTS
// ============================================

describe('skillTreeData - getNodeById', () => {
  it('returns node for valid ID', () => {
    const node = getNodeById('react')

    expect(node).toBeDefined()
    expect(node?.id).toBe('react')
    expect(node?.name).toBe('React')
  })

  it('returns undefined for invalid ID', () => {
    const node = getNodeById('non-existent-skill')

    expect(node).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    const node = getNodeById('')

    expect(node).toBeUndefined()
  })

  it('is case-sensitive', () => {
    const node = getNodeById('React')

    expect(node).toBeUndefined()
  })

  it('returns correct node for each valid ID', () => {
    for (const expectedNode of SKILL_NODES) {
      const node = getNodeById(expectedNode.id)
      expect(node).toEqual(expectedNode)
    }
  })
})

describe('skillTreeData - getNodesByCategory', () => {
  it('returns frontend nodes', () => {
    const nodes = getNodesByCategory('frontend')

    expect(nodes.length).toBeGreaterThan(0)
    nodes.forEach((node) => {
      expect(node.category).toBe('frontend')
    })
  })

  it('returns backend nodes', () => {
    const nodes = getNodesByCategory('backend')

    expect(nodes.length).toBeGreaterThan(0)
    nodes.forEach((node) => {
      expect(node.category).toBe('backend')
    })
  })

  it('returns mobile nodes', () => {
    const nodes = getNodesByCategory('mobile')

    expect(nodes.length).toBeGreaterThan(0)
    nodes.forEach((node) => {
      expect(node.category).toBe('mobile')
    })
  })

  it('returns state management nodes', () => {
    const nodes = getNodesByCategory('state')

    expect(nodes.length).toBeGreaterThan(0)
    nodes.forEach((node) => {
      expect(node.category).toBe('state')
    })
  })

  it('returns styling nodes', () => {
    const nodes = getNodesByCategory('styling')

    expect(nodes.length).toBeGreaterThan(0)
    nodes.forEach((node) => {
      expect(node.category).toBe('styling')
    })
  })

  it('returns tools nodes', () => {
    const nodes = getNodesByCategory('tools')

    expect(nodes.length).toBeGreaterThan(0)
    nodes.forEach((node) => {
      expect(node.category).toBe('tools')
    })
  })

  it('total nodes from all categories equals total nodes', () => {
    const categories: SkillTreeCategory[] = [
      'frontend',
      'backend',
      'mobile',
      'state',
      'styling',
      'tools',
    ]

    const totalFromCategories = categories.reduce(
      (sum, cat) => sum + getNodesByCategory(cat).length,
      0
    )

    expect(totalFromCategories).toBe(SKILL_NODES.length)
  })
})

describe('skillTreeData - getConnectedNodes', () => {
  it('returns connected nodes for react', () => {
    const connected = getConnectedNodes('react')

    expect(connected.length).toBeGreaterThan(0)
    // React connections include typescript, nextjs, react-native, redux
    const connectedIds = connected.map((n) => n.id)
    expect(connectedIds).toContain('typescript')
    expect(connectedIds).toContain('nextjs')
  })

  it('returns empty array for node with no connections', () => {
    const connected = getConnectedNodes('git')

    expect(connected).toEqual([])
  })

  it('returns empty array for invalid node ID', () => {
    const connected = getConnectedNodes('non-existent')

    expect(connected).toEqual([])
  })

  it('returns empty array for empty string', () => {
    const connected = getConnectedNodes('')

    expect(connected).toEqual([])
  })

  it('returns actual node objects, not just IDs', () => {
    const connected = getConnectedNodes('react')

    connected.forEach((node) => {
      expect(node.id).toBeDefined()
      expect(node.name).toBeDefined()
      expect(node.category).toBeDefined()
    })
  })
})

describe('skillTreeData - getNodesAtYear', () => {
  it('returns nodes unlocked by the given year', () => {
    const year = 2018
    const nodes = getNodesAtYear(year)

    nodes.forEach((node) => {
      expect(node.unlockedYear).toBeLessThanOrEqual(year)
    })
  })

  it('returns fewer nodes for earlier years', () => {
    const early = getNodesAtYear(2016)
    const late = getNodesAtYear(2023)

    expect(early.length).toBeLessThanOrEqual(late.length)
  })

  it('returns all nodes for current year', () => {
    const currentYear = new Date().getFullYear()
    const nodes = getNodesAtYear(currentYear)

    expect(nodes.length).toBe(SKILL_NODES.length)
  })

  it('returns some nodes for minimum year', () => {
    const minYear = getMinYear()
    const nodes = getNodesAtYear(minYear)

    expect(nodes.length).toBeGreaterThan(0)
  })

  it('returns no nodes for year before any skills', () => {
    const nodes = getNodesAtYear(2000)

    expect(nodes.length).toBe(0)
  })

  it('includes nodes unlocked exactly on the given year', () => {
    // Find a node with a specific unlock year
    const testNode = SKILL_NODES.find((n) => n.unlockedYear === 2018)
    if (testNode) {
      const nodes = getNodesAtYear(2018)
      const nodeIds = nodes.map((n) => n.id)
      expect(nodeIds).toContain(testNode.id)
    }
  })
})

describe('skillTreeData - getMinYear', () => {
  it('returns a number', () => {
    const minYear = getMinYear()
    expect(typeof minYear).toBe('number')
  })

  it('returns the earliest unlock year', () => {
    const minYear = getMinYear()
    const allYears = SKILL_NODES.map((n) => n.unlockedYear)
    const expectedMin = Math.min(...allYears)

    expect(minYear).toBe(expectedMin)
  })

  it('is less than or equal to max year', () => {
    expect(getMinYear()).toBeLessThanOrEqual(getMaxYear())
  })

  it('is a reasonable year (after 2000)', () => {
    expect(getMinYear()).toBeGreaterThan(2000)
  })
})

describe('skillTreeData - getMaxYear', () => {
  it('returns a number', () => {
    const maxYear = getMaxYear()
    expect(typeof maxYear).toBe('number')
  })

  it('returns the current year', () => {
    const maxYear = getMaxYear()
    const currentYear = new Date().getFullYear()

    expect(maxYear).toBe(currentYear)
  })

  it('is greater than or equal to all node unlock years', () => {
    const maxYear = getMaxYear()
    SKILL_NODES.forEach((node) => {
      expect(maxYear).toBeGreaterThanOrEqual(node.unlockedYear)
    })
  })
})

describe('skillTreeData - getAllCompanies', () => {
  it('returns an array', () => {
    const companies = getAllCompanies()
    expect(Array.isArray(companies)).toBe(true)
  })

  it('returns unique companies', () => {
    const companies = getAllCompanies()
    const uniqueCompanies = new Set(companies)

    expect(uniqueCompanies.size).toBe(companies.length)
  })

  it('contains expected companies', () => {
    const companies = getAllCompanies()

    // These are from the skill data
    expect(companies).toContain('bluenet')
    expect(companies).toContain('xdatagroup')
  })

  it('returns non-empty array', () => {
    const companies = getAllCompanies()
    expect(companies.length).toBeGreaterThan(0)
  })
})

describe('skillTreeData - getTotalYears', () => {
  it('returns a number', () => {
    const years = getTotalYears()
    expect(typeof years).toBe('number')
  })

  it('returns positive number', () => {
    const years = getTotalYears()
    expect(years).toBeGreaterThan(0)
  })

  it('returns the maximum yearsUsed from all nodes', () => {
    const years = getTotalYears()
    const maxYears = Math.max(...SKILL_NODES.map((n) => n.yearsUsed))

    expect(years).toBe(maxYears)
  })
})

describe('skillTreeData - getExpertSkillsCount', () => {
  it('returns a number', () => {
    const count = getExpertSkillsCount()
    expect(typeof count).toBe('number')
  })

  it('returns count of skills with proficiency >= 4', () => {
    const count = getExpertSkillsCount()
    const expectedCount = SKILL_NODES.filter((n) => n.proficiency >= 4).length

    expect(count).toBe(expectedCount)
  })

  it('returns positive number (there are expert skills)', () => {
    const count = getExpertSkillsCount()
    expect(count).toBeGreaterThan(0)
  })

  it('does not count skills with proficiency < 4', () => {
    const count = getExpertSkillsCount()
    const allSkillsCount = SKILL_NODES.length
    const nonExpertCount = SKILL_NODES.filter((n) => n.proficiency < 4).length

    expect(count).toBe(allSkillsCount - nonExpertCount)
  })
})

// ============================================
// EDGE CASES AND BOUNDARY CONDITIONS
// ============================================

describe('skillTreeData - Edge Cases', () => {
  it('handles getNodeById with whitespace', () => {
    expect(getNodeById(' react ')).toBeUndefined()
    expect(getNodeById('react ')).toBeUndefined()
    expect(getNodeById(' react')).toBeUndefined()
  })

  it('handles getNodeById with special characters', () => {
    expect(getNodeById('react!')).toBeUndefined()
    expect(getNodeById('react@')).toBeUndefined()
    expect(getNodeById('react#')).toBeUndefined()
  })

  it('getNodesAtYear handles fractional years', () => {
    const nodes = getNodesAtYear(2018.5)
    // Should work like Math.floor - nodes <= 2018.5 means <= 2018
    nodes.forEach((node) => {
      expect(node.unlockedYear).toBeLessThanOrEqual(2018)
    })
  })

  it('getNodesAtYear handles negative years', () => {
    const nodes = getNodesAtYear(-2000)
    expect(nodes).toEqual([])
  })

  it('node positions are within reasonable canvas bounds', () => {
    const maxX = SKILL_TREE_DIMENSIONS.width
    const maxY = SKILL_TREE_DIMENSIONS.height

    SKILL_NODES.forEach((node) => {
      expect(node.position.x).toBeGreaterThanOrEqual(0)
      expect(node.position.y).toBeGreaterThanOrEqual(0)
      expect(node.position.x).toBeLessThanOrEqual(maxX)
      expect(node.position.y).toBeLessThanOrEqual(maxY)
    })
  })
})
