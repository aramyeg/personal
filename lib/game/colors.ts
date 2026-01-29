/**
 * Theme-aware color utilities for canvas rendering
 * Converts CSS variables (OKLCH) to canvas-compatible colors
 */

import type { GameColors } from './types'

/**
 * Default colors for light mode
 */
const LIGHT_COLORS: GameColors = {
  background: '#faf8f5',
  backgroundAlt: '#e8e4df',
  ground: '#8b5a3a',
  groundHighlight: '#a67c52',
  platformDefault: '#c9856a',
  platformHighlight: '#d9a08a',
  platformReached: '#22c55e',
  platformReachedHighlight: '#4ade80',
  text: '#2d2d2d',
  textMuted: '#6b6b6b',
}

/**
 * Default colors for dark mode
 */
const DARK_COLORS: GameColors = {
  background: '#1a1816',
  backgroundAlt: '#2a2725',
  ground: '#6b5d52',
  groundHighlight: '#8b7355',
  platformDefault: '#c96d4f',
  platformHighlight: '#d98a6f',
  platformReached: '#22c55e',
  platformReachedHighlight: '#4ade80',
  text: '#f5f5f0',
  textMuted: '#a0a0a0',
}

/**
 * Gets game colors based on current theme
 * @param isDark - Whether dark mode is active
 * @returns GameColors object with theme-appropriate colors
 */
export function getGameColors(isDark: boolean): GameColors {
  return isDark ? { ...DARK_COLORS } : { ...LIGHT_COLORS }
}

/**
 * Adjusts hex color brightness
 * @param color - Hex color string (#RRGGBB)
 * @param amount - Amount to adjust (-255 to 255)
 * @returns Adjusted hex color string
 */
export function adjustBrightness(color: string, amount: number): string {
  if (!color.startsWith('#')) return color

  const hex = color.slice(1)
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount))

  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Creates a color with alpha transparency
 * @param color - Hex color string (#RRGGBB)
 * @param alpha - Alpha value (0-1)
 * @returns RGBA color string
 */
export function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#')) return color

  const hex = color.slice(1)
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Checks if dark mode is currently active
 * @returns boolean indicating dark mode status
 */
export function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}
