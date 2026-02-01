/**
 * Animation utilities for the Skill Tree
 * Provides pulsing glow, color interpolation, and timing functions
 */

// ============================================
// GLOW CONFIGURATION
// ============================================

export const GLOW_CONFIG = {
  minBlur: 8,
  maxBlur: 25,
  pulseSpeed: 0.002, // Slow, breathing effect
  opacity: 0.6,
} as const

// ============================================
// PARTICLE CONFIGURATION
// ============================================

export const PARTICLE_CONFIG = {
  ambient: { count: 20, decay: 0.008, sizeRange: [1, 3] as const, speed: 0.3 },
  hover: { count: 6, decay: 0.03, sizeRange: [2, 4] as const, speed: 1.2 },
  select: { count: 15, decay: 0.02, sizeRange: [3, 6] as const, speed: 2 },
  timelineUnlock: { count: 25, decay: 0.015, sizeRange: [2, 5] as const, speed: 1.5 },
} as const

// ============================================
// PARALLAX CONFIGURATION
// ============================================

export const PARALLAX_LAYERS = [
  { speed: 0.03, density: 30, sizeRange: [1, 2] as const, color: '#1a1a2e', opacity: 0.4 },
  { speed: 0.08, density: 20, sizeRange: [2, 4] as const, color: '#16213e', opacity: 0.5 },
  { speed: 0.15, density: 12, sizeRange: [3, 5] as const, color: '#0f3460', opacity: 0.6 },
] as const

// ============================================
// ANIMATION UTILITIES
// ============================================

/**
 * Calculate pulsing glow intensity based on timestamp
 * Returns a value between 0 and 1
 */
export function getGlowIntensity(timestamp: number, offset = 0): number {
  const phase = (timestamp * GLOW_CONFIG.pulseSpeed + offset) % (Math.PI * 2)
  return (Math.sin(phase) + 1) / 2
}

/**
 * Calculate blur amount for glow effect
 */
export function getGlowBlur(timestamp: number, offset = 0): number {
  const intensity = getGlowIntensity(timestamp, offset)
  return GLOW_CONFIG.minBlur + intensity * (GLOW_CONFIG.maxBlur - GLOW_CONFIG.minBlur)
}

/**
 * Generate a deterministic phase offset from a string ID
 * This ensures each node pulses at a different rate
 */
export function getPhaseOffset(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash = hash & hash
  }
  return (Math.abs(hash) % 1000) / 1000 * Math.PI * 2
}

/**
 * Parse hex color to RGB components
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')
}

/**
 * Interpolate between two colors
 * @param color1 Start color (hex)
 * @param color2 End color (hex)
 * @param t Interpolation factor (0-1)
 */
export function interpolateColor(color1: string, color2: string, t: number): string {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)
  if (!rgb1 || !rgb2) return color1

  const r = rgb1.r + (rgb2.r - rgb1.r) * t
  const g = rgb1.g + (rgb2.g - rgb1.g) * t
  const b = rgb1.b + (rgb2.b - rgb1.b) * t

  return rgbToHex(r, g, b)
}

/**
 * Ease out cubic function for smooth deceleration
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Ease in out cubic for smooth acceleration and deceleration
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ============================================
// PARTICLE TYPES
// ============================================

export type ParticleType = 'ambient' | 'hover' | 'select' | 'timelineUnlock'

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number // 0-1, fades out as it decreases
  decay: number
  size: number
  color: string
  type: ParticleType
}

/**
 * Create a new particle
 */
export function createParticle(
  x: number,
  y: number,
  color: string,
  type: ParticleType
): Particle {
  const config = PARTICLE_CONFIG[type]
  const angle = Math.random() * Math.PI * 2
  const speed = config.speed * (0.5 + Math.random() * 0.5)
  const [minSize, maxSize] = config.sizeRange

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1,
    decay: config.decay * (0.8 + Math.random() * 0.4),
    size: minSize + Math.random() * (maxSize - minSize),
    color,
    type,
  }
}

/**
 * Update particle position and life
 * Returns null if particle is dead
 */
export function updateParticle(particle: Particle, deltaTime: number): Particle | null {
  const newLife = particle.life - particle.decay * deltaTime
  if (newLife <= 0) return null

  return {
    ...particle,
    x: particle.x + particle.vx * deltaTime,
    y: particle.y + particle.vy * deltaTime,
    vy: particle.vy + 0.02 * deltaTime, // Slight gravity
    life: newLife,
  }
}
