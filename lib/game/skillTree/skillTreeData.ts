/**
 * Skill Tree Data
 * Static data for skill nodes, positions, and visual configuration
 */

import type { SkillNode, SkillTreeCategory } from './types'

// ============================================
// VISUAL CONFIGURATION (GitHub Dark theme)
// ============================================

/**
 * Colors for each skill category
 */
export const CATEGORY_COLORS: Record<SkillTreeCategory, string> = {
  frontend: '#7ee787', // Green
  backend: '#f78166', // Orange
  mobile: '#a371f7', // Purple
  state: '#ff7b72', // Red
  styling: '#d2a8ff', // Lavender
  tools: '#ffa657', // Yellow
}

/**
 * Core colors for the skill tree UI
 */
export const SKILL_TREE_COLORS = {
  background: '#0d1117',
  nodeInactive: '#161b22',
  nodeActive: '#58a6ff',
  nodeBorder: '#30363d',
  connections: '#30363d',
  connectionsHighlight: '#58a6ff',
  text: '#c9d1d9',
  textMuted: '#8b949e',
} as const

/**
 * Canvas dimensions
 */
export const SKILL_TREE_DIMENSIONS = {
  width: 620,
  height: 400,
  nodeRadius: 24,
  nodeRadiusHovered: 28,
} as const

// ============================================
// SKILL NODE DATA
// ============================================

/**
 * All skill nodes with positions calculated for tree layout
 *
 * Layout strategy:
 * - Frontend/Styling on left (x: 50-180)
 * - State management center-left (x: 180-280)
 * - Mobile in center (x: 280-380)
 * - Backend on right (x: 400-580)
 * - Tools at bottom (x: 200-420, y: 320-380)
 */
export const SKILL_NODES: SkillNode[] = [
  // ============================================
  // FRONTEND CORE (Left side)
  // ============================================
  {
    id: 'react',
    name: 'React',
    category: 'frontend',
    proficiency: 5,
    companies: ['bluenet', 'flyerbee', '360dialog', 'accenture', 'akna', 'xdatagroup'],
    connections: ['typescript', 'nextjs', 'react-native', 'redux'],
    yearsUsed: 8,
    position: { x: 150, y: 180 },
    unlockedYear: 2016,
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    category: 'frontend',
    proficiency: 5,
    companies: ['akna', 'xdatagroup'],
    connections: ['react', 'typescript', 'tailwind'],
    yearsUsed: 5,
    position: { x: 80, y: 100 },
    unlockedYear: 2019,
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    category: 'frontend',
    proficiency: 5,
    companies: ['360dialog', 'accenture', 'akna', 'xdatagroup'],
    connections: ['react', 'nextjs', 'nodejs', 'graphql'],
    yearsUsed: 6,
    position: { x: 220, y: 80 },
    unlockedYear: 2018,
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    category: 'frontend',
    proficiency: 5,
    companies: ['bluenet', 'flyerbee', '360dialog', 'accenture', 'akna', 'xdatagroup'],
    connections: ['react', 'nodejs'],
    yearsUsed: 8,
    position: { x: 80, y: 180 },
    unlockedYear: 2016,
  },

  // ============================================
  // MOBILE (Center)
  // ============================================
  {
    id: 'react-native',
    name: 'React Native',
    category: 'mobile',
    proficiency: 5,
    companies: ['flyerbee', 'accenture'],
    connections: ['react', 'redux', 'expo'],
    yearsUsed: 5,
    position: { x: 320, y: 160 },
    unlockedYear: 2018,
  },
  {
    id: 'expo',
    name: 'Expo',
    category: 'mobile',
    proficiency: 4,
    companies: ['flyerbee'],
    connections: ['react-native'],
    yearsUsed: 3,
    position: { x: 380, y: 100 },
    unlockedYear: 2019,
  },

  // ============================================
  // STATE MANAGEMENT (Center-left)
  // ============================================
  {
    id: 'redux',
    name: 'Redux / RTK',
    category: 'state',
    proficiency: 5,
    companies: ['flyerbee', 'accenture', 'akna', 'xdatagroup'],
    connections: ['react', 'react-native', 'typescript'],
    yearsUsed: 6,
    position: { x: 220, y: 260 },
    unlockedYear: 2017,
  },
  {
    id: 'zustand',
    name: 'Zustand',
    category: 'state',
    proficiency: 4,
    companies: ['xdatagroup'],
    connections: ['react'],
    yearsUsed: 2,
    position: { x: 140, y: 320 },
    unlockedYear: 2023,
  },
  {
    id: 'tanstack-query',
    name: 'TanStack Query',
    category: 'state',
    proficiency: 4,
    companies: ['xdatagroup'],
    connections: ['react', 'typescript'],
    yearsUsed: 3,
    position: { x: 300, y: 320 },
    unlockedYear: 2022,
  },
  {
    id: 'context-api',
    name: 'Context API',
    category: 'state',
    proficiency: 5,
    companies: ['360dialog', 'akna', 'xdatagroup'],
    connections: ['react'],
    yearsUsed: 5,
    position: { x: 220, y: 180 },
    unlockedYear: 2018,
  },

  // ============================================
  // STYLING (Left side, below frontend)
  // ============================================
  {
    id: 'tailwind',
    name: 'Tailwind CSS',
    category: 'styling',
    proficiency: 5,
    companies: ['xdatagroup'],
    connections: ['nextjs', 'react'],
    yearsUsed: 4,
    position: { x: 50, y: 260 },
    unlockedYear: 2020,
  },
  {
    id: 'chakra-ui',
    name: 'Chakra UI',
    category: 'styling',
    proficiency: 4,
    companies: ['xdatagroup'],
    connections: ['react'],
    yearsUsed: 3,
    position: { x: 50, y: 340 },
    unlockedYear: 2021,
  },
  {
    id: 'styled-components',
    name: 'Styled Components',
    category: 'styling',
    proficiency: 4,
    companies: ['akna'],
    connections: ['react'],
    yearsUsed: 4,
    position: { x: 50, y: 180 },
    unlockedYear: 2019,
  },
  {
    id: 'shadcn',
    name: 'Shadcn UI',
    category: 'styling',
    proficiency: 4,
    companies: ['xdatagroup'],
    connections: ['tailwind', 'react'],
    yearsUsed: 2,
    position: { x: 120, y: 260 },
    unlockedYear: 2023,
  },

  // ============================================
  // BACKEND (Right side)
  // ============================================
  {
    id: 'nodejs',
    name: 'Node.js',
    category: 'backend',
    proficiency: 4,
    companies: ['bluenet', 'flyerbee', '360dialog'],
    connections: ['typescript', 'graphql', 'postgresql'],
    yearsUsed: 5,
    position: { x: 480, y: 180 },
    unlockedYear: 2016,
  },
  {
    id: 'graphql',
    name: 'GraphQL',
    category: 'backend',
    proficiency: 4,
    companies: ['360dialog'],
    connections: ['nodejs', 'typescript', 'postgresql'],
    yearsUsed: 4,
    position: { x: 550, y: 120 },
    unlockedYear: 2019,
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    category: 'backend',
    proficiency: 3,
    companies: ['360dialog'],
    connections: ['nodejs', 'graphql', 'prisma'],
    yearsUsed: 3,
    position: { x: 560, y: 200 },
    unlockedYear: 2019,
  },
  {
    id: 'prisma',
    name: 'Prisma',
    category: 'backend',
    proficiency: 3,
    companies: ['xdatagroup'],
    connections: ['postgresql', 'typescript', 'nodejs'],
    yearsUsed: 2,
    position: { x: 550, y: 280 },
    unlockedYear: 2023,
  },
  {
    id: 'rest-apis',
    name: 'REST APIs',
    category: 'backend',
    proficiency: 5,
    companies: ['bluenet', 'flyerbee', '360dialog', 'accenture', 'akna', 'xdatagroup'],
    connections: ['nodejs', 'typescript'],
    yearsUsed: 8,
    position: { x: 480, y: 100 },
    unlockedYear: 2016,
  },

  // ============================================
  // TOOLS (Bottom)
  // ============================================
  {
    id: 'git',
    name: 'Git',
    category: 'tools',
    proficiency: 5,
    companies: ['bluenet', 'flyerbee', '360dialog', 'accenture', 'akna', 'xdatagroup'],
    connections: [],
    yearsUsed: 8,
    position: { x: 400, y: 340 },
    unlockedYear: 2016,
  },
  {
    id: 'jest',
    name: 'Jest',
    category: 'tools',
    proficiency: 4,
    companies: ['360dialog', 'accenture'],
    connections: ['react', 'react-native', 'typescript'],
    yearsUsed: 5,
    position: { x: 460, y: 340 },
    unlockedYear: 2018,
  },
  {
    id: 'storybook',
    name: 'Storybook',
    category: 'tools',
    proficiency: 4,
    companies: ['akna', 'xdatagroup'],
    connections: ['react'],
    yearsUsed: 3,
    position: { x: 520, y: 340 },
    unlockedYear: 2021,
  },
  {
    id: 'webpack-vite',
    name: 'Webpack/Vite',
    category: 'tools',
    proficiency: 4,
    companies: ['360dialog', 'akna', 'xdatagroup'],
    connections: ['react', 'typescript'],
    yearsUsed: 5,
    position: { x: 400, y: 260 },
    unlockedYear: 2017,
  },
]

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get a skill node by ID
 */
export function getNodeById(nodeId: string): SkillNode | undefined {
  return SKILL_NODES.find((node) => node.id === nodeId)
}

/**
 * Get all nodes in a category
 */
export function getNodesByCategory(category: SkillTreeCategory): SkillNode[] {
  return SKILL_NODES.filter((node) => node.category === category)
}

/**
 * Get connected nodes for a given node
 */
export function getConnectedNodes(nodeId: string): SkillNode[] {
  const node = getNodeById(nodeId)
  if (!node) return []
  return node.connections
    .map((id) => getNodeById(id))
    .filter((n): n is SkillNode => n !== undefined)
}

/**
 * Get nodes visible at a given year (for timeline mode)
 */
export function getNodesAtYear(year: number): SkillNode[] {
  return SKILL_NODES.filter((node) => node.unlockedYear <= year)
}

/**
 * Get the earliest year in the skill timeline
 */
export function getMinYear(): number {
  return Math.min(...SKILL_NODES.map((n) => n.unlockedYear))
}

/**
 * Get the latest year in the skill timeline
 */
export function getMaxYear(): number {
  return new Date().getFullYear()
}

/**
 * Get unique companies from all nodes
 */
export function getAllCompanies(): string[] {
  const companies = new Set<string>()
  for (const node of SKILL_NODES) {
    for (const company of node.companies) {
      companies.add(company)
    }
  }
  return Array.from(companies)
}

/**
 * Get total years of experience (based on max yearsUsed)
 */
export function getTotalYears(): number {
  return Math.max(...SKILL_NODES.map((n) => n.yearsUsed))
}

/**
 * Get count of expert-level skills (proficiency >= 4)
 */
export function getExpertSkillsCount(): number {
  return SKILL_NODES.filter((n) => n.proficiency >= 4).length
}
