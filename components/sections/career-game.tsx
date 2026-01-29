'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Trophy } from 'lucide-react'

type Platform = {
  x: number
  y: number
  width: number
  label: string
  year: string
  icon: string
  reached: boolean
}

type Player = {
  x: number
  y: number
  vx: number
  vy: number
  width: number
  height: number
  grounded: boolean
  facingRight: boolean
}

const GRAVITY = 0.5
const JUMP_FORCE = -12
const MOVE_SPEED = 4
const FRICTION = 0.85

const PLATFORMS: Omit<Platform, 'reached'>[] = [
  { x: 20, y: 180, width: 100, label: 'Marketing', year: '2016', icon: '📈' },
  { x: 160, y: 140, width: 100, label: 'Developer', year: '2017', icon: '💻' },
  { x: 320, y: 100, width: 100, label: 'Senior', year: '2020', icon: '⚡' },
  { x: 480, y: 60, width: 120, label: 'Tech Lead', year: '2024', icon: '🚀' },
]

export function CareerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [platforms, setPlatforms] = useState<Platform[]>(
    PLATFORMS.map((p) => ({ ...p, reached: false }))
  )
  const [currentMilestone, setCurrentMilestone] = useState<string | null>(null)

  const playerRef = useRef<Player>({
    x: 40,
    y: 140,
    vx: 0,
    vy: 0,
    width: 20,
    height: 30,
    grounded: false,
    facingRight: true,
  })

  const keysRef = useRef<Set<string>>(new Set())
  const animationRef = useRef<number | null>(null)

  const resetGame = useCallback(() => {
    playerRef.current = {
      x: 40,
      y: 140,
      vx: 0,
      vy: 0,
      width: 20,
      height: 30,
      grounded: false,
      facingRight: true,
    }
    setPlatforms(PLATFORMS.map((p) => ({ ...p, reached: false })))
    setGameWon(false)
    setCurrentMilestone(null)
  }, [])

  const drawPixelCharacter = useCallback((ctx: CanvasRenderingContext2D, player: Player) => {
    const { x, y, width, facingRight } = player
    const scale = width / 16

    ctx.save()
    if (!facingRight) {
      ctx.translate(x + width, y)
      ctx.scale(-1, 1)
      ctx.translate(0, 0)
    } else {
      ctx.translate(x, y)
    }

    // Hair (man-bun style)
    ctx.fillStyle = '#5c4033'
    ctx.fillRect(4 * scale, 0, 8 * scale, 2 * scale)
    ctx.fillRect(3 * scale, 2 * scale, 10 * scale, 3 * scale)

    // Face
    ctx.fillStyle = '#f5d0a9'
    ctx.fillRect(3 * scale, 5 * scale, 10 * scale, 8 * scale)

    // Eyes
    ctx.fillStyle = '#333'
    ctx.fillRect(5 * scale, 7 * scale, 2 * scale, 2 * scale)
    ctx.fillRect(9 * scale, 7 * scale, 2 * scale, 2 * scale)

    // Body (black shirt)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(2 * scale, 13 * scale, 12 * scale, 10 * scale)

    // Arms
    ctx.fillStyle = '#f5d0a9'
    ctx.fillRect(0, 14 * scale, 2 * scale, 6 * scale)
    ctx.fillRect(14 * scale, 14 * scale, 2 * scale, 6 * scale)

    // Pants
    ctx.fillStyle = '#374151'
    ctx.fillRect(3 * scale, 23 * scale, 4 * scale, 7 * scale)
    ctx.fillRect(9 * scale, 23 * scale, 4 * scale, 7 * scale)

    ctx.restore()
  }, [])

  const drawPlatform = useCallback((ctx: CanvasRenderingContext2D, platform: Platform) => {
    const { x, y, width, reached } = platform

    // Platform base
    ctx.fillStyle = reached ? '#22c55e' : '#6366f1'
    ctx.fillRect(x, y, width, 12)

    // Platform top highlight
    ctx.fillStyle = reached ? '#4ade80' : '#818cf8'
    ctx.fillRect(x, y, width, 4)

    // Pixel detail
    ctx.fillStyle = reached ? '#16a34a' : '#4f46e5'
    for (let i = 0; i < width; i += 8) {
      ctx.fillRect(x + i, y + 8, 4, 4)
    }
  }, [])

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !gameStarted) return

    const player = playerRef.current
    const keys = keysRef.current

    // Handle input
    if (keys.has('ArrowLeft') || keys.has('a')) {
      player.vx -= MOVE_SPEED * 0.3
      player.facingRight = false
    }
    if (keys.has('ArrowRight') || keys.has('d')) {
      player.vx += MOVE_SPEED * 0.3
      player.facingRight = true
    }
    if ((keys.has('ArrowUp') || keys.has('w') || keys.has(' ')) && player.grounded) {
      player.vy = JUMP_FORCE
      player.grounded = false
    }

    // Apply physics
    player.vx *= FRICTION
    player.vy += GRAVITY
    player.x += player.vx
    player.y += player.vy

    // Clamp velocity
    player.vx = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, player.vx))

    // World bounds
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x))

    // Ground collision
    if (player.y + player.height > canvas.height - 20) {
      player.y = canvas.height - 20 - player.height
      player.vy = 0
      player.grounded = true
    }

    // Platform collision
    player.grounded = player.y + player.height >= canvas.height - 20

    setPlatforms((prev) => {
      let updated = false
      const newPlatforms = prev.map((platform) => {
        const onPlatform =
          player.x + player.width > platform.x &&
          player.x < platform.x + platform.width &&
          player.y + player.height >= platform.y &&
          player.y + player.height <= platform.y + 16 &&
          player.vy >= 0

        if (onPlatform) {
          player.y = platform.y - player.height
          player.vy = 0
          player.grounded = true

          if (!platform.reached) {
            updated = true
            setCurrentMilestone(`${platform.icon} ${platform.year}: ${platform.label}`)
            setTimeout(() => setCurrentMilestone(null), 2000)

            // Check if this is the final platform
            if (platform.label === 'Tech Lead') {
              setGameWon(true)
            }

            return { ...platform, reached: true }
          }
        }
        return platform
      })
      return updated ? newPlatforms : prev
    })

    // Clear and draw
    ctx.fillStyle = '#0f0f0f'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw pixel grid background
    ctx.fillStyle = '#1a1a1a'
    for (let x = 0; x < canvas.width; x += 16) {
      for (let y = 0; y < canvas.height; y += 16) {
        if ((x + y) % 32 === 0) {
          ctx.fillRect(x, y, 16, 16)
        }
      }
    }

    // Draw ground
    ctx.fillStyle = '#374151'
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20)
    ctx.fillStyle = '#4b5563'
    ctx.fillRect(0, canvas.height - 20, canvas.width, 4)

    // Draw platforms
    platforms.forEach((platform) => {
      drawPlatform(ctx, platform)

      // Draw label
      ctx.fillStyle = platform.reached ? '#22c55e' : '#a5b4fc'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(platform.year, platform.x + platform.width / 2, platform.y - 8)
      ctx.fillText(platform.label, platform.x + platform.width / 2, platform.y - 20)
      ctx.font = '16px sans-serif'
      ctx.fillText(platform.icon, platform.x + platform.width / 2, platform.y - 32)
    })

    // Draw player
    drawPixelCharacter(ctx, player)

    animationRef.current = requestAnimationFrame(gameLoop)
  }, [gameStarted, platforms, drawPixelCharacter, drawPlatform])

  useEffect(() => {
    if (gameStarted && !gameWon) {
      animationRef.current = requestAnimationFrame(gameLoop)
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameStarted, gameWon, gameLoop])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault()
      }
      keysRef.current.add(e.key)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const handleTouchMove = useCallback((direction: 'left' | 'right') => {
    if (direction === 'left') {
      keysRef.current.add('ArrowLeft')
      keysRef.current.delete('ArrowRight')
    } else {
      keysRef.current.add('ArrowRight')
      keysRef.current.delete('ArrowLeft')
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    keysRef.current.delete('ArrowLeft')
    keysRef.current.delete('ArrowRight')
  }, [])

  const handleJump = useCallback(() => {
    keysRef.current.add(' ')
    setTimeout(() => keysRef.current.delete(' '), 100)
  }, [])

  return (
    <div className="relative">
      {/* Game canvas */}
      <div className="relative rounded-xl overflow-hidden border border-border bg-gray-950">
        <canvas
          ref={canvasRef}
          width={620}
          height={220}
          className="w-full h-auto"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Start overlay */}
        <AnimatePresence>
          {!gameStarted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center gap-4"
            >
              <Gamepad2 className="h-12 w-12 text-primary animate-pulse" />
              <h3 className="text-xl font-bold text-white">Career Journey</h3>
              <p className="text-sm text-gray-400 text-center max-w-xs">
                Navigate through my career milestones!
                <br />
                Use arrow keys or WASD to move, Space to jump.
              </p>
              <motion.button
                onClick={() => setGameStarted(true)}
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Game
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Win overlay */}
        <AnimatePresence>
          {gameWon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center gap-4"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <Trophy className="h-16 w-16 text-yellow-400" />
              </motion.div>
              <h3 className="text-2xl font-bold text-white">Journey Complete!</h3>
              <p className="text-sm text-gray-400">From Marketing to Tech Lead 🚀</p>
              <motion.button
                onClick={resetGame}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RotateCcw className="h-4 w-4" />
                Play Again
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Milestone notification */}
        <AnimatePresence>
          {currentMilestone && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium"
            >
              {currentMilestone}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile controls */}
      <div className="mt-4 flex items-center justify-center gap-4 sm:hidden">
        <motion.button
          onTouchStart={() => handleTouchMove('left')}
          onTouchEnd={handleTouchEnd}
          onMouseDown={() => handleTouchMove('left')}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          className="w-14 h-14 rounded-xl bg-card border border-border flex items-center justify-center active:bg-primary/20"
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft className="h-6 w-6" />
        </motion.button>

        <motion.button
          onTouchStart={handleJump}
          onMouseDown={handleJump}
          className="w-14 h-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
        >
          <ArrowUp className="h-6 w-6" />
        </motion.button>

        <motion.button
          onTouchStart={() => handleTouchMove('right')}
          onTouchEnd={handleTouchEnd}
          onMouseDown={() => handleTouchMove('right')}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          className="w-14 h-14 rounded-xl bg-card border border-border flex items-center justify-center active:bg-primary/20"
          whileTap={{ scale: 0.9 }}
        >
          <ArrowRight className="h-6 w-6" />
        </motion.button>
      </div>

      {/* Desktop controls hint */}
      <p className="mt-4 text-xs text-muted-foreground text-center hidden sm:block">
        Use ← → to move, ↑ or Space to jump
      </p>
    </div>
  )
}
