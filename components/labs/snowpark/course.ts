import type { Skill, SkillCategory } from '@/types'
import { skillCategories, skills } from '@/data/skills'

export type ObstacleType = 'kicker' | 'rail' | 'box'

export type CourseObstacle = {
  skill: Skill
  type: ObstacleType
  /** world x where the obstacle begins */
  x: number
  /** world length along x */
  length: number
  stretchName: string
}

export type Stretch = {
  name: string
  category: SkillCategory
  startX: number
  endX: number
}

export type Course = {
  obstacles: CourseObstacle[]
  stretches: Stretch[]
  /** x of the finish banner */
  finishX: number
}

// Spaced to the slope rhythm: one obstacle roughly every other primary
// roller (wavelength 520) at cruise, so features land on the pumpable tempo.
export const START_X = 900
export const OBSTACLE_SPACING = 1150
export const STRETCH_GAP = 500
export const OBSTACLE_LENGTH: Record<ObstacleType, number> = {
  kicker: 120,
  rail: 220,
  box: 180,
}

const STRETCH_NAMES: Record<Exclude<SkillCategory, 'fun'>, string> = {
  frontend: 'frontend face',
  mobile: 'mobile ridge',
  state: 'state park',
  styling: 'styling bowl',
  backend: 'backend flats',
  tools: 'tooling run-out',
}

/** One obstacle per skill: experts get kickers; the rest alternate rail/box. */
export function compileCourse(source: Skill[] = skills): Course {
  const obstacles: CourseObstacle[] = []
  const stretches: Stretch[] = []
  let cursor = START_X
  let nonExpertCount = 0

  for (const { id } of skillCategories) {
    if (id === 'fun') continue
    const group = source.filter((s) => s.category === id)
    if (group.length === 0) continue
    const name = STRETCH_NAMES[id]
    const startX = cursor

    for (const skill of group) {
      const type: ObstacleType =
        skill.level === 'expert' ? 'kicker' : nonExpertCount % 2 === 0 ? 'rail' : 'box'
      if (skill.level !== 'expert') nonExpertCount += 1
      obstacles.push({ skill, type, x: cursor, length: OBSTACLE_LENGTH[type], stretchName: name })
      cursor += OBSTACLE_SPACING
    }

    stretches.push({ name, category: id, startX, endX: cursor })
    cursor += STRETCH_GAP
  }

  return { obstacles, stretches, finishX: cursor + 600 }
}
