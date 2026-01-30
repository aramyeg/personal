import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock canvas context with all required methods
const mockCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  globalAlpha: 1,
  font: '',
  textAlign: '',
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  ellipse: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  clip: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  setLineDash: vi.fn(),
}

// Apply canvas mock before any imports
HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext

// Mock world state
vi.mock('@/lib/game/world', () => {
  const mockState = {
    exitToOverworld: vi.fn(),
    enterLevel: vi.fn(),
    startLevelTimer: vi.fn(),
    recordDeath: vi.fn(),
    collectLevelItem: vi.fn(),
    setLevelCollectibles: vi.fn(),
    completeLevel: vi.fn(),
    showLevelComplete: vi.fn(),
    goToOverworld: vi.fn(),
    selectWorld: vi.fn(),
    pendingSkillUnlock: null,
    levelProgress: {},
  }

  const useWorldStateFn = () => mockState
  useWorldStateFn.getState = () => mockState

  return {
  useWorldState: useWorldStateFn,
  useCurrentScreen: () => 'overworld',
  useUnlockedSkills: () => [],
  useSkillState: () => ({
    doubleJump: { jumpsRemaining: 1 },
    wallSlide: { isTouchingWall: false, wallDirection: null },
    dash: { isDashing: false, dashTimeRemaining: 0, cooldownRemaining: 0 },
    shield: { isActive: false, timeRemaining: 0, cooldownRemaining: 0 },
    float: { isFloating: false, timeRemaining: 1000 },
  }),
  useWorlds: () => [
    {
      id: 'bluenet',
      name: 'Hotel Systems',
      company: 'BlueNet / FreeDOM',
      theme: 'hotel',
      unlocked: true,
      completed: false,
      grantsSkill: 'double_jump',
      order: 1,
      levels: [{ id: 'bluenet_1', name: 'BlueNet / FreeDOM', completed: false }],
      mapPosition: { x: 80, y: 220 },
    },
  ],
  useSelectedWorld: () => null,
  useTotalStars: () => 0,
  getWorldById: vi.fn(),
  getLevelById: vi.fn(),
  generateWorlds: vi.fn(() => []),
  WORLD_THEMES: {
    hotel: { primaryColor: '#8B5CF6', secondaryColor: '#A78BFA' },
  },
  SKILLS: {
    double_jump: { name: 'Double Jump', icon: '⬆️' },
  },
  createInitialSkillState: () => ({
    doubleJump: { jumpsRemaining: 1 },
    wallSlide: { isTouchingWall: false, wallDirection: null },
    dash: { isDashing: false, dashTimeRemaining: 0, cooldownRemaining: 0 },
    shield: { isActive: false, timeRemaining: 0, cooldownRemaining: 0 },
    float: { isFloating: false, timeRemaining: 1000 },
  }),
  applySkillPhysics: vi.fn(() => ({
    physics: { x: 0, y: 0, vx: 0, vy: 0, grounded: true, facingRight: true },
    skillState: {},
    effects: {
      isDashing: false,
      isShielded: false,
      isFloating: false,
      isWallSliding: false,
      usedDoubleJump: false,
      collectRadiusMultiplier: 1,
    },
  })),
  populateLevelData: vi.fn(() => ({
    platforms: [],
    collectibles: [],
    checkpoints: [],
  })),
  getLevelBounds: vi.fn(() => ({ minX: 0, maxX: 2000 })),
  isAtLevelExit: vi.fn(() => false),
  }
})

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: ({ children, className, onClick, ...props }: Record<string, unknown>) => (
        <div className={className as string} onClick={onClick as () => void} {...props}>
          {children as React.ReactNode}
        </div>
      ),
      button: ({ children, className, onClick, ...props }: Record<string, unknown>) => (
        <button className={className as string} onClick={onClick as () => void} {...props}>
          {children as React.ReactNode}
        </button>
      ),
      span: ({ children, className, ...props }: Record<string, unknown>) => (
        <span className={className as string} {...props}>
          {children as React.ReactNode}
        </span>
      ),
      p: ({ children, className, ...props }: Record<string, unknown>) => (
        <p className={className as string} {...props}>
          {children as React.ReactNode}
        </p>
      ),
      h3: ({ children, className, ...props }: Record<string, unknown>) => (
        <h3 className={className as string} {...props}>
          {children as React.ReactNode}
        </h3>
      ),
    },
  }
})

// Mock game utilities
vi.mock('@/lib/game/palette', () => ({
  getPalette: () => ({
    background: { primary: '#000', secondary: '#111' },
    ground: { surface: '#333', edge: '#444', accent: '#555' },
    sky: { top: '#001', bottom: '#002' },
    text: { primary: '#fff', secondary: '#ccc' },
  }),
  isDarkMode: () => false,
}))

vi.mock('@/lib/game/backgrounds', () => ({
  generateBackground: vi.fn(() => ({ layers: [] })),
  renderBackground: vi.fn(),
}))

vi.mock('@/lib/game/character', () => ({
  createCharacterState: () => ({ frame: 0, animation: 'idle' }),
  updateCharacterAnimation: vi.fn(),
  getAnimationFromPhysics: vi.fn(() => 'idle'),
  renderCharacter: vi.fn(),
}))

vi.mock('@/lib/game/particles', () => ({
  createEmitter: () => ({ particles: [] }),
  updateParticles: vi.fn(),
  renderParticles: vi.fn(),
  emitDust: vi.fn(),
  emitSparkles: vi.fn(),
}))

// Import after mocking
import { CareerGame } from '@/components/sections/career-game'

describe('CareerGame', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders without crashing', () => {
    render(<CareerGame />)
    // CareerGame now renders WorldGame which shows the overworld map
    expect(document.body).toBeTruthy()
  })

  it('renders WorldGame component', () => {
    const { container } = render(<CareerGame />)
    // WorldGame should render some content
    expect(container.firstChild).toBeTruthy()
  })
})

describe('CareerGame Integration', () => {
  it('mounts and unmounts cleanly', () => {
    const { unmount } = render(<CareerGame />)
    expect(() => unmount()).not.toThrow()
  })
})
