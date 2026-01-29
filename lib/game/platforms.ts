/**
 * Platform Generation from Experience Data
 * Maps career milestones to game platforms
 */

import type { Platform } from './types'
import type { Experience } from '@/types'

// Role icons mapped to common titles
const ROLE_ICONS: Record<string, string> = {
  'technical lead': '🚀',
  'senior frontend engineer': '⚡',
  'senior react native': '📱',
  'react native': '📲',
  'frontend developer': '💻',
  'frontend web': '🌐',
  'mobile developer': '📱',
}

/**
 * Gets an emoji icon based on role title
 * @param role - Full role title
 * @returns Emoji icon string
 */
export function getRoleIcon(role: string): string {
  const lowerRole = role.toLowerCase()

  for (const [key, icon] of Object.entries(ROLE_ICONS)) {
    if (lowerRole.includes(key)) {
      return icon
    }
  }

  return '💼'
}

/**
 * Shortens role title for display on platforms
 * @param role - Full role title
 * @returns Shortened role string
 */
export function getShortRole(role: string): string {
  const lowerRole = role.toLowerCase()

  if (lowerRole.includes('technical lead')) return 'Tech Lead'
  if (lowerRole.includes('senior frontend engineer')) return 'Sr. Frontend'
  if (lowerRole.includes('senior react native')) return 'Sr. Mobile'
  if (lowerRole.includes('react native')) return 'Mobile Dev'
  if (lowerRole.includes('frontend web')) return 'Frontend'
  if (lowerRole.includes('frontend developer')) return 'Frontend'

  // Fallback: take first two words
  return role.split(' ').slice(0, 2).join(' ')
}

/**
 * Generates platforms from experience data
 * @param experiences - Array of Experience entries
 * @param canvasWidth - Width of game canvas
 * @param canvasHeight - Height of game canvas
 * @returns Array of Platform objects positioned across the canvas
 */
export function generatePlatforms(
  experiences: Experience[],
  canvasWidth: number,
  canvasHeight: number
): Platform[] {
  // Sort by start date (oldest first for left-to-right progression)
  const sorted = [...experiences].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  )

  // Limit to most recent 5 for playable game length
  const selected = sorted.slice(-5)

  const platformWidth = 110
  const spacing = (canvasWidth - platformWidth - 40) / Math.max(selected.length - 1, 1)
  const baseY = canvasHeight - 60
  const heightVariation = 25

  return selected.map((exp, index): Platform => {
    const year = exp.startDate.split('-')[0]
    // Create ascending platform heights with some variation
    const progressHeight = (index / Math.max(selected.length - 1, 1)) * heightVariation * 2
    const variation = index % 2 === 0 ? 15 : 0

    return {
      x: 20 + index * spacing,
      y: baseY - progressHeight - variation,
      width: platformWidth,
      label: getShortRole(exp.role),
      year,
      company: exp.company,
      icon: getRoleIcon(exp.role),
      reached: false,
    }
  })
}
