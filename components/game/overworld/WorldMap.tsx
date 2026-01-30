'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Star, Map as MapIcon } from 'lucide-react'
import {
  useWorlds,
  useSelectedWorld,
  useUnlockedSkills,
  useTotalStars,
  useWorldState,
  getWorldStars,
  getWorldMaxStars,
  WORLD_THEMES,
  SKILLS,
  type World,
  type WorldId,
} from '@/lib/game/world'
import { LevelSelectModal } from './LevelSelectModal'

const MAP_WIDTH = 620
const MAP_HEIGHT = 300

type WorldMapProps = {
  onStartLevel: () => void
}

export function WorldMap({ onStartLevel }: WorldMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worlds = useWorlds()
  const selectedWorldId = useSelectedWorld()
  const unlockedSkills = useUnlockedSkills()
  const totalStars = useTotalStars()
  const { selectWorld, deselectWorld, goToMenu } = useWorldState()

  const [hoveredWorld, setHoveredWorld] = useState<WorldId | null>(null)

  // Draw map
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const render = () => {
      ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT)

      // Draw background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, MAP_HEIGHT)
      gradient.addColorStop(0, '#1a1a2e')
      gradient.addColorStop(0.5, '#16213e')
      gradient.addColorStop(1, '#0f3460')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)

      // Draw decorative elements
      drawStars(ctx)
      drawPaths(ctx, worlds)
      drawWorldNodes(ctx, worlds, selectedWorldId, hoveredWorld)
    }

    render()
  }, [worlds, selectedWorldId, hoveredWorld])

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY

      // Check if click is on a world node
      for (const world of worlds) {
        const dx = x - world.mapPosition.x
        const dy = y - world.mapPosition.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance <= 28 && world.unlocked) {
          if (selectedWorldId === world.id) {
            // Already selected, do nothing (modal handles it)
          } else {
            selectWorld(world.id)
          }
          return
        }
      }

      // Click outside - deselect
      if (selectedWorldId) {
        deselectWorld()
      }
    },
    [worlds, selectedWorldId, selectWorld, deselectWorld]
  )

  // Handle canvas mouse move for hover
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY

      let foundWorld: WorldId | null = null

      for (const world of worlds) {
        const dx = x - world.mapPosition.x
        const dy = y - world.mapPosition.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance <= 28) {
          foundWorld = world.id
          break
        }
      }

      setHoveredWorld(foundWorld)
    },
    [worlds]
  )

  const selectedWorld = worlds.find((w) => w.id === selectedWorldId)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative rounded-xl overflow-hidden border border-border"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-background/80 to-transparent">
        <div className="flex items-center gap-2">
          <MapIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">World Map</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Skills display */}
          <div className="flex items-center gap-1">
            {unlockedSkills.map((skillId) => (
              <span
                key={skillId}
                className="text-sm"
                title={SKILLS[skillId].name}
              >
                {SKILLS[skillId].icon}
              </span>
            ))}
          </div>
          {/* Total stars */}
          <div className="flex items-center gap-1 text-yellow-400">
            <Star className="h-4 w-4 fill-current" />
            <span className="text-sm font-medium">{totalStars}</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        className="w-full h-auto cursor-pointer"
        style={{ imageRendering: 'pixelated' }}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredWorld(null)}
      />

      {/* World info tooltip on hover */}
      <AnimatePresence>
        {hoveredWorld && !selectedWorldId && (
          <WorldTooltip
            world={worlds.find((w) => w.id === hoveredWorld)!}
          />
        )}
      </AnimatePresence>

      {/* Level select modal */}
      <AnimatePresence>
        {selectedWorld && (
          <LevelSelectModal
            world={selectedWorld}
            onClose={deselectWorld}
            onStartLevel={onStartLevel}
          />
        )}
      </AnimatePresence>

      {/* Back to menu button */}
      <motion.button
        onClick={goToMenu}
        className="absolute bottom-3 left-3 px-3 py-1.5 text-xs font-medium bg-card/80 hover:bg-card border border-border rounded-lg backdrop-blur-sm"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        ← Back to Menu
      </motion.button>
    </motion.div>
  )
}

// ============================================
// TOOLTIP COMPONENT
// ============================================

function WorldTooltip({ world }: { world: World }) {
  const theme = WORLD_THEMES[world.theme]
  const stars = getWorldStars(world)
  const maxStars = getWorldMaxStars(world)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-3 right-3 p-3 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg max-w-[200px]"
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: theme.primaryColor }}
        />
        <span className="font-medium text-sm">{world.name}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{world.company}</p>
      {world.unlocked ? (
        <div className="flex items-center gap-1 text-yellow-400">
          <Star className="h-3 w-3 fill-current" />
          <span className="text-xs">
            {stars}/{maxStars}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span className="text-xs">Locked</span>
        </div>
      )}
    </motion.div>
  )
}

// ============================================
// DRAWING FUNCTIONS
// ============================================

function drawStars(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * MAP_WIDTH
    const y = Math.random() * MAP_HEIGHT * 0.6
    const size = Math.random() * 1.5 + 0.5
    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPaths(ctx: CanvasRenderingContext2D, worlds: World[]) {
  const sortedWorlds = [...worlds].sort((a, b) => a.order - b.order)

  for (let i = 0; i < sortedWorlds.length - 1; i++) {
    const from = sortedWorlds[i]
    const to = sortedWorlds[i + 1]

    const isUnlocked = from.completed

    ctx.beginPath()
    ctx.moveTo(from.mapPosition.x, from.mapPosition.y)

    // Create curved path
    const midX = (from.mapPosition.x + to.mapPosition.x) / 2
    const midY = (from.mapPosition.y + to.mapPosition.y) / 2 - 20

    ctx.quadraticCurveTo(midX, midY, to.mapPosition.x, to.mapPosition.y)

    if (isUnlocked) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 3
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
    }

    ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawWorldNodes(
  ctx: CanvasRenderingContext2D,
  worlds: World[],
  selectedId: WorldId | null,
  hoveredId: WorldId | null
) {
  for (const world of worlds) {
    const { x, y } = world.mapPosition
    const theme = WORLD_THEMES[world.theme]
    const isSelected = world.id === selectedId
    const isHovered = world.id === hoveredId
    const radius = isSelected ? 30 : isHovered ? 28 : 24

    // Outer glow for unlocked/selected
    if (world.unlocked) {
      ctx.beginPath()
      ctx.arc(x, y, radius + 6, 0, Math.PI * 2)
      const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius + 10)
      gradient.addColorStop(0, `${theme.primaryColor}40`)
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fill()
    }

    // Main circle
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)

    if (!world.unlocked) {
      ctx.fillStyle = '#374151'
      ctx.strokeStyle = '#4B5563'
    } else if (world.completed) {
      ctx.fillStyle = theme.primaryColor
      ctx.strokeStyle = theme.secondaryColor
    } else {
      ctx.fillStyle = `${theme.primaryColor}40`
      ctx.strokeStyle = theme.primaryColor
    }

    ctx.fill()
    ctx.lineWidth = isSelected ? 4 : 2
    ctx.stroke()

    // Icon/number
    ctx.fillStyle = world.unlocked ? '#fff' : '#9CA3AF'
    ctx.font = 'bold 14px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (!world.unlocked) {
      // Draw lock icon
      ctx.fillText('🔒', x, y)
    } else if (world.completed) {
      // Draw checkmark
      ctx.fillText('✓', x, y)
    } else {
      // Draw world number
      ctx.fillText(String(world.order), x, y)
    }

    // Stars for completed worlds
    if (world.unlocked && world.completed) {
      const stars = getWorldStars(world)
      ctx.font = '10px system-ui'
      ctx.fillStyle = '#FCD34D'
      ctx.fillText(`★${stars}`, x, y + radius + 10)
    }
  }
}
