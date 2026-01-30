---
name: game-development
description: Canvas-based 2D platformer game development patterns for the portfolio career game. Covers game loops, physics, rendering, state management with Zustand/Immer, and skill systems.
user_invocable: true
command: game-dev
---

# Career Platformer Game Development

Specialized patterns for the Super Mario World-inspired career journey platformer.

## Project-Specific Context

### Worlds (6 Total)
| # | World ID | Company | Skill Granted |
|---|----------|---------|---------------|
| 1 | bluenet | BlueNet / FreeDOM | double_jump |
| 2 | flyerbee | FLYERBEE AG | wall_slide |
| 3 | 360dialog | 360dialog | dash |
| 4 | accenture | Accenture | shield |
| 5 | akna | AKNA | magnet |
| 6 | xdatagroup | xDataGroup | float |

### Key Files
| Purpose | Path |
|---------|------|
| Main Game | `components/sections/world-game.tsx` |
| Game State | `lib/game/world/worldState.ts` |
| Skill Physics | `lib/game/world/skillPhysics.ts` |
| World Data | `lib/game/world/worldData.ts` |
| Game Types | `lib/game/world/types.ts` |
| Level Generator | `lib/game/world/levelGenerator.ts` |

### Canvas Dimensions
- Game canvas: 620×220 pixels
- Overworld map: 620×300 pixels

## Tech Stack

- **Canvas**: 2D rendering with requestAnimationFrame
- **State**: Zustand + Immer (immutable updates)
- **Types**: TypeScript strict mode
- **Animation**: Framer Motion (UI), manual canvas (game)

## Game Loop Pattern

### requestAnimationFrame Loop

```typescript
const gameLoop = useCallback(() => {
  const now = performance.now()
  const deltaTime = Math.min((now - lastTimeRef.current) / 16.67, 2)
  lastTimeRef.current = now

  // 1. Process input
  processInput(keysRef.current)

  // 2. Update physics
  updatePhysics(deltaTime)

  // 3. Check collisions
  checkCollisions()

  // 4. Update state
  updateGameState()

  // 5. Render
  render(ctx)

  // 6. Schedule next frame
  animationFrameRef.current = requestAnimationFrame(gameLoop)
}, [])

// Start/stop loop
useEffect(() => {
  animationFrameRef.current = requestAnimationFrame(gameLoop)
  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }
}, [gameLoop])
```

### Delta Time Normalization

```typescript
// Cap delta to prevent physics explosion on tab unfocus
const deltaTime = Math.min((now - lastTime) / 16.67, 2)

// Apply to all physics calculations
player.x += player.vx * deltaTime
player.vy += GRAVITY * deltaTime
```

## Physics Patterns

### Gravity and Friction

```typescript
const CONFIG = {
  gravity: 0.5,
  jumpForce: -11,
  moveSpeed: 4,
  friction: 0.85,
  maxFallSpeed: 15,
}

// Apply gravity
player.vy = Math.min(player.vy + CONFIG.gravity * deltaTime, CONFIG.maxFallSpeed)

// Apply horizontal friction when grounded
if (player.grounded) {
  player.vx *= CONFIG.friction
}
```

### Platform Collision (AABB)

```typescript
function checkPlatformCollision(
  player: Player,
  platform: Platform
): CollisionResult | null {
  const playerBottom = player.y + player.height
  const playerRight = player.x + player.width

  // Check overlap
  if (
    player.x < platform.x + platform.width &&
    playerRight > platform.x &&
    player.y < platform.y + platform.height &&
    playerBottom > platform.y
  ) {
    // Determine collision side
    const overlapLeft = playerRight - platform.x
    const overlapRight = platform.x + platform.width - player.x
    const overlapTop = playerBottom - platform.y
    const overlapBottom = platform.y + platform.height - player.y

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

    if (minOverlap === overlapTop && player.vy >= 0) {
      return { side: 'top', overlap: overlapTop }
    }
    // ... handle other sides
  }
  return null
}
```

### Moving Platforms

```typescript
function updateMovingPlatform(platform: MovingPlatform, deltaTime: number) {
  // Oscillate between start and end positions
  const progress = (Math.sin(Date.now() / 1000 * platform.speed) + 1) / 2
  platform.x = platform.startX + (platform.endX - platform.startX) * progress

  // Carry player if standing on platform
  if (player.standingOn === platform.id) {
    player.x += platform.dx
  }
}
```

## State Management Patterns

### Zustand Store with Immer

```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

type WorldState = {
  currentScreen: 'overworld' | 'level' | 'level_complete' | 'skill_unlock'
  worlds: World[]
  unlockedSkills: SkillId[]
  // actions
  completeLevel: (worldId: WorldId, stars: number) => void
  unlockSkill: (skillId: SkillId) => void
}

export const useWorldStore = create<WorldState>()(
  persist(
    immer((set) => ({
      currentScreen: 'overworld',
      worlds: INITIAL_WORLDS,
      unlockedSkills: [],

      completeLevel: (worldId, stars) =>
        set((state) => {
          const world = state.worlds.find((w) => w.id === worldId)
          if (world) {
            world.completed = true
            world.stars = Math.max(world.stars, stars)
          }
        }),

      unlockSkill: (skillId) =>
        set((state) => {
          if (!state.unlockedSkills.includes(skillId)) {
            state.unlockedSkills.push(skillId)
          }
        }),
    })),
    { name: 'world-game-progress' }
  )
)
```

### CRITICAL: Immutable Skill State Updates

```typescript
// ❌ WRONG - Zustand freezes state, causes error
skillState.doubleJump.jumpsRemaining -= 1

// ✅ CORRECT - Create new objects
const newSkillState: SkillState = {
  ...skillState,
  doubleJump: {
    ...skillState.doubleJump,
    jumpsRemaining: skillState.doubleJump.jumpsRemaining - 1,
  },
}
```

### Ref for Game Loop Performance

```typescript
// Use ref for values accessed every frame
const skillStateRef = useRef<SkillState>(createInitialSkillState())
const keysRef = useRef<Set<string>>(new Set())
const playerRef = useRef<Player>(createPlayer())

// Sync from Zustand only when needed
useEffect(() => {
  skillStateRef.current = skillState
}, [skillState])

// In game loop, access ref (no re-render triggers)
const skills = skillStateRef.current
if (skills.doubleJump.jumpsRemaining > 0) {
  // ...
}
```

## Input Handling Patterns

### Keyboard Input

```typescript
const keysRef = useRef<Set<string>>(new Set())

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    keysRef.current.add(e.key.toLowerCase())

    // Prevent default for game keys
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
      e.preventDefault()
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    keysRef.current.delete(e.key.toLowerCase())
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  return () => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  }
}, [])
```

### Touch Controls

```typescript
<div className="touch-controls">
  <button
    onTouchStart={() => keysRef.current.add('arrowleft')}
    onTouchEnd={() => keysRef.current.delete('arrowleft')}
  >
    ←
  </button>
  <button
    onTouchStart={() => keysRef.current.add('arrowright')}
    onTouchEnd={() => keysRef.current.delete('arrowright')}
  >
    →
  </button>
  <button
    onTouchStart={() => handleJump()}
    className="jump-button"
  >
    Jump
  </button>
</div>
```

## Canvas Rendering Patterns

### Layered Rendering

```typescript
function render(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas

  // 1. Clear canvas
  ctx.clearRect(0, 0, width, height)

  // 2. Background (parallax layers)
  renderBackground(ctx, camera)

  // 3. Platforms
  platforms.forEach((p) => renderPlatform(ctx, p, camera))

  // 4. Collectibles (with bob animation)
  collectibles.forEach((c) => renderCollectible(ctx, c, camera))

  // 5. Exit portal
  renderExitPortal(ctx, exitPortal, camera)

  // 6. Player
  renderPlayer(ctx, player, camera)

  // 7. Particles (on top)
  particles.forEach((p) => renderParticle(ctx, p, camera))
}
```

### Camera Follow

```typescript
function updateCamera(player: Player, levelWidth: number, canvasWidth: number) {
  // Target position (centered on player)
  const targetX = player.x - canvasWidth / 2

  // Clamp to level bounds
  const minX = 0
  const maxX = levelWidth - canvasWidth

  // Smooth follow
  camera.x += (targetX - camera.x) * 0.1

  // Apply bounds
  camera.x = Math.max(minX, Math.min(maxX, camera.x))
}
```

### Render with Camera Offset

```typescript
function renderPlatform(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  camera: Camera
) {
  const screenX = platform.x - camera.x
  const screenY = platform.y - camera.y

  // Cull off-screen platforms
  if (screenX + platform.width < 0 || screenX > ctx.canvas.width) {
    return
  }

  ctx.fillStyle = platform.color
  ctx.fillRect(screenX, screenY, platform.width, platform.height)
}
```

## Skill System Patterns

### Skill Configuration

```typescript
type SkillConfig = {
  id: SkillId
  name: string
  description: string
  control: string
  cooldown: number
  duration?: number
}

const SKILL_CONFIGS: Record<SkillId, SkillConfig> = {
  double_jump: {
    id: 'double_jump',
    name: 'Double Jump',
    description: 'Jump again while airborne',
    control: 'Space (airborne)',
    cooldown: 0, // Resets on land
  },
  dash: {
    id: 'dash',
    name: 'Dash',
    description: 'Quick horizontal burst',
    control: 'Shift',
    cooldown: 2000,
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    description: 'Temporary invulnerability',
    control: 'Q',
    cooldown: 10000,
    duration: 2000,
  },
  // ... more skills
}
```

### Skill Physics Application

```typescript
function applySkillPhysics(
  player: Player,
  skillState: SkillState,
  keys: Set<string>,
  deltaTime: number
): { player: Player; skillState: SkillState } {
  // Deep clone to ensure immutability
  let newPlayer = { ...player }
  let newSkillState = structuredClone(skillState)

  // Double Jump
  if (
    newSkillState.doubleJump.jumpsRemaining > 0 &&
    keys.has(' ') &&
    !player.grounded &&
    !newSkillState.doubleJump.justJumped
  ) {
    newPlayer.vy = JUMP_FORCE
    newSkillState.doubleJump.jumpsRemaining -= 1
    newSkillState.doubleJump.justJumped = true
  }

  // Reset on land
  if (player.grounded) {
    newSkillState.doubleJump.jumpsRemaining = 1
    newSkillState.doubleJump.justJumped = false
  }

  // Dash skill
  if (keys.has('shift') && newSkillState.dash.canDash) {
    newPlayer.vx = player.facingRight ? DASH_SPEED : -DASH_SPEED
    newSkillState.dash.canDash = false
    newSkillState.dash.cooldownEnd = Date.now() + 2000
  }

  // Update cooldowns
  if (Date.now() >= newSkillState.dash.cooldownEnd) {
    newSkillState.dash.canDash = true
  }

  return { player: newPlayer, skillState: newSkillState }
}
```

## Level Generation Patterns

### Seeded Random

```typescript
function createSeededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

// Use world ID as seed for deterministic generation
const seed = worldId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
const random = createSeededRandom(seed)
```

### Platform Generation

```typescript
function generatePlatforms(
  levelWidth: number,
  difficulty: number,
  random: () => number
): Platform[] {
  const platforms: Platform[] = []

  // Ground platforms
  platforms.push({
    x: 0,
    y: GROUND_Y,
    width: 200,
    height: 20,
    type: 'static',
  })

  // Procedural platforms
  let x = 250
  while (x < levelWidth - 200) {
    const gap = 80 + random() * 60 * difficulty
    const y = 80 + random() * 100
    const width = 60 + random() * 40

    platforms.push({
      x,
      y,
      width,
      height: 15,
      type: random() > 0.8 ? 'moving' : 'static',
    })

    x += width + gap
  }

  return platforms
}
```

## Particle System Patterns

```typescript
type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

function createDustParticles(x: number, y: number, count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x,
    y,
    vx: (Math.random() - 0.5) * 2,
    vy: -Math.random() * 2,
    life: 30,
    maxLife: 30,
    color: '#a0a0a0',
    size: 2 + Math.random() * 2,
  }))
}

function updateParticles(particles: Particle[], deltaTime: number): Particle[] {
  return particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx * deltaTime,
      y: p.y + p.vy * deltaTime,
      vy: p.vy + 0.1 * deltaTime, // gravity
      life: p.life - deltaTime,
    }))
    .filter((p) => p.life > 0)
}

function renderParticle(ctx: CanvasRenderingContext2D, p: Particle, camera: Camera) {
  const alpha = p.life / p.maxLife
  ctx.globalAlpha = alpha
  ctx.fillStyle = p.color
  ctx.fillRect(p.x - camera.x, p.y - camera.y, p.size, p.size)
  ctx.globalAlpha = 1
}
```

## Screen State Machine

```typescript
type Screen = 'overworld' | 'level' | 'level_complete' | 'skill_unlock'

// Transitions
// overworld → (select level) → level
// level → (reach exit) → level_complete
// level_complete → (world complete?) → skill_unlock OR overworld
// skill_unlock → (continue) → overworld

function WorldGame() {
  const { currentScreen, setScreen } = useWorldStore()

  return (
    <div className="game-container">
      {currentScreen === 'overworld' && <WorldMap />}
      {currentScreen === 'level' && <LevelCanvas />}
      {currentScreen === 'level_complete' && <LevelComplete />}
      {currentScreen === 'skill_unlock' && <SkillUnlock />}
    </div>
  )
}
```

## Performance Tips

1. **Use refs for game loop data** - Avoid state that triggers re-renders
2. **Cull off-screen objects** - Don't render what's not visible
3. **Object pooling** - Reuse particles and collectibles
4. **Minimize allocations** - Pre-allocate arrays in game loop
5. **Use typed arrays** - Float32Array for large data sets
6. **Throttle Zustand updates** - Batch state changes

## Testing Game Code

```typescript
describe('Platform Collision', () => {
  it('detects top collision correctly', () => {
    const player = { x: 100, y: 50, width: 16, height: 24, vy: 5 }
    const platform = { x: 90, y: 70, width: 50, height: 15 }

    const result = checkPlatformCollision(player, platform)

    expect(result).not.toBeNull()
    expect(result?.side).toBe('top')
  })

  it('returns null when no collision', () => {
    const player = { x: 0, y: 0, width: 16, height: 24, vy: 0 }
    const platform = { x: 200, y: 200, width: 50, height: 15 }

    expect(checkPlatformCollision(player, platform)).toBeNull()
  })
})

describe('Skill Physics', () => {
  it('decrements double jump on use', () => {
    const skillState = createInitialSkillState()
    skillState.doubleJump.jumpsRemaining = 1

    const { skillState: newState } = applySkillPhysics(
      { ...player, grounded: false },
      skillState,
      new Set([' ']),
      1
    )

    expect(newState.doubleJump.jumpsRemaining).toBe(0)
  })

  it('maintains immutability', () => {
    const originalState = createInitialSkillState()
    Object.freeze(originalState)
    Object.freeze(originalState.doubleJump)

    // Should not throw
    expect(() => {
      applySkillPhysics(player, originalState, new Set(), 1)
    }).not.toThrow()
  })
})
```

---

**Remember**: Game development in React requires careful state management. Use refs for frequently-changing values, immutable updates for Zustand, and requestAnimationFrame for smooth 60fps rendering.
