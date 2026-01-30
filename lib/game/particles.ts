/**
 * Particle Effects System
 * Visual feedback and polish for the career platformer
 */

import type { ColorPalette } from './palette'
import { withAlpha } from './palette'

// ============================================
// TYPES
// ============================================

export type ParticleType =
  | 'dust'      // Landing/running dust
  | 'sparkle'   // Collection sparkle
  | 'star'      // Star burst
  | 'confetti'  // Win celebration
  | 'trail'     // Movement trail
  | 'damage'    // Player damage effect
  | 'respawn'   // Respawn swirl effect

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  type: ParticleType
  size: number
  color: string
  gravity: number
  friction: number
  rotation?: number
  rotationSpeed?: number
}

export type ParticleEmitter = {
  particles: Particle[]
  maxParticles: number
}

// ============================================
// PARTICLE CREATION
// ============================================

/**
 * Creates a new particle emitter
 */
export function createEmitter(maxParticles: number = 100): ParticleEmitter {
  return {
    particles: [],
    maxParticles,
  }
}

/**
 * Creates a dust particle
 */
function createDustParticle(x: number, y: number, palette: ColorPalette): Particle {
  const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.8
  const speed = 1 + Math.random() * 2

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 1,
    life: 300 + Math.random() * 200,
    maxLife: 300 + Math.random() * 200,
    type: 'dust',
    size: 2 + Math.random() * 2,
    color: palette.ground.highlight,
    gravity: 0.1,
    friction: 0.98,
  }
}

/**
 * Creates a sparkle particle
 */
function createSparkleParticle(x: number, y: number, color: string): Particle {
  const angle = Math.random() * Math.PI * 2
  const speed = 2 + Math.random() * 3

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 400 + Math.random() * 200,
    maxLife: 400 + Math.random() * 200,
    type: 'sparkle',
    size: 2 + Math.random() * 2,
    color,
    gravity: -0.02, // Float upward
    friction: 0.95,
  }
}

/**
 * Creates a star burst particle
 */
function createStarParticle(x: number, y: number, palette: ColorPalette): Particle {
  const angle = Math.random() * Math.PI * 2
  const speed = 3 + Math.random() * 4

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 500 + Math.random() * 300,
    maxLife: 500 + Math.random() * 300,
    type: 'star',
    size: 3,
    color: palette.tech.tertiary,
    gravity: 0.05,
    friction: 0.96,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.2,
  }
}

/**
 * Creates a confetti particle
 */
function createConfettiParticle(x: number, y: number, palette: ColorPalette): Particle {
  const colors = [
    palette.tech.primary,
    palette.tech.secondary,
    palette.tech.tertiary,
    palette.tech.success,
  ]
  const angle = Math.random() * Math.PI * 2
  const speed = 2 + Math.random() * 5

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 3,
    life: 1500 + Math.random() * 1000,
    maxLife: 1500 + Math.random() * 1000,
    type: 'confetti',
    size: 4 + Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    gravity: 0.08,
    friction: 0.99,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.3,
  }
}

/**
 * Creates a trail particle
 */
function createTrailParticle(x: number, y: number, palette: ColorPalette): Particle {
  return {
    x: x + (Math.random() - 0.5) * 4,
    y: y + (Math.random() - 0.5) * 4,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    life: 200 + Math.random() * 100,
    maxLife: 200 + Math.random() * 100,
    type: 'trail',
    size: 1 + Math.random(),
    color: palette.tech.primary,
    gravity: 0,
    friction: 0.98,
  }
}

// ============================================
// EMITTER FUNCTIONS
// ============================================

/**
 * Emits dust particles (landing, running)
 */
export function emitDust(
  emitter: ParticleEmitter,
  x: number,
  y: number,
  count: number,
  palette: ColorPalette
): ParticleEmitter {
  const newParticles = [...emitter.particles]

  for (let i = 0; i < count; i++) {
    if (newParticles.length < emitter.maxParticles) {
      newParticles.push(createDustParticle(x, y, palette))
    }
  }

  return { ...emitter, particles: newParticles }
}

/**
 * Emits sparkle particles (collection)
 */
export function emitSparkles(
  emitter: ParticleEmitter,
  x: number,
  y: number,
  count: number,
  color: string
): ParticleEmitter {
  const newParticles = [...emitter.particles]

  for (let i = 0; i < count; i++) {
    if (newParticles.length < emitter.maxParticles) {
      newParticles.push(createSparkleParticle(x, y, color))
    }
  }

  return { ...emitter, particles: newParticles }
}

/**
 * Emits star burst (milestone reached)
 */
export function emitStarBurst(
  emitter: ParticleEmitter,
  x: number,
  y: number,
  count: number,
  palette: ColorPalette
): ParticleEmitter {
  const newParticles = [...emitter.particles]

  for (let i = 0; i < count; i++) {
    if (newParticles.length < emitter.maxParticles) {
      newParticles.push(createStarParticle(x, y, palette))
    }
  }

  return { ...emitter, particles: newParticles }
}

/**
 * Emits confetti (win celebration)
 */
export function emitConfetti(
  emitter: ParticleEmitter,
  x: number,
  y: number,
  count: number,
  palette: ColorPalette
): ParticleEmitter {
  const newParticles = [...emitter.particles]

  for (let i = 0; i < count; i++) {
    if (newParticles.length < emitter.maxParticles) {
      newParticles.push(createConfettiParticle(x, y, palette))
    }
  }

  return { ...emitter, particles: newParticles }
}

/**
 * Emits movement trail
 */
export function emitTrail(
  emitter: ParticleEmitter,
  x: number,
  y: number,
  palette: ColorPalette
): ParticleEmitter {
  const newParticles = [...emitter.particles]

  if (newParticles.length < emitter.maxParticles) {
    newParticles.push(createTrailParticle(x, y, palette))
  }

  return { ...emitter, particles: newParticles }
}

/**
 * Creates a damage particle (red/orange burst)
 */
function createDamageParticle(x: number, y: number): Particle {
  const angle = Math.random() * Math.PI * 2
  const speed = 2 + Math.random() * 4
  const colors = ['#ff4444', '#ff6644', '#ff8844', '#ffaa44']

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 2,
    life: 1,
    maxLife: 1,
    type: 'damage',
    size: 2 + Math.random() * 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    gravity: 0.15,
    friction: 0.95,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.3,
  }
}

/**
 * Creates a respawn particle (blue/white swirl)
 */
function createRespawnParticle(x: number, y: number, index: number, total: number): Particle {
  const angle = (index / total) * Math.PI * 2
  const radius = 20 + Math.random() * 10
  const colors = ['#4488ff', '#66aaff', '#88ccff', '#ffffff']

  return {
    x: x + Math.cos(angle) * radius,
    y: y + Math.sin(angle) * radius,
    vx: -Math.cos(angle) * 2,
    vy: -Math.sin(angle) * 2,
    life: 1,
    maxLife: 1,
    type: 'respawn',
    size: 2 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    gravity: 0,
    friction: 0.92,
    rotation: angle,
    rotationSpeed: 0.1,
  }
}

/**
 * Emits damage particles when player is hit
 */
export function emitDamage(
  emitter: ParticleEmitter,
  x: number,
  y: number,
  count: number
): ParticleEmitter {
  const newParticles = [...emitter.particles]
  const particlesToAdd = Math.min(count, emitter.maxParticles - newParticles.length)

  for (let i = 0; i < particlesToAdd; i++) {
    newParticles.push(createDamageParticle(x, y))
  }

  return { ...emitter, particles: newParticles }
}

/**
 * Emits respawn particles spiraling inward
 */
export function emitRespawn(
  emitter: ParticleEmitter,
  x: number,
  y: number,
  count: number
): ParticleEmitter {
  const newParticles = [...emitter.particles]
  const particlesToAdd = Math.min(count, emitter.maxParticles - newParticles.length)

  for (let i = 0; i < particlesToAdd; i++) {
    newParticles.push(createRespawnParticle(x, y, i, particlesToAdd))
  }

  return { ...emitter, particles: newParticles }
}

// ============================================
// UPDATE & RENDER
// ============================================

/**
 * Updates all particles in the emitter
 */
export function updateParticles(emitter: ParticleEmitter, deltaTime: number): ParticleEmitter {
  const updatedParticles = emitter.particles
    .map((p) => {
      // Apply physics
      p.vx *= p.friction
      p.vy *= p.friction
      p.vy += p.gravity
      p.x += p.vx
      p.y += p.vy

      // Update rotation
      if (p.rotation !== undefined && p.rotationSpeed) {
        p.rotation += p.rotationSpeed
      }

      // Decrease life
      p.life -= deltaTime

      return p
    })
    .filter((p) => p.life > 0) // Remove dead particles

  return { ...emitter, particles: updatedParticles }
}

/**
 * Renders all particles
 */
export function renderParticles(
  ctx: CanvasRenderingContext2D,
  emitter: ParticleEmitter,
  cameraX: number
): void {
  emitter.particles.forEach((p) => {
    const screenX = p.x - cameraX
    const alpha = Math.max(0, p.life / p.maxLife)

    ctx.save()

    switch (p.type) {
      case 'dust':
        renderDustParticle(ctx, screenX, p.y, p.size, p.color, alpha)
        break
      case 'sparkle':
        renderSparkleParticle(ctx, screenX, p.y, p.size, p.color, alpha)
        break
      case 'star':
        renderStarParticle(ctx, screenX, p.y, p.size, p.color, alpha, p.rotation || 0)
        break
      case 'confetti':
        renderConfettiParticle(ctx, screenX, p.y, p.size, p.color, alpha, p.rotation || 0)
        break
      case 'trail':
        renderTrailParticle(ctx, screenX, p.y, p.size, p.color, alpha)
        break
    }

    ctx.restore()
  })
}

/**
 * Renders a dust particle
 */
function renderDustParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number
): void {
  ctx.fillStyle = withAlpha(color, alpha * 0.6)
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(size), Math.ceil(size))
}

/**
 * Renders a sparkle particle
 */
function renderSparkleParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number
): void {
  // Cross shape
  ctx.fillStyle = withAlpha(color, alpha)
  ctx.fillRect(Math.floor(x), Math.floor(y - size / 2), 1, Math.ceil(size))
  ctx.fillRect(Math.floor(x - size / 2), Math.floor(y), Math.ceil(size), 1)

  // Center glow
  ctx.fillStyle = withAlpha('#ffffff', alpha * 0.8)
  ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1)
}

/**
 * Renders a star particle
 */
function renderStarParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  rotation: number
): void {
  ctx.translate(x, y)
  ctx.rotate(rotation)

  ctx.fillStyle = withAlpha(color, alpha)

  // Simple 4-pointed star
  const halfSize = size / 2
  ctx.fillRect(-halfSize, -1, size, 2)
  ctx.fillRect(-1, -halfSize, 2, size)

  // Center
  ctx.fillStyle = withAlpha('#ffffff', alpha * 0.8)
  ctx.fillRect(-1, -1, 2, 2)
}

/**
 * Renders a confetti particle
 */
function renderConfettiParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  rotation: number
): void {
  ctx.translate(x, y)
  ctx.rotate(rotation)

  ctx.fillStyle = withAlpha(color, alpha)
  ctx.fillRect(-size / 2, -size / 4, size, size / 2)
}

/**
 * Renders a trail particle
 */
function renderTrailParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number
): void {
  ctx.fillStyle = withAlpha(color, alpha * 0.5)
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(size), Math.ceil(size))
}

// ============================================
// UTILITY
// ============================================

/**
 * Clears all particles from emitter
 */
export function clearParticles(emitter: ParticleEmitter): ParticleEmitter {
  return { ...emitter, particles: [] }
}

/**
 * Gets particle count
 */
export function getParticleCount(emitter: ParticleEmitter): number {
  return emitter.particles.length
}
