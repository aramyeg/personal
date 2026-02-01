'use client'

import { useEffect, useState } from 'react'
import type { SkillNode } from '@/lib/game/skillTree'
import { SKILL_TREE_COLORS, CATEGORY_COLORS } from '@/lib/game/skillTree'

type Props = {
  nodes: SkillNode[]
  selectedNodeId: string | null
  hoveredNodeId: string | null
}

type LineData = {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  isHighlighted: boolean
  color: string
  length: number
}

export function ConnectionLines({ nodes, selectedNodeId, hoveredNodeId }: Props) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const lines: LineData[] = []

  // Animation offset for flowing effect
  const [dashOffset, setDashOffset] = useState(0)

  // Animate dash offset for flowing effect
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (prefersReducedMotion) return

    let animationFrame: number

    const animate = () => {
      setDashOffset((prev) => (prev + 0.3) % 20)
      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [])

  // Find nodes that should be highlighted
  const highlightedIds = new Set<string>()
  const activeNodeId = selectedNodeId ?? hoveredNodeId

  if (activeNodeId) {
    const activeNode = nodeMap.get(activeNodeId)
    if (activeNode) {
      highlightedIds.add(activeNodeId)
      activeNode.connections.forEach((id) => highlightedIds.add(id))
    }
  }

  // Generate lines for all connections
  for (const node of nodes) {
    for (const connectionId of node.connections) {
      const target = nodeMap.get(connectionId)
      if (!target) continue

      // Avoid duplicate lines (only draw if node.id < connectionId alphabetically)
      if (node.id > connectionId) continue

      const isHighlighted = highlightedIds.has(node.id) && highlightedIds.has(connectionId)
      const dx = target.position.x - node.position.x
      const dy = target.position.y - node.position.y
      const length = Math.sqrt(dx * dx + dy * dy)

      lines.push({
        key: `${node.id}-${connectionId}`,
        x1: node.position.x,
        y1: node.position.y,
        x2: target.position.x,
        y2: target.position.y,
        isHighlighted,
        color: isHighlighted ? CATEGORY_COLORS[node.category] : SKILL_TREE_COLORS.connections,
        length,
      })
    }
  }

  // Sort so highlighted lines render on top
  lines.sort((a, b) => (a.isHighlighted ? 1 : 0) - (b.isHighlighted ? 1 : 0))

  return (
    <g className="connection-lines">
      {/* Gradient definitions for highlighted lines */}
      <defs>
        {lines
          .filter((l) => l.isHighlighted)
          .map((line) => (
            <linearGradient
              key={`grad-${line.key}`}
              id={`line-gradient-${line.key}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={line.color} stopOpacity="0.9" />
              <stop offset="50%" stopColor={line.color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={line.color} stopOpacity="0.9" />
            </linearGradient>
          ))}
      </defs>

      {lines.map((line) => (
        <g key={line.key}>
          {/* Base line - subtle glow for highlighted */}
          {line.isHighlighted && (
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.color}
              strokeWidth={6}
              opacity={0.15}
              strokeLinecap="round"
              style={{ filter: 'blur(4px)' }}
            />
          )}

          {/* Main line */}
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.isHighlighted ? `url(#line-gradient-${line.key})` : line.color}
            strokeWidth={line.isHighlighted ? 2 : 1}
            opacity={line.isHighlighted ? 0.9 : 0.25}
            strokeLinecap="round"
            style={{
              transition: 'opacity 0.3s ease-out, stroke-width 0.3s ease-out',
            }}
          />

          {/* Flowing dots for highlighted connections */}
          {line.isHighlighted && (
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.color}
              strokeWidth={2}
              opacity={0.7}
              strokeLinecap="round"
              strokeDasharray="4 16"
              strokeDashoffset={-dashOffset}
            />
          )}
        </g>
      ))}
    </g>
  )
}
