/**
 * Tech-Themed Platform System
 * Creates visually appealing platforms with tech aesthetics
 */

import type { Platform, PlatformStyle } from './types'
import type { ColorPalette } from './palette'
import { withAlpha } from './palette'
import type { Experience } from '@/types'

// ============================================
// ROLE MAPPINGS
// ============================================

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
 * Maps role to platform style
 */
function getRolePlatformStyle(role: string): PlatformStyle {
  const lowerRole = role.toLowerCase()

  if (lowerRole.includes('lead')) return 'terminal'
  if (lowerRole.includes('mobile') || lowerRole.includes('react native')) return 'mobile_device'
  if (lowerRole.includes('frontend')) return 'code_block'
  if (lowerRole.includes('backend') || lowerRole.includes('server')) return 'server_rack'
  if (lowerRole.includes('cloud') || lowerRole.includes('devops')) return 'cloud'

  return 'tech_block'
}

// ============================================
// CIRCUIT BOARD PATTERNS
// ============================================

/**
 * Seeded random number generator for deterministic patterns
 */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/**
 * Generates circuit traces for a platform
 */
function generateCircuitTraces(
  width: number,
  height: number,
  seed: number
): { startX: number; startY: number; endX: number; endY: number }[] {
  const random = seededRandom(seed)
  const traces: { startX: number; startY: number; endX: number; endY: number }[] = []
  const traceCount = Math.floor(width / 15) + 2

  for (let i = 0; i < traceCount; i++) {
    const startX = Math.floor(random() * width)
    const startY = Math.floor(random() * height)

    if (random() > 0.5) {
      const endX = Math.min(width - 2, startX + 10 + Math.floor(random() * 20))
      traces.push({ startX, startY, endX, endY: startY })
    } else {
      const endY = Math.min(height - 2, startY + 5 + Math.floor(random() * 10))
      traces.push({ startX, startY, endX: startX, endY })
    }
  }

  return traces
}

/**
 * Generates circuit nodes (connection points)
 */
function generateCircuitNodes(
  width: number,
  height: number,
  seed: number
): { x: number; y: number; size: number }[] {
  const random = seededRandom(seed + 1000)
  const nodes: { x: number; y: number; size: number }[] = []
  const nodeCount = Math.floor(width / 20) + 2

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      x: 4 + Math.floor(random() * (width - 8)),
      y: 4 + Math.floor(random() * (height - 8)),
      size: random() > 0.7 ? 3 : 2,
    })
  }

  return nodes
}

// ============================================
// CODE SNIPPETS
// ============================================

const CODE_SNIPPETS = [
  ['const app = {', '  name: "career",', '  status: "growing"', '}'],
  ['function grow() {', '  skills++;', '  experience++;', '}'],
  ['export default', '  Journey;'],
  ['import { success }', '  from "work";'],
  ['await career', '  .level_up();'],
  ['if (passionate) {', '  build();', '}'],
]

function getCodeSnippet(seed: number): string[] {
  return CODE_SNIPPETS[seed % CODE_SNIPPETS.length]
}

// ============================================
// PLATFORM FACTORY
// ============================================

/**
 * Creates a platform with the specified configuration
 */
export function createPlatform(config: {
  x: number
  y: number
  width: number
  height?: number
  style?: PlatformStyle
  label: string
  subLabel?: string
  year: string
  company: string
  icon?: string
  experienceId: string
  technologies: string[]
}): Platform {
  const style = config.style || 'tech_block'
  const circuitSeed = Math.floor(Math.random() * 10000)
  const height = config.height || 28

  return {
    x: config.x,
    y: config.y,
    width: config.width,
    height,
    style,
    label: config.label,
    subLabel: config.subLabel,
    year: config.year,
    company: config.company,
    icon: config.icon || '💼',
    reached: false,
    glowIntensity: 0,
    experienceId: config.experienceId,
    technologies: config.technologies,
    circuitSeed,
    codeLines: style === 'code_block' ? getCodeSnippet(circuitSeed) : undefined,
    serverLights:
      style === 'server_rack'
        ? Array.from({ length: 6 }, () => Math.random() > 0.3)
        : undefined,
  }
}

/**
 * Generates platforms from experience data
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
    const progressHeight = (index / Math.max(selected.length - 1, 1)) * heightVariation * 2
    const variation = index % 2 === 0 ? 15 : 0
    const style = getRolePlatformStyle(exp.role)

    return createPlatform({
      x: 20 + index * spacing,
      y: baseY - progressHeight - variation,
      width: platformWidth,
      height: 28,
      style,
      label: getShortRole(exp.role),
      subLabel: exp.period,
      year,
      company: exp.company,
      icon: getRoleIcon(exp.role),
      experienceId: exp.id,
      technologies: exp.technologies || [],
    })
  })
}

// ============================================
// PLATFORM RENDERING
// ============================================

/**
 * Renders a single platform based on its style
 */
export function renderPlatform(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  cameraX: number,
  time: number,
  palette: ColorPalette
): void {
  const screenX = platform.x - cameraX

  // Skip if off-screen
  if (screenX + platform.width < -50 || screenX > ctx.canvas.width + 50) {
    return
  }

  // Render glow effect when reached
  if (platform.reached && platform.glowIntensity > 0) {
    renderPlatformGlow(ctx, screenX, platform.y, platform.width, platform.height, platform.glowIntensity, palette)
  }

  // Render based on style
  switch (platform.style) {
    case 'tech_block':
      renderTechBlock(ctx, screenX, platform.y, platform.width, platform.height, platform, time, palette)
      break
    case 'code_block':
      renderCodeBlock(ctx, screenX, platform.y, platform.width, platform.height, platform, time, palette)
      break
    case 'server_rack':
      renderServerRack(ctx, screenX, platform.y, platform.width, platform.height, platform, time, palette)
      break
    case 'mobile_device':
      renderMobileDevice(ctx, screenX, platform.y, platform.width, platform.height, platform, time, palette)
      break
    case 'cloud':
      renderCloudPlatform(ctx, screenX, platform.y, platform.width, platform.height, platform, time, palette)
      break
    case 'terminal':
      renderTerminal(ctx, screenX, platform.y, platform.width, platform.height, platform, time, palette)
      break
  }

  // Render label
  renderPlatformLabel(ctx, screenX, platform.y, platform.width, platform, palette)
}

/**
 * Renders platform glow effect
 */
function renderPlatformGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  intensity: number,
  palette: ColorPalette
): void {
  const glowSize = 4 + intensity * 4

  ctx.fillStyle = withAlpha(palette.tech.success, intensity * 0.3)
  ctx.fillRect(
    Math.floor(x - glowSize),
    Math.floor(y - glowSize),
    width + glowSize * 2,
    height + glowSize * 2
  )

  ctx.fillStyle = withAlpha(palette.tech.success, intensity * 0.5)
  ctx.fillRect(
    Math.floor(x - glowSize / 2),
    Math.floor(y - glowSize / 2),
    width + glowSize,
    height + glowSize
  )
}

/**
 * Renders tech block platform (circuit board style)
 */
function renderTechBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  platform: Platform,
  time: number,
  palette: ColorPalette
): void {
  const seed = platform.circuitSeed || 0

  // Base
  ctx.fillStyle = palette.ground.surface
  ctx.fillRect(Math.floor(x), Math.floor(y), width, height)

  // Top highlight
  ctx.fillStyle = palette.ground.highlight
  ctx.fillRect(Math.floor(x), Math.floor(y), width, 3)

  // Circuit traces
  const traces = generateCircuitTraces(width, height, seed)
  ctx.fillStyle = withAlpha(palette.tech.primary, 0.4)
  traces.forEach((trace) => {
    if (trace.startY === trace.endY) {
      ctx.fillRect(Math.floor(x + trace.startX), Math.floor(y + trace.startY), trace.endX - trace.startX, 1)
    } else {
      ctx.fillRect(Math.floor(x + trace.startX), Math.floor(y + trace.startY), 1, trace.endY - trace.startY)
    }
  })

  // Circuit nodes
  const nodes = generateCircuitNodes(width, height, seed)
  nodes.forEach((node, i) => {
    const pulse = Math.sin(time * 0.003 + i * 0.5) > 0.5
    ctx.fillStyle = pulse ? palette.tech.primary : withAlpha(palette.tech.primary, 0.5)
    ctx.fillRect(Math.floor(x + node.x), Math.floor(y + node.y), node.size, node.size)
  })

  // Border
  ctx.fillStyle = withAlpha(palette.tech.primary, 0.3)
  ctx.fillRect(Math.floor(x), Math.floor(y), width, 1)
  ctx.fillRect(Math.floor(x), Math.floor(y + height - 1), width, 1)
  ctx.fillRect(Math.floor(x), Math.floor(y), 1, height)
  ctx.fillRect(Math.floor(x + width - 1), Math.floor(y), 1, height)
}

/**
 * Renders code block platform (syntax highlighted)
 */
function renderCodeBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  platform: Platform,
  time: number,
  palette: ColorPalette
): void {
  // Dark background (like IDE)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(Math.floor(x), Math.floor(y), width, height)

  // Top bar (like editor tabs)
  ctx.fillStyle = '#2d2d44'
  ctx.fillRect(Math.floor(x), Math.floor(y), width, 6)

  // Window buttons
  ctx.fillStyle = '#ff5f56'
  ctx.fillRect(Math.floor(x + 4), Math.floor(y + 2), 3, 3)
  ctx.fillStyle = '#ffbd2e'
  ctx.fillRect(Math.floor(x + 9), Math.floor(y + 2), 3, 3)
  ctx.fillStyle = '#27ca40'
  ctx.fillRect(Math.floor(x + 14), Math.floor(y + 2), 3, 3)

  // Code lines
  if (platform.codeLines) {
    const lineHeight = 5
    const startY = y + 9
    const colors = [palette.tech.secondary, palette.tech.tertiary, palette.tech.primary, '#ffffff']

    platform.codeLines.forEach((line, i) => {
      if (startY + i * lineHeight < y + height - 2) {
        const isCursorLine = Math.floor(time / 500) % platform.codeLines!.length === i
        const lineColor = colors[i % colors.length]

        const indent = line.startsWith('  ') ? 6 : 0
        const lineWidth = Math.min(line.length * 2, width - 8 - indent)

        ctx.fillStyle = withAlpha(lineColor, 0.8)
        ctx.fillRect(
          Math.floor(x + 4 + indent),
          Math.floor(startY + i * lineHeight),
          lineWidth,
          3
        )

        // Cursor
        if (isCursorLine && Math.floor(time / 250) % 2 === 0) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(
            Math.floor(x + 4 + indent + lineWidth + 2),
            Math.floor(startY + i * lineHeight),
            2,
            4
          )
        }
      }
    })
  }

  // Border
  ctx.fillStyle = withAlpha(palette.tech.primary, 0.5)
  ctx.fillRect(Math.floor(x), Math.floor(y), width, 1)
  ctx.fillRect(Math.floor(x), Math.floor(y + height - 1), width, 1)
}

/**
 * Renders server rack platform
 */
function renderServerRack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  platform: Platform,
  time: number,
  palette: ColorPalette
): void {
  // Rack body
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(Math.floor(x), Math.floor(y), width, height)

  // Top edge
  ctx.fillStyle = '#4a4a5a'
  ctx.fillRect(Math.floor(x), Math.floor(y), width, 2)

  // Server units
  const unitHeight = 6
  const units = Math.floor((height - 4) / unitHeight)
  const unitWidth = width - 8

  for (let i = 0; i < units; i++) {
    const unitY = y + 4 + i * unitHeight

    // Unit face
    ctx.fillStyle = '#1a1a2a'
    ctx.fillRect(Math.floor(x + 4), Math.floor(unitY), unitWidth, unitHeight - 2)

    // Vent holes
    for (let v = 0; v < 3; v++) {
      ctx.fillStyle = '#0a0a1a'
      ctx.fillRect(Math.floor(x + 6 + v * 4), Math.floor(unitY + 1), 2, unitHeight - 4)
    }

    // Status lights
    if (platform.serverLights && platform.serverLights[i]) {
      const blink = Math.sin(time * 0.01 + i) > 0
      ctx.fillStyle = blink ? palette.tech.success : withAlpha(palette.tech.success, 0.3)
    } else {
      ctx.fillStyle = withAlpha(palette.tech.secondary, 0.3)
    }
    ctx.fillRect(Math.floor(x + unitWidth - 2), Math.floor(unitY + 1), 3, 2)

    // Activity light
    if (Math.sin(time * 0.02 + i * 2) > 0.7) {
      ctx.fillStyle = palette.tech.tertiary
      ctx.fillRect(Math.floor(x + unitWidth - 6), Math.floor(unitY + 1), 2, 2)
    }
  }

  // Rack frame edges
  ctx.fillStyle = '#5a5a6a'
  ctx.fillRect(Math.floor(x), Math.floor(y), 3, height)
  ctx.fillRect(Math.floor(x + width - 3), Math.floor(y), 3, height)
}

/**
 * Renders mobile device platform
 */
function renderMobileDevice(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  platform: Platform,
  time: number,
  palette: ColorPalette
): void {
  // Device body
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(Math.floor(x + 2), Math.floor(y), width - 4, height)
  ctx.fillRect(Math.floor(x), Math.floor(y + 2), width, height - 4)

  // Screen
  const screenPadding = 4
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(
    Math.floor(x + screenPadding),
    Math.floor(y + screenPadding),
    width - screenPadding * 2,
    height - screenPadding * 2 - 4
  )

  // App icons
  const iconSize = 4
  const iconSpacing = 6
  const iconsPerRow = Math.floor((width - screenPadding * 2 - 4) / iconSpacing)
  const iconColors = [palette.tech.primary, palette.tech.secondary, palette.tech.tertiary, palette.tech.success]

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < Math.min(iconsPerRow, 4); col++) {
      const iconX = x + screenPadding + 3 + col * iconSpacing
      const iconY = y + screenPadding + 3 + row * iconSpacing

      ctx.fillStyle = iconColors[(row * iconsPerRow + col) % iconColors.length]
      ctx.fillRect(Math.floor(iconX), Math.floor(iconY), iconSize, iconSize)
    }
  }

  // Status bar
  ctx.fillStyle = withAlpha('#ffffff', 0.3)
  ctx.fillRect(
    Math.floor(x + screenPadding),
    Math.floor(y + screenPadding),
    width - screenPadding * 2,
    2
  )

  // Home indicator
  ctx.fillStyle = '#4a4a5a'
  ctx.fillRect(
    Math.floor(x + width / 2 - 8),
    Math.floor(y + height - 3),
    16,
    2
  )

  // Notification pulse
  if (Math.sin(time * 0.005) > 0.8) {
    ctx.fillStyle = withAlpha(palette.tech.primary, 0.6)
    ctx.fillRect(
      Math.floor(x + width - screenPadding - 6),
      Math.floor(y + screenPadding + 1),
      4,
      4
    )
  }
}

/**
 * Renders cloud platform
 */
function renderCloudPlatform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  platform: Platform,
  time: number,
  palette: ColorPalette
): void {
  const floatOffset = Math.sin(time * 0.002) * 2
  const cloudY = y + floatOffset
  const shadowColor = withAlpha(palette.clouds.shadow, 0.5)

  // Shadow
  ctx.fillStyle = shadowColor
  drawPixelCloud(ctx, x + 2, cloudY + 3, width, height)

  // Main cloud
  ctx.fillStyle = withAlpha(palette.clouds.light, 0.9)
  drawPixelCloud(ctx, x, cloudY, width, height)

  // Top surface highlight
  ctx.fillStyle = withAlpha('#ffffff', 0.3)
  ctx.fillRect(Math.floor(x + width * 0.2), Math.floor(cloudY + 2), Math.floor(width * 0.6), 3)

  // Data points
  const dataPoints = 4
  for (let i = 0; i < dataPoints; i++) {
    const pointX = x + width * 0.2 + (width * 0.6 * i) / dataPoints
    const pointY = cloudY - 5 + Math.sin(time * 0.003 + i) * 3
    const pointAlpha = (Math.sin(time * 0.004 + i * 0.5) + 1) / 2

    ctx.fillStyle = withAlpha(palette.tech.primary, pointAlpha * 0.8)
    ctx.fillRect(Math.floor(pointX), Math.floor(pointY), 2, 2)

    // Connection line
    ctx.fillStyle = withAlpha(palette.tech.primary, pointAlpha * 0.3)
    for (let ly = pointY + 2; ly < cloudY; ly += 2) {
      ctx.fillRect(Math.floor(pointX), Math.floor(ly), 1, 1)
    }
  }
}

/**
 * Renders terminal platform
 */
function renderTerminal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  platform: Platform,
  time: number,
  palette: ColorPalette
): void {
  // Background
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(Math.floor(x), Math.floor(y), width, height)

  // Border
  ctx.fillStyle = withAlpha(palette.tech.success, 0.5)
  ctx.fillRect(Math.floor(x), Math.floor(y), width, 2)
  ctx.fillRect(Math.floor(x), Math.floor(y + height - 2), width, 2)
  ctx.fillRect(Math.floor(x), Math.floor(y), 2, height)
  ctx.fillRect(Math.floor(x + width - 2), Math.floor(y), 2, height)

  // Prompt
  const promptY = y + 6
  ctx.fillStyle = palette.tech.success
  ctx.fillRect(Math.floor(x + 4), Math.floor(promptY), 4, 3)
  ctx.fillRect(Math.floor(x + 10), Math.floor(promptY), 2, 3)

  // Command text
  const commandLength = Math.floor((time / 100) % 15)
  ctx.fillStyle = withAlpha('#ffffff', 0.8)
  ctx.fillRect(Math.floor(x + 14), Math.floor(promptY), Math.min(commandLength * 3, width - 24), 3)

  // Cursor
  if (Math.floor(time / 300) % 2 === 0) {
    ctx.fillStyle = palette.tech.success
    ctx.fillRect(Math.floor(x + 14 + Math.min(commandLength * 3, width - 24) + 2), Math.floor(promptY), 3, 4)
  }

  // Scanlines
  for (let sy = y + 4; sy < y + height - 4; sy += 4) {
    ctx.fillStyle = withAlpha('#000000', 0.1)
    ctx.fillRect(Math.floor(x + 2), Math.floor(sy), width - 4, 1)
  }
}

/**
 * Draws a pixel art cloud shape
 */
function drawPixelCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const centerY = y + height / 2

  ctx.fillRect(Math.floor(x + width * 0.15), Math.floor(centerY - height * 0.3), Math.floor(width * 0.7), Math.floor(height * 0.6))
  ctx.fillRect(Math.floor(x), Math.floor(centerY - height * 0.15), Math.floor(width * 0.35), Math.floor(height * 0.45))
  ctx.fillRect(Math.floor(x + width * 0.65), Math.floor(centerY - height * 0.2), Math.floor(width * 0.35), Math.floor(height * 0.5))
  ctx.fillRect(Math.floor(x + width * 0.25), Math.floor(centerY - height * 0.45), Math.floor(width * 0.3), Math.floor(height * 0.35))
  ctx.fillRect(Math.floor(x + width * 0.45), Math.floor(centerY - height * 0.4), Math.floor(width * 0.25), Math.floor(height * 0.3))
}

/**
 * Renders platform label
 */
function renderPlatformLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  platform: Platform,
  palette: ColorPalette
): void {
  const label = platform.company
  const labelWidth = Math.min(label.length * 5 + 8, width)
  const labelX = x + (width - labelWidth) / 2
  const labelY = y - 14

  // Background
  ctx.fillStyle = withAlpha(palette.ui.background, 0.85)
  ctx.fillRect(Math.floor(labelX), Math.floor(labelY), labelWidth, 12)

  // Border
  ctx.fillStyle = withAlpha(palette.tech.primary, 0.5)
  ctx.fillRect(Math.floor(labelX), Math.floor(labelY), labelWidth, 1)
  ctx.fillRect(Math.floor(labelX), Math.floor(labelY + 11), labelWidth, 1)

  // Text representation
  ctx.fillStyle = palette.ui.text
  const textWidth = Math.min(label.length * 4, labelWidth - 4)
  ctx.fillRect(
    Math.floor(labelX + (labelWidth - textWidth) / 2),
    Math.floor(labelY + 4),
    textWidth,
    4
  )

  // Year badge
  ctx.fillStyle = withAlpha(palette.tech.secondary, 0.7)
  const yearWidth = 20
  ctx.fillRect(Math.floor(x + width - yearWidth - 2), Math.floor(y + 2), yearWidth, 8)

  ctx.fillStyle = palette.ui.text
  ctx.fillRect(Math.floor(x + width - yearWidth), Math.floor(y + 4), yearWidth - 4, 4)
}

/**
 * Updates platform state (glow animation)
 */
export function updatePlatform(platform: Platform, _deltaTime: number): Platform {
  if (platform.reached) {
    const targetGlow = 0.6 + Math.sin(Date.now() * 0.003) * 0.4
    const newGlow = platform.glowIntensity + (targetGlow - platform.glowIntensity) * 0.1

    return {
      ...platform,
      glowIntensity: newGlow,
    }
  }

  return platform
}

/**
 * Renders all platforms
 */
export function renderPlatforms(
  ctx: CanvasRenderingContext2D,
  platforms: Platform[],
  cameraX: number,
  time: number,
  palette: ColorPalette
): void {
  platforms.forEach((platform) => {
    renderPlatform(ctx, platform, cameraX, time, palette)
  })
}
