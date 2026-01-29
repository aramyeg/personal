'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Trophy, Star } from 'lucide-react'

import { experiences } from '@/data'
import { getPalette, isDarkMode, type ColorPalette } from '@/lib/game/palette'
import { generateBackground, renderBackground, type BackgroundState } from '@/lib/game/backgrounds'
import {
  createCharacterState,
  updateCharacterAnimation,
  getAnimationFromPhysics,
  renderCharacter,
  type CharacterState,
} from '@/lib/game/character'
import {
  generatePlatforms,
  renderPlatforms,
  updatePlatform,
} from '@/lib/game/platforms'
import {
  generateCollectibles,
  renderCollectibles,
  checkCollectibleCollision,
  getCollectibleValue,
  getCollectiblePowerUp,
  type Collectible,
} from '@/lib/game/collectibles'
import {
  createEmitter,
  updateParticles,
  renderParticles,
  emitDust,
  emitSparkles,
  emitStarBurst,
  emitConfetti,
  emitTrail,
  emitDamage,
  emitRespawn,
  type ParticleEmitter,
} from '@/lib/game/particles'
import type { Platform, GameConfig, InputState } from '@/lib/game/types'
import {
  useGameState,
  useLives,
  useScore,
  useIsGameOver,
  useIsGameWon,
  useIsGameStarted,
  useActivePowerUps,
  GAME_MODE_CONFIGS,
} from '@/lib/game/gameState'
import { GameHUD, GameOverScreen, ExperiencePopupCard } from '@/components/game'
import type { Experience } from '@/types'

// Game configuration
const CONFIG: GameConfig = {
  gravity: 0.5,
  jumpForce: -11,
  moveSpeed: 4,
  friction: 0.85,
  playerWidth: 16,
  playerHeight: 24,
}

// Canvas dimensions
const CANVAS_WIDTH = 620
const CANVAS_HEIGHT = 220

// Death zone (below canvas)
const DEATH_ZONE_Y = CANVAS_HEIGHT + 50

// Player state type
type Player = {
  x: number
  y: number
  vx: number
  vy: number
  width: number
  height: number
  grounded: boolean
  wasGrounded: boolean
  facingRight: boolean
  invulnerable: boolean
  invulnerableTimer: number
}

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
    wasGrounded: false,
    facingRight: true,
    invulnerable: false,
    invulnerableTimer: 0,
  }
}

export function CareerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentExperience, setCurrentExperience] = useState<Experience | null>(null)

  // Game state from Zustand store
  const {
    initGame,
    startGame,
    resetGame: resetGameState,
    loseLife,
    addScore,
    reachPlatform,
    collectTech,
    updateGameTime,
    setGameWon,
    getCheckpointIndex,
    activatePowerUp,
    updatePowerUps,
    hasPowerUp,
    getPowerUpMultiplier,
    mode,
  } = useGameState()

  const lives = useLives()
  const score = useScore()
  const gameOver = useIsGameOver()
  const gameWon = useIsGameWon()
  const gameStarted = useIsGameStarted()
  const activePowerUps = useActivePowerUps()

  // Theme-aware palette
  const [palette, setPalette] = useState<ColorPalette>(() => getPalette(false))

  // Generate platforms from experience data
  const initialPlatforms = useMemo(
    () => generatePlatforms(experiences, CANVAS_WIDTH, CANVAS_HEIGHT),
    []
  )
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms)

  // Generate collectibles
  const initialCollectibles = useMemo(
    () => generateCollectibles(initialPlatforms, 15),
    [initialPlatforms]
  )
  const [collectibles, setCollectibles] = useState<Collectible[]>(initialCollectibles)

  // Generate background
  const [backgroundState, setBackgroundState] = useState<BackgroundState | null>(null)

  // Player state
  const playerRef = useRef<Player>(createPlayer(40, 140))

  // Character animation state
  const characterStateRef = useRef<CharacterState>(createCharacterState())

  // Input state
  const keysRef = useRef<InputState>({ left: false, right: false, jump: false })
  const animationRef = useRef<number | null>(null)

  // Time tracking
  const lastTimeRef = useRef<number>(0)
  const gameTimeRef = useRef<number>(0)

  // Camera position for parallax
  const cameraXRef = useRef(0)

  // Particle emitter
  const particleEmitterRef = useRef<ParticleEmitter>(createEmitter(150))

  // Track landing state for dust emission
  const wasInAirRef = useRef(false)

  // Initialize background on mount
  useEffect(() => {
    setBackgroundState(generateBackground(CANVAS_WIDTH, CANVAS_HEIGHT))
  }, [])

  // Initialize game state
  useEffect(() => {
    initGame('classic', initialPlatforms.length, initialCollectibles.length)
  }, [initGame, initialPlatforms.length, initialCollectibles.length])

  // Update palette on theme change
  useEffect(() => {
    const updatePalette = () => {
      setPalette(getPalette(isDarkMode()))
    }

    updatePalette()

    const observer = new MutationObserver(updatePalette)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  /**
   * Respawns player at checkpoint or start
   */
  const respawnPlayer = useCallback(() => {
    const checkpointIndex = getCheckpointIndex()
    let respawnX = 40
    let respawnY = 140

    if (checkpointIndex >= 0 && checkpointIndex < platforms.length) {
      const checkpoint = platforms[checkpointIndex]
      respawnX = checkpoint.x + 20
      respawnY = checkpoint.y - CONFIG.playerHeight - 10
    }

    // Reset player state
    playerRef.current = {
      ...createPlayer(respawnX, respawnY),
      invulnerable: true,
      invulnerableTimer: 2000, // 2 seconds of invulnerability
    }

    // Emit respawn particles
    particleEmitterRef.current = emitRespawn(
      particleEmitterRef.current,
      respawnX + CONFIG.playerWidth / 2,
      respawnY + CONFIG.playerHeight / 2,
      16
    )
  }, [getCheckpointIndex, platforms])

  const resetGame = useCallback(() => {
    playerRef.current = createPlayer(40, 140)
    characterStateRef.current = createCharacterState()
    particleEmitterRef.current = createEmitter(150)
    wasInAirRef.current = false
    setPlatforms(initialPlatforms)
    setCollectibles(initialCollectibles)
    setCurrentExperience(null)
    cameraXRef.current = 0
    gameTimeRef.current = 0
    resetGameState()
  }, [initialPlatforms, initialCollectibles, resetGameState])

  const handleStartGame = useCallback(() => {
    resetGame()
    startGame()
  }, [resetGame, startGame])

  const handleReturnToMenu = useCallback(() => {
    resetGame()
  }, [resetGame])

  const gameLoop = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx || !gameStarted || gameOver || gameWon || !backgroundState) return

      // Calculate delta time
      const deltaTime = lastTimeRef.current ? timestamp - lastTimeRef.current : 16
      lastTimeRef.current = timestamp
      gameTimeRef.current += deltaTime
      updateGameTime(deltaTime)
      updatePowerUps() // Clean up expired power-ups

      const player = playerRef.current
      const keys = keysRef.current

      // Update invulnerability timer
      if (player.invulnerable) {
        player.invulnerableTimer -= deltaTime
        if (player.invulnerableTimer <= 0) {
          player.invulnerable = false
          player.invulnerableTimer = 0
        }
      }

      // Store previous grounded state
      player.wasGrounded = player.grounded

      // Get power-up multipliers
      const speedMultiplier = getPowerUpMultiplier('speed')
      const jumpMultiplier = getPowerUpMultiplier('jump')
      const effectiveSpeed = CONFIG.moveSpeed * speedMultiplier
      const effectiveJump = CONFIG.jumpForce * jumpMultiplier

      // Handle input
      if (keys.left) {
        player.vx -= effectiveSpeed * 0.3
        player.facingRight = false
      }
      if (keys.right) {
        player.vx += effectiveSpeed * 0.3
        player.facingRight = true
      }
      if (keys.jump && player.grounded) {
        player.vy = effectiveJump
        player.grounded = false
      }

      // Apply physics
      player.vx *= CONFIG.friction
      player.vy += CONFIG.gravity
      player.x += player.vx
      player.y += player.vy

      // Clamp velocity (with power-up boost)
      player.vx = Math.max(-effectiveSpeed, Math.min(effectiveSpeed, player.vx))

      // World bounds (horizontal only - can fall off bottom)
      player.x = Math.max(0, player.x)

      // Check death zone (fell off screen)
      if (player.y > DEATH_ZONE_Y && !player.invulnerable) {
        // Shield power-up protects from death
        if (hasPowerUp('shield')) {
          // Emit respawn particles and reset position
          particleEmitterRef.current = emitRespawn(
            particleEmitterRef.current,
            player.x + player.width / 2,
            CANVAS_HEIGHT - 50,
            12
          )
          respawnPlayer()
        } else {
          // Emit damage particles at last known position
          particleEmitterRef.current = emitDamage(
            particleEmitterRef.current,
            player.x + player.width / 2,
            CANVAS_HEIGHT,
            15
          )

          const isGameOver = loseLife()

          if (!isGameOver) {
            // Respawn at checkpoint
            respawnPlayer()
          }
        }
      }

      // Ground collision
      const groundY = CANVAS_HEIGHT - 20
      if (player.y + player.height > groundY) {
        player.y = groundY - player.height
        player.vy = 0
        player.grounded = true
      }

      // Platform collision
      let onAnyPlatform = player.y + player.height >= groundY

      setPlatforms((prev) => {
        let updated = false
        const newPlatforms = prev.map((platform, index) => {
          const platformHeight = platform.height || 28
          const onPlatform =
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width &&
            player.y + player.height >= platform.y &&
            player.y + player.height <= platform.y + platformHeight &&
            player.vy >= 0

          if (onPlatform) {
            player.y = platform.y - player.height
            player.vy = 0
            player.grounded = true
            onAnyPlatform = true

            if (!platform.reached) {
              updated = true
              // Find the experience data for this platform
              const experience = experiences.find(exp => exp.id === platform.experienceId)
              if (experience) {
                setCurrentExperience(experience)
              }

              // Update game state
              reachPlatform(index)

              // Emit star burst for reaching milestone
              particleEmitterRef.current = emitStarBurst(
                particleEmitterRef.current,
                platform.x + platform.width / 2,
                platform.y,
                12,
                palette
              )

              // Check if this is the final platform
              if (index === prev.length - 1) {
                setGameWon()
                // Emit confetti for winning
                particleEmitterRef.current = emitConfetti(
                  particleEmitterRef.current,
                  platform.x + platform.width / 2,
                  platform.y - 20,
                  30,
                  palette
                )
              }

              return { ...platform, reached: true }
            }
          }

          // Update platform glow animation
          return updatePlatform(platform, deltaTime)
        })
        return updated ? newPlatforms : prev
      })

      player.grounded = onAnyPlatform

      // Check collectible collisions
      const collisionResult = checkCollectibleCollision(
        player.x,
        player.y,
        player.width,
        player.height,
        collectibles
      )

      if (collisionResult.collected.length > 0) {
        setCollectibles(collisionResult.collectibles)

        // Update game state for each collected item
        collisionResult.collected.forEach((c) => {
          collectTech(c.type, getCollectibleValue(c.type))

          // Check if collectible grants a power-up
          const powerUpGrant = getCollectiblePowerUp(c.type)
          if (powerUpGrant && GAME_MODE_CONFIGS[mode].powerUpsEnabled) {
            activatePowerUp(powerUpGrant.powerUp, powerUpGrant.duration)
          }

          // Emit sparkles for collected items
          particleEmitterRef.current = emitSparkles(
            particleEmitterRef.current,
            c.x + 4,
            c.y + 4,
            8,
            palette.tech.primary
          )
        })
      }

      // Emit dust particles when landing
      const justLanded = player.grounded && wasInAirRef.current
      if (justLanded) {
        particleEmitterRef.current = emitDust(
          particleEmitterRef.current,
          player.x + player.width / 2,
          player.y + player.height,
          5,
          palette
        )
      }
      wasInAirRef.current = !player.grounded

      // Emit trail when moving fast
      if (Math.abs(player.vx) > 2 && player.grounded) {
        particleEmitterRef.current = emitTrail(
          particleEmitterRef.current,
          player.x + player.width / 2,
          player.y + player.height - 2,
          palette
        )
      }

      // Update particles
      particleEmitterRef.current = updateParticles(particleEmitterRef.current, deltaTime)

      // Update character animation
      const newAnimation = getAnimationFromPhysics(
        player.grounded,
        player.wasGrounded,
        player.vy,
        player.vx,
        characterStateRef.current.animation
      )
      characterStateRef.current = updateCharacterAnimation(
        characterStateRef.current,
        deltaTime,
        newAnimation
      )
      characterStateRef.current = {
        ...characterStateRef.current,
        facingRight: player.facingRight,
      }

      // Update camera (follow player with smooth lag)
      const targetCameraX = player.x - CANVAS_WIDTH / 3
      cameraXRef.current += (targetCameraX - cameraXRef.current) * 0.1

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Render beautiful parallax background
      renderBackground(ctx, backgroundState, cameraXRef.current, gameTimeRef.current, palette)

      // Render platforms
      renderPlatforms(ctx, platforms, cameraXRef.current, gameTimeRef.current, palette)

      // Render collectibles
      renderCollectibles(ctx, collectibles, cameraXRef.current, gameTimeRef.current, palette)

      // Render character (with flashing effect if invulnerable)
      const screenX = player.x - cameraXRef.current
      const shouldRender = !player.invulnerable || Math.floor(gameTimeRef.current / 100) % 2 === 0
      if (shouldRender) {
        renderCharacter(ctx, screenX, player.y, characterStateRef.current, palette, 1.5)
      }

      // Render particles (on top of character)
      renderParticles(ctx, particleEmitterRef.current, cameraXRef.current)

      animationRef.current = requestAnimationFrame(gameLoop)
    },
    [
      gameStarted,
      gameOver,
      gameWon,
      platforms,
      collectibles,
      palette,
      backgroundState,
      updateGameTime,
      updatePowerUps,
      loseLife,
      respawnPlayer,
      reachPlatform,
      setGameWon,
      collectTech,
      activatePowerUp,
      hasPowerUp,
      getPowerUpMultiplier,
      mode,
    ]
  )

  useEffect(() => {
    if (gameStarted && !gameWon && !gameOver) {
      lastTimeRef.current = 0
      animationRef.current = requestAnimationFrame(gameLoop)
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameStarted, gameWon, gameOver, gameLoop])

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
    ? `Journey Complete! Reached ${finalPlatform?.label} at ${finalPlatform?.company}. Score: ${score}`
    : gameOver
    ? `Game Over! Score: ${score}`
    : currentExperience
    ? `Reached ${currentExperience.company}: ${currentExperience.role}`
    : null

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

        {/* HUD overlay */}
        {gameStarted && !gameOver && !gameWon && <GameHUD />}

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
                Collect tech icons and reach each company platform.
              </p>
              <p className="text-xs text-muted-foreground">
                You have {GAME_MODE_CONFIGS[mode].lives} lives. Don&apos;t fall!
              </p>
              <motion.button
                onClick={handleStartGame}
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Game
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Over overlay */}
        <AnimatePresence>
          {gameOver && (
            <GameOverScreen onRetry={handleStartGame} onMainMenu={handleReturnToMenu} />
          )}
        </AnimatePresence>

        {/* Win overlay */}
        <AnimatePresence>
          {gameWon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center gap-4 z-20"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <Trophy className="h-16 w-16 text-yellow-400" />
              </motion.div>
              <h3 className="text-2xl font-bold">Journey Complete!</h3>
              <div className="flex items-center gap-2 text-lg font-medium text-primary">
                <Star className="h-5 w-5 fill-current" />
                Score: {score}
              </div>
              <p className="text-sm text-muted-foreground">
                {finalPlatform?.icon} Reached {finalPlatform?.label} at {finalPlatform?.company}
              </p>
              {lives === GAME_MODE_CONFIGS[mode].lives && (
                <p className="text-xs text-green-500 font-medium">
                  Flawless run - no lives lost!
                </p>
              )}
              <motion.button
                onClick={handleStartGame}
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

        {/* Experience popup card */}
        <AnimatePresence>
          {currentExperience && !gameOver && !gameWon && (
            <ExperiencePopupCard
              experience={currentExperience}
              onDismiss={() => setCurrentExperience(null)}
            />
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
