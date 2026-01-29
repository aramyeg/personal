'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Trophy } from 'lucide-react'

import { experiences } from '@/data'
import { getGameColors, isDarkMode } from '@/lib/game/colors'
import { generatePlatforms } from '@/lib/game/platforms'
import { generateParallaxLayers, getElementPosition, renderElement } from '@/lib/game/parallax'
import type { Platform, Player, GameColors, ParallaxLayer, GameConfig, InputState } from '@/lib/game/types'

// Game configuration
const CONFIG: GameConfig = {
  gravity: 0.5,
  jumpForce: -12,
  moveSpeed: 4,
  friction: 0.85,
  playerWidth: 20,
  playerHeight: 30,
}

// Canvas dimensions
const CANVAS_WIDTH = 620
const CANVAS_HEIGHT = 220

/**
 * Creates initial player state
 */
function createPlayer(startX: number, startY: number): Player {
  return {
    x: startX,
    y: startY,
    vx: 0,
    vy: 0,
    width: CONFIG.playerWidth,
    height: CONFIG.playerHeight,
    grounded: false,
    facingRight: true,
    animationState: 'idle',
  }
}

/**
 * Draws pixel art character
 * Custom pixel art design: man with dark hair (man-bun style)
 */
function drawPixelCharacter(
  ctx: CanvasRenderingContext2D,
  player: Player,
  colors: GameColors
): void {
  const { x, y, width, facingRight } = player
  const scale = width / 16

  ctx.save()
  if (!facingRight) {
    ctx.translate(x + width, y)
    ctx.scale(-1, 1)
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
  ctx.fillStyle = colors.text
  ctx.fillRect(5 * scale, 7 * scale, 2 * scale, 2 * scale)
  ctx.fillRect(9 * scale, 7 * scale, 2 * scale, 2 * scale)

  // Body (dark shirt)
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
}

/**
 * Draws a platform with pixel art style
 */
function drawPlatform(ctx: CanvasRenderingContext2D, platform: Platform, colors: GameColors): void {
  const { x, y, width, reached } = platform

  // Platform base
  ctx.fillStyle = reached ? colors.platformReached : colors.platformDefault
  ctx.fillRect(x, y, width, 12)

  // Platform top highlight
  ctx.fillStyle = reached ? colors.platformReachedHighlight : colors.platformHighlight
  ctx.fillRect(x, y, width, 4)

  // Pixel detail pattern
  ctx.fillStyle = reached ? colors.platformReached : colors.platformDefault
  for (let i = 0; i < width; i += 8) {
    ctx.fillRect(x + i, y + 8, 4, 4)
  }
}

/**
 * Draws platform labels (year, role, icon)
 */
function drawPlatformLabels(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  colors: GameColors
): void {
  const { x, y, width, year, label, icon, reached } = platform

  ctx.fillStyle = reached ? colors.platformReached : colors.textMuted
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(year, x + width / 2, y - 8)
  ctx.fillText(label, x + width / 2, y - 20)
  ctx.font = '16px sans-serif'
  ctx.fillText(icon, x + width / 2, y - 32)
}

/**
 * Draws the ground
 */
function drawGround(ctx: CanvasRenderingContext2D, colors: GameColors): void {
  ctx.fillStyle = colors.ground
  ctx.fillRect(0, CANVAS_HEIGHT - 20, CANVAS_WIDTH, 20)
  ctx.fillStyle = colors.groundHighlight
  ctx.fillRect(0, CANVAS_HEIGHT - 20, CANVAS_WIDTH, 4)
}

/**
 * Draws parallax background layers
 */
function drawParallaxLayers(
  ctx: CanvasRenderingContext2D,
  layers: ParallaxLayer[],
  cameraX: number
): void {
  layers.forEach((layer) => {
    layer.elements.forEach((element) => {
      const adjustedX = getElementPosition(element.x, cameraX, layer.speed, CANVAS_WIDTH)
      renderElement(ctx, { ...element, x: adjustedX })
    })
  })
}

export function CareerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [currentMilestone, setCurrentMilestone] = useState<string | null>(null)

  // Theme-aware colors
  const [colors, setColors] = useState<GameColors>(() => getGameColors(false))

  // Generate platforms from experience data
  const initialPlatforms = useMemo(
    () => generatePlatforms(experiences, CANVAS_WIDTH, CANVAS_HEIGHT),
    []
  )
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms)

  // Generate parallax layers
  const parallaxLayers = useMemo(
    () => generateParallaxLayers(CANVAS_WIDTH, CANVAS_HEIGHT, colors),
    [colors]
  )

  // Player state
  const playerRef = useRef<Player>(createPlayer(40, 140))

  // Input state
  const keysRef = useRef<InputState>({ left: false, right: false, jump: false })
  const animationRef = useRef<number | null>(null)

  // Camera position for parallax
  const cameraXRef = useRef(0)

  // Update colors on theme change
  useEffect(() => {
    const updateColors = () => {
      setColors(getGameColors(isDarkMode()))
    }

    updateColors()

    // Watch for theme changes
    const observer = new MutationObserver(updateColors)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  const resetGame = useCallback(() => {
    playerRef.current = createPlayer(40, 140)
    setPlatforms(initialPlatforms)
    setGameWon(false)
    setCurrentMilestone(null)
    cameraXRef.current = 0
  }, [initialPlatforms])

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !gameStarted) return

    const player = playerRef.current
    const keys = keysRef.current

    // Handle input
    if (keys.left) {
      player.vx -= CONFIG.moveSpeed * 0.3
      player.facingRight = false
      player.animationState = 'walking'
    }
    if (keys.right) {
      player.vx += CONFIG.moveSpeed * 0.3
      player.facingRight = true
      player.animationState = 'walking'
    }
    if (keys.jump && player.grounded) {
      player.vy = CONFIG.jumpForce
      player.grounded = false
      player.animationState = 'jumping'
    }

    // Apply physics
    player.vx *= CONFIG.friction
    player.vy += CONFIG.gravity
    player.x += player.vx
    player.y += player.vy

    // Update animation state
    if (!player.grounded) {
      player.animationState = 'jumping'
    } else if (Math.abs(player.vx) < 0.1) {
      player.animationState = 'idle'
    }

    // Clamp velocity
    player.vx = Math.max(-CONFIG.moveSpeed, Math.min(CONFIG.moveSpeed, player.vx))

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
      const newPlatforms = prev.map((platform, index) => {
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
            setTimeout(() => setCurrentMilestone(null), 2500)

            // Check if this is the final platform
            if (index === prev.length - 1) {
              setGameWon(true)
            }

            return { ...platform, reached: true }
          }
        }
        return platform
      })
      return updated ? newPlatforms : prev
    })

    // Update camera (follow player)
    cameraXRef.current = player.x - CANVAS_WIDTH / 3

    // Clear and draw background
    ctx.fillStyle = colors.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw pixel grid background pattern
    ctx.fillStyle = colors.backgroundAlt
    for (let x = 0; x < canvas.width; x += 16) {
      for (let y = 0; y < canvas.height; y += 16) {
        if ((x + y) % 32 === 0) {
          ctx.fillRect(x, y, 16, 16)
        }
      }
    }

    // Draw parallax layers
    drawParallaxLayers(ctx, parallaxLayers, cameraXRef.current)

    // Draw ground
    drawGround(ctx, colors)

    // Draw platforms
    platforms.forEach((platform) => {
      drawPlatform(ctx, platform, colors)
      drawPlatformLabels(ctx, platform, colors)
    })

    // Draw player
    drawPixelCharacter(ctx, player, colors)

    animationRef.current = requestAnimationFrame(gameLoop)
  }, [gameStarted, platforms, colors, parallaxLayers])

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
      const keys = keysRef.current
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') keys.jump = true
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const keys = keysRef.current
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') keys.jump = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const handleTouchMove = useCallback((direction: 'left' | 'right') => {
    const keys = keysRef.current
    if (direction === 'left') {
      keys.left = true
      keys.right = false
    } else {
      keys.right = true
      keys.left = false
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    keysRef.current.left = false
    keysRef.current.right = false
  }, [])

  const handleJump = useCallback(() => {
    keysRef.current.jump = true
    setTimeout(() => {
      keysRef.current.jump = false
    }, 100)
  }, [])

  // Get the final milestone for win message
  const finalPlatform = platforms[platforms.length - 1]

  // Screen reader announcement
  const announcement = gameWon
    ? `Journey Complete! Reached ${finalPlatform?.label} at ${finalPlatform?.company}`
    : currentMilestone

  return (
    <div className="relative">
      {/* Screen reader announcements for game events */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Game canvas */}
      <div className="relative rounded-xl overflow-hidden border border-border bg-background">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-auto"
          style={{ imageRendering: 'pixelated' }}
          aria-label="Career journey platformer game. Use arrow keys or WASD to move, Space to jump."
          role="img"
          tabIndex={gameStarted ? 0 : -1}
        />

        {/* Start overlay */}
        <AnimatePresence>
          {!gameStarted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center gap-4"
            >
              <Gamepad2 className="h-12 w-12 text-primary animate-pulse" />
              <h3 className="text-xl font-bold">Career Journey</h3>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
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
              className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center gap-4"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <Trophy className="h-16 w-16 text-yellow-400" />
              </motion.div>
              <h3 className="text-2xl font-bold">Journey Complete!</h3>
              <p className="text-sm text-muted-foreground">
                {finalPlatform?.icon} Reached {finalPlatform?.label} at {finalPlatform?.company}
              </p>
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
          aria-label="Move left"
        >
          <ArrowLeft className="h-6 w-6" />
        </motion.button>

        <motion.button
          onTouchStart={handleJump}
          onMouseDown={handleJump}
          className="w-14 h-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
          aria-label="Jump"
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
          aria-label="Move right"
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
