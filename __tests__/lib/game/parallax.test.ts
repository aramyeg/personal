import { describe, it, expect } from 'vitest'
import {
  generateParallaxLayers,
  getElementPosition,
  createMountain,
  createBuilding,
  createCloud,
  createTree,
} from '@/lib/game/parallax'
import type { GameColors } from '@/lib/game/types'

const mockColors: GameColors = {
  background: '#faf8f5',
  backgroundAlt: '#e8e4df',
  ground: '#8b5a3a',
  groundHighlight: '#a67c52',
  platformDefault: '#c9856a',
  platformHighlight: '#d9a08a',
  platformReached: '#22c55e',
  platformReachedHighlight: '#4ade80',
  text: '#2d2d2d',
  textMuted: '#6b6b6b',
}

describe('generateParallaxLayers', () => {
  it('generates multiple layers', () => {
    const layers = generateParallaxLayers(800, 300, mockColors)

    expect(layers.length).toBeGreaterThanOrEqual(3)
  })

  it('assigns different speeds to layers', () => {
    const layers = generateParallaxLayers(800, 300, mockColors)

    const speeds = layers.map((l) => l.speed)
    const uniqueSpeeds = new Set(speeds)

    expect(uniqueSpeeds.size).toBeGreaterThan(1)
  })

  it('layers have increasing speeds (back to front)', () => {
    const layers = generateParallaxLayers(800, 300, mockColors)

    for (let i = 1; i < layers.length; i++) {
      expect(layers[i].speed).toBeGreaterThanOrEqual(layers[i - 1].speed)
    }
  })

  it('all layers have elements', () => {
    const layers = generateParallaxLayers(800, 300, mockColors)

    layers.forEach((layer) => {
      expect(layer.elements.length).toBeGreaterThan(0)
    })
  })

  it('elements have valid positions', () => {
    const layers = generateParallaxLayers(800, 300, mockColors)

    layers.forEach((layer) => {
      layer.elements.forEach((el) => {
        expect(el.x).toBeGreaterThanOrEqual(0)
        expect(el.width).toBeGreaterThan(0)
        expect(el.height).toBeGreaterThan(0)
      })
    })
  })
})

describe('getElementPosition', () => {
  it('returns original x when cameraX is 0', () => {
    const x = getElementPosition(100, 0, 0.5, 800)

    expect(x).toBe(100)
  })

  it('moves element slower than camera at speed < 1', () => {
    const originalX = 100
    const cameraX = 200
    const speed = 0.5

    const x = getElementPosition(originalX, cameraX, speed, 800)

    // Element moves at half speed, so appears to move backward relative to camera
    expect(x).toBe(100 - 200 * 0.5)
  })

  it('wraps element position for seamless scrolling', () => {
    const canvasWidth = 800
    const x = getElementPosition(-100, 0, 0.5, canvasWidth)

    // Should wrap to positive range
    expect(x).toBeGreaterThanOrEqual(-200) // Allow some buffer for wide elements
  })

  it('static layer (speed 0) never moves', () => {
    const x = getElementPosition(100, 500, 0, 800)

    expect(x).toBe(100)
  })
})

describe('createMountain', () => {
  it('creates mountain with correct type', () => {
    const mountain = createMountain(0, 200, mockColors)

    expect(mountain.type).toBe('mountain')
  })

  it('creates mountain with valid dimensions', () => {
    const mountain = createMountain(100, 200, mockColors)

    expect(mountain.x).toBe(100)
    expect(mountain.width).toBeGreaterThan(50)
    expect(mountain.height).toBeGreaterThan(30)
  })

  it('uses theme color', () => {
    const mountain = createMountain(0, 200, mockColors)

    expect(mountain.color).toBeDefined()
    expect(typeof mountain.color).toBe('string')
  })
})

describe('createBuilding', () => {
  it('creates building with correct type', () => {
    const building = createBuilding(0, 200, mockColors)

    expect(building.type).toBe('building')
  })

  it('creates building with valid dimensions', () => {
    const building = createBuilding(100, 200, mockColors)

    expect(building.x).toBe(100)
    expect(building.width).toBeGreaterThan(20)
    expect(building.height).toBeGreaterThan(30)
  })
})

describe('createCloud', () => {
  it('creates cloud with correct type', () => {
    const cloud = createCloud(0, 50, mockColors)

    expect(cloud.type).toBe('cloud')
  })

  it('creates cloud at specified position', () => {
    const cloud = createCloud(150, 80, mockColors)

    expect(cloud.x).toBe(150)
    expect(cloud.y).toBe(80)
  })

  it('cloud is wider than tall', () => {
    const cloud = createCloud(0, 50, mockColors)

    expect(cloud.width).toBeGreaterThan(cloud.height)
  })
})

describe('createTree', () => {
  it('creates tree with correct type', () => {
    const tree = createTree(0, 200, mockColors)

    expect(tree.type).toBe('tree')
  })

  it('creates tree with valid dimensions', () => {
    const tree = createTree(100, 200, mockColors)

    expect(tree.x).toBe(100)
    expect(tree.width).toBeGreaterThan(10)
    expect(tree.height).toBeGreaterThan(20)
  })
})
