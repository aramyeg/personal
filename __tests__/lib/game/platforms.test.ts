import { describe, it, expect } from 'vitest'
import { generatePlatforms, getRoleIcon, getShortRole } from '@/lib/game/platforms'
import type { Experience } from '@/types'

const mockExperiences: Experience[] = [
  {
    id: 'test-1',
    company: 'Company A',
    role: 'Frontend Developer',
    location: 'Remote',
    period: '2020 - 2021',
    startDate: '2020-01',
    endDate: '2021-01',
    description: 'Test description',
    highlights: ['Highlight 1'],
    technologies: ['React'],
  },
  {
    id: 'test-2',
    company: 'Company B',
    role: 'Senior Frontend Engineer',
    location: 'Remote',
    period: '2021 - 2023',
    startDate: '2021-02',
    endDate: '2023-01',
    description: 'Test description',
    highlights: ['Highlight 1'],
    technologies: ['React', 'TypeScript'],
  },
  {
    id: 'test-3',
    company: 'Company C',
    role: 'Technical Lead / Senior Frontend Engineer',
    location: 'Remote',
    period: '2023 - Present',
    startDate: '2023-02',
    endDate: null,
    description: 'Current role',
    highlights: ['Highlight 1'],
    technologies: ['React', 'TypeScript', 'Next.js'],
  },
]

describe('generatePlatforms', () => {
  it('generates correct number of platforms', () => {
    const platforms = generatePlatforms(mockExperiences, 620, 220)
    expect(platforms).toHaveLength(3)
  })

  it('sorts platforms by start date (oldest first)', () => {
    const platforms = generatePlatforms(mockExperiences, 620, 220)
    expect(platforms[0].year).toBe('2020')
    expect(platforms[1].year).toBe('2021')
    expect(platforms[2].year).toBe('2023')
  })

  it('assigns company names correctly', () => {
    const platforms = generatePlatforms(mockExperiences, 620, 220)
    expect(platforms[0].company).toBe('Company A')
    expect(platforms[1].company).toBe('Company B')
    expect(platforms[2].company).toBe('Company C')
  })

  it('positions platforms with increasing x values', () => {
    const platforms = generatePlatforms(mockExperiences, 620, 220)
    expect(platforms[1].x).toBeGreaterThan(platforms[0].x)
    expect(platforms[2].x).toBeGreaterThan(platforms[1].x)
  })

  it('initializes all platforms as not reached', () => {
    const platforms = generatePlatforms(mockExperiences, 620, 220)
    platforms.forEach((p) => expect(p.reached).toBe(false))
  })

  it('assigns platform width consistently', () => {
    const platforms = generatePlatforms(mockExperiences, 620, 220)
    platforms.forEach((p) => expect(p.width).toBe(110))
  })

  it('limits platforms to most recent 5', () => {
    const manyExperiences = Array.from({ length: 10 }, (_, i) => ({
      ...mockExperiences[0],
      id: `test-${i}`,
      startDate: `20${10 + i}-01`,
    }))
    const platforms = generatePlatforms(manyExperiences, 620, 220)
    expect(platforms.length).toBeLessThanOrEqual(5)
  })
})

describe('getRoleIcon', () => {
  it('returns rocket for Technical Lead', () => {
    expect(getRoleIcon('Technical Lead / Senior Frontend')).toBe('🚀')
  })

  it('returns lightning for Senior Frontend Engineer', () => {
    expect(getRoleIcon('Senior Frontend Engineer')).toBe('⚡')
  })

  it('returns phone for React Native roles', () => {
    expect(getRoleIcon('Senior React Native Developer')).toBe('📱')
  })

  it('returns computer for Frontend Developer', () => {
    expect(getRoleIcon('Frontend Developer')).toBe('💻')
  })

  it('returns briefcase for unknown roles', () => {
    expect(getRoleIcon('Unknown Position')).toBe('💼')
  })
})

describe('getShortRole', () => {
  it('shortens Technical Lead correctly', () => {
    expect(getShortRole('Technical Lead / Senior Frontend Engineer')).toBe('Tech Lead')
  })

  it('shortens Senior Frontend Engineer correctly', () => {
    expect(getShortRole('Senior Frontend Engineer')).toBe('Sr. Frontend')
  })

  it('shortens Senior React Native correctly', () => {
    expect(getShortRole('Senior React Native Developer')).toBe('Sr. Mobile')
  })

  it('shortens Frontend Developer correctly', () => {
    expect(getShortRole('Frontend Developer')).toBe('Frontend')
  })
})
