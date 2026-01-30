# Career Platformer - Game Design Document

## Overview

A Super Mario World-inspired career journey platformer that transforms professional experience into playable game worlds. Each world represents a job/company from the developer's career, with platforming challenges and skill unlocks.

**Current Status**: World Mode only (Classic mode removed for simplicity)

---

## Quick Reference

### Screen Flow
```
Overworld Map → Level Select Modal → Level Gameplay → Level Complete → Skill Unlock (if applicable) → Overworld
```

### Controls
| Action | Keyboard | Description |
|--------|----------|-------------|
| Move Left | `←` or `A` | Move player left |
| Move Right | `→` or `D` | Move player right |
| Jump | `↑` or `W` or `Space` | Jump (hold for higher) |
| Dash | `Shift` | Horizontal speed burst (when unlocked) |
| Shield | `Q` | Activate invulnerability (when unlocked) |

### Game Objective
1. Start at World 1 (BlueNet)
2. Complete the level by reaching the exit portal
3. Collect items for higher star ratings
4. Completing a world unlocks a new skill
5. Progress through all 6 worlds

---

## Architecture

### File Structure

```
lib/game/world/
├── index.ts              # Barrel export - public API
├── types.ts              # World, Level, Skill type definitions
├── worldData.ts          # World/level configuration and generation
├── worldState.ts         # Zustand store for world progression
├── levelGenerator.ts     # Procedural level platform/collectible generation
├── skillConfig.ts        # Skill definitions, effects, and state
└── skillPhysics.ts       # Immutable skill physics processing

components/sections/
├── career-game.tsx       # Entry point (renders WorldGame directly)
└── world-game.tsx        # Main game component (~900 lines)
                          # - Own game loop (requestAnimationFrame)
                          # - Canvas rendering
                          # - Physics and collision
                          # - Screen state management

components/game/
├── overworld/
│   ├── WorldMap.tsx        # Canvas-based overworld map
│   └── LevelSelectModal.tsx # Modal for level selection
├── LevelComplete.tsx       # Star rating and stats screen
├── SkillUnlock.tsx         # Skill unlock celebration
└── GameHUD.tsx             # In-game HUD (lives, score, skills)
```

### Component Hierarchy

```
<CareerGame>
  └── <WorldGame>
        ├── <WorldMap>              (when screen === 'overworld')
        │   └── <LevelSelectModal>  (when world selected)
        ├── <canvas>                (when screen === 'level')
        ├── <LevelComplete>         (when screen === 'level_complete')
        └── <SkillUnlock>           (when screen === 'skill_unlock')
```

### State Management

**Zustand Store** (`lib/game/world/worldState.ts`):
- Persists to `localStorage` key: `world-game-progress`
- Manages: screen state, world/level progress, unlocked skills, star ratings

**Key State Shape**:
```typescript
type WorldState = {
  currentScreen: 'overworld' | 'level' | 'level_complete' | 'skill_unlock'
  selectedWorldId: WorldId | null
  currentWorldId: WorldId | null
  currentLevelId: string | null
  worlds: World[]
  unlockedSkills: SkillId[]
  levelDeaths: number
  levelCollectiblesCollected: number
  skillState: SkillState
  // ... more
}
```

---

## Worlds (6 Total)

Each world represents a company/job in chronological order. **1 level per world**.

| # | World ID | Company | Theme | Skill Granted |
|---|----------|---------|-------|---------------|
| 1 | bluenet | BlueNet / FreeDOM | hotel | double_jump |
| 2 | flyerbee | FLYERBEE AG | logistics | wall_slide |
| 3 | 360dialog | 360dialog | messaging | dash |
| 4 | accenture | Accenture | banking | shield |
| 5 | akna | AKNA | ecommerce | magnet |
| 6 | xdatagroup | xDataGroup | fintech | float |

### World Themes

| Theme | Primary Color | Background Style | Platform Style |
|-------|--------------|------------------|----------------|
| hotel | Purple (#8B5CF6) | city | tech_block |
| logistics | Amber (#F59E0B) | nature | server_rack |
| messaging | Emerald (#10B981) | tech | cloud |
| banking | Blue (#3B82F6) | corporate | mobile_device |
| ecommerce | Pink (#EC4899) | city | code_block |
| fintech | Cyan (#06B6D4) | corporate | terminal |

### World Progression

1. World 1 (BlueNet) unlocked by default
2. Complete the level → World marked complete
3. Completing world grants skill + unlocks next world
4. Skills persist across all levels

---

## Levels

### Single Level Per World

Each world has exactly **1 level** with:
- **Name**: Company name (e.g., "BlueNet / FreeDOM")
- **Difficulty**: 2 (medium)
- **Width**: 45 tiles (1440px)

### Level Components

| Component | Description |
|-----------|-------------|
| Spawn Point | Player starting position (x: 50, y: 150) |
| Exit Portal | Green glowing portal at level end |
| Platforms | Static and moving platforms |
| Collectibles | Tech icons (50pts), coins (10pts), power-ups (100pts) |
| Ground | Base platforms at bottom |

### Star Rating System

```typescript
function calculateStars(deaths: number, collectRatio: number): 1 | 2 | 3 {
  if (deaths === 0 && collectRatio >= 0.9) return 3
  if (deaths <= 1 && collectRatio >= 0.6) return 2
  return 1
}
```

- ⭐⭐⭐: No deaths + 90%+ collectibles
- ⭐⭐: ≤1 death + 60%+ collectibles
- ⭐: Completed

---

## Skills (6 Total)

Skills are unlocked by completing worlds. All use **immutable state updates**.

| Skill | Unlocked By | Effect | Control | Cooldown |
|-------|-------------|--------|---------|----------|
| double_jump | World 1 | Extra mid-air jump | Space (airborne) | Resets on land |
| wall_slide | World 2 | Slide walls + wall jump | Touch wall + Space | None |
| dash | World 3 | Horizontal speed burst | Shift | 2s |
| shield | World 4 | 2s invulnerability | Q | 10s |
| magnet | World 5 | 2x collectible radius | Passive | Always on |
| float | World 6 | Reduced gravity 1s | Hold Space | Resets on land |

### Skill Physics (IMPORTANT)

Located in `lib/game/world/skillPhysics.ts`.

**Critical**: All skill state updates are **immutable**. The Zustand store freezes state objects, so direct mutation causes errors.

```typescript
// WRONG - causes "Cannot assign to read only property" error
skillState.doubleJump.jumpsRemaining -= 1

// CORRECT - create new objects
newSkillState = {
  ...skillState,
  doubleJump: {
    jumpsRemaining: skillState.doubleJump.jumpsRemaining - 1,
  },
}
```

The `applySkillPhysics()` function:
1. Deep clones input skillState
2. Processes each skill immutably
3. Returns new physics + skillState objects
4. Called every frame in game loop

---

## Game Loop

Located in `world-game.tsx` as a `useCallback` with `requestAnimationFrame`.

### Frame Update Order

1. Calculate delta time
2. Process skill physics (`applySkillPhysics`)
3. Apply gravity and friction
4. Handle horizontal movement
5. Check platform collisions
6. Check death conditions (fall off screen)
7. Check exit portal collision
8. Update collectibles
9. Update camera position
10. Update particles
11. Render everything

### Physics Constants

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

### Canvas Dimensions

- Game canvas: 620×220 pixels
- Overworld map: 620×300 pixels

---

## Level Generation

Located in `lib/game/world/levelGenerator.ts`.

### `populateLevelData(level, seed)`

Generates platforms and collectibles using seeded random for consistency.

**Platform Types**:
- `static`: Fixed position
- `moving`: Oscillates between startX and endX
- `skill_gated`: Requires specific skill (visual indicator only)

**Collectible Types**:
- `tech`: Technology icon (50 points)
- `coin`: Gold coin (10 points)
- `powerup`: Special item (100 points)

### Seeded Random

Uses world ID as seed for deterministic level generation:
```typescript
const seed = worldId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
```

---

## Rendering

### WorldGame Rendering Layers

1. Background (gradient/pattern)
2. Platforms (colored rectangles)
3. Collectibles (animated icons)
4. Exit portal (green glow effect)
5. Player (character sprite)
6. Skill effects (dash trail, shield bubble, float particles)
7. Particles (dust, sparkles)
8. HUD (lives, score, collectible count)

### WorldMap Rendering

Canvas-based with:
- Background gradient
- Path connections between worlds (Bézier curves)
- World nodes (circles with state colors)
- Lock icons for locked worlds
- Star indicators for completed worlds

---

## Key Patterns

### Screen State Machine

```typescript
type Screen = 'overworld' | 'level' | 'level_complete' | 'skill_unlock'

// Transitions:
// overworld → (select level) → level
// level → (reach exit) → level_complete
// level_complete → (world complete?) → skill_unlock OR overworld
// skill_unlock → (continue) → overworld
```

### Skill State Sync

The game loop uses a local ref (`skillStateRef`) for performance, synced from Zustand on mount:

```typescript
const skillStateRef = useRef<SkillState>(createInitialSkillState())

useEffect(() => {
  skillStateRef.current = skillState
}, [skillState])
```

**Important**: Don't call `updateSkillState()` every frame - it causes React re-render errors.

### Death Handling

```typescript
const handleDeath = useCallback(() => {
  recordDeath()  // Increments levelDeaths in Zustand
  const newLives = lives - 1
  if (newLives <= 0) {
    setGameOver(true)
  } else {
    respawnPlayer()
  }
}, [lives, recordDeath, respawnPlayer])
```

---

## Testing & Debugging

### Local Development

```bash
npm run dev
# Game appears in Timeline section of homepage
```

### Debug Tips

1. **Check currentScreen**: If game doesn't show, verify `currentScreen` is 'overworld'
2. **Skill not working**: Check if skill is in `unlockedSkills` array
3. **Level won't complete**: Verify exit portal position and collision detection
4. **State issues**: Check localStorage `world-game-progress` key

### Reset Progress

Clear localStorage to reset all progress:
```javascript
localStorage.removeItem('world-game-progress')
```

---

## Future Enhancements (Not Implemented)

- Sound effects and music
- Mobile touch controls for skills
- Skill-gated platform blocking (currently visual only)
- Character animations for skills
- Particle effects for skills
- Additional worlds/levels
- Boss encounters
- Leaderboards
- Character customization

---

## Implementation Status

### Completed ✓
- [x] World system with 6 worlds
- [x] Single level per world
- [x] Overworld map navigation
- [x] Level gameplay with physics
- [x] Exit portal detection
- [x] All 6 skills implemented
- [x] Skill physics (immutable)
- [x] Star rating system
- [x] Level completion screen
- [x] Skill unlock celebration
- [x] Progress persistence
- [x] Removed classic mode

### Pending
- [ ] Skill-gated platform collision blocking
- [ ] Skill visual effects (particles, animations)
- [ ] Mobile touch controls for skills
- [ ] Sound system
- [ ] Testing & balancing
