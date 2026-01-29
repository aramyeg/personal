/**
 * Tech Sunset Color Palette
 * Beautiful gradient-based colors for the career platformer game
 * Warm sunset gradients for sky, cool tones for tech elements
 */

/**
 * Extended color palette with gradient support
 */
export type ColorPalette = {
  // Sky gradient (top to bottom)
  sky: {
    zenith: string // Deep blue at top
    mid: string // Purple transition
    horizon: string // Orange/pink at horizon
    stars: string // Star color
  }

  // Mountain layers (far to near)
  mountains: {
    far: string // Most distant, muted
    mid: string // Middle distance
    near: string // Closest, more saturated
    snow: string // Snow caps
  }

  // City silhouettes
  buildings: {
    base: string
    windows: string
    windowsLit: string
    antenna: string
  }

  // Clouds
  clouds: {
    light: string
    shadow: string
  }

  // Ground and platforms
  ground: {
    surface: string
    highlight: string
    shadow: string
    grass: string
  }

  // Tech accent colors
  tech: {
    primary: string // Cyan glow
    secondary: string // Magenta accent
    tertiary: string // Gold/yellow highlight
    success: string // Green for reached
  }

  // Character colors
  character: {
    hair: string
    skin: string
    shirt: string
    pants: string
    shoes: string
    outline: string
  }

  // UI elements
  ui: {
    text: string
    textMuted: string
    background: string
    overlay: string
  }
}

/**
 * Light mode palette - warm sunset theme
 */
export const LIGHT_PALETTE: ColorPalette = {
  sky: {
    zenith: '#1a1a3e',
    mid: '#4a3b7e',
    horizon: '#f0a07c',
    stars: '#ffffff',
  },
  mountains: {
    far: '#3d3d5c',
    mid: '#4d4d6e',
    near: '#5d5d80',
    snow: '#e8e8f0',
  },
  buildings: {
    base: '#2a2a4a',
    windows: '#1a1a3a',
    windowsLit: '#00d9ff',
    antenna: '#ff3333',
  },
  clouds: {
    light: '#f5f0e8',
    shadow: '#d8d0c0',
  },
  ground: {
    surface: '#5c4a3d',
    highlight: '#7a6352',
    shadow: '#3d3229',
    grass: '#4a7c4a',
  },
  tech: {
    primary: '#00d9ff',
    secondary: '#ff6b9d',
    tertiary: '#ffd93d',
    success: '#4ade80',
  },
  character: {
    hair: '#3d2817',
    skin: '#f0c8a0',
    shirt: '#1a1a3e',
    pants: '#374151',
    shoes: '#1f1f1f',
    outline: '#0a0a0a',
  },
  ui: {
    text: '#f5f5f0',
    textMuted: '#a0a0a0',
    background: '#1a1816',
    overlay: 'rgba(10, 10, 15, 0.85)',
  },
}

/**
 * Dark mode palette - deeper night theme
 */
export const DARK_PALETTE: ColorPalette = {
  sky: {
    zenith: '#0a0a18',
    mid: '#1a1a2e',
    horizon: '#5c4040',
    stars: '#ffffff',
  },
  mountains: {
    far: '#15151f',
    mid: '#1f1f2e',
    near: '#2a2a3d',
    snow: '#c0c0d0',
  },
  buildings: {
    base: '#1a1a2a',
    windows: '#0f0f1f',
    windowsLit: '#00ffff',
    antenna: '#ff4444',
  },
  clouds: {
    light: '#3a3a4a',
    shadow: '#2a2a3a',
  },
  ground: {
    surface: '#3d3229',
    highlight: '#5c4a3d',
    shadow: '#2a221c',
    grass: '#3a5c3a',
  },
  tech: {
    primary: '#00ffff',
    secondary: '#ff7eb3',
    tertiary: '#ffe066',
    success: '#22c55e',
  },
  character: {
    hair: '#2d1807',
    skin: '#e0b890',
    shirt: '#0a0a1e',
    pants: '#272731',
    shoes: '#0f0f0f',
    outline: '#000000',
  },
  ui: {
    text: '#f5f5f0',
    textMuted: '#808080',
    background: '#0a0a0f',
    overlay: 'rgba(5, 5, 10, 0.9)',
  },
}

/**
 * Gets the appropriate palette based on dark mode
 */
export function getPalette(isDark: boolean): ColorPalette {
  return isDark ? DARK_PALETTE : LIGHT_PALETTE
}

/**
 * Checks if dark mode is currently active
 */
export function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

/**
 * Adjusts hex color brightness
 * @param color - Hex color string (#RRGGBB)
 * @param amount - Amount to adjust (-255 to 255)
 */
export function adjustBrightness(color: string, amount: number): string {
  if (!color.startsWith('#')) return color

  const hex = color.slice(1)
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount))

  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Creates a color with alpha transparency
 * @param color - Hex color string (#RRGGBB)
 * @param alpha - Alpha value (0-1)
 */
export function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#')) return color

  const hex = color.slice(1)
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Creates a vertical gradient on canvas
 */
export function createSkyGradient(
  ctx: CanvasRenderingContext2D,
  height: number,
  palette: ColorPalette
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, palette.sky.zenith)
  gradient.addColorStop(0.4, palette.sky.mid)
  gradient.addColorStop(0.85, palette.sky.horizon)
  gradient.addColorStop(1, adjustBrightness(palette.sky.horizon, 30))
  return gradient
}

/**
 * Interpolates between two colors
 * @param color1 - First hex color
 * @param color2 - Second hex color
 * @param t - Interpolation factor (0-1)
 */
export function lerpColor(color1: string, color2: string, t: number): string {
  if (!color1.startsWith('#') || !color2.startsWith('#')) return color1

  const r1 = parseInt(color1.slice(1, 3), 16)
  const g1 = parseInt(color1.slice(3, 5), 16)
  const b1 = parseInt(color1.slice(5, 7), 16)

  const r2 = parseInt(color2.slice(1, 3), 16)
  const g2 = parseInt(color2.slice(3, 5), 16)
  const b2 = parseInt(color2.slice(5, 7), 16)

  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)

  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}
