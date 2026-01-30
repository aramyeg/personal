/**
 * Game Type Definitions
 * Central types for the career platformer game
 */

// Animation states for the player character
export type AnimationState = 'idle' | 'walking' | 'jumping' | 'landing'

// Single frame in a sprite sheet
export type SpriteFrame = {
  x: number      // X position in sprite sheet (pixels)
  y: number      // Y position in sprite sheet (pixels)
  width: number  // Frame width (typically 32)
  height: number // Frame height (typically 32)
}

// Animation definition with frames and timing
export type Animation = {
  frames: SpriteFrame[]
  frameRate: number  // Frames per second
  loop: boolean      // Whether to loop or stop at last frame
}

// Complete sprite sheet state
export type SpriteSheet = {
  image: HTMLImageElement | null
  animations: Record<AnimationState, Animation>
  currentFrame: number
  currentAnimation: AnimationState
  lastFrameTime: number
}

// Player character state
export type Player = {
  x: number
  y: number
  vx: number       // Velocity X
  vy: number       // Velocity Y
  width: number
  height: number
  grounded: boolean
  facingRight: boolean
  animationState: AnimationState
}

// Platform visual styles
export type PlatformStyle =
  | 'tech_block'    // Circuit board pattern
  | 'code_block'    // Syntax-highlighted code
  | 'server_rack'   // Server/infrastructure
  | 'mobile_device' // Phone/tablet shape
  | 'cloud'         // Cloud platform
  | 'terminal'      // Command line terminal

// Platform representing a career milestone
export type Platform = {
  x: number
  y: number
  width: number
  height: number   // Added for varied platform heights
  style: PlatformStyle
  label: string    // Role title (shortened)
  subLabel?: string // Additional info (year, period)
  year: string     // Start year
  company: string  // Company name
  icon: string     // Emoji icon
  reached: boolean // Has player landed on this?
  glowIntensity: number // 0-1, animated when reached
  // Experience link
  experienceId: string  // Links to experience data
  technologies: string[] // Technologies for context-aware collectibles
  // Style-specific properties
  circuitSeed?: number  // For deterministic circuit patterns
  codeLines?: string[]  // For code_block style
  serverLights?: boolean[] // For server_rack style
}

// Parallax background element
export type ParallaxElement = {
  type: 'mountain' | 'building' | 'cloud' | 'tree'
  x: number
  y: number
  width: number
  height: number
  color: string
}

// Single parallax layer (multiple elements at same depth)
export type ParallaxLayer = {
  elements: ParallaxElement[]
  speed: number   // 0-1, movement relative to camera (0 = static, 1 = full)
  yOffset: number // Vertical position from bottom
}

// Theme-aware game colors
export type GameColors = {
  background: string
  backgroundAlt: string
  ground: string
  groundHighlight: string
  platformDefault: string
  platformHighlight: string
  platformReached: string
  platformReachedHighlight: string
  text: string
  textMuted: string
}

// Game configuration constants
export type GameConfig = {
  gravity: number
  jumpForce: number
  moveSpeed: number
  friction: number
  playerWidth: number
  playerHeight: number
}

// Input state for keyboard/touch controls
export type InputState = {
  left: boolean
  right: boolean
  jump: boolean
}

// Overall game state (legacy, kept for compatibility)
export type GameState = {
  player: Player
  platforms: Platform[]
  colors: GameColors
  parallaxLayers: ParallaxLayer[]
  config: GameConfig
  gameStarted: boolean
  gameWon: boolean
  currentMilestone: string | null
  cameraX: number
}

// ============================================
// GAME MODES
// ============================================

export type GameMode = 'classic' | 'speedrun' | 'hardcore'

export type GameModeConfig = {
  id: GameMode
  name: string
  description: string
  icon: string
  lives: number
  hasTimer: boolean
  targetTime?: number      // ms for speedrun
  hasCheckpoints: boolean
  scoreMultiplier: number
  powerUpsEnabled: boolean
}

// ============================================
// POWER-UPS
// ============================================

export type PowerUpType = 'speed_boost' | 'super_jump' | 'shield' | 'magnet'

export type PowerUpConfig = {
  type: PowerUpType
  name: string
  description: string
  duration: number      // ms
  icon: string          // Emoji
  color: string         // Primary color
  effect: {
    speedMultiplier?: number
    jumpMultiplier?: number
    invincible?: boolean
    magnetRadius?: number
  }
}

export type ActivePowerUp = {
  type: PowerUpType
  expiresAt: number    // Timestamp when effect ends
  duration: number     // Total duration for UI progress
}

export type PowerUpCollectible = {
  x: number
  y: number
  type: PowerUpType
  collected: boolean
  animOffset: number
}

// ============================================
// ACHIEVEMENTS
// ============================================

export type AchievementId =
  | 'first_platform'
  | 'all_platforms'
  | 'first_tech'
  | 'all_tech'
  | 'speedrun_60s'
  | 'speedrun_30s'
  | 'no_damage'
  | 'collector'
  | 'hardcore_complete'

export type Achievement = {
  id: AchievementId
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: number   // Timestamp
}

// ============================================
// EXTENDED GAME STATE
// ============================================

export type ExtendedGameState = {
  // Game mode
  mode: GameMode

  // Lives system
  lives: number
  maxLives: number

  // Game flow
  gameStarted: boolean
  gamePaused: boolean
  gameOver: boolean
  gameWon: boolean

  // Timing
  gameTime: number      // Elapsed ms
  timeLimit: number | null

  // Score
  score: number
  scoreMultiplier: number

  // Power-ups
  activePowerUps: ActivePowerUp[]

  // Platform progress
  platformsReached: number
  totalPlatforms: number
  currentPlatformIndex: number | null
  lastCheckpointIndex: number

  // Collectibles
  techCollected: string[]
  totalCollectibles: number
  collectiblesCollected: number

  // Achievements
  achievements: Achievement[]
  recentAchievement: Achievement | null
}
