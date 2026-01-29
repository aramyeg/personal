/**
 * Parallax Background System
 * Creates depth-layered scrolling backgrounds for the game
 */

import type { GameColors, ParallaxElement, ParallaxLayer } from './types'
import { adjustBrightness } from './colors'

/**
 * Creates a mountain element for distant background
 * Mountains are large, triangular shapes with muted colors
 *
 * @param x - X position
 * @param baseY - Base Y position (ground level)
 * @param colors - Theme colors
 * @returns ParallaxElement for a mountain
 */
export function createMountain(x: number, baseY: number, colors: GameColors): ParallaxElement {
  const width = 80 + Math.random() * 60 // 80-140px
  const height = 50 + Math.random() * 40 // 50-90px

  return {
    type: 'mountain',
    x,
    y: baseY - height,
    width,
    height,
    color: adjustBrightness(colors.backgroundAlt, -20),
  }
}

/**
 * Creates a building element for mid-ground
 * Buildings are rectangular with varying heights
 *
 * @param x - X position
 * @param baseY - Base Y position (ground level)
 * @param colors - Theme colors
 * @returns ParallaxElement for a building
 */
export function createBuilding(x: number, baseY: number, colors: GameColors): ParallaxElement {
  const width = 30 + Math.random() * 25 // 30-55px
  const height = 40 + Math.random() * 50 // 40-90px

  return {
    type: 'building',
    x,
    y: baseY - height,
    width,
    height,
    color: adjustBrightness(colors.backgroundAlt, -10),
  }
}

/**
 * Creates a cloud element for the sky layer
 * Clouds are wide, low shapes with light colors
 *
 * @param x - X position
 * @param y - Y position (sky height)
 * @param colors - Theme colors
 * @returns ParallaxElement for a cloud
 */
export function createCloud(x: number, y: number, colors: GameColors): ParallaxElement {
  const width = 40 + Math.random() * 40 // 40-80px
  const height = 15 + Math.random() * 10 // 15-25px

  return {
    type: 'cloud',
    x,
    y,
    width,
    height,
    color: adjustBrightness(colors.background, 10),
  }
}

/**
 * Creates a tree element for foreground decoration
 * Trees are smaller, detailed elements
 *
 * @param x - X position
 * @param baseY - Base Y position (ground level)
 * @param colors - Theme colors
 * @returns ParallaxElement for a tree
 */
export function createTree(x: number, baseY: number, colors: GameColors): ParallaxElement {
  const width = 15 + Math.random() * 15 // 15-30px
  const height = 25 + Math.random() * 20 // 25-45px

  return {
    type: 'tree',
    x,
    y: baseY - height,
    width,
    height,
    color: adjustBrightness(colors.ground, 20),
  }
}

/**
 * Generates parallax background layers
 * Creates multiple depth layers with different scroll speeds
 *
 * Layer structure (back to front):
 * 1. Sky with clouds (very slow, speed 0.1)
 * 2. Distant mountains (slow, speed 0.2)
 * 3. Buildings silhouettes (medium, speed 0.4)
 * 4. Trees (faster, speed 0.6)
 *
 * @param canvasWidth - Width of the game canvas
 * @param canvasHeight - Height of the game canvas
 * @param colors - Theme colors for elements
 * @returns Array of ParallaxLayer sorted by depth (back first)
 */
export function generateParallaxLayers(
  canvasWidth: number,
  canvasHeight: number,
  colors: GameColors
): ParallaxLayer[] {
  const groundY = canvasHeight - 40 // Ground level

  const layers: ParallaxLayer[] = []

  // Layer 1: Clouds (very distant, slow)
  const cloudElements: ParallaxElement[] = []
  for (let i = 0; i < 5; i++) {
    cloudElements.push(createCloud(i * (canvasWidth / 3) + Math.random() * 50, 20 + Math.random() * 40, colors))
  }
  layers.push({
    elements: cloudElements,
    speed: 0.1,
    yOffset: 0,
  })

  // Layer 2: Mountains (distant)
  const mountainElements: ParallaxElement[] = []
  for (let i = 0; i < 4; i++) {
    mountainElements.push(createMountain(i * (canvasWidth / 2.5), groundY, colors))
  }
  layers.push({
    elements: mountainElements,
    speed: 0.2,
    yOffset: groundY - 80,
  })

  // Layer 3: Buildings (mid-ground)
  const buildingElements: ParallaxElement[] = []
  for (let i = 0; i < 6; i++) {
    buildingElements.push(createBuilding(i * (canvasWidth / 4) + Math.random() * 30, groundY, colors))
  }
  layers.push({
    elements: buildingElements,
    speed: 0.4,
    yOffset: groundY - 60,
  })

  // Layer 4: Trees (foreground decoration)
  const treeElements: ParallaxElement[] = []
  for (let i = 0; i < 8; i++) {
    treeElements.push(createTree(i * (canvasWidth / 5) + Math.random() * 40, groundY, colors))
  }
  layers.push({
    elements: treeElements,
    speed: 0.6,
    yOffset: groundY - 30,
  })

  return layers
}

/**
 * Calculates element position based on camera and parallax speed
 * Handles wrapping for seamless infinite scrolling
 *
 * @param elementX - Original element X position
 * @param cameraX - Current camera X position
 * @param speed - Layer parallax speed (0-1, where 0 = static, 1 = moves with camera)
 * @param canvasWidth - Width of the canvas for wrapping calculation
 * @returns Adjusted X position for rendering
 */
export function getElementPosition(
  elementX: number,
  cameraX: number,
  speed: number,
  canvasWidth: number
): number {
  // Calculate parallax offset (slower layers move less)
  const parallaxOffset = cameraX * speed

  // Apply offset
  let adjustedX = elementX - parallaxOffset

  // Wrap for seamless scrolling (with buffer for element width)
  const wrapWidth = canvasWidth * 2
  while (adjustedX < -wrapWidth) {
    adjustedX += wrapWidth
  }
  while (adjustedX > wrapWidth) {
    adjustedX -= wrapWidth
  }

  return adjustedX
}

/**
 * Renders a parallax element to canvas context
 * Draws appropriate shape based on element type
 *
 * @param ctx - Canvas 2D rendering context
 * @param element - ParallaxElement to render
 */
export function renderElement(ctx: CanvasRenderingContext2D, element: ParallaxElement): void {
  ctx.fillStyle = element.color

  switch (element.type) {
    case 'mountain':
      // Triangle shape
      ctx.beginPath()
      ctx.moveTo(element.x + element.width / 2, element.y)
      ctx.lineTo(element.x, element.y + element.height)
      ctx.lineTo(element.x + element.width, element.y + element.height)
      ctx.closePath()
      ctx.fill()
      break

    case 'building':
      // Rectangle with optional windows
      ctx.fillRect(element.x, element.y, element.width, element.height)
      break

    case 'cloud':
      // Rounded blob shape
      ctx.beginPath()
      ctx.ellipse(
        element.x + element.width / 2,
        element.y + element.height / 2,
        element.width / 2,
        element.height / 2,
        0,
        0,
        Math.PI * 2
      )
      ctx.fill()
      break

    case 'tree':
      // Simple tree shape (trunk + triangle top)
      const trunkWidth = element.width * 0.3
      const trunkHeight = element.height * 0.4
      const trunkX = element.x + (element.width - trunkWidth) / 2

      // Trunk
      ctx.fillRect(trunkX, element.y + element.height - trunkHeight, trunkWidth, trunkHeight)

      // Foliage (triangle)
      ctx.beginPath()
      ctx.moveTo(element.x + element.width / 2, element.y)
      ctx.lineTo(element.x, element.y + element.height - trunkHeight)
      ctx.lineTo(element.x + element.width, element.y + element.height - trunkHeight)
      ctx.closePath()
      ctx.fill()
      break
  }
}
