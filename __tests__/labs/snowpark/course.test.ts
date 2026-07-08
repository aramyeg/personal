import { describe, expect, it } from 'vitest'
import type { Skill } from '@/types'
import { skills } from '@/data/skills'
import {
  compileCourse,
  OBSTACLE_LENGTH,
  OBSTACLE_SPACING,
  START_X,
} from '@/components/labs/snowpark/course'

describe('compileCourse', () => {
  const course = compileCourse()

  it('creates exactly one obstacle per skill (fun excluded)', () => {
    expect(course.obstacles).toHaveLength(skills.length)
  })

  it('assigns kickers to expert skills and rail/box alternation to the rest', () => {
    for (const o of course.obstacles) {
      if (o.skill.level === 'expert') expect(o.type).toBe('kicker')
      else expect(['rail', 'box']).toContain(o.type)
    }
    const nonExpert = course.obstacles.filter((o) => o.skill.level !== 'expert')
    nonExpert.forEach((o, i) => {
      expect(o.type).toBe(i % 2 === 0 ? 'rail' : 'box')
    })
  })

  it('groups by category into named stretches in skillCategories order', () => {
    expect(course.stretches.map((s) => s.name)).toEqual([
      'frontend face',
      'mobile ridge',
      'state park',
      'styling bowl',
      'backend flats',
      'tooling run-out',
    ])
    for (const stretch of course.stretches) {
      const inside = course.obstacles.filter((o) => o.stretchName === stretch.name)
      expect(inside.length).toBeGreaterThan(0)
      for (const o of inside) expect(o.skill.category).toBe(stretch.category)
    }
  })

  it('places obstacles at strictly increasing x with the finish beyond the last', () => {
    const xs = course.obstacles.map((o) => o.x)
    expect(xs[0]).toBe(START_X)
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
    const last = course.obstacles[course.obstacles.length - 1]
    expect(course.finishX).toBeGreaterThan(last.x + last.length)
  })

  it('adding a skill to the source adds an obstacle', () => {
    const extra: Skill = { name: 'Vitest', years: 2, category: 'tools', level: 'advanced' }
    const bigger = compileCourse([...skills, extra])
    expect(bigger.obstacles).toHaveLength(skills.length + 1)
    expect(bigger.obstacles.some((o) => o.skill.name === 'Vitest')).toBe(true)
  })

  it('uses the fixed lengths per obstacle type', () => {
    for (const o of course.obstacles) expect(o.length).toBe(OBSTACLE_LENGTH[o.type])
    expect(OBSTACLE_SPACING).toBeGreaterThan(Math.max(...Object.values(OBSTACLE_LENGTH)))
  })
})
