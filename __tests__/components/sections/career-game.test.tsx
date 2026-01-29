import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock the game state store with reactive state
let mockGameStarted = false
const mockStartGame = vi.fn(() => {
  mockGameStarted = true
})
const mockResetGame = vi.fn(() => {
  mockGameStarted = false
})

vi.mock('@/lib/game/gameState', () => ({
  useGameState: () => ({
    initGame: vi.fn(),
    startGame: mockStartGame,
    resetGame: mockResetGame,
    loseLife: vi.fn(() => false),
    addScore: vi.fn(),
    reachPlatform: vi.fn(),
    collectTech: vi.fn(),
    updateGameTime: vi.fn(),
    setGameWon: vi.fn(),
    getCheckpointIndex: vi.fn(() => -1),
    activatePowerUp: vi.fn(),
    updatePowerUps: vi.fn(),
    hasPowerUp: vi.fn(() => false),
    getPowerUpMultiplier: vi.fn(() => 1),
    clearRecentAchievement: vi.fn(),
    mode: 'classic',
  }),
  useLives: () => 3,
  useMaxLives: () => 3,
  useScore: () => 0,
  useGameTime: () => 0,
  useTimeLimit: () => null,
  useActivePowerUps: () => [],
  useRecentAchievement: () => null,
  useGameMode: () => 'classic',
  useIsGameOver: () => false,
  useIsGameWon: () => false,
  useIsGameStarted: () => mockGameStarted,
  GAME_MODE_CONFIGS: {
    classic: { lives: 3, timeLimit: null, scoreMultiplier: 1, hasCheckpoints: true, powerUpsEnabled: true },
    speedrun: { lives: 3, timeLimit: 60000, scoreMultiplier: 1.5, hasCheckpoints: true, powerUpsEnabled: true },
    hardcore: { lives: 1, timeLimit: null, scoreMultiplier: 2, hasCheckpoints: false, powerUpsEnabled: false },
  },
  formatTime: (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
  },
  getRemainingTime: () => null,
}))

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: ({
        children,
        className,
        onClick,
        style,
        ...props
      }: Record<string, unknown>) => (
        <div
          className={className as string}
          onClick={onClick as () => void}
          style={style as React.CSSProperties}
          {...props}
        >
          {children as React.ReactNode}
        </div>
      ),
      button: ({
        children,
        className,
        onClick,
        ...props
      }: Record<string, unknown>) => (
        <button className={className as string} onClick={onClick as () => void} {...props}>
          {children as React.ReactNode}
        </button>
      ),
      span: ({
        children,
        className,
        ...props
      }: Record<string, unknown>) => (
        <span className={className as string} {...props}>
          {children as React.ReactNode}
        </span>
      ),
      p: ({
        children,
        className,
        ...props
      }: Record<string, unknown>) => (
        <p className={className as string} {...props}>
          {children as React.ReactNode}
        </p>
      ),
      h3: ({
        children,
        className,
        ...props
      }: Record<string, unknown>) => (
        <h3 className={className as string} {...props}>
          {children as React.ReactNode}
        </h3>
      ),
    },
  }
})

// Mock canvas context
const mockCtx = {
  fillStyle: '',
  fillRect: vi.fn(),
  fillText: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  ellipse: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  font: '',
  textAlign: '',
}

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext

// Import after mocking
import { CareerGame } from '@/components/sections/career-game'

describe('CareerGame Accessibility', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGameStarted = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('canvas has proper aria-label with controls hint', () => {
    render(<CareerGame />)

    const canvas = screen.getByRole('img')
    expect(canvas).toHaveAttribute(
      'aria-label',
      'Career journey platformer game. Use arrow keys or WASD to move, Space to jump.'
    )
  })

  it('renders mode selector with accessible content', () => {
    render(<CareerGame />)

    expect(screen.getByText('Career Journey')).toBeInTheDocument()
    expect(screen.getByText('Choose your challenge')).toBeInTheDocument()
    expect(screen.getByText('Classic')).toBeInTheDocument()
    expect(screen.getByText('Speedrun')).toBeInTheDocument()
    expect(screen.getByText('Hardcore')).toBeInTheDocument()
  })

  it('mode button is focusable and clickable', () => {
    render(<CareerGame />)

    const classicButton = screen.getByText('Classic')
    expect(classicButton.tagName).toBe('H3') // Title in the button

    // Click the parent button
    fireEvent.click(classicButton.closest('button')!)
    // After click, the startGame function should be called
    expect(mockStartGame).toHaveBeenCalled()
  })

  it('mobile controls have aria-labels', () => {
    render(<CareerGame />)
    // Start the game first by selecting a mode
    fireEvent.click(screen.getByText('Classic').closest('button')!)

    const leftButton = screen.getByLabelText('Move left')
    const rightButton = screen.getByLabelText('Move right')
    const jumpButton = screen.getByLabelText('Jump')

    expect(leftButton).toBeInTheDocument()
    expect(rightButton).toBeInTheDocument()
    expect(jumpButton).toBeInTheDocument()
  })

  it('includes keyboard controls hint', () => {
    render(<CareerGame />)

    expect(screen.getByText(/Use arrow keys to move, Space to jump/)).toBeInTheDocument()
  })

  it('has aria-live region for screen reader announcements', () => {
    render(<CareerGame />)

    const liveRegion = screen.getByRole('status')
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    expect(liveRegion).toHaveClass('sr-only')
  })
})

describe('CareerGame Structure', () => {
  it('renders canvas with correct dimensions', () => {
    render(<CareerGame />)

    const canvas = screen.getByRole('img')
    expect(canvas).toHaveAttribute('width', '620')
    expect(canvas).toHaveAttribute('height', '220')
  })

  it('uses pixelated rendering for retro aesthetic', () => {
    render(<CareerGame />)

    const canvas = screen.getByRole('img')
    expect(canvas).toHaveStyle({ imageRendering: 'pixelated' })
  })
})

describe('CareerGame Keyboard Controls', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGameStarted = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('prevents default on arrow keys to stop page scroll', () => {
    render(<CareerGame />)

    // Start the game by selecting a mode
    fireEvent.click(screen.getByText('Classic').closest('button')!)

    const preventDefault = vi.fn()
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
    Object.defineProperty(event, 'preventDefault', { value: preventDefault })

    window.dispatchEvent(event)

    expect(preventDefault).toHaveBeenCalled()
  })

  it('prevents default on space key', () => {
    render(<CareerGame />)

    fireEvent.click(screen.getByText('Classic').closest('button')!)

    const preventDefault = vi.fn()
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true })
    Object.defineProperty(event, 'preventDefault', { value: preventDefault })

    window.dispatchEvent(event)

    expect(preventDefault).toHaveBeenCalled()
  })
})

describe('CareerGame Game States', () => {
  beforeEach(() => {
    mockGameStarted = false
  })

  it('shows mode selector when game is not started', async () => {
    render(<CareerGame />)

    // The mode selector should show game mode options
    expect(screen.getByText('Classic')).toBeInTheDocument()
    expect(screen.getByText('Speedrun')).toBeInTheDocument()
    expect(screen.getByText('Hardcore')).toBeInTheDocument()
  })

  it('has game title in mode selector', () => {
    // This test verifies the component has the title
    render(<CareerGame />)
    expect(screen.getByText('Career Journey')).toBeInTheDocument()
  })
})
