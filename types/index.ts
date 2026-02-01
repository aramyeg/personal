export type Experience = {
  id: string
  company: string
  role: string
  location: string
  period: string
  startDate: string
  endDate: string | null
  description: string
  highlights: string[]
  technologies: string[]
}

export type Project = {
  id: string
  title: string
  description: string
  longDescription?: string
  role: string
  company: string
  metrics?: string[]
  technologies: string[]
  image?: string
  link?: string
}

export type Skill = {
  name: string
  years: number
  category: SkillCategory
  level: 'expert' | 'advanced' | 'intermediate'
}

export type SkillCategory =
  | 'frontend'
  | 'mobile'
  | 'state'
  | 'styling'
  | 'backend'
  | 'tools'
  | 'fun'

export type SocialLink = {
  name: string
  url: string
  icon: string
}
