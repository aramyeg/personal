/**
 * Bento Grid Configuration for Experience Section
 * Presentation-layer only - keeps Experience data clean
 */

import type { Experience } from '@/types'

export type GridSize = 'small' | 'medium' | 'large'

export type BentoGridConfig = {
  gridSize: GridSize
  accentColor: string
  featured?: boolean
}

// Accents stay inside the site's warm terracotta system:
// featured roles carry the primary hue, the rest a warm neutral.
const TERRACOTTA = '#b0563d'
const WARM_NEUTRAL = '#a08c7a'

// Grid configuration per experience ID
const gridConfig: Record<string, BentoGridConfig> = {
  xdatagroup: {
    gridSize: 'large',
    accentColor: TERRACOTTA,
    featured: true,
  },
  akna: {
    gridSize: 'medium',
    accentColor: WARM_NEUTRAL,
  },
  accenture: {
    gridSize: 'medium',
    accentColor: WARM_NEUTRAL,
  },
  '360dialog': {
    gridSize: 'large',
    accentColor: TERRACOTTA,
  },
  flyerbee: {
    gridSize: 'small',
    accentColor: WARM_NEUTRAL,
  },
  bluenet: {
    gridSize: 'small',
    accentColor: WARM_NEUTRAL,
  },
}

// Default config for unknown experiences
const defaultConfig: BentoGridConfig = {
  gridSize: 'small',
  accentColor: WARM_NEUTRAL,
}

/**
 * Get grid configuration for an experience
 */
export function getGridConfig(experienceId: string): BentoGridConfig {
  return gridConfig[experienceId] ?? defaultConfig
}

/**
 * Get experience with grid config combined
 */
export function getExperienceWithConfig(experience: Experience) {
  const config = getGridConfig(experience.id)
  return { experience, config }
}

/**
 * Get CSS grid classes based on size
 * Desktop: 4 columns, Tablet: 2 columns, Mobile: 1 column
 */
export function getGridSpanClasses(size: GridSize): string {
  switch (size) {
    case 'large':
      return 'md:col-span-2 lg:col-span-2'
    case 'medium':
      return 'md:col-span-1 lg:col-span-1'
    case 'small':
    default:
      return 'md:col-span-1 lg:col-span-1'
  }
}

/**
 * Get minimum height based on size
 */
export function getMinHeightClass(size: GridSize): string {
  switch (size) {
    case 'large':
      return 'min-h-[280px]'
    case 'medium':
      return 'min-h-[240px]'
    case 'small':
    default:
      return 'min-h-[200px]'
  }
}
