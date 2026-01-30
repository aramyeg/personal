# Game Architecture

## Portfolio Career Platformer

This portfolio features a Super Mario World-inspired career journey platformer.

## Core Architecture

### File Structure

```
lib/game/world/
├── index.ts              # Barrel export - public API
├── types.ts              # World, Level, Skill type definitions
├── worldData.ts          # World/level configuration
├── worldState.ts         # Zustand store for progression
├── levelGenerator.ts     # Procedural platform/collectible generation
├── skillConfig.ts        # Skill definitions and effects
└── skillPhysics.ts       # Immutable skill physics processing

components/sections/
├── career-game.tsx       # Entry point
└── world-game.tsx        # Main game (~900 lines)

components/game/
├── overworld/
│   ├── WorldMap.tsx      # Canvas-based overworld
│   └── LevelSelectModal.tsx
├── LevelComplete.tsx     # Star rating screen
├── SkillUnlock.tsx       # Skill unlock celebration
└── GameHUD.tsx           # In-game HUD
```

### Component Hierarchy

```
<CareerGame>
  └── <WorldGame>
        ├── <WorldMap>              (screen === 'overworld')
        │   └── <LevelSelectModal>
        ├── <canvas>                (screen === 'level')
        ├── <LevelComplete>         (screen === 'level_complete')
        └── <SkillUnlock>           (screen === 'skill_unlock')
```

### Screen State Machine

```
type Screen = 'overworld' | 'level' | 'level_complete' | 'skill_unlock'

Transitions:
  overworld → (select level) → level
  level → (reach exit) → level_complete
  level_complete → (world complete?) → skill_unlock OR overworld
  skill_unlock → (continue) → overworld
```

## Worlds and Skills

| # | World ID | Company | Theme | Skill Granted |
|---|----------|---------|-------|---------------|
| 1 | bluenet | BlueNet / FreeDOM | hotel | double_jump |
| 2 | flyerbee | FLYERBEE AG | logistics | wall_slide |
| 3 | 360dialog | 360dialog | messaging | dash |
| 4 | accenture | Accenture | banking | shield |
| 5 | akna | AKNA | ecommerce | magnet |
| 6 | xdatagroup | xDataGroup | fintech | float |

## Skill Controls

| Skill | Control | Effect | Cooldown |
|-------|---------|--------|----------|
| double_jump | Space (airborne) | Extra mid-air jump | Resets on land |
| wall_slide | Touch wall + Space | Slide walls + wall jump | None |
| dash | Shift | Horizontal speed burst | 2s |
| shield | Q | 2s invulnerability | 10s |
| magnet | Passive | 2x collectible radius | Always on |
| float | Hold Space | Reduced gravity 1s | Resets on land |

## Critical Patterns

### 1. Immutable Skill State (MANDATORY)

Zustand with Immer freezes state. NEVER mutate directly:

```typescript
// ❌ WRONG - causes runtime error
skillState.doubleJump.jumpsRemaining -= 1

// ✅ CORRECT - create new objects
const newSkillState = {
  ...skillState,
  doubleJump: {
    ...skillState.doubleJump,
    jumpsRemaining: skillState.doubleJump.jumpsRemaining - 1,
  },
}
```

### 2. Refs for Game Loop

Use refs for values accessed every frame to avoid re-renders:

```typescript
const skillStateRef = useRef<SkillState>(createInitialSkillState())
const keysRef = useRef<Set<string>>(new Set())

// Sync from Zustand when needed
useEffect(() => {
  skillStateRef.current = skillState
}, [skillState])
```

### 3. Delta Time Physics

Always use delta time for frame-rate independent physics:

```typescript
const deltaTime = Math.min((now - lastTime) / 16.67, 2)
player.x += player.vx * deltaTime
player.vy += GRAVITY * deltaTime
```

### 4. Seeded Random for Levels

Use deterministic generation for consistent levels:

```typescript
const seed = worldId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
const random = createSeededRandom(seed)
```

## Physics Constants

```typescript
const CONFIG = {
  gravity: 0.5,
  jumpForce: -11,
  moveSpeed: 4,
  friction: 0.85,
  playerWidth: 16,
  playerHeight: 24,
}
```

## Canvas Dimensions

- Game canvas: 620×220 pixels
- Overworld map: 620×300 pixels

## Star Rating

```typescript
function calculateStars(deaths: number, collectRatio: number): 1 | 2 | 3 {
  if (deaths === 0 && collectRatio >= 0.9) return 3
  if (deaths <= 1 && collectRatio >= 0.6) return 2
  return 1
}
```

## Development Commands

```bash
npm run dev          # Start development server
npm test             # Run tests
npm run test:coverage # Check coverage
```

## Debug Tips

1. Check `currentScreen` if game doesn't show
2. Verify `unlockedSkills` array for skill issues
3. Check localStorage `world-game-progress` for state issues
4. Reset progress: `localStorage.removeItem('world-game-progress')`

## Key Files Reference

| Purpose | Path |
|---------|------|
| Main Game | `components/sections/world-game.tsx` |
| Game State | `lib/game/world/worldState.ts` |
| Skill Physics | `lib/game/world/skillPhysics.ts` |
| World Data | `lib/game/world/worldData.ts` |
| Game Types | `lib/game/world/types.ts` |
