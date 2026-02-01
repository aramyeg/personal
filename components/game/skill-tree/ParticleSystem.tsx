'use client'

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import {
  createParticle,
  updateParticle,
  PARTICLE_CONFIG,
  type Particle,
  type ParticleType,
} from '@/lib/game/skillTree'

type Props = {
  width: number
  height: number
  panOffset: { x: number; y: number }
  zoom: number
}

export type ParticleSystemHandle = {
  emit: (x: number, y: number, color: string, type: ParticleType) => void
}

const MAX_PARTICLES = 60

/**
 * Canvas-based particle system for ambient effects and interaction feedback
 */
export const ParticleSystem = forwardRef<ParticleSystemHandle, Props>(
  function ParticleSystem({ width, height, panOffset, zoom }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const particlesRef = useRef<Particle[]>([])
    const animationRef = useRef<number>(0)
    const lastTimeRef = useRef<number>(0)

    // Emit particles at a position
    const emit = useCallback((x: number, y: number, color: string, type: ParticleType) => {
      const config = PARTICLE_CONFIG[type]
      const count = Math.min(config.count, MAX_PARTICLES - particlesRef.current.length)

      for (let i = 0; i < count; i++) {
        particlesRef.current.push(createParticle(x, y, color, type))
      }

      // Limit total particles
      if (particlesRef.current.length > MAX_PARTICLES) {
        particlesRef.current = particlesRef.current.slice(-MAX_PARTICLES)
      }
    }, [])

    // Expose emit function via ref
    useImperativeHandle(ref, () => ({ emit }), [emit])

    // Spawn ambient particles periodically
    useEffect(() => {
      const prefersReducedMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)'
      ).matches

      if (prefersReducedMotion) return

      const spawnAmbient = () => {
        if (particlesRef.current.length < MAX_PARTICLES * 0.5) {
          const x = Math.random() * width
          const y = Math.random() * height
          // Random ambient color from palette
          const colors = ['#7ee787', '#f78166', '#a371f7', '#ffa657', '#58a6ff']
          const color = colors[Math.floor(Math.random() * colors.length)]
          emit(x, y, color, 'ambient')
        }
      }

      const intervalId = setInterval(spawnAmbient, 800)
      return () => clearInterval(intervalId)
    }, [width, height, emit])

    // Animation loop
    useEffect(() => {
      const prefersReducedMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)'
      ).matches

      if (prefersReducedMotion) return

      const animate = (timestamp: number) => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) {
          animationRef.current = requestAnimationFrame(animate)
          return
        }

        // Calculate delta time (clamped to prevent jumps)
        const deltaTime = Math.min((timestamp - lastTimeRef.current) / 16.67, 3)
        lastTimeRef.current = timestamp

        // Clear canvas
        ctx.clearRect(0, 0, width, height)

        // Update and draw particles
        const updatedParticles: Particle[] = []

        for (const particle of particlesRef.current) {
          const updated = updateParticle(particle, deltaTime)
          if (updated) {
            updatedParticles.push(updated)

            // Transform position based on pan and zoom
            const screenX = (updated.x - panOffset.x / zoom) * zoom
            const screenY = (updated.y - panOffset.y / zoom) * zoom

            // Skip if outside visible area
            if (screenX < -10 || screenX > width + 10 || screenY < -10 || screenY > height + 10) {
              continue
            }

            // Draw particle with fade
            ctx.beginPath()
            ctx.arc(screenX, screenY, updated.size * updated.life, 0, Math.PI * 2)
            ctx.fillStyle = updated.color
            ctx.globalAlpha = updated.life * 0.8
            ctx.fill()

            // Add glow for larger particles
            if (updated.size > 3) {
              ctx.beginPath()
              ctx.arc(screenX, screenY, updated.size * updated.life * 2, 0, Math.PI * 2)
              ctx.globalAlpha = updated.life * 0.2
              ctx.fill()
            }
          }
        }

        ctx.globalAlpha = 1
        particlesRef.current = updatedParticles

        animationRef.current = requestAnimationFrame(animate)
      }

      animationRef.current = requestAnimationFrame(animate)

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    }, [width, height, panOffset, zoom])

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10 }}
      />
    )
  }
)
