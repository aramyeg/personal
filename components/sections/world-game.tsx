'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, ArrowUp, Map } from 'lucide-react'

import { getPalette, isDarkMode, type ColorPalette } from '@/lib/game/palette'
import { generateBackground, renderBackground, type BackgroundState } from '@/lib/game/backgrounds'
import {
  createCharacterState,
  updateCharacterAnimation,
  getAnimationFromPhysics,
  renderCharacter,
  type CharacterState,
} from '@/lib/game/character'
// Note: We don't use renderPlatforms from lib/game/platforms because it's
// designed for career-game's experience-based platforms
import {
  createEmitter,
  updateParticles,
  renderParticles,
  emitDust,
  emitSparkles,
  emitConfetti,
  emitTrail,
  emitDamage,
  emitRespawn,
  type ParticleEmitter,
} from '@/lib/game/particles'
import type { GameConfig } from '@/lib/game/types'
import {
  useWorldState,
  useCurrentScreen,
  useUnlockedSkills,
  useSkillState,
  useWorlds,
  createInitialSkillState,
  type SkillState,
  populateLevelData,
  getLevelById,
} from '@/lib/game/world'
import { applySkillPhysics, canTakeDamage, getCollectRadius } from '@/lib/game/world/skillPhysics'
import type { Level, CollectibleConfig } from '@/lib/game/world/types'
import {
  WorldMap,
  LevelComplete,
  SkillUnlock,
} from '@/components/game'

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
const MAP_HEIGHT = 300
const TILE_SIZE = 32

// Debug mode constants (IDDQD easter egg)
const CHEAT_CODE = ['i', 'd', 'd', 'q', 'd']
const DEBUG_DURATION = 30 // seconds
const ALL_SKILLS = ['double_jump', 'wall_slide', 'dash', 'shield', 'magnet', 'float'] as const

// Simple platform type for world mode (different from career-game's Platform)
type WorldPlatform = {
  id: string
  x: number
  y: number
  width: number
  height: number
  type: 'static' | 'moving' | 'skill_gated'
  movementRange?: { startX: number; endX: number; speed: number }
  direction?: number
  requiredSkill?: string
}

// Input state with skill keys
type InputState = {
  left: boolean
  right: boolean
  jump: boolean
  dash: boolean
  shield: boolean
  jumpPressed: boolean
}

// Player state
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
  touchingWallLeft: boolean
  touchingWallRight: boolean
}

function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    width: CONFIG.playerWidth,
    height: CONFIG.playerHeight,
    grounded: false,
    wasGrounded: false,
    facingRight: true,
    invulnerable: false,
    invulnerableTimer: 0,
    touchingWallLeft: false,
    touchingWallRight: false,
  }
}

// Convert level config to game platforms
function levelConfigToPlatforms(level: Level): WorldPlatform[] {
  if (!level.platforms) return []

  return level.platforms.map((config, index) => ({
    id: `platform-${index}`,
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height || 24,
    type: config.type === 'moving' ? 'moving' : config.type === 'skill_gated' ? 'skill_gated' : 'static',
    movementRange: config.movementRange,
    direction: 1,
    requiredSkill: config.requiredSkill,
  }))
}

// Simple platform rendering for world mode
function renderWorldPlatforms(
  ctx: CanvasRenderingContext2D,
  platforms: WorldPlatform[],
  cameraX: number,
  palette: ColorPalette
): void {
  for (const platform of platforms) {
    const screenX = platform.x - cameraX

    // Skip if off-screen
    if (screenX + platform.width < -50 || screenX > ctx.canvas.width + 50) continue

    ctx.save()

    // Platform colors based on type
    if (platform.type === 'skill_gated') {
      // Skill-gated platforms have a special glow
      ctx.fillStyle = 'rgba(168, 85, 247, 0.3)' // Purple glow
      ctx.fillRect(screenX - 2, platform.y - 2, platform.width + 4, platform.height + 4)
      ctx.fillStyle = palette.tech.primary
    } else if (platform.type === 'moving') {
      ctx.fillStyle = palette.ground.surface
    } else {
      ctx.fillStyle = palette.ground.surface
    }

    // Main platform body
    ctx.fillRect(screenX, platform.y, platform.width, platform.height)

    // Top edge highlight
    ctx.fillStyle = palette.ground.highlight
    ctx.fillRect(screenX, platform.y, platform.width, 3)

    // Bottom edge shadow
    ctx.fillStyle = palette.ground.shadow
    ctx.fillRect(screenX, platform.y + platform.height - 2, platform.width, 2)

    ctx.restore()
  }
}

// Collectible type for rendering
type GameCollectible = {
  id: string
  x: number
  y: number
  type: 'tech' | 'coin' | 'powerup'
  collected: boolean
  techName?: string
  points: number
}

function levelCollectiblesToGame(collectibles: CollectibleConfig[]): GameCollectible[] {
  return collectibles.map((c, i) => ({
    id: `collectible-${i}`,
    x: c.x,
    y: c.y,
    type: c.type,
    collected: false,
    techName: c.techName,
    points: c.points ?? (c.type === 'tech' ? 50 : c.type === 'powerup' ? 100 : 10),
  }))
}

export function WorldGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // World state
  const {
    exitToOverworld,
    enterLevel,
    startLevelTimer,
    recordDeath,
    collectLevelItem,
    setLevelCollectibles,
    completeLevel,
    showLevelComplete,
  } = useWorldState()

  const currentScreen = useCurrentScreen()
  const unlockedSkills = useUnlockedSkills()
  const skillState = useSkillState()
  const worlds = useWorlds()

  // Game state
  const [isPlaying, setIsPlaying] = useState(false)
  const [lives, setLives] = useState(3)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [collectedCount, setCollectedCount] = useState(0)
  const [totalCollectibles, setTotalCollectibles] = useState(0)

  // Level data
  const [levelData, setLevelData] = useState<Level | null>(null)
  const [platforms, setPlatforms] = useState<WorldPlatform[]>([])
  const [collectibles, setCollectibles] = useState<GameCollectible[]>([])

  // Theme palette
  const [palette, setPalette] = useState<ColorPalette>(() => getPalette(false))
  const [backgroundState, setBackgroundState] = useState<BackgroundState | null>(null)

  // Player state
  const playerRef = useRef<Player>(createPlayer(40, 140))
  const characterStateRef = useRef<CharacterState>(createCharacterState())

  // Input state
  const keysRef = useRef<InputState>({
    left: false,
    right: false,
    jump: false,
    dash: false,
    shield: false,
    jumpPressed: false,
  })

  // Debug mode (IDDQD easter egg)
  const [debugMode, setDebugMode] = useState(false)
  const [debugTimeRemaining, setDebugTimeRemaining] = useState(0)
  const cheatSequenceRef = useRef<string[]>([])

  // Effective skills (debug mode gives all skills)
  const effectiveSkills = debugMode ? [...ALL_SKILLS] : unlockedSkills

  // Animation and timing
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const gameTimeRef = useRef<number>(0)
  const cameraXRef = useRef(0)

  // Particles
  const particleEmitterRef = useRef<ParticleEmitter>(createEmitter(150))
  const wasInAirRef = useRef(false)

  // Skill state ref
  const skillStateRef = useRef<SkillState>(createInitialSkillState())

  // Level bounds
  const levelBoundsRef = useRef({ minX: 0, maxX: 2000 })

  // Initialize background
  useEffect(() => {
    setBackgroundState(generateBackground(CANVAS_WIDTH, CANVAS_HEIGHT))
  }, [])

  // Update palette on theme change
  useEffect(() => {
    const updatePalette = () => setPalette(getPalette(isDarkMode()))
    updatePalette()

    const observer = new MutationObserver(updatePalette)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  // Sync skill state
  useEffect(() => {
    skillStateRef.current = skillState
  }, [skillState])

  // Debug mode countdown timer
  useEffect(() => {
    if (!debugMode) return

    const interval = setInterval(() => {
      setDebugTimeRemaining((prev) => {
        if (prev <= 1) {
          setDebugMode(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [debugMode])

  // Activate debug mode
  const activateDebugMode = useCallback(() => {
    if (debugMode) return // Already active

    setDebugMode(true)
    setDebugTimeRemaining(DEBUG_DURATION)

    console.log(
      '%c ⚡ GOD MODE ACTIVATED! ⚡ ',
      'background: linear-gradient(90deg, #ffd700, #ff8c00); color: black; padding: 12px 20px; font-size: 18px; font-weight: bold; border-radius: 5px;'
    )
    console.log('%c All skills unlocked for 30 seconds! ', 'color: #ffd700; font-size: 14px;')
  }, [debugMode])

  // Handle starting a level
  // Called after LevelSelectModal calls enterLevel() which sets currentLevelId
  const handleStartLevel = useCallback(() => {
    const levelId = useWorldState.getState().currentLevelId
    if (!levelId) return

    const level = getLevelById(worlds, levelId)
    if (!level) return

    // Populate level with generated content
    const populatedLevel = populateLevelData(level, unlockedSkills)
    setLevelData(populatedLevel)

    // Convert to game formats
    const gamePlatforms = levelConfigToPlatforms(populatedLevel)
    setPlatforms(gamePlatforms)

    const gameCollectibles = levelCollectiblesToGame(populatedLevel.collectibles || [])
    setCollectibles(gameCollectibles)
    setTotalCollectibles(gameCollectibles.length)
    setCollectedCount(0)

    // Set level bounds
    levelBoundsRef.current = {
      minX: 0,
      maxX: populatedLevel.width * TILE_SIZE,
    }

    // Reset player at spawn
    const spawnX = populatedLevel.spawnPoint?.x || 40
    const spawnY = populatedLevel.spawnPoint?.y || 140
    playerRef.current = createPlayer(spawnX, spawnY)
    characterStateRef.current = createCharacterState()
    particleEmitterRef.current = createEmitter(150)
    skillStateRef.current = createInitialSkillState()
    cameraXRef.current = 0
    gameTimeRef.current = 0

    // Reset game state
    setLives(3)
    setScore(0)
    setGameOver(false)

    // Enter level in world state
    enterLevel(levelId)
    startLevelTimer()
    setLevelCollectibles(gameCollectibles.length)
    setIsPlaying(true)
  }, [worlds, unlockedSkills, enterLevel, startLevelTimer, setLevelCollectibles])

  // Respawn player
  const respawnPlayer = useCallback(() => {
    if (!levelData) return

    const spawnX = levelData.spawnPoint?.x || 40
    const spawnY = levelData.spawnPoint?.y || 140

    playerRef.current = {
      ...createPlayer(spawnX, spawnY),
      invulnerable: true,
      invulnerableTimer: 2000,
    }

    particleEmitterRef.current = emitRespawn(
      particleEmitterRef.current,
      spawnX + CONFIG.playerWidth / 2,
      spawnY + CONFIG.playerHeight / 2,
      16
    )
  }, [levelData])

  // Handle death
  const handleDeath = useCallback(() => {
    recordDeath()

    const newLives = lives - 1
    setLives(newLives)

    if (newLives <= 0) {
      setGameOver(true)
      setIsPlaying(false)
    } else {
      respawnPlayer()
    }
  }, [lives, recordDeath, respawnPlayer])

  // Check exit portal collision
  const checkExitCollision = useCallback((player: Player): boolean => {
    if (!levelData?.exitPoint) return false

    const exitX = levelData.exitPoint.x
    const exitY = levelData.exitPoint.y
    const exitWidth = 40
    const exitHeight = 60

    return (
      player.x + player.width > exitX - exitWidth / 2 &&
      player.x < exitX + exitWidth / 2 &&
      player.y + player.height > exitY - exitHeight &&
      player.y < exitY
    )
  }, [levelData])

  // Handle level completion
  const handleLevelComplete = useCallback(() => {
    setIsPlaying(false)

    // completeLevel() calculates stars from worldState's levelDeaths/collectibles
    completeLevel()
    showLevelComplete()

    // Confetti!
    if (levelData?.exitPoint) {
      particleEmitterRef.current = emitConfetti(
        particleEmitterRef.current,
        levelData.exitPoint.x,
        levelData.exitPoint.y - 30,
        30,
        palette
      )
    }
  }, [completeLevel, showLevelComplete, levelData, palette])

  // Game loop
  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !isPlaying || gameOver || !backgroundState || !levelData) return

    const deltaTime = lastTimeRef.current ? timestamp - lastTimeRef.current : 16
    lastTimeRef.current = timestamp
    gameTimeRef.current += deltaTime

    const player = playerRef.current
    const keys = keysRef.current
    const bounds = levelBoundsRef.current

    // Update invulnerability
    if (player.invulnerable) {
      player.invulnerableTimer -= deltaTime
      if (player.invulnerableTimer <= 0) {
        player.invulnerable = false
        player.invulnerableTimer = 0
      }
    }

    player.wasGrounded = player.grounded

    // Handle input
    if (keys.left) {
      player.vx -= CONFIG.moveSpeed * 0.3
      player.facingRight = false
    }
    if (keys.right) {
      player.vx += CONFIG.moveSpeed * 0.3
      player.facingRight = true
    }
    if (keys.jump && player.grounded) {
      player.vy = CONFIG.jumpForce
      player.grounded = false
    }

    // Apply skill physics
    const skillInput = {
      jump: keys.jump,
      jumpPressed: keys.jumpPressed,
      dash: keys.dash,
      shield: keys.shield,
      left: keys.left,
      right: keys.right,
    }

    const playerPhysics = {
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      grounded: player.grounded,
      facingRight: player.facingRight,
      touchingWallLeft: player.touchingWallLeft,
      touchingWallRight: player.touchingWallRight,
    }

    const skillResult = applySkillPhysics(
      playerPhysics,
      skillStateRef.current,
      skillInput,
      effectiveSkills,
      deltaTime
    )

    // Apply skill results
    player.vx = skillResult.physics.vx
    player.vy = skillResult.physics.vy
    player.facingRight = skillResult.physics.facingRight
    skillStateRef.current = skillResult.skillState

    // Reset jump pressed
    keys.jumpPressed = false

    // Apply physics
    player.vx *= CONFIG.friction
    if (!skillResult.effects.isDashing) {
      player.vy += CONFIG.gravity
    }
    player.x += player.vx
    player.y += player.vy

    // Clamp velocity
    player.vx = Math.max(-CONFIG.moveSpeed, Math.min(CONFIG.moveSpeed, player.vx))

    // Level bounds
    player.x = Math.max(bounds.minX, Math.min(bounds.maxX - player.width, player.x))

    // Death zone
    const deathZoneY = CANVAS_HEIGHT + 50
    if (player.y > deathZoneY && !player.invulnerable) {
      if (!skillResult.effects.isShielded && canTakeDamage(effectiveSkills, skillStateRef.current)) {
        particleEmitterRef.current = emitDamage(
          particleEmitterRef.current,
          player.x + player.width / 2,
          CANVAS_HEIGHT,
          15
        )
        handleDeath()
      } else {
        respawnPlayer()
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
    player.touchingWallLeft = false
    player.touchingWallRight = false

    for (const platform of platforms) {
      const platformHeight = platform.height || 24

      // Top collision (landing on platform)
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
      }

      // Side collision (for wall slide)
      const verticalOverlap =
        player.y + player.height > platform.y &&
        player.y < platform.y + platformHeight

      if (verticalOverlap) {
        // Left side of platform
        if (
          player.x + player.width > platform.x &&
          player.x + player.width < platform.x + 10 &&
          player.vx > 0
        ) {
          player.touchingWallLeft = false
          player.touchingWallRight = true
        }
        // Right side of platform
        if (
          player.x < platform.x + platform.width &&
          player.x > platform.x + platform.width - 10 &&
          player.vx < 0
        ) {
          player.touchingWallLeft = true
          player.touchingWallRight = false
        }
      }
    }

    player.grounded = onAnyPlatform

    // Collectible collision
    const collectRadius = getCollectRadius(20, effectiveSkills)
    setCollectibles(prev => {
      let changed = false
      const updated = prev.map(c => {
        if (c.collected) return c

        const dx = (player.x + player.width / 2) - c.x
        const dy = (player.y + player.height / 2) - c.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < collectRadius) {
          changed = true
          setScore(s => s + c.points)
          setCollectedCount(n => n + 1)
          collectLevelItem()

          particleEmitterRef.current = emitSparkles(
            particleEmitterRef.current,
            c.x,
            c.y,
            8,
            palette.tech.primary
          )

          return { ...c, collected: true }
        }
        return c
      })
      return changed ? updated : prev
    })

    // Check exit portal
    if (checkExitCollision(player)) {
      handleLevelComplete()
      return
    }

    // Dust on landing
    if (player.grounded && wasInAirRef.current) {
      particleEmitterRef.current = emitDust(
        particleEmitterRef.current,
        player.x + player.width / 2,
        player.y + player.height,
        5,
        palette
      )
    }
    wasInAirRef.current = !player.grounded

    // Trail when moving fast
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

    // Camera follow with bounds
    const targetCameraX = player.x - CANVAS_WIDTH / 3
    const maxCameraX = bounds.maxX - CANVAS_WIDTH
    cameraXRef.current += (Math.max(0, Math.min(maxCameraX, targetCameraX)) - cameraXRef.current) * 0.1

    // Render
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    renderBackground(ctx, backgroundState, cameraXRef.current, gameTimeRef.current, palette)
    renderWorldPlatforms(ctx, platforms, cameraXRef.current, palette)

    // Render collectibles
    for (const c of collectibles) {
      if (c.collected) continue
      const screenX = c.x - cameraXRef.current
      if (screenX < -20 || screenX > CANVAS_WIDTH + 20) continue

      ctx.save()
      const bobOffset = Math.sin(gameTimeRef.current / 300 + c.x) * 3

      if (c.type === 'tech') {
        // Tech icon
        ctx.fillStyle = palette.tech.primary
        ctx.beginPath()
        ctx.arc(screenX, c.y + bobOffset, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = '8px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('T', screenX, c.y + bobOffset)
      } else {
        // Coin
        ctx.fillStyle = '#ffd700'
        ctx.beginPath()
        ctx.arc(screenX, c.y + bobOffset, 6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // Render exit portal
    if (levelData?.exitPoint) {
      const exitScreenX = levelData.exitPoint.x - cameraXRef.current
      const exitY = levelData.exitPoint.y

      ctx.save()
      // Portal glow
      const gradient = ctx.createRadialGradient(exitScreenX, exitY - 30, 5, exitScreenX, exitY - 30, 30)
      gradient.addColorStop(0, 'rgba(100, 255, 100, 0.8)')
      gradient.addColorStop(0.5, 'rgba(50, 200, 50, 0.4)')
      gradient.addColorStop(1, 'rgba(0, 150, 0, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(exitScreenX - 30, exitY - 60, 60, 60)

      // Portal frame
      ctx.strokeStyle = '#4ade80'
      ctx.lineWidth = 3
      ctx.strokeRect(exitScreenX - 15, exitY - 50, 30, 50)

      // Animated swirl
      const swirl = (gameTimeRef.current / 500) % (Math.PI * 2)
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(exitScreenX, exitY - 25, 10 + Math.sin(swirl) * 3, 0, Math.PI * 2)
      ctx.stroke()

      ctx.restore()
    }

    // Render player
    const screenX = player.x - cameraXRef.current
    const shouldRender = !player.invulnerable || Math.floor(gameTimeRef.current / 100) % 2 === 0
    if (shouldRender) {
      renderCharacter(ctx, screenX, player.y, characterStateRef.current, palette, 1.5)

      // Skill effects
      if (skillResult.effects.isDashing) {
        ctx.save()
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)'
        ctx.lineWidth = 2
        for (let i = 1; i <= 3; i++) {
          ctx.globalAlpha = 0.3 / i
          ctx.strokeRect(
            screenX - i * 5 * (player.facingRight ? 1 : -1),
            player.y,
            player.width,
            player.height
          )
        }
        ctx.restore()
      }

      if (skillResult.effects.isShielded) {
        ctx.save()
        ctx.strokeStyle = 'rgba(100, 255, 100, 0.8)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(
          screenX + player.width / 2,
          player.y + player.height / 2,
          player.width,
          0,
          Math.PI * 2
        )
        ctx.stroke()
        ctx.restore()
      }

      if (skillResult.effects.isFloating) {
        ctx.save()
        ctx.fillStyle = 'rgba(200, 200, 255, 0.3)'
        for (let i = 0; i < 3; i++) {
          const offset = (gameTimeRef.current / 100 + i * 50) % 30
          ctx.beginPath()
          ctx.arc(
            screenX + player.width / 2 + (i - 1) * 8,
            player.y + player.height + offset,
            2,
            0,
            Math.PI * 2
          )
          ctx.fill()
        }
        ctx.restore()
      }
    }

    renderParticles(ctx, particleEmitterRef.current, cameraXRef.current)

    animationRef.current = requestAnimationFrame(gameLoop)
  }, [
    isPlaying,
    gameOver,
    backgroundState,
    levelData,
    platforms,
    collectibles,
    palette,
    effectiveSkills,
    handleDeath,
    respawnPlayer,
    checkExitCollision,
    handleLevelComplete,
    collectLevelItem,
  ])

  // Start/stop game loop
  useEffect(() => {
    if (isPlaying && !gameOver) {
      lastTimeRef.current = 0
      animationRef.current = requestAnimationFrame(gameLoop)
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, gameOver, gameLoop])

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift', 'q'].includes(e.key)) {
        e.preventDefault()
      }
      const keys = keysRef.current
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        if (!keys.jump) keys.jumpPressed = true
        keys.jump = true
      }
      if (e.key === 'Shift') keys.dash = true
      if (e.key === 'q') keys.shield = true

      // IDDQD cheat code detection (only during level gameplay)
      if (isPlaying && !gameOver && currentScreen === 'level') {
        const key = e.key.toLowerCase()
        if (/^[a-z]$/.test(key)) {
          const newSequence = [...cheatSequenceRef.current.slice(-4), key]
          cheatSequenceRef.current = newSequence

          if (newSequence.join('') === CHEAT_CODE.join('')) {
            activateDebugMode()
            cheatSequenceRef.current = []
          }
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const keys = keysRef.current
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') keys.jump = false
      if (e.key === 'Shift') keys.dash = false
      if (e.key === 'q') keys.shield = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isPlaying, gameOver, currentScreen, activateDebugMode])

  // Touch controls
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
    keysRef.current.jumpPressed = true
    keysRef.current.jump = true
    setTimeout(() => {
      keysRef.current.jump = false
    }, 100)
  }, [])

  // Handle exit to overworld
  const handleExitLevel = useCallback(() => {
    setIsPlaying(false)
    exitToOverworld()
  }, [exitToOverworld])

  // Render based on current screen
  const showOverworld = currentScreen === 'overworld'
  const showLevel = currentScreen === 'level'
  const showLevelCompleteScreen = currentScreen === 'level_complete'
  const showSkillUnlockScreen = currentScreen === 'skill_unlock'
  const pendingSkillUnlock = useWorldState.getState().pendingSkillUnlock

  return (
    <div className="relative">
      {/* Overworld Map */}
      <AnimatePresence mode="wait">
        {showOverworld && (
          <motion.div
            key="overworld"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <WorldMap onStartLevel={handleStartLevel} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Gameplay */}
      <AnimatePresence mode="wait">
        {showLevel && (
          <motion.div
            key="level"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative rounded-xl overflow-hidden border border-border bg-background"
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full h-auto"
              style={{ imageRendering: 'pixelated' }}
              tabIndex={0}
            />

            {/* HUD */}
            {isPlaying && !gameOver && (
              <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none z-10">
                {/* Lives */}
                <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className={i < lives ? 'text-red-500' : 'text-gray-400'}>❤️</span>
                  ))}
                </div>

                {/* Score */}
                <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50">
                  <span className="text-yellow-400">⭐</span>
                  <span className="font-mono text-sm">{score}</span>
                </div>

                {/* Collectibles */}
                <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50">
                  <span className="font-mono text-sm">{collectedCount}/{totalCollectibles}</span>
                </div>
              </div>
            )}

            {/* Debug mode indicator */}
            {debugMode && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-12 left-1/2 -translate-x-1/2 z-20"
              >
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold rounded-lg shadow-lg">
                  <span className="text-lg">⚡</span>
                  <span>GOD MODE</span>
                  <span className="font-mono">{debugTimeRemaining}s</span>
                </div>
              </motion.div>
            )}

            {/* Skills indicator */}
            {isPlaying && effectiveSkills.length > 0 && (
              <div className="absolute bottom-2 left-2 flex gap-1">
                {effectiveSkills.map(skillId => (
                  <div
                    key={skillId}
                    className={`w-8 h-8 rounded bg-background/80 backdrop-blur-sm border flex items-center justify-center text-xs ${
                      debugMode ? 'border-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.3)]' : 'border-border/50'
                    }`}
                    title={skillId}
                  >
                    {skillId === 'double_jump' && '⬆️'}
                    {skillId === 'wall_slide' && '🧱'}
                    {skillId === 'dash' && '💨'}
                    {skillId === 'shield' && '🛡️'}
                    {skillId === 'magnet' && '🧲'}
                    {skillId === 'float' && '🎈'}
                  </div>
                ))}
              </div>
            )}

            {/* Exit button */}
            <button
              onClick={handleExitLevel}
              className="absolute top-2 right-2 px-3 py-1 bg-background/80 backdrop-blur-sm rounded-md border border-border/50 text-sm pointer-events-auto hover:bg-background/90 flex items-center gap-1"
            >
              <Map className="h-3 w-3" />
              Exit
            </button>

            {/* Game Over */}
            {gameOver && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                <h2 className="text-2xl font-bold text-red-500">Game Over</h2>
                <p className="text-sm text-muted-foreground">Score: {score}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (levelData) {
                        enterLevel(levelData.id)
                        handleStartLevel()
                      }
                    }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
                  >
                    Retry
                  </button>
                  <button
                    onClick={handleExitLevel}
                    className="px-4 py-2 bg-muted rounded-md"
                  >
                    Exit
                  </button>
                </div>
              </div>
            )}

            {/* Touch controls */}
            <div className="absolute bottom-2 right-2 flex gap-2 md:hidden">
              <button
                onTouchStart={() => handleTouchMove('left')}
                onTouchEnd={handleTouchEnd}
                className="w-12 h-12 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 flex items-center justify-center"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <button
                onTouchStart={() => handleTouchMove('right')}
                onTouchEnd={handleTouchEnd}
                className="w-12 h-12 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 flex items-center justify-center"
              >
                <ArrowRight className="h-6 w-6" />
              </button>
              <button
                onTouchStart={handleJump}
                className="w-12 h-12 bg-primary/80 backdrop-blur-sm rounded-lg border border-primary/50 flex items-center justify-center"
              >
                <ArrowUp className="h-6 w-6" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Complete */}
      <AnimatePresence mode="wait">
        {showLevelCompleteScreen && (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative rounded-xl overflow-hidden border border-border bg-background"
            style={{ height: MAP_HEIGHT }}
          >
            <LevelComplete />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skill Unlock */}
      <AnimatePresence mode="wait">
        {showSkillUnlockScreen && pendingSkillUnlock && (
          <motion.div
            key="unlock"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative rounded-xl overflow-hidden border border-border bg-background"
            style={{ height: MAP_HEIGHT }}
          >
            <SkillUnlock skillId={pendingSkillUnlock} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
