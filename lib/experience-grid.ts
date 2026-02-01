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

// Grid configuration per experience ID
const gridConfig: Record<string, BentoGridConfig> = {
  xdatagroup: {
    gridSize: 'large',
    accentColor: '#3B82F6', // Blue - banking/fintech
    featured: true,
  },
  akna: {
    gridSize: 'medium',
    accentColor: '#8B5CF6', // Purple - e-commerce
  },
  accenture: {
    gridSize: 'medium',
    accentColor: '#A855F7', // Purple - enterprise
  },
  '360dialog': {
    gridSize: 'large',
    accentColor: '#22C55E', // WhatsApp green
  },
  flyerbee: {
    gridSize: 'small',
    accentColor: '#F59E0B', // Amber - logistics
  },
  bluenet: {
    gridSize: 'small',
    accentColor: '#06B6D4', // Cyan - hotel/hospitality
  },
}

// Default config for unknown experiences
const defaultConfig: BentoGridConfig = {
  gridSize: 'small',
  accentColor: '#64748B',
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
