import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createSpriteSheet,
  getAnimationDefinitions,
  getCurrentFrame,
  updateAnimation,
  setAnimation,
} from '@/lib/game/sprites'
import type { SpriteSheet, AnimationState } from '@/lib/game/types'

describe('getAnimationDefinitions', () => {
  it('returns animations for all states', () => {
    const animations = getAnimationDefinitions()

    expect(animations.idle).toBeDefined()
    expect(animations.walking).toBeDefined()
    expect(animations.jumping).toBeDefined()
    expect(animations.landing).toBeDefined()
  })

  it('idle animation has correct properties', () => {
    const animations = getAnimationDefinitions()

    expect(animations.idle.frames.length).toBeGreaterThan(0)
    expect(animations.idle.frameRate).toBeGreaterThan(0)
    expect(animations.idle.loop).toBe(true)
  })

  it('walking animation loops', () => {
    const animations = getAnimationDefinitions()
    expect(animations.walking.loop).toBe(true)
  })

  it('jumping animation does not loop', () => {
    const animations = getAnimationDefinitions()
    expect(animations.jumping.loop).toBe(false)
  })

  it('landing animation does not loop', () => {
    const animations = getAnimationDefinitions()
    expect(animations.landing.loop).toBe(false)
  })

  it('all frames have valid dimensions', () => {
    const animations = getAnimationDefinitions()

    for (const state of Object.keys(animations) as AnimationState[]) {
      for (const frame of animations[state].frames) {
        expect(frame.x).toBeGreaterThanOrEqual(0)
        expect(frame.y).toBeGreaterThanOrEqual(0)
        expect(frame.width).toBeGreaterThan(0)
        expect(frame.height).toBeGreaterThan(0)
      }
    }
  })
})

describe('createSpriteSheet', () => {
  it('creates sprite sheet with null image initially', () => {
    const sheet = createSpriteSheet()

    expect(sheet.image).toBeNull()
  })

  it('initializes with idle animation', () => {
    const sheet = createSpriteSheet()

    expect(sheet.currentAnimation).toBe('idle')
  })

  it('starts at frame 0', () => {
    const sheet = createSpriteSheet()

    expect(sheet.currentFrame).toBe(0)
  })

  it('includes all animation definitions', () => {
    const sheet = createSpriteSheet()

    expect(sheet.animations.idle).toBeDefined()
    expect(sheet.animations.walking).toBeDefined()
    expect(sheet.animations.jumping).toBeDefined()
    expect(sheet.animations.landing).toBeDefined()
  })
})

describe('getCurrentFrame', () => {
  it('returns current frame from active animation', () => {
    const sheet = createSpriteSheet()
    const frame = getCurrentFrame(sheet)

    expect(frame).toEqual(sheet.animations.idle.frames[0])
  })

  it('returns correct frame after animation update', () => {
    let sheet = createSpriteSheet()
    sheet = { ...sheet, currentFrame: 1 }

    const frame = getCurrentFrame(sheet)

    expect(frame).toEqual(sheet.animations.idle.frames[1])
  })
})

describe('updateAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('advances frame when enough time has passed', () => {
    const sheet = createSpriteSheet()
    const frameTime = 1000 / sheet.animations.idle.frameRate

    // Advance time past one frame
    const updated = updateAnimation(sheet, sheet.lastFrameTime + frameTime + 1)

    expect(updated.currentFrame).toBe(1)
  })

  it('does not advance frame before frame duration', () => {
    const sheet = createSpriteSheet()
    const frameTime = 1000 / sheet.animations.idle.frameRate

    const updated = updateAnimation(sheet, sheet.lastFrameTime + frameTime / 2)

    expect(updated.currentFrame).toBe(0)
  })

  it('loops animation when loop is true', () => {
    let sheet = createSpriteSheet()
    const animation = sheet.animations.idle
    const lastFrameIndex = animation.frames.length - 1

    // Set to last frame
    sheet = { ...sheet, currentFrame: lastFrameIndex }

    const frameTime = 1000 / animation.frameRate
    const updated = updateAnimation(sheet, sheet.lastFrameTime + frameTime + 1)

    expect(updated.currentFrame).toBe(0) // Should loop back
  })

  it('stays on last frame when loop is false', () => {
    let sheet = createSpriteSheet()
    sheet = setAnimation(sheet, 'jumping') // jumping does not loop

    const animation = sheet.animations.jumping
    const lastFrameIndex = animation.frames.length - 1

    // Set to last frame
    sheet = { ...sheet, currentFrame: lastFrameIndex }

    const frameTime = 1000 / animation.frameRate
    const updated = updateAnimation(sheet, sheet.lastFrameTime + frameTime + 1)

    expect(updated.currentFrame).toBe(lastFrameIndex) // Should stay on last
  })

  it('updates lastFrameTime when frame advances', () => {
    const sheet = createSpriteSheet()
    const frameTime = 1000 / sheet.animations.idle.frameRate
    const newTime = sheet.lastFrameTime + frameTime + 1

    const updated = updateAnimation(sheet, newTime)

    expect(updated.lastFrameTime).toBe(newTime)
  })
})

describe('setAnimation', () => {
  it('changes current animation', () => {
    const sheet = createSpriteSheet()
    const updated = setAnimation(sheet, 'walking')

    expect(updated.currentAnimation).toBe('walking')
  })

  it('resets frame to 0 when animation changes', () => {
    let sheet = createSpriteSheet()
    sheet = { ...sheet, currentFrame: 2 }

    const updated = setAnimation(sheet, 'walking')

    expect(updated.currentFrame).toBe(0)
  })

  it('does not reset frame when same animation', () => {
    let sheet = createSpriteSheet()
    sheet = { ...sheet, currentFrame: 2 }

    const updated = setAnimation(sheet, 'idle')

    expect(updated.currentFrame).toBe(2)
  })

  it('preserves other sprite sheet properties', () => {
    const sheet = createSpriteSheet()
    const updated = setAnimation(sheet, 'jumping')

    expect(updated.animations).toBe(sheet.animations)
    expect(updated.image).toBe(sheet.image)
  })
})
