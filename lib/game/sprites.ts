/**
 * Sprite Animation System
 * Handles sprite sheet loading and frame-based animation
 */

import type { Animation, AnimationState, SpriteFrame, SpriteSheet } from './types'

// Standard frame dimensions for pixel art character
const FRAME_WIDTH = 32
const FRAME_HEIGHT = 32

/**
 * Creates sprite frame definitions for a row of frames
 * @param row - Row index in sprite sheet (0-indexed)
 * @param count - Number of frames in the row
 * @returns Array of SpriteFrame objects
 */
function createFrameRow(row: number, count: number): SpriteFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    x: i * FRAME_WIDTH,
    y: row * FRAME_HEIGHT,
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
  }))
}

/**
 * Gets animation definitions for all character states
 * Layout assumes standard platformer sprite sheet:
 * - Row 0: Idle (4 frames, looping)
 * - Row 1: Walking (6 frames, looping)
 * - Row 2: Jumping (2 frames, not looping)
 * - Row 3: Landing (2 frames, not looping)
 *
 * @returns Record of AnimationState to Animation
 */
export function getAnimationDefinitions(): Record<AnimationState, Animation> {
  return {
    idle: {
      frames: createFrameRow(0, 4),
      frameRate: 6, // Slow, relaxed idle
      loop: true,
    },
    walking: {
      frames: createFrameRow(1, 6),
      frameRate: 10, // Moderate walk speed
      loop: true,
    },
    jumping: {
      frames: createFrameRow(2, 2),
      frameRate: 8,
      loop: false, // Hold last frame while in air
    },
    landing: {
      frames: createFrameRow(3, 2),
      frameRate: 12, // Quick landing recovery
      loop: false,
    },
  }
}

/**
 * Creates a new sprite sheet with default values
 * Image must be loaded separately and assigned
 *
 * @returns New SpriteSheet object
 */
export function createSpriteSheet(): SpriteSheet {
  return {
    image: null,
    animations: getAnimationDefinitions(),
    currentFrame: 0,
    currentAnimation: 'idle',
    lastFrameTime: 0,
  }
}

/**
 * Gets the current frame from the active animation
 *
 * @param sheet - Current sprite sheet state
 * @returns The current SpriteFrame
 */
export function getCurrentFrame(sheet: SpriteSheet): SpriteFrame {
  const animation = sheet.animations[sheet.currentAnimation]
  return animation.frames[sheet.currentFrame]
}

/**
 * Updates animation state based on elapsed time
 * Advances frames according to frameRate
 *
 * @param sheet - Current sprite sheet state
 * @param currentTime - Current timestamp in milliseconds
 * @returns Updated SpriteSheet (immutable)
 */
export function updateAnimation(sheet: SpriteSheet, currentTime: number): SpriteSheet {
  const animation = sheet.animations[sheet.currentAnimation]
  const frameDuration = 1000 / animation.frameRate

  // Check if enough time has passed for next frame
  if (currentTime - sheet.lastFrameTime < frameDuration) {
    return sheet
  }

  const totalFrames = animation.frames.length
  let nextFrame = sheet.currentFrame + 1

  // Handle end of animation
  if (nextFrame >= totalFrames) {
    if (animation.loop) {
      nextFrame = 0 // Loop back to start
    } else {
      nextFrame = totalFrames - 1 // Stay on last frame
    }
  }

  return {
    ...sheet,
    currentFrame: nextFrame,
    lastFrameTime: currentTime,
  }
}

/**
 * Changes the current animation state
 * Resets frame to 0 only if animation actually changes
 *
 * @param sheet - Current sprite sheet state
 * @param animation - New animation state to switch to
 * @returns Updated SpriteSheet (immutable)
 */
export function setAnimation(sheet: SpriteSheet, animation: AnimationState): SpriteSheet {
  // Don't reset if already on this animation
  if (sheet.currentAnimation === animation) {
    return sheet
  }

  return {
    ...sheet,
    currentAnimation: animation,
    currentFrame: 0,
  }
}

/**
 * Loads a sprite sheet image from URL
 * Returns a promise that resolves when image is loaded
 *
 * @param url - URL of the sprite sheet image
 * @returns Promise resolving to HTMLImageElement
 */
export function loadSpriteImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load sprite image: ${url}`))
    image.src = url
  })
}

/**
 * Determines animation state based on player physics
 *
 * @param grounded - Is player on ground
 * @param vy - Vertical velocity
 * @param vx - Horizontal velocity
 * @param wasGrounded - Was player grounded last frame
 * @returns Appropriate AnimationState
 */
export function getAnimationFromPhysics(
  grounded: boolean,
  vy: number,
  vx: number,
  wasGrounded: boolean
): AnimationState {
  // Just landed - play landing animation
  if (grounded && !wasGrounded) {
    return 'landing'
  }

  // In the air
  if (!grounded) {
    return 'jumping'
  }

  // On ground and moving
  if (Math.abs(vx) > 0.1) {
    return 'walking'
  }

  // On ground and stationary
  return 'idle'
}
