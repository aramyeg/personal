/**
 * Collectibles System
 * Tech-themed collectible items representing skills and technologies
 */

import type { ColorPalette } from './palette'
import { withAlpha } from './palette'

// ============================================
// TYPES
// ============================================

export type CollectibleType =
  | 'react'
  | 'typescript'
  | 'nextjs'
  | 'nodejs'
  | 'graphql'
  | 'aws'
  | 'docker'
  | 'git'
  | 'star'
  | 'coin'

export type Collectible = {
  x: number
  y: number
  type: CollectibleType
  collected: boolean
  animOffset: number // For floating animation
  sparkleTimer: number
}

// ============================================
// ICON PIXEL DATA
// ============================================

/**
 * 8x8 pixel icons for each tech
 * 0 = transparent, 1 = primary, 2 = secondary, 3 = accent, 4 = highlight
 */
const ICON_DATA: Record<CollectibleType, number[][]> = {
  // React atom logo (simplified)
  react: [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [1, 0, 0, 1, 1, 0, 0, 1],
    [1, 0, 1, 4, 4, 1, 0, 1],
    [1, 0, 1, 4, 4, 1, 0, 1],
    [1, 0, 0, 1, 1, 0, 0, 1],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
  ],
  // TypeScript (TS box)
  typescript: [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 4, 4, 2, 4, 2, 1],
    [1, 2, 2, 4, 2, 4, 2, 1],
    [1, 2, 2, 4, 2, 4, 2, 1],
    [1, 2, 2, 4, 2, 4, 4, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // Next.js N
  nextjs: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 4, 4, 0, 0, 4, 4, 0],
    [0, 4, 4, 4, 0, 4, 4, 0],
    [0, 4, 4, 4, 4, 4, 4, 0],
    [0, 4, 4, 0, 4, 4, 4, 0],
    [0, 4, 4, 0, 0, 4, 4, 0],
    [0, 4, 4, 0, 0, 4, 4, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // Node.js hexagon
  nodejs: [
    [0, 0, 3, 3, 3, 3, 0, 0],
    [0, 3, 3, 3, 3, 3, 3, 0],
    [3, 3, 4, 4, 4, 4, 3, 3],
    [3, 3, 4, 3, 3, 4, 3, 3],
    [3, 3, 4, 3, 3, 4, 3, 3],
    [3, 3, 4, 4, 4, 4, 3, 3],
    [0, 3, 3, 3, 3, 3, 3, 0],
    [0, 0, 3, 3, 3, 3, 0, 0],
  ],
  // GraphQL diamond
  graphql: [
    [0, 0, 0, 2, 2, 0, 0, 0],
    [0, 0, 2, 2, 2, 2, 0, 0],
    [0, 2, 2, 4, 4, 2, 2, 0],
    [2, 2, 4, 4, 4, 4, 2, 2],
    [2, 2, 4, 4, 4, 4, 2, 2],
    [0, 2, 2, 4, 4, 2, 2, 0],
    [0, 0, 2, 2, 2, 2, 0, 0],
    [0, 0, 0, 2, 2, 0, 0, 0],
  ],
  // AWS cloud
  aws: [
    [0, 0, 3, 3, 3, 3, 0, 0],
    [0, 3, 3, 3, 3, 3, 3, 0],
    [3, 3, 3, 3, 3, 3, 3, 3],
    [3, 4, 4, 3, 3, 4, 4, 3],
    [3, 4, 4, 3, 3, 4, 4, 3],
    [3, 3, 3, 3, 3, 3, 3, 3],
    [0, 3, 3, 3, 3, 3, 3, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // Docker whale
  docker: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0],
    [0, 1, 4, 4, 4, 4, 4, 1],
    [1, 1, 4, 4, 4, 4, 4, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // Git branch
  git: [
    [0, 0, 2, 2, 0, 0, 0, 0],
    [0, 0, 2, 2, 0, 0, 2, 2],
    [0, 0, 2, 2, 2, 2, 2, 2],
    [0, 0, 2, 2, 2, 2, 0, 0],
    [0, 0, 2, 2, 0, 0, 0, 0],
    [0, 2, 2, 2, 2, 0, 0, 0],
    [0, 2, 2, 0, 2, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // Star (bonus)
  star: [
    [0, 0, 0, 3, 3, 0, 0, 0],
    [0, 0, 0, 3, 3, 0, 0, 0],
    [3, 3, 3, 3, 3, 3, 3, 3],
    [0, 3, 3, 4, 4, 3, 3, 0],
    [0, 0, 3, 4, 4, 3, 0, 0],
    [0, 3, 3, 3, 3, 3, 3, 0],
    [0, 3, 3, 0, 0, 3, 3, 0],
    [3, 3, 0, 0, 0, 0, 3, 3],
  ],
  // Coin
  coin: [
    [0, 0, 3, 3, 3, 3, 0, 0],
    [0, 3, 4, 4, 4, 4, 3, 0],
    [3, 4, 4, 3, 3, 4, 4, 3],
    [3, 4, 3, 4, 4, 3, 4, 3],
    [3, 4, 3, 4, 4, 3, 4, 3],
    [3, 4, 4, 3, 3, 4, 4, 3],
    [0, 3, 4, 4, 4, 4, 3, 0],
    [0, 0, 3, 3, 3, 3, 0, 0],
  ],
}

// Color mappings for each collectible type
const COLLECTIBLE_COLORS: Record<CollectibleType, { primary: string; secondary: string; accent: string; highlight: string }> = {
  react: { primary: '#61dafb', secondary: '#20232a', accent: '#61dafb', highlight: '#ffffff' },
  typescript: { primary: '#3178c6', secondary: '#235a97', accent: '#3178c6', highlight: '#ffffff' },
  nextjs: { primary: '#000000', secondary: '#111111', accent: '#000000', highlight: '#ffffff' },
  nodejs: { primary: '#339933', secondary: '#215721', accent: '#339933', highlight: '#68a063' },
  graphql: { primary: '#e10098', secondary: '#a30070', accent: '#e10098', highlight: '#ff5ec4' },
  aws: { primary: '#ff9900', secondary: '#cc7a00', accent: '#ff9900', highlight: '#ffcc80' },
  docker: { primary: '#2496ed', secondary: '#1a6fb3', accent: '#2496ed', highlight: '#6bb9f5' },
  git: { primary: '#f05032', secondary: '#b33d26', accent: '#f05032', highlight: '#ff8066' },
  star: { primary: '#ffd700', secondary: '#ccac00', accent: '#ffd700', highlight: '#ffeb80' },
  coin: { primary: '#ffd700', secondary: '#ccac00', accent: '#ffd700', highlight: '#ffeb80' },
}

// ============================================
// GENERATION
// ============================================

const TECH_TYPES: CollectibleType[] = ['react', 'typescript', 'nextjs', 'nodejs', 'graphql', 'aws', 'docker', 'git']

/**
 * Creates a collectible at the specified position
 */
export function createCollectible(x: number, y: number, type?: CollectibleType): Collectible {
  return {
    x,
    y,
    type: type || TECH_TYPES[Math.floor(Math.random() * TECH_TYPES.length)],
    collected: false,
    animOffset: Math.random() * Math.PI * 2,
    sparkleTimer: 0,
  }
}

/**
 * Generates collectibles around platforms
 */
export function generateCollectibles(
  platforms: { x: number; y: number; width: number }[],
  maxCount: number = 15
): Collectible[] {
  const collectibles: Collectible[] = []

  platforms.forEach((platform, index) => {
    if (collectibles.length >= maxCount) return
    // Place 1-2 collectibles above each platform
    const itemsAbove = 1 + (index % 2)

    for (let i = 0; i < itemsAbove; i++) {
      const offsetX = (i + 1) * (platform.width / (itemsAbove + 1))
      collectibles.push(
        createCollectible(
          platform.x + offsetX - 4, // Center the 8px icon
          platform.y - 30 - Math.random() * 20,
          TECH_TYPES[(index + i) % TECH_TYPES.length]
        )
      )
    }
  })

  // Add some bonus stars/coins in challenging positions
  const bonusCount = Math.min(5, Math.floor(platforms.length / 2))
  for (let i = 0; i < bonusCount; i++) {
    const platformIndex = Math.floor(Math.random() * platforms.length)
    const platform = platforms[platformIndex]
    collectibles.push(
      createCollectible(
        platform.x + platform.width / 2 - 4,
        platform.y - 50 - Math.random() * 30,
        Math.random() > 0.5 ? 'star' : 'coin'
      )
    )
  }

  return collectibles
}

// ============================================
// RENDERING
// ============================================

/**
 * Renders a single collectible
 */
export function renderCollectible(
  ctx: CanvasRenderingContext2D,
  collectible: Collectible,
  cameraX: number,
  time: number,
  _palette: ColorPalette
): void {
  if (collectible.collected) return

  const screenX = collectible.x - cameraX

  // Skip if off-screen
  if (screenX < -20 || screenX > ctx.canvas.width + 20) return

  // Floating animation
  const floatY = Math.sin(time * 0.004 + collectible.animOffset) * 3
  const y = collectible.y + floatY

  // Get icon data and colors
  const iconData = ICON_DATA[collectible.type]
  const colors = COLLECTIBLE_COLORS[collectible.type]

  // Draw glow effect
  const glowPulse = (Math.sin(time * 0.006 + collectible.animOffset) + 1) / 2
  ctx.fillStyle = withAlpha(colors.primary, 0.2 + glowPulse * 0.2)
  ctx.fillRect(Math.floor(screenX - 2), Math.floor(y - 2), 12, 12)

  // Draw icon pixels
  iconData.forEach((row, rowIndex) => {
    row.forEach((pixel, colIndex) => {
      if (pixel === 0) return

      let color: string
      switch (pixel) {
        case 1:
          color = colors.primary
          break
        case 2:
          color = colors.secondary
          break
        case 3:
          color = colors.accent
          break
        case 4:
          color = colors.highlight
          break
        default:
          color = colors.primary
      }

      ctx.fillStyle = color
      ctx.fillRect(Math.floor(screenX + colIndex), Math.floor(y + rowIndex), 1, 1)
    })
  })

  // Draw sparkles
  if (Math.sin(time * 0.01 + collectible.animOffset) > 0.8) {
    const sparkleX = screenX + 6 + Math.sin(time * 0.02) * 3
    const sparkleY = y - 2 + Math.cos(time * 0.02) * 3
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(Math.floor(sparkleX), Math.floor(sparkleY), 1, 1)
    ctx.fillRect(Math.floor(sparkleX - 1), Math.floor(sparkleY), 1, 1)
    ctx.fillRect(Math.floor(sparkleX + 1), Math.floor(sparkleY), 1, 1)
    ctx.fillRect(Math.floor(sparkleX), Math.floor(sparkleY - 1), 1, 1)
    ctx.fillRect(Math.floor(sparkleX), Math.floor(sparkleY + 1), 1, 1)
  }
}

/**
 * Renders all collectibles
 */
export function renderCollectibles(
  ctx: CanvasRenderingContext2D,
  collectibles: Collectible[],
  cameraX: number,
  time: number,
  palette: ColorPalette
): void {
  collectibles.forEach((collectible) => {
    renderCollectible(ctx, collectible, cameraX, time, palette)
  })
}

/**
 * Checks collision between player and collectibles
 */
export function checkCollectibleCollision(
  playerX: number,
  playerY: number,
  playerWidth: number,
  playerHeight: number,
  collectibles: Collectible[]
): { collectibles: Collectible[]; collected: Collectible[] } {
  const collected: Collectible[] = []
  const updated = collectibles.map((collectible) => {
    if (collectible.collected) return collectible

    // Simple AABB collision
    const iconSize = 8
    const collides =
      playerX < collectible.x + iconSize &&
      playerX + playerWidth > collectible.x &&
      playerY < collectible.y + iconSize &&
      playerY + playerHeight > collectible.y

    if (collides) {
      collected.push(collectible)
      return { ...collectible, collected: true }
    }

    return collectible
  })

  return { collectibles: updated, collected }
}

/**
 * Renders collection animation effect
 */
export function renderCollectionEffect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  startTime: number,
  type: CollectibleType,
  palette: ColorPalette
): boolean {
  const elapsed = time - startTime
  const duration = 500 // ms

  if (elapsed > duration) return false

  const progress = elapsed / duration
  const colors = COLLECTIBLE_COLORS[type]

  // Expanding ring
  const ringRadius = 4 + progress * 20
  const ringAlpha = 1 - progress

  ctx.strokeStyle = withAlpha(colors.primary, ringAlpha)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x + 4, y + 4, ringRadius, 0, Math.PI * 2)
  ctx.stroke()

  // Rising particles
  const particleCount = 6
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2
    const distance = progress * 15
    const px = x + 4 + Math.cos(angle) * distance
    const py = y + 4 + Math.sin(angle) * distance - progress * 10

    ctx.fillStyle = withAlpha(colors.highlight, 1 - progress)
    ctx.fillRect(Math.floor(px), Math.floor(py), 2, 2)
  }

  // Score popup (simplified)
  const scoreY = y - progress * 20
  ctx.fillStyle = withAlpha(palette.ui.text, 1 - progress)
  ctx.fillRect(Math.floor(x + 2), Math.floor(scoreY), 4, 4)

  return true
}

/**
 * Gets display name for collectible type
 */
export function getCollectibleName(type: CollectibleType): string {
  const names: Record<CollectibleType, string> = {
    react: 'React',
    typescript: 'TypeScript',
    nextjs: 'Next.js',
    nodejs: 'Node.js',
    graphql: 'GraphQL',
    aws: 'AWS',
    docker: 'Docker',
    git: 'Git',
    star: 'Bonus Star',
    coin: 'Coin',
  }
  return names[type]
}

/**
 * Calculates score value for collectible
 */
export function getCollectibleValue(type: CollectibleType): number {
  const values: Record<CollectibleType, number> = {
    react: 100,
    typescript: 100,
    nextjs: 100,
    nodejs: 100,
    graphql: 100,
    aws: 100,
    docker: 100,
    git: 100,
    star: 500,
    coin: 50,
  }
  return values[type]
}
