'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SkillNode as SkillNodeType } from '@/lib/game/skillTree'
import {
  CATEGORY_COLORS,
  SKILL_TREE_COLORS,
  getGlowBlur,
  getPhaseOffset,
  GLOW_CONFIG,
} from '@/lib/game/skillTree'

type Props = {
  node: SkillNodeType
  isSelected: boolean
  isHovered: boolean
  isConnected: boolean
  isNewlyUnlocked?: boolean
  onSelect: () => void
  onHover: (hovered: boolean) => void
  onParticleEmit?: (x: number, y: number, color: string, type: 'hover' | 'select') => void
  zoom: number
}

function getProficiencyLabel(proficiency: number): string {
  switch (proficiency) {
    case 5:
      return 'Expert'
    case 4:
      return 'Advanced'
    case 3:
      return 'Intermediate'
    default:
      return 'Beginner'
  }
}

export function SkillNode({
  node,
  isSelected,
  isHovered,
  isConnected,
  isNewlyUnlocked = false,
  onSelect,
  onHover,
  onParticleEmit,
  zoom,
}: Props) {
  const categoryColor = CATEGORY_COLORS[node.category]
  const isHighlighted = isSelected || isHovered || isConnected
  const phaseOffset = useRef(getPhaseOffset(node.id)).current

  // Animated glow state
  const [glowBlur, setGlowBlur] = useState<number>(GLOW_CONFIG.minBlur)
  const [unlockScale, setUnlockScale] = useState<number>(isNewlyUnlocked ? 0 : 1)
  const animationRef = useRef<number>(0)

  // Calculate scaled sizes based on zoom
  const baseRadius = 24
  const radius = baseRadius / zoom
  const glowRadius = (baseRadius + 12) / zoom
  const fontSize = 11 / zoom
  const dotRadius = 2.5 / zoom
  const dotSpacing = 6 / zoom

  // Pulsing glow animation
  useEffect(() => {
    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (prefersReducedMotion) {
      setGlowBlur(GLOW_CONFIG.minBlur)
      return
    }

    const animate = (timestamp: number) => {
      const blur = getGlowBlur(timestamp, phaseOffset)
      setGlowBlur(blur)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [phaseOffset])

  // Unlock animation
  useEffect(() => {
    if (!isNewlyUnlocked) {
      setUnlockScale(1)
      return
    }

    // Animate scale from 0 to 1.2 to 1
    setUnlockScale(0)
    const startTime = performance.now()
    const duration = 600

    const animateUnlock = (timestamp: number) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)

      if (progress < 0.6) {
        // Scale up to 1.3
        setUnlockScale(progress / 0.6 * 1.3)
      } else {
        // Bounce back to 1
        const bounceProgress = (progress - 0.6) / 0.4
        setUnlockScale(1.3 - 0.3 * bounceProgress)
      }

      if (progress < 1) {
        requestAnimationFrame(animateUnlock)
      } else {
        setUnlockScale(1)
        // Emit celebration particles
        if (onParticleEmit) {
          onParticleEmit(node.position.x, node.position.y, categoryColor, 'select')
        }
      }
    }

    requestAnimationFrame(animateUnlock)
  }, [isNewlyUnlocked, node.position.x, node.position.y, categoryColor, onParticleEmit])

  // Keyboard support
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect()
        if (onParticleEmit) {
          onParticleEmit(node.position.x, node.position.y, categoryColor, 'select')
        }
      }
    },
    [onSelect, onParticleEmit, node.position.x, node.position.y, categoryColor]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect()
      if (onParticleEmit) {
        onParticleEmit(node.position.x, node.position.y, categoryColor, 'select')
      }
    },
    [onSelect, onParticleEmit, node.position.x, node.position.y, categoryColor]
  )

  const handleMouseEnter = useCallback(() => {
    onHover(true)
    if (onParticleEmit) {
      onParticleEmit(node.position.x, node.position.y, categoryColor, 'hover')
    }
  }, [onHover, onParticleEmit, node.position.x, node.position.y, categoryColor])

  const ariaLabel = `${node.name}, ${getProficiencyLabel(node.proficiency)} level, ${node.yearsUsed} years experience`

  // Calculate actual display radius with unlock animation
  const displayRadius = radius * unlockScale

  return (
    <g
      role="button"
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      tabIndex={0}
      style={{ cursor: 'pointer', outline: 'none' }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className="skill-node"
    >
      {/* Outer breathing glow - always visible */}
      <circle
        cx={node.position.x}
        cy={node.position.y}
        r={glowRadius * unlockScale}
        fill="none"
        stroke={categoryColor}
        strokeWidth={1}
        opacity={0.15 + (glowBlur - GLOW_CONFIG.minBlur) / (GLOW_CONFIG.maxBlur - GLOW_CONFIG.minBlur) * 0.15}
        style={{
          filter: `blur(${glowBlur / zoom}px)`,
          transition: 'opacity 0.3s ease-out',
        }}
      />

      {/* Inner glow for highlighted state */}
      {isHighlighted && (
        <circle
          cx={node.position.x}
          cy={node.position.y}
          r={(glowRadius - 4) * unlockScale}
          fill={categoryColor}
          opacity={0.25}
          style={{
            filter: `blur(${(glowBlur * 0.6) / zoom}px)`,
          }}
        />
      )}

      {/* Node circle with gradient */}
      <defs>
        <radialGradient id={`gradient-${node.id}`} cx="30%" cy="30%">
          <stop offset="0%" stopColor={isHighlighted ? categoryColor : SKILL_TREE_COLORS.nodeInactive} stopOpacity="1" />
          <stop offset="100%" stopColor={isHighlighted ? categoryColor : SKILL_TREE_COLORS.nodeInactive} stopOpacity="0.7" />
        </radialGradient>
      </defs>

      <circle
        cx={node.position.x}
        cy={node.position.y}
        r={isHovered ? displayRadius * 1.1 : displayRadius}
        fill={`url(#gradient-${node.id})`}
        stroke={categoryColor}
        strokeWidth={isSelected ? 3 / zoom : 1.5 / zoom}
        style={{
          transition: 'r 0.15s ease-out, stroke-width 0.15s ease-out',
        }}
      />

      {/* Inner highlight for depth */}
      <circle
        cx={node.position.x - radius * 0.2}
        cy={node.position.y - radius * 0.2}
        r={displayRadius * 0.3}
        fill="white"
        opacity={isHighlighted ? 0.15 : 0.08}
        style={{ transition: 'opacity 0.15s ease-out' }}
      />

      {/* Proficiency dots */}
      <g aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => {
          const dotX = node.position.x - 2 * dotSpacing + i * dotSpacing
          const dotY = node.position.y + displayRadius + dotSpacing + 4
          const isFilled = i < node.proficiency
          return (
            <circle
              key={i}
              cx={dotX}
              cy={dotY}
              r={dotRadius}
              fill={isFilled ? categoryColor : SKILL_TREE_COLORS.nodeBorder}
              opacity={isFilled ? 1 : 0.5}
              style={{
                transition: 'fill 0.2s ease-out',
              }}
            />
          )
        })}
      </g>

      {/* Label */}
      <text
        x={node.position.x}
        y={node.position.y + displayRadius + dotSpacing * 3 + 10}
        textAnchor="middle"
        fill={isHighlighted ? SKILL_TREE_COLORS.text : SKILL_TREE_COLORS.textMuted}
        fontSize={fontSize}
        fontFamily="ui-monospace, monospace"
        fontWeight={isSelected ? 600 : 400}
        aria-hidden="true"
        style={{ transition: 'fill 0.15s ease-out' }}
      >
        {node.name}
      </text>
    </g>
  )
}
