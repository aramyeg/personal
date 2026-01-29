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

// Platform representing a career milestone
export type Platform = {
  x: number
  y: number
  width: number
  label: string    // Role title (shortened)
  year: string     // Start year
  company: string  // Company name
  icon: string     // Emoji icon
  reached: boolean // Has player landed on this?
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

// Overall game state
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
