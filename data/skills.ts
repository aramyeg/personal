import type { Skill, SkillCategory } from '@/types'

// Focus skills - Modern stack the user is highly confident in despite less time
export type FocusSkill = {
  name: string
  description: string
  confidence: 'High' | 'Very High'
  growth: string
  icon: string
}

export const focusSkills: FocusSkill[] = [
  {
    name: 'Zustand',
    description: 'Lightweight, fast state management with minimal boilerplate',
    confidence: 'Very High',
    growth: 'Mastered in 2 years, now my go-to for state',
    icon: '🐻',
  },
  {
    name: 'Shadcn/ui',
    description: 'Beautifully designed, accessible components built on Radix',
    confidence: 'Very High',
    growth: 'Daily driver for all new projects',
    icon: '✨',
  },
  {
    name: 'TanStack Query',
    description: 'Powerful async state management for server state',
    confidence: 'High',
    growth: 'Essential for every data-fetching need',
    icon: '⚡',
  },
  {
    name: 'Next.js App Router',
    description: 'Modern React framework with RSC and streaming',
    confidence: 'Very High',
    growth: 'Embraced early, production-ready expertise',
    icon: '🚀',
  },
]

export const skills: Skill[] = [
  // Frontend
  { name: 'React', years: 8, category: 'frontend', level: 'expert' },
  { name: 'Next.js', years: 5, category: 'frontend', level: 'expert' },
  { name: 'TypeScript', years: 6, category: 'frontend', level: 'expert' },
  { name: 'JavaScript', years: 8, category: 'frontend', level: 'expert' },

  // Mobile
  { name: 'React Native', years: 5, category: 'mobile', level: 'expert' },
  { name: 'Expo', years: 3, category: 'mobile', level: 'advanced' },

  // State Management
  { name: 'Redux / RTK', years: 6, category: 'state', level: 'expert' },
  { name: 'Zustand', years: 2, category: 'state', level: 'advanced' },
  { name: 'TanStack Query', years: 3, category: 'state', level: 'advanced' },
  { name: 'Context API', years: 5, category: 'state', level: 'expert' },

  // Styling
  { name: 'Tailwind CSS', years: 4, category: 'styling', level: 'expert' },
  { name: 'Shadcn UI', years: 2, category: 'styling', level: 'advanced' },
  { name: 'Chakra UI', years: 3, category: 'styling', level: 'advanced' },
  { name: 'Styled Components', years: 4, category: 'styling', level: 'advanced' },
  { name: 'CSS/SCSS', years: 8, category: 'styling', level: 'expert' },

  // Backend
  { name: 'Node.js', years: 5, category: 'backend', level: 'advanced' },
  { name: 'GraphQL', years: 4, category: 'backend', level: 'advanced' },
  { name: 'REST APIs', years: 8, category: 'backend', level: 'expert' },
  { name: 'Prisma', years: 2, category: 'backend', level: 'intermediate' },

  // Tools
  { name: 'Git', years: 8, category: 'tools', level: 'expert' },
  { name: 'Storybook', years: 3, category: 'tools', level: 'advanced' },
  { name: 'Jest', years: 5, category: 'tools', level: 'advanced' },
  { name: 'Webpack/Vite', years: 5, category: 'tools', level: 'advanced' },
]

export const skillCategories: { id: SkillCategory; label: string }[] = [
  { id: 'frontend', label: 'Frontend' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'state', label: 'State Management' },
  { id: 'styling', label: 'Styling' },
  { id: 'backend', label: 'Backend' },
  { id: 'tools', label: 'Tools' },
]

export const getSkillsByCategory = (category: SkillCategory) =>
  skills.filter((skill) => skill.category === category)
