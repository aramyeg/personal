'use client'

import { useEffect, useRef, useCallback } from 'react'
import { PARALLAX_LAYERS, SKILL_TREE_COLORS } from '@/lib/game/skillTree'

type Props = {
  width: number
  height: number
  panOffset: { x: number; y: number }
}

type Star = {
  x: number
  y: number
  size: number
  baseOpacity: number
  twinkleSpeed: number
  twinkleOffset: number
}

type LayerData = {
  stars: Star[]
  speed: number
  color: string
  opacity: number
}

/**
 * Canvas-based parallax background with twinkling stars
 * Creates depth and makes the skill tree feel alive
 */
export function ParallaxBackground({ width, height, panOffset }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layersRef = useRef<LayerData[]>([])
  const animationRef = useRef<number>(0)
  const initializedRef = useRef(false)

  // Initialize star layers
  const initializeLayers = useCallback(() => {
    if (initializedRef.current) return

    layersRef.current = PARALLAX_LAYERS.map((layer) => {
      const stars: Star[] = []
      for (let i = 0; i < layer.density; i++) {
        const [minSize, maxSize] = layer.sizeRange
        stars.push({
          x: Math.random() * width * 1.5,
          y: Math.random() * height * 1.5,
          size: minSize + Math.random() * (maxSize - minSize),
          baseOpacity: 0.3 + Math.random() * 0.7,
          twinkleSpeed: 0.001 + Math.random() * 0.002,
          twinkleOffset: Math.random() * Math.PI * 2,
        })
      }
      return {
        stars,
        speed: layer.speed,
        color: layer.color,
        opacity: layer.opacity,
      }
    })

    initializedRef.current = true
  }, [width, height])

  // Render loop
  const render = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return

      // Clear canvas
      ctx.fillStyle = SKILL_TREE_COLORS.background
      ctx.fillRect(0, 0, width, height)

      // Draw each parallax layer
      for (const layer of layersRef.current) {
        for (const star of layer.stars) {
          // Calculate parallax offset
          const offsetX = panOffset.x * layer.speed
          const offsetY = panOffset.y * layer.speed

          // Wrap star positions
          let drawX = (star.x + offsetX) % (width * 1.5)
          let drawY = (star.y + offsetY) % (height * 1.5)
          if (drawX < 0) drawX += width * 1.5
          if (drawY < 0) drawY += height * 1.5

          // Skip if outside visible area
          if (drawX > width + star.size || drawY > height + star.size) continue

          // Calculate twinkle effect
          const twinkle = Math.sin(timestamp * star.twinkleSpeed + star.twinkleOffset)
          const opacity = star.baseOpacity * layer.opacity * (0.5 + twinkle * 0.5)

          // Draw star with glow
          ctx.beginPath()
          ctx.arc(drawX, drawY, star.size, 0, Math.PI * 2)
          ctx.fillStyle = layer.color
          ctx.globalAlpha = opacity
          ctx.fill()

          // Add subtle glow for larger stars
          if (star.size > 2) {
            ctx.beginPath()
            ctx.arc(drawX, drawY, star.size * 2, 0, Math.PI * 2)
            ctx.globalAlpha = opacity * 0.3
            ctx.fill()
          }
        }
      }

      ctx.globalAlpha = 1

      // Continue animation
      animationRef.current = requestAnimationFrame(render)
    },
    [width, height, panOffset]
  )

  // Initialize and start animation
  useEffect(() => {
    initializeLayers()
    animationRef.current = requestAnimationFrame(render)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [initializeLayers, render])

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  if (prefersReducedMotion) {
    // Return static background for reduced motion
    return (
      <div
        className="absolute inset-0"
        style={{ backgroundColor: SKILL_TREE_COLORS.background }}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ backgroundColor: SKILL_TREE_COLORS.background }}
    />
  )
}
