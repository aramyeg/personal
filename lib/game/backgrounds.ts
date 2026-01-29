/**
 * Beautiful Parallax Background System
 * Creates layered, animated backgrounds for the career platformer
 */

import type { ColorPalette } from './palette'
import { withAlpha, createSkyGradient, adjustBrightness } from './palette'

// ============================================
// TYPES
// ============================================

export type Star = {
  x: number
  y: number
  size: number
  twinkleOffset: number
  brightness: number
}

export type MountainPeak = {
  x: number
  height: number
  width: number
}

export type Building = {
  x: number
  width: number
  height: number
  windows: { x: number; y: number; lit: boolean }[]
  hasAntenna: boolean
}

export type Cloud = {
  x: number
  y: number
  width: number
  puffs: { offsetX: number; offsetY: number; radius: number }[]
  speed: number
  opacity: number
}

export type BackgroundState = {
  stars: Star[]
  mountainsFar: MountainPeak[]
  mountainsMid: MountainPeak[]
  mountainsNear: MountainPeak[]
  buildings: Building[]
  clouds: Cloud[]
}

// ============================================
// GENERATION FUNCTIONS
// ============================================

/**
 * Generates twinkling stars for the sky
 */
export function generateStars(canvasWidth: number, canvasHeight: number, count: number = 50): Star[] {
  const stars: Star[] = []

  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvasWidth * 2,
      y: Math.random() * canvasHeight * 0.5,
      size: Math.random() < 0.8 ? 1 : 2,
      twinkleOffset: Math.random() * Math.PI * 2,
      brightness: 0.3 + Math.random() * 0.7,
    })
  }

  return stars
}

/**
 * Generates a mountain range
 */
export function generateMountains(
  startX: number,
  endX: number,
  baseY: number,
  minHeight: number,
  maxHeight: number,
  count: number
): MountainPeak[] {
  const peaks: MountainPeak[] = []
  const spacing = (endX - startX) / count

  for (let i = 0; i < count; i++) {
    const height = minHeight + Math.random() * (maxHeight - minHeight)
    const width = height * (1.2 + Math.random() * 0.6)

    peaks.push({
      x: startX + i * spacing + (Math.random() - 0.5) * spacing * 0.5,
      height,
      width,
    })
  }

  return peaks
}

/**
 * Generates city buildings
 */
export function generateBuildings(
  startX: number,
  endX: number,
  baseY: number,
  count: number
): Building[] {
  const buildings: Building[] = []
  const spacing = (endX - startX) / count

  for (let i = 0; i < count; i++) {
    const width = 25 + Math.random() * 35
    const height = 30 + Math.random() * 70
    const x = startX + i * spacing + (Math.random() - 0.5) * spacing * 0.3

    // Generate windows
    const windowCols = Math.floor(width / 10)
    const windowRows = Math.floor(height / 15)
    const windows: Building['windows'] = []

    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        windows.push({
          x: 4 + col * 10,
          y: 8 + row * 15,
          lit: Math.random() < 0.35,
        })
      }
    }

    buildings.push({
      x,
      width,
      height,
      windows,
      hasAntenna: Math.random() > 0.6,
    })
  }

  return buildings
}

/**
 * Generates fluffy clouds
 */
export function generateClouds(canvasWidth: number, canvasHeight: number, count: number): Cloud[] {
  const clouds: Cloud[] = []

  for (let i = 0; i < count; i++) {
    const width = 50 + Math.random() * 60
    const puffCount = 3 + Math.floor(Math.random() * 3)
    const puffs: Cloud['puffs'] = []

    for (let p = 0; p < puffCount; p++) {
      const t = p / (puffCount - 1)
      puffs.push({
        offsetX: (t - 0.5) * width * 0.8,
        offsetY: Math.sin(t * Math.PI) * 8 - 4,
        radius: 12 + Math.random() * 10,
      })
    }

    clouds.push({
      x: (i / count) * canvasWidth * 2.5,
      y: 30 + Math.random() * 50,
      width,
      puffs,
      speed: 0.15 + Math.random() * 0.2,
      opacity: 0.5 + Math.random() * 0.3,
    })
  }

  return clouds
}

/**
 * Generates complete background state
 */
export function generateBackground(canvasWidth: number, canvasHeight: number): BackgroundState {
  const groundY = canvasHeight - 20

  return {
    stars: generateStars(canvasWidth, canvasHeight, 40),
    mountainsFar: generateMountains(0, canvasWidth * 2, groundY, 50, 80, 6),
    mountainsMid: generateMountains(0, canvasWidth * 2, groundY, 35, 60, 8),
    mountainsNear: generateMountains(0, canvasWidth * 2, groundY, 25, 45, 10),
    buildings: generateBuildings(0, canvasWidth * 2, groundY, 12),
    clouds: generateClouds(canvasWidth, canvasHeight, 6),
  }
}

// ============================================
// RENDERING FUNCTIONS
// ============================================

/**
 * Renders the sky gradient
 */
export function renderSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: ColorPalette
): void {
  const gradient = createSkyGradient(ctx, height, palette)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

/**
 * Renders twinkling stars
 */
export function renderStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  time: number,
  cameraX: number,
  palette: ColorPalette
): void {
  stars.forEach((star) => {
    // Very slow parallax for stars
    const x = star.x - cameraX * 0.02
    const wrappedX = ((x % (ctx.canvas.width * 2)) + ctx.canvas.width * 2) % (ctx.canvas.width * 2)

    if (wrappedX > ctx.canvas.width + 10) return

    // Twinkle effect
    const twinkle = Math.sin(time * 0.003 + star.twinkleOffset) * 0.3 + 0.7
    const alpha = star.brightness * twinkle

    ctx.fillStyle = withAlpha(palette.sky.stars, alpha)
    ctx.fillRect(Math.floor(wrappedX), Math.floor(star.y), star.size, star.size)
  })
}

/**
 * Renders a single mountain range layer
 */
export function renderMountains(
  ctx: CanvasRenderingContext2D,
  peaks: MountainPeak[],
  groundY: number,
  color: string,
  highlightColor: string,
  cameraX: number,
  parallaxSpeed: number,
  snowLine?: number,
  snowColor?: string
): void {
  const offset = cameraX * parallaxSpeed

  peaks.forEach((peak) => {
    const x = peak.x - offset
    const wrappedX =
      ((x % (ctx.canvas.width * 2)) + ctx.canvas.width * 2) % (ctx.canvas.width * 2) -
      ctx.canvas.width * 0.5

    if (wrappedX > ctx.canvas.width + peak.width || wrappedX < -peak.width * 2) return

    const peakY = groundY - peak.height

    // Mountain body
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(wrappedX - peak.width / 2, groundY)
    ctx.lineTo(wrappedX + peak.width * 0.1, peakY)
    ctx.lineTo(wrappedX + peak.width / 2, groundY)
    ctx.closePath()
    ctx.fill()

    // Left highlight (light from top-left)
    ctx.fillStyle = withAlpha(highlightColor, 0.2)
    ctx.beginPath()
    ctx.moveTo(wrappedX - peak.width / 2, groundY)
    ctx.lineTo(wrappedX + peak.width * 0.1, peakY)
    ctx.lineTo(wrappedX - peak.width * 0.1, peakY + peak.height * 0.4)
    ctx.closePath()
    ctx.fill()

    // Snow cap
    if (snowLine !== undefined && snowColor && peakY < snowLine) {
      const snowHeight = Math.min(peak.height * 0.35, snowLine - peakY + 10)
      const snowWidth = peak.width * (snowHeight / peak.height) * 0.8

      ctx.fillStyle = snowColor
      ctx.beginPath()
      ctx.moveTo(wrappedX + peak.width * 0.1 - snowWidth / 2, peakY + snowHeight)
      ctx.lineTo(wrappedX + peak.width * 0.1, peakY)
      ctx.lineTo(wrappedX + peak.width * 0.1 + snowWidth / 2, peakY + snowHeight)
      ctx.closePath()
      ctx.fill()
    }
  })
}

/**
 * Renders city buildings
 */
export function renderBuildings(
  ctx: CanvasRenderingContext2D,
  buildings: Building[],
  groundY: number,
  cameraX: number,
  parallaxSpeed: number,
  time: number,
  palette: ColorPalette
): void {
  const offset = cameraX * parallaxSpeed

  buildings.forEach((building, buildingIndex) => {
    const x = building.x - offset
    const wrappedX =
      ((x % (ctx.canvas.width * 2)) + ctx.canvas.width * 2) % (ctx.canvas.width * 2) -
      ctx.canvas.width * 0.3

    if (wrappedX > ctx.canvas.width + building.width || wrappedX < -building.width * 2) return

    const y = groundY - building.height

    // Building body
    ctx.fillStyle = palette.buildings.base
    ctx.fillRect(Math.floor(wrappedX), Math.floor(y), building.width, building.height)

    // Building edge highlight (left side)
    ctx.fillStyle = withAlpha('#ffffff', 0.05)
    ctx.fillRect(Math.floor(wrappedX), Math.floor(y), 2, building.height)

    // Windows
    building.windows.forEach((window, windowIndex) => {
      // Deterministic flickering based on building and window index
      const seed = buildingIndex * 100 + windowIndex
      const flicker = Math.sin(time * 0.002 + seed * 0.5) > 0.3

      if (window.lit && flicker) {
        // Window glow
        ctx.fillStyle = withAlpha(palette.buildings.windowsLit, 0.2)
        ctx.fillRect(
          Math.floor(wrappedX + window.x - 1),
          Math.floor(y + window.y - 1),
          6,
          10
        )
        // Window
        ctx.fillStyle = palette.buildings.windowsLit
      } else {
        ctx.fillStyle = palette.buildings.windows
      }

      ctx.fillRect(Math.floor(wrappedX + window.x), Math.floor(y + window.y), 4, 8)
    })

    // Antenna
    if (building.hasAntenna) {
      const antennaHeight = 12
      ctx.fillStyle = palette.buildings.base
      ctx.fillRect(
        Math.floor(wrappedX + building.width / 2 - 1),
        Math.floor(y - antennaHeight),
        2,
        antennaHeight
      )

      // Blinking light
      const blink = Math.sin(time * 0.005 + buildingIndex) > 0
      if (blink) {
        ctx.fillStyle = palette.buildings.antenna
        ctx.fillRect(
          Math.floor(wrappedX + building.width / 2 - 2),
          Math.floor(y - antennaHeight - 2),
          4,
          3
        )
      }
    }
  })
}

/**
 * Renders fluffy pixel art clouds
 */
export function renderClouds(
  ctx: CanvasRenderingContext2D,
  clouds: Cloud[],
  cameraX: number,
  parallaxSpeed: number,
  time: number,
  palette: ColorPalette,
  layer: 'back' | 'front'
): void {
  const offset = cameraX * parallaxSpeed
  const cloudColor = layer === 'back' ? palette.clouds.shadow : palette.clouds.light

  clouds.forEach((cloud) => {
    // Independent cloud drift + parallax
    const drift = (time * cloud.speed * 0.03) % (ctx.canvas.width * 2.5)
    const x = cloud.x - offset * 0.5 + drift
    const wrappedX =
      ((x % (ctx.canvas.width * 2.5)) + ctx.canvas.width * 2.5) % (ctx.canvas.width * 2.5) -
      ctx.canvas.width * 0.3

    if (wrappedX > ctx.canvas.width + cloud.width || wrappedX < -cloud.width * 2) return

    // Adjust Y for layer depth
    const y = cloud.y + (layer === 'back' ? 20 : 0)
    const opacity = cloud.opacity * (layer === 'back' ? 0.5 : 1)

    ctx.fillStyle = withAlpha(cloudColor, opacity)

    // Draw puffs
    cloud.puffs.forEach((puff) => {
      const px = wrappedX + cloud.width / 2 + puff.offsetX
      const py = y + puff.offsetY

      // Pixel art circle
      drawPixelCircle(ctx, px, py, puff.radius)
    })
  })
}

/**
 * Renders the ground
 */
export function renderGround(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: ColorPalette
): void {
  const groundY = height - 20

  // Ground base
  ctx.fillStyle = palette.ground.surface
  ctx.fillRect(0, groundY, width, 20)

  // Ground top highlight
  ctx.fillStyle = palette.ground.highlight
  ctx.fillRect(0, groundY, width, 3)

  // Subtle grass/texture pattern
  ctx.fillStyle = withAlpha(palette.ground.grass, 0.3)
  for (let x = 0; x < width; x += 8) {
    if ((x / 8) % 2 === 0) {
      ctx.fillRect(x, groundY, 4, 2)
    }
  }
}

/**
 * Renders all background layers in order
 */
export function renderBackground(
  ctx: CanvasRenderingContext2D,
  state: BackgroundState,
  cameraX: number,
  time: number,
  palette: ColorPalette
): void {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  const groundY = height - 20

  // 1. Sky gradient
  renderSky(ctx, width, height, palette)

  // 2. Stars (only visible in darker areas)
  renderStars(ctx, state.stars, time, cameraX, palette)

  // 3. Far mountains (slowest parallax)
  renderMountains(
    ctx,
    state.mountainsFar,
    groundY,
    palette.mountains.far,
    palette.mountains.mid,
    cameraX,
    0.1,
    80,
    palette.mountains.snow
  )

  // 4. Back clouds
  renderClouds(ctx, state.clouds, cameraX, 0.15, time, palette, 'back')

  // 5. Mid mountains
  renderMountains(
    ctx,
    state.mountainsMid,
    groundY,
    palette.mountains.mid,
    palette.mountains.near,
    cameraX,
    0.2
  )

  // 6. Buildings (city silhouettes)
  renderBuildings(ctx, state.buildings, groundY, cameraX, 0.35, time, palette)

  // 7. Near mountains
  renderMountains(
    ctx,
    state.mountainsNear,
    groundY,
    palette.mountains.near,
    adjustBrightness(palette.mountains.near, 20),
    cameraX,
    0.45
  )

  // 8. Front clouds
  renderClouds(ctx, state.clouds, cameraX, 0.5, time, palette, 'front')

  // 9. Ground
  renderGround(ctx, width, height, palette)
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Draws a pixel-perfect filled circle
 */
function drawPixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const r2 = r * r
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r2) {
        ctx.fillRect(Math.floor(cx + x), Math.floor(cy + y), 1, 1)
      }
    }
  }
}
