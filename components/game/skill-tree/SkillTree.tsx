'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import {
  useSkillTreeStore,
  useSelectedNode,
  useVisibleNodes,
  useConnectedNodeIds,
  SKILL_TREE_COLORS,
  SKILL_TREE_DIMENSIONS,
  getMinYear,
  getMaxYear,
} from '@/lib/game/skillTree'
import { SkillNode } from './SkillNode'
import { ConnectionLines } from './ConnectionLines'
import { NodeDetail } from './NodeDetail'
import { QuickStats } from './QuickStats'
import { TimelineSlider } from './TimelineSlider'
import { ZoomControls } from './ZoomControls'
import { ParallaxBackground } from './ParallaxBackground'
import { ParticleSystem, type ParticleSystemHandle } from './ParticleSystem'

const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = SKILL_TREE_DIMENSIONS
const MIN_YEAR = getMinYear()
const MAX_YEAR = getMaxYear()

type Props = {
  autoPlay?: boolean
}

export function SkillTree({ autoPlay = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const particleSystemRef = useRef<ParticleSystemHandle>(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const previousVisibleIdsRef = useRef<Set<string>>(new Set())

  // Container dimensions for canvas sizing
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  })

  // Store state and actions
  const {
    selectedNodeId,
    hoveredNodeId,
    viewMode,
    timelineYear,
    zoom,
    pan,
    isAnimating,
    selectNode,
    hoverNode,
    setViewMode,
    setTimelineYear,
    setZoom,
    adjustPan,
    resetView,
    startTimelineAnimation,
    stopTimelineAnimation,
  } = useSkillTreeStore()

  // Derived state
  const visibleNodes = useVisibleNodes()
  const selectedNode = useSelectedNode()
  const connectedNodeIds = useConnectedNodeIds()

  // Track newly unlocked nodes for animation
  const [newlyUnlockedIds, setNewlyUnlockedIds] = useState<Set<string>>(new Set())

  // Detect newly visible nodes in timeline mode
  useEffect(() => {
    if (viewMode !== 'timeline') {
      previousVisibleIdsRef.current = new Set(visibleNodes.map((n) => n.id))
      setNewlyUnlockedIds(new Set())
      return
    }

    const currentIds = new Set(visibleNodes.map((n) => n.id))
    const newIds = new Set<string>()

    for (const id of currentIds) {
      if (!previousVisibleIdsRef.current.has(id)) {
        newIds.add(id)
      }
    }

    if (newIds.size > 0) {
      setNewlyUnlockedIds(newIds)
      // Clear after animation completes
      setTimeout(() => setNewlyUnlockedIds(new Set()), 700)
    }

    previousVisibleIdsRef.current = currentIds
  }, [visibleNodes, viewMode])

  // Auto-play timeline on mount if enabled
  useEffect(() => {
    if (autoPlay && viewMode === 'tree') {
      // Small delay before starting auto-play
      const timeoutId = setTimeout(() => {
        setViewMode('timeline')
        startTimelineAnimation()
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [autoPlay, viewMode, setViewMode, startTimelineAnimation])

  // Resize observer for container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Particle emission callback
  const handleParticleEmit = useCallback(
    (x: number, y: number, color: string, type: 'hover' | 'select') => {
      particleSystemRef.current?.emit(x, y, color, type)
    },
    []
  )

  // Pan handling - Mouse
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).closest('.connection-lines')) {
      isDragging.current = true
      lastPos.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      adjustPan({ x: dx, y: dy })
      lastPos.current = { x: e.clientX, y: e.clientY }
    },
    [adjustPan]
  )

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // Pan handling - Touch
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true
      lastPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    }
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1) return
      const dx = e.touches[0].clientX - lastPos.current.x
      const dy = e.touches[0].clientY - lastPos.current.y
      adjustPan({ x: dx, y: dy })
      lastPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    },
    [adjustPan]
  )

  // Wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(zoom + delta)
    },
    [zoom, setZoom]
  )

  // Calculate viewBox based on zoom and pan
  const viewBoxX = -pan.x / zoom
  const viewBoxY = -pan.y / zoom
  const viewBoxWidth = CANVAS_WIDTH / zoom
  const viewBoxHeight = CANVAS_HEIGHT / zoom

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden"
      style={{
        backgroundColor: SKILL_TREE_COLORS.background,
        border: `1px solid ${SKILL_TREE_COLORS.nodeBorder}`,
        minHeight: '400px',
      }}
    >
      {/* Parallax background */}
      <ParallaxBackground
        width={containerSize.width || CANVAS_WIDTH}
        height={containerSize.height || CANVAS_HEIGHT}
        panOffset={pan}
      />

      {/* Particle system */}
      <ParticleSystem
        ref={particleSystemRef}
        width={containerSize.width || CANVAS_WIDTH}
        height={containerSize.height || CANVAS_HEIGHT}
        panOffset={pan}
        zoom={zoom}
      />

      {/* Mode toggle */}
      <div
        className="absolute top-3 right-3 z-20 flex gap-1.5"
        role="tablist"
        aria-label="Skill tree view mode"
      >
        <button
          role="tab"
          aria-selected={viewMode === 'tree'}
          onClick={() => setViewMode('tree')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            viewMode === 'tree'
              ? 'bg-[#58a6ff] text-white shadow-lg shadow-[#58a6ff]/20'
              : 'bg-[#161b22]/80 text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]'
          }`}
        >
          Explore
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'timeline'}
          onClick={() => setViewMode('timeline')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            viewMode === 'timeline'
              ? 'bg-[#58a6ff] text-white shadow-lg shadow-[#58a6ff]/20'
              : 'bg-[#161b22]/80 text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]'
          }`}
        >
          Journey
        </button>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        role="img"
        aria-label="Interactive skill tree showing technologies and their connections"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        className="relative w-full h-auto touch-none cursor-grab active:cursor-grabbing"
        style={{
          minHeight: '400px',
          zIndex: 5,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        onClick={(e) => {
          if (e.target === svgRef.current) {
            selectNode(null)
          }
        }}
      >
        {/* Connection lines */}
        <ConnectionLines
          nodes={visibleNodes}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
        />

        {/* Skill nodes */}
        {visibleNodes.map((node) => (
          <SkillNode
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            isHovered={hoveredNodeId === node.id}
            isConnected={connectedNodeIds.includes(node.id)}
            isNewlyUnlocked={newlyUnlockedIds.has(node.id)}
            onSelect={() => selectNode(selectedNodeId === node.id ? null : node.id)}
            onHover={(hovered) => hoverNode(hovered ? node.id : null)}
            onParticleEmit={handleParticleEmit}
            zoom={zoom}
          />
        ))}
      </svg>

      {/* Timeline controls (only in timeline mode) */}
      {viewMode === 'timeline' && (
        <TimelineSlider
          year={timelineYear}
          minYear={MIN_YEAR}
          maxYear={MAX_YEAR}
          isAnimating={isAnimating}
          onYearChange={setTimelineYear}
          onStartAnimation={startTimelineAnimation}
          onStopAnimation={stopTimelineAnimation}
        />
      )}

      {/* Quick stats (only in tree/explore mode) */}
      {viewMode === 'tree' && <QuickStats nodes={visibleNodes} />}

      {/* Zoom controls */}
      <ZoomControls
        zoom={zoom}
        onZoomIn={() => setZoom(zoom + 0.25)}
        onZoomOut={() => setZoom(zoom - 0.25)}
        onResetView={resetView}
      />

      {/* Node detail panel */}
      <NodeDetail node={selectedNode} onClose={() => selectNode(null)} />

      {/* Year badge in timeline mode */}
      {viewMode === 'timeline' && (
        <div
          className="absolute top-14 left-3 z-20 px-4 py-2 rounded-xl"
          style={{
            backgroundColor: 'rgba(13, 17, 23, 0.95)',
            border: '1px solid #30363d',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div className="text-3xl font-bold" style={{ color: '#58a6ff' }}>
            {timelineYear}
          </div>
          <div className="text-xs" style={{ color: SKILL_TREE_COLORS.textMuted }}>
            {visibleNodes.length} skills
          </div>
        </div>
      )}
    </div>
  )
}
